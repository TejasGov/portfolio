import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loadTraveller, alohaLinear, sky } from './films/kit'

/*
 * Chapter Four, level 3: the village. A sunlit grass plateau above the clouds, seen from a raised
 * three-quarter strategy-game camera that follows the traveller along a path. He is the builder: each
 * plot springs up with a bounce as he reaches it (storehouse, sawmill, forge, market, cottages, walls,
 * and last the keep), and comes down again if you scroll back. Everything is built here from painted
 * primitives merged per building: no models, one shared material, one painted ground.
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
const TAU = Math.PI * 2, PUFFS = 10 // dust puffs round each building as it lands
// The plateau: a rounded rectangle (a superellipse) with a wobbling edge, clouds all round it.
const X0 = -24, X1 = 88, Z0 = -28, Z1 = 20
const CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2, RA = (X1 - X0) / 2, RB = (Z1 - Z0) / 2
const inside = (x, z, k = 1) => ((x - CX) / (RA * k)) ** 4 + ((z - CZ) / (RB * k)) ** 4 < 1
// The painted ground covers this rectangle (2:1).
const TX0 = X0 - 2, TW = X1 - X0 + 4, TZ0 = CZ - TW / 4

const C = {
  plaster: '#fff1d2', timber: '#8d5632', timberDark: '#6a3d23', plank: '#dba05c', plankDark: '#b97c42', wood: '#b8763c',
  stone: '#d3d8e0', stoneDark: '#a9b2c0', stoneWarm: '#e4d9c6', red: '#ea5b3f', orange: '#f28b3c', teal: '#31ab9f', blue: '#4169cc',
  gold: '#ffc93a', cloth: '#ffd044', white: '#fff9ec', straw: '#edc963', glass: '#8bdcf5', glassDark: '#3f5f96', iron: '#5b6372',
  leather: '#b06a35', skin: ['#f6cfa8', '#e0a878', '#c98d5e', '#f2c097'], hair: ['#5a3a24', '#2e2420', '#b5763a', '#d9c7a0'],
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
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.72, 0.9), cl * 0.85);`)
  }
  return mat
}

export function createVillage(renderer, { loader, mobile = false }) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#eaf5ff', 55, 230)
  scene.add(sky({ top: '#2f86e6', mid: '#93cdfb', low: '#eef8ff', sunDir: new THREE.Vector3(-0.45, 0.5, 0.6), sun: '#fff3d0' }))
  const U = { uT: { value: 0 } }
  const MAT = sunlit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }), U)
  const make = () => builder(MAT)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const pick = a => a[Math.floor(rnd() * a.length)]
  const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k)

  // ------------------------------------------------------------ shared pieces of architecture
  /** Dressed stone: a block with a few stones standing proud of the two faces the camera sees (+z, -x). */
  const stoneBlock = (b, w, h, d, x, y, z, n = 8, base = C.stone) => {
    b.box(w, h, d, x, y, z, base)
    for (let i = 0; i < n; i++) {
      const sw = 0.4 + rnd() * 0.5, sh = 0.26 + rnd() * 0.2, c = rnd() < 0.5 ? C.stoneDark : C.stoneWarm, u = rnd() - 0.5, v = rnd()
      if (i % 3) b.box(sw, sh, 0.08, x + u * (w - sw), y + v * (h - sh), z + d / 2, c, { ao: 0 })
      else b.box(0.08, sh, sw, x - w / 2, y + v * (h - sh), z + u * (d - sw), c, { ao: 0 })
    }
  }
  /** A battlement along x: merlons on a wall top. */
  const merlons = (b, len, x, y, z, d = 1.1) => {
    const n = Math.max(2, Math.round(len / 1.3))
    for (let i = 0; i < n; i++) b.box(0.62, 0.55, d, x - len / 2 + (i + 0.5) * (len / n), y, z, i % 2 ? C.stone : C.stoneWarm, { ao: 0.1 })
  }
  /** A pitched roof, ridge along z, on a gable wall: two slabs with a tile course or two, and a ridge cap. */
  const gable = (b, span, len, rise, y, color, { ov = 0.5, wall = C.plaster, t = 0.22, cap = null } = {}) => {
    b.geo(prism(span, rise, len), wall, 0, y, 0, { ao: 0.1 })
    const run = span / 2 + ov, drop = (rise * ov) / (span / 2), s = Math.hypot(run, rise + drop), pitch = Math.atan2(rise, span / 2), dark = shade(color, 0.78)
    for (const sx of [-1, 1]) {
      b.box(s, t, len + 0.8, (sx * run) / 2, y + (rise - drop) / 2, 0, color, { rz: -sx * pitch, ao: 0.1 })
      for (const f of [0.36, 0.7]) b.box(0.09, t + 0.05, len + 0.82, sx * run * f, y + rise - (rise + drop) * f, 0, dark, { rz: -sx * pitch, ao: 0 })
      b.box(0.14, t + 0.08, len + 0.86, sx * run * 0.985, y - drop + 0.03, 0, C.white, { rz: -sx * pitch, ao: 0 }) // a pale eave board
    }
    b.box(0.36, 0.26, len + 0.9, 0, y + rise - 0.03, 0, cap ?? dark, { ao: 0 })
  }
  const door = (b, x, y, z, w = 0.95, h = 1.65) => {
    b.box(w, h, 0.14, x, y, z, C.timberDark, { ao: 0.35 }).box(w + 0.3, 0.16, 0.2, x, y + h, z, C.plank, { ao: 0 })
    for (const sx of [-1, 1]) b.box(0.14, h, 0.2, x + sx * (w / 2 + 0.07), y, z, C.plank, { ao: 0 })
    b.ball(0.06, x + w * 0.3, y + h * 0.5, z + 0.1, C.gold, { ao: 0 })
  }
  const windowAt = (b, x, y, z, { w = 0.8, h = 0.8, box = false, glass = C.glass } = {}) => {
    b.box(w, h, 0.1, x, y, z, glass, { ao: 0.25 }).box(w + 0.16, 0.09, 0.14, x, y + h, z, C.timber, { ao: 0 }).box(w + 0.24, 0.1, 0.2, x, y - 0.08, z, C.plank, { ao: 0 })
    b.box(0.07, h, 0.13, x, y, z, C.timber, { ao: 0 }).box(w, 0.07, 0.13, x, y + h / 2 - 0.035, z, C.timber, { ao: 0 })
    for (const sx of [-1, 1]) b.box(0.09, h, 0.14, x + sx * (w / 2 + 0.04), y, z, C.timber, { ao: 0 })
    if (box) {
      b.box(w + 0.2, 0.2, 0.26, x, y - 0.3, z + 0.12, C.wood)
      for (let i = 0; i < 4; i++) b.ball(0.11, x - w / 2 + 0.1 + i * ((w - 0.2) / 3), y - 0.06, z + 0.16, pick(['#ff7fa8', '#ffd84a', '#ffffff', '#ff9a4a']), { detail: 0, ao: 0 })
    }
  }
  /** A half-timbered cottage on a stone footing, gable ends to the sides. */
  const cottage = (b, w, d, roof, { h = 2.4, rise = 1.9, chimney = true } = {}) => {
    stoneBlock(b, w + 0.3, 0.55, d + 0.3, 0, 0, 0, 5)
    b.box(w, h, d, 0, 0.55, 0, C.plaster)
    const top = 0.55 + h, fz = d / 2, lx = -w / 2
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.26, h, 0.26, sx * (w / 2 - 0.06), 0.55, sz * (d / 2 - 0.06), C.timber)
    b.box(w + 0.1, 0.22, 0.12, 0, top - 0.22, fz, C.timber).box(w + 0.1, 0.16, 0.12, 0, 0.55 + h * 0.46, fz, C.timber)
    b.box(0.12, 0.22, d + 0.1, lx, top - 0.22, 0, C.timber).box(0.12, 0.16, d + 0.1, lx, 0.55 + h * 0.46, 0, C.timber)
    b.box(0.13, 1.25, 0.1, w / 2 - 0.3, 0.6, fz + 0.01, C.timber, { rz: 0.62 }).box(0.13, 1.25, 0.1, -w / 2 + 0.3, 0.6, fz + 0.01, C.timber, { rz: -0.62 })
    door(b, -w * 0.18, 0.55, fz + 0.02)
    windowAt(b, w * 0.24, 0.55 + h * 0.52, fz + 0.02, { box: true })
    b.sub(() => windowAt(b, 0, 0.55 + h * 0.52, 0), lx - 0.02, 0, d * 0.1, -Math.PI / 2)
    b.sub(() => gable(b, d + 0.24, w, rise, top, roof), 0, 0, 0, Math.PI / 2)
    b.sub(() => windowAt(b, 0, top + rise * 0.22, 0, { w: 0.55, h: 0.55 }), lx - 0.02, 0, 0, -Math.PI / 2)
    if (chimney) {
      stoneBlock(b, 0.6, rise + 0.5, 0.6, w * 0.28, top + 0.2, -d * 0.2, 2, C.stoneWarm)
      b.box(0.76, 0.16, 0.76, w * 0.28, top + rise + 0.7, -d * 0.2, C.stoneDark, { ao: 0 })
    }
  }
  const barrel = (b, x, y, z, s = 1) => b.cyl(0.3 * s, 0.3 * s, 0.75 * s, x, y, z, C.wood, { seg: 9 }).cyl(0.325 * s, 0.325 * s, 0.07 * s, x, y + 0.14 * s, z, C.iron, { seg: 9, ao: 0 }).cyl(0.325 * s, 0.325 * s, 0.07 * s, x, y + 0.54 * s, z, C.iron, { seg: 9, ao: 0 })
  const crate = (b, x, y, z, s = 0.6, ry = 0.2) => b.box(s, s, s, x, y, z, C.plank, { ry }).box(s + 0.04, 0.07, s + 0.04, x, y + s - 0.07, z, C.plankDark, { ry, ao: 0 }).box(s + 0.04, 0.07, s + 0.04, x, y, z, C.plankDark, { ry, ao: 0 })
  const sack = (b, x, y, z, s = 1) => b.ball(0.3 * s, x, y + 0.24 * s, z, '#f1e2bf', { sy: 0.85, ao: 0.3 }).ball(0.09 * s, x, y + 0.52 * s, z, '#d9c59a', { detail: 0, ao: 0 })
  const logs = (b, x, y, z, len = 2.4, ry = 0) => b.sub(() => {
    for (const [dx, dy] of [[-0.32, 0], [0.32, 0], [0, 0], [-0.16, 0.28], [0.16, 0.28], [0, 0.56]]) {
      b.cyl(0.16, 0.16, len, dx, dy + 0.16, -len / 2, C.wood, { seg: 7, rx: Math.PI / 2, ao: 0 })
      b.cyl(0.12, 0.12, 0.02, dx, dy + 0.16, len / 2, '#f0cf96', { seg: 7, rx: Math.PI / 2, ao: 0 })
    }
  }, x, y, z, ry)
  const lantern = (b, x, y, z) => b.box(0.2, 0.26, 0.2, x, y, z, '#ffd27a', { glow: 2.6, ao: 0 }).box(0.26, 0.06, 0.26, x, y + 0.26, z, C.iron, { ao: 0 }).box(0.26, 0.05, 0.26, x, y - 0.05, z, C.iron, { ao: 0 })

  // ------------------------------------------------------------ the little villagers (peg figures)
  const alive = [] // each: t => move one villager
  const villager = ({ tunic, hat = 'straw', hatColor = C.red, tool = null, both = null, s = 1.12 }) => {
    const skin = pick(C.skin), b = make()
    b.cyl(0.18, 0.32, 0.84, 0, 0, 0, tunic, { ao: 0.32 }).cyl(0.268, 0.285, 0.09, 0, 0.3, 0, C.timberDark, { ao: 0 })
    b.box(0.14, 0.09, 0.2, -0.11, 0, 0.2, C.timberDark, { ao: 0 }).box(0.14, 0.09, 0.2, 0.11, 0, 0.2, C.timberDark, { ao: 0 })
    b.ball(0.215, 0, 1.02, 0, skin, { detail: 2, ao: 0.15 }).ball(0.222, 0, 1.06, -0.045, pick(C.hair), { detail: 2, ao: 0.1 })
    if (hat === 'straw') b.cone(0.44, 0.2, 0, 1.15, 0, C.straw, { seg: 12, ao: 0.25 })
    else if (hat === 'cap') b.cyl(0.19, 0.23, 0.13, 0, 1.17, 0, hatColor).ball(0.05, 0, 1.3, 0, C.white, { detail: 0 })
    else if (hat === 'hood') b.ball(0.25, 0, 1.03, -0.06, tunic, { detail: 2 })
    const g = new THREE.Group(), body = b.mesh()
    g.add(body)
    const arms = [-1, 1].map(sx => {
      const a = make()
      a.cyl(0.075, 0.062, 0.44, 0, -0.44, 0, tunic, { seg: 7, ao: 0.15 }).ball(0.078, 0, -0.47, 0, skin, { detail: 1, ao: 0 })
      if (both) both(a, sx)
      else if (tool && sx === 1) tool(a)
      const m = a.mesh({ shadow: false })
      m.position.set(sx * 0.27, 0.76, 0)
      g.add(m)
      return m
    })
    g.scale.setScalar(s)
    return { g, body, l: arms[0], r: arms[1] }
  }
  // Tools, in the arm's own space: the hand is at (0, -0.47, 0), forward is +z.
  const hammer = a => a.box(0.045, 0.045, 0.42, 0, -0.5, 0.18, C.wood, { ao: 0 }).box(0.13, 0.13, 0.2, 0, -0.54, 0.34, C.iron, { ao: 0 })
  const hoe = a => a.box(0.045, 0.045, 1.1, 0, -0.5, 0.45, C.wood, { ao: 0 }).box(0.22, 0.16, 0.04, 0, -0.62, 0.98, C.iron, { ao: 0 })
  const saw = a => a.box(0.03, 0.14, 0.7, 0, -0.56, 0.4, '#dfe6ee', { ao: 0 }).box(0.06, 0.16, 0.14, 0, -0.56, 0.02, C.wood, { ao: 0 })
  const staff = a => a.cyl(0.03, 0.03, 2.3, 0, -1.25, 0.1, C.wood, { seg: 6, ao: 0 }).pennant(0.7, 0.34, 0.03, 0.85, 0.1, C.cloth, { amp: 0.2 })
  const bucket = a => a.cyl(0.14, 0.11, 0.22, 0, -0.76, 0, C.wood, { seg: 8 }).cyl(0.12, 0.12, 0.02, 0, -0.56, 0, C.glass, { seg: 8, ao: 0 })

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
  const SITES = {
    barn: [10.5, -7.6, 7.4, 6, 3.5], tower: [6.4, -16.4, 4.2, 4.2, 1.5], shed: [18.2, -7.8, 6.2, 5, 10.5], cottageA: [14.4, -15.4, 5.4, 5, 7.5],
    forge: [25.4, -7.6, 6.6, 5.8, 17.5], cottageB: [22.2, -16, 5.2, 5, 14.5], stall0: [29.6, -4.9, 3.6, 2.8, 22.5], stall1: [33.9, -6.4, 3.6, 2.8, 26],
    stall2: [38.2, -4.9, 3.6, 2.8, 29.5], well: [36.6, -3, 2.8, 2.8, 28], cottageC: [30, -14, 5.6, 5, 23.5], granary: [36.4, -13.4, 4.8, 4.8, 28.5],
    keep: [47.4, -11.6, 13, 10, 34], towerS: [55.2, -5.4, 4.2, 4.2, 46.5],
  }
  const site = (name, mesh, o) => pop(mesh, SITES[name][0], SITES[name][1], SITES[name][4], { r: Math.max(SITES[name][2], SITES[name][3]) / 2, ...o })

  const build = {
    barn() {
      const b = make(), w = 6.2, d = 4.6, h = 2.7
      stoneBlock(b, w + 0.3, 0.5, d + 0.3, 0, 0, 0, 6)
      b.box(w, h, d, 0, 0.5, 0, C.plank)
      for (let i = 0; i < 10; i++) b.box(0.07, h, 0.06, -w / 2 + 0.3 + i * 0.62, 0.5, d / 2 + 0.01, C.plankDark, { ao: 0 })
      for (let i = 0; i < 7; i++) b.box(0.06, h, 0.07, -w / 2 - 0.01, 0.5, -d / 2 + 0.35 + i * 0.65, C.plankDark, { ao: 0 })
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.3, h, 0.3, sx * (w / 2 - 0.05), 0.5, sz * (d / 2 - 0.05), C.timber)
      b.box(w + 0.1, 0.24, 0.14, 0, 0.5 + h - 0.24, d / 2, C.timber)
      // The big double door, cross-braced.
      b.box(2.3, 2.1, 0.14, 0, 0.5, d / 2 + 0.03, C.timberDark, { ao: 0.3 }).box(0.08, 2.1, 0.18, 0, 0.5, d / 2 + 0.04, C.plank, { ao: 0 }).box(2.6, 0.18, 0.2, 0, 2.6, d / 2 + 0.04, C.plank, { ao: 0 })
      for (const sx of [-1, 1]) b.box(0.1, 2.3, 0.18, sx * 0.58, 0.55, d / 2 + 0.05, C.plank, { rz: sx * 0.5, ao: 0 }).box(0.12, 2.1, 0.2, sx * 1.2, 0.5, d / 2 + 0.04, C.plank, { ao: 0 })
      b.sub(() => gable(b, d + 0.3, w, 2.3, 0.5 + h, C.red, { wall: C.plank }), 0, 0, 0, Math.PI / 2)
      b.sub(() => windowAt(b, 0, 0.5 + h + 0.45, 0, { w: 0.7, h: 0.7, glass: C.timberDark }), -w / 2 - 0.03, 0, 0, -Math.PI / 2) // the loft hatch
      b.box(0.14, 0.14, 1.1, -w / 2 - 0.5, 0.5 + h + 1.4, 0, C.timber, { ry: Math.PI / 2 }) // and its hoist
      barrel(b, w / 2 - 0.2, 0, d / 2 + 0.7)
      barrel(b, w / 2 + 0.45, 0, d / 2 + 0.45, 0.85)
      crate(b, -w / 2 + 0.3, 0, d / 2 + 0.75, 0.7).box(0.5, 0.5, 0.5, -w / 2 + 0.34, 0.7, d / 2 + 0.72, C.plank, { ry: 0.6 })
      sack(b, -1.9, 0, d / 2 + 0.6)
      sack(b, -1.5, 0, d / 2 + 1.0, 0.9)
      sack(b, -1.72, 0.36, d / 2 + 0.74, 0.85)
      return site('barn', b.mesh())
    },
    tower() {
      // A timber lookout on four leaning legs, with a guard and a pennant.
      const b = make(), top = 4.6
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.3, top + 0.1, 0.3, sx * 1.5, 0, sz * 1.5, C.timber, { rz: sx * 0.08, rx: -sz * 0.08 })
      for (const y of [1.3, 3]) {
        b.box(2.9, 0.16, 0.14, 0, y, 1.42 - y * 0.08, C.plankDark, { ao: 0 }).box(0.14, 0.16, 2.9, -1.42 + y * 0.08, y, 0, C.plankDark, { ao: 0 })
      }
      b.box(0.12, 3.6, 0.1, -1.1, 0.4, 1.4, C.plank, { rz: -0.66, ao: 0 }).box(0.12, 3.6, 0.1, 1.1, 0.4, 1.4, C.plank, { rz: 0.66, ao: 0 })
      b.box(3.5, 0.26, 3.5, 0, top, 0, C.plank)
      for (const s of [-1, 1]) {
        b.box(3.5, 0.14, 0.12, 0, top + 1.0, s * 1.68, C.timber, { ao: 0 }).box(0.12, 0.14, 3.5, s * 1.68, top + 1.0, 0, C.timber, { ao: 0 })
        for (const t of [-1, 1]) b.box(0.18, 2.5, 0.18, s * 1.6, top + 0.26, t * 1.6, C.timber, { ao: 0 })
        for (let i = -1; i <= 1; i++) b.box(0.08, 0.8, 0.08, i * 0.8, top + 0.26, s * 1.68, C.plank, { ao: 0 }).box(0.08, 0.8, 0.08, s * 1.68, top + 0.26, i * 0.8, C.plank, { ao: 0 })
      }
      b.cone(3, 1.9, 0, top + 2.7, 0, C.blue, { seg: 4, turn: Math.PI / 4, ao: 0.15 }).ball(0.16, 0, top + 4.65, 0, C.gold, { ao: 0 })
      b.cyl(0.04, 0.04, 1.5, 0, top + 4.6, 0, C.timberDark, { seg: 5 }).pennant(1.5, 0.6, 0, top + 5.75, 0, C.cloth)
      for (let i = 0; i < 9; i++) b.box(0.5, 0.06, 0.08, 0, 0.4 + i * 0.5, 1.74, C.plank, { ao: 0 }) // the ladder
      for (const sx of [-1, 1]) b.box(0.07, top + 0.2, 0.07, sx * 0.27, 0, 1.76, C.timber, { ao: 0 })
      const m = b.mesh(), guard = villager({ tunic: C.blue, hat: 'cap', hatColor: C.gold, tool: staff })
      guard.g.position.set(0.3, top + 0.26, 0.5)
      guard.r.rotation.x = -0.5
      m.add(guard.g)
      alive.push(t => { guard.g.rotation.y = 0.5 + Math.sin(t * 0.45) * 0.9 })
      return site('tower', m)
    },
    shed() {
      // The sawmill: an open shed, a log on the horse, stacked timber, a sawyer at work.
      const b = make()
      for (const sx of [-1, 1]) b.box(0.26, 3.1, 0.26, sx * 2.5, 0, -1.7, C.timber).box(0.26, 2.3, 0.26, sx * 2.5, 0, 1.7, C.timber)
      b.box(5.9, 0.2, 4.3, 0, 2.7, 0, C.teal, { rx: 0.23, ao: 0.1 }).box(5.94, 0.26, 0.14, 0, 2.2, 2.1, C.white, { ao: 0 })
      for (const f of [-0.33, 0.33]) b.box(5.92, 0.25, 0.1, 0, 2.7 - f * 1.0, f * 4.2, shade(C.teal, 0.78), { rx: 0.23, ao: 0 })
      b.box(5.2, 0.2, 0.2, 0, 2.05, 1.7, C.timber).box(5.2, 0.2, 0.2, 0, 2.85, -1.7, C.timber)
      logs(b, -1.7, 0, -0.9, 2.6, Math.PI / 2)
      logs(b, 1.5, 0, -1.2, 2.2, Math.PI / 2 + 0.1)
      for (let i = 0; i < 5; i++) b.box(2.4, 0.09, 0.34, 1.5, i * 0.1, 0.9 + (i % 2) * 0.06, i % 2 ? '#f3d49a' : '#e9c483', { ao: 0 })
      // The sawhorse and the log being cut.
      for (const sx of [-1, 1]) b.box(0.1, 0.9, 0.1, -1.2 + sx * 0.5, 0, 1.6, C.timber, { rx: 0.3 }).box(0.1, 0.9, 0.1, -1.2 + sx * 0.5, 0, 2.1, C.timber, { rx: -0.3 })
      b.cyl(0.19, 0.19, 1.9, -2.15, 0.8, 1.85, C.wood, { seg: 8, rz: -Math.PI / 2, ao: 0 }).cyl(0.15, 0.15, 0.02, -0.24, 0.8, 1.85, '#f0cf96', { seg: 8, rz: -Math.PI / 2, ao: 0 })
      b.cyl(0.36, 0.42, 0.5, 2.9, 0, 2.3, C.wood, { seg: 9 }).cyl(0.3, 0.3, 0.02, 2.9, 0.5, 2.3, '#f0cf96', { seg: 9, ao: 0 }) // a stump
      const m = b.mesh(), sawyer = villager({ tunic: C.teal, hat: 'cap', hatColor: C.orange, tool: saw })
      sawyer.g.position.set(-0.75, 0, 2.55)
      sawyer.g.rotation.y = Math.PI
      m.add(sawyer.g)
      alive.push(t => {
        sawyer.r.rotation.x = -0.95 + Math.sin(t * 6.5) * 0.3
        sawyer.body.rotation.x = 0.1 + Math.sin(t * 6.5) * 0.04
      })
      return site('shed', m)
    },
    cottageA() { const b = make(); cottage(b, 4.4, 4, C.orange); return site('cottageA', b.mesh(), { ry: 0.12 }) },
    cottageB() { const b = make(); cottage(b, 4.2, 3.8, C.red, { h: 2.6, rise: 2.2 }); return site('cottageB', b.mesh(), { ry: -0.1 }) },
    cottageC() {
      const b = make()
      cottage(b, 4.6, 4, C.orange, { h: 2.3 })
      barrel(b, 2.7, 0, 1.7)
      return site('cottageC', b.mesh(), { ry: 0.06 })
    },
    forge() {
      // Stone, a tall chimney, an open front under a slate lean-to, the anvil outside.
      const b = make(), w = 5, d = 3.6, h = 3
      stoneBlock(b, w, h, d, 0, 0, -0.6, 16)
      b.box(w + 0.4, 0.3, d + 0.4, 0, h, -0.6, C.stoneDark).box(w - 0.6, 0.5, d - 0.6, 0, h + 0.3, -0.6, C.stone)
      b.box(2.2, 1.9, 0.5, 0.5, 0, 1.0, '#3b2a2a', { ao: 0 }).box(1.5, 0.7, 0.3, 0.5, 0.15, 1.18, '#ff8a2a', { glow: 3.2, ao: 0 }).box(1.9, 0.22, 0.6, 0.5, 0, 1.25, C.stoneDark)
      stoneBlock(b, 1.5, 6.2, 1.5, -1.6, 0, -1.4, 10, C.stoneWarm)
      b.box(1.8, 0.3, 1.8, -1.6, 6.2, -1.4, C.stoneDark, { ao: 0 }).box(1.1, 0.35, 1.1, -1.6, 6.5, -1.4, '#4a4040', { ao: 0 })
      for (const sx of [-1, 1]) b.box(0.24, 2.3, 0.24, sx * 2.5, 0, 3.2, C.timber)
      b.box(5.8, 0.2, 2.9, 0, 2.62, 2.0, '#6f7f9a', { rx: 0.2, ao: 0.1 }).box(5.84, 0.26, 0.14, 0, 2.24, 3.42, C.white, { ao: 0 })
      b.box(5.3, 0.2, 0.2, 0, 2.2, 3.2, C.timber)
      // The anvil on its block, the quench barrel, a rack of tools.
      b.cyl(0.36, 0.4, 0.55, -0.9, 0, 2.5, C.wood, { seg: 9 }).box(0.7, 0.2, 0.3, -0.9, 0.55, 2.5, '#454b58', { ao: 0 }).box(0.42, 0.14, 0.24, -0.9, 0.75, 2.5, '#5d6474', { ao: 0 })
      b.cone(0.13, 0.4, -0.5, 0.75, 2.5, '#5d6474', { seg: 6, rz: -Math.PI / 2 }).box(0.3, 0.05, 0.1, -0.9, 0.9, 2.5, '#ffb04a', { glow: 3, ao: 0 })
      barrel(b, 1.9, 0, 2.6).cyl(0.26, 0.26, 0.02, 1.9, 0.72, 2.6, C.glass, { seg: 9, ao: 0 })
      b.box(1.3, 0.1, 0.1, 2.9, 1.5, 0.9, C.timber).box(0.1, 1.6, 0.1, 2.4, 0, 0.9, C.timber).box(0.1, 1.6, 0.1, 3.4, 0, 0.9, C.timber)
      for (let i = 0; i < 3; i++) b.box(0.05, 0.8, 0.05, 2.6 + i * 0.3, 0.7, 0.98, C.wood, { ao: 0 }).box(0.16, 0.14, 0.07, 2.6 + i * 0.3, 0.62, 0.98, C.iron, { ao: 0 })
      lantern(b, -2.5, 1.9, 3.36)
      const m = b.mesh(), smith = villager({ tunic: '#7a4a6e', hat: 'none', tool: hammer })
      smith.g.position.set(-0.9, 0, 3.25)
      smith.g.rotation.y = Math.PI
      m.add(smith.g)
      alive.push(t => {
        const hit = Math.abs(Math.sin(t * 3.3))
        smith.r.rotation.x = -0.35 - 1.5 * hit * hit
        smith.body.rotation.x = 0.16 - 0.1 * hit
      })
      return site('forge', m, { ry: -0.08 })
    },
    stall(k) {
      // A market stall: counter, striped awning, goods; a merchant behind it.
      const b = make(), hue = [C.red, C.blue, C.teal][k]
      b.box(2.8, 0.92, 1.1, 0, 0, 0.2, C.plank).box(2.96, 0.1, 1.24, 0, 0.92, 0.2, C.plankDark, { ao: 0 })
      for (let i = 0; i < 6; i++) b.box(0.05, 0.9, 0.04, -1.2 + i * 0.48, 0, 0.76, C.plankDark, { ao: 0 })
      for (const sx of [-1, 1]) b.box(0.15, 2.5, 0.15, sx * 1.42, 0, 0.8, C.timber).box(0.15, 2.95, 0.15, sx * 1.42, 0, -0.8, C.timber)
      for (let i = 0; i < 8; i++) {
        const c = i % 2 ? C.white : hue, x = -1.4 + i * 0.4
        b.box(0.4, 0.09, 2.1, x, 2.72, 0.05, c, { rx: 0.23, ao: 0 }).box(0.4, 0.3, 0.06, x, 2.14, 1.08, c, { ao: 0.2 })
      }
      if (k === 0) { // fruit
        for (let i = 0; i < 3; i++) {
          b.box(0.7, 0.2, 0.6, -0.9 + i * 0.9, 1.02, 0.3, C.wood, { rx: 0.25 })
          for (let j = 0; j < 6; j++) b.ball(0.12, -1.1 + i * 0.9 + (j % 3) * 0.2, 1.24 - Math.floor(j / 3) * 0.05, 0.22 + Math.floor(j / 3) * 0.24, ['#ff5a4a', '#ffa23a', '#8fd84a'][i], { detail: 0, ao: 0 })
        }
      } else if (k === 1) { // cloth
        for (let i = 0; i < 5; i++) b.cyl(0.13, 0.13, 0.9, -1.0 + i * 0.5, 1.15, -0.2, ['#ff7fa8', '#ffd84a', '#7fd4ff', '#b58cff', '#ff9a4a'][i], { seg: 8, rx: Math.PI / 2, ao: 0.1 })
        b.banner(0.5, 0.9, -1.0, 2.3, 0.86, '#b58cff', { amp: 0.1 }).banner(0.5, 0.9, 1.0, 2.3, 0.86, '#ff7fa8', { amp: 0.1 })
      } else { // bread and pots
        for (let i = 0; i < 4; i++) b.ball(0.17, -1.0 + i * 0.34, 1.13, 0.45, '#e8b56a', { sy: 0.6, sx: 1.4, detail: 1, ao: 0.2 })
        for (let i = 0; i < 3; i++) b.cyl(0.11, 0.17, 0.34, 0.5 + i * 0.36, 1.02, 0.2, ['#c9643a', '#e8a04a', '#8a5a3a'][i], { seg: 8 }).cyl(0.13, 0.11, 0.06, 0.5 + i * 0.36, 1.36, 0.2, '#f2d9a8', { seg: 8, ao: 0 })
      }
      crate(b, 1.9, 0, 0.5, 0.6, 0.3)
      const m = b.mesh(), seller = villager({ tunic: [C.gold, '#e06a9a', '#6fb4e8'][k], hat: k === 1 ? 'hood' : 'cap', hatColor: hue })
      seller.g.position.set(k === 1 ? 0.4 : -0.3, 0, -0.6)
      m.add(seller.g)
      alive.push(t => {
        const hi = ss(0.2, 0.7, Math.sin(t * 0.6 + k * 2.1)) // waves now and then
        seller.r.rotation.z = hi * (2.5 + Math.sin(t * 7) * 0.35)
        seller.g.rotation.y = Math.sin(t * 0.5 + k) * 0.3
      })
      return site('stall' + k, m, { ry: [0.28, 0, -0.28][k] })
    },
    well() {
      const b = make()
      b.cyl(0.95, 1.05, 0.8, 0, 0, 0, C.stone, { seg: 12 }).cyl(1.02, 1.02, 0.12, 0, 0.8, 0, C.stoneWarm, { seg: 12, ao: 0 }).cyl(0.72, 0.72, 0.02, 0, 0.92, 0, '#4fb8e6', { seg: 12, ao: 0 })
      for (const sx of [-1, 1]) b.box(0.16, 2.2, 0.16, sx * 0.95, 0.3, 0, C.timber)
      b.cyl(0.07, 0.07, 1.9, -0.95, 1.95, 0, C.wood, { seg: 6, rz: -Math.PI / 2, ao: 0 })
      b.sub(() => gable(b, 1.5, 2.4, 0.7, 2.5, C.red, { wall: C.timber, ov: 0.3, t: 0.14 }), 0, 0, 0, Math.PI / 2)
      b.cyl(0.02, 0.02, 0.7, 0.2, 1.25, 0, C.straw, { seg: 4, ao: 0 }).cyl(0.16, 0.13, 0.24, 0.2, 1.02, 0, C.wood, { seg: 8 })
      return site('well', b.mesh())
    },
    granary() {
      // A round timber store on stone feet under a straw cap.
      const b = make()
      for (let i = 0; i < 6; i++) b.cyl(0.3, 0.36, 0.7, Math.cos(i * 1.047) * 1.5, 0, Math.sin(i * 1.047) * 1.5, C.stone, { seg: 7 })
      b.cyl(2.0, 2.0, 0.24, 0, 0.7, 0, C.timber, { seg: 14 }).cyl(1.8, 1.8, 2.6, 0, 0.94, 0, C.plank, { seg: 14 })
      for (const y of [1.3, 2.2, 3.1]) b.cyl(1.84, 1.84, 0.12, 0, y, 0, C.timberDark, { seg: 14, ao: 0 })
      b.cone(2.6, 2.4, 0, 3.5, 0, C.straw, { seg: 14, ao: 0.3 }).cone(1.5, 1.5, 0, 4.75, 0, shade(C.straw, 0.86), { seg: 14, ao: 0 }).ball(0.2, 0, 6.2, 0, C.timber)
      b.box(0.8, 1.3, 0.12, 0, 0.94, 1.8, C.timberDark, { ao: 0.3 })
      for (let i = 0; i < 4; i++) b.box(0.9, 0.08, 0.3, 0, 0.1 + i * 0.22, 2.7 - i * 0.24, C.plank, { ao: 0 })
      sack(b, 1.5, 0, 2.1)
      sack(b, 2.0, 0, 1.7, 0.9)
      return site('granary', b.mesh())
    },
    keep() {
      // The keep, in three lifts: a stone ground floor on a plinth; a timber hall under a blue roof;
      // then the tower and the corner turret with their pennants.
      const [x, z, , , at] = SITES.keep
      let b = make()
      stoneBlock(b, 12, 0.9, 8.6, 0, 0, 0, 12, C.stoneWarm)
      for (let i = 0; i < 3; i++) b.box(3.4 - i * 0.2, 0.3, 0.5, 0, 0.6 - i * 0.3, 4.5 + i * 0.5, i % 2 ? C.stone : C.stoneWarm, { ao: 0.1 })
      stoneBlock(b, 10.6, 2.7, 7.2, 0, 0.9, 0, 30)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) stoneBlock(b, 0.9, 2.9, 0.9, sx * 5.2, 0.9, sz * 3.5, 3, C.stoneWarm)
      b.box(1.9, 1.7, 0.2, 0, 0.9, 3.66, C.timberDark, { ao: 0.3 }).cyl(0.95, 0.95, 0.2, 0, 2.6, 3.56, C.timberDark, { seg: 14, rx: Math.PI / 2, ao: 0 })
      b.box(0.08, 2.5, 0.24, 0, 0.9, 3.68, C.plank, { ao: 0 })
      for (const y of [1.4, 2.2]) b.box(1.9, 0.1, 0.24, 0, y, 3.68, C.iron, { ao: 0 })
      for (const sx of [-1, 1]) {
        b.box(0.34, 2.0, 0.34, sx * 1.22, 0.9, 3.7, C.stoneWarm, { ao: 0.1 })
        lantern(b, sx * 1.9, 2.3, 3.75)
        for (const wx of [3.2, 4.2]) b.box(0.36, 1.1, 0.1, sx * wx, 1.7, 3.62, C.glassDark, { ao: 0.2 }).box(0.5, 0.12, 0.16, sx * wx, 1.6, 3.64, C.stoneWarm, { ao: 0 })
      }
      for (const wz of [-1.6, 1.4]) b.box(0.1, 1.1, 0.36, -5.32, 1.7, wz, C.glassDark, { ao: 0.2 })
      const chat = [villager({ tunic: '#e06a9a', hat: 'hood' }), villager({ tunic: C.teal, hat: 'straw' })]
      const base = pop(b.mesh(), x, z, at, { r: 6.5 })
      chat[0].g.position.set(-3.6, 0, 6.2)
      chat[0].g.rotation.y = 1.2
      chat[1].g.position.set(-2.7, 0, 6.5)
      chat[1].g.rotation.y = -1.9
      base.obj.add(chat[0].g, chat[1].g)
      alive.push(t => {
        chat[0].body.rotation.x = Math.sin(t * 2.1) * 0.06
        chat[0].r.rotation.x = -0.7 - Math.max(0, Math.sin(t * 2.1)) * 0.7
        chat[1].body.rotation.z = Math.sin(t * 1.7 + 1) * 0.07
        chat[1].l.rotation.x = -0.4 - Math.max(0, Math.sin(t * 1.7 + 2)) * 0.9
      })

      // The hall: jettied out over the stone, half-timbered, windows in a row.
      b = make()
      b.box(11.5, 0.32, 8.1, 0, 0, 0, C.timberDark).box(11, 2.1, 7.6, 0, 0.32, 0, C.plaster)
      for (let i = 0; i <= 6; i++) b.box(0.24, 2.1, 0.14, -5.4 + i * 1.8, 0.32, 3.8, C.timber, { ao: 0.1 })
      for (let i = 0; i <= 4; i++) b.box(0.14, 2.1, 0.24, -5.5, 0.32, -3.6 + i * 1.8, C.timber, { ao: 0.1 })
      b.box(11.1, 0.2, 0.14, 0, 2.2, 3.8, C.timber, { ao: 0 }).box(0.14, 0.2, 7.7, -5.5, 2.2, 0, C.timber, { ao: 0 })
      for (let i = 0; i < 6; i++) {
        if (i % 2 === 0) windowAt(b, -4.5 + i * 1.8, 1.05, 3.8, { w: 0.85, h: 0.85 })
        else b.box(0.12, 1.5, 0.1, -4.5 + i * 1.8 - 0.55, 0.36, 3.81, C.timber, { rz: -0.7, ao: 0 }).box(0.12, 1.5, 0.1, -4.5 + i * 1.8 + 0.55, 0.36, 3.81, C.timber, { rz: 0.7, ao: 0 })
      }
      for (const wz of [-1.8, 1.8]) b.sub(() => windowAt(b, 0, 1.05, 0, { w: 0.85, h: 0.85 }), -5.52, 0, wz, -Math.PI / 2)
      b.sub(() => gable(b, 7.9, 11, 2.5, 2.42, C.blue, { cap: C.gold, t: 0.26, ov: 0.6 }), 0, 0, 0, Math.PI / 2)
      for (const sx of [-1, 1]) b.ball(0.26, sx * 5.9, 5.1, 0, C.gold, { ao: 0 })
      // Two long banners hang from the jetty, either side of the door.
      for (const sx of [-1, 1]) {
        b.box(1.3, 0.1, 0.1, sx * 2.7, 0.02, 4.16, C.gold, { ao: 0 })
        b.banner(1.1, 0.4, sx * 2.7, 0, 4.16, C.white, { total: 2.6, amp: 0.3 }).banner(1.1, 1.9, sx * 2.7, -0.4, 4.16, C.cloth, { from: 0.4, total: 2.6, amp: 0.3 })
        b.pennant(0.6, 1.1, sx * 2.7, -2.3, 4.16, C.cloth, { rz: -Math.PI / 2, wave: () => 0.3 }) // its pointed foot
        b.box(0.42, 0.42, 0.03, sx * 2.7, -1.5, 4.19, C.red, { rz: Math.PI / 4, ao: 0 })
      }
      pop(b.mesh(), x, z, at + 3, { y: 3.6, r: 6.5 })

      // The tower, rising through the hall's back corner, and the round turret at the front.
      b = make()
      stoneBlock(b, 3.3, 10.2, 3.3, 3.1, 0, -2.1, 22)
      b.box(4.1, 0.36, 4.1, 3.1, 10.2, -2.1, C.timberDark)
      b.sub(() => { for (const s of [-1, 1]) merlons(b, 4.1, 0, 10.56, s * 1.75, 0.5) }, 3.1, 0, -2.1)
      b.sub(() => { for (const s of [-1, 1]) merlons(b, 3.1, 0, 10.56, s * 1.75, 0.5) }, 3.1, 0, -2.1, Math.PI / 2)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.2, 1.7, 0.2, 3.1 + sx * 1.3, 10.56, -2.1 + sz * 1.3, C.timber, { ao: 0 })
      b.cone(2.7, 2.9, 3.1, 12.2, -2.1, C.blue, { seg: 4, turn: Math.PI / 4, ao: 0.15 }).ball(0.24, 3.1, 15.1, -2.1, C.gold, { ao: 0 })
      b.cyl(0.05, 0.05, 2.2, 3.1, 15.1, -2.1, C.timberDark, { seg: 5 }).pennant(2.6, 0.95, 3.1, 16.75, -2.1, C.cloth, { amp: 0.42 })
      for (const y of [6.6, 8.4]) b.box(0.5, 0.9, 0.1, 3.1, y, -0.44, C.glassDark, { ao: 0.2 }).box(0.1, 0.9, 0.5, 1.44, y, -2.1, C.glassDark, { ao: 0.2 })
      b.cyl(1.25, 1.25, 4.4, -5.0, 3.6, 3.3, C.stone, { seg: 12 }).cyl(1.45, 1.3, 0.4, -5.0, 8.0, 3.3, C.stoneWarm, { seg: 12, ao: 0 })
      b.cone(1.75, 2.3, -5.0, 8.4, 3.3, C.blue, { seg: 12, ao: 0.15 }).ball(0.18, -5.0, 10.7, 3.3, C.gold, { ao: 0 })
      b.cyl(0.04, 0.04, 1.4, -5.0, 10.7, 3.3, C.timberDark, { seg: 5 }).pennant(1.6, 0.6, -5.0, 11.75, 3.3, C.cloth)
      b.box(0.4, 0.8, 0.1, -5.0, 5.6, 4.56, C.glassDark, { ao: 0.2 })
      pop(b.mesh(), x, z, at + 6, { r: 6.5 })
    },
    walls() {
      // The stone curtain wall goes up in lengths behind the keep and down the far side to the gate.
      const run = (len, x, z, ry, at) => {
        const b = make()
        stoneBlock(b, len, 2.9, 1.0, 0, 0, 0, Math.round(len * 1.6))
        b.box(len, 0.3, 1.5, 0, 2.9, 0, C.stoneDark, { ao: 0.1 })
        merlons(b, len, 0, 3.2, 0.5, 0.45)
        pop(b.mesh(), x, z, at, { ry, r: len / 2 })
      }
      run(9.4, 34.7, -21, 0, 26)
      run(9.4, 44.1, -21, 0, 33)
      run(8.2, 52.9, -21, 0, 40)
      run(8.4, 58, -15.9, Math.PI / 2, 47.5)
      run(6.6, 58, -8.2, Math.PI / 2, 49)
      // The corner drum where the two runs meet.
      const b = make()
      b.cyl(1.9, 2.1, 4.4, 0, 0, 0, C.stone, { seg: 14 }).cyl(2.2, 1.95, 0.5, 0, 4.4, 0, C.stoneWarm, { seg: 14, ao: 0 })
      for (let i = 0; i < 8; i++) b.box(0.6, 0.55, 0.5, Math.cos(i * 0.785) * 1.95, 4.9, Math.sin(i * 0.785) * 1.95, i % 2 ? C.stone : C.stoneWarm, { ry: -i * 0.785 + Math.PI / 2, ao: 0.1 })
      b.cone(2.0, 2.4, 0, 5.3, 0, C.blue, { seg: 14, ao: 0.15 }).ball(0.2, 0, 7.7, 0, C.gold, { ao: 0 }).cyl(0.04, 0.04, 1.3, 0, 7.7, 0, C.timberDark, { seg: 5 }).pennant(1.5, 0.6, 0, 8.7, 0, C.cloth)
      pop(b.mesh(), 58, -21, 44, { r: 2.6 })
    },
    towerS() {
      // The stone gate tower beside the far gate.
      const b = make()
      stoneBlock(b, 3.2, 6.6, 3.2, 0, 0, 0, 20)
      b.box(4, 0.4, 4, 0, 6.6, 0, C.stoneDark, { ao: 0.1 })
      for (const s of [-1, 1]) merlons(b, 4, 0, 7, s * 1.72, 0.5)
      b.sub(() => { for (const s of [-1, 1]) merlons(b, 3, 0, 7, s * 1.72, 0.5) }, 0, 0, 0, Math.PI / 2)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.2, 1.9, 0.2, sx * 1.2, 7, sz * 1.2, C.timber, { ao: 0 })
      b.cone(2.5, 2.2, 0, 8.9, 0, C.blue, { seg: 4, turn: Math.PI / 4, ao: 0.15 }).ball(0.2, 0, 11.1, 0, C.gold, { ao: 0 })
      b.cyl(0.04, 0.04, 1.5, 0, 11.1, 0, C.timberDark, { seg: 5 }).pennant(1.7, 0.66, 0, 12.25, 0, C.cloth)
      b.box(1.2, 0.1, 0.1, 0, 5.6, 1.66, C.gold, { ao: 0 }).banner(1.0, 0.4, 0, 5.6, 1.66, C.white, { total: 2.4 }).banner(1.0, 2.0, 0, 5.2, 1.66, C.cloth, { from: 0.4, total: 2.4 })
      b.box(0.4, 0.4, 0.03, 0, 4.2, 1.69, C.red, { rz: Math.PI / 4, ao: 0 })
      b.box(0.1, 0.9, 0.5, -1.62, 4.4, 0, C.glassDark, { ao: 0.2 })
      door(b, 0.6, 0, 1.62, 0.9, 1.6)
      const m = b.mesh(), guard = villager({ tunic: C.blue, hat: 'cap', hatColor: C.gold, tool: staff })
      guard.g.position.set(-0.4, 7, 0.4)
      guard.r.rotation.x = -0.5
      m.add(guard.g)
      alive.push(t => { guard.g.rotation.y = -0.7 + Math.sin(t * 0.38 + 2) * 0.8 })
      return site('towerS', m)
    },
    gate() {
      // The far gate: two stone piers, a beam between them, banners toward the village.
      const b = make(), gz = pathZ(58)
      for (const s of [-1, 1]) {
        stoneBlock(b, 2.2, 4.6, 2.0, 0, 0, gz + s * 3.1, 10)
        b.box(2.6, 0.34, 2.4, 0, 4.6, gz + s * 3.1, C.stoneDark, { ao: 0.1 })
        b.cone(1.9, 1.6, 0, 4.94, gz + s * 3.1, C.blue, { seg: 4, turn: Math.PI / 4, sz: 0.92, ao: 0.15 }).ball(0.16, 0, 6.5, gz + s * 3.1, C.gold, { ao: 0 })
        b.sub(() => b.box(1.0, 0.1, 0.1, 0, 3.9, 0, C.gold, { ao: 0 }).banner(0.9, 0.35, 0, 3.9, 0, C.white, { total: 2.1 }).banner(0.9, 1.75, 0, 3.55, 0, C.cloth, { from: 0.35, total: 2.1 }), -1.14, 0, gz + s * 3.1, -Math.PI / 2)
        lantern(b, -1.2, 1.9, gz + s * 1.9)
      }
      b.box(1.5, 0.9, 4.4, 0, 3.5, gz, C.stone).box(1.8, 0.24, 4.4, 0, 4.4, gz, C.stoneDark, { ao: 0 })
      b.sub(() => merlons(b, 4.2, 0, 4.64, 0, 1.5), 0, 0, gz, Math.PI / 2)
      pop(b.mesh(), 58, 0, 50, { r: 4 })
    },
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
    g.lineWidth = 0.07
    g.lineCap = 'round'
    for (const [ink, a] of [['#c4ee78', 0.6], ['#5fb440', 0.5]]) {
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
    const cobbles = (n, at, inks) => {
      for (let i = 0; i < n; i++) {
        const [x, z] = at()
        g.fillStyle = pick(inks)
        g.globalAlpha = 0.75
        g.beginPath()
        g.ellipse(x, z, 0.12 + rnd() * 0.16, 0.09 + rnd() * 0.1, rnd() * 3, 0, 7)
        g.fill()
      }
      g.globalAlpha = 1
    }
    const SAND = '#f3dda4', EDGE = '#d6ba7f', STONES = ['#e6cc92', '#fbecc0', '#d9bb80', '#f6e2b0']
    // Plots: packed earth under each building, and a footpath from its door to the road.
    for (const [x, z, w, d] of Object.values(SITES)) {
      g.strokeStyle = SAND
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(x, z)
      g.lineTo(x + 0.4, pathZ(x))
      g.stroke()
      blob(x, z, w + 0.6, d + 0.6, 'rgba(120,180,70,0.6)', 1.3)
      blob(x, z, w, d, '#dcbd84')
      blob(x, z, w - 0.7, d - 0.7, '#e7cc97', 0.6)
    }
    // The road.
    g.lineJoin = 'round'
    for (const [w, ink] of [[4.2, 'rgba(120,180,70,0.55)'], [3.2, EDGE], [2.6, SAND]]) {
      g.strokeStyle = ink
      g.lineWidth = w
      g.beginPath()
      for (let x = X0 - 2; x <= X1 + 2; x += 0.8) g.lineTo(x, pathZ(x))
      g.stroke()
    }
    cobbles(mobile ? 500 : 1100, () => { const x = X0 + rnd() * (X1 - X0); return [x, pathZ(x) + (rnd() - 0.5) * 2.3] }, STONES)
    // The market square: rings of cobbles round its middle.
    const PX = 34, PZ = -0.9
    for (const [r, ink] of [[7.3, 'rgba(120,180,70,0.55)'], [6.8, EDGE], [6.4, '#ecd9ae']]) { g.fillStyle = ink; g.beginPath(); g.arc(PX, PZ, r, 0, 7); g.fill() }
    for (let r = 0.5; r < 6.3; r += 0.5) {
      const n = Math.round((6.283 * r) / 0.52)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + r
        g.fillStyle = pick(['#dcc590', '#f7e7bd', '#e6d2a2', '#cfb57e'])
        g.beginPath()
        g.ellipse(PX + Math.cos(a) * r, PZ + Math.sin(a) * r, 0.2, 0.15, a, 0, 7)
        g.fill()
      }
    }
    // The field: tilled rows. The pond: sand, water, a few glints.
    blob(13, 5.0, 12.6, 3.6, '#a8763f', 0.5)
    g.strokeStyle = '#c08a50'
    g.lineWidth = 0.2
    for (let z = 3.55; z < 6.7; z += 0.45) { g.beginPath(); g.moveTo(7, z); g.lineTo(19, z); g.stroke() }
    for (const [rx2, rz2, ink] of [[4.9, 2.5, '#f1dfa9'], [4.3, 2.0, '#4fbfe8'], [3.2, 1.3, '#7ad6f2']]) { g.fillStyle = ink; g.beginPath(); g.ellipse(45, 5.2, rx2, rz2, 0.12, 0, 7); g.fill() }
    g.strokeStyle = '#e8fbff'
    g.lineWidth = 0.09
    for (let i = 0; i < 14; i++) { const x = 42.4 + rnd() * 5, z = 4.3 + rnd() * 1.7; g.beginPath(); g.moveTo(x, z); g.lineTo(x + 0.5 + rnd() * 0.5, z); g.stroke() }
    // Flowers in drifts.
    for (let k = 0; k < (mobile ? 50 : 110); k++) {
      const x = rx(), z = rz(), ink = pick(['#ffffff', '#ffe25a', '#ff8fb4', '#c9a2ff', '#ffb25a'])
      if (Math.abs(z - pathZ(x)) < 2.4) continue
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
  // Where nothing tall may stand: the road, the village, the approach to its gate, and the whole near
  // side, which the camera (and, further back, a phone's) flies over.
  const clearOf = (x, z) => Math.abs(z - pathZ(x)) > 3.4 && !(x > 1 && x < 60 && z > -22.5) && !(z > 4.5 && x > -26 && x < 74) && !(x > -14 && x <= 1 && z > -9)
  let dust = null, smoke = null, forgeRec = null
  const walkers = [] // villagers out in the open, who arrive with a building
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
    () => {
      // What stands before he builds anything: the timber palisade and its gate, the front fence.
      const b = make()
      const log = (x, z) => {
        const h = 2.5 + rnd() * 0.35, c = pick([C.wood, '#c4844a', '#a96c38'])
        b.cyl(0.25, 0.27, h, x, 0, z, c, { seg: 6, open: true, ao: 0.3 }).cone(0.25, 0.45, x, h, z, c, { seg: 6, ao: 0 })
      }
      const gz = pathZ(3)
      for (let z = 7.4; z > -21; z -= 0.5) if (Math.abs(z - gz) > 2.3) log(3 + Math.sin(z * 1.7) * 0.06, z)
      for (let x = 3.5; x < 30; x += 0.5) log(x, -21 + Math.sin(x * 1.7) * 0.06)
      b.box(0.14, 0.2, 18.4, 2.72, 1.6, -11.8 + gz, C.timberDark, { ao: 0 }).box(0.14, 0.2, 4.9, 2.72, 1.6, 4.9 + gz / 2, C.timberDark, { ao: 0 }).box(26.6, 0.2, 0.14, 16.6, 1.6, -20.72, C.timberDark, { ao: 0 })
      // The gate: two tall posts, a beam, a little roof, a pair of pennants.
      for (const s of [-1, 1]) {
        b.cyl(0.4, 0.46, 4.4, 3, 0, gz + s * 2.5, C.timber, { seg: 8 }).cone(0.42, 0.6, 3, 4.4, gz + s * 2.5, C.timber, { seg: 8, ao: 0 })
        b.cyl(0.04, 0.04, 1.2, 3, 5, gz + s * 2.5, C.timberDark, { seg: 5 }).pennant(1.2, 0.5, 3, 5.9, gz + s * 2.5, C.cloth)
        lantern(b, 2.5, 2.2, gz + s * 2.5)
      }
      b.box(0.4, 0.4, 5.8, 3, 3.5, gz, C.timberDark)
      b.sub(() => gable(b, 1.6, 6.2, 0.7, 3.9, C.blue, { wall: C.timber, ov: 0.35, t: 0.16 }), 3, 0, gz)
      b.sub(() => b.banner(1.4, 0.3, 0, 3.5, 0, C.white, { total: 1.4, amp: 0.14 }).banner(1.4, 1.1, 0, 3.2, 0, C.cloth, { from: 0.3, total: 1.4, amp: 0.14 }), 2.76, 0, gz, -Math.PI / 2)
      // The low fence along the front, with a gap where the pond is.
      for (let x = 3; x <= 58; x += 2.2) {
        if (x > 39 && x < 51) continue
        b.box(0.16, 1.0, 0.16, x, 0, 7.9, C.plank).box(2.2, 0.1, 0.08, x + 1.1, 0.42, 7.9, C.plankDark, { ao: 0 }).box(2.2, 0.1, 0.08, x + 1.1, 0.78, 7.9, C.plankDark, { ao: 0 })
      }
      scene.add(b.mesh())
    },
    () => {
      // The field, a scarecrow, haystacks, lamps along the road, rocks, a signpost, each plot's stakes.
      const b = make()
      for (let z = 3.78; z < 6.6; z += 0.45) for (let x = 7.3; x < 18.9; x += mobile ? 0.7 : 0.42) b.cone(0.17, 0.62 + rnd() * 0.22, x + (rnd() - 0.5) * 0.1, 0, z, rnd() < 0.5 ? '#f2c94e' : '#e6b43c', { seg: 5, ao: 0.4 })
      b.box(0.1, 1.9, 0.1, 16.6, 0, 5, C.timber).box(1.3, 0.1, 0.1, 16.6, 1.35, 5, C.timber).box(0.6, 0.6, 0.3, 16.6, 0.85, 5, C.red).ball(0.24, 16.6, 1.75, 5, C.straw, { ao: 0.2 }).cone(0.42, 0.26, 16.6, 1.9, 5, C.timber, { seg: 10 })
      for (const [x, z, s] of [[21.6, 5.3, 1], [23.2, 6.1, 0.8], [22.5, 4.3, 0.65]]) b.cyl(0.5 * s, 0.95 * s, 1.0 * s, x, 0, z, C.straw, { seg: 10, ao: 0.3 }).cone(0.52 * s, 0.6 * s, x, 1.0 * s, z, shade(C.straw, 0.92), { seg: 10, ao: 0 })
      for (const x of [8, 17, 26, 42, 51]) {
        const z = pathZ(x) - 2.3
        b.box(0.14, 2.3, 0.14, x, 0, z, C.timberDark).box(0.1, 0.1, 0.6, x, 2.2, z + 0.02, C.timberDark, { ao: 0 })
        lantern(b, x, 1.82, z + 0.5)
      }
      for (let i = 0; i < 22; i++) {
        const x = X0 + 6 + rnd() * (X1 - X0 - 12), z = Z0 + 4 + rnd() * (Z1 - Z0 - 8)
        if (Math.abs(z - pathZ(x)) < 2.6 || Object.values(SITES).some(([sx, sz, w, d]) => Math.abs(x - sx) < w / 2 + 1 && Math.abs(z - sz) < d / 2 + 1)) continue
        const r = 0.3 + rnd() * 0.5
        b.ball(r, x, r * 0.3, z, pick([C.stone, C.stoneDark, C.stoneWarm]), { detail: 0, flat: true, sy: 0.7, ao: 0.3, ry: rnd() * 3 })
      }
      b.box(0.14, 1.7, 0.14, 0.2, 0, 2.3, C.timber).box(1.0, 0.3, 0.08, 0.6, 1.25, 2.3, C.plank, { ao: 0 }).box(0.8, 0.26, 0.08, -0.2, 0.85, 2.3, C.plank, { ao: 0 })
      // A builder's stakes and line at the corners of every plot still to be raised.
      for (const [x, z, w, d] of Object.values(SITES)) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        b.cyl(0.05, 0.05, 0.7, x + sx * (w / 2 - 0.9), 0, z + sz * (d / 2 - 0.9), C.plank, { seg: 5, ao: 0 }).ball(0.09, x + sx * (w / 2 - 0.9), 0.72, z + sz * (d / 2 - 0.9), C.red, { detail: 0, ao: 0 })
      }
      scene.add(b.mesh())
      // The farmer, hoeing the field's edge since before he came.
      const farmer = villager({ tunic: '#8fbf4a', hat: 'straw', tool: hoe })
      farmer.g.position.set(9.4, 0, 3.05)
      farmer.g.rotation.y = 0.35
      scene.add(farmer.g)
      alive.push(t => {
        const dig = Math.max(0, Math.sin(t * 2.4))
        farmer.r.rotation.x = -0.45 - 0.55 * dig
        farmer.body.rotation.x = 0.06 + 0.07 * dig
      })
    },
    () => {
      // Round trees and bushes: one canopy, one trunk, instanced.
      const cb = make()
      cb.ball(1, 0, 0, 0, '#ffffff', { detail: 2, ao: 0.42 }).ball(0.7, 0.62, -0.2, 0.3, '#ffffff', { ao: 0.42 }).ball(0.62, -0.58, -0.12, -0.34, '#ffffff', { ao: 0.42 }).ball(0.55, 0.12, 0.56, -0.2, '#f4ffe6', { ao: 0.3 })
      const canopyGeo = cb.mesh().geometry
      const N = mobile ? 46 : 88, BUSH = mobile ? 26 : 50
      const canopy = instanced(canopyGeo, N + BUSH, { shadow: true })
      const trunk = instanced(paint(new THREE.CylinderGeometry(0.6, 1, 1, 7, 1, true).translate(0, 0.5, 0), '#8f5d38', { ao: 0.3 }), N, { shadow: true })
      const spots = [[19.6, -12.6], [27.2, -18.2], [33.4, -18.6], [53.8, -13.5], [41, -18.4], [9.6, -17.8], [26.2, -12.4]] // a few inside the walls
      for (let i = 0; i < N; i++) {
        let x, z, tries = 0
        if (i < spots.length) [x, z] = spots[i]
        else do {
          x = X0 + 3 + rnd() * (X1 - X0 - 6)
          z = Z0 + 2 + rnd() * (Z1 - Z0 - 4)
        } while ((!inside(x, z, 0.95) || !clearOf(x, z)) && ++tries < 40)
        const r = i < spots.length ? 1.25 + rnd() * 0.3 : 1.5 + rnd() * 0.9, th = 1.1 + rnd() * 0.8
        const leaf = rnd() < 0.08 ? '#ffb7cd' : rnd() < 0.07 ? '#ffd257' : pick(C.leaf)
        setAt(canopy, i, x, th + r * 0.72, z, r, r * 0.92, r, rnd() * 6.3, leaf)
        setAt(trunk, i, x, 0, z, 0.26 + r * 0.06, th + r * 0.3, 0.26 + r * 0.06)
      }
      for (let i = 0; i < BUSH; i++) {
        let x, z, tries = 0
        do {
          x = X0 + 3 + rnd() * (X1 - X0 - 6)
          z = Z0 + 2 + rnd() * (Z1 - Z0 - 4)
        } while ((!inside(x, z, 0.96) || Math.abs(z - pathZ(x)) < 3 || (x > 2 && x < 59 && z > -21.5 && z < 7)) && ++tries < 40)
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
          do { cx = X0 + 4 + rnd() * (X1 - X0 - 8); cz = Z0 + 3 + rnd() * (Z1 - Z0 - 6) } while ((!inside(cx, cz, 0.93) || Math.abs(cz - pathZ(cx)) < 2.2) && ++tries < 30)
          ink = pick(['#ffffff', '#ffe25a', '#ff8fb4', '#c9a2ff', '#ffb25a'])
        }
        setAt(flowers, i, cx + (rnd() - 0.5) * 2.4, 0.12 + rnd() * 0.08, cz + (rnd() - 0.5) * 1.8, 0.7 + rnd() * 0.7, undefined, undefined, 0, ink)
      }
      const tb = make()
      tb.cone(0.07, 0.36, 0, 0, 0, '#ffffff', { seg: 4, ao: 0.5 }).cone(0.06, 0.28, 0.09, 0, 0.03, '#ffffff', { seg: 4, rz: -0.4, ao: 0.5 }).cone(0.06, 0.3, -0.08, 0, -0.04, '#ffffff', { seg: 4, rz: 0.4, ao: 0.5 })
      const tufts = instanced(tb.mesh().geometry, T)
      for (let i = 0; i < T; i++) {
        let x, z, tries = 0
        do { x = X0 + 3 + rnd() * (X1 - X0 - 6); z = Z0 + 2 + rnd() * (Z1 - Z0 - 4) } while ((!inside(x, z, 0.96) || Math.abs(z - pathZ(x)) < 1.7) && ++tries < 30)
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
    build.barn, build.tower, build.shed, build.cottageA,
    () => { forgeRec = build.forge() },
    build.cottageB, () => build.stall(0), () => build.stall(1), () => build.stall(2), build.cottageC, build.granary,
    () => {
      const wellRec = build.well()
      // Out in the open: a carrier between the storehouse and the sawmill, a water-carrier round the well.
      const carrier = villager({ tunic: C.orange, hat: 'straw', both: a => a.box(0.5, 0.36, 0.22, 0, -0.62, 0.05, C.plank, { ao: 0 }) })
      carrier.l.position.x = -0.2
      carrier.r.position.x = 0.2
      carrier.l.rotation.x = carrier.r.rotation.x = -1.25
      const water = villager({ tunic: '#6fb4e8', hat: 'hood', both: bucket })
      scene.add(carrier.g, water.g)
      walkers.push({ v: carrier, ref: pops[0] }, { v: water, ref: wellRec })
      alive.push(t => {
        const u = (t * 0.085) % 2, back = u > 1, k = back ? 2 - u : u, x = 11 + k * 6.6
        carrier.g.position.set(x, Math.abs(Math.sin(t * 8)) * 0.05, pathZ(x) - 2.2 - Math.sin(k * Math.PI) * 0.5)
        carrier.g.rotation.set(0, back ? -Math.PI / 2 : Math.PI / 2, Math.sin(t * 8) * 0.07)
        const a = t * 0.32
        water.g.position.set(SITES.well[0] + Math.cos(a) * 2.3, Math.abs(Math.sin(t * 7)) * 0.04, SITES.well[1] + Math.sin(a) * 2)
        water.g.rotation.set(0, -a, Math.sin(t * 7) * 0.06)
      })
    },
    build.keep, build.walls, build.towerS, build.gate,
    () => {
      // Dust round a building's foot as it lands (small, flat, low and quick), and the forge's smoke: opaque toy puffs.
      const puff = paint(new THREE.IcosahedronGeometry(1, 1), '#ffffff', { ao: 0.2 })
      dust = instanced(puff, pops.length * PUFFS)
      smoke = instanced(puff, 14)
      for (let i = 0; i < pops.length * PUFFS; i++) setAt(dust, i, 0, -5, 0, 1e-3, undefined, undefined, 0, '#fff6e6')
      for (let i = 0; i < 14; i++) setAt(smoke, i, 0, -5, 0, 1e-3, undefined, undefined, 0, i % 2 ? '#f2f2f2' : '#dcdfe6')
      scene.add(dust, smoke)
    },
  ]
  let built = false // world.js compiles the village once it is whole
  ;(async () => {
    let t0 = performance.now()
    for (const job of jobs) {
      job()
      if (performance.now() - t0 > 4) {
        await new Promise(r => setTimeout(r))
        t0 = performance.now()
      }
    }
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
  // the keep against the sky; and a high one for the village whole, at the end.
  const RIG = {
    // Close enough that the builder reads, looking a little ahead of him at the next plot to go up.
    wide: { follow: [[-7, 8.5, 10.5], [3, 1, -3]], hero: [[-12, 6.4, 18], [2.5, 5.2, -5]], crane: [[-21, 19, 22], [-7, 2.2, -6.5]] },
    tall: { follow: [[-8.5, 10.5, 12], [4, 1, -3]], hero: [[-35, 12, 17], [5, 6.5, -7]], crane: [[-40, 30, 22], [-5, 2, -8]] }, // a phone sees a narrow slice: back a little further, up the road
  }
  let lastT = null, lastX = null, movedAt = -1, cue = '', struck = -9
  const SWING = 'Right_Hand_Sword_Slash' // with the mallet in his fist, the blow that raises a building

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
    if (you) {
      const next = t - struck < you.duration(SWING) * 0.8 ? SWING : t - movedAt < 0.25 ? 'Walk' : p > 0.82 && p < 0.99 ? 'Cheer_with_Both_Hands_Up' : 'Idle'
      if (next !== cue) you.play((cue = next), { fade: next === SWING ? 0.12 : 0.3 })
      you.root.position.set(x, 0.02, z)
      you.root.rotation.y = Math.atan2(1, 0.147 * Math.cos((x - 4) * 0.105)) // along the road
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
    if (smoke && forgeRec) {
      const fk = Math.min(1, Math.max(0, forgeRec.k)), ox = forgeRec.x - 1.4, oz = forgeRec.z - 1.5
      for (let i = 0; i < 14; i++) {
        const k = (t * 0.16 + i / 14) % 1
        dummy.position.set(ox + k * k * 3.2 + Math.sin(i * 5.1 + k * 5) * 0.35, 6.9 + k * 6.5, oz - k * 1.2 + Math.cos(i * 3.3 + k * 4) * 0.3)
        dummy.scale.setScalar(Math.max(1e-3, fk * (0.3 + k * 1.1) * (1 - k * k * k)))
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        smoke.setMatrixAt(i, dummy.matrix)
      }
      smoke.instanceMatrix.needsUpdate = true
    }

    // The camera: down out of the clouds onto the three-quarter view; lower for the keep; up and back at the end.
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    const portrait = state.portrait ?? aspect < 0.85
    const rig = RIG[portrait ? 'tall' : 'wide']
    const hero = state.still ? 0 : ss(0.5, 0.64, p) * (1 - ss(0.76, 0.84, p)), crane = state.still ? 0 : ss(0.76, 0.9, p)
    cam.fromArray(rig.follow[0]).lerp(a3.fromArray(rig.hero[0]), hero).lerp(a3.fromArray(rig.crane[0]), crane)
    look.fromArray(rig.follow[1]).lerp(b3.fromArray(rig.hero[1]), hero).lerp(b3.fromArray(rig.crane[1]), crane)
    const high = state.still ? 0 : (1 - ss(0, 0.115, p)) ** 1.6
    cam.x += x + high * 5
    cam.y += high * 44
    cam.z += z * 0.4 + high * 7
    look.x += x + high * 9
    look.z += z * 0.4 - high * 5
    // Keep him in the middle third as the camera lifts away for the village whole (a phone's narrow frame
    // also in the keep shot): aim between the set piece and him, at least half toward him.
    const toHim = portrait ? Math.max(hero, crane) * 0.55 : crane * 0.5
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
 * The builder's kit: a mallet in his right fist, a leather apron over his shirt, a tool belt with a
 * pouch. Each piece is placed around him in his rest pose (metres; y up, his front +z, arms out along
 * x) and then parented to the bone it rides on, as the block world's gear is.
 */
function makeGear(you, make) {
  const LEATHER = '#b5733a', DARK = '#7a4a26'
  const parts = [
    // The fist is at about x -0.7, y 1.26; its grip runs front to back.
    ['RightHand', b => b.box(0.04, 0.04, 0.56, -0.7, 1.24, 0.14, '#c98a4a', { ao: 0 }).box(0.13, 0.24, 0.14, -0.7, 1.14, 0.4, '#8f98a8', { ao: 0.2 }).box(0.14, 0.05, 0.15, -0.7, 1.235, 0.4, '#5b6372', { ao: 0 })],
    // The bib (torso: x ±0.2, y 0.98..1.36, z ±0.125).
    ['Spine01', b => b.box(0.3, 0.3, 0.03, 0, 1.03, 0.15, LEATHER, { ao: 0.15 }).box(0.12, 0.1, 0.035, 0, 1.12, 0.155, DARK, { ao: 0 }).box(0.04, 0.12, 0.03, -0.12, 1.32, 0.145, DARK, { ao: 0 }).box(0.04, 0.12, 0.03, 0.12, 1.32, 0.145, DARK, { ao: 0 })],
    // The belt, the apron's skirt, a pouch with a chisel in it.
    ['Hips', b => b.box(0.37, 0.055, 0.26, 0, 0.96, 0, DARK, { ao: 0 }).box(0.34, 0.24, 0.03, 0, 0.74, 0.15, LEATHER, { ao: 0.15 }).box(0.1, 0.13, 0.08, 0.17, 0.84, 0.09, DARK, { ao: 0 }).box(0.025, 0.12, 0.025, 0.17, 0.95, 0.09, '#c98a4a', { ao: 0 }).box(0.06, 0.05, 0.04, 0, 0.955, 0.16, '#ffc93a', { ao: 0 })],
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
