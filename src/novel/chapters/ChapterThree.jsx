import { useEffect, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { store } from '../lib/store'
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
// In slot k (journey.js placeAt) the walk to stop k is u 0..0.5 and the stand is 0.5..1. Card k holds from
// u 0.22 (he is ~44% of the way to stop k) to u 0.22 of slot k+1 (~44% of the way to the next), the
// stretch where diorama k is most in frame, and hands straight over to card k+1. Card 0 waits for the seam
// title to clear (gone at three 0.05); the last card is gone before the recede (0.97, timeline.js).
const slip = k => [k === 0 ? 0.053 : (k + 0.22) / N, k === N - 1 ? 0.968 : (k + 1.22) / N]
// In 0.005 x 820svh (~4svh) top-first; out in 0.0008 (<1svh), so no frame shows the outgoing card sliced.
const BEATS = JOURNEY.map((s, k) => ({ at: slip(k), edge: [0.005, 0.0008], s }))
// One title for the Two to Three seam, on one progress that runs work 0..1 then 1 + three.
const SEAM = [{ at: [0.946, 1.05], edge: [0.01, 0.006] }] // whole from work 0.956, as the hall washes to paper
const seam23 = () => store.set('seam23', store.three > 0 ? 1 + store.three : store.work)

export default function ChapterThree() {
  const ref = useRef(null)
  useProgress(ref, 'three', { start: 'top bottom', end: 'bottom bottom' })
  useRunningHead(ref, 'Chapter Three · Places I Worked', { start: 'top bottom', end: 'bottom bottom' })
  useEffect(() => {
    seam23()
    const on = key => (key === 'work' || key === 'three') && seam23()
    store.listeners.add(on)
    return () => store.listeners.delete(on)
  }, [])
  const bind = useBeats('three', BEATS)
  const bindSeam = useBeats('seam23', SEAM)

  return (
    <section ref={ref} id="three" aria-labelledby="three-title" className="relative" style={{ height: '820svh' }}>
      <div className="sticky top-0 h-svh">
        {/* Fixed, so the title never rides Two's sticky up or Three's in; it spans the seam alone. */}
        <div className="pointer-events-none fixed inset-0 z-[1] grid place-items-center px-6">
          <div ref={bindSeam(0)} className="max-w-[min(90vw,60rem)] text-ink opacity-0">
            <p className="poster text-stamp" style={{ '--s': 2.6 }}>Chapter Three</p>
            <Assemble as="h2" id="three-title" parts={TITLE} className="mt-4 block font-display text-[clamp(3.4rem,8vw,7.4rem)] leading-[0.88] tracking-[-0.02em]" />
            <p className="mt-5 max-w-[34ch] font-serif text-lg text-ink/85 italic">Prayagraj, 2022 to New York, 2026.</p>
          </div>
        </div>
        <div className="absolute inset-0 grid px-6 pt-[13svh] md:px-[6vw]">
          {BEATS.map((b, k) => (
            <article key={b.s.id} ref={bind(k)} className="paper job-sheet col-start-1 row-start-1 max-w-[25rem] self-start p-5 text-ink opacity-0 shadow-[0_18px_40px_rgb(20_14_8/0.28)] md:p-7" style={{ rotate: `${k % 2 ? 0.8 : -0.9}deg` }} aria-label={`${b.s.when}, ${b.s.place}`}>
              <p className="kicker text-stamp">
                {b.s.when} · {b.s.place}
              </p>
              <ul className="mt-3 space-y-3 md:mt-4 md:space-y-4">
                {b.s.roles.map(r => (
                  <li key={`${r.org}-${r.role}`}>
                    <p className="font-display text-[1.4rem] leading-[1.05] md:text-[1.65rem]">{r.role}</p>
                    <p className="mt-1 font-serif text-[0.98rem] text-ink/80">
                      {r.org} · {r.period}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-ink/15 pt-3 font-hand text-[1.3rem] md:mt-5 md:pt-4 md:text-[1.45rem] leading-tight text-[#2a2116]">“{b.s.roles.at(-1)?.impact}”</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
