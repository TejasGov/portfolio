import { store } from './store'
import { sound } from './sound'
import { CLEAR, DANCE_SPAN, LEVELS, chapterP } from '../cinema/movies'

/*
 * Chapter Five's scenes playing themselves: one scene, or all seven in a row, at a film's pace instead of the
 * reader's scroll. It drives the page's scroll through the chapter in real time (the worlds are pure functions of
 * their progress, so this is the same picture a steady scroll gives), from where a scene is first seen clear of its
 * transition to where it hands over to the next. The dance runs at its routine's own speed, so its song stays in
 * step. Any wheel, touch or key of the reader's (outside the player's own controls, [data-autoplay]) hands the scroll
 * back where it is. It turns the sound on: playing is the gesture that allows it.
 *
 *   autoplay.play(names)   names: worlds in film order (ALL for the whole feature)
 *   autoplay.stop()
 *   autoplay.playing       the world playing now, or null; autoplay.subscribe(fn) -> unsubscribe, fn(playing)
 */
export const ALL = LEVELS.map(l => l.name)
// Seconds one whole walk through a world (its own p 0..1) takes; the dance's is its routine's, one second a second.
const WALK = { swing: 24, dive: 22, landing: 13, chase: 15, vault: 15, final: 14 } // about 1.85x a steady read, with room for each theme to land
const SEAM = 1.3 // seconds through a transition between two worlds
const walkSeconds = name => (name === 'dance' ? (store.danceClock?.end ?? 34.4) / (DANCE_SPAN[1] - DANCE_SPAN[0]) : WALK[name])

/** The legs of a play: [name, P from, P to, seconds]; a transition belongs to the world it leads into. */
export function legs(names) {
  const out = []
  for (const n of names) {
    const [c0, c1] = CLEAR[n], a = chapterP(n, c0), b = chapterP(n, c1)
    if (out.length) out.push([n, out.at(-1)[2], a, SEAM])
    out.push([n, a, b, (c1 - c0) * walkSeconds(n)])
  }
  return out
}

let playing = null, stopNow = null
const subs = new Set()
const tell = name => {
  if (name === playing) return
  playing = name
  subs.forEach(fn => fn(name))
}
const STOPS = ['wheel', 'touchstart', 'keydown']

export const autoplay = {
  get playing() {
    return playing
  },
  subscribe(fn) {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  stop() {
    stopNow?.()
  },
  async play(names) {
    stopNow?.()
    const sec = document.getElementById('five')
    if (!sec) return
    if (!sound.on) await sound.toggle()
    const run = legs(names), total = run.reduce((s, l) => s + l[3], 0)
    // Five's P runs 'top bottom' -> 'bottom bottom': the scroll that puts the chapter at P.
    const top = sec.getBoundingClientRect().top + scrollY, h = sec.offsetHeight
    const y = P => top - innerHeight + P * h
    const t0 = performance.now()
    let raf
    const interrupt = e => !e.target?.closest?.('[data-autoplay]') && stopNow?.()
    stopNow = () => {
      cancelAnimationFrame(raf)
      for (const k of STOPS) removeEventListener(k, interrupt, true)
      stopNow = null
      tell(null)
    }
    const step = () => {
      let t = (performance.now() - t0) / 1000
      if (t >= total) {
        scrollTo(0, y(run.at(-1)[2]))
        return stopNow()
      }
      let k = 0
      while (t > run[k][3]) t -= run[k++][3]
      const [n, a, b, s] = run[k]
      scrollTo(0, y(a + ((b - a) * t) / s))
      tell(n)
      raf = requestAnimationFrame(step)
    }
    for (const k of STOPS) addEventListener(k, interrupt, { capture: true, passive: true })
    step()
  },
}

// Self-check: a play is a gapless run forward through the chapter.
{
  const run = legs(ALL)
  console.assert(run.every((l, i) => l[2] > l[1] && (!i || Math.abs(l[1] - run[i - 1][2]) < 1e-9)), 'autoplay: the legs run on, forward')
}
