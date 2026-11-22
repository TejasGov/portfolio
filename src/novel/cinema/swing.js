import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loadTraveller, alohaLinear, wearSuit } from './films/kit'

/*
 * Chapter Five, world 1: the swing (Spider-Man, a fan's tribute). Golden hour over Midtown: the Empire
 * State Building (its limestone setbacks, piers and aluminium window columns, the stepped crown and the
 * mast), a sea of towers with water tanks on their roofs, the rivers and the far shores in haze, birds
 * round a copper dome on a nearby roof. He crouches on the dome's finial in his own clothes; he leaps,
 * falls head-down in a slow inverted shot while the red-and-blue suit spreads over him from the chest,
 * flips upright, fires a web and swings west down an avenue into the setting sun, four pendulum arcs,
 * the light going from gold to dusk, and his last swing throws him toward the landmark tower far ahead.
 * Everything is procedural except his suit (public/cinema/suits/spider.glb, worn with kit.wearSuit).
 * Beats in p (all a pure function of p and t, so it scrubs both ways):
 *   0     .17   the perch: a deep crouch on the finial, one hand down; birds wheel; the pointer tilts the camera
 *   .17   .25   the leap: a dip, a rise, and he tips over backward to head-down
 *   .25   .40   the leap of faith: the camera rolls over, the city hangs from the top of the frame; the
 *               suit spreads from his chest over his clothes (.255 - .375)
 *   .40   .43   he flips upright and fires the first web
 *   .43   .905  four swings down the avenue (a flip between the second and third)
 *   .905  1     the last release: thrown toward the landmark tower; the WHIP cover takes it from .945
 *
 * CONTRACT (world.js, timeline.js and movies.js rely on it; do not change the export or its signature)
 *   export function createSwing(renderer, { loader, normalize, mobile }) -> { scene, camera, update, built }
 *     loader: the shared GLTFLoader (Meshopt + Draco). normalize(root, size, yaw): a model's meshes as
 *     one centred group scaled to `size` metres. mobile: phone-sized screen, build lighter.
 *   update(state, t, aspect) is called once per rendered frame while this world is drawn.
 *     state.p         0..1, this world's own progress (movies.js: Five's P 0.0276..0.2366, 500 svh of
 *                     scroll), driven by scroll: it scrubs both ways and can jump, so derive everything
 *                     from p and t and keep no one-way state. p 0..0.945 is seen clear; the WHIP cover
 *                     (a fast pan, warm to night) rolls in over p 0.945..1, whole at p = 1, so the last
 *                     swing should be carrying him toward the landmark tower by then. The suit-up must
 *                     be scroll-driven and reversible: a pure function of p.
 *     state.onScreen  true while this world is drawn onto the cinema's screen: Five's push-in, at p = 0
 *                     (aspect is then the screen's 2.4). The p = 0 shot on the screen and full-frame must
 *                     be the same picture, or the hand-over at the end of the push jumps: no DOM-only or
 *                     frame-locked HUD, and the pointer parallax eased to nothing on the screen.
 *     state.still     reduced motion: no camera flourishes, shake or pointer parallax; the suit-up shows
 *                     its finished state (the leap and the swings still follow p).
 *     state.portrait  the frame is a phone's (aspect < 0.85): frame for it. Decide framing from this,
 *                     not from `aspect`: on the cinema's screen `aspect` is 2.4 and a phone sees only
 *                     the middle of that picture.
 *     state.mobile    same as the option. state.cover: 0..1, how much a transition hides the frame
 *                     (kind 'whip' | null, phase 0..1): skip work the cover hides.
 *     state.pointer   the eased pointer (a Vector2, x right and y up, each -1..1; read-only, the same
 *                     object every frame) for the perch's parallax: ease the camera with it, a subtle
 *                     3D feel. Ignore it when still or onScreen. On touch it follows a dragging finger.
 *     t               seconds, monotonic. aspect: width / height of what is being drawn; set
 *                     camera.aspect from it.
 *     Returns { here, dream, grade? }: here = a Vector3 at the traveller (world space; the same object
 *     every frame is fine); dream = 0..1 extra bloom for a held beat (0 otherwise); grade = optional
 *     overrides of GRADE.swing in movies.js ({ bloom, threshold, vignette, grain, scan }).
 *   Units: metres, y up, the street at y = 0, the traveller 1.72 m tall. Camera: a PerspectiveCamera with
 *   a 40 degree vertical fov (the hall's lens, so the push-in does not jump; it opens to 58 once he is on the web).
 *   Colour: the frame has no sRGB encode after tone mapping, so a hex colour reads darker and richer
 *   than on a page, and a painted canvas texture reads as painted with colorSpace NoColorSpace.
 *   Build in steps: build the set a piece at a time, yielding (await a timeout) whenever a step has run
 *   ~4 ms, and report `built` false until it is whole; until then update() only places the camera
 *   (world.js keeps the world off screen and compiles it once it is whole).
 *   Budget: the whole frame is about 5.6 ms on the desktop GPU today; keep this scene within that:
 *   at most ~150 draw calls and ~400k triangles in view (instance repeats), one shadow-casting light
 *   (2048 map, 1024 on mobile), textures at most 2048 px (a suit's base colour; 1024 for other maps), new
 *   GLBs under ~6 MB in all, no allocation or geometry rebuilds in update().
 *   world.prepare() builds this while the reader is paused late in Chapter Four, then compiles it, draws
 *   it once at p = 0 and once into the cinema screen's target: anything hidden then (visible = false) is
 *   skipped and would compile mid-scroll, so keep things that appear later in the scene, scaled to
 *   nothing, and add late-loading models to `scene` (prepare compiles again when the scene grows).
 *   GPU memory: Stage.jsx may release this world while the reader is two worlds away (world.release:
 *   its geometries, textures, materials and shadow maps are disposed, the objects kept) and prepare it
 *   again on approach: keep every GPU resource reachable from `scene` (no render targets of its own
 *   unless they are rebuilt on use), and never dispose anything yourself.
 */
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const lerp = THREE.MathUtils.lerp
const clamp01 = x => Math.min(1, Math.max(0, x))
const PI = Math.PI
let seed = 11
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

// ---------------------------------------------------------------- the map (x east, z south, metres)
// The Empire State Building stands at the origin, its long side along z. The grid is laid square to it.
// The perch: a limestone tower south-west of it, its copper dome's finial tip at D. The avenue he swings
// down runs along x at z = AV, west toward the setting sun (which sets a little south of its axis) and
// the landmark tower at its far end.
const D = new THREE.Vector3(-420, 226.5, 270)
const PERCH = { x: -420, z: 270, w: 34, roof: 205 }
const AV = 330, AVH = 22 // the avenue's centre line and half width (its frontages stand on AV +- AVH)
const TOWER = new THREE.Vector3(-2000, 0, 250) // the landmark (dive.js's tower), seen far off, its roof at 180
const F = new THREE.Vector3(0.12, 0, 0.99).normalize() // the way he faces on the perch (south, toward the avenue; the lens sees him in profile, from his right)
const FWD = new THREE.Vector3(-1, 0, 0) // down the avenue
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0)
const SUN_H = new THREE.Vector3(-0.951, 0, 0.309) // the sun's bearing (nearly down the avenue from the west: it rakes the avenue's north wall)

/** A smooth curve through keys [p, ...values], unevenly spaced in p (cubic Hermite, Catmull-Rom slopes). */
function keyed(keys) {
  const n = keys[0].length - 1, last = keys.length - 1
  const slope = (i, j) => {
    const a = keys[Math.max(0, i - 1)], c = keys[Math.min(last, i + 1)]
    return (c[j] - a[j]) / (c[0] - a[0])
  }
  return (p, out) => {
    let i = -1
    if (p >= keys[last][0]) i = last
    else if (p > keys[0][0]) for (i = last - 1; i > 0 && keys[i][0] > p; i--);
    if (i < 0 || i === last) {
      for (let j = 0; j < n; j++) out[j] = keys[Math.max(0, i)][j + 1]
      return out
    }
    const k1 = keys[i], k2 = keys[i + 1], h = k2[0] - k1[0], s = (p - k1[0]) / h
    const s2 = s * s, s3 = s2 * s
    for (let j = 1; j <= n; j++) {
      const d = (k2[j] - k1[j]) / h
      let m1 = slope(i, j), m2 = slope(i + 1, j)
      if (d === 0 || m1 * d < 0) m1 = 0
      if (d === 0 || m2 * d < 0) m2 = 0
      out[j - 1] = (2 * s3 - 3 * s2 + 1) * k1[j] + (s3 - 2 * s2 + s) * h * m1 + (-2 * s3 + 3 * s2) * k2[j] + (s3 - s2) * h * m2
    }
    return out
  }
}

// ---------------------------------------------------------------- the swings
// Each arc: a pendulum about its anchor (on a frontage, s = -1 north / +1 south), from angle a to b
// (radians from straight down, + ahead), its length L; between arcs a ballistic hop of (fwd, up) metres.
// (low in the canyon: each arc bottoms out some 20-25 m over the street, so the street rushes past)
const ARCS = [
  { p0: 0.43, p1: 0.52, L: 60, a: -0.85, b: 0.75, s: -1, hop: [40, 8] },
  { p0: 0.56, p1: 0.655, L: 64, a: -0.95, b: 0.8, s: 1, hop: [50, 6], flip: true },
  { p0: 0.705, p1: 0.795, L: 62, a: -0.9, b: 0.85, s: -1, hop: [35, 5] },
  { p0: 0.83, p1: 0.905, L: 75, a: -0.95, b: 1.0, s: 1, hop: [110, 25] },
]
const S1 = new THREE.Vector3(-455, 46.4, AV) // where the first web catches him
{
  let s = S1.clone()
  for (const a of ARCS) {
    a.S = s.clone()
    a.A = s.clone().addScaledVector(FWD, -a.L * Math.sin(a.a)).addScaledVector(Y, a.L * Math.cos(a.a)) // its anchor
    a.R = a.A.clone().addScaledVector(FWD, a.L * Math.sin(a.b)).addScaledVector(Y, -a.L * Math.cos(a.b)) // the release
    a.W = new THREE.Vector3(a.A.x, a.A.y, AV + a.s * (AVH - 0.3)) // the web's end, on the frontage's face
    s = a.R.clone().addScaledVector(FWD, a.hop[0]).addScaledVector(Y, a.hop[1])
  }
  ARCS.END = s
}
const ease = u => 0.55 * u + 0.45 * u * u * (3 - 2 * u)
const dEase = u => 0.55 + 0.45 * 6 * u * (1 - u)
/** His hips on arc i at its own u (0..1), and the velocity there per unit of p. */
function onArc(a, u, out, vel) {
  const th = lerp(a.a, a.b, ease(u))
  out.copy(a.A).addScaledVector(FWD, a.L * Math.sin(th)).addScaledVector(Y, -a.L * Math.cos(th))
  out.z = AV + a.s * 7 * Math.sin(PI * u) ** 2 // toward his anchor's side at the bottom of the arc
  if (vel) {
    const w = ((a.b - a.a) * dEase(u)) / (a.p1 - a.p0)
    vel.copy(FWD).multiplyScalar(a.L * w * Math.cos(th)).addScaledVector(Y, a.L * w * Math.sin(th))
  }
  return out
}
const _v0 = new THREE.Vector3(), _v1 = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3()
/** The hop after arc i (to the next arc, or the last long throw): a cubic between release and catch. */
function onHop(i, p, out) {
  const a = ARCS[i], n = ARCS[i + 1]
  const q0 = a.p1, q1 = n ? n.p0 : 1, h = q1 - q0, s = (p - q0) / h
  onArc(a, 1, _a, _v0)
  if (n) onArc(n, 0, _b, _v1)
  else _b.copy(ARCS.END), _v1.copy(FWD).multiplyScalar(1100).addScaledVector(Y, 60)
  const s2 = s * s, s3 = s2 * s
  out.copy(_a).multiplyScalar(2 * s3 - 3 * s2 + 1).addScaledVector(_v0, (s3 - 2 * s2 + s) * h).addScaledVector(_b, -2 * s3 + 3 * s2).addScaledVector(_v1, (s3 - s2) * h)
  out.z = AV
  return out
}

