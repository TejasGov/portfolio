import * as THREE from 'three'
import { loadTraveller, toon, paintTexture, textSprite, inkBox } from './films/kit'

/*
 * Chapter Four, "Press Start": an ode to the games Tejas grew up on, in two original worlds that share
 * one place.
 *   The neon coast: an 80s beach boulevard at dusk, pastel hotels with neon trim, palms, a parked coupe,
 *   the sea under a striped sunset. You walk it under a third-person chase camera.
 *   The block world: the same coast rebuilt in voxels under a bright sky.
 * At the end of the boardwalk you reach an arcade cabinet, and a wave rolls out from it: behind its
 * glowing, rippling front the coast is gone and the blocks are there (every coast material discards
 * inside the wave, every block material outside it), with glowing cubes lifting off the front.
 */
export const ARCADE_X = 34.5
const WAVE_GLSL = /* glsl */ `
uniform vec3 uWaveO; uniform float uWaveR; uniform float uWaveSide; uniform float uWaveT;
varying vec3 vWaveP;
float waveD() {
  vec3 p = vWaveP;
  float r = uWaveR + sin(p.x * 0.8 + uWaveT * 1.3) * sin(p.z * 0.65 - uWaveT) * 0.9 + sin(p.y * 1.7 + uWaveT * 2.0) * 0.35;
  return distance(p, uWaveO) - r; // < 0 inside the wave
}`

/** Make a material belong to one side of the wave: side +1 = the coast (gone inside), -1 = the blocks. */
function onWave(mat, side, U) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, { uWaveSide: { value: side } })
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaveP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vWaveP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWaveP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + WAVE_GLSL)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float wd = waveD();
        if (wd * uWaveSide < 0.0) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float crest = exp(-abs(wd) * 1.6) * step(0.01, uWaveR);
        totalEmissiveRadiance += mix(vec3(1.0, 0.45, 0.85), vec3(0.45, 0.9, 1.0), 0.5 + 0.5 * sin(vWaveP.y * 2.0 + uWaveT)) * crest * 2.2;`)
  }
  mat.needsUpdate = true
  return mat
}

/** A sky that crossfades from the neon sunset to the bright block-world day. */
function twoSkies(U) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: { uDay: U.uDay, uT: U.uWaveT },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = (projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0)).xyww; }',
      fragmentShader: /* glsl */ `
        uniform float uDay; uniform float uT; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          // Dusk: violet overhead, magenta to orange at the sea line, a striped sun sinking into it.
          vec3 dusk = mix(vec3(1.0, 0.55, 0.32), vec3(0.92, 0.25, 0.55), smoothstep(0.0, 0.12, h));
          dusk = mix(dusk, vec3(0.16, 0.08, 0.32), smoothstep(0.12, 0.55, h));
          vec3 sd = normalize(vec3(1.0, 0.06, 0.55)); // ahead and to the right of the walk, over the sea
          float s = length(d - sd);
          float disc = smoothstep(0.17, 0.16, s);
          float stripe = step(0.5, fract((d.y - 0.03) * 70.0)) + step(0.075, d.y);
          dusk = mix(dusk, mix(vec3(1.0, 0.85, 0.35), vec3(1.0, 0.35, 0.55), smoothstep(0.2, -0.05, d.y - sd.y + 0.12)), disc * min(stripe, 1.0));
          dusk += vec3(1.0, 0.4, 0.5) * exp(-s * 5.0) * 0.35;
          float star = step(0.9975, fract(sin(dot(floor(d.xz * 300.0), vec2(12.99, 78.23))) * 43758.5)) * smoothstep(0.25, 0.6, h);
          dusk += star * 0.8;
          // Day: clear blue with soft banded clouds.
          vec3 day = mix(vec3(0.75, 0.88, 1.0), vec3(0.32, 0.6, 0.98), smoothstep(0.0, 0.5, h));
          gl_FragColor = vec4(mix(dusk, day, uDay), 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  )
}

function neonSign(text, color, h = 1) {
  const sp = textSprite(text, { font: '400 150px "Instrument Serif", serif', color: '#ffffff', glow: color, size: h, width: 1024, height: 220 })
  sp.material.color.set(color).multiplyScalar(2.2) // past 1, so it blooms
  return sp
}

