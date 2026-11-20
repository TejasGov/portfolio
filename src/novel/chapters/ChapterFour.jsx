import { useMemo, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import Assemble from '../lib/Assemble'
import { PROJECTS } from '../content'

const TITLE = [['Press ', false], ['start', true]]

/*
 * Chapter Four, "Press Start": an ode to the games I grew up on (cinema/arcade.js). You walk a neon
 * coast at dusk; at the arcade at the end of the boardwalk a wave turns the world to blocks, and you
 * walk on through those. The words live here, set like a game's on-screen prompts.
 * Progress starts as the chapter rises into view, so it picks up exactly where the journey ends.
 */
// Only the game's own words here. Tejas's lines, when he writes them, go in `note`.
// The thing he built that is a game, straight from the project data.
const GAME = PROJECTS.find(p => p.id === 'yudhveer')
const BEATS = [
  { at: [0.035, 0.17], kind: 'title' },
  { at: [0.2, 0.45], kind: 'objective', label: 'Objective', text: 'Reach the arcade.', skip: true },
  { at: [0.49, 0.58], kind: 'prompt', text: 'Press start' },
  { at: [0.78, 0.96], kind: 'objective', label: 'New objective', text: 'Build something.', project: GAME },
]

export default function ChapterFour() {
  const ref = useRef(null)
  useProgress(ref, 'four', { start: 'top bottom', end: 'bottom bottom' })
  useRunningHead(ref, 'Chapter Four · Press Start', { start: 'top bottom', end: 'bottom bottom' })
  const beats = useMemo(() => BEATS, [])
  const bind = useBeats('four', beats)

  return (
    <section ref={ref} id="four" aria-labelledby="four-title" className="relative" style={{ height: '760svh' }}>
      <div className="sticky top-0 h-svh">
        <div className="absolute inset-0 grid px-6 pt-[13svh] pb-[12svh] md:px-[6vw]">
          {beats.map((b, k) =>
            b.kind === 'title' ? (
              <div key="title" ref={bind(k)} className="pointer-events-none col-start-1 row-start-1 self-end opacity-0">
                <p className="kicker text-[#ff7ac8]">Chapter Four</p>
                <Assemble as="h2" id="four-title" parts={TITLE} className="mt-4 block font-display text-[clamp(3.6rem,9vw,8.5rem)] leading-[0.86] tracking-[-0.02em] [text-shadow:0_4px_50px_rgb(40_10_60/0.8)]" />
              </div>
            ) : b.kind === 'prompt' ? (
              <p key={k} ref={bind(k)} className="kicker pointer-events-none col-start-1 row-start-1 self-end justify-self-center text-[clamp(0.9rem,1.4vw,1.15rem)] tracking-[0.5em] text-white opacity-0 [animation:blink_1.1s_steps(2)_infinite] [text-shadow:0_0_18px_#ff3da8]">
                {b.text}
              </p>
            ) : (
              // A game's objective box: top-left, quiet, legible over neon or daylight.
              <div key={k} ref={bind(k)} className={`${b.skip || b.project ? 'pointer-events-auto' : 'pointer-events-none'} col-start-1 row-start-1 max-w-[24rem] self-start rounded-sm bg-[rgb(12_8_24/0.85)] p-5 text-white opacity-0`}>
                <p className="kicker text-[#9ff0ff]">{b.label}</p>
                <p className="mt-2 font-display text-[1.9rem] leading-[1.05]">{b.text}</p>
                {b.note && <p className="mt-3 font-serif text-[1.02rem] leading-relaxed text-white/80">{b.note}</p>}
                {b.skip && <a href="#epilogue" className="kicker mt-3 inline-flex min-h-11 items-center text-white/85 underline-offset-4 hover:underline">Skip to contact ↓</a>}
                {b.project && (
                  <>
                    <p className="mt-3 font-serif text-[1.02rem] leading-relaxed text-white/80">{b.project.title}: {b.project.line}</p>
                    {b.project.link && (
                      <a href={b.project.link} target="_blank" rel="noreferrer" className="kicker mt-2 inline-flex min-h-11 items-center text-[#9ff0ff] underline-offset-4 hover:underline">
                        {`${b.project.linkLabel} ↗`}
                      </a>
                    )}
                  </>
                )}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
