import { BANDS, field } from './noise.js'
import { SHAPES, sliceShape } from './sculptures.js'

/*
 * Point "targets": where each of the N pixels sits in every state of the story.
 * All arrays are Float32Array(N * 3), so morphing is just mixing two of them.
 */

export const ORB_R = 1.6

function rng(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/** The vortex: a two-armed spiral galaxy of square pixels, thin at the rim, swollen at the core. */
export function galaxy(n, seed = 3) {
  const r = rng(seed)
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const t = Math.pow(r(), 0.62)
    const radius = 0.12 + t * 4.4
    const arm = (i % 3) * ((Math.PI * 2) / 3)
    const spread = (r() - 0.5) * (0.55 + (1 - t) * 1.2) * (1 - t * 0.35)
    const angle = arm + radius * 1.35 + spread
    const thick = (r() - 0.5) * 0.32 * Math.pow(1 - t, 2) * 2
    const jitter = (r() - 0.5) * 0.16
    out[i * 3] = Math.cos(angle) * radius + jitter
    out[i * 3 + 1] = thick
    out[i * 3 + 2] = Math.sin(angle) * radius + jitter
  }
  return out
}

/** Points lying on the orb's contour lines (the same field the shader draws), heavier lines denser. */
export function orbLines(n, seed = 5) {
  const r = rng(seed)
  const out = new Float32Array(n * 3)
  let i = 0
  for (let tries = 0; i < n && tries < n * 60; tries++) {
    const u = r() * 2 - 1
    const a = r() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const x = s * Math.cos(a), y = u, z = s * Math.sin(a)
    const b = field(x, y, z) * BANDS
    const d = Math.min(b - Math.floor(b), Math.ceil(b) - b)
    const major = Math.round(b) % 5 === 0
    if (d > (major ? 0.07 : 0.035)) continue
    out[i * 3] = x * ORB_R
    out[i * 3 + 1] = y * ORB_R
    out[i * 3 + 2] = z * ORB_R
    i++
  }
  return out
}

/** A project's shape as stacked contour rings, sampled evenly along their length, scaled to orb size. */
export function shapeRings(key, n, seed = 9) {
  const segs = sliceShape(SHAPES[key], { half: 9, top: 15.5, levels: 54, res: 96 })
  const count = segs.length / 6
  const lengths = new Float32Array(count)
  let total = 0
  for (let k = 0; k < count; k++) {
    const o = k * 6
    total += Math.hypot(segs[o + 3] - segs[o], segs[o + 4] - segs[o + 1], segs[o + 5] - segs[o + 2])
    lengths[k] = total
  }
  const r = rng(seed)
  const out = new Float32Array(n * 3)
  const scale = 0.21
  for (let i = 0; i < n; i++) {
    const target = r() * total
    let lo = 0, hi = count - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (lengths[mid] < target) lo = mid + 1
      else hi = mid
    }
    const o = lo * 6
    const t = r()
    out[i * 3] = (segs[o] + (segs[o + 3] - segs[o]) * t) * scale
    out[i * 3 + 1] = ((segs[o + 1] + (segs[o + 4] - segs[o + 1]) * t) - 7.5) * scale
    out[i * 3 + 2] = (segs[o + 2] + (segs[o + 5] - segs[o + 2]) * t) * scale
  }
  return out
}

/** Loose dust around the orb, where leftover pixels settle. */
export function dust(n, seed = 11) {
  const r = rng(seed)
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1
    const a = r() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    // Most dust hugs the limb like sparks thrown off the surface; a little drifts further out.
    const rad = ORB_R * (1.03 + Math.pow(r(), 3.2) * 1.9)
    out[i * 3] = s * Math.cos(a) * rad
    out[i * 3 + 1] = u * rad
    out[i * 3 + 2] = s * Math.sin(a) * rad
  }
  return out
}
