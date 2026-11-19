import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'

/*
 * The film that plays on the cinema screen in Chapter Two, and the world you enter when the camera
 * goes into the screen. Every project is a dense cloud of light sampled from its Meshy model (coloured
 * by the model's own texture), standing on a black mirror floor under a shaft of light. The clouds share
 * one point count, so one project flows into the next through a vortex: the projector's dust becomes
 * the cricket bat, the bat becomes the brain, and so on.
 *
 * It renders into `rt` (2.4:1, the screen's aspect) for the hall, or straight to the frame (with a view
 * offset that matches the crop of the screen) once the camera is inside.
 */
export const FILM_ASPECT = 2.4
const FLOOR = -1.3

const POINT_VERT = /* glsl */ `
attribute vec3 aB; attribute vec3 nA; attribute vec3 nB; attribute vec3 cA; attribute vec3 cB; attribute vec4 aSeed;
uniform float uMorph; uniform float uTime; uniform float uSize; uniform float uFocal; uniform float uMirror;
uniform float uSpinA; uniform float uSpinB; uniform float uGain;
uniform vec3 uKey; uniform vec3 uTint; uniform vec3 uTintB;
varying vec3 vCol;
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main() {
  // A wave climbs the object: the bottom lets go first, each point a little early or late.
  float h = clamp((position.y - ${FLOOR.toFixed(2)}) / 3.2, 0.0, 1.0);
  float k = clamp(uMorph * 1.7 - (aSeed.x * 0.4 + h * 0.3), 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  vec3 a = position; vec3 b = aB;
  a.xz = rot(uTime * 0.35 * uSpinA * (0.6 + aSeed.y)) * a.xz; // the dust keeps turning
  b.xz = rot(uTime * 0.35 * uSpinB * (0.6 + aSeed.y)) * b.xz;
  vec3 p = mix(a, b, k);
  // In flight: thrown out into a turning vortex, then drawn back in.
  float fly = sin(3.14159 * k);
  p.xz = rot(fly * (2.2 + aSeed.y * 2.5)) * p.xz;
  p.xz *= 1.0 + fly * (0.5 + aSeed.z * 0.9);
  p.y += fly * (aSeed.w - 0.35) * 1.6;
  p += vec3(sin(uTime * 0.7 + aSeed.x * 40.0), sin(uTime * 0.6 + aSeed.y * 40.0), cos(uTime * 0.8 + aSeed.z * 40.0)) * 0.005;

  vec3 n = normalize(mix(nA, nB, k) + 1e-4);
  vec3 alb = mix(cA, cB, k);
  vec3 tint = mix(uTint, uTintB, k);
  vec3 v = normalize(cameraPosition - p);
  float dif = max(dot(n, uKey), 0.0);
  float rim = pow(1.0 - abs(dot(n, v)), 3.0);
  float spec = pow(max(dot(reflect(-uKey, n), v), 0.0), 24.0);
  float tw = pow(fract(sin(aSeed.x * 91.7 + floor(uTime * (2.0 + aSeed.z * 3.0)) * 13.1) * 43758.5), 22.0);
  vCol = alb * (0.08 + 1.25 * dif) + tint * (rim * 0.7 + spec * 1.2) + vec3(tw) * 4.0 + tint * fly * 0.9;

  if (uMirror > 0.5) {
    float above = p.y - ${FLOOR.toFixed(2)};
    p.y = ${FLOOR.toFixed(2)} - above;
    vCol *= 0.16 * exp(-above * 0.9);
  }
  vCol *= uGain;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uSize * uFocal / -mv.z * (1.0 + fly * 1.2 + uMirror * 0.8), 1.0, 24.0);
  gl_Position = projectionMatrix * mv;
}`

