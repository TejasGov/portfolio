import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'
import { sound } from '../lib/sound'
import { sfx } from './audio'

/*
 * The landing (Landing.jsx mounts it, then imports this module, which runs once): a stone circle under the Milky
 * Way, modelled, lit and baked in Blender (scripts/landing/stage.py -> public/landing/stage.*), its surfaces
 * photo-scanned rock and flagstone (CC0, Poly Haven) multiplied over the baked light, with scanned plants, two iron
 * lanterns and a still black pool. Over the pool, Tejas's head and shoulders as a particle cloud sampled from
 * public/tejas_about.webp (via a small copy).
 *
 * The opening: a loader; the circle as points under the stars, waiting for a hold (it goes in by itself after 7 s);
 * a wave of light turns the points to stone; points stream in from every star in the sky to form the bust; the name
 * drops onto the floor letter by letter. After that the halo's light, the lanterns' flames, the mist, the dust and
 * the moonlight move, and the bust parts around the pointer. Scrolling swings round the circle and up into the Milky
 * Way as the bust goes home to the stars, then fades to black into the Prologue's booth.
 * ?instant skips the opening (for review). Sound follows the site's switch (lib/sound.js).
 */


const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const instant = new URLSearchParams(location.search).has('instant') // demo review: skip the opening, land on its end
const phone = matchMedia('(max-width: 760px)').matches
const $ = id => document.getElementById(id)
const canvas = $('gl'), section = $('landing'), sheet = $('sheet'), veil = $('veil'), loaderEl = $('loader')
// The billing rides in the footer here: the name stands low on the floor, as in the concept.

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 1.75))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
const scene = new THREE.Scene()
scene.background = new THREE.Color('#020204')
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 220)

const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 })
const composer = new EffectComposer(renderer, rt)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.55, 0.6, 0.85)
composer.addPass(bloom)
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 v = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      c *= 1.0 - 0.55 * smoothstep(0.35, 1.15, length(v)); // vignette
      c += vec3(0.0016, 0.0026, 0.0045) * (1.0 - smoothstep(0.0, 0.05, dot(c, vec3(0.33)))); // the blacks lift to a deep blue
      c += (h(vUv * uRes + fract(uTime) * 91.0) - 0.5) * 0.006; // grain
      gl_FragColor = vec4(c, 1.0);
    }`,
})
composer.addPass(grade)
composer.addPass(new OutputPass())

// ---------------------------------------------------------------------------------------------- shared GLSL
const HEAD = new THREE.Vector3(0, 3.3, 0), HEAD_H = 2.2 // the head's centre and height; the shoulders fade out just above the pool
const NAME_Z = 5.5 // standing on the floor in front of the pool, so the pool shows above it
const U = {
  uTime: { value: 0 }, // seconds since the page started
  uT: { value: -100 }, // seconds since the opening began
  uReveal: { value: 0 }, // the light wave's radius, metres from the pool
  uBlueprint: { value: 0 }, // 0..1: the scene drawn as points and lines, before the light comes
  uExposure: { value: 2.4 },
  uShock: { value: -100 }, uNameHalf: { value: 2.5 }, uNameZ: { value: NAME_Z },
  uLantern0: { value: new THREE.Vector3() }, uLantern1: { value: new THREE.Vector3() }, uFlick: { value: new THREE.Vector2(1, 1) },
}
const BG = 'vec3(0.006, 0.009, 0.02)'
const GLSL = /* glsl */ `
  uniform float uReveal, uBlueprint; uniform vec3 uLantern0, uLantern1; uniform vec2 uFlick;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y);
    float b = mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y);
    return mix(a, b, f.z);
  }
  float fbm3(vec3 p) { float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += w * noise3(p); p *= 2.07; w *= 0.5; } return a; }
  float fogK(float d) { return 1.0 - exp(-pow(d * 0.034, 1.6)); }
  // The baked radiance, log-encoded by scripts/landing/stage.py (a = 400, rmax = 10).
  // Light alone: stage.py bakes every surface as flat grey (0.25), so dividing it out leaves the light falling there.
  vec3 decode(vec3 c) { return (exp(c * log(1.0 + 4000.0)) - 1.0) / 400.0 / 0.25; }
  // Photo-scanned albedo, cooled and pulled toward grey for the moonlit palette.
  vec3 grade(vec3 a) { float l = dot(a, vec3(0.299, 0.587, 0.114)); return mix(vec3(l), a, 0.35) * vec3(0.86, 0.95, 1.12); }
  // The light wave: how lit a point is, and the bright band at the wave's front.
  vec2 reveal(vec3 w) {
    float front = uReveal - (length(w - vec3(0.0, 0.8, 0.0)) + 1.6 * noise(w.xz * 0.35 + w.y * 0.2));
    return vec2(smoothstep(0.0, 3.5, front), exp(-pow(front * 0.8, 2.0)));
  }
  // The lanterns' flames breathe: the baked light near each one rises and falls a little.
  float flicker(vec3 w) {
    vec3 a = w - uLantern0, b = w - uLantern1;
    return 1.0 + 0.35 * (exp(-dot(a, a) * 0.18) * (uFlick.x - 1.0) + exp(-dot(b, b) * 0.18) * (uFlick.y - 1.0));
  }
  const vec3 WAVE = vec3(0.55, 0.85, 1.0);
