import * as THREE from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'

const perlin = new ImprovedNoise()

export const SIZE = 640
/** The childhood hilltop: a soft hill with a flattened top and a pitch running along z. */
export const HILL = { x: 40, z: -60, flat: 16 }
export const PITCH = { halfWidth: 1.5, halfLength: 10 }
/** The lake you end at, with water at WATER_Y. The skyline stands on the ridge beyond it. */
export const LAKE = { x: 40, z: 190, r: 70, blend: 34 }
export const WATER_Y = -2

function fbm(x, z) {
  let sum = 0
  let amp = 1
  let freq = 1 / 95
  for (let o = 0; o < 5; o++) {
    sum += amp * perlin.noise(x * freq, z * freq, 1.7)
    amp *= 0.5
    freq *= 2.03
  }
  return sum
}

function raw(x, z) {
  const d = Math.hypot(x - HILL.x, z - HILL.z)
  return fbm(x, z) * 38 + 6 + 30 * Math.exp(-(d * d) / (2 * 45 * 45))
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export const PLATEAU = raw(HILL.x, HILL.z) + 1.5

/**
 * Levelled pads where things stand: the hilltop, the chai stall, the cinema and the five project
 * landmarks down the eastern valley. Each pad keeps the natural height at its centre.
 */
const pad = (x, z, r, blend, lift = 0) => ({ x, z, r, blend, y: raw(x, z) + lift })
export const SITES = {
  hill: { x: HILL.x, z: HILL.z, r: HILL.flat, blend: 26, y: PLATEAU },
  chai: pad(70, -32, 6, 12, 0.5),
  cinema: pad(36, 8, 13, 16),
  projects: [
    pad(150, 66, 10, 14),
    pad(166, 100, 10, 14),
    pad(150, 134, 10, 14),
    pad(168, 166, 10, 14),
    pad(146, 196, 10, 14),
  ],
}
const PADS = [SITES.hill, SITES.chai, SITES.cinema, ...SITES.projects]

/** Ground height in metres at (x, z): natural terrain, levelled pads, and the lake basin. */
export function height(x, z) {
  let h = raw(x, z)
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z)
    if (d < p.r + p.blend) h = THREE.MathUtils.lerp(h, p.y, smoothstep(p.r + p.blend, p.r, d))
  }
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z)
  if (dl < LAKE.r + LAKE.blend) h = THREE.MathUtils.lerp(h, Math.min(h, WATER_Y - 9), smoothstep(LAKE.r + LAKE.blend, LAKE.r * 0.6, dl))
  return h
}

/** Heightfield mesh, displaced on the CPU so trees, props and the camera can share the same heights. */
export function terrainGeometry(segments) {
  const g = new THREE.PlaneGeometry(SIZE, SIZE, segments, segments).rotateX(-Math.PI / 2)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)))
  g.computeVertexNormals()
  return g
}

/** Scatter trees on gentle ground, clear of every site and the lake. Seeded, so the world is stable. */
export function treeSpots(count) {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const out = []
  for (let tries = 0; out.length < count && tries < count * 30; tries++) {
    const x = (rand() - 0.5) * SIZE * 0.9
    const z = (rand() - 0.5) * SIZE * 0.9
    if (PADS.some(p => Math.hypot(x - p.x, z - p.z) < p.r + 10)) continue
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + LAKE.blend * 0.6) continue
    if (z > 262 && x > -100 && x < 180) continue // the skyline's ground
    const h = height(x, z)
    const slope = Math.abs(height(x + 2, z) - h) + Math.abs(height(x, z + 2) - h)
    if (h < -14 || h > 52 || slope > 1.6) continue
    out.push({ x, z, y: h, s: 1.6 + rand() * 2.4, r: rand() * Math.PI })
  }
  return out
}
