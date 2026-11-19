import { useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import Assemble from '../lib/Assemble'

/*
 * Prologue: the projection booth. The camera leaves the projector, flies out through the window down
 * the beam, turns back over the seats, then rises into the lamp until it floods the frame and breaks
 * into the paper of Chapter One (stage/Takeover.jsx). Camera timing lives in cinema/timeline.js.
 */
const BEATS = [
  { at: [-0.1, 0.1], kind: 'title' },
  { at: [0.15, 0.27], text: 'Lights down.' },
  { at: [0.32, 0.5], text: 'I grew up on Friday releases in Prayagraj.' },
  { at: [0.56, 0.74], text: 'Roll the flashback.' },
]

const NAME = [['Tejas ', false], ['Govind', true]]

export default function Prologue() {
  const ref = useRef(null)
  useProgress(ref, 'prologue')
  useRunningHead(ref, 'Prologue · Lights down')
  const bind = useBeats('prologue', BEATS)

  return (
    <section ref={ref} id="prologue" aria-label="Prologue" className="relative" style={{ height: '760svh' }}>
      <div className="sticky top-0 h-svh">
        <div className="pointer-events-none absolute inset-0 grid px-6 md:px-[6vw]">
          {BEATS.map((b, i) => (
            <div key={i} ref={bind(i)} className="col-start-1 row-start-1 flex w-full opacity-0">
              {b.kind === 'title' ? (
                <div className="self-end pb-[9svh]">
                  <p className="kicker text-glow/80">Now showing</p>
                  <Assemble as="h1" parts={NAME} className="mt-5 block font-display text-[clamp(4.2rem,11.5vw,10.5rem)] leading-[0.84] tracking-[-0.025em] [text-shadow:0_4px_60px_rgb(3_5_11/0.95)]" />
                  <p className="kicker mt-8 text-night-ink/55">Scroll, slowly ↓</p>
                </div>
              ) : (
                <p className="max-w-[15ch] self-end pb-[14svh] font-display text-[clamp(2.2rem,4.2vw,3.9rem)] leading-[1.02] italic [text-shadow:0_4px_50px_rgb(3_5_11/0.95)]">
                  {b.text}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
