import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { loadTraveller, alohaLinear, sky, paintTexture } from './films/kit'

/*
 * Chapter Four, level 4: night ops. A night training exercise at a desert compound, under a closer,
 * lower third-person camera: through a gate into a floodlit yard of barriers and pop-down steel
 * targets, down a dark alley of containers (his night-vision flips down and the picture goes to
 * phosphor), out into a second yard under a watchtower and a radio mast, and up to a helicopter
 * waiting on its pad with its rotors turning. A drone keeps station ahead of him. It is also the level
 * that ends the game: at p = 1 it plays on the cinema's screen while the camera backs out into the
 * hall, and fades there as the epilogue rises. He carries a rifle (public/cinema/ops/rifle.glb) in both hands:
 * at low ready on the move, raised to each target in turn, a short burst as it drops. Everything else is built
 * in code: no models to load but the traveller and the rifle.
 *
 * CONTRACT (world.js, timeline.js and levels.js rely on it; do not change the export or its signature)
 *   export function createOps(renderer, { loader, normalize, mobile }) -> { scene, camera, update }
 *     loader: the shared GLTFLoader (Meshopt + Draco). normalize(root, size, yaw): a model's meshes as
 *     one centred group scaled to `size` metres. mobile: phone-sized screen, build lighter.
 *   update(state, t, aspect) is called once per rendered frame while this level is on screen.
 *     state.p         0..1, this level's own progress, driven by scroll (it scrubs both ways and can
 *                     jump; derive everything from p and t, keep no one-way state). The tech
 *                     transition resolves over p 0..0.14; p 0.14..1 is seen clear (levels.js CLEAR).
 *                     p stays at 1 through the back-out and the epilogue's fade: make p = 1 a composed
 *                     last shot that reads from the cinema's seats.
 *     state.still     reduced motion: no camera flourishes; the walk still follows p.
 *     state.portrait  the frame is a phone's (aspect < 0.85): frame for it. Decide framing from this,
 *                     not from `aspect`: on the cinema's screen `aspect` is the screen's 2.4, and a
 *                     phone sees only the middle of that picture.
 *     state.onScreen  true while the level is drawn onto the cinema's screen (the back-out and the
 *                     epilogue). The full-frame view at p = 1 and the on-screen one must match, or
 *                     the hand-over at the back-out jumps: same camera, no DOM-only or frame-locked HUD
 *                     that would vanish there (fade a HUD out as p nears 1).
 *     state.mobile    same as the option. state.cover: 0..1, how much a transition hides the frame.
 *     t               seconds, monotonic. aspect: width / height of what is being drawn; set
 *                     camera.aspect from it.
 *     Returns { here, dream, grade? }: here = a Vector3 at the traveller (world space); dream = 0..1
 *     extra bloom for a held, dreamy beat (0 otherwise); grade = optional overrides of this level's
 *     GRADE in levels.js ({ bloom, threshold, vignette, grain, scan }).
 *   Units: metres, y up, ground at y = 0, the traveller 1.72 m tall. The path runs along +x from x = 0;
 *   the camera sits on the +z side looking toward -z, so the set's "back" is -z. Camera: a
 *   PerspectiveCamera with a 40 degree vertical fov (the hall's lens, so leaving through the screen
 *   does not jump).
 *   Budget: the whole frame is about 5.6 ms on the desktop GPU today; keep this scene within that:
 *   at most ~150 draw calls and ~400k triangles in view (instance repeats), one shadow-casting light
 *   (2048 map, 1024 on mobile), textures at most 2048 px, no allocation or geometry rebuilds in update().
 *   world.prepare() builds this while the reader is paused in the level before, then compiles it and
 *   draws it once at p = 0 (and once into the cinema screen's target): anything hidden then
 *   (visible = false) is skipped and would compile mid-walk, so keep things that appear later in the
 *   scene, scaled to nothing, and add late-loading models to `scene` (prepare compiles again when the
 *   scene grows).
 */
const LENGTH = 42 // metres of path walked: he stops here, short of the pad
const PAD = [53, -1] // the helipad's centre (x, z)
const ALLEY = [17, 27] // the dark stretch between the containers, where his night-vision is down
const TOWER = [50, -15] // the watchtower, whose searchlight holds the helicopter
const MOON = new THREE.Vector3(0.75, 0.38, -0.55).normalize() // toward the moon: ahead and behind the set, low
// Pop-down steel targets beside the course: [x, z, yaw]. Each drops as he comes level with it.
const TARGETS = [[6.5, -4, -0.25], [10, -4.8, -0.2], [13.5, -3.6, -0.3], [19.6, -1.3, -0.1], [24, -1.3, -0.1], [30.5, -4.3, -0.25], [34, -5, -0.2], [37.5, -3.8, -0.3]]
// Shipping containers: [x, y, z, yaw, colour].
const BOXES = [
  [-3, 0, -10.5, 0.04, '#b5553f'], [3.4, 0, -10.6, -0.03, '#4f86b0'], [3.2, 2.59, -10.7, 0.06, '#aaa69a'], [9.9, 0, -10.4, 0, '#5f9a7a'], [16.4, 0, -10.8, 0.05, '#c79a45'], [16.2, 2.59, -10.6, -0.04, '#b5553f'],
  [19.1, 0, -3.4, 0, '#4f86b0'], [25.3, 0, -3.4, 0, '#b5553f'], [22, 2.59, -3.5, 0.03, '#5f9a7a'], [19.1, 0, 4.5, 0, '#aaa69a'], [25.3, 0, 4.5, 0, '#c79a45'], [19.4, 2.59, 4.6, -0.02, '#4f86b0'],
  [31, 0, -11, 0.1, '#aaa69a'], [37.5, 0, -11.5, -0.05, '#b5553f'], [43.6, 0, -12.6, 0.3, '#4f86b0'], [43.4, 2.59, -12.5, 0.36, '#c79a45'], [62, 0, -13, -0.4, '#5f9a7a'], [65, 0, 7, 1.3, '#b5553f'],
]
// Concrete barriers: [x, z, yaw]. The rows make two chicanes the path weaves through.
const BARRIERS = [[4.6, -1.7, 0.03], [6.7, -1.7, -0.02], [8.8, -1.7, 0.04], [10.6, 1.7, 0], [12.7, 1.7, -0.04], [29.4, -1.7, 0.02], [31.5, -1.7, -0.03], [34.9, 1.7, 0.03], [37, 1.7, 0], [1.5, -6.5, 0.3], [13.5, -8.2, 1.2], [45.4, -6.4, 0.9], [46.4, 4.8, -0.5]]

const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const lerp = THREE.MathUtils.lerp
const SHOT = 2.5 // metres short of a target where he fires on it: its plate starts down 0.1 m later
const BLADE = 0.3 // his chest turned this far right of where the rifle points: the left shoulder forward, to reach the handguard
/**
 * Each hand on the rifle, in its own space (+z the barrel, +y its top, +x its left): [side, where the palm
 * meets it, the fingers' direction, the palm's facing, the elbow's pull (to his left, down)]. The right hand
 * wraps the pistol grip from its right side; the left clamps the handguard's left side, thumb over the top,
 * behind the vertical grip (his hands have no finger bones, so a flat palm along a side reads best).
 */
const HOLD = [
  ['Right', new THREE.Vector3(0, 0.0, -0.005), new THREE.Vector3(0.3, -0.32, 0.9), new THREE.Vector3(1, 0, -0.2), -0.6, -0.8],
  ['Left', new THREE.Vector3(0.028, 0.1, 0.37), new THREE.Vector3(-0.15, 0.2, 0.95), new THREE.Vector3(-1, 0.25, 0), 0.35, -0.9],
]
const TAU = Math.PI * 2
const MONO = px => `600 ${px}px "Geist Mono Variable", ui-monospace, Consolas, Menlo, monospace`
const _m = new THREE.Matrix4(), _e = new THREE.Euler(), _yxz = new THREE.Euler(0, 0, 0, 'YXZ'), _c = new THREE.Color(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3()
const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0)
let seed = 11
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

/** The weave through the two chicanes: his z at x. */
const pathZ = x => 0.8 * (Math.sin(((x - 3) * Math.PI) / 6) * ss(2, 5, x) * (1 - ss(13.5, 16, x)) + Math.sin(((x - 28) * Math.PI) / 6) * ss(27.5, 30, x) * (1 - ss(38, 41, x)))

/** A part of a merged set piece: turned, placed and painted (one colour per part; k above 1 glows). */
function part(geo, color = '#ffffff', x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, k = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
  g.applyMatrix4(_m.makeRotationFromEuler(_e.set(rx, ry, rz)).setPosition(x, y, z))
  _c.set(color).multiplyScalar(k)
  const n = g.attributes.position.count, a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n)
/** A square bar from a to b. */
function strut(a, b, t, color, k = 1) {
  const len = _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).length()
  const g = part(box(t, len, t), color, 0, 0, 0, 0, 0, 0, k)
  _q.setFromUnitVectors(UP, _v.normalize())
  return g.applyMatrix4(_m.makeRotationFromQuaternion(_q).setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2))
}
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A skin over cross-sections [x, centre y, half width, half height, squareness], nose first: a fuselage. */
function loft(secs, rings = 44, sides = 24) {
  const cat = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t)
  const at = j => secs[Math.max(0, Math.min(secs.length - 1, j))]
  const pos = [], uv = [], idx = [], x0 = secs[0][0], x1 = secs[secs.length - 1][0]
  for (let i = 0; i <= rings; i++) {
    const s = (i / rings) * (secs.length - 1), k = Math.min(secs.length - 2, Math.floor(s)), t = s - k
    const [x, cy, w, h, n] = [0, 1, 2, 3, 4].map(c => cat(at(k - 1)[c], at(k)[c], at(k + 1)[c], at(k + 2)[c], t))
    for (let j = 0; j <= sides; j++) {
      const th = (j / sides) * TAU, c = Math.cos(th), sn = Math.sin(th), e = 2 / n
      pos.push(x, cy + Math.max(0.01, h) * Math.sign(c) * Math.abs(c) ** e, Math.max(0.01, w) * Math.sign(sn) * Math.abs(sn) ** e)
      uv.push((x - x0) / (x1 - x0), 1 - j / sides)
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** One steel box, corrugated on its long sides and one end, doors on the other: instanced for every container. */
function containerGeometry() {
  const L = 6.06, H = 2.59, W = 2.44, parts = []
  const corrugated = (w, n) => {
    const g = new THREE.PlaneGeometry(w, H - 0.24, n, 1), pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) if ((i % (n + 1)) % 4 >= 2) pos.setZ(i, -0.045)
    const flat = g.toNonIndexed()
    flat.computeVertexNormals()
    return flat
  }
  // The frame, roof and door gear sample a plain patch of the grime map, not its stencils.
  const plain = g => { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, 0.03 + u.getX(i) * 0.05, 0.3 + u.getY(i) * 0.25); return g }
  parts.push(part(corrugated(L - 0.2, 84), '#fff', 0, H / 2, W / 2 - 0.02), part(corrugated(L - 0.2, 84), '#fff', 0, H / 2, -W / 2 + 0.02, Math.PI))
  parts.push(part(corrugated(W - 0.2, 32), '#fff', -L / 2 + 0.02, H / 2, 0, -Math.PI / 2), part(plain(new THREE.PlaneGeometry(W - 0.2, H - 0.24)), '#fff', L / 2 - 0.03, H / 2, 0, Math.PI / 2))
  parts.push(part(plain(new THREE.PlaneGeometry(L - 0.1, W - 0.1)), '#fff', 0, H - 0.03, 0, 0, -Math.PI / 2))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(part(plain(box(0.14, H, 0.14)), '#fff', sx * (L / 2 - 0.07), H / 2, sz * (W / 2 - 0.07)))
  for (const y of [0.06, H - 0.06]) for (const s of [-1, 1]) parts.push(part(plain(box(L, 0.12, 0.12)), '#fff', 0, y, s * (W / 2 - 0.06)), part(plain(box(0.12, 0.12, W)), '#fff', s * (L / 2 - 0.06), y, 0))
  for (const z of [-0.85, -0.3, 0.3, 0.85]) parts.push(part(plain(cyl(0.02, 0.02, H - 0.3, 6)), '#fff', L / 2, H / 2, z), part(plain(box(0.03, 0.05, 0.3)), '#fff', L / 2 + 0.01, 1.15, z + 0.08))
  return mergeGeometries(parts)
}

