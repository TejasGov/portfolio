import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ChromaticAberrationEffect, NoiseEffect,
  VignetteEffect, ToneMappingEffect, ToneMappingMode, BlendFunction,
} from 'postprocessing'
import { noiseVolume, beamFrame, VolumetricPass, makeDust, glowTexture } from './core'
import { createFilm, FILM_ASPECT } from './film'
import { createJourney } from './journey'
import { createArcade } from './arcade'
import { SketchPass } from './sketch'

/*
 * The one 3D world of the site: a cinema. A projection booth (with the Meshy projector) behind a window
 * in the back wall, a stadium hall baked in Blender (two lighting states: show and house lights),
 * Meshy recliners, the projector beam through haze, and the films that play on the screen (film.js).
 * The projector is a real three.js SpotLight with a texture map, so the film frame lands on the screen
 * and anything standing in the beam casts its shadow there.
 */
export const LENS = new THREE.Vector3(0.9, 7.58, -12.15)
export const WINDOW = new THREE.Vector3(0.9, 7.6, -11.5)
export const SCREEN = new THREE.Vector3(0, 4.15, 15.44)
const SCREEN_W = 18, SCREEN_H = 7.5
/** Where the camera stands, on the screen's axis, when the screen exactly fills (covers) the frame. */
export function insideDistance(fovDeg, aspect) {
  const t = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2))
  return aspect <= SCREEN_W / SCREEN_H ? SCREEN_H / 2 / t : SCREEN_W / 2 / (t * aspect)
}

// Recliner layout: identical to the Blender bake's seat proxies (hall_build.py).
const ROWS = 15, COLS = 22, ROW_D = 1.02, ROW_H = 0.346, Z0 = 4.4
const seatAt = (r, c) => {
  const x = (c - 10.5) * 0.78 + (c >= 11 ? 0.45 : -0.45)
  return [x, r * ROW_H, Z0 - r * ROW_D + x * x * 0.004]
}

// Meshopt for the hall's own models; Draco for the films' and the journey's (scripts/cinema/compress.py).
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'))

