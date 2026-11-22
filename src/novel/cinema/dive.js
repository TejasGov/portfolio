import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loadTraveller, loadClips, alohaLinear, sky, wearSuit } from './films/kit'

/*
 * Chapter Five, world 2: the dive (Iron Man). A night skyline of original glass towers over wet streets,
 * searchlights and city haze. The tallest tower has a flared glass crown, a round landing pad (the dais)
 * and a tall blade: no letters, logos or signs. He web-zips up out of the street canyon in the spider suit
 * (public/cinema/suits/spider.glb, worn on his own bones), lets go over the pad's rim, flips and lands in
 * a three-point landing (the landing world's own clip, landing/land.glb); the spider suit recedes off him
 * into his chest (a ragged, lit front: the mask first); he runs to the rim and dives off the pad, the
 * camera falling with him;
 * mid-fall a red-and-gold armour suit with a lit chest reactor flies in piece by piece and locks on, the
 * faceplate swings shut and the eyes light, thrusters at palms and feet ignite, he pulls out just above
 * the street and flies up between the towers into the storm (levelfx.js STORM).
 * The city is procedural: the towers are instanced boxes and prisms with windows drawn from world
 * position. The armour is dive/suit.glb (a Meshy model cut per bone by scripts/cinema/suit_fit.py),
 * its pieces parented to his bones (as the block world's gear is), each flying in on its own path;
 * his free-fall clip is dive/fall.glb.
 *
 * CONTRACT (world.js, timeline.js and movies.js rely on it; do not change the export or its signature)
 *   export function createDive(renderer, { loader, normalize, mobile }) -> { scene, camera, update, built }
 *     loader: the shared GLTFLoader (Meshopt + Draco). normalize(root, size, yaw): a model's meshes as
 *     one centred group scaled to `size` metres. mobile: phone-sized screen, build lighter.
 *   update(state, t, aspect) is called once per rendered frame while this world is drawn.
 *     state.p         0..1, this world's own progress (movies.js: Five's P 0.2458..0.4381), driven by
 *                     scroll: it scrubs both ways and can jump, so derive everything from p and t and keep
 *                     no one-way state. The WHIP cover parts over p 0..0.06; p 0.06..0.94 is seen clear;
 *                     the STORM cover rolls in over p 0.94..1 (whole at p = 1), so the climb into cloud
 *                     should be under way by then. The opening (zip, landing, recede, run, leap) is p 0..A
 *                     (0.3); the old fall, suit-up and climb play on from there in their own clock q
 *                     (qOf). The recede and the suit-up must be scroll-driven and reversible: each piece's
 *                     place is a pure function of p.
 *     state.onScreen  true while this world is drawn onto the cinema's screen (no longer: the swing is
 *                     Five's first world). Were it again, the p = 0 shot must match full-frame.
 *     state.still     reduced motion: no camera flourishes or shake; the spider suit is on until it cuts
 *                     off at p 0.22, the armour shows finished from the leap (p = A) on (the zip, the
 *                     landing, the fall and the flight still follow p).
 *     state.portrait  the frame is a phone's (aspect < 0.85): frame for it. Decide framing from this,
 *                     not from `aspect`: on the cinema's screen `aspect` is 2.4 and a phone sees only
 *                     the middle of that picture.
 *     state.mobile    same as the option. state.cover: 0..1, how much a transition hides the frame
 *                     (kind 'storm' | null, phase 0..1): skip work the cover hides.
 *     t               seconds, monotonic. aspect: width / height of what is being drawn; set
 *                     camera.aspect from it.
 *     Returns { here, dream, grade? }: here = a Vector3 at the traveller (world space; the same object
 *     every frame is fine); dream = 0..1 extra bloom for a held beat (0 otherwise); grade = optional
 *     overrides of GRADE.dive in movies.js ({ bloom, threshold, vignette, grain, scan }).
 *   Units: metres, y up, the street at y = 0, the traveller 1.72 m tall. The tower's roof is at ROOF;
 *   he lands on the pad (padC, its deck at ROOF - 13.75), dives off its rim and flies on along +x between the towers. Camera: a
 *   PerspectiveCamera with a 40 degree vertical fov (the hall's lens, so the push-in does not jump).
 *   Colour: the frame has no sRGB encode after tone mapping, so a hex colour reads darker and richer
 *   than on a page, and a painted canvas texture reads as painted with colorSpace NoColorSpace.
 *   Build in steps: build the set a piece at a time, yielding (await a timeout) whenever a step has run
 *   ~4 ms, and report `built` false until it is whole; until then update() only places the camera
 *   (world.js keeps the world off screen and compiles it once it is whole).
 *   Budget: the whole frame is about 5.6 ms on the desktop GPU today; keep this scene within that:
 *   at most ~150 draw calls and ~400k triangles in view (instance repeats), one shadow-casting light
 *   (2048 map, 1024 on mobile), textures at most 2048 px, no allocation or geometry rebuilds in update().
 *   world.prepare() builds this while the reader is paused late in Chapter Four, then compiles it, draws
 *   it once at p = 0 and once into the cinema screen's target: anything hidden then (visible = false) is
 *   skipped and would compile mid-scroll, so keep things that appear later in the scene, scaled to
 *   nothing, and add late-loading models to `scene` (prepare compiles again when the scene grows).
 */
export const ROOF = 180 // the tallest tower's roof
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const clamp01 = x => Math.min(1, Math.max(0, x))
const PI = Math.PI
let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

/**
 * A smooth curve through keys [p, ...values], unevenly spaced in p (cubic Hermite, Catmull-Rom slopes
 * per unit of p, flattened where a segment holds still or turns): fills `out` with the values at p.
 */