// The perch to the catch: the dip, the spring (over the camera), the fall in front of the perch tower's
// south face and out over the avenue. HP (his hips above the finial in the crouch) is measured at build.
const HP = new THREE.Vector3(0.05, 0.3, -0.12)
const fallKeys = () => {
  const k = (p, f, y, extra) => [p, ...D.clone().addScaledVector(F, f).add(HP.clone().multiplyScalar(1 - extra)).setY(D.y + HP.y * (1 - extra) + y).toArray()]
  return keyed([
    k(0.17, 0, 0, 0), k(0.185, 0, -0.14, 0), k(0.205, 1.6, 1.2, 1), k(0.23, 7, -0.6, 1), k(0.27, 20, -25, 1), k(0.32, 29, -70, 1), k(0.37, 33, -125, 1),
    [0.4, -445, 72, AV - 18], [0.43, S1.x, S1.y, S1.z], [0.44, ...onArc(ARCS[0], 0.01 / 0.09, new THREE.Vector3()).toArray()],
  ])
}
let FALL = fallKeys()
const K3 = [0, 0, 0]
/** His hips at p. */
function hipsAt(p, out) {
  if (p <= 0.17) return out.copy(D).add(HP)
  if (p < 0.43) return out.fromArray(FALL(p, K3))
  for (let i = 0; i < ARCS.length; i++) {
    const a = ARCS[i]
    if (p <= a.p1) return onArc(a, clamp01((p - a.p0) / (a.p1 - a.p0)), out)
    const q1 = ARCS[i + 1]?.p0 ?? 1
    if (p < q1) return onHop(i, p, out)
  }
  return onHop(ARCS.length - 1, 1, out)
}
// His body's pitch about his own x while he leaps and falls: he tips over backward (the leap of faith),
// head-down from .27, and carries the turn on round to upright by .43.
const PITCH = keyed([[0, 0], [0.185, 0], [0.205, -0.5], [0.23, -1.7], [0.27, -PI], [0.385, -PI], [0.43, -2 * PI]])

// ---------------------------------------------------------------- the camera
// Keys [p, rel, offset x y z, look x y z, roll]: offset and look are from D (rel 0) or from his hips
// (rel 1), in world axes. The perch: low and back, the ribbed dome across the bottom of the frame, him on
// its finial, the ESB beside him; the push in; he tips over backward; in front of him as he falls, rolled
// over; round behind as he flips upright. Then a tracking rig for each arc, 4-6 m off his shoulder
// (he swings due west, so world offsets ride with him), swooping under him at the bottom, and a pull
// back wide down the avenue at each release: over his left shoulder; high over his right, the street
// rushing below; low under him against the western sky; over his right shoulder into the sunset; the
// throw toward the tower.
const CAM = keyed([
  [0, 0, -8.1, -2.4, 2.5, -0.32, -0.5, -0.8, 0],
  [0.13, 0, -7.4, -2.2, 2.4, -0.25, -0.4, -0.7, 0],
  [0.17, 0, -6.6, -1.4, 2.4, 0.2, 0.2, -0.5, 0],
  [0.205, 0, -5.8, -1.0, 2.6, -0.9, 1.4, 1.2, 0],
  [0.222, 1, -0.6, -0.6, -4.0, 0, 0, 0, 0],
  [0.245, 1, 2.4, -0.4, -2.6, 0, 0, 0, 0.8],
  [0.265, 1, 3.0, 0.3, -1.4, 0, 0, 0, 1.9],
  [0.295, 1, 3.3, 0.3, 0.1, 0, 0.1, 0, PI],
  [0.385, 1, 3.0, 0.1, 1.1, 0, 0.15, 0, PI],
  [0.425, 1, 4.5, -0.3, 2.3, -4, 0.7, 0, 2 * PI],
  // on the web: 2.5-3 m off him, closest at the bottom of each arc; one wide at each release
  [0.445, 1, 2.5, 0.5, 1.45, -4.8, 0.2, -0.4, 2 * PI],
  [0.475, 1, 2.2, -0.45, 1.5, -4.8, 0.5, -0.4, 2 * PI],
  [0.51, 1, 2.6, 0.5, 1.65, -4.8, 0, -0.5, 2 * PI],
  [0.54, 1, 6, 1.1, 2.2, -7, 0.5, -1, 2 * PI],
  [0.57, 1, 2.5, 1.2, -1.45, -4.8, -0.9, -0.25, 2 * PI],
  [0.605, 1, 2.3, 0.8, -1.55, -4.8, -0.6, -0.25, 2 * PI],
  [0.645, 1, 2.75, 1.3, -1.65, -4.8, -0.9, -0.35, 2 * PI],
  [0.68, 1, 6, 1.1, -2.2, -7, 0.5, 1, 2 * PI],
  [0.715, 1, 2.3, -1.3, 1.3, -5.4, 1.7, -0.3, 2 * PI],
  [0.75, 1, 2.1, -1.1, 1.45, -5.4, 1.9, -0.3, 2 * PI],
  [0.785, 1, 2.5, -0.9, 1.55, -5.4, 1.45, -0.6, 2 * PI],
  [0.812, 1, 6, 1.1, 2.2, -7, 0.5, -1, 2 * PI],
  [0.84, 1, 2.75, 0.8, -1.3, -7, 0.1, 0.35, 2 * PI],
  [0.87, 1, 2.5, 0.1, -1.45, -7, 0.35, 0.35, 2 * PI],
  [0.9, 1, 3, 0.8, -1.55, -8, 0.5, 0.35, 2 * PI],
  [0.95, 1, 10, 2.5, -2, -40, 3, -1, 2 * PI],
  [1, 1, 13, 3, -1.5, -50, 4, -2, 2 * PI],
])
// A phone's: the perch from a little off the line to the ESB, so its crown stands beside him in the tall
// frame over the dome; on the web, closer and centred on him (a tall frame is narrow), the wides from
// right behind him, down the avenue into the western sky.
const CAMP = keyed([
  [0, 0, -8.1, -3.0, 3.9, -0.25, -0.35, -0.31, 0],
  [0.13, 0, -7.4, -2.7, 3.6, -0.2, -0.25, -0.3, 0],
  [0.17, 0, -5.6, -1.4, 3.0, 0.1, 0.2, -0.2, 0],
  [0.205, 0, -5.9, -0.6, 4.0, -0.9, 1.4, 1.2, 0],
  [0.222, 1, -1.2, -0.8, -5.2, 0, 0, 0, 0],
  [0.245, 1, 3.7, -0.6, -4.1, 0, -0.2, 0, 0.8],
  [0.265, 1, 4.7, 0.5, -2.2, 0, -0.3, 0, 1.9],
  [0.295, 1, 5.1, 0.5, 0.1, 0, -0.1, 0, PI],
  [0.385, 1, 3.9, 0.15, 1.4, 0, 0.15, 0, PI],
  [0.425, 1, 8.5, -0.5, 4.2, -2, 0.5, 0, 2 * PI],
  [0.445, 1, 3.8, 0.8, 2.0, -1.6, 0, -0.6, 2 * PI],
  [0.475, 1, 3.5, -0.6, 2.2, -1.6, 0.3, -0.6, 2 * PI],
  [0.51, 1, 4.0, 0.8, 2.4, -1.6, 0, -0.7, 2 * PI],
  [0.54, 1, 7.5, 0.6, 1, -3, 0.35, -0.4, 2 * PI],
  [0.556, 1, 1.2, 2.2, -4.0, 0.3, 0.1, 0.1, 2 * PI], // round his left side, not through him
  [0.57, 1, -4.2, 0.7, -2.0, 1.2, 0, 0.6, 2 * PI],
  [0.605, 1, -3.8, -0.6, -2.2, 1.2, 0.3, 0.6, 2 * PI],
  [0.645, 1, -4.4, 0.9, -2.4, 1.2, 0, 0.7, 2 * PI],
  [0.68, 1, 7.5, 0.6, -1, -3, 0.35, 0.4, 2 * PI],
  [0.715, 1, 3.4, -2.2, 1.8, -1.4, 0.9, -0.7, 2 * PI],
  [0.75, 1, 3.0, -1.8, 2.0, -1.4, 1.0, -0.7, 2 * PI],
  [0.785, 1, 3.6, -1.4, 2.2, -1.4, 0.8, -0.8, 2 * PI],
  [0.812, 1, 7.5, 0.6, 1, -3, 0.35, -0.4, 2 * PI],
  [0.84, 1, 4.5, 1.0, -0.5, -3, 0.4, 0.1, 2 * PI],
  [0.87, 1, 4.2, 0.3, -0.6, -3, 0.6, 0.1, 2 * PI],
  [0.9, 1, 4.8, 1.0, -0.7, -3.4, 0.5, 0.1, 2 * PI],
  [0.95, 1, 8, 2, -1.5, -10, 1.5, 0, 2 * PI],
  [1, 1, 11, 2.5, -1, -14, 2, -0.5, 2 * PI],
])
// The lens: the hall's 40 degrees until he is on the web, then 50, opening to 68 through each arc's low point.
const fovAt = (p, still) => {
  let f = 40 + 10 * ss(0.405, 0.44, p)
  if (!still) for (const a of ARCS) if (p > a.p0 && p < a.p1) f += 18 * Math.sin((PI * (p - a.p0)) / (a.p1 - a.p0)) ** 2
  return f
}
// A slow-motion hold at the top of each hop between swings: p is remapped so the scroll lingers there
// (slope 1 - k at the apex; the window's ends and slopes meet p's own, so nothing jumps).
const HOLD = [[0.54, 0.03], [0.68, 0.03], [0.8125, 0.025]]
const warp = p => {
  for (const [c, w] of HOLD) {
    const x = (p - c) / w
    if (x > -1 && x < 1) return c + w * (x - 0.375 * (Math.sin(PI * x) / PI + Math.sin(2 * PI * x) / (2 * PI)))
  }
  return p
}
{
  let last = -1
  for (let i = 0; i <= 1000; i++) { const q = warp(i / 1000); console.assert(q >= last - 1e-9, 'swing: warp is monotone'); last = q }
}

// ---------------------------------------------------------------- the poses
// Each a set of limb directions in his own frame (he faces +z, his left is +x, in his T rest pose):
// a bone named here points its length that way, and the bones below it follow unless named too.
const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize()
const mirror = pose => Object.fromEntries(Object.entries(pose).map(([k, d]) => [k.replace(/^Left|^Right/, m => (m === 'Left' ? 'Right' : 'Left')), new THREE.Vector3(-d.x, d.y, d.z)]))
const POSES = {
  // The perch: a deep crouch on the finial, knees wide, his right hand down on the tip, the left over his knee.
  crouch: {
    pelvis: 0.55, Spine: v(0, 0.3, 0.95), Spine01: v(0, 0.34, 0.94), Spine02: v(0, 0.4, 0.92), neck: v(0, 0.8, 0.6), Head: v(0, 1, -0.04),
    LeftUpLeg: v(0.42, 0.14, 0.9), RightUpLeg: v(-0.42, 0.14, 0.9), LeftLeg: v(-0.36, -0.62, -0.7), RightLeg: v(0.36, -0.62, -0.7),
    LeftFoot: v(-0.05, -0.8, 0.6), RightFoot: v(0.05, -0.8, 0.6), LeftToeBase: v(0, -0.2, 1), RightToeBase: v(0, -0.2, 1),
    // (the right arm is aimed at build so the hand lands on the knob between his feet)
    RightShoulder: v(-0.9, -0.25, 0.36), RightArm: v(0.15, -0.95, 0.1), RightForeArm: v(0.1, -0.95, -0.2), RightHand: v(0.05, -0.75, 0.66),
    LeftShoulder: v(0.9, -0.2, 0.38), LeftArm: v(0.3, -0.93, 0.2), LeftForeArm: v(-0.3, -0.85, 0.43), LeftHand: v(-0.15, -0.95, 0.25),
  },
  // The tip-over: he lets go backward, arched, arms thrown wide and up, legs long.
  leap: {
    Spine02: v(0, 0.93, -0.36), Spine01: v(0, 0.95, -0.3), Spine: v(0, 0.97, -0.24), neck: v(0, 0.85, -0.52), Head: v(0, 0.75, -0.66),
    LeftUpLeg: v(0.12, -0.96, 0.25), RightUpLeg: v(-0.12, -0.96, 0.25), LeftLeg: v(0.05, -0.96, -0.28), RightLeg: v(-0.05, -0.96, -0.28),
    LeftArm: v(0.85, 0.45, -0.28), LeftForeArm: v(0.75, 0.6, -0.28), RightArm: v(-0.85, 0.45, -0.28), RightForeArm: v(-0.75, 0.6, -0.28),
  },
  // The leap of faith: arms spread wide, one knee drawn up, looking where he falls.
  fall: {
    Spine02: v(0, 0.97, -0.2), Spine: v(0, 0.96, -0.28), neck: v(0, 0.9, -0.4), Head: v(0, 0.8, -0.6),
    LeftUpLeg: v(0.18, -0.82, 0.55), LeftLeg: v(0.08, -0.95, -0.3), RightUpLeg: v(-0.12, -0.97, 0.12), RightLeg: v(-0.08, -0.98, -0.05),
    LeftArm: v(0.95, 0.22, -0.18), LeftForeArm: v(0.88, 0.42, -0.2), RightArm: v(-0.95, 0.26, -0.12), RightForeArm: v(-0.86, 0.48, -0.15),
  },
  // Tucked for a flip.
  tuck: {
    Spine02: v(0, 0.8, 0.6), Spine: v(0, 0.75, 0.66), Head: v(0, 0.7, 0.71),
    LeftUpLeg: v(0.18, 0.35, 0.92), RightUpLeg: v(-0.18, 0.35, 0.92), LeftLeg: v(0.04, -0.85, -0.5), RightLeg: v(-0.04, -0.85, -0.5),
    LeftArm: v(0.35, -0.45, 0.82), LeftForeArm: v(-0.25, -0.3, 0.92), RightArm: v(-0.35, -0.45, 0.82), RightForeArm: v(0.25, -0.3, 0.92),
  },
  // On the web: his right arm up along it, the left out ahead, knees bent and together.
  swing: {
    Spine02: v(0, 0.99, -0.12), Spine: v(0, 0.98, -0.16), Head: v(0, 0.94, 0.33),
    RightShoulder: v(-0.85, 0.5, 0), RightArm: v(-0.18, 0.98, 0.06), RightForeArm: v(-0.1, 0.99, 0.08), RightHand: v(-0.05, 1, 0.05),
    LeftArm: v(0.78, -0.3, 0.55), LeftForeArm: v(0.55, -0.05, 0.83), LeftHand: v(0.5, 0, 0.86),
    LeftUpLeg: v(0.06, -0.78, 0.62), RightUpLeg: v(-0.06, -0.82, 0.57), LeftLeg: v(0.03, -0.86, -0.5), RightLeg: v(-0.03, -0.9, -0.42),
  },
  // Between swings: arms spread, one leg drawn up.
  fly: {
    Spine02: v(0, 0.96, -0.28), Spine: v(0, 0.95, -0.3), Head: v(0, 0.88, 0.47),
    LeftArm: v(0.9, 0.28, 0.33), LeftForeArm: v(0.84, 0.45, 0.3), RightArm: v(-0.9, 0.28, 0.33), RightForeArm: v(-0.84, 0.45, 0.3),
    LeftUpLeg: v(0.2, -0.6, 0.77), LeftLeg: v(0.1, -0.9, -0.42), RightUpLeg: v(-0.1, -0.95, -0.3), RightLeg: v(-0.05, -0.95, -0.3),
  },
}
POSES.swingL = mirror(POSES.swing)
// Which pose when: [p, pose], blended between neighbours.
const POSE_AT = [
  [0, 'crouch'], [0.178, 'crouch'], [0.2, 'leap'], [0.25, 'fall'], [0.39, 'fall'], [0.412, 'tuck'], [0.43, 'swing'],
  [0.515, 'swing'], [0.535, 'fly'], [0.548, 'fly'], [0.565, 'swingL'], [0.65, 'swingL'], [0.67, 'tuck'], [0.69, 'tuck'], [0.712, 'swing'],
  [0.79, 'swing'], [0.808, 'fly'], [0.836, 'swingL'], [0.9, 'swingL'], [0.93, 'fly'], [1, 'fly'],
]
const SUIT = [0.255, 0.375] // the suit's spread over him, from the chest
const SUIT_R = 1.45 // bind-space reach from the chest emblem that covers all of him

