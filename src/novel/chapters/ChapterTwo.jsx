import { useMemo, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { PROJECTS } from '../content'
import Assemble from '../lib/Assemble'

const TITLE = [['Now ', false], ['showing', true]]

/*
 * Chapter Two: five screenings. In the hall, each project is projected into being on the stage
 * (cinema/timeline.js): dust streams down the beam, condenses on the object, the solid model dissolves
 * in, and the projector throws its title card on the screen behind it. The words and links live here.
 */
const SLOT = 0.93 / PROJECTS.length
const beatWindow = i => [0.07 + (i + 0.4) * SLOT, 0.07 + (i + 0.96) * SLOT]
const ext = { target: '_blank', rel: 'noreferrer' }

export default function ChapterTwo() {
  const ref = useRef(null)
  useProgress(ref, 'work')
  useRunningHead(ref, 'Chapter Two · Now Showing')
  const beats = useMemo(() => [{ at: [-0.1, 0.065], kind: 'title' }, ...PROJECTS.map((p, i) => ({ at: beatWindow(i), p, i }))], [])
  const bind = useBeats('work', beats)

  return (
    <section ref={ref} id="two" aria-labelledby="two-title" className="relative" style={{ height: '900svh' }}>
      <div className="sticky top-0 h-svh">
        <div className="absolute inset-0 grid px-6 md:px-[6vw]">
          {beats.map((b, k) =>
            b.kind === 'title' ? (
              <div key="title" ref={bind(k)} className="pointer-events-none col-start-1 row-start-1 self-end pb-[12svh] opacity-0">
                <p className="kicker text-glow/80">Chapter Two · Things I built</p>
                <Assemble as="h2" id="two-title" parts={TITLE} className="mt-5 block font-display text-[clamp(3.6rem,9vw,8.5rem)] leading-[0.86] tracking-[-0.02em] [text-shadow:0_4px_60px_rgb(3_5_11/0.95)]" />
                <p className="mt-6 max-w-[34ch] font-serif text-lg leading-relaxed text-night-ink/75 [text-shadow:0_2px_30px_rgb(3_5_11/0.95)]">
                  Five projects, each projected into the room.
                </p>
              </div>
            ) : (
              <article key={b.p.id} ref={bind(k)} className="col-start-1 row-start-1 max-w-[30rem] self-end pb-[9svh] opacity-0 md:pb-[11svh]" aria-labelledby={`p-${b.p.id}`}>
                <p className="kicker text-glow/80">
                  {String(b.i + 1).padStart(2, '0')} / {String(PROJECTS.length).padStart(2, '0')} · {b.p.category}
                </p>
                {/* The projector throws the big title on the screen; the card carries a quieter one. */}
                <h3 id={`p-${b.p.id}`} className="mt-3 font-display text-[clamp(2rem,3vw,2.8rem)] leading-[0.95] italic [text-shadow:0_4px_40px_rgb(3_5_11/0.95)]">
                  {b.p.title}
                </h3>
                <p className="mt-5 max-w-[30ch] font-serif text-[clamp(1.05rem,1.4vw,1.3rem)] leading-[1.5] text-night-ink/90 [text-shadow:0_2px_24px_rgb(3_5_11/0.95)]">{b.p.line}</p>
                <p className="kicker mt-5 max-w-[46ch] leading-[1.9] text-night-ink/55 normal-case tracking-[0.06em]">{b.p.tech}</p>
                <div className="kicker mt-6 flex gap-6">
                  {b.p.link && (
                    <a href={b.p.link} {...ext} className="underline-offset-4 hover:underline">
                      {b.p.linkLabel} ↗
                    </a>
                  )}
                  {b.p.github && (
                    <a href={b.p.github} {...ext} className="underline-offset-4 hover:underline">
                      Source ↗
                    </a>
                  )}
                </div>
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
