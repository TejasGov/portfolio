import { PLATEAU, coverAt } from './levels'

/*
 * Chapter Five's level map, in the shape of levels.js: one scroll (P, 0..1 through the chapter) plays
 * seven fan-tribute film worlds, one at a time. The map is laid out in svh of scroll (each world's own
 * length, the same gap and seam size between every two) and divided by the chapter's height, SVH, which
 * ChapterFive.jsx uses for its section: so a world's pace per screen of scroll is set here alone.
 *   hall     P 0      - 0.0243  in the hall after Four's back-out: Four's last world fades off the screen,
 *                               the projector flares for a new reel, the swing comes up on the screen and
 *                               the camera pushes into it (timeline.js)
 *   swing    P 0.0243 - 0.2085  Spider-Man (swing.js)              500 svh
 *   dive     P 0.2167 - 0.3861  Iron Man (dive.js)                 460 svh
 *   landing  P 0.3943 - 0.4915  Thor (landing.js)                  264 svh
 *   chase    P 0.4996 - 0.6102  The Dark Knight (chase.js)         300 svh
 *   vault    P 0.6183 - 0.7288  Mission: Impossible (vault.js)     300 svh
 *   dance    P 0.7369 - 0.8622  Deadpool & Wolverine (dance.js)    340 svh
 *   final    P 0.8703 - 0.9716  Argentina 2022 (final.js)          275 svh
 *   back-out P 0.9716 - 1       the final plays on the cinema's screen (p held at 1) and the camera backs
 *                               out into the hall, where the epilogue begins (and fades it)
 * Between worlds a covering transition (levelfx.js) hides the swap: only one world is ever drawn.
 *   whip     P 0.1984 - 0.2268  swap at 0.2126     swing -> dive
 *   storm    P 0.3760 - 0.4044  swap at 0.3902     dive -> landing
 *   bats     P 0.4814 - 0.5098  swap at 0.4956     landing -> chase
 *   laser    P 0.6000 - 0.6284  swap at 0.6142     chase -> vault
 *   comic    P 0.7187 - 0.7471  swap at 0.7329     vault -> dance
 *   flash    P 0.8521 - 0.8804  swap at 0.8662     dance -> final
 * So each world is seen clear of its transitions only for part of its own p (CLEAR):
 *   swing 0..0.945, dive 0.060..0.940, landing 0.104..0.896, chase 0.092..0.908, vault 0.092..0.908,
 *   dance 0.081..0.919, final 0.100..1. Each world's p reaches 1 a little before its seam's middle and
 *   holds there under the full cover; the next starts at 0 just after it.
 */
/** The dance world's own p over which its routine plays (dance.js), so the scene player (lib/autoplay.js) can play it in real time. */
export const DANCE_SPAN = [0.075, 0.93]
const HALL = 66, GAP = 22, HALF = 38.5, OUT = 77 // svh: the push-in, the gap between two walks, half a seam, the back-out
const PLAN = [['swing', 500], ['dive', 460], ['landing', 264], ['chase', 300], ['vault', 300], ['dance', 340], ['final', 275]]
const KINDS = ['whip', 'storm', 'bats', 'laser', 'comic', 'flash'] // SEAMS[k] sits between LEVELS[k] and LEVELS[k + 1]
/** The chapter's height in svh (ChapterFive.jsx's section): P runs over it, 'top bottom' to 'bottom bottom'. */
export const SVH = HALL + PLAN.reduce((a, [, n]) => a + n, 0) + GAP * (PLAN.length - 1) + OUT
/** How much shorter one svh of scroll is in P than it was at the three-world chapter's 1100 svh (timeline.js, the beats). */
export const UNIT = 1100 / SVH
export const LEVELS = []
export const SEAMS = []
for (let y = HALL, i = 0; i < PLAN.length; i++) {
  const [name, len] = PLAN[i]
  LEVELS.push({ name, walk: [y / SVH, (y + len) / SVH], top: 1 })
  if (i < KINDS.length) SEAMS.push({ at: (y + len + GAP / 2) / SVH, half: HALF / SVH, kind: KINDS[i] })
  y += len + GAP
}
export const BACK = LEVELS[LEVELS.length - 1].walk[1]
export const FIRST = LEVELS[0].name
export const LAST = LEVELS[LEVELS.length - 1].name

