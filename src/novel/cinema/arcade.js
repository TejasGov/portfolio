import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loadTraveller, toon } from './films/kit'
import { buildOceanDrive, duskSky, neonSignTexture } from './oceandrive'

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
let ARCADE_X = 34.5 // set from the street's layout: the arcade stands opposite the club's door
const ARCADE_Z = -0.9 // on the street side of your path, clear of the chase camera, which rides on the beach side
const WAVE_GLSL = /* glsl */ `
uniform vec3 uWaveO; uniform float uWaveR; uniform float uWaveSide; uniform float uWaveT;
varying vec3 vWaveP;
float waveD() {
  vec3 p = vWaveP;
  // The ripple grows in with the wave, so nothing near its origin (the arcade) is touched before it starts.
  float r = uWaveR + (sin(p.x * 0.8 + uWaveT * 1.3) * sin(p.z * 0.65 - uWaveT) * 0.9 + sin(p.y * 1.7 + uWaveT * 2.0) * 0.35) * min(1.0, uWaveR);
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
        // The coast breaks up into 30 cm cubes in a thin band just ahead of the front, each cube at its own moment.
        float cubeAt = fract(sin(dot(floor(vWaveP / 0.3), vec3(12.99, 78.23, 37.71))) * 43758.5) * 0.6 * step(0.0, uWaveSide) * step(0.01, uWaveR);
        if ((wd - cubeAt) * uWaveSide < 0.0) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float live = step(0.01, uWaveR) * step(uWaveR, 9000.0);
        vec3 neon = mix(vec3(1.0, 0.45, 0.85), vec3(0.45, 0.9, 1.0), 0.5 + 0.5 * sin(vWaveP.y * 2.0 + uWaveT));
        // The crest: a white-hot core in a narrow neon glow. Both stay low until the front is clear of the
        // traveller and the cabinet it starts from, so nothing closes round him like a glass dome.
        float clear = smoothstep(3.0, 8.0, uWaveR);
        totalEmissiveRadiance += (neon * exp(-abs(wd) * 3.0) * 1.6 * clear + vec3(1.0, 0.96, 1.0) * exp(-abs(wd) * 9.0) * 3.0 * mix(0.3, 1.0, clear)) * live;
        // Behind it, the blocks arrive drawn in light: their edges glow cyan for a short trail behind the front.
        if (uWaveSide < 0.0) {
          vec3 g = 1.0 - smoothstep(0.0, 0.045, min(fract(vWaveP), 1.0 - fract(vWaveP)));
          float edge = max(g.x * g.y, max(g.y * g.z, g.x * g.z));
          float since = max(-wd, 0.0);
          totalEmissiveRadiance += vec3(0.35, 0.95, 1.0) * edge * smoothstep(0.0, 0.4, since) * exp(-since / 1.2) * 1.4 * live;
        }`)
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
  ARCADE_X = drive.clubX
  U.uWaveO.value.set(ARCADE_X, 1, -0.8)
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
  const gltfs = {} // each model loads and decodes once; every palm and coupe is built from that one copy
  const place = (url, size, at, yaw, { side = 1, tint = null, rough = 0.75, metal = 0 } = {}) => (gltfs[url] ??= loader.loadAsync(url)).then(gltf => {
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
  for (let x = -20; x < 160; x += 7) place('/cinema/arcade/palm.glb', 7.5 + ((x * 7) % 3), [x, 0, 5.6], x, { rough: 0.85 }) // far enough from the chase camera to frame, not block
  for (const [x, z] of [[8, 10], [21, 12], [39, 9], [58, 11], [77, 10], [96, 12], [118, 9], [139, 11]]) place('/cinema/arcade/palm.glb', 8, [x, 0, z], x, { rough: 0.85 })
  // Traffic, not parked cars (there is no parking lane): coupes driving both lanes, on the right-hand
  // side, head- and tail-lights on. Each loops the length of the street.
  const traffic = []
  const LANES = [{ z: -3.0, dir: 1 }, { z: -5.0, dir: -1 }] // driving on the right
  for (const [k, tint] of ['#ffffff', '#bff3ea', '#ffd7e6', '#c9d6ff', '#fff1c9', '#e2d3ff'].entries()) {
    const lane = LANES[k % 2]
    const car = { lane, x0: -30 + k * 33, speed: 6 + k * 0.7, g: null }
    traffic.push(car)
    // The coupe model's nose points down -x: turn it round for the eastbound lane.
    place('/cinema/arcade/car.glb', 4.3, [0, 0, lane.z], lane.dir > 0 ? Math.PI : 0, { tint, rough: 0.3, metal: 0.45 }).then(g => {
      if (!g) return
      car.g = g
      const lamp = (c, k2) => new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), coast(new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k2) })))
      car.lights = [lamp('#fff3d6', 5), lamp('#fff3d6', 5), lamp('#ff2a2a', 4), lamp('#ff2a2a', 4)]
      car.lights.forEach(l => scene.add(l))
    })
  }
  place('/cinema/arcade/arcade.glb', 1.9, [ARCADE_X, 0.1, ARCADE_Z], -Math.PI / 2 + 0.3, { rough: 0.4 }).then(g => {
    g?.traverse(o => { if (o.isMesh) { o.material.emissiveMap = o.material.map; o.material.emissive.set('#ffffff'); o.material.emissiveIntensity = 0.55 } })
  })
  const cabinetLight = new THREE.PointLight('#d77bff', 14, 7, 1.6)
  cabinetLight.position.set(ARCADE_X - 0.8, 1.4, ARCADE_Z + 0.6)
  scene.add(cabinetLight)
  // The club: an original 80s streamline moderne nightclub (Meshy), set back behind its entrance
  // pavilion, its name in our own neon on its marquee, and searchlights sweeping the sky behind it.
  // Model (22 m deep, measured in Blender): canopy front at CLUB_FRONT, marquee band 3.2 m behind it
  // at 5-7 m, the central pylon's face 1.3 m behind it from 8.5 m up, roof ~14 m.
  const CLUB_FRONT = -7.4, MARQUEE = CLUB_FRONT - 3.2, PYLON = CLUB_FRONT - 1.3
  place('/cinema/arcade/club.glb', 22, [ARCADE_X, 0, CLUB_FRONT - 11], 0, { rough: 0.6 })
  const dark = coast(new THREE.MeshStandardMaterial({ color: '#160c22', roughness: 0.4 }))
  const neon = (tex, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), coast(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(2.6, 2.6, 2.6) })))
  const marquee = new THREE.Mesh(new THREE.BoxGeometry(16.2, 1.7, 0.12), dark)
  marquee.position.set(ARCADE_X, 6.0, MARQUEE + 0.06)
  const clubSign = neon(neonSignTexture('Velvet Tide', '#ff4fa3'), 6.8, 1.66)
  clubSign.position.set(ARCADE_X, 6.0, MARQUEE + 0.14)
  // A blade sign off the pylon, square to the street, so the name reads as you walk up to it.
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8.4, 2.0), dark)
  blade.position.set(ARCADE_X, 12.8, PYLON + 1.0)
  const bladeTex = neonSignTexture('Velvet Tide', '#ff4fa3', { vertical: true })
  const bladeFaces = [-1, 1].map(s => {
    const f = neon(bladeTex, 1.9, 8.2)
    f.rotation.y = s * Math.PI / 2
    f.position.set(ARCADE_X + s * 0.17, 12.8, PYLON + 1.0)
    return f
  })
  scene.add(marquee, clubSign, blade, ...bladeFaces)
  const beamTex = (() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 256
    const g = c.getContext('2d')
    const gr = g.createLinearGradient(0, 256, 0, 0)
    gr.addColorStop(0, 'rgba(255,255,255,0.55)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 64, 256)
    const side = g.createLinearGradient(0, 0, 64, 0)
    side.addColorStop(0, 'rgba(0,0,0,1)')
    side.addColorStop(0.5, 'rgba(0,0,0,0)')
    side.addColorStop(1, 'rgba(0,0,0,1)')
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = side
    g.fillRect(0, 0, 64, 256)
    return new THREE.CanvasTexture(c)
  })()
  const searchlights = [0, 1, 2].map(k => {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 70).translate(0, 35, 0), coast(new THREE.MeshBasicMaterial({ map: beamTex, color: new THREE.Color('#dfe8ff').multiplyScalar(0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })))
    beam.position.set(ARCADE_X - 6 + k * 6, 14.2, CLUB_FRONT - 16) // on the club's roof
    scene.add(beam)
    return beam
  })
  const HOTELS = drive.hotels.map(h => [h.x, h.floors < 4])

  // ------------------------------------------------------------ the block world, in the same place
  const X0 = -18, X1 = 165 // the stretch of coast the blocks rebuild, past the last hotel
  const cube = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  // One column per metre: top colour by height (sand, grass, stone), sides banded every metre so a
  // column reads as stacked blocks; a little per-block speckle, our own palette, no borrowed textures.
  const blockStd = opts => onWave(new THREE.MeshStandardMaterial(opts), -1, U)
  // Pixel-block surfaces, drawn in the shader in our own palette (no borrowed textures): 16 pixels to a
  // block, each a little lighter or darker; dark seams between blocks; occlusion toward each block's
  // foot. Kinds: 0 terrain (grass tops over earth sides with a ragged grass lip; stone; sand; snow),
  // 1 leaves (with gaps), 2 wood (bark in vertical streaks), 3 plain (painted blocks, clouds, water).
  const blockDetail = (mat, kind) => {
    mat.defines = { ...mat.defines, BLOCK_KIND: kind }
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
          varying float vTop; varying vec3 vWaveN;
          float bhash(vec3 p) { return fract(sin(dot(p, vec3(12.99, 78.23, 37.71))) * 43758.5); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 bq = vWaveP - vWaveN * 0.002; // just inside the face, so each pixel's cell is stable
          vec3 px = floor(bq * 16.0);
          float n = bhash(px), n2 = bhash(px + 17.0);
          vec3 f = fract(bq);
          float edge = min(min(min(f.x, 1.0 - f.x), min(f.z, 1.0 - f.z)), min(f.y, 1.0 - f.y));
          bool side = abs(vWaveN.y) < 0.5;
          vec3 c = diffuseColor.rgb;
          #if BLOCK_KIND == 0
            bool grassy = c.g > c.r * 1.25 && c.g > c.b * 1.2;
            bool snowy = c.r > 0.85 && c.b > 0.85;
            float lip = (2.0 + floor(bhash(vec3(px.x + px.z, 0.0, 3.0)) * 4.0)) / 16.0;
            if (side && bq.y < vTop - lip) c = grassy ? vec3(0.45, 0.3, 0.19) : snowy ? vec3(0.55, 0.57, 0.6) : c * 0.85;
            c *= 0.84 + 0.26 * n;
            if (n2 > 0.93) c *= 0.78;
          #elif BLOCK_KIND == 1
            c *= 0.78 + 0.34 * n;
            if (n2 < 0.16) c *= 0.45;
          #elif BLOCK_KIND == 2
            c *= side ? 0.72 + 0.34 * bhash(vec3(px.x + px.z, floor(px.y / 3.0), 7.0)) : 0.88 + 0.16 * n;
          #else
            c *= 0.93 + 0.1 * n;
            if (side) c *= abs(vWaveN.x) > 0.5 ? 0.82 : 0.68; // lit tops, two darker sides (instances are unrotated)
          #endif
          c *= 0.8 + 0.2 * smoothstep(0.0, 0.04, edge);
          if (side) c *= 0.74 + 0.26 * smoothstep(0.0, 0.7, f.y);
          diffuseColor.rgb = c;`)
    }
    return mat
  }
  const blockMats = [0, 1, 2, 3].map(k => blockDetail(blockStd({ color: '#ffffff', roughness: k === 1 ? 0.8 : 0.92 }), k))
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
  const grid = new THREE.InstancedMesh(cube, blockMats[0], cols.length)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
  cols.forEach(([x, z, h, c], i) => {
    m4.compose(p.set(x + 0.5, -3, z + 0.5), q, s.set(1, h + 3, 1))
    grid.setMatrixAt(i, m4)
    grid.setColorAt(i, new THREE.Color(c))
  })
  grid.receiveShadow = grid.castShadow = true
  scene.add(grid)
  // Water: glossy blocks that hold the sky.
  const sea2 = new THREE.InstancedMesh(cube, blockDetail(blockStd({ color: '#3d97d6', roughness: 0.12, metalness: 0.1 }), 3), water.length)
  water.forEach(([x, z], i) => {
    m4.compose(p.set(x + 0.5, -1.2, z + 0.5), q, s.set(1, 1, 1))
    sea2.setMatrixAt(i, m4)
  })
  sea2.receiveShadow = true
  scene.add(sea2)
  // Block trees where the palms stood (a fuller crown), block towers where the hotels stood, clouds.
  const bits = []
  const addBlock = (x, y, z, sx, sy, sz, c, kind = 3) => bits.push([x, y, z, sx, sy, sz, c, kind])
  // Two kinds of tree: a dark-barked one with a deep green crown, and a pale-barked, lighter one. The
  // crown is a cross of leaf blocks (no square corners), a smaller layer, and a tuft on top.
  const tree = (x, z, h, pale) => {
    const [bark, leaf, leaf2] = pale ? ['#e6dfd2', '#7cc35a', '#8fd06a'] : ['#7a5232', '#4f9e3c', '#5aad45']
    addBlock(x, 0, z, 1, h, 1, bark, 2)
    addBlock(x, h - 1, z, 5, 2, 3, leaf, 1)
    addBlock(x, h - 1, z, 3, 2, 5, leaf, 1)
    addBlock(x, h + 1, z, 3, 1, 3, leaf2, 1)
    addBlock(x + (pale ? -1 : 1), h + 2, z, 1, 1, 1, leaf2, 1)
  }
  for (let x = -14, k = 0; x < 160; x += 6.5, k++) tree(x, 6, 4 + Math.round(Math.abs(Math.sin(x)) * 2), k % 3 === 1)
  for (const [k, [x, z]] of [[-8, -16], [3, -19], [16, -17], [27, -21], [44, -18], [55, -16], [72, -19], [88, -15], [104, -20], [121, -17], [140, -18], [156, -16]].entries()) tree(x, z, 5 + (k % 2), k % 2 === 0)
  for (const [x, odd] of HOTELS) {
    const floors = odd ? 3 : 5
    const tint = ['#f4b3c9', '#a8e6d3', '#ffd0a8', '#c9b6f2'][Math.abs(Math.round(x)) % 4]
    for (let f = 0; f < floors; f++) addBlock(x, f * 2, -10.5, odd ? 8 : 6, 2, 6, f % 2 ? tint : '#f6efe4')
    addBlock(x, floors * 2, -10.5, 2, 2.5, 2, tint) // its fin, in blocks
  }
  for (const [x, y, z, w] of [[0, 24, -34, 11], [18, 28, -28, 9], [36, 23, -38, 13], [52, 27, -24, 10], [8, 30, 34, 12], [30, 26, 40, 9], [-10, 25, -20, 8], [74, 26, -30, 12], [98, 29, -22, 9], [122, 24, -36, 13], [146, 27, -26, 10], [86, 25, 30, 11]]) {
    addBlock(x, y, z, w, 1.5, w * 0.55, '#ffffff')
    addBlock(x + 1, y + 1.5, z, w * 0.55, 1, w * 0.35, '#ffffff')
  }
  // The arcade cabinet, rebuilt in blocks where it stood (its screen faces back down the path), so the
  // wave turns it to blocks rather than eating it. Its own mesh, marquee first, so update() can pop it
  // out block by block once you walk on.
  const AX = ARCADE_X, AZ = ARCADE_Z
  const cab = [
    [AX + 0.05, 2.0, AZ, 0.9, 0.35, 1, '#ff5fb7'], // marquee
    [AX - 0.31, 1.25, AZ, 0.04, 0.6, 0.76, '#7ff6ff'], // screen
    [AX + 0.1, 1.1, AZ, 0.8, 0.9, 1, '#3b2470'], // upper body, set back
    [AX - 0.55, 0.95, AZ, 0.3, 0.12, 0.9, '#24164a'], // control panel
    [AX, 0, AZ, 1, 1.1, 1, '#3b2470'], // base
  ]
  const cabinetBlocks = new THREE.InstancedMesh(cube, blockMats[3], cab.length)
  const upright = new THREE.Quaternion() // its own: the motes leave the shared q turned
  const placeCab = (j, k) => {
    const [x, y, z, sx, sy, sz] = cab[j]
    m4.compose(p.set(x, y, z), upright, s.set(sx, sy, sz).multiplyScalar(Math.max(1e-3, k)))
    cabinetBlocks.setMatrixAt(j, m4)
  }
  cab.forEach((b, j) => {
    placeCab(j, 1)
    cabinetBlocks.setColorAt(j, new THREE.Color(b[6]))
  })
  cabinetBlocks.castShadow = cabinetBlocks.receiveShadow = true
  scene.add(cabinetBlocks)
  let cabMoved = false
  for (const kind of [1, 2, 3]) {
    const mine = bits.filter(b => b[7] === kind)
    const blocks = new THREE.InstancedMesh(cube, blockMats[kind], mine.length)
    mine.forEach(([x, y, z, sx, sy, sz, c], i) => {
      m4.compose(p.set(x, y, z), q, s.set(sx, sy, sz))
      blocks.setMatrixAt(i, m4)
      blocks.setColorAt(i, new THREE.Color(c))
    })
    blocks.castShadow = blocks.receiveShadow = true
    scene.add(blocks)
  }
  // Tall grass: crossed pixel tufts on the open grass either side of the path.
  const tuftTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const g = c.getContext('2d')
    for (let k = 0; k < 9; k++) {
      const bx = 1 + ((k * 7) % 14), top = 3 + ((k * 5) % 9)
      for (let y = top; y < 16; y++) {
        g.fillStyle = ['#4f9e3c', '#5fb347', '#3f8a32', '#6cc052'][(k + y) % 4]
        g.fillRect(bx + (y < top + 3 ? (k % 2 ? 1 : -1) : 0), y, 1, 1)
      }
    }
    const t = new THREE.CanvasTexture(c)
    t.magFilter = t.minFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  const tuftPlane = () => new THREE.PlaneGeometry(0.9, 0.9).translate(0, 0.45, 0)
  const tuftGeo = mergeGeometries([tuftPlane().rotateY(Math.PI / 4), tuftPlane().rotateY(-Math.PI / 4)])
  const TUFTS = 900
  const tufts = new THREE.InstancedMesh(tuftGeo, blockStd({ map: tuftTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), TUFTS)
  for (let i = 0; i < TUFTS; i++) {
    const x = X0 + Math.random() * (X1 - X0), z = (Math.random() < 0.5 ? -1 : 1) * (2.2 + Math.random() * 9)
    const fx = Math.floor(x), fz = Math.floor(z), h = hgt(fx, fz)
    if (z > 9 || h > 8) { tufts.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue } // none on sand or stone
    m4.compose(p.set(fx + 0.5, h, fz + 0.5), q.setFromEuler(new THREE.Euler(0, Math.random() * 3, 0)), s.setScalar(0.7 + Math.random() * 0.4))
    tufts.setMatrixAt(i, m4)
  }
  q.identity()
  tufts.receiveShadow = true
  scene.add(tufts)
  // Flowers in the grass along the path.
  // Flowers grow in patches, one colour to a patch, small enough to read as flowers and not dice.
  const PATCHES = 90, PER = 7
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

  // ------------------------------------------------------------ the block world's creatures
  // Our own designs in our own pixel palette, in the spirit of a block game's night: an undead
  // shambler with its arms out, a skeletal archer with a bow, and a mossy stone golem. They wander
  // beside the path and, like everything in the block world, appear as the wave reaches them.
  const tex8 = paint => {
    const c = document.createElement('canvas')
    c.width = c.height = 8
    paint(c.getContext('2d'))
    const t = new THREE.CanvasTexture(c)
    t.magFilter = t.minFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const dot = (g, col, pts) => {
    g.fillStyle = col
    for (const [x, y, w = 1, h = 1] of pts) g.fillRect(x, y, w, h)
  }
  const pixelMat = (cols, paint) => {
    const map = tex8(g => {
      for (let i = 0; i < 64; i++) dot(g, cols[Math.floor((Math.abs(Math.sin((i + cols.length * 7) * 12.9898) * 43758.5453) % 1) * cols.length)], [[i % 8, i >> 3]])
      paint?.(g)
    })
    // A faint glow of their own colours, so the creatures read against the grass at mid-distance.
    return blockStd({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.15, roughness: 0.85 })
  }
  // A box placed at [x, y, z]; a limb (hang) has its origin at its top, so it swings from its joint.
  const part = (w, h, d, mat, [x, y, z], hang = false) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, hang ? -h / 2 : 0, 0), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    return m
  }
  const withFace = (side, front) => [side, side, side, side, front, side] // +x -x +y -y +z(front) -z
  const ASH = ['#7d8a6e', '#73805f', '#86937a', '#6a7658']
  const RUST = ['#a2552f', '#93492a', '#b05f36']
  const CLOTH = ['#4e3b2c', '#45342a', '#58443a']
  const BONE = ['#e4dfd0', '#d8d2c0', '#ece8dc']
  const STONE = ['#7f8683', '#737a77', '#8b928e', '#6a706d']
  const MOSS = ['#4f7f3a', '#5c8f44', '#456f33']
  const shambler = () => {
    const skin = pixelMat(ASH), shirt = pixelMat(RUST), cloth = pixelMat(CLOTH)
    const face = pixelMat(ASH, g => { dot(g, '#1c1410', [[1, 3, 2, 2], [5, 3, 2, 2], [2, 6, 4, 1]]); dot(g, '#ffb547', [[1, 3], [6, 3]]) })
    const arms = [0.33, -0.33].map(x => part(0.2, 0.66, 0.2, shirt, [x, 1.36, 0], true))
    const legs = [0.12, -0.12].map(x => part(0.22, 0.7, 0.22, cloth, [x, 0.7, 0], true))
    const g = new THREE.Group().add(part(0.46, 0.46, 0.46, withFace(skin, face), [0, 1.62, 0]), part(0.46, 0.68, 0.26, shirt, [0, 1.05, 0]), ...arms, ...legs)
    return { g, legs, arms, armRest: -Math.PI / 2 + 0.12, speed: 0.6 } // arms held out ahead
  }
  const archer = () => {
    const bone = pixelMat(BONE), wood = pixelMat(['#7a5232', '#6b4628'])
    const ribs = pixelMat(BONE, g => dot(g, '#5a5448', [[1, 1, 6, 1], [1, 3, 6, 1], [1, 5, 6, 1], [3, 0, 2, 8]]))
    const skull = pixelMat(BONE, g => dot(g, '#2a2620', [[1, 3, 2, 2], [5, 3, 2, 2], [3, 5, 2, 1], [2, 7, 4, 1]]))
    const arms = [0.25, -0.25].map(x => part(0.11, 0.62, 0.11, bone, [x, 1.36, 0], true))
    const legs = [0.1, -0.1].map(x => part(0.12, 0.7, 0.12, bone, [x, 0.7, 0], true))
    const bow = [[0.3, 0.5], [0.15, 0.58], [0, 0.6], [-0.15, 0.58], [-0.3, 0.5]].map(([y, z]) => part(0.05, 0.16, 0.05, wood, [-0.25, 1.36 + y, z]))
    const g = new THREE.Group().add(part(0.44, 0.44, 0.44, withFace(bone, skull), [0, 1.6, 0]), part(0.4, 0.64, 0.18, ribs, [0, 1.06, 0]), ...arms, ...legs, ...bow, part(0.01, 0.62, 0.01, bone, [-0.25, 1.36, 0.47]))
    return { g, legs, arms, armRest: -Math.PI / 2, speed: 0.75 }
  }
  const golem = () => {
    const stone = pixelMat(STONE, g => dot(g, MOSS[0], [[0, 0, 3, 1], [5, 0, 3, 2], [0, 1, 1, 2]]))
    const face = pixelMat(STONE, g => { dot(g, '#0e3b3f', [[1, 3, 2, 2], [5, 3, 2, 2]]); dot(g, '#5ff3ff', [[1, 3], [5, 3]]); dot(g, MOSS[1], [[0, 0, 8, 1], [2, 1, 2, 1]]) })
    const legs = [[0.3, 0.28], [-0.3, -0.28], [-0.3, 0.28], [0.3, -0.28]].map(([x, z]) => part(0.24, 0.32, 0.24, stone, [x, 0.32, z], true))
    const g = new THREE.Group().add(part(0.9, 0.62, 0.8, [stone, stone, pixelMat(MOSS), stone, face, stone], [0, 0.62, 0]), ...legs)
    return { g, legs, arms: [], armRest: 0, speed: 0.4 }
  }
  // Beside the path ahead of where the walk through the blocks begins, a few metres off it either side.
  const mobs = [shambler, archer, golem, shambler, archer, shambler, golem].map((make, i) => {
    const m = make()
    m.home = new THREE.Vector2(ARCADE_X + 7 + i * 4.2, i === 3 ? -3 : i % 2 ? -3.6 - (i % 3) * 0.8 : 4.6 + (i % 3) * 0.8) // the camera rides at z ~2 on the + side; the fourth stays close by the path, in frame as you walk
    m.pos = m.home.clone()
    m.to = m.home.clone()
    m.phase = i * 1.7
    scene.add(m.g)
    return m
  })
  const step2 = new THREE.Vector2()

  // Glowing cubes lifting off the wave front.
  const MOTES = mobile ? 60 : 100
  const motes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd6f4').multiplyScalar(3), transparent: true, opacity: 0.9, depthWrite: false }), MOTES)
  const moteDir = Array.from({ length: MOTES }, () => { const d = new THREE.Vector3().randomDirection(); return d.set(Math.abs(d.x), Math.random() * 0.5, d.z).normalize() }) // the front's upper half, ahead of the camera
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

  // Dressed for the coast: his own texture with the shirt repainted as an original aloha print with an
  // open collar and buttons (scripts/cinema/aloha.py), and, in the block world, block-built gear.
  const aloha = new THREE.TextureLoader().load('/cinema/traveller_aloha.webp')
  aloha.flipY = false // glTF's UV convention, like the texture it replaces
  aloha.colorSpace = THREE.SRGBColorSpace
  let you = null, gear = null
  loadTraveller(loader).then(t => {
    you = t.make({ look: 'pbr' }) // shaded like the street around him, not ink-and-paint
    you.root.traverse(o => { if (o.isSkinnedMesh) o.material.map = aloha })
    gear = makeGear(you) // fitted in his rest pose, so before the mixer first poses him
    scene.add(you.root)
  })
  // A danced moment at the arcade: a soft pink light circling him while he moves.
  const danceLight = new THREE.PointLight('#ff7ad9', 0, 6, 1.4)
  scene.add(danceLight)

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 700) // the hall's own lens, so leaving through the screen doesn't jump
  const look = new THREE.Vector3(), cam = new THREE.Vector3(), dreamCam = new THREE.Vector3(), dreamLook = new THREE.Vector3()
  let lastT = null, cue = ''

  /**
   * state: { p (0..1 through the chapter) }. Walk the coast (to the arcade), the wave, walk the blocks.
   * Returns where you are, for the ink seams.
   */
  function update(state, t, aspect) {
    const P = state.p
    const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
    const walk1 = ss(0.04, 0.5, P), wave = ss(0.565, 0.7, P), walk2 = ss(0.78, 0.95, P)
    const x = THREE.MathUtils.lerp(-10, ARCADE_X - 1.4, walk1) + walk2 * 20
    const dt = lastT === null ? 0 : Math.min(0.1, t - lastT)
    lastT = t
    U.uWaveT.value = t
    // Past the whole neon set by 0.68, the skyline ~265 m out across the water too (the late wave^6 term).
    // Reduced motion: one cut from the coast to the blocks.
    U.uWaveR.value = state.still ? (P < 0.62 ? 0 : 1e4) : wave <= 0 ? 0 : wave >= 1 ? 1e4 : 0.6 + 150 * Math.pow(wave, 1.5) + 250 * Math.pow(wave, 6)
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
    // Traffic loops the street; its lights ride with it.
    for (const car of traffic) {
      if (!car.g) continue
      // Loops -40..160: both ends far out of frame (behind the camera, or deep in the haze).
      const span = 200
      const cx = -40 + ((((car.x0 + car.lane.dir * car.speed * t) + 40) % span) + span) % span
      car.g.position.x = cx
      const d = car.lane.dir
      car.lights[0].position.set(cx + d * 2.05, 0.62, car.lane.z - 0.62)
      car.lights[1].position.set(cx + d * 2.05, 0.62, car.lane.z + 0.62)
      car.lights[2].position.set(cx - d * 2.1, 0.7, car.lane.z - 0.6)
      car.lights[3].position.set(cx - d * 2.1, 0.7, car.lane.z + 0.6)
    }
    // Searchlights: each beam turns to face the camera, then sweeps side to side about its base.
    for (const [k, b] of searchlights.entries()) {
      b.rotation.set(0, Math.atan2(camera.position.x - b.position.x, camera.position.z - b.position.z), 0)
      b.rotateZ(Math.sin(t * 0.35 + k * 2.1) * 0.6)
    }
    // Shadows ignore the wave's discard, so only the world in front casts them (the coast until the
    // wave has mostly passed, then the blocks); flipped once each way.
    const castSide = U.uWaveR.value > 40 ? -1 : 1
    if (castSide !== shadows.side) {
      shadows.side = castSide
      scene.traverse(o => {
        const side = o.isMesh && [o.material].flat()[0]?.userData?.waveSide
        if (side) o.castShadow = side === castSide
      })
    }

    // The dance at the arcade, in a dreamy slow motion: the camera eases in, the light softens and blooms.
    const dream = ss(0.5, 0.515, P) * (1 - ss(0.552, 0.566, P))
    if (you) {
      you.root.position.set(x, 0.02, 0)
      const strut = walk1 > 0 && walk1 < 1 // a relaxed, unhurried walk on the coast
      const trek = walk2 > 0 && walk2 < 1
      const atArcade = P > 0.5 && P < 0.56
      const jumping = P >= 0.575 && P < 0.62
      const done = P > 0.95
      const next = jumping ? 'Regular_Jump' : done ? 'Axe_Breathe_and_Look_Around' : atArcade ? 'Step_Hip_Hop_Dance' : strut ? 'Casual_Walk' : trek ? 'Walk' : 'Idle'
      if (next !== cue) {
        cue = next
        you.play(you.actions[next] ? next : 'Idle', { fade: 0.35 })
      }
      if (you.actions.Step_Hip_Hop_Dance) you.actions.Step_Hip_Hop_Dance.timeScale = 0.72
      const face = atArcade ? -0.35 : Math.PI / 2 // he dances turned to you, three-quarters
      you.root.rotation.y += (face - you.root.rotation.y) * 0.1
      you.mixer.update(dt)
      // The gear goes on as the wave takes him, popping in over a third of a second.
      const inBlocks = U.uWaveR.value > you.root.position.distanceTo(U.uWaveO.value) + 0.3
      gear.k = THREE.MathUtils.clamp(gear.k + (inBlocks ? dt : -dt) * 3, 0, 1)
      for (const g of gear.parts) {
        g.visible = gear.k > 0
        g.scale.setScalar(g.userData.scale * Math.max(1e-3, THREE.MathUtils.smoothstep(gear.k, 0, 1) * (1 + 0.25 * Math.sin(gear.k * Math.PI))))
      }
    }
    danceLight.intensity = dream * 16
    danceLight.position.set(x + Math.sin(t * 1.3) * 1.3, 1.7, Math.cos(t * 1.3) * 1.3)
    // The creatures wander about their spots, legs swinging, turning the way they walk.
    if (U.uWaveR.value > 0)
      for (const m of mobs) {
        if (m.pos.distanceTo(m.to) < 0.3) m.to.set(m.home.x + (Math.random() - 0.5) * 6, m.home.y + (Math.random() - 0.5) * 1.6)
        step2.copy(m.to).sub(m.pos)
        const len = step2.length()
        m.pos.addScaledVector(step2.divideScalar(len || 1), Math.min(len, m.speed * dt))
        const turn = Math.atan2(step2.x, step2.y) - m.g.rotation.y
        m.g.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * 0.08
        m.g.position.set(m.pos.x, hgt(Math.floor(m.pos.x), Math.floor(m.pos.y)), m.pos.y)
        const swing = Math.sin(t * 7 * m.speed + m.phase) * 0.6
        m.legs.forEach((l, k) => { l.rotation.x = k % 2 ? -swing : swing })
        m.arms.forEach((a, k) => { a.rotation.x = m.armRest + (k % 2 ? swing : -swing) * 0.12 })
      }
    // Motes: on the wave's front, drifting up and out, never over the traveller or the lens.
    if (wave > 0 && wave < 1 && !state.still) {
      const R = U.uWaveR.value
      for (let i = 0; i < MOTES; i++) {
        const k = (t * 0.25 + moteSeed[i]) % 1
        p.copy(moteDir[i]).multiplyScalar(R * (0.96 + 0.06 * k)).add(U.uWaveO.value)
        p.y = Math.max(0.2, p.y) + k * 3
        const near = THREE.MathUtils.smoothstep(p.distanceTo(camera.position), 3.5, 7) * (you ? THREE.MathUtils.smoothstep(p.distanceTo(you.root.position), 3, 4.5) : 1)
        m4.compose(p, q.setFromEuler(new THREE.Euler(k * 6, k * 4, 0)), s.setScalar((1 - k) * near))
        motes.setMatrixAt(i, m4)
      }
      motes.instanceMatrix.needsUpdate = true
      motes.visible = true
    } else motes.visible = false

    // The block cabinet pops out as you walk on, top first, so it never stands beside the path ahead.
    const cabK = cab.map((_, j) => ss(0.79 + j * 0.012, 0.805 + j * 0.012, P))
    const gone = cabK.every(k => k >= 1)
    // Written only while it moves, and once more to stand it back up when you scroll back before it.
    if (cabK.some(k => k > 0 && k < 1) || (cabMoved && cabK.every(k => k <= 0))) {
      cabK.forEach((k, j) => placeCab(j, (1 - k) * (1 + 0.25 * Math.sin(k * Math.PI))))
      cabinetBlocks.instanceMatrix.needsUpdate = true
      cabMoved = cabK.some(k => k > 0)
    }
    cabinetBlocks.visible = !gone

    // The third-person chase camera: behind and a little above, looking down the boulevard.
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    const portrait = state.portrait ?? aspect < 0.85 // on the cinema's screen, framed for the phone it is seen on
    cam.set(x - (portrait ? 7.5 : 5.2), portrait ? 3.6 : 2.5, portrait ? 2.6 : 1.9)
    cam.lerp(dreamCam.set(x - (portrait ? 3.6 : 2.6), portrait ? 1.9 : 1.6, portrait ? 4.2 : 3.2), dream)
    camera.position.lerp(cam, camera.position.lengthSq() ? 0.12 : 1)
    look.set(x + 6, 1.5, -1.2).lerp(dreamLook.set(x, 1.15, 0), dream)
    camera.lookAt(look)
    // Dusk: the sun low behind the hotels, ahead of you; long shadows across the street.
    sun.position.set(x + 30, 9 + U.uDay.value * 20, -18 + U.uDay.value * 40)
    sun.target.position.set(x + 4, 0, -2)
    return { here: you ? you.root.position : look, dream, blocks: U.uWaveR.value > 1e3 }
  }

  return { scene, camera, update }
}

/**
 * Block-world armour in the blocky game style, drawn in our own pixel palette: a gold helm (a box round
 * the whole head with a face opening) and an iron chestplate (a box round the torso, sleeves round the
 * upper arms), plus an axe with a stepped blade. Every face is a 16-pixel plate: a few flat shades, a
 * dark outline and a highlight row. Each piece is placed around him in his rest pose (metres; y up, his
 * front +z) and then parented to the bone it rides on. Returns the pieces, hidden, for update().
 */
function makeGear(you) {
  // armour: a 2px shaded bevel (right and bottom) and a rivet in each corner; visor: a dark slit along the bottom.
  const plate = (pal, outline, highlight, { armour = false, visor = false } = {}) => {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const g = c.getContext('2d')
    for (let i = 0; i < 256; i++) {
      g.fillStyle = pal[Math.floor((Math.abs(Math.sin(i * 12.9898 + pal.length) * 43758.5453) % 1) * pal.length)]
      g.fillRect(i % 16, i >> 4, 1, 1)
    }
    g.fillStyle = highlight
    g.fillRect(1, 1, 14, 1)
    g.fillRect(1, 1, 1, 14)
    g.fillStyle = outline
    if (armour) {
      g.globalAlpha = 0.7
      g.fillRect(13, 1, 2, 14)
      g.fillRect(1, 13, 12, 2)
      g.globalAlpha = 1
      for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) g.fillRect(x, y, 1, 1)
    }
    if (visor) g.fillRect(0, 13, 16, 3)
    g.strokeStyle = outline
    g.lineWidth = 1
    g.strokeRect(0.5, 0.5, 15, 15)
    const t = new THREE.CanvasTexture(c)
    t.magFilter = t.minFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const mat = (tex, metalness, roughness) => new THREE.MeshStandardMaterial({ map: tex, metalness, roughness, flatShading: true })
  const GOLD = ['#f6d63c', '#e3b92c', '#cf9f22', '#fbe270'], IRON = ['#d6d6d6', '#bdbdbd', '#a6a6a6', '#e9e9e9']
  const gold = mat(plate(GOLD, '#9a6c15', '#fff6a8', { armour: true }), 0.35, 0.55)
  const brow = mat(plate(GOLD, '#9a6c15', '#fff6a8', { armour: true, visor: true }), 0.35, 0.55)
  const iron = mat(plate(IRON, '#7b7b7b', '#f6f6f6', { armour: true }), 0.3, 0.6)
  const blade = mat(plate(IRON, '#7b7b7b', '#f6f6f6'), 0.3, 0.6) // the axe's iron, unriveted
  const ironDark = mat(plate(['#9a9a9a', '#8c8c8c', '#a8a8a8'], '#5e5e5e', '#c4c4c4'), 0.3, 0.6)
  const steel = mat(plate(['#eef2f6', '#e2e6ea'], '#a9b0b8', '#ffffff'), 0.4, 0.45)
  const wood = mat(plate(['#8a5a32', '#7a4e2a', '#9c6a3e'], '#4f3119', '#ad7c4c'), 0, 0.8)
  const leather = mat(plate(['#4a2e1c', '#563622'], '#2e1c10', '#6b452c'), 0, 0.7)
  const parts = []
  const piece = (bone, material, [w, h, d], [x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    m.position.set(x, y, z)
    m.castShadow = true
    you.root.add(m)
    parts.push([bone, m])
  }
  // Helm: a box round the head (head: x ±0.11, y 1.45..1.72, z ±0.13; the face at +z), open at the face.
  piece('Head', gold, [0.3, 0.06, 0.33], [0, 1.75, 0]) // top
  piece('Head', gold, [0.04, 0.26, 0.33], [-0.14, 1.6, 0]) // sides, down to the jaw
  piece('Head', gold, [0.04, 0.26, 0.33], [0.14, 1.6, 0])
  piece('Head', gold, [0.3, 0.28, 0.04], [0, 1.6, -0.165]) // back
  piece('Head', brow, [0.3, 0.06, 0.04], [0, 1.69, 0.165]) // brow, the top of the face opening
  piece('Head', gold, [0.05, 0.13, 0.04], [-0.115, 1.56, 0.165]) // cheeks, its sides
  piece('Head', gold, [0.05, 0.13, 0.04], [0.115, 1.56, 0.165])
  // Chestplate: a box round a loose shirt (torso: x ±0.2, y 0.98..1.36, z ±0.125) and sleeves round the
  // upper arms (shoulder to elbow along x in the rest pose).
  piece('Spine01', iron, [0.47, 0.39, 0.31], [0, 1.18, 0])
  piece('Spine01', ironDark, [0.02, 0.33, 0.01], [0, 1.18, 0.16]) // the seam down the front
  for (const [bone, sx] of [['LeftArm', 1], ['RightArm', -1]]) piece(bone, iron, [0.21, 0.16, 0.17], [sx * 0.275, 1.3, 0])
  // Axe in the right fist (fist about x -0.7, y 1.26; its grip runs front to back), blade up.
  piece('RightHand', wood, [0.035, 0.035, 0.62], [-0.7, 1.26, 0.1])
  piece('RightHand', leather, [0.045, 0.045, 0.1], [-0.7, 1.26, -0.02]) // grip wrap
  piece('RightHand', ironDark, [0.05, 0.06, 0.07], [-0.7, 1.26, 0.37]) // socket
  piece('RightHand', blade, [0.03, 0.06, 0.08], [-0.7, 1.315, 0.37]) // the blade, widening in steps
  piece('RightHand', blade, [0.03, 0.05, 0.12], [-0.7, 1.37, 0.37])
  piece('RightHand', blade, [0.03, 0.04, 0.15], [-0.7, 1.415, 0.37])
  piece('RightHand', steel, [0.032, 0.02, 0.16], [-0.7, 1.445, 0.37]) // the edge
  piece('RightHand', ironDark, [0.03, 0.04, 0.04], [-0.7, 1.215, 0.37]) // back spike
  you.root.updateMatrixWorld(true)
  for (const [bone, m] of parts) {
    you.bone(bone).attach(m)
    m.userData.scale = m.scale.x // attach() folds the bone's scale in: pop relative to it
    m.visible = false
  }
  return { k: 0, parts: parts.map(([, m]) => m) }
}