`

// ---------------------------------------------------------------------------------------------- the stage (baked)
const manager = new THREE.LoadingManager()
const texLoader = new THREE.TextureLoader(manager)
const bakedTex = url => {
  const t = texLoader.load(url)
  t.flipY = false // glTF UVs
  t.colorSpace = THREE.NoColorSpace // log-encoded data, not colour
  t.anisotropy = 8
  return t
}
const stonesMap = bakedTex('/landing/stage_stones.webp')
const floorMap = bakedTex('/landing/stage_floor.webp')
// The surfaces, as bricelab.dev builds them: photo-scanned textures tiling at their true scale over the baked light.
// CC0 scans from Poly Haven (polyhaven.com): dark_rock for the stones, monastery_stone_floor for the floor.
const scan = (url, srgb) => {
  const t = texLoader.load(url)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  return t
}
const rockDiff = scan('/landing/rock_diff.webp', true), rockNor = scan('/landing/rock_nor.webp')
const slabDiff = scan('/landing/slab_diff.webp', true), slabNor = scan('/landing/slab_nor.webp'), slabRough = scan('/landing/slab_rough.webp')

const stonesMat = new THREE.ShaderMaterial({
  uniforms: { ...U, uMap: { value: stonesMap }, uDiff: { value: rockDiff }, uNor: { value: rockNor } },
  vertexShader: /* glsl */ `
    varying vec2 vMapUv; varying vec3 vWorld, vNormal; varying float vDist;
    void main() {
      vMapUv = uv;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz; vDist = distance(w.xyz, cameraPosition);
      vNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap, uDiff, uNor; uniform float uExposure;
    varying vec2 vMapUv; varying vec3 vWorld, vNormal; varying float vDist;
    ${GLSL}
    void main() {
      // Triplanar: the scan projected along the three axes and blended by the surface's facing, so no face stretches.
      vec3 n = normalize(vNormal);
      vec3 bw = pow(abs(n), vec3(5.0)); bw /= bw.x + bw.y + bw.z;
      const float S = 0.36; // one tile per 2.8 m, the scan's own scale
      vec2 ux = vWorld.zy * S, uy = vWorld.xz * S, uz = vWorld.xy * S;
      vec3 alb = texture2D(uDiff, ux).rgb * bw.x + texture2D(uDiff, uy).rgb * bw.y + texture2D(uDiff, uz).rgb * bw.z;
      // Its normal map, whiteout-blended per axis onto the surface normal.
      vec3 tx = texture2D(uNor, ux).xyz * 2.0 - 1.0, ty = texture2D(uNor, uy).xyz * 2.0 - 1.0, tz = texture2D(uNor, uz).xyz * 2.0 - 1.0;
      vec3 nx = vec3(0.0, tx.y, tx.x) * sign(n.x), ny = vec3(ty.x, 0.0, ty.y) * sign(n.y), nz = vec3(tz.x, tz.y, 0.0) * sign(n.z);
      vec3 np = normalize(n + (nx * bw.x + ny * bw.y + nz * bw.z) * 1.4);
      // The baked light is smooth; the scan's relief shades it, lit as the bake was: soft sky from the camera's side, moon above.
      vec3 key = normalize(vec3(0.0, 0.35, 1.0)), moon = normalize(vec3(-0.35, 0.75, -0.55));
      float relief = clamp(1.0 + 1.6 * (dot(np, key) - dot(n, key)) + 0.8 * (dot(np, moon) - dot(n, moon)), 0.35, 1.9);
      // Moss: low on the stones, on faces that catch the damp, in patches.
      float moss = smoothstep(1.4, 0.1, vWorld.y + 0.8 * noise(vWorld.xz * 1.3 + vWorld.y)) * smoothstep(0.42, 0.7, noise(vWorld.xz * 2.1 + vWorld.y * 1.7)) * (1.0 - smoothstep(0.4, 0.8, n.y)) * 0.8;
      vec3 surface = mix(grade(alb) * 3.2, vec3(0.1, 0.14, 0.075), moss * 0.7); // the scan is very dark rock: brought up to weathered grey
      vec2 r = reveal(vWorld);
      vec3 col = surface * decode(texture2D(uMap, vMapUv).rgb) * uExposure * relief * flicker(vWorld) * r.x + WAVE * r.y * 0.05;
      gl_FragColor = vec4(mix(col, ${BG}, fogK(vDist)), 1.0);
    }`,
})

// The floor is the mirror: a still pool in the rim (sharp, dark water) and polished flagstones round it (a faint,
// smeared reflection), over the baked light, with an astrolabe's rings and ticks cut into the stone.
let floor = null
function makeFloor(geo) {
  geo.rotateX(Math.PI / 2) // Reflector wants its plane facing +z; it's turned back flat below
  floor = new Reflector(geo, {
    clipBias: 0.003, textureWidth: 2, textureHeight: 2,
    shader: {
      name: 'StageFloor',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, ...U, uMap: { value: floorMap }, uDiff: { value: slabDiff }, uNor: { value: slabNor }, uRough: { value: slabRough } },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vUv; varying vec2 vMapUv; varying vec3 vWorld; varying float vDist;
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          vMapUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz; vDist = distance(w.xyz, cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse, uMap, uDiff, uNor, uRough; uniform float uTime, uExposure, uShock, uNameHalf, uNameZ;
        varying vec4 vUv; varying vec2 vMapUv; varying vec3 vWorld; varying float vDist;
        ${GLSL}
        // A thin bright line at radius R.
        float line(float r, float R, float w) { return exp(-pow((r - R) / w, 2.0)); }
        void main() {
          float r = length(vWorld.xz);
          float pool = 1.0 - smoothstep(2.33, 2.37, r);
          vec2 tuv = vWorld.xz / 3.2; // one tile of the scan per 3.2 m
          vec3 alb = grade(texture2D(uDiff, tuv).rgb);
          vec3 tn = texture2D(uNor, tuv).xyz * 2.0 - 1.0; // tangent space: x along world x, y along world -z
          float rough = texture2D(uRough, tuv).r;
          vec3 np = normalize(vec3(tn.x, 1.0, -tn.y));
          vec3 key = normalize(vec3(0.0, 0.35, 1.0));
          float relief = clamp(1.0 + 1.8 * (dot(np, key) - key.y), 0.4, 1.8);
          vec3 lit = alb * 1.1 * decode(texture2D(uMap, vMapUv).rgb) * uExposure * relief * flicker(vWorld);

          // Reflection: the pool is still, dark water. The flagstones are wet: the reflection ripples over their relief
          // and smears where the stone is rough; the joints hold no water.
          vec2 n = vec2(noise(vWorld.xz * 1.1 + uTime * 0.05), noise(vWorld.xz * 1.1 + 9.0 - uTime * 0.04)) - 0.5;
          float blur = mix(0.0015 + 0.008 * rough, 0.0004, pool);
          vec3 refl = vec3(0.0);
          for (int i = -3; i <= 3; i++) {
            vec4 uv = vUv;
            uv.xy += (mix(tn.xy * 0.02, n * 0.001, pool) + vec2(0.0, float(i) * blur)) * uv.w;
            refl += texture2DProj(tDiffuse, uv).rgb;
          }
          refl /= 7.0;
          float fres = 0.08 + 0.92 * pow(1.0 - normalize(cameraPosition - vWorld).y, 3.0);
          float wet = (1.0 - smoothstep(0.35, 0.85, rough)) * 0.85 + 0.15;
          vec3 col = lit * (1.0 - pool) + refl * mix(0.55 * fres * wet, 0.95, pool);
          col = mix(col, col * vec3(0.4, 0.5, 0.65), pool); // the water's own dark blue

          // The rings: thin glowing lines cut into the floor, and small glyph circles set on the middle ring.
          float a = atan(vWorld.z, vWorld.x);
          float aa = fwidth(r) * 0.8; // never thinner than a pixel, so the lines hold at distance
          float rings = line(r, 4.0, 0.007 + aa) + 0.7 * line(r, 4.16, 0.005 + aa) + line(r, 6.3, 0.008 + aa) + 0.6 * line(r, 7.25, 0.007 + aa);
          for (int k = 0; k < 8; k++) {
            float ang = float(k) * 0.7853982 + 0.39;
            vec2 c = vec2(cos(ang), sin(ang)) * 6.3;
            float dc = distance(vWorld.xz, c);
            rings += line(dc, 0.26, 0.006 + aa) * 0.9 + line(dc, 0.13, 0.005 + aa) * 0.5;
          }
          rings += step(0.9, fract(a / 6.2831853 * 120.0)) * step(4.2, r) * step(r, 4.4) * 0.35; // a band of fine ticks
          vec2 rv = reveal(vWorld);
          col = col * rv.x + vec3(0.18, 0.72, 0.92) * min(rings, 1.2) * (0.5 * rv.x + 0.6 * rv.y + 0.2 * uBlueprint * (1.0 - rv.x)) * (1.0 - pool) + WAVE * rv.y * 0.03 * (1.0 - pool);

          // The name's landing: a shock that runs out from the line of letters.
          float dn = distance(vWorld.xz, vec2(clamp(vWorld.x, -uNameHalf, uNameHalf), uNameZ));
          float tau = uTime - uShock;
          col += WAVE * exp(-pow((dn - tau * 7.0) * 1.6, 2.0)) * exp(-tau * 1.3) * step(0.0, tau) * 0.22;

          gl_FragColor = vec4(mix(col, ${BG}, fogK(vDist)), 1.0);
        }`,
    },
  })
  for (const k in U) floor.material.uniforms[k] = U[k] // Reflector clones its uniforms: share the live ones again
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)
}

const gltfLoader = new GLTFLoader(manager).setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'))
const stageReady = Promise.all([
  gltfLoader.loadAsync('/landing/stage.glb'),
  fetch('/landing/stage_meta.json').then(r => r.json()),
]).then(([gltf, meta]) => {
  U.uLantern0.value.fromArray(meta.lanterns[0])
  U.uLantern1.value.fromArray(meta.lanterns[1])
  lanternGlows.forEach((g, k) => g.position.fromArray(meta.lanterns[k]))
  const plants = makePlants(meta.feet) // the loader waits for them too
  gltf.scene.traverse(o => {
    if (!o.isMesh) return
    o.updateWorldMatrix(true, false)
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld)
    if (o.name.startsWith('floor')) makeFloor(geo)
    else {
      const mesh = new THREE.Mesh(geo, stonesMat)
      scene.add(mesh)
      makeBlueprint(mesh)
    }
  })
  return plants
})

