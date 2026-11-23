import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loadTraveller, wearSuit, toon, outline } from './films/kit'
import { DANCE_SPAN } from './movies'
import { store } from '../lib/store'

/*
 * Chapter Five, world 6: the dance (Deadpool & Wolverine, a fan's tribute). A snowy clearing by day, as in
 * the film's graveside fight, printed like a comic: trampled snow, an open grave with its mound and a plain
 * unmarked headstone, snow-laden pines fading into a pale overcast halftone sky, snow falling. In the
 * red-and-black suit (public/cinema/suits/deadpool.glb, katanas on his back) he dances the "Bye Bye Bye"
 * routine and its fight, the claws in his right fist (public/cinema/dance/routine.glb: scripts/cinema/pose_splice.py
 * joins the owner's clip's shots on the music's beat, pose_retarget.py makes the clip), through a crowd of twelve
 * generic masked henchmen, who charge in from the trees and get knocked flying in
 * spinning arcs to land in puffs of snow. Each hit pops a sound-effect word in a comic starburst; the title
 * phrase "Bye Bye Bye" pops in a caption box on each of the routine's "bye" pushes and over the last pose.
 * As in the film's opening credits, relics fly past the lens with a credit on each (a femur, a skull, a boot's sole).
 * Words on the page: the title phrase, sound-effect words and the credits, never a lyric line.
 * The routine's hits, "bye" beats and end come with the clip (its animation extras), so a routine tracked
 * from the owner's own clip re-times the henchmen, the words and the camera by itself.
 * Everything else is built here: the henchmen are one instanced, shader-posed mesh (with an instanced ink
 * shell), the puffs, words and glints instanced quads driven from the routine's time.
 *
 * CONTRACT (world.js, timeline.js and movies.js rely on it; do not change the export or its signature)
 *   export function createDance(renderer, { loader, normalize, mobile }) -> { scene, camera, update, built }
 *     loader: the shared GLTFLoader (Meshopt + Draco). normalize(root, size, yaw): a model's meshes as
 *     one centred group scaled to `size` metres. mobile: phone-sized screen, build lighter.
 *   update(state, t, aspect) is called once per rendered frame while this world is drawn.
 *     state.p         0..1, this world's own progress (movies.js: Five's P 0.8257..0.9678, 340 svh of
 *                     scroll), driven by scroll: it scrubs both ways and can jump, so derive everything
 *                     from p and t and keep no one-way state (the routine's steps are a pure function of
 *                     p: scrubbing back plays them backwards). The COMIC cover (panels sliding off the
 *                     page) leaves over p 0..0.081; p 0.081..1 is seen clear. p stays at 1 through the
 *                     back-out and the epilogue's fade: make p = 1 a composed final pose that reads from
 *                     the cinema's seats.
 *     state.onScreen  true while this world is drawn onto the cinema's screen (Five's back-out and the
 *                     epilogue, at p = 1; aspect is then the screen's 2.4). The full-frame view at p = 1
 *                     and the on-screen one must match, or the hand-over at the back-out jumps: same
 *                     camera, no DOM-only or frame-locked HUD (comic words drawn in the scene are fine).
 *     state.still     reduced motion: no camera flourishes or shake; the routine still follows p.
 *     state.portrait  the frame is a phone's (aspect < 0.85): frame for it. Decide framing from this,
 *                     not from `aspect`: on the cinema's screen `aspect` is 2.4 and a phone sees only
 *                     the middle of that picture.
 *     state.mobile    same as the option. state.cover: 0..1, how much a transition hides the frame
 *                     (kind 'comic' | null, phase 0..1): skip work the cover hides.
 *     t               seconds, monotonic. aspect: width / height of what is being drawn; set
 *                     camera.aspect from it.
 *     Returns { here, dream, grade? }: here = a Vector3 at the traveller (world space; the same object
 *     every frame is fine); dream = 0..1 extra bloom for a held beat (0 otherwise); grade = optional
 *     overrides of GRADE.dance in movies.js ({ bloom, threshold, vignette, grain, scan }).
 *   Units: metres, y up, the floor at y = 0, him at the origin facing +z, the traveller 1.72 m tall.
 *   Camera: a PerspectiveCamera with a 40 degree vertical fov (the hall's lens, so the back-out does
 *   not jump).
 *   Colour: the frame has no sRGB encode after tone mapping, so a hex colour reads darker and richer
 *   than on a page, and a painted canvas texture reads as painted with colorSpace NoColorSpace.
 *   Build in steps: build the set a piece at a time, yielding (await a timeout) whenever a step has run
 *   ~4 ms, and report `built` false until it is whole; until then update() only places the camera
 *   (world.js holds the COMIC cover over it and compiles it once it is whole).
 *   Budget: the whole frame is about 5.6 ms on the desktop GPU today; keep this scene within that:
 *   at most ~150 draw calls and ~400k triangles in view (instance repeats), one shadow-casting light
 *   (2048 map, 1024 on mobile), textures at most 2048 px (a suit's base colour; 1024 for other maps), new
 *   GLBs under ~6 MB in all, no allocation or geometry rebuilds in update().
 *   world.prepare() builds this while the reader is paused in the final, then compiles it, draws it once
 *   at p = 0 and once into the cinema screen's target: anything hidden then (visible = false) is skipped
 *   and would compile mid-scroll, so keep things that appear later in the scene, scaled to nothing, and
 *   add late-loading models to `scene` (prepare compiles again when the scene grows).
 *   GPU memory: Stage.jsx may release this world while the reader is two worlds away (world.release:
 *   its geometries, textures, materials and shadow maps are disposed, the objects kept) and prepare it
 *   again on approach: keep every GPU resource reachable from `scene` (no render targets of its own
 *   unless they are rebuilt on use), and never dispose anything yourself.
 */
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const clamp01 = x => Math.min(1, Math.max(0, x))
const lerp = THREE.MathUtils.lerp
const PI = Math.PI, TAU = PI * 2
const D2R = PI / 180
let seed = 11
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

// The routine plays over p 0.075..0.93 (it starts as the comic panels slide off) and holds its last pose.
const [P0, P1] = DANCE_SPAN
const FOES = 12
const WORDS = ['THWACK', 'SNIKT', 'POW', 'CRACK', 'WHAM', 'BOOM', 'KRAK', 'BAM', 'SNIKT', 'THWACK', 'POW', 'CRUNCH']
const INK = '#0b0710'
const GRAVE = [-3.0, 0, -5.6] // the headstone's foot, behind him and to his right (camera left)

/**
 * A smooth curve through keys [u, ...values], unevenly spaced in u (cubic Hermite, Catmull-Rom slopes,
 * flattened where a segment holds still or turns): fills `out` with the values at u. (As dive.js.)
 */
function keyed(keys) {
  const n = keys[0].length - 1, last = keys.length - 1
  const slope = (i, j) => {
    const a = keys[Math.max(0, i - 1)], c = keys[Math.min(last, i + 1)]
    return (c[j] - a[j]) / (c[0] - a[0])
  }
  return (u, out) => {
    let i = -1
    if (u >= keys[last][0]) i = last
    else if (u > keys[0][0]) while (keys[i + 1][0] <= u) i++
    if (i < 0 || i === last) {
      for (let j = 0; j < n; j++) out[j] = keys[Math.max(0, i)][j + 1]
      return out
    }
    const k1 = keys[i], k2 = keys[i + 1], h = k2[0] - k1[0], s = (u - k1[0]) / h
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

// The camera through the routine, in u = its time / its end: azimuth round him (degrees from his front,
// + to his left), distance, height, where it looks (height) and how far right of him it looks (him left
// of centre, for the caption on his right). Wide on the crowd; in for each "bye"; low for the kicks,
// the slams and the spins; square-on and a touch low for the last pose.
const SHOTS = keyed([
  [0, 30, 7.4, 1.55, 1.1, 0],
  [0.07, 22, 6.2, 1.35, 1.1, 0],
  [0.15, 12, 5.0, 1.35, 1.2, 0.5],
  [0.25, 10, 4.7, 1.35, 1.2, 0.5],
  [0.3, -18, 5.8, 1.2, 1.1, 0],
  [0.37, -32, 5.2, 0.85, 1.05, 0],
  [0.46, -8, 5.6, 0.7, 1.1, 0],
  [0.52, 12, 4.8, 1.35, 1.2, 0.5],
  [0.58, 14, 4.8, 1.35, 1.2, 0.5],
  [0.64, 36, 6.0, 1.45, 1.1, 0],
  [0.73, 18, 5.4, 1.1, 1.1, 0],
  [0.81, -26, 5.1, 0.85, 1.05, 0],
  [0.87, 8, 4.8, 1.35, 1.2, 0.5],
  [0.92, 8, 5.0, 1.3, 1.2, 0.3],
  [0.96, -12, 5.8, 0.85, 1.1, 0],
  [1, 0, 5.7, 1.0, 1.3, 0.35],
])

// ---------------------------------------------------------------- comic print
// Halftone: a 45 degree grid of dots in screen pixels (uCell a cell's size), darkening the mid-shadows.
const HALFTONE = /* glsl */ `
uniform float uCell; uniform float uInk;
float halftone(float lum) {
  vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / uCell;
  float r = length(fract(g) - 0.5);
  float size = mix(0.42, 0.18, smoothstep(0.03, 0.3, lum));
  return (1.0 - smoothstep(size - 0.06, size + 0.06, r)) * smoothstep(0.012, 0.05, lum) * (1.0 - smoothstep(0.22, 0.45, lum));
}`
function printed(material, U, key) {
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (sh, r) => {
    prev?.(sh, r)
    sh.uniforms.uCell = U.cell
    sh.uniforms.uInk = U.ink
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HALFTONE)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= 1.0 - uInk * halftone(dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11)));')
  }
  material.customProgramCacheKey = () => 'dance-print-' + key
  return material
}

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

