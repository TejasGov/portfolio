import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { store } from '../lib/store'
import { pixelState } from './timeline'

export const N = typeof window !== 'undefined' && matchMedia('(max-width: 767px)').matches ? 42000 : 90000
export const SHAPE_KEYS = ['hand', 'brain', 'glasses', 'sword', 'city']
/** Each project hologram keeps its own light, so five shapes never read as one template. */
const TINT = { hand: '#8fdcff', brain: '#c3b0ff', glasses: '#ffd79a', sword: '#ffab8c', city: '#9df2cf' }
const focusAt = new THREE.Vector3()

const vertexShader = /* glsl */ `
  attribute vec3 aTo;
  attribute vec4 aRand;
  uniform float uMix, uScatter, uTime, uCell, uSpinFrom, uSpinTo, uFromGalaxy, uToGalaxy, uOpacity, uMouseOn, uBright, uFocus, uAperture, uBokeh;
  uniform vec2 uViewport, uMouse;
  uniform vec3 uTintFrom, uTintTo;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSoft;

  vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); }

  // Galaxy colour by radius: white-hot core, cyan arms, deep blue-violet rim.
  vec3 galaxyColor(float r, float k) {
    vec3 core = vec3(1.0, 0.92, 0.84) * 1.25;
    vec3 arm = vec3(0.38, 0.66, 1.0) * 0.7;
    vec3 rim = vec3(0.24, 0.26, 0.9) * 0.42;
    vec3 c = mix(core, arm, smoothstep(0.1, 1.4, r));
    c = mix(c, rim, smoothstep(1.6, 4.2, r));
    return c * (0.55 + 0.75 * k);
  }
  vec3 shapeColor(float k) { return mix(vec3(0.32, 0.55, 1.0), vec3(0.85, 0.93, 1.0), k * k) * (0.35 + 0.5 * k); }

  vec3 place(vec3 p, float isGalaxy, float spin) {
    if (isGalaxy < 0.5) return p;
    float r = length(p.xz);
    // Differential rotation: the core turns faster than the rim, like a real vortex.
    return rotY(p, uTime * 0.16 / (0.3 + r * 0.45) + spin * (2.4 - r * 0.25));
  }

  void main() {
    // Each pixel leaves on its own schedule, so shapes crumble and re-form instead of cross-fading.
    float m = smoothstep(aRand.x * 0.45, 0.55 + aRand.x * 0.45, uMix);
    vec3 a = place(position, uFromGalaxy, uSpinFrom);
    vec3 b = place(aTo, uToGalaxy, uSpinTo);
    vec3 p = mix(a, b, m);

    // Mid-flight the cloud becomes a vortex: swirl round the axis, flare outward, then settle.
    float s = uScatter * sin(3.14159 * m);
    p = rotY(p, s * (1.2 + aRand.y * 2.4));
    p += normalize(vec3(aRand.z - 0.5, (aRand.w - 0.5) * 0.6, aRand.y - 0.5)) * s * (0.4 + aRand.w * 0.9);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;

    // The cursor parts the pixels; they spring back as it leaves.
    vec2 d = ndc - uMouse;
    d.x *= uViewport.x / uViewport.y;
    float push = uMouseOn * smoothstep(0.32, 0.0, length(d)) * 0.07;
    vec2 dir = normalize(d + 1e-5);
    dir.x *= uViewport.y / uViewport.x;
    ndc += dir * push;

    // Depth of field: in focus, a pixel is a tiny crisp square locked to the screen grid;
    // out of focus, it opens into a soft bokeh disc. Detail where you look, dream at the edges.
    float coc = clamp(abs(-mv.z - uFocus) * uAperture - 0.08, 0.0, 1.0);
    vSoft = smoothstep(0.12, 0.45, coc);
    if (vSoft < 0.5) {
      vec2 px = (ndc * 0.5 + 0.5) * uViewport;
      px = (floor(px / uCell) + 0.5) * uCell;
      ndc = px / uViewport * 2.0 - 1.0;
    }
    gl_Position = vec4(ndc * clip.w, clip.z, clip.w);
    float size = uCell + coc * uBokeh * (0.6 + aRand.z * 0.8);
    gl_PointSize = size;

    float k = aRand.y;
    float twinkle = 0.75 + 0.25 * sin(uTime * (1.5 + aRand.z * 3.0) + aRand.w * 40.0);
    vec3 ca = uFromGalaxy > 0.5 ? galaxyColor(length(position.xz), k) : shapeColor(k) * uTintFrom;
    vec3 cb = uToGalaxy > 0.5 ? galaxyColor(length(aTo.xz), k) : shapeColor(k) * uTintTo;
    float depth = smoothstep(14.0, 3.0, -mv.z);
    // Additive pixels pile up fast; uBright keeps dense states (the orb) from blowing out.
    // A bokeh disc spreads the same light over more pixels, so it dims as it grows.
    float spread = (uCell * uCell) / (size * size);
    vColor = mix(ca, cb, m) * twinkle * (0.4 + 0.7 * depth) * uBright * mix(1.0, max(spread * 2.2, 0.08), vSoft);
    vAlpha = uOpacity;
  }`

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (vSoft < 0.5) {
      // A sliver of gap between cells keeps the grid legible.
      if (max(abs(c.x), abs(c.y)) > 0.42) discard;
      gl_FragColor = vec4(vColor * vAlpha, 1.0);
      return;
    }
    // Bokeh: a soft disc with a faintly brighter rim, like an out-of-focus light.
    float r = length(c) * 2.0;
    if (r > 1.0) discard;
    float disc = smoothstep(1.0, 0.82, r) * (0.75 + 0.25 * smoothstep(0.5, 0.95, r));
    gl_FragColor = vec4(vColor * vAlpha * disc, 1.0);
  }`

/** The 90k-pixel cloud: galaxy, orb, dust and every project shape are positions it moves between. */
export default function Field() {
  const [targets, setTargets] = useState(null)
  const points = useRef()
  const pair = useRef('')
  const size = useThree(s => s.size)
  const dpr = useThree(s => s.viewport.dpr)

  useEffect(() => {
    const worker = new Worker(new URL('./targets.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      setTargets(data)
      worker.terminate()
    }
    worker.postMessage({ n: N, shapes: SHAPE_KEYS })
    return () => worker.terminate()
  }, [])

  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    g.setAttribute('aTo', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    const rand = new Float32Array(N * 4)
    for (let i = 0; i < rand.length; i++) rand[i] = Math.random()
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 4))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50)
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uMix: { value: 0 },
        uScatter: { value: 0 },
        uTime: { value: 0 },
        uCell: { value: 3 },
        uSpinFrom: { value: 0 },
        uSpinTo: { value: 0 },
        uFromGalaxy: { value: 1 },
        uToGalaxy: { value: 0 },
        uOpacity: { value: 0 },
        uBright: { value: 1 },
        uFocus: { value: 7 },
        uAperture: { value: 0.32 },
        uBokeh: { value: 14 },
        uTintFrom: { value: new THREE.Color(1, 1, 1) },
        uTintTo: { value: new THREE.Color(1, 1, 1) },
        uMouseOn: { value: 0 },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uMouse: { value: new THREE.Vector2(9, 9) },
      },
    })
    return { geometry: g, material: m }
  }, [])
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useEffect(() => {
    material.uniforms.uViewport.value.set(size.width * dpr, size.height * dpr)
    // ~2 CSS px squares: fine enough to read as detail, big enough to stay square.
    material.uniforms.uCell.value = Math.max(2, Math.round(2 * dpr))
    material.uniforms.uBokeh.value = 12 * dpr
  }, [material, size, dpr])

  const reveal = useRef(0)
  useFrame((state, delta) => {
    if (!targets) return
    const u = material.uniforms
    const st = pixelState(store)
    const key = `${st.from}>${st.to}`
    if (pair.current !== key) {
      pair.current = key
      geometry.attributes.position.array.set(targets[st.from])
      geometry.attributes.aTo.array.set(targets[st.to])
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.aTo.needsUpdate = true
    }
    reveal.current = Math.min(1, reveal.current + delta * 0.6) // fade in once targets arrive
    u.uMix.value = st.mix
    u.uScatter.value = st.scatter
    u.uSpinFrom.value = st.spin
    u.uSpinTo.value = st.spin
    u.uFromGalaxy.value = st.from === 'galaxy' ? 1 : 0
    u.uToGalaxy.value = st.to === 'galaxy' ? 1 : 0
    u.uOpacity.value = st.opacity * reveal.current
    u.uBright.value = st.bright ?? 1
    u.uTintFrom.value.set(TINT[st.from] ?? '#ffffff')
    u.uTintTo.value.set(TINT[st.to] ?? '#ffffff')
    // Focus on the cloud's centre, wherever it sits in the frame.
    u.uFocus.value = state.camera.position.distanceTo(points.current.parent.getWorldPosition(focusAt))
    u.uTime.value = state.clock.elapsedTime
    u.uMouse.value.lerp({ x: store.mouse.x, y: store.mouse.y }, 0.2)
    u.uMouseOn.value = THREE.MathUtils.damp(u.uMouseOn.value, store.mouse.active, 4, delta)
  })

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}
