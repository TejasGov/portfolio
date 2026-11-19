/*
 * Scroll → state for the WebGL stage. Pure functions of the store, so every visual layer
 * (pixels, orb, camera, HUD) reads the same moment of the story.
 */
const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mobile = () => typeof window !== 'undefined' && matchMedia('(max-width: 767px)').matches

export const WORK_KEYS = ['hand', 'brain', 'glasses', 'sword', 'city']

/** Which night chapter is driving the stage right now. */
export function chapter(s) {
  if (s.epilogue > 0) return 'epilogue'
  if (s.work > 0) return 'work'
  return 'prologue'
}

/** Work progress → which project is in front (0..4) and how far between projects. */
export function workPosition(w) {
  // 0.06 to settle in, then five equal spans; each project holds for the middle of its span.
  const f = Math.max(0, (w - 0.06) / 0.94) * WORK_KEYS.length
  const i = Math.min(WORK_KEYS.length - 1, Math.floor(f))
  return { i, local: f - i }
}

export function pixelState(s) {
  const ch = chapter(s)
  const side = mobile() ? [0, 1.2, 0] : [1.75, 0, 0]
  if (ch === 'prologue') {
    const p = s.prologue
    // Desktop: the orb sits right of centre while lines of text are up, centred again for home.
    // The orb moves aside once it forms and stays there, leaving a clear column for the words.
    const k = ss(0.2, 0.36, p)
    const shift = mobile() ? [0, 0.95 * k, 0] : [(1.1 + 0.25 * ss(0.74, 0.9, p)) * k, 0, 0]
    if (p < 0.42) {
      const mix = ss(0.07, 0.36, p)
      return { from: 'galaxy', to: 'orb', mix, scatter: 0.55, spin: ss(0.03, 0.38, p) * 1.4, opacity: 1, bright: 1 - 0.62 * mix, offset: shift }
    }
    // Once the drawn orb takes over, the pixels loosen into dust around it.
    return { from: 'orb', to: 'dust', mix: ss(0.42, 0.62, p), scatter: 0.2, spin: 0, opacity: 1 - 0.88 * ss(0.42, 0.52, p), bright: 0.32, offset: shift }
  }
  if (ch === 'work') {
    const w = s.work
    // The chapter opens on a dim, loose cloud already off to the side, clear of the title.
    if (w < 0.06) return { from: 'dust', to: WORK_KEYS[0], mix: ss(0.015, 0.06, w), scatter: 0.9, spin: 0, opacity: 1, bright: 0.3 + 0.5 * ss(0.02, 0.06, w), offset: side }
    const { i, local } = workPosition(w)
    // Hold the shape for most of its span; morph to the next only in the last 30%.
    if (i < WORK_KEYS.length - 1 && local > 0.7) {
      return { from: WORK_KEYS[i], to: WORK_KEYS[i + 1], mix: ss(0.7, 1, local), scatter: 1, spin: 0, opacity: 1, bright: 0.8, offset: side }
    }
    return { from: WORK_KEYS[i], to: WORK_KEYS[i], mix: 0, scatter: 0, spin: 0, opacity: 1, bright: 0.8, offset: side }
  }
  const e = s.epilogue
  // The orb re-forms off to the side (above, on phones) so the closing words have clear sky.
  const rest = mobile() ? [0, 0.95, 0] : [1.35, 0.1, 0]
  return { from: WORK_KEYS[WORK_KEYS.length - 1], to: 'orb', mix: ss(0, 0.45, e), scatter: 0.8, spin: 0, opacity: 1 - 0.55 * ss(0.5, 0.7, e), bright: 0.5, offset: lerp3(side, rest, ss(0, 0.4, e)) }
}

export function orbState(s) {
  const ch = chapter(s)
  // Fades out under the paper fringe at the very end, so Chapter Two can start from loose dust.
  if (ch === 'prologue') return { opacity: ss(0.33, 0.45, s.prologue) * (1 - ss(0.955, 1, s.prologue)) }
  if (ch === 'epilogue') return { opacity: ss(0.4, 0.62, s.epilogue) }
  return { opacity: 0 }
}

/** HUD markers: on with the orb, the home marker takes over near the end of the prologue. */
export function hudState(s) {
  const ch = chapter(s)
  if (ch === 'prologue') {
    const p = s.prologue
    return { orb: ss(0.44, 0.52, p) * (1 - ss(0.95, 1, p)), home: ss(0.74, 0.82, p) * (1 - ss(0.97, 1, p)), work: 0 }
  }
  if (ch === 'work') return { orb: 0, home: 0, work: 1 }
  return { orb: ss(0.6, 0.75, s.epilogue), home: 0, work: 0 }
}

const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

/** Camera keyframes per chapter: [p, position, lookAt]. */
const PROLOGUE_CAM = [
  [0, [0, 3.6, 8.2], [0, -0.2, 0]],
  [0.36, [0, 0.9, 6.6], [0, 0, 0]],
  [0.7, [0.15, 0.35, 6.0], [0.25, 0, 0]],
  [1, [0.3, 0.3, 5.9], [0.5, 0.1, 0]],
]
export function cameraState(s) {
  const ch = chapter(s)
  if (ch === 'prologue') return sample(PROLOGUE_CAM, s.prologue)
  if (ch === 'work') {
    const a = s.work * Math.PI * 0.6
    return { pos: [Math.sin(a) * 0.6, 0.5, 6.8], look: [mobile() ? 0 : 0.35, mobile() ? 0.5 : 0, 0] }
  }
  return { pos: [0, 0.6, 7.6 - s.epilogue * 0.5], look: [mobile() ? 0 : 0.35, mobile() ? 0.5 : 0, 0] }
}

function sample(keys, p) {
  let i = 0
  while (i < keys.length - 2 && p > keys[i + 1][0]) i++
  const [pa, a, la] = keys[i]
  const [pb, b, lb] = keys[i + 1]
  const t = ss(pa, pb, p)
  return { pos: lerp3(a, b, t), look: lerp3(la, lb, t) }
}

export { ss }
