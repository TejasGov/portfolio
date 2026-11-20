import * as THREE from 'three'
import { loadTraveller, toon } from './films/kit'
import { buildOceanDrive, duskSky } from './oceandrive'

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
  mat.userData.waveSide = side
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

export function createArcade(renderer, { loader, normalize, mobile = false }) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#5a3a66', 55, 190)
  const U = { uWaveO: { value: new THREE.Vector3(ARCADE_X, 1, 0.8) }, uWaveR: { value: 0 }, uWaveT: { value: 0 }, uDay: { value: 0 } }
  const sky = duskSky(U)
  scene.add(sky)
  let envDusk, envDay
  // The sky also lights the street and shows in every glass, car and puddle: an environment map of it.
  {
    const envScene = new THREE.Scene()
    envScene.add(duskSky({ uDay: { value: 0 } }))
    const pm = new THREE.PMREMGenerator(renderer)
    envDusk = pm.fromScene(envScene, 0.02).texture
    const dayScene = new THREE.Scene()
    dayScene.add(duskSky({ uDay: { value: 1 } }))
    envDay = pm.fromScene(dayScene, 0.02).texture
    scene.environment = envDusk
    scene.environmentIntensity = 1.2
  }
  const coast = m => onWave(m, 1, U)
  const block = (opts) => onWave(toon(opts), -1, U)

  // ------------------------------------------------------------ the neon coast (oceandrive.js)
  const drive = buildOceanDrive(scene, { wrap: coast, mobile })
  // The sea: the dusk in a long, low swell, a broken path of light toward the sun.
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 300).rotateX(-Math.PI / 2), onWave(new THREE.ShaderMaterial({
    uniforms: { ...U },
    vertexShader: 'varying vec3 vWaveP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWaveP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
      ${WAVE_GLSL}
      void main() {
        float wd = waveD(); if (wd < 0.0) discard;
        float far = smoothstep(0.0, 160.0, distance(vWaveP, cameraPosition));
        vec3 c = mix(vec3(0.16, 0.2, 0.36), vec3(0.95, 0.5, 0.52), far * far);
        float swell = sin(vWaveP.z * 0.9 + uWaveT * 0.8 + sin(vWaveP.x * 0.3)) * 0.5 + 0.5;
        c *= 0.85 + 0.25 * swell;
        float glint = step(0.72, fract(sin(floor(vWaveP.x * 1.2) * 12.9 + floor(vWaveP.z * 2.4) * 78.2 + floor(uWaveT * 2.0)) * 43758.5));
        float path = exp(-abs((vWaveP.z - cameraPosition.z) * 0.55 - (vWaveP.x - cameraPosition.x) * 0.0 - 0.0) * 0.0) * exp(-abs(atan(vWaveP.z - cameraPosition.z, vWaveP.x - cameraPosition.x) + 0.5) * 3.0);
        c += vec3(1.0, 0.72, 0.45) * glint * path * 1.4;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }), 1, U))
  sea.position.set(20, -0.05, 176)
  scene.add(sea)

  const props = new THREE.Group()
  const shadows = { side: 0 } // which world casts shadows right now (see update)
  scene.add(props)
  const place = (url, size, at, yaw, { side = 1, tint = null, rough = 0.75, metal = 0 } = {}) => loader.loadAsync(url).then(gltf => {
    const g = normalize(gltf.scene, size, yaw)
    const box = new THREE.Box3().setFromObject(g)
    g.position.set(at[0], at[1] - box.min.y, at[2])
    g.traverse(o => {
      if (!o.isMesh) return
      o.material = side > 0
        ? coast(new THREE.MeshStandardMaterial({ map: o.material.map, color: tint ?? '#ffffff', roughness: rough, metalness: metal }))
        : block({ map: o.material.map })
      o.receiveShadow = true
      o.castShadow = shadows.side === 0 || shadows.side === side // late arrivals obey the current side
    })
    props.add(g)
    return g
  }).catch(() => null)
  // Palms along the promenade's lawn and on the beach; a few parked coupes; the arcade at the end.
  for (let x = -20; x < 68; x += 7) place('/cinema/arcade/palm.glb', 7.5 + ((x * 7) % 3), [x, 0, 5.6], x, { rough: 0.85 }) // far enough from the chase camera to frame, not block
  for (const [x, z] of [[8, 10], [21, 12], [39, 9], [58, 11]]) place('/cinema/arcade/palm.glb', 8, [x, 0, z], x, { rough: 0.85 })
  for (const [x, tint] of [[-6, '#ffffff'], [14, '#bff3ea'], [41, '#ffd7e6']]) place('/cinema/arcade/car.glb', 4.4, [x, 0, -2.9], Math.PI / 2 + 0.04, { tint, rough: 0.32, metal: 0.4 })
  place('/cinema/arcade/arcade.glb', 1.9, [ARCADE_X, 0.1, 1.0], -Math.PI / 2 - 0.3, { rough: 0.4 }).then(g => {
    g?.traverse(o => { if (o.isMesh) { o.material.emissiveMap = o.material.map; o.material.emissive.set('#ffffff'); o.material.emissiveIntensity = 0.55 } })
  })
  const cabinetLight = new THREE.PointLight('#d77bff', 14, 7, 1.6)
  cabinetLight.position.set(ARCADE_X - 0.8, 1.4, 1.6)
  scene.add(cabinetLight)
  const HOTELS = drive.hotels.map(h => [h.x, h.floors < 4])

  // ------------------------------------------------------------ the block world, in the same place
  const X0 = -18, X1 = 64 // the stretch of coast the blocks rebuild
  const cube = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  // One column per metre: top colour by height (sand, grass, stone), sides banded every metre so a
  // column reads as stacked blocks; a little per-block speckle, our own palette, no borrowed textures.
  const blockStd = opts => onWave(new THREE.MeshStandardMaterial(opts), -1, U)
  // Per-block detail in the shader, our own palette and no borrowed textures: a little speckle per
  // block, darker seams between blocks, earth under a band of grass on the sides, and a soft occlusion
  // toward the bottom of every block face so a column reads as stacked cubes.
  const blockDetail = mat => {
    const prev = mat.onBeforeCompile
    mat.onBeforeCompile = sh => {
      prev(sh)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying float vTop; varying vec3 vWaveN;`)
        .replace('#include <project_vertex>', `#include <project_vertex>
          vTop = (modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 1.0)).y;
          vWaveN = normal;`)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying float vTop; varying vec3 vWaveN;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 cell = floor(vWaveP + 0.001);
          float spk = fract(sin(dot(cell, vec3(12.99, 78.23, 37.71))) * 43758.5);
          vec3 f = fract(vWaveP);
          float grain = fract(sin(dot(floor(vWaveP * 8.0), vec3(3.1, 7.7, 5.3))) * 9124.7);
          float edge = min(min(min(f.x, 1.0 - f.x), min(f.z, 1.0 - f.z)), min(f.y, 1.0 - f.y));
          diffuseColor.rgb *= (0.9 + 0.12 * spk) * (0.93 + 0.07 * grain) * (0.8 + 0.2 * smoothstep(0.0, 0.05, edge));
          bool side = abs(vWaveN.y) < 0.5;
          bool grassy = diffuseColor.g > diffuseColor.r * 1.25 && diffuseColor.g > diffuseColor.b * 1.2;
          if (side) {
            if (vWaveP.y < vTop - 0.2) diffuseColor.rgb = grassy ? vec3(0.47, 0.32, 0.21) * (0.88 + 0.16 * spk) * (0.93 + 0.07 * grain) : diffuseColor.rgb * 0.82;
            diffuseColor.rgb *= 0.72 + 0.28 * smoothstep(0.0, 0.7, f.y); // occlusion toward each block's foot
          }`)
    }
    return mat
  }
  const blocksMat = blockDetail(blockStd({ color: '#ffffff', roughness: 0.92 }))
  const cols = [], water = []
  const hgt = (x, z) => {
    const n = Math.sin(x * 0.17) * Math.cos(z * 0.21) + Math.sin(x * 0.05 + z * 0.08) * 1.6
    const away = Math.min(1, Math.max(0, (Math.abs(z) - 3) / 8)) // flat by the path
    const hills = THREE.MathUtils.smoothstep(-z, 14, 34) * (7 + 5 * Math.sin(x * 0.09) * Math.cos(z * 0.13)) // the ridge behind
    return Math.round(Math.max(0, n * 2.4 + 1.5) * away + Math.max(0, hills))
  }
  for (let x = X0; x < X1; x++)
    for (let z = -40; z < 26; z++) {
      if (z >= 14) { water.push([x, z]); continue } // the sea, as water blocks
      const h = Math.abs(z) < 2 ? 0 : hgt(x, z)
      const top = z > 9 ? '#efd795' : h > 12 ? '#f4f7fb' : h > 8 ? '#9aa3ad' : '#5aa84a'
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
  // Water: glossy blocks that hold the sky.
  const sea2 = new THREE.InstancedMesh(cube, blockDetail(blockStd({ color: '#3d97d6', roughness: 0.12, metalness: 0.1 })), water.length)
  water.forEach(([x, z], i) => {
    m4.compose(p.set(x + 0.5, -1.2, z + 0.5), q, s.set(1, 1, 1))
    sea2.setMatrixAt(i, m4)
  })
  sea2.receiveShadow = true
  scene.add(sea2)
  // Block trees where the palms stood (a fuller crown), block towers where the hotels stood, clouds.
  const bits = []
  const addBlock = (x, y, z, sx, sy, sz, c) => bits.push([x, y, z, sx, sy, sz, c])
  const tree = (x, z, h) => {
    addBlock(x, 0, z, 1, h, 1, '#8a5a3a')
    addBlock(x, h - 1, z, 5, 2, 5, '#4f9e3c')
    addBlock(x, h + 1, z, 3, 1, 3, '#5aad45')
    addBlock(x + 1, h + 2, z, 1, 1, 1, '#66bb50')
  }
  for (let x = -14; x < 60; x += 6.5) tree(x, 6, 4 + Math.round(Math.abs(Math.sin(x)) * 2))
  for (const [x, z] of [[-8, -16], [3, -19], [16, -17], [27, -21], [44, -18], [55, -16]]) tree(x, z, 5)
  for (const [x, odd] of HOTELS) {
    const floors = odd ? 3 : 5
    const tint = ['#f4b3c9', '#a8e6d3', '#ffd0a8', '#c9b6f2'][Math.abs(Math.round(x)) % 4]
    for (let f = 0; f < floors; f++) addBlock(x, f * 2, -10.5, odd ? 8 : 6, 2, 6, f % 2 ? tint : '#f6efe4')
    addBlock(x, floors * 2, -10.5, 2, 2.5, 2, tint) // its fin, in blocks
  }
  for (const [x, y, z, w] of [[0, 24, -34, 11], [18, 28, -28, 9], [36, 23, -38, 13], [52, 27, -24, 10], [8, 30, 34, 12], [30, 26, 40, 9], [-10, 25, -20, 8]]) {
    addBlock(x, y, z, w, 1.5, w * 0.55, '#ffffff')
    addBlock(x + 1, y + 1.5, z, w * 0.55, 1, w * 0.35, '#ffffff')
  }
  const blocks = new THREE.InstancedMesh(cube, blocksMat, bits.length)
  bits.forEach(([x, y, z, sx, sy, sz, c], i) => {
    m4.compose(p.set(x, y, z), q, s.set(sx, sy, sz))
    blocks.setMatrixAt(i, m4)
    blocks.setColorAt(i, new THREE.Color(c))
  })
  blocks.castShadow = blocks.receiveShadow = true
  scene.add(blocks)
  // Flowers in the grass along the path.
  // Flowers grow in patches, one colour to a patch, small enough to read as flowers and not dice.
  const PATCHES = 46, PER = 7
  const flowers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.11, 0.11).translate(0, 0.055, 0), blockStd({ color: '#ffffff', roughness: 0.7 }), PATCHES * PER)
  const petal = ['#ff6f8a', '#ffd84d', '#fffaf0', '#c9a0ff', '#ffa65c'].map(c => new THREE.Color(c))
  let fi = 0
  for (let k = 0; k < PATCHES; k++) {
    const cx = X0 + 2 + ((k * 37) % (X1 - X0 - 4)), cz = (k % 2 ? -1 : 1) * (3 + ((k * 13) % 5))
    for (let j = 0; j < PER; j++) {
      const x = cx + (Math.random() - 0.5) * 1.6, z = cz + (Math.random() - 0.5) * 1.6
      m4.compose(p.set(x, hgt(Math.floor(x), Math.floor(z)), z), q, s.setScalar(0.8 + Math.random() * 0.4))
      flowers.setMatrixAt(fi, m4)
      flowers.setColorAt(fi++, petal[k % petal.length])
    }
  }
  scene.add(flowers)

  // Glowing cubes lifting off the wave front.
  const MOTES = 260
  const motes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd6f4').multiplyScalar(3), transparent: true, opacity: 0.9, depthWrite: false }), MOTES)
  const moteDir = Array.from({ length: MOTES }, () => new THREE.Vector3().randomDirection().setY(Math.random() * 0.5).normalize())
  const moteSeed = Array.from({ length: MOTES }, () => Math.random())
  motes.frustumCulled = false
  scene.add(motes)

  // ------------------------------------------------------------ light
  const sun = new THREE.DirectionalLight('#ffb38a', 2.4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 })
  const hemi = new THREE.HemisphereLight('#c9b6ff', '#4a3550', 1.15)
  scene.add(sun, sun.target, hemi)

  let you = null
  loadTraveller(loader).then(t => {
    you = t.make({ look: 'pbr' }) // shaded like the street around him, not ink-and-paint
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
    scene.fog.color.set('#5a3a66').lerp(new THREE.Color('#bfe0ff'), U.uDay.value)
    sun.color.set('#ffb38a').lerp(new THREE.Color('#fff6e0'), U.uDay.value)
    sun.intensity = 2.4 + U.uDay.value * 1.0
    hemi.color.set('#b9a3ff').lerp(new THREE.Color('#e6f2ff'), U.uDay.value)
    hemi.groundColor.set('#3a2a40').lerp(new THREE.Color('#6a8a50'), U.uDay.value)
    hemi.intensity = 1.15 + U.uDay.value * 0.4
    scene.environment = U.uDay.value > 0.5 ? envDay : envDusk
    scene.environmentIntensity = U.uDay.value > 0.5 ? 1.0 : 1.2
    drive.update(t, x)
    // Shadows ignore the wave's discard, so only the world in front casts them (the coast until the
    // wave has mostly passed, then the blocks); flipped once each way.
    const castSide = U.uWaveR.value > 40 ? -1 : 1
    if (castSide !== shadows.side) {
      shadows.side = castSide
      scene.traverse(o => {
        const side = o.isMesh && o.material?.userData?.waveSide
        if (side) o.castShadow = side === castSide
      })
    }

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
    // Dusk: the sun low behind the hotels, ahead of you; long shadows across the street.
    sun.position.set(x + 30, 9 + U.uDay.value * 20, -18 + U.uDay.value * 40)
    sun.target.position.set(x + 4, 0, -2)
    return { here: you ? you.root.position : look }
  }

  return { scene, camera, update }
}
