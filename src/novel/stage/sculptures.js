/*
 * Project landmarks are contour lines lifted off the ground: each shape is a signed distance
 * function, cut into horizontal slices, and every slice's outline (marching squares) becomes a ring.
 */

const len2 = (x, y) => Math.hypot(x, y)
const len3 = (x, y, z) => Math.hypot(x, y, z)
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

function capsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az
  const bax = bx - ax, bay = by - ay, baz = bz - az
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)))
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - r
}
function box(px, py, pz, cx, cy, cz, hx, hy, hz, round = 0) {
  const qx = Math.abs(px - cx) - hx + round, qy = Math.abs(py - cy) - hy + round, qz = Math.abs(pz - cz) - hz + round
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - round
}
function ellipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = (px - cx) / rx, y = (py - cy) / ry, z = (pz - cz) / rz
  const k0 = len3(x, y, z)
  const k1 = len3(x / rx, y / ry, z / rz)
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
}

/** Three-quarter turns per shape, so depth (temples, towers, the shield) reads from the camera. */
export const YAW = { hand: -0.12, brain: 0.45, glasses: 0.62, sword: 0.35, city: 0.6 }

/** Shapes, roughly 12–15 m tall, standing on y = 0. */
export const SHAPES = {
  // Smash Cricket: an open hand, fingers up — the gesture the game reads.
  hand(x, y, z) {
    let d = box(x, y, z, 0, 5.2, 0, 3.6, 2.9, 1.05, 0.9)
    d = smin(d, capsule(x, y, z, 0, 0, 0, 0, 3, 0, 2.2), 1.2)
    // Four fingers fanned wide plus a thumb out to the side: an unmistakable "five".
    const fingers = [[-3.3, 3.7, -1.5], [-1.15, 4.7, -0.45], [1.1, 4.9, 0.4], [3.2, 4.1, 1.35]]
    for (const [fx, l, tilt] of fingers) d = smin(d, capsule(x, y, z, fx, 7.4, 0, fx + tilt, 7.4 + l, 0, 0.82), 0.6)
    d = smin(d, capsule(x, y, z, 3.4, 4.2, 0.2, 7.2, 7.4, 0.7, 0.9), 0.8)
    return d
  },
  // CogniFlow: a brain, two folded hemispheres on a stem.
  brain(x, y, z) {
    let d = smin(ellipsoid(x, y, z, -2.1, 8.4, 0, 3.6, 4.1, 5.6), ellipsoid(x, y, z, 2.1, 8.4, 0, 3.6, 4.1, 5.6), 0.8)
    d += 0.32 * Math.sin(x * 2.9) * Math.sin(y * 2.4) * Math.sin(z * 2.6)
    d = smin(d, capsule(x, y, z, 0, 0, 1.2, 0, 5, 0.6, 1.2), 1.4)
    return d
  },
  // Revere: a pair of glasses, floating, lenses facing you.
  glasses(x, y, z) {
    const lens = cx => {
      const qx = Math.hypot(x - cx, y - 8) - 2.7
      return Math.hypot(qx, z) - 0.42
    }
    let d = Math.min(lens(-3.4), lens(3.4))
    d = Math.min(d, capsule(x, y, z, -0.9, 8.9, 0, 0.9, 8.9, 0, 0.38))
    d = Math.min(d, capsule(x, y, z, -6.05, 8.9, 0, -6.4, 8.4, -7.5, 0.34))
    d = Math.min(d, capsule(x, y, z, 6.05, 8.9, 0, 6.4, 8.4, -7.5, 0.34))
    return d
  },
  // Yudhveer: a sword planted in the ground, a round shield leaning beside it.
  sword(x, y, z) {
    let d = box(x, y, z, 1.6, 6.4, 0, 0.42, 5.2, 0.2)
    d = Math.min(d, box(x, y, z, 1.6, 11.8, 0, 2.3, 0.32, 0.38, 0.1))
    d = Math.min(d, capsule(x, y, z, 1.6, 12, 0, 1.6, 14, 0, 0.32))
    d = Math.min(d, len3(x - 1.6, y - 14.4, z) - 0.6)
    // Shield: a short cylinder on its edge, tipped back.
    const t = -0.28
    const sy = y - 4.4, sz = z - 1.6
    const ry = sy * Math.cos(t) - sz * Math.sin(t)
    const rz = sy * Math.sin(t) + sz * Math.cos(t)
    const shield = Math.max(len2(x + 3.8, ry) - 4.1, Math.abs(rz) - 0.38)
    return Math.min(d, shield)
  },
  // Commit City: a block of towers, heights like a year of commits.
  city(x, y, z) {
    const heights = [5, 9, 6, 12, 7, 14, 4, 8, 10, 6, 11, 5, 8, 13, 6, 9]
    let d = Infinity
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const h = heights[i * 4 + j]
        d = Math.min(d, box(x, y, z, (i - 1.5) * 3.2, h / 2, (j - 1.5) * 3.2, 1.25, h / 2, 1.25))
      }
    }
    return d
  },
}

/**
 * Slice an SDF into contour rings. Returns a flat [x,y,z, x,y,z, ...] segment list for LineSegments2.
 * Marching squares on an xz grid per slice, with linear interpolation along cell edges.
 */
export function sliceShape(sdf, { half = 8, top = 15, levels = 28, res = 80 } = {}) {
  const out = []
  const step = (half * 2) / res
  const v = new Float32Array((res + 1) * (res + 1))
  for (let k = 0; k < levels; k++) {
    const y = ((k + 0.5) / levels) * top
    for (let j = 0; j <= res; j++) {
      for (let i = 0; i <= res; i++) v[j * (res + 1) + i] = sdf(-half + i * step, y, -half + j * step)
    }
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const a = v[j * (res + 1) + i], b = v[j * (res + 1) + i + 1]
        const c = v[(j + 1) * (res + 1) + i + 1], d = v[(j + 1) * (res + 1) + i]
        const x0 = -half + i * step, z0 = -half + j * step
        // Crossing points on each edge (bottom, right, top, left) where the sign changes.
        const pts = []
        const cross = (va, vb, ax, az, bx, bz) => {
          if ((va < 0) !== (vb < 0)) {
            const t = va / (va - vb)
            pts.push(ax + (bx - ax) * t, az + (bz - az) * t)
          }
        }
        cross(a, b, x0, z0, x0 + step, z0)
        cross(b, c, x0 + step, z0, x0 + step, z0 + step)
        cross(c, d, x0 + step, z0 + step, x0, z0 + step)
        cross(d, a, x0, z0 + step, x0, z0)
        for (let p = 0; p + 3 < pts.length; p += 4) out.push(pts[p], y, pts[p + 1], pts[p + 2], y, pts[p + 3])
      }
    }
  }
  return new Float32Array(out)
}
