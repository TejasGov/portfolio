import { useEffect, useMemo, useRef, useState } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { store } from '../lib/store'
import { sound } from '../lib/sound'
import Assemble from '../lib/Assemble'
import { BACK, CLEAR, DANCE_SPAN, LEVELS, SVH, UNIT, chapterP } from '../cinema/movies'
import '../five.css'

const TITLE = [['The big ', false], ['screen', true]]
const HEAD = 'Chapter Five · The Big Screen'
const EXIT = 'Epilogue · House lights' // from BACK the camera backs out of the screen into the hall

/*
 * Chapter Five, "The Big Screen": after Four's game the projector starts a new reel and the camera
 * pushes back into the screen for seven fan-tribute scenes in one scroll (cinema/movies.js): Spider-Man
 * swinging through golden-hour Manhattan, Iron Man's dive and suit-up, Thor's landing with Stormbreaker,
 * the Dark Knight's bike chase, the vault hang (Mission: Impossible), Deadpool's "Bye Bye Bye"
 * fight-dance, and last the 2022 final, which plays on the screen as the camera backs out. The words live
 * here, set like a film's title cards. Progress starts as the chapter rises into view, so it picks up
 * exactly where Four's back-out leaves the hall. Every window below is in the chapter's P (movies.js lays
 * it out in svh; UNIT turns the three-world chapter's P lengths into today's, so edges keep their feel).
 */
const S = p => chapterP('swing', p), D = p => chapterP('dive', p), L = p => chapterP('landing', p)
const C = p => chapterP('chase', p), V = p => chapterP('vault', p), X = p => chapterP('dance', p), F = p => chapterP('final', p)
// The slates name each scene as a fan's tribute; the final keeps its two factual captions. No lyric
// lines anywhere: the dance's only words are its title phrase and the scene's sound effects.
const SLATES = {
  swing: { at: [S(0.03), S(0.15)], label: 'Scene one', text: 'Spider-Man', skip: true }, // on a phone every slate docks under the header (five.css)
  dive: { at: [D(0.265), D(0.355)], edge: 0.008 * UNIT, anchor: D(0.075), label: 'Scene two', text: 'Iron Man' }, // from the rim dive to 'Suit up' (both sit low on a phone): Spider-Man owns the pad landing; the ticket still lands on the pad wide
  landing: { at: [L(0.16), L(0.5)], label: 'Scene three', text: 'Thor' },
  chase: { at: [C(0.12), C(0.32)], label: 'Scene four', text: 'The Dark Knight' },
  vault: { at: [V(0.12), V(0.32)], anchor: V(0.39), label: 'Scene five', text: 'Mission: Impossible' }, // the ticket lands on the hold (p ~.45): him level on the wires, just above the tiles
  dance: { at: [X(0.1), X(0.3)], label: 'Scene six', text: 'Deadpool & Wolverine' },
  final: { at: [F(0.14), F(0.42)], label: 'Scene seven', text: 'The final' },
}
const EDGE = 0.015 * UNIT
const BEATS = [
  { at: [0.006 * UNIT, 0.054 * UNIT], edge: [0.004 * UNIT, 0.012 * UNIT], kind: 'title' }, // over the new reel and the push; gone before the perch
  ...LEVELS.map(l => ({ kind: 'slate', ...SLATES[l.name] })),
  { at: [D(0.355), D(0.75)], edge: 0.006 * UNIT, kind: 'prompt', text: 'Suit up' }, // with the first plates, gone at the visor,
  { at: [X(0.09), X(0.9)], kind: 'play' }, // bottom left, clear of the slate (top left), from the first step to the last pose
  { at: [F(0.55), F(0.88)], kind: 'caption', label: '18 December 2022', text: 'Argentina. World champions.' },
].map(b => ({ edge: EDGE, ...b }))
/*
 * Scene anchors (the box office jumps with goToId('scene-<world>')): an empty marker per world, placed so
 * that scrolling it to the top of the viewport puts the chapter's P where that world is clear of its
 * transition and its slate has just come fully in. Five's progress runs 'top bottom' -> 'bottom bottom',
 * so a marker at y within the section is at P = (y + 100svh) / SVH svh.
 */
