import * as THREE from 'three'
import { toon, outline, sky, paintTexture, holdIn } from './kit'

/*
 * Yudhveer, the film: a duel at dusk on a stone ring. You hold sword and shield against your own
 * shadow. It cuts, you parry (sparks), you answer, and you shove it back with the shield. A 9.6 s loop.
 */
const LOOP = 9.6

function sword() {
  const g = new THREE.Group()
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.78, 0.012), toon({ color: '#dfe6ee', emissive: '#30343a' }))
  blade.position.y = 0.5
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.12, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3), blade.material)
  tip.position.y = 0.95
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.05), toon({ color: '#c99a3a' }))
  guard.position.y = 0.1
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), toon({ color: '#3a2216' }))
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), guard.material)
  pommel.position.y = -0.09
  for (const m of [blade, tip, guard, grip, pommel]) {
    outline(m, { width: 0.008 })
    g.add(m)
  }
  return g
}

function shield() {
  const g = new THREE.Group()
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 32).rotateX(Math.PI / 2), toon({ color: '#7b2b1f' }))
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 40), toon({ color: '#c99a3a' }))
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), rim.material)
  boss.position.z = 0.025
  for (const m of [face, rim, boss]) {
    outline(m, { width: 0.008 })
    g.add(m)
  }
  return g
}

export async function yudhveer({ traveller }) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#f0a27a', 26, 95)
  scene.add(sky({ top: '#4b3a78', mid: '#ef7f63', low: '#ffd3a1', sun: '#fff1cf', sunDir: new THREE.Vector3(-0.45, 0.09, -1) }))

  // The ring and the plain around it.
  const plain = new THREE.Mesh(new THREE.CircleGeometry(80, 48).rotateX(-Math.PI / 2), toon({ map: paintTexture('#e3a274', ['#c98257', '#f2c193', '#d4936a'], { seed: 3 }) }))
  plain.material.map.repeat.set(10, 10)
  plain.receiveShadow = true
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.25, 48), toon({ map: paintTexture('#efe1c8', ['#d6c3a3', '#fff4e0', '#e0cdb0'], { seed: 7 }) }))
  ring.position.y = 0.125
  ring.receiveShadow = true
  outline(ring, { width: 0.03 })
  scene.add(plain, ring)
  // Distant hills: flat painted shapes, layered.
  for (const [r, h, col, n] of [[48, 9, '#d27565', 7], [62, 14, '#a8607a', 5]]) {
    const pts = []
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2
      pts.push(new THREE.Vector2(a, h * (0.45 + 0.55 * Math.abs(Math.sin(a * n * 0.5 + r))) * (0.7 + 0.3 * Math.sin(a * 13 + r))))
    }
    const geo = new THREE.BufferGeometry()
    const v = []
    for (let i = 0; i < 64; i++) {
      const [a0, h0] = [pts[i].x, pts[i].y], [a1, h1] = [pts[i + 1].x, pts[i + 1].y]
      const p = (a, y) => [Math.sin(a) * r, y, Math.cos(a) * r]
      v.push(...p(a0, -1), ...p(a1, -1), ...p(a1, h1), ...p(a0, -1), ...p(a1, h1), ...p(a0, h0))
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, fog: true })))
  }

  // Light: a low warm sun behind the shadow, a cool fill, and a rim that draws both silhouettes.
  const sun = new THREE.DirectionalLight('#fff0d8', 3.2)
  sun.position.set(-3, 8, 5)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 })
  const rim = new THREE.DirectionalLight('#ff9a6b', 2.6)
  rim.position.set(-4, 3, -9) // from the sun, behind them
  scene.add(sun, rim, new THREE.HemisphereLight('#fff0e0', '#a0607a', 1.6))

  // The two duellists.
  const you = traveller.make()
  const them = traveller.make({ look: 'shadow' })
  you.root.position.set(-1.05, 0.25, 0)
  you.root.rotation.y = Math.PI / 2
  them.root.position.set(1.05, 0.25, 0)
  them.root.rotation.y = -Math.PI / 2
  scene.add(you.root, them.root)
  holdIn(you.bone('RightHand'), sword()).rotation.set(0, 0, 0)
  holdIn(you.bone('LeftForeArm'), shield()).position.set(0, 0.6, 0)
  holdIn(them.bone('RightHand'), sword())

  // Sparks where the blades meet.
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ color: new THREE.Color('#fff1c4').multiplyScalar(4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, map: sparkTexture() }))
  spark.scale.setScalar(0.01)
  scene.add(spark)

  const camera = new THREE.PerspectiveCamera(28, 2.4, 0.1, 400)
  const beat = (t, a, b) => t >= a && t < b
  let last = -1

  function update(time) {
    const t = time % LOOP
    // Choreography (re-cued only when the beat changes, so cross-fades run their course).
    const cue = beat(t, 0, 2) ? 0 : beat(t, 2, 3.4) ? 1 : beat(t, 3.4, 4.9) ? 2 : beat(t, 4.9, 6.4) ? 3 : 4
    if (cue !== last) {
      last = cue
      if (cue === 0 || cue === 4) { you.play('Combat_Stance'); them.play('Combat_Stance') }
      if (cue === 1) { them.play('Right_Hand_Sword_Slash', { once: true }); you.play('Sword_Parry', { once: true, at: 0.1 }) }
      if (cue === 2) { you.play('Right_Hand_Sword_Slash', { once: true }); them.play('Sword_Parry', { once: true, at: 0.1 }) }
      if (cue === 3) { you.play('Shield_Push_Left', { once: true }); them.play('Combat_Stance') }
    }
    // The shove sends the shadow back a step, and it walks in again.
    const push = THREE.MathUtils.smoothstep(t, 5.3, 5.7) * (1 - THREE.MathUtils.smoothstep(t, 7.2, 9.0))
    them.root.position.x = 1.05 + push * 0.9
    // Sparks on the two contacts.
    const hit = Math.max(Math.exp(-((t - 2.75) ** 2) / 0.004), Math.exp(-((t - 4.05) ** 2) / 0.004))
    spark.scale.setScalar(0.05 + hit * 0.55)
    spark.material.opacity = hit
    spark.position.set(0.05, 1.35, 0.15)
    // Camera: low, from the side, drifting in; a small kick on each hit.
    const a = -0.25 + Math.sin(time * 0.11) * 0.12
    const d = 8.6 - Math.min(t, 6) * 0.12
    camera.position.set(Math.sin(a) * d, 1.15 + hit * 0.03, Math.cos(a) * d)
    camera.lookAt(0.85, 1.05, 0) // the duel sits left of centre; the title takes the right
  }

  return {
    scene, camera, update,
    tick(dt) { you.mixer.update(dt); them.mixer.update(dt) },
  }
}

function sparkTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.15, 'rgba(255,230,170,0.8)')
  r.addColorStop(1, 'rgba(255,120,40,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = 'rgba(255,245,210,0.9)'
  g.lineWidth = 3
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2
    g.beginPath()
    g.moveTo(64, 64)
    g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62)
    g.stroke()
  }
  return new THREE.CanvasTexture(c)
}
