import * as THREE from 'three'
import { toon, sky, paintTexture, textSprite, inkBox, inkMesh } from './kit'

/*
 * Revere, the film: seen through the glasses. A sunlit garden in the late afternoon; you walk up the
 * path and wave. The glasses find your face (corner brackets close in) and quietly write who you are
 * beside you, so the person wearing them doesn't have to ask. An 11 s loop.
 */
const LOOP = 11

function tree(x, z, s = 1) {
  const g = new THREE.Group()
  const trunk = inkMesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.6 * s, 8), '#6b4a34')
  trunk.position.y = 0.8 * s
  const crown = inkMesh(new THREE.IcosahedronGeometry(1.05 * s, 1), '#5f9a4a', { flatShading: true })
  crown.position.y = 2.1 * s
  const crown2 = inkMesh(new THREE.IcosahedronGeometry(0.7 * s, 1), '#78b45a', { flatShading: true })
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
  const name = textSprite('Tejas', { font: '400 104px "Instrument Serif", serif', color: '#ffffff', glow: '#9fd6ff', size: 0.16, width: 512, height: 150, bg: 'rgba(12,22,34,0.55)' })
  const who = textSprite('your grandson · visited on Sunday', { font: '500 30px "Geist Mono Variable", monospace', color: '#e8f4ff', size: 0.085, width: 1024, height: 64, bg: 'rgba(12,22,34,0.55)' })
  for (const sp of [name, who]) {
    sp.material.depthTest = false
    sp.renderOrder = 11
    scene.add(sp)
  }

  // The wearer's eyes: seated on a garden bench, a little below standing height.
  const camera = new THREE.PerspectiveCamera(34, 2.4, 0.1, 400)
  const head = new THREE.Vector3(), look = new THREE.Vector3()
  const start = new THREE.Vector3(-3.6, 0, -7.5), stop = new THREE.Vector3(-0.55, 0, -2.4)
  let lastCue = ''

  function update(time) {
    const t = time % LOOP
    const walkK = THREE.MathUtils.smoothstep(t, 0, 3.6)
    const cue = t < 3.5 ? 'walk' : t < 5.2 ? 'wave' : 'chat'
    if (cue !== lastCue) {
      lastCue = cue
      you.play(cue === 'walk' ? 'Walk' : cue === 'wave' ? 'Wave_One_Hand' : 'Stand_and_Chat', { fade: 0.4 })
    }
    you.root.position.copy(start).lerp(stop, walkK)
    // Walk along the path, then turn to face the wearer.
    const face = Math.atan2(-you.root.position.x, 1.2 - you.root.position.z)
    const along = Math.atan2(stop.x - start.x, stop.z - start.z)
    you.root.rotation.y = THREE.MathUtils.lerp(along, face, THREE.MathUtils.smoothstep(t, 2.8, 3.8))

    you.bone('Head').getWorldPosition(head)
    // The glasses find the face: brackets close in from wide, then hold.
    const find = THREE.MathUtils.smoothstep(t, 3.9, 4.6)
    const spread = 1 + (1 - find) * 1.6
    hud.g.position.copy(head).add(new THREE.Vector3(0, 0.02, 0))
    hud.g.quaternion.copy(camera.quaternion)
    hud.g.children.forEach(m => {
      const [sx, sy] = m.userData.s
      m.position.x = sx * (m.geometry.parameters.width > 0.05 ? 0.155 : 0.2) * spread
      m.position.y = sy * (m.geometry.parameters.width > 0.05 ? 0.2 : 0.155) * spread
    })
    hud.mat.opacity = find * (1 - THREE.MathUtils.smoothstep(t, 10.4, 11)) * (0.85 + 0.15 * Math.sin(time * 6))
    const say = THREE.MathUtils.smoothstep(t, 4.7, 5.3) * (1 - THREE.MathUtils.smoothstep(t, 10.4, 11))
    name.material.opacity = say
    who.material.opacity = THREE.MathUtils.smoothstep(t, 5.2, 5.8) * (1 - THREE.MathUtils.smoothstep(t, 10.4, 11))
    // The tag sits under the face, inside the frame the glasses drew, clear of the title card.
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    name.position.copy(head).addScaledVector(up, -0.36)
    who.position.copy(head).addScaledVector(up, -0.5)

    // The wearer looks at whoever is coming, with a little head sway.
    camera.position.set(0.15 + Math.sin(time * 0.4) * 0.02, 1.32 + Math.sin(time * 0.7) * 0.01, 1.4)
    look.copy(head).add(new THREE.Vector3(0.75, -0.15, 0))
    camera.lookAt(look)
  }

  return { scene, camera, update, tick(dt) { you.mixer.update(dt) } }
}
