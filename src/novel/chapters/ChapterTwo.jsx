import { useMemo, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { PROJECTS } from '../content'
import Assemble from '../lib/Assemble'

const TITLE = [['Now ', false], ['showing', true]]

/*
 * Chapter Two: five films. The hall arrives as an ink drawing and blooms into colour, the camera walks
 * into the screen, and each project plays as a short animated film starring the traveller
 * (cinema/timeline.js, cinema/films/). The words and links live here, beside each film.
 */
const FILMS = [0.15, 0.85] // = FILMS in cinema/timeline.js (kept here so this chunk doesn't pull in three)
const SLOT = (FILMS[1] - FILMS[0]) / PROJECTS.length
const beatWindow = i => [FILMS[0] + (i + 0.2) * SLOT, FILMS[0] + (i + 0.8) * SLOT]
const ext = { target: '_blank', rel: 'noreferrer' }

export default function ChapterTwo() {
  const ref = useRef(null)
  useProgress(ref, 'work')
  useProgress(ref, 'workIn', { start: 'top bottom', end: 'top top' })
  useRunningHead(ref, 'Chapter Two · Now Showing')
  const beats = useMemo(() => [{ at: [0.03, 0.07], kind: 'title' }, ...PROJECTS.map((p, i) => ({ at: beatWindow(i), p, i }))], [])
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
                  Five projects, each its own short film.
                </p>
              </div>
            ) : (
              <article key={b.p.id} ref={bind(k)} className="col-start-1 row-start-1 max-w-[26rem] self-end pb-[8svh] opacity-0 md:mr-[2vw] md:self-center md:justify-self-end md:pb-0" aria-labelledby={`p-${b.p.id}`}>
                <p className="kicker text-glow/80">
                  {String(b.i + 1).padStart(2, '0')} / {String(PROJECTS.length).padStart(2, '0')} · {b.p.category}
                </p>
                {/* The film takes the left two thirds of the frame; its title sits in the right third. */}
                <h3 id={`p-${b.p.id}`} className="mt-3 font-display text-[clamp(2.6rem,4.4vw,4.4rem)] leading-[0.92] [text-shadow:0_4px_40px_rgb(3_5_11/0.8)]">
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
