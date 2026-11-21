import * as THREE from 'three'
import { toon, sky, paintTexture, textSprite, inkBox, inkMesh, lookBelow, FRAME } from './kit'

/*
 * Revere, the film: seen through the glasses. A sunlit garden in the late afternoon; you walk up the
 * path and wave. The glasses find your face (corner brackets close in) and quietly write who you are
 * beside you, so the person wearing them doesn't have to ask. An 11 s loop, the tag up for most of it, and
 * the lens's own outline always in view, so any frame reads as seen through the glasses.
 */
const LOOP = 11

function tree(x, z, s = 1) {
  const g = new THREE.Group()
  const trunk = inkMesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.6 * s, 8), '#6b4a34')
  trunk.position.y = 0.8 * s
  const crown = inkMesh(new THREE.IcosahedronGeometry(1.05 * s, 1), '#5f9a4a')
  crown.position.y = 2.1 * s
  const crown2 = inkMesh(new THREE.IcosahedronGeometry(0.7 * s, 1), '#78b45a')
  crown2.position.set(0.45 * s, 2.6 * s, 0.2 * s)
  g.add(trunk, crown, crown2)
  g.position.set(x, 0, z)
  return g
}

/** Corner brackets drawn as four L-shaped strokes, as a HUD would frame a face. */
function brackets() {
  const g = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe6ff').multiplyScalar(2.2), transparent: true, depthTest: false })
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.012), mat)
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.09), mat)
    h.position.set(sx * 0.155, sy * 0.2, 0)
    v.position.set(sx * 0.2, sy * 0.155, 0)
    h.userData.s = v.userData.s = [sx, sy]
    g.add(h, v)
  }
  g.renderOrder = 10
  return { g, mat }
}

/** A rounded rectangle, centred, as a Shape or Path. */
function rounded(P, w, h, r) {
  const x = -w / 2, y = -h / 2
  P.moveTo(x + r, y)
  P.lineTo(x + w - r, y)
  P.quadraticCurveTo(x + w, y, x + w, y + r)
  P.lineTo(x + w, y + h - r)
  P.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  P.lineTo(x + r, y + h)
  P.quadraticCurveTo(x, y + h, x, y + h - r)
  P.lineTo(x, y + r)
  P.quadraticCurveTo(x, y, x + r, y)
  return P
}

