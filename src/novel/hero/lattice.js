import * as THREE from 'three'

/*
 * The first frame's 3D: a projector beam from a booth window at the top of the frame cuts down and forward
 * through the haze, and the dust in it streams down the beam and resolves into a neural-network lattice (layers of nodes, edges between neighbours,
 * cool signal pulses running along the edges). Depth of field is faked per point: out of focus is bigger and
 * fainter. Its own small canvas, not the Stage's renderer: lazy (Prologue.jsx imports it after load), its
 * programs compiled off the main thread before the first frame, paused while the poster is off screen, and
 * disposed by Prologue.jsx once the reader is well past it.
 *
 * Everything moves in the shaders from a few uniforms, so a frame allocates nothing. Reduced motion: the
 * lattice already resolved, one still frame, redrawn only on resize.
 */
const WARM = new THREE.Color('#ffd7a1') // projector light
const COOL = new THREE.Color('#6fd8ec') // the one cool accent: signals

const rand = (a, b) => a + Math.random() * (b - a)

/**
 * Five parallel layers fanning out from the beam and back (few nodes at the ends, most in the middle), every
 * node linked to every node of the next layer: the textbook network diagram, so it reads as one at a glance.
 * Nearly flat, facing the camera, so the layers stay columns. Portrait stacks the layers vertically.
 */
function network(phone) {
  const counts = phone ? [3, 4, 5, 4, 3] : [3, 5, 7, 5, 3]
  const span = phone ? 3.4 : 6.6 // across the layers
  const gap = phone ? 0.74 : 0.38 // between nodes in a layer
  const nodes = [], layers = []
  counts.forEach((n, l) => {
    const ids = []
    const across = (l / (counts.length - 1) - 0.5) * span
    for (let i = 0; i < n; i++) {
      const along = (i - (n - 1) / 2) * gap + rand(-0.04, 0.04)
      ids.push(nodes.length)
      nodes.push(phone ? [along, -across, rand(-0.3, 0.3)] : [across, along, rand(-0.3, 0.3)])
    }
    layers.push(ids)
  })
  const edges = []
  for (let l = 0; l < layers.length - 1; l++) for (const a of layers[l]) for (const b of layers[l + 1]) edges.push([a, b])
  return { nodes, edges, layers }
}

const NODE_VS = /* glsl */ `
  attribute vec3 start; attribute float delay; attribute float seed;
  uniform float uTime, uResolve, uFocus, uScale;
  varying float vA; varying float vCore;
  vec3 place(vec3 s, vec3 e, float d) {
    float k = clamp((uResolve - d) / 0.55, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    return mix(s, e, k) + 0.05 * vec3(sin(uTime * 0.6 + seed * 6.3), cos(uTime * 0.5 + seed * 4.1), 0.0) * k;
  }
  void main() {
    vec3 p = place(start, position, delay);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float blur = abs(-mv.z - uFocus);
    gl_PointSize = uScale * (0.15 + 0.06 * blur) / -mv.z;
    vA = 1.0 / (1.0 + blur * blur * 0.35);
    vCore = clamp(1.0 - blur * 0.5, 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }`
const NODE_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha;
  varying float vA; varying float vCore;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float halo = pow(1.0 - r, 2.0);
    float core = smoothstep(0.42, 0.16, r) * vCore * 1.7;
    gl_FragColor = vec4(uColor * (halo * 0.7 + core), (halo * 0.7 + core) * vA * uAlpha);
  }`

const EDGE_VS = /* glsl */ `
  attribute vec3 start; attribute float delay;
  uniform float uResolve, uFocus;
  varying float vA;
  void main() {
    float k = clamp((uResolve - delay) / 0.55, 0.0, 1.0);
    vec3 p = mix(start, position, k * k * (3.0 - 2.0 * k));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float blur = abs(-mv.z - uFocus);
    vA = 1.0 / (1.0 + blur * blur * 0.5);
    gl_Position = projectionMatrix * mv;
  }`
const EDGE_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha;
  varying float vA;
  void main() { gl_FragColor = vec4(uColor, vA * uAlpha); }`

