import { Fragment, useEffect, useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { store } from '../lib/store'
import { useProgress, useRunningHead } from '../lib/chapters'
import { ScrollTrigger } from '../lib/scroll'
import { ALSO_SHOWING, CONTACT, LAB, PROJECTS } from '../content'
import { Jump } from '../Book'

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
      const [a, b] = innerWidth / innerHeight <= 1 ? [0.05, 0.05] : [0.034, 0.045] // landscape .034: the title sits low, half on the seats
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
    <>
    <section ref={ref} id="two" aria-labelledby="two-title" className="relative" style={{ height: '900svh' }}>
      <div className="sticky top-0 h-svh">
        {/* Fixed, under One (z-20), so it never rides Two's sticky up into a crop or draws over One's paper.
            Set in ink on the drawn hall, it takes the screen's light (--bloom) as the colour reaches it. */}
        <div ref={seamEl} className="pointer-events-none fixed inset-0 z-[1] grid px-6 md:px-[6vw]">
          <div
            ref={bindSeam(0)}
            className="self-end pb-[12svh] max-w-[min(100%,66rem)] opacity-0 [@media(min-aspect-ratio:1/1)]:pb-[4.5svh]" // landscape: low enough that the kicker clears the screen's lit bottom rail
            style={{
              color: 'color-mix(in oklab, var(--color-ink), var(--color-night-ink) calc(var(--bloom, 0) * 100%))',
              textShadow: '0 4px 60px rgb(3 5 11 / calc(var(--bloom, 0) * 0.95))',
            }}
          >
            {/* Stamp red on the paper; a lighter vermilion on the dark curtains. */}
            <p className="poster" style={{ '--s': 2.6, color: 'color-mix(in oklab, var(--color-stamp), #ff6a4d calc(var(--bloom, 0) * 100%))' }}>Chapter Two · Things I built</p>
            <h2 id="two-title" className="display-title mt-5 block text-[clamp(2.6rem,6.4vw,6.2rem)] leading-[0.92]"><span>Now</span> <span className="title-heavy">showing</span></h2>
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
            <Fragment key={b.p.id}>
            <Jump to={{ chapter: 'two', i: k }}>Film {k + 1} of {PROJECTS.length} · {b.p.title}</Jump>
            <article ref={bind(k)} className="film-sheet film-copy col-start-1 row-start-1 max-w-[26rem] self-end opacity-0 md:mr-[2vw] md:self-center md:justify-self-end md:pb-0" aria-labelledby={`p-${b.p.id}`}>
              <p className="kicker text-glow">
                {String(b.i + 1).padStart(2, '0')} / {String(PROJECTS.length).padStart(2, '0')} · {b.p.category}
              </p>
              {/* The film takes the left two thirds of the frame; its title sits in the right third. */}
              <h3 id={`p-${b.p.id}`} className="mt-3 font-display text-[clamp(2.1rem,3.4vw,3.4rem)] leading-none tracking-[-0.02em] [text-shadow:0_4px_40px_rgb(3_5_11/0.8)]">
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
            </Fragment>
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
    <Lobby />
    </>
  )
}

/*
 * After the films, the lobby: a paper sheet (z above Three's seam title) rises over the hall's ink drawing,
 * carrying a wall of posters and the lab's index, then clears through its faded hem onto bare paper, where
 * Three's title is uncovered and its journey inks in. The stage keeps drawing behind it, so Three still
 * compiles while the reader pauses here. Until the sheet has covered the screen, Three's seam title (which
 * keys off Two's end) is held back (index.css [data-lobby-ahead]), so it never announces Three over the lobby.
 */
const ART = {
  // A voice, drawn as a waveform: bars from two sines.
  echoscribe: (
    <g fill="currentColor">
      {Array.from({ length: 34 }, (_, i) => {
        const h = 8 + Math.abs(Math.sin(i * 0.55) * 46 + Math.sin(i * 1.7) * 16)
        return <rect key={i} x={6 + i * 5.6} y={60 - h / 2} width="3" height={h} rx="1.5" />
      })}
    </g>
  ),
  // A wall of films; one is lit.
  'whattowatch-tonight': (
    <g>
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={4 + (i % 10) * 19.4} y={4 + Math.floor(i / 10) * 28} width="15" height="23" fill="currentColor" opacity={i === 16 ? 1 : 0.16} />
      ))}
      <circle cx="139" cy="43" r="24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </g>
  ),
  // A notice, read into ticks.
  'backpack-brain': (
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="44" y="6" width="112" height="108" rx="3" />
      {[30, 54, 78, 102].map((y, i) => (
        <g key={y} opacity={i === 3 ? 0.4 : 1}>
          <path d={`M58 ${y - 4}l5 5 9-10`} stroke="var(--ac2)" />
          <path d={`M82 ${y}h${[58, 44, 52, 34][i]}`} />
        </g>
      ))}
    </g>
  ),
  // A pixel skyline under three coins.
  'gotta-get-rich': (
    <g shapeRendering="crispEdges">
      {[[0, 60], [18, 38], [36, 74], [54, 50], [72, 88], [90, 30], [108, 64], [126, 96], [144, 44], [162, 70], [180, 56]].map(([x, h]) => (
        <rect key={x} x={x + 2} y={120 - h} width="16" height={h} fill="currentColor" opacity="0.85" />
      ))}
      {[[46, 12], [100, 4], [150, 16]].map(([x, y]) => (
        <g key={x} fill="var(--ac2)">
          <rect x={x} y={y + 3} width="12" height="6" />
          <rect x={x + 3} y={y} width="6" height="12" />
        </g>
      ))}
    </g>
  ),
}