// ---------------------------------------------------------------- the henchmen
// One merged body, posed in the shader (as final.js's squad): parts 0 torso and head, 1/2 left/right
// arm, 3/4 left thigh/shin, 5/6 right thigh/shin. Dark fatigues, a vest, a black ski mask with two white
// eye holes: generic, faceless.
function henchGeometry() {
  const parts = []
  const add = (geo, part, hex, x, y, z, sx = 1, sy = 1, sz = 1) => {
    geo.scale(sx, sy, sz).translate(x, y, z)
    const g = geo.index ? geo.toNonIndexed() : geo
    g.deleteAttribute('uv')
    const n = g.attributes.position.count, c = new THREE.Color(hex), col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) c.toArray(col, i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1))
    parts.push(g)
  }
  const cyl = (r1, r2, h, s = 12) => new THREE.CylinderGeometry(r1, r2, h, s)
  const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h)
  const PANTS = '#465066', SHIRT = '#3c4456', VEST = '#23272f', BLACK = '#141418'
  for (const s of [1, -1]) {
    const T = s > 0 ? 3 : 5
    add(new THREE.BoxGeometry(0.11, 0.09, 0.27), T + 1, BLACK, s * 0.1, 0.045, 0.04)
    add(cyl(0.062, 0.07, 0.42), T + 1, PANTS, s * 0.1, 0.3, 0)
    add(sph(0.07, 10, 8), T + 1, PANTS, s * 0.1, 0.51, 0.005)
    add(cyl(0.092, 0.074, 0.4), T, PANTS, s * 0.1, 0.72, 0)
  }
  add(cyl(0.18, 0.17, 0.2), 0, PANTS, 0, 0.94, 0, 1, 1, 0.72)
  add(new THREE.TorusGeometry(0.17, 0.022, 6, 20).rotateX(PI / 2), 0, BLACK, 0, 1.0, 0, 1, 1, 0.74)
  const torso = [[0.001, 0.98], [0.168, 1.0], [0.18, 1.12], [0.2, 1.3], [0.205, 1.38], [0.17, 1.47], [0.07, 1.51], [0.001, 1.515]]
  add(new THREE.LatheGeometry(torso.map(([r, y]) => new THREE.Vector2(r, y)), 16), 0, SHIRT, 0, 0, 0, 1, 1, 0.7)
  const vest = [[0.186, 1.06], [0.205, 1.14], [0.222, 1.3], [0.214, 1.4], [0.18, 1.43]]
  add(new THREE.LatheGeometry(vest.map(([r, y]) => new THREE.Vector2(r, y)), 16, 0, TAU), 0, VEST, 0, 0, 0, 1, 1, 0.74)
  add(cyl(0.05, 0.056, 0.11), 0, BLACK, 0, 1.54, 0)
  add(sph(0.108, 16, 12), 0, BLACK, 0, 1.67, 0.008, 0.92, 1.08, 1)
  for (const s of [1, -1]) add(sph(0.026, 8, 6), 0, '#f4f1ea', s * 0.04, 1.69, 0.094, 1.2, 0.75, 0.5) // eye holes
  for (const s of [1, -1]) {
    const A = s > 0 ? 1 : 2
    add(sph(0.075, 10, 8), A, SHIRT, s * 0.225, 1.425, 0)
    add(cyl(0.068, 0.058, 0.24), A, SHIRT, s * 0.24, 1.31, 0)
    add(cyl(0.05, 0.04, 0.42), A, SHIRT, s * 0.245, 1.0, 0)
    add(sph(0.052, 8, 6), A, BLACK, s * 0.245, 0.77, 0.01)
  }
  return mergeGeometries(parts)
}
// The pose (iArm: left and right raise 0..1 (x PI about x), spread, lean; iLeg: hip and knee, left then
// right) as final.js's squad.
const POSE_GLSL = /* glsl */ `
attribute float aPart; attribute vec4 iArm; attribute vec4 iLeg;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
void pose(inout vec3 p, inout vec3 n) {
  int part = int(aPart + 0.5);
  if (part >= 3) {
    bool left = part <= 4;
    float side = left ? 1.0 : -1.0;
    vec3 H = vec3(0.1 * side, 0.94, 0.0), K = vec3(0.1 * side, 0.51, 0.0);
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

// ---------------------------------------------------------------- the words
// One atlas of comic lettering: the sound effects in starbursts (4 x 4 cells of 512 x 256), the caption
// "Bye Bye Bye" in a yellow box across a whole row (cell 12, 2048 x 256). Archivo, upright, heavy.
const CELLS = 16
function lettering() {
  const W = 2048, H = 1024, cw = 512, ch = 256
  const fills = ['#ffe23a', '#ffffff', '#ff4a3a', '#7ef0ff', '#ffe23a', '#ff8a2a', '#ffffff', '#ffe23a', '#ff4a3a', '#7ef0ff', '#ffe23a', '#ff8a2a']
  const bursts = ['#e8202a', '#ffd21a', '#ffffff', '#ff2f8e', '#1a1a1a', '#ffe23a', '#e8202a', '#2a7dff', '#ffd21a', '#e8202a', '#ff2f8e', '#ffffff']
  return canvasTexture(W, H, g => {
    g.clearRect(0, 0, W, H)
    let s = 5
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647
    // The bursts' halftone as one pattern fill each: thousands of separate dot fills cost ~300 ms in the GPU process.
    const tile = document.createElement('canvas')
    tile.width = 14
    tile.height = 28
    const tg = tile.getContext('2d')
    tg.fillStyle = 'rgba(255,255,255,0.28)'
    tg.beginPath()
    for (const [x, y] of [[0, 0], [14, 0], [0, 28], [14, 28], [7, 14]]) { tg.moveTo(x + 3.2, y); tg.arc(x, y, 3.2, 0, TAU) }
    tg.fill()
    const dots = g.createPattern(tile, 'repeat')
    const word = (text, x, y, w, h, size, fill) => {
      g.font = `900 ${size}px "Archivo Variable", "Arial Black", sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const k = Math.min(1, (w * 0.86) / g.measureText(text).width)
      g.save()
      g.translate(x, y)
      g.scale(k, k)
      g.lineJoin = 'round'
      g.lineWidth = size * 0.16
      g.strokeStyle = '#0b0710'
      g.strokeText(text, 0, size * 0.05)
      g.fillStyle = fill
      g.fillText(text, 0, size * 0.05)
      g.restore()
    }
    for (let i = 0; i < 12; i++) {
      const cx = (i % 4) * cw + cw / 2, cy = Math.floor(i / 4) * ch + ch / 2
      // A jagged starburst behind the word, ink-outlined, a lighter halftone inside.
      g.beginPath()
      const spikes = 14 + (i % 3) * 2
      for (let k = 0; k <= spikes * 2; k++) {
        const a = (k / (spikes * 2)) * TAU, rr = k % 2 ? 0.62 + r() * 0.12 : 0.97 - r() * 0.08
        g.lineTo(cx + Math.cos(a) * rr * (cw / 2 - 8), cy + Math.sin(a) * rr * (ch / 2 - 8))
      }
      g.closePath()
      g.fillStyle = bursts[i]
      g.fill()
      g.lineWidth = 9
      g.strokeStyle = '#0b0710'
      g.stroke()
      g.fillStyle = dots
      g.fill()
      word(WORDS[i], cx, cy, cw * 0.78, ch * 0.7, 150, fills[i])
    }
    // The caption: a yellow box with an ink border and a drop shadow, the title phrase in black caps.
    const y0 = 3 * ch
    g.fillStyle = '#0b0710'
    g.fillRect(60, y0 + 42, W - 100, ch - 66)
    g.fillStyle = '#ffd92e'
    g.fillRect(40, y0 + 22, W - 100, ch - 66)
    g.lineWidth = 12
    g.strokeStyle = '#0b0710'
    g.strokeRect(40, y0 + 22, W - 100, ch - 66)
    g.font = '900 150px "Archivo Variable", "Arial Black", sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#0b0710'
    g.fillText('BYE BYE BYE', W / 2 - 10, y0 + 22 + (ch - 66) / 2 + 8)
  })
}

