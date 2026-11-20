import * as THREE from 'three'
import { Pass } from 'postprocessing'

/*
 * The projector beam, shared by every lab scene: a rectangular light frustum from a booth port,
 * ray-marched through animated haze, plus dust motes that only light up inside it.
 */

// Tileable 3D value-noise fbm baked once on the CPU, so the shaders pay one texture fetch per octave.
export function noiseVolume(N = 64) {
  const octaves = [[4, 0.5], [8, 0.3], [16, 0.2]]
  const lattices = octaves.map(([p]) => Float32Array.from({ length: p * p * p }, Math.random))
  const s = t => t * t * (3 - 2 * t)
  const data = new Uint8Array(N * N * N)
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let v = 0
        octaves.forEach(([p, w], o) => {
          const g = lattices[o]
          const fx = (x / N) * p, fy = (y / N) * p, fz = (z / N) * p
          const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz)
          const tx = s(fx - ix), ty = s(fy - iy), tz = s(fz - iz)
          const at = (a, b, c) => g[(((c % p) * p + (b % p)) * p) + (a % p)]
          const lx = (b, c) => at(ix, b, c) + (at(ix + 1, b, c) - at(ix, b, c)) * tx
          const ly = c => lx(iy, c) + (lx(iy + 1, c) - lx(iy, c)) * ty
          v += w * (ly(iz) + (ly(iz + 1) - ly(iz)) * tz)
        })
        data[(z * N + y) * N + x] = Math.min(255, v * 255)
      }
  const tex = new THREE.Data3DTexture(data, N, N, N)
  tex.format = THREE.RedFormat
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}

/** Beam frame from the port toward the screen centre. tanX/tanY are the half-angle tangents (2.39:1 scope). */
export function beamFrame(apex, target, tanX = 0.27, tanY = 0.115, portHalf = 0.3) {
  const axis = target.clone().sub(apex).normalize()
  const right = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, axis).normalize()
  const z0 = portHalf / tanX
  return { apex, axis, right, up, tan: new THREE.Vector2(tanX, tanY), z0, apexV: apex.clone().addScaledVector(axis, -z0) }
}

export const beamUniforms = b => ({
  uApexV: { value: b.apexV },
  uAxis: { value: b.axis },
  uRight: { value: b.right },
  uUp: { value: b.up },
  uTan: { value: b.tan },
  uZ0: { value: b.z0 },
  uLamp: { value: 1 },
})

export const BEAM_GLSL = /* glsl */ `
uniform vec3 uApexV; uniform vec3 uAxis; uniform vec3 uRight; uniform vec3 uUp;
uniform vec2 uTan; uniform float uZ0; uniform float uLamp;
// Irradiance factor of the beam at p (0 outside the frustum); buv is the beam-space position (-1..1 inside).
float beamAt(vec3 p, out vec2 buv, out float z) {
  vec3 v = p - uApexV;
  z = dot(v, uAxis);
  buv = vec2(dot(v, uRight), dot(v, uUp)) / (max(z, 1e-3) * uTan);
  if (z < uZ0) return 0.0;
  float edge = smoothstep(1.0, 0.9, abs(buv.x)) * smoothstep(1.0, 0.84, abs(buv.y));
  float d = z - uZ0;
  return edge / (1.0 + 0.0045 * d * d);
}
`

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }
`

const MARCH_FRAG = /* glsl */ `
#include <packing>
varying vec2 vUv;
uniform sampler2D tDepth;
uniform highp sampler3D tNoise;
uniform mat4 uInvProj; uniform mat4 uCamWorld; uniform vec3 uCamPos;
uniform float uNear; uniform float uFar; uniform float uTime; uniform float uFrame;
uniform float uSteps; uniform float uDensity; uniform float uMaxDist;
uniform vec3 uBeamColor; uniform vec3 uWarm; uniform vec3 uAmbient;
${BEAM_GLSL}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float haze(vec3 p) {
  vec3 q = p * 0.045 + vec3(0.0, uTime * 0.004, -uTime * 0.007);
  float a = texture(tNoise, q).r;
  float b = texture(tNoise, q * 2.7 + a * 0.4 + vec3(0.3, uTime * 0.012, 0.0)).r;
  return smoothstep(0.36, 0.8, a * 0.6 + b * 0.4);
}
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
void main() {
  vec4 vp = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 vdir = normalize(vp.xyz / vp.w);
  vec3 dir = normalize(mat3(uCamWorld) * vdir);
  float vz = perspectiveDepthToViewZ(texture2D(tDepth, vUv).r, uNear, uFar);
  float tMax = min(-vz / max(-vdir.z, 1e-4), uMaxDist);
  float dt = tMax / uSteps;
  float j = ign(gl_FragCoord.xy + uFrame * 5.588238);
  vec3 L = vec3(0.0);
  for (int i = 0; i < 96; i++) {
    if (float(i) >= uSteps) break;
    float tt = (float(i) + j) * dt;
    vec3 p = uCamPos + dir * tt;
    float h = haze(p);
    // Haze right at the lens would fog the whole frame; real air only reads at a distance.
    float nearK = smoothstep(0.4, 3.0, tt);
    vec2 buv; float z;
    float b = beamAt(p, buv, z);
    if (b > 0.0005) {
      // Streaks are constant along rays from the port, so they read as shafts inside the beam.
      float s1 = texture(tNoise, vec3(buv * vec2(2.2, 1.2), uTime * 0.004)).r;
      float s2 = texture(tNoise, vec3(buv * vec2(7.0, 3.5) + 0.37, uTime * 0.006)).r;
      float streak = 0.06 + 1.7 * smoothstep(0.4, 0.78, s1 * 0.6 + s2 * 0.4);
      vec3 col = mix(uBeamColor, uWarm, 0.45 * smoothstep(0.5, 0.85, texture(tNoise, vec3(buv * 0.35 + 0.5, 0.7)).r));
      float ph = hg(dot(dir, -normalize(p - uApexV)), 0.6) * 2.2;
      L += col * b * streak * (0.03 + h * (0.35 + h)) * (0.3 + ph) * uLamp * nearK;
    }
    L += uAmbient * h * nearK;
  }
  gl_FragColor = vec4(L * dt * uDensity, 1.0);
}
`

const COMP_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tInput; uniform sampler2D tVol; uniform vec2 uTexel;
void main() {
  vec3 v = texture2D(tVol, vUv).rgb * 0.4
    + (texture2D(tVol, vUv + vec2(uTexel.x, 0.0)).rgb + texture2D(tVol, vUv - vec2(uTexel.x, 0.0)).rgb
     + texture2D(tVol, vUv + vec2(0.0, uTexel.y)).rgb + texture2D(tVol, vUv - vec2(0.0, uTexel.y)).rgb) * 0.15;
  vec4 c = texture2D(tInput, vUv);
  gl_FragColor = vec4(c.rgb + v, c.a);
}
`

