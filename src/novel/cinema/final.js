import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loadTraveller, alohaLinear, sky, holdIn } from './films/kit'

/*
 * Chapter Five, world 3: the final. A packed night stadium, floodlights, smoke, a crowd in sky-blue and
 * white with flags and scarves waving. On the pitch a team in light-blue-and-white vertical stripes
 * (generic toon players: no faces of real people, no names, numbers, sponsor or federation marks)
 * gathers for the lift: one raises an original golden cup, the squad piles in and jumps together,
 * confetti and gold streamers burst, fireworks over the roof. He stands pitch-side in the crowd's
 * colours and joins the jump. It ends on the lifted cup in the confetti; at p = 1 it plays on the
 * cinema's screen while the camera backs out into the hall, and fades there as the epilogue rises.
 * Everything here is built in code but him: a two-tier bowl under a cantilevered roof ringed with
 * floodlight gantries, a crowd of instanced cards (they bounce, wave, hold scarves, flags and a card
 * stunt, and flash their phones), the squad as one instanced, shader-posed mesh, and the confetti,
 * streamers, cold-spark fountains and fireworks as instanced quads driven from p and t on the GPU.
 *
 * CONTRACT (world.js, timeline.js and movies.js rely on it; do not change the export or its signature)
 *   export function createFinal(renderer, { loader, normalize, mobile }) -> { scene, camera, update, built }
 *     loader: the shared GLTFLoader (Meshopt + Draco). normalize(root, size, yaw): a model's meshes as
 *     one centred group scaled to `size` metres. mobile: phone-sized screen, build lighter.
 *   update(state, t, aspect) is called once per rendered frame while this world is drawn.
 *     state.p         0..1, this world's own progress (movies.js: Five's P 0.68..0.93), driven by scroll:
 *                     it scrubs both ways and can jump, so derive everything from p and t and keep no
 *                     one-way state. The FLASH cover resolves over p 0..0.1 (its camera flashes become the
 *                     crowd's: a crowd flashing there continues them); p 0.1..1 is seen clear. p stays at
 *                     1 through the back-out and the epilogue's fade: make p = 1 a composed last shot (the
 *                     lifted cup in the confetti) that reads from the cinema's seats.
 *     state.onScreen  true while this world is drawn onto the cinema's screen (Five's back-out and the
 *                     epilogue, at p = 1; aspect is then the screen's 2.4). The full-frame view at p = 1
 *                     and the on-screen one must match, or the hand-over at the back-out jumps: same
 *                     camera, no DOM-only or frame-locked HUD.
 *     state.still     reduced motion: no camera flourishes or shake; the celebration still follows p.
 *     state.portrait  the frame is a phone's (aspect < 0.85): frame for it. Decide framing from this,
 *                     not from `aspect`: on the cinema's screen `aspect` is 2.4 and a phone sees only
 *                     the middle of that picture.
 *     state.mobile    same as the option. state.cover: 0..1, how much a transition hides the frame
 *                     (kind 'flash' | null, phase 0..1): skip work the cover hides.
 *     t               seconds, monotonic. aspect: width / height of what is being drawn; set
 *                     camera.aspect from it.
 *     Returns { here, dream, grade? }: here = a Vector3 at the traveller (world space; the same object
 *     every frame is fine); dream = 0..1 extra bloom for a held beat (0 otherwise); grade = optional
 *     overrides of GRADE.final in movies.js ({ bloom, threshold, vignette, grain, scan }).
 *   Units: metres, y up, the pitch at y = 0 centred on the origin, its length along x (105 x 68), the
 *   traveller 1.72 m tall, standing just off the near touchline (+z). Camera: a PerspectiveCamera with
 *   a 40 degree vertical fov (the hall's lens, so the back-out does not jump).
 *   Colour: the frame has no sRGB encode after tone mapping, so a hex colour reads darker and richer
 *   than on a page, and a painted canvas texture reads as painted with colorSpace NoColorSpace.
 *   Build in steps: build the set a piece at a time, yielding (await a timeout) whenever a step has run
 *   ~4 ms, and report `built` false until it is whole; until then update() only places the camera
 *   (world.js holds the FLASH cover over it and compiles it once it is whole).
 *   Budget: the whole frame is about 5.6 ms on the desktop GPU today; keep this scene within that:
 *   at most ~150 draw calls and ~400k triangles in view (instance repeats: the crowd, the confetti),
 *   one shadow-casting light (2048 map, 1024 on mobile), textures at most 2048 px, no allocation or
 *   geometry rebuilds in update().
 *   world.prepare() builds this while the reader is paused in the landing, then compiles it, draws it
 *   once at p = 0 and once into the cinema screen's target: anything hidden then (visible = false) is
 *   skipped and would compile mid-scroll, so keep things that appear later in the scene, scaled to
 *   nothing, and add late-loading models to `scene` (prepare compiles again when the scene grows).
 */
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const lerp = THREE.MathUtils.lerp
const TAU = Math.PI * 2
let seed = 5
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const HIM = new THREE.Vector3(6, 0, 37.5)
// The presentation stage, just inside the near touchline in front of him: centre x, z, width, depth, height.
const STAGE = { x: 0.5, z: 29.6, w: 10.4, d: 5, h: 0.14 }
const LIFT = 0.6 // the cup goes up: the jump, the confetti, the fireworks
// The stands' footprint: the lower tier's front edge, a rounded rectangle of half-length a and half-width b.
const RIM = { a: 57, b: 42.5, r: 19 }
const IA = RIM.a - RIM.r, IB = RIM.b - RIM.r
const LOWER = d => 1.3 + 0.47 * d // the lower tier's floor, d metres back from its front (0.3 .. 21)
const UPPER = d => 17 + 0.6 * (d - 25) // the upper tier's (25 .. 50)
const ROOF_EDGE = 8, ROOF_Y = 42.5 // the roof's inner edge, where the floodlight gantries hang: its d and height
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color()
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _s = new THREE.Vector3(), _h = new THREE.Vector3()
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), DOWN = new THREE.Vector3(0, -1, 0)

// The footprint's eight runs from the near side's -x end, heading +x: a straight is [0, x0, z0, dx, dz,
// nx, nz] (n: outward), a corner [1, centre x, centre z, start angle] (it turns a quarter, clockwise).
const RUNS = [
  [0, -IA, RIM.b, 1, 0, 0, 1], [1, IA, IB, Math.PI / 2],
  [0, RIM.a, IB, 0, -1, 1, 0], [1, IA, -IB, 0],
  [0, IA, -RIM.b, -1, 0, 0, -1], [1, -IA, -IB, -Math.PI / 2],
  [0, -RIM.a, -IB, 0, 1, -1, 0], [1, -IA, IB, -Math.PI],
]
const runLength = (k, d) => (RUNS[k][0] ? (Math.PI / 2) * (RIM.r + d) : RUNS[k][3] ? 2 * IA : 2 * IB)
const perimeter = d => 4 * (IA + IB) + TAU * (RIM.r + d)
const F = { x: 0, z: 0, nx: 0, nz: 0 }
/** The point a fraction f along run k, d metres back from the stands' front (F, with its outward normal). */
function runAt(k, f, d) {
  const g = RUNS[k]
  if (g[0]) {
    const th = g[3] - f * (Math.PI / 2)
    F.nx = Math.cos(th)
    F.nz = Math.sin(th)
    F.x = g[1] + F.nx * (RIM.r + d)
    F.z = g[2] + F.nz * (RIM.r + d)
  } else {
    const len = runLength(k, 0)
    F.nx = g[5]
    F.nz = g[6]
    F.x = g[1] + g[3] * f * len + F.nx * d
    F.z = g[2] + g[4] * f * len + F.nz * d
  }
  return F
}
/** The point s metres round the footprint at depth d. */
function rimAt(s, d) {
  const L = perimeter(d)
  s = ((s % L) + L) % L
  for (let k = 0; k < 8; k++) {
    const len = runLength(k, d)
    if (s <= len || k === 7) return runAt(k, Math.min(1, s / len), d)
    s -= len
  }
}
if (import.meta.env?.DEV) {
  const a = { ...rimAt(0, 0) }, b = { ...rimAt(perimeter(3) - 1e-6, 3) }, c = { ...runAt(1, 1, 0) }
  console.assert(Math.abs(a.x + IA) < 1e-6 && Math.abs(a.z - RIM.b) < 1e-6 && Math.abs(b.x + IA) < 1e-3 && Math.abs(b.z - RIM.b - 3) < 1e-3, 'final: the footprint closes')
  console.assert(Math.abs(c.x - RIM.a) < 1e-6 && Math.abs(c.z - IB) < 1e-6, 'final: the corners meet the straights')
}

/** A band of the bowl: profile segments [d0, y0, d1, y1, colour] swept all the way round. uv.x: metres round. */
function sweep(segs, { uv = false } = {}) {
  const st = []
  for (let k = 0; k < 8; k++) for (let i = 0, n = RUNS[k][0] ? 14 : 6; i < n; i++) st.push([k, i / n])
  st.push([0, 0]) // and closes
  const pos = [], col = [], uvs = [], idx = []
  for (const [d0, y0, d1, y1, hex] of segs) {
    _c.set(hex)
    const base = pos.length / 3, dm = (d0 + d1) / 2
    for (let i = 0; i < st.length; i++) {
      const [k, f] = st[i]
      let u = f * runLength(k, dm)
      for (let j = 0; j < k; j++) u += runLength(j, dm)
      if (i === st.length - 1) u = perimeter(dm)
      runAt(k, f, d0)
      pos.push(F.x, y0, F.z)
      runAt(k, f, d1)
      pos.push(F.x, y1, F.z)
      col.push(_c.r, _c.g, _c.b, _c.r, _c.g, _c.b)
      uvs.push(u, 0, u, 1)
      if (i) {
        const a = base + (i - 1) * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g.toNonIndexed()
}

/** A part of a merged mesh, placed by `m` and painted one colour (k above 1 glows): position, normal, colour. */
function bake(geo, hex, m, k = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo
  for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n)
  if (m) g.applyMatrix4(m)
  _c.set(hex).multiplyScalar(k)
  const n = g.attributes.position.count, a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) a[i * 3] = _c.r, a[i * 3 + 1] = _c.g, a[i * 3 + 2] = _c.b
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}
const at = (x, y, z, ry = 0, rx = 0, rz = 0) => _m.makeRotationFromEuler(_e.set(rx, ry, rz)).setPosition(x, y, z)
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n)