/*
 * Each world's grade (world.js applies it, as levels.js GRADE; a world may override any of it by
 * returning { grade } from update). Lens flares off the city lights and the landing's god-rays are the
 * worlds' own (sprites and shafts in their scenes); this is the frame's bloom, vignette, grain, scan.
 */
export const GRADE = {
  swing: { bloom: 0.8, threshold: 0.7, vignette: 0.4, grain: 0.3, scan: 0 }, // golden hour: soft bloom off the sun on glass and stone
  chase: { bloom: 0.9, threshold: 0.62, vignette: 0.62, grain: 0.55, scan: 0 }, // sodium-orange night: fire and streetlights bloom, the dark holds
  dance: { bloom: 0.45, threshold: 0.88, vignette: 0.22, grain: 0.12, scan: 0 }, // punchy comic colour: clean, flat, little vignette
  dive:{ bloom: 0.7, threshold: 0.72, vignette: 0.55, grain: 0.5, scan: 0 }, // cool and filmic: the city's lights bloom
  landing: { bloom: 0.6, threshold: 0.8, vignette: 0.5, grain: 0.35, scan: 0 }, // dusky and stormy
  final: { bloom: 0.95, threshold: 0.68, vignette: 0.38, grain: 0.3, scan: 0 }, // warm floodlight, bloom on the confetti
  vault: { bloom: 0.55, threshold: 0.86, vignette: 0.18, grain: 0.08, scan: 0 }, // sterile cool white, high key: only the white walls and lamps bloom
}

const clamp01 = x => Math.min(1, Math.max(0, x))

/**
 * Where the chapter is at progress P (Five's worlds only: the hall and the back-out are timeline.js's).
 * Returns { i, level (its name), p (that world's own progress), kind (a seam's kind, see KINDS, or null:
 * the transition on screen), phase (0..1 through it, 0.5 = the swap), cover (0..1..0) }.
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
  const names = LEVELS.map(l => l.name).join()
  console.assert(names === 'swing,dive,landing,chase,vault,dance,final' && SEAMS.map(s => s.kind).join() === 'whip,storm,bats,laser,comic,flash', 'movies: running order')
  console.assert(PLATEAU[0] < 0.5 && PLATEAU[1] > 0.5 && SVH === 2714 && near(BACK, 1 - OUT / SVH), 'movies: plateau, height')
  console.assert(Object.keys(GRADE).length === LEVELS.length && LEVELS.every(l => GRADE[l.name]), 'movies: a grade per world')
  const IN = LEVELS[0].walk[0]
  console.assert(levelAt(IN).level === 'swing' && levelAt(IN).p === 0 && levelAt(IN + 0.05).kind === null, 'movies: start')
  LEVELS.forEach((L, i) => {
    const mid = (L.walk[0] + L.walk[1]) / 2
    console.assert(levelAt(mid).level === L.name && levelAt(mid).kind === null && near(levelAt(L.walk[1]).p, 1), `movies: ${L.name} walks clear and ends at 1`)
    console.assert(near(levelAt(chapterP(L.name, 0.4)).p, 0.4) && CLEAR[L.name][0] < 0.11 && CLEAR[L.name][1] > 0.89, `movies: ${L.name} chapterP, CLEAR`)
    if (i < SEAMS.length) {
      const s = SEAMS[i]
      // The world ends under its seam, the next starts at 0 there, and the swap is under full cover.
      console.assert(L.walk[1] < s.at && LEVELS[i + 1].walk[0] > s.at && levelAt(L.walk[1]).kind === s.kind, `movies: ${L.name} ends under the ${s.kind}`)
      console.assert(levelAt(s.at).level === LEVELS[i + 1].name && levelAt(s.at).p === 0 && levelAt(s.at - 1e-6).level === L.name, `movies: the ${s.kind} swap`)
      console.assert(near(levelAt(s.at - 1e-4).cover, 1) && near(levelAt(s.at + 1e-4).cover, 1) && levelAt(s.at, true).kind === null, `movies: the ${s.kind} cover holds over the swap; cut when still`)
      if (i) console.assert(SEAMS[i - 1].at + SEAMS[i - 1].half < s.at - s.half, 'movies: seams never overlap')
    }
  })
  console.assert(levelAt(BACK).level === LAST && levelAt(BACK).p === 1 && levelAt(1).p === 1 && levelAt(BACK).kind === null, 'movies: back-out')
}