// Billboards: quads at -1..1 turned to the camera in view space.
const QUAD = new THREE.PlaneGeometry(2, 2)
function instanced(base, count, attrs) {
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  g.setAttribute('position', base.attributes.position)
  g.instanceCount = count
  for (const [k, [arr, n]] of Object.entries(attrs)) g.setAttribute(k, new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage))
  return g
}

export function createDance(renderer, { loader, mobile = false }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400)
  scene.add(camera)
  const here = new THREE.Vector3(0, 0.95, 0)
  // A daylit snow set: the bloom only on what is brighter than the snow (the glints, the hits).
  const out = { here, dream: 0, grade: { bloom: 0.3, threshold: 0.97, vignette: 0.2 } }
  const K = [0, 0, 0, 0, 0]
  const cam = new THREE.Vector3(), look = new THREE.Vector3(), right = new THREE.Vector3()
  let end = 34.7 // the routine's last pose (seconds), from its extras once loaded
  const timeAt = p => end * clamp01((p - P0) / (P1 - P0))
  // The routine's clock for the music (sound.js keeps its cue in step with T) and the scene player (lib/autoplay.js).
  const clock = (store.danceClock = { T: 0, end, seen: 0 })
  // The camera from his place (here), the routine's time and p; shake from the hits (none when still).
  const shake = { x: 0, y: 0 }
  let camAz = 0
  let byeTimes = [] // the routine's "bye" pushes (seconds), from its extras once loaded
  const place = (state, aspect, T) => {
    const p = state.p ?? 0, portrait = !!state.portrait
    SHOTS(T / end, K)
    // Each "bye" push: a medium shot from the front, him about half the frame's height, whatever the clip's timing.
    let near = 0
    for (const b of byeTimes) near = Math.max(near, ss(b - 1.0, b - 0.3, T) * (1 - ss(b + 1.6, b + 2.3, T)))
    K[0] = lerp(K[0], 6, near)
    K[2] = lerp(K[2], 1.35, near)
    K[3] = lerp(K[3], 1.15, near)
    K[4] = lerp(K[4], 0.5, near)
    const hold = ss(P1, 1, p) // the held last pose: a slow push in to the composed final frame
    const az = (camAz = K[0] * D2R), dist = lerp(K[1] * (portrait ? 1.55 : 1), portrait ? 4.3 : 4.4, near) - 0.25 * hold
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    cam.set(here.x + Math.sin(az) * dist, K[2] + (portrait ? 0.35 : 0), here.z + Math.cos(az) * dist)
    look.set(here.x, K[3] - (portrait ? 0.15 : 0), here.z)
    right.set(Math.cos(az), 0, -Math.sin(az))
    if (!portrait) look.addScaledVector(right, K[4])
    if (!state.still) {
      cam.x += shake.x
      cam.y += shake.y
      look.x += shake.x * 0.6
      look.y += shake.y * 0.6
    }
    camera.position.copy(cam)
    camera.lookAt(look)
  }
  let run = null

  ;(async () => {
    let t0 = performance.now()
    const step = async () => {
      if (performance.now() - t0 < 4) return
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }
    const traveller = loadTraveller(loader)
    const suitFile = loader.loadAsync('/cinema/suits/deadpool.glb')
    const routineFile = loader.loadAsync('/cinema/dance/routine.glb')
    const relicsFile = loader.loadAsync('/cinema/dance/relics.glb')
    const fonts = document.fonts?.load('900 100px "Archivo Variable"').catch(() => {})
    const U = { cell: { value: 5 }, ink: { value: 0.55 }, t: { value: 0 } }
    const add = (o, shadow = true) => {
      o.traverse(m => { if (m.isMesh) m.receiveShadow = shadow })
      scene.add(o)
      return o
    }

    // ------------------------------------------------------------ sky, fog, the light it all reflects
    scene.fog = new THREE.FogExp2('#ccd4de', mobile ? 0.034 : 0.03) // the sky's colour at the horizon: the clearing melts into it
    const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
      uniforms: { uCell: U.cell, uSunDir: { value: new THREE.Vector3(0.45, 0.32, -1).normalize() } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = (projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0)).xyww; }',
      fragmentShader: /* glsl */ `
        uniform float uCell; uniform vec3 uSunDir; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          // Overcast winter: a pale band over the pines, a greyer blue above.
          vec3 c = mix(vec3(0.8, 0.83, 0.87), vec3(0.6, 0.66, 0.74), smoothstep(0.02, 0.55, h));
          float m = max(dot(d, uSunDir), 0.0);
          float glow = pow(m, 24.0) * 0.6 + pow(m, 5.0) * 0.2;
          // Printed: the sun's glow through the cloud and the low band in halftone dots.
          vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / uCell;
          float r = length(fract(g) - 0.5);
          float tone = clamp(glow + (1.0 - smoothstep(0.0, 0.25, h)) * 0.35, 0.0, 1.0);
          float dotv = 1.0 - smoothstep(tone * 0.5 - 0.05, tone * 0.5 + 0.05, r);
          c += vec3(1.0, 0.97, 0.9) * (dotv * 0.12 * tone + glow * 0.12);
          gl_FragColor = vec4(c, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
    }))
    scene.add(sky)
    {
      // The environment: a white overcast overhead, the snow's bounce from below, a cooler side.
      const env = new THREE.Scene()
      env.background = new THREE.Color(0.42, 0.46, 0.52)
      const strip = (color, k, x, y, z, w, h) => {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }))
        s.position.set(x, y, z)
        s.lookAt(0, 0, 0)
        env.add(s)
      }
      strip('#f4f6fa', 2.0, 0, 50, 10, 60, 60)
      strip('#dfe6f0', 1.2, 20, -12, 0, 60, 20)
      strip('#b8c8de', 1.0, -45, 8, -20, 40, 10)
      strip('#fff4e4', 1.3, 30, 18, -40, 30, 12)
      await new Promise(r => setTimeout(r))
      const pm = new THREE.PMREMGenerator(renderer)
      scene.environment = pm.fromScene(env, 0, 0.1, 200, { size: 128 }).texture
      scene.environmentIntensity = 0.8
      pm.dispose()
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }

    // ------------------------------------------------------------ the clearing: trampled snow
    const GROUND = 30
    const snow = canvasTexture(1024, 1024, (g, w) => {
      const m = w / GROUND // px per metre
      g.fillStyle = '#dfe6ee'
      g.fillRect(0, 0, w, w)
      for (let i = 0; i < 9000; i++) {
        const v = 205 + rnd() * 45
        g.fillStyle = `rgba(${v - 8},${v - 3},${Math.min(255, v + 6)},${0.25 + rnd() * 0.35})`
        g.fillRect(rnd() * w, rnd() * w, 1 + rnd() * 2.5, 1 + rnd() * 2.5)
      }
      // Trampled where the fight goes, round him: soft blue-grey hollows and scuffs.
      for (let i = 0; i < 40; i++) {
        const a = rnd() * TAU, d = rnd() * 7, x = (Math.sin(a) * d + GROUND / 2) * m, y = (Math.cos(a) * d + GROUND / 2) * m
        const r = (0.5 + rnd() * 1.4) * m, gr = g.createRadialGradient(x, y, 0, x, y, r)
        gr.addColorStop(0, 'rgba(120,138,160,0.32)')
        gr.addColorStop(1, 'rgba(120,138,160,0)')
        g.fillStyle = gr
        g.fillRect(x - r, y - r, r * 2, r * 2)
      }
      g.fillStyle = 'rgba(96,110,132,0.35)'
      for (let i = 0; i < 260; i++) { // footprints
        const a = rnd() * TAU, d = 1 + rnd() * 8
        g.beginPath()
        g.ellipse((Math.sin(a) * d + GROUND / 2) * m, (Math.cos(a) * d + GROUND / 2) * m, 0.06 * m, 0.13 * m, rnd() * PI, 0, TAU)
        g.fill()
      }
      // The grave's spill: dark earth thrown on the snow round the open pit.
      const X = x => (x + GROUND / 2) * m, Z = z => (z + GROUND / 2) * m
      for (let i = 0; i < 90; i++) {
        const r = (0.05 + rnd() * 0.18) * m
        g.fillStyle = `rgba(${60 + rnd() * 20},${46 + rnd() * 14},${38 + rnd() * 10},${0.5 + rnd() * 0.4})`
        g.beginPath()
        g.arc(X(GRAVE[0] + (rnd() - 0.3) * 2.6), Z(GRAVE[2] + 0.6 + (rnd() - 0.5) * 2.4), r, 0, TAU)
        g.fill()
      }
    })
    const groundMat = printed(new THREE.MeshStandardMaterial({ map: snow, roughness: 0.9, metalness: 0, envMapIntensity: 0.6 }), U, 'ground')
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND, GROUND).rotateX(-PI / 2), groundMat)
    const far = new THREE.Mesh(new THREE.RingGeometry(GROUND / 2 - 0.5, 160, 48, 1).rotateX(-PI / 2), printed(new THREE.MeshStandardMaterial({ color: '#d2dae4', roughness: 0.9 }), U, 'far'))
    far.position.y = -0.005
    add(ground)
    add(far)
    await step()

    // ------------------------------------------------------------ the grave: an open pit, its mound, a plain headstone
    const earth = printed(new THREE.MeshStandardMaterial({ color: '#4a382e', roughness: 0.95 }), U, 'earth')
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#120c0a', polygonOffset: true, polygonOffsetFactor: -1 }))
    pit.position.set(GRAVE[0], 0.006, GRAVE[2] + 0.6)
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, PI / 2), earth)
    mound.scale.set(0.7, 0.55, 1.2)
    mound.position.set(GRAVE[0] + 1.15, 0, GRAVE[2] + 0.7)
    const snowCap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 6, 0, TAU, 0, 0.5), printed(new THREE.MeshStandardMaterial({ color: '#e6ecf3', roughness: 0.9 }), U, 'cap'))
    snowCap.scale.set(0.73, 0.57, 1.23)
    snowCap.position.copy(mound.position)
    outline(mound, { ink: INK, width: 0.03 })
    const arch = new THREE.Shape().moveTo(-0.36, 0).lineTo(-0.36, 0.72).absarc(0, 0.72, 0.36, PI, 0, true).lineTo(0.36, 0).lineTo(-0.36, 0)
    const stone = new THREE.Mesh(new THREE.ExtrudeGeometry(arch, { depth: 0.16, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 16 }).translate(0, 0, -0.08),
      printed(new THREE.MeshStandardMaterial({ color: '#7d8189', roughness: 0.85 }), U, 'stone'))
    stone.position.set(GRAVE[0], 0, GRAVE[2] - 0.55)
    stone.rotation.set(-0.06, 0.12, 0.04)
    stone.castShadow = true
    outline(stone, { ink: INK, width: 0.025 })
    add(pit)
    add(mound)
    add(snowCap)
    add(stone)
    await step()

    // ------------------------------------------------------------ lights: a flat winter day
    const key = new THREE.DirectionalLight('#f3f5ff', 2.2) // the bright overcast, from in front and above
    key.position.set(3.5, 9, 6)
    key.castShadow = true
    key.shadow.mapSize.setScalar(mobile ? 1024 : 2048)
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 })
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    const fill = new THREE.DirectionalLight('#cfdaec', 0.9) // the snow's glow on his front, from the camera's side
    fill.position.set(-1, 2, 8)
    const rim = new THREE.DirectionalLight('#fff1dc', 1.2) // the low sun behind the cloud
    rim.position.set(5, 3, -9)
    scene.add(key, key.target, fill, rim, new THREE.HemisphereLight('#e2e9f4', '#8a95a4', 1.1))
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), HS = new THREE.Vector3(0.93, 0.93, 0.93), _v = new THREE.Vector3(), _w = new THREE.Vector3()
    const Yax = new THREE.Vector3(0, 1, 0), Xax = new THREE.Vector3(1, 0, 0), Zax = new THREE.Vector3(0, 0, 1)

    // ------------------------------------------------------------ the pines round the clearing, snow on every tier
    {
      const parts = []
      const part = (geo, hex) => {
        const g = geo.toNonIndexed()
        const n = g.attributes.position.count, c = new THREE.Color(hex), col = new Float32Array(n * 3)
        for (let i = 0; i < n; i++) c.toArray(col, i * 3)
        g.setAttribute('color', new THREE.BufferAttribute(col, 3))
        g.deleteAttribute('uv')
        parts.push(g)
      }
      part(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 7).translate(0, 0.7, 0), '#3a2a22')
      for (let k = 0; k < 4; k++) {
        const r = 1.5 - k * 0.32, y = 1.0 + k * 1.05, h = 1.9 - k * 0.2
        part(new THREE.ConeGeometry(r, h, 9).translate(0, y + h / 2, 0), '#1d352d')
        part(new THREE.ConeGeometry(r * 0.72, h * 0.45, 9).translate(0, y + h * 0.66, 0), '#e4ebf2')
      }
      const NT = mobile ? 30 : 52
      const pines = new THREE.InstancedMesh(mergeGeometries(parts), printed(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), U, 'pine'), NT)
      for (let i = 0; i < NT; i++) {
        const a = rnd() * TAU, d = 13 + rnd() * 22
        const x = Math.sin(a) * d, z = Math.cos(a) * d
        if (z > 0 && Math.abs(x) < z * 0.7 && d < 16) { i--; continue } // clear of the camera's side
        const s = 0.8 + rnd() * 0.7
        pines.setMatrixAt(i, _m.compose(_v.set(x, 0, z), _q.setFromAxisAngle(Yax, rnd() * TAU), _w.set(s, s * (0.9 + rnd() * 0.4), s)))
      }
      add(pines, false)
    }
    await step()

    // ------------------------------------------------------------ falling snow
    const ND = mobile ? 260 : 600
    const dP = new Float32Array(ND * 3), dS = new Float32Array(ND)
    for (let i = 0; i < ND; i++) {
      dP.set([(rnd() - 0.5) * 22, rnd() * 7, -12 + rnd() * 20], i * 3)
      dS[i] = rnd()
    }
    const dust = new THREE.Mesh(instanced(QUAD, ND, { iP: [dP, 3], iS: [dS, 1] }), new THREE.ShaderMaterial({
      uniforms: { uT: U.t },
      vertexShader: /* glsl */ `
        attribute vec3 iP; attribute float iS; uniform float uT; varying vec2 vQ; varying float vA;
        void main() {
          vec3 p = iP + vec3(sin(uT * 0.5 + iS * 40.0) * 0.4, 0.0, cos(uT * 0.4 + iS * 30.0) * 0.3);
          p.y = mod(iP.y - uT * (0.35 + iS * 0.4), 7.0); // falling, round again
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float s = 0.022 + iS * 0.026;
          mv.xy += position.xy * s;
          vQ = position.xy;
          vA = smoothstep(30.0, 3.0, -mv.z) * (0.5 + 0.5 * iS);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vQ; varying float vA;
        void main() { float r2 = dot(vQ, vQ); gl_FragColor = vec4(vec3(1.0), exp(-r2 * 3.0) * vA * (1.0 - smoothstep(0.7, 1.0, r2))); }`,
      transparent: true, depthWrite: false,
    }))
    dust.frustumCulled = false
    scene.add(dust)
    await step()

    // ------------------------------------------------------------ him: the suit and the routine
    const kit = await traveller
    const you = kit.make({ look: 'pbr' })
    const body = []
    you.root.traverse(o => { if (o.isSkinnedMesh) body.push(o) })
    for (const o of body) o.visible = false // the suit is cut to his skeleton, not his baggy clothes: his own body stays hidden
    const suitScene = (await suitFile).scene
    if (mobile) {
      // A phone takes the suit's 2048 px colour at 1024: a quarter of the memory, never seen closer.
      const maps = new Set()
      suitScene.traverse(o => { for (const v of Object.values(o.material ?? {})) if (v?.isTexture && v.image?.width > 1024) maps.add(v) })
      for (const tex of maps) {
        const c = document.createElement('canvas')
        c.width = c.height = 1024
        c.getContext('2d').drawImage(tex.image, 0, 0, 1024, 1024)
        tex.image = c
        tex.needsUpdate = true
      }
    }
    const suit = wearSuit(you.root, suitScene)
    for (const m of suit.meshes) {
      m.receiveShadow = true
      m.material.envMapIntensity = 1.1
      if (m.material.map) m.material.map.colorSpace = THREE.NoColorSpace // as painted: the frame has no sRGB encode
      // An ink line round him too, so he sits in the printed world (pushed in the mesh's own units).
      m.geometry.computeBoundingBox()
      const perMetre = (m.geometry.boundingBox.max.y - m.geometry.boundingBox.min.y) / 1.72
      outline(m, { ink: INK, width: 0.011 * perMetre })
    }
    scene.add(you.root)
    const gltf = await routineFile
    const clip = gltf.animations[0]
    const extras = gltf.parser.json.animations?.[0]?.extras ?? {}
    end = clock.end = Math.min(clip.duration, extras.end ?? clip.duration)
    you.add([clip])
    const act = you.actions[clip.name]
    act.play()
    const hipsBone = you.bone('Hips'), fists = [you.bone('LeftHand'), you.bone('RightHand')]
    await step()

    // Glints at his fists, flaring on the one that lands each hit.
    const NGL = 2, glP = new Float32Array(NGL * 3), glA = new Float32Array(NGL)
    const glintMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec3 iP; attribute float iS; varying vec2 vQ; varying float vA;
        void main() { vec4 mv = modelViewMatrix * vec4(iP, 1.0); mv.xy += position.xy * (0.05 + 0.55 * iS); vQ = position.xy; vA = iS; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        varying vec2 vQ; varying float vA;
        void main() {
          float r2 = dot(vQ, vQ);
          float star = exp(-abs(vQ.x) * 22.0) * exp(-abs(vQ.y) * 1.8) + exp(-abs(vQ.y) * 22.0) * exp(-abs(vQ.x) * 1.8);
          gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * (star * 1.4 + exp(-r2 * 12.0)) * vA * (1.0 - smoothstep(0.6, 1.0, r2)), 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    const glints = new THREE.Mesh(instanced(QUAD, NGL, { iP: [glP, 3], iS: [glA, 1] }), glintMat)
    glints.frustumCulled = false
    glints.renderOrder = 9
    scene.add(glints)
    await step()

    // ------------------------------------------------------------ the henchmen
    // A henchman for each of twelve of his blows, spread through the whole fight (the clip finds more blows than that).
    const found = extras.hits?.length ? extras.hits : [3, 6, 12, 14, 16, 17, 21, 22, 23, 28, 29, 33].map(t => ({ t, side: 'right' }))
    const hits = found.length <= FOES ? found : Array.from({ length: FOES }, (_, i) => found[Math.round((i * (found.length - 1)) / (FOES - 1))])
    const byes = extras.byes ?? []
    const SLATE_T = timeAt(0.32) // the routine's time as the top-left slate (ChapterFive.jsx: p 0.1..0.3) has gone
    byeTimes = byes
    const NF = Math.min(FOES, hits.length)
    const hg = henchGeometry()
    const armA = new THREE.InstancedBufferAttribute(new Float32Array(FOES * 4), 4).setUsage(THREE.DynamicDrawUsage)
    const legA = new THREE.InstancedBufferAttribute(new Float32Array(FOES * 4), 4).setUsage(THREE.DynamicDrawUsage)
    hg.setAttribute('iArm', armA)
    hg.setAttribute('iLeg', legA)
    const henchMat = printed(toon({ vertexColors: true }), U, 'hench')
    const prevHench = henchMat.onBeforeCompile
    henchMat.onBeforeCompile = (sh, r) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + POSE_GLSL)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal); vec3 posed = vec3(position); pose(posed, objectNormal);')
        .replace('#include <begin_vertex>', 'vec3 transformed = posed;')
      prevHench(sh, r)
    }
    const crew = new THREE.InstancedMesh(hg, henchMat, FOES)
    crew.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    crew.frustumCulled = false
    crew.castShadow = false
    const shell = new THREE.InstancedMesh(hg, new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uInk: { value: new THREE.Color(INK) } }]),
      vertexShader: /* glsl */ `
        ${POSE_GLSL}
        varying float vDepth;
        void main() {
          vec3 n = normal; vec3 p = position; pose(p, n);
          p += normalize(n) * 0.022;
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uInk; uniform vec3 fogColor; uniform float fogDensity; varying float vDepth;
        void main() { gl_FragColor = vec4(mix(uInk, fogColor, 1.0 - exp(-fogDensity * fogDensity * vDepth * vDepth)), 1.0); }`,
      side: THREE.BackSide, fog: true,
    }), FOES)
    shell.instanceMatrix = crew.instanceMatrix
    shell.frustumCulled = false
    scene.add(crew, shell)
    // Each one's part in it: where he waits in the dark, which way he comes at him, where he flies.
    seed = 23
    const ANGLE = { fore: -38, back: -95, kick: 12, slam: 28, spin: 140, front: 15, left: 60, right: -60 }
    const LAND = [100, -110, 150, -150, 72, -78, 125, -132, 172, -165, 88, -96]
    const foes = []
    let spinSide = 1
    for (let i = 0; i < NF; i++) {
      const h = hits[i], kind = h.kind ?? h.side ?? 'right'
      let a = (ANGLE[kind] ?? (i % 2 ? 55 : -55)) + (rnd() - 0.5) * 16
      if (kind === 'spin') a *= (spinSide = -spinSide)
      const reach = kind === 'kick' ? 1.15 : kind === 'slam' ? 1.7 : 1.95
      const ra = Math.sign(a || 1) * Math.max(Math.abs(a), 80) * D2R + (rnd() - 0.5) * 0.6 // they wait to his sides and behind him, clear of the camera
      const wait = 8.5 + rnd() * 3.5
      foes.push({
        t: h.t, kind, a: a * D2R, reach,
        spawn: [Math.sin(ra) * wait, Math.cos(ra) * wait - 1.5],
        // Where he comes down: round the sides and the back, spread out, clear of the camera at his front.
        land: [Math.sin(LAND[i % LAND.length] * D2R) * (4.2 + rnd() * 1.8), Math.cos(LAND[i % LAND.length] * D2R) * (4.2 + rnd() * 1.8)],
        apex: kind === 'slam' ? 1.1 : kind === 'kick' ? 1.6 : 2.2 + rnd() * 0.9,
        dur: kind === 'slam' ? 0.7 : 0.85 + rnd() * 0.2,
        turns: kind === 'slam' ? 0 : 1 + (rnd() < 0.5 ? 1 : 0),
        roll: (rnd() - 0.5) * 2.4, run: 2.8 + rnd() * 0.6, ph: rnd() * TAU, word: i % WORDS.length,
      })
    }
    // Blob shadows under everyone (him last), and the dust puffs from the hits and the landings.
    const blobTex = canvasTexture(64, 64, g => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = r
      g.fillRect(0, 0, 64, 64)
    })
    const blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#000000', alphaMap: blobTex, transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2 }), FOES)
    blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    blobs.frustumCulled = false
    scene.add(blobs)
    const PUFFS = mobile ? 3 : 5, NP = FOES * 2 * PUFFS
    const pP = new Float32Array(NP * 3), pS = new Float32Array(NP * 2)
    const puffs = new THREE.Mesh(instanced(QUAD, NP, { iP: [pP, 3], iS: [pS, 2] }), new THREE.ShaderMaterial({
      uniforms: { uCell: U.cell },
      vertexShader: /* glsl */ `
        attribute vec3 iP; attribute vec2 iS; varying vec2 vQ; varying float vA;
        void main() { vec4 mv = modelViewMatrix * vec4(iP, 1.0); mv.xy += position.xy * iS.x; vQ = position.xy; vA = iS.y; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform float uCell; varying vec2 vQ; varying float vA;
        void main() {
          float r = length(vQ);
          if (r > 1.0 || vA <= 0.0) discard;
          // A comic dust puff: a pale cloud with an ink rim, shaded in dots towards its foot.
          vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / uCell;
          float dots = step(length(fract(g) - 0.5), 0.3 * smoothstep(0.1, -0.9, vQ.y));
          vec3 c = mix(vec3(0.97, 0.98, 1.0), vec3(0.64, 0.7, 0.8), dots); // kicked-up snow
          c = mix(c, vec3(0.04, 0.03, 0.06), smoothstep(0.84, 0.9, r));
          gl_FragColor = vec4(c, vA * (1.0 - smoothstep(0.96, 1.0, r)));
        }`,
      transparent: true, depthWrite: false,
    }))
    puffs.frustumCulled = false
    scene.add(puffs)
    await step()

    // ------------------------------------------------------------ the words
    if (fonts) await fonts
    const letters = lettering()
    const wInset = { value: 0 } // the words' margin from the frame's sides, in NDC (0 on the cinema screen)
    const NW = NF + byes.length + 1
    const wP = new Float32Array(NW * 3), wS = new Float32Array(NW * 3), wR = new Float32Array(NW * 4)
    const words = new THREE.Mesh(instanced(QUAD, NW, { iP: [wP, 3], iS: [wS, 3], iR: [wR, 4] }), new THREE.ShaderMaterial({
      uniforms: { uMap: { value: letters }, uInset: wInset, uTop: { value: 1 - 2 * 0.12 } }, // tops below 12% of the frame
      vertexShader: /* glsl */ `
        attribute vec3 iP; attribute vec3 iS; attribute vec4 iR; uniform float uInset; uniform float uTop; varying vec2 vUv; varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(iP, 1.0);
          float c = cos(iS.z), s = sin(iS.z);
          vec2 half_ = vec2(iS.x * iR.z / iR.w, iS.x * 0.5); // a cell's width over its height is twice its uv ratio (2048 x 1024)
          float fit = 1.0;
          if (uInset > 0.0 && mv.z < 0.0) {
            // Shrink a word to the frame's width and keep it uInset (NDC) inside both edges.
            float px = projectionMatrix[0][0] / -mv.z, hw = (abs(c) * half_.x + abs(s) * half_.y) * px;
            fit = min(1.0, (1.0 - uInset) / max(hw, 1e-4));
            float lim = max(0.0, 1.0 - uInset - hw * fit);
            mv.x = clamp(mv.x * px, -lim, lim) / px;
            // And its top below uTop (NDC): clear of the page's header bar.
            float py = projectionMatrix[1][1] / -mv.z, hh = (abs(s) * half_.x + abs(c) * half_.y) * py * fit;
            mv.y = min(mv.y * py, uTop - hh) / py;
          }
          vec2 q = position.xy * half_ * fit;
          mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y);
          vUv = iR.xy + (position.xy * 0.5 + 0.5) * iR.zw;
          vA = iS.y;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec2 vUv; varying float vA;
        void main() { vec4 c = texture2D(uMap, vUv); if (c.a < 0.02 || vA <= 0.0) discard; gl_FragColor = vec4(c.rgb, c.a * vA); }`,
      transparent: true, depthWrite: false, depthTest: false,
    }))
    words.frustumCulled = false
    words.renderOrder = 10
    scene.add(words)
    // Atlas rects (u, v, w, h; v from the bottom) and each word's moment.
    for (let i = 0; i < NW; i++) {
      const caption = i >= NF
      const c = caption ? 0 : foes[i].word
      wR.set(caption ? [0, 0, 1, 0.25] : [(c % 4) * 0.25, 0.75 - Math.floor(c / 4) * 0.25, 0.25, 0.25], i * 4)
    }
    words.geometry.attributes.iR.needsUpdate = true
    await step()

    // ------------------------------------------------------------ the relics
    // The film's opening credits ride on its props as they fly past the lens; this tribute's ride on three of
    // them (public/cinema/dance/relics.glb, from scripts/cinema/props.py 'relics'; the boot's sole is built
    // here), lettered in red on the side that faces the lens. And the claws (Logan's forearm and hand, three
    // claws out over the knuckles), held in his right fist through the whole fight.
    const relicSet = (await relicsFile).scene
    const RED = '#b3121c'
    // Planar uvs over the relic's x-y box (its +Z side faces the lens) and the credit painted to match, in metres.
    // lines: { x, y, w (widest, m), parts: [[text, cap height (m)], ...] in a row }; paint(g, k): the ground's detail.
    const credit = (geo, key, { ground, rough, metal, lines, paint }) => {
      geo.computeBoundingBox()
      const { min, max } = geo.boundingBox, bw = max.x - min.x, bh = max.y - min.y
      const pos = geo.attributes.position, uv = new Float32Array(pos.count * 2)
      for (let i = 0; i < pos.count; i++) uv.set([(pos.getX(i) - min.x) / bw, (pos.getY(i) - min.y) / bh], i * 2)
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      const W = mobile ? 1024 : 2048, H = Math.round((W * bh) / bw), k = W / bw
      const font = (g, cap) => {
        g.font = `900 ${(cap * k) / 0.72}px "Archivo Variable", "Arial Black", sans-serif`
        if ('fontStretch' in g) g.fontStretch = 'condensed'
      }
      const letter = (g, fill, stroke) => {
        g.textBaseline = 'alphabetic'
        g.lineJoin = 'round'
        for (const l of lines) {
          const gaps = l.parts.map(([, cap], j) => (j ? cap * k * 0.45 : 0))
          const ws = l.parts.map(([text, cap]) => (font(g, cap), g.measureText(text).width))
          const total = ws.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0)
          const fit = Math.min(1, (l.w * k) / total), capMax = Math.max(...l.parts.map(p => p[1]))
          let x = (l.x - min.x) * k - (total * fit) / 2
          const base = (max.y - l.y) * k + (capMax * k * fit) / 2
          l.parts.forEach(([text, cap], j) => {
            x += gaps[j] * fit
            font(g, cap * fit)
            if (stroke) {
              g.lineWidth = cap * k * fit * 0.14
              g.strokeStyle = stroke
              g.strokeText(text, x, base)
            }
            g.fillStyle = fill
            g.fillText(text, x, base)
            x += ws[j] * fit
          })
        }
      }
      const map = canvasTexture(W, H, g => {
        g.fillStyle = ground
        g.fillRect(0, 0, W, H)
        paint?.(g, k, x => (x - min.x) * k, y => (max.y - y) * k)
        letter(g, RED, INK)
      })
      const rm = canvasTexture(W, H, g => { // g: roughness, b: metalness (the paint is matte)
        g.fillStyle = `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`
        g.fillRect(0, 0, W, H)
        letter(g, 'rgb(0,190,0)', 'rgb(0,190,0)')
      })
      const o = new THREE.Mesh(geo, printed(new THREE.MeshStandardMaterial({ map, roughnessMap: rm, metalnessMap: rm, roughness: 1, metalness: 1, envMapIntensity: 1.3 }), U, 'relic-' + key))
      outline(o, { ink: INK, width: 0.0035 })
      o.scale.setScalar(1e-5)
      scene.add(o)
      return o
    }
    const ADAMANTIUM = '#c3c9d2'
    const femurGeo = relicSet.getObjectByName('femur').geometry
    const skullGeo = relicSet.getObjectByName('skull').geometry
    let shaftY = 0
    {
      const p = femurGeo.attributes.position
      let n = 0
      // The shaft's height, where it flares (its straight middle decimates to long triangles with no vertices in it).
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) > 0.1 && Math.abs(p.getX(i)) < 0.15) shaftY += p.getY(i), n++
      shaftY /= n
    }
    skullGeo.computeBoundingBox()
    const crown = skullGeo.boundingBox.max.y
    // The sole of a boot, tread to the lens: a toe, a ball, the waist of the arch and a heel, 0.3 m long.
    const soleShape = new THREE.Shape()
    soleShape.moveTo(0.15, 0.004)
    soleShape.splineThru([[0.135, 0.042], [0.09, 0.055], [0.03, 0.049], [-0.03, 0.036], [-0.085, 0.039], [-0.132, 0.034], [-0.152, 0], [-0.132, -0.034], [-0.085, -0.039], [-0.03, -0.03], [0.03, -0.046], [0.09, -0.05], [0.136, -0.036], [0.15, 0.004]].map(([x, y]) => new THREE.Vector2(x, y)))
    const soleGeo = new THREE.ExtrudeGeometry(soleShape, { depth: 0.034, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 40 }).translate(0, 0, -0.017)
    const femur = credit(femurGeo, 'femur', {
      ground: ADAMANTIUM, rough: 0.3, metal: 1,
      lines: [{ x: 0, y: shaftY - 0.003, w: 0.3, parts: [['A FILM BY', 0.0085], ['TEJAS GOVIND', 0.017]] }],
    })
    const skull = credit(skullGeo, 'skull', {
      ground: ADAMANTIUM, rough: 0.3, metal: 1,
      lines: [
        { x: 0, y: crown - 0.04, w: 0.1, parts: [['A FAN TRIBUTE TO', 0.0075]] },
        { x: 0, y: crown - 0.06, w: 0.13, parts: [['DEADPOOL', 0.018]] },
        { x: 0, y: crown - 0.083, w: 0.135, parts: [['& WOLVERINE', 0.014]] },
      ],
    })
    const sole = credit(soleGeo, 'sole', {
      ground: '#34333a', rough: 0.85, metal: 0,
      // The tread: rows of chevron lugs, a heel block, a groove round the rim.
      paint: (g, k, X, Y) => {
        g.fillStyle = '#1d1c22'
        for (let x = -0.13; x < 0.14; x += 0.022) {
          for (const s of [1, -1]) {
            g.beginPath()
            g.moveTo(X(x), Y(0.004 * s))
            g.lineTo(X(x + 0.01), Y(0.045 * s))
            g.lineTo(X(x + 0.018), Y(0.045 * s))
            g.lineTo(X(x + 0.008), Y(0.004 * s))
            g.fill()
          }
        }
        g.strokeStyle = '#1d1c22'
        g.lineWidth = 0.006 * k
        g.strokeRect(X(-0.142), Y(0.03), 0.062 * k, 0.06 * k)
      },
      lines: [
        { x: 0.005, y: 0.028, w: 0.12, parts: [['MUSIC', 0.011]] },
        { x: 0.005, y: 0.002, w: 0.24, parts: [['BYE BYE BYE', 0.024]] },
        { x: 0.005, y: -0.026, w: 0.16, parts: [['*NSYNC · 2000', 0.011]] },
      ],
    })
    // Each one's pass, in the routine's seconds (clear of the slate and the "bye" captions): its size as a share of
    // the frame's width (landscape, portrait) and height, which way it goes, how high, its tumble.
    const fliers = [
      { o: femur, t0: 10.75, dur: 2.8, dir: -1, y: -0.3, fw: [0.62, 0.96], fh: 1, roll: [0.14, -0.08], yaw: 0.3, pitch: 0.25, grow: 0.06 },
      { o: skull, t0: 14.4, dur: 3.0, dir: 1, y: 0.02, fw: [0.8, 0.8], fh: 0.52, roll: [-0.12, 0.1], yaw: 0.45, pitch: 0.12, grow: 0.08 },
      { o: sole, t0: 22.0, dur: 2.6, dir: -1, y: -0.12, fw: [0.48, 0.92], fh: 0.5, roll: [-0.35, 0.2], yaw: 0.4, pitch: 0.3, grow: 0.25 },
    ]
    for (const f of fliers) {
      const b = f.o.geometry.boundingBox
      f.w = b.max.x - b.min.x
      f.h = b.max.y - b.min.y
    }
    const claws = new THREE.Mesh(relicSet.getObjectByName('claws').geometry, printed(new THREE.MeshStandardMaterial({ color: ADAMANTIUM, metalness: 1, roughness: 0.28, envMapIntensity: 1.3 }), U, 'claws'))
    outline(claws, { ink: INK, width: 0.004 })
    claws.castShadow = true
    scene.add(claws)
    const foreR = you.bone('RightForeArm'), clawHand = new THREE.Vector3(1, 0, 0) // the hand bone's axis out of the back of his hand
    await step()

    // ------------------------------------------------------------ each frame
    const strike = new THREE.Vector3(), pos = new THREE.Vector3(), tmp = new THREE.Vector3()
    const cR = new THREE.Vector3(), cU = new THREE.Vector3(), cF = new THREE.Vector3(), cN = new THREE.Vector3(), _e = new THREE.Euler()
    const TH = Math.tan(20 * D2R) // half the 40 degree fov
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), mtx = new THREE.Matrix4()
    const size = new THREE.Vector2()
    const home = new THREE.Vector3() // where he stands at a moment (his hips' track), for a henchman's aim
    const hipsTrack = clip.tracks.find(k => k.name === 'Hips.position')
    const scaleHips = you.root.scale.x * 0.01 // armature cm -> metres
    const hipsAt = (T, v) => {
      const tt = hipsTrack.times, n = tt.length
      const f = Math.min(n - 1, Math.max(0, Math.round((T / clip.duration) * (n - 1))))
      return v.set(hipsTrack.values[f * 3] * scaleHips, 0, hipsTrack.values[f * 3 + 2] * scaleHips)
    }
    const pose = (i, armL, armR, spread, lean, hl, kl, hr, kr) => {
      armA.setXYZW(i, armL, armR, spread, lean)
      legA.setXYZW(i, hl, kl, hr, kr)
    }
    const puffAt = (k, x, y, z, age, big) => {
      const live = age > 0 && age < 0.9
      pP[k * 3] = x; pP[k * 3 + 1] = y; pP[k * 3 + 2] = z
      pS[k * 2] = live ? (0.25 + 0.55 * Math.sqrt(age / 0.9)) * big : 0
      pS[k * 2 + 1] = live ? 1 - ss(0.45, 0.9, age) : 0
    }
    const word = (i, T0, T, x, y, z, s, rot, life) => {
      const age = T - T0
      const live = age > 0 && age < life
      const pop = live ? (age < 0.1 ? (age / 0.1) * 1.25 : age < 0.2 ? lerp(1.25, 1, (age - 0.1) / 0.1) : 1) : 0
      wP[i * 3] = x; wP[i * 3 + 1] = y; wP[i * 3 + 2] = z
      wS[i * 3] = s * pop
      wS[i * 3 + 1] = live ? 1 - ss(life - 0.25, life, age) : 0
      wS[i * 3 + 2] = rot
    }
    let lastT = null
    run = (state, t, aspect) => {
      const p = state.p ?? 0, still = !!state.still, portrait = !!state.portrait
      const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT))
      lastT = t
      const T = timeAt(p)
      clock.T = T
      clock.seen = performance.now()
      const Tfx = T + 1.2 * ss(P1, 0.98, p) // through the held last pose the dust settles and the words go, for a clean final frame
      U.t.value = t
      renderer.getDrawingBufferSize(size)
      U.cell.value = Math.max(4, size.y / 190)
      wInset.value = state.onScreen ? 0 : (32 * renderer.getPixelRatio()) / size.x // 16 css px from the frame's sides

      // Him: the routine at T.
      act.time = Math.min(T, clip.duration - 1e-3)
      you.mixer.update(0)
      you.root.updateMatrixWorld(true)
      hipsBone.getWorldPosition(here)

      // The claws in his right fist: Logan's forearm along his, the bone hand over his knuckles, claws out past them.
      fists[1].getWorldPosition(pos)
      foreR.getWorldPosition(tmp)
      cF.subVectors(pos, tmp).normalize() // his fingers' way
      fists[1].getWorldQuaternion(qa)
      cN.copy(clawHand).applyQuaternion(qa).addScaledVector(cF, -cN.dot(cF)).normalize()
      cU.crossVectors(cN, cF)
      mtx.makeBasis(cF, cU, cN)
      claws.quaternion.setFromRotationMatrix(mtx)
      claws.position.copy(pos).addScaledVector(cF, 0.04).addScaledVector(cN, 0.03)

      // The henchmen.
      let flash = 0, shook = 0, fist = 1
      for (let i = 0; i < FOES; i++) {
        if (i >= NF) {
          mtx.makeScale(0, 0, 0)
          crew.setMatrixAt(i, mtx)
          blobs.setMatrixAt(i, mtx)
          continue
        }
        const f = foes[i]
        const tHit = f.t, tGo = tHit - 3.0, tSet = tHit - 0.4
        hipsAt(tHit, home)
        strike.set(home.x + Math.sin(f.a) * f.reach, 0, home.z + Math.cos(f.a) * f.reach)
        let yaw = 0, flat = 0, cy = 0
        if (T < tHit) {
          // Waiting in the dark, then a run at him, then the wind-up.
          const k = ss(tGo, tSet, T)
          pos.set(lerp(f.spawn[0], strike.x, k), 0, lerp(f.spawn[1], strike.z, k))
          hipsAt(T, tmp)
          yaw = Math.atan2(tmp.x - pos.x, tmp.z - pos.z)
          const running = k > 0 && k < 1 ? Math.min(1, Math.sin(k * PI) * 2.5) : 0
          const ph = f.ph + Math.hypot(pos.x - f.spawn[0], pos.z - f.spawn[1]) * f.run
          const sw = Math.sin(ph) * running
          const wind = ss(tSet - 0.15, tHit - 0.05, T)
          const idle = still ? 0 : Math.sin(t * 2.2 + f.ph) * 0.04
          pos.y = Math.abs(Math.cos(ph)) * 0.06 * running
          pose(i, lerp(0.3 + sw * 0.35, 0.92, wind) + idle, lerp(0.3 - sw * 0.35, 0.75, wind) - idle, 0.2 + 0.2 * wind, 0.18 * running + 0.1 * wind,
            0.12 + sw * 0.7, 0.2 + Math.max(0, -sw) * 1.1, 0.12 - sw * 0.7, 0.2 + Math.max(0, sw) * 1.1)
        } else {
          // Hit: flung in a spinning arc, a bounce, a slide, then flat on his back.
          const u = clamp01((T - tHit) / f.dur), land = tHit + f.dur
          const slide = ss(land, land + 0.55, T)
          const fx = f.land[0] - strike.x, fz = f.land[1] - strike.z, dist = Math.hypot(fx, fz)
          const travel = (dist - 0.7) * (u * (1 - 0.15 * u)) / 0.85 + 0.7 * slide
          pos.set(strike.x + (fx / dist) * travel, 0, strike.z + (fz / dist) * travel)
          cy = lerp(0.95, 0.16, u) + f.apex * 4 * u * (1 - u) + (T > land ? 0.14 * Math.sin(PI * clamp01((T - land) / 0.3)) : 0)
          // From facing him to his back towards where he flies, as the blow turns him.
          const y0 = f.a + PI, y1 = Math.atan2(-fx, -fz)
          yaw = y0 + ((((y1 - y0) % TAU) + TAU + PI) % TAU - PI) * ss(0, 0.35, u)
          flat = (PI / 2 + TAU * f.turns) * Math.min(1, u * 1.05)
          const flail = 1 - slide
          const w = still ? 0.5 : Math.sin(T * 17 + f.ph)
          pose(i, 0.55 + 0.4 * w * flail + 0.35 * (1 - flail), 0.6 - 0.4 * w * flail + 0.35 * (1 - flail), 0.6 + 0.5 * flail, -0.3 * flail,
            0.5 * w * flail + 0.1, 0.9 * flail, -0.5 * w * flail + 0.1, 0.7 * flail)
          // The puffs: a burst where the blow lands, dust where he hits the floor.
          const hitAge = Tfx - tHit, landAge = Tfx - land
          for (let k = 0; k < PUFFS; k++) {
            const a = (k / PUFFS) * TAU + f.ph
            puffAt(i * 2 * PUFFS + k, strike.x + Math.cos(a) * 0.35 * hitAge * 3, 1.25 + Math.sin(a) * 0.3 * hitAge * 2.5, strike.z + Math.sin(a * 1.3) * 0.2, hitAge * 1.6, 0.32)
            puffAt(i * 2 * PUFFS + PUFFS + k, pos.x + Math.cos(a) * (0.3 + landAge * 1.2), 0.18 + landAge * 0.35 * (k % 2 + 0.5), pos.z + Math.sin(a) * (0.3 + landAge * 1.2), landAge, 0.55)
          }
          if (hitAge < 0.3 && 1 - hitAge / 0.3 > flash) flash = 1 - hitAge / 0.3, fist = f.kind === 'left' ? 0 : 1
          if (hitAge < 0.25) shook = Math.max(shook, 1 - hitAge / 0.25)
        }
        if (T < tHit) for (let k = 0; k < 2 * PUFFS; k++) puffAt(i * 2 * PUFFS + k, 0, 0, 0, -1, 0)
        // Turn: face him (yaw), then the tumble about his own side axis, round his middle.
        qa.setFromAxisAngle(Yax, yaw)
        qb.setFromAxisAngle(Xax, -flat)
        qa.multiply(qb)
        qb.setFromAxisAngle(Zax, f.roll * Math.min(1, flat))
        qa.multiply(qb)
        if (T < tHit) {
          mtx.compose(pos, qa, HS)
        } else {
          tmp.set(0, -0.88, 0).applyQuaternion(qa)
          pos.y = cy
          pos.add(tmp)
          mtx.compose(pos, qa, HS)
        }
        crew.setMatrixAt(i, mtx)
        // His shadow: under his middle, smaller and fainter the higher he is.
        tmp.set(0, 0.95, 0).applyQuaternion(qa).add(pos)
        const hgt = Math.max(0, tmp.y - 0.95)
        const sz = (flat > 0.8 ? 1.9 : 1.0) / (1 + hgt * 0.6)
        mtx.compose(_v.set(tmp.x, 0.01, tmp.z), qc.setFromAxisAngle(Yax, yaw), _w.set(sz * 0.8, 1, sz * (flat > 0.8 ? 1.3 : 0.8)))
        blobs.setMatrixAt(i, mtx)
      }
      crew.instanceMatrix.needsUpdate = true
      blobs.instanceMatrix.needsUpdate = true
      armA.needsUpdate = legA.needsUpdate = true
      puffs.geometry.attributes.iP.needsUpdate = puffs.geometry.attributes.iS.needsUpdate = true

      // Fist glints: only the fist that lands, as it lands.
      for (let k = 0; k < NGL; k++) {
        fists[k].getWorldPosition(tmp).toArray(glP, k * 3)
        glA[k] = k === fist ? flash : 0
      }
      glints.geometry.attributes.iP.needsUpdate = glints.geometry.attributes.iS.needsUpdate = true

      // The camera, with a kick on each hit.
      shake.x = shook * 0.05 * Math.sin(t * 61)
      shake.y = shook * 0.04 * Math.sin(t * 47 + 1)
      place(state, aspect, T)
      // The relics past the lens, held a set distance in front of it: quick in, a slow drift across the middle
      // of the frame (long enough to read), quick out; a slow tumble that keeps the credit to the lens.
      cR.set(1, 0, 0).applyQuaternion(camera.quaternion)
      cU.set(0, 1, 0).applyQuaternion(camera.quaternion)
      cF.set(0, 0, -1).applyQuaternion(camera.quaternion)
      for (const f of fliers) {
        const u = (T - f.t0) / f.dur
        if (u <= 0 || u >= 1) {
          f.o.scale.setScalar(1e-5)
          continue
        }
        const v = 2 * u - 1, d = 1.2, hh = d * TH, hw = hh * aspect
        const s = Math.min(((portrait ? f.fw[1] : f.fw[0]) * 2 * hw) / f.w, (f.fh * 2 * hh) / f.h) * (1 + f.grow * v)
        const A = 1.1 + (s * f.w) / (2 * hw) // its middle a half-width off the frame's edge at either end
        const x = f.dir * ((A - 0.35) * v * v * v + 0.35 * v)
        f.o.position.copy(camera.position).addScaledVector(cF, d).addScaledVector(cR, x * hw).addScaledVector(cU, (f.y + 0.06 * v) * hh)
        f.o.quaternion.copy(camera.quaternion).multiply(qb.setFromEuler(_e.set(f.pitch * v, f.yaw * v, lerp(f.roll[0], f.roll[1], u))))
        f.o.scale.setScalar(s)
      }
      // The caption: "Bye Bye Bye" on each push, beside him; then over the last pose, above him.
      right.set(Math.cos(camAz), 0, -Math.sin(camAz))
      // The hits' words: a starburst beside him on the blow's side of the frame; on his right (clear of the
      // top-left slate) while the slate is up. A phone sees only the middle: keep the word near him.
      for (let i = 0; i < NF; i++) {
        const f = foes[i]
        hipsAt(f.t, home)
        const s = f.t < SLATE_T || Math.sin(f.a) * right.x + Math.cos(f.a) * right.z >= 0 ? 1 : -1
        const wx = portrait ? 0.5 : 1.5
        word(i, f.t, Tfx, home.x + right.x * s * wx, (portrait ? 2.3 : 1.5) + (i % 3) * 0.15, home.z + right.z * s * wx, portrait ? 0.68 : 0.8, ((i % 5) - 2) * 0.09, 0.95)
      }
      for (let b = 0; b < byes.length; b++) {
        const bx = portrait ? 0 : 1.25
        word(NF + b, byes[b], T, here.x + right.x * bx, portrait ? 2.0 : 2.15, here.z + right.z * bx, portrait ? 0.26 : 0.3, -0.04, 2.6)
      }
      const fx = portrait ? 0 : 1.2
      word(NF + byes.length, end - 0.4, T, here.x + right.x * fx, portrait ? 3.05 : 2.7, here.z + right.z * fx, portrait ? 0.3 : 0.4, -0.03, 99)
      words.geometry.attributes.iP.needsUpdate = words.geometry.attributes.iS.needsUpdate = true

      out.dream = still ? 0 : 0.25 * ss(P1, 1, p)
      return out
    }
  })()

  const hold = (state, aspect) => {
    place(state, aspect, timeAt(state.p ?? 0))
    return out
  }
  return { scene, camera, update: (state, t, aspect) => (run ? run(state, t, aspect) : hold(state, aspect)), get built() { return !!run } }
}
