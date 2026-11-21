/*
 * Chapter Four's level map: one scroll (P, 0..1 through the chapter) walks four game worlds.
 *   arcade   P 0     - 0.50   the neon coast and the block world (arcade.js, on its own p 0..0.92, so its
 *                             pace per screen of scroll is what it always was)
 *   village  P 0.51  - 0.74   the fortified village (village.js), its own p 0..1
 *   ops      P 0.75  - 0.93   night ops (ops.js), its own p 0..1
 *   back-out P 0.93  - 1      the last level plays on the cinema's screen (p held at 1) and the camera
 *                             backs out into the hall, where the epilogue begins
 * Between levels a covering transition (levelfx.js) hides the swap: only one world is ever drawn.
 *   cloud    P 0.475 - 0.535  full cover and the swap at 0.505
 *   tech     P 0.715 - 0.775  full cover and the swap at 0.745
 * So a level is seen clear of its transitions only for part of its own p (see CLEAR).
 */
export const BACK = 0.93
export const LEVELS = [
  { name: 'arcade', walk: [0, 0.5], top: 0.92 },
  { name: 'village', walk: [0.51, 0.74], top: 1 },
  { name: 'ops', walk: [0.75, BACK], top: 1 },
]
export const LAST = LEVELS[LEVELS.length - 1].name
// SEAMS[k] sits between LEVELS[k] and LEVELS[k + 1].
export const SEAMS = [
  { at: 0.505, half: 0.03, kind: 'cloud' },
  { at: 0.745, half: 0.03, kind: 'tech' },
]
// A transition's phase runs 0..1; the frame is fully covered across this plateau, the swap in its middle.
export const PLATEAU = [0.44, 0.56]

/*
 * Each level's grade (world.js applies it; a world may override any of it by returning { grade } from
 * update). bloom: intensity; threshold: luminance where bloom starts; vignette: darkness; grain: share
 * of the hall's film grain; scan: scanline opacity.
 */
export const GRADE = {
  arcade: { bloom: 0.55, threshold: 0.95, vignette: 0.42, grain: 0.45, scan: 0 },
  village: { bloom: 0.8, threshold: 0.8, vignette: 0.3, grain: 0.2, scan: 0 }, // soft, sunny, hazy
  ops: { bloom: 0.32, threshold: 0.9, vignette: 0.6, grain: 0.6, scan: 0.12 }, // crisp, cool, faint scanlines
}

const clamp01 = x => Math.min(1, Math.max(0, x))
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }

/** How much of the frame a transition covers at `phase` (0..1): 0, up to 1 across the plateau, back to 0. */
export const coverAt = phase => smooth(0, PLATEAU[0], phase) * (1 - smooth(PLATEAU[1], 1, phase))

/**
 * Where the chapter is at progress P.
 * Returns { i, level (its name), p (that world's own progress), kind ('cloud' | 'tech' | null: the
 * transition on screen), phase (0..1 through it, 0.5 = the swap), cover (0..1..0) }.
 * `still` (reduced motion): no transitions, the levels cut.
 */
export function levelAt(P, still = false) {
  const i = P < SEAMS[0].at ? 0 : P < SEAMS[1].at ? 1 : 2
  const L = LEVELS[i]
  const out = { i, level: L.name, p: clamp01((P - L.walk[0]) / (L.walk[1] - L.walk[0])) * L.top, kind: null, phase: 0, cover: 0 }
  if (!still)
    for (const s of SEAMS) {
      const phase = (P - s.at + s.half) / (2 * s.half)
      if (phase <= 0 || phase >= 1) continue
      out.kind = s.kind
      out.phase = phase
      out.cover = coverAt(phase)
    }
  return out
}

/** The chapter progress P at which `level` reaches its own progress p (for beats and prompts). */
export function chapterP(level, p) {
  const L = LEVELS.find(l => l.name === level)
  return L.walk[0] + (p / L.top) * (L.walk[1] - L.walk[0])
}

/** The stretch of a level's own p that is seen clear of the transitions either side of it. */
export const CLEAR = Object.fromEntries(LEVELS.map((L, i) => {
  const own = P => clamp01((P - L.walk[0]) / (L.walk[1] - L.walk[0])) * L.top
  return [L.name, [i ? own(SEAMS[i - 1].at + SEAMS[i - 1].half) : 0, i < SEAMS.length ? own(SEAMS[i].at - SEAMS[i].half) : L.top]]
}))

if (import.meta.env?.DEV) {
  const near = (a, b) => Math.abs(a - b) < 1e-6
  console.assert(levelAt(0).level === 'arcade' && levelAt(0).p === 0, 'levels: start')
  console.assert(near(levelAt(0.5).p, 0.92) && near(levelAt(0.504).p, 0.92), 'levels: the arcade keeps its 0..0.92')
  console.assert(levelAt(0.505).level === 'village' && levelAt(0.505).p === 0 && near(levelAt(0.505).cover, 1), 'levels: the swap is under full cover')
  console.assert(levelAt(0.6).kind === null && levelAt(0.745).level === 'ops' && levelAt(0.745).kind === 'tech', 'levels: tech seam')
  console.assert(levelAt(BACK).p === 1 && levelAt(1).p === 1 && levelAt(0.505, true).kind === null, 'levels: back-out, reduced motion')
  console.assert(near(chapterP('arcade', 0.92), 0.5) && near(levelAt(chapterP('village', 0.4)).p, 0.4), 'levels: chapterP')
}