// ---------------------------------------------------------------- shaders
// The sky, the haze and the light, shared by every custom shader here so the city, the landmark, the
// water and the sky all sit in one atmosphere. Lighting is three.js's own Lambert (albedo x irradiance)
// so the physically lit meshes (him, the dome) match the shader-lit city.
const ATMOS = /* glsl */ `
  uniform vec3 uSun, uSunCol, uZen, uHor, uGlow, uBelt, uSkyAmb, uGndAmb;
  uniform float uFog, uDusk, uT;
  vec3 skyCol(vec3 d) {
    float h = d.y;
    float sd = max(dot(d, uSun), 0.0);
    vec3 c = mix(uHor, uZen, pow(clamp(h + 0.015, 0.0, 1.0), 0.42));
    float anti = max(-dot(normalize(d.xz + vec2(1e-4)), normalize(uSun.xz)), 0.0);
    c = mix(c, uBelt, anti * anti * smoothstep(-0.01, 0.06, h) * (1.0 - smoothstep(0.07, 0.34, h)) * 0.75);
    c += uGlow * (pow(sd, 5.0) * 0.42 + pow(sd, 42.0) * 0.9);
    return c;
  }
  vec3 hazeCol(vec3 dir) { return skyCol(normalize(vec3(dir.x, 0.01 + max(dir.y, 0.0) * 0.5, dir.z))); }
  vec3 atmos(vec3 col, vec3 wp) {
    vec3 r = wp - cameraPosition; float d = length(r);
    float k = uFog * (0.3 + 0.7 * exp(-max(wp.y, 0.0) / 240.0));
    return mix(col, hazeCol(r / d), 1.0 - exp(-d * k));
  }
  // (walls also take the warm light thrown back off the sunlit walls across the street)
  vec3 lit(vec3 alb, vec3 n, float sunlit) {
    return alb * (uSunCol * max(dot(n, uSun), 0.0) * sunlit + mix(uGndAmb, uSkyAmb, 0.5 + 0.5 * n.y) + uSunCol * 0.07 * (1.0 - abs(n.y)));
  }
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float bx(float x, float a, float b, float w) { return clamp((x - a) / w + 0.5, 0.0, 1.0) * clamp((b - x) / w + 0.5, 0.0, 1.0); }
  // Window glass: what is inside, the sky (or the street) mirrored with Fresnel, and the sun's glint; each
  // pane a little off true (id), so the low sun catches a scatter of them, moving as the camera moves.
  vec3 glassCol(vec3 wp, vec3 n, vec3 inside, float rough, float sunlit, vec2 id, float far) {
    vec3 V = normalize(cameraPosition - wp);
    vec3 nn = normalize(n + (vec3(h21(id), h21(id + 4.1), h21(id + 8.3)) - 0.5) * 0.08 * (1.0 - far));
    vec3 R = reflect(-V, nn);
    float fr = 0.14 + 0.86 * pow(1.0 - max(dot(nn, V), 0.0), 5.0);
    vec3 env = R.y > 0.0 ? skyCol(R) : mix(hazeCol(R) * 0.45, vec3(0.04, 0.035, 0.035), clamp(-R.y * 4.0, 0.0, 1.0));
    float rs = max(dot(R, uSun), 0.0);
    vec3 spec = uSunCol * sunlit * (pow(rs, 900.0) * 7.0 * (1.0 - far) + pow(rs, 14.0) * 0.22 * (1.0 - rough));
    // A few panes stand open or off true enough to throw the low sun at the lens, flashing as the camera moves.
    float hf = h21(id * 0.37 + 5.1);
    spec += uSunCol * sunlit * max(dot(n, uSun), 0.0) * step(0.972, hf) * pow(max(sin(dot(cameraPosition.xz, vec2(0.9, 0.7)) + uT * 0.4 + hf * 400.0), 0.0), 6.0) * 2.6 * (1.0 - far);
    return mix(inside, env, fr * (1.0 - 0.6 * rough)) + spec;
  }
`
const SKY_U = () => ({
  uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Vector3() }, uZen: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() },
  uGlow: { value: new THREE.Vector3() }, uBelt: { value: new THREE.Vector3() }, uSkyAmb: { value: new THREE.Vector3() }, uGndAmb: { value: new THREE.Vector3() },
  uFog: { value: 0.0006 }, uDusk: { value: 0 }, uT: { value: 0 }, uSunDisc: { value: new THREE.Vector3() }, uShadow: { value: 60 }, uEsbShadow: { value: 150 }, uCrown: { value: 0 },
})

function skyMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = (projectionMatrix * viewMatrix * vec4(cameraPosition + position * 6000.0, 1.0)).xyww; }`,
    fragmentShader: /* glsl */ `
      ${ATMOS}
      uniform vec3 uSunDisc;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = d.y > 0.0 ? skyCol(d) : hazeCol(d);
        // The sun: a soft disc, flattened into the haze at the horizon (it sinks behind the far shore).
        float sd = dot(d, uSun);
        c += uSunDisc * smoothstep(0.99988, 0.99993, sd) * smoothstep(-0.002, 0.004, d.y);
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  })
}

// The city's towers (instanced boxes; SOLO for one-off meshes): a facade picked per building (pre-war
// limestone, brick, dark glass, white ribbons, brownstone, green glass), windows from world position
// (so every box keeps true panes whatever its scale), and the golden-hour light: the low sun lights only
// the upper floors (the streets lie in the shadow of the blocks west of them, uShadow rising as it sets),
// lit rooms come on at dusk.
function cityMaterial(U, { solo = false, seed = 0 } = {}) {
  return new THREE.ShaderMaterial({
    defines: solo ? { SOLO: '' } : {},
    uniforms: { ...U, uSeed: { value: seed } },
    vertexShader: /* glsl */ `
      uniform float uSeed;
      varying vec3 vW; varying vec3 vN; varying float vSeed;
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = m * instanceMatrix;
          vSeed = fract(sin(dot(floor(instanceMatrix[3].xz * 0.5), vec2(12.9898, 78.233))) * 43758.5453);
        #else
          vSeed = uSeed;
        #endif
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(m) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${ATMOS}
      uniform float uShadow;
      varying vec3 vW; varying vec3 vN; varying float vSeed;
      void main() {
        vec3 n = normalize(vN);
        float st = floor(vSeed * 6.0);
        vec3 wall; vec2 cell; vec4 pane; float glassy;
        if (st < 1.0) { wall = vec3(0.5, 0.42, 0.32); cell = vec2(2.2, 3.5); pane = vec4(0.27, 0.73, 0.24, 0.84); glassy = 0.0; }
        else if (st < 2.0) { wall = vec3(0.3, 0.14, 0.09); cell = vec2(2.0, 3.3); pane = vec4(0.28, 0.72, 0.26, 0.82); glassy = 0.0; }
        else if (st < 3.0) { wall = vec3(0.06, 0.07, 0.08); cell = vec2(1.5, 3.8); pane = vec4(0.04, 0.96, 0.08, 0.97); glassy = 1.0; }
        else if (st < 4.0) { wall = vec3(0.56, 0.55, 0.52); cell = vec2(1.8, 3.6); pane = vec4(0.02, 0.98, 0.38, 0.9); glassy = 0.5; }
        else if (st < 5.0) { wall = vec3(0.4, 0.29, 0.21); cell = vec2(2.4, 3.4); pane = vec4(0.3, 0.7, 0.3, 0.8); glassy = 0.0; }
        else { wall = vec3(0.07, 0.11, 0.12); cell = vec2(1.6, 3.9); pane = vec4(0.05, 0.95, 0.06, 0.96); glassy = 1.0; }
        wall *= 0.82 + 0.36 * fract(vSeed * 17.3);
        // The low sun reaches only the upper floors, each block's own shadow line.
        float sunlit = smoothstep(-14.0, 14.0, vW.y - (uShadow + 80.0 * fract(vSeed * 5.7) - 40.0));
        // The sun runs nearly down the avenue: its north frontage (facing south onto it) glows almost to the
        // street, the south frontage stays in deep blue shade.
        float north = step(0.5, n.z) * step(abs(vW.z - ${(AV - AVH).toFixed(1)}), 3.0);
        float south = step(0.5, -n.z) * step(abs(vW.z - ${(AV + AVH).toFixed(1)}), 3.0);
        sunlit = max(sunlit, north * smoothstep(3.0, 24.0, vW.y));
        vec3 col;
        if (n.y > 0.5) {
          col = lit(vec3(0.2, 0.19, 0.18) * (0.75 + 0.5 * fract(vSeed * 3.3)), n, sunlit);
        } else if (n.y < -0.5) {
          col = lit(vec3(0.15), n, 0.0);
        } else {
          float hor = abs(n.x) > abs(n.z) ? vW.z : vW.x;
          vec2 w = vec2(hor, vW.y) / cell, f = fract(w), id = floor(w);
          vec2 fw = max(fwidth(w), vec2(1e-4));
          float far = smoothstep(0.2, 0.55, max(fw.x, fw.y));
          float area = (pane.y - pane.x) * (pane.w - pane.z);
          float m = mix(bx(f.x, pane.x, pane.y, fw.x) * bx(f.y, pane.z, pane.w, fw.y), area, far);
          // Shop fronts: the lowest floor all glass.
          m = mix(m, 0.8, step(vW.y, 4.5) * (1.0 - glassy));
          float r = h21(id + vSeed * 31.0);
          vec3 inside = vec3(0.022, 0.025, 0.03) + vec3(0.11, 0.09, 0.07) * mix(step(0.72, r), 0.28, far) * (1.0 - glassy * 0.7);
          float on = mix(step(1.0 - uDusk * (0.12 + 0.3 * fract(vSeed * 9.1)), h21(id * 1.7 + 3.3)), uDusk * 0.27, far);
          inside += on * vec3(1.0, 0.72, 0.45) * (0.35 + 0.45 * mix(h21(id + 7.7), 0.5, far)) * uDusk;
          // The top of each opening in shadow under its lintel.
          inside *= mix(1.0, 0.55, smoothstep(pane.w - 0.12, pane.w, f.y) * (1.0 - far) * (1.0 - glassy));
          vec3 g = glassCol(vW, n, inside, 1.0 - glassy * 0.85, sunlit, id + vSeed * 13.0, far);
          vec3 wl = lit(wall * (0.92 + 0.16 * h21(vec2(id.y, vSeed))), n, sunlit);
          // A string course every few floors on the masonry ones.
          wl *= 1.0 - 0.25 * (1.0 - glassy) * (1.0 - far) * step(fract(vW.y / (cell.y * 6.0)), 0.04);
          // Close up, as on the ESB: the masonry's windows stacked in columns over darker spandrels between
          // piers; each opening framed, split by a mullion and a transom; the glass walls' mullion grid.
          float near = 1.0 - far;
          wl *= 1.0 - 0.22 * near * (1.0 - glassy) * bx(f.x, pane.x, pane.y, fw.x) * (1.0 - bx(f.y, pane.z, pane.w, fw.y));
          float fr = 1.0 - bx(f.x, pane.x + 0.035, pane.y - 0.035, fw.x) * bx(f.y, pane.z + 0.03, pane.w - 0.03, fw.y);
          fr = max(fr, bx(f.x, 0.5 * (pane.x + pane.y) - 0.012, 0.5 * (pane.x + pane.y) + 0.012, fw.x));
          fr = max(fr, bx(f.y, mix(pane.z, pane.w, 0.62) - 0.01, mix(pane.z, pane.w, 0.62) + 0.01, fw.y));
          vec3 frameC = lit(mix(vec3(0.5, 0.47, 0.42), vec3(0.1, 0.1, 0.11), glassy), n, sunlit);
          g = mix(g, frameC, fr * near);
          col = mix(wl, g, m);
          col *= mix(vec3(1.0), vec3(0.62, 0.78, 1.2), south * (1.0 - sunlit));
        }
        gl_FragColor = vec4(atmos(col, vW), 1.0);
      }`,
  })
}

