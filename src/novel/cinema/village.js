import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { loadTraveller, alohaLinear, sky } from './films/kit'

/*
 * Chapter Four, level 3: the village, as a base in a mobile base-builder. A bright grass plateau above
 * the clouds, a tidy grid inside chunky stone walls, seen from a raised three-quarter strategy-game camera
 * that follows the traveller along the road. He is the builder (hard hat, hammer): each plot springs up
 * with a bounce as he reaches it (his hut, gold mines, a mana well, the stores, cannons, archer towers,
 * barracks, a sky defence, the wall in runs, and the grand town hall in three lifts), and comes down
 * again if you scroll back. Villagers work the mines and the well; from the barracks on, a small troop
 * parade (a brawler, an archer, a giant, a wizard, an armoured knight) marches behind him and a small
 * dragon circles overhead. All of it is an original design built here from painted primitives merged per
 * building: no models, one shared material (and one glass), one painted ground.
 *
 * CONTRACT (world.js, timeline.js and levels.js rely on it; do not change the export or its signature)
 *   export function createVillage(renderer, { loader, normalize, mobile }) -> { scene, camera, update }
 *     loader: the shared GLTFLoader (Meshopt + Draco). normalize(root, size, yaw): a model's meshes as
 *     one centred group scaled to `size` metres. mobile: phone-sized screen, build lighter.
 *   update(state, t, aspect) is called once per rendered frame while this level is on screen.
 *     state.p         0..1, this level's own progress, driven by scroll (it scrubs both ways and can
 *                     jump; derive everything from p and t, keep no one-way state). The clouds part
 *                     over p 0..0.11 (the camera should come down out of them); p 0.11..0.89 is seen
 *                     clear; the tech transition breaks the picture up over p 0.89..1 (levels.js CLEAR).
 *     state.still     reduced motion: no camera flourishes; the walk still follows p.
 *     state.portrait  the frame is a phone's (aspect < 0.85): frame for it. Decide framing from this,
 *                     not from `aspect`.
 *     state.onScreen  the level is being drawn onto the cinema's screen (only the last level, ops).
 *     state.mobile    same as the option. state.cover: 0..1, how much a transition hides the frame.
 *     t               seconds, monotonic. aspect: width / height of what is being drawn; set
 *                     camera.aspect from it.
 *     Returns { here, dream, grade? }: here = a Vector3 at the traveller (world space); dream = 0..1
 *     extra bloom for a held, dreamy beat (0 otherwise); grade = optional overrides of this level's
 *     GRADE in levels.js ({ bloom, threshold, vignette, grain, scan }).
 *   Units: metres, y up, ground at y = 0, the traveller 1.72 m tall. The path runs along +x from x = 0;
 *   the camera sits on the +z side looking toward -z, so the set's "back" is -z. Camera: a
 *   PerspectiveCamera with a 40 degree vertical fov (the hall's lens).
 *   Budget: the whole frame is about 5.6 ms on the desktop GPU today; keep this scene within that:
 *   at most ~150 draw calls and ~400k triangles in view (instance repeats), one shadow-casting light
 *   (2048 map, 1024 on mobile), textures at most 2048 px, no allocation or geometry rebuilds in update().
 *   world.prepare() builds this while the reader is paused in the level before, then compiles it and
 *   draws it once at p = 0: anything hidden then (visible = false) is skipped and would compile mid-walk,
 *   so keep things that appear later in the scene, scaled to nothing, and add late-loading models to
 *   `scene` (prepare compiles again when the scene grows).
 *
 * The buildings pop on a spring toward 0 or 1, and which of the two is decided by p alone, so the
 * village is always the one p describes within half a second of the scroll resting (and at once under
 * reduced motion, under a covering transition and after a jump).
 */
const LENGTH = 62 // metres of path walked over p 0..1
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const pathZ = x => 1.4 * Math.sin((x - 4) * 0.105) // the path wanders a little either side of z = 0
const pathYaw = x => Math.atan2(1, 0.147 * Math.cos((x - 4) * 0.105)) // facing along the road
const TAU = Math.PI * 2, PUFFS = 10 // dust puffs round each building as it lands
// The plateau: a rounded rectangle (a superellipse) with a wobbling edge, clouds all round it.
const X0 = -24, X1 = 88, Z0 = -28, Z1 = 20
const CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2, RA = (X1 - X0) / 2, RB = (Z1 - Z0) / 2
const inside = (x, z, k = 1) => ((x - CX) / (RA * k)) ** 4 + ((z - CZ) / (RB * k)) ** 4 < 1
// The painted ground covers this rectangle (2:1).
const TX0 = X0 - 2, TW = X1 - X0 + 4, TZ0 = CZ - TW / 4
// The base: a walled rectangle on a 2 m grid, the road through it from gate to gate.
const BX0 = 3, BX1 = 59, BZ0 = -23, BZ1 = 7, TILE = 2

const C = {
  stone: '#d3d8e1', stoneDark: '#a5adbd', stoneWarm: '#ece0c6', slate: '#7d889c',
  wood: '#c47a3a', woodDark: '#8a4f25', plank: '#eab066', plankDark: '#c58743', plaster: '#fcebc8',
  red: '#f04c3c', redDark: '#c6352a', blue: '#3f82ec', blueDark: '#2c5fc2', orange: '#f8953a', teal: '#2cbaa6',
  gold: '#ffd12e', goldDark: '#e8a31a', mana: '#b84cff', manaHi: '#f0b8ff', iron: '#485166', ironLight: '#8c96aa', steel: '#cdd4df',
  white: '#fff8ea', straw: '#f0c95a', glass: '#9fe3f7', glassDark: '#3b5c94', rock: '#a48d74', hat: '#ffbf1a',
  skin: ['#f6cfa8', '#e0a878', '#c98d5e', '#f2c097'], hair: ['#5a3a24', '#2e2420', '#b5763a', '#d9c7a0'],
  leaf: ['#62c64c', '#4ab24c', '#7ed650', '#42a658', '#9ade56', '#58bd46'],
}

/*
 * SCREEN: the composer shows a world's tone-mapped frame without an sRGB encode, so a colour decoded to
 * linear comes out darker and harsher than written. Here every colour is used as written instead (the
 * paint, the instance tints, the ground painting, his own texture), and the light adds up to about 1 on
 * sunlit ground: what the palette says is what the screen shows.
 */
const tmpC = new THREE.Color(), M4 = new THREE.Matrix4(), M3 = new THREE.Matrix3(), EU = new THREE.Euler()
/**
 * Paint a geometry for the shared material: one flat colour, darker toward its own foot (painted-on
 * occlusion), brighter than white if it glows, and how far each vertex flutters in the wind (cloth).
 */
function paint(g, hex, { ao = 0.2, glow = 1, wave = null, flat = false } = {}) {
  if (g.index) g = g.toNonIndexed()
  g.deleteAttribute('uv')
  if (flat) g.computeVertexNormals()
  const pos = g.attributes.position, n = pos.count
  g.computeBoundingBox()
  const y0 = g.boundingBox.min.y, h = Math.max(1e-4, g.boundingBox.max.y - y0)
  tmpC.set(hex).convertLinearToSRGB() // see SCREEN below
  const c = new Float32Array(n * 3), w = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const k = glow * (1 - ao * (1 - (pos.getY(i) - y0) / h) ** 2)
    c[i * 3] = tmpC.r * k
    c[i * 3 + 1] = tmpC.g * k
    c[i * 3 + 2] = tmpC.b * k
    if (wave) w[i * 3 + 2] = wave(pos.getX(i), pos.getY(i))
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  g.setAttribute('aWave', new THREE.BufferAttribute(w, 3))
  return g
}

/** A gable: a triangular prism, its ridge along z, its base at y = 0. */
function prism(w, h, d) {
  const a = -w / 2, b = w / 2, z0 = -d / 2, z1 = d / 2
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    a, 0, z1, b, 0, z1, 0, h, z1, b, 0, z0, a, 0, z0, 0, h, z0,
    a, 0, z0, a, 0, z1, 0, h, z1, a, 0, z0, 0, h, z1, 0, h, z0,
    b, 0, z1, b, 0, z0, 0, h, z0, b, 0, z1, 0, h, z0, 0, h, z1,
  ], 3))
  g.computeVertexNormals()
  return g
}

/** Cloth is seen from both sides: add the back faces. */
function twoSided(g) {
  g = g.toNonIndexed()
  const p = g.attributes.position.array, nn = g.attributes.normal.array, n = p.length
  const P = new Float32Array(n * 2), N = new Float32Array(n * 2)
  P.set(p)
  N.set(nn)
  for (let i = 0; i < n; i += 9) for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++) {
    const from = i + [0, 2, 1][v] * 3 + k
    P[n + i + v * 3 + k] = p[from]
    N[n + i + v * 3 + k] = -nn[from]
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(P, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3))
  return out
}

/** One RoundedBoxGeometry per size, standing on y = 0: paint() reads it into a copy of its own, so it is shared. */
const ROUNDED = new Map()
function rounded(w, h, d, seg, r) {
  const key = `${w},${h},${d},${seg},${r}`
  let g = ROUNDED.get(key)
  if (!g) ROUNDED.set(key, (g = new RoundedBoxGeometry(w, h, d, seg, r).translate(0, h / 2, 0)))
  return g
}

/** Collects painted parts and merges them into one mesh: a whole building is one draw call. */
function builder(mat) {
  let gs = []
  const place = (g, hex, x, y, z, o = {}) => {
    g = paint(g, hex, o)
    if (o.rx || o.ry || o.rz) {
      M4.makeRotationFromEuler(EU.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'))
      g.applyMatrix4(M4)
      g.attributes.aWave.applyMatrix3(M3.setFromMatrix4(M4))
    }
    g.translate(x, y, z)
    gs.push(g)
    return b
  }
  const b = {
    // Every part sits on (x, y, z) by its foot and turns about it.
    box: (w, h, d, x, y, z, hex, o) => place(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), hex, x, y, z, o),
    /** A chunky bevelled block, the genre's soft-edged look (o.r: the bevel, o.seg: its rounding steps). */
    rbox: (w, h, d, x, y, z, hex, o = {}) => place(rounded(w, h, d, o.seg ?? 1, Math.min(o.r ?? 0.14, Math.min(w, h, d) * 0.45)), hex, x, y, z, o),
    cyl: (r1, r2, h, x, y, z, hex, o = {}) => place(new THREE.CylinderGeometry(r1, r2, h, o.seg ?? 10, 1, !!o.open).translate(0, h / 2, 0), hex, x, y, z, o),
    cone: (r, h, x, y, z, hex, o = {}) => place(new THREE.ConeGeometry(r, h, o.seg ?? 10).rotateY(o.turn ?? 0).scale(o.sx ?? 1, 1, o.sz ?? 1).translate(0, h / 2, 0), hex, x, y, z, { flat: (o.seg ?? 10) < 6, ...o }),
    ball: (r, x, y, z, hex, o = {}) => place(new THREE.IcosahedronGeometry(r, o.detail ?? 1).scale(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1), hex, x, y, z, o),
    geo: (g, hex, x, y, z, o) => place(g, hex, x, y, z, o),
    /** A banner hanging from (x, top, z), facing +z: it moves more the lower it hangs. */
    banner: (w, h, x, top, z, hex, { from = 0, total = h, amp = 0.2, ...o } = {}) =>
      place(twoSided(new THREE.PlaneGeometry(w, h, 3, 5)), hex, x, top - h / 2, z, { ao: 0, wave: (_, y) => amp * ((from + h / 2 - y) / total) ** 1.5, ...o }),
    /** A pennant flying toward +x from a pole at (x, y, z). */
    pennant: (len, h, x, y, z, hex, { amp = 0.34, ...o } = {}) => {
      const g = new THREE.PlaneGeometry(len, h, 7, 1).translate(len / 2, 0, 0)
      const p = g.attributes.position
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (1 - 0.85 * p.getX(i) / len))
      return place(twoSided(g), hex, x, y, z, { ao: 0, wave: px => amp * (px / len), ...o })
    },
    /** Parts made inside fn, moved and turned together. */
    sub: (fn, x = 0, y = 0, z = 0, ry = 0) => {
      const keep = gs
      gs = []
      fn()
      const made = gs
      gs = keep
      M4.makeRotationY(ry).setPosition(x, y, z)
      M3.setFromMatrix4(M4)
      for (const g of made) {
        g.applyMatrix4(M4)
        g.attributes.aWave.applyMatrix3(M3)
        gs.push(g)
      }
      return b
    },
    mesh: ({ shadow = true } = {}) => {
      const m = new THREE.Mesh(mergeGeometries(gs), mat)
      m.castShadow = shadow
      m.receiveShadow = true
      m.frustumCulled = false // drawn from the first frame, so nothing uploads mid-walk
      return m
    },
  }
  return b
}

/**
 * The village's one look: vertex-painted, soft, with cloud shadows drifting across everything and cloth
 * that moves (aWave: a per-vertex offset, zero for anything rigid).
 */
function sunlit(mat, U) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = U.uT
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uT; attribute vec3 aWave; varying vec3 vWp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += aWave * (sin(uT * 3.1 + position.x * 1.9 + position.y * 2.3 + position.z * 1.3) * 0.7 + sin(uT * 5.3 + position.y * 4.1) * 0.3);`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWp = (modelMatrix * wp4).xyz;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uT; varying vec3 vWp;
        float vh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(vh(i), vh(i + vec2(1.0, 0.0)), f.x), mix(vh(i + vec2(0.0, 1.0)), vh(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 cp = vWp.xz * 0.055 + vec2(uT * 0.06, uT * 0.026);
        float cl = smoothstep(0.47, 0.68, vn(cp) * 0.65 + vn(cp * 2.3 + 7.1) * 0.35);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.66, 0.75, 0.92), cl * 0.7);`)
  }
  return mat
}