function keyed(keys) {
  const n = keys[0].length - 1, last = keys.length - 1
  const slope = (i, j) => {
    const a = keys[Math.max(0, i - 1)], c = keys[Math.min(last, i + 1)]
    return (c[j] - a[j]) / (c[0] - a[0])
  }
  return (p, out) => {
    const i = p <= keys[0][0] ? -1 : p >= keys[last][0] ? last : keys.findLastIndex(k => k[0] <= p)
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

// ---------------------------------------------------------------- his tower's crown and pad (the set below builds them)
const CROWN = 36, ROWS = 12, N = 28, SLOPE = 9, Y0 = ROOF - CROWN
// A crown ring at t (0 its foot, 1 the roof): a superellipse, square at the foot where it grows out of
// the chamfered shaft, rounder and wider toward -x and the sides as it rises.
const ring = t => {
  const rx = 8.1 + 5.8 * t ** 0.8
  return { cx: 8 - rx, rx, rz: 8.1 + 3.6 * Math.sin(t * PI * 0.5), e: 4 - 1.6 * t }
}
const ringAt = (t, k) => {
  const { cx, rx, rz, e } = ring(t), a = (k / N) * PI * 2, c = Math.cos(a), s = Math.sin(a)
  return [cx + rx * Math.sign(c) * Math.abs(c) ** (2 / e), rz * Math.sign(s) * Math.abs(s) ** (2 / e)]
}
const rise = x => SLOPE * clamp01((8 - x) / (2 * ring(1).rx)) ** 1.3 // the cap's sloped cut
// How far out from the axis the building's skin is along a horizontal direction (dx, dz) at height y.
function reach(y, dx, dz) {
  if (y < Y0) return Math.min(8 / Math.abs(dx || 1e-9), 8 / Math.abs(dz || 1e-9), 13.8 / (Math.abs(dx) + Math.abs(dz)))
  const { cx, rx, rz, e } = ring(Math.min(1, (y - Y0) / CROWN))
  let lo = 0, hi = 40
  for (let i = 0; i < 30; i++) {
    const u = (lo + hi) / 2
    if (Math.abs((u * dx - cx) / rx) ** e + Math.abs((u * dz) / rz) ** e < 1) lo = u
    else hi = u
  }
  return lo
}
// The round landing pad (the dais), cantilevered out of the crown on the +x+z side, its deck at PY + 0.25.
const npx = 0.55, npz = 0.835, PY = ROOF - 14, PR = 5.8
const pr = reach(PY, npx, npz), pd = pr + 3.2 + PR, padC = new THREE.Vector3(npx * pd, PY, npz * pd)

// ---------------------------------------------------------------- the choreography, in the dive's own p
// The opening (p 0..A) is new: he web-zips up out of the street canyon onto the pad in the spider suit,
// flips, lands, the suit recedes off him, he runs to the pad's rim and dives. From A on, the old fall,
// suit-up and climb play as they always did, in their own clock q (q = Q0 at p = A, 1 at p = 1).
const A = 0.3, Q0 = 0.19, S = (1 - A) / (1 - Q0)
const T = q => A + (q - Q0) * S // the old clock's q in the dive's p
const qOf = p => Q0 + (p - A) / S
// The opening's frame: r, the way he runs to the rim (between the pad's own outward line and +x), s across it.
const YR = 0.9, YIN = YR + PI // he runs facing r; he lands facing back along it, toward the crown
const R = new THREE.Vector3(Math.sin(YR), 0, Math.cos(YR)), SIDE = new THREE.Vector3(Math.cos(YR), 0, -Math.sin(YR))
const LAND = padC.clone().addScaledVector(R, 2.6).setY(PY + 0.25 + 0.91) // his hips, standing where he lands
const loc = (u, v, h, o = LAND) => new THREE.Vector3().copy(o).addScaledVector(R, u).addScaledVector(SIDE, v).add(new THREE.Vector3(0, h, 0)).toArray()
const off = (u, v, h) => loc(u, v, h, new THREE.Vector3())
// The web's anchor: the crown's glass lip above the pad.
const WEB = (() => { const d = Math.hypot(padC.x, padC.z), r = reach(ROOF - 1.5, padC.x / d, padC.z / d) - 0.25; return new THREE.Vector3((padC.x / d) * r, ROOF - 1.5, (padC.z / d) * r) })()
const ZIP = 0.13, TOUCH = 0.15, RECEDE = [0.19, 0.245], RUN = [0.252, 0.277] // web let go; feet down; the suit off; the run to the leap
// His hips: zipping up the web out of the canyon; let go over the rim, the flip, down on the pad; the run;
// off the rim; then the old fall (drifting in toward the face it used to fall past), the pull-out just
// above the street, up the avenue (+x) between the towers and into the storm.
const PATH = keyed([
  [0, ...loc(30, 9, -16)], [0.06, ...loc(21, 6.5, -11)], [0.09, ...loc(11.5, 3.5, -5.5)], [0.115, ...loc(3.7, 1, 0.3)],
  [ZIP, ...loc(1.9, 0.5, 2.2)], [0.14, ...loc(0.8, 0.15, 2.6)], [TOUCH, ...loc(0, 0, 0)], [RUN[0], ...loc(0, 0, 0)],
  [0.262, ...loc(0.4, 0, 0)], [0.27, ...loc(1.7, 0, 0.05)], [RUN[1], ...loc(3, 0, 0.1)], [0.283, ...loc(4.2, 0, 0.6)],
  [0.291, ...loc(5.4, 0, -0.6)], [A, ...loc(6.3, 0, -3.2)],
  ...[[0.28, 15, ROOF - 34, 11.8], [0.38, 16.4, ROOF - 64, 5.5], [0.5, 17.8, ROOF - 96, 2], [0.62, 19.2, ROOF - 127, 1], [0.72, 21.2, ROOF - 151, 1],
    [0.775, 25.5, 16, 1], [0.82, 34, 8.5, 0.8], [0.88, 56, 10, 0.4], [0.94, 84, 22, 0], [1, 110, 47, 0]].map(([q, ...v]) => [T(q), ...v]),
])
// His body: pitch (0 upright; PI/2 belly-down, head forward; more is head-first), roll about his length,
// and his heading (yaw: PI/2 faces +x). Stretched along the web; upright on the pad (the flip is added
// in update); the turn to the rim; head-first off it; then the old tumble, turning to +x.
const BODY = keyed([
  [0, 0.95, 0, YIN], [0.125, 0.95, 0, YIN], [TOUCH, 0, 0, YIN], [0.246, 0, 0, YIN], [0.258, 0, 0, YR], [0.265, 0.18, 0, YR],
  [RUN[1], 0.25, 0, YR], [0.281, 0.9, 0, YR], [0.289, 1.5, 0.1, YR],
  ...[[0.195, 2.3, 1.2, 0.25], [0.225, 2.15, 3.2, 0.6], [0.25, 1.8, 5, 0.9], [0.27, 1.57, 6.283, 1], [0.72, 1.57, 6.283, 1], [0.77, 1.42, 6.283, 1],
    [0.84, 1.5, 6.283, 1], [0.92, 1.32, 6.283, 1], [1, 0.98, 6.283, 1]].map(([q, a, b, k]) => [T(q), a, b, YR + (PI / 2 - YR) * k]),
])
// The camera: its offset, where it looks (offset from its anchor) and its roll. In the opening the anchor
// is the spot he lands on (so the wide and the landing hold still in the world); from the run it is him.
// A wide of the crown and pad as he zips up out of the canyon; on the pad's edge as he comes over the rim
// and flips; low in front of the three-point landing; close round him as the spider suit recedes; behind
// him on the run; over his shoulder off the rim and down. Then the old shots: tumbling; under him for the
// suit-up (his front faces the street), piece by piece up his body to the visor; a held three-quarter
// front of the finished suit as the eyes light and the thrusters ignite; round behind him for the climb.
const CAM = keyed([
  [0, ...off(58, 31, 7), ...off(1, 0, 1.5), 0], // the landmark wide: crown, pad and blade over the canyon he zips up out of
  [0.06, ...off(54, 29, 6), ...off(2, 0, 0.5), 0],
  [0.086, ...off(44, 23, 4), ...off(5, 1, -3), 0],
  [0.103, ...off(-1, 2.5, 3.2), ...off(9.5, 2.6, -4), 0], // up on the pad, looking down the web at him coming up out of the canyon
  [0.114, ...off(-1.6, 2.5, 3), ...off(5, 1.3, -1), 0],
  [0.125, ...off(-2.2, 2.4, 2.6), ...off(4.5, 0.6, 0.8), 0],
  [0.138, ...off(-3, 2.2, 2.2), ...off(1.4, 0.2, 1.2), 0], // the flip over the pad
  [TOUCH, ...off(-3, 1.2, 0.9), ...off(0.8, 0, -0.75), 0], // above, in front of the three-point landing: the drop and the city behind him
  [0.18, ...off(-2.7, 1, 0.8), ...off(0.7, 0, -0.7), 0],
  [0.2, ...off(-2.6, 1.3, 0.9), ...off(0.6, 0, -0.3), 0], // he rises
  [0.225, ...off(-1.95, 0.85, 0.8), ...off(0.4, 0, -0.05), 0], // close as the suit recedes
  [0.244, ...off(-2.2, -0.7, 0.85), ...off(0.4, 0, -0.15), 0],
  [0.26, ...off(-2.9, -0.8, 1.4), ...off(3, 0, -0.8), 0], // behind him as he turns and runs
  [0.272, ...off(-2.7, -0.5, 1.5), ...off(4, 0, -1.4), 0],
  [0.286, ...off(-1.8, -0.3, 2), ...off(3, 0, -3.5), 0], // off the rim: over his shoulder, the drop below
  [A, ...off(-2.1, 0.3, 3.4), ...off(1.4, 0, -1.2), 0.1],
  ...[
    [0.215, 0.8, 4.6, -0.6, 0.4, -1, 0, 0.9],
    [0.24, 3.5, 1, 4.4, 0.2, 0.1, 0, -0.3],
    [0.27, -0.3, -1.75, 2.15, -0.5, -0.25, 0, 0], // close: his body fills the frame for the leg and torso locks
    [0.34, -0.5, -1.5, 1.8, -0.45, -0.2, 0, 0],
    [0.43, 0.25, -1.6, 1.5, 0.15, -0.1, 0, 0],
    [0.55, 0.5, -2.1, 2.4, 0.2, -0.1, 0.1, 0],
    [0.65, 1.9, -1.25, 1.45, 0.6, -0.05, 0, 0],
    [0.715, 1.5, -2.3, 1.25, 0.5, 0, 0, 0], // the finished suit, three-quarter front from below at his chest: held
    [0.76, 1.7, -2.2, 1.55, 0.5, 0.05, 0, 0],
    [0.8, -3.2, 0.9, 1.6, 3, -0.3, 0.2, 0],
    [0.85, -4.6, 1.6, 1, 5, -0.4, 0, 0],
    [0.9, -5.4, 1.4, 0.8, 7, 0.8, 0, 0],
    [1, -6, -0.5, 0.8, 8, 4, 0, 0],
  ].map(([q, ...v]) => [T(q), ...v]),
])
// Where a phone looks in the opening wide: between the crown and the pad, the canyon below.
const PADKEY = new THREE.Vector3().fromArray(loc(-3.5, 2.5, 1.6)) // a key light for him on the pad
const TOWER_PHONE = new THREE.Vector3(padC.x * 0.3 - 2, ROOF - 9, padC.z * 0.3)
const PHONE_ROLL = -PI / 2 // the suit-up on a phone: his body (head along +x) stood up the frame
const FLY = 0.09 // how much of q each plate spends in the air
const VISOR = [0.68, 0.71] // the faceplate swings down, then the eyes light (in q)

// ---------------------------------------------------------------- the armour
// Its pieces in dive/suit.glb, by the bone each rides on, and the p at which each locks: boots and legs,
// then the torso, the arms, the helmet, and the visor last (the right a beat after the left), spread over
// most of the fall so every piece is seen in the air.
const SUIT = []
for (const [name, lock] of [['Foot', 0.28], ['Leg', 0.31], ['UpLeg', 0.34]]) SUIT.push({ name: 'Left' + name, lock }, { name: 'Right' + name, lock: lock + 0.01 })
SUIT.push({ name: 'Hips', lock: 0.38 }, { name: 'Spine02', lock: 0.405 }, { name: 'Spine01', lock: 0.43 }, { name: 'Spine', lock: 0.46 })
for (const [name, lock] of [['Shoulder', 0.49], ['Arm', 0.525], ['ForeArm', 0.56], ['Hand', 0.595]]) SUIT.push({ name: 'Left' + name, lock }, { name: 'Right' + name, lock: lock + 0.012 })
SUIT.push({ name: 'Head', lock: 0.645 })
for (const s of SUIT) s.bone = s.name
// The faceplate's hinge, at the top of the helmet: it swings up over it and down shut.
const FACE_C = [0, 1.62, 0]

/** The suit's own painted metal, its paint read as painted (the frame has no sRGB encode), with the
 * near-white of the reactor and the eyes lit by `glow` (a uniform: 0 dark, 1 lit, more a flash). */
function suitMaterial(src, glow) {
  const m = src.clone()
  if (m.map) m.map.colorSpace = THREE.NoColorSpace
  m.side = THREE.DoubleSide // the cuts between pieces are open
  m.envMapIntensity = 1.4
  m.onBeforeCompile = sh => {
    sh.uniforms.uGlow = glow
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow;')
      .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
        float gHi = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
        float gLit = smoothstep(0.72, 0.9, gHi) * (1.0 - smoothstep(0.12, 0.3, gHi - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b))));
        totalEmissiveRadiance += vec3(0.7, 0.88, 1.0) * gLit * uGlow * 2.5 * float(gl_FrontFacing);
        // Seen through a cut between pieces: the inside of the shell, dark like an undersuit, not the paint.
        if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.02, 0.022, 0.028);`)
  }
  m.customProgramCacheKey = () => 'dive-suit'
  return m
}

/**
 * A pose as bone-local quaternions: his rest pose with whole limbs turned (each turn a rotation in his
 * own frame, inherited by the bones below unless they name their own).
 */
function makePose(bones, rest, turns) {
  const I = new THREE.Quaternion(), world = new Map(), turn = new Map(), posed = new Map()
  return bones.map(b => {
    const w = (world.get(b.parent) ?? I).clone().multiply(rest.get(b))
    const d = turns[b.name] ?? turn.get(b.parent) ?? I
    const e = d.clone().multiply(w)
    world.set(b, w)
    turn.set(b, d)
    posed.set(b, e)
    return (posed.get(b.parent) ?? I).clone().invert().multiply(e)
  })
}
const turn = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z))
// Streamlined: arms back along his sides, palms turned to push behind him, legs long, head up to see
// ahead (the dive head-first, and the flight with the thrusters lit).
const FLIGHT = {
  Spine01: turn(-0.08, 0, 0), neck: turn(-0.3, 0, 0), Head: turn(-0.85, 0, 0),
  LeftArm: turn(0, 0, -1.32), RightArm: turn(0, 0, 1.32), LeftHand: turn(0, 0, -0.3), RightHand: turn(0, 0, 0.3),
}
// On the web: the right arm reaching up along it, the left swept back, the legs trailing, head up.
const ZIPPED = {
  neck: turn(-0.25, 0, 0), Head: turn(-0.55, 0, 0),
  RightArm: turn(-0.2, 0, -1.42), LeftArm: turn(0.55, 0, -0.95), LeftForeArm: turn(0.15, 0, -1.1),
  LeftUpLeg: turn(-0.35, 0, 0), LeftLeg: turn(0.5, 0, 0), RightUpLeg: turn(0.15, 0, 0), RightLeg: turn(0.95, 0, 0),
}
// Tucked for the flip: knees to his chest, hands at his shins, curled.
const TUCKED = {
  Spine: turn(0.3, 0, 0), Spine01: turn(0.55, 0, 0), Head: turn(0.7, 0, 0),
  LeftArm: turn(-0.9, 0, -1.25), RightArm: turn(-0.9, 0, 1.25), LeftForeArm: turn(-1.9, 0, -1.25), RightForeArm: turn(-1.9, 0, 1.25),
  LeftUpLeg: turn(-1.95, 0, 0), RightUpLeg: turn(-1.95, 0, 0), LeftLeg: turn(0.35, 0, 0), RightLeg: turn(0.35, 0, 0),
}
// A run, sampled at STRIDES phases of one cycle (two steps, RUN_LEN metres): thighs swinging, the knee
// most bent as the leg comes through, elbows bent and pumping against the legs.
const STRIDES = 8, RUN_LEN = 2.9
const runPose = f => {
  const leg = a => ({ thigh: -0.8 * Math.sin(a) - 0.08, bend: 0.25 + 1.35 * Math.max(0, Math.cos(a)) ** 1.5 })
  const l = leg(f), r = leg(f + PI), al = -0.65 * Math.sin(f), ar = -al
  return {
    Head: turn(-0.12, 0, 0),
    LeftUpLeg: turn(l.thigh, 0, 0), LeftLeg: turn(l.thigh + l.bend, 0, 0), RightUpLeg: turn(r.thigh, 0, 0), RightLeg: turn(r.thigh + r.bend, 0, 0),
    LeftArm: turn(al + 0.1, 0, -1.28), LeftForeArm: turn(al - 1.35, 0, -1.28), RightArm: turn(ar + 0.1, 0, 1.28), RightForeArm: turn(ar - 1.35, 0, 1.28),
  }
}

// The spider suit recedes off him into his chest (a nanotech dissolve): the mask peels up off his head
// from the neck, then the suit draws in from his hands and feet. The order is a distance in his rest pose
// (bind space, metres), broken into small cells so the front is ragged; the suit is drawn where it is under
// uSpider and his own body where it is over, so the two always meet on the same front.
const SPIDER_D = /* glsl */ `
  float spiderD(vec3 b) {
    float n = fract(sin(dot(floor(b * 55.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float d = b.y > 1.4 && abs(b.x) < 0.15 ? 1.5 + (1.79 - b.y) * 1.2 : length(b - vec3(0.0, 1.25, 0.1));
    return d + 0.025 * n;
  }`
// The suit's own reveal: R from fully on (2) to gone (-0.1) through the recede, the mask first.
const spiderR = x => (x <= 0 ? 2 : x >= 1 ? -0.1 : x < 0.3 ? 2.0 - (x / 0.3) * 0.5 : 1.34 - ((x - 0.3) / 0.7) * 1.44)
function spiderMaterial(src, U) {
  const m = src.clone()
  for (const k of ['map', 'emissiveMap']) if (m[k]) m[k].colorSpace = THREE.NoColorSpace // read as painted: the frame has no sRGB encode
  m.envMapIntensity = 1.1
  m.onBeforeCompile = sh => {
    sh.uniforms.uSpider = U.uSpider
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSp = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSp; uniform float uSpider;${SPIDER_D}`)
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat spD = spiderD(vSp);\nif (spD > uSpider) discard;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.75, 0.88, 1.0) * (1.0 - smoothstep(0.0, 0.018, uSpider - spD)) * step(uSpider, 1.995) * 2.2;')
  }
  m.customProgramCacheKey = () => 'dive-spider'
  return m
}

/**
 * Glass towers: night windows drawn from world position, so every box keeps true panes whatever its
 * scale. Each tower (a hash of its place) picks a facade (punched windows, ribbon glazing, fins, fine
 * grid), how lit it is, a few floors still at work, and maybe a lit band under its roof.
 */
function towerMaterial({ seed = 0.37, top = 0, hero = false } = {}) {
  return new THREE.ShaderMaterial({
    // HERO, his tower: dark mirrored glass with lit floors, floor-high panes between thin mullions that
    // wrap its curves (the horizontal measured round its axis), a glass parapet above the roof (uTop).
    defines: hero ? { HERO: '' } : {},
    side: hero ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSeed: { value: seed }, uTop: { value: top } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uSeed, uTop;
      varying vec3 vWorld; varying vec3 vN; varying float vSeed; varying float vTop;
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = m * instanceMatrix;
          vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
          vTop = instanceMatrix[3].y + length(instanceMatrix[1].xyz);
        #else
          vSeed = uSeed;
          vTop = uTop;
        #endif
        vec4 w = m * vec4(position, 1.0);
        vWorld = w.xyz;
        vN = normalize(mat3(m) * normal);
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      varying vec3 vWorld; varying vec3 vN; varying float vSeed; varying float vTop;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 n = normalize(vN);
        vec3 col = vec3(0.006, 0.008, 0.012);
        #ifdef HERO
        if (n.y < 0.5) {
          float hor = atan(vWorld.z, vWorld.x) * length(vWorld.xz);
          vec2 w = vec2(hor, vWorld.y) / vec2(1.7, 3.0), f = fract(w), id = floor(w);
          float crownY = step(vTop - 36.0, vWorld.y), parapet = step(vTop, vWorld.y);
          // The shaft: punched windows in a darker skin. The crown: one glass volume, floor-high panes.
          float pane = mix(step(0.24, f.x) * step(f.x, 0.76) * step(0.3, f.y) * step(f.y, 0.9), step(0.06, f.x) * step(f.x, 0.94) * step(0.14, f.y), crownY);
          // Lit rooms, about two in five, floor by floor: some floors busier and brighter, warm or cool.
          float fl = h2(vec2(id.y, 17.0));
          float lit = step(mix(0.5, 0.64 - 0.3 * step(0.7, fl), crownY), h2(id + 3.7)) * (1.0 - parapet);
          vec3 tint = mix(vec3(0.66, 0.8, 1.0), vec3(1.0, 0.8, 0.58), step(0.6, h2(id.yx * 0.7 + 1.3)));
          // Inside a lit room: brightest under its ceiling and toward the pane's middle, some blinds part down.
          float room = (0.4 + 0.6 * f.y) * (1.0 - 0.45 * smoothstep(0.2, 0.5, abs(f.x - 0.5))) * mix(1.0, 0.3, step(0.62, h2(id + 9.1)) * step(1.0 - 0.4 * h2(id + 2.2), f.y));
          vec3 light = lit * tint * (0.3 + 0.7 * fl) * (0.55 + 0.45 * h2(id * 1.3)) * room * mix(0.8, 1.3, crownY);
          float aa = clamp(2.0 - 3.0 * max(fwidth(w.x), fwidth(w.y)), 0.0, 1.0);
          pane = mix(0.85, pane, aa);
          // Dark glass that mirrors the night: the sky's gradient above the horizon, the city's glow below,
          // strongest at grazing angles.
          vec3 V = normalize(cameraPosition - vWorld), R = reflect(-V, n);
          float fr = 0.05 + 0.95 * pow(1.0 - max(dot(n, V), 0.0), 4.0);
          vec3 env = R.y > 0.0 ? mix(vec3(0.1, 0.13, 0.24), vec3(0.012, 0.02, 0.05), sqrt(R.y)) : mix(vec3(0.1, 0.13, 0.24), vec3(0.16, 0.1, 0.06), min(1.0, -R.y * 3.0));
          vec3 glass = vec3(0.004, 0.007, 0.016) + env * fr * 1.4;
          glass += parapet * vec3(0.03, 0.05, 0.09) * smoothstep(vTop, vTop + 10.0, vWorld.y);
          col = glass + pane * (light + (1.0 - lit) * vec3(0.006, 0.01, 0.02));
          // A dark slab line at every floor of the crown.
          col = mix(col, vec3(0.01, 0.012, 0.018), crownY * (1.0 - parapet) * (1.0 - step(0.1, f.y)) * aa);
          col += vec3(0.08, 0.045, 0.02) * exp(-vWorld.y / 20.0);
        }
        #else
        if (n.y < 0.5) {
          float style = floor(vSeed * 5.0);
          vec2 cell = style < 1.0 ? vec2(1.8, 3.6) : style < 2.0 ? vec2(1.5, 3.4) : style < 3.0 ? vec2(2.4, 3.8) : style < 4.0 ? vec2(1.1, 3.6) : vec2(1.6, 4.0);
          float hor = abs(n.x) > abs(n.z) ? vWorld.z : vWorld.x;
          vec2 w = vec2(hor, vWorld.y) / cell, f = fract(w), id = floor(w);
          float pane = style < 2.0 ? step(0.12, f.x) * step(f.x, 0.88) * step(0.18, f.y) * step(f.y, 0.84)
            : style < 3.0 ? step(0.05, fract(w.x * 2.0)) * step(0.3, f.y) * step(f.y, 0.86)
            : style < 4.0 ? step(0.32, f.x) * step(f.x, 0.68) * step(0.06, f.y) * step(f.y, 0.94)
            : step(0.08, f.x) * step(f.x, 0.92) * step(0.1, f.y) * step(f.y, 0.9);
          float dark = step(0.86, fract(vSeed * 13.7)); // a few towers stand mostly dark
          float lit = step(0.6 - 0.3 * fract(vSeed * 7.3) + 0.32 * dark, h2(id + vSeed * 91.0));
          float work = step(0.95, h2(vec2(id.y * 1.3, vSeed * 57.0))) * (1.0 - dark); // whole floors still at work
          vec3 warm = mix(vec3(1.0, 0.66, 0.36), vec3(0.72, 0.85, 1.0), step(0.62, h2(id.yx + vSeed)));
          // Inside a lit room: brighter under its ceiling, some blinds half down.
          float room = (0.45 + 0.55 * f.y) * mix(1.0, 0.55 + 0.45 * step(0.5, fract(f.y * 9.0)), step(0.7, h2(id + 3.1)));
          vec3 light = mix(lit * warm * (0.25 + 0.85 * h2(id * 1.7)), vec3(0.78, 0.9, 1.0) * 1.15, work) * room;
          // Far off, a pane is smaller than a pixel: blend to its average instead of shimmering.
          float aa = clamp(2.0 - 3.0 * max(fwidth(w.x), fwidth(w.y)), 0.0, 1.0);
          pane = mix(0.5, pane, aa);
          light = mix(warm * (0.3 - 0.12 * dark) * 0.7, light, aa);
          // Dark glass catching the sky's glow toward the top, and a soft sheen of it across each face.
          vec3 glass = mix(vec3(0.005, 0.008, 0.016), vec3(0.024, 0.04, 0.075), smoothstep(0.0, 220.0, vWorld.y));
          glass += vec3(0.012, 0.02, 0.04) * smoothstep(0.55, 1.0, fract(hor / 41.0 + vSeed * 3.0));
          col = glass + pane * (light + (1.0 - max(lit, work)) * vec3(0.008, 0.013, 0.026));
          // A lit band under the roof on some towers.
          col += step(0.55, fract(vSeed * 3.1)) * step(vTop - 2.6, vWorld.y) * step(vWorld.y, vTop - 1.4) * vec3(0.7, 0.86, 1.0) * 1.5;
          // The street's sodium glow washing up the lowest floors.
          col += vec3(0.08, 0.045, 0.02) * exp(-vWorld.y / 20.0);
        }
        #endif
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  })
}

// ---------------------------------------------------------------- light, haze and motion, as shaders
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
const fogged = extra => THREE.UniformsUtils.merge([THREE.UniformsLib.fog, extra])

/** Lights as glowing points (street lamps, aircraft warnings that blink), sized in metres, with a faint
 * horizontal lens streak through each. */
function lightPoints(list, scale) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(list.flatMap(l => l.p), 3))
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(list.flatMap(l => l.c), 3))
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(list.map(l => l.s), 1))
  g.setAttribute('aBlink', new THREE.Float32BufferAttribute(list.map(l => l.b ?? -1), 1))
  const m = new THREE.ShaderMaterial({
    uniforms: fogged({ uT: { value: 0 }, uScale: scale }),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec3 aCol; attribute float aSize; attribute float aBlink;
      uniform float uT, uScale;
      varying vec3 vCol;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float on = aBlink < 0.0 ? 1.0 : smoothstep(0.5, 0.56, fract(uT * 0.75 + aBlink)) * (1.0 - smoothstep(0.86, 0.95, fract(uT * 0.75 + aBlink)));
        float px = aSize * uScale / max(1.0, -mvPosition.z);
        // Below two pixels a light flickers: keep it two wide and dim it by the area it lost.
        vCol = aCol * on * min(1.0, px * px / 4.0);
        gl_PointSize = max(px, 2.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      varying vec3 vCol;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q) * 2.0;
        float glow = exp(-r * r * 7.0) + exp(-abs(q.y) * 70.0) * max(0.0, 1.0 - abs(q.x) * 2.0) * 0.4;
        gl_FragColor = vec4(vCol * glow, 1.0);
        #ifdef USE_FOG
          gl_FragColor.rgb *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth); // fade into the haze, adding none of it
        #endif
      }`,
    fog: true,
    ...ADD,
  })
  const pts = new THREE.Points(g, m)
  pts.frustumCulled = false
  return pts
}

/** Traffic far below as long-exposure streaks: white one way, red the other, along every street. */
function traffic(lanes, count) {
  const base = new THREE.PlaneGeometry(1, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  g.setAttribute('position', base.attributes.position)
  const A = [], B = []
  for (let i = 0; i < count; i++) {
    const [x0, z0, dx, dz, len, white] = lanes[Math.floor(rnd() * lanes.length)]
    A.push(x0, z0, dx, dz)
    B.push(len, rnd() * len, 9 + rnd() * 14, white)
  }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(A), 4))
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(B), 4))
  g.instanceCount = count
  const m = new THREE.ShaderMaterial({
    uniforms: fogged({ uT: { value: 0 } }),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aA; attribute vec4 aB;
      uniform float uT;
      varying float vU; varying float vWhite;
      void main() {
        float s = mod(aB.y + aB.z * uT, aB.x);
        vec3 dir = vec3(aA.z, 0.0, aA.w), side = vec3(-aA.w, 0.0, aA.z);
        vec3 p = vec3(aA.x, 0.25, aA.y) + dir * (s + position.x * 24.0) + side * position.y * 0.35;
        vU = position.x + 0.5;
        vWhite = aB.w;
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      varying float vU; varying float vWhite;
      void main() {
        vec3 c = mix(vec3(1.0, 0.1, 0.04) * 1.3, vec3(1.0, 0.88, 0.7) * 1.6, vWhite);
        gl_FragColor = vec4(c * vU * vU, 1.0);
        #ifdef USE_FOG
          gl_FragColor.rgb *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth); // fade into the haze, adding none of it
        #endif
      }`,
    fog: true,
    side: THREE.DoubleSide,
    ...ADD,
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.frustumCulled = false
  return mesh
}