// The Empire State Building's own skin, by part (aPart: zone, its base, its height): zone 0 the body
// (limestone piers, between them recessed columns of windows over cast aluminium spandrels, edged by
// bright steel mullions running up the whole shaft; the base's big windows), 1 the crown's tiers (fluted
// limestone and aluminium, floodlit from each setback), 2 the mast and antenna (metal), 3 glass.
function esbMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      attribute vec3 aPart;
      varying vec3 vW; varying vec3 vN; varying vec3 vPart;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vPart = aPart;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${ATMOS}
      uniform float uEsbShadow, uCrown;
      varying vec3 vW; varying vec3 vN; varying vec3 vPart;
      void main() {
        vec3 n = normalize(vN);
        float zone = vPart.x;
        float sunlit = smoothstep(-20.0, 20.0, vW.y - uEsbShadow);
        vec3 V = normalize(cameraPosition - vW), R = reflect(-V, n);
        vec3 env = R.y > 0.0 ? skyCol(R) : hazeCol(R) * 0.5;
        float rs = max(dot(R, uSun), 0.0);
        vec3 lime = vec3(0.6, 0.52, 0.41);
        vec3 col;
        if (n.y > 0.5) {
          col = lit(vec3(0.26, 0.24, 0.22), n, sunlit);
        } else if (n.y < -0.5) {
          col = lit(vec3(0.18), n, 0.0);
        } else if (zone < 0.5) {
          float hor = abs(n.x) > abs(n.z) ? vW.z : vW.x;
          float base = step(vW.y, 25.5);
          vec2 w = base > 0.5 ? vec2(hor / 4.6, vW.y / 5.1) : vec2(hor / 2.8 + 0.18, vW.y / 3.74);
          vec2 f = fract(w), id = floor(w);
          vec2 fw = max(fwidth(w), vec2(1e-4));
          float far = smoothstep(0.16, 0.5, max(fw.x, fw.y));
          float cx = bx(f.x, 0.4, 0.96, fw.x);
          float win = base > 0.5 ? bx(f.x, 0.14, 0.86, fw.x) * bx(f.y, 0.12, 0.8, fw.y) : cx * bx(f.y, 0.06, 0.64, fw.y);
          float mull = base > 0.5 ? 0.0 : bx(f.x, 0.36, 1.0, fw.x) - cx;
          float span = base > 0.5 ? 0.0 : cx - win;
          float r = h21(id + 1.3);
          vec3 inside = vec3(0.02, 0.022, 0.026) + vec3(0.1, 0.085, 0.07) * mix(step(0.7, r), 0.3, far);
          inside += mix(step(1.0 - uDusk * 0.55, h21(id * 1.9 + 2.0)), uDusk * 0.5, far) * vec3(1.0, 0.72, 0.42) * 0.9 * uDusk;
          vec3 stone = lit(lime * (0.9 + 0.14 * mix(h21(vec2(id.x * 0.37, floor(id.y / 3.0))), 0.5, far)), n, sunlit);
          vec3 metal = lit(vec3(0.24, 0.24, 0.25), n, sunlit) + env * 0.55 + uSunCol * sunlit * pow(rs, 26.0) * 0.9;
          vec3 spand = lit(vec3(0.17, 0.16, 0.15), n, sunlit) + env * 0.1 + uSunCol * sunlit * pow(rs, 10.0) * 0.12;
          vec3 glass = glassCol(vW, n, inside, 0.15, sunlit, id + vec2(step(0.0, n.x + n.z) * 91.0, 0.0), far);
          // A scatter of its panes, off true, throw the low sun at the lens as the camera moves (the pointer's parallax).
          float hf = h21(id * 0.53 + 2.7);
          glass += uSunCol * sunlit * max(dot(n, uSun), 0.0) * step(0.9, hf) * (1.0 - far * 0.6)
            * pow(max(sin(dot(cameraPosition.xz, vec2(1.1, 0.8)) * 1.4 + uT * 0.5 + hf * 300.0), 0.0), 8.0) * 6.0;
          col = stone;
          col = mix(col, spand, span);
          col = mix(col, metal, mull);
          col = mix(col, glass, win);
          // From far off the pattern is finer than a pixel: its average (vertical stripes still read).
          vec3 avg = base > 0.5 ? mix(stone, glass, 0.5) : stone * 0.36 + metal * 0.04 + glass * 0.35 + spand * 0.25;
          col = mix(col, avg, far * 0.85);
        } else if (zone < 1.5) {
          // The crown: fluted, its piers of limestone and ribs of aluminium; floodlit from each setback.
          float hor = abs(n.x) > abs(n.z) ? vW.z : vW.x;
          float rib = step(0.62, fract(hor / 1.1));
          vec3 c = mix(lit(lime * 1.05, n, sunlit), lit(vec3(0.3), n, sunlit) + env * 0.5 + uSunCol * sunlit * pow(rs, 20.0) * 0.6, rib * 0.7);
          float up = clamp((vW.y - vPart.y) / vPart.z, 0.0, 1.0);
          c += vec3(1.0, 0.86, 0.62) * uCrown * pow(1.0 - up, 1.6) * (0.75 + 0.25 * rib);
          col = c;
        } else if (zone < 2.5) {
          col = lit(vec3(0.3, 0.3, 0.31), n, sunlit) + env * 0.45 + uSunCol * sunlit * pow(rs, 30.0) * 0.8;
          col += vec3(1.0, 0.85, 0.6) * uCrown * 0.25 * smoothstep(380.0, 372.0, vW.y);
        } else {
          col = glassCol(vW, n, vec3(0.03) + vec3(1.0, 0.8, 0.5) * uCrown * 0.6, 0.1, sunlit, floor(vW.xz), 0.0);
        }
        // Low sun: the faces turned to it bright, those turned away deep in shade.
        if (zone < 1.5 && abs(n.y) < 0.5) col *= mix(0.68, 1.2, clamp(dot(n, uSun) * 1.6, 0.0, 1.0) * sunlit);
        gl_FragColor = vec4(atmos(col, vW), 1.0);
      }`,
  })
}

// Plain lit things in the same air: roof plant, water tanks, cornices, the ground (albedo per vertex).
function plainMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      attribute vec3 aAlb;
      varying vec3 vW; varying vec3 vN; varying vec3 vAlb;
      void main() {
        mat4 m = modelMatrix;
        float tint = 1.0;
        #ifdef USE_INSTANCING
          m = m * instanceMatrix;
          tint = 0.8 + 0.4 * fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #endif
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(m) * normal); vAlb = aAlb * tint;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${ATMOS}
      uniform float uShadow;
      varying vec3 vW; varying vec3 vN; varying vec3 vAlb;
      void main() {
        vec3 n = normalize(vN);
        float sunlit = smoothstep(-14.0, 14.0, vW.y - uShadow + 20.0);
        gl_FragColor = vec4(atmos(lit(vAlb, n, sunlit), vW), 1.0);
      }`,
  })
}

// The rivers: a rippled mirror of the sky with a path of sun glitter.
function waterMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${ATMOS}
      varying vec3 vW;
      void main() {
        vec2 q = vW.xz * 0.06; float t = uT * 0.7;
        vec2 g = vec2(sin(q.x * 3.1 + t) + 0.6 * sin(q.y * 4.3 + q.x * 1.7 - t * 1.3) + 0.3 * sin((q.x + q.y) * 9.0 + t * 2.0),
                      cos(q.y * 3.7 - t) + 0.6 * cos(q.x * 5.1 - q.y * 2.1 + t * 1.1) + 0.3 * cos((q.x - q.y) * 11.0 - t * 1.7));
        vec3 n = normalize(vec3(g.x * 0.05, 1.0, g.y * 0.05));
        vec3 V = normalize(cameraPosition - vW), R = reflect(-V, n);
        float fr = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 col = mix(vec3(0.02, 0.03, 0.04), skyCol(vec3(R.x, abs(R.y), R.z)), fr);
        float rs = max(dot(R, uSun), 0.0);
        col += uSunCol * (pow(rs, 260.0) * 3.0 + pow(rs, 24.0) * 0.16);
        gl_FragColor = vec4(atmos(col, vW), 1.0);
      }`,
  })
}

// Birds: pigeons wheeling round the dome and gulls over the avenue, each on its own tilted loop, flapping
// and gliding by turns; drawn as dark silhouettes warmed a little by the sun. All on the GPU's clock.
function birds(U, list) {
  const base = new THREE.BufferGeometry()
  // body, then the two wings (their outer vertices flap)
  base.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.2, -0.05, 0, -0.15, 0.05, 0, -0.15, 0, 0, 0.08, 0.05, 0, -0.05, 0.42, 0.02, -0.1, 0, 0, 0.08, -0.42, 0.02, -0.1, -0.05, 0, -0.05], 3))
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', base.attributes.position)
  g.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(b => b.c)), 3))
  g.setAttribute('aO', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(b => b.o)), 4))
  g.instanceCount = list.length
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      uniform float uT;
      attribute vec3 aC; attribute vec4 aO;
      varying vec3 vW;
      void main() {
        float r = aO.x, sp = aO.y, ph = aO.z, bob = aO.w;
        float a = ph + uT * sp;
        vec3 c = aC + vec3(cos(a) * r, sin(a * 2.0 + ph) * bob, sin(a) * r * 0.75);
        vec3 fwd = normalize(vec3(-sin(a) * r, cos(a * 2.0 + ph) * 2.0 * bob, cos(a) * r * 0.75) * sign(sp));
        vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
        vec3 up = cross(right, fwd);
        float flap = sin(uT * 13.0 + ph * 7.0) * step(0.0, sin(uT * 0.8 + ph * 3.0));
        vec3 l = position * 1.6;
        l.y += abs(l.x) * flap * 0.9;
        vec3 w = c + right * l.x + up * l.y + fwd * l.z - right * l.x * 0.0;
        vW = w;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${ATMOS}
      varying vec3 vW;
      void main() { gl_FragColor = vec4(atmos(vec3(0.05, 0.045, 0.045) + uSunCol * 0.025, vW), 1.0); }`,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.frustumCulled = false
  return mesh
}

