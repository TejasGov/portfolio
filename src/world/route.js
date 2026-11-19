import * as THREE from 'three'
import { HILL, PITCH, PLATEAU, SITES, WATER_Y, height } from './terrain'
import { PROJECTS, ROLES } from './content'

/*
 * The whole journey on one scroll axis (p: 0 → 1):
 *   0.00 orb · 0.08 inside it · 0.10 above the land · 0.24 hilltop (cricket) · 0.33 chai stall
 *   0.40 cinema · 0.50 five project landmarks · 0.74 lamp path (work) · 0.85 the lake at night
 */

export const ORB = new THREE.Vector3(0, 320, 0)
export const STUMPS_Z = HILL.z + PITCH.halfLength - 1.2
const P = PLATEAU
const CH = SITES.chai
const CI = SITES.cinema

export const PROJECT_P = PROJECTS.map((_, i) => 0.5 + i * 0.045)

/** Lamps on the dusk path from the last landmark to the lake shore. */
const PATH_A = new THREE.Vector2(150, 214)
const PATH_B = new THREE.Vector2(113, 166)
const PATH_DIR = PATH_B.clone().sub(PATH_A).normalize()
const PATH_PERP = new THREE.Vector2(-PATH_DIR.y, PATH_DIR.x)
export const LAMPS = ROLES.map((_, j) => {
  const t = (j + 0.5) / ROLES.length
  const at = PATH_A.clone().lerp(PATH_B, t).addScaledVector(PATH_PERP, j % 2 ? 2.2 : -2.2)
  return new THREE.Vector3(at.x, height(at.x, at.y), at.y)
})
export const LAMP_P = ROLES.map((_, j) => 0.745 + j * 0.016)

const keys = [
  { p: 0.0, pos: [0, 321, 34], look: [0, 320, 0] },
  { p: 0.06, pos: [0, 320.4, 11], look: [0, 320, 0] },
  { p: 0.085, pos: [0, 320, 2], look: [0, 318, -1] },
  { p: 0.1, pos: [0, 290, 1], look: [0, 0, -6] },
  { p: 0.15, pos: [8, 175, 50], look: [30, 20, -40] },
  { p: 0.2, pos: [26, 88, 42], look: [40, 40, -60] },
  { p: 0.24, pos: [HILL.x + 10, P + 4.5, HILL.z - 2], look: [HILL.x, P + 0.8, HILL.z] },
  { p: 0.275, pos: [HILL.x + 0.7, P + 1.45, STUMPS_Z - 5.2], look: [HILL.x, P + 0.7, STUMPS_Z + 6] },
  { p: 0.3, pos: [HILL.x + 0.4, P + 1.5, STUMPS_Z - 4.2], look: [HILL.x + 0.5, P + 0.8, STUMPS_Z + 6] },
  { p: 0.33, pos: [CH.x - 13, CH.y + 4.5, CH.z + 6], look: [CH.x, CH.y + 1.2, CH.z] },
  { p: 0.355, pos: [CH.x - 4.4, CH.y + 1.75, CH.z + 2], look: [CH.x, CH.y + 1.15, CH.z] },
  { p: 0.375, pos: [CH.x - 4.0, CH.y + 1.65, CH.z + 1.4], look: [CH.x, CH.y + 1.15, CH.z] },
  { p: 0.405, pos: [56, CI.y + 15, -18], look: [CI.x, CI.y + 5, CI.z] },
  { p: 0.43, pos: [CI.x + 3, CI.y + 3.2, CI.z - 34], look: [CI.x, CI.y + 8, CI.z] },
  { p: 0.45, pos: [CI.x + 1.5, CI.y + 2.8, CI.z - 30], look: [CI.x, CI.y + 8.2, CI.z] },
  { p: 0.475, pos: [86, CI.y + 24, 18], look: [150, -10, 66] },
  ...PROJECTS.flatMap((_, i) => {
    const s = SITES.projects[i]
    return [
      { p: PROJECT_P[i], pos: [s.x - 25, s.y + 6.5, s.z - 15], look: [s.x + 1.5, s.y + 7.5, s.z - 3] },
      { p: PROJECT_P[i] + 0.022, pos: [s.x - 23, s.y + 5.5, s.z - 6], look: [s.x + 2, s.y + 7.5, s.z - 1.5] },
    ]
  }),
  ...LAMPS.map((l, j) => ({
    p: LAMP_P[j],
    pos: [l.x - PATH_DIR.x * 5 - PATH_PERP.x * (j % 2 ? 1.6 : -1.6), l.y + 1.7, l.z - PATH_DIR.y * 5 - PATH_PERP.y * (j % 2 ? 1.6 : -1.6)],
    look: [l.x + PATH_DIR.x * 4, l.y + 2.2, l.z + PATH_DIR.y * 4],
  })),
  // The south shore, far enough back that the city is a skyline across the water, not a wall.
  { p: 0.855, pos: [98, WATER_Y + 6, 124], look: [30, 13, 300] },
  { p: 0.93, pos: [94, WATER_Y + 4.8, 129], look: [32, 12, 300] },
  { p: 1.0, pos: [91, WATER_Y + 4.2, 133], look: [33, 12, 300] },
]
export const KEYS = keys

