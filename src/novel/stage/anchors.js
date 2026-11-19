import { ORB_R } from './targets'
import { YAW } from './sculptures'

/*
 * Points the HUD tracks. Orb markers are lat/lon on the orb; work annotations are points on each
 * project's shape (in the shape's sliced space: x, y up to ~15, z), with a short true caption.
 */
const ll = (lat, lon) => {
  const a = (lat * Math.PI) / 180
  const b = (lon * Math.PI) / 180
  return [Math.cos(a) * Math.cos(b) * ORB_R, Math.sin(a) * ORB_R, Math.cos(a) * Math.sin(b) * ORB_R]
}

export const HOME = { lat: 25.4358, lon: 81.8463, at: ll(25.4358, 81.8463) }

/** Survey markers scattered over the orb, numbered like instrument readouts. */
export const ORB_MARKS = [
  [52, 18], [38, 64], [16, 100], [-6, 36], [24, -12], [-30, 84], [60, 122], [-16, 148], [4, -50], [-44, 10], [42, 168], [-22, -92], [8, 58], [-52, 120],
].map(([lat, lon], i) => ({ id: 2086 + i * 3 + (i % 2), at: ll(lat, lon) }))

/** Pairs of markers joined by thin survey lines across the face of the orb. */
export const ORB_LINKS = [[0, 2], [1, 4], [2, 5], [3, 8], [4, 9], [1, 6], [5, 7], [0, 10], [3, 11], [12, 0], [12, 5], [13, 3], [2, 13], [6, 12]]

const S = 0.21
/** Same transform as targets.shapeRings: scale, centre, then the shape's three-quarter turn. */
const shapeOf = key => (x, y, z) => {
  const c = Math.cos(YAW[key])
  const s = Math.sin(YAW[key])
  return [(x * c + z * s) * S, (y - 7.5) * S, (-x * s + z * c) * S]
}

/** Annotations per project shape, in work order (hand, brain, glasses, sword, city). */
export const WORK_NOTES = [
  [
    { at: shapeOf('hand')(-0.45, 12, 0), text: 'index_finger_tip · lm 8' },
    { at: shapeOf('hand')(6.9, 7.2, 0.7), text: 'thumb_tip · lm 4' },
    { at: shapeOf('hand')(0, 5, 1), text: '21 landmarks → 1–6 runs' },
    { at: shapeOf('hand')(0, 1, 0), text: 'latency < 500 ms' },
  ],
  [
    { at: shapeOf('brain')(-2.4, 11.4, 1.5), text: 'LLaMA-3 · language' },
    { at: shapeOf('brain')(2.6, 10.2, -2), text: 'YOLOv8 · visual attention' },
    { at: shapeOf('brain')(3.4, 6.2, 2.5), text: 'XGBoost · abandonment risk' },
    { at: shapeOf('brain')(0, 2.5, 1), text: 'end-to-end < 2 s' },
  ],
  [
    { at: shapeOf('glasses')(-3.4, 10.7, 0), text: 'Gemini 2.0 Flash · faces' },
    { at: shapeOf('glasses')(3.4, 5.4, 0), text: 'Raspberry Pi Zero 2 W' },
    { at: shapeOf('glasses')(6.3, 8.6, -5), text: 'I2S audio · quiet prompts' },
  ],
  [
    { at: shapeOf('sword')(1.6, 14.4, 0), text: 'Three.js · render' },
    { at: shapeOf('sword')(-3.8, 6, 1.6), text: 'Rapier · physics' },
    { at: shapeOf('sword')(1.6, 3, 0), text: 'prologue + 5 chapters' },
  ],
  [
    { at: shapeOf('city')(-1.6, 14.2, 1.6), text: 'busiest day · tallest tower' },
    { at: shapeOf('city')(4.8, 5.4, -4.8), text: 'one block · one day' },
    { at: shapeOf('city')(-4.8, 4.2, 4.8), text: 'canvas · no API needed' },
  ],
]
