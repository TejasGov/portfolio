import { useMemo, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { PROJECTS } from '../content'

/*
 * Chapter Two: the pixel cloud becomes each project as an annotated hologram (drawn by the stage),
 * while an editorial spread carries the words and links. Windows match stage/timeline.js.
 */
const span = 0.94 / PROJECTS.length
const beatWindow = i => [0.06 + (i + 0.04) * span, 0.06 + (i + 0.78) * span]
const ext = { target: '_blank', rel: 'noreferrer' }

export default function ChapterTwo() {
  const ref = useRef(null)
  useProgress(ref, 'work')
  useRunningHead(ref, 'Chapter Two · Things I Built')
  const beats = useMemo(() => [{ at: [-0.1, 0.07], kind: 'title' }, ...PROJECTS.map((p, i) => ({ at: beatWindow(i), p, i }))], [])
  const bind = useBeats('work', beats)

  return (
    <section ref={ref} id="two" aria-labelledby="two-title" className="relative" style={{ height: '760svh' }}>
      <div className="sticky top-0 h-svh">
        <div className="absolute inset-0 grid px-6 md:px-[6vw]">
          {beats.map((b, k) =>
            b.kind === 'title' ? (
              <div key="title" ref={bind(k)} className="pointer-events-none col-start-1 row-start-1 self-center opacity-0">
                <p className="kicker text-glow/80">Chapter Two</p>
                <h2 id="two-title" className="mt-5 font-display text-[clamp(3.6rem,9vw,8.5rem)] leading-[0.86] tracking-[-0.02em]">
                  Things I <em>built</em>
                </h2>
                <p className="mt-6 max-w-[34ch] font-serif text-lg leading-relaxed text-night-ink/70">
                  Five of them, drawn the way I see them: as contour lines, and the parts that make them work.
                </p>
              </div>
            ) : (
              <article key={b.p.id} ref={bind(k)} className="col-start-1 row-start-1 self-end pb-[12svh] opacity-0 md:self-center md:pb-0" aria-labelledby={`p-${b.p.id}`}>
                <p className="kicker text-glow/80">
                  {String(b.i + 1).padStart(2, '0')} / {String(PROJECTS.length).padStart(2, '0')} · {b.p.category}
                </p>
                <h3 id={`p-${b.p.id}`} className="mt-4 font-display text-[clamp(3rem,7vw,6.6rem)] leading-[0.88] tracking-[-0.02em]">
                  {b.p.title}
                </h3>
                <p className="mt-6 max-w-[30ch] font-serif text-[clamp(1.1rem,1.5vw,1.35rem)] leading-[1.5] text-night-ink/85">{b.p.line}</p>
                <p className="kicker mt-6 max-w-[46ch] leading-[1.9] text-night-ink/50 normal-case tracking-[0.06em]">{b.p.tech}</p>
                <div className="kicker mt-7 flex gap-6">
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
