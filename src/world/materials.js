import * as THREE from 'three'
import { HILL, PITCH } from './terrain'

/*
 * One visual rule for the whole world: soft, painterly forms drawn over with glowing contour lines.
 * Every material reads the same atmosphere uniforms, so night → dawn changes everything at once.
 */
export const atmosphere = {
  uSkyTop: { value: new THREE.Color() },
  uHorizon: { value: new THREE.Color() },
  uGroundLow: { value: new THREE.Color() },
  uGroundHigh: { value: new THREE.Color() },
  uLine: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0.4, 0.25, -0.9).normalize() },
  uSunColor: { value: new THREE.Color() },
  uLight: { value: 0 }, // 0 night → 1 morning
  uFog: { value: 0.006 },
  uTime: { value: 0 },
}

const noise2 = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }`

const fog = /* glsl */ `
vec3 applyFog(vec3 col, vec3 world) {
  float dist = length(world - cameraPosition);
  float f = 1.0 - exp(-pow(dist * uFog, 1.35));
  f = max(f, (1.0 - smoothstep(-2.0, 18.0, world.y)) * 0.35); // mist pooling in the valleys
  return mix(col, uHorizon, clamp(f, 0.0, 1.0));
}`

/**
 * Painterly ground/props: wrapped, softly posterised light + a height colour ramp + brush mottling,
 * with contour lines every `spacing` metres (every fifth one heavier) that glow at night.
 */
export function contourMaterial({ spacing = 2.5, tint = null, pitch = false, lineStrength = 1 } = {}) {
  return new THREE.ShaderMaterial({
    defines: { ...(tint && { TINT: '' }), ...(pitch && { PITCH: '' }) },
    uniforms: {
      ...atmosphere,
      uSpacing: { value: spacing },
      uLineStrength: { value: lineStrength },
      uTint: { value: new THREE.Color(tint ?? '#ffffff') },
      uPitchCenter: { value: new THREE.Vector2(HILL.x, HILL.z) },
      uPitchHalf: { value: new THREE.Vector2(PITCH.halfWidth, PITCH.halfLength) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 world = modelMatrix * local;
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSkyTop, uHorizon, uGroundLow, uGroundHigh, uLine, uSunDir, uSunColor, uTint;
      uniform float uLight, uFog, uSpacing, uTime, uLineStrength;
      uniform vec2 uPitchCenter, uPitchHalf;
      varying vec3 vWorld;
      varying vec3 vNormal;
      ${noise2}
      ${fog}
      void main() {
        vec3 n = normalize(vNormal);
        // Wrapped light, then a soft posterise: shapes read as painted planes, not plastic.
        float wrap = dot(n, uSunDir) * 0.5 + 0.5;
        float bands = floor(wrap * 4.0) / 4.0;
        float shade = mix(wrap, bands, 0.55);

        #ifdef TINT
          vec3 base = uTint;
        #else
          vec3 base = mix(uGroundLow, uGroundHigh, smoothstep(0.0, 55.0, vWorld.y));
          base = mix(base, base * 0.8, smoothstep(0.55, 0.85, 1.0 - n.y)); // steep faces darker
        #endif

        #ifdef PITCH
          vec2 q = abs(vWorld.xz - uPitchCenter);
          float onPitch = (1.0 - smoothstep(uPitchHalf.x - 0.15, uPitchHalf.x, q.x)) * (1.0 - smoothstep(uPitchHalf.y - 0.2, uPitchHalf.y, q.y));
          base = mix(base, vec3(0.78, 0.66, 0.46), onPitch);
          float crease = (1.0 - smoothstep(0.03, 0.07, abs(q.y - (uPitchHalf.y - 1.2)))) * step(q.x, uPitchHalf.x);
          base = mix(base, vec3(0.97, 0.95, 0.9), crease);
        #endif

        // Brush mottling at two scales, so flat areas still feel hand-made.
        float mottle = vnoise(vWorld.xz * 0.35) * 0.6 + vnoise(vWorld.xz * 2.1) * 0.4;
        vec3 lit = base * (0.32 + 0.85 * shade) * mix(vec3(1.0), uSunColor, 0.35 * uLight);
        lit *= 0.9 + 0.2 * mottle;

        // Contour lines: thin everywhere, heavier every fifth, with a soft halo that blooms at night.
        float b = vWorld.y / uSpacing;
        float dist = min(fract(b), 1.0 - fract(b));
        float w = fwidth(b);
        float major = step(fract(floor(b + 0.5) / 5.0 + 0.001), 0.01);
        float core = 1.0 - smoothstep(w * (0.6 + major * 0.8), w * (1.6 + major * 1.4), dist);
        float halo = (1.0 - smoothstep(0.0, w * 6.0, dist)) * 0.35;
        float glow = mix(1.9, 1.1, uLight);
        vec3 col = mix(lit, uLine * glow, clamp(core * (0.75 + major * 0.25) + halo * (1.0 - uLight * 0.6), 0.0, 1.0) * uLineStrength * mix(1.0, 0.45, uLight));
        // ^ lines recede by day (so landmarks read) and come back to full glow at night.

        gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

/** Sky dome: gradient, a sun that rises with uLight, and stars that fade out at dawn. */
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { ...atmosphere },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSkyTop, uHorizon, uSunDir, uSunColor;
      uniform float uLight, uTime;
      varying vec3 vDir;
      ${noise2}
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(uHorizon, uSkyTop, smoothstep(-0.02, 0.55, d.y));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, 600.0) * 3.0 + pow(s, 24.0) * 0.45 + pow(s, 4.0) * 0.18) * uLight;
        // Stars: sparse hashed points, twinkling, gone by morning.
        vec2 g = d.xz / (d.y + 1.2) * 340.0;
        float star = step(0.9985, hash12(floor(g))) * (0.6 + 0.4 * sin(uTime * 2.0 + hash12(floor(g) + 3.1) * 40.0));
        col += vec3(0.85, 0.9, 1.0) * star * (1.0 - smoothstep(0.1, 0.5, uLight)) * smoothstep(0.0, 0.2, d.y);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

/** The orb: a dark sphere drawn in drifting glowing contour lines with a cold rim — the user's image, in 3D. */
export function orbMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: atmosphere.uTime },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormalV;
      varying vec3 vView;
      void main() {
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vNormalV;
      varying vec3 vView;
      ${noise2}
      float n3(vec3 p) { return vnoise(p.xy + p.z * 1.7) * 0.5 + vnoise(p.yz * 1.3 - p.x) * 0.5; }
      void main() {
        vec3 p = normalize(vPos);
        float h = n3(p * 2.2 + vec3(0.0, uTime * 0.03, 0.0)) + 0.5 * n3(p * 4.6 - uTime * 0.02);
        float b = h * 9.0;
        float dist = min(fract(b), 1.0 - fract(b));
        float w = fwidth(b);
        float line = 1.0 - smoothstep(w * 0.7, w * 1.8, dist);
        float halo = (1.0 - smoothstep(0.0, w * 7.0, dist)) * 0.3;
        float fres = pow(1.0 - max(dot(normalize(vNormalV), normalize(vView)), 0.0), 2.5);
        vec3 col = vec3(0.02, 0.05, 0.13) + vec3(0.25, 0.5, 1.0) * fres * 1.4;
        col += vec3(0.75, 0.88, 1.0) * (line * 2.2 + halo);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}