function hallMaterial(show, house, gains, detail) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uHouse: { value: 0 }, uExposure: { value: 1 }, uDetailK: { value: 0.9 }, uLog: { value: new THREE.Vector2(gains.show.a, Math.log1p(gains.show.rmax * gains.show.a)) } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec2 uv1; attribute vec2 uv2; // the bake's detail UVs and material id (scripts/cinema/bake.py)
      varying vec2 vUv; varying vec2 vDet; varying float vMid;
      void main() {
        vUv = uv;
        vDet = uv1;
        vMid = uv2.x;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D tShow; uniform sampler2D tHouse; uniform sampler2D tDetail;
      uniform float uHouse; uniform float uExposure; uniform vec2 uLog; uniform float uDetailK;
      varying vec2 vUv; varying vec2 vDet; varying float vMid;
      // The bakes are log-encoded radiance (see the Blender bake script): r = (exp(c * L) - 1) / A.
      vec3 radiance(vec3 c) { return (exp(c * uLog.y) - 1.0) / uLog.x; }
      void main() {
        vec3 a = radiance(texture2D(tShow, vUv).rgb);
        vec3 b = radiance(texture2D(tHouse, vUv).rgb);
        // Real surface under the baked light: carpet pattern, wall fabric, board-marked concrete, velvet.
        vec4 dt = texture2D(tDetail, vDet);
        float id = floor(vMid);
        float c = id < 1.5 ? dt.r : id < 2.5 ? dt.g : id < 3.5 ? dt.b : dt.a;
        float detail = id < 0.5 ? 1.0 : 1.0 + (c - 0.5) * 2.0 * uDetailK;
        gl_FragColor = vec4(mix(a, b, uHouse) * uExposure * detail, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  })
  m.uniforms.tShow = { value: show }
  m.uniforms.tHouse = { value: house }
  m.uniforms.tDetail = { value: detail }
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

export async function createCinema(canvas, { mobile = false, onProgress } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, powerPreference: 'high-performance' })
  const dpr = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75)
  renderer.setPixelRatio(dpr)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
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
  const detailTex = tex.loadAsync('/cinema/hall_detail.webp').then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.NoColorSpace
    t.anisotropy = 8
    return t
  })
  const [hallGltf, show, house, gains, seatGltf, projGltf, detail] = await Promise.all([
    loader.loadAsync('/cinema/hall.glb'),
    loadTex('/cinema/hall_show.webp'),
    loadTex('/cinema/hall_house.webp'),
    fetch('/cinema/hall_gains.json').then(r => r.json()),
    loader.loadAsync('/cinema/seat.glb'),
    loader.loadAsync('/cinema/projector.glb'),
    detailTex,
  ])
  onProgress?.(0.6)
  const hallMat = hallMaterial(show, house, gains, detail)
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

  // ------------------------------------------------------------ the star ceiling
  // Fibre-optic stars between the ceiling baffles, each twinkling at its own pace; they fade when the
  // house lights come up.
  const starN = mobile ? 900 : 2200
  const starPos = new Float32Array(starN * 3), starSeed = new Float32Array(starN)
  for (let i = 0; i < starN; i++) {
    starPos.set([(Math.random() * 2 - 1) * 10.8, 12.47, -11.2 + Math.random() * 26.4], i * 3)
    starSeed[i] = Math.random()
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 1))
  const starU = { uTime: { value: 0 }, uOn: { value: 1 }, uDpr: { value: dpr } }
  const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({
    uniforms: starU,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uDpr; varying float vA; varying vec3 vC;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 40.0);
        vA = tw * (0.4 + aSeed * 0.6);
        vC = mix(vec3(1.0, 0.86, 0.66), vec3(0.8, 0.88, 1.0), step(0.7, aSeed));
        gl_PointSize = clamp((1.2 + aSeed * 1.6) * uDpr * 14.0 / -mv.z, 1.0, 4.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOn; varying float vA; varying vec3 vC;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vC * vA * uOn * 2.4 * smoothstep(0.5, 0.0, r), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }))
  stars.frustumCulled = false
  scene.add(stars)

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
  // Chapter Two's film plays on this, a hair in front of the lit screen.
  // Built on first use: its render target and 150k-point cloud cost nothing until Chapter Two needs them.
  let film = null
  let journey = null
  let arcade = null
  const getFilm = () => {
    if (!film) {
      film = createFilm(renderer, { mobile, loader })
      filmScreen.material.map = film.rt.texture
      filmScreen.material.needsUpdate = true
      // Compile and first-draw the screen now (compile skips hidden meshes; the driver finishes a shader
      // on its first draw), not on Two's first frame (~75 ms).
      const withScreen = fn => { filmScreen.visible = true; const out = offscreen(fn, composer.inputBuffer); filmScreen.visible = false; return out }
      withScreen(() => renderer.compileAsync(scene, camera)).then(() => withScreen(() => renderer.render(scene, camera))).catch(() => {})
    }
    return film
  }
  const worlds = {
    journey: () => (journey ??= createJourney(renderer, { loader, normalize })),
    arcade: () => (arcade ??= createArcade(renderer, { loader, normalize, mobile })),
  }
  // Build a chapter's world ahead of its seam, then compile its shaders and upload its textures, so
  // crossing into it doesn't stall. Called on every idle frame: it compiles again whenever the world
  // has grown (its models load after it is built), and otherwise costs one traversal.
  const seen = {}
  let compiling = null
  // Compile against a render target: the composer draws worlds into one, which takes a different
  // shader variant (no tone mapping, linear output) from drawing to the screen.
  const offscreen = (fn, target = scratch) => {
    const prev = renderer.getRenderTarget()
    renderer.setRenderTarget(target)
    const out = fn()
    renderer.setRenderTarget(prev)
    return out
  }
  const nextFrame = () => new Promise(requestAnimationFrame)
  // Upload a scene's textures a few at a time, about 8 ms a frame.
  const uploadTextures = async root => {
    const textures = new Set()
    root.traverse(o => {
      for (const m of [o.material].flat()) for (const v of Object.values(m ?? {})) if (v?.isTexture) textures.add(v)
    })
    let t0 = performance.now()
    for (const tex of textures) {
      renderer.initTexture(tex)
      if (performance.now() - t0 > 8) await nextFrame(), (t0 = performance.now())
    }
  }
  const prepare = name => {
    const fresh = name === 'journey' ? !journey : !arcade
    const w = worlds[name]()
    if (fresh) return void w.update({ p: 0 }, 0, camera.aspect) // compile on a later frame: two short pauses, not one long one
    let n = 0
    w.scene.traverse(() => n++)
    if (compiling || seen[name] === n) return
    seen[name] = n
    compiling = offscreen(() => renderer.compileAsync(w.scene, w.camera)).then(async () => {
      await uploadTextures(w.scene)
      await nextFrame()
      offscreen(() => renderer.render(w.scene, w.camera)) // then one real draw: geometry and shadow map
      // That draw only sees the first stop; frame each of the others in turn, one a frame, so none
      // uploads its geometry or first shadow pass mid-walk.
      if (name === 'journey') for (let k = 0; k < w.count; k++) {
        await nextFrame()
        w.aim(k, camera.aspect)
        offscreen(() => renderer.render(w.scene, w.camera))
      }
      if (name !== 'arcade') return
      // The game also leaves through the cinema's screen: make its screen target now, not mid-exit.
      await nextFrame()
      const prev = renderer.getRenderTarget()
      renderer.setRenderTarget(gameTarget())
      renderer.render(w.scene, w.camera)
      renderer.setRenderTarget(prev)
    }).finally(() => { compiling = null })
  }
  const scratch = new THREE.WebGLRenderTarget(64, 64)
  // Warm each film once it loads, in idle time and never alongside prepare(): its shaders for the screen's
  // target and for the composer's (used once the camera is inside), its textures, and one draw. Without
  // this the first frame of each film compiled and uploaded mid-scroll in Chapter Two.
  const warmed = new Set()
  const warmFilm = (id, s) => {
    if (!s || warmed.has(id)) return
    warmed.add(id)
    const run = async () => {
      while (compiling) await compiling.catch(() => {})
      compiling = (async () => {
        await offscreen(() => renderer.compileAsync(s.scene, s.camera), film.rt)
        await offscreen(() => renderer.compileAsync(s.scene, s.camera))
        await uploadTextures(s.scene)
        await nextFrame()
        s.update(0)
        offscreen(() => renderer.render(s.scene, s.camera))
      })().catch(() => {}).finally(() => { compiling = null })
    }
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 2000 })
    else setTimeout(run, 500)
  }
  const loadFilm = id => getFilm().load(id).then(s => (warmFilm(id, s), s))
  let gameRT = null
  const gameTarget = () => (gameRT ??= new THREE.WebGLRenderTarget(mobile ? 1152 : 2048, Math.round((mobile ? 1152 : 2048) / FILM_ASPECT), { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 }))
  const showOnScreen = tex => {
    if (filmScreen.material.map === tex) return
    filmScreen.material.map = tex
    filmScreen.material.needsUpdate = true
  }
  const filmScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
    new THREE.MeshBasicMaterial({ fog: false }), // opaque: the film's additive light piles alpha past 1
  )
  filmScreen.position.copy(SCREEN).add(new THREE.Vector3(0, 0, -0.02))
  filmScreen.rotation.y = Math.PI
  filmScreen.visible = false
  scene.add(filmScreen)

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
  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)
  const vol = new VolumetricPass(camera, beam, noise, { scale: 0.5, steps: mobile ? 26 : 46 })
  vol.uniforms.uDensity.value = 0.6
  vol.uniforms.uMaxDist.value = 46
  composer.addPass(vol)
  const bloom = new BloomEffect({ mipmapBlur: true, intensity: 1.0, luminanceThreshold: 0.32, luminanceSmoothing: 0.3, radius: 0.74 })
  const toneMap = new ToneMappingEffect({ mode: ToneMappingMode.AGX })
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.72 })
  const grain = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT })
  const grainBase = mobile ? 0.1 : 0.16
  grain.blendMode.opacity.value = grainBase
  composer.addPass(new EffectPass(camera, new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0008, 0.0005), radialModulation: true, modulationOffset: 0.25 }), bloom, toneMap, vignette, grain))
  const sketch = new SketchPass(camera, noise)
  composer.addPass(sketch)

  // ------------------------------------------------------------ film frames on the screen
  // The spot's projective map is square; the screen fills its full width and a centred band of its height.
  const band = SCREEN_H / SCREEN_W
  let lastCard = ''
  function card(key, { kicker = '', title = '', field = ['#03060c', '#1a2a46'], ink = '#ffffff' } = {}) {
    if (key === lastCard) return
    lastCard = key
    // A CPU-backed canvas: uploading a GPU canvas after a redraw read it back and stalled a frame ~50 ms.
    const g = frame.getContext('2d', { willReadFrequently: true })
    const S = frame.width
    const h = S * band, y0 = (S - h) / 2
    g.fillStyle = '#000'
    g.fillRect(0, 0, S, S)
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
      // An email of any length stays inside the screen; a portrait phone frames only its middle half.
      const fit = Math.min(1, ((mobile ? 0.46 : 0.86) * S) / g.measureText(title).width)
      if (fit < 1) g.font = `400 ${Math.round(h * 0.3 * fit)}px "Instrument Serif", serif`
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

  // ------------------------------------------------------------ per-frame state
  const look = new THREE.Vector3()
  const drawSize = new THREE.Vector2()
  const timer = new THREE.Timer()
  let active = true
  function resize(w, h) {
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  /** Render resolution, lowered by the stage when a GPU can't keep up. Point sprites scale with it. */
  function setDpr(d) {
    renderer.setPixelRatio(d)
    dust.material.uniforms.uDpr.value = d
    starU.uDpr.value = d
    const s = renderer.getSize(new THREE.Vector2())
    resize(s.x, s.y)
  }

  /**
   * state: { pos, target, fov, lamp (0..∞), pull, swirl, bloom, house (0..1), card: {key, ...},
   *          sketch: { r, origin, band, colourBehind } (the ink-drawing wave; omit for the plain world),
   *          project: { id, morph, fade, dissolve, spin } | null, flare }
   */
  function render(state) {
    if (!active) return
    const t = timer.update().getElapsed()
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
    starU.uTime.value = t
    starU.uOn.value = 1 - hs * 0.85
    screenLight.intensity = 0.9 * (1 - hs)
    scene.fog.density = THREE.MathUtils.lerp(0.022, 0.012, hs)

    // Chapter Three's journey is its own world, drawn instead of the hall.
    const jy = state.journey ? worlds.journey() : state.arcade ? worlds.arcade() : null
    // Chapter Four ends on the cinema's screen: the game plays there, framed for it, while the hall is drawn.
    const onScreen = !!state.arcade?.onScreen
    if (onScreen) state.arcade.portrait = camera.aspect < 0.85 // so the screen's centre crop matches the full-frame view
    const res = jy ? jy.update(state.journey ?? state.arcade, t, onScreen ? FILM_ASPECT : camera.aspect) : null
    const walker = res?.here ?? null
    // The film: on the screen from the seats, or the whole frame once the camera is inside it.
    const f = jy ? null : state.film
    const inFilm = !!f && f.inside >= 1
    filmScreen.visible = !!f && !inFilm && (f.show ?? 1) > 0.001
    if (f) {
      f.portrait = camera.aspect < 0.85
      getFilm().update(f, t)
      filmScreen.material.color.setScalar(f.show ?? 1)
      showOnScreen(film.rt.texture)
      if (inFilm) film.cropFor(camera.aspect, renderer.getDrawingBufferSize(drawSize).y)
      else film.renderToTexture()
    }
    if (onScreen) {
      const prev = renderer.getRenderTarget()
      renderer.setRenderTarget(gameTarget())
      renderer.clear()
      renderer.render(jy.scene, jy.camera)
      renderer.setRenderTarget(prev)
      showOnScreen(gameRT.texture)
      filmScreen.visible = (state.arcade.show ?? 1) > 0.001
      filmScreen.material.color.setScalar(state.arcade.show ?? 1)
    }
    const away = onScreen ? null : jy ?? (inFilm ? film : null) // a world other than the hall fills the frame
    renderPass.mainScene = away ? away.scene : scene
    renderPass.mainCamera = away ? away.camera : camera
    vol.enabled = !away
    grain.blendMode.opacity.value = grainBase * (away ? 0.45 : 1) // the hall keeps its film grain; the painted worlds read cleaner
    // Backing out of the screen at the end of Chapter Four, the game's own grade gives way to the hall's
    // as the hall comes into view (k: 0 inside the screen, 1 at the seats), so nothing jumps at the cut.
    const k = onScreen ? state.arcade.back ?? 1 : 1
    vignette.darkness = away ? 0.42 : THREE.MathUtils.lerp(0.42, 0.72, k) // a film is graded on its own; the hall's heavy vignette would muddy it
    // The films and the journey are bright, painted daylight: bloom only their true highlights and keep
    // their colour (Neutral); the dark hall keeps AgX, which holds the lamp's flood gracefully.
    const mode = away || onScreen ? ToneMappingMode.NEUTRAL : ToneMappingMode.AGX
    if (toneMap.mode !== mode) toneMap.mode = mode
    bloom.luminanceMaterial.threshold = away ? 0.95 : THREE.MathUtils.lerp(0.95, 0.32, k)
    if (away) bloom.intensity = 0.55 + (res?.dream ?? 0) * 0.9 // the arcade dance blooms softer and wider
    else if (onScreen) bloom.intensity = THREE.MathUtils.lerp(0.55, bloom.intensity, k)
    // The seams: the world as an ink drawing on the book's paper, and the wave between the two.
    const sk = state.sketch
    const su = sketch.uniforms
    sketch.cam = away ? away.camera : camera
    su.uR.value = sk ? sk.r : 1e5
    if (sk) {
      su.uOrigin.value.copy(sk.follow && walker ? walker : sk.origin)
      su.uBand.value = sk.band ?? 1.2
      su.uColorBehind.value = sk.colourBehind === false ? 0 : 1
      su.uPlane.value = sk.dir ? 1 : 0
      if (sk.dir) su.uDir.value.copy(sk.dir)
      su.uLines.value = sk.ink ?? 1
      // Each seam's own light: a tint (two-toned along the front), or the hue of the world it reveals.
      su.uTint.value.set(sk.tint ?? '#ffe2b0')
      su.uTint2.value.set(sk.tint2 ?? sk.tint ?? '#ffe2b0')
      su.uAuto.value = sk.tint ? 0 : 1
      su.uGrid.value = sk.grid ?? 0.4
      su.uShimmer.value = sk.shimmer ?? 0.8
    }
    su.uTime.value = t
    composer.render()
  }

  card('prologue', { kicker: 'Now showing', title: 'Tejas Govind' })
  // Compile both grades now, so crossing into a film doesn't stall on a shader compile.
  toneMap.mode = ToneMappingMode.NEUTRAL
  composer.render()
  toneMap.mode = ToneMappingMode.AGX
  onProgress?.(1)
  return {
    renderer, scene, camera, render, resize, loadFilm, prepare, setDpr, get dpr() { return renderer.getPixelRatio() },
    setActive: v => { active = v },
    debug: { vol, bloom, toneMap, grain, dust, lamp, hallMat, seats, projector, screenLight, hemi, bulb, flare, streak },
  }
}
