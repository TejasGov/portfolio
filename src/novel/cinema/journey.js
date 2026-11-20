import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loadTraveller, toon, sky, paintTexture, frameLeft, lookBelow } from './films/kit'

/*
 * Chapter Three: the traveller's journey. A path across a painted land, from Prayagraj in 2022 to
 * New York in 2026, with a little world (a Meshy diorama) beside it for each stop. You walk it as the
 * reader scrolls and pause at each stop. The world ahead of you is still an ink drawing on the page;
 * it blooms into colour as you reach it (the sketch pass's travelling front, set in timeline.js), and
 * the day moves from morning to night along the way.
 */
export const STOP_GAP = 11
const IDS = ['prayagraj', 'campus', 'gym', 'library', 'garage', 'nyc']
const SKIES = [ // morning → day → afternoon → golden hour → dusk → late dusk
  { top: '#7fb6e6', mid: '#cfe4f2', low: '#fff1d6', sun: '#fff6e0', light: '#fff1dc', k: 2.6 },
  { top: '#5f9fe0', mid: '#b9dcf5', low: '#f3f6ea', sun: '#ffffff', light: '#ffffff', k: 2.8 },
  { top: '#6c96d6', mid: '#d7d8e6', low: '#ffe6c4', sun: '#fff0d0', light: '#fff0d8', k: 2.6 },
  { top: '#5a6fb8', mid: '#f0b98a', low: '#ffd7a0', sun: '#ffe2b0', light: '#ffd9a8', k: 2.3 },
  { top: '#3a2f78', mid: '#c46a7e', low: '#f6a46e', sun: '#ffb98e', light: '#ffbe96', k: 1.9 },
  { top: '#2b1c58', mid: '#7a4a8e', low: '#f0915c', sun: '#ffc49a', light: '#ffcaa0', k: 1.5 }, // a violet dusk, not night: New York stays lit and in colour
].map(s => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'string' ? new THREE.Color(v) : v])))

/**
 * The Meshy bakes leave a few large triangles with no area in UV space; each samples one stray texel
 * (the pale wedge on the NYC slab). Paint each with the colour of its nearest same-facing neighbour.
 * The geometry is already in metres (normalize), and these triangles share no vertices.
 */