/** Ray-marches the beam at reduced resolution against the scene depth, then adds it over the frame. */
export class VolumetricPass extends Pass {
  constructor(camera, beam, noiseTex, { scale = 0.5, steps = 48 } = {}) {
    super('VolumetricPass')
    this.needsDepthTexture = true
    this.cam = camera
    this.scale = scale
    this.low = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false })
    this.march = new THREE.ShaderMaterial({
      uniforms: {
        ...beamUniforms(beam),
        tDepth: { value: null },
        tNoise: { value: noiseTex },
        uInvProj: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uTime: { value: 0 },
        uFrame: { value: 0 },
        uSteps: { value: steps },
        uDensity: { value: 1 },
        uMaxDist: { value: 60 },
        uBeamColor: { value: new THREE.Color(0.6, 0.76, 1.0) },
        uWarm: { value: new THREE.Color(1.0, 0.8, 0.6) },
        uAmbient: { value: new THREE.Color(0.0005, 0.0007, 0.0014) },
      },
      vertexShader: FS_VERT,
      fragmentShader: MARCH_FRAG,
      depthWrite: false,
      depthTest: false,
    })
    this.uniforms = this.march.uniforms
    this.composite = new THREE.ShaderMaterial({
      uniforms: { tInput: { value: null }, tVol: { value: this.low.texture }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: COMP_FRAG,
      depthWrite: false,
      depthTest: false,
    })
    this.fullscreenMaterial = this.march
  }

  setDepthTexture(t) {
    this.march.uniforms.tDepth.value = t
  }

  setSize(w, h) {
    this.low.setSize(Math.max(1, Math.round(w * this.scale)), Math.max(1, Math.round(h * this.scale)))
    this.composite.uniforms.uTexel.value.set(1 / this.low.width, 1 / this.low.height)
  }

  render(renderer, inputBuffer, outputBuffer) {
    const u = this.march.uniforms
    const c = this.cam
    u.uInvProj.value.copy(c.projectionMatrixInverse)
    u.uCamWorld.value.copy(c.matrixWorld)
    u.uCamPos.value.setFromMatrixPosition(c.matrixWorld)
    u.uNear.value = c.near
    u.uFar.value = c.far
    u.uFrame.value = (u.uFrame.value + 1) % 64
    this.fullscreenMaterial = this.march
    renderer.setRenderTarget(this.low)
    renderer.render(this.scene, this.camera)
    this.fullscreenMaterial = this.composite
    this.composite.uniforms.tInput.value = inputBuffer.texture
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
    renderer.render(this.scene, this.camera)
  }
}