/** A searchlight's beam: a long soft cone, brightest through its middle, fading up into the haze. */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0.16 } },
    vertexShader: /* glsl */ `
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main() {
        vY = position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uI;
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main() {
        float core = pow(min(1.0, abs(dot(normalize(vN), normalize(vV)))), 2.5);
        float a = core * pow(clamp(1.0 - vY, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.01, vY) * uI;
        gl_FragColor = vec4(vec3(0.62, 0.72, 0.9) * a, 1.0);
      }`,
    side: THREE.DoubleSide,
    ...ADD,
  })
}

/** City haze: a soft, slowly drifting sheet of lit smog, seen through on the way down. */
function hazeMaterial(color, alpha) {
  return new THREE.ShaderMaterial({
    uniforms: fogged({ uT: { value: 0 }, uC: { value: new THREE.Color(...color) }, uA: { value: alpha } }),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vXZ;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uT, uA; uniform vec3 uC;
      varying vec2 vXZ;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.0), f.x), f.y); }
      void main() {
        vec2 p = vXZ * 0.006 + vec2(uT * 0.004, uT * 0.002);
        float d = n(p) * 0.6 + n(p * 2.3 + 7.0) * 0.4;
        float a = uA * smoothstep(0.3, 0.85, d);
        gl_FragColor = vec4(uC, a);
        #include <fog_fragment>
        gl_FragColor.a *= 1.0 - fogFactor * 0.6;
      }`,
    fog: true,
    transparent: true,
    depthWrite: false,
  })
}

/** Wind streaks round him: thin lines left behind as he falls and flies, longer the faster he goes. */
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
        float along = (fract(aOff.y * 0.5 + 0.5 - uRun) - 0.5) * 50.0;
        vec2 r = aOff.xz * 11.0;
        r += normalize(r + 0.001) * 1.6; // never through him
        vec3 p = uC + uSide * r.x + uUp * r.y + uDir * (along - aEnd * uLen);
        vA = uA * (1.0 - abs(along) / 25.0) * (0.4 + 0.6 * fract(aOff.x * 7.0));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { gl_FragColor = vec4(vec3(0.6, 0.72, 0.9) * vA, 1.0); }`,
    ...ADD,
  })
  const lines = new THREE.LineSegments(g, m)
  lines.frustumCulled = false
  return { lines, U }
}