const ANCHORS = LEVELS.map(l => {
  const P = Math.max(chapterP(l.name, CLEAR[l.name][0]), SLATES[l.name].anchor ?? SLATES[l.name].at[0]) + EDGE + 2 / SVH
  return { id: `scene-${l.name}`, label: `${SLATES[l.name].label}: ${SLATES[l.name].text}`, top: `calc(${(P * SVH).toFixed(2)}svh - 100svh)` }
})

/**
 * The dance's play button: scrolls the routine at its own speed (one second of routine a second) with the song
 * on, so the music and his steps stay locked (sound.js follows the routine's clock). Any wheel, touch or
 * key of the reader's stops it where it is; it turns the sound on if it was off (the click is the gesture).
 */
const STOPS = ['wheel', 'touchstart', 'keydown']
function PlayDance() {
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef(null), button = useRef(null)
  useEffect(() => () => stopRef.current?.(), [])
  const toggle = async () => {
    if (stopRef.current) return stopRef.current()
    const c = store.danceClock
    if (!c) return
    if (!sound.on) await sound.toggle()
    const sec = document.getElementById('five')
    const top = sec.getBoundingClientRect().top + scrollY, h = sec.offsetHeight, vh = innerHeight
    const [a, z] = DANCE_SPAN
    // Five's P runs 'top bottom' -> 'bottom bottom': the scroll that puts the routine at time T.
    const y = T => top - vh + chapterP('dance', a + ((z - a) * T) / c.end) * h
    const from = c.T > c.end - 1 ? 0 : c.T
    const t0 = performance.now()
    let raf
    const interrupt = e => e.target !== button.current && stop()
    const stop = () => {
      cancelAnimationFrame(raf)
      for (const k of STOPS) removeEventListener(k, interrupt, true)
      stopRef.current = null
      setPlaying(false)
    }
    const step = () => {
      const T = Math.min(c.end, from + (performance.now() - t0) / 1000)
      scrollTo(0, y(T))
      if (T >= c.end) return stop()
      raf = requestAnimationFrame(step)
    }
    for (const k of STOPS) addEventListener(k, interrupt, { capture: true, passive: true })
    stopRef.current = stop
    setPlaying(true)
    step()
  }
  return (
    <button ref={button} type="button" onClick={toggle} aria-pressed={playing} className="kicker inline-flex min-h-11 items-center gap-3 rounded-sm bg-[rgb(6_10_20/0.85)] px-5 text-white hover:bg-[rgb(6_10_20/0.95)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
      <span aria-hidden="true">{playing ? '■' : '▶'}</span>
      {playing ? 'Stop' : 'Play it with music'}
    </button>
  )
}

