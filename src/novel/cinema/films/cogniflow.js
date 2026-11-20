import * as THREE from 'three'
import { toon, paintTexture, textSprite, inkBox, inkMesh, frameLeft } from './kit'

/*
 * CogniFlow, the film: late at night at a desk. A ring of focus glows around your head. Distractions
 * drift in out of the dark (a buzzing phone, a chat bubble, a controller) and the ring drains toward
 * amber. Just before it breaks, a gentle nudge arrives; the distractions dissolve, you lean back and
 * breathe, and the ring fills again. A 10 s loop.
 */
const LOOP = 10

function icon(kind) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.lineWidth = 12
  g.lineJoin = g.lineCap = 'round'
  g.strokeStyle = '#1a1410'
  g.fillStyle = { phone: '#ffb35c', chat: '#8fd3ff', pad: '#c7a2ff', bell: '#ffd84d' }[kind]
  const path = {
    phone: () => { g.beginPath(); g.roundRect(78, 30, 100, 196, 22) },
    chat: () => { g.beginPath(); g.roundRect(30, 50, 196, 130, 40); g.moveTo(70, 180); g.lineTo(60, 226); g.lineTo(110, 180) },
    pad: () => { g.beginPath(); g.roundRect(24, 80, 208, 110, 55) },
    bell: () => { g.beginPath(); g.moveTo(128, 36); g.bezierCurveTo(60, 50, 70, 150, 40, 186); g.lineTo(216, 186); g.bezierCurveTo(186, 150, 196, 50, 128, 36) },
  }[kind]
  path()
  g.fill()
  g.stroke()
  // A red badge: something wants you.
  g.beginPath()
  g.arc(200, 56, 30, 0, Math.PI * 2)
  g.fillStyle = '#ff3b30'
  g.fill()
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
}