// The sky. All round: deep blue night and sharp procedural stars. Behind the stones: a painted Milky Way
// (public/landing/sky.webp) on a curved backdrop, its band fitted into the strip of sky the camera sees, its
// edges dissolving into the night round it. The painted stars are soft at this size, so sharp ones are drawn over.
const STARS = /* glsl */ `
  float stars(vec3 d, float scale, float keep) {
    vec3 g = d * scale, id = floor(g), f = fract(g) - 0.5;
    vec3 o = vec3(hash3(id), hash3(id + 3.1), hash3(id + 7.7)) - 0.5;
    float on = step(keep, hash3(id + 1.3));
    float tw = 0.65 + 0.35 * sin(uTime * (0.5 + hash3(id) * 2.0) + hash3(id) * 60.0);
    return on * tw * (0.4 + 0.6 * hash3(id + 9.1)) * smoothstep(0.1, 0.0, length(f - o * 0.7));
  }
  vec3 night(vec3 d) {
    vec3 col = vec3(0.004, 0.007, 0.018) + vec3(0.02, 0.035, 0.06) * exp(-max(d.y, 0.0) * 6.0);
    return col + vec3(0.9, 0.94, 1.0) * (stars(d, 150.0, 0.94) * 0.9 + stars(d, 320.0, 0.92) * 0.45);
  }
`
const sky = new THREE.Mesh(new THREE.SphereGeometry(110, 64, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: U,
  vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec3 vDir;
    ${GLSL}
    ${STARS}
    void main() {
      vec3 d = normalize(vDir);
      gl_FragColor = vec4(night(d) * smoothstep(-0.03, 0.08, d.y) * max(smoothstep(14.0, 34.0, uReveal), 0.32 * uBlueprint), 1.0);
    }`,
}))
scene.add(sky)
const SKY_ARC = THREE.MathUtils.degToRad(140), SKY_R = 100 // a 21:9 4K panorama over 140 degrees: about the screen's own pixel density
const skyTex = texLoader.load(phone ? '/landing/sky-phone.webp' : '/landing/sky.webp') // 4096 px (2048 on phones), from a 6256 px FLUX 3 render
skyTex.colorSpace = THREE.SRGBColorSpace
skyTex.anisotropy = 8
skyTex.generateMipmaps = true
const backdrop = new THREE.Mesh(
  new THREE.CylinderGeometry(SKY_R, SKY_R, 1, 96, 1, true, Math.PI - SKY_ARC / 2, SKY_ARC),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true,
    uniforms: { ...U, uSky: { value: skyTex } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vDir; void main() { vUv = uv; vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uSky; uniform float uTime;
      varying vec2 vUv; varying vec3 vDir;
      ${GLSL}
      ${STARS}
      void main() {
        vec3 d = normalize(vDir);
        vec3 paint = texture2D(uSky, vec2(1.0 - vUv.x, mix(0.12, 0.72, vUv.y))).rgb; // the strip with the band in it, at its true proportions
        paint = pow(paint, vec3(1.1)) * 0.85;
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(1.0, 0.8, vUv.y);
        vec3 col = mix(night(d), paint, edge);
        gl_FragColor = vec4(col * smoothstep(-0.03, 0.06, d.y) * max(smoothstep(14.0, 34.0, uReveal), 0.16 * uBlueprint), 1.0);
      }`,
  }),
)
backdrop.scale.y = SKY_R * Math.tan(THREE.MathUtils.degToRad(33)) + 6 // from just under the horizon to 33 degrees up
backdrop.position.y = backdrop.scale.y / 2 - 6
scene.add(backdrop)

// The hills: a low dark ridge all round on the horizon, seen through the gaps between the stones, lost in haze.
{
  const N = 240, pos = []
  const ridge = a => 3.2 + 2.6 * Math.sin(a * 3 + 1) * Math.sin(a * 1.7) + 1.4 * Math.sin(a * 7.3 + 2) + 0.6 * Math.sin(a * 17 + 4)
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2, R = 75
    pos.push(Math.sin(a) * R, -4, Math.cos(a) * R, Math.sin(a) * R, Math.max(0.5, ridge(a)), Math.cos(a) * R)
  }
  const idx = []
  for (let i = 0; i < N; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  scene.add(new THREE.Mesh(g, new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: U,
    vertexShader: /* glsl */ `varying float vY; void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying float vY;
      ${GLSL}
      void main() { // dark land, a breath of haze along its crest
        vec3 col = ${BG} * 0.55 + vec3(0.01, 0.016, 0.03) * smoothstep(-1.0, 6.0, vY);
        gl_FragColor = vec4(col * smoothstep(14.0, 34.0, uReveal), 1.0);
      }`,
  })))
}

// The air: soft drifting haze between the stones (moonlit blue, warm near the lanterns), a glow round the bust,
// halos round the lanterns, mist breathing off the pool.
const airMat = (tint, gain, scale) => new THREE.ShaderMaterial({
  uniforms: { ...U, uTint: { value: new THREE.Color(tint) }, uGain: { value: gain }, uScale: { value: scale } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vWorld; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uTint; uniform float uGain, uScale, uTime;
    varying vec2 vUv; varying vec3 vWorld;
    ${GLSL}
    void main() {
      float n = fbm3(vec3(vWorld.xy * uScale, uTime * 0.03) + vec3(uTime * 0.02, 0.0, 0.0));
      float shape = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
      vec3 a = vWorld - uLantern0, b = vWorld - uLantern1;
      vec3 warm = vec3(1.0, 0.6, 0.3) * (exp(-dot(a, a) * 0.08) * uFlick.x + exp(-dot(b, b) * 0.08) * uFlick.y) * 0.6;
      vec3 c = vWorld - vec3(0.0, 2.6, 0.0);
      vec3 cool = vec3(0.0);
      gl_FragColor = vec4((uTint + warm + cool) * pow(n, 2.2) * shape * uGain * reveal(vWorld).x, 1.0);
    }`,
})
for (const [z, y, w, h, gain] of [[-14, 3.5, 60, 10, 0.05], [-9.5, 2.2, 40, 6, 0.05]]) { // only behind the circle: a sheet nearer the bust read as a lit rectangle
  const sheetMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), airMat('#1d3350', gain, 0.18))
  sheetMesh.position.set(0, y, z)
  scene.add(sheetMesh)
}
const glowMat = (tint, gain, flick) => new THREE.ShaderMaterial({
  uniforms: { ...U, uTint: { value: new THREE.Color(tint) }, uGain: { value: gain }, uWhich: { value: flick } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uTint; uniform float uGain, uWhich, uT; uniform vec2 uFlick;
    varying vec2 vUv;
    void main() {
      float r = length(vUv - 0.5) * 2.0;
      float f = uWhich < 0.5 ? 1.0 : uWhich < 1.5 ? uFlick.x : uFlick.y;
      float on = uWhich < 0.5 ? smoothstep(4.0, 7.0, uT) : smoothstep(0.6, 2.0, uT);
      gl_FragColor = vec4(uTint * pow(max(0.0, 1.0 - r), 2.4) * uGain * f * on, 1.0);
    }`,
})
// The shaft: a soft column of moonlight falling through the open sky onto the bust, dust drifting down it. Brightest
// along its axis, gone at its edges (it faces the camera through its own surface normal), fading top and bottom.
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.6, 11, 48, 1, true), new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: /* glsl */ `
    varying vec3 vWorld, vN; varying float vY;
    void main() {
      vY = position.y / 11.0 + 0.5;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime, uT;
    varying vec3 vWorld, vN; varying float vY;
    ${GLSL}
    void main() {
      vec3 v = normalize(cameraPosition - vWorld);
      float core = pow(abs(dot(normalize(vec3(vN.x, 0.0, vN.z)), normalize(vec3(v.x, 0.0, v.z)))), 2.5); // dense where we look through its middle
      float motes = 0.75 + 0.25 * noise(vec2(atan(vN.z, vN.x) * 3.0, vY * 9.0 + uTime * 0.25));
      float a = core * motes * smoothstep(0.0, 0.35, vY) * smoothstep(1.0, 0.6, vY) * smoothstep(3.5, 6.0, uT);
      gl_FragColor = vec4(vec3(0.42, 0.6, 0.9) * a * 0.09, 1.0);
    }`,
}))
shaft.position.set(HEAD.x - 0.6, HEAD.y + 3.6, HEAD.z - 0.3)
shaft.rotation.z = 0.12 // the moon is a little to the left, high behind
scene.add(shaft)

