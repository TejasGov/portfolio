import * as THREE from 'three'
import { toon, sky, paintTexture, textSprite, inkBox, inkMesh, frameLeft, FRAME } from './kit'

/*
 * Smash Cricket, the film: a floodlit ground at night. You show your hand to a giant webcam; its beam
 * reads the fingers, the number pops in the beam, a ball flies to the boundary and the board adds
 * the runs. A six gets a cheer. A 10 s loop.
 */
const LOOP = 10
const THROWS = [[0.9, 4], [2.7, 2], [4.4, 6], [7.0, 1], [8.5, 3]] // [time, runs]

function webcam() {
  const g = new THREE.Group()
  const body = inkMesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 16).rotateZ(Math.PI / 2), '#2a2f3a', { width: 0.02 })
  const ring = inkMesh(new THREE.TorusGeometry(0.33, 0.07, 10, 32).rotateY(Math.PI / 2), '#cfd6e2', { width: 0.015 })
  ring.position.x = -0.42
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.27, 32).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fd0ff').multiplyScalar(3) }))
  lens.position.x = -0.47
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4a3a').multiplyScalar(4) }))
  led.position.set(-0.38, 0.32, 0.3)
  const legs = [-0.5, 0.5].map((z, i) => {
    const leg = inkBox(0.06, 2.1, 0.06, '#1b1e26')
    leg.position.set(0.15, -1.05, z * 0.7)
    leg.rotation.x = (i ? -1 : 1) * 0.25
    return leg
  })
  const back = inkBox(0.06, 2.1, 0.06, '#1b1e26')
  back.position.set(0.7, -1.05, 0)
  back.rotation.z = 0.3
  g.add(body, ring, lens, led, ...legs, back)
  return { g, lens, led }
}

function stumps() {
  const g = new THREE.Group()
  for (const x of [-0.11, 0, 0.11]) {
    const s = inkMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.71, 8), '#f1e6c8', { width: 0.008 })
    s.position.set(x, 0.355, 0)
    g.add(s)
  }
  for (const x of [-0.055, 0.055]) {
    const b = inkBox(0.11, 0.02, 0.02, '#e0c27a', { width: 0.005 })
    b.position.set(x, 0.72, 0)
    g.add(b)
  }
  return g
}

function board() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const draw = (runs, last) => {
    const g = c.getContext('2d')
    g.fillStyle = '#10151d'
    g.fillRect(0, 0, 512, 256)
    g.strokeStyle = '#e8c45a'
    g.lineWidth = 8
    g.strokeRect(8, 8, 496, 240)
    g.fillStyle = '#e8c45a'
    g.font = '500 30px "Geist Mono Variable", monospace'
    g.fillText('RUNS', 34, 62)
    g.fillText('LAST BALL', 290, 62)
    g.fillStyle = '#ffffff'
    g.font = '400 150px Anton, Impact, sans-serif'
    g.fillText(String(runs), 34, 220)
    g.fillStyle = '#7fd0ff'
    g.fillText(String(last), 330, 220)
    t.needsUpdate = true
  }
  draw(0, '-')
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }))
  const frame = inkBox(3.4, 1.8, 0.12, '#1d232d')
  frame.position.z = -0.08
  const g = new THREE.Group()
  g.add(frame, m)
  return { g, draw }
}

