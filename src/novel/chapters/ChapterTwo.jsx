import { useEffect, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { store } from '../lib/store'
import { useProgress, useRunningHead } from '../lib/chapters'
import { CONTACT, PROJECTS } from '../content'

/*
 * Chapter Two: five films. The hall arrives as an ink drawing and blooms into colour, the camera walks
 * into the screen, and each project plays as a short animated film starring the traveller
 * (cinema/timeline.js, cinema/films/). The words and links live here, beside each film.
 */
const FILMS = [0.15, 0.85] // = FILMS in cinema/timeline.js (kept here so this chunk doesn't pull in three)
const SLOT = (FILMS[1] - FILMS[0]) / PROJECTS.length
const ext = { target: '_blank', rel: 'noreferrer' }
// One card and one nameplate per film, back to back on the same tiling, so a film is never on screen
// unnamed or without its words. The first is up while the push-in fills the frame with film 1; the last
// card stays into the pull-out (timeline.js .85 to .93) to .9, its plate to .91.
// Between films both swap as a hard cut (a few px of scroll), so the cut frame is never unnamed or half-wiped.
const tile = (i, [first, end, edge]) => {
  const last = i === PROJECTS.length - 1
  return { at: [i ? FILMS[0] + i * SLOT - 0.0003 : first, last ? end : FILMS[0] + (i + 1) * SLOT], edge: [i ? 0.0004 : edge, last ? edge : 0.0004], p: PROJECTS[i], i }
}
const CARDS = PROJECTS.map((_, i) => tile(i, [0.12, 0.9, 0.006]))
const CAPTIONS = PROJECTS.map((_, i) => tile(i, [0.085, 0.91, 0.004]))
// The chapter's title, on one progress that runs workIn - 1 (-1..0) then work. It is on while One's paper
// still covers its box, and seamEl's clip (below) uncovers it line by line exactly where the paper, with its
// 24svh faded hem (.one-ground), has cleared: titled from the first revealed pixel, never under the paper.
// It wipes out as the camera starts the push (timeline.js .075).
const SEAM = [{ at: [-0.75, 0.072], edge: [0.03, 0.009] }]
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const BTN = 'inline-flex min-h-11 items-center border border-night-ink/35 px-4 font-mono text-[13px] tracking-[0.14em] uppercase hover:bg-night-ink hover:text-night'

export default function ChapterTwo() {
  const ref = useRef(null)
  const seamEl = useRef(null)
  useProgress(ref, 'work')
  useProgress(ref, 'workIn', { start: 'top bottom', end: 'top top' })
  useRunningHead(ref, 'Chapter Two · Now Showing', { end: 'bottom bottom' })
  useEffect(() => {
    let bloom
    const seam12 = () => {
      store.set('seam12', store.work > 0 ? store.work : store.workIn - 1)
      // One's hem ends 24svh below Two's top, which sits (1 - workIn) screens down.
      if (seamEl.current) seamEl.current.style.clipPath = store.workIn < 0.9 ? `inset(calc(${((1 - store.workIn) * innerHeight).toFixed(1)}px + 24svh) -60px -60px)` : ''
      // The title turns from ink to screen-light as the colour bloom (timeline.js w 0 to .065) passes behind it:
      // the floor, then the seats under its last line. A phone's title sits on the seats, which colour last.
      const [a, b] = innerWidth / innerHeight <= 1 ? [0.05, 0.05] : [0.026, 0.045]
      const k = [ss(a, a + 0.013, store.work).toFixed(3), ss(b, b + 0.013, store.work).toFixed(3)]
      if (k.join() !== bloom) {
        bloom = k.join()
        seamEl.current?.style.setProperty('--bloom', k[0])
        seamEl.current?.style.setProperty('--bloom-line', k[1])
      }
    }
    seam12()
    const on = key => (key === 'work' || key === 'workIn') && seam12()
    store.listeners.add(on)
    return () => store.listeners.delete(on)
  }, [])
  const bind = useBeats('work', CARDS)
  const bindSeam = useBeats('seam12', SEAM)
  const bindCap = useBeats('work', CAPTIONS)

  return (
    <section ref={ref} id="two" aria-labelledby="two-title" className="relative" style={{ height: '900svh' }}>
      <div className="sticky top-0 h-svh">
        {/* Fixed, under One (z-20), so it never rides Two's sticky up into a crop or draws over One's paper.
            Set in ink on the drawn hall, it takes the screen's light (--bloom) as the colour reaches it. */}
        <div ref={seamEl} className="pointer-events-none fixed inset-0 z-[1] grid px-6 md:px-[6vw]">
          <div
            ref={bindSeam(0)}
            className="self-end pb-[12svh] max-w-[min(100%,60rem)] opacity-0"
            style={{
              color: 'color-mix(in oklab, var(--color-ink), var(--color-night-ink) calc(var(--bloom, 0) * 100%))',
              textShadow: '0 4px 60px rgb(3 5 11 / calc(var(--bloom, 0) * 0.95))',
            }}
          >
            <p className="poster text-stamp" style={{ '--s': 2.6 }}>Chapter Two · Things I built</p>
            <h2 id="two-title" className="mt-5 block font-display text-[clamp(3.6rem,9vw,8.5rem)] leading-[0.86] tracking-[-0.02em]">Now showing</h2>
            <p
              className="mt-6 max-w-[34ch] font-serif text-lg leading-relaxed opacity-85"
              style={{
                color: 'color-mix(in oklab, var(--color-ink), var(--color-night-ink) calc(var(--bloom-line, 0) * 100%))',
                textShadow: '0 2px 30px rgb(3 5 11 / calc(var(--bloom-line, 0) * 0.95))',
              }}
            >
              Five projects, each its own short film.
            </p>
          </div>
        </div>
        <div className="absolute inset-0 grid px-6 md:px-[6vw]">
          {CARDS.map((b, k) => (
            <article key={b.p.id} ref={bind(k)} className="film-sheet film-copy col-start-1 row-start-1 max-w-[26rem] self-end opacity-0 md:mr-[2vw] md:self-center md:justify-self-end md:pb-0" aria-labelledby={`p-${b.p.id}`}>
              <p className="kicker text-glow">
                {String(b.i + 1).padStart(2, '0')} / {String(PROJECTS.length).padStart(2, '0')} · {b.p.category}
              </p>
              {/* The film takes the left two thirds of the frame; its title sits in the right third. */}
              <h3 id={`p-${b.p.id}`} className="mt-3 font-display text-[clamp(2.6rem,4.4vw,4.4rem)] leading-[0.92] [text-shadow:0_4px_40px_rgb(3_5_11/0.8)]">
                {b.p.title}
              </h3>
              <p className="mt-5 max-w-[30ch] font-serif text-[clamp(1.05rem,1.4vw,1.3rem)] leading-[1.5] text-night-ink/90 [text-shadow:0_2px_24px_rgb(3_5_11/0.95)]">{b.p.line}</p>
              <p className="kicker mt-5 max-w-[46ch] text-[14px]! leading-[1.9] text-night-ink/80 normal-case tracking-[0.06em]">{b.p.tech}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {b.p.link && (
                  <a href={b.p.link} {...ext} className={BTN}>
                    {b.p.linkLabel} ↗
                  </a>
                )}
                {b.p.github && (
                  <a href={b.p.github} {...ext} className={BTN}>
                    Code ↗
                  </a>
                )}
                {/* No public build or repo yet: the row still offers a way in. */}
                {!b.p.link && !b.p.github && (
                  <a href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(b.p.title)}`} className={BTN}>
                    Ask about it ↗
                  </a>
                )}
              </div>
            </article>
          ))}
          {/* The plate only names the film; its card (above, always up) carries the pitch and the links. */}
          {CAPTIONS.map(c => (
            <p key={c.p.id} ref={bindCap(c.i)} className="film-caption pointer-events-none opacity-0">
              <span className="kicker text-glow">
                {String(c.i + 1).padStart(2, '0')} / {String(PROJECTS.length).padStart(2, '0')} · {c.p.title}
              </span>
              <span className="film-caption-cat font-mono text-[13px] tracking-[0.08em] text-night-ink/85">{c.p.shortCategory}</span>
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