const glows = []
const aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat('#6fb6ff', 0.2, 0))
aura.scale.set(7.5, 7.5, 1)
aura.position.set(HEAD.x, HEAD.y - 0.6, HEAD.z - 0.8)
glows.push(aura)
const lanternGlows = [1, 2].map(k => {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat('#ffa75a', 0.5, k))
  g.scale.set(2.6, 2.6, 1)
  glows.push(g)
  return g
})
glows.forEach(g => (g.material.depthTest = true, scene.add(g)))

const MIST = phone ? 160 : 320
const mistPos = new Float32Array(MIST * 3), mistSeed = new Float32Array(MIST)
for (let i = 0; i < MIST; i++) {
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 2.2
  mistPos.set([Math.cos(a) * r, 0, Math.sin(a) * r], i * 3)
  mistSeed[i] = Math.random()
}
const mistGeo = new THREE.BufferGeometry()
mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3))
mistGeo.setAttribute('aSeed', new THREE.BufferAttribute(mistSeed, 1))
const MU = { ...U, uSize: { value: 400 } }
const mist = new THREE.Points(mistGeo, new THREE.ShaderMaterial({
  uniforms: MU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    attribute float aSeed; uniform float uTime, uSize, uT; varying float vA;
    void main() {
      float ph = fract(uTime * (0.025 + 0.02 * aSeed) + aSeed);
      vec3 p = position + vec3(sin(uTime * 0.2 + aSeed * 30.0) * 0.4, 0.15 + ph * 1.8, cos(uTime * 0.17 + aSeed * 20.0) * 0.4);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uSize * (0.6 + ph) / -mv.z;
      vA = sin(ph * 3.14159) * 0.05 * smoothstep(0.5, 2.0, uT);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying float vA;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0;
      gl_FragColor = vec4(vec3(0.55, 0.75, 1.0) * pow(max(0.0, 1.0 - r), 2.0) * vA, 1.0);
    }`,
}))
mist.frustumCulled = false
scene.add(mist)

// The halo: two fine rings tilted round the head, like a planet's, a soft comet of light running each.
const haloMat = (speed, phase) => new THREE.ShaderMaterial({
  uniforms: { ...U, uSpeed: { value: speed }, uPhase: { value: phase } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime, uT, uSpeed, uPhase; varying vec2 vUv;
    void main() {
      float comet = pow(0.5 + 0.5 * cos((vUv.x - uTime * uSpeed - uPhase) * 6.2831853), 24.0);
      float on = smoothstep(3.4, 5.4, uT); // the halo lights as the bust forms
      gl_FragColor = vec4(vec3(0.62, 0.86, 1.0) * (0.55 + 1.4 * comet) * on, 1.0);
    }`,
})
const halo = new THREE.Group()
const halo1 = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.012, 8, 480), haloMat(0.045, 0))
const halo2 = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.008, 8, 480), haloMat(-0.03, 0.5))
halo.add(halo1, halo2)
halo.position.set(HEAD.x, HEAD.y - 0.45, HEAD.z)
halo.rotation.set(1.36, 0, -0.3) // tipped nearly flat and tilted, crossing in front of the neck and behind the head
scene.add(halo)

// Dust in the air, drifting up through the light.
const DUST = phone ? 1500 : 3000
const dustPos = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST)
for (let i = 0; i < DUST; i++) {
  dustPos.set([(Math.random() - 0.5) * 34, Math.random() * 12, -16 + Math.random() * 26], i * 3)
  dustSeed[i] = Math.random()
}
const dustGeo = new THREE.BufferGeometry()
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1))
const DU = { ...U, uSize: { value: 20 } }
const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
  uniforms: DU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    attribute float aSeed; uniform float uTime, uSize; varying float vA;
    ${GLSL}
    void main() {
      vec3 p = position;
      p.y = mod(p.y + uTime * (0.03 + 0.06 * aSeed), 12.0);
      p.x += sin(uTime * 0.12 + aSeed * 40.0) * 0.3;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uSize * (0.4 + aSeed) / -mv.z;
      vA = (0.12 + 0.3 * aSeed) * (1.0 - fogK(-mv.z)) * smoothstep(0.0, 1.0, p.y) * smoothstep(12.0, 9.0, p.y) * reveal(p).x;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying float vA;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * smoothstep(0.25, 0.0, dot(c, c)) * vA, 1.0);
    }`,
}))
dust.frustumCulled = false
scene.add(dust)

// ---------------------------------------------------------------------------------------------- the blueprint
// Before the light, the stone circle is there only as points: fine, cool, sampled over every stone's surface (as
// bricelab.dev shows its atrium as points before it materialises). The wave turns them to stone as it passes.
function makeBlueprint(mesh) {
  const n = phone ? 11000 : 26000
  const sampler = new MeshSurfaceSampler(mesh).build()
  const pos = new Float32Array(n * 3), seed = new Float32Array(n), v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    sampler.sample(v)
    pos.set([v.x, v.y, v.z], i * 3)
    seed[i] = Math.random()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: DU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uSize; varying float vA;
      ${GLSL}
      void main() {
        vec2 r = reveal(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        mv.xyz *= 0.993; // a hair toward the camera: the points sit on the stones' own surface
        gl_PointSize = max(1.6, uSize * (0.9 + 1.4 * r.y) / -mv.z);
        float tw = 0.7 + 0.3 * sin(uTime * 2.0 + aSeed * 50.0);
        vA = (uBlueprint * (1.0 - r.x) * 0.3 * tw + r.y * 1.0) * (1.0 - fogK(-mv.z) * 0.7) * step(aSeed, 0.4 + 0.6 * uBlueprint);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        gl_FragColor = vec4(vec3(0.62, 0.85, 1.0) * smoothstep(0.25, 0.0, dot(c, c)) * vA, 1.0);
      }`,
  }))
  pts.frustumCulled = false
  scene.add(pts)
}

