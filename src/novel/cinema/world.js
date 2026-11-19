import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ChromaticAberrationEffect, NoiseEffect,
  VignetteEffect, ToneMappingEffect, ToneMappingMode, BlendFunction,
} from 'postprocessing'
import { noiseVolume, beamFrame, VolumetricPass, makeDust, glowTexture } from './core'

/*
 * The one 3D world of the site: a cinema. A projection booth (with the Meshy projector) behind a window
 * in the back wall, a stadium hall baked in Blender (two lighting states: show and house lights),
 * Meshy recliners, the projector beam through haze, and the projects that get "screened" in it.
 * The projector is a real three.js SpotLight with a texture map, so the film frame lands on the screen
 * and anything standing in the beam casts its shadow there.
 */
export const LENS = new THREE.Vector3(0.9, 7.58, -12.15)
export const WINDOW = new THREE.Vector3(0.9, 7.6, -11.5)
export const SCREEN = new THREE.Vector3(0, 4.15, 15.44)
export const STAGE = new THREE.Vector3(0, 3.5, 11.2) // where the projects materialize
const SCREEN_W = 18, SCREEN_H = 7.5
const PROJ_SCALE = 1.8 // projects are seen from row ten, in front of an 18 m screen

// Recliner layout: identical to the Blender bake's seat proxies (hall_build.py).
const ROWS = 15, COLS = 22, ROW_D = 1.02, ROW_H = 0.346, Z0 = 4.4
const seatAt = (r, c) => {
  const x = (c - 10.5) * 0.78 + (c >= 11 ? 0.45 : -0.45)
  return [x, r * ROW_H, Z0 - r * ROW_D + x * x * 0.004]
}

export const PROJECT_MODELS = {
  'smash-cricket': { url: '/cinema/cricket.glb', still: '/smash.png', size: 2.3, yaw: -0.25, tint: '#ffb46b', field: ['#2a1606', '#7a4512'] },
  cognifight: { url: '/cinema/brain.glb', still: '/cognitive.png', size: 2.2, yaw: -0.6, tint: '#c9b4ff', field: ['#160f2c', '#4d3a8c'] },
  revere: { url: '/cinema/glasses.glb', still: '/revere.png', size: 2.4, yaw: 0.35, tint: '#9fd2ff', field: ['#06142a', '#1f4f86'] },
  yudhveer: { url: '/cinema/sword.glb', still: '/projects/yudhveer.webp', size: 2.4, yaw: 0.55 + Math.PI, tint: '#ffb08c', field: ['#260a06', '#8a2a16'] },
  'commit-city': { url: '/cinema/city.glb', still: '/projects/commit-city.webp', size: 2.5, yaw: 0.6, tint: '#9ef2d2', shade: '#a8d9c8', field: ['#04201a', '#1a6b55'] },
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

function hallMaterial(show, house, gains) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uHouse: { value: 0 }, uExposure: { value: 1 }, uLog: { value: new THREE.Vector2(gains.show.a, Math.log1p(gains.show.rmax * gains.show.a)) } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D tShow; uniform sampler2D tHouse;
      uniform float uHouse; uniform float uExposure; uniform vec2 uLog;
      varying vec2 vUv;
      // The bakes are log-encoded radiance (see the Blender bake script): r = (exp(c * L) - 1) / A.
      vec3 radiance(vec3 c) { return (exp(c * uLog.y) - 1.0) / uLog.x; }
      void main() {
        vec3 a = radiance(texture2D(tShow, vUv).rgb);
        vec3 b = radiance(texture2D(tHouse, vUv).rgb);
        gl_FragColor = vec4(mix(a, b, uHouse) * uExposure, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  })
  m.uniforms.tShow = { value: show }
  m.uniforms.tHouse = { value: house }
  return m
}

/**
 * Compressed GLBs store positions/normals as normalized integers in [-1, 1] (mesh quantization).
 * Transforming those in place would clamp every vertex outside that range, so expand to floats first.
 */
function toFloat(geo) {
  for (const [name, a] of Object.entries(geo.attributes)) {
    if (a.array instanceof Float32Array && !a.normalized && !a.isInterleavedBufferAttribute) continue
    const f = new Float32Array(a.count * a.itemSize)
    const get = ['getX', 'getY', 'getZ', 'getW']
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a[get[c]](i)
    geo.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize))
  }
  return geo
}