export function createVillage(renderer, { loader, mobile = false }) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#eaf5ff', 60, 240)
  scene.add(sky({ top: '#2f86e6', mid: '#93cdfb', low: '#eef8ff', sunDir: new THREE.Vector3(-0.45, 0.5, 0.6), sun: '#fff3d0' }))
  const U = { uT: { value: 0 } }
  const MAT = sunlit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), U)
  // The mana well's orb and the mana store's tank: clear glass over the glowing liquid.
  const GLASS = new THREE.MeshStandardMaterial({ color: tmpC.set('#f4ecff').convertLinearToSRGB().clone(), roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false })
  const make = () => builder(MAT)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const pick = a => a[Math.floor(rnd() * a.length)]
  const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k)

  // ------------------------------------------------------------ shared pieces
  /** Dressed stone: a block with a few stones standing proud of the two faces the camera sees (+z, -x). */
  const proud = (b, w, h, d, x, y, z, n = 8) => {
    for (let i = 0; i < n; i++) {
      const sw = 0.45 + rnd() * 0.5, sh = 0.3 + rnd() * 0.2, c = rnd() < 0.5 ? C.stoneDark : C.stoneWarm, u = rnd() - 0.5, v = rnd()
      if (i % 3) b.rbox(sw, sh, 0.12, x + u * (w - sw), y + v * (h - sh), z + d / 2, c, { ao: 0, r: 0.04 })
      else b.rbox(0.12, sh, sw, x - w / 2, y + v * (h - sh), z + u * (d - sw), c, { ao: 0, r: 0.04 })
    }
  }
  /** A pitched roof, ridge along z, on a gable wall: two slabs with a tile course or two, and a ridge cap. */
  const gable = (b, span, len, rise, y, color, { ov = 0.5, wall = C.plaster, t = 0.3, cap = null } = {}) => {
    b.geo(prism(span, rise, len), wall, 0, y, 0, { ao: 0.1 })
    const run = span / 2 + ov, drop = (rise * ov) / (span / 2), s = Math.hypot(run, rise + drop), pitch = Math.atan2(rise, span / 2), dark = shade(color, 0.78)
    for (const sx of [-1, 1]) {
      b.rbox(s, t, len + 0.8, (sx * run) / 2, y + (rise - drop) / 2, 0, color, { rz: -sx * pitch, ao: 0.1, r: 0.1 })
      for (const f of [0.36, 0.7]) b.box(0.1, t + 0.05, len + 0.82, sx * run * f, y + rise - (rise + drop) * f, 0, dark, { rz: -sx * pitch, ao: 0 })
    }
    b.rbox(0.42, 0.32, len + 0.95, 0, y + rise - 0.05, 0, cap ?? dark, { ao: 0, r: 0.1 })
  }
  /** An arched plank door in a stone surround, facing +z. */
  const door = (b, x, y, z, w = 0.9, h = 1.3, frame = C.stoneWarm) => {
    b.rbox(w + 0.34, h + w / 2 + 0.16, 0.14, x, y, z - 0.06, frame, { ao: 0.1, r: 0.06 })
    b.box(w, h, 0.12, x, y, z, C.woodDark, { ao: 0.35 }).cyl(w / 2, w / 2, 0.12, x, y + h, z - 0.06, C.woodDark, { seg: 12, rx: Math.PI / 2, ao: 0 })
    for (const f of [0.3, 0.72]) b.box(w + 0.02, 0.07, 0.15, x, y + h * f, z, C.iron, { ao: 0 })
    b.box(0.05, h + w * 0.4, 0.14, x, y, z + 0.01, '#6e3d1c', { ao: 0 })
    b.ball(0.06, x + w * 0.3, y + h * 0.5, z + 0.1, C.gold, { ao: 0 })
  }
  const windowAt = (b, x, y, z, { w = 0.8, h = 0.8, glass = C.glass, glow = 1 } = {}) => {
    b.box(w, h, 0.1, x, y, z, glass, { ao: 0.25, glow }).rbox(w + 0.22, 0.14, 0.18, x, y + h, z, C.woodDark, { ao: 0, r: 0.04 }).rbox(w + 0.3, 0.14, 0.24, x, y - 0.1, z, C.plank, { ao: 0, r: 0.04 })
    b.box(0.07, h, 0.13, x, y, z, C.woodDark, { ao: 0 }).box(w, 0.07, 0.13, x, y + h / 2 - 0.035, z, C.woodDark, { ao: 0 })
    for (const sx of [-1, 1]) b.box(0.1, h, 0.15, x + sx * (w / 2 + 0.04), y, z, C.woodDark, { ao: 0 })
  }
  const crate = (b, x, y, z, s = 0.6, ry = 0.2) => b.rbox(s, s, s, x, y, z, C.plank, { ry, r: 0.05 }).box(s + 0.04, 0.07, s + 0.04, x, y + s - 0.07, z, C.plankDark, { ry, ao: 0 }).box(s + 0.04, 0.07, s + 0.04, x, y, z, C.plankDark, { ry, ao: 0 })
  const sack = (b, x, y, z, s = 1, hex = '#f1e2bf') => b.ball(0.3 * s, x, y + 0.24 * s, z, hex, { sy: 0.85, ao: 0.3 }).ball(0.09 * s, x, y + 0.52 * s, z, shade(hex, 0.88), { detail: 0, ao: 0 })
  const lantern = (b, x, y, z) => b.box(0.22, 0.28, 0.22, x, y, z, '#ffd27a', { glow: 2.6, ao: 0 }).rbox(0.3, 0.08, 0.3, x, y + 0.28, z, C.iron, { ao: 0, r: 0.03 }).box(0.28, 0.05, 0.28, x, y - 0.05, z, C.iron, { ao: 0 })
  const flagpole = (b, x, y, z, h, hex, len = 1.5) => b.cyl(0.05, 0.05, h, x, y, z, C.woodDark, { seg: 5 }).ball(0.12, x, y + h, z, C.gold, { ao: 0 }).pennant(len, len * 0.42, x, y + h - 0.35, z, hex)
  /** A heap of gold coins: a mound with coins standing on edge and lying on it. */
  const coins = (b, x, y, z, r = 0.9) => {
    b.ball(r, x, y, z, C.gold, { sy: 0.42, glow: 1.08, ao: 0.15, detail: 2 })
    for (let i = 0; i < 9; i++) {
      const a = rnd() * TAU, d = rnd() * r * 0.75
      b.cyl(0.17, 0.17, 0.05, x + Math.cos(a) * d, y + r * 0.42 * (1 - (d / r) ** 2) - 0.03, z + Math.sin(a) * d, i % 3 ? C.gold : C.goldDark, { seg: 10, rx: (rnd() - 0.5) * 1.4, rz: (rnd() - 0.5) * 1.4, ao: 0, glow: 1.12 })
    }
  }

  // ------------------------------------------------------------ the little people (peg figures)
  const alive = [] // each: t => move one figure
  /** A peg figure: a merged body and two arms that swing from the shoulder (the hand at the arm's foot). */
  const peg = ({ fill, sleeve, hand, s = 1.12, armX = 0.27, armY = 0.76, armLen = 0.44, armR = 0.075, fist = 0.078, arm = null }) => {
    const b = make()
    fill(b)
    const g = new THREE.Group(), body = b.mesh()
    g.add(body)
    const arms = [-1, 1].map(sx => {
      const a = make()
      a.cyl(armR, armR * 0.83, armLen, 0, -armLen, 0, sleeve, { seg: 7, ao: 0.15 }).ball(fist, 0, -armLen - 0.03, 0, hand, { detail: 1, ao: 0 })
      if (arm) arm(a, sx, -armLen - 0.03)
      const m = a.mesh({ shadow: false })
      m.position.set(sx * armX, armY, 0)
      g.add(m)
      return m
    })
    g.scale.setScalar(s)
    return { g, body, l: arms[0], r: arms[1] }
  }
  const head = (b, skin, y = 1.02, r = 0.215) => b.ball(r, 0, y, 0, skin, { detail: 2, ao: 0.15 }).ball(0.03, -0.075, y + 0.02, r * 0.93, '#2a1d18', { detail: 0, ao: 0 }).ball(0.03, 0.075, y + 0.02, r * 0.93, '#2a1d18', { detail: 0, ao: 0 })
  const villager = ({ tunic, hat = 'straw', hatColor = C.red, tool = null, both = null, s = 1.12 }) => {
    const skin = pick(C.skin), hair = pick(C.hair)
    return peg({
      s, sleeve: tunic, hand: skin,
      fill: b => {
        b.cyl(0.18, 0.32, 0.84, 0, 0, 0, tunic, { ao: 0.32 }).cyl(0.268, 0.285, 0.09, 0, 0.3, 0, C.woodDark, { ao: 0 })
        b.rbox(0.15, 0.1, 0.22, -0.11, 0, 0.2, C.woodDark, { ao: 0, r: 0.04 }).rbox(0.15, 0.1, 0.22, 0.11, 0, 0.2, C.woodDark, { ao: 0, r: 0.04 })
        head(b, skin)
        b.ball(0.222, 0, 1.06, -0.045, hair, { detail: 2, ao: 0.1 })
        if (hat === 'straw') b.cone(0.44, 0.2, 0, 1.15, 0, C.straw, { seg: 12, ao: 0.25 })
        else if (hat === 'cap') b.cyl(0.19, 0.23, 0.13, 0, 1.17, 0, hatColor).ball(0.05, 0, 1.3, 0, C.white, { detail: 0 })
        else if (hat === 'hood') b.ball(0.25, 0, 1.03, -0.06, tunic, { detail: 2 })
        else if (hat === 'scarf') b.ball(0.235, 0, 1.08, -0.03, hatColor, { detail: 2, sy: 0.8 })
      },
      arm: (a, sx) => { if (both) both(a, sx); else if (tool && sx === 1) tool(a) },
    })
  }
  // Tools, in the arm's own space: the hand is at (0, -0.47, 0), forward is +z.
  const pickaxe = a => a.box(0.05, 0.05, 0.86, 0, -0.5, 0.05, C.wood, { ao: 0 }).box(0.06, 0.62, 0.08, 0, -0.81, 0.86, C.ironLight, { ao: 0 }).cone(0.05, 0.16, 0, -0.5, 0.86, C.steel, { seg: 4, rx: 0, ao: 0 })
  const bow = a => a.geo(new THREE.TorusGeometry(0.46, 0.035, 4, 12, Math.PI * 0.8).rotateZ(-Math.PI * 0.4).rotateY(Math.PI / 2), C.woodDark, 0, -0.47, 0.06, { ao: 0 }).box(0.012, 0.86, 0.012, 0, -0.9, -0.08, C.white, { ao: 0 })
  const bucket = a => a.cyl(0.14, 0.11, 0.22, 0, -0.76, 0, C.wood, { seg: 8 }).cyl(0.12, 0.12, 0.02, 0, -0.56, 0, C.mana, { seg: 8, ao: 0, glow: 1.6 })

  // ------------------------------------------------------------ the buildings he raises
  const pops = [] // { obj, at (the traveller's x that raises it), k, v, want, r }
  const pop = (mesh, x, z, at, { ry = 0, y = 0, r = 3 } = {}) => {
    mesh.position.set(x, y, z)
    mesh.rotation.y = ry
    mesh.scale.setScalar(1e-3)
    scene.add(mesh)
    const rec = { obj: mesh, at, k: 0, v: 0, want: 0, shown: -1, since: -9, r, x, z }
    pops.push(rec)
    return rec
  }
  // [x, z, w, d, at]: where each plot is, its footprint, and the traveller's x that raises it.
  const SITES = {
    hut: [7.4, -6.4, 3.6, 3.4, 1.5], goldA: [12.8, -7.6, 5.2, 4.8, 6.5], goldB: [10.4, -16.4, 5.2, 4.8, 8],
    cannonA: [15.2, 4.9, 3.6, 3.6, 11], store: [17.6, -16.6, 4, 3.8, 12.5], archerA: [25.4, -18.2, 4, 4, 20],
    barracks: [25.4, -8.2, 6.6, 5.2, 19], well: [19.4, -6.8, 4.2, 4.2, 14], cannonB: [31, 4.9, 3.6, 3.6, 25],
    hall: [37.6, -12.6, 11.4, 10.4, 28.5], tank: [47.6, -6.8, 4, 4, 40.5], sky: [48.2, -18, 4.2, 4.2, 41.5],
    cannonC: [46.2, 4.9, 3.6, 3.6, 41], archerB: [54.4, -13.6, 4, 4, 47.5],
  }
  const site = (name, mesh, o) => pop(mesh, SITES[name][0], SITES[name][1], SITES[name][4], { r: Math.max(SITES[name][2], SITES[name][3]) / 2, ...o })
  /** A moving part: its own mesh, a child of the building it belongs to. */
  const part = (parent, fill, x, y, z) => {
    const b = make()
    fill(b)
    const m = b.mesh()
    m.position.set(x, y, z)
    parent.add(m)
    return m
  }

  const build = {
    hut() {
      // The builder's hut: a plank cabin under an orange hip roof, his big hammer sign, bricks and planks.
      const b = make()
      b.rbox(3.4, 0.32, 3.2, 0, 0, 0, C.stoneWarm, { r: 0.12 })
      b.rbox(2.7, 1.85, 2.5, 0, 0.32, 0, C.plank, { r: 0.12, ao: 0.25 })
      for (let i = 0; i < 4; i++) b.box(2.66, 0.05, 0.04, 0, 0.62 + i * 0.4, 1.26, C.plankDark, { ao: 0 })
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rbox(0.32, 1.95, 0.32, sx * 1.3, 0.32, sz * 1.2, C.wood, { r: 0.08 })
      b.rbox(3.25, 0.24, 3.05, 0, 2.17, 0, C.woodDark, { r: 0.08, ao: 0 })
      b.cone(2.4, 1.6, 0, 2.41, 0, C.orange, { seg: 4, turn: Math.PI / 4, ao: 0.12 }).ball(0.18, 0, 4.0, 0, C.gold, { ao: 0 })
      door(b, -0.45, 0.32, 1.27, 0.8, 1.15)
      windowAt(b, 0.66, 0.98, 1.27, { w: 0.6, h: 0.6 })
      b.sub(() => windowAt(b, 0, 0.98, 0, { w: 0.6, h: 0.6 }), -1.27, 0, 0, -Math.PI / 2)
      // The sign: a giant hammer leaning on the front corner.
      b.sub(() => b.rbox(0.16, 1.7, 0.16, 0, 0, 0, C.wood, { r: 0.05 }).rbox(0.75, 0.36, 0.36, 0, 1.55, 0, C.ironLight, { r: 0.08 }).box(0.06, 0.4, 0.38, 0.39, 1.53, 0, C.steel, { ao: 0 }), 1.55, 0, 1.55, 0.4)
      // Bricks, planks and a toolbox.
      for (let i = 0; i < 6; i++) b.rbox(0.42, 0.18, 0.22, -1.65 + (i % 3) * 0.44, Math.floor(i / 3) * 0.19, 1.6, i % 2 ? '#d0603e' : '#e0734c', { r: 0.03, ao: 0.1 })
      for (let i = 0; i < 4; i++) b.box(1.7, 0.07, 0.26, -0.4, i * 0.075, 2.05 + (i % 2) * 0.03, i % 2 ? '#f3d49a' : '#e9c483', { ry: 0.08, ao: 0 })
      b.rbox(0.55, 0.32, 0.3, 0.6, 0, 2.05, C.red, { r: 0.05 }).box(0.3, 0.06, 0.04, 0.6, 0.34, 2.05, C.iron, { ao: 0 })
      return site('hut', b.mesh(), { ry: 0.12 })
    },
    goldMine(name) {
      // A rocky mound with gold in its seams, a timber-framed adit, a cart of ore on its rails, a winch.
      const b = make(), rockC = [0, 0.3, -0.7], rad = [2.1, 1.45, 1.8]
      b.ball(1, ...rockC, C.rock, { detail: 1, flat: true, sx: rad[0], sy: rad[1], sz: rad[2], ao: 0.35 })
      b.ball(1.25, -1.6, 0.1, 0.1, '#b79f83', { detail: 1, flat: true, sy: 0.7, ao: 0.3 }).ball(1.1, 1.7, 0.05, 0.2, '#957e66', { detail: 1, flat: true, sy: 0.72, ao: 0.3 })
      for (let i = 0; i < 9; i++) {
        const a = (rnd() - 0.5) * 2.6, e = 0.25 + rnd() * 0.75, s = 0.2 + rnd() * 0.16
        b.geo(new THREE.OctahedronGeometry(s, 0).scale(1, 1.4, 1), i % 3 ? C.gold : '#ffe27a', rockC[0] + Math.sin(a) * Math.cos(e) * rad[0] * 0.93, rockC[1] + Math.sin(e) * rad[1] * 0.93, rockC[2] + Math.cos(a) * Math.cos(e) * rad[2] * 0.93, { ao: 0, glow: 1.15, rx: rnd() - 0.5, rz: rnd() - 0.5 })
      }
      b.box(1.3, 1.35, 0.4, 0, 0, 1.0, '#2a1d18', { ao: 0 })
      for (const sx of [-1, 1]) b.rbox(0.3, 1.65, 0.34, sx * 0.8, 0, 1.15, C.wood, { r: 0.07 })
      b.rbox(2.1, 0.32, 0.4, 0, 1.55, 1.15, C.wood, { r: 0.08 }).ball(0.2, 0, 1.95, 1.3, C.gold, { glow: 1.15, ao: 0 })
      // Rails and sleepers out of the mouth, the cart on them.
      for (let i = 0; i < 5; i++) b.box(1.1, 0.06, 0.18, 0, 0, 1.4 + i * 0.36, C.woodDark, { ao: 0 })
      for (const sx of [-1, 1]) b.box(0.06, 0.07, 1.9, sx * 0.38, 0.06, 2.1, C.ironLight, { ao: 0 })
      b.rbox(0.95, 0.5, 0.75, 0, 0.22, 2.3, C.iron, { r: 0.08 }).box(1.0, 0.07, 0.8, 0, 0.62, 2.3, C.ironLight, { ao: 0 })
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.13, 0.13, 0.08, sx * 0.42, 0.24, 2.3 + sz * 0.24, '#2e3340', { seg: 8, rz: Math.PI / 2, ao: 0 })
      for (let i = 0; i < 6; i++) b.geo(new THREE.OctahedronGeometry(0.17, 0), C.gold, -0.3 + (i % 3) * 0.3, 0.74 + Math.floor(i / 3) * 0.1, 2.18 + Math.floor(i / 3) * 0.22, { ao: 0, glow: 1.15, ry: i })
      coins(b, 1.85, 0, 1.7, 0.55)
      // The winch's A-frame on the mound's top.
      for (const sx of [-1, 1]) b.rbox(0.18, 2.0, 0.18, sx * 0.7, 1.35, -0.6, C.wood, { rz: sx * 0.22, r: 0.05 })
      b.rbox(1.8, 0.14, 0.14, 0, 3.25, -0.6, C.woodDark, { r: 0.04 })
      const m = b.mesh()
      const wheel = part(m, w => {
        w.geo(new THREE.TorusGeometry(0.55, 0.07, 5, 14).rotateY(Math.PI / 2), C.woodDark, 0, 0, 0, { ao: 0 })
        for (let i = 0; i < 3; i++) w.box(0.08, 1.08, 0.08, 0, -0.54, 0, C.wood, { rx: (i * Math.PI) / 3, ao: 0 })
        w.cyl(0.12, 0.12, 0.3, -0.15, 0, 0, C.iron, { seg: 8, rz: -Math.PI / 2, ao: 0 })
      }, 0, 3.32, -0.35)
      const k = name === 'goldA' ? 0 : 1.7
      alive.push(t => { wheel.rotation.x = -t * 1.7 - k })
      return site(name, m, { ry: name === 'goldA' ? 0.1 : -0.12 })
    },
    well() {
      // The mana well: a glass orb of glowing purple liquid on a pump, worked by a lever.
      const b = make()
      b.cyl(1.75, 1.9, 0.5, 0, 0, 0, C.stone, { seg: 10 }).cyl(1.85, 1.85, 0.14, 0, 0.5, 0, C.stoneWarm, { seg: 10, ao: 0 })
      b.cyl(1.15, 1.32, 0.62, 0, 0.64, 0, C.slate, { seg: 8 }).cyl(1.25, 1.25, 0.14, 0, 1.26, 0, C.gold, { seg: 8, ao: 0 })
      for (let i = 0; i < 4; i++) {
        const a = i * (TAU / 4) + Math.PI / 4
        b.rbox(0.2, 1.5, 0.2, Math.cos(a) * 1.08, 1.3, Math.sin(a) * 1.08, C.iron, { r: 0.05 }).ball(0.13, Math.cos(a) * 1.08, 2.85, Math.sin(a) * 1.08, C.gold, { ao: 0 })
      }
      b.cyl(1.12, 1.12, 0.12, 0, 2.1, 0, C.goldDark, { seg: 16, open: true, ao: 0 })
      b.cyl(0.42, 0.58, 0.32, 0, 3.5, 0, C.gold, { seg: 12 }).cyl(0.16, 0.16, 0.36, 0, 3.82, 0, C.iron, { seg: 8 }).ball(0.16, 0, 4.24, 0, C.mana, { glow: 1.8, ao: 0 })
      // The pipe down into the ground, the lever's post.
      b.cyl(0.12, 0.12, 1.2, 1.45, 0.5, 0.7, C.iron, { seg: 8 }).rbox(0.36, 0.2, 0.36, 1.45, 1.6, 0.7, C.ironLight, { r: 0.06 })
      b.rbox(0.3, 1.5, 0.3, -1.55, 0.5, 0.75, C.wood, { r: 0.07 })
      for (let i = 0; i < 5; i++) b.geo(new THREE.OctahedronGeometry(0.16, 0).scale(1, 1.5, 1), C.mana, Math.cos(i * 1.3) * 1.65, 0.62, Math.sin(i * 1.3) * 1.65 + 0.1, { ao: 0, glow: 1.5 })
      const m = b.mesh()
      const liquid = part(m, w => w.ball(0.95, 0, 0, 0, C.mana, { detail: 3, glow: 1.45, ao: 0 }).ball(0.32, -0.3, 0.38, 0.55, C.manaHi, { detail: 2, glow: 1.9, ao: 0 }), 0, 2.45, 0)
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 3), GLASS)
      orb.position.y = 2.45
      orb.frustumCulled = false
      m.add(orb)
      const lever = part(m, w => w.rbox(1.6, 0.14, 0.14, 0.55, -0.07, 0, C.woodDark, { r: 0.04 }).ball(0.12, 1.35, 0, 0, C.red, { ao: 0 }), -1.55, 2.05, 0.75)
      const pumper = villager({ tunic: '#7b5bd6', hat: 'scarf', hatColor: '#ffcf4a', s: 1.1 })
      pumper.g.position.set(-1.2, 0, 2.05)
      pumper.g.rotation.y = Math.PI * 0.85
      m.add(pumper.g)
      alive.push(t => {
        const pump = Math.sin(t * 2.6)
        lever.rotation.z = 0.35 * pump
        liquid.scale.set(1 + 0.03 * pump, 1 - 0.04 * pump, 1 + 0.03 * pump)
        liquid.rotation.y = t * 0.5
        pumper.l.rotation.x = pumper.r.rotation.x = -1.9 - 0.4 * pump
        pumper.body.rotation.x = 0.06 + 0.05 * pump
      })
      return site('well', m)
    },
    store() {
      // The gold store: an iron-bound strongbox the size of a shed, heaped with coins, padlocked.
      const b = make()
      b.rbox(3.6, 0.3, 3.4, 0, 0, 0, C.stoneWarm, { r: 0.12 })
      b.rbox(3.0, 1.7, 2.8, 0, 0.3, 0, C.wood, { r: 0.18, seg: 2 })
      for (const y of [0.55, 1.55]) b.rbox(3.1, 0.16, 2.9, 0, y, 0, C.iron, { r: 0.06, ao: 0 })
      for (const x of [-0.75, 0.75]) b.box(0.16, 1.72, 0.06, x, 0.3, 1.42, C.iron, { ao: 0 })
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rbox(0.55, 0.55, 0.55, sx * 1.42, 1.62, sz * 1.32, C.gold, { r: 0.12, glow: 1.08 })
      b.rbox(3.1, 0.22, 2.9, 0, 2.0, 0, C.woodDark, { r: 0.08, ao: 0 })
      coins(b, 0, 2.1, 0, 1.25)
      b.rbox(0.44, 0.48, 0.16, 0, 0.85, 1.42, C.gold, { r: 0.08, glow: 1.1 }).geo(new THREE.TorusGeometry(0.15, 0.04, 5, 10, Math.PI), C.ironLight, 0, 1.32, 1.42, { ao: 0 }).box(0.08, 0.14, 0.04, 0, 0.95, 1.5, '#2a1d18', { ao: 0 })
      sack(b, 1.9, 0, 1.4, 0.9, '#e6c76a')
      sack(b, -1.85, 0, 1.5, 0.8, '#e6c76a')
      return site('store', b.mesh(), { ry: -0.06 })
    },
    tank() {
      // The mana store: a squat glass tank of the purple liquid in an iron frame with gold bands.
      const b = make()
      b.rbox(3.4, 0.45, 3.4, 0, 0, 0, C.stone, { r: 0.14 }).rbox(3.6, 0.14, 3.6, 0, 0.45, 0, C.stoneWarm, { r: 0.05, ao: 0 })
      b.cyl(1.02, 1.02, 1.7, 0, 0.62, 0, C.mana, { seg: 16, glow: 1.4, ao: 0.1 }).cyl(0.6, 0.6, 0.05, 0, 2.31, 0, C.manaHi, { seg: 12, glow: 1.8, ao: 0 })
      for (const y of [0.55, 2.35]) b.cyl(1.28, 1.28, 0.24, 0, y, 0, C.gold, { seg: 16, ao: 0 })
      for (let i = 0; i < 4; i++) {
        const a = i * (TAU / 4) + Math.PI / 4
        b.rbox(0.22, 2.1, 0.22, Math.cos(a) * 1.3, 0.55, Math.sin(a) * 1.3, C.iron, { r: 0.05 })
      }
      b.cone(1.3, 0.7, 0, 2.59, 0, C.iron, { seg: 16, ao: 0.1 }).ball(0.2, 0, 3.3, 0, C.mana, { glow: 1.8, ao: 0 })
      const m = b.mesh()
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.14, 1.14, 1.78, 20, 1, true).translate(0, 0.89 + 0.6, 0), GLASS)
      glass.frustumCulled = false
      m.add(glass)
      return site('tank', m)
    },
    cannon(name, k) {
      // A round stone emplacement, a turning carriage, a fat iron barrel that kicks when it fires.
      const b = make()
      b.cyl(1.6, 1.75, 0.6, 0, 0, 0, C.stone, { seg: 12 }).cyl(1.68, 1.68, 0.12, 0, 0.6, 0, C.stoneWarm, { seg: 12, ao: 0 }).cyl(1.25, 1.25, 0.08, 0, 0.72, 0, C.plank, { seg: 12, ao: 0 })
      for (let i = 0; i < 8; i++) b.rbox(0.5, 0.3, 0.3, Math.cos(i * 0.785) * 1.55, 0.72, Math.sin(i * 0.785) * 1.55, i % 2 ? C.stoneWarm : C.stoneDark, { ry: -i * 0.785, r: 0.06, ao: 0 })
      for (const [x, y, z] of [[1.0, 0.98, 0.95], [1.3, 0.98, 0.6], [1.18, 1.3, 0.8]]) b.ball(0.2, x, y, z, '#2e3340', { detail: 2, ao: 0.1 })
      const m = b.mesh()
      let barrel
      const turret = part(m, w => {
        w.rbox(1.2, 0.42, 1.5, 0, 0, 0, C.wood, { r: 0.1 })
        for (const sx of [-1, 1]) w.rbox(0.2, 0.75, 1.2, sx * 0.5, 0.3, -0.05, C.woodDark, { r: 0.06 }).cyl(0.14, 0.14, 0.1, sx * 0.62, 0.78, 0, C.gold, { seg: 8, rz: Math.PI / 2, ao: 0 })
      }, 0, 0.8, 0)
      barrel = part(turret, w => {
        w.cyl(0.3, 0.42, 1.9, 0, 0, -0.75, C.iron, { seg: 12, rx: Math.PI / 2, ao: 0 })
        w.cyl(0.38, 0.38, 0.22, 0, 0, 0.98, C.iron, { seg: 12, rx: Math.PI / 2, ao: 0 }).cyl(0.22, 0.22, 0.02, 0, 0, 1.205, '#12141a', { seg: 10, rx: Math.PI / 2, ao: 0 })
        w.cyl(0.45, 0.45, 0.14, 0, 0, -0.1, C.gold, { seg: 12, rx: Math.PI / 2, ao: 0 }).ball(0.2, 0, 0, -0.85, C.iron, { ao: 0 })
      }, 0, 0.85, 0)
      barrel.rotation.x = -0.14
      alive.push(t => {
        turret.rotation.y = 0.5 + Math.sin(t * 0.42 + k * 2.1) * 0.75
        const kick = Math.max(0, 1 - ((t + k * 1.9) % 5.2) / 0.45)
        barrel.position.z = -0.32 * kick * kick
      })
      const holder = new THREE.Group() // the spring scales the holder; the cannon itself is a size smaller than it was drawn
      m.scale.setScalar(0.8)
      holder.add(m)
      return site(name, holder)
    },
    archer(name, k) {
      // A stone foot, four timber legs, a railed deck under a red pointed canopy, an archer keeping watch.
      const b = make(), top = 4.9
      b.rbox(3.2, 1.2, 3.2, 0, 0, 0, C.stone, { r: 0.2, seg: 2 }).rbox(3.4, 0.22, 3.4, 0, 1.2, 0, C.stoneDark, { r: 0.08, ao: 0 })
      proud(b, 3.2, 1.2, 3.2, 0, 0, 0, 6)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rbox(0.36, top - 1.3, 0.36, sx * 1.05, 1.42, sz * 1.05, C.wood, { r: 0.08, rz: sx * 0.05, rx: -sz * 0.05 })
      for (const y of [2.4, 3.7]) for (const s of [-1, 1]) b.box(2.2, 0.16, 0.14, 0, y, s * 1.08, C.woodDark, { ao: 0 }).box(0.14, 0.16, 2.2, s * 1.08, y, 0, C.woodDark, { ao: 0 })
      b.box(0.12, 2.2, 0.1, 0, 1.9, 1.12, C.plank, { rz: 0.9, ao: 0 }).box(0.12, 2.2, 0.1, -1.12, 1.9, 0, C.plank, { rx: 0.9, ao: 0 })
      b.rbox(3.3, 0.32, 3.3, 0, top, 0, C.plank, { r: 0.08 })
      for (const s of [-1, 1]) {
        b.rbox(3.3, 0.6, 0.16, 0, top + 0.32, s * 1.58, C.plankDark, { r: 0.05 }).rbox(0.16, 0.6, 3.3, s * 1.58, top + 0.32, 0, C.plankDark, { r: 0.05 })
        b.box(3.32, 0.1, 0.18, 0, top + 0.62, s * 1.58, C.red, { ao: 0 }).box(0.18, 0.1, 3.32, s * 1.58, top + 0.62, 0, C.red, { ao: 0 })
        for (const t of [-1, 1]) b.rbox(0.18, 1.9, 0.18, s * 1.5, top + 0.32, t * 1.5, C.woodDark, { r: 0.05 })
      }
      b.cone(2.7, 1.8, 0, top + 2.2, 0, C.red, { seg: 4, turn: Math.PI / 4, ao: 0.12 }).rbox(3.7, 0.16, 3.7, 0, top + 2.15, 0, C.redDark, { r: 0.06, ao: 0 })
      flagpole(b, 0, top + 3.9, 0, 1.2, C.gold, 1.2)
      for (let i = 0; i < 8; i++) b.box(0.5, 0.06, 0.08, 0, 1.5 + i * 0.44, 1.7, C.plank, { ao: 0 }) // the ladder
      for (const sx of [-1, 1]) b.box(0.07, top - 1.2, 0.07, sx * 0.27, 1.42, 1.72, C.wood, { ao: 0 })
      const m = b.mesh(), watch = villager({ tunic: '#3d9a52', hat: 'hood', both: (a, sx) => sx === -1 && bow(a), s: 1.1 })
      watch.g.position.set(0.2, top + 0.32, 0.3)
      watch.l.rotation.x = -1.35
      watch.r.rotation.x = -1.2
      m.add(watch.g)
      alive.push(t => { watch.g.rotation.y = 0.3 + Math.sin(t * 0.45 + k * 2) * 1.0 })
      return site(name, m)
    },
    sky() {
      // The sky defence: a hexagonal stone base, a blue turret that turns, a rack of four rockets aimed up.
      const b = make()
      b.cyl(1.8, 2.0, 0.95, 0, 0, 0, C.stone, { seg: 6 }).cyl(1.95, 1.95, 0.18, 0, 0.95, 0, C.stoneDark, { seg: 6, ao: 0 })
      for (let i = 0; i < 6; i++) b.rbox(0.9, 0.34, 0.12, Math.cos(i * 1.047 + 0.5236) * 1.72, 0.3, Math.sin(i * 1.047 + 0.5236) * 1.72, C.gold, { ry: -i * 1.047 - 0.5236 + Math.PI / 2, r: 0.04, ao: 0 })
      b.cyl(0.6, 0.78, 0.9, 0, 1.13, 0, C.iron, { seg: 10 })
      const m = b.mesh()
      const turret = part(m, w => {
        w.rbox(1.7, 0.62, 1.5, 0, 0, 0, C.blue, { r: 0.2, seg: 2 }).rbox(1.8, 0.14, 1.6, 0, 0.62, 0, C.blueDark, { r: 0.05, ao: 0 })
        for (const sx of [-1, 1]) w.rbox(0.22, 0.9, 0.9, sx * 0.85, 0.5, 0, C.ironLight, { r: 0.06 })
      }, 0, 2.03, 0)
      const rack = part(turret, w => {
        w.rbox(1.35, 0.7, 1.1, 0, -0.35, 0, C.steel, { r: 0.12 })
        for (const [x, y] of [[-0.32, 0.18], [0.32, 0.18], [-0.32, -0.2], [0.32, -0.2]]) {
          w.cyl(0.15, 0.15, 1.3, x, y, -0.55, C.white, { seg: 8, rx: Math.PI / 2, ao: 0 }).cone(0.15, 0.42, x, y, 0.75, C.red, { seg: 8, rx: Math.PI / 2, ao: 0 })
          w.cyl(0.165, 0.165, 0.12, x, y, -0.3, C.red, { seg: 8, rx: Math.PI / 2, ao: 0 })
        }
      }, 0, 1.0, 0)
      rack.rotation.x = -0.6
      alive.push(t => {
        turret.rotation.y = t * 0.35
        rack.rotation.x = -0.6 - 0.15 * Math.sin(t * 0.9)
      })
      return site('sky', m)
    },
    barracks() {
      // Stone below, timber above, a red roof; crossed blades over the door, a training dummy and a fire.
      const b = make(), w = 5.6, d = 3.8
      b.rbox(6.6, 0.35, 5.2, 0, 0, 0, C.stoneWarm, { r: 0.12 })
      b.rbox(w, 1.15, d, 0, 0.35, -0.3, C.stone, { r: 0.18, seg: 2 })
      proud(b, w, 1.15, d, 0, 0.35, -0.3, 8)
      b.rbox(w - 0.2, 1.2, d - 0.2, 0, 1.5, -0.3, C.plaster, { r: 0.12 })
      for (let i = 0; i <= 4; i++) b.rbox(0.22, 1.2, 0.14, -w / 2 + 0.2 + i * ((w - 0.4) / 4), 1.5, d / 2 - 0.36, C.woodDark, { r: 0.04, ao: 0 })
      b.rbox(w, 0.2, d + 0.1, 0, 2.62, -0.3, C.woodDark, { r: 0.06, ao: 0 })
      b.sub(() => gable(b, d + 0.3, w, 1.7, 2.8, C.red, { wall: C.plaster }), 0, 0, -0.3, Math.PI / 2)
      door(b, 0, 0.35, d / 2 - 0.26, 1.3, 1.3)
      for (const sx of [-1, 1]) windowAt(b, sx * 1.75, 1.75, d / 2 - 0.26, { w: 0.62, h: 0.62 })
      // The badge: a gold disc with two crossed blades.
      b.cyl(0.42, 0.42, 0.1, 0, 3.55, 1.55, C.gold, { seg: 14, rx: Math.PI / 2, ao: 0 })
      for (const s of [-1, 1]) b.box(0.08, 0.86, 0.05, 0, 3.15, 1.67, C.steel, { rz: s * 0.75, ao: 0 })
      flagpole(b, -w / 2 - 0.3, 0.35, 1.4, 3.4, C.red, 1.6)
      // The training dummy, a spear rack.
      b.cyl(0.07, 0.07, 1.2, -2.6, 0, 2.6, C.wood, { seg: 6 }).box(0.9, 0.08, 0.08, -2.6, 1.0, 2.6, C.wood, { ao: 0 }).ball(0.3, -2.6, 0.95, 2.6, C.straw, { sy: 1.2, ao: 0.2 }).ball(0.2, -2.6, 1.42, 2.6, '#f1e2bf', { ao: 0 })
      for (let i = 0; i < 4; i++) b.cyl(0.03, 0.03, 1.8, 2.5 + i * 0.22, 0, 1.9, C.wood, { seg: 5, rz: -0.12 }).cone(0.06, 0.22, 2.5 + i * 0.22 + 0.21, 1.78, 1.9, C.steel, { seg: 4, rz: -0.12 })
      b.box(1.2, 0.08, 0.12, 2.83, 0.9, 1.95, C.woodDark, { ao: 0 })
      // The fire: a ring of stones, crossed logs.
      for (let i = 0; i < 8; i++) b.ball(0.16, 1.3 + Math.cos(i * 0.785) * 0.5, 0.08, 3.3 + Math.sin(i * 0.785) * 0.5, C.stoneDark, { detail: 0, flat: true, ao: 0 })
      for (let i = 0; i < 3; i++) b.cyl(0.07, 0.07, 0.8, 1.3, 0.12, 3.3, C.woodDark, { seg: 6, rz: Math.PI / 2, ry: (i * Math.PI) / 3, ao: 0 })
      const m = b.mesh()
      const fire = part(m, f => f.cone(0.3, 0.7, 0, 0, 0, '#ff8a2a', { seg: 7, glow: 2.6, ao: 0 }).cone(0.18, 0.5, 0.06, 0, 0.04, '#ffd34a', { seg: 6, glow: 3, ao: 0 }), 1.3, 0.14, 3.3)
      fire.castShadow = false
      alive.push(t => { fire.scale.set(1 + 0.08 * Math.sin(t * 13), 0.85 + 0.25 * Math.abs(Math.sin(t * 9.3) + 0.4 * Math.sin(t * 17)), 1 + 0.08 * Math.sin(t * 11 + 1)) })
      return site('barracks', m)
    },
    *hall() { // a job a lift (see the build below)
      // The town hall, in three lifts: a stone ground floor on its podium; a timber hall under a red hip
      // roof; then the bell tower and two round turrets with blue cones and the big flag.
      const [x, z, , , at] = SITES.hall
      let b = make()
      b.rbox(11.2, 0.8, 9.8, 0, 0, 0, C.stoneWarm, { r: 0.22, seg: 2 })
      for (let i = 0; i < 3; i++) b.rbox(3.6 - i * 0.3, 0.3, 0.6, 0, 0.5 - i * 0.25, 5.0 + i * 0.5, i % 2 ? C.stone : C.stoneWarm, { r: 0.08, ao: 0.1 })
      b.rbox(9.2, 3.0, 7.4, 0, 0.8, -0.3, C.stone, { r: 0.3, seg: 2 })
      proud(b, 9.2, 3.0, 7.4, 0, 0.8, -0.3, 26)
      for (const sx of [-1, 1]) b.cyl(0.62, 0.7, 3.2, sx * 4.5, 0.8, -3.9, C.stoneWarm, { seg: 10 }).cyl(0.75, 0.75, 0.24, sx * 4.5, 4.0, -3.9, C.gold, { seg: 10, ao: 0 })
      door(b, 0, 0.8, 3.48, 1.9, 1.8)
      for (const sx of [-1, 1]) {
        lantern(b, sx * 1.75, 2.1, 3.6)
        for (const wx of [2.7, 3.7]) windowAt(b, sx * wx, 1.9, 3.48, { w: 0.62, h: 0.9, glass: '#ffd98a', glow: 1.25 })
        b.box(0.6, 0.1, 0.14, sx * 1.75, 2.0, 3.55, C.iron, { ao: 0 })
      }
      for (const wz of [-2, 0.8]) b.sub(() => windowAt(b, 0, 1.9, 0, { w: 0.7, h: 0.9, glass: '#ffd98a', glow: 1.25 }), -4.62, 0, wz, -Math.PI / 2)
      const chat = [villager({ tunic: '#e06a9a', hat: 'hood' }), villager({ tunic: C.teal, hat: 'straw' })]
      const base = pop(b.mesh(), x, z, at, { r: 6.5 })
      chat[0].g.position.set(-3.4, 0.8, 4.4)
      chat[0].g.rotation.y = 1.2
      chat[1].g.position.set(-2.5, 0.8, 4.7)
      chat[1].g.rotation.y = -1.9
      base.obj.add(chat[0].g, chat[1].g)
      alive.push(t => {
        chat[0].body.rotation.x = Math.sin(t * 2.1) * 0.06
        chat[0].r.rotation.x = -0.7 - Math.max(0, Math.sin(t * 2.1)) * 0.7
        chat[1].body.rotation.z = Math.sin(t * 1.7 + 1) * 0.07
        chat[1].l.rotation.x = -0.4 - Math.max(0, Math.sin(t * 1.7 + 2)) * 0.9
      })
      yield

      // The hall: a gold band, plaster and timber, a row of windows, the red hip roof.
      b = make()
      b.rbox(9.6, 0.34, 7.8, 0, 0, -0.3, C.gold, { r: 0.1 })
      b.rbox(8.2, 2.3, 6.6, 0, 0.34, -0.3, C.plaster, { r: 0.18 })
      for (let i = 0; i <= 6; i++) b.rbox(0.24, 2.3, 0.16, -4.0 + i * (8 / 6), 0.34, 3.0, C.woodDark, { r: 0.05, ao: 0.1 })
      for (let i = 0; i <= 4; i++) b.rbox(0.16, 2.3, 0.24, -4.1, 0.34, -3.5 + i * 1.6, C.woodDark, { r: 0.05, ao: 0.1 })
      for (let i = 0; i < 6; i++) windowAt(b, -3.33 + i * (8 / 6), 1.05, 3.05, { w: 0.6, h: 0.7, glass: '#ffd98a', glow: 1.25 })
      b.rbox(9.8, 0.26, 8.0, 0, 2.64, -0.3, C.redDark, { r: 0.08, ao: 0 })
      b.cone(6.95, 2.9, 0, 2.9, -0.3, C.red, { seg: 4, turn: Math.PI / 4, sz: 0.82, ao: 0.15 })
      for (const sx of [-1, 1]) {
        b.box(1.4, 0.1, 0.1, sx * 2.2, 0.02, 3.5, C.gold, { ao: 0 })
        b.banner(1.2, 0.4, sx * 2.2, 0, 3.5, C.white, { total: 2.4, amp: 0.3 }).banner(1.2, 1.7, sx * 2.2, -0.4, 3.5, C.blue, { from: 0.4, total: 2.4, amp: 0.3 })
        b.pennant(0.6, 1.2, sx * 2.2, -2.1, 3.5, C.blue, { rz: -Math.PI / 2, wave: () => 0.3 }) // its pointed foot
        b.ball(0.2, sx * 2.2, -1.3, 3.56, C.gold, { ao: 0 })
      }
      pop(b.mesh(), x, z, at + 3, { y: 3.8, r: 6.5 })
      yield

      // The bell tower through the roof, two round turrets at the front corners.
      b = make()
      b.rbox(3.0, 5.0, 3.0, 0, 5.4, -0.8, C.stoneWarm, { r: 0.22, seg: 2 })
      proud(b, 3.0, 5.0, 3.0, 0, 5.4, -0.8, 12)
      b.cyl(0.85, 0.85, 0.14, 0, 8.2, 0.72, C.gold, { seg: 16, rx: Math.PI / 2, ao: 0 }).cyl(0.62, 0.62, 0.05, 0, 8.2, 0.86, C.blue, { seg: 16, rx: Math.PI / 2, ao: 0 })
      b.geo(new THREE.OctahedronGeometry(0.4, 0).scale(1, 1.3, 0.3), C.gold, 0, 8.2, 0.92, { ao: 0, glow: 1.1 })
      b.rbox(3.4, 0.3, 3.4, 0, 10.4, -0.8, C.gold, { r: 0.08, ao: 0 })
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rbox(0.36, 1.7, 0.36, sx * 1.3, 10.7, -0.8 + sz * 1.3, C.stoneWarm, { r: 0.08 })
      b.cone(0.55, 0.8, 0, 11.0, -0.8, C.gold, { seg: 12, ao: 0.1 }).ball(0.16, 0, 10.95, -0.8, C.goldDark, { ao: 0 })
      b.rbox(3.6, 0.3, 3.6, 0, 12.4, -0.8, C.blueDark, { r: 0.08, ao: 0 })
      b.cone(2.75, 2.6, 0, 12.7, -0.8, C.blue, { seg: 4, turn: Math.PI / 4, ao: 0.15 }).ball(0.28, 0, 15.3, -0.8, C.gold, { ao: 0 })
      b.cyl(0.06, 0.06, 2.6, 0, 15.3, -0.8, C.woodDark, { seg: 5 }).pennant(3.0, 1.15, 0, 17.4, -0.8, C.blue, { amp: 0.45 })
      for (const sx of [-1, 1]) {
        b.cyl(1.05, 1.12, 6.6, sx * 4.5, 0.8, 3.0, C.stone, { seg: 14 }).cyl(1.28, 1.12, 0.45, sx * 4.5, 7.4, 3.0, C.stoneWarm, { seg: 14, ao: 0 })
        b.cyl(1.3, 1.3, 0.16, sx * 4.5, 7.85, 3.0, C.gold, { seg: 14, ao: 0 })
        b.cone(1.5, 2.5, sx * 4.5, 8.0, 3.0, C.blue, { seg: 14, ao: 0.15 }).ball(0.2, sx * 4.5, 10.5, 3.0, C.gold, { ao: 0 })
        b.box(0.42, 0.9, 0.1, sx * 4.5, 5.4, 4.1, C.glassDark, { ao: 0.2 }).box(0.42, 0.9, 0.1, sx * 4.5, 2.6, 4.12, '#ffd98a', { ao: 0.2, glow: 1.25 })
      }
      pop(b.mesh(), x, z, at + 6, { r: 6.5 })
    },
    *walls() { // a job a run
      // Chunky stone wall lengths with bigger posts at every joint, round the whole base, raised in runs.
      const run = (ax, az, bx, bz, at) => {
        const b = make(), len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1.7))
        for (let i = 0; i < n; i++) {
          const cx = -len / 2 + (i + 0.5) * (len / n)
          b.rbox(len / n - 0.04, 1.15, 0.8, cx, 0, 0, i % 2 ? '#c9cfd9' : '#d6dae2', { r: 0.14, ao: 0.3 })
        }
        for (let i = 0; i <= n; i++) {
          const cx = -len / 2 + i * (len / n)
          b.rbox(0.98, 1.5, 0.98, cx, 0, 0, '#a2abbc', { r: 0.18, ao: 0.3 }).rbox(1.04, 0.2, 1.04, cx, 1.46, 0, '#8d97aa', { r: 0.08, ao: 0 })
        }
        pop(b.mesh(), (ax + bx) / 2, (az + bz) / 2, at, { ry: Math.atan2(-(bz - az), bx - ax), r: len / 2 })
      }
      const gz0 = pathZ(BX0), gz1 = pathZ(BX1), G = 2.6
      yield run(BX0, BZ1, BX0, gz0 + G, -1)
      yield run(BX0, gz0 - G, BX0, BZ0, -1)
      for (let i = 0; i < 6; i++) {
        const a = BX0 + (i * (BX1 - BX0)) / 6, c = BX0 + ((i + 1) * (BX1 - BX0)) / 6
        yield run(a, BZ0, c, BZ0, a - 1 + i * 1.2)
        yield run(a, BZ1, c, BZ1, a + 1 + i * 1.2)
      }
      yield run(BX1, BZ0, BX1, gz1 - G, 47)
      run(BX1, gz1 + G, BX1, BZ1, 49)
    },
    gate(gx, at) {
      // Two big gate posts with gold caps, torches and flags.
      const b = make(), gz = pathZ(gx)
      for (const s of [-1, 1]) {
        b.rbox(1.5, 2.8, 1.5, 0, 0, gz + s * 2.6, C.stoneWarm, { r: 0.24, seg: 2 }).rbox(1.7, 0.3, 1.7, 0, 2.8, gz + s * 2.6, C.stoneDark, { r: 0.1, ao: 0 })
        proud(b, 1.5, 2.8, 1.5, 0, 0, gz + s * 2.6, 5)
        b.ball(0.38, 0, 3.4, gz + s * 2.6, C.gold, { detail: 2, ao: 0 })
        lantern(b, -0.85, 1.7, gz + s * 2.6)
        flagpole(b, 0.3, 3.1, gz + s * 2.6 - 0.3, 1.8, C.blue, 1.4)
      }
      pop(b.mesh(), gx, 0, at, { r: 3 })
    },
  }

  // ------------------------------------------------------------ the troops: original toon figures
  const brawler = () => {
    const skin = '#e3a777'
    return peg({
      s: 1.18, sleeve: skin, hand: skin, armX: 0.37, armY: 0.9, armLen: 0.4, armR: 0.095, fist: 0.14,
      fill: b => {
        for (const sx of [-1, 1]) b.rbox(0.2, 0.14, 0.3, sx * 0.13, 0, 0.04, '#5a3420', { r: 0.05, ao: 0 })
        b.cyl(0.28, 0.3, 0.38, 0, 0.08, 0, '#2f5fb8', { seg: 10 }).cyl(0.31, 0.31, 0.09, 0, 0.42, 0, '#5a3420', { seg: 10, ao: 0 }).rbox(0.14, 0.12, 0.06, 0, 0.41, 0.3, C.gold, { r: 0.02, ao: 0 })
        b.cyl(0.36, 0.28, 0.5, 0, 0.5, 0, '#b65a26', { seg: 10, ao: 0.1 }).box(0.2, 0.42, 0.06, 0, 0.54, 0.3, skin, { ao: 0 })
        head(b, skin, 1.12, 0.21)
        b.cyl(0.215, 0.215, 0.07, 0, 1.16, 0, C.teal, { seg: 12, ao: 0 }).box(0.06, 0.24, 0.04, 0.05, 0.98, -0.22, C.teal, { rz: 0.3, ao: 0 })
        for (const [x, z, r] of [[0, 0, 0], [-0.1, -0.05, -0.4], [0.1, -0.05, 0.4]]) b.cone(0.09, 0.2, x, 1.28, z, '#2e2420', { seg: 5, rz: r, ao: 0 })
        b.box(0.17, 0.035, 0.03, 0, 1.17, 0.205, '#2e2420', { ao: 0 })
      },
      arm: (a, sx, hy) => a.cyl(0.1, 0.1, 0.07, 0, hy + 0.08, 0, '#5a3420', { seg: 7, ao: 0 }),
    })
  }
  const archer = () => {
    const skin = '#f2c097'
    return peg({
      s: 1.08, sleeve: '#3d9a52', hand: skin,
      fill: b => {
        for (const sx of [-1, 1]) b.rbox(0.14, 0.1, 0.22, sx * 0.11, 0, 0.2, '#5a3420', { r: 0.04, ao: 0 })
        b.cyl(0.17, 0.28, 0.84, 0, 0, 0, '#3d9a52', { ao: 0.3 }).cyl(0.255, 0.27, 0.08, 0, 0.32, 0, '#5a3420', { ao: 0 })
        head(b, skin)
        b.ball(0.25, 0, 1.04, -0.06, '#2c7a3e', { detail: 2 }).cone(0.12, 0.3, 0, 1.06, -0.3, '#2c7a3e', { seg: 6, rx: -2.2, ao: 0 })
        b.cyl(0.08, 0.08, 0.6, 0.12, 0.4, -0.27, C.wood, { seg: 7, rz: -0.35 })
        for (let i = 0; i < 3; i++) b.cone(0.045, 0.14, 0.33 + i * 0.04, 0.95 + i * 0.02, -0.25 + (i - 1) * 0.05, C.red, { seg: 4, rz: -0.35, ao: 0 })
      },
      arm: (a, sx) => sx === -1 && bow(a),
    })
  }
  const giant = () => {
    const skin = '#e8b086'
    return peg({
      s: 1.85, sleeve: skin, hand: skin, armX: 0.4, armY: 0.82, armLen: 0.42, armR: 0.1, fist: 0.14,
      fill: b => {
        for (const sx of [-1, 1]) b.rbox(0.2, 0.14, 0.3, sx * 0.14, 0, 0.05, '#6b3f20', { r: 0.05, ao: 0 })
        b.cyl(0.3, 0.42, 0.88, 0, 0, 0, '#c99a5c', { seg: 12, ao: 0.3 }).cyl(0.36, 0.38, 0.08, 0, 0.36, 0, '#8a5a2a', { seg: 12, ao: 0 })
        b.box(0.1, 0.7, 0.05, 0, 0.42, 0.3, '#8a5a2a', { rz: 0.6, ao: 0 })
        head(b, skin, 1.08, 0.24)
        b.ball(0.18, 0, 0.98, 0.13, '#8a4f25', { sy: 1.05, ao: 0 }).box(0.24, 0.05, 0.04, 0, 1.14, 0.225, '#5a3420', { ao: 0 })
        for (const sx of [-1, 1]) b.ball(0.06, sx * 0.24, 1.07, 0, skin, { detail: 0, ao: 0 })
      },
      arm: (a, sx, hy) => sx === 1 && a.cyl(0.06, 0.15, 0.95, 0, hy, -0.05, C.wood, { seg: 7, rx: Math.PI / 2, ao: 0 }).ball(0.15, 0, hy, 0.9, C.wood, { detail: 1, ao: 0 }).cone(0.05, 0.12, 0.12, hy, 0.75, C.steel, { seg: 4, rz: -Math.PI / 2, ao: 0 }),
    })
  }
  const wizard = () => {
    const skin = '#f6cfa8', robe = '#4b4fd0', hat = '#2b2878'
    return peg({
      s: 1.1, sleeve: robe, hand: skin, armR: 0.085,
      fill: b => {
        b.cyl(0.14, 0.37, 0.96, 0, 0, 0, robe, { seg: 12, ao: 0.3 }).cyl(0.375, 0.38, 0.08, 0, 0, 0, C.gold, { seg: 12, ao: 0 }).cyl(0.2, 0.22, 0.06, 0, 0.62, 0, C.gold, { seg: 12, ao: 0 })
        head(b, skin, 1.08, 0.2)
        b.cone(0.15, 0.4, 0, 1.0, 0.13, C.white, { seg: 8, rx: Math.PI, ao: 0 })
        b.cyl(0.34, 0.34, 0.04, 0, 1.2, 0, hat, { seg: 14, ao: 0 }).cyl(0.2, 0.2, 0.07, 0, 1.24, 0, C.gold, { seg: 12, ao: 0 })
        b.cone(0.2, 0.62, 0, 1.24, 0, hat, { seg: 10, rx: -0.2, ao: 0.1 })
      },
      arm: (a, sx, hy) => sx === 1 && a.cyl(0.03, 0.03, 1.55, 0, hy - 0.62, 0.1, C.woodDark, { seg: 6, ao: 0 }).ball(0.12, 0, hy + 0.98, 0.1, '#7ff0ff', { glow: 2.4, ao: 0 }),
    })
  }
  const knight = () => {
    const steel = C.steel
    return peg({
      s: 1.15, sleeve: steel, hand: C.ironLight, armR: 0.085, fist: 0.09,
      fill: b => {
        for (const sx of [-1, 1]) b.rbox(0.15, 0.12, 0.24, sx * 0.11, 0, 0.2, C.ironLight, { r: 0.04, ao: 0 })
        b.cyl(0.21, 0.3, 0.86, 0, 0, 0, steel, { seg: 12, ao: 0.3 }).rbox(0.3, 0.48, 0.06, 0, 0.3, 0.26, C.red, { r: 0.02, ao: 0 }).cyl(0.275, 0.29, 0.08, 0, 0.32, 0, C.gold, { seg: 12, ao: 0 })
        for (const sx of [-1, 1]) b.ball(0.13, sx * 0.25, 0.8, 0, '#b7bfcc', { sy: 0.7, ao: 0 })
        b.ball(0.235, 0, 1.06, 0, '#dce2ea', { detail: 2, ao: 0.1 }).box(0.3, 0.05, 0.06, 0, 1.06, 0.21, '#1f2430', { ao: 0 }).box(0.05, 0.3, 0.05, 0, 0.92, 0.22, '#aeb6c4', { ao: 0 })
        b.ball(0.1, 0, 1.36, -0.06, C.red, { sy: 1.6, sz: 1.8, ao: 0 })
      },
      arm: (a, sx, hy) => sx === -1
        ? a.cyl(0.3, 0.3, 0.06, -0.07, hy + 0.12, 0.05, '#2f63c8', { seg: 16, rz: Math.PI / 2, ao: 0 }).cyl(0.33, 0.33, 0.04, -0.06, hy + 0.12, 0.05, C.gold, { seg: 16, rz: Math.PI / 2, ao: 0 }).ball(0.08, -0.14, hy + 0.12, 0.05, C.gold, { ao: 0 })
        : a.box(0.05, 0.08, 0.75, 0, hy, 0.4, '#eef2f8', { ao: 0 }).box(0.24, 0.05, 0.06, 0, hy - 0.005, 0.05, C.gold, { ao: 0 }),
    })
  }
  /** The small dragon: green with a gold belly and orange wings that flap. */
  const dragon = () => {
    const g = new THREE.Group(), green = '#2fb37f', b = make()
    b.ball(0.5, 0, 0, 0, green, { detail: 2, sx: 0.85, sy: 0.8, sz: 1.25, ao: 0.15 }).ball(0.42, 0, -0.1, 0.1, '#ffd35a', { detail: 2, sx: 0.72, sy: 0.62, sz: 1.08, ao: 0 })
    b.ball(0.32, 0, 0.42, 0.72, green, { detail: 2, ao: 0.1 }).rbox(0.38, 0.22, 0.36, 0, 0.26, 0.96, green, { r: 0.08 })
    for (const sx of [-1, 1]) {
      b.ball(0.07, sx * 0.15, 0.56, 0.95, C.white, { ao: 0 }).ball(0.035, sx * 0.16, 0.57, 1.0, '#1f1a18', { detail: 0, ao: 0 })
      b.cone(0.06, 0.28, sx * 0.13, 0.64, 0.6, '#fff1d2', { seg: 6, rx: -0.7, ao: 0 })
      b.ball(0.12, sx * 0.25, -0.38, 0.3, green, { ao: 0 }).ball(0.12, sx * 0.25, -0.38, -0.35, green, { ao: 0 })
    }
    b.cone(0.26, 1.2, 0, 0.0, -0.45, green, { seg: 8, rx: -Math.PI / 2 - 0.15, ao: 0 })
    for (let i = 0; i < 4; i++) b.cone(0.07, 0.18, 0, 0.38 - i * 0.04, 0.35 - i * 0.3, C.orange, { seg: 4, rx: -0.4, ao: 0 })
    const body = b.mesh()
    g.add(body)
    const shape = new THREE.Shape()
    ;[[0, 0.35], [0.7, 0.62], [1.45, 0.48], [1.12, 0.06], [1.25, -0.36], [0.82, -0.2], [0.55, -0.5], [0.2, -0.3], [0, -0.2]].forEach(([x, y], i) => shape[i ? 'lineTo' : 'moveTo'](x, y))
    const wings = [-1, 1].map(sx => {
      const w = make()
      w.geo(twoSided(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).scale(sx, 1, -1)), C.orange, 0, 0, 0, { ao: 0 })
      w.box(0.06, 0.06, 0.06, 0, 0, 0, green, { ao: 0 })
      const m = w.mesh()
      m.receiveShadow = false // its own body's shadow would black out the membrane's underside
      m.position.set(sx * 0.3, 0.28, 0.12)
      g.add(m)
      return m
    })
    g.scale.setScalar(1.3)
    return { g, body, wings }
  }

  // ------------------------------------------------------------ the ground: one painting
  function paintGround() {
    const size = mobile ? 1024 : 2048
    const c = document.createElement('canvas')
    c.width = size
    c.height = size / 2
    const g = c.getContext('2d'), s = size / TW
    g.fillStyle = '#8fd652'
    g.fillRect(0, 0, size, size / 2)
    g.setTransform(s, 0, 0, s, -TX0 * s, -TZ0 * s) // from here on, in metres
    const rx = () => TX0 + rnd() * TW, rz = () => TZ0 + rnd() * (TW / 2)
    for (let i = 0; i < 420; i++) {
      const x = rx(), z = rz(), r = 1.5 + rnd() * 5.5, grad = g.createRadialGradient(x, z, 0, x, z, r)
      grad.addColorStop(0, pick(['#a9e35c', '#74c645', '#9bdc52', '#7fce4a', '#b9e86c', '#6cc04a']))
      grad.addColorStop(1, 'rgba(140,210,80,0)')
      g.globalAlpha = 0.3 + rnd() * 0.3
      g.fillStyle = grad
      g.fillRect(x - r, z - r, r * 2, r * 2)
    }
    // Inside the walls: a tidy 2 m grid of two close greens, a rim of darker grass along the wall's foot.
    g.globalAlpha = 1
    g.fillStyle = '#86cf4a'
    g.fillRect(BX0, BZ0, BX1 - BX0, BZ1 - BZ0)
    for (let x = BX0; x < BX1; x += TILE) for (let z = BZ0; z < BZ1; z += TILE) {
      g.fillStyle = ((x - BX0) / TILE + (z - BZ0) / TILE) % 2 ? '#94d955' : '#88d04b'
      g.fillRect(x, z, TILE, TILE)
    }
    g.strokeStyle = '#6fb83f'
    g.globalAlpha = 0.55
    g.lineWidth = 1.4
    g.strokeRect(BX0 + 0.6, BZ0 + 0.6, BX1 - BX0 - 1.2, BZ1 - BZ0 - 1.2)
    g.lineWidth = 0.07
    g.lineCap = 'round'
    for (const [ink, a] of [['#c4ee78', 0.5], ['#5fb440', 0.42]]) {
      g.strokeStyle = ink
      g.globalAlpha = a
      g.beginPath()
      for (let i = 0; i < 1500; i++) {
        const x = rx(), z = rz()
        g.moveTo(x, z)
        g.lineTo(x + (rnd() - 0.5) * 0.2, z - 0.2 - rnd() * 0.25)
      }
      g.stroke()
    }
    g.globalAlpha = 1
    const blob = (x, z, w, d, fill, r = 0.9) => { g.fillStyle = fill; g.beginPath(); g.roundRect(x - w / 2, z - d / 2, w, d, r); g.fill() }
    const SAND = '#f3dda4', EDGE = '#d6ba7f', STONES = ['#e6cc92', '#fbecc0', '#d9bb80', '#f6e2b0']
    // Each plot: a soft darker footprint, the building's own occlusion.
    for (const [x, z, w, d] of Object.values(SITES)) {
      blob(x, z, w + 1.2, d + 1.2, 'rgba(70,130,40,0.22)', 1.6)
      blob(x, z, w + 0.4, d + 0.4, 'rgba(60,120,40,0.28)', 1.1)
    }
    // The road.
    g.lineJoin = 'round'
    for (const [w, ink] of [[4.0, 'rgba(110,170,60,0.5)'], [3.1, EDGE], [2.5, SAND]]) {
      g.strokeStyle = ink
      g.lineWidth = w
      g.beginPath()
      for (let x = X0 - 2; x <= X1 + 2; x += 0.8) g.lineTo(x, pathZ(x))
      g.stroke()
    }
    for (let i = 0; i < (mobile ? 500 : 1100); i++) {
      const x = X0 + rnd() * (X1 - X0), z = pathZ(x) + (rnd() - 0.5) * 2.2
      g.fillStyle = pick(STONES)
      g.globalAlpha = 0.75
      g.beginPath()
      g.ellipse(x, z, 0.12 + rnd() * 0.16, 0.09 + rnd() * 0.1, rnd() * 3, 0, 7)
      g.fill()
    }
    g.globalAlpha = 1
    // Flowers in drifts, outside the walls.
    for (let k = 0; k < (mobile ? 50 : 110); k++) {
      const x = rx(), z = rz(), ink = pick(['#ffffff', '#ffe25a', '#ff8fb4', '#c9a2ff', '#ffb25a'])
      if (Math.abs(z - pathZ(x)) < 2.4 || (x > BX0 - 1 && x < BX1 + 1 && z > BZ0 - 1 && z < BZ1 + 1)) continue
      g.fillStyle = ink
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(x + (rnd() - 0.5) * 2.2, z + (rnd() - 0.5) * 1.6, 0.07 + rnd() * 0.04, 0, 7); g.fill() }
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.NoColorSpace // SCREEN: the painting's own values are what is shown
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    return tex
  }

  // ------------------------------------------------------------ the build, a piece at a time
  // Each job is a few milliseconds; they run between frames, so building the village (while the reader
  // is paused in the level before) never holds a frame long. Each adds to the scene; prepare() compiles
  // and draws it again as it grows.
  const dummy = new THREE.Object3D()
  const instanced = (geo, n, { shadow = false } = {}) => {
    const m = new THREE.InstancedMesh(geo, MAT, n)
    m.castShadow = shadow
    m.receiveShadow = true
    m.frustumCulled = false
    return m
  }
  const setAt = (m, i, x, y, z, sx, sy = sx, sz = sx, ry = 0, color = null, lift = 1) => {
    dummy.position.set(x, y, z)
    dummy.scale.set(sx, sy, sz)
    dummy.rotation.set(0, ry, 0)
    dummy.updateMatrix()
    m.setMatrixAt(i, dummy.matrix)
    if (color) m.setColorAt(i, tmpC.set(color).convertLinearToSRGB().multiplyScalar(lift))
  }
  // Where nothing tall may stand: the road, the base, and the whole near side, which the camera (and,
  // further back, a phone's) flies over.
  const inBase = (x, z, m = 0) => x > BX0 - 1.5 - m && x < BX1 + 1.5 + m && z > BZ0 - 1.5 - m && z < BZ1 + 1.5 + m
  const clearOf = (x, z) => Math.abs(z - pathZ(x)) > 3.4 && !inBase(x, z, 1) && !(z > 4.5 && x > -26 && x < 74) && !(x > -14 && x <= 1 && z > -9)
  let dust = null
  const walkers = [] // villagers out in the open, who arrive with a building
  let troops = null, drake = null, barracksRec = null
  const jobs = [
    () => {
      // The plateau's top, cut to its wobbling outline, wearing the painting.
      const shape = new THREE.Shape()
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2, co = Math.cos(a), si = Math.sin(a), k = 1 + 0.03 * Math.sin(a * 7) + 0.02 * Math.sin(a * 13 + 1)
        shape[i ? 'lineTo' : 'moveTo'](CX + RA * Math.sign(co) * Math.sqrt(Math.abs(co)) * k, -(CZ + RB * Math.sign(si) * Math.sqrt(Math.abs(si)) * k))
      }
      const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2)
      const p = geo.attributes.position, uv = geo.attributes.uv
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - TX0) / TW, 1 - (p.getZ(i) - TZ0) / (TW / 2))
      geo.setAttribute('aWave', new THREE.BufferAttribute(new Float32Array(p.count * 3), 3))
      const ground = new THREE.Mesh(geo, sunlit(new THREE.MeshStandardMaterial({ map: paintGround(), roughness: 1 }), U))
      ground.receiveShadow = true
      ground.frustumCulled = false
      scene.add(ground)
    },
    build.walls,
    () => { build.gate(BX0, -1); build.gate(BX1, 50) },
    () => {
      // Torches along the road, rocks outside, a builder's stakes at the corners of every plot to be raised.
      const b = make()
      for (const x of [9, 22, 33, 44, 53]) {
        const z = pathZ(x) - 2.0
        b.rbox(0.22, 1.9, 0.22, x, 0, z, C.woodDark, { r: 0.05 }).rbox(0.4, 0.16, 0.4, x, 1.75, z, C.iron, { r: 0.04, ao: 0 })
        b.cone(0.16, 0.42, x, 1.92, z, '#ff9a2a', { seg: 6, glow: 2.6, ao: 0 }).cone(0.09, 0.28, x, 1.94, z, '#ffe05a', { seg: 5, glow: 3, ao: 0 })
      }
      for (let i = 0; i < 26; i++) {
        const x = X0 + 6 + rnd() * (X1 - X0 - 12), z = Z0 + 4 + rnd() * (Z1 - Z0 - 8)
        if (Math.abs(z - pathZ(x)) < 2.6 || inBase(x, z, 0.5) || !inside(x, z, 0.95)) continue
        const r = 0.3 + rnd() * 0.5
        b.ball(r, x, r * 0.3, z, pick([C.stone, C.stoneDark, C.stoneWarm]), { detail: 0, flat: true, sy: 0.7, ao: 0.3, ry: rnd() * 3 })
      }
      for (const [x, z, w, d] of Object.values(SITES)) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        b.cyl(0.05, 0.05, 0.7, x + sx * (w / 2 - 0.9), 0, z + sz * (d / 2 - 0.9), C.plank, { seg: 5, ao: 0 }).ball(0.09, x + sx * (w / 2 - 0.9), 0.72, z + sz * (d / 2 - 0.9), C.red, { detail: 0, ao: 0 })
      }
      // A few flower beds and topiary inside the walls, off the plots.
      for (const [x, z] of [[5.6, -19.5], [31.4, -20.6], [42.6, -21], [56.6, -4.4], [21.8, 4.6], [38.6, 4.8], [52.4, 4.8], [5.4, 4.4]]) {
        b.rbox(1.6, 0.3, 1.0, x, 0, z, C.woodDark, { r: 0.08 }).ball(0.42, x - 0.4, 0.3, z, '#4ab24c', { ao: 0.25 }).ball(0.42, x + 0.4, 0.3, z, '#58bd46', { ao: 0.25 })
        for (let i = 0; i < 5; i++) b.ball(0.1, x - 0.6 + i * 0.3, 0.62, z + 0.25 * ((i % 2) * 2 - 1) * 0.6, pick(['#ff8fb4', '#ffe25a', '#ffffff', '#c9a2ff']), { detail: 0, ao: 0 })
      }
      scene.add(b.mesh())
    },
    () => {
      // Round trees and bushes outside the walls: one canopy, one trunk, instanced.
      const cb = make()
      cb.ball(1, 0, 0, 0, '#ffffff', { detail: 2, ao: 0.42 }).ball(0.7, 0.62, -0.2, 0.3, '#ffffff', { ao: 0.42 }).ball(0.62, -0.58, -0.12, -0.34, '#ffffff', { ao: 0.42 }).ball(0.55, 0.12, 0.56, -0.2, '#f4ffe6', { ao: 0.3 })
      const canopyGeo = cb.mesh().geometry
      const N = mobile ? 46 : 88, BUSH = mobile ? 26 : 50
      const canopy = instanced(canopyGeo, N + BUSH, { shadow: true })
      const trunk = instanced(paint(new THREE.CylinderGeometry(0.6, 1, 1, 7, 1, true).translate(0, 0.5, 0), '#8f5d38', { ao: 0.3 }), N, { shadow: true })
      for (let i = 0; i < N; i++) {
        let x, z, tries = 0
        do {
          x = X0 + 3 + rnd() * (X1 - X0 - 6)
          z = Z0 + 2 + rnd() * (Z1 - Z0 - 4)
        } while ((!inside(x, z, 0.95) || !clearOf(x, z)) && ++tries < 40)
        const r = 1.5 + rnd() * 0.9, th = 1.1 + rnd() * 0.8
        const leaf = rnd() < 0.08 ? '#ffb7cd' : rnd() < 0.07 ? '#ffd257' : pick(C.leaf)
        setAt(canopy, i, x, th + r * 0.72, z, r, r * 0.92, r, rnd() * 6.3, leaf)
        setAt(trunk, i, x, 0, z, 0.26 + r * 0.06, th + r * 0.3, 0.26 + r * 0.06)
      }
      for (let i = 0; i < BUSH; i++) {
        let x, z, tries = 0
        do {
          x = X0 + 3 + rnd() * (X1 - X0 - 6)
          z = Z0 + 2 + rnd() * (Z1 - Z0 - 4)
        } while ((!inside(x, z, 0.96) || Math.abs(z - pathZ(x)) < 3 || inBase(x, z, 0.5)) && ++tries < 40)
        const r = 0.45 + rnd() * 0.45
        setAt(canopy, N + i, x, r * 0.55, z, r, r * 0.8, r, rnd() * 6.3, pick(C.leaf))
      }
      scene.add(canopy, trunk)
    },
    () => {
      // Flowers and tufts, small and many; the cloud sea round the plateau; cumulus far off.
      const F = mobile ? 120 : 260, T = mobile ? 150 : 340
      const flowers = instanced(paint(new THREE.IcosahedronGeometry(0.1, 0).scale(1, 0.7, 1), '#ffffff', { ao: 0 }), F)
      for (let i = 0, cx = 0, cz = 0, ink = ''; i < F; i++) {
        if (i % 10 === 0) {
          let tries = 0
          do { cx = X0 + 4 + rnd() * (X1 - X0 - 8); cz = Z0 + 3 + rnd() * (Z1 - Z0 - 6) } while ((!inside(cx, cz, 0.93) || Math.abs(cz - pathZ(cx)) < 2.2 || inBase(cx, cz)) && ++tries < 30)
          ink = pick(['#ffffff', '#ffe25a', '#ff8fb4', '#c9a2ff', '#ffb25a'])
        }
        setAt(flowers, i, cx + (rnd() - 0.5) * 2.4, 0.12 + rnd() * 0.08, cz + (rnd() - 0.5) * 1.8, 0.7 + rnd() * 0.7, undefined, undefined, 0, ink)
      }
      const tb = make()
      tb.cone(0.07, 0.36, 0, 0, 0, '#ffffff', { seg: 4, ao: 0.5 }).cone(0.06, 0.28, 0.09, 0, 0.03, '#ffffff', { seg: 4, rz: -0.4, ao: 0.5 }).cone(0.06, 0.3, -0.08, 0, -0.04, '#ffffff', { seg: 4, rz: 0.4, ao: 0.5 })
      const tufts = instanced(tb.mesh().geometry, T)
      for (let i = 0; i < T; i++) {
        let x, z, tries = 0
        do { x = X0 + 3 + rnd() * (X1 - X0 - 6); z = Z0 + 2 + rnd() * (Z1 - Z0 - 4) } while ((!inside(x, z, 0.96) || Math.abs(z - pathZ(x)) < 1.7 || inBase(x, z)) && ++tries < 30)
        setAt(tufts, i, x, 0, z, 0.8 + rnd() * 0.9, undefined, undefined, rnd() * 6.3, pick(['#6cc24a', '#a6e060', '#58b043', '#8ed455']))
      }
      const pb = make()
      pb.ball(1, 0, 0, 0, '#ffffff', { detail: 2, ao: 0.16 }).ball(0.72, 0.8, -0.1, 0.2, '#ffffff', { detail: 2, ao: 0.16 }).ball(0.64, -0.78, -0.14, -0.1, '#ffffff', { detail: 2, ao: 0.16 }).ball(0.6, 0.2, 0.3, -0.5, '#ffffff', { detail: 1, ao: 0.1 })
      const RING = mobile ? 40 : 70, FAR = 16
      const puffs = instanced(pb.mesh().geometry, RING + FAR)
      for (let i = 0; i < RING; i++) {
        const a = (i / RING) * Math.PI * 2 + rnd() * 0.05, co = Math.cos(a), si = Math.sin(a), out = 1.04 + rnd() * 0.16, r = 5 + rnd() * 5
        setAt(puffs, i, CX + RA * Math.sign(co) * Math.sqrt(Math.abs(co)) * out, -2.6 - rnd() * 3.5, CZ + RB * Math.sign(si) * Math.sqrt(Math.abs(si)) * out, r, r * 0.5, r * 0.8, rnd() * 6.3, '#ffffff', 1.25)
      }
      for (let i = 0; i < FAR; i++) {
        const r = 12 + rnd() * 12
        setAt(puffs, RING + i, -40 + i * 13 + rnd() * 6, 4 + rnd() * 20, -62 - rnd() * 60, r, r * 0.42, r * 0.7, rnd() * 0.6, '#ffffff', 1.8) // seen from below: lit like cloud, not like stone
      }
      scene.add(flowers, tufts, puffs)
    },
    build.hut, () => build.goldMine('goldA'), build.well, () => build.cannon('cannonA', 0), build.store, () => build.archer('archerA', 0),
    () => { barracksRec = build.barracks() },
    () => build.goldMine('goldB'), () => build.cannon('cannonB', 1),
    build.hall, build.tank, build.sky, () => build.cannon('cannonC', 2), () => build.archer('archerB', 1),
    () => {
      // Out in the open: a miner at the first mine's rock face, a carrier between it and the gold store.
      const miner = villager({ tunic: '#d0713a', hat: 'cap', hatColor: C.gold, tool: pickaxe })
      const goldA = pops.find(r => r.x === SITES.goldA[0]), store = pops.find(r => r.x === SITES.store[0])
      miner.g.position.set(-1.5, 0, 1.55)
      miner.g.rotation.y = Math.PI * 0.8
      goldA.obj.add(miner.g)
      const carrier = villager({ tunic: '#6fb4e8', hat: 'straw', both: a => a.ball(0.32, 0, -0.62, 0.12, '#e6c76a', { sy: 0.8, ao: 0.2 }) })
      carrier.l.position.x = -0.2
      carrier.r.position.x = 0.2
      carrier.l.rotation.x = carrier.r.rotation.x = -1.25
      scene.add(carrier.g)
      walkers.push({ v: carrier, ref: store })
      alive.push(t => {
        const dig = Math.max(0, Math.sin(t * 3.2))
        miner.r.rotation.x = -0.2 - 2.0 * (1 - dig)
        miner.body.rotation.x = 0.12 * dig
        const u = (t * 0.1) % 2, back = u > 1, k = back ? 2 - u : u, x = SITES.goldA[0] + 1 + k * (SITES.store[0] - SITES.goldA[0] - 1)
        carrier.g.position.set(x, Math.abs(Math.sin(t * 8)) * 0.05, pathZ(x) - 2.6 - Math.sin(k * Math.PI) * 0.4)
        carrier.g.rotation.set(0, back ? -Math.PI / 2 : Math.PI / 2, Math.sin(t * 8) * 0.07)
      })
    },
    () => {
      // The troops who march behind him once the barracks is up, and the dragon over them.
      troops = [knight(), brawler(), archer(), wizard(), giant()].map((v, i) => ({ v, gap: 2.6 + i * 1.75 + (i === 4 ? 0.6 : 0), s: v.g.scale.x, ph: i * 1.3 }))
      for (const tr of troops) { tr.v.g.scale.setScalar(1e-3); scene.add(tr.v.g) }
      drake = dragon()
      drake.s = drake.g.scale.x
      drake.g.scale.setScalar(1e-3)
      scene.add(drake.g)
    },
    () => {
      // Dust round a building's foot as it lands (small, flat, low and quick): opaque toy puffs.
      dust = instanced(paint(new THREE.IcosahedronGeometry(1, 1), '#ffffff', { ao: 0.2 }), pops.length * PUFFS)
      for (let i = 0; i < pops.length * PUFFS; i++) setAt(dust, i, 0, -5, 0, 1e-3, undefined, undefined, 0, '#fff6e6')
      scene.add(dust)
    },
  ]
  let built = false // world.js compiles the village once it is whole
  ;(async () => {
    let t0 = performance.now()
    const tick = async () => {
      if (performance.now() - t0 > 4) {
        await new Promise(r => setTimeout(r))
        t0 = performance.now()
      }
    }
    for (const job of jobs) {
      const steps = job() // a generator job (the walls, the town hall) yields between its own pieces
      if (steps?.next) while (!steps.next().done) await tick()
      await tick()
    }
    ROUNDED.clear() // only the build needs them
    built = true
  })()

  // ------------------------------------------------------------ light
  const toSun = new THREE.Vector3(-0.5, 0.78, 0.45).normalize()
  const sun = new THREE.DirectionalLight('#fff0d0', 2.5)
  sun.castShadow = true
  const MAP = mobile ? 1024 : 2048, HALF = mobile ? 26 : 36
  sun.shadow.mapSize.setScalar(MAP)
  sun.shadow.radius = 5 // soft, toy-like
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.05
  Object.assign(sun.shadow.camera, { left: -HALF, right: HALF, top: HALF, bottom: -HALF, near: 1, far: 160 })
  scene.add(sun, sun.target, new THREE.HemisphereLight('#f2f7ff', '#d2e8a8', 1.6))
  // The shadow follows him a whole texel at a time, so shadow edges do not crawl as the frame moves.
  const sRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toSun).normalize(), sUp = new THREE.Vector3().crossVectors(toSun, sRight)
  const TEXEL = (HALF * 2) / MAP, centre = new THREE.Vector3()

  // ------------------------------------------------------------ the traveller, as the builder
  let you = null
  loadTraveller(loader).then(t => {
    you = t.make({ look: 'pbr' }) // shaded like the village round him
    // SCREEN: his aloha shirt, as on the coast, read as painted like everything else here.
    you.root.traverse(o => { if (o.isSkinnedMesh) o.material.map = alohaLinear() })
    makeGear(you, make)
    scene.add(you.root)
  })

  // He is small from up here: a pale ring on the ground marks him, as a strategy game marks the unit you hold.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.85, depthWrite: false }))
  ring.frustumCulled = false
  scene.add(ring)

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 700)
  const look = new THREE.Vector3(), cam = new THREE.Vector3(), a3 = new THREE.Vector3(), b3 = new THREE.Vector3()
  // The three-quarter camera, as [his x +, height, z] and what it looks at; a lower one that takes in
  // the town hall against the sky; and a high one for the base whole, at the end.
  const RIG = {
    // Close enough that the builder reads, looking a little ahead of him at the next plot to go up.
    wide: { follow: [[-7, 8.5, 10.5], [3, 1, -3]], hero: [[-12, 6.4, 18], [2.5, 5.2, -5]], crane: [[-21, 19, 22], [-7, 2.2, -6.5]] },
    // A phone sees a narrow slice: back a little further, up the road. Its town hall shot is not a fixed
    // offset: the camera stands on the line from the hall through him, so the hall rises over him (heroAt).
    tall: { follow: [[-8, 12, 13.8], [1.5, 1, -4.5]], hero: [[0, 0, 0], [0, 0, 0]], crane: [[-40, 30, 22], [-5, 2, -8]] },
  }
  const HALL_X = SITES.hall[0], HALL_Z = SITES.hall[1]
  /** The phone's town hall shot, as offsets like the rig's: back from the hall through him, looking past him at it. */
  const heroAt = (x, z) => {
    const dx = x - HALL_X, dz = z - HALL_Z, k = 1 / Math.hypot(dx, dz)
    const [c, l] = RIG.tall.hero // world points less what update() adds back (his x, 0.4 of his z)
    c[0] = dx * k * 31, c[1] = 15, c[2] = z * 0.6 + dz * k * 31
    l[0] = -dx * 0.62, l[1] = 4.6, l[2] = z * 0.6 - dz * 0.62
  }
  let lastT = null, lastX = null, movedAt = -1, cue = '', struck = -9, march = 0
  const SWING = 'Right_Hand_Sword_Slash' // with the hammer in his fist, the blow that raises a building

  function update(state, t, aspect) {
    const p = state.p
    const x = p * LENGTH, z = pathZ(x)
    const dt = lastT === null ? 0 : Math.min(0.1, t - lastT)
    lastT = t
    U.uT.value = t
    // He walks while the scroll moves him and stands when it rests.
    const jumped = lastX === null || Math.abs(x - lastX) > 10
    if (lastX !== null && Math.abs(x - lastX) > 1e-4) movedAt = t
    lastX = x
    const walking = t - movedAt < 0.25, cheer = p > 0.82 && p < 0.99
    if (you) {
      const next = t - struck < you.duration(SWING) * 0.8 ? SWING : walking ? 'Walk' : cheer ? 'Cheer_with_Both_Hands_Up' : 'Idle'
      if (next !== cue) you.play((cue = next), { fade: next === SWING ? 0.12 : 0.3 })
      you.root.position.set(x, 0.02, z)
      you.root.rotation.y = pathYaw(x)
      you.mixer.update(dt)
    }
    ring.position.set(x, 0.05, z)
    ring.scale.setScalar(1 + 0.06 * Math.sin(t * 3)) // grown with the crane below, so it still marks him from up there

    // The village: each plot is up once he has reached it and down before; a spring carries it there.
    const snap = state.still || jumped || (state.cover ?? 0) > 0.97
    for (let i = 0; i < pops.length; i++) {
      const b = pops[i], want = x >= b.at ? 1 : 0
      if (want !== b.want) {
        b.want = want
        b.since = snap ? -9 : t
        if (want && !snap && t - struck > 1.2) struck = t
      }
      if (snap) {
        b.k = want
        b.v = 0
      } else if (b.k !== want || b.v !== 0) {
        for (let n = Math.max(1, Math.ceil(dt / 0.012)), h = dt / n, j = 0; j < n; j++) {
          b.v += ((want - b.k) * 190 - b.v * 13) * h
          b.k += b.v * h
        }
        if (Math.abs(want - b.k) < 2e-3 && Math.abs(b.v) < 0.02) {
          b.k = want
          b.v = 0
        }
      }
      if (b.k !== b.shown) {
        b.shown = b.k
        const k = Math.max(1e-3, b.k), wide = k < 1 ? 1 - (1 - k) ** 2 : 1 - 0.45 * (k - 1) // it lands tall and thin, then settles
        b.obj.scale.set(Math.max(1e-3, wide), k, Math.max(1e-3, wide))
      }
      if (dust) {
        const age = (t - b.since) / 0.45, on = want === 1 && age < 1
        if (on || b.dusty) {
          for (let j = 0; j < PUFFS; j++) {
            const a = (j * TAU) / PUFFS + i, r = b.r * (0.8 + age * 0.7), s = on ? Math.max(1e-3, Math.sin(Math.PI * age) * (0.25 + 0.25 * ((j * 7 + i) % 3) / 2)) : 1e-3
            dummy.position.set(b.x + Math.cos(a) * r, 0.12 + age * 0.3, b.z + Math.sin(a) * r)
            dummy.scale.set(s, s * 0.6, s)
            dummy.rotation.set(0, 0, 0)
            dummy.updateMatrix()
            dust.setMatrixAt(i * PUFFS + j, dummy.matrix)
          }
          dust.instanceMatrix.needsUpdate = true
          b.dusty = on
        }
      }
    }
    for (let i = 0; i < alive.length; i++) alive[i](t)
    for (let i = 0; i < walkers.length; i++) walkers[i].v.g.scale.setScalar(Math.max(1e-3, walkers[i].ref.k) * 1.12)

    // The parade: in file behind him on the road, marching while he walks, cheering with him at the end.
    if (troops && barracksRec) {
      const up = Math.min(1, Math.max(0, barracksRec.k))
      march += ((walking ? 1 : 0) - march) * Math.min(1, dt * 6)
      for (let i = 0; i < troops.length; i++) {
        const tr = troops[i], v = tr.v, tx = x - tr.gap, ph = t * 7.5 + tr.ph
        v.g.scale.setScalar(Math.max(1e-3, up * tr.s))
        v.g.position.set(tx, march * Math.abs(Math.sin(ph)) * 0.07, pathZ(tx) + (i % 2 ? 0.45 : -0.35))
        v.g.rotation.set(0, pathYaw(tx), march * Math.sin(ph) * 0.06)
        const swing = march * Math.sin(ph) * 0.6, idle = Math.sin(t * 1.6 + tr.ph) * 0.05
        if (cheer && !walking) {
          v.l.rotation.set(0, 0, -2.6 - Math.sin(t * 6 + tr.ph) * 0.25)
          v.r.rotation.set(0, 0, 2.6 + Math.sin(t * 6 + tr.ph + 1) * 0.25)
        } else {
          v.l.rotation.set(swing + idle, 0, 0)
          v.r.rotation.set(-swing - idle - (i === 0 ? 0.5 : 0), 0, 0) // the knight carries his blade forward
        }
      }
      const d = drake, a = state.still ? 0.6 : t * 0.5, R = 6.5
      d.g.scale.setScalar(Math.max(1e-3, up * d.s))
      d.g.position.set(x - 1 + Math.cos(a) * R, 8.6 + Math.sin(t * 1.3) * 0.4, z - 6 + Math.sin(a) * R * 0.6)
      d.g.rotation.set(0, Math.atan2(-Math.sin(a), 0.6 * Math.cos(a)), state.still ? 0 : -0.3)
      const flap = Math.sin(t * (state.still ? 3 : 7.5)) * 0.65
      d.wings[0].rotation.z = -flap
      d.wings[1].rotation.z = flap
    }
    // The camera: down out of the clouds onto the three-quarter view; lower for the town hall; up and back at the end.
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    const portrait = state.portrait ?? aspect < 0.85
    const rig = RIG[portrait ? 'tall' : 'wide']
    if (portrait) heroAt(x, z)
    // (a phone turns to the hall as its first lift lands, at p 0.46)
    const hero = state.still ? 0 : ss(portrait ? 0.43 : 0.5, portrait ? 0.53 : 0.64, p) * (1 - ss(0.76, 0.84, p)), crane = state.still ? 0 : ss(0.76, 0.9, p)
    cam.fromArray(rig.follow[0]).lerp(a3.fromArray(rig.hero[0]), hero).lerp(a3.fromArray(rig.crane[0]), crane)
    look.fromArray(rig.follow[1]).lerp(b3.fromArray(rig.hero[1]), hero).lerp(b3.fromArray(rig.crane[1]), crane)
    const high = state.still ? 0 : (1 - ss(0, 0.115, p)) ** 1.6
    cam.x += x + high * 5
    cam.y += high * 44
    cam.z += z * 0.4 + high * 7
    look.x += x + high * 9
    look.z += z * 0.4 - high * 5
    // Keep him in the middle third as the camera lifts away for the base whole (a phone's narrow frame
    // also in the town hall shot): aim between the set piece and him, at least half toward him.
    const toHim = portrait ? crane * 0.55 : crane * 0.5
    look.lerp(a3.set(x, 1, z), toHim)
    ring.scale.multiplyScalar(1 + 1.1 * crane)
    camera.position.copy(cam)
    camera.lookAt(look)

    centre.set(x + 6, 0, -5)
    const sx = centre.dot(sRight), sy = centre.dot(sUp)
    centre.addScaledVector(sRight, Math.round(sx / TEXEL) * TEXEL - sx).addScaledVector(sUp, Math.round(sy / TEXEL) * TEXEL - sy)
    sun.target.position.copy(centre)
    sun.position.copy(centre).addScaledVector(toSun, 70)
    return { here: you ? you.root.position : look.set(x, 0.9, z), dream: 0 }
  }

  return { scene, camera, update, get built() { return built } }
}

