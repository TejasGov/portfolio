import { useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import Assemble from '../lib/Assemble'

/*
 * Prologue: the vortex of pixels condenses into the orb, the orb turns home.
 * Copy is a first draft in Tejas's voice; every claim is true to his own words and data.
 */
const BEATS = [
  { at: [-0.1, 0.13], kind: 'title' },
  { at: [0.1, 0.27], text: 'Most of what I build starts as noise.' },
  { at: [0.32, 0.5], text: 'The work is staring at it long enough to find the shape.' },
  { at: [0.53, 0.72], text: 'Every line on this is something I couldn’t stop thinking about.' },
  { at: [0.76, 1.4], kind: 'home' },
]

const NAME = [['Tejas ', false], ['Govind', true]]

export default function Prologue() {
  const ref = useRef(null)
  useProgress(ref, 'prologue')
  useRunningHead(ref, 'Prologue · Signal')
  const bind = useBeats('prologue', BEATS)

  return (
    <section ref={ref} id="prologue" aria-label="Prologue" className="relative" style={{ height: '620svh' }}>
      <div className="sticky top-0 h-svh">
        <div className="pointer-events-none absolute inset-0 grid px-6 md:px-[6vw]">
          {BEATS.map((b, i) => (
            <div key={i} ref={bind(i)} className="col-start-1 row-start-1 flex w-full opacity-0">
              {b.kind === 'title' ? (
                // Editorial title block, bottom-left, clear of the bright core of the vortex.
                <div className="self-end pb-[9svh]">
                  <p className="kicker text-glow/80">A design novel in four chapters</p>
                  <Assemble as="h1" parts={NAME} className="mt-5 block font-display text-[clamp(4.2rem,11.5vw,10.5rem)] leading-[0.84] tracking-[-0.025em] [text-shadow:0_4px_60px_rgb(3_5_11/0.95)]" />
                  <p className="kicker mt-8 text-night-ink/55">Scroll, slowly ↓</p>
                </div>
              ) : b.kind === 'home' ? (
                <div className="self-end pb-[10svh]">
                  <p className="font-display text-[clamp(2.6rem,5.4vw,4.8rem)] leading-none italic [text-shadow:0_4px_50px_rgb(3_5_11/0.95)]">Mine started here.</p>
                  <p className="kicker mt-5 text-glow">Prayagraj · Uttar Pradesh · India</p>
                </div>
              ) : (
                <p className="max-w-[15ch] self-end pb-[14svh] font-display md:self-center md:pb-0 text-[clamp(2.2rem,4.2vw,3.9rem)] leading-[1.02] italic [text-shadow:0_4px_50px_rgb(3_5_11/0.95)]">
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
