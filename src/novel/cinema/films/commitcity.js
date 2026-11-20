import * as THREE from 'three'
import { toon, sky, frameLeft } from './kit'

/*
 * Commit City, the film: a year of commits as a city. The contribution graph (52 weeks by 7 days) lies
 * on the ground like a map; you walk along its front edge and, week by week behind you, each day's
 * square rises into a tower as tall as its commits, in the graph's own greens, windows coming on as
 * dusk turns to night. A 12 s loop.
 */
const LOOP = 12
const WEEKS = 52, DAYS = 7, CELL = 0.46

// A plausible year: quiet weekends, busy stretches, a few big days.
function commits(w, d) {
  const n = Math.sin(w * 12.9898 + d * 78.233) * 43758.5453
  const r = n - Math.floor(n)
  const busy = 0.5 + 0.5 * Math.sin(w * 0.35) * Math.sin(w * 0.11 + 1)
  const weekend = d === 0 || d === 6 ? 0.35 : 1
  const c = r < 0.18 ? 0 : Math.floor(r * 14 * busy * weekend)
  return c
}
const GREENS = ['#0e4429', '#006d32', '#26a641', '#39d353'].map(c => new THREE.Color(c))

export async function commitCity({ traveller }) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#2a2350', 18, 70)
  const skyMesh = sky({ top: '#0d0b26', mid: '#3a2d6b', low: '#d86f6a', sun: '#ffb38a', sunDir: new THREE.Vector3(-0.2, 0.03, -1) })
  scene.add(skyMesh)

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), toon({ color: '#1b1830' }))
  ground.receiveShadow = true
  scene.add(ground)

  // The graph: one instanced box per day. Each grows from its square to its height.
  const N = WEEKS * DAYS
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const mat = toon({ color: '#ffffff' })
  // Windows: lit dots on the side faces, more of them as the night comes on.
  const night = { value: 0 }
  mat.onBeforeCompile = sh => {
    sh.uniforms.uNight = night
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vN; uniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (abs(vN.y) < 0.5) {
          vec2 cell = vec2(dot(vW.xz, vec2(1.0)) * 14.0, vW.y * 9.0);
          vec2 f = fract(cell);
          float lit = step(0.55, fract(sin(dot(floor(cell), vec2(12.9898, 78.233))) * 43758.5));
          float win = step(0.25, f.x) * step(f.x, 0.75) * step(0.3, f.y) * step(f.y, 0.75);
          totalEmissiveRadiance += vec3(1.0, 0.82, 0.5) * win * lit * uNight * 1.6 * step(0.12, vW.y);
        }`)
  }
  const towers = new THREE.InstancedMesh(geo, mat, N)
  towers.castShadow = towers.receiveShadow = true
  const data = []
  for (let w = 0; w < WEEKS; w++)
    for (let d = 0; d < DAYS; d++) {
      const c = commits(w, d)
      const i = w * DAYS + d
      data.push({ x: (w - WEEKS / 2) * CELL, z: (d - 3) * CELL - 2.2, h: c ? 0.25 + c * 0.32 : 0.04, w })
      towers.setColorAt(i, c ? GREENS[Math.min(3, Math.floor(c / 3.5))] : new THREE.Color('#2b2d3a'))
    }
  scene.add(towers)

  const sun = new THREE.DirectionalLight('#ffc39a', 2.2)
  sun.position.set(-6, 6, -10)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 8, bottom: -8, near: 1, far: 50 })
  const fill = new THREE.DirectionalLight('#8f9cff', 1.2)
  fill.position.set(6, 5, 8)
  scene.add(sun, fill, new THREE.HemisphereLight('#a99cff', '#2a2040', 1.2))

  const you = traveller.make()
  you.root.rotation.y = Math.PI / 2
  scene.add(you.root)
  you.play('Walk')

  const camera = new THREE.PerspectiveCamera(32, 2.4, 0.1, 400)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), subject = new THREE.Vector3()

  function update(time) {
    const t = time % LOOP
    // You walk the front edge from January to December; each week rises as you pass it.
    const x = -WEEKS * CELL * 0.42 + t * 1.7
    you.root.position.set(x, 0, 0.1)
    const sink = THREE.MathUtils.smoothstep(t, 11.2, 12)
    for (let i = 0; i < N; i++) {
      const b = data[i]
      const rise = THREE.MathUtils.smoothstep(x - b.x, -2.5, 1.5) * (1 - sink)
      const h = 0.04 + (b.h - 0.04) * rise
      m4.compose(p.set(b.x, 0, b.z), q, s.set(CELL * 0.82, h, CELL * 0.82))
      towers.setMatrixAt(i, m4)
    }
    towers.instanceMatrix.needsUpdate = true
    night.value = THREE.MathUtils.smoothstep(t, 2, 9)
    // Camera: a low tracking shot ahead of you, the city rising beside.
    camera.position.set(x + 3.2, 1.6, 5.8)
    frameLeft(camera, subject.set(x, 1.2, -0.6), 1.3)
  }

  return { scene, camera, update, tick(dt) { you.mixer.update(dt) } }
}
