import { useLayoutEffect, useRef } from 'react'
import PixelFringe from '../lib/PixelFringe'
import { usePaper, useRunningHead } from '../lib/chapters'
import { gsap, reducedMotion } from '../lib/scroll'
import { ALL_ROLES } from '../content'

/*
 * Chapter Three: every place I've worked, typeset like the index at the back of a book.
 * Each entry opens (native <details>) to the line I'd want remembered from it.
 */
export default function ChapterThree() {
  const ref = useRef(null)
  usePaper(ref)
  useRunningHead(ref, 'Chapter Three · Places I Worked')

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined
    const ctx = gsap.context(() => {
      gsap.from('.index-row', {
        y: 28,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: { trigger: '.index-list', start: 'top 80%' },
      })
      gsap.from('.three-head > *', { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.three-head', start: 'top 80%' } })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} id="three" aria-labelledby="three-title" className="paper relative z-20 px-6 pt-[22svh] pb-[30svh] md:px-[8vw]">
      <PixelFringe edge="top" />
      <PixelFringe edge="bottom" />
      <header className="three-head mx-auto max-w-5xl">
        <p className="poster text-stamp" style={{ '--s': 3.2, '--strip-unit': '1vw' }}>
          Chapter Three
        </p>
        <h2 id="three-title" className="mt-4 font-display text-[clamp(3.4rem,8vw,7.4rem)] leading-[0.88] tracking-[-0.02em]">
          Places I <em>worked</em>
        </h2>
        <p className="mt-5 font-serif text-lg text-ink/65 italic">An index, newest first. Open any entry.</p>
      </header>

      <ol className="index-list mx-auto mt-[10svh] max-w-5xl border-t border-ink/25">
        {ALL_ROLES.map((r, i) => (
          <li key={`${r.org}-${r.role}`} className="index-row border-b border-ink/15">
            <details className="group">
              <summary className="grid cursor-pointer list-none grid-cols-[3.2rem_1fr] items-baseline gap-x-4 py-5 md:grid-cols-[4.5rem_1fr_auto] md:py-6 [&::-webkit-details-marker]:hidden">
                <span className="font-poster text-xl text-stamp md:text-2xl">{r.year}</span>
                <span className="min-w-0">
                  <span className="font-display text-[clamp(1.5rem,2.6vw,2.3rem)] leading-tight group-open:italic">{r.role}</span>
                  <span className="ml-3 font-serif text-base text-ink/60 italic md:text-lg">{r.org}</span>
                  {r.current && <sup className="ml-1 font-mono text-[10px] text-stamp">now</sup>}
                </span>
                <span className="kicker col-start-2 mt-1 text-ink/55 md:col-start-auto md:mt-0">{r.period}</span>
              </summary>
              <div className="grid grid-cols-[3.2rem_1fr] gap-x-4 pb-7 md:grid-cols-[4.5rem_1fr]">
                <span className="kicker pt-1 text-ink/40">{String(i + 1).padStart(2, '0')}</span>
                <div className="max-w-[60ch]">
                  <p className="font-hand text-[1.7rem] leading-tight text-[#2a2116]">“{r.impact}”</p>
                  <ul className="mt-4 space-y-2 font-serif text-[1.02rem] leading-relaxed text-ink/80">
                    {r.bullets.map(b => (
                      <li key={b} className="pl-5 -indent-5">
                        — {b}
                      </li>
                    ))}
                  </ul>
                  <p className="kicker mt-4 text-ink/45">
                    {r.type} · {r.place}
                  </p>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  )
}
