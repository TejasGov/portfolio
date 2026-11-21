import { PLATEAU, coverAt } from './levels'

/*
 * Chapter Five's level map, in the shape of levels.js: one scroll (P, 0..1 through the chapter) plays
 * three original film-homage worlds, one at a time.
 *   hall     P 0     - 0.06   in the hall after Four's back-out: Four's last world fades off the screen,
 *                             the projector flares for a new reel, the dive comes up on the screen and the
 *                             camera pushes into it (timeline.js)
 *   dive     P 0.06  - 0.40   the dive (dive.js), its own p 0..1
 *   landing  P 0.42  - 0.66   the landing (landing.js), its own p 0..1
 *   final    P 0.68  - 0.93   the final (final.js), its own p 0..1
 *   back-out P 0.93  - 1      the final plays on the cinema's screen (p held at 1) and the camera backs out
 *                             into the hall, where the epilogue begins
 * Between worlds a covering transition (levelfx.js) hides the swap: only one world is ever drawn.
 *   storm    P 0.375 - 0.445  full cover and the swap at 0.41
 *   flash    P 0.635 - 0.705  full cover and the swap at 0.67
 * So each world is seen clear of its transitions only for part of its own p (CLEAR):
 *   dive 0..0.926, landing 0.104..0.896, final 0.1..1.
 */
export const BACK = 0.93
export const LEVELS = [
  { name: 'dive', walk: [0.06, 0.4], top: 1 },
  { name: 'landing', walk: [0.42, 0.66], top: 1 },
  { name: 'final', walk: [0.68, BACK], top: 1 },
]
export const FIRST = LEVELS[0].name
export const LAST = LEVELS[LEVELS.length - 1].name
// SEAMS[k] sits between LEVELS[k] and LEVELS[k + 1].
export const SEAMS = [
  { at: 0.41, half: 0.035, kind: 'storm' },
  { at: 0.67, half: 0.035, kind: 'flash' },
]

/*
 * Each world's grade (world.js applies it, as levels.js GRADE; a world may override any of it by
 * returning { grade } from update). Lens flares off the city lights and the landing's god-rays are the
 * worlds' own (sprites and shafts in their scenes); this is the frame's bloom, vignette, grain, scan.
 */
export const GRADE = {
  dive: { bloom: 0.7, threshold: 0.72, vignette: 0.55, grain: 0.5, scan: 0 }, // cool and filmic: the city's lights bloom
  landing: { bloom: 0.6, threshold: 0.8, vignette: 0.5, grain: 0.35, scan: 0 }, // dusky and stormy
  final: { bloom: 0.95, threshold: 0.68, vignette: 0.38, grain: 0.3, scan: 0 }, // warm floodlight, bloom on the confetti
}

const clamp01 = x => Math.min(1, Math.max(0, x))

/**
 * Where the chapter is at progress P (Five's worlds only: the hall and the back-out are timeline.js's).
 * Returns { i, level (its name), p (that world's own progress), kind ('storm' | 'flash' | null: the
 * transition on screen), phase (0..1 through it, 0.5 = the swap), cover (0..1..0) }.
 * `still` (reduced motion): no transitions, the worlds cut.
 */
export function levelAt(P, still = false) {
  let i = 0
  while (i < SEAMS.length && P >= SEAMS[i].at) i++
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

/** The stretch of a world's own p that is seen clear of the transitions either side of it. */
export const CLEAR = Object.fromEntries(LEVELS.map((L, i) => {
  const own = P => clamp01((P - L.walk[0]) / (L.walk[1] - L.walk[0])) * L.top
  return [L.name, [i ? own(SEAMS[i - 1].at + SEAMS[i - 1].half) : 0, i < SEAMS.length ? own(SEAMS[i].at - SEAMS[i].half) : L.top]]
}))

if (import.meta.env?.DEV) {
  const near = (a, b) => Math.abs(a - b) < 1e-6
  console.assert(PLATEAU[0] < 0.5 && PLATEAU[1] > 0.5, 'movies: plateau')
  console.assert(levelAt(0.06).level === 'dive' && levelAt(0.06).p === 0 && levelAt(0.2).kind === null, 'movies: start')
  console.assert(near(levelAt(0.4).p, 1) && levelAt(0.409).level === 'dive' && levelAt(0.4).kind === 'storm', 'movies: the dive ends under the storm')
  console.assert(levelAt(0.41).level === 'landing' && levelAt(0.41).p === 0 && near(levelAt(0.41).cover, 1), 'movies: the swap is under full cover')
  console.assert(levelAt(0.67).level === 'final' && levelAt(0.67).kind === 'flash' && near(levelAt(0.67).cover, 1) && levelAt(0.8).kind === null, 'movies: flash seam')
  console.assert(levelAt(BACK).p === 1 && levelAt(1).p === 1 && levelAt(0.41, true).kind === null, 'movies: back-out, reduced motion')
  console.assert(near(chapterP('dive', 1), 0.4) && near(levelAt(chapterP('landing', 0.4)).p, 0.4), 'movies: chapterP')
  // Every swap is under full cover: on either side of a seam's middle the cover is whole.
  for (const s of SEAMS) console.assert(near(levelAt(s.at - 1e-4).cover, 1) && near(levelAt(s.at + 1e-4).cover, 1), 'movies: the cover holds over the swap')
}