function nightWindow() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 384
  const g = c.getContext('2d')
  const sky = g.createLinearGradient(0, 0, 0, 384)
  sky.addColorStop(0, '#0d1638')
  sky.addColorStop(1, '#3b3f7a')
  g.fillStyle = sky
  g.fillRect(0, 0, 512, 384)
  g.fillStyle = '#fff3c4'
  g.beginPath()
  g.arc(390, 90, 34, 0, Math.PI * 2)
  g.fill()
  for (let i = 0; i < 18; i++) {
    const w = 18 + (i * 37) % 30, h = 80 + ((i * 53) % 160), x = i * 30 - 10
    g.fillStyle = '#141a3a'
    g.fillRect(x, 384 - h, w, h)
    g.fillStyle = '#ffd98a'
    for (let y = 384 - h + 10; y < 380; y += 16) for (let xx = x + 4; xx < x + w - 4; xx += 8) if ((xx * 7 + y * 3) % 5 === 0) g.fillRect(xx, y, 3, 5)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export async function cogniflow({ traveller }) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#141225')
  scene.fog = new THREE.Fog('#141225', 10, 30)

  // The room: a wall with a window on the city, a floor, a desk, a lamp, a laptop.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), toon({ map: paintTexture('#3a3156', ['#2f2848', '#463c66', '#352d50'], { seed: 21 }) }))
  wall.position.set(0, 5, -3)
  wall.receiveShadow = true
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20).rotateX(-Math.PI / 2), toon({ map: paintTexture('#5a3f35', ['#4a332b', '#6b4c40', '#523a31'], { seed: 22 }) }))
  floor.receiveShadow = true
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), new THREE.MeshBasicMaterial({ map: nightWindow() }))
  win.position.set(-2.4, 2.6, -2.97)
  const frame = inkBox(3.4, 2.6, 0.08, '#d8c7a6')
  frame.position.set(-2.4, 2.6, -3.02)
  scene.add(wall, floor, frame, win)

  const desk = new THREE.Group()
  const top = inkBox(2.2, 0.08, 0.95, '#a8744c')
  top.position.y = 0.76
  desk.add(top)
  for (const [x, z] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) {
    const leg = inkBox(0.07, 0.74, 0.07, '#6d4a31')
    leg.position.set(x, 0.37, z)
    desk.add(leg)
  }
  const base = inkBox(0.62, 0.03, 0.42, '#c9ced8')
  base.position.set(0.15, 0.815, 0.05)
  const lid = inkBox(0.62, 0.4, 0.03, '#c9ced8')
  lid.position.set(0.15, 1.02, -0.17)
  lid.rotation.x = -0.25
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.33), new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fd6ff').multiplyScalar(1.6) }))
  glow.position.set(0.15, 1.02, -0.15)
  glow.rotation.x = -0.25
  const lampBase = inkMesh(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 20), '#2c3a4a')
  lampBase.position.set(-0.75, 0.82, -0.2)
  const lampArm = inkBox(0.03, 0.55, 0.03, '#2c3a4a')
  lampArm.position.set(-0.75, 1.08, -0.2)
  const shade = inkMesh(new THREE.ConeGeometry(0.16, 0.2, 20, 1, true), '#e0b04a', { side: THREE.DoubleSide })
  shade.position.set(-0.62, 1.32, -0.2)
  shade.rotation.z = 0.6
  const bulb = new THREE.PointLight('#ffc27a', 6, 6, 1.6)
  bulb.position.set(-0.58, 1.2, -0.15)
  bulb.castShadow = true
  desk.add(base, lid, glow, lampBase, lampArm, shade, bulb)
  desk.position.set(-0.4, 0, 0)
  scene.add(desk)

  const chair = new THREE.Group()
  const seat = inkBox(0.5, 0.06, 0.5, '#2f5f73')
  seat.position.y = 0.46
  const back = inkBox(0.5, 0.6, 0.06, '#2f5f73')
  back.position.set(0, 0.8, 0.25)
  chair.add(seat, back)
  for (const [x, z] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) {
    const leg = inkBox(0.04, 0.44, 0.04, '#1e3a47')
    leg.position.set(x, 0.22, z)
    chair.add(leg)
  }
  chair.position.set(-0.25, 0, 0.75)
  scene.add(chair)

  // You, at the desk.
  const you = traveller.make()
  you.root.position.set(-0.25, 0.02, 0.62)
  you.root.rotation.y = Math.PI
  scene.add(you.root)

  // The ring of focus around your head: an arc of light that drains and refills.
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#7ff0ff').multiplyScalar(3), transparent: true })
  let ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.018, 8, 64, Math.PI * 2), ringMat)
  scene.add(ring)
  const icons = ['phone', 'chat', 'pad', 'bell', 'phone', 'chat'].map((k, i) => {
    const sp = icon(k)
    sp.userData = { a: (i / 6) * Math.PI * 2, r: 2.6 + (i % 3) * 0.5, y: 1.3 + (i % 2) * 0.6 }
    scene.add(sp)
    return sp
  })
  const nudge = textSprite('Take two minutes. Then one small step.', { font: 'italic 400 44px "Instrument Serif", serif', color: '#fff7e6', glow: '#7ff0ff', size: 0.34, width: 1024, height: 120 })
  scene.add(nudge)

  scene.add(new THREE.HemisphereLight('#9a8fd6', '#3a2b2a', 1.1))
  const moon = new THREE.DirectionalLight('#9fb6ff', 1.4)
  moon.position.set(-4, 5, 2)
  scene.add(moon)

  const camera = new THREE.PerspectiveCamera(30, 2.4, 0.1, 100)
  const head = new THREE.Vector3(), subject = new THREE.Vector3()
  let lastCue = ''

  function update(time) {
    const t = time % LOOP
    const lean = t > 6.0 && t < 8.2
    const cue = lean ? 'lean' : 'sit'
    if (cue !== lastCue) {
      lastCue = cue
      you.play(lean ? 'Sit_Hands_on_Head_Lean_Back' : 'Chair_Sit_Idle_M', { fade: 0.5 })
    }
    // Focus drains while the distractions close in, and comes back after the nudge.
    const drain = THREE.MathUtils.smoothstep(t, 0.5, 5.5)
    const refill = THREE.MathUtils.smoothstep(t, 7.4, 9.6)
    const focus = 1 - drain * 0.78 + refill * 0.78
    const arc = Math.max(0.05, Math.min(1, focus)) * Math.PI * 2
    if (Math.abs(ring.geometry.parameters.arc - arc) > 0.02) {
      ring.geometry.dispose()
      ring.geometry = new THREE.TorusGeometry(0.34, 0.018, 8, 64, arc)
    }
    ringMat.color.set(focus > 0.6 ? '#7ff0ff' : focus > 0.35 ? '#ffd27a' : '#ff8a5c').multiplyScalar(3)
    you.bone('Head').getWorldPosition(head)
    ring.position.copy(head).add(new THREE.Vector3(0, 0.22, 0))
    ring.rotation.set(Math.PI / 2 + 0.25, 0, time * 0.3)
    // Distractions spiral in; the nudge sends them away.
    const away = THREE.MathUtils.smoothstep(t, 5.6, 6.6) * (1 - THREE.MathUtils.smoothstep(t, 9.6, 10))
    icons.forEach((sp, i) => {
      const u = sp.userData
      const close = drain * (1 - away)
      const r = u.r - close * (u.r - 0.75)
      const a = u.a + time * (0.25 + i * 0.03)
      sp.position.set(head.x + Math.cos(a) * r, u.y + close * (head.y - u.y) * 0.6 + Math.sin(time * 2 + i) * 0.05, head.z + Math.sin(a) * r * 0.6)
      sp.material.opacity = (0.25 + 0.75 * drain) * (1 - away)
      const pulse = 1 + 0.12 * Math.max(0, Math.sin(time * 9 + i * 2)) * drain
      sp.scale.setScalar(0.32 * pulse)
    })
    const n = THREE.MathUtils.smoothstep(t, 5.4, 5.8) * (1 - THREE.MathUtils.smoothstep(t, 8.4, 9))
    nudge.material.opacity = n
    // Above and toward the desk (frame right of the head), clear of the frame's left edge.
    nudge.position.copy(head).add(new THREE.Vector3(0, 0.7 + n * 0.06, -0.2))
    // Camera: in profile across the desk, breathing in slowly.
    const a = 1.25 + Math.sin(time * 0.1) * 0.06
    const d = 5.4 - Math.min(t, 6) * 0.06
    camera.position.set(Math.sin(a) * d - 0.25, 1.7, Math.cos(a) * d + 0.62)
    frameLeft(camera, subject.set(-0.25, 1.2, 0.5), 0.85)
  }

  return { scene, camera, update, tick(dt) { you.mixer.update(dt) } }
}