/** Instanced quads (or any base) with per-instance attributes { name: [array, size] }. */
function instanced(base, n, attrs) {
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  for (const k of ['position', 'uv', 'normal']) if (base.attributes[k]) g.setAttribute(k, base.attributes[k])
  for (const [k, [arr, size]] of Object.entries(attrs)) g.setAttribute(k, new THREE.InstancedBufferAttribute(arr, size))
  g.instanceCount = n
  return g
}
const QUAD = new THREE.PlaneGeometry(2, 2) // a billboard's corners at -1..1
const fogU = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog)
const HASH = 'float h1(float n) { return fract(sin(n) * 43758.5453123); }'
// Turn v about the unit axis ax by a (Rodrigues).
const ROT = 'vec3 turn(vec3 v, vec3 ax, float a) { float c = cos(a), s = sin(a); return v * c + cross(ax, v) * s + ax * dot(ax, v) * (1.0 - c); }'

/*
 * The camera, as keys [p, position, look-at]: a low crane pushing in from the near touchline to pitch level behind
 * his shoulder as the squad gathers, low for the lift, and still for the last shot (the cup up in the
 * confetti, him jumping at the left), which is also the picture on the cinema's screen. A phone's tall
 * frame stands behind him instead, so he and the cup stack in it.
 */
const WIDE = [
  [0, 24, 9, 46, -2, 6, 22],
  [0.16, 19, 5, 44, -1, 4, 26],
  [0.32, 14.5, 2.6, 41.5, 0, 2.6, 28],
  [0.46, 11, 1.6, 39.6, 0.6, 2.2, 29.2],
  [0.57, 9.5, 1.3, 38.8, 0.6, 2, 29.8],
  [0.62, 2.5, 0.75, 38.6, 0.5, 2.5, 30.9], // the lift: pushed in low on the lifter, the cup against the floodlit roof
  [0.68, -1.6, 0.8, 38.6, 0.5, 2.8, 30.9],
  [0.74, -3.2, 0.85, 38.2, 0.5, 2.7, 30.9],
  [0.8, 3.4, 1.4, 41.8, 6, 1.5, 37.5], // a beat on him mid-jump, close enough for the scarf
  [0.86, 3.6, 1.4, 41.6, 5.6, 1.6, 37.4],
  [0.94, 10.9, 1.3, 39.2, 0.8, 3, 30.2], // back to the wide for the back-out
  [1, 10.9, 1.3, 39.2, 0.8, 3, 30.2],
]
const TALL = [
  [0, 18, 8, 45, 0, 4, 25],
  [0.16, 15, 5, 44, 0.5, 3, 27],
  [0.32, 11.5, 3.2, 42.6, 0.8, 1.8, 29],
  [0.46, 8.9, 1.95, 42.6, 2.2, 1.7, 30.5],
  [0.57, 8.4, 1.5, 41.4, 1.4, 1.7, 29.8],
  [0.62, 2, 0.9, 40, 0.5, 2.4, 30.9],
  [0.68, -0.6, 0.9, 39.9, 0.5, 2.6, 30.9],
  [0.74, -2, 0.9, 39.6, 0.5, 2.5, 30.9],
  [0.8, 4, 1.5, 42.5, 6, 1.4, 37.5],
  [0.86, 4.2, 1.5, 42.3, 5.8, 1.5, 37.4],
  [0.94, 10.2, 1.55, 42.2, 1.2, 2.9, 30],
  [1, 10.2, 1.55, 42.2, 1.2, 2.9, 30],
]
const cr = (a, b, c, d, u) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u)
/** Catmull-Rom through the keys at p: the camera's position and where it looks. */
function track(keys, p, pos, look) {
  let i = 0
  while (i < keys.length - 2 && p > keys[i + 1][0]) i++
  const a = keys[Math.max(0, i - 1)], b = keys[i], c = keys[i + 1], d = keys[Math.min(keys.length - 1, i + 2)]
  const u = THREE.MathUtils.clamp((p - b[0]) / (c[0] - b[0]), 0, 1)
  pos.set(cr(a[1], b[1], c[1], d[1], u), cr(a[2], b[2], c[2], d[2], u), cr(a[3], b[3], c[3], d[3], u))
  look.set(cr(a[4], b[4], c[4], d[4], u), cr(a[5], b[5], c[5], d[5], u), cr(a[6], b[6], c[6], d[6], u))
}

/*
 * A footballer, built once and drawn instanced: generic toon proportions, no face, no number, no marks.
 * aPart says which joint moves a vertex (0 torso and head, 1 and 2 the arms, 3 and 4 the left thigh and
 * shin, 5 and 6 the right), aKind how it is painted (0 its colour, 1 the striped shirt, 2 skin, 3 hair).
 * Facing +z, feet at y = 0, 1.78 m tall.
 */
function playerGeometry() {
  const parts = []
  const add = (geo, part, kind, hex, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const g = bake(geo.scale(sx, sy, sz), hex, at(x, y, z))
    const n = g.attributes.position.count
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1))
    g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(kind), 1))
    parts.push(g)
  }
  const sph = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h)
  const SHORTS = '#15171e'
  for (const s of [1, -1]) {
    const T = s > 0 ? 3 : 5
    add(box(0.1, 0.075, 0.27), T + 1, 0, '#1a1a1f', s * 0.1, 0.04, 0.04)
    add(cyl(0.052, 0.06, 0.44), T + 1, 0, '#eef0ee', s * 0.1, 0.3, 0)
    add(sph(0.058), T + 1, 2, '#fff', s * 0.1, 0.5, 0.005)
    add(cyl(0.083, 0.062, 0.26), T, 2, '#fff', s * 0.1, 0.62, 0)
    add(cyl(0.11, 0.1, 0.26), T, 0, SHORTS, s * 0.1, 0.83, 0)
  }
  add(cyl(0.175, 0.17, 0.17), 0, 0, SHORTS, 0, 0.94, 0, 1, 1, 0.72)
  const torso = [[0.001, 0.9], [0.165, 0.92], [0.172, 1.05], [0.19, 1.27], [0.198, 1.37], [0.168, 1.46], [0.07, 1.5], [0.001, 1.505]]
  add(new THREE.LatheGeometry(torso.map(([r, y]) => new THREE.Vector2(r, y)), 16), 0, 1, '#fff', 0, 0, 0, 1, 1, 0.7)
  add(cyl(0.048, 0.055, 0.11), 0, 2, '#fff', 0, 1.53, 0)
  add(sph(0.104, 14, 10), 0, 2, '#fff', 0, 1.665, 0.008, 0.92, 1.06, 1)
  add(new THREE.SphereGeometry(0.11, 14, 7, 0, TAU, 0, Math.PI * 0.5).rotateX(-0.55), 0, 3, '#fff', 0, 1.675, -0.012, 0.94, 1, 1.02) // swept back off the forehead
  for (const s of [1, -1]) {
    const A = s > 0 ? 1 : 2
    add(sph(0.072, 10, 8), A, 1, '#fff', s * 0.225, 1.425, 0)
    add(cyl(0.066, 0.056, 0.22), A, 1, '#fff', s * 0.24, 1.32, 0)
    add(cyl(0.046, 0.036, 0.44), A, 2, '#fff', s * 0.245, 1.0, 0)
    add(sph(0.048, 8, 6), A, 2, '#fff', s * 0.245, 0.77, 0.01)
  }
  return mergeGeometries(parts)
}
// The squad's pose, in the shader (iArm: left and right raise 0..1, spread, lean; iLeg: hip and knee,
// left then right), mirrored in handOf() for the cup in the lifter's hands.
const POSE_GLSL = /* glsl */ `
attribute float aPart; attribute float aKind; attribute vec4 iArm; attribute vec4 iLeg; attribute vec3 iSkin; attribute vec3 iHair;
varying float vKind; varying float vRestX; varying vec3 vSkin; varying vec3 vHair;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
void pose(inout vec3 p, inout vec3 n) {
  int part = int(aPart + 0.5);
  if (part >= 3) {
    bool left = part <= 4;
    float side = left ? 1.0 : -1.0;
    vec3 H = vec3(0.1 * side, 0.94, 0.0), K = vec3(0.1 * side, 0.5, 0.0);
    if (part == 4 || part == 6) { mat3 Rk = rotX(left ? iLeg.y : iLeg.w); p = Rk * (p - K) + K; n = Rk * n; }
    mat3 Rh = rotX(-(left ? iLeg.x : iLeg.z)); p = Rh * (p - H) + H; n = Rh * n;
  } else {
    if (part >= 1) {
      float side = part == 1 ? 1.0 : -1.0;
      vec3 S = vec3(0.235 * side, 1.43, 0.0);
      mat3 Ra = rotX(-(part == 1 ? iArm.x : iArm.y) * 3.14159265) * rotZ(side * iArm.z);
      p = Ra * (p - S) + S; n = Ra * n;
    }
    vec3 T = vec3(0.0, 0.94, 0.0);
    mat3 Rl = rotX(iArm.w); p = Rl * (p - T) + T; n = Rl * n;
  }
}`
/** A hand of player `m` (instance matrix) in world space, as the shader poses it: side 1 left, -1 right. */
function handOf(side, raise, spread, lean, m, out) {
  out.set(side * 0.01, -0.64, 0).applyAxisAngle(Z, side * spread).applyAxisAngle(X, -raise * Math.PI)
  out.x += side * 0.235
  out.y += 1.43 - 0.94
  out.applyAxisAngle(X, lean)
  out.y += 0.94
  return out.applyMatrix4(m)
}

// Billboards: quads at -1..1 turned to the camera in view space.
const SOFT_FS = /* glsl */ `
varying vec2 vQ; varying vec3 vC;
void main() { float r2 = dot(vQ, vQ); gl_FragColor = vec4(vC * exp(-r2 * 7.0) * (1.0 - smoothstep(0.6, 1.0, r2)), 1.0); }`
const additive = (vertexShader, fragmentShader, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace // as painted (see the contract's colour note)
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...repeat)
  }
  t.anisotropy = 4
  return t
}

