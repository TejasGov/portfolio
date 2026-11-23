import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loadTraveller, alohaLinear, wearSuit, loadSuit, holdIn } from './films/kit'

/*
 * Chapter Five, world 5: the vault (Mission: Impossible, a fan's homage to a famous kind of shot, not a
 * copy of one). A stark white, high-key room: panelled walls and ceiling with lit coves and grilles, a
 * raised floor of pressure tiles, a round vault door's seam on the far wall, a faint red sensor beam or
 * two, one white pedestal terminal in the middle. He comes down on two black cables from a ceiling vent
 * in a generic black stealth outfit and harness (suits/stealth.glb, the RIG's), his own head. No logos,
 * film text or any actor's likeness; the screen's words are generic.
 * Beats in p (all derived from p and t, so it scrubs both ways):
 *   0    .04  under the LASER cover's white flare the vent's grille swings up; his head and shoulders are out
 *   0    .26  he is lowered head-first through it (in frame as the cover opens), swung level once he
 *             clears the vent (.12 .. .27), arms spread for balance
 *   .27  .40  held level, face down, at chest height, the cables creaking
 *   .40  .48  the winch slips: three jolts down to a hand's width over the pressure tiles
 *   .49  .58  the hold: a bead of sweat forms, falls in slow motion and is caught in his glove
 *   .60  .67  winched back up to the terminal's height, turning on the cables to face it
 *   .68  .80  he types: the screen decrypts, ACCESS GRANTED at .795
 *   .815 .865 he pulls the data drive from the console's port
 *   .865 .93  he is hauled up and out through the vent; the empty room under the COMIC cover
 * Shots: up at the vent; high overhead looking down past him to the floor; low side profile on the tiles
 * (the inches of gap); close on his face and the bead; three-quarter as he turns; close on his hands at
 * the keyboard; over his shoulder on the screen; low and wide as he is hauled out. Each has a phone
 * framing of its own (him read down a tall frame, or end-on).
 * He is posed by hand, no clips: every frame his bones are reset to rest, then the spine and neck are
 * bent and each limb is laid with a two-bone reach (ik) to a target in the rig's frame or the room's.
 *
 * CONTRACT (world.js, timeline.js and movies.js rely on it; do not change the export or its signature)
 *   export function createVault(renderer, { loader, normalize, mobile }) -> { scene, camera, update, built }
 *     loader: the shared GLTFLoader (Meshopt + Draco). normalize(root, size, yaw): a model's meshes as
 *     one centred group scaled to `size` metres. mobile: phone-sized screen, build lighter.
 *   update(state, t, aspect) is called once per rendered frame while this world is drawn.
 *     state.p         0..1, this world's own progress (movies.js: Five's P 0.6183..0.7288, 300 svh of
 *                     scroll), driven by scroll: it scrubs both ways and can jump, so derive everything
 *                     from p and t and keep no one-way state. The LASER cover (a red security grid that
 *                     a white flare burns out) opens from the middle onto this room over p 0..0.092, so
 *                     the first frame is white walls in a cool light; p 0.092..0.908 is seen clear; the
 *                     COMIC cover (halftone print, then panels) closes over p 0.908..1.
 *     state.onScreen  never true for this world.
 *     state.still     reduced motion: no camera flourishes, sway or swinging on the wire; the beats
 *                     still follow p.
 *     state.portrait  the frame is a phone's (aspect < 0.85): frame for it (him level across a tall
 *                     frame: the camera higher and looking down, or turned so he reads across it).
 *     state.mobile    same as the option. state.cover: 0..1, how much a transition hides the frame
 *                     (kind 'laser' | 'comic' | null, phase 0..1): skip work the cover hides.
 *     t               seconds, monotonic. aspect: width / height of what is being drawn; set
 *                     camera.aspect from it.
 *     Returns { here, dream, grade? }: here = a Vector3 at the traveller (world space; the same object
 *     every frame is fine); dream = 0..1 extra bloom for a held beat (0 otherwise); grade = optional
 *     overrides of GRADE.vault in movies.js ({ bloom, threshold, vignette, grain, scan }).
 *   Units: metres, y up, the floor at y = 0, the room centred on the origin, the traveller 1.72 m tall.
 *   Camera: a PerspectiveCamera with a 40 degree vertical fov.
 *   Colour: the frame has no sRGB encode after tone mapping, so a hex colour reads darker and richer
 *   than on a page, and a painted canvas texture reads as painted with colorSpace NoColorSpace.
 *   Build in steps: build the set a piece at a time, yielding (await a timeout) whenever a step has run
 *   ~4 ms, and report `built` false until it is whole; until then update() only places the camera
 *   (world.js holds the LASER cover over it and compiles it once it is whole).
 *   Budget: at most ~150 draw calls and ~400k triangles in view, one shadow-casting light (2048 map,
 *   1024 on mobile), base colour maps <= 2048 px and other maps <= 1024 px, new GLBs under ~6 MB in
 *   all, no allocation or geometry rebuilds in update().
 *   world.prepare() builds this while the reader is paused in the chase, then compiles it and draws it
 *   once at p = 0: anything hidden then (visible = false) is skipped and would compile mid-scroll, so
 *   keep things that appear later in the scene, scaled to nothing, and add late-loading models to
 *   `scene` (prepare compiles again when the scene grows).
 */
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const lerp = THREE.MathUtils.lerp
const W = 7.2, H = 4 // the room: W square, H high
const VX = 0, VZ = 0.62, VS = 0.8 // the vent he comes through, over where he hangs
const PZ = -0.62 // the pedestal's centre (x 0)
const TOP_Y = 4.75, HANG_Y = 1.3, HOLD_Y = 0.4, TYPE_Y = 1.16, OUT_Y = 7.4 // his harness ring's height at each beat
const KEYS = new THREE.Vector3(0, 0.955, -0.43) // the keyboard's centre
const PORT = new THREE.Vector3(0.2, 0.905, -0.4) // the drive's port, on the console's front edge
const RED = new THREE.Color(3.2, 0.12, 0.1)