const DUST_VERT = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime; uniform float uFocus; uniform float uAperture; uniform float uSize; uniform float uDpr;
uniform float uSwirl; uniform float uPull;
${BEAM_GLSL}
varying float vB; varying float vCoc; varying float vTw; varying float vNear;
void main() {
  vec3 p = position;
  float t = uTime;
  p += vec3(sin(t * 0.11 + aSeed.x * 40.0), sin(t * 0.07 + aSeed.y * 40.0), cos(t * 0.09 + aSeed.z * 40.0)) * (0.2 + aSeed.z * 0.35);
  // Swirl around the beam axis: a slow vortex, tighter near the axis.
  vec3 v = p - uApexV;
  float z = dot(v, uAxis);
  vec3 rad = v - uAxis * z;
  float ang = uSwirl * (t * 0.06 + 0.5 / (0.5 + length(rad))) * (0.5 + aSeed.x);
  rad = rad * cos(ang) + cross(uAxis, rad) * sin(ang);
  // At the takeover the motes stream into the lamp.
  float pull = smoothstep(0.0, 1.0, uPull * (0.55 + aSeed.y * 0.9));
  float zz = mix(z, uZ0 + (z - uZ0) * 0.04, pull);
  p = uApexV + uAxis * zz + rad * mix(1.0, zz / max(z, 1e-3), pull);
  vec2 buv; float bz;
  vB = beamAt(p, buv, bz) * uLamp;
  vTw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(t * (0.8 + aSeed.z * 2.5) + aSeed.x * 60.0), 3.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vCoc = abs(dist - uFocus) * uAperture;
  // Motes brushing the lens would be huge grey discs: let them pass out of view instead.
  vNear = smoothstep(0.3, 1.6, dist);
  gl_PointSize = clamp((uSize * (0.5 + aSeed.y) / dist + vCoc * 10.0) * uDpr, 1.0, 56.0);
  gl_Position = projectionMatrix * mv;
}
`

const DUST_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uLamp;
varying float vB; varying float vCoc; varying float vTw; varying float vNear;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  // In focus a mote is a crisp square pixel; out of focus it opens into a soft bokeh disc.
  float k = smoothstep(0.12, 0.7, vCoc);
  float shape = mix(1.0, smoothstep(0.5, 0.36, r) * (0.7 + 0.3 * smoothstep(0.25, 0.47, r)), k);
  float a = shape * (vB * vTw * 2.4 + 0.004 * min(uLamp, 1.0)) * vNear / (1.0 + vCoc * vCoc * 5.0);
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`

/** n dust motes: most seeded inside the beam, the rest loose in the room box. */
export function makeDust(n, beam, box, { inBeam = 0.88, reach = 30 } = {}) {
  const pos = new Float32Array(n * 3)
  const seed = new Float32Array(n * 3)
  const p = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    if (Math.random() < inBeam) {
      const z = beam.z0 + Math.pow(Math.random(), 1.35) * reach
      p.copy(beam.apexV)
        .addScaledVector(beam.axis, z)
        .addScaledVector(beam.right, (Math.random() * 2 - 1) * 1.05 * z * beam.tan.x)
        .addScaledVector(beam.up, (Math.random() * 2 - 1) * 1.1 * z * beam.tan.y)
    } else {
      p.set(
        THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random()),
        THREE.MathUtils.lerp(box.min.y, box.max.y, Math.random()),
        THREE.MathUtils.lerp(box.min.z, box.max.z, Math.random()),
      )
    }
    p.toArray(pos, i * 3)
    seed[i * 3] = Math.random()
    seed[i * 3 + 1] = Math.random()
    seed[i * 3 + 2] = Math.random()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...beamUniforms(beam),
      uTime: { value: 0 },
      uFocus: { value: 8 },
      uAperture: { value: 0.2 },
      uSize: { value: 7 },
      uDpr: { value: 1 },
      uSwirl: { value: 1 },
      uPull: { value: 0 },
      uColor: { value: new THREE.Color(0.85, 0.92, 1.0).multiplyScalar(0.8) },
    },
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  return points
}

/** Soft radial glow / anamorphic streak textures for the port. */
export function glowTexture(kind = 'radial') {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = kind === 'streak' ? 32 : 256
  const g = c.getContext('2d')
  if (kind === 'streak') {
    const h = g.createLinearGradient(0, 0, 256, 0)
    h.addColorStop(0, 'rgba(255,255,255,0)')
    h.addColorStop(0.5, 'rgba(255,255,255,1)')
    h.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = h
    g.fillRect(0, 0, 256, 32)
    const v = g.createLinearGradient(0, 0, 0, 32)
    v.addColorStop(0, 'rgba(0,0,0,1)')
    v.addColorStop(0.5, 'rgba(0,0,0,0)')
    v.addColorStop(1, 'rgba(0,0,0,1)')
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = v
    g.fillRect(0, 0, 256, 32)
  } else {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.12, 'rgba(255,255,255,0.45)')
    r.addColorStop(0.4, 'rgba(255,255,255,0.08)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 256, 256)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