export function createFinal(renderer, { loader, mobile = false }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900)
  scene.add(camera)
  let run = null
  const held = { here: HIM.clone().setY(0.9), dream: 0 }
  const hold = (state, aspect) => {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    track(state.portrait ? TALL : WIDE, state.p ?? 0, camera.position, _v)
    camera.lookAt(_v)
    return held
  }
  ;(async () => {
    let t0 = performance.now()
    const step = async () => {
      if (performance.now() - t0 < 4) return
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }
    scene.fog = new THREE.FogExp2('#272431', 0.0034) // the smoke hanging in the bowl
    const dome = sky({ top: '#020308', mid: '#0b0d1a', low: '#2c2634', sunDir: new THREE.Vector3(0, 1, 0), sun: '#000000' })
    scene.add(dome)
    // The uniforms the shaders share, set once a frame from p and t.
    const U = { t: { value: 0 }, p: { value: 0 }, excite: { value: 0.5 }, wave: { value: 0 }, stunt: { value: 1 }, lift: { value: 0 }, fire: { value: 0 }, spark: { value: 0 }, rate: { value: 0.3 } }
    const LIGHT = new THREE.Vector3(0.35, 0.8, 0.5).normalize() // the floodlights' main fall, for the confetti's glints
    const add = (o, still = true) => {
      if (still) o.matrixAutoUpdate = false
      o.frustumCulled = false // instanced and shader-placed: their bounds say nothing
      scene.add(o)
      return o
    }

    // ------------------------------------------------------------ the pitch: mown stripes, a cross-cut, grain and the lines
    const PW = mobile ? 1024 : 2048, PH = mobile ? 750 : 1500 // a phone's half the size: it never sees the pitch that close
    const PX = PW / 112, pc = document.createElement('canvas')
    pc.width = PW
    pc.height = PH
    const pg = pc.getContext('2d')
    for (let i = 0; i < 16; i++) {
      pg.fillStyle = i % 2 ? '#3d9441' : '#48a64c'
      pg.fillRect((i * PW) / 16, 0, PW / 16 + 1, PH)
    }
    pg.fillStyle = 'rgba(255,255,255,0.03)'
    for (let j = 0; j < 12; j += 2) pg.fillRect(0, (j * PH) / 12, PW, PH / 12)
    const img = pg.getImageData(0, 0, PW, PH), pxl = img.data
    for (let y = 0; y < PH; y++) {
      for (let x = 0, i = y * PW * 4; x < PW; x++, i += 4) {
        const n = (Math.random() - 0.5) * 20
        pxl[i] += n
        pxl[i + 1] += n * 1.2
        pxl[i + 2] += n * 0.6
      }
      if ((y & 63) === 63) await step()
    }
    pg.putImageData(img, 0, 0)
    {
      const M = x => PW / 2 + x * PX, N = z => PH / 2 + z * PX
      pg.strokeStyle = pg.fillStyle = 'rgba(244,248,244,0.92)'
      pg.lineWidth = (2.6 * PW) / 2048
      const arc = (x, z, r, a0, a1) => { pg.beginPath(); pg.arc(M(x), N(z), r * PX, a0, a1); pg.stroke() }
      const spot = (x, z) => { pg.beginPath(); pg.arc(M(x), N(z), 0.2 * PX, 0, TAU); pg.fill() }
      pg.strokeRect(M(-52.5), N(-34), 105 * PX, 68 * PX)
      pg.beginPath(); pg.moveTo(M(0), N(-34)); pg.lineTo(M(0), N(34)); pg.stroke()
      arc(0, 0, 9.15, 0, TAU)
      spot(0, 0)
      for (const s of [-1, 1]) {
        pg.strokeRect(M(Math.min(s * 52.5, s * 36)), N(-20.16), 16.5 * PX, 40.32 * PX)
        pg.strokeRect(M(Math.min(s * 52.5, s * 47)), N(-9.16), 5.5 * PX, 18.32 * PX)
        spot(s * 41.5, 0)
        const a = Math.acos(5.5 / 9.15) // the arc outside the box
        if (s > 0) arc(41.5, 0, 9.15, Math.PI - a, Math.PI + a)
        else arc(-41.5, 0, 9.15, -a, a)
        arc(s * 52.5, -34, 1, s > 0 ? Math.PI / 2 : 0, s > 0 ? Math.PI : Math.PI / 2)
        arc(s * 52.5, 34, 1, s > 0 ? Math.PI : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : 0)
      }
    }
    const pitchTex = new THREE.CanvasTexture(pc)
    pitchTex.colorSpace = THREE.NoColorSpace
    pitchTex.anisotropy = 8
    add(new THREE.Mesh(new THREE.PlaneGeometry(112, 82).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: pitchTex })))
    add(new THREE.Mesh(new THREE.PlaneGeometry(150, 110).rotateX(-Math.PI / 2).translate(0, -0.02, 0), new THREE.MeshLambertMaterial({ color: '#22402a' })))
    await step()

    // ------------------------------------------------------------ the bowl: two tiers under a cantilevered roof, one merged mesh
    const SEAT = '#1c2742', CONC = '#2c2f38', DARK = '#121318', ROOF = '#2d3039'
    const set = [sweep([
      [0, 0, 0, 1.3, CONC], [0, 1.3, 0.3, 1.3, CONC], [0.3, 1.3, 21, LOWER(21), SEAT],
      [21, LOWER(21), 21, 13, DARK], [21, 13, 23.5, 13.4, CONC], [23.5, 16.4, 25, 16.4, CONC], [25, 16.4, 25, 17, CONC],
      [25, 17, 50, UPPER(50), SEAT], [50, UPPER(50), 50, 37.2, CONC], [50, 37.2, 52, 37, ROOF],
      [52, 37, ROOF_EDGE, ROOF_Y, ROOF], [ROOF_EDGE, ROOF_Y, ROOF_EDGE, ROOF_Y - 2.4, DARK],
    ])]
    const lit = [] // things that glow: the lamps, the stage's edge
    const glows = [] // [x, y, z, sx, sy, kind (0 glow, 1 streak, 2 flickering flare), seed, r, g, b]
    // Floodlight gantries round the roof's inner edge, each a dark frame of twelve lamps faced in and
    // down at the pitch, with a rib under the roof behind it.
    const G = mobile ? 36 : 44, Lg = perimeter(ROOF_EDGE), gantries = []
    const tan = new THREE.Vector3(), up = new THREE.Vector3(), face = new THREE.Vector3(), c0 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1)
    for (let i = 0; i < G; i++) {
      const { x, z, nx, nz } = rimAt(((i + 0.5) * Lg) / G, ROOF_EDGE)
      set.push(bake(box(44, 1.1, 0.4), ROOF, at(x + nx * 22, (37 + ROOF_Y) / 2 - 0.75, z + nz * 22, Math.atan2(-nz, nx), 0, -0.124)))
      tan.set(-nz, 0, nx)
      face.set(-nx * 0.62, -0.78, -nz * 0.62)
      up.crossVectors(face, tan)
      _q.setFromRotationMatrix(_m.makeBasis(tan, up, face))
      c0.set(x - nx * 0.4, ROOF_Y - 2.9, z - nz * 0.4)
      gantries.push([c0.x, c0.y, c0.z, face.x, face.y, face.z])
      set.push(bake(box(6.4, 1.9, 0.35), DARK, _m.compose(c0, _q, one)))
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
        _h.set((c - 2.5) * 1.0, (r - 0.5) * 0.85, 0.2).applyQuaternion(_q).add(c0)
        lit.push(bake(new THREE.CircleGeometry(0.34, 10), '#fff6e4', _m.compose(_h, _q, one), 2.6))
      }
      glows.push([c0.x + face.x, c0.y + face.y, c0.z + face.z, 6.5, 6.5, 0, rnd(), 1, 0.9, 0.76])
      if (i % 3 === 0) glows.push([c0.x + face.x, c0.y + face.y, c0.z + face.z, 30, 0.5, 1, rnd(), 0.32, 0.3, 0.28])
      if (i % 4 === 3) await step()
    }
    // Pitch-side boards (their faces are the LED strip, below) and the goals.
    const led = [sweep([[20.97, 11.4, 20.97, 12.8, '#ffffff']], { uv: true })]
    const board = (w, x, z, ry) => {
      set.push(bake(box(w, 0.95, 0.3), DARK, at(x, 0.475, z, ry)))
      const g = new THREE.PlaneGeometry(w, 0.9).toNonIndexed()
      const uv = g.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * w)
      g.applyMatrix4(at(x, 0.5, z, ry)).translate(Math.sin(ry) * 0.16, 0, Math.cos(ry) * 0.16)
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(uv.count * 3).fill(1), 3))
      led.push(g)
    }
    board(108, 0, 40.1, Math.PI)
    board(108, 0, -40.1, 0)
    board(60, 56.1, 0, -Math.PI / 2)
    board(60, -56.1, 0, Math.PI / 2)
    const nets = []
    for (const s of [-1, 1]) {
      const gx = s * 52.5, bx = gx + s * 2
      for (const z of [-3.66, 3.66]) {
        set.push(bake(box(0.12, 2.44, 0.12), '#f2f2f2', at(gx, 1.22, z)), bake(box(0.05, 2.44, 0.05), '#d8d8d8', at(bx, 1.22, z)), bake(box(2, 0.05, 0.05), '#d8d8d8', at(gx + s, 2.44, z)), bake(box(2, 0.05, 0.05), '#d8d8d8', at(gx + s, 0.03, z)))
        nets.push(new THREE.PlaneGeometry(2, 2.44).applyMatrix4(at(gx + s, 1.22, z)))
      }
      set.push(bake(box(0.12, 0.12, 7.44), '#f2f2f2', at(gx, 2.44, 0)), bake(box(0.05, 0.05, 7.32), '#d8d8d8', at(bx, 2.44, 0)))
      nets.push(new THREE.PlaneGeometry(7.32, 2.44).applyMatrix4(at(bx, 1.22, 0, Math.PI / 2)), new THREE.PlaneGeometry(2, 7.32).applyMatrix4(at(gx + s, 2.44, 0, 0, -Math.PI / 2)))
    }
    // The stage: a low, pale platform with a step and a gold edge.
    const { x: SX, z: SZ, w: SW, d: SD, h: SH } = STAGE
    set.push(bake(box(SW, SH, SD), '#9aa3b8', at(SX, SH / 2, SZ)), bake(box(3.2, SH / 2, 0.6), '#9aa3b8', at(SX, SH / 4, SZ + SD / 2 + 0.3)))
    for (const z of [-1, 1]) lit.push(bake(box(SW + 0.04, 0.04, 0.05), '#ffc35a', at(SX, SH, SZ + (z * SD) / 2), 1.8))
    for (const x of [-1, 1]) lit.push(bake(box(0.05, 0.04, SD), '#ffc35a', at(SX + (x * SW) / 2, SH, SZ), 1.8))
    add(new THREE.Mesh(mergeGeometries(set), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.08, side: THREE.DoubleSide })))
    add(new THREE.Mesh(mergeGeometries(lit), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })))
    const netTex = canvasTexture(64, 64, g => {
      g.strokeStyle = 'rgba(255,255,255,1)'
      g.lineWidth = 3
      g.strokeRect(0, 0, 64, 64)
    }, [16, 16])
    add(new THREE.Mesh(mergeGeometries(nets), new THREE.MeshBasicMaterial({ color: '#cfd6d6', alphaMap: netTex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })))
    // The club level's lit windows, between the tiers.
    const winTex = canvasTexture(256, 64, g => {
      g.fillStyle = '#0a0c11'
      g.fillRect(0, 0, 256, 64)
      for (let i = 0; i < 8; i++) {
        const k = rnd()
        g.fillStyle = k < 0.7 ? `rgb(${210 + 40 * rnd()},${150 + 40 * rnd()},${90 + 30 * rnd()})` : '#1b1e26'
        g.fillRect(i * 32 + 2, 8, 28, 50)
      }
    }, [1 / 8, 1])
    add(new THREE.Mesh(sweep([[23.45, 13.55, 23.45, 16.25, '#ffffff']], { uv: true }), new THREE.MeshBasicMaterial({ map: winTex })))
    // The LED ribbon on the lower tier's fascia and the boards: sky-blue and white bands drifting round
    // the bowl, swept with gold once the cup is up.
    add(new THREE.Mesh(mergeGeometries(led), new THREE.ShaderMaterial({
      uniforms: { ...fogU(), uT: U.t, uLift: U.lift },
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        #include <common>
        #include <fog_pars_vertex>
        void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uT, uLift; varying vec2 vUv;
        #include <common>
        #include <fog_pars_fragment>
        void main() {
          float x = vUv.x;
          float b = step(0.5, fract(x / 7.0 - uT * 0.18));
          vec3 c = mix(vec3(0.42, 0.66, 0.9), vec3(0.9, 0.94, 1.0), b);
          float chev = fract((x + abs(vUv.y - 0.5) * 2.0) / 3.5 - uT * 0.5);
          c *= 0.8 + 0.35 * smoothstep(0.85, 0.95, chev);
          float pulse = 0.5 + 0.5 * sin(x * 0.45 - uT * 6.0);
          c = mix(c, vec3(1.0, 0.72, 0.3) * (0.55 + 0.9 * pulse), uLift);
          vec2 g = fract(vec2(x * 10.0, vUv.y * 9.0));
          float aa = clamp(fwidth(x * 10.0), 0.0, 1.0);
          c *= mix(step(0.2, g.x) * step(0.2, g.y), 0.64, aa) * 0.5 + 0.75;
          gl_FragColor = vec4(c * 1.1, 1.0);
          #include <fog_fragment>
        }`,
    })))
    await step()

    // ------------------------------------------------------------ the crowd: instanced cards on the tiers
    // An atlas of eight poses, painted as masks (red the shirt, green skin, blue a scarf or card, black the
    // rest), so one card is any fan: arms down, both up, a scarf held up, one arm up, clapping, a card held
    // up for the stunt, a scarf worn, fists up.
    const ARMS = [
      [[0.25, 1.15, 0.26, 0.9], [0.25, 1.15, 0.26, 0.9]],
      [[0.32, 1.7, 0.42, 1.98], [0.32, 1.7, 0.42, 1.98]],
      [[0.33, 1.66, 0.33, 1.98], [0.33, 1.66, 0.33, 1.98]],
      [[0.25, 1.15, 0.26, 0.9], [0.24, 1.72, 0.26, 2.06]],
      [[0.25, 1.14, 0.05, 1.3], [0.25, 1.14, 0.05, 1.3]],
      [[0.3, 1.66, 0.26, 1.88], [0.3, 1.66, 0.26, 1.88]],
      [[0.25, 1.15, 0.26, 0.9], [0.25, 1.15, 0.26, 0.9]],
      [[0.37, 1.45, 0.26, 1.8], [0.37, 1.45, 0.26, 1.8]],
    ]
    const atlas = canvasTexture(1024, 256, g => {
      const M = 256 / 2.2
      g.lineCap = g.lineJoin = 'round'
      for (let f = 0; f < 8; f++) {
        const X0 = x => f * 128 + 64 + x * M, Y0 = y => 256 - y * M
        const limb = (x0, y0, x1, y1, w, col) => { g.strokeStyle = col; g.lineWidth = w * M; g.beginPath(); g.moveTo(X0(x0), Y0(y0)); g.lineTo(X0(x1), Y0(y1)); g.stroke() }
        const blob = (x, y, rx, ry, col, a0 = 0, a1 = TAU) => { g.fillStyle = col; g.beginPath(); g.ellipse(X0(x), Y0(y), rx * M, ry * M, 0, a0, a1); g.fill() }
        const rect = (x0, y0, x1, y1, col) => { g.fillStyle = col; g.fillRect(X0(x0), Y0(y1), (x1 - x0) * M, (y1 - y0) * M) }
        rect(-0.17, 0, 0.17, 0.92, '#000')
        g.fillStyle = '#f00'
        g.beginPath()
        g.roundRect(X0(-0.2), Y0(1.47), 0.4 * M, 0.62 * M, 0.08 * M)
        g.fill()
        rect(-0.045, 1.42, 0.045, 1.55, '#0f0')
        blob(0, 1.63, 0.095, 0.115, '#0f0')
        blob(0, 1.66, 0.102, 0.09, '#000', Math.PI, TAU)
        for (const sd of [1, -1]) {
          const [ex, ey, hx, hy] = ARMS[f][sd > 0 ? 0 : 1]
          limb(sd * 0.19, 1.4, sd * ex, ey, 0.11, '#f00')
          limb(sd * ex, ey, sd * hx, hy, 0.085, '#0f0')
          blob(sd * hx, hy, 0.05, 0.05, '#0f0')
        }
        if (f === 2) rect(-0.37, 1.93, 0.37, 2.04, '#00f')
        if (f === 5) rect(-0.3, 1.83, 0.3, 2.2, '#00f')
        if (f === 6) rect(-0.11, 1.0, -0.035, 1.5, '#00f'), rect(0.035, 1.0, 0.11, 1.5, '#00f'), rect(-0.1, 1.43, 0.1, 1.5, '#00f')
      }
    })
    const SPACE = mobile ? 0.9 : 0.56, rows = []
    for (let k = 0; k < 24; k++) { const d = 0.75 + k * 0.85; rows.push([d, LOWER(d), 0, k]) }
    for (let k = 0; k < 30; k++) { const d = 25.5 + k * 0.8; rows.push([d, UPPER(d), 1, k]) }
    let NC = 0
    for (const [d] of rows) NC += Math.floor(perimeter(d) / SPACE)
    const cPos = new Float32Array(NC * 3), cA = new Float32Array(NC * 4), cCol = new Float32Array(NC * 3), cAcc = new Float32Array(NC * 3)
    const flashes = [], flags = [], spots = []
    const WHITE = [0.95, 0.96, 0.98], SKY = [0.45, 0.69, 0.91], GOLD = [1, 0.76, 0.34], NAVY = [0.1, 0.15, 0.3], INK = [0.08, 0.08, 0.1], OTHER = [0.75, 0.2, 0.2]
    let nc = 0
    const L0 = perimeter(0)
    for (const [d, y, tier, k] of rows) {
      const L = perimeter(d), m = Math.floor(L / SPACE)
      for (let j = 0; j < m; j++) {
        const s = (j + 0.3 * (rnd() - 0.5)) * (L / m)
        if (((s * L0) / L) % 13.5 < 1.1 || rnd() < 0.025) continue // the aisles, and the odd empty seat
        const f = rimAt(s, d + 0.12 * (rnd() - 0.5)), r = rnd()
        let shirt = SKY, striped = 0
        if (r < 0.36) striped = 1
        else if (r < 0.56) shirt = SKY
        else if (r < 0.76) shirt = WHITE
        else if (r < 0.86) shirt = NAVY
        else if (r < 0.93) shirt = INK
        else if (r < 0.97) shirt = GOLD
        else shirt = OTHER
        // The card stunt: the far side's lower tier holds up sky-blue and white cards in broad stripes.
        let role = rnd() < 0.2 ? 1 : 0, acc = SKY
        if (!tier && k < 18 && f.nz < -0.99 && Math.abs(f.x) < 36) {
          role = 2
          acc = k >= 7 && k <= 9 ? GOLD : Math.floor((f.x + 36) / 6) % 2 ? WHITE : SKY
        }
        cPos.set([f.x, y, f.z], nc * 3)
        cA.set([rnd(), s / L, role + striped * 0.5, tier], nc * 4)
        cCol.set(shirt, nc * 3)
        cAcc.set(acc, nc * 3)
        nc++
        if (rnd() < (mobile ? 0.12 : 0.2)) flashes.push(f.x, y + 2.05, f.z, rnd())
        if (rnd() < (mobile ? 0.007 : 0.013)) flags.push(f.x, y + 1.95, f.z, rnd(), 0.95 + 0.4 * rnd(), (rnd() - 0.5) * 1.5)
        else if (!tier && k > 1 && k < 9 && f.nz < 0.5 && rnd() < 0.0035) flags.push(f.x, y + 1.95, f.z, rnd(), 3 + rnd(), (rnd() - 0.5) * 1.2) // a big one
        if (!tier && k > 2 && k < 12 && f.nz < 0.3 && rnd() < 0.0007) spots.push([f.x, y, f.z])
      }
      await step()
    }
    const crowd = add(new THREE.Mesh(
      instanced(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), nc, { iPos: [cPos, 3], iA: [cA, 4], iCol: [cCol, 3], iAcc: [cAcc, 3] }),
      new THREE.ShaderMaterial({
        uniforms: { ...fogU(), uT: U.t, uExcite: U.excite, uWave: U.wave, uStunt: U.stunt, uAtlas: { value: atlas }, uScale: { value: mobile ? 1.1 : 1 }, uLight: { value: 1 } },
        fog: true,
        vertexShader: /* glsl */ `
          uniform float uT, uExcite, uWave, uStunt, uScale;
          attribute vec3 iPos; attribute vec4 iA; attribute vec3 iCol; attribute vec3 iAcc;
          varying vec2 vUv; varying vec3 vCol; varying vec3 vAcc; varying vec3 vSkin; varying float vStripe; varying float vScarf; varying float vShade;
          #include <common>
          #include <fog_pars_vertex>
          ${HASH}
          void main() {
            float sd = iA.x, role = floor(iA.z + 0.01);
            float hop = max(0.0, sin(uT * (7.0 + sd * 2.5) + sd * 60.0));
            float wild = step(0.08 + 0.85 * fract(sd * 3.7), uExcite);
            float pick = h1(floor(uT * 0.3 + sd * 17.0) + sd * 311.0);
            float frame = pick < 0.3 ? 0.0 : pick < 0.55 ? 4.0 : pick < 0.8 ? 3.0 : 7.0;
            if (role == 1.0) frame = fract(uT * 0.21 + sd * 5.0) < 0.7 ? 2.0 : 6.0;
            if (wild > 0.5) frame = role == 1.0 ? 2.0 : hop > 0.45 ? 1.0 : 7.0;
            float w = fract(iA.y - uT * 0.045);
            float wave = uWave * smoothstep(0.03, 0.0, min(w, 1.0 - w));
            if (wave > 0.3) frame = 1.0;
            float card = role == 2.0 ? step(0.04 + 0.9 * fract(sd * 7.1), uStunt) : 0.0;
            if (card > 0.5) frame = 5.0;
            float lift = (hop * 0.24 * wild + wave * 0.32) * (1.0 - card) + sin(uT * 2.0 + sd * 30.0) * 0.015;
            vec3 base = iPos + vec3(0.0, 0.6 * uScale + lift, 0.0);
            vec2 to = normalize(cameraPosition.xz - base.xz);
            vec3 wp = base + vec3(to.y, 0.0, -to.x) * position.x * 1.1 * uScale + vec3(0.0, position.y * 1.6 * uScale, 0.0);
            vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            vUv = vec2((frame + uv.x) / 8.0, (0.6 + uv.y * 1.6) / 2.2);
            vCol = iCol; vAcc = iAcc; vStripe = step(0.25, fract(iA.z)); vScarf = role == 1.0 ? 1.0 : 0.0;
            vSkin = mix(vec3(0.92, 0.71, 0.57), vec3(0.45, 0.29, 0.2), h1(sd * 53.0) * h1(sd * 17.0));
            vShade = (0.6 + 0.4 * h1(sd * 91.0)) * (iA.w > 0.5 ? 0.8 : 1.0);
            #include <fog_vertex>
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uAtlas; uniform float uLight;
          varying vec2 vUv; varying vec3 vCol; varying vec3 vAcc; varying vec3 vSkin; varying float vStripe; varying float vScarf; varying float vShade;
          #include <common>
          #include <fog_pars_fragment>
          void main() {
            vec4 m = texture2D(uAtlas, vUv);
            if (m.a < 0.5) discard;
            vec3 sky = vec3(0.45, 0.69, 0.91), white = vec3(0.95, 0.96, 0.98);
            float u = fract(vUv.x * 8.0) * 10.6;
            float aa = clamp(fwidth(u) * 1.2, 0.0, 1.0);
            vec3 shirt = mix(vCol, mix(white, sky, mix(step(0.5, fract(u)), 0.5, aa)), vStripe);
            vec3 acc = mix(vAcc, mix(white, sky, mix(step(0.5, fract(u * 0.6)), 0.5, aa)), vScarf);
            vec3 c = vec3(0.05, 0.05, 0.07) * max(0.0, 1.0 - m.r - m.g - m.b) + shirt * m.r + vSkin * m.g + acc * m.b;
            gl_FragColor = vec4(c * vShade * uLight, 1.0);
            #include <fog_fragment>
          }`,
      }),
    ))
    await step()

    // Phone flashes across the stands: a storm of them as the cover's own flashes hand over, a steady
    // twinkle after, and a second storm when the cup goes up.
    const NF = flashes.length / 4
    add(new THREE.Mesh(instanced(QUAD, NF, { iP: [new Float32Array(flashes), 4] }), additive(/* glsl */ `
      attribute vec4 iP; uniform float uT, uRate; varying vec2 vQ; varying vec3 vC;
      ${HASH}
      void main() {
        float tick = uT * 6.0 + iP.w * 91.0;
        float on = step(1.0 - uRate, h1(floor(tick) * 1.37 + iP.w * 1000.0)) * pow(1.0 - fract(tick), 4.0);
        vec4 mv = modelViewMatrix * vec4(iP.xyz, 1.0);
        mv.xy += position.xy * max(0.12, -mv.z * 0.0045) * step(0.02, on);
        vQ = position.xy; vC = vec3(0.9, 0.95, 1.0) * 3.0 * on;
        gl_Position = projectionMatrix * mv;
      }`, SOFT_FS, { uT: U.t, uRate: U.rate })))
    // Flags in the crowd: sky-blue and white bands, flapping, waved in arcs; a few big ones low down.
    const NFl = flags.length / 6, flP = new Float32Array(NFl * 4), flF = new Float32Array(NFl * 2)
    for (let i = 0; i < NFl; i++) flP.set(flags.slice(i * 6, i * 6 + 4), i * 4), flF.set(flags.slice(i * 6 + 4, i * 6 + 6), i * 2)
    add(new THREE.Mesh(instanced(new THREE.PlaneGeometry(1, 0.66, 8, 3).translate(0.5, 0.33, 0), NFl, { iP: [flP, 4], iF: [flF, 2] }), new THREE.ShaderMaterial({
      uniforms: { ...fogU(), uT: U.t, uExcite: U.excite },
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        uniform float uT, uExcite; attribute vec4 iP; attribute vec2 iF; varying vec2 vUv; varying float vShade;
        #include <common>
        #include <fog_pars_vertex>
        void main() {
          float sd = iP.w, s = iF.x;
          vec3 p = position;
          float ph = p.x * 5.0 - uT * (6.5 + sd * 3.0) + sd * 20.0;
          p.z += sin(ph) * 0.12 * p.x;
          p.y -= p.x * p.x * 0.1;
          p *= s;
          p.y += 0.45 * s;
          float tilt = sin(uT * (1.4 + sd) + sd * 40.0) * (0.35 + 0.4 * uExcite), c = cos(tilt), sn = sin(tilt);
          p.xy = vec2(p.x * c - p.y * sn, p.x * sn + p.y * c);
          vec2 to = cameraPosition.xz - iP.xz;
          float yaw = atan(to.x, to.y) + iF.y + sin(uT * (0.9 + sd) + sd * 9.0) * 0.6, cy = cos(yaw), sy = sin(yaw);
          p.xz = vec2(p.x * cy + p.z * sy, -p.x * sy + p.z * cy);
          vec4 mvPosition = viewMatrix * vec4(iP.xyz + p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vUv = uv; vShade = 0.78 + 0.22 * cos(ph);
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vShade;
        #include <common>
        #include <fog_pars_fragment>
        void main() {
          float band = step(0.333, vUv.y) * step(vUv.y, 0.667);
          gl_FragColor = vec4(mix(vec3(0.45, 0.69, 0.91), vec3(0.95), band) * vShade, 1.0);
          #include <fog_fragment>
        }`,
    })))
    await step()

    // ------------------------------------------------------------ smoke: haze in the bowl, coloured smoke off flares in the stands
    const puffTex = canvasTexture(128, 128, g => {
      for (let i = 0; i < 24; i++) {
        const r = 16 + rnd() * 26, x = 64 + (rnd() - 0.5) * 2 * (60 - r), y = 64 + (rnd() - 0.5) * 2 * (60 - r)
        const gr = g.createRadialGradient(x, y, 0, x, y, r)
        gr.addColorStop(0, 'rgba(255,255,255,0.22)')
        gr.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = gr
        g.fillRect(0, 0, 128, 128)
      }
    })
    const puffs = [] // [x, y, z, size, r, g, b, a, rise, period, phase, spin]
    for (let i = 0; i < 24; i++) puffs.push([(rnd() - 0.5) * 110, 9 + rnd() * 24, (rnd() - 0.5) * 80, 18 + rnd() * 22, 0.62, 0.6, 0.62, 0.07, 0, 0, rnd(), rnd()])
    for (const [x, y, z] of spots) {
      const white = rnd() < 0.4
      for (let j = 0; j < 6; j++) puffs.push([x, y + 1.6, z, 2.6, white ? 0.9 : 0.55, white ? 0.92 : 0.76, white ? 0.95 : 0.98, 0.42, 14, 8, j / 6 + rnd() * 0.05, rnd()])
      glows.push([x, y + 2.1, z, 1.4, 1.4, 2, rnd(), 2.2, 0.55, 0.3])
    }
    const NP = puffs.length, pP = new Float32Array(NP * 4), pC = new Float32Array(NP * 4), pM = new Float32Array(NP * 4)
    puffs.forEach((q, i) => { pP.set(q.slice(0, 4), i * 4); pC.set(q.slice(4, 8), i * 4); pM.set(q.slice(8, 12), i * 4) })
    add(new THREE.Mesh(instanced(QUAD, NP, { iP: [pP, 4], iC: [pC, 4], iM: [pM, 4] }), new THREE.ShaderMaterial({
      uniforms: { uT: U.t, uTex: { value: puffTex } },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec4 iP; attribute vec4 iC; attribute vec4 iM; uniform float uT; varying vec2 vUv; varying vec4 vC;
        void main() {
          float per = iM.y, age = per > 0.0 ? fract(uT / per + iM.z) : 0.5;
          vec3 c = iP.xyz + vec3(sin(uT * 0.07 + iM.z * 6.28) * 3.0, per > 0.0 ? age * iM.x : sin(uT * 0.05 + iM.z * 9.0), cos(uT * 0.06 + iM.z * 4.0) * 3.0);
          float size = iP.w * (per > 0.0 ? 0.4 + age * 1.3 : 1.0), a = iC.a * (per > 0.0 ? sin(age * 3.14159) : 1.0);
          float r = iM.z * 6.28 + uT * 0.05 * (iM.w - 0.5);
          vec2 q = mat2(cos(r), sin(r), -sin(r), cos(r)) * position.xy;
          vec4 mv = modelViewMatrix * vec4(c, 1.0);
          mv.xy += q * size;
          a *= smoothstep(2.0, 12.0, -mv.z);
          vUv = uv; vC = vec4(iC.rgb, a);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; varying vec2 vUv; varying vec4 vC;
        void main() { gl_FragColor = vec4(vC.rgb, vC.a * texture2D(uTex, vUv).a); }`,
    })))
    // Floodlight shafts in the haze, from gantries on the far side and the ends down onto the pitch.
    const shafts = gantries.filter((g, i) => g[5] > -0.2 && i % 2 === 0).slice(0, 14) // not the near side's: they would light the lens
    const beams = add(new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 7, 1, 20, 1, true).translate(0, -0.5, 0), new THREE.ShaderMaterial({
      uniforms: { uBeam: { value: 0.045 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        uniform float uBeam; varying float vA;
        void main() {
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec3 n = normalize(mat3(instanceMatrix) * normalize(vec3(position.x, 0.0, position.z)));
          float f = abs(dot(n, normalize(cameraPosition - wp.xyz))), along = -position.y;
          vA = uBeam * f * f * (1.0 - along) * smoothstep(0.0, 0.06, along);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: 'varying float vA; void main() { gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * vA, 1.0); }',
    }), shafts.length))
    shafts.forEach(([x, y, z], i) => {
      _v.set(x * 0.3 + (rnd() - 0.5) * 20, 0, z * 0.3 + (rnd() - 0.5) * 16).sub(_w.set(x, y, z))
      const len = _v.length()
      beams.setMatrixAt(i, _m.compose(_w, _q.setFromUnitVectors(DOWN, _v.normalize()), _s.set(1, len, 1)))
    })
    // Every glow: the gantries' flares and streaks, the flares in the stands.
    const NG = glows.length, gP = new Float32Array(NG * 3), gS = new Float32Array(NG * 4), gC = new Float32Array(NG * 3)
    glows.forEach((q, i) => { gP.set(q.slice(0, 3), i * 3); gS.set(q.slice(3, 7), i * 4); gC.set(q.slice(7, 10), i * 3) })
    const GLOW_VS = /* glsl */ `
      attribute vec3 iP; attribute vec4 iS; attribute vec3 iC; uniform float uT, uGlow; varying vec2 vQ; varying vec3 vC; varying float vK;
      void main() {
        vec4 mv = modelViewMatrix * vec4(iP, 1.0);
        float f = iS.z > 1.5 ? 0.7 + 0.3 * sin(uT * 23.0 + iS.w * 50.0) * sin(uT * 9.0 + iS.w * 13.0) : 1.0;
        mv.xy += position.xy * iS.xy;
        vQ = position.xy; vC = iC * f * uGlow; vK = iS.z;
        gl_Position = projectionMatrix * mv;
      }`
    const GLOW_FS = /* glsl */ `
      varying vec2 vQ; varying vec3 vC; varying float vK;
      void main() {
        float r2 = dot(vQ, vQ);
        float a = vK > 0.5 && vK < 1.5 ? exp(-abs(vQ.y) * 5.0) * pow(max(0.0, 1.0 - abs(vQ.x)), 3.0) : (exp(-r2 * 30.0) + 0.28 * exp(-r2 * 5.0)) * (1.0 - smoothstep(0.7, 1.0, r2));
        gl_FragColor = vec4(vC * a, 1.0);
      }`
    add(new THREE.Mesh(instanced(QUAD, NG, { iP: [gP, 3], iS: [gS, 4], iC: [gC, 3] }), additive(GLOW_VS, GLOW_FS, { uT: U.t, uGlow: { value: 1 } })))
    await step()

    // ------------------------------------------------------------ the squad, the stage and the cup
    const NS = 19
    const sqG = playerGeometry()
    const armA = new THREE.InstancedBufferAttribute(new Float32Array(NS * 4), 4).setUsage(THREE.DynamicDrawUsage)
    const legA = new THREE.InstancedBufferAttribute(new Float32Array(NS * 4), 4).setUsage(THREE.DynamicDrawUsage)
    const SKINS = [[0.88, 0.68, 0.54], [0.8, 0.58, 0.44], [0.62, 0.43, 0.31], [0.92, 0.74, 0.6], [0.7, 0.5, 0.36]], HAIRS = [[0.06, 0.05, 0.04], [0.16, 0.11, 0.07], [0.28, 0.19, 0.11], [0.04, 0.04, 0.05]]
    const skinA = new Float32Array(NS * 3), hairA = new Float32Array(NS * 3)
    for (let i = 0; i < NS; i++) skinA.set(SKINS[Math.floor(rnd() * SKINS.length)], i * 3), hairA.set(HAIRS[Math.floor(rnd() * HAIRS.length)], i * 3)
    sqG.setAttribute('iArm', armA)
    sqG.setAttribute('iLeg', legA)
    sqG.setAttribute('iSkin', new THREE.InstancedBufferAttribute(skinA, 3))
    sqG.setAttribute('iHair', new THREE.InstancedBufferAttribute(hairA, 3))
    const squadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 })
    squadMat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + POSE_GLSL)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal); vec3 posed = vec3(position); pose(posed, objectNormal);\nvKind = aKind; vRestX = position.x; vSkin = iSkin; vHair = iHair;')
        .replace('#include <begin_vertex>', 'vec3 transformed = posed;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vKind; varying float vRestX; varying vec3 vSkin; varying vec3 vHair;')
        .replace('#include <color_fragment>', /* glsl */ `
          if (vKind > 0.5 && vKind < 1.5) diffuseColor.rgb = mix(vec3(0.96), vec3(0.45, 0.69, 0.91), step(0.5, fract(vRestX * 5.9 + 0.25)));
          else if (vKind > 1.5 && vKind < 2.5) diffuseColor.rgb = vSkin;
          else if (vKind > 2.5) diffuseColor.rgb = vHair;
          else diffuseColor.rgb *= vColor.rgb;`)
    }
    const squad = add(new THREE.InstancedMesh(sqG, squadMat, NS), false)
    squad.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    // Where each stands: gathered tight round the lifter (index 0) at the front, three rows deep; before
    // that, spread out across the stage, facing every way, waving to the stands. The lifter walks in last.
    const GATHER = [[0, 1.35], [-2.25, 1.0], [-1.5, 1.2], [1.5, 1.2], [2.25, 1.0]]
    for (let i = 0; i < 7; i++) GATHER.push([-2.4 + i * 0.8 + (rnd() - 0.5) * 0.12, 0.38 + (rnd() - 0.5) * 0.15])
    for (let i = 0; i < 7; i++) GATHER.push([-2.1 + i * 0.7 + (rnd() - 0.5) * 0.12, -0.42 + (rnd() - 0.5) * 0.15])
    const SQUAD = GATHER.map(([gx, gz], i) => {
      const sx = i ? THREE.MathUtils.clamp(gx * 2.2 + (rnd() - 0.5) * 0.8, -4.7, 4.7) : -4.3
      const sz = i ? THREE.MathUtils.clamp(gz * 1.9 + (rnd() - 0.5) * 0.6, -2.1, 2.1) : 2.1
      return {
        sx, sz, gx, gz, dist: Math.hypot(gx - sx, gz - sz),
        syaw: rnd() < 0.3 ? Math.PI + (rnd() - 0.5) : (rnd() - 0.5) * 2.4,
        gyaw: i ? Math.atan2(8 - gx, 14) * 0.6 : 0.25,
        rank: rnd(), ph: rnd() * TAU, sc: i ? 0.95 + rnd() * 0.1 : 1,
      }
    })
    // An original cup: a stepped foot, a slender stem with a knot, a tall flared bowl with a rolled lip,
    // a band round its waist and two loop handles. Gold, reflecting a painted stadium.
    const cupProfile = [[0, 0], [0.11, 0], [0.112, 0.018], [0.1, 0.026], [0.09, 0.026], [0.088, 0.05], [0.066, 0.06], [0.04, 0.075], [0.03, 0.1], [0.026, 0.17], [0.03, 0.19], [0.05, 0.2], [0.052, 0.215], [0.032, 0.228], [0.036, 0.245], [0.07, 0.28], [0.105, 0.34], [0.127, 0.41], [0.134, 0.465], [0.142, 0.478], [0.138, 0.49], [0.126, 0.484], [0.12, 0.45], [0.1, 0.37], [0.04, 0.3], [0, 0.29]]
    const cupG = mergeGeometries([
      new THREE.LatheGeometry(cupProfile.map(([r, y]) => new THREE.Vector2(r, y)), 48),
      new THREE.TorusGeometry(0.108, 0.008, 6, 48).rotateX(Math.PI / 2).translate(0, 0.345, 0),
      new THREE.TorusGeometry(0.07, 0.011, 8, 24, Math.PI).rotateZ(-Math.PI / 2).translate(0.12, 0.4, 0),
      new THREE.TorusGeometry(0.07, 0.011, 8, 24, Math.PI).rotateZ(Math.PI / 2).translate(-0.12, 0.4, 0),
    ])
    const envTex = canvasTexture(512, 256, g => {
      const gr = g.createLinearGradient(0, 0, 0, 256)
      gr.addColorStop(0, '#0a0a10'); gr.addColorStop(0.3, '#3a3530'); gr.addColorStop(0.42, '#6a6e7a'); gr.addColorStop(0.5, '#4a4a4c'); gr.addColorStop(0.53, '#2a2c22'); gr.addColorStop(1, '#16180f')
      g.fillStyle = gr
      g.fillRect(0, 0, 512, 256)
      for (let i = 0; i < 2500; i++) {
        g.fillStyle = ['#8fbde8', '#f2f4f8', '#1a2238'][i % 3]
        g.fillRect(rnd() * 512, 96 + rnd() * 30, 2, 2)
      }
      for (let i = 0; i < 40; i++) {
        const x = (i + 0.5) * 12.8, y = 58 + Math.sin(i * 1.3) * 3, r = g.createRadialGradient(x, y, 0, x, y, 8)
        r.addColorStop(0, '#ffffff'); r.addColorStop(1, 'rgba(255,240,210,0)')
        g.fillStyle = r
        g.fillRect(x - 8, y - 8, 16, 16)
      }
    })
    envTex.mapping = THREE.EquirectangularReflectionMapping
    const cup = add(new THREE.Mesh(cupG, new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(1, 0.86, 0.5, THREE.LinearSRGBColorSpace), metalness: 1, roughness: 0.22, envMap: envTex, envMapIntensity: 1.8 })), false)
    cup.scale.setScalar(1.65) // a touch heroic, so it reads from the cinema's seats
    // A glint on its lip and a star across it, once it is up.
    const glintP = new THREE.InstancedBufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage)
    const glintG = instanced(QUAD, 2, { iS: [new Float32Array([0.9, 0.9, 0, 0.3, 7, 0.09, 1, 0.6]), 4], iC: [new Float32Array([1.6, 1.3, 0.8, 0.7, 0.6, 0.45]), 3] })
    glintG.setAttribute('iP', glintP)
    const glint = { value: 0 }
    add(new THREE.Mesh(glintG, additive(GLOW_VS, GLOW_FS, { uT: U.t, uGlow: glint })))
    // Soft contact shadows under everyone on the stage and him, and a long one away from the key light.
    const blobTex = canvasTexture(64, 64, g => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      r.addColorStop(0, 'rgba(0,0,0,0.6)'); r.addColorStop(0.6, 'rgba(0,0,0,0.25)'); r.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = r
      g.fillRect(0, 0, 64, 64)
    })
    const blobMat = o => new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: o, polygonOffset: true, polygonOffsetFactor: -2, color: '#000000' })
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const blobs = add(new THREE.InstancedMesh(flat, blobMat(1), NS + 1), false), longs = add(new THREE.InstancedMesh(flat, blobMat(0.45), NS + 1), false)
    blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    longs.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const SHADE = new THREE.Vector2(-0.5, -0.87) // away from the key light, on the ground
    const shadowAt = (i, x, y, z, k) => {
      blobs.setMatrixAt(i, _m.compose(_v.set(x, y + 0.012, z), _q.identity(), _s.set(0.85 * k, 1, 0.85 * k)))
      longs.setMatrixAt(i, _m.compose(_v.set(x + SHADE.x * 1.05, y + 0.01, z + SHADE.y * 1.05), _q.setFromAxisAngle(Y, Math.atan2(SHADE.x, SHADE.y)), _s.set(0.5 * k, 1, 2.3)))
    }
    shadowAt(NS, HIM.x, 0, HIM.z, 1)
    await step()

    // ------------------------------------------------------------ the celebration: confetti, streamers, sparks, fireworks
    const NCf = mobile ? 3200 : 7000, NSt = mobile ? 110 : 240
    const rand4 = n => Float32Array.from({ length: n * 4 }, rnd)
    const RAIN = { uBox: { value: new THREE.Vector3(SX + 2, 0, 31) }, uSize: { value: new THREE.Vector3(34, 20, 26) }, uCan: { value: new THREE.Vector3(SX, SH + 0.3, SZ) }, uL: { value: LIGHT } }
    // Shot from four cannons at the stage's corners as the cup goes up, arcing up and out to where each
    // piece then rains from, tumbling: gold, sky blue and white, catching the floodlight.
    const BURST = /* glsl */ `
      uniform float uT, uP; uniform vec3 uBox, uSize, uCan, uL; attribute vec4 iR; varying vec3 vC;
      ${ROT}
      vec3 burst(float fall, float spread, float delay, out float k) {
        vec3 r = iR.xyz; float w = iR.w, H = uSize.y;
        float y = mod(r.y * H - uT * fall * (0.6 + 0.6 * r.x), H);
        vec3 rain = vec3(uBox.x + (r.x - 0.5) * uSize.x * spread + sin(uT * (0.5 + r.z) + w * 30.0) * 0.5, y, uBox.z + (r.z - 0.5) * uSize.z * spread + cos(uT * (0.4 + r.x) + w * 20.0) * 0.5);
        k = clamp((uP - ${LIFT.toFixed(3)} - delay - w * 0.03) / 0.07, 0.0, 1.0);
        float ci = floor(fract(w * 3.1) * 4.0);
        vec3 c = mix(uCan + vec3((mod(ci, 2.0) - 0.5) * 11.0, 0.0, (floor(ci / 2.0) - 0.5) * 5.0), rain, 1.0 - (1.0 - k) * (1.0 - k));
        c.y += 4.0 * k * (1.0 - k) * (9.0 + 9.0 * r.y);
        return c;
      }`
    add(new THREE.Mesh(instanced(QUAD, NCf, { iR: [rand4(NCf), 4] }), new THREE.ShaderMaterial({
      uniforms: { ...fogU(), uT: U.t, uP: U.p, ...RAIN },
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        ${BURST}
        void main() {
          float k;
          vec3 c = burst(0.75, 1.0, 0.0, k), r = iR.xyz; float w = iR.w;
          vec4 mc = viewMatrix * vec4(c, 1.0);
          float s = step(0.0001, k) * smoothstep(0.05, 0.5, c.y) * smoothstep(uSize.y, uSize.y - 3.0, c.y) * smoothstep(2.0, 5.0, -mc.z);
          vec3 ax = normalize(r - 0.5 + 0.001);
          float a = uT * (2.5 + 4.0 * r.z) + w * 40.0;
          vec3 n = turn(vec3(0.0, 0.0, 1.0), ax, a);
          vec4 mvPosition = viewMatrix * vec4(c + turn(vec3(position.x * 0.05, position.y * 0.032, 0.0) * s, ax, a), 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float pick = fract(w * 7.3);
          vec3 col = pick < 0.45 ? vec3(1.0, 0.76, 0.34) : pick < 0.75 ? vec3(0.45, 0.69, 0.91) : vec3(0.96);
          float spec = pow(abs(dot(n, normalize(uL + normalize(cameraPosition - c)))), 28.0);
          vC = col * (0.3 + 0.75 * abs(dot(n, uL))) + spec * (pick < 0.45 ? 3.5 : 1.6);
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC;
        #include <common>
        #include <fog_pars_fragment>
        void main() { gl_FragColor = vec4(vC, 1.0);
        #include <fog_fragment>
        }`,
    })))
    // Gold streamers: long ribbons from the same cannons, twisting as they fall.
    add(new THREE.Mesh(instanced(new THREE.PlaneGeometry(1, 1, 1, 12), NSt, { iR: [rand4(NSt), 4] }), new THREE.ShaderMaterial({
      uniforms: { ...fogU(), uT: U.t, uP: U.p, ...RAIN },
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        ${BURST}
        void main() {
          float k;
          vec3 head = burst(1.0, 0.8, 0.004, k), r = iR.xyz; float w = iR.w;
          float v = position.y + 0.5, a = v * 7.0 + uT * (2.0 + r.z * 2.0) + w * 50.0;
          float s = step(0.0001, k) * smoothstep(0.3, 1.2, head.y) * smoothstep(uSize.y, uSize.y - 3.0, head.y);
          vec3 side = vec3(cos(a), 0.0, sin(a)), n = vec3(-sin(a), 0.0, cos(a));
          vec3 c = head + (vec3(sin(v * 4.0 + uT * 1.7 + w * 20.0) * 0.22, v * 1.6, cos(v * 3.0 + uT * 1.3 + w * 9.0) * 0.22) + side * position.x * 0.05) * s;
          vec4 mvPosition = viewMatrix * vec4(c, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float spec = pow(abs(dot(n, normalize(uL + normalize(cameraPosition - c)))), 24.0);
          vC = vec3(1.0, 0.74, 0.32) * (0.35 + 0.65 * abs(dot(n, uL))) + vec3(1.0, 0.92, 0.7) * spec * 3.0;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC;
        #include <common>
        #include <fog_pars_fragment>
        void main() { gl_FragColor = vec4(vC, 1.0);
        #include <fog_fragment>
        }`,
    })))
    // Cold-spark fountains at the stage's corners and along its back.
    const FOUNT = [[-5.3, 2.4], [5.8, 2.4], [-4.2, -2.6], [-1.4, -2.6], [1.6, -2.6], [4.6, -2.6]], PS = mobile ? 90 : 170
    const spB = new Float32Array(FOUNT.length * PS * 4), spD = new Float32Array(FOUNT.length * PS * 4)
    FOUNT.forEach(([fx, fz], f) => {
      for (let j = 0; j < PS; j++) {
        const i = f * PS + j, a = rnd() * TAU, tilt = rnd() * 0.22
        spB.set([SX + fx, SH, SZ + fz, rnd()], i * 4)
        spD.set([Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a), 5.5 + rnd() * 2.5], i * 4)
      }
    })
    add(new THREE.Mesh(instanced(QUAD, FOUNT.length * PS, { iB: [spB, 4], iD: [spD, 4] }), additive(/* glsl */ `
      attribute vec4 iB; attribute vec4 iD; uniform float uT, uSpark; varying vec2 vQ; varying vec3 vC;
      ${HASH}
      void main() {
        float life = 1.0 + 0.4 * h1(iB.w * 5.0), a = mod(uT + iB.w * 7.0, life);
        vec3 c = iB.xyz + iD.xyz * iD.w * a + vec3(0.0, -4.9 * a * a, 0.0);
        float fade = (1.0 - a / life) * uSpark * step(${(SH + 0.02).toFixed(2)}, c.y);
        vec4 mv = modelViewMatrix * vec4(c, 1.0);
        mv.xy += position.xy * max(0.04, -mv.z * 0.0016) * step(0.004, fade);
        vQ = position.xy; vC = vec3(1.0, 0.8, 0.48) * 3.0 * fade;
        gl_Position = projectionMatrix * mv;
      }`, SOFT_FS, { uT: U.t, uSpark: U.spark })))
    // Fireworks over the roof, most over the far half where the camera looks: each burst blooms, sags and
    // crackles out on its own cycle.
    const NB = mobile ? 7 : 12, PB = mobile ? 140 : 240
    const fwB = new Float32Array(NB * PB * 4), fwD = new Float32Array(NB * PB * 4), fwC = new Float32Array(NB * PB * 3)
    const PAL = [[1, 0.78, 0.38], [1, 1, 1], [0.55, 0.78, 1], [1, 0.62, 0.3], [0.85, 0.82, 1]]
    for (let b = 0; b < NB; b++) {
      const f = rimAt(rnd() * perimeter(50), 38 + rnd() * 26), bz = b < NB * 0.75 ? -Math.abs(f.z) : f.z, by = 56 + rnd() * 26, bs = rnd()
      for (let j = 0; j < PB; j++) {
        const i = b * PB + j, u = rnd() * 2 - 1, th = rnd() * TAU, r = Math.sqrt(1 - u * u)
        fwB.set([f.x, by, bz, bs], i * 4)
        fwD.set([r * Math.cos(th), u, r * Math.sin(th), 0.85 + rnd() * 0.15], i * 4)
        fwC.set(PAL[(b + (j % 5 ? 0 : 2)) % PAL.length], i * 3)
      }
    }
    add(new THREE.Mesh(instanced(QUAD, NB * PB, { iB: [fwB, 4], iD: [fwD, 4], iC: [fwC, 3] }), additive(/* glsl */ `
      attribute vec4 iB; attribute vec4 iD; attribute vec3 iC; uniform float uT, uFire; varying vec2 vQ; varying vec3 vC;
      ${HASH}
      void main() {
        float per = 3.0 + h1(iB.w * 7.0) * 2.0, a = mod(uT + iB.w * 17.0, per), life = 2.3;
        vec3 c = iB.xyz + iD.xyz * (11.0 + h1(iB.w * 3.0) * 8.0) * iD.w * (1.0 - exp(-3.2 * a)) + vec3(0.0, -1.4 * a * a, 0.0);
        float fade = (1.0 - smoothstep(0.5, life, a)) * step(a, life) * uFire;
        fade *= a > 1.1 ? 0.45 + 0.55 * step(0.4, h1(floor(uT * 18.0) + iD.x * 311.0)) : 1.0;
        vec4 mv = modelViewMatrix * vec4(c, 1.0);
        mv.xy += position.xy * max(0.2, -mv.z * 0.0038) * (1.0 + 2.5 * exp(-a * 10.0)) * step(0.004, fade);
        vQ = position.xy; vC = iC * fade * (2.0 + 4.0 * exp(-a * 8.0));
        gl_Position = projectionMatrix * mv;
      }`, SOFT_FS, { uT: U.t, uFire: U.fire })))
    await step()

    // ------------------------------------------------------------ light: a warm key from the near roof, a cool back light, the cup's own glow
    const hemi = new THREE.HemisphereLight('#aab8dc', '#35552e', 1.3)
    const key = new THREE.DirectionalLight('#fff1dc', 2.6)
    key.position.set(40, 60, 70)
    key.target.position.set(0, 0, 25)
    const back = new THREE.DirectionalLight('#d4e2ff', 2.0)
    back.position.set(-30, 45, -60)
    back.target.position.set(0, 0, 25)
    const cupLight = new THREE.PointLight('#ffd08a', 0, 9, 2)
    scene.add(hemi, key, key.target, back, back.target, cupLight)

    // ------------------------------------------------------------ him, pitch-side in a sky-blue and white scarf
    let you = null, cue = ''
    const faceStage = Math.atan2(SX - HIM.x, SZ - HIM.z)
    const out = { here: HIM.clone(), dream: 0 }
    loadTraveller(loader).then(t => {
      you = t.make({ look: 'pbr' })
      you.root.traverse(o => { if (o.isSkinnedMesh) o.material.map = alohaLinear() })
      you.root.position.copy(HIM)
      you.root.rotation.y = faceStage
      you.root.updateMatrixWorld(true)
      // The scarf: a striped band round his neck, one end down his chest and one down his back. It is
      // made upright in his own frame, then hung on the neck bone so it follows him.
      const stripes = canvasTexture(16, 64, g => {
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2f4f8' : '#74b0e8'; g.fillRect(0, i * 8, 16, 8) }
      })
      const scarfMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.9 })
      const scarf = new THREE.Group()
      scarf.add(
        new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.026, 6, 18).rotateX(Math.PI / 2).scale(1, 1, 0.9), scarfMat),
        new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.014).translate(0.03, -0.19, 0.085).rotateX(-0.12), scarfMat),
        new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.014).translate(-0.03, -0.2, -0.1).rotateX(0.12), scarfMat),
      )
      const neck = you.bone('neck')
      neck.updateWorldMatrix(true, false)
      neck.getWorldQuaternion(_q).invert()
      const pivot = holdIn(neck, new THREE.Group())
      pivot.quaternion.copy(_q).multiply(you.root.getWorldQuaternion(new THREE.Quaternion()))
      scarf.position.y = -0.02
      pivot.add(scarf)
      scene.add(you.root)
      out.here = you.root.position
    })

    // ------------------------------------------------------------ each frame
    const cam = new THREE.Vector3(), look = new THREE.Vector3(), handA = new THREE.Vector3(), handB = new THREE.Vector3()
    let lastT = null, lastP = -1, movedAt = -1, moving = 0
    run = (state, t, aspect) => {
      const p = state.p, portrait = !!state.portrait, still = !!state.still
      const dt = lastT === null ? 0 : THREE.MathUtils.clamp(t - lastT, 0, 0.1)
      lastT = t
      if (Math.abs(p - lastP) > 1e-5) movedAt = t
      lastP = p
      moving += ((t - movedAt < 0.25 ? 1 : 0) - moving) * Math.min(1, dt * 5)

      track(portrait ? TALL : WIDE, p, cam, look)
      camera.aspect = aspect
      camera.updateProjectionMatrix()
      // A hand on the camera, stilled for the last shot so it matches the one on the cinema's screen.
      const sway = still ? 0 : 1 - ss(0.84, 0.95, p)
      camera.position.set(cam.x + Math.sin(t * 0.7) * 0.05 * sway, cam.y + Math.sin(t * 1.3) * 0.03 * sway, cam.z)
      camera.lookAt(look)
      if (sway > 0) {
        camera.rotateZ(Math.sin(t * 0.61) * 0.004 * sway)
        camera.rotateX(Math.sin(t * 1.1) * 0.003 * sway)
      }
      dome.position.copy(camera.position)
      dome.updateMatrix()

      // The bowl's mood: cheering, a wave round the stands, a hush as they crouch, then it goes up.
      const lift = ss(LIFT - 0.012, LIFT + 0.02, p)
      U.t.value = t
      U.p.value = p
      U.excite.value = 0.62 - 0.1 * ss(0.1, 0.3, p) - 0.17 * ss(0.45, 0.56, p) + 0.75 * lift
      U.wave.value = ss(0.12, 0.2, p) * (1 - ss(0.4, 0.47, p))
      U.stunt.value = 1 - ss(LIFT - 0.005, LIFT + 0.04, p)
      U.lift.value = lift
      U.fire.value = ss(LIFT, LIFT + 0.03, p)
      U.spark.value = ss(LIFT - 0.005, LIFT + 0.01, p) * (1 - 0.6 * ss(0.8, 0.9, p))
      U.rate.value = 0.07 + 0.25 * (1 - ss(0.02, 0.14, p)) + 0.04 * lift

      // The squad: spread out and waving, then piling in round the lifter, crouching low together, and
      // up as the cup goes up, jumping as one.
      const crouch = ss(0.47, 0.56, p) * (1 - ss(LIFT - 0.015, LIFT + 0.015, p))
      const party = ss(LIFT, LIFT + 0.04, p)
      for (let i = 0; i < NS; i++) {
        const P = SQUAD[i]
        const k = i ? ss(0.27 + P.rank * 0.1, 0.4 + P.rank * 0.06, p) : ss(0.36, 0.5, p)
        const walk = 4 * k * (1 - k) * moving
        const stride = ((k * P.dist) / 0.65) * Math.PI, sw = Math.sin(stride)
        const w1 = Math.max(0, Math.sin(t * (2.6 + P.ph * 0.2) + P.ph * 5)), w2 = Math.max(0, Math.sin(t * (2.3 + P.ph * 0.2) + P.ph * 3 + 1.7))
        let rl, rr, sp
        if (i) {
          rl = lerp(0.6 + 0.38 * w1, lerp(0.3 + 0.12 * w1, 0.2, crouch), k) // gathered: arms half up, bouncing; crouched: hands to the knees
          rr = lerp(0.6 + 0.38 * w2, lerp(0.3 + 0.12 * w2, 0.2, crouch), k)
          sp = lerp(0.35, lerp(0.45, 0.18, crouch), k)
          rl = lerp(rl, 0.08 - 0.12 * sw, walk)
          rr = lerp(rr, 0.08 + 0.12 * sw, walk)
          sp = lerp(sp, 0.1, walk)
        } else {
          rl = rr = lerp(0.36, 0.3, crouch) // the cup held at his chest
          sp = 0.06
        }
        const hopNow = Math.abs(Math.sin(Math.PI * (t * 1.45 + P.ph * 0.012)))
        rl = lerp(rl, i ? 0.95 + 0.04 * hopNow : 1, lift)
        rr = lerp(rr, i ? 0.95 + 0.04 * hopNow : 1, lift)
        sp = lerp(sp, i ? 0.3 : 0.05, lift)
        const th = 0.85 * crouch + 0.4 * (1 - hopNow) ** 3 * party
        const hipL = 0.45 * sw * walk + th, hipR = -0.45 * sw * walk + th
        const kneeL = 2 * th + Math.max(0, Math.sin(stride + 0.5)) * 0.7 * walk, kneeR = 2 * th + Math.max(0, Math.sin(stride + 0.5 + Math.PI)) * 0.7 * walk
        const lean = 0.7 * th + 0.04
        const hop = i ? 0.1 * w1 ** 4 * (1 - k) : 0
        const y = SH + hop + 0.45 * hopNow * party - 0.92 * (1 - Math.cos(th)) * P.sc
        const x = SX + lerp(P.sx, P.gx, k), z = SZ + lerp(P.sz, P.gz, k)
        let yaw = THREE.MathUtils.lerp(P.syaw + Math.sin(t * 0.5 + P.ph) * 0.3 * (1 - k), P.gyaw, ss(0.2, 0.9, k))
        if (walk > 0.01) {
          const head = Math.atan2(P.gx - P.sx, P.gz - P.sz)
          yaw += (((head - yaw + Math.PI * 3) % TAU) - Math.PI) * Math.min(1, walk * 2)
        }
        armA.setXYZW(i, rl, rr, sp, lean)
        legA.setXYZW(i, hipL, kneeL, hipR, kneeR)
        _m.compose(_v.set(x, y, z), _q.setFromAxisAngle(Y, yaw), _s.setScalar(P.sc))
        squad.setMatrixAt(i, _m)
        shadowAt(i, x, SH, z, 1 - 0.35 * (y - SH))
        if (!i) {
          // The cup, between his hands, upright.
          handOf(1, rl, sp, lean, _m, handA)
          handOf(-1, rr, sp, lean, _m, handB)
          cup.position.addVectors(handA, handB).multiplyScalar(0.5)
          cup.position.y -= 0.2
          cup.rotation.y = yaw
          cup.updateMatrix()
        }
      }
      armA.needsUpdate = legA.needsUpdate = squad.instanceMatrix.needsUpdate = true
      blobs.instanceMatrix.needsUpdate = longs.instanceMatrix.needsUpdate = true
      const shine = 0.35 + 0.65 * lift
      cupLight.position.set(cup.position.x, cup.position.y + 0.6, cup.position.z + 0.7)
      cupLight.intensity = 5 * shine
      glint.value = lift * (0.75 + 0.25 * Math.sin(t * 2.3))
      glintP.setXYZ(0, cup.position.x + 0.12, cup.position.y + 0.68, cup.position.z + 0.08)
      glintP.setXYZ(1, cup.position.x, cup.position.y + 0.55, cup.position.z + 0.1)
      glintP.needsUpdate = true

      // Him: cheering with the stands, still as they crouch, and jumping with them once it is up.
      if (you) {
        const next = p < 0.45 ? 'Cheer_with_Both_Hands_Up' : p < LIFT ? 'Idle' : 'happy_jump_m'
        if (next !== cue) you.play((cue = next), { fade: 0.35 })
        you.mixer.update(dt)
      }
      out.dream = 0.35 * ss(LIFT, LIFT + 0.02, p) * (1 - ss(LIFT + 0.05, LIFT + 0.15, p))
      return out
    }
  })()

  return { scene, camera, update: (state, t, aspect) => (run ? run(state, t, aspect) : hold(state, aspect)), get built() { return !!run } }
}