/** Bake a model's meshes into one normalized group: centred, scaled to `size`, yawed. */
function normalize(root, size, yaw = 0) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const s = size / Math.max(...box.getSize(new THREE.Vector3()).toArray())
  const c = box.getCenter(new THREE.Vector3())
  const m = new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z))
  const out = new THREE.Group()
  root.traverse(o => {
    if (!o.isMesh) return
    const g = toFloat(o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(m, o.matrixWorld))
    out.add(new THREE.Mesh(g, o.material))
  })
  return out
}

/** Dissolve-in for any lit material: noise + a sweep up the object, with a hot edge. */
function dissolvable(mat, u) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal; uniform float uDissolve; uniform vec3 uEdgeColor; uniform highp sampler3D tNoise; uniform float uHalf;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float dn = texture(tNoise, vLocal * 0.9).r * 0.4 + clamp((vLocal.y + uHalf) / (2.0 * uHalf), 0.0, 1.0) * 0.6;
        float dh = mix(-0.12, 1.1, uDissolve);
        if (dn > dh) discard;
        float dEdge = 1.0 - smoothstep(0.0, 0.045, dh - dn);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uEdgeColor * dEdge;')
  }
  mat.needsUpdate = true
}

export async function createCinema(canvas, { mobile = false, onProgress } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, powerPreference: 'high-performance' })
  const dpr = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75)
  renderer.setPixelRatio(dpr)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  RectAreaLightUniformsLib.init()

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#010205')
  scene.fog = new THREE.FogExp2('#03050b', 0.022)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 120)
  const noise = noiseVolume(64)
  const tex = new THREE.TextureLoader()
  const loadTex = url => tex.loadAsync(url).then(t => {
    t.colorSpace = THREE.NoColorSpace
    t.flipY = false
    t.anisotropy = 4
    return t
  })

  // ------------------------------------------------------------ the baked hall
  const [hallGltf, show, house, gains, seatGltf, projGltf] = await Promise.all([
    loader.loadAsync('/cinema/hall.glb'),
    loadTex('/cinema/hall_show.webp'),
    loadTex('/cinema/hall_house.webp'),
    fetch('/cinema/hall_gains.json').then(r => r.json()),
    loader.loadAsync('/cinema/seat.glb'),
    loader.loadAsync('/cinema/projector.glb'),
  ])
  onProgress?.(0.6)
  const hallMat = hallMaterial(show, house, gains)
  hallMat.uniforms.uExposure.value = 1
  hallGltf.scene.traverse(o => {
    if (o.isMesh) o.material = hallMat
  })
  scene.add(hallGltf.scene)

  // ------------------------------------------------------------ recliners
  let seatMesh
  seatGltf.scene.updateMatrixWorld(true)
  seatGltf.scene.traverse(o => {
    if (o.isMesh && !seatMesh) seatMesh = o
  })
  const seatGeo = toFloat(seatMesh.geometry.clone()).applyMatrix4(seatMesh.matrixWorld)
  seatGeo.computeBoundingBox()
  const sb = seatGeo.boundingBox
  const ss = 1.05 / (sb.max.y - sb.min.y)
  seatGeo.translate(-(sb.min.x + sb.max.x) / 2, -sb.min.y, -(sb.min.z + sb.max.z) / 2).scale(ss, ss, ss)
  const seats = new THREE.InstancedMesh(seatGeo, seatMesh.material, ROWS * COLS)
  const m4 = new THREE.Matrix4()
  let n = 0
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const [x, y, z] = seatAt(r, c)
      m4.makeRotationY(-x * 0.008).setPosition(x, y + 0.01, z)
      seats.setMatrixAt(n++, m4)
    }
  seats.frustumCulled = false
  scene.add(seats)

  // ------------------------------------------------------------ the projector, in its booth
  // Its lens points along the model's +x; turned a quarter so it looks out of the window at the screen.
  const projector = normalize(projGltf.scene, 1.85, -Math.PI / 2)
  projector.position.set(0.9, 7.45, -12.65)
  scene.add(projector)

  // ------------------------------------------------------------ light
  // Screen bounce onto seats and objects, a dim fill, the booth bulb.
  const screenLight = new THREE.RectAreaLight('#a9c6ff', 0.9, SCREEN_W, SCREEN_H)
  screenLight.position.copy(SCREEN)
  screenLight.lookAt(0, 3, 0)
  scene.add(screenLight)
  const hemi = new THREE.HemisphereLight('#1b2540', '#060405', 0.08)
  scene.add(hemi)
  const bulb = new THREE.PointLight('#ffb36b', 16, 9, 2)
  bulb.position.set(-1.0, 9.6, -14.2)
  scene.add(bulb)
  const houseLight = new THREE.HemisphereLight('#ffd7a8', '#3a2418', 0)
  scene.add(houseLight)
  // Studio light for whatever is being screened: a warm key from the front-left, a tinted rim from the
  // screen side, and a soft room reflection so metal, glass and lacquer read as real.
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
  // Steep from above, so what passes the object lands on the stage floor, not on the screen.
  const stageKey = new THREE.SpotLight('#fff1de', 0, 0, 0.3, 0.6, 2)
  stageKey.position.set(-1.6, 11.5, 8.6)
  stageKey.target.position.copy(STAGE)
  const stageRim = new THREE.SpotLight('#9ec2ff', 0, 0, 0.5, 0.6, 2)
  stageRim.position.set(2.8, 6.5, 14.6)
  stageRim.target.position.copy(STAGE)
  scene.add(stageKey, stageKey.target, stageRim, stageRim.target)

  // The projector itself: a spotlight that projects the film frame (a canvas) and casts shadows.
  const frame = document.createElement('canvas')
  frame.width = frame.height = mobile ? 1024 : 2048
  const frameTex = new THREE.CanvasTexture(frame)
  frameTex.colorSpace = THREE.SRGBColorSpace
  const lamp = new THREE.SpotLight('#dfe9ff', 0, 0, Math.atan((SCREEN_W / 2 + 0.3) / (SCREEN.z - LENS.z)), 0.02, 2)
  lamp.position.copy(LENS)
  lamp.target.position.copy(SCREEN)
  lamp.map = frameTex
  lamp.castShadow = true
  lamp.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048)
  lamp.shadow.bias = -0.0004
  lamp.shadow.camera.near = 0.6
  lamp.shadow.camera.far = 32
  scene.add(lamp, lamp.target)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), new THREE.MeshLambertMaterial({ color: '#d8dce4' }))
  screen.position.copy(SCREEN)
  screen.rotation.y = Math.PI
  screen.receiveShadow = true
  scene.add(screen)

  // ------------------------------------------------------------ beam, dust, lens glow
  const beam = beamFrame(LENS, SCREEN, (SCREEN_W / 2) / (SCREEN.z - LENS.z), (SCREEN_H / 2) / (SCREEN.z - LENS.z), 0.09)
  const dust = makeDust(mobile ? 6000 : 11000, beam, new THREE.Box3(new THREE.Vector3(-10, 0, -11), new THREE.Vector3(10, 12, 15)), { reach: 27 })
  dust.material.uniforms.uDpr.value = dpr
  dust.material.uniforms.uSize.value = 7
  dust.material.uniforms.uAperture.value = 0.18
  dust.material.uniforms.uColor.value.setRGB(0.85, 0.92, 1).multiplyScalar(0.6)
  scene.add(dust)
  const glowMat = (kind, color, k) => new THREE.SpriteMaterial({ map: glowTexture(kind), color: new THREE.Color(color).multiplyScalar(k), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })
  const flare = new THREE.Sprite(glowMat('radial', '#b3d1ff', 2.2))
  flare.scale.setScalar(1.7)
  flare.position.copy(LENS).add(new THREE.Vector3(0, 0, 0.12))
  const streak = new THREE.Sprite(glowMat('streak', '#5c9aff', 3))
  streak.scale.set(14, 0.2, 1)
  streak.position.copy(flare.position)
  scene.add(flare, streak)

  // ------------------------------------------------------------ post
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
  composer.addPass(new RenderPass(scene, camera))
  const vol = new VolumetricPass(camera, beam, noise, { scale: 0.5, steps: mobile ? 26 : 46 })
  vol.uniforms.uDensity.value = 0.6
  vol.uniforms.uMaxDist.value = 46
  composer.addPass(vol)
  const bloom = new BloomEffect({ mipmapBlur: true, intensity: 1.0, luminanceThreshold: 0.32, luminanceSmoothing: 0.3, radius: 0.74 })
  const grain = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT })
  grain.blendMode.opacity.value = 0.16
  composer.addPass(new EffectPass(camera, new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0008, 0.0005), radialModulation: true, modulationOffset: 0.25 }), bloom, new ToneMappingEffect({ mode: ToneMappingMode.AGX }), new VignetteEffect({ offset: 0.28, darkness: 0.72 }), grain))

  // ------------------------------------------------------------ film frames on the screen
  // The spot's projective map is square; the screen fills its full width and a centred band of its height.
  const band = SCREEN_H / SCREEN_W
  let lastCard = ''
  const stills = {}
  const still = url => {
    if (!stills[url]) {
      stills[url] = new Image()
      stills[url].onload = () => { lastCard = '' } // redraw the frame once the footage arrives
      stills[url].src = url
    }
    return stills[url]
  }
  function card(key, { kicker = '', title = '', field = ['#0a1220', '#3b5d8f'], ink = '#ffffff', image } = {}) {
    if (key === lastCard) return
    lastCard = key
    const g = frame.getContext('2d')
    const S = frame.width
    const h = S * band, y0 = (S - h) / 2
    g.fillStyle = '#000'
    g.fillRect(0, 0, S, S)
    const img = image && still(image)
    if (img?.complete && img.naturalWidth) {
      // A flat (16:9) print on a scope screen: masked at the sides, cropped to its middle.
      const w = h * 16 / 9, x0 = (S - w) / 2
      const sh = Math.min(img.naturalHeight, img.naturalWidth * 9 / 16)
      g.drawImage(img, 0, (img.naturalHeight - sh) / 2, img.naturalWidth, sh, x0, y0, w, h)
      const vg = g.createRadialGradient(S / 2, S / 2, h * 0.3, S / 2, S / 2, w * 0.62)
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(0,0,0,0.55)')
      g.fillStyle = vg
      g.fillRect(x0, y0, w, h)
      frameTex.needsUpdate = true
      return
    }
    if (img) lastCard = '' // still loading: show the colour field meanwhile, then redraw
    const grad = g.createRadialGradient(S / 2, S / 2, h * 0.1, S / 2, S / 2, S * 0.62)
    grad.addColorStop(0, field[1])
    grad.addColorStop(1, field[0])
    g.fillStyle = grad
    g.fillRect(0, y0, S, h)
    g.fillStyle = ink
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    if (kicker) {
      g.font = `500 ${Math.round(h * 0.05)}px "Geist Mono Variable", monospace`
      g.globalAlpha = 0.8
      g.fillText(kicker.toUpperCase().split('').join(' '), S / 2, y0 + h * 0.28)
      g.globalAlpha = 1
    }
    if (title) {
      g.font = `400 ${Math.round(h * 0.3)}px "Instrument Serif", serif`
      g.fillText(title, S / 2, y0 + h * 0.56)
    }
    // A film frame is never clean: faint grain and a soft gate edge.
    g.globalCompositeOperation = 'multiply'
    const edge = g.createLinearGradient(0, 0, S, 0)
    edge.addColorStop(0, '#555'); edge.addColorStop(0.08, '#fff'); edge.addColorStop(0.92, '#fff'); edge.addColorStop(1, '#555')
    g.fillStyle = edge
    g.fillRect(0, y0, S, h)
    g.globalCompositeOperation = 'source-over'
    frameTex.needsUpdate = true
  }

  // ------------------------------------------------------------ projects (loaded after first paint)
  const projects = {}
  const dissolveU = () => ({ uDissolve: { value: 0 }, uEdgeColor: { value: new THREE.Color(0.5, 0.75, 1).multiplyScalar(7) }, tNoise: { value: noise }, uHalf: { value: 1.2 } })
  const loading = {}
  // One load per project, however many callers ask at once.
  const loadProject = id => (loading[id] ??= buildProject(id))
  async function buildProject(id) {
    const spec = PROJECT_MODELS[id]
    const gltf = await loader.loadAsync(spec.url)
    const group = normalize(gltf.scene, spec.size, spec.yaw)
    const u = dissolveU()
    u.uEdgeColor.value.set(spec.tint).multiplyScalar(7)
    group.traverse(o => {
      if (!o.isMesh) return
      o.material = o.material.clone()
      if (spec.shade) o.material.color.multiply(new THREE.Color(spec.shade)) // a white maquette reads pale under the beam
      o.material.envMap = env
      o.material.envMapIntensity = 0.9
      dissolvable(o.material, u)
      o.castShadow = true
    })
    // Surface points: the dust condenses onto these before the solid appears.
    const meshes = []
    group.traverse(o => o.isMesh && meshes.push(o))
    const NP = mobile ? 9000 : 22000
    const to = new Float32Array(NP * 3), from = new Float32Array(NP * 3), seed = new Float32Array(NP * 3)
    const samplers = meshes.map(m => new MeshSurfaceSampler(m).build())
    const v = new THREE.Vector3(), b = new THREE.Vector3()
    for (let i = 0; i < NP; i++) {
      samplers[i % samplers.length].sample(v)
      v.toArray(to, i * 3)
      // Start back up the beam, toward the booth, as if the light carries the object in.
      const t = 0.15 + Math.random() * 0.85
      b.copy(LENS).lerp(STAGE, 1 - t).sub(STAGE)
      b.x += (Math.random() - 0.5) * 3.5 * t
      b.y += (Math.random() - 0.5) * 2.0 * t
      b.divideScalar(PROJ_SCALE) // these live inside the scaled root
      ;(v.clone().add(b)).toArray(from, i * 3)
      seed.set([Math.random(), Math.random(), Math.random()], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(from, 3))
    geo.setAttribute('aTo', new THREE.BufferAttribute(to, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    const pmat = new THREE.ShaderMaterial({
      uniforms: { uMorph: { value: 0 }, uTime: { value: 0 }, uFade: { value: 0 }, uDpr: { value: dpr }, uColor: { value: new THREE.Color(spec.tint).multiplyScalar(2.4) } },
      vertexShader: /* glsl */ `
        attribute vec3 aTo; attribute vec3 aSeed;
        uniform float uMorph; uniform float uTime; uniform float uFade; uniform float uDpr;
        varying float vA;
        void main() {
          float k = smoothstep(0.0, 1.0, clamp(uMorph * 1.6 - aSeed.x * 0.6, 0.0, 1.0));
          vec3 drift = vec3(sin(uTime * 0.5 + aSeed.y * 30.0), cos(uTime * 0.4 + aSeed.z * 30.0), sin(uTime * 0.45 + aSeed.x * 30.0)) * 0.06 * (1.0 - k);
          vec3 p = mix(position + drift, aTo, k);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(uDpr * (1.6 + (1.0 - k) * 1.5) * 9.0 / -mv.z, 1.0, 5.0);
          vA = (0.08 + 0.92 * k) * uFade * (0.65 + 0.35 * sin(uTime * 3.0 + aSeed.y * 50.0));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main() { gl_FragColor = vec4(uColor * vA, 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const points = new THREE.Points(geo, pmat)
    points.frustumCulled = false
    const root = new THREE.Group()
    root.add(group, points)
    root.position.copy(STAGE)
    root.scale.setScalar(PROJ_SCALE)
    root.visible = false
    scene.add(root)
    projects[id] = { root, group, points, pmat, u, spec }
    return projects[id]
  }

  // ------------------------------------------------------------ per-frame state
  const look = new THREE.Vector3()
  const clock = new THREE.Clock()
  let active = true
  function resize(w, h) {
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  /**
   * state: { pos, target, fov, lamp (0..∞), pull, swirl, bloom, house (0..1), card: {key, ...},
   *          project: { id, morph, fade, dissolve, spin } | null, flare }
   */
  function render(state) {
    if (!active) return
    const t = clock.getElapsedTime()
    camera.position.copy(state.pos)
    look.copy(state.target)
    camera.lookAt(look)
    if (state.fov && camera.fov !== state.fov) {
      camera.fov = state.fov
      camera.updateProjectionMatrix()
    }
    if (state.card) card(state.card.key, state.card)

    const lampK = state.lamp ?? 1
    // A shutter at 24 fps never gives perfectly even light.
    const flicker = 1 + 0.015 * Math.sin(Math.floor(t * 24) * 12.9898)
    // Like the end credits: the house lights come up while the film is still running.
    lamp.intensity = 1600 * lampK * (1 - 0.6 * (state.house ?? 0)) * flicker
    vol.uniforms.uTime.value = t
    vol.uniforms.uLamp.value = lampK * (1 - (state.house ?? 0) * 0.9)
    // Inside the beam you look along all of it at once: thin the haze there so it reads as light, not fog.
    const v = camera.position.clone().sub(beam.apexV)
    const bz = v.dot(beam.axis)
    const inside = bz > beam.z0 ? Math.max(Math.abs(v.dot(beam.right) / (bz * beam.tan.x)), Math.abs(v.dot(beam.up) / (bz * beam.tan.y))) : 9
    const inBeam = 1 - THREE.MathUtils.smoothstep(inside, 0.8, 1.25)
    vol.uniforms.uDensity.value = (state.density ?? 0.6) * (1 - 0.75 * inBeam)
    if (state.beamColor) vol.uniforms.uBeamColor.value.lerp(state.beamColor, 0.06)
    const du = dust.material.uniforms
    du.uTime.value = t
    du.uLamp.value = vol.uniforms.uLamp.value * (1 - 0.6 * inBeam) * (state.dust ?? 1)
    du.uPull.value = state.pull ?? 0
    du.uSwirl.value = state.swirl ?? 1
    du.uFocus.value = state.focus ?? 8
    bloom.intensity = state.bloom ?? 1
    // The lens only flares for someone looking into it, not from behind the projector.
    const facing = THREE.MathUtils.smoothstep(camera.position.clone().sub(LENS).normalize().dot(beam.axis), 0.1, 0.7)
    const fl = (state.flare ?? 1) * facing
    flare.material.color.setRGB(0.7, 0.82, 1).multiplyScalar(2.2 * fl)
    streak.material.color.setRGB(0.36, 0.6, 1).multiplyScalar(3 * Math.min(fl, 4))
    streak.scale.set(14 + 6 * fl, 0.2 + 0.06 * fl, 1)

    const hs = state.house ?? 0
    hallMat.uniforms.uHouse.value = hs
    hallMat.uniforms.uExposure.value = state.exposure ?? 1
    houseLight.intensity = hs * 1.4
    screenLight.intensity = 0.9 * (1 - hs)
    scene.fog.density = THREE.MathUtils.lerp(0.022, 0.012, hs)

    const lit = state.project ? Math.max(state.project.dissolve, state.project.morph * 0.3) : 0
    stageKey.intensity = 260 * lit
    stageRim.intensity = 420 * lit
    if (state.beamColor) stageRim.color.copy(state.beamColor)
    for (const [id, p] of Object.entries(projects)) {
      const on = state.project?.id === id
      p.root.visible = on
      if (!on) continue
      const s = state.project
      p.pmat.uniforms.uMorph.value = s.morph
      p.pmat.uniforms.uFade.value = s.fade
      p.pmat.uniforms.uTime.value = t
      p.u.uDissolve.value = s.dissolve
      p.group.visible = s.dissolve > 0.001
      p.root.rotation.y = s.spin ?? 0
      p.root.position.y = STAGE.y + Math.sin(t * 0.7) * 0.04
    }
    composer.render()
  }

  for (const m of Object.values(PROJECT_MODELS)) still(m.still)
  card('prologue', { kicker: 'Now showing', title: 'Tejas Govind' })
  onProgress?.(1)
  return {
    renderer, scene, camera, render, resize, loadProject,
    setActive: v => { active = v },
    debug: { vol, bloom, dust, lamp, hallMat, seats, projector, screenLight, hemi, bulb, flare, streak, projects },
  }
}
