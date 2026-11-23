import { useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { DOOR, FrontDoor } from '../boxoffice/BoxOffice'

/*
 * Prologue: the projection booth. The camera leaves the projector, flies out through the window down
 * the beam, turns back over the seats, then rises into the lamp until it floods the frame and breaks
 * into the paper of Chapter One (stage/Takeover.jsx). Camera timing lives in cinema/timeline.js.
 *
 * It opens in the dark the landing (landing/Landing.jsx) fades to, on the front door: the box office
 * (boxoffice/, which owns its window DOOR and the once-a-visit catch that stops a first flick on it), then the
 * booth's own lines for whoever keeps scrolling.
 */
const BEATS = [
  { at: DOOR, edge: [0.03, 0.04], kind: 'door' },
  { at: [0.45, 0.6], text: 'From Prayagraj to New York, by way of Buffalo.' }, // facts only (collage.js home, JOURNEY); Tejas's own lines replace these
  { at: [0.63, 0.79], text: 'Roll the flashback.' },
]

export default function Prologue() {
  const ref = useRef(null)
  useProgress(ref, 'prologue')
  useRunningHead(ref, 'Prologue · Lights down', { end: 'bottom 143%' }) // = Chapter One's top at 75% (--one-overlap 68svh): its paper has the screen
  const bind = useBeats('prologue', BEATS)
  const phone = matchMedia('(max-width: 760px)').matches // read once: the camera is progress-driven, so only the length changes

  return (
    <section ref={ref} id="prologue" aria-label="Prologue" className="relative" style={{ height: phone ? '320svh' : '380svh' }}>
      <div className="sticky top-0 h-svh">
        {/* The front door: the box office, the next thing a visitor meets after the landing. */}
        <div ref={bind(0)} className="absolute inset-0 opacity-0">
          <FrontDoor section={ref} />
        </div>
        <div className="pointer-events-none absolute inset-0 grid px-6 md:px-[6vw]">
          {BEATS.map((b, i) =>
            b.kind ? null : (
              <div key={i} ref={bind(i)} className="col-start-1 row-start-1 flex w-full opacity-0">
                <p className="max-w-[20ch] self-end [text-wrap:balance] pb-[14svh] font-display text-[clamp(1.8rem,3.3vw,3.1rem)] leading-[1.06] tracking-[-0.015em] [text-shadow:0_4px_50px_rgb(3_5_11/0.95)]">
                  {b.text}
                </p>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