// A signal runs one path forward through all five layers (p0..p4), easing through each node, then rests:
// it travels for the first 60% of its cycle, so ten paths keep about six signals in flight.
const PULSE_VS = /* glsl */ `
  attribute vec3 p1, p2, p3, p4; attribute float phase; attribute float speed;
  uniform float uTime, uFocus, uScale;
  varying float vA;
  void main() {
    float s = fract(uTime * speed + phase) / 0.6 * 4.0;
    float seg = min(floor(s), 3.0);
    vec3 a = seg < 0.5 ? position : seg < 1.5 ? p1 : seg < 2.5 ? p2 : p3;
    vec3 b = seg < 0.5 ? p1 : seg < 1.5 ? p2 : seg < 2.5 ? p3 : p4;
    vec4 mv = modelViewMatrix * vec4(mix(a, b, smoothstep(0.0, 1.0, s - seg)), 1.0);
    float blur = abs(-mv.z - uFocus);
    gl_PointSize = uScale * (0.14 + 0.05 * blur) / -mv.z;
    vA = smoothstep(0.0, 0.2, s) * (1.0 - smoothstep(3.75, 4.0, s)) / (1.0 + blur * blur * 0.35);
    gl_Position = projectionMatrix * mv;
  }`
const PULSE_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float a = (pow(1.0 - r, 2.2) + smoothstep(0.3, 0.05, r)) * vA * uAlpha;
    gl_FragColor = vec4(uColor * a * 2.2, a);
  }`

const DUST_VS = /* glsl */ `
  attribute float seed;
  uniform float uTime, uScale;
  varying float vA;
  void main() {
    vec3 p = position + 0.22 * vec3(sin(uTime * 0.07 + seed * 40.0), sin(uTime * 0.05 + seed * 23.0), cos(uTime * 0.06 + seed * 31.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uScale * 0.03 / -mv.z;
    vA = (0.35 + 0.65 * sin(uTime * (0.4 + seed) + seed * 90.0) * 0.5 + 0.325) * smoothstep(0.5, 2.5, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`
const DUST_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float a = (1.0 - r) * vA * uAlpha;
    gl_FragColor = vec4(uColor * a, a);
  }`

// The beam, drawn analytically on one full-screen quad: each pixel's view ray against the cone from the lens
// (its nearest approach to the axis, against the cone's radius there), so it reads as light in the haze from
// any angle, soft at its edge and brightest near the lens. The lens sits behind the lattice near the top of
// the frame and throws down past it toward the seats under the viewer, so the cone is seen from outside.
const BEAM_VS = /* glsl */ `
  varying vec2 vNdc;
  void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`
const BEAM_FS = /* glsl */ `
  uniform vec3 uColor, uLens, uAxis; uniform float uTime, uAlpha, uLen, uR;
  uniform mat4 uInvProj, uCamWorld;
  varying vec2 vNdc;
  void main() {
    vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0);
    vec3 d = normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
    vec3 o = cameraPosition, w = o - uLens;
    float b = dot(d, uAxis), den = max(1.0 - b * b, 1e-4);
    float s = clamp((dot(w, uAxis) - b * dot(w, d)) / den, 0.0, uLen);
    float t = max(dot(uLens + uAxis * s - o, d), 0.0);
    float dist = length(o + d * t - uLens - uAxis * s);
    float u = s / uLen; // 0 at the lens, 1 far away
    float r = 0.06 + u * uR;
    float k = clamp(1.0 - dist / r, 0.0, 1.0);
    vec3 pe = o + d * t - uLens - uAxis * s;
    float ang = atan(pe.x, pe.y); // around the axis: the streaks a lens throws through haze
    float rays = 0.5 + 0.5 * pow(0.5 + 0.5 * sin(ang * 11.0 + 2.0 * sin(ang * 3.0 + uTime * 0.07)), 2.0);
    rays = mix(1.0, rays, smoothstep(0.0, 0.5, 1.0 - k)); // the angle flips where a ray crosses the axis: no seam
    float haze = 0.8 + 0.12 * sin(u * 23.0 - uTime * 0.18) + 0.08 * sin(u * 61.0 + uTime * 0.11);
    float a = smoothstep(0.0, 0.3, k) * (0.35 + 0.65 * k) * rays * haze * (0.12 + 1.1 * pow(1.0 - u, 1.5)) * uAlpha;
    gl_FragColor = vec4(uColor * a, a);
  }`

function mat(vs, fs, color, uniforms, opts = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vs,
    fragmentShader: fs,
    uniforms: { uColor: { value: color }, uAlpha: { value: 1 }, ...uniforms },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    ...opts,
  })
}

/**
 * Start the lattice in a new canvas appended to `host`. `phone` lays it out for portrait with fewer points;
 * `still` is reduced motion; `resolved` skips the resolve (a return visit to the top).
 * Returns { setActive(on), dispose() }.
 */
export function startLattice(host, { phone = false, still = false, resolved = false } = {}) {
  const canvas = document.createElement('canvas')
  canvas.className = 'hero-gl'
  canvas.setAttribute('aria-hidden', 'true')
  host.appendChild(canvas)
  let renderer = null // made in steps below, a task each, so the pointer trail keeps its frames

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(phone ? 50 : 38, 1, 0.1, 80)
  const look = new THREE.Vector3(0, phone ? 1.1 : 0.55, 0)
  const home = new THREE.Vector3(0, phone ? 0.6 : 0.2, phone ? 9.6 : 9)

  const lens = new THREE.Vector3(0, phone ? 9.5 : 6.4, -14)
  const far = new THREE.Vector3(0, phone ? -8.5 : -6.5, 8) // below the camera: it stays outside the cone
  const R = phone ? 5.2 : 7.6 // the beam's radius at the far end (most of the lattice's width at it)
  const shared = {
    uTime: { value: 0 },
    uResolve: { value: still || resolved ? 2 : 0 },
    uFocus: { value: home.distanceTo(look) },
    uScale: { value: 1 },
  }

  // The beam
  const len = lens.distanceTo(far)
  const beamMat = mat(BEAM_VS, BEAM_FS, WARM, {
      uTime: shared.uTime,
      uLens: { value: lens },
      uAxis: { value: far.clone().sub(lens).normalize() },
      uLen: { value: len },
      uR: { value: R },
      uInvProj: { value: camera.projectionMatrixInverse },
      uCamWorld: { value: camera.matrixWorld },
  })
  beamMat.uniforms.uAlpha.value = 1.15
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), beamMat)
  beam.frustumCulled = false
  beam.renderOrder = -1
  scene.add(beam)

  // Dust in the haze: inside the beam's cone, densest near the lattice.
  const nDust = phone ? 360 : 900
  const dustPos = new Float32Array(nDust * 3), dustSeed = new Float32Array(nDust)
  const v = new THREE.Vector3()
  for (let i = 0; i < nDust; i++) {
    const t = Math.pow(Math.random(), 0.7) * 0.72 + 0.12
    const r = R * t * Math.sqrt(Math.random())
    const a = Math.random() * Math.PI * 2
    v.lerpVectors(lens, far, t)
    dustPos.set([v.x + Math.cos(a) * r, v.y + Math.sin(a) * r, v.z], i * 3)
    dustSeed[i] = Math.random()
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(dustSeed, 1))
  const dustMat = mat(DUST_VS, DUST_FS, WARM, { uTime: shared.uTime, uScale: shared.uScale })
  dustMat.uniforms.uAlpha.value = 0.85
  scene.add(new THREE.Points(dustGeo, dustMat))

  // The lattice. Each node streams in from up the beam (toward the lens) to its place.
  const lattice = new THREE.Group()
  lattice.position.copy(look)
  lattice.position.y += phone ? 1.55 : 0.5 // above the tag line and the name
  scene.add(lattice)
  const { nodes, edges, layers } = network(phone)
  const lensLocal = lens.clone().sub(look)
  const N = nodes.length
  const end = new Float32Array(N * 3), start = new Float32Array(N * 3), delay = new Float32Array(N), seed = new Float32Array(N)
  nodes.forEach((p, i) => {
    end.set(p, i * 3)
    v.set(...p).lerp(lensLocal, rand(0.35, 0.75))
    start.set([v.x + rand(-1.2, 1.2), v.y + rand(-0.8, 0.8), v.z + rand(-1, 1)], i * 3)
    delay[i] = rand(0, 0.7) + (p[2] + 1.6) * 0.08
    seed[i] = Math.random()
  })
  const nodeGeo = new THREE.BufferGeometry()
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(end, 3))
  nodeGeo.setAttribute('start', new THREE.BufferAttribute(start, 3))
  nodeGeo.setAttribute('delay', new THREE.BufferAttribute(delay, 1))
  nodeGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1))
  const nodeMat = mat(NODE_VS, NODE_FS, WARM, shared)
  lattice.add(new THREE.Points(nodeGeo, nodeMat))

  const E = edges.length
  const ePos = new Float32Array(E * 6), eStart = new Float32Array(E * 6), eDelay = new Float32Array(E * 2)
  edges.forEach(([a, b], i) => {
    for (const [k, n] of [[0, a], [1, b]]) {
      ePos.set(end.subarray(n * 3, n * 3 + 3), i * 6 + k * 3)
      eStart.set(start.subarray(n * 3, n * 3 + 3), i * 6 + k * 3)
      eDelay[i * 2 + k] = Math.max(delay[a], delay[b]) + 0.35 // an edge draws once both its ends have arrived
    }
  })
  const edgeGeo = new THREE.BufferGeometry()
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3))
  edgeGeo.setAttribute('start', new THREE.BufferAttribute(eStart, 3))
  edgeGeo.setAttribute('delay', new THREE.BufferAttribute(eDelay, 1))
  const edgeMat = mat(EDGE_VS, EDGE_FS, WARM, { uResolve: shared.uResolve, uFocus: shared.uFocus })
  edgeMat.uniforms.uAlpha.value = 0.24
  lattice.add(new THREE.LineSegments(edgeGeo, edgeMat))

  // Signals: ten paths, each one node per layer, input to output (PULSE_VS).
  const P = 10
  const path = layers.map(() => new Float32Array(P * 3)), phase = new Float32Array(P), speed = new Float32Array(P)
  for (let i = 0; i < P; i++) {
    layers.forEach((ids, l) => {
      const n = ids[(Math.random() * ids.length) | 0]
      path[l].set(end.subarray(n * 3, n * 3 + 3), i * 3)
    })
    phase[i] = i / P + rand(0, 0.06)
    speed[i] = rand(0.075, 0.1) // a slow cycle: ~1.5-2 s a hop
  }
  const pulseGeo = new THREE.BufferGeometry()
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(path[0], 3))
  for (let l = 1; l < 5; l++) pulseGeo.setAttribute(`p${l}`, new THREE.BufferAttribute(path[l], 3))
  pulseGeo.setAttribute('phase', new THREE.BufferAttribute(phase, 1))
  pulseGeo.setAttribute('speed', new THREE.BufferAttribute(speed, 1))
  const pulseMat = mat(PULSE_VS, PULSE_FS, COOL, { uTime: shared.uTime, uFocus: shared.uFocus, uScale: shared.uScale })
  pulseMat.uniforms.uAlpha.value = still || resolved ? 1 : 0
  lattice.add(new THREE.Points(pulseGeo, pulseMat))

  // Sizing: points are sized in device px against the drawing buffer's height.
  function size() {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h || !renderer) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    shared.uScale.value = renderer.getPixelRatio() * h * 1.1
  }
  const ro = new ResizeObserver(() => {
    size()
    if (still && !first) renderer.render(scene, camera) // a running loop redraws itself; a paused one waits
  })
  ro.observe(host)

  // Pointer parallax (not on touch, not under reduced motion): eased toward, never snapped.
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches && !still
  let px = 0, py = 0, tx = 0, ty = 0
  const onPointer = e => {
    tx = (e.clientX / innerWidth) * 2 - 1
    ty = (e.clientY / innerHeight) * 2 - 1
  }
  if (fine) addEventListener('pointermove', onPointer, { passive: true })

  // A context is costly on the main thread (creation, three's setup, the first drawing buffer): one step per
  // task with a frame between, then every program compiled off the main thread (KHR_parallel_shader_compile).
  let ready = false, dead = false
  const nextFrame = () => new Promise(res => requestAnimationFrame(() => setTimeout(res, 0)))
  const compiled = (async () => {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'high-performance' })
    if (!gl) return // no WebGL: the poster stands on its own
    await nextFrame()
    if (dead) return
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: false })
    renderer.debug.checkShaderErrors = import.meta.env.DEV // its info-log reads block ~50 ms a program at first use
    renderer.setClearColor(0x000000, 0)
    await nextFrame()
    if (dead) return
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 1.75)) // resizes the canvas too: this step's job
    size()
    await nextFrame()
    if (dead) return
    await renderer.compileAsync(scene, camera)
    ready = !dead
  })().catch(() => {})

  // Stage.jsx boots the booth once the lattice has resolved; its startup blocks the main thread, so it can ask
  // the lattice to hold its last frame ('novel:hero-hold') until the booth has drawn ('novel:hero-go').
  let told = false, held = false, holdCap = 0
  const resolvedNow = () => told || ((told = true), dispatchEvent(new Event('novel:hero-resolved')))
  const onHold = () => {
    held = true
    cancelAnimationFrame(raf)
    clearTimeout(holdCap)
    holdCap = setTimeout(onGo, 4000) // never frozen for good if 'go' is lost
  }
  const onGo = () => {
    clearTimeout(holdCap)
    if (!held) return
    held = false
    last = 0
    if (running && !dead) raf = requestAnimationFrame(frame)
  }
  addEventListener('novel:hero-hold', onHold)
  addEventListener('novel:hero-go', onGo)

  let raf = 0, running = false, last = 0, t = 0, first = true
  function frame(now) {
    raf = requestAnimationFrame(frame)
    const dt = first ? 0 : Math.min(0.05, last ? (now - last) / 1000 : 0.016) // the clock starts once drawn
    last = now
    t += dt
    shared.uTime.value = t
    if (shared.uResolve.value < 2) shared.uResolve.value = Math.min(2, t / 1.1) // ~2.2 s, dust to lattice
    if (shared.uResolve.value >= 2) resolvedNow()
    pulseMat.uniforms.uAlpha.value = Math.min(1, Math.max(pulseMat.uniforms.uAlpha.value, (shared.uResolve.value - 1.2) * 1.5))
    // The projector throws hard at first, then settles as the lattice takes over (resolved: settled already).
    beamMat.uniforms.uAlpha.value = resolved ? 1.15 : 1.15 + 0.55 * (1 - THREE.MathUtils.smoothstep(t, 1.2, 2.6))
    px += (tx - px) * Math.min(1, dt * 2.2)
    py += (ty - py) * Math.min(1, dt * 2.2)
    camera.position.set(home.x + Math.sin(t * 0.07) * 0.35 + px * 0.45, home.y + Math.sin(t * 0.05) * 0.18 - py * 0.3, home.z + Math.sin(t * 0.04) * 0.25)
    camera.lookAt(look)
    lattice.rotation.y = Math.sin(t * 0.045) * 0.12 + px * 0.05
    renderer.render(scene, camera)
    if (first) (first = false), host.classList.add('is-lit')
  }

  function setActive(on) {
    if (dead) return
    if (!ready) return void compiled.then(() => ready && setActive(on))
    if (still) {
      if (on && first) {
        camera.position.copy(home)
        camera.lookAt(look)
        renderer.render(scene, camera)
        first = false
        host.classList.add('is-lit')
        resolvedNow()
      }
      return
    }
    if (on === running) return
    running = on
    last = 0
    if (on) held || (raf = requestAnimationFrame(frame))
    else cancelAnimationFrame(raf)
  }

  function dispose() {
    dead = true
    running = false
    cancelAnimationFrame(raf)
    clearTimeout(holdCap)
    removeEventListener('novel:hero-hold', onHold)
    removeEventListener('novel:hero-go', onGo)
    ro.disconnect()
    removeEventListener('pointermove', onPointer)
    scene.traverse(o => {
      o.geometry?.dispose()
      o.material?.dispose()
    })
    renderer?.dispose()
    ;(renderer?.getContext() ?? canvas.getContext('webgl2'))?.getExtension('WEBGL_lose_context')?.loseContext()
    host.classList.remove('is-lit')
    canvas.remove()
  }

  return { setActive, dispose }
}