function Lobby() {
  const ref = useRef(null)
  useRunningHead(ref, LOBBY_HEAD)
  useEffect(() => {
    const el = ref.current, root = document.documentElement
    // Ahead of the sheet (it has not yet covered the screen): hold Three's seam title back.
    const hold = s => root.toggleAttribute('data-lobby-ahead', !s.isActive)
    const st = ScrollTrigger.create({ trigger: el, start: 'top top', end: 'max', onToggle: hold, onRefresh: hold })
    hold(st)
    // Posters slide up and settle, the lab fades in: once, as each enters.
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && (e.target.classList.add('is-in'), io.unobserve(e.target))), { rootMargin: '0px 0px -12% 0px' })
    el.querySelectorAll('[data-enter]').forEach(n => io.observe(n))
    return () => {
      st.kill()
      io.disconnect()
      root.removeAttribute('data-lobby-ahead')
    }
  }, [])

  return (
    <section ref={ref} id="also" aria-labelledby="also-title" className="relative z-[2]">
      <div className="paper lobby-ground px-4 md:px-[6vw]">
        <div className="mx-auto max-w-[80rem]">
          <p className="poster text-stamp" style={{ '--s': 2.2 }}>Chapter Two · Also showing</p>
          <h2 id="also-title" className="display-title mt-4 block text-[clamp(2.3rem,5.4vw,5.2rem)] leading-[0.92] text-ink"><span>Also</span> <span className="title-heavy">showing</span></h2>
          <p className="mt-5 max-w-[38ch] font-serif text-lg text-ink/80">Four more projects, on the lobby wall.</p>

          <ul data-enter className="lobby-wall mt-10 md:mt-14" aria-label="Also showing">
            {ALSO_SHOWING.map((p, i) => (
              <li key={p.id} id={`also-${p.id}`} className="one-sheet" style={{ '--i': i }} data-art={p.id}>
                <article aria-labelledby={`also-${p.id}-t`}>
                  <div className="one-sheet-face">
                    <p className="kicker one-sheet-top">Tejas Govind presents</p>
                    <svg className="one-sheet-art" viewBox="0 0 200 120" aria-hidden="true">{ART[p.id]}</svg>
                    <h3 id={`also-${p.id}-t`} className="one-sheet-title">{p.title}</h3>
                    {p.tag && <p className="one-sheet-tag">{p.tag}</p>}
                    <p className="one-sheet-line">{p.line}</p>
                    <p className="one-sheet-bill">{dots(p.bill)}</p>
                    <span className="one-sheet-sweep" aria-hidden="true" />
                  </div>
                  <div className="mt-3 flex gap-2">
                    {p.link && <a href={p.link} {...ext} className={LOBBY_BTN} aria-label={`${p.title}: live demo (opens in a new tab)`}>Live ↗</a>}
                    {p.github && <a href={p.github} {...ext} className={LOBBY_BTN} aria-label={`${p.title}: code (opens in a new tab)`}>Code ↗</a>}
                  </div>
                </article>
              </li>
            ))}
          </ul>

          <div id="lab" data-enter className="lab mt-24 md:mt-32">
            <p className="kicker text-stamp">Machine learning · private repos</p>
            <h2 className="display-title mt-3 block text-[clamp(1.9rem,3.6vw,3.2rem)] leading-[0.95] text-ink"><span>In the</span> <span className="title-heavy">lab</span></h2>
            <ol className="mt-8 border-t border-ink/25">
              {LAB.map((p, i) => (
                <li key={p.id} id={`lab-${p.id}`} className="lab-row border-b border-ink/15 py-5 md:py-6">
                  <span className="kicker text-ink/55">L-{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="font-display text-[1.35rem] leading-tight text-ink md:text-[1.6rem]">{p.title}</h3>
                    <p className="mt-1.5 max-w-[60ch] font-serif text-[1.02rem] leading-snug text-ink/85">{p.does}</p>
                    <p className="mt-2 font-mono text-[12.5px] leading-[1.7] tracking-[0.04em] text-ink/70">{p.how.join(' · ')}</p>
                    {p.result && (
                      <p className="mt-2 max-w-[70ch] font-serif text-[0.95rem] leading-snug text-ink/75">
                        <span className="kicker mr-2 text-[10.5px]! text-ink/50">From the README</span>“{p.result}”
                      </p>
                    )}
                  </div>
                  <p className="lab-meta kicker text-[11px]! leading-[1.8] text-ink/55">
                    <span className="block">Private repo</span>
                    <span className="block normal-case tracking-[0.06em]">{dots(p.stack)}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      {/* Bare paper under the hem, where Three's title is uncovered before its journey inks in. */}
      <div aria-hidden="true" className="h-[45svh]" />
    </section>
  )
}
const LOBBY_HEAD = 'Chapter Two · Also showing'
// A dotted list that only wraps between items.
const dots = s => s.split(' · ').map((t, k) => <Fragment key={t}>{k > 0 && ' · '}<span className="whitespace-nowrap">{t}</span></Fragment>)
const LOBBY_BTN = 'inline-flex min-h-11 flex-1 items-center justify-center border border-ink/35 px-3 font-mono text-[12.5px] tracking-[0.14em] uppercase text-ink hover:bg-ink hover:text-paper'
