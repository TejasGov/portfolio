import { useEffect, useMemo, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { store } from '../lib/store'
import Assemble from '../lib/Assemble'
import { BACK, chapterP } from '../cinema/movies'
import '../five.css'

const TITLE = [['The big ', false], ['screen', true]]
const HEAD = 'Chapter Five · The Big Screen'
const EXIT = 'Epilogue · House lights' // from BACK (0.93) the camera backs out of the screen into the hall

/*
 * Chapter Five, "The Big Screen": after Four's game the projector starts a new reel and the camera
 * pushes back into the screen for three original film homages in one scroll (cinema/movies.js): a dive
 * off a tower into a suit of armour, a landing out of a lightning strike on a highland ridge, and a
 * stadium final. The words live here, set like a film's title cards. Progress starts as the chapter
 * rises into view, so it picks up exactly where Four's back-out leaves the hall.
 */
const D = p => chapterP('dive', p), L = p => chapterP('landing', p), F = p => chapterP('final', p)
// Only the films' own words here, and the final's two factual captions.
const BEATS = [
  { at: [0.006, 0.054], edge: [0.004, 0.012], kind: 'title' }, // over the new reel and the push; gone before the tower's wide
  { at: [D(0.04), D(0.22)], kind: 'slate', label: 'Scene one', text: 'The dive.', skip: true },
  { at: [D(0.26), D(0.71)], edge: 0.006, kind: 'prompt', text: 'Suit up' },
  { at: [L(0.16), L(0.5)], kind: 'slate', label: 'Scene two', text: 'The landing.' },
  { at: [F(0.14), F(0.42)], kind: 'slate', label: 'Scene three', text: 'The final.' },
  { at: [F(0.55), 0.965], kind: 'caption', label: '18 December 2022', text: 'Argentina. World champions.' },
].map(b => ({ edge: 0.015, ...b }))

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
    <section ref={ref} id="five" aria-labelledby="five-title" className="relative" style={{ height: '1100svh' }}>
      <div className="sticky top-0 h-svh">
        {/* Fixed, so the title is whole and in frame over the hall, before this sticky sticks (its ~0.09). */}
        <div className="pointer-events-none fixed inset-0 z-[1] grid px-6 pb-[max(12svh,72px)] md:px-[6vw]">
          <div ref={bind(0)} className="five-title self-end opacity-0">
            <p className="five-kicker poster text-[#8fc8ff]" style={{ '--s': 2.6 }}>Chapter Five</p>
            <Assemble as="h2" id="five-title" parts={TITLE} className="mt-4 block font-display text-[clamp(3.6rem,9vw,8.5rem)] leading-[0.86] tracking-[-0.02em] [text-shadow:0_4px_50px_rgb(5_10_30/0.8)]" />
          </div>
        </div>
        <div className="absolute inset-0 grid px-6 pt-[13svh] pb-[12svh] md:px-[6vw]">
          {beats.map((b, k) =>
            b.kind === 'title' ? null : b.kind === 'prompt' ? (
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