/** A soft round glow with an anamorphic streak through it: lens flares on the brightest lights. */
let flareTex = null
function flare() {
  if (flareTex) return flareTex
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')
  let grad = g.createRadialGradient(128, 64, 0, 128, 64, 60)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.12, 'rgba(255,255,255,0.55)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.12)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 128)
  grad = g.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.8)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 62, 256, 4)
  g.globalAlpha = 0.35
  g.fillRect(0, 59, 256, 10)
  flareTex = new THREE.CanvasTexture(c)
  flareTex.colorSpace = THREE.NoColorSpace
  return flareTex
}
const flareSprite = (color, w) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flare(), color, ...ADD, fog: false }))
  s.scale.set(w, w / 2, 1)
  s.frustumCulled = false
  return s
}

/** Sparks off a plate as it locks: each plate's burst flies out and is left behind (drifting up) as he
 * falls on; its age is a function of p, so it scrubs both ways. And the glow of each plate in flight. */
function sparks(pieces, perPiece, scale) {
  const n = pieces * perPiece
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  const piece = [], dir = [], sd = []
  for (let i = 0; i < n; i++) {
    piece.push(Math.floor(i / perPiece))
    const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize()
    dir.push(v.x, v.y, v.z)
    sd.push(rnd())
  }
  g.setAttribute('aPiece', new THREE.Float32BufferAttribute(piece, 1))
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3))
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1))
  const U = { uAt: { value: Array.from({ length: pieces }, () => new THREE.Vector3()) }, uAge: { value: new Float32Array(pieces) }, uScale: scale }
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      uniform vec3 uAt[${pieces}]; uniform float uAge[${pieces}]; uniform float uScale;
      attribute float aPiece; attribute vec3 aDir; attribute float aSeed;
      varying float vHot;
      void main() {
        int i = int(aPiece + 0.5);
        float age = uAge[i];
        float a = clamp(age * (0.75 + 0.5 * aSeed), 0.0, 1.0);
        vec3 p = uAt[i] + aDir * (0.12 + 0.9 * aSeed) * (1.0 - pow(1.0 - a, 3.0)) + vec3(0.0, 1.0, 0.0) * a * a * 1.6;
        vHot = (age > 0.0 && age < 1.0) ? 1.0 - a : 0.0;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = vHot > 0.0 ? (0.012 + 0.03 * vHot) * uScale / max(0.3, -mv.z) : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      varying float vHot;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(mix(vec3(0.5, 0.75, 1.0), vec3(1.0, 0.95, 0.85), vHot) * exp(-r * r * 4.0) * (1.5 + 4.0 * vHot), 1.0);
      }`,
    ...ADD,
  })
  const pts = new THREE.Points(g, m)
  pts.frustumCulled = false
  return { pts, U }
}

/** A thruster's jet: a cone of light from palm or sole, white at its root and blue at its tail. */
function jetMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main() {
        vY = -position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uHeat, uT;
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main() {
        float core = pow(min(1.0, abs(dot(normalize(vN), normalize(vV)))), 1.6);
        float tail = pow(clamp(1.0 - vY, 0.0, 1.0), 2.0);
        float flick = 0.82 + 0.18 * sin(uT * 70.0 - vY * 40.0);
        vec3 c = mix(vec3(1.0, 0.98, 0.95), vec3(0.35, 0.62, 1.0), smoothstep(0.0, 0.45, vY));
        gl_FragColor = vec4(c * core * tail * flick * uHeat * 3.0, 1.0);
      }`,
    side: THREE.DoubleSide,
    ...ADD,
  })
}

