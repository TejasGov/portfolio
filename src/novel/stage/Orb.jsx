import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { glslField } from './noise'
import { ORB_R } from './targets'
import { store } from '../lib/store'
import { orbState } from './timeline'

const vertex = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    vPos = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`

/**
 * The orb, drawn like a scientific plate (after Tejas's reference image): a near-black sphere whose
 * contour lines are glowing ribbons — a white-hot core, thin parallel side strands, a blue bloom —
 * slightly embossed, packing into a hot rim at the limb. Values above 1.0 feed the bloom pass.
 */
const fragment = /* glsl */ `
  uniform float uTime, uOpacity, uPhase;
  varying vec3 vPos;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  ${glslField}
  float h1(float n) { return fract(sin(n * 12.9898 + 4.1) * 43758.5453); }
  float aaLine(float v, float width) {
    float fw = fwidth(v);
    float d = abs(fract(v - 0.5) - 0.5);
    return 1.0 - smoothstep(fw * width, fw * (width + 1.0), d);
  }
  void main() {
    vec3 p = normalize(vPos);
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vWorld);
    float facing = max(dot(n, v), 0.0);
    float fres = 1.0 - facing;

    float b = field(p) * BANDS + uPhase;
    float fw = max(fwidth(b), 1e-4);
    float idx = floor(b + 0.5);
    float d = abs(b - idx);           // distance to the nearest contour, in band units
    float dpx = d / fw;               // ... and in screen pixels
    float r = h1(idx);                // every line gets its own weight and brightness
    float major = step(mod(idx, 4.0), 0.5);

    float width = mix(0.7, 1.6, r) + major * 0.9;
    float core = exp(-pow(dpx / width, 2.0));
    // Thin side strands a fixed fraction of a band away: lines read as ribbons of 2–3 filaments.
    float off = max(0.085 / fw, width * 2.4);
    float strands = exp(-pow((dpx - off) / (0.55 + 0.3 * r), 2.0)) * (0.35 + 0.45 * step(0.4, r));
    float strands2 = exp(-pow((dpx - off * 1.9) / 0.5, 2.0)) * 0.22 * step(0.7, r);
    float glow = exp(-dpx / (width * 2.8));

    // Emboss: the side of each ribbon facing the light (upper left) catches more of it.
    vec2 g = vec2(dFdx(b), dFdy(b));
    float side = sign(b - idx);
    float lit = 0.72 + 0.45 * clamp(dot(normalize(g + 1e-6) * side, normalize(vec2(-0.55, 0.83))), -1.0, 1.0);

    float bright = mix(0.45, 1.25, r) * (0.55 + 0.95 * pow(fres, 1.3)) * (0.85 + 0.3 * major);
    float scan = exp(-pow((p.y - sin(uTime * 0.21) * 1.05) * 9.0, 2.0));
    bright *= 1.0 + scan * 0.55;

    vec3 hot = vec3(0.86, 0.93, 1.0);
    vec3 cool = vec3(0.22, 0.46, 1.0);
    vec3 col = vec3(0.002, 0.005, 0.016) + vec3(0.01, 0.03, 0.1) * pow(fres, 3.0);
    col += hot * core * lit * bright * 1.55;
    col += mix(cool, hot, 0.35) * (strands + strands2) * lit * bright * 0.9;
    col += cool * glow * bright * 0.16;

    // Instrument layer: a faint dotted graticule every 15 degrees.
    float lat = asin(clamp(p.y, -1.0, 1.0)) / 0.2618;
    float lon = atan(p.z, p.x) / 0.2618;
    float dots = step(0.6, fract((asin(clamp(p.y, -1.0, 1.0)) + atan(p.z, p.x)) * 42.0));
    col += vec3(0.4, 0.6, 1.0) * max(aaLine(lat, 0.25), aaLine(lon, 0.25)) * dots * 0.06;

    // The limb: an inner blue haze and a thin white-hot edge.
    col += vec3(0.2, 0.42, 1.0) * pow(fres, 3.5) * 0.35;
    col += vec3(0.75, 0.88, 1.0) * pow(fres, 12.0) * 1.8;
    gl_FragColor = vec4(col * uOpacity, 1.0);
  }`

/** A soft halo behind the orb: a camera-facing disc with a gaussian falloff (no hard shell edge). */
const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy;
    gl_Position = projectionMatrix * mv;
  }`
const glowFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    // The orb's limb sits at r = 1/1.7 of this plane: glow only from there outward, never through it.
    float r = length(vUv - 0.5) * 2.0;
    float limb = 1.0 / 1.7;
    float i = smoothstep(limb - 0.02, limb + 0.01, r) * exp(-(r - limb) * 10.0) * smoothstep(0.98, 0.8, r);
    gl_FragColor = vec4(vec3(0.18, 0.36, 1.0) * i * 0.5 * uOpacity, 1.0);
  }`

export default function Orb({ group }) {
  const { surface, shell } = useMemo(() => {
    const uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uPhase: { value: 0 } }
    return {
      surface: new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      shell: new THREE.ShaderMaterial({ vertexShader: glowVertex, fragmentShader: glowFragment, uniforms: { uOpacity: uniforms.uOpacity }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    }
  }, [])
  useEffect(() => () => {
    surface.dispose()
    shell.dispose()
  }, [surface, shell])
  const phase = useRef(0)

  useFrame((state, delta) => {
    const st = orbState(store)
    surface.uniforms.uTime.value = state.clock.elapsedTime
    surface.uniforms.uOpacity.value = st.opacity
    // Contours only start to flow once the pixels have handed over to the drawn lines.
    if (st.opacity > 0.98) phase.current += delta * 0.04
    surface.uniforms.uPhase.value = phase.current
    group.current.visible = st.opacity > 0.001
  })

  return (
    <>
      <mesh material={surface}>
        <sphereGeometry args={[ORB_R, 160, 120]} />
      </mesh>
      <mesh material={shell} renderOrder={-1}>
        <planeGeometry args={[ORB_R * 3.4, ORB_R * 3.4]} />{/* 1.7 × diameter */}
      </mesh>
    </>
  )
}
