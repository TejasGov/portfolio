import { useMemo, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import Assemble from '../lib/Assemble'
import { chapterP } from '../cinema/levels'
import '../four.css'

const TITLE = [['Press ', false], ['start', true]]
const HEAD = 'Chapter Four · Press Start' // through the back-out (0.93) too: Five's own head takes over as it rises

/*
 * Chapter Four, "Press Start": an ode to the games I grew up on, as four game worlds in one walk
 * (cinema/levels.js). A neon coast at dusk; at the arcade at the end of the boardwalk a wave turns the
 * world to blocks; clouds close over the blocks and part on a village; the village breaks into a
 * console and resolves into a night exercise. The words live here, set like a game's on-screen prompts.
 * Progress starts as the chapter rises into view, so it picks up exactly where the journey ends.
 */
// A beat's window in each world's own progress (the coast and blocks keep the p arcade.js runs on).
const A = p => chapterP('arcade', p), V = p => chapterP('village', p), O = p => chapterP('ops', p)
const EDGE = A(0.035) // the wipe the beats had before the chapter grew
// Only the game's own words here. Tejas's lines, when he writes them, go in `note`.
const BEATS = [
  { at: [A(0.035), A(0.17)], edge: [A(0.004), A(0.03)], kind: 'title' }, // whole from 0.04
  { at: [A(0.2), A(0.45)], kind: 'objective', label: 'Objective', text: 'Reach the arcade.', skip: true },
  { at: [A(0.465), A(0.555)], edge: A(0.005), kind: 'prompt', text: 'Press start' }, // whole from 0.47, gone before the wave's first cubes (0.565); a short edge, as a long wipe cuts the glyph tops
  { at: [A(0.74), A(0.865)], kind: 'objective', label: 'New objective', text: 'Get past the creatures.' }, // the blocks, until the clouds roll in
  { at: [V(0.16), V(0.84)], kind: 'objective', label: 'New objective', text: 'Build the village.' }, // between the clouds and the console
  { at: [O(0.2), O(0.6)], kind: 'objective', label: 'New objective', text: 'Reach the helicopter.' },
  { at: [O(0.68), 0.965], kind: 'objective', label: 'New objective', text: 'Next reel.', skip: true }, // the game's last prompt points on to Chapter Five's films
].map(b => ({ edge: EDGE, ...b }))

export default function ChapterFour() {
  const ref = useRef(null)
  useProgress(ref, 'four', { start: 'top bottom', end: 'bottom bottom' })
  useRunningHead(ref, HEAD, { start: 'top bottom', end: 'bottom bottom' })
  const beats = useMemo(() => BEATS, [])
  const bind = useBeats('four', beats)

  return (
    <section ref={ref} id="four" aria-labelledby="four-title" className="relative" style={{ height: '1400svh' }}>
      <div className="sticky top-0 h-svh">
        {/* Fixed, so the title is whole and in frame from the coast's 0.035, before this sticky sticks (its ~0.13). */}
        <div className="pointer-events-none fixed inset-0 z-[1] grid px-6 pb-[max(12svh,72px)] md:px-[6vw]">
          <div ref={bind(0)} className="four-title self-end opacity-0">
            <p className="four-kicker poster text-[#ff4fa3]" style={{ '--s': 2.6 }}>Chapter Four</p>
            <Assemble as="h2" id="four-title" parts={TITLE} className="mt-4 block font-display text-[clamp(3.6rem,9vw,8.5rem)] leading-[0.86] tracking-[-0.02em] [text-shadow:0_4px_50px_rgb(40_10_60/0.8)]" />
          </div>
        </div>
        <div className="absolute inset-0 grid px-6 pt-[13svh] pb-[12svh] md:px-[6vw]">
          {beats.map((b, k) =>
            b.kind === 'title' ? null : b.kind === 'prompt' ? (
              // On a dark pill above the scene, clear of the traveller; the words blink, the pill holds.
              <p key={k} ref={bind(k)} className="kicker pointer-events-none col-start-1 row-start-1 mt-[6svh] self-start justify-self-center rounded-sm bg-[rgb(12_8_24/0.85)] px-5 py-3 text-[clamp(1rem,1.6vw,1.25rem)] leading-[1.6] tracking-[0.42em] text-white opacity-0 [text-shadow:0_0_18px_#ff3da8]">
                <span className="[animation:blink_1.1s_steps(2)_infinite]">{b.text}</span>
              </p>
            ) : (
              // A game's objective box: top-left, quiet, legible over neon or daylight.
              <div key={k} ref={bind(k)} className={`${b.skip ? 'pointer-events-auto' : 'pointer-events-none'} col-start-1 row-start-1 max-w-[24rem] self-start rounded-sm bg-[rgb(12_8_24/0.85)] p-5 text-white opacity-0`}>
                <p className="kicker text-[#9ff0ff]">{b.label}</p>
                <p className="mt-2 font-display text-[1.9rem] leading-[1.05]">{b.text}</p>
                {b.note && <p className="mt-3 text-[1.02rem] leading-relaxed text-white/80">{b.note}</p>}
                {b.skip && <a href="#epilogue" className="kicker mt-3 inline-flex min-h-11 items-center text-white/85 underline-offset-4 hover:underline">Skip to contact ↓</a>}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