export async function revere({ traveller }) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#f4d9b0', 14, 60)
  scene.add(sky({ top: '#7fa7d8', mid: '#f3c48f', low: '#ffe6c2', sun: '#fff4d6', sunDir: new THREE.Vector3(0.6, 0.18, -1) }))

  const lawn = new THREE.Mesh(new THREE.CircleGeometry(80, 48).rotateX(-Math.PI / 2), toon({ map: paintTexture('#8fbf62', ['#7aad52', '#a6cf73', '#86b85a'], { seed: 31 }) }))
  lawn.material.map.repeat.set(16, 16)
  lawn.receiveShadow = true
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 30).rotateX(-Math.PI / 2), toon({ map: paintTexture('#e8d2a8', ['#d9c095', '#f3e2bf'], { seed: 32 }) }))
  path.position.set(-1.2, 0.01, -8)
  path.rotation.y = 0.35
  path.receiveShadow = true
  scene.add(lawn, path)
  for (const [x, z, s] of [[-5.5, -6, 1.2], [4.8, -9, 1.4], [-8, -14, 1.6], [9, -4, 1.1], [2, -18, 1.8]]) scene.add(tree(x, z, s))
  // A low fence along the back of the garden.
  for (let i = -12; i <= 12; i++) {
    const post = inkBox(0.1, 0.9, 0.1, '#f2ead8', { width: 0.01 })
    post.position.set(i * 0.8, 0.45, -11)
    scene.add(post)
  }
  const rail = inkBox(20, 0.08, 0.06, '#f2ead8', { width: 0.01 })
  rail.position.set(0, 0.7, -11)
  scene.add(rail)

  const sun = new THREE.DirectionalLight('#fff0d6', 3)
  sun.position.set(6, 9, -6)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 })
  scene.add(sun, new THREE.HemisphereLight('#fff2dc', '#7a9a5a', 1.5))

  // You, walking up the path toward the wearer.
  const you = traveller.make()
  scene.add(you.root)
  const hud = brackets()
  scene.add(hud.g)
  const name = textSprite('Tejas', { font: '620 semi-expanded 92px "Archivo Variable", sans-serif', color: '#ffffff', glow: '#9fd6ff', size: 0.16, width: 512, height: 150, bg: 'rgba(12,22,34,0.55)' })
  const who = textSprite('your grandson · visited on Sunday', { font: '500 30px "Geist Mono Variable", monospace', color: '#e8f4ff', size: 0.085, width: 1024, height: 64, bg: 'rgba(12,22,34,0.55)' })
  for (const sp of [name, who]) {
    sp.material.depthTest = false
    sp.renderOrder = 11
    scene.add(sp)
  }

  // The wearer's eyes: seated on a garden bench, a little below standing height.
  const camera = new THREE.PerspectiveCamera(34, 2.4, 0.1, 400)
  scene.add(camera) // so the lens, parented to it, is drawn
  const head = new THREE.Vector3(), look = new THREE.Vector3()
  const start = new THREE.Vector3(-2.8, 0, -6.2), stop = new THREE.Vector3(-0.55, 0, -2.4)
  let lastCue = ''

  // The lens: a faint outline and a status light, fixed to the eye, sized to the part of the frame this
  // viewport sees (film.js cropFor). Desktop keeps it off the right third (the card), a phone off its bottom sheet.
  const lensMat = hud.mat.clone()
  Object.assign(lensMat, { opacity: 0.35, depthWrite: false, fog: false })
  const lens = new THREE.Mesh(new THREE.BufferGeometry(), lensMat)
  const status = textSprite('●  REVERE', { font: '500 30px "Geist Mono Variable", monospace', color: '#e8f4ff', size: 1, width: 256, height: 48 })
  Object.assign(status.material, { opacity: 0.85, depthTest: false })
  lens.renderOrder = status.renderOrder = 10
  camera.add(lens, status)
  let lensKey = ''
  function fitLens() {
    const v = camera.view?.enabled ? camera.view : null
    const [x0, vw, y0, vh] = v ? [v.offsetX / v.fullWidth, v.width / v.fullWidth, v.offsetY / v.fullHeight, v.height / v.fullHeight] : [0, 1, 0, 1]
    const key = [x0, vw, y0, vh, FRAME.portrait].join()
    if (key === lensKey) return
    lensKey = key
    const D = 1, H = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), W = H * camera.aspect
    const X = u => (x0 + u * vw - 0.5) * W, Y = q => (0.5 - (y0 + q * vh)) * H, unit = vh * H
    const [u0, u1, q0, q1] = FRAME.portrait ? [0.06, 0.94, 0.125, 0.535] : [0.045, 0.64, 0.1, 0.9]
    const w = X(u1) - X(u0), h = Y(q0) - Y(q1), r = 0.03 * unit, s = 0.0024 * unit
    const shape = rounded(new THREE.Shape(), w, h, r)
    shape.holes.push(rounded(new THREE.Path(), w - 2 * s, h - 2 * s, r - s))
    lens.geometry.dispose()
    lens.geometry = new THREE.ShapeGeometry(shape, 8)
    lens.position.set((X(u0) + X(u1)) / 2, (Y(q0) + Y(q1)) / 2, -D)
    const sh = 0.03 * unit // ~16px words
    status.scale.set(sh * 256 / 48, sh, 1)
    status.position.set(X(u0) + r + sh * 2, Y(q0) - r - sh * 0.2, -D)
  }

  function update(time) {
    const t = time % LOOP
    const walkK = THREE.MathUtils.smoothstep(t, 0, 2.2)
    const cue = t < 2.2 ? 'walk' : t < 3.4 ? 'wave' : 'chat'
    if (cue !== lastCue) {
      lastCue = cue
      you.play(cue === 'walk' ? 'Walk' : cue === 'wave' ? 'Wave_One_Hand' : 'Stand_and_Chat', { fade: 0.4 })
    }
    you.root.position.copy(start).lerp(stop, walkK)
    // Walk along the path, then turn to face the wearer.
    const face = Math.atan2(-you.root.position.x, 1.2 - you.root.position.z)
    const along = Math.atan2(stop.x - start.x, stop.z - start.z)
    you.root.rotation.y = THREE.MathUtils.lerp(along, face, THREE.MathUtils.smoothstep(t, 1.6, 2.4))

    you.bone('Head').getWorldPosition(head)
    // The glasses find the face: brackets close in from wide, then hold.
    const find = THREE.MathUtils.smoothstep(t, 2.4, 2.9)
    const spread = 1 + (1 - find) * 1.6
    hud.g.position.copy(head).add(new THREE.Vector3(0, 0.02, 0))
    hud.g.quaternion.copy(camera.quaternion)
    hud.g.children.forEach(m => {
      const [sx, sy] = m.userData.s
      m.position.x = sx * (m.geometry.parameters.width > 0.05 ? 0.155 : 0.2) * spread
      m.position.y = sy * (m.geometry.parameters.width > 0.05 ? 0.2 : 0.155) * spread
    })
    const out = 1 - THREE.MathUtils.smoothstep(t, 10.5, 11)
    hud.mat.opacity = find * out * (0.85 + 0.15 * Math.sin(time * 6))
    name.material.opacity = THREE.MathUtils.smoothstep(t, 2.9, 3.3) * out
    who.material.opacity = THREE.MathUtils.smoothstep(t, 3.2, 3.6) * out
    // The tag sits under the face, inside the frame the glasses drew, clear of the title card.
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    name.position.copy(head).addScaledVector(up, -0.36)
    who.position.copy(head).addScaledVector(up, -0.5)

    // The wearer looks at whoever is coming, with a little head sway.
    camera.position.set(0.15 + Math.sin(time * 0.4) * 0.02, 1.32 + Math.sin(time * 0.7) * 0.01, 1.4)
    // A phone frames the face in its top third, so the tag under it clears the bottom sheet.
    if (FRAME.portrait) lookBelow(camera, head, 0.44)
    else camera.lookAt(look.copy(head).add(new THREE.Vector3(0.75, -0.15, 0)))
    fitLens()
  }

  return { scene, camera, update, tick(dt) { you.mixer.update(dt) } }
}