function mendUVs(geo) {
  const p = geo.attributes.position, uv = geo.attributes.uv, idx = geo.index
  if (!uv) return
  const n = (idx ? idx.count : p.count) / 3, vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const mid = new Float32Array(n * 3), nrm = new Float32Array(n * 3), bad = []
  for (let t = 0; t < n; t++) {
    const [i, j, k] = [vi(t, 0), vi(t, 1), vi(t, 2)]
    a.fromBufferAttribute(p, i), b.fromBufferAttribute(p, j), c.fromBufferAttribute(p, k)
    mid.set([(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3], t * 3)
    c.sub(a), b.sub(a)
    const area = b.cross(c).length() / 2
    nrm.set(b.normalize().toArray(), t * 3)
    const uvArea = (uv.getX(j) - uv.getX(i)) * (uv.getY(k) - uv.getY(i)) - (uv.getX(k) - uv.getX(i)) * (uv.getY(j) - uv.getY(i))
    if (Math.abs(uvArea) < 2e-7 && area > 0.01) bad.push(t)
  }
  const badSet = new Set(bad)
  for (const t of bad) {
    let best = -1, d = Infinity
    for (let o = 0; o < n; o++) {
      if (badSet.has(o) || nrm[o * 3] * nrm[t * 3] + nrm[o * 3 + 1] * nrm[t * 3 + 1] + nrm[o * 3 + 2] * nrm[t * 3 + 2] < 0.9) continue
      const dd = (mid[o * 3] - mid[t * 3]) ** 2 + (mid[o * 3 + 1] - mid[t * 3 + 1]) ** 2 + (mid[o * 3 + 2] - mid[t * 3 + 2]) ** 2
      if (dd < d) d = dd, best = o
    }
    if (best < 0) continue
    const u = (uv.getX(vi(best, 0)) + uv.getX(vi(best, 1)) + uv.getX(vi(best, 2))) / 3
    const v = (uv.getY(vi(best, 0)) + uv.getY(vi(best, 1)) + uv.getY(vi(best, 2))) / 3
    for (let k = 0; k < 3; k++) uv.setXY(vi(t, k), u, v)
  }
  uv.needsUpdate = true
}

/** Where the path runs: gently winding along +x. */
const pathZ = x => Math.sin(x * 0.12) * 0.8

export function createJourney(renderer, { loader, normalize }) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#dfe6ea', 28, 140) // the far land melts into the sky's low colour (set per frame)
  const skyMesh = sky()
  scene.add(skyMesh)
  const su = skyMesh.material.uniforms

  const land = new THREE.Mesh(new THREE.PlaneGeometry(400, 200).rotateX(-Math.PI / 2), toon({ map: paintTexture('#86b65a', ['#6f9c48', '#9cc56a', '#b3bf72', '#7aa64f', '#c2b47e'], { count: 420, seed: 41 }) }))
  land.material.map.repeat.set(8, 4) // big patches, so the field reads as painted at walking distance
  land.receiveShadow = true
  scene.add(land)
  // The path: a ribbon of light earth that winds past every stop, on a wider verge of trodden dirt.
  const L = STOP_GAP * IDS.length + 30
  const ribbon = (width, y) => {
    const geo = new THREE.PlaneGeometry(L, width, 240, 1).rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + L / 2 - 14
      pos.setX(i, x)
      pos.setZ(i, pos.getZ(i) + pathZ(x))
      pos.setY(i, y)
    }
    return geo
  }
  const verge = new THREE.Mesh(ribbon(2.6, 0.006), toon({ color: '#a88f62' }))
  verge.receiveShadow = true
  scene.add(verge)
  const path = new THREE.Mesh(ribbon(1.6, 0.012), toon({ map: paintTexture('#ead8b4', ['#dcc59a', '#f4e6c8', '#e2cfa8'], { seed: 42 }) }))
  path.material.map.repeat.set(L / 3, 1)
  path.receiveShadow = true
  scene.add(path)

  // Scenery between the stops, so the walk passes through a place: inked poplars, kept off the path.
  const rnd = (() => { let q = 7; return () => ((q = (q * 16807) % 2147483647) / 2147483647) })()
  const spots = []
  while (spots.length < 140) {
    const x = -16 + rnd() * (STOP_GAP * IDS.length + 26), z = -22 + rnd() * 20
    const nearPath = Math.abs(z - pathZ(x)) < 2.2
    const nearStop = IDS.some((_, i) => Math.hypot(x - i * STOP_GAP, z - (pathZ(i * STOP_GAP) - 3.6)) < 4.2)
    if (!nearPath && !nearStop && z < pathZ(x) - 2.4) spots.push([x, z, 0.6 + rnd() * 0.9, rnd()]) // only behind the path: never between you and the camera
  }
  // A crown of two stacked cones, centred on its origin so the ink shell can scale about it.
  const crownGeo = mergeGeometries([new THREE.ConeGeometry(0.62, 1.2, 7).translate(0, -0.25, 0), new THREE.ConeGeometry(0.46, 1.0, 7).translate(0, 0.45, 0)])
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 1, 6).translate(0, 0.5, 0)
  const ink = new THREE.MeshBasicMaterial({ color: '#2a1f14', side: THREE.BackSide })
  const trunks = new THREE.InstancedMesh(trunkGeo, toon({ color: '#7a5638' }), spots.length)
  const crowns = new THREE.InstancedMesh(crownGeo, toon({ color: '#ffffff' }), spots.length)
  const trunkInk = new THREE.InstancedMesh(trunkGeo, ink, spots.length)
  const crownInk = new THREE.InstancedMesh(crownGeo, ink, spots.length)
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3()
  const greens = ['#4f7d3a', '#5e8c44', '#6f9a4c', '#3f6b33'].map(c => new THREE.Color(c))
  const thick = new THREE.Matrix4().makeScale(1.07, 1.07, 1.07)
  spots.forEach(([x, z, s, r], i) => {
    m4.compose(v.set(x, 0, z), qq.identity(), sc.set(s, s * 1.4, s))
    trunks.setMatrixAt(i, m4)
    trunkInk.setMatrixAt(i, m4.multiply(thick))
    m4.compose(v.set(x, s * 2.2, z), qq.setFromEuler(new THREE.Euler(0, r * 6, 0)), sc.set(s, s * 1.15, s))
    crowns.setMatrixAt(i, m4)
    crownInk.setMatrixAt(i, m4.multiply(thick))
    crowns.setColorAt(i, greens[Math.floor(r * 997) % greens.length])
  })
  trunks.castShadow = crowns.castShadow = true
  scene.add(trunks, crowns, trunkInk, crownInk)

  const sun = new THREE.DirectionalLight('#fff1dc', 2.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 60 })
  const hemi = new THREE.HemisphereLight('#f4f0e6', '#7e9a6a', 1.4)
  scene.add(sun, sun.target, hemi)

  // The stops: dioramas set back from the path, each a little different in size and turn.
  const stops = IDS.map((id, i) => {
    const holder = new THREE.Group()
    holder.position.set(i * STOP_GAP, 0, pathZ(i * STOP_GAP) - 3.6)
    scene.add(holder)
    loader.loadAsync(`/cinema/journey/${id}.glb`).then(gltf => {
      const g = normalize(gltf.scene, { nyc: 5.6, gym: 6 }[id] ?? 4.8, -0.35) // the wide, low ones a little larger
      const box = new THREE.Box3().setFromObject(g)
      g.position.y = -box.min.y
      g.traverse(o => {
        if (!o.isMesh) return
        mendUVs(o.geometry)
        o.material = toon({ map: o.material.map, side: THREE.DoubleSide }) // open-backed scans: no pale backface or clipped corner
        o.castShadow = o.receiveShadow = true
      })
      holder.add(g)
    }).catch(() => {})
    return holder
  })

  let you = null
  loadTraveller(loader).then(t => {
    you = t.make()
    scene.add(you.root)
    you.play('Idle')
  })

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 600)
  const subject = new THREE.Vector3(), here = new THREE.Vector3()
  const ease = u => u * u * (3 - 2 * u)
  let lastX = null, speed = 0, lastT = null, cue = ''

  /** Where you are along the path at progress p: walk half of each stop's slot, then stand. */
  function placeAt(p) {
    const n = IDS.length
    const f = Math.min(n - 1e-4, Math.max(0, p * n))
    const k = Math.floor(f), u = f - k
    const from = k === 0 ? -9 : (k - 1) * STOP_GAP
    const walk = Math.min(1, u / 0.5)
    return { x: from + (k * STOP_GAP - from) * ease(walk), stop: k, dwell: u >= 0.5 ? (u - 0.5) / 0.5 : 0 }
  }

  /** state: { p (0..1) }. Returns where the traveller stands, for the sketch front. */
  function update(state, t, aspect) {
    const { x, stop, dwell } = placeAt(state.p)
    const dt = lastT === null ? 0 : Math.min(0.1, t - lastT)
    lastT = t
    if (lastX !== null && dt > 0) speed += (Math.abs(x - lastX) / dt - speed) * 0.15
    lastX = x
    here.set(x, 0, pathZ(x) + 0.2)
    if (you) {
      you.root.position.copy(here)
      // Walking: face along the path; standing: turn to look at the stop.
      const walking = speed > 0.12
      const face = walking ? Math.PI / 2 : Math.PI * 0.85
      you.root.rotation.y += (face - you.root.rotation.y) * 0.08
      const next = walking ? 'Walk' : stop === IDS.length - 1 && dwell > 0.2 ? 'Wave_One_Hand' : 'Idle'
      if (next !== cue) {
        cue = next
        you.play(next, { fade: 0.4 })
      }
      if (walking) you.actions.Walk.timeScale = THREE.MathUtils.clamp(speed / 1.5, 0.5, 1.4)
      you.mixer.update(dt)
    }
    // The day goes by along the path.
    const d = Math.min(SKIES.length - 1.001, Math.max(0, (x / STOP_GAP)))
    const a = SKIES[Math.floor(d)], b = SKIES[Math.floor(d) + 1], k = d - Math.floor(d)
    su.uTop.value.copy(a.top).lerp(b.top, k)
    su.uMid.value.copy(a.mid).lerp(b.mid, k)
    su.uLow.value.copy(a.low).lerp(b.low, k)
    su.uSun.value.copy(a.sun).lerp(b.sun, k)
    sun.color.copy(a.light).lerp(b.light, k)
    sun.intensity = a.k + (b.k - a.k) * k
    hemi.intensity = 0.6 + sun.intensity * 0.3
    scene.fog.color.copy(su.uLow.value)
    frameAt(x, aspect)
    return { here, stop, dwell }
  }

  /** The sun and the camera at path position x. */
  function frameAt(x, aspect) {
    // Camera: high three-quarter behind and to the side, following; you stand right of centre and the
    // story is told top-left.
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    const portrait = aspect < 0.85
    camera.position.set(x + 1.2, portrait ? 6.4 : 2.9, (portrait ? 16 : 7.6) + pathZ(x))
    frameLeft(camera, subject.set(x + 0.4, 1.5, pathZ(x) - 1.8), portrait ? 0 : -1.4)
    // Phone: you and the stop sit in the top half, above the job card (a four-role card reaches 44% up).
    if (portrait) lookBelow(camera, subject, 0.55)
    sun.position.set(x - 6, 10, 8)
    sun.target.position.set(x, 0, -2)
  }

  /** Frame stop k without moving the walk, so a warm-up draw can see (and upload) that stop. */
  function aim(k, aspect) {
    frameAt(k * STOP_GAP, aspect)
    sun.target.updateMatrixWorld()
  }

  return { scene, camera, update, aim, stops, count: IDS.length }
}