// ---------------------------------------------------------------------------------------------- the plants
// Photo-scanned plants (CC0, Poly Haven: grass_medium_02, fern_02, moss_01), placed sparingly: grass and the odd fern
// where the stones meet the floor, moss cushions round the pool's rim and at the stones' feet, a few tufts in the
// floor's joints and a thin band beyond the circle. Their leaves are cut out by the scans' alpha maps, lit like the
// stones (moonlit sky, the lanterns' flames, the bust's glow), and they move a little in the wind.
const PLANTS = {
  grass: { url: '/landing/plants/grass_medium_02/grass_medium_02.gltf', tex: 'grass_medium_02', size: [0.32, 0.6] },
  fern: { url: '/landing/plants/fern_02/fern_02.gltf', tex: 'fern_02', size: [0.45, 0.75] },
  moss: { url: '/landing/plants/moss_01/moss_01.gltf', tex: 'moss_01', size: [0.07, 0.14], wide: true },
}
const plantTex = (name, file, srgb) => {
  const t = texLoader.load(`/landing/plants/${name}/textures/${file}`)
  t.flipY = false // glTF UVs
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  return t
}
const plantMat = name => new THREE.ShaderMaterial({
  uniforms: { ...U, uMap: { value: plantTex(name, `${name}_diff_1k.jpg`, true) }, uAlpha: { value: plantTex(name, `${name}_alpha_1k.png`) } },
  side: THREE.DoubleSide,
  vertexShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv; varying float vH; varying vec3 vWorld; varying float vDist;
    void main() {
      vUv = uv;
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vH = clamp(w.y / 0.6, 0.0, 1.0);
      float gust = sin(uTime * 1.1 + w.x * 0.35 + w.z * 0.2) * 0.6 + sin(uTime * 2.3 + w.x * 1.7 + w.z) * 0.4;
      w.xz += vec2(0.045, 0.02) * gust * vH * vH;
      vWorld = w.xyz; vDist = distance(w.xyz, cameraPosition);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap, uAlpha;
    varying vec2 vUv; varying float vH; varying vec3 vWorld; varying float vDist;
    ${GLSL}
    void main() {
      if (texture2D(uAlpha, vUv).r < 0.5) discard;
      vec3 alb = texture2D(uMap, vUv).rgb;
      alb = mix(vec3(dot(alb, vec3(0.299, 0.587, 0.114))), alb, 0.7) * vec3(0.85, 0.95, 1.05); // the night takes the colour down
      vec3 a = vWorld - uLantern0, b = vWorld - uLantern1, c = vWorld - vec3(0.0, 2.6, 0.0);
      vec3 light = vec3(0.32, 0.4, 0.55) * (0.45 + 0.55 * vH) // sky, darker down among the leaves
                 + vec3(2.2, 1.2, 0.55) * (exp(-dot(a, a) * 0.1) * uFlick.x + exp(-dot(b, b) * 0.1) * uFlick.y)
                 + vec3(0.3, 0.45, 0.6) * exp(-dot(c, c) * 0.04);
      gl_FragColor = vec4(mix(alb * light * 0.75 * reveal(vWorld).x, ${BG}, fogK(vDist)), 1.0);
    }`,
})
async function makePlants(feet) {
  const kinds = {}
  await Promise.all(Object.entries(PLANTS).map(async ([kind, def]) => {
    const gltf = await gltfLoader.loadAsync(def.url)
    const variants = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse(o => {
      if (!o.isMesh) return
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld)
      g.computeBoundingBox()
      const bb = g.boundingBox, c = bb.getCenter(new THREE.Vector3())
      g.translate(-c.x, -bb.min.y, -c.z) // each variant stands at the origin
      const span = def.wide ? Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) : bb.max.y - bb.min.y
      variants.push({ g, span })
    })
    kinds[kind] = { def, variants, mat: plantMat(def.tex), spots: [] }
  }))
  const put = (kind, x, z, y = 0) => kinds[kind].spots.push([x, y, z])
  const clear = (x, z) => Math.hypot(x, z) > 3.05 && !(Math.abs(x) < 3.4 && z > 4.3 && z < 7.0) // the pool and the name stay clear
  feet.forEach(([x, z, w, d, yaw], i) => {
    const X = [Math.cos(yaw), -Math.sin(yaw)], Z = [-Math.sin(yaw), -Math.cos(yaw)] // the stone's width and depth axes
    const around = (off, cb) => {
      const a = Math.random() * Math.PI * 2, lx = Math.cos(a) * (w / 2 + off), lz = Math.sin(a) * (d / 2 + off)
      cb(x + lx * X[0] + lz * Z[0], z + lx * X[1] + lz * Z[1])
    }
    for (let k = 3 + Math.floor(Math.random() * 3); k > 0; k--) around(0.04 + Math.random() * 0.3, (px, pz) => put('grass', px, pz))
    for (let k = 2; k > 0; k--) around(0.0 + Math.random() * 0.12, (px, pz) => put('moss', px, pz))
    if (i < 16 && Math.random() < 0.4) around(0.25 + Math.random() * 0.3, (px, pz) => put('fern', px, pz))
  })
  for (let i = 0; i < 30; i++) { // moss along the outside of the rim
    const a = Math.random() * Math.PI * 2, r = 3.05 + Math.random() * 0.2
    put('moss', Math.cos(a) * r, Math.sin(a) * r)
  }
  for (let i = 0; i < 64; i++) { // a thin band beyond the circle, and a few tufts in the floor's joints inside it
    const a = Math.random() * Math.PI * 2, r = i < 46 ? 9.8 + Math.random() * 9 : 4.4 + Math.random() * 3
    const x = Math.sin(a) * r, z = -Math.cos(a) * r
    if (clear(x, z)) put(i < 46 && Math.random() < 0.2 ? 'fern' : 'grass', x, z)
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3()
  for (const { def, variants, mat, spots } of Object.values(kinds)) {
    const buckets = variants.map(() => [])
    spots.forEach(s => buckets[Math.floor(Math.random() * variants.length)].push(s))
    variants.forEach(({ g, span }, vi) => {
      if (!buckets[vi].length) return
      const inst = new THREE.InstancedMesh(g, mat, buckets[vi].length)
      buckets[vi].forEach(([x, y, z], i) => {
        const k = (def.size[0] + Math.random() * (def.size[1] - def.size[0])) / span
        inst.setMatrixAt(i, m.compose(v.set(x, y, z), q.setFromAxisAngle(up, Math.random() * 6.283), sc.set(k, k, k)))
      })
      inst.frustumCulled = false
      scene.add(inst)
    })
  }
}

// ---------------------------------------------------------------------------------------------- the bust
// Outlines in the photo's 1500 x 2000 frame: the head (hair, back of the head, neck, profile) and the shoulders.
const OUTLINE = [[505, 500], [560, 330], [660, 275], [800, 255], [950, 265], [1080, 300], [1170, 370], [1215, 470], [1215, 580], [1180, 690],
  [1110, 800], [1080, 900], [1060, 980], [1070, 1060], [600, 1070], [520, 1000], [470, 945], [455, 880], [450, 820], [462, 772], [450, 740],
  [446, 700], [478, 640], [498, 580]]
const TORSO = [[0, 1075], [180, 1035], [330, 1020], [470, 1010], [560, 1035], [640, 1075], [1060, 1060], [1090, 990], [1200, 1000], [1350, 1030],
  [1500, 1070], [1500, 1750], [0, 1750]]
const CU = 0.555, CV = 0.34, SPAN = 0.42 // the head's centre and height in the photo (fractions of its width and height)
const BOTTOM = -1.25 // where the shoulders have faded out, in head heights below the head's centre

/** Points for the head and shoulders, in a space where the head is 1 tall and centred on the origin. */
async function bustCloud(SW) {
  const img = new Image()
  await new Promise((ok, fail) => {
    img.onload = ok
    img.onerror = fail
    img.src = '/landing/tejas-scan.webp' // a 750 px copy of public/tejas_about.webp
  })
  const SH = Math.round((SW * img.height) / img.width)
  const c = document.createElement('canvas')
  c.width = SW; c.height = SH
  const x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(img, 0, 0, SW, SH)
  const rgb = x.getImageData(0, 0, SW, SH).data
  x.clearRect(0, 0, SW, SH)
  x.filter = `blur(${SW * 0.012}px)` // feathered edges, so the silhouette thins out instead of cutting off
  for (const shape of [OUTLINE, TORSO]) {
    x.beginPath()
    shape.forEach(([u, v], i) => x[i ? 'lineTo' : 'moveTo']((u / 1500) * SW, (v / 2000) * SH))
    x.fill()
  }
  const m = x.getImageData(0, 0, SW, SH).data

  const lum = new Float32Array(SW * SH)
  for (let i = 0; i < lum.length; i++) lum[i] = (0.2126 * rgb[i * 4] + 0.7152 * rgb[i * 4 + 1] + 0.0722 * rgb[i * 4 + 2]) / 255
  const L = (ix, iy) => lum[iy * SW + ix]
  const ss = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k) }
  const pos = [], bright = [], seed = []
  const aspect = SW / SH
  for (let iy = 1; iy < SH - 1; iy++) for (let ix = 1; ix < SW - 1; ix++) {
    const u0 = ix / SW, v0 = iy / SH
    // The shoulders fade out sideways and downward, like a bust's base dissolving: never a hard crop.
    // The shoulders fade out sideways and downward, like a bust's base dissolving: never a hard crop.
    const mask = (m[(iy * SW + ix) * 4 + 3] / 255) * (1 - ss(0.3, 0.5, Math.abs(u0 - 0.53))) * (1 - ss(0.66, 0.86, v0))
      * (v0 < 0.5 ? 1 : 1 - ss(0.84, 1.08, Math.hypot((u0 - 0.55) / 0.56, (v0 - 0.5) / 0.42))) // the shoulders' outer corners round off, like a bust's
    if (mask < 0.04) continue
    const gx = L(ix + 1, iy - 1) + 2 * L(ix + 1, iy) + L(ix + 1, iy + 1) - L(ix - 1, iy - 1) - 2 * L(ix - 1, iy) - L(ix - 1, iy + 1)
    const gy = L(ix - 1, iy + 1) + 2 * L(ix, iy + 1) + L(ix + 1, iy + 1) - L(ix - 1, iy - 1) - 2 * L(ix, iy - 1) - L(ix + 1, iy - 1)
    const edge = Math.min(1, Math.hypot(gx, gy) * 2.2)
    const l = L(ix, iy)
    const t = Math.min(1, Math.max(0, (l - 0.06) / 0.7))
    const shirt = v0 > 0.53 ? 0.72 : 1 // the pale shirt, a little under the face
    const b = Math.min(1, 0.06 + 0.94 * Math.pow(t, 1.5) + 0.2 * edge) * (0.3 + 0.7 * mask) * shirt
    if (Math.random() > mask * (0.12 + 0.88 * b)) continue // stipple: dark areas get fewer points, so features read by density too
    const u = (ix + 0.25 + Math.random() * 0.5) / SW, v = (iy + 0.25 + Math.random() * 0.5) / SH
    const xf = ((u - CU) * aspect) / SPAN, yf = -(v - CV) / SPAN
    const head = Math.sqrt(Math.max(0, 1 - (xf / 0.5) ** 2 - (yf / 0.56) ** 2)) * 0.42
    const neck = yf < -0.3 ? Math.sqrt(Math.max(0, 1 - ((xf - 0.05) / 0.3) ** 2)) * 0.3 : 0
    const torso = Math.sqrt(Math.max(0, 1 - (xf / 1.05) ** 2)) * 0.38 * ss(-0.45, -0.7, yf)
    pos.push(xf, yf, Math.max(head, neck, torso) + l * 0.04)
    bright.push(b)
    seed.push(Math.random())
  }
  // Where each point starts: out among the stars, anywhere in the sky (in head heights from the bust).
  const n = seed.length, start = new Float32Array(n * 3)
  const dir = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    dir.randomDirection()
    dir.y = 0.12 + Math.abs(dir.y) * 0.88 // the sky, all round: never below the horizon
    dir.normalize().multiplyScalar((60 + Math.random() * 35) / HEAD_H)
    start.set([dir.x, dir.y, dir.z], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aStart', new THREE.BufferAttribute(start, 3))
  g.setAttribute('aB', new THREE.Float32BufferAttribute(bright, 1))
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1))
  return g
}

const FU = { ...U, uForm: { value: 0 }, uScatter: { value: 0 }, uScan: { value: 9 }, uSize: { value: 30 },
  uPtr: { value: new THREE.Vector3(0, 0, 9) }, uPtrVel: { value: new THREE.Vector3() }, uPtrK: { value: 0 } } // the pointer, in the bust's own space
const bustMat = new THREE.ShaderMaterial({
  uniforms: FU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    attribute vec3 aStart; attribute float aB, aSeed;
    uniform float uTime, uForm, uScatter, uScan, uSize, uBlueprint, uPtrK; uniform vec3 uPtr, uPtrVel;
    varying float vA, vScan;
    void main() {
      float k = smoothstep(aSeed * 0.6, aSeed * 0.6 + 0.4, uForm); // each point leaves the sky at its own moment
      float e = 1.0 - pow(1.0 - k, 3.0); // fast, then settling
      float ang = (1.0 - e) * (1.2 + aSeed * 2.4); // a spiral in, not a straight line
      vec3 s = aStart;
      s.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * s.xz;
      vec3 p = mix(s, position, e);
      p += 0.004 * vec3(sin(uTime * 0.7 + aSeed * 40.0), cos(uTime * 0.6 + aSeed * 23.0), sin(uTime * 0.5 + aSeed * 11.0));
      // The bust's base keeps dissolving: its lower points peel away as smoke, curling down and in toward the pool,
      // thinning as they go, then begin again.
      float low = smoothstep(-0.7, -1.2, position.y) * step(0.999, k) * step(0.35, fract(aSeed * 5.3));
      float ph = fract(uTime * (0.045 + 0.05 * aSeed) + aSeed * 7.0);
      float curl = uTime * 0.4 + aSeed * 30.0 + ph * 3.0;
      p += low * (vec3(-position.x * 0.45 * ph, -ph * 0.32, 0.0) + vec3(sin(curl), 0.0, cos(curl)) * 0.09 * ph);
      // The pointer stirs it: points near it are pushed out and turned about it, dragged a little along its path, and
      // spring back as it leaves. Their depth sets how far they go, so the bust parts in layers, not as a cut-out.
      vec2 dp = p.xy - uPtr.xy;
      float near = exp(-dot(dp, dp) / 0.05) * uPtrK * step(0.999, k);
      float tw = (aSeed - 0.5) * 2.4;
      vec2 swirl = mat2(cos(tw), -sin(tw), sin(tw), cos(tw)) * normalize(dp + 1e-4);
      p.xy += (swirl * (0.07 + 0.09 * aSeed) + uPtrVel.xy * (0.5 + aSeed)) * near;
      p.z += near * (0.08 + 0.12 * fract(aSeed * 13.7));
      vec3 away = normalize(position + vec3(aSeed - 0.5, fract(aSeed * 7.3) - 0.5, 0.6)); // scroll: blown apart
      p += away * uScatter * (1.5 + aSeed * 3.0);
      vScan = 0.0;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float flight = k * (1.0 - e);
      gl_PointSize = uSize * (0.5 + 0.9 * aB + 0.5 * vScan + 3.0 * flight) / -mv.z;
      vA = step(0.0001, k) * (0.12 + 0.88 * aB) * (0.4 + 0.6 * e) * (1.0 - uScatter * 0.6) * (1.0 - low * ph);
      // Before it leaves, one point in four already shines in the sky as a star.
      float star = (1.0 - step(0.0001, k)) * step(aSeed, 0.25) * uBlueprint;
      vA += star * (0.5 + 0.5 * sin(uTime * 1.7 + aSeed * 80.0)) * 2.2;
      gl_PointSize = min(max(gl_PointSize, star * uSize * 0.06), uSize * 0.16); // capped: a point passing the camera stays a point, not a snowflake
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying float vA, vScan;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float r = dot(c, c);
      if (r > 0.25) discard;
      vec3 col = mix(vec3(0.86, 0.92, 1.0), vec3(0.35, 0.85, 0.95), vScan * 0.6);
      gl_FragColor = vec4(col * smoothstep(0.25, 0.0, r) * vA * 0.24, 1.0);
    }`,
})
const bust = new THREE.Points(new THREE.BufferGeometry(), bustMat)
bust.frustumCulled = false
bust.scale.setScalar(HEAD_H)
bust.position.copy(HEAD)
scene.add(bust)

// ---------------------------------------------------------------------------------------------- the name
// Each letter is its own stack of slices, so each can fall on its own.
const nameCanvas = document.createElement('canvas')
const nameTex = new THREE.CanvasTexture(nameCanvas)
nameTex.anisotropy = 8
const SLICES = 56
const DROP = { t0: 5.5, gap: 0.085, fall: 0.6, height: 7 } // when the first letter drops (after the opening began), the stagger, the fall
const nameMat = new THREE.ShaderMaterial({
  uniforms: { ...U, uMask: { value: nameTex }, uTexel: { value: new THREE.Vector2(1e-3, 1e-3) }, uDrop: { value: new THREE.Vector4(DROP.t0, DROP.gap, DROP.fall, DROP.height) } },
  vertexShader: /* glsl */ `
    attribute float aSlice, aLetter; attribute vec4 aRect;
    uniform float uT; uniform vec4 uDrop;
    varying vec2 vUv; varying float vS, vShow, vFlash;
    void main() {
      vUv = mix(aRect.xy, aRect.zw, uv); vS = aSlice;
      float tau = uT - (uDrop.x + aLetter * uDrop.y), T = uDrop.z;
      float k = clamp(tau / T, 0.0, 1.0);
      float y = tau < T ? uDrop.w * (1.0 - k * k) : 0.05 * exp(-(tau - T) * 7.0) * abs(sin((tau - T) * 16.0)); // falls, lands, settles
      vShow = step(0.0, tau);
      vFlash = tau >= T ? exp(-(tau - T) * 3.5) : 0.0;
      vec4 w = instanceMatrix * vec4(position, 1.0);
      w.y += y;
      gl_Position = projectionMatrix * modelViewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMask; uniform vec2 uTexel; uniform float uTime;
    varying vec2 vUv; varying float vS, vShow, vFlash;
    float m(vec2 o) { return texture2D(uMask, vUv + o * uTexel).r; }
    float h1(float n) { return fract(sin(n * 91.345) * 47453.21); }
    void main() {
      if (vShow < 0.5 || m(vec2(0.0)) < 0.5) discard;
      vec3 col;
      if (vS < 0.001) {
        // The face: brushed metal. A bevel round every edge (the mask's slope, read 6 px out) catches a key light from
        // the upper left; the face reflects a cool sky above and the dark floor below; a fine horizontal grain; and
        // every few seconds a glint runs across the whole name.
        const float E = 6.0;
        vec2 g = vec2(m(vec2(E, 0.0)) - m(vec2(-E, 0.0)), m(vec2(0.0, E)) - m(vec2(0.0, -E)));
        float rim = 1.0 - min(min(m(vec2(E, 0.0)), m(vec2(-E, 0.0))), min(m(vec2(0.0, E)), m(vec2(0.0, -E))));
        vec3 nrm = normalize(vec3(-g * 1.8, 1.0));
        vec3 L = normalize(vec3(-0.45, 0.7, 0.55));
        float spec = pow(max(dot(reflect(-L, nrm), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);
        float grain = 0.9 + 0.1 * h1(floor(vUv.y / uTexel.y * 0.5));
        vec3 env = mix(vec3(0.11, 0.13, 0.17), vec3(0.62, 0.67, 0.75), smoothstep(0.95, 0.05, vUv.y)); // bright where the letters face the sky (the canvas's v runs downward here)
        float glint = exp(-pow((vUv.x + vUv.y * 0.3 - (fract(uTime * 0.065) * 2.6 - 0.8)) * 7.0, 2.0));
        col = env * grain * (1.0 - 0.35 * rim) + vec3(0.85, 0.92, 1.0) * (spec * 1.3 * rim + glint * 0.35);
        col *= 1.0 + 2.0 * vFlash;
      } else {
        // The body: dark steel, lit along its front edge and falling into shadow toward the back.
        col = mix(vec3(0.09, 0.11, 0.14), vec3(0.006, 0.007, 0.01), pow(vS, 0.4)) + vec3(0.1, 0.4, 0.55) * vFlash * (1.0 - vS);
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
})
let name = null

/** Set the name on its canvas and return each letter's box (canvas px), the baseline, and the canvas size. */
async function setName(portrait) {
  await document.fonts.load('800 100px "Archivo Variable"').catch(() => {}) // without it the name falls back to Arial, not to nothing
  const ctx = nameCanvas.getContext('2d')
  const font = (w, px, t) => {
    ctx.font = `${w} ${px}px "Archivo Variable"`
    if ('fontStretch' in ctx) ctx.fontStretch = 'expanded'
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${t * px}px`
  }
  const px = 240, LIGHT = [320, 0.015], HEAVY = [800, -0.012]
  const w = (s, [wt, t]) => (font(wt, px, t), ctx.measureText(s).width)
  font(HEAVY[0], px, HEAVY[1])
  const cap = ctx.measureText('O').actualBoundingBoxAscent
  const pad = px * 0.12, lead = cap * 1.28
  const wT = w('TEJAS', LIGHT), wS = w(' ', LIGHT), wG = w('GOVIND', HEAVY)
  const W = Math.ceil((portrait ? Math.max(wT, wG) : wT + wS + wG) + pad * 2)
  const H = Math.ceil((portrait ? cap + lead : cap) + pad * 2)
  nameCanvas.width = W; nameCanvas.height = H
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'
  const words = [
    { s: 'TEJAS', f: LIGHT, x: pad, base: pad + cap },
    { s: 'GOVIND', f: HEAVY, x: portrait ? pad : pad + wT + wS, base: portrait ? pad + cap + lead : pad + cap },
  ]
  const letters = []
  for (const { s, f, x, base } of words) {
    font(f[0], px, f[1])
    ctx.fillText(s, x, base)
    for (let i = 0; i < s.length; i++) {
      const x0 = x + ctx.measureText(s.slice(0, i)).width, x1 = x + ctx.measureText(s.slice(0, i + 1)).width
      letters.push({ x0, x1, y0: base - cap - pad * 0.5, y1: base + pad * 0.5 })
    }
  }
  nameTex.needsUpdate = true
  nameMat.uniforms.uTexel.value.set(1 / W, 1 / H)
  return { W, letters, base: words[1].base }
}

// ---------------------------------------------------------------------------------------------- layout
const rest = { pos: new THREE.Vector3(), look: new THREE.Vector3(), dist: 15 }
const journey = { pos: null, look: null }
const around = (deg, r, y) => new THREE.Vector3(HEAD.x + Math.sin(THREE.MathUtils.degToRad(deg)) * r, y, HEAD.z + Math.cos(THREE.MathUtils.degToRad(deg)) * r)

async function layout() {
  const W = innerWidth, H = innerHeight, portrait = W / H < 0.9
  const dpr = renderer.getPixelRatio()
  renderer.setSize(W, H, false)
  composer.setSize(W, H)
  bloom.resolution.set(W, H)
  grade.uniforms.uRes.value.set(W, H)
  MU.uSize.value = 900 * (H / 900) * dpr
  floor?.getRenderTarget().setSize(Math.round((W * dpr) / 2), Math.round((H * dpr) / 2))
  camera.aspect = W / H
  camera.fov = portrait ? 56 : 38
  camera.updateProjectionMatrix()
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))

  const nameW = portrait ? 2.6 : 5.0
  rest.dist = Math.max(portrait ? 12 : 13.5, NAME_Z + nameW / (0.8 * 2 * tan * camera.aspect))
  rest.pos.set(0, portrait ? 3.0 : 2.6, rest.dist)
  rest.look.set(0, portrait ? 2.3 : 2.0, 0)
  camera.position.copy(rest.pos)
  camera.lookAt(rest.look)
  camera.updateMatrixWorld()
  // The scroll's path: from the rest shot, round to the left at the bust's height with the far lantern glowing across
  // the circle behind it, then rising inside the ring and tipping up past the lintels into the Milky Way.
  journey.pos = new THREE.CatmullRomCurve3([rest.pos.clone(), around(-26, 7.4, 2.7), around(-70, 6.4, 2.4), around(-112, 5.2, 3.4), around(-140, 4, 5.6), around(-155, 2.6, 7.4)], false, 'centripetal')
  journey.look = new THREE.CatmullRomCurve3([rest.look.clone(), HEAD.clone(), HEAD.clone(), new THREE.Vector3(0.6, 4.2, 0.4), new THREE.Vector3(1.5, 8, -9), new THREE.Vector3(5, 20, -60)], false, 'centripetal') // ends on the Milky Way's band, not the plain sky above it
  const px = 22 * (H / 900) * dpr
  FU.uSize.value = px
  DU.uSize.value = px * 1.5

  // The name: letters on the floor along z = NAME_Z, the bottom line's baseline on y = 0.
  const { W: tw, letters, base } = await setName(portrait)
  const k = nameW / tw // world units per canvas px
  U.uNameHalf.value = nameW / 2
  if (name) name.geometry.dispose(), scene.remove(name)
  const geo = new THREE.PlaneGeometry(1, 1)
  const count = letters.length * SLICES
  name = new THREE.InstancedMesh(geo, nameMat, count)
  const aSlice = new Float32Array(count), aLetter = new Float32Array(count), aRect = new Float32Array(count * 4)
  const depth = 0.32
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3()
  letters.forEach((l, li) => {
    const cx = ((l.x0 + l.x1) / 2 - tw / 2) * k, cy = (base - (l.y0 + l.y1) / 2) * k
    for (let si = 0; si < SLICES; si++) {
      const i = li * SLICES + si
      aSlice[i] = si / (SLICES - 1)
      aLetter[i] = li
      aRect.set([l.x0 / tw, 1 - l.y1 / nameCanvas.height, l.x1 / tw, 1 - l.y0 / nameCanvas.height], i * 4)
      name.setMatrixAt(i, mtx.compose(v.set(cx, cy, -aSlice[i] * depth), q, s.set((l.x1 - l.x0) * k, (l.y1 - l.y0) * k, 1)))
    }
  })
  geo.setAttribute('aSlice', new THREE.InstancedBufferAttribute(aSlice, 1))
  geo.setAttribute('aLetter', new THREE.InstancedBufferAttribute(aLetter, 1))
  geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(aRect, 4))
  name.position.set(0, 0, NAME_Z)
  name.frustumCulled = false
  scene.add(name)

  // Hang the HTML off the 3D at the rest shot: the lines under the name, the brackets round the bust.
  const toPx = (x, y, z) => {
    const p = new THREE.Vector3(x, y, z).project(camera)
    return [((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H]
  }
  const top = (base - Math.min(...letters.map(l => l.y0))) * k
  const [nl, nt] = toPx(-nameW / 2, top, NAME_Z)
  const [nr, nb] = toPx(nameW / 2, 0, NAME_Z)
  sheet.style.setProperty('--name-left', `${nl}px`)
  sheet.style.setProperty('--name-right', `${W - nr}px`)
  sheet.style.setProperty('--name-top', `${nt}px`)
  sheet.style.setProperty('--name-bottom', `${nb}px`)
}

// ---------------------------------------------------------------------------------------------- loading
// The counter follows the real loads (the stage and its light maps through the manager, then the photo and the
// font), eased so it never jumps.
let loaded = 0, shown = 0
manager.onProgress = (_, done, total) => (loaded = Math.max(loaded, (done / total) * 0.85))
const ready = Promise.all([
  stageReady,
  bustCloud(phone ? 360 : 600).then(g => {
    bust.geometry = g
  }),
  document.fonts.load('800 100px "Archivo Variable"').catch(() => {}),
]).then(() => (loaded = 1))

// ---------------------------------------------------------------------------------------------- the loop
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const pointer = new THREE.Vector2(), look = new THREE.Vector2()
let moved = -1e9
addEventListener('pointermove', e => {
  moved = performance.now()
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
})

let p = 0, opened = -1, readyAt = -1, laidOut = false
// The opening's cues are scheduled on the audio clock as it begins (silent unless the site's sound is on).
sound.subscribe(on => sfx.set(on)) // the site's switch: the landing's own sounds follow it
function cueOpening() {
  sfx.swell(0)
  sfx.glints(1.6, 3.8)
  for (let i = 0; i < 11; i++) sfx.thud(DROP.t0 + i * DROP.gap + DROP.fall, i === 0)
}
const ray = new THREE.Raycaster(), bustPlane = new THREE.Plane(), planeN = new THREE.Vector3(), hit = new THREE.Vector3()
// The threshold: once loaded, the circle stands as points under the stars and waits. Hold (pointer, or Space/Enter
// pressed and held) to enter; a tap or a key press also gets there, just slower, and it enters by itself after 7 s.
const enterEl = $('enter')
let holding = false, fill = 0, lastT = 0
const hold = on => (holding = on)
enterEl.addEventListener('pointerdown', e => (e.preventDefault(), hold(true)))
addEventListener('pointerup', () => hold(false))
addEventListener('pointercancel', () => hold(false))
addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && readyAt >= 0 && opened < 0) (e.preventDefault(), hold(true)) })
addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') hold(false) })
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3()
const t0 = performance.now()
function tick(now) {
  requestAnimationFrame(tick)
  const t = (now - t0) / 1000
  shown = instant ? loaded : shown + (loaded - shown) * 0.06
  const pct = Math.min(100, Math.round(shown * 100))
  $('pct').textContent = String(pct)
  loaderEl.style.setProperty('--p', pct)
  if (!laidOut) return
  // Loaded: the loader lifts on the blueprint, and the threshold waits for a hold.
  if (readyAt < 0 && shown > 0.995 && (t > 1.4 || instant)) {
    readyAt = t
    loaderEl.classList.add('done')
    enterEl.classList.add('on')
  }
  if (readyAt >= 0 && opened < 0) {
    const auto = t - readyAt > 7 // nobody need hold: it goes in on its own
    const dt = Math.min(0.1, t - lastT) // seconds, whatever the frame rate: 1.1 s held, 1.8 s on its own, drains in 0.6 s
    fill = Math.min(1, Math.max(0, fill + (holding ? dt / 1.1 : auto ? dt / 1.8 : -dt / 0.6)))
    enterEl.style.setProperty('--fill', fill)
    if (fill >= 1 || instant || reduce) {
      opened = t
      enterEl.classList.remove('on')
      if (!instant) cueOpening()
    }
  }
  U.uBlueprint.value = readyAt < 0 ? 0 : ss(0, 1.6, t - readyAt)
  lastT = t
  const rect = section.getBoundingClientRect()
  if (rect.bottom <= 0) return
  const T = opened < 0 ? -100 : reduce || instant ? 60 : t - opened
  const goal = Math.min(1, Math.max(0, -rect.top / (rect.height - innerHeight)))
  p += (goal - p) * (reduce ? 1 : 0.1)

  // The opening's clock: the wave, the bust forming, the name's landing.
  U.uT.value = T
  U.uTime.value = t
  U.uReveal.value = T < 0 ? 0 : 46 * Math.pow(ss(0.15, 3.8, T), 1.5)
  // Scrolling down runs the gathering backwards: the points go home to the sky as the camera looks up after them.
  FU.uForm.value = T < 0 ? 0 : Math.min(ss(1.4, 5.6, T), 1 - ss(0.42, 0.8, p)) * 1.02
  U.uShock.value = opened >= 0 && !reduce ? opened + DROP.t0 + DROP.fall : -100 // uShock is page time
  // The flames: two unrelated wavers, never in step.
  U.uFlick.value.set(1 + 0.5 * Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1) + 0.3 * Math.sin(t * 17.1), 1 + 0.5 * Math.sin(t * 6.1 + 2) * Math.sin(t * 3.7) + 0.3 * Math.sin(t * 15.3 + 4))

  // The camera: at rest it leans toward the pointer; scrolling swings it round the bust (so it shows its depth),
  // rises to eye level, then flies into the head as it breaks up.
  if (!reduce) look.lerp(pointer, 0.04)
  const swing = ss(0.02, 0.3, p), u = ss(0.02, 0.9, p)
  journey.pos.getPoint(u, camPos)
  journey.look.getPoint(u, camLook)
  camPos.x += look.x * 0.8 * (1 - swing)
  camPos.y += look.y * 0.35 * (1 - swing)
  camera.position.copy(camPos)
  camera.lookAt(camLook)
  halo.rotation.y = Math.sin(t * 0.12) * 0.05 // the rings drift, barely
  grade.uniforms.uTime.value = t
  glows.forEach(g => g.quaternion.copy(camera.quaternion)) // the glows face the camera
  // Where the pointer falls on the bust's plane, in the bust's space; eased, with its velocity, so the stirring is smooth.
  ray.setFromCamera(pointer, camera)
  if (ray.ray.intersectPlane(bustPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(planeN).negate(), HEAD), hit)) {
    hit.sub(HEAD).divideScalar(HEAD_H)
    const prev = FU.uPtr.value.clone()
    FU.uPtr.value.lerp(hit, 0.18)
    FU.uPtrVel.value.lerp(prev.subVectors(FU.uPtr.value, prev).multiplyScalar(6), 0.12)
  }
  const live = performance.now() - moved < 1800 && !reduce
  FU.uPtrK.value += ((live ? 1 : 0) - FU.uPtrK.value) * 0.05

  FU.uScatter.value = 0

  // The HTML comes in after the name has landed; scrolling takes it away.
  const away = 1 - ss(0, 0.05, p)
  sheet.style.opacity = $('foot-bill').style.opacity = String(ss(DROP.t0 + 1.4, DROP.t0 + 2.4, T) * away)
  veil.style.opacity = String(ss(0.84, 0.98, p))

  composer.render()
}
requestAnimationFrame(tick)

// Settles once the world is in and laid out; Landing.jsx falls back to the plain title if it fails.
export const done = ready.then(layout).then(() => {
  laidOut = true
  addEventListener('resize', layout)
})