// The shots: [p0, p1, from (x y z), to (x y z), look from, look to, follow?, fov?]. Hard cuts between them; a
// slow move within each. The phone has its own set on the same cuts, wider where he lies across its narrow frame.
const WIDE = [
  [0, 0.13, [1.5, 0.45, 2.6], [1.35, 0.5, 2.4], [0, 3.4, 0.6], [0, 3.0, 0.6], 2], // low, up the shaft at him coming out of it
  [0.13, 0.27, [2.7, 0.9, 3.3], [2.45, 1.0, 3.0], [0, 1.0, 0.62], [0, 1.0, 0.62], 2], // low, up at him swinging level
  [0.27, 0.4, [2.6, 3.1, 2.9], [2.4, 3.0, 2.7], [0, 1.1, 0.6], [0, 1.0, 0.6]], // high three-quarter: level and face down over the floor
  [0.4, 0.5, [0.2, 0.15, 3.45], [0.1, 0.15, 3.15], [0.1, 0.5, 0.62], [0.1, 0.42, 0.62], 1], // low profile on the tiles (the look follows him down)
  [0.5, 0.6, [1.95, 0.16, 1.55], [1.85, 0.15, 1.45], [0.6, 0.26, 0.64], [0.6, 0.24, 0.64]], // close: the bead, his head and reaching arm
  [0.6, 0.68, [2.5, 1.75, -1.5], [2.25, 1.62, -1.3], [0.1, 1.0, 0.3], [0, 1.05, 0.2]], // three-quarter: he turns
  [0.68, 0.78, [1.4, 1.0, -1.5], [1.3, 1.02, -1.4], [0, 1.06, -0.3], [0, 1.07, -0.32]], // low three-quarter from the terminal's side, past the monitor's edge: his face and hands at the keys
  [0.78, 0.85, [0.5, 1.33, -0.1], [0.45, 1.32, -0.15], [0.02, 1.23, -0.72], [0.01, 1.23, -0.72]], // in close off his right, his head out of shot: the screen
  [0.85, 1.01, [2.3, 0.34, -2.5], [2.05, 0.4, -2.25], [0, 1.9, 0.5], [0, 2.5, 0.5]], // low and wide: hauled out
]
const TALL = [
  [0, 0.13, [0.9, 0.4, 1.9], [0.8, 0.45, 1.75], [0, 3.4, 0.6], [0, 3.0, 0.6], 2],
  [0.13, 0.27, [2.6, 1.0, 3.0], [2.4, 1.05, 2.8], [0.25, 1.0, 0.62], [0.25, 1.0, 0.62], 3, 55], // up at him: the drop reads down the tall frame, between the slate and the caption
  [0.27, 0.4, [3.4, 2.9, 1.5], [3.25, 2.8, 1.4], [-0.1, 0.9, 0.62], [-0.1, 0.8, 0.62], 0, 58], // high, from his head's end: down past him to the floor
  [0.4, 0.5, [2.9, 0.16, 2.3], [2.75, 0.16, 2.15], [0.3, 0.4, 0.62], [0.3, 0.34, 0.62], 1, 58], // three-quarter from his head's end, on the tiles: all of him and the gap
  [0.5, 0.6, [3.3, 0.1, 1.1], [3.2, 0.1, 1.05], [0.1, 0.3, 0.62], [0.1, 0.28, 0.62], 0, 56], // low on the tiles, along him from his head: him above, the floor below
  [0.6, 0.68, [1.7, 2.3, -1.7], [1.55, 2.15, -1.5], [0.05, 1.0, 0.25], [0, 1.05, 0.2]],
  [0.68, 0.78, [1.05, 1.02, -1.85], [0.98, 1.03, -1.75], [0, 1.06, -0.32], [0, 1.07, -0.33], 0, 50], // low three-quarter from the terminal's side: his face and hands
  [0.78, 0.85, [0.74, 1.37, 0.2], [0.7, 1.36, 0.15], [0.02, 1.2, -0.72], [0.01, 1.2, -0.72], 0, 50], // off his right, his head out of shot: the screen
  [0.85, 1.01, [1.6, 0.3, -2.3], [1.45, 0.36, -2.1], [0.2, 1.6, 0.5], [0.1, 2.6, 0.5]],
]
const UP = new THREE.Vector3(0, 1, 0)
const HEAD_CLEAR = 0.45 // the camera's least distance from his Head bone (about 0.3 m clear of his hair)
// his harness ring's height at p: lowered, the winch's three jolts, back up to the terminal, hauled out
function ringY(p) {
  let y = lerp(TOP_Y, HANG_Y, ss(0, 0.26, p))
  if (p > 0.4) {
    const k = Math.min(1, (p - 0.4) / 0.08) * 3, i = Math.min(2, Math.floor(k)), f = k - i
    const s = p >= 0.48 ? 1 : (i + ss(0, 0.28, f)) / 3
    const jolt = p >= 0.48 ? 0 : 0.035 * Math.exp(-Math.max(0, f - 0.28) * 9) * Math.sin(Math.max(0, f - 0.28) * 30)
    y = lerp(HANG_Y, HOLD_Y, s) + jolt
  }
  y = lerp(y, TYPE_Y, ss(0.6, 0.67, p))
  const haul = ss(0.865, 0.93, p)
  return lerp(y, OUT_Y, haul * haul)
}