export async function smash({ traveller }) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#1d3552', 30, 120)
  scene.add(sky({ top: '#070d22', mid: '#16305a', low: '#3c6a8c', sun: '#000000', sunDir: new THREE.Vector3(0, -1, 0) }))

  // The ground: an oval of mown grass with a pitch.
  const grass = new THREE.Mesh(new THREE.CircleGeometry(70, 64).rotateX(-Math.PI / 2), toon({ map: paintTexture('#3f8f4c', ['#2f7a3c', '#5aa860', '#357f43'], { seed: 11 }) }))
  grass.material.map.repeat.set(14, 14)
  grass.receiveShadow = true
  const pitch = inkMesh(new THREE.BoxGeometry(3.05, 0.04, 20.1), '#d8c48f', { width: 0.02 })
  pitch.position.set(-0.4, 0.02, -6)
  const crease = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.05).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fbf6e8' }))
  crease.position.set(-0.4, 0.045, 1.2)
  const wicket = stumps()
  wicket.position.set(-0.4, 0.04, 2.4)
  scene.add(grass, pitch, crease, wicket)

  // Floodlights: towers in silhouette with blazing banks (they bloom in the hall's post).
  const lights = []
  for (const [x, z] of [[-26, -30], [24, -34], [-34, 10], [36, 6]]) {
    const tower = inkBox(0.6, 24, 0.6, '#0b1220', { width: 0.06 })
    tower.position.set(x, 12, z)
    const bank = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6dc').multiplyScalar(6), fog: false }))
    bank.position.set(x, 24.5, z)
    bank.lookAt(0, 0, 0)
    scene.add(tower, bank)
    lights.push(bank)
  }
  const flood = new THREE.DirectionalLight('#eef4ff', 2.6)
  flood.position.set(-8, 14, 10)
  flood.castShadow = true
  flood.shadow.mapSize.set(1024, 1024)
  Object.assign(flood.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 })
  const rim = new THREE.DirectionalLight('#8fd0ff', 2.2)
  rim.position.set(10, 6, -8)
  scene.add(flood, rim, new THREE.HemisphereLight('#bcd7ff', '#1f3a2a', 1.3))

  // You, the webcam, the beam between you, the board.
  const you = traveller.make()
  you.root.position.set(-1.25, 0, 0.4)
  you.root.rotation.y = Math.PI / 2 + 0.25
  scene.add(you.root)
  const cam = webcam()
  cam.g.position.set(0.85, 1.55, -0.45)
  cam.g.rotation.y = -0.2
  cam.g.scale.setScalar(0.6)
  scene.add(cam.g)
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1, 32, 1, true).rotateZ(Math.PI / 2).translate(0.5, 0, 0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fd0ff').multiplyScalar(0.6), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  )
  scene.add(beam)
  const sb = board()
  sb.g.position.set(-3.6, 2.9, -9)
  sb.g.rotation.y = 0.15
  scene.add(sb.g)

  // The numerals, one per count, and the ball.
  const numerals = Object.fromEntries([1, 2, 3, 4, 6].map(n => {
    const sp = textSprite(String(n), { font: '400 220px Anton, Impact, sans-serif', color: '#ffffff', glow: '#7fd0ff', size: 0.9 })
    sp.material.opacity = 0
    scene.add(sp)
    return [n, sp]
  }))
  const ball = inkMesh(new THREE.SphereGeometry(0.11, 16, 12), '#b3241c', { width: 0.01, emissive: '#3a0a06' })
  scene.add(ball)

  const camera = new THREE.PerspectiveCamera(30, 2.4, 0.1, 400)
  const hand = new THREE.Vector3(), lens = new THREE.Vector3(), subject = new THREE.Vector3()
  let lastCue = -1

  function update(time) {
    const t = time % LOOP
    // Which throw are we on?
    let k = -1
    for (let i = 0; i < THROWS.length; i++) if (t >= THROWS[i][0]) k = i
    const [t0, runs] = k >= 0 ? THROWS[k] : [0, 0]
    const since = t - t0
    const six = runs === 6 && since < 2.2
    const cue = six ? 'cheer' : 'hand'
    if (cue !== lastCue) {
      lastCue = cue
      you.play(six ? 'Cheer_with_Both_Hands_Up' : 'Wave_One_Hand', { fade: 0.35 })
    }
    // The board.
    const total = THROWS.slice(0, k + 1).reduce((a, x) => a + x[1], 0)
    if (sb.last !== `${k}`) {
      sb.last = `${k}`
      sb.draw(total, k >= 0 ? runs : '-')
    }
    // The beam reads the raised hand; the numeral pops in the beam beside you.
    you.bone('RightHand').getWorldPosition(hand)
    cam.lens.getWorldPosition(lens)
    beam.position.copy(lens)
    beam.lookAt(hand)
    beam.rotateY(-Math.PI / 2)
    beam.scale.set(lens.distanceTo(hand), 1, 1)
    const read = k >= 0 ? Math.exp(-((since - 0.25) ** 2) / 0.05) : 0
    beam.material.opacity = 0.08 + read * 0.35
    cam.led.material.color.setScalar(read > 0.3 ? 6 : 1.5).multiply(new THREE.Color('#ff4a3a'))
    for (const [n, sp] of Object.entries(numerals)) {
      const on = k >= 0 && +n === runs ? THREE.MathUtils.smoothstep(since, 0.15, 0.35) * (1 - THREE.MathUtils.smoothstep(since, 0.6, 0.9)) : 0 // gone well before the next throw, so no ghost numeral
      sp.material.opacity = on
      // In the beam at chest height, camera-right of you: the board fills the frame above your head (on a phone, the whole top).
      sp.position.set(you.root.position.x + 0.85, 1.4 + since * 0.08, you.root.position.z)
      sp.scale.set(0.9 * 2 * (0.7 + 0.3 * on), 0.9 * (0.7 + 0.3 * on), 1)
    }
    // The ball: off the bat end of the pitch and away to the boundary (sixes go over the lights).
    const fly = k >= 0 ? THREE.MathUtils.clamp((since - 0.4) / 1.3, 0, 1) : 0
    const far = runs === 6 ? 46 : 12 + runs * 6
    ball.visible = fly > 0 && fly < 1
    ball.position.set(-0.4 + fly * far * 0.35, 0.8 + Math.sin(Math.PI * fly) * (runs === 6 ? 18 : 2 + runs), 2 - fly * far)
    // Camera: low, three-quarter, drifting.
    const a = 0.08 + Math.sin(time * 0.1) * 0.06
    camera.position.set(Math.sin(a) * 7.8 - 0.3, 1.5, Math.cos(a) * 7.8)
    frameLeft(camera, subject.set(FRAME.portrait ? -1.1 : -0.3, 1.4, 0), 0.95) // on a phone, centre on you rather than the set
  }

  return { scene, camera, update, tick(dt) { you.mixer.update(dt) } }
}