// His undersuit: from the feet up, a dark ribbed weave spreads over him ahead of the plates, its front
// edge lit. The order follows his rest pose (vertex position before skinning), in the dive's own p.
// Under a locked plate he is gone: each vertex follows its strongest bone, and once that bone's plate
// (lock, per skeleton bone) has locked, nothing of him there is drawn, so no shirt or skin pokes through.
function undersuit(material, U, lock) {
  material.onBeforeCompile = sh => {
    sh.uniforms.uSuit = U.uSuit
    sh.uniforms.uSpider = U.uSpider
    sh.uniforms.uLock = { value: lock }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vBind; varying float vGone; uniform float uSuit; uniform float uLock[${lock.length}];`)
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        vBind = position;
        float bi = skinIndex.x, bw = skinWeight.x;
        if (skinWeight.y > bw) { bw = skinWeight.y; bi = skinIndex.y; }
        if (skinWeight.z > bw) { bw = skinWeight.z; bi = skinIndex.z; }
        if (skinWeight.w > bw) bi = skinIndex.w;
        vGone = step(uLock[int(bi + 0.5)], uSuit);`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec3 vBind; varying float vGone; uniform float uSuit; uniform float uSpider;${SPIDER_D}
        float suitOrder(vec3 b) {
          float ax = abs(b.x);
          if (b.y > 1.38 && ax < 0.16) return (b.z > 0.05 && b.y > 1.44 && b.y < 1.69) ? 9.0 : 0.6 + (b.y - 1.38) * 0.1; // the face waits for the visor
          if (ax > 0.19 && b.y > 1.08) return 0.45 + (ax - 0.19) * 0.22;
          if (b.y < 0.95) return 0.23 + b.y * 0.09;
          return 0.335 + (b.y - 0.95) * 0.2;
        }`)
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
        if (vGone > 0.5 || spiderD(vBind) < uSpider) discard; // under a locked plate, or still under the spider suit
        float sOrd = suitOrder(vBind);
        float sOn = smoothstep(sOrd, sOrd + 0.006, uSuit);
        float sEdge = smoothstep(sOrd - 0.005, sOrd, uSuit) * (1.0 - sOn);
        float rib = 0.7 + 0.3 * step(0.5, fract(vBind.y * 90.0 + 0.5 * step(0.5, fract(vBind.x * 45.0))));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.028, 0.032, 0.04) * rib, sOn);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.36, sOn);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.65, sOn);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.55, 0.82, 1.0) * sEdge * 5.0;')
  }
  material.customProgramCacheKey = () => 'dive-undersuit'
}

export function createDive(renderer, { loader, mobile = false }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1600)
  scene.add(camera)
  let run = null
  const at = new THREE.Vector3(), cam = new THREE.Vector3(), look = new THREE.Vector3()
  const K3 = [0, 0, 0], K7 = [0, 0, 0, 0, 0, 0, 0]
  const out = { here: at, dream: 0 }
  // The camera alone, before the world is whole: the first shot, so prepare's draw is the real one.
  const anchor = new THREE.Vector3()
  const place = (p, portrait, aspect, still) => {
    CAM(p, K7)
    const q = qOf(p)
    // The anchor the camera's keys hang from: the spot he lands on, then him from the run on.
    anchor.copy(LAND).lerp(at, ss(0.246, 0.292, p))
    // A phone sees only the middle of the frame. From the zip up the web to the suit-up it stands further
    // back and looks right at him, and while he lies flat for the suit-up the frame turns a quarter so
    // his length runs up the tall frame.
    const near = portrait ? ss(0.088, 0.105, p) : 0, flat = portrait ? ss(0.235, 0.265, q) * (1 - ss(0.715, 0.76, q)) : 0
    const k = portrait ? 1.35 + 0.35 * Math.max(near * (1 - ss(0.27, 0.31, p)), flat) : 1
    cam.set(K7[0], K7[1], K7[2]).multiplyScalar(k).add(anchor)
    cam.y = Math.max(1.5, cam.y)
    look.set(K7[3], K7[4], K7[5]).add(anchor)
    if (portrait) look.lerp(at, (0.8 + 0.2 * flat) * near)
    if (portrait && p < 0.1) look.lerp(TOWER_PHONE, 1 - near) // or, in the wide, his tower: crown and pad, the canyon below
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    camera.up.set(0, 1, 0)
    camera.position.copy(cam)
    camera.lookAt(look)
    camera.rotateZ((still ? 0 : K7[6]) + flat * PHONE_ROLL)
  }
  const hold = (state, aspect) => {
    at.fromArray(PATH(state.p ?? 0, K3))
    place(state.p ?? 0, !!state.portrait, aspect, true)
    return out
  }
  ;(async () => {
    let t0 = performance.now()
    const step = async () => {
      if (performance.now() - t0 < 4) return
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }
    const traveller = loadTraveller(loader), clips = loadClips(loader, '/cinema/dive/fall.glb'), suitFile = loader.loadAsync('/cinema/dive/suit.glb')
    // The opening: the spider suit (scripts/cinema/suit_skin.py) and the three-point landing (the landing's own clip, as recorded).
    const spiderFile = loader.loadAsync('/cinema/suits/spider.glb'), landFile = loader.loadAsync('/cinema/landing/land.glb')
    // Pixels per metre at one metre away, for lights sized in metres (set each frame from the drawing size).
    const pxScale = { value: 900 }, size = new THREE.Vector2()
    scene.fog = new THREE.FogExp2('#0c1527', mobile ? 0.0024 : 0.002)
    const dome = sky({ top: '#01030a', mid: '#08122a', low: '#2a3352', sunDir: new THREE.Vector3(0.6, 0.1, -1), sun: '#9fb8ff' })
    scene.add(dome)
    // The night itself lights the metal: an environment of the sky, the city's warm glow below and a
    // few cool light strips, so the armour has something to reflect.
    {
      const env = new THREE.Scene()
      env.add(sky({ top: '#02040c', mid: '#0b1631', low: '#3a3346', sunDir: new THREE.Vector3(0.6, 0.1, -1), sun: '#9fb8ff' }))
      const glow = new THREE.Mesh(new THREE.CircleGeometry(160, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.17, 0.13, 0.1) }))
      glow.position.y = -40
      env.add(glow)
      for (let i = 0; i < 7; i++) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(50, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.9, 1).multiplyScalar(2.2), side: THREE.DoubleSide }))
        const a = (i / 7) * PI * 2, e = 0.15 + (i % 3) * 0.22
        s.position.set(Math.cos(a) * 120 * Math.cos(e), Math.sin(e) * 120, Math.sin(a) * 120 * Math.cos(e))
        s.lookAt(0, 0, 0)
        env.add(s)
      }
      // Its own frame, before and after: the six-face render and blur are the build's heaviest step.
      await new Promise(r => setTimeout(r))
      const pm = new THREE.PMREMGenerator(renderer)
      scene.environment = pm.fromScene(env, 0, 0.1, 400, { size: 128 }).texture
      scene.environmentIntensity = 0.85
      pm.dispose()
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }
    await step()

    // ------------------------------------------------------------ the skyline
    // Blocks on a 34 m grid with streets between; the avenue (z = 0) runs out along +x from the plaza
    // round his tower at the origin.
    const mats = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3()
    const recs = []
    for (let x = -170; x <= 460; x += 34) for (let z = -306; z <= 170; z += 34) {
      if (z === 0 && x > -60) continue // the avenue
      if (Math.abs(x) < 40 && Math.abs(z) < 40) continue // his tower's plaza
      const avenue = Math.abs(z) === 34 && x > -60
      const fall = Math.max(0.22, 1 - Math.hypot(x - 70, z + 40) / 430)
      const h = avenue ? 40 + rnd() * 115 : 20 + rnd() ** 1.5 * 145 * fall
      const r = { x: x + (rnd() - 0.5) * 5, z: z + (rnd() - 0.5) * 5, w: 14 + rnd() * (avenue ? 7 : 9), d: 14 + rnd() * (avenue ? 6 : 9), h: Math.min(h, 166), round: !avenue && rnd() < 0.1 }
      // Low-rise along the opening wide's line of sight (from up the avenue to his tower), so nothing stands in front of it.
      const u = clamp01((r.x * 112 - r.z * 110) / (112 * 112 + 110 * 110))
      if (Math.hypot(r.x - 112 * u, r.z + 110 * u) < 30) r.h = Math.min(r.h, 34 + 20 * rnd())
      recs.push(r)
    }
    const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const glassMat = towerMaterial()
    const boxes = recs.filter(r => !r.round), rounds = recs.filter(r => r.round), tiers = []
    for (const r of boxes) {
      r.top = r.h
      if (r.h > 60 && rnd() < 0.55) {
        tiers.push([r.x, r.h, r.z, r.w * 0.7, r.h * 0.2, r.d * 0.7])
        r.top = r.h * 1.2
        r.tw = r.w * 0.7
        if (rnd() < 0.4) {
          tiers.push([r.x, r.top, r.z, r.w * 0.45, r.h * 0.1, r.d * 0.45])
          r.top = r.h * 1.3
          r.tw = r.w * 0.45
        }
      }
    }
    const inst = (geo, mat, list, put) => {
      const m = new THREE.InstancedMesh(geo, mat, list.length)
      list.forEach((r, i) => m.setMatrixAt(i, put(r)))
      m.frustumCulled = false
      scene.add(m)
      return m
    }
    inst(unit, glassMat, boxes, r => mats.compose(pos.set(r.x, 0, r.z), q, sc.set(r.w, r.h, r.d)))
    inst(unit, glassMat, tiers, ([x, y, z, w, h, d]) => mats.compose(pos.set(x, y, z), q, sc.set(w, h, d)))
    inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 14).translate(0, 0.5, 0), glassMat, rounds, r => mats.compose(pos.set(r.x, 0, r.z), q, sc.set(r.w, (r.top = r.h), r.w)))
    await step()
    // Roofs: plant boxes, masts with blinking warning lights; red lights on the corners of the tallest.
    const plant = new THREE.MeshStandardMaterial({ color: '#191c22', roughness: 0.75, metalness: 0.3 })
    const kit = [], masts = [], lights = []
    for (const r of recs) {
      const span = (r.tw ?? r.w) * 0.32
      for (let k = 0; k < 2; k++) kit.push([r.x + (rnd() - 0.5) * span, r.top, r.z + (rnd() - 0.5) * span, 2 + rnd() * 3.5, 1.2 + rnd() * 2.2, 2 + rnd() * 3.5])
      if (r.h > 70 && rnd() < 0.35) {
        const mh = 8 + rnd() * 12
        masts.push([r.x, r.top, r.z, mh])
        lights.push({ p: [r.x, r.top + mh + 0.4, r.z], c: [1, 0.1, 0.06], s: 1.6, b: rnd() })
      }
      if (r.top > 100) for (const s of [-1, 1]) lights.push({ p: [r.x + s * (r.tw ?? r.w) * 0.48, r.top + 0.5, r.z + s * (r.tw ?? r.w) * 0.48], c: [1, 0.12, 0.06], s: 1.2, b: rnd() })
    }
    inst(unit, plant, kit, ([x, y, z, w, h, d]) => mats.compose(pos.set(x, y, z), q, sc.set(w, h, d)))
    inst(new THREE.CylinderGeometry(0.12, 0.2, 1, 6).translate(0, 0.5, 0), plant, masts, ([x, y, z, h]) => mats.compose(pos.set(x, y, z), q, sc.set(1, h, 1)))
    await step()

    // ------------------------------------------------------------ his tower
    // The skyline's landmark: a chamfered glass shaft that swells into a faceted glass crown, leaning out
    // toward -x in lit terraces and cut on a slope (a glass parapet round the roof, rising on that side); a
    // round landing pad cantilevered out at the crown's lower lip; and a wide solid blade hugging the -x
    // face from far down the shaft, rising past the roof, its outer edge lit and a white light at its tip.
    // No letters or marks.
    // The crown's +x edge stays at x = 8, where he stands, so his fall down that face stays clear.
    const chamfer = (w, c) => {
      const s = new THREE.Shape(), h = w / 2
      s.moveTo(-h + c, -h)
      for (const [x, y] of [[h - c, -h], [h, -h + c], [h, h - c], [h - c, h], [-h + c, h], [-h, h - c], [-h, -h + c]]) s.lineTo(x, y)
      return s
    }
    const prism = (w, c, h, x, y) => new THREE.ExtrudeGeometry(chamfer(w, c), { depth: h, bevelEnabled: false }).rotateX(-PI / 2).translate(x, y, 0)
    const heroGlass = towerMaterial({ seed: 0.3, top: ROOF, hero: true })
    // The crown's skin: rings a floor apart, faceted, the last one the parapet's sloped top.
    const rows = []
    for (let j = 0; j <= ROWS + 1; j++) rows.push(Array.from({ length: N }, (_, k) => {
      const [x, z] = ringAt(Math.min(1, j / ROWS), k)
      return [x, j > ROWS ? ROOF + rise(x) : Y0 + (j * CROWN) / ROWS, z]
    }))
    const shell = []
    for (let j = 0; j < ROWS + 1; j++) for (let k = 0; k < N; k++) {
      const a = rows[j][k], b = rows[j][(k + 1) % N], c = rows[j + 1][(k + 1) % N], d = rows[j + 1][k]
      shell.push(...a, ...c, ...b, ...a, ...d, ...c)
    }
    const hull = new THREE.BufferGeometry()
    hull.setAttribute('position', new THREE.Float32BufferAttribute(shell, 3))
    hull.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((shell.length / 3) * 2), 2))
    hull.computeVertexNormals()
    scene.add(new THREE.Mesh(mergeGeometries([prism(16, 2.2, Y0, 0, 0), hull]), heroGlass))
    // The blade: drawn in (out from the axis, y), stood in the plane along (bx, bz), a little off the -x
    // axis toward -z so the avenue sees it in profile. Its inner edge rides the skin to the tip; it is
    // widest through the crown and rises a little past the roof, its top cut on a slant.
    const BETA = 0.45, bx = -Math.cos(BETA), bz = -Math.sin(BETA), B0 = ROOF - 100, B1 = ROOF + 16
    const bIn = [], bOut = []
    for (let i = 0; i <= 40; i++) {
      const s = i / 40, yi = B0 + s * (B1 - 8 - B0), yo = B0 + s * (B1 - B0)
      const r = reach(Math.min(yi, ROOF), bx, bz) - 0.3
      bIn.push(new THREE.Vector2(r, yi))
      bOut.push(new THREE.Vector2(r + 3 + 9 * ss(0, 0.55, s) - 8 * ss(0.75, 1, s), yo))
    }
    const bladeGeo = new THREE.ExtrudeGeometry(new THREE.Shape([...bOut, ...[...bIn].reverse()]), { depth: 1.2, bevelEnabled: false }).translate(0, 0, -0.6).rotateY(PI - BETA)
    // The pad, near the crown's lower lip, cantilevered out across the avenue's line of sight (so it breaks
    // the crown's outline in the opening wide) on a deep tapered arm with a lit underside.
    const arm =new THREE.Shape([new THREE.Vector2(pr - 1, PY + 0.25), new THREE.Vector2(pd - PR + 1, PY + 0.25), new THREE.Vector2(pd - PR + 1, PY - 0.9), new THREE.Vector2(pr - 1, PY - 5.2)])
    const metal = new THREE.MeshStandardMaterial({ color: '#3a414d', metalness: 0.8, roughness: 0.3, emissive: '#141a26' })
    // The blade's own satin metal, lit by the city so its face reads against the night.
    scene.add(new THREE.Mesh(bladeGeo, new THREE.MeshStandardMaterial({ color: '#66728a', metalness: 0.5, roughness: 0.36, emissive: '#34476a' })))
    scene.add(new THREE.Mesh(new THREE.ExtrudeGeometry(arm, { depth: 3.4, bevelEnabled: false }).translate(0, 0, -1.7).rotateY(Math.atan2(-npz, npx)), metal))
    // Terraces: four floor slabs on the crown's -x side, each reaching further out than the one below, so
    // the top leans out in steps (they stop short of the blade).
    const ledges = [], ledgeEdges = []
    for (const [t, m] of [[0.5, 1.1], [0.64, 1.8], [0.78, 2.5], [0.92, 3.2]]) for (const [a0, a1] of [[0.25, 0.535], [0.6, 0.75]]) {
      const y = Y0 + t * CROWN, { cx } = ring(t), outer = [], inner = []
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, [x, z] = ringAt(t, N * (a0 + (a1 - a0) * u)), dx = x - cx, dl = Math.hypot(dx, z), bell = Math.sin(PI * u) ** 0.6
        outer.push([x + (dx / dl) * m * bell, z + (z / dl) * m * bell])
        inner.push([x - (dx / dl) * 0.6, z - (z / dl) * 0.6])
      }
      ledges.push(new THREE.ExtrudeGeometry(new THREE.Shape([...outer, ...inner.reverse()].map(([x, z]) => new THREE.Vector2(x, -z))), { depth: 0.6, bevelEnabled: false }).rotateX(-PI / 2).translate(0, y - 0.6, 0))
      ledgeEdges.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outer.map(([x, z]) => new THREE.Vector3(x, y - 0.62, z))), 48, 0.11, 5))
    }
    // Decks: the roof he stands on (its top is the roof), the pad's and the terraces, pale and lit.
    const deckMat = new THREE.MeshStandardMaterial({ color: '#7a8290', roughness: 0.8, metalness: 0.2, emissive: '#232c3e' })
    scene.add(new THREE.Mesh(mergeGeometries([
      new THREE.ExtrudeGeometry(new THREE.Shape(rows[ROWS].map(([x, , z]) => new THREE.Vector2(x, -z))), { depth: 0.4, bevelEnabled: false }).rotateX(-PI / 2).translate(0, ROOF - 0.4, 0),
      new THREE.CylinderGeometry(PR, PR - 0.6, 0.9, 48).translate(padC.x, PY - 0.2, padC.z).toNonIndexed(), // (extrusions are unindexed)
      ...ledges,
    ]), deckMat))
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * PI * 2
      lights.push({ p: [padC.x + Math.cos(a) * (PR - 0.3), PY + 0.4, padC.z + Math.sin(a) * (PR - 0.3)], c: [0.55, 0.75, 1], s: 0.35 })
    }
    for (let i = 0; i < 6; i++) for (const z of [-3.5, 3.5]) lights.push({ p: [5.5 - i * 2.6, ROOF + 0.06, z], c: [0.4, 0.55, 0.8], s: 0.22 })
    // Light: a strip down the blade's whole outer face, the shaft's corners, the pad's rim, the arm's
    // underside and the terraces' edges (bright); the cap's sloped top edge, the roof's rim (dim).
    const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.87, 1).multiplyScalar(1.8) })
    const strips = [
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bOut.map(v => new THREE.Vector3((v.x + 0.2) * bx, v.y, (v.x + 0.2) * bz))), 80, mobile ? 0.55 : 0.4, 6),
      new THREE.TorusGeometry(PR, 0.2, 6, 64).rotateX(PI / 2).translate(padC.x, PY + 0.28, padC.z),
      new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(npx * (pr - 0.5), PY - 5.2, npz * (pr - 0.5)), new THREE.Vector3(npx * (pd - PR + 1), PY - 0.95, npz * (pd - PR + 1))), 4, 0.14, 6),
      ...ledgeEdges,
    ]
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) strips.push(new THREE.BoxGeometry(0.16, 46, 0.16).rotateY(PI / 4).translate(sx * 6.95, Y0 - 23, sz * 6.95))
    scene.add(new THREE.Mesh(mergeGeometries(strips), led))
    // (and one hairline where the crown's glass meets the shaft)
    const rim = row => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(row.map(([x, y, z]) => new THREE.Vector3(x, y + 0.03, z)), true, 'catmullrom', 0.1), N * 6, 0.05, 5, true)
    scene.add(new THREE.Mesh(mergeGeometries([rim(rows[ROWS + 1]), rim(rows[0])]), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.78, 1).multiplyScalar(0.55) })))
    const tip = bOut[bOut.length - 1], tipAt = [tip.x * bx, B1 + 0.5, tip.x * bz]
    const beacon = flareSprite(new THREE.Color(0.85, 0.92, 1).multiplyScalar(1.6), 7)
    beacon.position.fromArray(tipAt)
    lights.push({ p: tipAt, c: [0.85, 0.92, 1], s: 1.2, b: 0.3 })
    scene.add(beacon)
    await step()

    // ------------------------------------------------------------ the street
    // Wet asphalt reflecting the night; lamps down every street, pools of light on the avenue, traffic.
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ color: '#040508', roughness: 0.22, metalness: 0.15 })))
    const lanes = []
    const X0 = -190, X1 = 480, Z0 = -330, Z1 = 190
    for (let z = -289; z <= 170; z += 34) for (const s of [-1, 1]) lanes.push([s > 0 ? X0 : X1, z + s * 1.6, s, 0, X1 - X0, s > 0 ? 1 : 0])
    for (let x = -153; x <= 460; x += 34) for (const s of [-1, 1]) lanes.push([x + s * 1.6, s > 0 ? Z0 : Z1, 0, s, Z1 - Z0, s > 0 ? 1 : 0])
    for (const z of [-8, -4, 4, 8]) for (let k = 0; k < 4; k++) lanes.push([z < 0 ? -40 : X1, z, z < 0 ? 1 : -1, 0, X1 + 40, z < 0 ? 1 : 0]) // the avenue, busier
    const cars = traffic(lanes, mobile ? 420 : 900)
    scene.add(cars)
    const lamp = [1, 0.62, 0.3]
    for (let z = -289; z <= 170; z += 34) for (let x = X0; x < X1; x += mobile ? 24 : 16) lights.push({ p: [x, 6, z + 5.5], c: lamp, s: 0.9 })
    for (let x = -153; x <= 460; x += 34) for (let z = Z0; z < Z1; z += mobile ? 24 : 16) lights.push({ p: [x + 5.5, 6, z], c: lamp, s: 0.9 })
    const pools = []
    for (let x = 40; x < X1; x += 14) for (const s of [-1, 1]) {
      lights.push({ p: [x, 7, s * 17], c: [1, 0.7, 0.42], s: 1.3 })
      pools.push([x, s * 16])
    }
    const pc = document.createElement('canvas')
    pc.width = pc.height = 64
    const pg = pc.getContext('2d'), grad = pg.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    pg.fillStyle = grad
    pg.fillRect(0, 0, 64, 64)
    const poolTex = new THREE.CanvasTexture(pc)
    poolTex.colorSpace = THREE.NoColorSpace
    inst(new THREE.PlaneGeometry(9, 9).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: poolTex, color: new THREE.Color(0.5, 0.3, 0.14), ...ADD }), pools, ([x, z]) => mats.makeTranslation(x, 0.06, z))
    // A faint glow of city haze behind his crown (seen from up the avenue), so its silhouette stands off the sky.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: poolTex, color: new THREE.Color(0.25, 0.32, 0.55), ...ADD, fog: false }))
    halo.position.set(-80, ROOF - 30, 80)
    halo.scale.set(320, 240, 1)
    scene.add(halo)
    const glows = lightPoints(lights, pxScale)
    scene.add(glows)
    await step()

    // Searchlights from the far blocks, sweeping slowly; their bright sources flare.
    const beams = []
    const beamGeo = new THREE.CylinderGeometry(11, 0.6, 1, 20, 1, true).translate(0, 0.5, 0)
    const beamMat = beamMaterial()
    for (const [x, z, ph] of [[150, -170, 0], [-110, -230, 1.7], [280, -90, 3.1], [70, -290, 4.4], [330, 130, 5.6]]) {
      const g = new THREE.Group()
      g.position.set(x, 2, z)
      const b = new THREE.Mesh(beamGeo, beamMat)
      b.scale.set(1, 620, 1)
      b.frustumCulled = false
      g.add(b, flareSprite(new THREE.Color(0.8, 0.88, 1).multiplyScalar(1.6), 30))
      g.userData.ph = ph
      beams.push(g)
      scene.add(g)
    }
    // City haze: a sheet of lit smog low over the blocks, and a thinner one higher up.
    const hazeLow = hazeMaterial([0.12, 0.08, 0.06], 0.42), hazeHigh = hazeMaterial([0.06, 0.07, 0.1], 0.24)
    for (const [y, m] of [[38, hazeLow], [105, hazeHigh]]) {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500).rotateX(-PI / 2), m)
      h.position.y = y
      h.frustumCulled = false
      h.renderOrder = 1
      scene.add(h)
    }
    const wind = windStreaks(mobile ? 90 : 180)
    scene.add(wind.lines)
    await step()

    // ------------------------------------------------------------ light
    const moon = new THREE.DirectionalLight('#b8ccff', 1.3)
    moon.position.set(-40, 120, 80)
    const bounce = new THREE.DirectionalLight('#8fb2ff', 0.9) // the glass towers' cool light, from below and aside
    bounce.position.set(60, -40, 50)
    scene.add(moon, moon.target, bounce, bounce.target, new THREE.HemisphereLight('#4a6aa8', '#3a3029', 0.8))
    const cityGlow = new THREE.PointLight('#e9ddd0', 380, 120, 1.6) // the street's light from below, on him
    const thrustLight = new THREE.PointLight('#a8d8ff', 0, 7, 2) // his thrusters, on him and the plates
    scene.add(cityGlow, thrustLight)

    // ------------------------------------------------------------ the traveller and his suit
    const you = (await traveller).make({ look: 'pbr' })
    you.add(await clips)
    you.add((await landFile).animations)
    const root = you.root
    const suitU = { uSuit: { value: 0 }, uSpider: { value: 2 } }
    const skin = []
    // Each skeleton bone's lock: its own plate's, a toe its foot's, the neck and head the visor's.
    const lockOf = n => n.endsWith('ToeBase') ? lockOf(n.replace('ToeBase', 'Foot')) : /^(neck|Head|head_end|headfront)$/.test(n) ? VISOR[1] - 0.004 : SUIT.find(s => s.name === n)?.lock ?? 9
    root.traverse(o => {
      if (!o.isSkinnedMesh) return
      skin.push(o)
      o.material.map = alohaLinear()
      undersuit(o.material, suitU, o.skeleton.bones.map(b => lockOf(b.name)))
    })
    scene.add(root)
    const bones = []
    root.traverse(o => o.isBone && bones.push(o))
    const restQ = new Map(bones.map(b => [b, b.quaternion.clone()]))
    const hips = you.bone('Hips'), hipsRest = hips.position.clone()
    root.updateMatrixWorld(true)
    const hipsAt = hips.getWorldPosition(new THREE.Vector3()).sub(root.position) // root origin -> hips, upright
    const flightQ = makePose(bones, restQ, FLIGHT)
    // The free-fall clip lays his body face-down itself; the dive turns his whole body instead, so take
    // the clip's own tilt out of his hips.
    const fallClip = you.actions.Skydive.getClip()
    const hipTrack = fallClip.tracks.find(k => k.name === 'Hips.quaternion')
    const untilt = restQ.get(hips).clone().multiply(new THREE.Quaternion().fromArray(hipTrack.values, 0).invert())
    const idle = you.actions.Idle, falling = you.actions.Skydive, kneel = you.actions.Land_Kneel
    for (const a of [idle, falling, kneel]) a.play()
    kneel.setEffectiveTimeScale(0) // scrubbed by p
    const zipQ = makePose(bones, restQ, ZIPPED), tuckQ = makePose(bones, restQ, TUCKED)
    const runQ = Array.from({ length: STRIDES }, (_, i) => makePose(bones, restQ, runPose((i / STRIDES) * PI * 2)))
    await step()

    // A phone takes a suit's 2048 px maps at 1024: a quarter of the memory, and it never sees them closer.
    const shrink = async model => {
      if (!mobile) return
      const maps = new Set()
      model.traverse(o => { for (const v of Object.values(o.material ?? {})) if (v?.isTexture && v.image?.width > 1024) maps.add(v) })
      for (const tex of maps) {
        const c = document.createElement('canvas')
        c.width = c.height = 1024
        c.getContext('2d').drawImage(tex.image, 0, 0, 1024, 1024)
        tex.image = c
        tex.needsUpdate = true
      }
      await step()
    }
    // The spider suit, on his own bones: on through the opening, then it recedes into his chest.
    const spiderScene = (await spiderFile).scene
    await shrink(spiderScene)
    const spider = wearSuit(root, spiderScene)
    for (const m of spider.meshes) m.material = spiderMaterial(m.material, suitU)
    // The web: a fine line from his right hand up to the crown's lip, while he zips up it.
    const web = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.66, 0.74) }))
    web.frustumCulled = false
    scene.add(web)
    const webR = mobile ? 0.035 : 0.022, palm = new THREE.Vector3(0.69, 1.25, 0.02) // the right palm in his rest pose (mirrored x below)
    const webHand = new THREE.Group()
    webHand.position.set(-palm.x, palm.y, palm.z)
    root.add(webHand)
    you.bone('RightHand').attach(webHand)
    await step()

    // The suit's pieces (dive/suit.glb: scripts/cinema/suit_fit.py cut it per bone round his rest pose),
    // parented to their bones. The reactor and the eyes glow; the rest is painted metal.
    const suitScene = (await suitFile).scene
    await shrink(suitScene)
    const pieces = []
    seed = 31
    for (const spec of SUIT) {
      const src = suitScene.getObjectByName('suit_' + spec.name)
      const geo = src.geometry
      geo.computeBoundingBox()
      const centre = geo.boundingBox.getCenter(new THREE.Vector3())
      geo.translate(-centre.x, -centre.y, -centre.z)
      const glow = { value: 1 }
      const pm = new THREE.Mesh(geo, suitMaterial(src.material, glow))
      pm.frustumCulled = false
      pm.castShadow = true
      const g = new THREE.Group()
      g.add(pm)
      g.position.copy(centre)
      let visor = null
      if (spec.name === 'Head') {
        const face = suitScene.getObjectByName('suit_Faceplate')
        const fg = face.geometry.translate(-FACE_C[0], -FACE_C[1], -FACE_C[2])
        visor = { pivot: new THREE.Group(), eyes: { value: 0 } }
        visor.pivot.position.set(FACE_C[0] - centre.x, FACE_C[1] - centre.y, FACE_C[2] - centre.z)
        const fm = new THREE.Mesh(fg, suitMaterial(face.material, visor.eyes))
        fm.frustumCulled = false
        visor.pivot.add(fm)
        g.add(visor.pivot)
      }
      root.add(g)
      const bone = you.bone(spec.bone)
      bone.attach(g)
      // Its flight in, in the bone's own units: from outside him along the line from his middle through
      // the plate (and a little off it), curving in on a sideways bow, spinning about its own axis.
      bone.updateWorldMatrix(true, false)
      const bq = bone.getWorldQuaternion(new THREE.Quaternion()).invert(), bs = new THREE.Vector3().setFromMatrixScale(bone.matrixWorld).x
      const from = centre.clone().sub(new THREE.Vector3(0, 1.05, 0)).normalize().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.9)).normalize()
      const side = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(from).normalize()
      const dist = 2.6 + rnd() * 1.4
      pieces.push({
        ...spec, g, glow, visor,
        home: g.position.clone(), homeQ: g.quaternion.clone(), homeS: g.scale.x,
        dir: from.applyQuaternion(bq).multiplyScalar(dist / bs), side: side.applyQuaternion(bq).multiplyScalar((dist * 0.4) / bs),
        axis: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), spin: (1.2 + rnd() * 1.3) * PI * 2 * (rnd() < 0.5 ? -1 : 1),
      })
      await step()
    }
    const burst = sparks(pieces.length, mobile ? 12 : 26, pxScale)
    scene.add(burst.pts)
    // The plates in flight glow as they come: one point each.
    const comet = (() => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pieces.length * 3), 3))
      g.setAttribute('aOn', new THREE.BufferAttribute(new Float32Array(pieces.length), 1))
      const m = new THREE.ShaderMaterial({
        uniforms: { uScale: pxScale },
        vertexShader: /* glsl */ `
          attribute float aOn; uniform float uScale; varying float vOn;
          void main() {
            vOn = aOn;
            vec4 mv = viewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aOn > 0.0 ? 0.5 * uScale / max(0.3, -mv.z) : 0.0;
          }`,
        fragmentShader: /* glsl */ `
          varying float vOn;
          void main() {
            vec2 q = gl_PointCoord - 0.5;
            float r = length(q) * 2.0;
            gl_FragColor = vec4(vec3(0.55, 0.8, 1.0) * (exp(-r * r * 9.0) * 1.6 + exp(-abs(q.y) * 50.0) * (1.0 - abs(q.x) * 2.0) * 0.6) * vOn, 1.0);
          }`,
        ...ADD,
      })
      const pts = new THREE.Points(g, m)
      pts.frustumCulled = false
      return pts
    })()
    scene.add(comet)
    // Thrusters at his palms and soles (each facing -y in his rest pose): a jet and a flare, on the bone.
    const jetU = { uHeat: { value: 0 }, uT: { value: 0 } }
    const jetGeo = new THREE.CylinderGeometry(0.05, 0.012, 1, 14, 1, true).translate(0, -0.5, 0), jetMat = jetMaterial(jetU)
    const jetFlare = new THREE.Color(0.55, 0.8, 1)
    const jets = []
    for (const [bone, x, y, z, len] of [['LeftHand', 0.69, 1.205, -0.02, 0.9], ['RightHand', -0.69, 1.205, -0.02, 0.9], ['LeftFoot', 0.096, -0.012, 0.005, 1.3], ['RightFoot', -0.096, -0.012, 0.005, 1.3]]) {
      const g = new THREE.Group()
      g.position.set(x, y, z)
      const jet = new THREE.Mesh(jetGeo, jetMat), fl = flareSprite(jetFlare, 1.4)
      jet.frustumCulled = false
      jet.scale.set(1, 1e-4, 1)
      fl.scale.set(1e-4, 1e-4, 1)
      g.add(jet, fl)
      root.add(g)
      you.bone(bone).attach(g)
      jets.push({ g, jet, fl, len })
    }
    await step()

    // ------------------------------------------------------------ each frame
    const vel = new THREE.Vector3(), off = new THREE.Vector3(), tmp = new THREE.Vector3(), feet = new THREE.Vector3()
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion()
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0)
    const K3b = [0, 0, 0], K2 = [0, 0, 0], qr = new THREE.Quaternion(), hand = new THREE.Vector3()
    const cometPos = comet.geometry.attributes.position, cometOn = comet.geometry.attributes.aOn
    const slerpAll = (pose, w) => { if (w > 0) for (let i = 0; i < bones.length; i++) bones[i].quaternion.slerp(pose[i], Math.min(1, w)) }
    let lastT = null
    run = (state, t, aspect) => {
      const p = state.p, still = !!state.still, q = qOf(p)
      const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT))
      lastT = t
      renderer.getDrawingBufferSize(size)
      pxScale.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(20)))

      // Where he is and which way he moves.
      at.fromArray(PATH(p, K3))
      const ahead = p < 0.996
      vel.fromArray(PATH(ahead ? p + 0.004 : p - 0.004, K3b)).sub(at)
      if (!ahead) vel.negate()
      const speed = vel.length()
      if (speed > 1e-5) vel.multiplyScalar(1 / speed)
      else vel.set(0, -1, 0)

      // His body: turned whole (heading, pitch with the flip over the pad, a roll through the dive), hips on the line.
      BODY(p, K2)
      qa.setFromAxisAngle(Y, K2[2])
      qb.setFromAxisAngle(X, K2[0] + (still ? 0 : 2 * PI * ss(0.127, TOUCH, p)))
      qc.setFromAxisAngle(Y, still ? 0 : K2[1])
      root.quaternion.copy(qa).multiply(qb).multiply(qc)
      off.copy(hipsAt).applyQuaternion(root.quaternion)
      root.position.copy(at).sub(off)
      // His limbs: up the web, tucked for the flip, the three-point landing (its clip scrubbed by p) and up,
      // standing, the run, then the free-fall clip (spread for the suit-up) and the streamlined pose for
      // the dive and the flight.
      const wKneel = ss(0.141, 0.148, p) * (1 - ss(0.222, 0.236, p))
      const wFall = p < A ? ss(0.279, A, p) : ss(0.1, 0.16, q)
      const wPose = p < A ? ss(0.272, 0.29, p) : Math.min(1, ss(0.13, 0.2, q) - ss(0.21, 0.26, q) + ss(0.72, 0.8, q))
      const kt = p < TOUCH ? 0.58 - 0.12 * (1 - ss(0.141, TOUCH, p)) : p < 0.185 ? 0.58 + 0.84 * ((p - TOUCH) / (0.185 - TOUCH)) : 1.42 + 1.62 * ss(0.185, 0.226, p)
      kneel.time = Math.min(kt, kneel.getClip().duration - 1e-3)
      kneel.setEffectiveWeight(wKneel)
      idle.setEffectiveWeight(Math.max(0, 1 - wFall - wKneel))
      falling.setEffectiveWeight(wFall)
      you.mixer.update(dt)
      if (wFall > 0) {
        qa.identity().slerp(untilt, wFall)
        hips.quaternion.premultiply(qa)
        hips.position.lerp(hipsRest, wFall)
      }
      if (p < 0.2) {
        slerpAll(zipQ, 1 - ss(0.125, 0.133, p))
        slerpAll(tuckQ, ss(0.127, 0.134, p) - ss(0.141, 0.149, p))
      }
      const wRun = ss(0.247, 0.257, p) - ss(RUN[1] - 0.004, 0.285, p)
      if (wRun > 0) {
        // The stride follows the ground he covers, so his feet never slide.
        const c = (Math.max(0, tmp.copy(at).sub(LAND).dot(R)) / RUN_LEN + 0.25) * STRIDES
        const i = Math.floor(c), f = c - i, a = runQ[i % STRIDES], b = runQ[(i + 1) % STRIDES]
        for (let j = 0; j < bones.length; j++) bones[j].quaternion.slerp(qr.slerpQuaternions(a[j], b[j], f), wRun)
      }
      slerpAll(flightQ, wPose)

      // The spider suit, receding off him (cut, with reduced motion); the iron suit, each plate a pure function of q.
      suitU.uSpider.value = still ? (p < 0.22 ? 2 : -0.1) : spiderR((p - RECEDE[0]) / (RECEDE[1] - RECEDE[0]))
      for (const m of spider.meshes) m.visible = suitU.uSpider.value > -0.1
      suitU.uSuit.value = still ? (p < A ? 0 : 2) : q
      for (const o of skin) o.visible = still ? p < A : q < VISOR[1] // sealed in: only the suit, nothing of him poking through
      const suited = still ? (p < A ? 0 : 1) : -1
      for (let i = 0; i < pieces.length; i++) {
        const pc = pieces[i], g = pc.g
        const f = suited >= 0 ? suited : clamp01((q - (pc.lock - FLY)) / FLY)
        const e = 1 - (1 - f) ** 3
        g.position.copy(pc.home).addScaledVector(pc.dir, 1 - e).addScaledVector(pc.side, Math.sin(PI * e))
        qa.setFromAxisAngle(pc.axis, (1 - e) * pc.spin)
        g.quaternion.copy(pc.homeQ).multiply(qa)
        g.scale.setScalar(pc.homeS * Math.min(1, f * 5))
        const since = q - pc.lock
        // Each plate flares as it locks; the whole suit powers up as the visor seals.
        pc.glow.value = still ? 1.6 : f <= 0 ? 1 : f < 1 ? 1.9 : 1 + 4 * Math.exp(-since / 0.016) + 0.6 * ss(VISOR[1], VISOR[1] + 0.025, q)
        burst.U.uAge.value[i] = still ? -1 : since / 0.04
        cometOn.array[i] = !still && f > 0 && f < 1 ? Math.min(1, f * 6) * (1 - f) : 0
        if (pc.visor) {
          const close = still ? 1 : ss(VISOR[0], VISOR[1], q)
          pc.visor.pivot.rotation.x = -1.75 * (1 - close)
          pc.visor.eyes.value = still ? 1.2 : close < 1 ? 0.15 : 1.2 + 4 * Math.exp(-(q - VISOR[1]) / 0.014)
        }
      }
      const heat = ss(0.722, 0.758, q)
      jetU.uHeat.value = heat
      jetU.uT.value = t
      for (const j of jets) {
        const flick = still ? 1 : 0.9 + 0.1 * Math.sin(t * 53 + j.len * 9)
        j.jet.scale.set(1 + heat * 0.3, Math.max(1e-4, heat * j.len * flick), 1 + heat * 0.3)
        j.fl.scale.set(Math.max(1e-4, heat * 1.6), Math.max(1e-4, heat * 0.8), 1)
      }
      root.updateMatrixWorld(true)
      for (let i = 0; i < pieces.length; i++) {
        pieces[i].g.getWorldPosition(burst.U.uAt.value[i])
        burst.U.uAt.value[i].toArray(cometPos.array, i * 3)
      }
      cometPos.needsUpdate = cometOn.needsUpdate = true
      // The web, from his palm to the crown's lip, until he lets go.
      webHand.getWorldPosition(hand)
      tmp.copy(WEB).sub(hand)
      const webLen = tmp.length(), webOn = 1 - ss(ZIP - 0.003, ZIP + 0.002, p)
      web.position.copy(hand)
      web.quaternion.setFromUnitVectors(Y, tmp.multiplyScalar(1 / webLen))
      web.scale.set(webR * webOn + 1e-4, webLen * (0.02 + 0.98 * webOn), webR * webOn + 1e-4)
      jets[2].g.getWorldPosition(feet).add(jets[3].g.getWorldPosition(tmp)).multiplyScalar(0.5)
      thrustLight.position.copy(feet)
      thrustLight.intensity = heat * 9
      cityGlow.position.set(at.x + 2, Math.max(2, at.y - 26), at.z + 5)
      // On the pad, the city's glow comes up over its rim in front of him instead: his key there.
      const onPad = 1 - ss(0.268, 0.3, p)
      cityGlow.position.lerp(PADKEY, onPad)
      cityGlow.intensity = 380 - 340 * onPad

      // The wind past him.
      wind.U.uC.value.copy(at)
      wind.U.uDir.value.copy(vel)
      wind.U.uSide.value.set(0, 1, 0).cross(vel)
      if (wind.U.uSide.value.lengthSq() < 1e-4) wind.U.uSide.value.set(1, 0, 0)
      wind.U.uSide.value.normalize()
      wind.U.uUp.value.crossVectors(vel, wind.U.uSide.value)
      wind.U.uLen.value = Math.min(6, speed * 2.2)
      wind.U.uRun.value = (at.x - at.y) / 50 + t * 0.15
      wind.U.uA.value = still ? 0 : 0.55 * ss(0.25, 1.0, speed) * Math.max(ss(0.12, 0.2, q), 1 - ss(ZIP - 0.02, ZIP, p))

      // The city lives on its own clock.
      cars.material.uniforms.uT.value = t
      glows.material.uniforms.uT.value = t
      hazeLow.uniforms.uT.value = hazeHigh.uniforms.uT.value = t
      beacon.material.opacity = 0.25 + 0.75 * ss(0.5, 0.56, (t * 0.75 + 0.3) % 1) * (1 - ss(0.86, 0.95, (t * 0.75 + 0.3) % 1))
      for (const b of beams) {
        const ph = b.userData.ph
        b.rotation.set(0.32 * Math.sin(t * 0.11 + ph), 0, 0.32 * Math.cos(t * 0.09 + ph * 1.3) - 0.08)
      }

      // The camera, with a small push toward him as each plate locks, so every lock lands as a beat.
      place(p, !!state.portrait, aspect, still)
      if (!still) {
        let push = 0
        for (let i = 0; i < SUIT.length; i++) push += Math.exp(-(((q - SUIT[i].lock) / 0.005) ** 2))
        camera.position.lerp(look, 0.03 * Math.min(1, push))
        const shake = 0.012 * ss(0.722, 0.74, q) * (1 - ss(0.78, 0.86, q))
        camera.rotateX(Math.sin(t * 41) * shake)
        camera.rotateY(Math.sin(t * 33 + 1.3) * shake)
      }
      dome.position.copy(camera.position)
      out.dream = still ? 0 : 0.35 * Math.exp(-(((q - VISOR[1] - 0.004) / 0.012) ** 2))
      return out
    }
  })()

  return { scene, camera, update: (state, t, aspect) => (run ? run(state, t, aspect) : hold(state, aspect)), get built() { return !!run } }
}