export default function ChapterFive() {
  const ref = useRef(null)
  useProgress(ref, 'five', { start: 'top bottom', end: 'bottom bottom' })
  useRunningHead(ref, HEAD, { start: 'top bottom', end: 'bottom bottom' })
  useEffect(() => {
    // Deferred: the running head's own toggle may be mid-broadcast of HEAD when it re-enters from below.
    const fn = key => {
      if ((key !== 'five' && key !== 'chapterLabel') || store.five <= 0 || store.five >= 1) return
      const want = store.five >= BACK ? EXIT : HEAD
      if ((store.chapterLabel === HEAD || store.chapterLabel === EXIT) && store.chapterLabel !== want) queueMicrotask(() => store.set('chapterLabel', want))
    }
    store.listeners.add(fn)
    return () => store.listeners.delete(fn)
  }, [])
  const beats = useMemo(() => BEATS, [])
  const bind = useBeats('five', beats)

  return (
    <section ref={ref} id="five" aria-labelledby="five-title" className="relative" style={{ height: `${SVH}svh` }}>
      {ANCHORS.map(a => <div key={a.id} id={a.id} role="group" aria-label={a.label} tabIndex={-1} className="pointer-events-none absolute left-0 h-px w-px" style={{ top: a.top }} />)}
      <div className="sticky top-0 h-svh">
        {/* Fixed, so the title is whole and in frame over the hall, before this sticky sticks (its ~0.09). */}
        <div className="pointer-events-none fixed inset-0 z-[1] grid px-6 pb-[max(12svh,72px)] md:px-[6vw]">
          <div ref={bind(0)} className="five-title self-end opacity-0">
            <p className="five-kicker poster text-[#8fc8ff]" style={{ '--s': 2.6 }}>Chapter Five</p>
            <Assemble as="h2" id="five-title" parts={TITLE} className="mt-4 block font-display text-[clamp(3.6rem,9vw,8.5rem)] leading-[0.86] tracking-[-0.02em] [text-shadow:0_4px_50px_rgb(5_10_30/0.8)]" />
            <p className="five-fan mt-5 max-w-[30ch] font-serif text-[clamp(1.1rem,1.7vw,1.4rem)] leading-snug text-white/90">I'm a Marvel fan. These are the scenes I'd jump into.</p>
          </div>
        </div>
        <div className="absolute inset-0 grid px-6 pt-[13svh] pb-[12svh] md:px-[6vw]">
          {beats.map((b, k) =>
            b.kind === 'title' ? null : b.kind === 'play' ? (
              <div key={k} ref={bind(k)} className="pointer-events-auto col-start-1 row-start-1 grid justify-items-start gap-2 self-end justify-self-start opacity-0">
                <PlayDance />
                <p className="max-w-[34ch] rounded-sm bg-[rgb(6_10_20/0.7)] px-3 py-1.5 text-[0.8rem] leading-snug text-white/85">
                  Music: “Bye Bye Bye”, *NSYNC (2000). A fan tribute; the song belongs to its owners.
                </p>
              </div>
            ) : b.kind === 'prompt' ? (
              // On a dark pill in the lower third, clear of him; the words' glow pulses like a heads-up line, the letters hold.
              <p key={k} ref={bind(k)} className="kicker pointer-events-none col-start-1 row-start-1 mb-[2svh] self-end justify-self-center rounded-sm bg-[rgb(6_10_20/0.85)] px-5 py-3 text-[clamp(1rem,1.6vw,1.25rem)] leading-[1.6] tracking-[0.42em] text-white opacity-0 [text-shadow:0_0_18px_#6fb8ff]">
                <span className="five-pulse">{b.text}</span>
              </p>
            ) : b.kind === 'caption' ? (
              // A film's closing caption: low and centred, the date over the line.
              <div key={k} ref={bind(k)} className="five-caption pointer-events-none col-start-1 row-start-1 self-end justify-self-center rounded-sm bg-[rgb(6_10_20/0.82)] px-6 py-4 text-center text-white opacity-0">
                <p className="kicker text-[#ffd9a0]">{b.label}</p>
                <p className="mt-2 font-display text-[clamp(1.5rem,3.2vw,2.4rem)] leading-[1.05]">{b.text}</p>
              </div>
            ) : (
              // A title card: top-left, quiet, legible over a night city, a dusk ridge or floodlight.
              <div key={k} ref={bind(k)} className={`five-slate ${b.skip ? 'pointer-events-auto' : 'pointer-events-none'} col-start-1 row-start-1 max-w-[24rem] self-start rounded-sm bg-[rgb(6_10_20/0.85)] p-5 text-white opacity-0`}>
                <p className="kicker text-[#8fc8ff]">{b.label}</p>
                <p className="mt-2 font-display text-[1.9rem] leading-[1.05]">{b.text}</p>
                {b.skip && <a href="#epilogue" className="kicker mt-3 inline-flex min-h-11 items-center text-white/85 underline-offset-4 hover:underline">Skip to contact ↓</a>}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