/**
 * The builder's kit: a yellow hard hat, a hammer in his right fist, a leather bib over his shirt, a tool
 * belt with a pouch. Each piece is placed around him in his rest pose (metres; y up, his front +z, arms
 * out along x) and then parented to the bone it rides on, as the block world's gear is.
 */
function makeGear(you, make) {
  const LEATHER = '#b5733a', DARK = '#7a4a26', HAT = '#ffbf1a'
  const parts = [
    // The hat: a dome with a ridge, a brim, a short peak over his brow (the head: top ~1.73, front z ~0.16).
    ['Head', b => b.geo(new THREE.SphereGeometry(0.168, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.86, 1.08), HAT, 0, 1.655, -0.005, { ao: 0.12 })
      .cyl(0.205, 0.205, 0.025, 0, 1.645, -0.005, HAT, { seg: 18, ao: 0 }).box(0.2, 0.024, 0.09, 0, 1.646, 0.2, HAT, { ao: 0 })
      .box(0.045, 0.04, 0.34, 0, 1.79, -0.005, '#f0a800', { ao: 0 })],
    // The fist is at about x -0.7, y 1.26; the handle runs front to back, the head across the top.
    ['RightHand', b => b.box(0.04, 0.04, 0.5, -0.7, 1.24, 0.14, '#c98a4a', { ao: 0 }).box(0.08, 0.1, 0.2, -0.7, 1.19, 0.38, '#8f98a8', { ao: 0.1, rx: Math.PI / 2 }).box(0.085, 0.06, 0.1, -0.7, 1.21, 0.46, '#5b6372', { ao: 0 })],
    // The bib (torso: x ±0.2, y 0.98..1.36, z ±0.125).
    ['Spine01', b => b.box(0.3, 0.3, 0.03, 0, 1.03, 0.15, LEATHER, { ao: 0.15 }).box(0.12, 0.1, 0.035, 0, 1.12, 0.155, DARK, { ao: 0 }).box(0.04, 0.12, 0.03, -0.12, 1.32, 0.145, DARK, { ao: 0 }).box(0.04, 0.12, 0.03, 0.12, 1.32, 0.145, DARK, { ao: 0 })],
    // The belt, a pouch with a chisel in it.
    ['Hips', b => b.box(0.37, 0.055, 0.26, 0, 0.96, 0, DARK, { ao: 0 }).box(0.1, 0.13, 0.08, 0.17, 0.84, 0.09, DARK, { ao: 0 }).box(0.025, 0.12, 0.025, 0.17, 0.95, 0.09, '#c98a4a', { ao: 0 }).box(0.1, 0.13, 0.08, -0.17, 0.84, 0.09, DARK, { ao: 0 }).box(0.06, 0.05, 0.04, 0, 0.955, 0.16, '#ffc93a', { ao: 0 })],
  ].map(([bone, fill]) => {
    const b = make()
    fill(b)
    const m = b.mesh()
    you.root.add(m)
    return [bone, m]
  })
  you.root.updateMatrixWorld(true)
  for (const [bone, m] of parts) you.bone(bone).attach(m)
}
