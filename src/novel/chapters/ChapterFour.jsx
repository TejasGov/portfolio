import { useMemo, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import Assemble from '../lib/Assemble'

const TITLE = [['Player ', false], ['one', true]]

/*
 * Chapter Four, "Press Start": an ode to the games I grew up on (cinema/arcade.js). You walk a neon
 * coast at dusk; at the arcade at the end of the boardwalk a wave turns the world to blocks, and you
 * walk on through those. The words live here, set like a game's on-screen prompts.
 * Progress starts as the chapter rises into view, so it picks up exactly where the journey ends.
 */
const BEATS = [
  { at: [0.035, 0.17], kind: 'title' },
  { at: [0.2, 0.45], kind: 'objective', label: 'Objective', text: 'Walk the coast at dusk.', note: 'I grew up in open worlds: neon streets, palm trees, one more mission at 2 a.m.' },
  { at: [0.49, 0.58], kind: 'prompt', text: 'Press start' },
  { at: [0.78, 0.96], kind: 'objective', label: 'New world', text: 'Everything is blocks.', note: 'Then I found out a world is just blocks, and you can build your own. I have been building ever since.' },
]

export default function ChapterFour() {
  const ref = useRef(null)
  useProgress(ref, 'four', { start: 'top bottom', end: 'bottom bottom' })
  useRunningHead(ref, 'Chapter Four · Press Start')
  const beats = useMemo(() => BEATS, [])
  const bind = useBeats('four', beats)

  return (
    <section ref={ref} id="four" aria-labelledby="four-title" className="relative" style={{ height: '760svh' }}>
      <div className="sticky top-0 h-svh">
        <div className="absolute inset-0 grid px-6 pt-[13svh] pb-[12svh] md:px-[6vw]">
          {beats.map((b, k) =>
            b.kind === 'title' ? (
              <div key="title" ref={bind(k)} className="pointer-events-none col-start-1 row-start-1 self-end opacity-0">
                <p className="kicker text-[#ff7ac8]">Chapter Four · Press Start</p>
                <Assemble as="h2" id="four-title" parts={TITLE} className="mt-4 block font-display text-[clamp(3.6rem,9vw,8.5rem)] leading-[0.86] tracking-[-0.02em] [text-shadow:0_4px_50px_rgb(40_10_60/0.8)]" />
                <p className="mt-5 max-w-[34ch] font-serif text-lg text-night-ink/85 italic [text-shadow:0_2px_24px_rgb(40_10_60/0.9)]">An ode to the games I grew up on.</p>
              </div>
            ) : b.kind === 'prompt' ? (
              <p key={k} ref={bind(k)} className="kicker pointer-events-none col-start-1 row-start-1 self-end justify-self-center text-[clamp(0.9rem,1.4vw,1.15rem)] tracking-[0.5em] text-white opacity-0 [animation:blink_1.1s_steps(2)_infinite] [text-shadow:0_0_18px_#ff3da8]">
                {b.text}
              </p>
            ) : (
              // A game's objective box: top-left, quiet, legible over neon or daylight.
              <div key={k} ref={bind(k)} className="pointer-events-none col-start-1 row-start-1 max-w-[24rem] self-start rounded-sm bg-[rgb(12_8_24/0.55)] p-5 text-white opacity-0 backdrop-blur-sm">
                <p className="kicker text-[#7fe9ff]">{b.label}</p>
                <p className="mt-2 font-display text-[1.9rem] leading-[1.05]">{b.text}</p>
                <p className="mt-3 font-serif text-[1.02rem] leading-relaxed text-white/80">{b.note}</p>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