// A web line: a thin camera-facing ribbon from his hand (uA) to its anchor (uB), shot out to uLen of the
// way, sagging by uSag at its middle; never thinner than a pixel and a half.
function webLine() {
  const N = 28, pos = [], idx = []
  for (let i = 0; i <= N; i++) pos.push(i / N, -1, 0, i / N, 1, 0)
  for (let i = 0; i < N; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  const U = { uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uLen: { value: 0 }, uSag: { value: 0 }, uAlpha: { value: 0 }, uPx: { value: 0.001 }, uCol: { value: new THREE.Vector3(1, 0.96, 0.9) } }
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      uniform vec3 uA, uB; uniform float uLen, uSag, uPx;
      varying float vS;
      vec3 at(float s) { return mix(uA, uB, s) - vec3(0.0, 1.0, 0.0) * uSag * 4.0 * s * (1.0 - s); }
      void main() {
        float s = position.x * uLen;
        vec3 p = at(s), t = normalize(at(s + 0.01) - at(max(0.0, s - 0.01)) + 1e-5);
        vec3 side = normalize(cross(t, p - cameraPosition) + 1e-6);
        float wd = max(0.012, length(p - cameraPosition) * uPx * 0.8);
        vS = position.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(p + side * position.y * wd, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; uniform vec3 uCol;
      varying float vS;
      void main() { gl_FragColor = vec4(uCol * 1.4, uAlpha * (1.0 - vS * vS)); }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.frustumCulled = false
  return { mesh, U }
}

// Wind streaks round him: thin lines left behind as he falls and swings, longer the faster he goes.
function windStreaks(count) {
  const pos = new Float32Array(count * 6), off = [], end = []
  for (let i = 0; i < count; i++) {
    const o = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]
    off.push(...o, ...o)
    end.push(0, 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aOff', new THREE.Float32BufferAttribute(off, 3))
  g.setAttribute('aEnd', new THREE.Float32BufferAttribute(end, 1))
  const U = { uC: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, -1, 0) }, uSide: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 0, 1) }, uLen: { value: 0 }, uRun: { value: 0 }, uA: { value: 0 } }
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      attribute vec3 aOff; attribute float aEnd;
      uniform vec3 uC, uDir, uSide, uUp; uniform float uLen, uRun, uA;
      varying float vA;
      void main() {
        float along = (fract(aOff.y * 0.5 + 0.5 - uRun) - 0.5) * 24.0;
        vec2 r = aOff.xz * 4.0;
        r += normalize(r + 0.001) * 1.2;
        vec3 p = uC + uSide * r.x + uUp * r.y + uDir * (along - aEnd * uLen);
        vA = uA * (1.0 - abs(along) / 12.0) * (0.4 + 0.6 * fract(aOff.x * 7.0));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { gl_FragColor = vec4(vec3(1.0, 0.9, 0.75) * vA, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const lines = new THREE.LineSegments(g, m)
  lines.frustumCulled = false
  return { lines, U }
}

/** Red aviation lights (and the ESB's mast top), blinking; sized in metres with a floor of 2 px. */
function lightPoints(list, scale) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(list.flatMap(l => l.p), 3))
  g.setAttribute('aB', new THREE.Float32BufferAttribute(list.map(l => l.b), 1))
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uScale: scale, uOn: { value: 0.5 } },
    vertexShader: /* glsl */ `
      attribute float aB; uniform float uT, uScale, uOn;
      varying float vOn;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float px = 1.8 * uScale / max(1.0, -mv.z);
        vOn = uOn * (0.25 + 0.75 * step(0.55, fract(uT * 0.6 + aB))) * min(1.0, px * px / 4.0);
        gl_PointSize = max(px, 2.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vOn;
      void main() { float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.12, 0.06) * exp(-r * r * 6.0) * vOn * 2.0, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const pts = new THREE.Points(g, m)
  pts.frustumCulled = false
  return pts
}

/** A soft round glow with an anamorphic streak (the sun's flare, the beacon, the web's splash). */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')
  let grad = g.createRadialGradient(128, 64, 0, 128, 64, 62)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.1, 'rgba(255,255,255,0.5)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.1)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 128)
  grad = g.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.7)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 62, 256, 4)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  return t
}

/** The dome's copper: copper-teal verdigris with darker runs down from each rib and bronze where it is still copper. */
function copperTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#6c9f90')
  grad.addColorStop(1, '#5a8b7c')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 512, y = rnd() * 512, h = 20 + rnd() * 160
    g.fillStyle = rnd() < 0.12 ? `rgba(150,90,45,${0.1 + rnd() * 0.15})` : rnd() < 0.6 ? `rgba(40,70,62,${0.14 + rnd() * 0.18})` : `rgba(175,215,200,${0.08 + rnd() * 0.1})`
    g.fillRect(x, y, 1 + rnd() * 3, h)
  }
  // The sixteen ribs (the lathe's u runs round the dome): a bronze edge where the seam stands proud, a dark run beside it.
  for (let i = 0; i < 16; i++) {
    g.fillStyle = 'rgba(165,92,48,0.65)'
    g.fillRect(i * 32 - 1, 0, 3, 512)
    g.fillStyle = 'rgba(30,58,50,0.4)'
    g.fillRect(i * 32 + 2, 0, 5, 512)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/**
 * A pose as bone-local quaternions: his rest pose with limbs aimed (each a turn in his own frame that
 * takes the bone's rest direction to the one asked, inherited by the bones below unless they name their own).
 */
function makePose(bones, rest, dirs, restDir) {
  const I = new THREE.Quaternion(), world = new Map(), turn = new Map(), posed = new Map()
  return bones.map(b => {
    const w = (world.get(b.parent) ?? I).clone().multiply(rest.get(b))
    // (the hips have no one direction to aim: a pose may tip the pelvis forward about his x instead)
    const d = b.name === 'Hips' && dirs.pelvis ? new THREE.Quaternion().setFromAxisAngle(X, dirs.pelvis)
      : dirs[b.name] ? new THREE.Quaternion().setFromUnitVectors(restDir.get(b), dirs[b.name]) : turn.get(b.parent) ?? I
    const e = d.clone().multiply(w)
    world.set(b, w)
    turn.set(b, d)
    posed.set(b, e)
    return (posed.get(b.parent) ?? I).clone().invert().multiply(e)
  })
}

// The suit's spread: distance from his chest emblem in his rest pose (bind space), slower round to the
// back, its front broken up by noise so it reads as something alive crawling over him.
const SPREAD = /* glsl */ `
  uniform float uSpread;
  varying vec3 vBind;
  float sh3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float sn3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(sh3(i), sh3(i + vec3(1, 0, 0)), f.x), mix(sh3(i + vec3(0, 1, 0)), sh3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(sh3(i + vec3(0, 0, 1)), sh3(i + vec3(1, 0, 1)), f.x), mix(sh3(i + vec3(0, 1, 1)), sh3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float spreadD(vec3 b) {
    vec3 q = b - vec3(0.0, 1.24, 0.13);
    q.z *= q.z < 0.0 ? 1.5 : 1.0;
    return length(q) + (sn3(b * 13.0) - 0.5) * 0.09 + (sn3(b * 41.0) - 0.5) * 0.03;
  }`
function spreadMaterial(material, U, isSuit, rim) {
  material.onBeforeCompile = sh => {
    sh.uniforms.uSpread = U
    if (rim) Object.assign(sh.uniforms, rim)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SPREAD}`)
      .replace('#include <clipping_planes_fragment>', isSuit
        ? '#include <clipping_planes_fragment>\nfloat sD = spreadD(vBind); if (sD > uSpread) discard;\nfloat sEdge = 1.0 - smoothstep(0.0, 0.06, uSpread - sD);'
        : '#include <clipping_planes_fragment>\nif (spreadD(vBind) < uSpread - 0.035) discard;')
    if (isSuit)
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
        float sSpark = step(0.82, sh3(floor(vBind * 90.0)));
        totalEmissiveRadiance += (vec3(1.0, 0.28, 0.16) * 2.2 + vec3(1.0, 0.9, 0.8) * sSpark * 3.0) * sEdge * sEdge * step(uSpread, ${SUIT_R.toFixed(2)} - 0.01);
        // the low sun's warm rim round his edges on the web (uRimDir: toward the sun, in view space)
        totalEmissiveRadiance += uRimCol * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0) * smoothstep(-0.2, 0.6, dot(normal, uRimDir));`)
    if (isSuit) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRimDir, uRimCol;')
  }
  material.customProgramCacheKey = () => (isSuit ? 'swing-suit' : 'swing-body')
}

export function createSwing(renderer, { loader, mobile = false }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 9000)
  scene.add(camera)
  const here = new THREE.Vector3()
  const grade = { bloom: 0.8, threshold: 0.7 }
  const out = { here, dream: 0, grade }
  const U = SKY_U()
  const K8 = new Array(8).fill(0)
  const cam = new THREE.Vector3(), look = new THREE.Vector3(), base = new THREE.Vector3(), right = new THREE.Vector3()
  const qYaw = new THREE.Quaternion(), qPitch = new THREE.Quaternion()
  let par = 0, lastPT = null
  // The camera from p alone (before the world is whole, and every frame after).
  const place = (state, aspect, t) => {
    const p = warp(state.p ?? 0), still = !!state.still
    const tall = !!state.portrait
    ;(tall ? CAMP : CAM)(p, K8)
    hipsAt(p, here)
    base.copy(D).lerp(here, K8[0])
    cam.set(K8[1], K8[2], K8[3]).add(base)
    look.set(K8[4], K8[5], K8[6]).add(base)
    // Never inside him: a key passing from behind him to in front is held off his hips.
    if (K8[0] > 0.5) {
      const dd = right.copy(cam).sub(here).length(), minD = tall ? 2.4 : 1.8
      if (dd < minD) cam.copy(here).addScaledVector(right, minD / Math.max(dd, 1e-4))
    }
    camera.aspect = aspect
    camera.fov = fovAt(p, still)
    camera.updateProjectionMatrix()
    camera.up.set(0, 1, 0)
    camera.position.copy(cam)
    camera.lookAt(look)
    // The perch's parallax: the camera orbits the finial with the pointer (about 6 degrees of yaw, 3 of
    // pitch, a degree of roll), so he holds still in the frame while the dome and the near roofs slide
    // against the ESB and the far skyline (eased in and out, so the hand-over from the screen does not jump).
    const want = !still && !state.onScreen && state.pointer ? 1 - ss(0.12, 0.17, p) : 0
    const dt = lastPT === null ? 0 : Math.min(0.1, Math.max(0, t - lastPT))
    lastPT = t
    par += (want - par) * (1 - Math.exp(-dt * 3))
    if (par > 1e-3 && state.pointer) {
      right.set(1, 0, 0).applyQuaternion(camera.quaternion)
      qYaw.setFromAxisAngle(Y, -state.pointer.x * 0.105 * par).multiply(qPitch.setFromAxisAngle(right, state.pointer.y * 0.052 * par))
      camera.position.sub(D).applyQuaternion(qYaw).add(D)
      camera.quaternion.premultiply(qYaw)
      camera.rotateZ(-state.pointer.x * 0.017 * par)
    }
    if (!still) camera.rotateZ(K8[7]) // the roll over into the inverted shot is a flourish: level when still
  }
  let run = null
  ;(async () => {
    let t0 = performance.now()
    const step = async () => {
      if (performance.now() - t0 < 4) return
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }
    const traveller = loadTraveller(loader), suitFile = loader.loadAsync('/cinema/suits/spider.glb')
    const pxScale = { value: 900 }, size = new THREE.Vector2()
    // The light at p = 0, so the build's first frames and the environment below are already golden.
    const light = sunAt(0, U)
    scene.fog = new THREE.FogExp2(new THREE.Color(0.85, 0.62, 0.45), 0.0004)
    const skyMat = skyMaterial(U)
    const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat)
    skyMesh.frustumCulled = false
    skyMesh.renderOrder = -1
    scene.add(skyMesh)
    // The sky lights his suit and the copper: an environment of it, once.
    {
      const env = new THREE.Scene()
      env.add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat))
      const ground = new THREE.Mesh(new THREE.CircleGeometry(5, 16).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.09, 0.07) }))
      ground.position.y = -0.4
      env.add(ground)
      await new Promise(r => setTimeout(r))
      const pm = new THREE.PMREMGenerator(renderer)
      scene.environment = pm.fromScene(env, 0, 0.1, 100, { size: 64 }).texture
      scene.environmentIntensity = 0.7
      pm.dispose()
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }

    // ------------------------------------------------------------ the city
    const cityMat = cityMaterial(U), plainMat = plainMaterial(U)
    const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    unit.deleteAttribute('uv')
    const alb = (geo, r, g, b) => {
      const n = geo.attributes.position.count, a = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) a.set([r, g, b], i * 3)
      geo.setAttribute('aAlb', new THREE.BufferAttribute(a, 3))
      return geo
    }
    // Streets: avenues along z every 190 m, streets along x every 90 m, the swing's avenue (z = AV) wide.
    const XB = [], ZB = []
    for (let x = 40 - 190 * 12; x <= 1200; x += 190) XB.push(x)
    for (let z = AV - 90 * 15; z <= 1150; z += 90) ZB.push(z)
    const halfZ = z => (z === AV ? AVH : 9)
    // The line of sight from the perch to the ESB stays clear of tall towers.
    const sight = (x, z) => {
      const ax = 0 - D.x, az = 0 - D.z, u = clamp01(((x - D.x) * ax + (z - D.z) * az) / (ax * ax + az * az))
      return Math.hypot(x - D.x - ax * u, z - D.z - az * u)
    }
    const boxes = [], plant = [], tanks = [], lights = [], cornices = []
    for (let i = 0; i < XB.length - 1; i++) for (let j = 0; j < ZB.length - 1; j++) {
      const bx0 = XB[i] + 12, bx1 = XB[i + 1] - 12, bz0 = ZB[j] + halfZ(ZB[j]), bz1 = ZB[j + 1] - halfZ(ZB[j + 1])
      const cxb = (bx0 + bx1) / 2, czb = (bz0 + bz1) / 2
      const far = Math.hypot(cxb + 700, czb - 300)
      const scale = (mobile ? 1.6 : 1) * (1 + Math.max(0, far - 900) / 700)
      for (const row of [0, 1]) {
        const z0 = row ? (bz0 + bz1) / 2 : bz0, z1 = row ? bz1 : (bz0 + bz1) / 2
        const front = (row === 0 && ZB[j] === AV) ? 1 : (row === 1 && ZB[j + 1] === AV) ? -1 : 0 // faces the swing's avenue
        for (let x = bx0; x < bx1 - 8;) {
          const w = Math.min(bx1 - x, (16 + rnd() * 26) * scale)
          const cx = x + w / 2
          x += w
          const inset = front ? 0 : rnd() * 2.5
          const d = (z1 - z0) - inset - rnd() * 3
          const cz = front === 1 ? z0 + d / 2 : front === -1 ? z1 - d / 2 : (z0 + z1) / 2
          if (Math.abs(cx) < 30 + w / 2 && Math.abs(cz) < 66 + d / 2) continue // the ESB's block
          if (Math.abs(cx - PERCH.x) < PERCH.w / 2 + w / 2 + 1 && Math.abs(cz - PERCH.z) < PERCH.w / 2 + d / 2 + 1) continue // the perch tower
          if (Math.hypot(cx - TOWER.x, cz - TOWER.z) < 34) continue
          let h = 24 + 110 * rnd() ** 1.6
          if (rnd() < 0.13) h = 150 + 130 * rnd()
          const dE = Math.hypot(cx, cz)
          if (dE < 260) h = Math.min(h, 40 + 95 * rnd())
          if (sight(cx, cz) < 55) h = Math.min(h, 120 + 50 * rnd())
          if (front && cx > -1260 && cx < -360) {
            h = 95 + 115 * rnd()
            for (const a of ARCS) if (a.s === front && Math.abs(cx - a.A.x) < w / 2 + 6) h = Math.max(h, a.A.y + 16 + 20 * rnd())
          } else if (front && cx <= -1260) h = 40 + 70 * rnd()
          if (cx < -1850) h = Math.min(h, 18 + 50 * rnd())
          if (Math.hypot(cx - TOWER.x, cz - TOWER.z) < 200) h = Math.min(h, 30 + 50 * rnd())
          // Near the perch: lower, so the dome stands up out of the roofs around it.
          if (Math.hypot(cx - PERCH.x, cz - PERCH.z) < 110) h = Math.min(h, 95 + 50 * rnd())
          if (Math.abs(cx - PERCH.x + 10) < 50 + w / 2 && cz > PERCH.z + 10 && cz < AV) h = Math.min(h, 14 + 10 * rnd()) // he falls past the perch tower's south face: low there
          boxes.push([cx, 0, cz, w - (front ? 0.6 : 1 + rnd() * 2), h, d])
          // The avenue's frontages, which the camera rides past: a crowning cornice and a belt over the shops.
          if (front && cx > -1300 && cx < -360) cornices.push([cx, h - 1.5, cz, w + 0.4, 1.5, d + 1.6], [cx, 13, cz, w + 0.2, 0.8, d + 0.9])
          let top = h, tw = w * 0.5, td = d * 0.5
          if (h > 80 && rnd() < 0.6) {
            const s1 = 0.62 + rnd() * 0.2, th = h * (0.12 + rnd() * 0.1)
            boxes.push([cx, h, cz, w * s1, th, d * s1])
            top = h + th, tw = w * s1 * 0.5, td = d * s1 * 0.5
            if (h > 140 && rnd() < 0.5) {
              const s2 = s1 * (0.6 + rnd() * 0.2), th2 = h * (0.06 + rnd() * 0.06)
              boxes.push([cx, top, cz, w * s2, th2, d * s2])
              top += th2, tw = w * s2 * 0.5, td = d * s2 * 0.5
            }
          }
          if (far < 1500 || rnd() < 0.4) {
            if (top < 170 && rnd() < (mobile ? 0.25 : 0.42)) tanks.push([cx + (rnd() - 0.5) * tw, top, cz + (rnd() - 0.5) * td, 0.8 + rnd() * 0.5])
            const k = mobile ? 1 : 2
            for (let q = 0; q < k; q++) plant.push([cx + (rnd() - 0.5) * tw * 1.2, top, cz + (rnd() - 0.5) * td * 1.2, 2 + rnd() * 5, 1.5 + rnd() * 2.5, 2 + rnd() * 5])
          }
          if (top > 160) lights.push({ p: [cx, top + 1, cz], b: rnd() })
        }
      }
      await step()
    }
    // The far shores and the rest of the island in haze: Jersey over the Hudson, Queens over the East
    // River, uptown and downtown.
    const fars = [[-4800, -3500, -3500, 3500, 40, mobile ? 160 : 320], [1750, 5200, -3500, 3500, 30, mobile ? 120 : 240], [-2200, 1100, -4200, -1100, 90, mobile ? 160 : 320], [-2200, 1100, 1250, 4600, 110, mobile ? 140 : 260]]
    for (const [x0, x1, z0, z1, hh, n] of fars) {
      for (let k = 0; k < n; k++) {
        const w = 30 + rnd() * 60, h = rnd() < 0.08 ? hh * (2 + rnd() * 2) : 12 + hh * rnd() ** 1.5
        boxes.push([x0 + rnd() * (x1 - x0), 0, z0 + rnd() * (z1 - z0), w, h, 30 + rnd() * 60])
      }
      await step()
    }
    const mats = new THREE.Matrix4(), q0 = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3()
    const inst = (geo, mat, list, put) => {
      const m = new THREE.InstancedMesh(geo, mat, list.length)
      list.forEach((r, i) => m.setMatrixAt(i, put(r)))
      m.frustumCulled = false
      scene.add(m)
      return m
    }
    inst(unit, cityMat, boxes, ([x, y, z, w, h, d]) => mats.compose(pos.set(x, y, z), q0, sc.set(w, h, d)))
    await step()
    inst(alb(unit.clone(), 0.2, 0.19, 0.18), plainMat, plant, ([x, y, z, w, h, d]) => mats.compose(pos.set(x, y, z), q0, sc.set(w, h, d)))
    inst(alb(unit.clone(), 0.46, 0.4, 0.32), plainMat, cornices, ([x, y, z, w, h, d]) => mats.compose(pos.set(x, y, z), q0, sc.set(w, h, d)))
    // The water tanks: a wooden tub with a conical cap on a steel stand.
    {
      const parts = []
      const leg = (x, z) => alb(new THREE.BoxGeometry(0.22, 3.6, 0.22).translate(x, 1.8, z), 0.08, 0.075, 0.07)
      for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) parts.push(leg(x, z))
      parts.push(alb(new THREE.BoxGeometry(3.6, 0.25, 3.6).translate(0, 3.6, 0), 0.1, 0.09, 0.08))
      parts.push(alb(new THREE.CylinderGeometry(2.1, 2.2, 4.4, 14, 1).translate(0, 5.9, 0), 0.34, 0.24, 0.16))
      parts.push(alb(new THREE.ConeGeometry(2.35, 1.6, 14, 1).translate(0, 8.9, 0), 0.22, 0.2, 0.19))
      parts.push(alb(new THREE.CylinderGeometry(2.16, 2.16, 0.12, 14, 1, true).translate(0, 5.0, 0), 0.06, 0.06, 0.06))
      parts.push(alb(new THREE.CylinderGeometry(2.14, 2.14, 0.12, 14, 1, true).translate(0, 6.9, 0), 0.06, 0.06, 0.06))
      const tank = mergeGeometries(parts.map(g => (g.deleteAttribute('uv'), g.index ? g.toNonIndexed() : g)))
      inst(tank, plainMat, tanks, ([x, y, z, s]) => mats.compose(pos.set(x, y, z), q0.setFromAxisAngle(Y, x * 0.37), sc.setScalar(s)))
      q0.identity()
    }
    // The ground, and the rivers.
    {
      const g = alb(new THREE.PlaneGeometry(16000, 16000).rotateX(-PI / 2), 0.1, 0.095, 0.095)
      g.deleteAttribute('uv')
      const ground = new THREE.Mesh(g, plainMat)
      ground.frustumCulled = false
      scene.add(ground)
      const wm = waterMaterial(U)
      const rivers = mergeGeometries([new THREE.PlaneGeometry(1000, 16000).rotateX(-PI / 2).translate(-2850, 0.4, 0), new THREE.PlaneGeometry(420, 16000).rotateX(-PI / 2).translate(1460, 0.4, 0)])
      const water = new THREE.Mesh(rivers, wm)
      water.frustumCulled = false
      scene.add(water)
    }
    await step()

    // ------------------------------------------------------------ the Empire State Building
    // Massing true to it: the five-storey base filling the lot, the setbacks at the 6th, 25th and 30th
    // floors, the shaft to the 72nd with its centre bays standing proud on every face, the 72nd and 81st
    // setbacks, the 86th-floor observation deck, the stepped crown with its fins, the 102nd floor, the mast.
    {
      const parts = []
      const part = (geo, zone, y0, h) => {
        geo.deleteAttribute('uv')
        const g = geo.index ? geo.toNonIndexed() : geo
        const n = g.attributes.position.count, a = new Float32Array(n * 3)
        for (let i = 0; i < n; i++) a.set([zone, y0, h], i * 3)
        g.setAttribute('aPart', new THREE.BufferAttribute(a, 3))
        parts.push(g)
      }
      const box = (w, h, d, y0, zone = 0, x = 0, z = 0) => part(new THREE.BoxGeometry(w, h, d).translate(x, y0 + h / 2, z), zone, y0, h)
      const chamfer = (w, d, c) => {
        const s = new THREE.Shape(), hw = w / 2, hd = d / 2
        s.moveTo(-hw + c, -hd)
        for (const [x, y] of [[hw - c, -hd], [hw, -hd + c], [hw, hd - c], [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c]]) s.lineTo(x, y)
        return s
      }
      const prism = (w, d, c, y0, h, zone) => part(new THREE.ExtrudeGeometry(chamfer(w, d, c), { depth: h, bevelEnabled: false }).rotateX(-PI / 2).translate(0, y0, 0), zone, y0, h)
      box(57, 25.5, 129, 0)
      box(49, 74, 111, 25.5)
      box(47, 18, 86, 99.5)
      box(40, 160, 56, 117.5)
      box(45, 159.6, 25, 117.5) // the long faces' centre bays
      box(23, 159.6, 61, 117.5) // and the short faces'
      box(34, 32, 45, 277.5)
      box(37.5, 31.6, 19, 277.5)
      box(17, 31.6, 48.5, 277.5)
      box(28, 12, 36, 309.5)
      box(24, 3.5, 31, 321.5)
      // The 86th-floor deck: its parapet round the setback, and the glazed floor within.
      for (const [w, d, x, z] of [[28.6, 0.6, 0, 18], [28.6, 0.6, 0, -18], [0.6, 36, 14, 0], [0.6, 36, -14, 0]]) box(w, 1.5, d, 321.5, 0, x, z)
      box(20, 5.5, 24, 325, 3)
      // The crown: chamfered tiers stepping in, each floodlit from its foot, the aluminium fins on each face.
      prism(19, 21, 4.4, 330.5, 13.5, 1)
      prism(15, 16.5, 3.6, 344, 10, 1)
      prism(11.6, 12.6, 2.8, 354, 9, 1)
      prism(8.6, 9.2, 2.1, 363, 7, 1)
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (const [y0, h, r] of [[330.5, 20, 12.6], [350.5, 9, 9.6], [359.5, 6, 7.4]]) {
          const w = dx ? r * 2 : 1.3, d = dz ? r * 2 : 1.3
          box(w, h, d, y0, 1)
        }
      }
      part(new THREE.CylinderGeometry(3.6, 3.9, 4.2, 20).translate(0, 372.1, 0), 3, 370, 4.2) // the 102nd floor
      part(new THREE.CylinderGeometry(1.15, 1.75, 18, 12).translate(0, 383.2, 0), 2, 374.2, 18)
      part(new THREE.CylinderGeometry(0.22, 0.85, 50, 8).translate(0, 417.2, 0), 2, 392.2, 50)
      for (const y of [380, 388, 396, 408]) part(new THREE.CylinderGeometry(1.9 - (y - 380) * 0.04, 1.9 - (y - 380) * 0.04, 0.5, 12).translate(0, y, 0), 2, y, 0.5)
      const esb = new THREE.Mesh(mergeGeometries(parts), esbMaterial(U))
      esb.frustumCulled = false
      scene.add(esb)
      lights.push({ p: [0, 442.6, 0], b: 0.2 }, { p: [0, 393, 1.2], b: 0.7 })
    }
    await step()

    // ------------------------------------------------------------ the landmark tower, far off
    // dive.js's tower in silhouette: the chamfered glass shaft, its crown flaring out toward -x, the round
    // pad on its arm, the blade rising past the roof and its white beacon. No letters or marks.
    const glowTex = glowTexture()
    let beacon
    {
      const g = cityMaterial(U, { solo: true, seed: 0.42 }) // dark glass
      const parts = [new THREE.CylinderGeometry(9.2, 9.2, 144, 8).rotateY(PI / 8).translate(0, 72, 0), new THREE.CylinderGeometry(13.5, 9.2, 36, 8, 1).rotateY(PI / 8).translate(-5, 162, 0)]
      const metal = alb(new THREE.BoxGeometry(1.2, 116, 9).translate(-17, 138, -3), 0.28, 0.3, 0.34)
      const pad = alb(new THREE.CylinderGeometry(5.8, 5.2, 0.9, 24).translate(9, 166, 15), 0.3, 0.32, 0.36)
      const arm = alb(new THREE.BoxGeometry(3, 2.5, 12).translate(5, 164.5, 8), 0.2, 0.22, 0.25)
      const tower = new THREE.Mesh(mergeGeometries(parts.map(p => (p.deleteAttribute('uv'), p.toNonIndexed()))), g)
      const kit = new THREE.Mesh(mergeGeometries([metal, pad, arm].map(p => (p.deleteAttribute('uv'), p.toNonIndexed()))), plainMat)
      // Its lit edges (the blade's outer edge, the pad's rim), as the dive shows them, so it reads at the avenue's end.
      const led = mergeGeometries([new THREE.BoxGeometry(0.9, 116, 0.9).translate(-17.7, 138, 1.6), new THREE.TorusGeometry(5.8, 0.3, 6, 32).rotateX(PI / 2).translate(9, 166.6, 15)].map(g => (g.deleteAttribute('uv'), g.toNonIndexed())))
      const ledMesh = new THREE.Mesh(led, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.88, 1).multiplyScalar(2.2), fog: false }))
      for (const m of [tower, kit, ledMesh]) m.position.copy(TOWER), (m.frustumCulled = false), scene.add(m)
      beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(0.9, 0.95, 1).multiplyScalar(2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
      beacon.position.set(TOWER.x - 17, 197, TOWER.z - 3)
      beacon.scale.set(30, 15, 1)
      scene.add(beacon)
    }
    const avLights = lightPoints(lights, pxScale)
    scene.add(avLights)
    await step()

    // ------------------------------------------------------------ the perch: a limestone tower and its copper dome
    const lime = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.6, 0.52, 0.41), roughness: 0.85 })
    {
      const shaft = mergeGeometries([
        new THREE.BoxGeometry(PERCH.w, 168, PERCH.w).translate(0, 84, 0),
        new THREE.BoxGeometry(30, 22, 30).translate(0, 179, 0),
        new THREE.BoxGeometry(26, 15, 26).translate(0, 197.5, 0),
      ].map(g => (g.deleteAttribute('uv'), g.toNonIndexed())))
      const m = new THREE.Mesh(shaft, cityMaterial(U, { solo: true, seed: 0.06 }))
      m.position.set(PERCH.x, 0, PERCH.z)
      m.frustumCulled = false
      scene.add(m)
      // Cornices and a balustrade, in the city's light.
      const c = []
      for (const [s, y] of [[36.2, 167.2], [32, 189.2], [28, 204.2]]) c.push(alb(new THREE.BoxGeometry(s, 1.1, s).translate(0, y, 0), 0.55, 0.48, 0.38))
      for (let i = 0; i < 4; i++) for (let k = -12; k <= 12; k += 1.2) {
        const g = new THREE.BoxGeometry(0.3, 0.95, 0.3).translate(k, 205.4, 13.5).rotateY((i * PI) / 2)
        c.push(alb(g, 0.55, 0.48, 0.38))
      }
      for (let i = 0; i < 4; i++) c.push(alb(new THREE.BoxGeometry(27.6, 0.22, 0.5).translate(0, 206, 13.5).rotateY((i * PI) / 2), 0.55, 0.48, 0.38))
      const cm = new THREE.Mesh(mergeGeometries(c.map(g => (g.deleteAttribute('uv'), g.toNonIndexed()))), plainMat)
      cm.position.copy(m.position)
      cm.frustumCulled = false
      scene.add(cm)
    }
    await step()
    {
      // The drum: a ring of columns under an entablature, in stone that takes his shadow.
      const stone = []
      // (on a square plinth over the roof, so the dome rides high above the balustrade)
      stone.push(new THREE.BoxGeometry(19, 3.6, 19).translate(0, 206.8, 0).toNonIndexed())
      stone.push(new THREE.BoxGeometry(19.8, 0.5, 19.8).translate(0, 208.75, 0).toNonIndexed())
      stone.push(new THREE.CylinderGeometry(6.7, 6.9, 5.4, 40).translate(0, 211.7, 0).toNonIndexed())
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI * 2
        stone.push(new THREE.CylinderGeometry(0.3, 0.34, 4.9, 10).translate(Math.cos(a) * 7.35, 211.65, Math.sin(a) * 7.35).toNonIndexed())
      }
      stone.push(new THREE.CylinderGeometry(7.95, 7.95, 1.0, 48).translate(0, 214.6, 0).toNonIndexed())
      stone.push(new THREE.CylinderGeometry(8.1, 8.1, 0.35, 48).translate(0, 209.2, 0).toNonIndexed())
      const drum = new THREE.Mesh(mergeGeometries(stone.map(g => (g.deleteAttribute('uv'), g))), lime)
      // The dome: sixteen ribs, a lantern, its cap, a ball and the spire, the knob at its tip D.
      const prof = []
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * PI * 0.5
        prof.push(new THREE.Vector2(Math.max(0.45, 7.4 * Math.cos(a) ** 0.85), 215.1 + 9.2 * Math.sin(a)))
      }
      const dome = new THREE.LatheGeometry(prof, 96)
      {
        const pa = dome.attributes.position
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i), z = pa.getZ(i), a = Math.atan2(z, x), rib = Math.abs(Math.cos(a * 8)) ** 24
          const k = 1 + 0.05 * rib * ss(224.2, 216, pa.getY(i))
          pa.setXYZ(i, x * k, pa.getY(i), z * k)
        }
        dome.computeVertexNormals()
      }
      const cu = [
        dome,
        // (a squat lantern, its cap, the ball and a short stub of a finial: he crouches right over the dome)
        new THREE.CylinderGeometry(0.42, 0.47, 0.9, 24).translate(0, 224.6, 0),
        new THREE.CylinderGeometry(0.56, 0.56, 0.16, 24).translate(0, 225.13, 0),
        new THREE.ConeGeometry(0.5, 0.6, 24).translate(0, 225.51, 0),
        new THREE.SphereGeometry(0.19, 16, 10).translate(0, 226.0, 0),
        new THREE.CylinderGeometry(0.05, 0.08, 0.27, 10).translate(0, 226.28, 0),
        new THREE.SphereGeometry(0.12, 14, 8).scale(1, 0.8, 1).translate(0, D.y - 0.09, 0),
      ]
      const copper = new THREE.Mesh(mergeGeometries(cu.map(g => (g.index ? g.toNonIndexed() : g))), new THREE.MeshStandardMaterial({ map: copperTexture(), color: new THREE.Color(0.78, 0.8, 0.8), roughness: 0.72, metalness: 0.08 }))
      for (const m of [drum, copper]) {
        m.position.set(D.x, 0, D.z)
        m.castShadow = m.receiveShadow = true
        scene.add(m)
      }
    }
    // Birds: a flock of pigeons round the dome, gulls along the avenue.
    {
      const list = []
      for (let i = 0; i < (mobile ? 22 : 44); i++) list.push({ c: [D.x - F.x * 22 + (rnd() - 0.5) * 20, D.y - 4 + rnd() * 16, D.z - F.z * 22 + (rnd() - 0.5) * 20], o: [8 + rnd() * 18, (0.25 + rnd() * 0.25) * (rnd() < 0.8 ? 1 : -1), rnd() * 6.28, 1 + rnd() * 3] })
      for (let i = 0; i < (mobile ? 14 : 28); i++) list.push({ c: [-500 - rnd() * 700, 90 + rnd() * 80, AV + (rnd() - 0.5) * 30], o: [20 + rnd() * 40, (0.12 + rnd() * 0.12) * (rnd() < 0.5 ? 1 : -1), rnd() * 6.28, 2 + rnd() * 5] })
      scene.add(birds(U, list))
    }
    await step()

    // ------------------------------------------------------------ light
    const sun = new THREE.DirectionalLight('#ffffff', PI)
    sun.castShadow = true
    sun.shadow.mapSize.setScalar(mobile ? 1024 : 2048)
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 300 })
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.02
    const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', PI)
    // A warm key that rides with him on the web, from the lens's side and above, so the suit reads in the canyon.
    const key = new THREE.DirectionalLight(new THREE.Color(1, 0.72, 0.48), 0)
    scene.add(sun, sun.target, hemi, key, key.target)
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1, 0.8, 0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
    flare.renderOrder = 2
    scene.add(flare)

    // ------------------------------------------------------------ web lines, their splashes, the wind
    const webs = [webLine(), webLine()]
    const splash = []
    for (const w of webs) {
      scene.add(w.mesh)
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1, 0.97, 0.92), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
      s.scale.set(1e-4, 1e-4, 1)
      scene.add(s)
      splash.push(s)
    }
    const wind = windStreaks(mobile ? 70 : 140)
    scene.add(wind.lines)
    await step()

    // ------------------------------------------------------------ him, and the suit
    const you = (await traveller).make({ look: 'pbr' })
    const root = you.root
    const spreadU = { value: 0 }
    const rim = { uRimDir: { value: new THREE.Vector3() }, uRimCol: { value: new THREE.Vector3() } }
    const body = []
    root.traverse(o => {
      if (!o.isSkinnedMesh) return
      body.push(o)
      o.material.map = alohaLinear()
      spreadMaterial(o.material, spreadU, false)
    })
    scene.add(root)
    const bones = []
    root.traverse(o => o.isBone && bones.push(o))
    const restQ = new Map(bones.map(b => [b, b.quaternion.clone()]))
    root.updateMatrixWorld(true)
    // Each bone's rest direction (to its first child, or on from its parent at the chain's end).
    const restDir = new Map()
    const wp = b => b.getWorldPosition(new THREE.Vector3())
    for (const b of bones) {
      const kid = b.children.find(c => c.isBone)
      restDir.set(b, kid ? wp(kid).sub(wp(b)).normalize() : b.parent?.isBone ? wp(b).sub(wp(b.parent)).normalize() : Y.clone())
    }
    const names = Object.keys(POSES), poseQ = {}
    for (const k of names) poseQ[k] = makePose(bones, restQ, POSES[k], restDir)
    const poseSeq = POSE_AT.map(([p, k]) => [p, poseQ[k]])
    const hips = you.bone('Hips'), hipsLocal = hips.getWorldPosition(new THREE.Vector3()).sub(root.position)
    const rightHand = you.bone('RightHand'), leftHand = you.bone('LeftHand')
    const spineB = you.bone('Spine01'), headB = you.bone('Head')
    // Measure the crouch: his hips above the balls of his feet, which rest on the finial's knob.
    {
      root.quaternion.setFromAxisAngle(Y, Math.atan2(F.x, F.z))
      bones.forEach((b, i) => b.quaternion.copy(poseQ.crouch[i]))
      root.updateMatrixWorld(true)
      const toes = wp(you.bone('LeftToeBase')).add(wp(you.bone('RightToeBase'))).multiplyScalar(0.5).sub(root.position)
      HP.copy(hips.getWorldPosition(new THREE.Vector3()).sub(root.position)).sub(toes).add(new THREE.Vector3(0, 0.035, 0))
      FALL = fallKeys()
      // His right arm, two bones with the elbow out and back, aimed so the heel of his hand lands on the knob
      // just ahead of his toes (straight, if it cannot reach).
      const S = wp(you.bone('RightArm')), E = wp(you.bone('RightForeArm')), a = S.distanceTo(E), b = E.distanceTo(wp(rightHand))
      const u = toes.add(root.position).addScaledVector(F, 0.05).addScaledVector(Y, 0.1).sub(S)
      const d = Math.min(u.length(), a + b - 1e-4)
      u.normalize()
      const h = new THREE.Vector3(-1, 0, -1).applyQuaternion(root.quaternion)
      h.addScaledVector(u, -h.dot(u)).normalize()
      const ca = (a * a + d * d - b * b) / (2 * a * d)
      const upper = u.clone().multiplyScalar(ca).addScaledVector(h, Math.sqrt(Math.max(0, 1 - ca * ca)))
      const fore = S.clone().addScaledVector(u, d).sub(E.copy(S).addScaledVector(upper, a)).normalize()
      const iq = root.quaternion.clone().invert()
      POSES.crouch.RightArm = upper.applyQuaternion(iq)
      POSES.crouch.RightForeArm = fore.applyQuaternion(iq)
      makePose(bones, restQ, POSES.crouch, restDir).forEach((q, i) => poseQ.crouch[i].copy(q))
    }
    const suitScene = (await suitFile).scene
    // A phone takes the suit's 2048 px base colour at 1024: a quarter of the memory, and it never sees it closer.
    if (mobile) suitScene.traverse(o => {
      const tex = o.material?.map
      if (!tex || !(tex.image?.width > 1024)) return
      const c = document.createElement('canvas')
      c.width = c.height = 1024
      c.getContext('2d').drawImage(tex.image, 0, 0, 1024, 1024)
      tex.image = c
      tex.needsUpdate = true
    })
    const worn = wearSuit(root, suitScene)
    for (const m of worn.meshes) {
      const mat = m.material.clone()
      if (mat.map) mat.map.colorSpace = THREE.NoColorSpace
      mat.envMapIntensity = 1.1
      spreadMaterial(mat, spreadU, true, rim)
      m.material = mat
    }
    await step()

    // ------------------------------------------------------------ each frame
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qFall = new THREE.Quaternion(), qSwing = new THREE.Quaternion()
    const mB = new THREE.Matrix4(), bx_ = new THREE.Vector3(), by_ = new THREE.Vector3(), bz_ = new THREE.Vector3()
    const vel = new THREE.Vector3(), ahead = new THREE.Vector3(), tmp = new THREE.Vector3(), hand = new THREE.Vector3(), hand2 = new THREE.Vector3()
    const yawF = new THREE.Quaternion(), YAW0 = Math.atan2(F.x, F.z)
    const K1 = [0]
    // His body's orientation on the web: up along the line to his anchor, facing down the avenue.
    const uh = new THREE.Vector3()
    const upOn = (a, p, out) => out.copy(a.W).sub(hipsAt(p, uh)).normalize()
    const orient = (upDir, out) => {
      by_.copy(upDir)
      bz_.copy(FWD).addScaledVector(by_, -FWD.dot(by_)).normalize()
      bx_.crossVectors(by_, bz_)
      return out.setFromRotationMatrix(mB.makeBasis(bx_, by_, bz_))
    }
    const swingQ = (p, out, still) => {
      for (let i = 0; i < ARCS.length; i++) {
        const a = ARCS[i], n = ARCS[i + 1]
        if (p <= a.p1) return orient(upOn(a, Math.max(p, a.p0), ahead), out)
        const q1 = n ? n.p0 : 1
        if (p < q1) {
          const s = (p - a.p1) / (q1 - a.p1)
          upOn(a, a.p1, ahead)
          if (n) upOn(n, n.p0, tmp)
          else tmp.copy(FWD).multiplyScalar(0.7).add(Y).normalize()
          ahead.lerp(tmp, ss(0, 1, s)).normalize()
          orient(ahead, out)
          if (a.flip && !still) out.multiply(qb.setFromAxisAngle(X, 2 * PI * ss(0.1, 0.9, s)))
          return out
        }
      }
      return orient(tmp.copy(FWD).multiplyScalar(0.7).add(Y).normalize(), out)
    }
    let lastT = null
    run = (state, t, aspect) => {
      const p = warp(state.p ?? 0), still = !!state.still
      const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT))
      lastT = t
      renderer.getDrawingBufferSize(size)
      const tanH = Math.tan(THREE.MathUtils.degToRad(fovAt(p, still) / 2))
      pxScale.value = size.y / (2 * tanH)
      sunAt(p, U)
      // Down in the canyon: more of the sky's light on the walls (most on a phone's small, bright-room screen).
      const lift = 1 + ((mobile || state.portrait) ? 0.5 : 0.35) * ss(0.4, 0.5, p)
      U.uSkyAmb.value.multiplyScalar(lift)
      U.uGndAmb.value.multiplyScalar(lift)
      U.uT.value = t

      // Where he is, which way he moves, how he hangs.
      hipsAt(p, here)
      hipsAt(Math.min(1, p + 0.002), vel).sub(here)
      if (p > 0.998) hipsAt(p - 0.002, vel).negate().add(here)
      const speed = vel.length() / 0.002 // metres per unit of p
      if (vel.lengthSq() > 1e-10) vel.normalize()
      else vel.set(0, -1, 0)
      // (turning as he goes over, so he falls facing back up the avenue and comes upright facing down it)
      yawF.setFromAxisAngle(Y, lerp(YAW0, -PI / 2, ss(0.2, 0.32, p)))
      qFall.copy(yawF).multiply(qa.setFromAxisAngle(X, PITCH(p, K1)[0]))
      if (p < 0.4) root.quaternion.copy(qFall)
      else {
        swingQ(Math.max(p, 0.43), qSwing, still)
        root.quaternion.copy(qFall).slerp(qSwing, ss(0.4, 0.44, p))
      }
      // His limbs: the pose for p, blended from its neighbours.
      let k = 0
      while (k < poseSeq.length - 2 && poseSeq[k + 1][0] <= p) k++
      const [pa, A] = poseSeq[k], [pb, B] = poseSeq[k + 1]
      const w = ss(pa, pb, p)
      for (let i = 0; i < bones.length; i++) bones[i].quaternion.copy(A[i]).slerp(B[i], w)
      // On the perch he breathes and glances round.
      const calm = 1 - ss(0.16, 0.19, p)
      if (calm > 0 && !still) {
        spineB.quaternion.multiply(qa.setFromAxisAngle(X, 0.025 * Math.sin(t * 1.6) * calm))
        headB.quaternion.multiply(qa.setFromAxisAngle(Y, 0.22 * Math.sin(t * 0.31) * Math.sin(t * 0.17 + 1) * calm))
      }
      root.position.copy(here).sub(tmp.copy(hipsLocal).applyQuaternion(root.quaternion))
      root.updateMatrixWorld(true)

      // The suit spreads over him from the chest; once it is whole his own clothes are not drawn at all.
      const r = still ? SUIT_R : SUIT_R * ss(SUIT[0], SUIT[1], p)
      spreadU.value = r
      for (const o of body) {
        o.visible = r < SUIT_R - 1e-3
        o.castShadow = r < 0.6
      }
      for (const m of worn.meshes) m.castShadow = r >= 0.6

      // The webs: each arc's fired from his hand as the hop before it ends, taut through the arc, let go
      // at its end to go slack and fade.
      rightHand.getWorldPosition(hand)
      leftHand.getWorldPosition(hand2)
      for (let s = 0; s < 2; s++) {
        const W = webs[s].U, sp = splash[s]
        W.uAlpha.value = 0
        sp.scale.set(1e-4, 1e-4, 1)
        W.uPx.value = (2 * tanH) / size.y
        for (let i = s; i < ARCS.length; i += 2) {
          const a = ARCS[i], fire = a.p0 - 0.014
          if (p < fire || p > a.p1 + 0.04) continue
          W.uB.value.copy(a.W)
          const h = a.s < 0 ? hand : hand2
          if (p <= a.p1) {
            W.uA.value.copy(h)
            W.uLen.value = ss(fire, a.p0, p)
            W.uSag.value = 0.25
            W.uAlpha.value = 0.95
          } else {
            const g = ss(a.p1, a.p1 + 0.04, p)
            onArc(a, 1, W.uA.value).addScaledVector(Y, 0.9).lerp(a.W, g * 0.65)
            W.uLen.value = 1
            W.uSag.value = 0.25 + 6 * g
            W.uAlpha.value = 0.95 * (1 - g)
          }
          const hit = (p - a.p0) / 0.012
          if (hit > 0 && hit < 1) {
            sp.position.copy(a.W).addScaledVector(Y, 0)
            sp.position.z -= a.s * 0.4
            const sz = 3 + 5 * hit
            sp.scale.set(sz, sz * 0.5, 1)
            sp.material.opacity = 1 - hit
          }
        }
      }

      // The wind past him.
      wind.U.uC.value.copy(here)
      wind.U.uDir.value.copy(vel)
      wind.U.uSide.value.set(0, 1, 0).cross(vel)
      if (wind.U.uSide.value.lengthSq() < 1e-4) wind.U.uSide.value.set(1, 0, 0)
      wind.U.uSide.value.normalize()
      wind.U.uUp.value.crossVectors(vel, wind.U.uSide.value)
      wind.U.uLen.value = Math.min(5, speed * 0.004)
      wind.U.uRun.value = (here.x - here.y) / 40 + t * 0.12
      wind.U.uA.value = still ? 0 : 0.22 * ss(300, 1200, speed) * ss(0.2, 0.26, p)

      // The sun: its light and the one shadow (a box round him), its flare.
      sun.color.setFromVector3(U.uSunCol.value)
      sun.position.copy(here).addScaledVector(U.uSun.value, 150)
      sun.target.position.copy(here)
      sun.target.updateMatrixWorld()
      hemi.color.setFromVector3(U.uSkyAmb.value)
      hemi.groundColor.setFromVector3(U.uGndAmb.value)
      avLights.material.uniforms.uT.value = t
      avLights.material.uniforms.uOn.value = 0.4 + 0.6 * U.uDusk.value
      beacon.material.opacity = (0.3 + 0.7 * U.uDusk.value) * (0.35 + 0.65 * ss(0.5, 0.56, (t * 0.75) % 1) * (1 - ss(0.86, 0.95, (t * 0.75) % 1)))

      place(state, aspect, t)
      camera.updateMatrixWorld()
      rim.uRimDir.value.copy(U.uSun.value).transformDirection(camera.matrixWorldInverse)
      rim.uRimCol.value.copy(U.uSunCol.value).multiplyScalar(0.45 * ss(0.4, 0.45, p) * (1 - ss(0.93, 0.98, p)))
      key.intensity = 2.4 * ss(0.4, 0.45, p) * (1 - ss(0.92, 0.98, p))
      key.position.copy(camera.position).sub(here).normalize().addScaledVector(Y, 0.6).multiplyScalar(20).add(here)
      key.target.position.copy(here)
      key.target.updateMatrixWorld()
      flare.position.copy(camera.position).addScaledVector(U.uSun.value, 4000)
      const fl = ss(-0.02, 0.01, U.uSun.value.y) * light.flare
      flare.scale.set(1400 * (0.6 + 0.4 * fl), 700 * (0.6 + 0.4 * fl), 1)
      flare.material.opacity = 0.55 * fl
      skyMesh.position.copy(camera.position)
      const dusk = U.uDusk.value
      grade.bloom = 0.8 + 0.35 * dusk
      grade.threshold = 0.7 - 0.1 * dusk
      out.dream = still ? 0 : 0.3 * Math.exp(-(((p - SUIT[1] - 0.01) / 0.015) ** 2))
      return out
    }
  })()

  return { scene, camera, update: (state, t, aspect) => (run ? run(state, t, aspect) : (place(state, aspect, t), out)), get built() { return !!run } }
}

// ---------------------------------------------------------------- the light through the swing
// The sun sinks from 6.6 degrees to just over the horizon (dusk, not night: the WHIP takes it to night); its light warms from gold to deep orange and
// fades; the streets' shadow climbs the towers; the sky goes from golden-hour blue to dusk; the city's
// rooms and the ESB's crown light come on.
const SUN_EL = keyed([[0, 0.115], [0.4, 0.09], [0.7, 0.062], [0.86, 0.036], [1, 0.012]])
const C = (r, g, b) => new THREE.Vector3(r, g, b)
const PAL = [ // [elevation, sun, zenith, horizon, glow, belt, sky ambient, ground ambient]
  [0.115, C(2.6, 1.85, 1.1), C(0.2, 0.33, 0.6), C(0.98, 0.72, 0.5), C(0.9, 0.55, 0.25), C(0.85, 0.6, 0.6), C(0.3, 0.34, 0.46), C(0.24, 0.16, 0.11)],
  [0.05, C(2.4, 1.4, 0.65), C(0.15, 0.24, 0.48), C(1.0, 0.62, 0.38), C(1.0, 0.5, 0.2), C(0.85, 0.55, 0.58), C(0.25, 0.27, 0.4), C(0.21, 0.13, 0.08)],
  [0.012, C(1.7, 0.75, 0.3), C(0.09, 0.14, 0.32), C(0.95, 0.48, 0.28), C(1.0, 0.4, 0.15), C(0.7, 0.42, 0.5), C(0.22, 0.22, 0.33), C(0.17, 0.1, 0.07)],
  [-0.012, C(0.25, 0.08, 0.03), C(0.06, 0.09, 0.22), C(0.75, 0.36, 0.24), C(0.8, 0.28, 0.12), C(0.5, 0.32, 0.42), C(0.19, 0.19, 0.3), C(0.13, 0.08, 0.06)],
]
const EL = [0]
const _l = { flare: 1 }
function sunAt(p, U) {
  const el = SUN_EL(p, EL)[0]
  U.uSun.value.copy(SUN_H).multiplyScalar(Math.cos(el)).setY(Math.sin(el))
  let i = 0
  while (i < PAL.length - 2 && el < PAL[i + 1][0]) i++
  const a = PAL[i], b = PAL[i + 1], k = clamp01((a[0] - el) / (a[0] - b[0]))
  const keys = ['uSunCol', 'uZen', 'uHor', 'uGlow', 'uBelt', 'uSkyAmb', 'uGndAmb']
  keys.forEach((n, j) => U[n].value.copy(a[j + 1]).lerp(b[j + 1], k))
  U.uSunDisc.value.copy(U.uSunCol.value).multiplyScalar(2.2)
  U.uDusk.value = ss(0.55, 1, p)
  U.uShadow.value = lerp(70, 150, ss(0.1, 1, p))
  U.uEsbShadow.value = lerp(120, 260, ss(0.1, 1, p))
  U.uCrown.value = 0.12 + 0.9 * ss(0.45, 0.95, p)
  _l.flare = 1
  return _l
}