export function createArcade(renderer, { loader, normalize }) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#3a1d4a', 40, 130)
  const U = { uWaveO: { value: new THREE.Vector3(ARCADE_X, 1, 0.8) }, uWaveR: { value: 0 }, uWaveT: { value: 0 }, uDay: { value: 0 } }
  scene.add(twoSkies(U))
  const coast = (opts) => onWave(toon(opts), 1, U)
  const block = (opts) => onWave(toon(opts), -1, U)

  // ------------------------------------------------------------ the neon coast
  const X0 = -18, X1 = 64
  const strip = (z0, z1, mat, y = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, z1 - z0).rotateX(-Math.PI / 2), mat)
    m.position.set((X0 + X1) / 2, y, (z0 + z1) / 2)
    m.receiveShadow = true
    scene.add(m)
    return m
  }
  strip(-12, -6.5, coast({ color: '#d9b8c8' }))
  strip(-6.5, -1.6, coast({ map: paintTexture('#2c2638', ['#241f30', '#352e44'], { seed: 51 }) }))
  const tiles = paintTexture('#f2d7d0', ['#e8c4bf', '#f8e6df'], { seed: 52 })
  tiles.repeat.set(40, 2)
  strip(-1.6, 1.6, coast({ map: tiles }), 0.02)
  strip(1.6, 14, coast({ map: paintTexture('#f3d9a8', ['#e9c88e', '#f8e5bd'], { seed: 53 }) }))
  // Lane dashes on the road.
  for (let x = X0; x < X1; x += 3) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.12).rotateX(-Math.PI / 2), coast({ color: '#ffe9a8', emissive: '#4a3a10' }))
    dash.position.set(x, 0.01, -4)
    scene.add(dash)
  }
  // The sea: a sunset mirror with a broken path of light toward the sun.
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 260).rotateX(-Math.PI / 2), onWave(new THREE.ShaderMaterial({
    uniforms: { ...U },
    vertexShader: 'varying vec3 vWaveP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWaveP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      ${WAVE_GLSL}
      void main() {
        float wd = waveD(); if (wd < 0.0) discard;
        vec3 v = normalize(vWaveP - cameraPosition);
        float far = smoothstep(0.0, 120.0, distance(vWaveP, cameraPosition));
        vec3 c = mix(vec3(0.42, 0.16, 0.42), vec3(0.95, 0.4, 0.5), far);
        float glint = step(0.6, fract(sin(floor(vWaveP.x * 1.5) * 12.9 + floor(vWaveP.z * 3.0) * 78.2 + uWaveT * 0.6) * 43758.5));
        float path = exp(-abs(vWaveP.x - cameraPosition.x - (vWaveP.z - cameraPosition.z) * 0.55) * 0.08);
        c += vec3(1.0, 0.75, 0.45) * glint * path * 0.9;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }), 1, U))
  sea.position.set(20, -0.05, 144)
  scene.add(sea)

  const props = new THREE.Group()
  scene.add(props)
  const place = (url, size, at, yaw, side = 1) => loader.loadAsync(url).then(gltf => {
    const g = normalize(gltf.scene, size, yaw)
    const box = new THREE.Box3().setFromObject(g)
    g.position.set(at[0], at[1] - box.min.y, at[2])
    g.traverse(o => {
      if (!o.isMesh) return
      o.material = side > 0 ? coast({ map: o.material.map }) : block({ map: o.material.map })
      o.castShadow = o.receiveShadow = true
    })
    props.add(g)
    return g
  }).catch(() => null)
  const HOTELS = []
  for (let i = 0; i < 9; i++) {
    const x = -12 + i * 8.6
    HOTELS.push([x, i % 2])
    place(i % 2 ? '/cinema/arcade/motel.glb' : '/cinema/arcade/hotel.glb', i % 2 ? 9 : 11, [x, 0, -10.5], i % 2 ? -0.1 : 0.15)
  }
  for (let x = -14; x < 60; x += 6.5) place('/cinema/arcade/palm.glb', 6.5 + ((x * 7) % 3), [x, 0, 4.4], x) // on the sand, clear of the chase camera
  for (const [x, z] of [[6, 9], [19, 11], [27, 8], [44, 10]]) place('/cinema/arcade/palm.glb', 7, [x, 0, z], x)
  place('/cinema/arcade/car.glb', 4.4, [12, 0, -3.1], Math.PI / 2 + 0.05)
  place('/cinema/arcade/arcade.glb', 1.9, [ARCADE_X, 0.02, 1.0], -Math.PI / 2 - 0.3)
  // Lamp posts with neon bars, and signs of our own.
  for (let x = -12; x < 60; x += 9) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.2, 8), coast({ color: '#2b2440' }))
    pole.position.set(x, 2.1, -1.9)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), coast({ color: '#000000', emissive: x % 2 ? '#ff3da8' : '#3de4ff', emissiveIntensity: 3 }))
    bar.position.set(x, 4.2, -1.9)
    scene.add(pole, bar)
  }
  const signs = [['Neon Coast', '#ff3da8', -12], ['Motel', '#3de4ff', -3.4], ['Open late', '#ffd23d', 13.8], ['Arcade', '#b06bff', 31]].map(([t, c, x]) => {
    const sign = neonSign(t, c, 1.1)
    sign.position.set(x, 9.2, -6.6)
    scene.add(sign)
    return sign
  })

  // ------------------------------------------------------------ the block world, in the same place
  const cube = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  // One column per metre: top colour by height (sand, grass, stone), sides banded every metre so a
  // column reads as stacked blocks; a little per-block speckle, our own palette, no borrowed textures.
  const blocksMat = block({ color: '#ffffff' })
  const prev = blocksMat.onBeforeCompile
  blocksMat.onBeforeCompile = sh => {
    prev(sh)
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 cell = floor(vWaveP + 0.001);
      float spk = fract(sin(dot(cell, vec3(12.99, 78.23, 37.71))) * 43758.5);
      vec3 f = fract(vWaveP);
      float edge = min(min(min(f.x, 1.0 - f.x), min(f.z, 1.0 - f.z)), min(f.y, 1.0 - f.y));
      diffuseColor.rgb *= (0.9 + 0.12 * spk) * (0.82 + 0.18 * smoothstep(0.0, 0.06, edge));
      // Sides below a thin band at the top: grass columns show their earth, the rest just shade.
      bool side = abs(vWaveN.y) < 0.5;
      bool grassy = diffuseColor.g > diffuseColor.r * 1.25 && diffuseColor.g > diffuseColor.b * 1.2;
      if (side && vWaveP.y < vTop - 0.22) diffuseColor.rgb = grassy ? vec3(0.45, 0.3, 0.2) * (0.9 + 0.15 * spk) : diffuseColor.rgb * 0.78;`)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying float vTop; varying vec3 vWaveN;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vTop = (modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 1.0)).y;
        vWaveN = normal;`)
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying float vTop; varying vec3 vWaveN;`)
  }
  const cols = []
  const hgt = (x, z) => {
    const n = Math.sin(x * 0.17) * Math.cos(z * 0.21) + Math.sin(x * 0.05 + z * 0.08) * 1.6
    const away = Math.min(1, Math.max(0, (Math.abs(z) - 3) / 8)) // flat by the path
    return Math.round(Math.max(0, n * 2.4 + 1.5) * away)
  }
  for (let x = X0; x < X1; x++)
    for (let z = -22; z < 26; z++) {
      if (z >= 14) { cols.push([x, z, 0, '#4aa3df']); continue } // the sea, as water blocks
      const h = Math.abs(z) < 2 ? 0 : hgt(x, z)
      const top = z > 9 ? '#f1d98c' : h > 4 ? '#9aa3ad' : '#6fcf5b'
      cols.push([x, z, h, top])
    }
  const grid = new THREE.InstancedMesh(cube, blocksMat, cols.length)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
  cols.forEach(([x, z, h, c], i) => {
    m4.compose(p.set(x + 0.5, -3, z + 0.5), q, s.set(1, h + 3, 1))
    grid.setMatrixAt(i, m4)
    grid.setColorAt(i, new THREE.Color(c))
  })
  grid.receiveShadow = grid.castShadow = true
  scene.add(grid)
  // Block trees where the palms stood, block towers where the hotels stood, and a few clouds.
  const bits = []
  const addBlock = (x, y, z, sx, sy, sz, c) => bits.push([x, y, z, sx, sy, sz, c])
  for (let x = -14; x < 60; x += 6.5) {
    const h = 4 + Math.round(Math.abs(Math.sin(x)) * 2)
    addBlock(x, 0, 6, 1, h, 1, '#8a5a3a')
    addBlock(x, h, 6, 3, 2, 3, '#4f9e3c')
    addBlock(x, h + 2, 6, 1, 1, 1, '#5fb24a')
  }
  for (const [x, odd] of HOTELS) {
    const floors = odd ? 3 : 5
    const tint = ['#f4b3c9', '#a8e6d3', '#ffd0a8', '#c9b6f2'][Math.abs(Math.round(x)) % 4]
    for (let f = 0; f < floors; f++) addBlock(x, f * 2, -10.5, odd ? 8 : 6, 2, 6, f % 2 ? tint : '#f6efe4')
  }
  for (const [x, y, z] of [[0, 22, -30], [18, 26, -24], [36, 21, -34], [52, 25, -20], [8, 28, 30]]) addBlock(x, y, z, 9, 1.5, 5, '#ffffff')
  const blocks = new THREE.InstancedMesh(cube, blocksMat, bits.length)
  bits.forEach(([x, y, z, sx, sy, sz, c], i) => {
    m4.compose(p.set(x, y, z), q, s.set(sx, sy, sz))
    blocks.setMatrixAt(i, m4)
    blocks.setColorAt(i, new THREE.Color(c))
  })
  blocks.castShadow = blocks.receiveShadow = true
  scene.add(blocks)

  // Glowing cubes lifting off the wave front.
  const MOTES = 260
  const motes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd6f4').multiplyScalar(3), transparent: true, opacity: 0.9, depthWrite: false }), MOTES)
  const moteDir = Array.from({ length: MOTES }, () => new THREE.Vector3().randomDirection().setY(Math.random() * 0.5).normalize())
  const moteSeed = Array.from({ length: MOTES }, () => Math.random())
  motes.frustumCulled = false
  scene.add(motes)

  // ------------------------------------------------------------ light
  const sun = new THREE.DirectionalLight('#ffb2a0', 2.2)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 })
  const hemi = new THREE.HemisphereLight('#c79bff', '#3a2140', 1.4)
  scene.add(sun, sun.target, hemi)

  let you = null
  loadTraveller(loader).then(t => {
    you = t.make()
    scene.add(you.root)
  })

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 700)
  const look = new THREE.Vector3(), cam = new THREE.Vector3()
  let lastT = null, cue = ''

  /**
   * state: { p (0..1 through the chapter) }. Walk the coast (to the arcade), the wave, walk the blocks.
   * Returns where you are, for the ink seams.
   */
  function update(state, t, aspect) {
    const P = state.p
    const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
    const walk1 = ss(0.04, 0.5, P), wave = ss(0.56, 0.76, P), walk2 = ss(0.78, 0.95, P)
    const x = THREE.MathUtils.lerp(-10, ARCADE_X - 1.4, walk1) + walk2 * 20
    const dt = lastT === null ? 0 : Math.min(0.1, t - lastT)
    lastT = t
    U.uWaveT.value = t
    U.uWaveR.value = wave <= 0 ? 0 : wave >= 1 ? 1e4 : 0.6 + wave * wave * 130
    U.uDay.value = ss(0.6, 0.78, P)
    scene.fog.color.set('#3a1d4a').lerp(new THREE.Color('#bfe0ff'), U.uDay.value)
    sun.color.set('#ffb2a0').lerp(new THREE.Color('#fff6e0'), U.uDay.value)
    sun.intensity = 2.2 + U.uDay.value * 1.2
    hemi.color.set('#c79bff').lerp(new THREE.Color('#e6f2ff'), U.uDay.value)
    hemi.groundColor.set('#3a2140').lerp(new THREE.Color('#6a8a50'), U.uDay.value)

    if (you) {
      you.root.position.set(x, 0.02, 0)
      const moving = (walk1 > 0 && walk1 < 1) || (walk2 > 0 && walk2 < 1)
      const atArcade = P > 0.5 && P < 0.56
      const jumping = P >= 0.575 && P < 0.62
      const happy = P > 0.95
      const next = jumping ? 'Regular_Jump' : happy ? 'happy_jump_m' : atArcade ? 'Idle' : moving ? 'Walk' : 'Idle'
      if (next !== cue) {
        cue = next
        you.play(you.actions[next] ? next : 'Idle', { fade: 0.3 })
      }
      const face = atArcade ? -0.25 : Math.PI / 2
      you.root.rotation.y += (face - you.root.rotation.y) * 0.1
      you.mixer.update(dt)
    }
    // Sprites can't take the wave's discard: switch the signs off as the front passes them.
    for (const sign of signs) sign.visible = sign.position.distanceTo(U.uWaveO.value) > U.uWaveR.value
    // Motes: on the wave's front, drifting up and out.
    if (wave > 0 && wave < 1) {
      const R = U.uWaveR.value
      for (let i = 0; i < MOTES; i++) {
        const k = (t * 0.25 + moteSeed[i]) % 1
        p.copy(moteDir[i]).multiplyScalar(R * (0.96 + 0.06 * k)).add(U.uWaveO.value)
        p.y = Math.max(0.2, p.y) + k * 3
        const near = THREE.MathUtils.smoothstep(p.distanceTo(camera.position), 3, 7) // none brush the lens
        m4.compose(p, q.setFromEuler(new THREE.Euler(k * 6, k * 4, 0)), s.setScalar((1 - k) * near))
        motes.setMatrixAt(i, m4)
      }
      motes.instanceMatrix.needsUpdate = true
      motes.visible = true
    } else motes.visible = false

    // The third-person chase camera: behind and a little above, looking down the boulevard.
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    const portrait = aspect < 0.85
    cam.set(x - (portrait ? 7.5 : 5.2), portrait ? 3.6 : 2.5, portrait ? 2.6 : 1.9)
    camera.position.lerp(cam, camera.position.lengthSq() ? 0.12 : 1)
    look.set(x + 6, 1.5, -1.2)
    camera.lookAt(look)
    sun.position.set(x + 20, 14, 30)
    sun.target.position.set(x, 0, 0)
    return { here: you ? you.root.position : look }
  }

  return { scene, camera, update }
}