export function createVault(renderer, { loader, mobile = false }) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0.8, 0.84, 0.88)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 40)
  scene.add(camera)
  const here = new THREE.Vector3(0, 1.4, VZ)
  const grade = { bloom: 0.55, threshold: 0.86 } // GRADE.vault's, held lower in the close-ups so the white floor does not blow out
  const out = { here, dream: 0, grade }

  const _c = new THREE.Vector3(), _l = new THREE.Vector3(), _hd = new THREE.Vector3()
  const aim = (p, portrait, t, still, hy = 1) => {
    const list = portrait ? TALL : WIDE
    let s = list[0]
    for (let i = 1; i < list.length; i++) if (p >= list[i][0]) s = list[i]
    const e = THREE.MathUtils.clamp((p - s[0]) / (s[1] - s[0]), 0, 1)
    _c.set(lerp(s[2][0], s[3][0], e), lerp(s[2][1], s[3][1], e), lerp(s[2][2], s[3][2], e))
    _l.set(lerp(s[4][0], s[5][0], e), lerp(s[4][1], s[5][1], e), lerp(s[4][2], s[5][2], e))
    if (s[6] === 1) _l.y = Math.max(_l.y, hy - 0.3) // keep him in frame as he drops into the shot
    if (s[6] === 2) _l.y = Math.min(hy - 0.2, 3.7) // follow him down from the vent
    if (s[6] === 3) _l.y = Math.min(hy + 0.2, 3.9) // the same, framed lower so his boots clear a phone's slate
    camera.fov = s[7] ?? 40
    camera.updateProjectionMatrix()
    if (!still) {
      // a held camera's breath, smaller on the close shots
      const k = Math.min(1, _c.distanceTo(_l) / 3) * 0.012
      _c.x += Math.sin(t * 0.53) * k
      _c.y += Math.sin(t * 0.71 + 1) * k * 0.6
    }
    camera.position.copy(_c)
    camera.lookAt(_l)
  }
  const frame = (state, aspect) => {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    aim(state.p ?? 0, !!state.portrait, 0, true, ringY(state.p ?? 0))
    return out
  }
  let run = null

  ;(async () => {
    let t0 = performance.now()
    const step = async () => {
      if (performance.now() - t0 < 4) return
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }
    const loads = Promise.all([loadTraveller(loader), loadSuit(loader, 'stealth')])
    loads.catch(() => {})

    // ------------------------------------------------------------ the white room's light
    // Its few shaders compile off the main thread first (into a target, as the PMREM draws them); then a
    // small, unblurred PMREM, the size and sigma chase.js uses, so its filter shader is usually compiled.
    const room = new RoomEnvironment()
    {
      const rt = new THREE.WebGLRenderTarget(1, 1), prev = renderer.getRenderTarget()
      renderer.setRenderTarget(rt)
      const ready = renderer.compileAsync(room, camera)
      renderer.setRenderTarget(prev)
      await ready.catch(() => {})
      rt.dispose()
      t0 = performance.now()
    }
    const pm = new THREE.PMREMGenerator(renderer)
    scene.environment = pm.fromScene(room, 0, 0.1, 100, { size: 64 }).texture
    scene.environmentIntensity = 0.55
    pm.dispose()
    room.traverse(o => { o.geometry?.dispose(); if (o.material) o.material.dispose() })
    await new Promise(r => setTimeout(r))
    t0 = performance.now()
    const hemi = new THREE.HemisphereLight('#f4f8ff', '#c4ccd6', 1.05)
    // The one shadow: a cool spot just under the ceiling, a little off the vent, pooling round the pedestal.
    const key = new THREE.SpotLight('#eef4ff', 70, 0, 0.95, 0.85, 2)
    key.position.set(1.1, 3.92, 1.9)
    key.target.position.set(0, 0, 0)
    key.castShadow = true
    key.shadow.mapSize.setScalar(mobile ? 1024 : 2048)
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 9
    // The screen's glow on his face and hands while he works (no shadow).
    const glow = new THREE.PointLight('#7fc4ff', 0, 1.6, 2)
    glow.position.set(0, 1.2, -0.55)
    scene.add(hemi, key, key.target, glow)

    // ------------------------------------------------------------ canvases: tiles, panels, the screen
    const canvas = (w, h, draw) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      draw(c.getContext('2d'), w, h)
      const tx = new THREE.CanvasTexture(c)
      tx.colorSpace = THREE.NoColorSpace
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping
      tx.anisotropy = 8
      return tx
    }
    const S = mobile ? 512 : 1024
    // Pressure tiles: 0.6 m squares (the canvas holds 2 x 2), seams, a faint bevel, a sensor dot at each corner.
    const tiles = canvas(S, S, (g, w) => {
      const q = w / 2
      g.fillStyle = '#e6ebf0'
      g.fillRect(0, 0, w, w)
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const x = i * q, y = j * q
        const gr = g.createLinearGradient(x, y, x + q, y + q)
        gr.addColorStop(0, '#eef2f6')
        gr.addColorStop(1, '#dfe5eb')
        g.fillStyle = gr
        g.fillRect(x + 4, y + 4, q - 8, q - 8)
        g.strokeStyle = 'rgba(255,255,255,.8)'
        g.lineWidth = 2
        g.strokeRect(x + 7, y + 7, q - 14, q - 14)
      }
      g.fillStyle = '#9aa6b3'
      for (let i = 0; i <= 2; i++) {
        g.fillRect(i * q - 3, 0, 6, w)
        g.fillRect(0, i * q - 3, w, 6)
      }
      g.fillStyle = '#7f8c99'
      for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) { g.beginPath(); g.arc(i * q, j * q, 9, 0, 7); g.fill() }
    })
    tiles.repeat.set(W / 1.2, W / 1.2)
    // Wall panels: 1.2 m wide, full height (the canvas holds one), a recessed kick and a seam at 2.6 m.
    const panels = canvas(S / 2, S, (g, w, h) => {
      g.fillStyle = '#edf0f4'
      g.fillRect(0, 0, w, h)
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, 'rgba(120,135,150,.28)')
      gr.addColorStop(0.08, 'rgba(120,135,150,0)')
      gr.addColorStop(0.9, 'rgba(120,135,150,0)')
      gr.addColorStop(1, 'rgba(120,135,150,.35)')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#aab4bf'
      g.fillRect(0, 0, 3, h)
      g.fillRect(w - 3, 0, 3, h)
      const seam = y => { g.fillStyle = '#aeb8c3'; g.fillRect(0, y - 2, w, 4); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, y + 2, w, 2) }
      seam(h * (1 - 2.6 / H))
      seam(h * (1 - 0.16 / H))
      g.fillStyle = '#c9d1da'
      g.fillRect(0, h * (1 - 0.16 / H) + 4, w, h * (0.16 / H))
    })
    panels.repeat.set(W / 1.2, 1)
    const ceilTex = canvas(S / 2, S / 2, (g, w) => {
      g.fillStyle = '#eceff3'
      g.fillRect(0, 0, w, w)
      g.fillStyle = '#b3bcc6'
      g.fillRect(0, 0, w, 3)
      g.fillRect(0, 0, 3, w)
      g.fillStyle = 'rgba(255,255,255,.6)'
      g.fillRect(3, 3, w, 2)
      g.fillRect(3, 3, 2, w)
    })
    ceilTex.repeat.set(1 / 1.2, 1 / 1.2)
    await step()

    // ------------------------------------------------------------ the room
    const white = (map, rough = 0.6) => new THREE.MeshStandardMaterial({ color: '#ffffff', map, roughness: rough, metalness: 0 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, W), white(tiles, 0.32))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    const wallMat = white(panels, 0.7)
    const walls = []
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat)
      const a = (i * Math.PI) / 2
      m.position.set(Math.sin(a) * -W / 2, H / 2, Math.cos(a) * -W / 2)
      m.rotation.y = a
      m.receiveShadow = true
      walls.push(m)
    }
    // The ceiling, with the vent's opening cut out of it.
    const shape = new THREE.Shape().moveTo(-W / 2, -W / 2).lineTo(W / 2, -W / 2).lineTo(W / 2, W / 2).lineTo(-W / 2, W / 2).closePath()
    shape.holes.push(new THREE.Path().moveTo(VX - VS / 2, VZ - VS / 2).lineTo(VX - VS / 2, VZ + VS / 2).lineTo(VX + VS / 2, VZ + VS / 2).lineTo(VX + VS / 2, VZ - VS / 2).closePath())
    const ceiling = new THREE.Mesh(new THREE.ShapeGeometry(shape), Object.assign(white(ceilTex, 0.75), { emissive: new THREE.Color(0.34, 0.36, 0.4) })) // a luminous ceiling: the lamps light the room, not it
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = H
    // The vent's shaft: dark, unlit, fading to black as it rises.
    const shaftMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying float vY; void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'varying float vY; void main() { float k = exp(-max(vY + 1.7, 0.) * 1.1); gl_FragColor = vec4(vec3(.52, .55, .6) * k + .015, 1.); }',
    })
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(VS, 3.4, VS), shaftMat)
    shaft.position.set(VX, H + 1.7 - 0.001, VZ)
    // A grille: a frame and slats in one geometry, shared by the vent and the lit grilles in the ceiling.
    const bx = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)
    const G = VS - 0.02, parts = [bx(G, 0.03, 0.03, 0, 0, -G / 2 + 0.015), bx(G, 0.03, 0.03, 0, 0, G / 2 - 0.015), bx(0.03, 0.03, G, -G / 2 + 0.015, 0, 0), bx(0.03, 0.03, G, G / 2 - 0.015, 0, 0)]
    for (let i = 1; i < 10; i++) parts.push(bx(0.012, 0.028, G - 0.03, -G / 2 + (i * G) / 10, 0, 0))
    const grilleGeo = mergeGeometries(parts)
    const grilleMat = new THREE.MeshStandardMaterial({ color: '#d9dfe6', roughness: 0.45, metalness: 0.3 })
    const grille = new THREE.Mesh(grilleGeo, grilleMat)
    grille.position.set(VS / 2 - 0.01, -0.015, 0) // hinged on its -x edge
    const hinge = new THREE.Group()
    hinge.position.set(VX - VS / 2 + 0.01, H, VZ)
    hinge.add(grille)
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2e34', roughness: 0.4, metalness: 0.7 }))
    pulley.position.set(VX, H + 0.42, VZ)
    scene.add(floor, ...walls, ceiling, shaft, hinge, pulley)
    await step()

    // The lit grilles in the ceiling's corners (a cool glow behind the slats) and the light lines: coves
    // round the ceiling, a kick light round the floor and two bars across the ceiling, all one instanced box.
    const spots = [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.4], [2.2, 2.4]]
    const vents = new THREE.InstancedMesh(grilleGeo, grilleMat, spots.length)
    const backs = new THREE.InstancedMesh(new THREE.PlaneGeometry(VS - 0.06, VS - 0.06).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.62, 1.8) }), spots.length)
    const m4 = new THREE.Matrix4()
    spots.forEach(([x, z], i) => {
      vents.setMatrixAt(i, m4.makeTranslation(x, H - 0.016, z))
      backs.setMatrixAt(i, m4.makeTranslation(x, H - 0.004, z))
    })
    const lines = []
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2, s = Math.sin(a), c = Math.cos(a)
      lines.push([s * -(W / 2 - 0.02), H - 0.05, c * -(W / 2 - 0.02), a, W - 0.1, 0.022]) // the cove
      lines.push([s * -(W / 2 - 0.02), 0.08, c * -(W / 2 - 0.02), a, W - 0.1, 0.012]) // the kick
    }
    lines.push([0, H - 0.008, -1.9, 0, 4.6, 0.006, 0.16], [0, H - 0.008, 2.7, 0, 4.6, 0.006, 0.16])
    const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 2.0, 2.2) }), lines.length)
    const q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3()
    lines.forEach(([x, y, z, a, len, h, d = 0.03], i) => strips.setMatrixAt(i, m4.compose(v4.set(x, y, z), q4.setFromAxisAngle(UP, a), s4.set(len, h, d))))
    // The vault door's seam on the far wall: a ring and its hub, flush.
    const doorMat = new THREE.MeshStandardMaterial({ color: '#c4ccd5', roughness: 0.4, metalness: 0.4 })
    const door = new THREE.Group()
    door.add(new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.025, 8, 96), doorMat), new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.012, 6, 96), doorMat))
    const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12).rotateX(Math.PI / 2), doorMat, 12)
    for (let i = 0; i < 12; i++) bolts.setMatrixAt(i, m4.makeTranslation(Math.cos((i / 12) * Math.PI * 2) * 1.065, Math.sin((i / 12) * Math.PI * 2) * 1.065, 0))
    door.add(bolts)
    door.position.set(0, 1.55, -W / 2 + 0.012)
    // The sensor beams: a hot core and a soft glow, low across the far wall and along the left.
    const beams = [[0, 0.22, -2.7, Math.PI / 2, W], [-2.5, 0.55, 0, 0, W]]
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateZ(Math.PI / 2)
    const addMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    const core = new THREE.InstancedMesh(beamGeo, addMat(RED), beams.length)
    const halo = new THREE.InstancedMesh(beamGeo, addMat(RED.clone().multiplyScalar(0.06)), beams.length)
    const emit = new THREE.InstancedMesh(new RoundedBoxGeometry(0.08, 0.08, 0.05, 2, 0.015), new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.4, metalness: 0.5 }), beams.length * 2)
    beams.forEach(([x, y, z, a, len], i) => {
      core.setMatrixAt(i, m4.compose(v4.set(x, y, z), q4.setFromAxisAngle(UP, a + Math.PI / 2), s4.set(len, 0.0032, 0.0032)))
      halo.setMatrixAt(i, m4.compose(v4.set(x, y, z), q4, s4.set(len, 0.03, 0.03)))
      for (const e of [-1, 1]) {
        const ex = x + Math.sin(a) * e * (W / 2 - 0.02), ez = z + Math.cos(a) * e * (W / 2 - 0.02)
        emit.setMatrixAt(i * 2 + (e > 0 ? 1 : 0), m4.compose(v4.set(ex, y, ez), q4.setFromAxisAngle(UP, a), s4.set(1, 1, 1)))
      }
    })
    scene.add(vents, backs, strips, door, core, halo, emit)
    await step()

    // ------------------------------------------------------------ the pedestal and its terminal
    const gloss = new THREE.MeshStandardMaterial({ color: '#f4f6f9', roughness: 0.22, metalness: 0 })
    const dark = new THREE.MeshStandardMaterial({ color: '#15191f', roughness: 0.25, metalness: 0.3 })
    const ped = new THREE.Group()
    ped.position.set(0, 0, PZ)
    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.castShadow = m.receiveShadow = true
      ped.add(m)
      return m
    }
    part(new RoundedBoxGeometry(0.62, 0.05, 0.62, 2, 0.02), gloss, 0, 0.025, 0)
    part(new RoundedBoxGeometry(0.32, 0.84, 0.32, 3, 0.04), gloss, 0, 0.47, 0)
    part(new RoundedBoxGeometry(0.58, 0.06, 0.44, 3, 0.02), gloss, 0, 0.9, 0)
    part(new THREE.BoxGeometry(0.5, 0.004, 0.36), dark, 0, 0.932, 0)
    // the keyboard: a dark slab and its keys (one instanced mesh), softly backlit
    part(new RoundedBoxGeometry(0.33, 0.014, 0.12, 2, 0.005), dark, KEYS.x, KEYS.y - 0.013, KEYS.z - PZ)
    const keyMat = new THREE.MeshStandardMaterial({ color: '#262c34', roughness: 0.5, emissive: new THREE.Color('#2e6fa6'), emissiveIntensity: 0.18 })
    const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.019, 0.008, 0.019, 1, 0.003), keyMat, 52)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 13; c++) keys.setMatrixAt(r * 13 + c, m4.makeTranslation(KEYS.x + (c - 6) * 0.0235 + (r % 2) * 0.006, KEYS.y - 0.002, KEYS.z - PZ + (r - 1.5) * 0.0235))
    keys.castShadow = true
    ped.add(keys)
    // the monitor, on a short neck at the back of the console, its face toward him (+z)
    part(new THREE.BoxGeometry(0.05, 0.18, 0.03), gloss, 0, 1.02, -0.13)
    const mon = part(new RoundedBoxGeometry(0.48, 0.31, 0.03, 2, 0.01), dark, 0, 1.24, -0.12)
    mon.rotation.x = -0.12
    const screenCanvas = document.createElement('canvas')
    screenCanvas.width = mobile ? 512 : 1024
    screenCanvas.height = mobile ? 640 : 1280
    const screenTex = new THREE.CanvasTexture(screenCanvas)
    screenTex.colorSpace = THREE.NoColorSpace
    const screenU = { uMap: { value: screenTex }, uProg: { value: 0 }, uGrant: { value: 0 }, uTime: { value: 0 }, uOn: { value: 0.6 } }
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.275),
      new THREE.ShaderMaterial({
        uniforms: screenU,
        toneMapped: false,
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform float uProg, uGrant, uTime, uOn; varying vec2 vUv;
          void main() {
            vec2 px = vec2(vUv.x, 1. - vUv.y) * vec2(1024., 640.); // the panel's own pixels, from the top left
            vec3 work = texture2D(uMap, vec2(vUv.x, .5 + vUv.y * .5)).rgb;
            vec3 done = texture2D(uMap, vec2(vUv.x, vUv.y * .5)).rgb;
            // the code rows come in as the key is worked out; the bar fills
            float row = floor((px.y - 170.) / 30.);
            float rows = step(px.y, 170.) + step(500., px.y) + step(row, uProg * 11. - 1.) * step(170., px.y) * step(px.y, 500.);
            work *= min(rows, 1.);
            float bar = step(64., px.x) * step(px.x, 64. + uProg * 896.) * step(548., px.y) * step(px.y, 580.);
            work = mix(work, vec3(.45, .9, 1.), bar);
            float flick = 1. - .5 * step(.5, fract(uTime * 7.)) * step(uGrant, .99) * step(.01, uGrant);
            vec3 c = mix(work, done * flick, step(.5, uGrant));
            c *= .96 + .04 * sin(px.y * 1.6 + uTime * 9.);
            gl_FragColor = vec4(c * uOn * 1.6, 1.);
          }`,
      }),
    )
    screen.position.set(0, 1.24, -0.12 + 0.0155)
    screen.rotation.x = -0.12
    ped.add(screen)
    // the data drive, in the port on the console's front edge, a cyan light at its end
    part(new THREE.BoxGeometry(0.04, 0.02, 0.008), dark, PORT.x, PORT.y, PORT.z - PZ + 0.002)
    const driveGeo = mergeGeometries([new RoundedBoxGeometry(0.024, 0.012, 0.064, 2, 0.003), new THREE.BoxGeometry(0.012, 0.004, 0.004).translate(0, 0.002, 0.033)].map(g => (g.index ? g.toNonIndexed() : g)))
    const drive = new THREE.Mesh(driveGeo, new THREE.MeshStandardMaterial({ color: '#1b1f25', roughness: 0.3, metalness: 0.6, emissive: '#36d6ff', emissiveIntensity: 0 }))
    drive.castShadow = true
    scene.add(ped, drive)
    await step()
    // The screen's two panels, drawn once: working (top) and granted (bottom), each 1024 x 640. Generic words only.
    {
      try { await Promise.race([Promise.all(['600 40px "Geist Mono Variable"', '800 90px "Archivo Variable"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]) } catch { /* the fallbacks draw */ }
      const g = screenCanvas.getContext('2d'), k = screenCanvas.width / 1024
      g.scale(k, k)
      const mono = (s, w = 500) => `${w} ${s}px "Geist Mono Variable", ui-monospace, monospace`
      const panel = (y0, bg) => { g.fillStyle = bg; g.fillRect(0, y0, 1024, 640) }
      panel(0, '#04101b')
      g.fillStyle = '#8fd8ff'
      g.font = mono(30, 600)
      g.fillText('NODE 07  /  ISOLATED', 64, 76)
      g.fillStyle = '#4f86a8'
      g.font = mono(24)
      g.fillText('KEY EXCHANGE  ·  STAGE 4 OF 4', 64, 120)
      g.fillRect(64, 140, 896, 2)
      let s = 11
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      g.font = mono(22)
      for (let r = 0; r < 11; r++) {
        let line = ''
        for (let i = 0; i < 9; i++) line += (rnd() * 0xffff | 0).toString(16).toUpperCase().padStart(4, '0') + '  '
        g.fillStyle = r % 3 === 2 ? '#bfeaff' : '#5aa3cc'
        g.fillText(line, 64, 192 + r * 30)
      }
      g.strokeStyle = '#4f86a8'
      g.lineWidth = 2
      g.strokeRect(62, 546, 900, 36)
      g.fillStyle = '#4f86a8'
      g.font = mono(22)
      g.fillText('DECRYPTING', 64, 534)
      panel(640, '#041a14')
      g.strokeStyle = '#6ff0b8'
      g.lineWidth = 4
      g.strokeRect(64, 640 + 64, 896, 512)
      g.fillStyle = '#d8ffef'
      g.font = '800 84px "Archivo Variable", "Arial Black", sans-serif'
      g.textAlign = 'center'
      g.fillText('ACCESS GRANTED', 512, 640 + 330)
      g.fillStyle = '#6ff0b8'
      g.font = mono(28, 600)
      g.fillText('KEY VERIFIED  ·  FILE COPIED', 512, 640 + 420)
      screenTex.needsUpdate = true
    }
    await step()

    // ------------------------------------------------------------ him, the harness and the cables
    const cableMat = new THREE.MeshStandardMaterial({ color: '#0d0f12', roughness: 0.35, metalness: 0.4 })
    const cables = [0, 1].map(() => new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 1, 6), cableMat))
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.008, 14, 10), new THREE.MeshStandardMaterial({ color: '#cfe2f0', roughness: 0.03, metalness: 0.1, envMapIntensity: 3, emissive: '#bfe0ff', emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }))
    bead.scale.setScalar(1e-4)
    scene.add(...cables, bead)

    const rig = new THREE.Group() // pivots on the harness ring: head +y, front +z, his left +x
    rig.rotation.order = 'YXZ'
    let you = null, ring = null, back = null
    const B = {}, restB = [], restQ = [], R = {}
    try {
      const [t, suit] = await loads
      you = t.make({ look: 'pbr' })
      you.root.traverse(o => {
        if (!o.isSkinnedMesh) return
        o.material.map = alohaLinear()
        o.castShadow = false // the suit casts his shadow
        headOnly(o.material, o.skeleton.bones.map(b => (['Head', 'head_end', 'headfront'].includes(b.name) ? 1 : 0)))
      })
      if (mobile) {
        // a phone takes the suit's 2048 px maps at 1024
        const maps = new Set()
        suit.scene.traverse(o => { for (const v of Object.values(o.material ?? {})) if (v?.isTexture && v.image?.width > 1024) maps.add(v) })
        for (const tex of maps) {
          const c = document.createElement('canvas')
          c.width = c.height = 1024
          c.getContext('2d').drawImage(tex.image, 0, 0, 1024, 1024)
          tex.image = c
          tex.needsUpdate = true
        }
      }
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
      wearSuit(you.root, suit.scene)
      for (const n of ['Hips', 'Spine01', 'Spine', 'neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']) B[n] = you.bone(n)
      you.root.traverse(o => { if (o.isBone) { restB.push(o); restQ.push(o.quaternion.clone()) } })
      // the lift point at the back of his belt (the RIG's marker), and one between his shoulder blades
      ring = new THREE.Object3D()
      ring.position.copy(suit.scene.getObjectByName('harness_ring')?.position ?? new THREE.Vector3(0, -5, -12))
      B.Hips.add(ring)
      back = new THREE.Object3D()
      back.position.set(0, 8, -12)
      B.Spine.add(back)
      const clip = holdIn(ring, new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 14), new THREE.MeshStandardMaterial({ color: '#2b2f35', roughness: 0.3, metalness: 0.8 })))
      clip.rotation.y = Math.PI / 2
      rig.add(you.root)
      rig.updateMatrixWorld(true)
      ring.getWorldPosition(v4)
      you.root.position.copy(v4).negate()
      rig.updateMatrixWorld(true)
      // his rest pose in the rig's frame: where each reach starts from
      for (const n of ['LeftArm', 'RightArm', 'LeftHand', 'RightHand', 'LeftUpLeg', 'RightUpLeg', 'LeftFoot', 'RightFoot', 'Head']) R[n] = B[n].getWorldPosition(new THREE.Vector3())
      scene.add(rig)
    } catch (e) {
      console.warn('vault: the traveller did not load', e)
      you = null
    }
    await step()

    // ------------------------------------------------------------ posing
    const _pq = new THREE.Quaternion(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion()
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3()
    const _d = new THREE.Vector3(), _p = new THREE.Vector3(), _E = new THREE.Vector3(), _T = new THREE.Vector3()
    const turn = (bone, q) => { // rotate a bone by a world-space rotation
      bone.parent.getWorldQuaternion(_pq)
      _qa.copy(_pq).invert().multiply(q).multiply(_pq)
      bone.quaternion.premultiply(_qa)
      bone.updateMatrixWorld(true)
    }
    const bend = (bone, axis, angle) => turn(bone, _q.setFromAxisAngle(axis, angle))
    const point = (bone, child, target) => {
      bone.getWorldPosition(_a)
      child.getWorldPosition(_b)
      _b.sub(_a).normalize()
      _T.copy(target).sub(_a).normalize()
      turn(bone, _q.setFromUnitVectors(_b, _T))
    }
    const ik = (up, mid, end, target, pole) => {
      up.getWorldPosition(_A)
      mid.getWorldPosition(_B)
      end.getWorldPosition(_C)
      const a = _A.distanceTo(_B), b = _B.distanceTo(_C)
      _d.subVectors(target, _A)
      const d = THREE.MathUtils.clamp(_d.length(), Math.abs(a - b) + 1e-3, (a + b) * 0.998)
      _d.normalize()
      const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x))
      _p.subVectors(pole, _A)
      _p.addScaledVector(_d, -_p.dot(_d)).normalize()
      _E.copy(_A).addScaledVector(_d, x).addScaledVector(_p, h)
      point(up, mid, _E)
      _E.copy(_A).addScaledVector(_d, d)
      point(mid, end, _E)
    }
    // limb targets, blended from poses in the rig's frame (L) and the room's (world)
    const tgt = { LH: new THREE.Vector3(), RH: new THREE.Vector3(), LF: new THREE.Vector3(), RF: new THREE.Vector3() }
    const pole = { LH: new THREE.Vector3(), RH: new THREE.Vector3(), LF: new THREE.Vector3(), RF: new THREE.Vector3() }
    const _w = new THREE.Vector3(), side = new THREE.Vector3(), head = new THREE.Vector3(), front = new THREE.Vector3()
    const toWorld = (v, x, y, z) => v.set(x, y, z).applyMatrix4(rig.matrixWorld)
    const mixW = (v, x, y, z, k) => k > 0 && v.lerp(_w.set(x, y, z), k)
    const mixL = (v, x, y, z, k) => k > 0 && v.lerp(toWorld(_w, x, y, z), k)
    const hip = new THREE.Vector3(), top = new THREE.Vector3(), mid = new THREE.Vector3(), bk = new THREE.Vector3(), catchAt = new THREE.Vector3(), held = new THREE.Vector3()
    const cable = (m, from, to) => {
      mid.subVectors(to, from)
      const len = mid.length()
      m.scale.set(1, Math.max(len, 1e-3), 1)
      m.quaternion.setFromUnitVectors(UP, mid.multiplyScalar(1 / Math.max(len, 1e-3)))
      m.position.addVectors(from, to).multiplyScalar(0.5)
    }

    run = (state, t, aspect) => {
      const p = state.p ?? 0, still = !!state.still
      camera.aspect = aspect
      camera.updateProjectionMatrix()
      // the grille swings up into the shaft
      hinge.rotation.z = 1.5 * ss(0, 0.035, p)

      // ---- where the ring is, and how he hangs from it
      const y = ringY(p)
      let pitch = lerp(Math.PI, Math.PI / 2, ss(0.12, 0.27, p))
      pitch = lerp(pitch, 0.2, ss(0.865, 0.905, p))
      const yaw = lerp(Math.PI / 2, Math.PI, ss(0.605, 0.675, p))
      const sway = still ? 0 : lerp(1, 0.18, ss(0.24, 0.4, p)) * (1 - ss(0.6, 0.68, p) * 0.7)
      rig.position.set(VX + Math.sin(t * 0.9) * 0.035 * sway, y, VZ + Math.sin(t * 0.7 + 1.2) * 0.025 * sway)
      rig.rotation.set(pitch + Math.sin(t * 0.8) * 0.03 * sway, yaw + Math.sin(t * 0.43) * 0.06 * sway, Math.sin(t * 1.1 + 0.5) * 0.04 * sway)
      here.copy(rig.position)
      aim(p, !!state.portrait, t, still, y)

      if (you) {
        for (let i = 0; i < restB.length; i++) restB[i].quaternion.copy(restQ[i])
        rig.updateMatrixWorld(true)
        side.set(1, 0, 0).applyQuaternion(rig.quaternion)
        head.set(0, 1, 0).applyQuaternion(rig.quaternion)
        front.set(0, 0, 1).applyQuaternion(rig.quaternion)
        const level = ss(0.12, 0.27, p) * (1 - ss(0.865, 0.9, p))
        const spread = ss(0.16, 0.3, p) * (1 - ss(0.6, 0.66, p))
        const work = ss(0.64, 0.69, p) * (1 - ss(0.865, 0.89, p))
        const breath = still ? 0 : Math.sin(t * 1.7) * 0.012
        // the back arched a little and the head up, looking ahead; down at the tiles in the hold; at the screen as he works
        bend(B.Spine01, side, -(0.08 + breath) * level)
        const hang = ss(0.36, 0.44, p) * (1 - ss(0.6, 0.66, p)) // the hold: rigid, face down, reaching for the floor
        const look = lerp(0.55, -0.15, hang) + 0.3 * work
        bend(B.neck, side, -look * level * 0.5)
        bend(B.Head, side, -look * level * 0.6)

        // the hands: tucked by his hips through the vent, spread wide for balance, on the keys, the drive
        const L = R.LeftArm, Rr = R.RightArm
        toWorld(tgt.LH, 0.2, -0.05, 0.12)
        toWorld(tgt.RH, -0.2, -0.05, 0.12)
        mixL(tgt.LH, L.x + 0.56, L.y + 0.12, 0.22, spread)
        mixL(tgt.RH, Rr.x - 0.56, Rr.y + 0.12, 0.22, spread)
        // held: out to his sides for balance, only a little toward the tiles (hovering, never planted on them)
        mixL(tgt.LH, L.x + 0.46, L.y + 0.1, L.z + 0.15, hang)
        mixL(tgt.RH, Rr.x - 0.46, Rr.y + 0.1, Rr.z + 0.15, hang)
        toWorld(pole.LH, L.x + 0.3, L.y - 0.3, -0.5)
        toWorld(pole.RH, Rr.x - 0.3, Rr.y - 0.3, -0.5)
        mixL(pole.LH, L.x + 0.6, L.y - 0.1, L.z, hang)
        mixL(pole.RH, Rr.x - 0.6, Rr.y - 0.1, Rr.z, hang)
        // the bead: it forms at his brow (.49), falls slowly (.505 .. .575) into his left glove, cupped under it
        const fall = ss(0.505, 0.575, p)
        const cup = ss(0.515, 0.555, p) * (1 - ss(0.6, 0.64, p))
        if (p < 0.62) {
          B.Head.getWorldPosition(held).addScaledVector(front, 0.13).addScaledVector(head, 0.06)
          catchAt.set(held.x, 0.13, held.z)
          mixW(tgt.LH, catchAt.x - head.x * 0.07, catchAt.y - 0.02, catchAt.z - head.z * 0.07, cup)
          mixL(pole.LH, L.x + 0.4, L.y - 0.2, -0.3, cup)
        }
        const tap = still ? 0 : 1
        // typing: a slow, small rise and fall over the keys (a fast tap read as a twitch), the hands just above them
        const tl = 0.004 * (1 + Math.sin(t * 4.2)) * tap, tr = 0.004 * (1 + Math.sin(t * 3.7 + 2)) * tap
        mixW(tgt.LH, KEYS.x - 0.075 + Math.sin(t * 1.3) * 0.008 * tap, KEYS.y + 0.05 + tl, KEYS.z + 0.03, work)
        mixW(tgt.RH, KEYS.x + 0.075 + Math.sin(t * 1.1 + 1) * 0.008 * tap, KEYS.y + 0.05 + tr, KEYS.z + 0.03, work)
        mixL(pole.LH, L.x + 0.5, L.y, -0.6, work)
        mixL(pole.RH, Rr.x - 0.5, Rr.y, -0.6, work)
        const reach = ss(0.815, 0.84, p) * (1 - ss(0.865, 0.895, p))
        const pull = ss(0.845, 0.865, p)
        mixW(tgt.RH, PORT.x + 0.01, PORT.y + 0.03, PORT.z + 0.07 + 0.12 * pull, reach)
        // hauled: both hands in at his chest, the drive in his right
        const tuck = ss(0.87, 0.9, p)
        mixL(tgt.LH, 0.12, 0.3, 0.26, tuck)
        mixL(tgt.RH, -0.12, 0.32, 0.28, tuck)
        tgt.LH.y = Math.max(tgt.LH.y, 0.07) // a hand's width over the tiles, never through them
        tgt.RH.y = Math.max(tgt.RH.y, 0.07)
        ik(B.LeftArm, B.LeftForeArm, B.LeftHand, tgt.LH, pole.LH)
        ik(B.RightArm, B.RightForeArm, B.RightHand, tgt.RH, pole.RH)
        // the legs: straight through the vent; level, spread and the feet lifted behind, the knees toward the floor
        const legs = level * (1 - ss(0.865, 0.89, p))
        toWorld(tgt.LF, R.LeftFoot.x, R.LeftFoot.y, R.LeftFoot.z)
        toWorld(tgt.RF, R.RightFoot.x, R.RightFoot.y, R.RightFoot.z)
        mixL(tgt.LF, R.LeftUpLeg.x + 0.2, R.LeftUpLeg.y - 0.72, -0.34 - breath, legs)
        mixL(tgt.RF, R.RightUpLeg.x - 0.2, R.RightUpLeg.y - 0.7, -0.3 + breath, legs)
        toWorld(pole.LF, R.LeftUpLeg.x + 0.1, R.LeftUpLeg.y - 0.4, 0.8)
        toWorld(pole.RF, R.RightUpLeg.x - 0.1, R.RightUpLeg.y - 0.4, 0.8)
        ik(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, tgt.LF, pole.LF)
        ik(B.RightUpLeg, B.RightLeg, B.RightFoot, tgt.RF, pole.RF)

        // the bead and the drive
        if (p < 0.49 || p > 0.62) bead.scale.setScalar(1e-4)
        else {
          bead.scale.setScalar(ss(0.49, 0.505, p) * (1 - ss(0.6, 0.62, p)) + 1e-4)
          bead.scale.y *= 1 + 0.35 * fall * (1 - ss(0.565, 0.575, p))
          if (p < 0.575) bead.position.lerpVectors(held, catchAt, fall * fall * 0.6 + fall * 0.4)
          else B.LeftHand.getWorldPosition(bead.position).addScaledVector(head, 0.05).addScaledVector(front, -0.012)
        }
        const inHand = p >= 0.855
        if (!inHand) drive.position.set(PORT.x, PORT.y, PORT.z + 0.032 + 0.03 * ss(0.845, 0.855, p))
        else B.RightHand.getWorldPosition(drive.position).addScaledVector(head, 0.07)
        drive.quaternion.identity()
        if (inHand) drive.quaternion.copy(rig.quaternion).multiply(_q.setFromAxisAngle(_w.set(1, 0, 0), -Math.PI / 2))
        drive.material.emissiveIntensity = 0.4 + 1.6 * ss(0.79, 0.8, p)

        // the cables, from the pulley to the ring and to his upper back
        ring.getWorldPosition(hip)
        back.getWorldPosition(bk)
        cable(cables[0], top.set(VX + 0.02, H + 0.42, VZ), hip)
        cable(cables[1], top.set(VX - 0.02, H + 0.42, VZ), bk)
        here.copy(hip)
        // no shot may sit inside his head: hold the lens off it and look again
        B.Head.getWorldPosition(_hd)
        const hd = camera.position.distanceTo(_hd)
        if (hd < HEAD_CLEAR) {
          camera.position.sub(_hd).multiplyScalar(HEAD_CLEAR / Math.max(hd, 1e-3)).add(_hd)
          camera.lookAt(_l)
        }
      }

      // the screen: waiting, decrypting while he types, granted
      screenU.uTime.value = t
      screenU.uProg.value = ss(0.69, 0.785, p)
      screenU.uGrant.value = ss(0.79, 0.8, p)
      screenU.uOn.value = 0.55 + 0.45 * ss(0.62, 0.68, p)
      glow.intensity = 0.6 * ss(0.62, 0.68, p) * (1 - ss(0.88, 0.92, p))
      const close = ss(0.49, 0.5, p) * (1 - ss(0.6, 0.61, p)) + ss(0.67, 0.68, p) * (1 - ss(0.85, 0.86, p))
      grade.bloom = 0.55 - 0.25 * close
      grade.threshold = 0.86 + 0.07 * close
      out.dream = 0.35 * ss(0.5, 0.53, p) * (1 - ss(0.575, 0.6, p))
      return out
    }
  })()

  return { scene, camera, update: (state, t, aspect) => (run ? run(state, t, aspect) : frame(state, aspect)), get built() { return !!run } }
}

/* His own body under the suit: only his head is drawn, the suit's collar covering the neck (each vertex follows its strongest
 * bone, as landing.js does), so no shirt or shoe shows through it. */
function headOnly(m, keep) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uKeep = { value: keep }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying float vGone; uniform float uKeep[${keep.length}];`)
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        float bi = skinIndex.x, bw = skinWeight.x;
        if (skinWeight.y > bw) { bw = skinWeight.y; bi = skinIndex.y; }
        if (skinWeight.z > bw) { bw = skinWeight.z; bi = skinIndex.z; }
        if (skinWeight.w > bw) bi = skinIndex.w;
        vGone = 1. - uKeep[int(bi + .5)];`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGone;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vGone > .5) discard;')
  }
  m.customProgramCacheKey = () => 'vault-head'
}