export const posCurve = new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k.pos)))
export const lookCurve = new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k.look)))
export function curveU(p) {
  for (let i = 0; i < keys.length - 1; i++) {
    if (p <= keys[i + 1].p) return (i + (p - keys[i].p) / (keys[i + 1].p - keys[i].p)) / (keys.length - 1)
  }
  return 1
}

/** A whole day: night → dawn → morning → noon → golden hour → dusk → night again. */
export const PALETTE = [
  { p: 0.0, top: '#02040c', hor: '#081127', low: '#0a1124', high: '#141e3a', line: '#9cc9ff', sun: '#ffb98a', light: 0, fog: 0.0042 },
  { p: 0.1, top: '#040a1c', hor: '#14254d', low: '#0e1730', high: '#1b2748', line: '#a9d0ff', sun: '#ffb98a', light: 0.05, fog: 0.0045 },
  { p: 0.17, top: '#1d2858', hor: '#c58b9c', low: '#2b3546', high: '#6b675a', line: '#ffe2c6', sun: '#ffb070', light: 0.45, fog: 0.005 },
  { p: 0.25, top: '#4a66ad', hor: '#f0bf9e', low: '#465e3c', high: '#968c5c', line: '#fff0da', sun: '#ffc490', light: 0.8, fog: 0.0046 },
  { p: 0.37, top: '#6f8fd2', hor: '#f3d4b6', low: '#4e6a40', high: '#a39760', line: '#fff6e8', sun: '#ffd2a6', light: 1, fog: 0.0042 },
  { p: 0.45, top: '#6b92d8', hor: '#e6e1d2', low: '#557249', high: '#ada46e', line: '#fffaf0', sun: '#fff0d8', light: 1, fog: 0.0036 },
  { p: 0.6, top: '#5a74b8', hor: '#f2c48c', low: '#5a663c', high: '#ad935a', line: '#fff1d6', sun: '#ffb066', light: 0.9, fog: 0.004 },
  { p: 0.72, top: '#3c3f7c', hor: '#ec9c72', low: '#3f4438', high: '#7d6650', line: '#ffe0b8', sun: '#ff9a5a', light: 0.6, fog: 0.0045 },
  { p: 0.79, top: '#1a1d45', hor: '#9d6476', low: '#1e2533', high: '#3d3646', line: '#ffd9b0', sun: '#ff8a5a', light: 0.25, fog: 0.0045 },
  { p: 0.85, top: '#03060f', hor: '#0c1630', low: '#0a1124', high: '#141e3a', line: '#9cc9ff', sun: '#ffb98a', light: 0, fog: 0.0032 },
  { p: 1.0, top: '#02040c', hor: '#0a1430', low: '#0a1124', high: '#141e3a', line: '#a9d0ff', sun: '#ffb98a', light: 0, fog: 0.0032 },
].map(s => ({ ...s, top: new THREE.Color(s.top), hor: new THREE.Color(s.hor), low: new THREE.Color(s.low), high: new THREE.Color(s.high), line: new THREE.Color(s.line), sun: new THREE.Color(s.sun) }))

/** Sun arc: rises east-southeast at dawn, crosses, sets in the west at dusk. */
export function sunDir(p, out) {
  const day = THREE.MathUtils.clamp((p - 0.13) / (0.8 - 0.13), 0, 1)
  const el = Math.sin(day * Math.PI) * 0.7 - 0.06
  const az = 0.97 + day * 2.2
  return out.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize()
}

/** Rise, hold, fall: the white-out that hides the jump from inside the orb to above the land. */
export const veilAt = p => {
  const [a, b, c, d] = [0.07, 0.088, 0.096, 0.112]
  return p < a || p > d ? 0 : p < b ? (p - a) / (b - a) : p <= c ? 1 : 1 - (p - c) / (d - c)
}
