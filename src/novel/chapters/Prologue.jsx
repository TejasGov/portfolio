import { useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import Assemble from '../lib/Assemble'
import { CONTACT, JOURNEY, ROLES } from '../content'
import { goTo } from '../Book'

/*
 * Prologue: the projection booth. The camera leaves the projector, flies out through the window down
 * the beam, turns back over the seats, then rises into the lamp until it floods the frame and breaks
 * into the paper of Chapter One (stage/Takeover.jsx). Camera timing lives in cinema/timeline.js.
 */
const BEATS = [
  { at: [-0.1, 0.1], kind: 'title' },
  { at: [0.13, 0.4], text: 'Computer Science, University at Buffalo, class of 2027.' }, // facts only; Tejas's own lines replace these
  { at: [0.48, 0.76], text: 'Roll the flashback.' },
]

const NAME = [['Tejas ', false], ['Govind', true]]
const LINK = 'kicker inline-flex min-h-11 items-center underline-offset-4 hover:text-glow hover:underline'
// The facts on the first frame, from the same data Chapter Three uses: a recruiter needn't scroll for them.
const FACTS = ROLES.filter(r => ['Daiwa Capital Markets America', 'COA'].includes(r.org)).map(r => `${r.role}, ${r.org}`).join(' · ') + ' · Computer Science, University at Buffalo ’27'

export default function Prologue() {
  const ref = useRef(null)
  useProgress(ref, 'prologue')
  useRunningHead(ref, 'Prologue · Lights down', { end: 'bottom 143%' }) // = Chapter One's top at 75% (--one-overlap 68svh): its paper has the screen
  const bind = useBeats('prologue', BEATS)
  const phone = matchMedia('(max-width: 760px)').matches // read once: the camera is progress-driven, so only the length changes

  return (
    <section ref={ref} id="prologue" aria-label="Prologue" className="relative" style={{ height: phone ? '320svh' : '380svh' }}>
      <div className="sticky top-0 h-svh">
        <div className="pointer-events-none absolute inset-0 grid px-6 md:px-[6vw]">
          {BEATS.map((b, i) => (
            <div key={i} ref={bind(i)} className="col-start-1 row-start-1 flex w-full opacity-0">
              {b.kind === 'title' ? (
                <div className="self-end pb-[9svh]">
                  <p className="kicker text-glow/80">Now showing</p>
                  <Assemble as="h1" parts={NAME} className="mt-5 block font-display text-[clamp(4.2rem,11.5vw,10.5rem)] leading-[0.84] tracking-[-0.025em] [text-shadow:0_4px_60px_rgb(3_5_11/0.95)]" />
                  <p className="mt-6 max-w-[60ch] font-serif text-[15px] leading-snug text-night-ink/90 [text-shadow:0_2px_20px_rgb(3_5_11/0.95)] md:text-base">{FACTS}</p>
                  <div className="kicker pointer-events-auto mt-5 flex flex-wrap items-center gap-x-6 text-night-ink/85">
                    {/* Straight to the work and the newest job (Daiwa), for whoever hasn't time for the film. */}
                    <button type="button" onClick={() => goTo({ chapter: 'two', i: 0 })} className={LINK}>Work ↓</button>
                    <button type="button" onClick={() => goTo({ chapter: 'three', k: JOURNEY.length - 1 })} className={LINK}>Experience ↓</button>
                    <a href={`mailto:${CONTACT.email}`} className={LINK}>Email ↗</a>
                    {/* Book.jsx owns the dialog; its header button opens it. */}
                    <button type="button" onClick={() => document.querySelector('[data-contents]')?.click()} className={LINK}>Contents</button>
                    <span className="text-night-ink/55">or scroll ↓</span>
                  </div>
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
