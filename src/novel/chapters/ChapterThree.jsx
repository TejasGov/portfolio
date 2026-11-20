import { useMemo, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { JOURNEY } from '../content'
import Assemble from '../lib/Assemble'

const TITLE = [['Places I ', false], ['worked', true]]

/*
 * Chapter Three: the journey. In the 3D world (cinema/journey.js) the traveller walks a path from
 * Prayagraj to New York, pausing at a little world for each stop, which blooms from ink into colour as
 * he reaches it. The words live here: a paper slip, top-left, for each stop while he stands at it.
 * Progress starts as soon as the chapter rises into view, so it picks up exactly where Chapter Two ends.
 */
const N = JOURNEY.length
const slip = k => [(k + 0.4) / N, (k + 0.98) / N] // = the stand at stop k in journey.js placeAt()

export default function ChapterThree() {
  const ref = useRef(null)
  useProgress(ref, 'three', { start: 'top bottom', end: 'bottom bottom' })
  useRunningHead(ref, 'Chapter Three · Places I Worked')
  const beats = useMemo(() => [{ at: [0.012, 0.06], kind: 'title' }, ...JOURNEY.map((s, k) => ({ at: slip(k), s }))], [])
  const bind = useBeats('three', beats)

  return (
    <section ref={ref} id="three" aria-labelledby="three-title" className="relative" style={{ height: '820svh' }}>
      <div className="sticky top-0 h-svh">
        <div className="absolute inset-0 grid px-6 pt-[13svh] md:px-[6vw]">
          {beats.map((b, k) =>
            b.kind === 'title' ? (
              // The chapter opens on the page itself (the world is still ink), so it is set in ink.
              <div key="title" ref={bind(k)} className="pointer-events-none col-start-1 row-start-1 self-center text-ink opacity-0">
                <p className="kicker text-stamp">Chapter Three</p>
                <Assemble as="h2" id="three-title" parts={TITLE} className="mt-4 block font-display text-[clamp(3.4rem,8vw,7.4rem)] leading-[0.88] tracking-[-0.02em]" />
                <p className="mt-5 max-w-[34ch] font-serif text-lg text-ink/70 italic">From Prayagraj to New York, on foot. Keep scrolling and walk with me.</p>
              </div>
            ) : (
              <article key={b.s.id} ref={bind(k)} className="paper col-start-1 row-start-1 max-w-[25rem] self-start p-6 text-ink opacity-0 shadow-[0_18px_40px_rgb(20_14_8/0.28)] md:p-7" style={{ rotate: `${k % 2 ? 0.8 : -0.9}deg` }} aria-label={`${b.s.when}, ${b.s.place}`}>
                <p className="kicker text-stamp">
                  {b.s.when} · {b.s.place}
                </p>
                <ul className="mt-4 space-y-4">
                  {b.s.roles.map(r => (
                    <li key={`${r.org}-${r.role}`}>
                      <p className="font-display text-[1.65rem] leading-[1.05]">{r.role}</p>
                      <p className="mt-1 font-serif text-[0.98rem] text-ink/70 italic">
                        {r.org} · {r.period}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-ink/15 pt-4 font-hand text-[1.45rem] leading-tight text-[#2a2116]">“{b.s.roles.at(-1)?.impact}”</p>
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