export function createOps(renderer, { loader, mobile = false }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 700)
  scene.add(camera)
  // The set goes up a piece at a time, as the village's does: each step is a few milliseconds between
  // frames, so building it while the reader is paused never holds a frame long. Until it is whole the
  // level only places its camera (world.js holds the cover over it and compiles it once it is built).
  let run = null
  const held = { here: new THREE.Vector3(0, 0.9, 0), dream: 0 }
  const hold = aspect => {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    camera.position.set(-4.1, 1.62, 2.5)
    camera.lookAt(6, 1.3, -0.9)
    return held
  }
  ;(async () => {
    let t0 = performance.now()
    const step = async () => {
      if (performance.now() - t0 < 4) return
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }
    scene.fog = new THREE.Fog('#1a2a44', 45, 210)
    const dome = sky({ top: '#03060e', mid: '#0c1a33', low: '#1e3050', sunDir: new THREE.Vector3(0.75, 0.3, -0.55), sun: '#dfe9ff' })
    scene.add(dome)
    const uTime = { value: 0 }
    // The set is merged by material: painted steel and concrete, things that glow, light cones, lamp glows.
    const paint = [], lit = [], cones = [], glows = []
    const put = (parts, x, z, ry = 0, into = paint) => { _m.makeRotationY(ry).setPosition(x, 0, z); for (const g of parts) into.push(g.applyMatrix4(_m)) }
    /** A lamp's glow, or a mote of dust: [x, y, z], colour, radius in metres, brightness, blink (rate, share lit, phase), drift. */
    const glow = (list, at, color, size, k, rate = 0, duty = 1, phase = 0, drift = 0) => list.push([at[0], at[1], at[2], color, size, k, rate, duty, phase, drift])
    /** A cone of lit haze from a lamp to where it points. */
    const cone = (list, from, to, spread, color, k) => {
      const len = _w.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]).length()
      const g = part(new THREE.ConeGeometry(len * spread, len, 28, 1, true).translate(0, -len / 2, 0), color, 0, 0, 0, 0, 0, 0, k)
      _q.setFromUnitVectors(DOWN, _w.normalize())
      list.push(g.applyMatrix4(_m.makeRotationFromQuaternion(_q).setPosition(from[0], from[1], from[2])))
    }
    /** Dust hanging in a lamp's cone. */
    const dust = (list, from, to, spread, n, color) => {
      const d = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]), len = d.length()
      const a = new THREE.Vector3().crossVectors(d.normalize(), UP).normalize(), b = new THREE.Vector3().crossVectors(d, a)
      for (let i = 0; i < n; i++) {
        const t = 0.18 + 0.8 * rnd(), ang = rnd() * TAU, r = t * len * spread * 0.85 * Math.sqrt(rnd())
        _v.set(from[0], from[1], from[2]).addScaledVector(d, t * len).addScaledVector(a, Math.cos(ang) * r).addScaledVector(b, Math.sin(ang) * r)
        if (_v.y > 0.1) glow(list, [_v.x, _v.y, _v.z], color, 0.018 + 0.03 * rnd(), 0.75 * (1 - 0.6 * t), 0, 1, rnd(), 0.4)
      }
    }

    // ------------------------------------------------------------ ground
    const sand = paintTexture('#a8977a', ['#c2b08c', '#8a7a62', '#d0bf9c', '#75684f'], { count: 420, seed: 7 })
    sand.repeat.set(40, 26)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }))
    ground.position.x = 30
    ground.receiveShadow = true
    // The course and the pad's apron: concrete slabs, 4 m to a joint.
    const slab = paintTexture('#8f8b82', ['#96918a', '#89847b', '#8d897f'], { count: 200, seed: 3 }) // grey concrete, a little sand-washed, gently mottled
    const sg = slab.image.getContext('2d')
    sg.strokeStyle = 'rgba(40,40,36,0.6)'
    sg.lineWidth = 4
    sg.strokeRect(0, 0, 512, 512)
    slab.repeat.set(18.5, 4)
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(74, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: slab, roughness: 0.92 }))
    apron.position.set(25, 0.012, -1)
    apron.receiveShadow = true
    const padTex = canvasTexture(512, 512, g => {
      g.fillStyle = '#8d9093'
      g.fillRect(0, 0, 512, 512)
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '40,42,44' : '190,190,186'},${0.03 + rnd() * 0.05})`; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 8 + rnd() * 40, 0, TAU); g.fill() }
      g.lineWidth = 12
      g.strokeStyle = '#e2b64a'
      g.beginPath(); g.arc(256, 256, 190, 0, TAU); g.stroke()
      g.setLineDash([26, 18])
      g.lineWidth = 6
      g.strokeStyle = '#e8e6de'
      g.beginPath(); g.arc(256, 256, 236, 0, TAU); g.stroke()
      g.fillStyle = '#e8e6de'
      g.fillRect(196, 176, 26, 160); g.fillRect(290, 176, 26, 160); g.fillRect(196, 243, 120, 26)
    })
    const pad = new THREE.Mesh(new THREE.CircleGeometry(6.6, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.9 }))
    pad.position.set(PAD[0], 0.024, PAD[1])
    pad.receiveShadow = true
    scene.add(ground, apron, pad)
    // Painted lane edges down the course, and a stop bar before the pad.
    for (let x = 0; x < 44; x += 4) for (const z of [-2.7, 2.7]) paint.push(part(new THREE.PlaneGeometry(2, 0.14), '#d8b24a', x + 1, 0.03, z, 0, -Math.PI / 2))
    paint.push(part(new THREE.PlaneGeometry(0.35, 5.4), '#e4e2d8', 44.6, 0.03, 0, 0, -Math.PI / 2))

    await step()

    // ------------------------------------------------------------ containers, barriers, sandbags, drums, cones, tyres, crates
    const instanced = (geo, mat, list) => {
      const m = new THREE.InstancedMesh(geo, mat, list.length)
      list.forEach(([x, y, z, ry = 0, color = '#ffffff', sx = 1, sy = sx, sz = sx], i) => {
        m.setMatrixAt(i, _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _w.set(sx, sy, sz)))
        m.setColorAt(i, _c.set(color))
      })
      m.castShadow = m.receiveShadow = true
      scene.add(m)
      return m
    }
    const grime = canvasTexture(512, 256, (g, w, h) => {
      g.fillStyle = '#a9a7a2'
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 150; i++) { g.fillStyle = `rgba(52,40,30,${0.04 + rnd() * 0.1})`; g.fillRect(rnd() * w, 0, 1 + rnd() * 5, 30 + rnd() * 220) }
      const dirt = g.createLinearGradient(0, h - 70, 0, h)
      dirt.addColorStop(0, 'rgba(60,50,38,0)')
      dirt.addColorStop(1, 'rgba(60,50,38,0.6)')
      g.fillStyle = dirt
      g.fillRect(0, h - 70, w, 70)
      g.fillStyle = 'rgba(255,255,255,0.9)'
      g.font = MONO(30)
      g.fillText('NS-04', 384, 46)
      g.font = MONO(13)
      g.fillText('RANGE STORES', 384, 68)
      g.fillRect(384, 80, 46, 30)
    })
    instanced(containerGeometry(), new THREE.MeshStandardMaterial({ map: grime, roughness: 0.7, metalness: 0.25 }), BOXES)
    const barrier = new THREE.Shape([[-0.3, 0], [0.3, 0], [0.3, 0.08], [0.15, 0.33], [0.09, 0.81], [-0.09, 0.81], [-0.15, 0.33], [-0.3, 0.08]].map(([x, y]) => new THREE.Vector2(x, y)))
    const concrete = paintTexture('#b9b8b2', ['#d0cfc8', '#8f8e88', '#77736c'], { size: 256, count: 120, seed: 5 })
    instanced(new THREE.ExtrudeGeometry(barrier, { depth: 2, bevelEnabled: false }).translate(0, 0, -1).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95 }), BARRIERS.map(([x, z, ry], i) => [x, 0, z, ry, i % 3 ? '#ffffff' : '#e6dcc4']))
    const bags = []
    for (const [cx, cz, ry, n, courses] of [[12, -7.2, 0.15, 8, 5], [35.5, -7.6, -0.1, 8, 5], [41.6, -6.2, 1.1, 6, 4]])
      for (let c = 0; c < courses; c++) for (let i = 0; i < n - (c % 2); i++) {
        const off = (i - (n - 1) / 2 + (c % 2) * 0.5) * 0.63
        bags.push([cx + Math.cos(ry) * off, 0.09 + c * 0.155, cz - Math.sin(ry) * off, ry + (rnd() - 0.5) * 0.14, ['#c9b78d', '#b8a67c', '#d4c49c'][Math.floor(rnd() * 3)]])
      }
    const cloth = new THREE.MeshStandardMaterial({ roughness: 1 })
    instanced(new THREE.SphereGeometry(0.5, 10, 6).scale(0.66, 0.2, 0.36), cloth, bags)
    const drumShape = [[0, 0], [0.28, 0], [0.29, 0.02], [0.29, 0.28], [0.305, 0.3], [0.29, 0.32], [0.29, 0.58], [0.305, 0.6], [0.29, 0.62], [0.29, 0.86], [0.28, 0.88], [0, 0.88]].map(([r, y]) => new THREE.Vector2(r, y))
    const steel = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.35 })
    instanced(new THREE.LatheGeometry(drumShape, 14), steel, [[2.5, -5.5, '#4f7fb0'], [3.2, -5.3, '#b5553f'], [2.9, -6.1, '#4f7fb0'], [15.3, -6.2, '#7f8a5e'], [15.9, -6.6, '#c8a23a'], [28.6, -6.4, '#b5553f'], [29.2, -6, '#4f7fb0'], [28.8, -7, '#7f8a5e'], [40.4, -8.4, '#c8a23a'], [41, -8.8, '#4f7fb0']].map(([x, z, c]) => [x, 0, z, rnd() * 6, c]))
    // Traffic cones along the chicanes and the pad's edge: a white band on orange, and a faint glow of their own so they read in the dark.
    const coneShape = new THREE.LatheGeometry([[0.2, 0], [0.2, 0.03], [0.13, 0.04], [0.035, 0.52], [0, 0.53]].map(([r, y]) => new THREE.Vector2(r, y)), 12)
    {
      const pos = coneShape.attributes.position, a = new Float32Array(pos.count * 3)
      for (let i = 0; i < pos.count; i++) { const band = pos.getY(i) > 0.22 && pos.getY(i) < 0.36; a.set(band ? [1, 1, 0.95] : [1, 0.36, 0.1], i * 3) }
      coneShape.setAttribute('color', new THREE.BufferAttribute(a, 3))
    }
    instanced(coneShape, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, emissive: '#ff5a1a', emissiveIntensity: 0.12 }), [[3.4, 2.6], [9.6, 2.5], [14.4, -2.5], [15.6, 2.6], [28.2, 2.4], [33.4, 2.5], [39.6, -2.6], [44.2, -3.2], [44.4, 3.2], [46.6, -6.2], [47.2, 5.2], [20.6, 1.9], [23.4, 1.95]].map(([x, z]) => [x, 0, z]))
    const tyres = []
    for (const [x, z, n] of [[9.5, -6.8, 4], [10.4, -6.6, 3], [32.6, -9, 4], [33.5, -9.2, 2], [27.6, 2.9, 3]]) for (let k = 0; k < n; k++) tyres.push([x + (rnd() - 0.5) * 0.08, 0.13 + k * 0.25, z + (rnd() - 0.5) * 0.08, rnd() * 6, '#565b63'])
    instanced(new THREE.TorusGeometry(0.33, 0.13, 8, 16).rotateX(Math.PI / 2), cloth, tyres)
    const planks = canvasTexture(128, 128, g => {
      g.fillStyle = '#b9b3a2'
      g.fillRect(0, 0, 128, 128)
      g.fillStyle = 'rgba(40,34,24,0.5)'
      for (let y = 0; y < 128; y += 21) g.fillRect(0, y, 128, 2)
      g.strokeStyle = 'rgba(40,34,24,0.7)'
      g.lineWidth = 9
      g.strokeRect(4, 4, 120, 120)
      g.beginPath(); g.moveTo(8, 8); g.lineTo(120, 120); g.stroke()
    })
    instanced(box(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ map: planks, roughness: 0.9 }), [[0.5, 0, -6.6, 0.2, '#8f9670', 1.2, 0.9, 0.9], [0.6, 0.9, -6.5, -0.1, '#b89a6a', 0.8, 0.7, 0.8], [14.2, 0, -7.7, 0.5, '#b89a6a', 1.1, 0.8, 1.1], [39.3, 0, -8.6, -0.2, '#8f9670', 1.4, 1, 1], [39.4, 1, -8.5, 0.15, '#8f9670', 1, 0.7, 0.9], [26.4, 0, 3, 0.3, '#b89a6a', 0.9, 0.9, 0.9], [57.5, 0, -8, 0.6, '#8f9670', 1.3, 1, 1.1], [59, 0, -7.4, -0.3, '#b89a6a', 1, 0.8, 1]])

    await step()

    // ------------------------------------------------------------ set pieces, merged
    const DARK = '#565c64', STEEL = '#9aa0a8', YEL = '#d1aa3e', OLIVE = '#858c68', RED = '#c24a36', WHITE = '#e2e0d6'
    const WARM = '#ffe6bd'
    /** A towed light tower: a generator trailer, a telescoping mast and four lamps. Returns its lamp head. */
    const lightTower = (x, z, ax, az) => {
      const ry = Math.atan2(ax - x, az - z), P = [], G = []
      P.push(part(box(1.7, 0.85, 1.05), YEL, 0, 0.87, 0), part(box(1.5, 0.08, 1.2), DARK, 0, 0.42, 0), part(box(0.08, 0.08, 1.3), DARK, 0, 0.42, -1.1), part(box(0.5, 0.3, 0.04), DARK, 0.4, 0.95, 0.54))
      for (const s of [-1, 1]) {
        P.push(part(cyl(0.3, 0.3, 0.2, 14), '#3a3d44', s * 0.86, 0.3, 0.1, 0, 0, Math.PI / 2))
        for (const f of [-1, 1]) P.push(strut([s * 0.8, 0.45, f * 0.5], [s * 1.5, 0.03, f * 0.95], 0.06, DARK))
      }
      P.push(part(cyl(0.07, 0.085, 3, 8), STEEL, 0, 2.75, 0), part(cyl(0.055, 0.055, 2.6, 8), STEEL, 0, 5.4, 0), part(cyl(0.04, 0.04, 1.4, 8), STEEL, 0, 7.1, 0), part(box(1.9, 0.07, 0.07), DARK, 0, 7.6, 0))
      for (const lx of [-0.72, -0.24, 0.24, 0.72]) {
        P.push(part(box(0.4, 0.3, 0.14), DARK, lx, 7.6, 0.08, 0, 0.6))
        G.push(part(new THREE.PlaneGeometry(0.34, 0.24), WARM, lx, 7.556, 0.146, 0, 0.6, 0, 9))
      }
      put(P, x, z, ry)
      put(G, x, z, ry, lit)
      const head = [x + Math.sin(ry) * 0.2, 7.55, z + Math.cos(ry) * 0.2], to = [ax, 0, az]
      glow(glows, head, WARM, 2.4, 1.5)
      cone(cones, head, to, 0.62, WARM, 0.5)
      dust(glows, head, to, 0.62, mobile ? 130 : 300, WARM)
      return head
    }
    const headA = lightTower(7, -6.6, 9, -0.6), headB = lightTower(33, -7, 36, -0.8)

    await step()

    // The gate he came in by: a hut with a lit window and a raised boom.
    {
      const P = [part(box(2.4, 2.4, 2.4), OLIVE, -1, 1.2, -5.6), part(box(2.9, 0.12, 2.9), DARK, -1, 2.46, -5.6), part(box(0.24, 1.1, 0.24), YEL, 1, 0.55, -3.3), part(box(0.24, 1.1, 0.24), YEL, 1, 0.55, 3.3)]
      for (let k = 0; k < 6; k++) P.push(strut([1, 1 + k * 0.92, -3.3 + k * 0.33], [1, 1 + (k + 1) * 0.92, -3.3 + (k + 1) * 0.33], 0.1, k % 2 ? WHITE : RED))
      paint.push(...P)
      lit.push(part(new THREE.PlaneGeometry(1.1, 0.8), '#ffcf8a', -1, 1.6, -4.39, 0, 0, 0, 1.6), part(new THREE.PlaneGeometry(0.8, 0.7), '#ffcf8a', 0.21, 1.6, -5.6, Math.PI / 2, 0, 0, 1.6))
      glow(glows, [1, 1.15, -3.3], '#ff3a2a', 0.5, 1.2, 0.8, 0.5)
    }

    // Steel targets: a stand each (the plates are instanced, so they can fall), and its status lamp.
    for (const [x, z, ry] of TARGETS) put([part(box(0.6, 0.04, 0.45), DARK, 0, 0.02, 0), part(box(0.045, 0.6, 0.045), DARK, -0.22, 0.32, 0), part(box(0.045, 0.6, 0.045), DARK, 0.22, 0.32, 0), part(cyl(0.022, 0.022, 0.52, 8), STEEL, 0, 0.62, 0, 0, 0, Math.PI / 2)], x, z, ry)
    const plateTex = canvasTexture(128, 128, g => {
      g.fillStyle = '#eceae2'
      g.fillRect(0, 0, 128, 128)
      g.strokeStyle = '#3a3d42'
      g.lineWidth = 3
      g.beginPath(); g.arc(64, 64, 40, 0, TAU); g.stroke()
      g.fillStyle = '#ff6a1e'
      g.beginPath(); g.arc(64, 64, 19, 0, TAU); g.fill()
    })
    const plates = new THREE.InstancedMesh(cyl(0.28, 0.28, 0.022, 24).rotateX(Math.PI / 2).translate(0, 0.33, 0), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5, metalness: 0.4 }), TARGETS.length)
    plates.castShadow = true
    const leds = new THREE.InstancedMesh(box(0.07, 0.07, 0.07), new THREE.MeshBasicMaterial({ fog: false }), TARGETS.length)
    const AMBER = new THREE.Color(3, 1.4, 0.2), GREEN = new THREE.Color(0.3, 3, 0.8)
    TARGETS.forEach(([x, z, ry], i) => {
      leds.setMatrixAt(i, _m.makeTranslation(x + Math.cos(ry) * 0.22, 0.68, z - Math.sin(ry) * 0.22))
      leds.setColorAt(i, AMBER)
    })
    plates.frustumCulled = leds.frustumCulled = false // the plates move
    scene.add(plates, leds)
    const fallen = TARGETS.map(() => -1)

    await step()

    // The watchtower: a braced steel frame, a cabin with a lit window band, and a searchlight held on the pad.
    const searchHead = [TOWER[0] + 1.2, 9.5, TOWER[1] + 1.5]
    {
      const P = [], leg = (sx, sz) => [[sx * 1.6, 0, sz * 1.6], [sx * 1.2, 6, sz * 1.2]]
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(strut(...leg(sx, sz), 0.16, STEEL))
      for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
        const at = ([sx, sz], y) => { const k = 1.6 - (0.4 * y) / 6; return [sx * k, y, sz * k] }
        for (const [y0, y1] of [[0.2, 3], [3, 5.9]]) P.push(strut(at(a, y0), at(b, y1), 0.07, STEEL), strut(at(b, y0), at(a, y1), 0.07, STEEL), strut(at(a, y1), at(b, y1), 0.08, STEEL))
      }
      P.push(part(box(3.4, 0.14, 3.4), DARK, 0, 6.07, 0), part(box(2.8, 0.95, 2.8), OLIVE, 0, 6.6, 0), part(new THREE.ConeGeometry(2.5, 0.8, 4), DARK, 0, 9, 0, Math.PI / 4))
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(part(box(0.1, 1.55, 0.1), DARK, sx * 1.35, 7.85, sz * 1.35), strut([sx * 1.65, 6.14, sz * 1.65], [sx * 1.65, 7.1, sz * 1.65], 0.05, STEEL))
      for (const s of [-1, 1]) P.push(strut([-1.65, 7.1, s * 1.65], [1.65, 7.1, s * 1.65], 0.05, STEEL), strut([s * 1.65, 7.1, -1.65], [s * 1.65, 7.1, 1.65], 0.05, STEEL), strut([s * 0.25, 0, 1.75], [s * 0.25, 6.1, 1.42], 0.05, STEEL))
      for (let y = 0.4; y < 6; y += 0.4) P.push(strut([-0.25, y, 1.75 - y * 0.054], [0.25, y, 1.75 - y * 0.054], 0.035, STEEL))
      P.push(part(cyl(0.2, 0.26, 0.4, 12), DARK, 1.2, 9.5, 1.5, 0, 1.1))
      put(P, TOWER[0], TOWER[1])
      put([part(box(2.6, 0.75, 2.6), '#ffc27a', 0, 7.5, 0, 0, 0, 0, 0.9)], TOWER[0], TOWER[1], 0, lit)
      glow(glows, searchHead, '#eaf2ff', 1.9, 1.6)
      cone(cones, searchHead, [PAD[0], 0.5, PAD[1]], 0.2, '#dfeaff', 0.42)
      dust(glows, searchHead, [PAD[0], 0.5, PAD[1]], 0.2, mobile ? 70 : 160, '#eaf2ff')
    }

    await step()

    // The radio mast: a lattice in red and white bands, guyed, with a blinking light at its head.
    const MAST = [72, -20]
    {
      const P = [], R = 0.55, corner = k => [Math.sin((k * TAU) / 3) * R, Math.cos((k * TAU) / 3) * R]
      for (let bay = 0; bay < 17; bay++) {
        const y0 = bay * 2, y1 = y0 + 2, c = Math.floor(bay / 2) % 2 ? WHITE : RED
        for (let k = 0; k < 3; k++) {
          const [ax, az] = corner(k), [bx, bz] = corner(k + 1)
          P.push(strut([ax, y0, az], [ax, y1, az], 0.09, c), strut([ax, y0, az], [bx, y1, bz], 0.05, c), strut([ax, y1, az], [bx, y1, bz], 0.05, c))
        }
      }
      P.push(part(cyl(0.5, 0.5, 0.3, 14), WHITE, 0.75, 27, 0, 0, 0, Math.PI / 2), part(cyl(0.4, 0.4, 0.25, 14), WHITE, -0.4, 24.5, 0.6, 0, Math.PI / 2), part(box(0.25, 1.6, 0.12), WHITE, 0.5, 30.5, 0.5), part(cyl(0.03, 0.03, 3, 6), STEEL, 0, 35.5, 0))
      put(P, MAST[0], MAST[1])
      glow(glows, [MAST[0], 34.3, MAST[1]], '#ff2a1c', 1.5, 2.2, 0.55, 0.45)
      glow(glows, [MAST[0], 22.3, MAST[1] + 0.6], '#ff2a1c', 0.9, 1.4)
      glow(glows, [MAST[0], 11.3, MAST[1] + 0.6], '#ff2a1c', 0.9, 1.4)
      const wires = []
      for (let k = 0; k < 3; k++) for (const h of [16, 30]) wires.push(MAST[0] + Math.sin((k * TAU) / 3 + 0.5) * 15, 0, MAST[1] + Math.cos((k * TAU) / 3 + 0.5) * 15, MAST[0], h, MAST[1])
      scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(wires, 3)), new THREE.LineBasicMaterial({ color: '#56657c' })))
    }

    await step()

    // Far back: hangars with a lamp over each door, a low control building, the perimeter fence.
    for (const [x, z, open] of [[8, -47, 0], [40, -49, 1], [76, -45, 0]]) {
      const P = [part(new THREE.CylinderGeometry(9, 9, 26, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), '#727b88'), part(new THREE.CircleGeometry(9, 20, 0, Math.PI), '#666e7a', 0, 0, 13), part(new THREE.PlaneGeometry(10, 5.6), '#444a54', 0, 2.8, 13.03)]
      put(P, x, z)
      if (open) put([part(new THREE.PlaneGeometry(1.4, 5.3), '#ffbf78', -2.2, 2.65, 13.06, 0, 0, 0, 1.3)], x, z, 0, lit)
      glow(glows, [x, 6.6, z + 13.4], WARM, 1.6, 1.1)
    }
    put([part(box(12, 4.2, 7), '#857c6e', 0, 2.1, 0), part(box(2, 1, 1.6), DARK, -3, 4.7, 0), part(cyl(0.03, 0.03, 4, 6), STEEL, 4, 6.2, 1)], 25, -33)
    put([-4, -1.5, 1, 3.5].map(wx => part(new THREE.PlaneGeometry(1.3, 0.9), '#ffd08c', wx, 2.6, 3.52, 0, 0, 0, 1.4)), 25, -33, 0, lit)
    for (let x = -24; x <= 86; x += 3.5) paint.push(part(cyl(0.04, 0.04, 2.7, 6), STEEL, x, 1.35, -23))
    paint.push(part(box(110, 0.05, 0.05), STEEL, 31, 2.55, -23))
    const link = canvasTexture(64, 64, g => {
      g.strokeStyle = 'rgba(190,200,214,0.95)'
      g.lineWidth = 3
      for (const [a, b, c, d] of [[0, 0, 64, 64], [64, 0, 0, 64], [-32, 0, 32, 64], [32, 0, 96, 64], [96, 0, 32, 64], [32, 0, -32, 64]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke() }
    })
    link.wrapS = link.wrapT = THREE.RepeatWrapping
    link.repeat.set(360, 8)
    const fence = new THREE.Mesh(new THREE.PlaneGeometry(110, 2.4), new THREE.MeshStandardMaterial({ map: link, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 }))
    fence.position.set(31, 1.3, -23)
    scene.add(fence)
    // A windsock by the pad, standing out in the rotor wash.
    put([part(cyl(0.05, 0.06, 5, 8), WHITE, 0, 2.5, 0), ...[0, 1, 2, 3].map(k => part(cyl(0.3 - k * 0.055, 0.245 - k * 0.055, 0.5, 10), k % 2 ? WHITE : '#ff6a1e', 0.3 + k * 0.5, 4.85 - k * 0.05, 0, 0, 0, -Math.PI / 2 - 0.1))], 46.4, -8.8, 2.4)
    // The pad's edge lights.
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU, at = [PAD[0] + Math.cos(a) * 6.9, 0.14, PAD[1] + Math.sin(a) * 6.9]
      paint.push(part(cyl(0.07, 0.09, 0.14, 8), DARK, at[0], 0.07, at[2]))
      glow(glows, at, '#4dffb0', 0.42, 1.3)
    }

    await step()

    // Distant mesas on the horizon, and the stars.
    {
      const pos = [], idx = [], N = 120
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * TAU, h = 7 + 9 * (0.5 + 0.5 * Math.sin(a * 5 + 1)) * (0.5 + 0.5 * Math.sin(a * 2.3)) + 5 * Math.max(0, Math.sin(a * 9.1)) ** 3 + 2 * Math.sin(a * 23)
        pos.push(Math.cos(a) * 175, -2, Math.sin(a) * 175, Math.cos(a) * 175, Math.max(1.5, h), Math.sin(a) * 175)
        if (i < N) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
      }
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setIndex(idx)
      const mesas = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#0c1626', fog: false, side: THREE.DoubleSide }))
      mesas.position.x = 25
      scene.add(mesas)
    }
    const stars = (() => {
      const n = mobile ? 350 : 800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, y = 0.05 + rnd() * 0.95, r = Math.sqrt(1 - y * y), b = 0.25 + rnd() ** 3 * 1.4
        pos.set([Math.cos(a) * r * 190, y * 190, Math.sin(a) * r * 190], i * 3)
        col.set([b * (0.85 + rnd() * 0.15), b * 0.92, b], i * 3)
      }
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)).setAttribute('color', new THREE.BufferAttribute(col, 3))
      return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }))
    })()
    stars.frustumCulled = false
    scene.add(stars)

    await step()

    // ------------------------------------------------------------ materials for the merged set
    const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 })
    const litMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })
    const coneMat = new THREE.ShaderMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vAlong; varying vec3 vColor; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; vAlong = 1.0 - uv.y; vColor = color; gl_Position = projectionMatrix * mv; }',
      // Brightest looking through the cone's middle and near the lamp; nothing at its rim or its base.
      // Keep the clamp: at an edge the varying can leave 0..1, pow() of a negative is NaN, and bloom spreads one NaN into a black frame.
      fragmentShader: 'varying vec3 vN; varying vec3 vV; varying float vAlong; varying vec3 vColor; void main() { float f = abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(vColor * f * f * pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.4) * smoothstep(0.0, 0.06, vAlong), 1.0); }',
    })
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aPos; attribute vec3 aColor; attribute vec4 aPar; attribute float aDrift; // aPar: radius, blink rate, share lit, phase
        uniform float uTime; varying vec2 vUv; varying vec3 vColor;
        void main() {
          float ph = aPar.w * 6.2831;
          vec3 p = aPos + aDrift * vec3(sin(uTime * 0.21 + ph * 3.0), sin(uTime * 0.17 + ph * 5.0) * 0.6, cos(uTime * 0.19 + ph * 7.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          mv.xy += position.xy * aPar.x;
          gl_Position = projectionMatrix * mv;
          vColor = aColor * (aPar.y > 0.0 ? step(fract(uTime * aPar.y + aPar.w), aPar.z) : 1.0);
          vUv = position.xy;
        }`,
      fragmentShader: 'varying vec2 vUv; varying vec3 vColor; void main() { float r2 = dot(vUv, vUv); gl_FragColor = vec4(vColor * (exp(-r2 * 14.0) + 0.22 * exp(-r2 * 3.0)) * (1.0 - smoothstep(0.6, 1.0, r2)), 1.0); }',
    })
    /** Camera-facing glows drawn in one call. */
    const glowMesh = list => {
      const n = list.length, g = new THREE.InstancedBufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
      g.setIndex([0, 1, 2, 0, 2, 3])
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), par = new Float32Array(n * 4), dr = new Float32Array(n)
      list.forEach(([x, y, z, color, size, k, rate, duty, phase, drift], i) => {
        pos.set([x, y, z], i * 3)
        _c.set(color).multiplyScalar(k)
        col.set([_c.r, _c.g, _c.b], i * 3)
        par.set([size, rate, duty, phase], i * 4)
        dr[i] = drift
      })
      g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3)).setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3)).setAttribute('aPar', new THREE.InstancedBufferAttribute(par, 4)).setAttribute('aDrift', new THREE.InstancedBufferAttribute(dr, 1))
      g.instanceCount = n
      const m = new THREE.Mesh(g, glowMat)
      m.frustumCulled = false
      return m
    }
    const merged = (list, mat, shadow = false) => {
      const m = new THREE.Mesh(mergeGeometries(list), mat)
      m.castShadow = m.receiveShadow = shadow
      return m
    }

    await step()

    // ------------------------------------------------------------ the helicopter
    // An original light utility helicopter: nose along its own +x. Slate grey with an orange cheat line.
    const heli = new THREE.Group()
    const rotor = new THREE.Group(), tail = new THREE.Group()
    {
      const X0 = 4.6, SPAN = 12.6
      const livery = (w, h, glass, base) => canvasTexture(w, h, g => {
        const px = x => ((X0 - x) / SPAN) * w, py = d => (d / 360) * h
        // The same shape on both flanks: degrees run from the spine (0) down the right flank to the keel (180).
        const band = (xa, xb, da, db, r = 0) => { for (const [a, b] of [[da, db], [360 - db, 360 - da]]) { g.beginPath(); g.roundRect(px(xa), py(a), px(xb) - px(xa), py(b) - py(a), r); g.fill() } }
        base(g, px, py, band)
        g.fillStyle = glass
        band(4.05, 2.45, 5, 76, 10 * (w / 1024)); band(4.25, 3.55, 100, 138, 8 * (w / 1024)); band(2.25, 0.95, 34, 82, 10 * (w / 1024)); band(0.75, -0.55, 34, 82, 10 * (w / 1024))
      })
      const body = livery(1024, 512, '#0a1118', (g, px, py, band) => {
        g.fillStyle = '#6f7a86'
        g.fillRect(0, 0, 1024, 512)
        g.fillStyle = 'rgba(20,24,30,0.35)'
        g.fillRect(0, py(140), 1024, py(80))
        g.fillStyle = '#e8792c'
        band(4.3, -7.2, 94, 103)
        g.fillStyle = '#ecebe4'
        band(4.3, -7.2, 104.5, 106.5)
        g.fillStyle = '#e8792c'
        g.fillRect(px(-6.5), 0, px(-7.1) - px(-6.5), 512)
        g.fillStyle = '#ecebe4'
        g.fillRect(px(-7.1), 0, px(-7.35) - px(-7.1), 512)
        g.fillStyle = 'rgba(15,18,22,0.45)'
        for (const x of [2.38, 0.85, -0.65, -1.9]) g.fillRect(px(x), 0, 2, 512)
        // Its number, on each flank (the skin's map runs tail-ward, so the right flank is drawn mirrored, the left one flipped).
        g.fillStyle = 'rgba(240,240,232,0.9)'
        g.font = MONO(30)
        g.textAlign = 'center'
        for (const [d, sx, sy] of [[88, -1, 1], [272, 1, -1]]) { g.save(); g.translate(px(-1.3), py(d)); g.scale(sx, sy); g.fillText('NS-404', 0, 0); g.restore() }
      })
      // The cabin's lamps through the glass: amber in the doors, instrument green low in the windscreen.
      const lamps = livery(512, 256, '#7a4a1c', g => { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256) })
      const skin = new THREE.Mesh(loft([[4.6, 1.2, 0.03, 0.03, 2], [4.35, 1.22, 0.42, 0.36, 2.2], [3.7, 1.32, 0.82, 0.72, 2.4], [2.7, 1.52, 1.04, 0.98, 2.7], [1.3, 1.62, 1.1, 1.08, 3], [-0.4, 1.64, 1.08, 1.06, 3], [-1.7, 1.72, 0.86, 0.9, 2.6], [-2.7, 1.95, 0.44, 0.5, 2.2], [-4.6, 2.1, 0.27, 0.3, 2], [-6.6, 2.22, 0.19, 0.22, 2], [-7.7, 2.28, 0.13, 0.16, 2], [-8, 2.3, 0.02, 0.03, 2]]),
        new THREE.MeshStandardMaterial({ map: body, emissiveMap: lamps, emissive: '#ffffff', emissiveIntensity: 0.5, roughness: 0.45, metalness: 0.3 }))
      const P = [], G = [], SLATE = '#6f7a86', BLADE = '#4d525a'
      P.push(part(loft([[1.7, 2.6, 0.03, 0.03, 2], [1.2, 2.72, 0.5, 0.28, 2.4], [0.2, 2.82, 0.62, 0.36, 2.6], [-1.4, 2.8, 0.55, 0.34, 2.4], [-2.4, 2.6, 0.3, 0.2, 2], [-2.9, 2.45, 0.03, 0.03, 2]], 16, 14), SLATE))
      P.push(part(cyl(0.09, 0.11, 0.5, 10), DARK, 0.2, 3.3, 0), part(cyl(0.2, 0.22, 0.12, 12), DARK, 0.2, 3.5, 0), part(cyl(0.12, 0.14, 0.5, 10), DARK, -1.9, 2.95, 0.3, 0, 0, 1.2))
      const fin = new THREE.Shape([[-6.9, 2.35], [-7.75, 3.8], [-8.25, 3.8], [-8, 2.3], [-7.6, 1.75], [-7.3, 1.8]].map(([x, y]) => new THREE.Vector2(x, y)))
      P.push(part(new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: false }).translate(0, 0, -0.04), SLATE), part(box(0.75, 0.05, 2.4), SLATE, -6.3, 2.3, 0))
      for (const s of [-1, 1]) {
        const skid = new THREE.CatmullRomCurve3([[2.95, 0.62], [2.6, 0.22], [2.2, 0.1], [0, 0.1], [-1.9, 0.1], [-2.2, 0.15]].map(([x, y]) => new THREE.Vector3(x, y, s * 1.15)))
        P.push(part(new THREE.TubeGeometry(skid, 20, 0.05, 8), DARK), strut([1.5, 0.1, s * 1.15], [1.5, 0.8, s * 0.6], 0.07, DARK), strut([-1, 0.1, s * 1.15], [-1, 0.8, s * 0.6], 0.07, DARK))
      }
      P.push(part(cyl(0.11, 0.13, 0.12, 12), DARK, 3.3, 0.7, 0))
      G.push(part(new THREE.CircleGeometry(0.1, 12), '#ffffff', 3.36, 0.66, 0, Math.PI / 2, 0, 0, 12))
      const hull = merged(P, paintMat, true)
      skin.castShadow = skin.receiveShadow = true
      heli.add(skin, hull, merged(G, litMat))
      await step()
      // Main rotor: four blades with yellow tips, coned up a little, and the haze of their turning.
      const B = []
      for (let k = 0; k < 4; k++) B.push(part(box(4.6, 0.035, 0.36).translate(2.6, 0, 0), BLADE, 0, 0, 0, (k * Math.PI) / 2, 0, 0.035), part(box(0.5, 0.037, 0.37).translate(5.15, 0, 0), YEL, 0, 0, 0, (k * Math.PI) / 2, 0, 0.035))
      rotor.add(merged(B, paintMat, true))
      rotor.position.set(0.2, 3.56, 0)
      const blur = canvasTexture(256, 256, g => {
        g.translate(128, 128)
        for (let i = 0; i < 90; i++) { g.rotate(rnd() * TAU); g.fillStyle = `rgba(190,205,225,${0.05 + rnd() * 0.2})`; g.fillRect(8, -1 - rnd() * 3, 118, 2 + rnd() * 6) }
      })
      const disc = new THREE.Mesh(new THREE.CircleGeometry(5.4, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blur, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }))
      disc.position.y = 0.02
      rotor.add(disc)
      tail.add(merged([part(box(1.5, 0.13, 0.02), BLADE), part(box(0.13, 1.5, 0.02), BLADE)], paintMat, true))
      tail.position.set(-7.95, 3.15, 0.2)
      heli.add(rotor, tail)
      // Its lights: red to port, green to starboard, a white strobe and a red beacon on the tail, the landing lamp under the nose.
      const HG = [], HC = []
      glow(HG, [0.3, 1.5, -1.16], '#ff2a1c', 0.5, 1.6)
      glow(HG, [0.3, 1.5, 1.16], '#2aff7a', 0.5, 1.6)
      glow(HG, [-8.1, 2.4, 0], '#ffffff', 0.9, 2.4, 1, 0.08)
      glow(HG, [-8, 3.9, 0], '#ff2a1c', 0.8, 1.8, 0.7, 0.3, 0.4)
      glow(HG, [3.42, 0.66, 0], '#f4f8ff', 1.1, 2.6) // a tight flare: a wide one is cut off by the nose in front of it
      cone(HC, [3.36, 0.68, 0], [10.5, 0, 0], 0.32, '#e6efff', 0.5)
      dust(HG, [3.36, 0.68, 0], [10.5, 0, 0], 0.32, mobile ? 40 : 90, '#f4f8ff')
      heli.add(glowMesh(HG), merged(HC, coneMat))
      // Dust lifted by the rotor wash: it circles out along the ground from under the disc.
      const n = mobile ? 70 : 150, g = new THREE.InstancedBufferGeometry(), seeds = new Float32Array(n * 3)
      for (let i = 0; i < n * 3; i++) seeds[i] = rnd()
      g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
      g.setIndex([0, 1, 2, 0, 2, 3])
      g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3))
      g.instanceCount = n
      const wash = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: { uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute vec3 aSeed; uniform float uTime; varying vec2 vUv; varying float vA;
          void main() {
            float life = fract(aSeed.y + uTime * (0.09 + 0.06 * aSeed.z));
            float r = 3.2 + life * 8.0, a = aSeed.x * 6.2831 + uTime * 0.5 * (1.0 - 0.6 * life);
            vec4 mv = modelViewMatrix * vec4(cos(a) * r, 0.15 + aSeed.z * (0.3 + life * 1.4), sin(a) * r, 1.0);
            mv.xy += position.xy * (0.3 + life * 1.0);
            gl_Position = projectionMatrix * mv;
            vA = sin(life * 3.1416) * 0.05; vUv = position.xy;
          }`,
        fragmentShader: 'varying vec2 vUv; varying float vA; void main() { float r2 = dot(vUv, vUv); gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * vA * exp(-r2 * 3.5) * (1.0 - smoothstep(0.5, 1.0, r2)), 1.0); }',
      }))
      wash.frustumCulled = false
      heli.add(wash)
    }
    heli.position.set(PAD[0], 0.03, PAD[1])
    scene.add(heli)

    await step()

    // ------------------------------------------------------------ the drone
    const drone = new THREE.Group()
    {
      const P = [part(new RoundedBoxGeometry(0.3, 0.085, 0.22, 2, 0.03), '#7c848e'), strut([-0.26, 0, -0.26], [0.26, 0, 0.26], 0.03, DARK), strut([-0.26, 0, 0.26], [0.26, 0, -0.26], 0.03, DARK), part(new THREE.SphereGeometry(0.05, 10, 8), '#33373d', 0.12, -0.07, 0)]
      const D = []
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        P.push(part(cyl(0.03, 0.03, 0.06, 8), DARK, sx * 0.26, 0.03, sz * 0.26), strut([sx * 0.12, -0.03, sz * 0.09], [sx * 0.17, -0.16, sz * 0.13], 0.014, DARK))
        D.push(part(new THREE.CircleGeometry(0.18, 16), '#c4d2e2', sx * 0.26, 0.07, sz * 0.26, 0, -Math.PI / 2))
      }
      const G = []
      glow(G, [-0.17, 0, 0], '#ff2a1c', 0.2, 1.8, 1.4, 0.5)
      glow(G, [0.17, 0, 0], '#2aff7a', 0.2, 1.8)
      drone.add(merged(P, paintMat, true), merged(D, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })), glowMesh(G))
      drone.scale.setScalar(1.7)
      scene.add(drone)
    }

    await step()
    scene.add(merged(paint, paintMat, true))
    await step()
    scene.add(merged(lit, litMat), merged(cones, coneMat), glowMesh(glows))
    await step()

    // ------------------------------------------------------------ light
    // The moon is the one light that casts shadows: low, ahead and behind the set, so every shadow is
    // long and falls toward you. Three lamps and the helicopter's landing light are spots without shadows.
    // A cool moon over warm ground: desert at night, not a winter airfield.
    const MOON_I = 2.6, HEMI_I = 1.9, FLOOD_I = 620, KEY_I = 260
    const moon = new THREE.DirectionalLight('#b9c6e0', MOON_I)
    moon.castShadow = true
    moon.shadow.mapSize.setScalar(mobile ? 1024 : 2048)
    moon.shadow.bias = -0.0004
    moon.shadow.normalBias = 0.04
    Object.assign(moon.shadow.camera, { left: -24, right: 24, top: 15, bottom: -15, near: 1, far: 150 })
    const hemi = new THREE.HemisphereLight('#7f9fd6', '#4a4030', HEMI_I)
    const spot = (color, intensity, dist, angle, from, to, parent = scene) => {
      const s = new THREE.SpotLight(color, intensity, dist, angle, 0.85, 1.6)
      s.position.set(...from)
      s.target.position.set(...to)
      parent.add(s, s.target)
      return s
    }
    // The first yard's lamp, until he is in the alley; from there the same light is the key on him for the last shot.
    const spotA = spot('#ffe2b8', FLOOD_I, 26, 0.68, headA, [9, 0, -0.6])
    spot('#ffe2b8', FLOOD_I * 0.7, 28, 0.68, headB, [36, 0, -0.8]) // the yard by the pad: dimmer, so the moon and the cool fill set its mood
    spot('#e6eeff', 1500, 40, 0.24, searchHead, [PAD[0], 1, PAD[1]])
    spot('#eef4ff', 500, 22, 0.5, [3.4, 0.9, 0], [10, 0, 0], heli)
    // A cool fill from the lens side, without shadows: the moon is behind the set, so this is what shapes the faces you see.
    const FILL_I = 1.3
    const fill = new THREE.DirectionalLight('#a3b2da', FILL_I)
    fill.position.set(-0.45, 0.5, 1)
    scene.add(moon, moon.target, hemi, fill)

    await step()

    // ------------------------------------------------------------ the traveller and his kit
    const kitMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide })
    const lensMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })
    /**
     * His kit, our own design: a helmet with flip-down night-vision, a plate carrier with pouches, a radio
     * and a small pack. Built around his rest pose (metres; y up, his front +z; head x ±0.11, y 1.45..1.72;
     * torso x ±0.2, y 0.98..1.36, z ±0.125), then each piece is handed to the bone it rides on.
     */
    function dress(you) {
      const SHELL = '#8a9070', TRIM = '#565a48', WEB = '#7b8062', PACK = '#6b7058'
      const helmet = [
        part(new THREE.SphereGeometry(0.158, 20, 8, 0, TAU, 0, Math.PI / 2).scale(1, 1.02, 1.2), SHELL, 0, 1.628, -0.008),
        part(new THREE.SphereGeometry(0.158, 16, 4, (Math.PI * 5) / 6, (Math.PI * 4) / 3, Math.PI / 2, Math.PI * 0.19).scale(1, 1.02, 1.2), SHELL, 0, 1.628, -0.008), // lower at the sides and back
        part(box(0.02, 0.03, 0.14), TRIM, -0.158, 1.62, 0.02), part(box(0.02, 0.03, 0.14), TRIM, 0.158, 1.62, 0.02), part(box(0.06, 0.05, 0.03), TRIM, 0, 1.675, 0.185),
      ]
      const nvg = new THREE.Group() // hinged at the brow
      nvg.position.set(0, 1.685, 0.2)
      nvg.add(new THREE.Mesh(mergeGeometries([part(box(0.03, 0.07, 0.03), TRIM, 0, -0.025, 0.012), part(box(0.1, 0.035, 0.04), TRIM, 0, -0.06, 0.03), ...[-1, 1].map(s => part(cyl(0.021, 0.024, 0.09, 10), TRIM, s * 0.034, -0.065, 0.055, 0, Math.PI / 2))]), kitMat))
      nvg.add(new THREE.Mesh(mergeGeometries([-1, 1].map(s => part(new THREE.CircleGeometry(0.019, 10), '#3dff8a', s * 0.034, -0.065, 0.101, 0, 0, 0, 1.6))), lensMat))
      const vest = [
        part(new RoundedBoxGeometry(0.37, 0.37, 0.065, 2, 0.02), WEB, 0, 1.19, 0.14), part(new RoundedBoxGeometry(0.37, 0.37, 0.065, 2, 0.02), WEB, 0, 1.19, -0.14),
        part(box(0.04, 0.2, 0.25), WEB, -0.205, 1.12, 0), part(box(0.04, 0.2, 0.25), WEB, 0.205, 1.12, 0), part(box(0.075, 0.035, 0.3), WEB, -0.115, 1.385, 0), part(box(0.075, 0.035, 0.3), WEB, 0.115, 1.385, 0),
        ...[-0.097, 0, 0.097].map(px => part(new RoundedBoxGeometry(0.08, 0.135, 0.05, 2, 0.015), TRIM, px, 1.085, 0.19)), part(new RoundedBoxGeometry(0.2, 0.09, 0.035, 2, 0.012), TRIM, 0, 1.275, 0.185),
        part(new RoundedBoxGeometry(0.25, 0.26, 0.1, 2, 0.03), PACK, -0.03, 1.16, -0.215), part(box(0.07, 0.17, 0.045), TRIM, 0.12, 1.25, -0.2), part(cyl(0.006, 0.006, 0.36, 5), TRIM, 0.135, 1.5, -0.2),
      ]
      const pieces = [['Head', new THREE.Mesh(mergeGeometries(helmet), kitMat)], ['Head', nvg], ['Spine01', new THREE.Mesh(mergeGeometries(vest), kitMat)],
        ['Head', new THREE.Mesh(part(box(0.03, 0.015, 0.01), '#3dff8a', 0, 1.6, -0.2, 0, 0, 0, 1.4), lensMat)]] // a marker light on the back of the helmet
      for (const [, m] of pieces) { you.root.add(m); m.traverse(o => { o.castShadow = !!o.isMesh }) }
      you.root.updateMatrixWorld(true)
      for (const [bone, m] of pieces) you.bone(bone).attach(m)
      return { nvg, q0: nvg.quaternion.clone() }
    }
    let you = null, kit = null
    loadTraveller(loader).then(t => {
      you = t.make({ look: 'pbr' })
      // His aloha shirt under the kit, as in the block world, read as painted (the frame has no sRGB encode).
      you.root.traverse(o => { if (o.isSkinnedMesh) o.material.map = alohaLinear() })
      kit = dress(you) // fitted in his rest pose, so before the mixer first poses him
      you.root.rotation.y = Math.PI / 2 // facing +x, down the path
      if (you.actions.Walk) you.actions.Walk.timeScale = 1.3
      for (const s of ['Left', 'Right']) {
        const arm = you.bone(s + 'Arm'), fore = you.bone(s + 'ForeArm'), hand = you.bone(s + 'Hand')
        arms[s] = { arm, fore, hand, ...handAxes(hand, fore) }
      }
      spine = ['Spine', 'Spine01', 'Spine02'].map(n => you.bone(n))
      you.root.updateMatrixWorld(true)
      chestAxis.set(1, 0, 0).applyQuaternion(spine[0].getWorldQuaternion(_q).invert()) // his front (+x now) in his upper spine's own axes
      neck = [you.bone('neck'), you.bone('Head')]
      headAxis.set(1, 0, 0).applyQuaternion(neck[1].getWorldQuaternion(_q).invert())
      // Every bone the hold turns, with its rest pose: put back before any clip plays or the mixer runs, as a
      // bone no clip animates would otherwise keep last frame's turn (and a clip bound later would save it).
      posed = [...spine, ...neck, ...Object.values(arms).flatMap(a => [a.arm, a.fore, a.hand])].map(b => ({ b, q: b.quaternion.clone() }))
      scene.add(you.root)
    })

    // ------------------------------------------------------------ his rifle (public/cinema/ops/rifle.glb)
    // Origin at the pistol grip, barrel along +z, top +y. Held in both hands every frame by a two-bone reach
    // of each arm to its grip, the stock in his right shoulder: low ready on the move, raised to each target.
    const R = { butt: new THREE.Vector3(0, 0.055, -0.271), muzzle: new THREE.Vector3(0, 0.1, 0.645) } // measured off the model
    const rifle = new THREE.Group()
    const arms = {}
    let spine = null, neck = null, posed = []
    const chestAxis = new THREE.Vector3(), headAxis = new THREE.Vector3()
    loader.loadAsync('/cinema/ops/rifle.glb').then(gltf => {
      gltf.scene.traverse(o => {
        if (!o.isMesh) return
        const map = o.material.map
        if (map) { map.colorSpace = THREE.NoColorSpace; map.anisotropy = mobile ? 2 : 4 } // as painted: the frame has no sRGB encode
        o.material = new THREE.MeshStandardMaterial({ map, roughness: 0.42, metalness: 0.5, color: '#d2d6da' })
        o.castShadow = !mobile
      })
      rifle.add(gltf.scene)
    })
    // The muzzle flash: three crossed quads of a soft star, added at the muzzle; scaled to nothing between rounds.
    const starTex = canvasTexture(128, 128, (g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
      r.addColorStop(0, 'rgba(255,250,230,1)'); r.addColorStop(0.18, 'rgba(255,214,140,0.95)'); r.addColorStop(0.5, 'rgba(255,140,40,0.35)'); r.addColorStop(1, 'rgba(255,90,20,0)')
      g.fillStyle = r
      g.beginPath()
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, k = i % 2 ? 0.2 : 0.5; g.lineTo(w / 2 + Math.cos(a) * w * k, w / 2 + Math.sin(a) * w * k) }
      g.fill()
    })
    const flashMat = new THREE.MeshBasicMaterial({ map: starTex, color: new THREE.Color(2.4, 2.1, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide })
    const flash = new THREE.Mesh(mergeGeometries([new THREE.PlaneGeometry(0.22, 0.22), new THREE.PlaneGeometry(0.12, 0.34).rotateY(Math.PI / 2).translate(0, 0, 0.12), new THREE.PlaneGeometry(0.34, 0.12).rotateX(Math.PI / 2).translate(0, 0, 0.12)]), flashMat)
    flash.position.copy(R.muzzle)
    rifle.add(flash)
    // A spark where a round meets the steel, and his rifle's infrared aiming laser, seen only through the tube.
    const spark = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), flashMat)
    const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 5).translate(0, 0.5, 0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2, 1.7), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
    laser.position.set(0.03, 0.115, 0.38) // a box on the handguard's left rail
    rifle.add(laser)
    for (const m of [flash, spark, laser]) { m.frustumCulled = false; m.renderOrder = 5 }
    scene.add(rifle, spark)

    /** A hand's own axes for its fingers and its palm, read in his rest pose (arms out, palms down; the rig has no finger bones, so the fingers run on from the forearm). */
    function handAxes(hand, fore) {
      you.root.updateMatrixWorld(true)
      hand.getWorldQuaternion(_q).invert()
      const fingers = hand.getWorldPosition(new THREE.Vector3()).sub(fore.getWorldPosition(new THREE.Vector3())).normalize().applyQuaternion(_q)
      const palm = DOWN.clone().applyQuaternion(_q)
      palm.addScaledVector(fingers, -palm.dot(fingers)).normalize()
      return { rest: new THREE.Matrix4().makeBasis(fingers, palm, new THREE.Vector3().crossVectors(fingers, palm)).invert(), q0: new THREE.Quaternion(), q1: new THREE.Quaternion() }
    }
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3(), _e2 = new THREE.Vector3(), _pole = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3()
    const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _mb = new THREE.Matrix4()
    const D = new THREE.Vector3(), U = new THREE.Vector3(), L = new THREE.Vector3(), F = new THREE.Vector3(), POCKET = new THREE.Vector3(), HF = new THREE.Vector3(), HN = new THREE.Vector3(), POLE = new THREE.Vector3()
    /** Turn a bone in world space by q. */
    const turn = (bone, q) => {
      bone.getWorldQuaternion(_qa).premultiply(q)
      bone.parent.getWorldQuaternion(_qb).invert()
      bone.quaternion.copy(_qb.multiply(_qa))
      bone.updateMatrixWorld(true)
    }
    /** Turn a bone so the direction from it to `from` (a world point) points at `to`. */
    const swing = (bone, from, to) => {
      bone.getWorldPosition(_a)
      _qr.setFromUnitVectors(_b.copy(from).sub(_a).normalize(), _t.copy(to).sub(_a).normalize())
      turn(bone, _qr)
    }
    /** Two-bone reach of arm s: wrist to W, elbow bent toward the pole direction P, blended in by w. */
    const _S = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3()
    function reachTo(s, W, P, w) {
      const A = arms[s]
      A.q0.copy(A.arm.quaternion)
      A.q1.copy(A.fore.quaternion)
      A.arm.getWorldPosition(_S)
      A.fore.getWorldPosition(_B)
      A.hand.getWorldPosition(_C)
      const l1 = _B.distanceTo(_S), l2 = _C.distanceTo(_B)
      _n.copy(W).sub(_S)
      const d = THREE.MathUtils.clamp(_n.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999)
      _n.normalize()
      _pole.copy(P).addScaledVector(_n, -P.dot(_n)).normalize()
      const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca))
      _e2.copy(_S).addScaledVector(_n, ca * l1).addScaledVector(_pole, sa * l1) // the elbow
      _f.copy(_S).addScaledVector(_n, d) // the wrist, as far as it can reach
      swing(A.arm, _B, _e2)
      A.hand.getWorldPosition(_C)
      swing(A.fore, _C, _f)
      if (w < 1) {
        A.arm.quaternion.slerpQuaternions(A.q0, A.arm.quaternion, w)
        A.fore.quaternion.slerpQuaternions(A.q1, A.fore.quaternion, w)
        A.arm.updateMatrixWorld(true)
      }
    }
    /** Lay hand s on a grip: its fingers along f and its palm facing n (world), blended in by w. */
    function grip(s, f, n, w) {
      const A = arms[s]
      _n.copy(n).addScaledVector(f, -n.dot(f)).normalize()
      _mb.makeBasis(f, _n, _a.crossVectors(f, _n)).multiply(A.rest)
      _qr.setFromRotationMatrix(_mb)
      A.hand.parent.getWorldQuaternion(_qb).invert()
      _qa.copy(A.hand.quaternion)
      A.hand.quaternion.copy(_qb.multiply(_qr))
      if (w < 1) A.hand.quaternion.slerpQuaternions(_qa, A.hand.quaternion, w)
    }

    await step()

    // ------------------------------------------------------------ the HUD and the night-vision tube, both on the camera
    const HH = Math.tan(THREE.MathUtils.degToRad(20)) // half the frame's height, one metre out
    const hudBits = { transparent: true, depthTest: false, depthWrite: false, fog: false }
    const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
    const CYAN = '#c8f6ff'
    // Compass: a strip of bearings that slides with the camera's heading, a caret at its middle.
    const bearings = canvasTexture(2048, 56, (g, w, h) => {
      g.fillStyle = 'rgba(6,12,18,0.5)'
      g.fillRect(0, 0, w, h)
      g.fillStyle = CYAN
      g.textAlign = 'center'
      g.font = MONO(25)
      for (let d = 0; d < 360; d += 5) {
        const x = (d / 360) * w
        g.fillRect(x - 1, h - (d % 15 ? 9 : 16), 2, d % 15 ? 9 : 16)
        if (d % 15 === 0) g.fillText(d % 90 ? String(d).padStart(3, '0') : 'NESW'[d / 90], x, 28)
      }
    })
    bearings.wrapS = THREE.RepeatWrapping
    const compass = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      ...hudBits, uniforms: { map: { value: bearings }, uHead: { value: 0 }, uSpan: { value: 0.3 }, uAlpha: { value: 0 } }, vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; uniform float uHead, uSpan, uAlpha; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(map, vec2(uHead / 360.0 + (vUv.x - 0.5) * uSpan, vUv.y));
          float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
          float caret = step(abs(vUv.x - 0.5) * uSpan * 36.6, (0.3 - vUv.y) * 0.6) * step(vUv.y, 0.3);
          gl_FragColor = vec4(mix(c.rgb, vec3(1.0, 0.76, 0.36), caret), max(c.a * edge, caret) * uAlpha);
        }`,
    }))
    // Mini-map: the compound from above, north up, him at its middle, the helicopter as an amber diamond (held at the rim while it is off the map).
    const MAP = { x0: -14, z0: -50, size: 80, r: 15 }
    const plan = canvasTexture(512, 512, g => {
      const s = 512 / MAP.size, X2 = x => (x - MAP.x0) * s, Z2 = z => (z - MAP.z0) * s
      const rect = (x, z, w, d, ry, fill) => { g.save(); g.translate(X2(x), Z2(z)); g.rotate(-ry); g.fillStyle = fill; g.fillRect((-w / 2) * s, (-d / 2) * s, w * s, d * s); g.restore() }
      for (const [x, , z, ry] of BOXES) rect(x, z, 6.06, 2.44, ry, 'rgba(150,205,228,0.6)')
      for (const [x, z, ry] of BARRIERS) rect(x, z, 2, 0.7, ry, 'rgba(215,236,246,0.9)')
      rect(TOWER[0], TOWER[1], 3.2, 3.2, 0, 'rgba(150,205,228,0.8)')
      for (const [x, z] of [[8, -47], [40, -49], [76, -45]]) rect(x, z, 18, 26, 0, 'rgba(150,205,228,0.3)')
      g.strokeStyle = 'rgba(150,205,228,0.5)'
      g.lineWidth = 2
      g.beginPath(); g.moveTo(X2(-24), Z2(-23)); g.lineTo(X2(86), Z2(-23)); g.stroke()
      g.setLineDash([6, 6])
      g.beginPath()
      for (let x = 0; x <= LENGTH; x++) g.lineTo(X2(x), Z2(pathZ(x)))
      g.stroke()
      g.setLineDash([])
      g.strokeStyle = 'rgba(255,196,107,0.9)'
      g.lineWidth = 3
      g.beginPath(); g.arc(X2(PAD[0]), Z2(PAD[1]), 6.4 * s, 0, TAU); g.stroke()
    })
    const minimap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      ...hudBits, uniforms: { map: { value: plan }, uC: { value: new THREE.Vector2() }, uObj: { value: new THREE.Vector2((PAD[0] - MAP.x0) / MAP.size, 1 - (PAD[1] - MAP.z0) / MAP.size) }, uYaw: { value: 0 }, uR: { value: MAP.r / MAP.size }, uAlpha: { value: 0 } }, vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; uniform vec2 uC, uObj; uniform float uYaw, uR, uAlpha; varying vec2 vUv;
        void main() {
          vec2 d = (vUv - 0.5) * 2.0; float r = length(d);
          if (r > 1.0) discard;
          vec4 m = texture2D(map, uC + d * uR);
          vec3 col = mix(vec3(0.02, 0.05, 0.07), m.rgb, m.a); float a = 0.66;
          float ring = smoothstep(0.045, 0.0, abs(r - 0.955));
          col = mix(col, vec3(0.78, 0.96, 1.0), ring); a = max(a, ring);
          col = mix(col, vec3(1.0), step(abs(d.x), 0.035) * step(0.8, d.y));
          float cy = cos(uYaw), sy = sin(uYaw); vec2 q = vec2(d.x * cy - d.y * sy, d.x * sy + d.y * cy); // q.y: ahead of him
          float me = step(-0.1, q.y) * step(q.y, 0.15) * step(abs(q.x), (0.15 - q.y) * 0.48);
          col = mix(col, vec3(1.0), me); a = max(a, me);
          vec2 o = (uObj - uC) / uR; float ol = length(o); if (ol > 0.82) o *= 0.82 / ol;
          vec2 od = abs(d - o); float obj = step(od.x + od.y, 0.1);
          col = mix(col, vec3(1.0, 0.72, 0.3), obj); a = max(a, obj);
          gl_FragColor = vec4(col, a * uAlpha);
        }`,
    }))
    // Two small readouts, redrawn only when their number changes: the distance under the objective marker, and the targets down.
    const readout = (w, h, draw) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      let shown = null
      return { tex, set(v) { if (v === shown) return; shown = v; g.clearRect(0, 0, w, h); draw(g, v); tex.needsUpdate = true } }
    }
    const dist = readout(256, 112, (g, v) => {
      g.strokeStyle = g.fillStyle = '#ffc46b'
      g.lineWidth = 5
      g.beginPath(); g.moveTo(128, 6); g.lineTo(152, 30); g.lineTo(128, 54); g.lineTo(104, 30); g.closePath(); g.stroke()
      g.fillRect(122, 24, 12, 12)
      g.fillStyle = 'rgba(6,12,18,0.6)'
      g.beginPath(); g.roundRect(64, 66, 128, 42, 6); g.fill()
      g.fillStyle = '#ffd89a'
      g.font = MONO(30)
      g.textAlign = 'center'
      g.fillText(v + ' m', 128, 98)
    })
    const tally = readout(256, 48, (g, v) => {
      // A dark band and near-white phosphor, so it holds 4.5:1 over the lit apron, inside the tube's
      // green and under the corner's vignette.
      g.fillStyle = 'rgba(0,0,0,0.72)'
      g.beginPath(); g.roundRect(0, 4, 256, 40, 6); g.fill()
      g.fillStyle = '#ecfff7'
      g.font = MONO(25)
      g.fillText('TARGETS ' + v + '/' + TARGETS.length, 14, 33)
    })
    tally.tex.colorSpace = THREE.NoColorSpace // as painted: through the frame's missing encode an sRGB read came out dim grey-teal
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: dist.tex, sizeAttenuation: false, ...hudBits, opacity: 0 }))
    marker.position.set(PAD[0], 5.6, PAD[1])
    marker.scale.set(0.16, 0.07, 1)
    const counter = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tally.tex, ...hudBits, opacity: 0 }))
    // The tube: the whole frame multiplied down to green phosphor inside a round field. Folded to nothing while his goggles are up.
    const tube = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      ...hudBits, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { uNv: { value: 0 }, uAspect: { value: 1 }, uTime },
      vertexShader: 'uniform float uNv; varying vec2 vUv; void main() { vUv = position.xy; gl_Position = vec4(position.xy * step(0.001, uNv), 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uNv, uAspect, uTime; varying vec2 vUv;
        void main() {
          float r = length(vUv * vec2(max(uAspect, 1.0), max(1.0 / uAspect, 1.0)) / max(uAspect, 1.0 / uAspect) * 1.25);
          float field = 1.0 - 0.8 * smoothstep(0.62, 1.02, r);
          vec3 tint = vec3(0.3, 1.0, 0.48) * 1.5 * field * (0.96 + 0.04 * sin(uTime * 37.0));
          gl_FragColor = vec4(mix(vec3(1.0), tint, uNv), 1.0);
        }`,
    }))
    tube.frustumCulled = false
    tube.renderOrder = 900
    for (const m of [compass, minimap, counter, marker]) m.renderOrder = 1000
    camera.add(compass, minimap, counter, tube)
    scene.add(marker)

    const look = new THREE.Vector3(), camPos = new THREE.Vector3()
    const grade = { bloom: 0.32, threshold: 0.9, vignette: 0.6, grain: 0.6, scan: 0.07 }
    const out = { here: look, dream: 0, grade }
    let lastT = null, lastX = 0, movedAt = -1, cue = '', late = null, shotAt = -1, shotI = 0

    function update(state, t, aspect) {
      const p = state.p, portrait = state.portrait ?? aspect < 0.85
      const dt = lastT === null ? 0 : Math.min(0.1, t - lastT)
      lastT = t
      uTime.value = t
      // A steady pace down the course, easing to a stop at the pad's edge by p = 0.9.
      const u = Math.min(1, p / 0.9), f = u < 0.8 ? u : u - (u - 0.8) ** 2 / 0.4
      const x = (LENGTH * f) / 0.9, z = pathZ(x), slope = (pathZ(x + 0.1) - pathZ(x - 0.1)) / 0.2
      const end = ss(0.8, 0.97, p)
      const nv = ss(ALLEY[0], ALLEY[0] + 1.6, x) * (1 - ss(ALLEY[1] - 1.6, ALLEY[1], x))
      // The target he covers: raised to it as it comes up, lowered once it is down.
      let ka = 0, ti = 0
      for (let i = 0; i < TARGETS.length; i++) {
        const T0 = TARGETS[i][0], k = ss(T0 - 3.7, T0 - 3.0, x) * (1 - ss(T0 - 1.5, T0 - 0.5, x))
        if (k > ka) { ka = k; ti = i }
      }
      const ks = ss(0.9, 0.94, p) // at the pad the rifle goes to its sling and his hands are free to wave
      ka *= 1 - ks
      const TT = TARGETS[ti], tx = TT[0] - x, tz = TT[1] - z
      const fy = Math.PI / 2 - slope
      let twist = Math.atan2(tx, tz) - fy
      twist = Math.atan2(Math.sin(twist), Math.cos(twist)) * ka

      // Third person, low and close behind his right shoulder. The last shot steps out to his side: him
      // in the foreground, the helicopter beyond, the moon over both. A phone stands behind him instead,
      // so he and the helicopter stack in its narrow frame, under the prompt box.
      camera.aspect = aspect
      camera.updateProjectionMatrix()
      if (portrait) {
        camPos.set(x - 7.6, 2.5, 1.5 + 0.5 * z).lerp(_v.set(33.6, 3, 1.9), end)
        look.set(x + 3, 1.75, -0.3 + 0.3 * z).lerp(_v.set(48.35, 1.2, -0.83), end)
      } else {
        camPos.set(x - 4.1, 1.62, 2.5 + 0.5 * z).lerp(_v.set(36.8, 1.5, 5), end)
        look.set(x + 6, 1.3, -0.9 + 0.3 * z).lerp(_v.set(47, 2, -1.6), end)
      }
      // While he aims the camera comes round behind him with his turn, a little closer, so the rifle points
      // into the frame at the target over his shoulder instead of hiding in front of his chest.
      if (ka > 0 && !state.still) {
        // A phone's narrow frame cannot swing round with him (the alley's containers stand right there): it
        // cranes up behind his right shoulder instead, looking down the rifle at the plate.
        const ay = Math.atan2(tx, tz), sa = Math.sin(ay), ca = Math.cos(ay)
        if (portrait) camPos.lerp(_w.set(x - 5.2, 3.2, z + 2.2), ka)
        else camPos.lerp(_w.set(x - sa * 2.8 - ca * 1.55, 1.6, z - ca * 2.8 + sa * 1.55), ka)
        look.lerp(_v.set(lerp(x, TT[0], portrait ? 0.18 : 0.6), portrait ? 1.0 : 1.15, lerp(z, TT[1], portrait ? 0.18 : 0.6)), ka)
      }
      // A hand on the camera, stilled for the last shot so it matches the one on the cinema's screen.
      const sway = state.still ? 0 : 1 - ss(0.86, 0.97, p)
      camera.position.set(camPos.x + Math.sin(t * 0.9) * 0.03 * sway, camPos.y + Math.sin(t * 1.7) * 0.018 * sway, camPos.z)
      camera.lookAt(look)
      if (sway > 0) {
        camera.rotateZ(Math.sin(t * 0.83) * 0.004 * sway)
        camera.rotateX((Math.sin(t * 1.31) * 0.0035 + Math.sin(t * 2.9) * 0.0012) * sway)
        camera.rotateY(Math.sin(t * 1.07 + 1) * 0.004 * sway)
      }
      dome.position.copy(camera.position)
      stars.position.copy(camera.position)

      // He walks while the scroll moves him and stands when it rests; at the pad he turns to you and waves.
      // He fires a short burst at each target as it comes up (stepping forward past its mark only), just before it drops.
      for (let i = 0; i < TARGETS.length; i++) {
        const mark = TARGETS[i][0] - SHOT
        if (lastX < mark && x >= mark && x - lastX < 1.5) { shotAt = t; shotI = i }
      }
      if (Math.abs(x - lastX) > 1e-4) movedAt = t
      lastX = x
      if (you) {
        for (const o of posed) o.b.quaternion.copy(o.q)
        const next = p > 0.945 ? 'Wave_One_Hand' : t - movedAt < 0.25 ? 'Walk' : 'Idle'
        if (next !== cue) you.play((cue = next), { fade: 0.3 })
        you.root.position.set(x, 0.02, z)
        you.root.rotation.y = lerp(fy + 0.3 * twist, Math.atan2(camPos.x - x, camPos.z - z), ss(0.9, 0.955, p))
        you.mixer.update(dt)
        if (spine) {
          you.root.updateMatrixWorld(true)
          // His chest to a set heading: the idle clip swings his whole body a long way, and the rifle must not swing with it.
          const blade = BLADE * (1 - ks), chest = you.root.rotation.y + 0.7 * twist - blade
          _w.copy(chestAxis).applyQuaternion(spine[0].getWorldQuaternion(_qa))
          const off = Math.atan2(Math.sin(chest - Math.atan2(_w.x, _w.z)), Math.cos(chest - Math.atan2(_w.x, _w.z)))
          _q.setFromAxisAngle(UP, (off * (1 - ks)) / 3)
          for (const b of spine) turn(b, _q)
          // His eyes go where the rifle goes: the idle's look-around would have him glance away mid-aim.
          const gaze = chest + blade * (0.4 + 0.6 * ka)
          _w.copy(headAxis).applyQuaternion(neck[1].getWorldQuaternion(_qa))
          const look2 = Math.atan2(Math.sin(gaze - Math.atan2(_w.x, _w.z)), Math.cos(gaze - Math.atan2(_w.x, _w.z)))
          _q.setFromAxisAngle(UP, (look2 * (1 - ks)) / 2)
          for (const b of neck) turn(b, _q)
          // Recoil: three rounds 90 ms apart, each a short kick back and up.
          const since = t - shotAt, fire = !state.still && shotAt >= 0 && since < 0.4
          let kick = 0, burst = 0, round = 0
          if (fire) for (let r = 0; r < 3; r++) {
            const u = since - r * 0.09
            if (u < 0) continue
            kick += Math.exp(-u * 22) * Math.min(1, u * 60)
            if (u < 0.045) { burst = 1 - u / 0.045; round = r + 1 }
          }
          const yaw = chest + blade + 0.15 * (1 - ka)
          const pitch = lerp(-0.62, Math.atan2(0.95 - 1.42, Math.hypot(tx, tz)), ka) + 0.05 * kick
          const cp = Math.cos(pitch), sp = Math.sin(pitch)
          D.set(Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp)
          U.set(-Math.sin(yaw) * sp, cp, -Math.cos(yaw) * sp)
          F.set(Math.sin(chest), 0, Math.cos(chest))
          L.set(Math.cos(chest), 0, -Math.sin(chest))
          // The stock in the pocket of his right shoulder, a little in from the joint and forward of it.
          arms.Right.arm.getWorldPosition(POCKET).addScaledVector(L, 0.07).addScaledVector(F, 0.11).addScaledVector(UP, -0.06 + 0.05 * ka).addScaledVector(D, -0.03 * kick)
          rifle.quaternion.setFromRotationMatrix(_mb.makeBasis(_a.crossVectors(U, D), U, D))
          rifle.position.copy(R.butt).applyQuaternion(rifle.quaternion).negate().add(POCKET)
          if (ks > 0) {
            // Slung: hanging muzzle-down across his front, its top to the lens.
            spine[2].getWorldPosition(_b).addScaledVector(F, 0.14).addScaledVector(UP, -0.2).addScaledVector(L, -0.06)
            D.copy(UP).multiplyScalar(-0.8).addScaledVector(L, 0.6).normalize()
            U.copy(F).addScaledVector(D, -F.dot(D)).normalize()
            _qa.setFromRotationMatrix(_mb.makeBasis(_a.crossVectors(U, D), U, D))
            rifle.quaternion.slerp(_qa, ks)
            rifle.position.lerp(_b, ks)
          }
          rifle.updateMatrixWorld(true)
          // Hands: right on the pistol grip, left on the foregrip; each wrist set back from its grip along the fingers.
          const w = 1 - ks
          if (w > 0) for (const [s, at, fd, nd, px, py] of HOLD) {
            HF.copy(fd).applyQuaternion(rifle.quaternion).normalize()
            HN.copy(nd).applyQuaternion(rifle.quaternion).normalize()
            _w.copy(at).applyMatrix4(rifle.matrixWorld).addScaledVector(HN, -0.03).addScaledVector(HF, -0.075)
            POLE.copy(L).multiplyScalar(px + (s === 'Right' ? -0.4 * ka : 0)).addScaledVector(UP, py)
            reachTo(s, _w, POLE, w)
            grip(s, HF, HN, w)
          }
          // The flash at the muzzle, a spark on the plate.
          const fs = burst > 0 ? 0.7 + 0.5 * burst : 1e-4
          flash.scale.setScalar(fs)
          flash.rotation.z = round * 2.1
          _v.set(TARGETS[shotI][0], 0.95, TARGETS[shotI][1] + 0.05)
          spark.position.copy(_v)
          spark.quaternion.copy(camera.quaternion)
          spark.scale.setScalar(burst > 0 ? 0.4 + 0.5 * burst : 1e-4)
          laser.scale.set(1, 1, nv > 0.01 ? 30 : 1e-4)
          laser.material.opacity = 0.4 * nv
        }
        kit.nvg.quaternion.copy(kit.q0).multiply(_q.setFromAxisAngle(X, -1.75 * (1 - nv)))
        out.here = you.root.position
      }

      // Targets drop as he comes level with each, with a little rebound, and stand again if you scroll back.
      let down = 0, moved = false
      for (let i = 0; i < TARGETS.length; i++) {
        const T = TARGETS[i], k = ss(T[0] - 2.4, T[0] - 0.4, x)
        if (k >= 0.5) down++
        if (k === fallen[i]) continue
        fallen[i] = k
        const a = 1.42 * (k < 0.65 ? (k / 0.65) ** 2 : 1 - 0.1 * Math.sin(((k - 0.65) / 0.35) * Math.PI))
        plates.setMatrixAt(i, _m.makeRotationFromEuler(_yxz.set(-a, T[2], 0)).setPosition(T[0], 0.62, T[1]))
        leds.setColorAt(i, k >= 0.5 ? GREEN : AMBER)
        moved = true
      }
      if (moved) plates.instanceMatrix.needsUpdate = leds.instanceColor.needsUpdate = true

      // The helicopter: rotors turning, nose three-quarters to the lens.
      heli.rotation.y = portrait ? -2.5 : -1.92
      rotor.rotation.y = t * 9
      tail.rotation.z = t * 15
      // The drone keeps station ahead of him, and comes to hover by the pad.
      if (portrait) drone.position.set(x + 13, 3.7, 0.4 + Math.sin(t * 0.23 + 1)).lerp(_v.set(44, 2.6, -1.4), end)
      else drone.position.set(x + 12 + Math.sin(t * 0.31) * 1.5, 4.6, 0.1 + Math.sin(t * 0.23 + 1) * 1.5).lerp(_v.set(46.3, 4.5, -5.2), end)
      drone.position.y += Math.sin(t * 0.9) * 0.12
      drone.rotation.set(0.1 + Math.sin(t * 0.7) * 0.03, Math.sin(t * 0.2) * 0.4, Math.sin(t * 0.53) * 0.04)

      // Light: the moon rides with him; in the alley the tube lifts the dark as it turns it green.
      moon.position.set(x + MOON.x * 70, MOON.y * 70, MOON.z * 70)
      moon.target.position.set(x + 3, 0, -1)
      moon.intensity = MOON_I * (1 + 0.8 * nv)
      hemi.intensity = HEMI_I * (1 + 2.4 * nv)
      fill.intensity = FILL_I * (1 + 1.5 * nv)
      const nowLate = x > 22 // inside the alley nothing the first lamp lights is in view: hand it over there
      if (nowLate !== late) {
        late = nowLate
        spotA.position.set(...(late ? [39, 3.4, 6.5] : headA))
        spotA.target.position.set(...(late ? [LENGTH, 1.1, 0] : [9, 0, -0.6]))
        spotA.color.set(late ? '#ffe6cc' : '#ffe2b8') // late: a near-neutral key on him by the pad, which keeps his skin from going grey under the moon without an amber apron
      }
      if (late && portrait) spotA.position.set(37.5, 3.6, 4.6)
      spotA.intensity = late ? KEY_I * ss(0.7, 0.93, p) : FLOOD_I
      tube.material.uniforms.uNv.value = nv
      tube.material.uniforms.uAspect.value = aspect
      grade.bloom = 0.32 + 0.45 * nv
      grade.scan = 0.07 + 0.2 * nv
      grade.grain = 0.6 + 0.4 * nv
      grade.vignette = 0.6 + 0.15 * nv

      // The HUD boots as the level resolves and is gone before the last shot, which the cinema's screen also shows.
      const on = ss(0.13, 0.2, p) * (1 - ss(0.84, 0.9, p)), hw = HH * aspect
      const away = Math.max(0, Math.hypot(PAD[0] - x, PAD[1] - z) - 5.5)
      const ch = HH * 0.066, cw = portrait ? hw * 1.72 : hw * 0.6
      compass.scale.set(cw, ch, 1)
      compass.position.set(0, HH * (portrait ? 0.794 : 0.77), -1) // between the page's header and the prompt box
      camera.getWorldDirection(_w)
      const cu = compass.material.uniforms
      cu.uHead.value = (Math.atan2(_w.x, -_w.z) * 180) / Math.PI
      cu.uSpan.value = ((cw / ch) * 56) / 2048
      cu.uAlpha.value = portrait ? 0 : on // a phone's top is the page's header and the objective box: no room for a third band there
      const ms = HH * (portrait ? 0.25 : 0.32), mx = -hw + hw * 0.12 + ms / 2, my = -HH + HH * (portrait ? 0.11 : 0.15) + ms / 2
      minimap.scale.set(ms, ms, 1)
      minimap.position.set(mx, my, -1)
      const mu = minimap.material.uniforms
      mu.uC.value.set((x - MAP.x0) / MAP.size, 1 - (z - MAP.z0) / MAP.size)
      mu.uYaw.value = Math.atan2(1, -slope)
      mu.uAlpha.value = on
      const th = HH * 0.07, tw = (th * 256) / 48
      counter.scale.set(tw, th, 1)
      if (portrait) counter.position.set(hw * 0.94 - tw / 2, my + ms / 2 - th / 2, -1) // level with the map's top, at the right edge: clear of him
      else counter.position.set(mx + ms / 2 + hw * 0.02 + tw / 2, my - ms / 2 + th / 2, -1)
      counter.material.opacity = on
      marker.material.opacity = on * ss(7, 11, away) // he can see it from there
      marker.position.y = portrait ? 4.5 : 5.6 // a phone's prompt box sits where the marker would
      tally.set(down)
      dist.set(Math.round(away))
      return out
    }

    run = update
  })()

  return { scene, camera, update: (state, t, aspect) => (run ? run(state, t, aspect) : hold(aspect)), get built() { return !!run } }
}