const POINT_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(c));
  gl_FragColor = vec4(vCol * a, 1.0);
}`

// A cone of light from above, ray-marched through 3D noise: real-looking shafts for a few samples.
const SHAFT_FRAG = /* glsl */ `
uniform highp sampler3D tNoise; uniform float uTime; uniform vec3 uTint; uniform float uK;
uniform vec3 uTop; uniform float uR0; uniform float uR1; uniform float uH;
varying vec3 vWorld;
float density(vec3 p) {
  float t = clamp((uTop.y - p.y) / uH, 0.0, 1.0);
  float r = mix(uR0, uR1, t);
  float d = length(p.xz - uTop.xz);
  float inside = 1.0 - smoothstep(r * 0.55, r, d);
  float n = texture(tNoise, p * 0.18 + vec3(0.0, uTime * 0.03, uTime * 0.01)).r;
  return inside * (0.35 + n * 1.3) * (1.0 - t * 0.55) * smoothstep(0.0, 0.08, t);
}
void main() {
  vec3 ro = cameraPosition, rd = normalize(vWorld - cameraPosition);
  float far = length(vWorld - cameraPosition);
  float near = max(0.0, far - 2.4 * uR1);
  float dt = (far - near) / 18.0;
  float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float acc = 0.0;
  for (int i = 0; i < 18; i++) acc += density(ro + rd * (near + (float(i) + j) * dt));
  gl_FragColor = vec4(uTint * acc * dt * uK, 1.0);
}`

// The void's colour in a direction: near-black, a faint tinted glow along the horizon. The floor fades
// into exactly this, so there is no seam where it ends.
const SKY_GLSL = /* glsl */ `
vec3 skyAt(vec3 d, vec3 tint) {
  float hz = exp(-abs(d.y) * 9.0);
  return vec3(0.004, 0.005, 0.009) + tint * hz * 0.05 + vec3(0.002, 0.003, 0.006) * max(d.y, 0.0);
}`

const SKY_FRAG = /* glsl */ `
uniform vec3 uTint; varying vec3 vDir;
${SKY_GLSL}
void main() { gl_FragColor = vec4(skyAt(normalize(vDir), uTint), 1.0); }`

const FLOOR_FRAG = /* glsl */ `
uniform vec3 uTint; uniform float uPool; uniform highp sampler3D tNoise;
varying vec3 vWorld;
${SKY_GLSL}
void main() {
  float r = length(vWorld.xz);
  float pool = exp(-r * r / 5.0) * uPool;
  float grain = texture(tNoise, vec3(vWorld.xz * 0.6, 0.3)).r;
  vec3 c = vec3(0.006, 0.007, 0.01) * (0.7 + grain * 0.6) + uTint * pool * (0.05 + 0.04 * grain);
  vec3 d = normalize(vWorld - cameraPosition);
  gl_FragColor = vec4(mix(skyAt(vec3(d.x, 0.0, d.z), uTint), c, exp(-r * 0.075)), 1.0);
}`

const WORLD_VERT = /* glsl */ `
varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`

/** Read a material's base colour at a uv (glTF textures are not flipped: v = 0 is the top row). */
function albedoReader(material) {
  const img = material?.map?.image
  const base = material?.color ?? new THREE.Color(1, 1, 1)
  if (!img) return () => [base.r, base.g, base.b]
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d', { willReadFrequently: true })
  g.drawImage(img, 0, 0, S, S)
  const d = g.getImageData(0, 0, S, S).data
  const lin = x => Math.pow(x / 255, 2.2)
  return (u, v) => {
    const x = Math.min(S - 1, Math.floor((((u % 1) + 1) % 1) * S))
    const y = Math.min(S - 1, Math.floor((((v % 1) + 1) % 1) * S))
    const i = (y * S + x) * 4
    return [lin(d[i]) * base.r, lin(d[i + 1]) * base.g, lin(d[i + 2]) * base.b]
  }
}

/** N surface points of a normalized model, area-weighted across its meshes, with normals and colours. */
function sampleModel(group, N) {
  const meshes = []
  group.traverse(o => o.isMesh && meshes.push(o))
  const samplers = meshes.map(m => new MeshSurfaceSampler(m).build())
  const readers = meshes.map(m => albedoReader(m.material))
  const cum = []
  let total = 0
  for (const s of samplers) cum.push((total += s.distribution[s.distribution.length - 1]))
  const pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), col = new Float32Array(N * 3)
  const p = new THREE.Vector3(), n = new THREE.Vector3(), uv = new THREE.Vector2(-1, -1)
  for (let i = 0; i < N; i++) {
    const r = Math.random() * total
    let j = 0
    while (cum[j] < r) j++
    samplers[j].sample(p, n, undefined, uv)
    p.toArray(pos, i * 3)
    n.toArray(nrm, i * 3)
    col.set(readers[j](uv.x, uv.y), i * 3)
  }
  return { pos, nrm, col }
}

/** The projector's dust as it arrives: a slow column of glitter standing in the shaft of light. */
function dustCloud(N) {
  const pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), col = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2
    const y = Math.random()
    const r = Math.sqrt(Math.random()) * (0.9 + y * 1.2) // uniform across the disc: no bright axis
    pos.set([Math.cos(a) * r, FLOOR + 0.05 + y * 5.5, Math.sin(a) * r], i * 3)
    const n = new THREE.Vector3().randomDirection()
    nrm.set([n.x, n.y, n.z], i * 3)
    const w = (0.08 + Math.random() * 0.25) * (1 - y * 0.6)
    col.set([w, w, w * 1.1], i * 3)
  }
  return { pos, nrm, col }
}

export function createFilm(renderer, { mobile = false, loader, normalize, models, noise }) {
  const N = mobile ? 60000 : 150000
  const W = mobile ? 1152 : 2048
  const rt = new THREE.WebGLRenderTarget(W, Math.round(W / FILM_ASPECT), { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 })
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#010205')
  const camera = new THREE.PerspectiveCamera(30, FILM_ASPECT, 0.1, 1200)

  const tint = new THREE.Color('#9fc4ff')
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: { uTint: { value: tint } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  )
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2).translate(0, FLOOR, 0),
    new THREE.ShaderMaterial({ uniforms: { uTint: { value: tint }, uPool: { value: 1 }, tNoise: { value: noise } }, vertexShader: WORLD_VERT, fragmentShader: FLOOR_FRAG, depthWrite: false }),
  )
  sky.renderOrder = -3
  floor.renderOrder = -2

  const top = new THREE.Vector3(0, 7.5, 0)
  const shaftH = top.y - FLOOR
  const shaftU = { tNoise: { value: noise }, uTime: { value: 0 }, uTint: { value: tint }, uK: { value: 0.09 }, uTop: { value: top }, uR0: { value: 0.5 }, uR1: { value: 2.6 }, uH: { value: shaftH } }
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5 * 1.15, 2.6 * 1.15, shaftH, 40, 1, true).translate(0, FLOOR + shaftH / 2, 0),
    new THREE.ShaderMaterial({ uniforms: shaftU, vertexShader: WORLD_VERT, fragmentShader: SHAFT_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  )
  shaft.renderOrder = 2

  // ------------------------------------------------------------ the cloud
  const dust = dustCloud(N)
  const clouds = { dust }
  const seed = new Float32Array(N * 4).map(() => Math.random())
  const geo = new THREE.BufferGeometry()
  const attr = (name, data, size = 3) => geo.setAttribute(name, new THREE.BufferAttribute(data.slice(), size).setUsage(THREE.DynamicDrawUsage))
  attr('position', dust.pos); attr('aB', dust.pos); attr('nA', dust.nrm); attr('nB', dust.nrm); attr('cA', dust.col); attr('cB', dust.col)
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50)
  const u = {
    uMorph: { value: 0 }, uTime: { value: 0 }, uSize: { value: 0.016 }, uFocal: { value: 800 }, uMirror: { value: 0 },
    uSpinA: { value: 1 }, uSpinB: { value: 1 }, uGain: { value: mobile ? 0.5 : 0.32 },
    uKey: { value: new THREE.Vector3(-0.45, 0.85, 0.35).normalize() }, uTint: { value: new THREE.Color('#9fc4ff') }, uTintB: { value: new THREE.Color('#9fc4ff') },
  }
  const pointMat = mirror => new THREE.ShaderMaterial({
    uniforms: { ...u, uMirror: { value: mirror ? 1 : 0 } },
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  })
  const cloud = new THREE.Points(geo, pointMat(false))
  const reflection = new THREE.Points(geo, pointMat(true))
  reflection.renderOrder = -1
  cloud.renderOrder = 1
  scene.add(sky, floor, reflection, cloud, shaft)

  // ------------------------------------------------------------ loading
  const loading = {}
  const load = id => (loading[id] ??= (async () => {
    const spec = models[id]
    const gltf = await loader.loadAsync(spec.url)
    const group = normalize(gltf.scene, spec.size * 1.15, spec.yaw)
    // Stand it on the floor.
    const box = new THREE.Box3().setFromObject(group)
    group.traverse(o => o.isMesh && o.geometry.translate(0, FLOOR + 0.25 - box.min.y, 0))
    clouds[id] = sampleModel(group, N)
    pair = '' // re-upload if this one is on screen
    return clouds[id]
  })())

  let pair = ''
  function setPair(from, to) {
    const a = clouds[from] ?? dust, b = clouds[to] ?? dust
    const key = `${clouds[from] ? from : 'dust'}>${clouds[to] ? to : 'dust'}`
    if (key === pair) return
    pair = key
    const set = (name, data) => { geo.attributes[name].array.set(data); geo.attributes[name].needsUpdate = true }
    set('position', a.pos); set('nA', a.nrm); set('cA', a.col)
    set('aB', b.pos); set('nB', b.nrm); set('cB', b.col)
    u.uSpinA.value = a === dust ? 1 : 0
    u.uSpinB.value = b === dust ? 1 : 0
  }

  const target = new THREE.Vector3(0, 0.1, 0), look = new THREE.Vector3()
  /**
   * state: { from, to, morph (0..1), orbit (radians), shift (subject left of centre, m), dist (camera distance factor) }
   */
  function update(state, time) {
    setPair(state.from, state.to)
    for (const m of [cloud.material, reflection.material]) {
      m.uniforms.uMorph.value = state.morph
      m.uniforms.uTime.value = time
    }
    u.uTint.value.set(models[state.from]?.tint ?? '#9fc4ff')
    u.uTintB.value.set(models[state.to]?.tint ?? '#9fc4ff')
    tint.copy(u.uTint.value).lerp(u.uTintB.value, state.morph)
    shaftU.uTime.value = time
    const a = state.orbit ?? 0
    const R = 7.6 * (state.dist ?? 1) // further back for a tall, narrow crop (phones)
    camera.position.set(Math.sin(a) * R, 0.55 + Math.sin(a * 0.7) * 0.25, -Math.cos(a) * R)
    // Look a little right of the subject, so it stands left of centre and the title has the right third.
    look.set(-Math.cos(a), 0, -Math.sin(a)).multiplyScalar(state.shift ?? 1.1).add(target) // the camera's right
    camera.lookAt(look)
  }

  /** Render into the screen texture (full 2.4:1 frame). */
  function renderToTexture() {
    camera.clearViewOffset()
    u.uFocal.value = rt.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
    const prev = renderer.getRenderTarget()
    renderer.setRenderTarget(rt)
    renderer.render(scene, camera)
    renderer.setRenderTarget(prev)
  }

  /** Point the film camera at the crop of the frame that a viewport of this aspect sees, filling it. */
  function cropFor(aspect, heightPx) {
    const fullH = heightPx, fullW = heightPx * FILM_ASPECT
    if (aspect <= FILM_ASPECT) camera.setViewOffset(fullW, fullH, (fullW - aspect * fullH) / 2, 0, aspect * fullH, fullH)
    else {
      const h = fullW / aspect
      camera.setViewOffset(fullW, fullH, 0, (fullH - h) / 2, fullW, h)
    }
    // Point size follows the crop's pixel scale.
    const visH = aspect <= FILM_ASPECT ? fullH : fullW / aspect
    u.uFocal.value = (heightPx * (fullH / visH)) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
  }

  return { scene, camera, rt, load, update, renderToTexture, cropFor, clouds }
}
