/*
 * One noise function, written twice (JS and GLSL) so the orb's shader-drawn contour lines and the
 * pixels that condense onto them agree. JS runs the hash at float32 precision to match the GPU.
 */
const f = Math.fround
const fract = x => x - Math.floor(x)

function hash3(x, y, z) {
  let a = fract(f(x * 0.1031))
  let b = fract(f(y * 0.1031))
  let c = fract(f(z * 0.1031))
  const d = f(a * (c + 31.32) + b * (b + 31.32) + c * (a + 31.32))
  a = f(a + d)
  b = f(b + d)
  c = f(c + d)
  return fract(f(f(a + b) * c))
}

const smooth = t => t * t * (3 - 2 * t)

function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz)
  const lerp = (a, b, t) => a + (b - a) * t
  const n = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz)
  return lerp(
    lerp(lerp(n(0, 0, 0), n(1, 0, 0), fx), lerp(n(0, 1, 0), n(1, 1, 0), fx), fy),
    lerp(lerp(n(0, 0, 1), n(1, 0, 1), fx), lerp(n(0, 1, 1), n(1, 1, 1), fx), fy),
    fz,
  )
}

function fieldRaw(x, y, z) {
  const s = 1.7
  return (
    (vnoise(x * s + 3.1, y * s + 1.7, z * s + 5.3) - 0.5) * 1.2 +
    (vnoise(x * s * 2.1 + 9.2, y * s * 2.1, z * s * 2.1 + 1.1) - 0.5) * 0.55 +
    (vnoise(x * s * 4.3, y * s * 4.3 + 7.7, z * s * 4.3) - 0.5) * 0.22
  )
}

/**
 * The orb's height field on the unit sphere: domain-warped, so contours meander into long nested
 * loops like a real topographic plate instead of round blobs. Roughly -1..1.
 */
export function field(x, y, z) {
  const k = 0.42
  const wx = x + k * fieldRaw(x * 1.1 + 11.3, y * 1.1, z * 1.1)
  const wy = y + k * fieldRaw(x * 1.1, y * 1.1 + 7.1, z * 1.1)
  const wz = z + k * fieldRaw(x * 1.1, y * 1.1, z * 1.1 + 5.7)
  return fieldRaw(wx, wy, wz)
}

export const BANDS = 13

export const glslField = /* glsl */ `
float hash3(vec3 p) {
  vec3 p3 = fract(p * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1,0,0)), u.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), u.x), u.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), u.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), u.x), u.y),
    u.z);
}
float fieldRaw(vec3 p) {
  float s = 1.7;
  return (vnoise(p * s + vec3(3.1, 1.7, 5.3)) - 0.5) * 1.2
       + (vnoise(p * s * 2.1 + vec3(9.2, 0.0, 1.1)) - 0.5) * 0.55
       + (vnoise(p * s * 4.3 + vec3(0.0, 7.7, 0.0)) - 0.5) * 0.22;
}
float field(vec3 p) {
  float k = 0.42;
  vec3 w = p + k * vec3(
    fieldRaw(p * 1.1 + vec3(11.3, 0.0, 0.0)),
    fieldRaw(p * 1.1 + vec3(0.0, 7.1, 0.0)),
    fieldRaw(p * 1.1 + vec3(0.0, 0.0, 5.7)));
  return fieldRaw(w);
}
const float BANDS = ${BANDS.toFixed(1)};
`
