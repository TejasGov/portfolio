import { useMemo, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { CONTACT, PROJECTS } from '../content'
import Assemble from '../lib/Assemble'

const TITLE = [['Now ', false], ['showing', true]]

/*
 * Chapter Two: five films. The hall arrives as an ink drawing and blooms into colour, the camera walks
 * into the screen, and each project plays as a short animated film starring the traveller
 * (cinema/timeline.js, cinema/films/). The words and links live here, beside each film.
 */
const FILMS = [0.15, 0.85] // = FILMS in cinema/timeline.js (kept here so this chunk doesn't pull in three)
const SLOT = (FILMS[1] - FILMS[0]) / PROJECTS.length
// Opaque for ~80% of each film; edge 0.009 (~70px of scroll) makes the card arrive whole, not as a ghost.
const beatWindow = i => [FILMS[0] + (i + 0.06) * SLOT, FILMS[0] + (i + 0.94) * SLOT]
const ext = { target: '_blank', rel: 'noreferrer' }
const BTN = 'inline-flex min-h-11 items-center border border-night-ink/35 px-4 font-mono text-[13px] tracking-[0.14em] uppercase hover:bg-night-ink hover:text-night'

export default function ChapterTwo() {
  const ref = useRef(null)
  useProgress(ref, 'work')
  useProgress(ref, 'workIn', { start: 'top bottom', end: 'top top' })
  useRunningHead(ref, 'Chapter Two · Now Showing', { end: 'bottom bottom' })
  // The ink title is gone just as the white one starts, so the two never share the screen.
  const beats = useMemo(() => [{ at: [-0.03, 0.03], edge: [0.01, 0.009], kind: 'inktitle' }, { at: [0.03, 0.07], edge: 0.009, kind: 'title' }, ...PROJECTS.map((p, i) => ({ at: beatWindow(i), edge: 0.009, p, i }))], [])
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
            ) : b.kind === 'inktitle' ? (
              // While Two rises over the paper the hall is still an ink drawing, so its title is set in ink,
              // centred: high enough to be read mid-rise, low enough to clear One's pixel fringe (42svh).
              <div key="inktitle" ref={bind(k)} className="pointer-events-none col-start-1 row-start-1 self-center text-ink opacity-0" aria-hidden="true">
                <p className="poster text-stamp" style={{ '--s': 2.6 }}>Chapter Two · Things I built</p>
                <p className="mt-5 block font-display text-[clamp(3.6rem,9vw,8.5rem)] leading-[0.86] tracking-[-0.02em]">{TITLE.map(([w]) => w).join('')}</p>
                <p className="mt-6 max-w-[34ch] font-serif text-lg leading-relaxed text-ink/85">Five projects, each its own short film.</p>
              </div>
            ) : (
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
            ),
          )}
        </div>
      </div>
    </section>
  )
}
