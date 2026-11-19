import { useLayoutEffect, useRef } from 'react'
import PixelFringe from '../lib/PixelFringe'
import { usePaper, useRunningHead } from '../lib/chapters'
import { gsap, reducedMotion } from '../lib/scroll'
import { SPREADS, src } from './collage'

/* ------------------------------------------------------------- doodles */

const Steam = () => (
  <svg className="steam" viewBox="0 0 120 170" aria-hidden="true">
    {[[34, 0], [60, 1.1], [86, 2.2]].map(([x, d]) => (
      <path key={x} style={{ animationDelay: `${d}s` }} d={`M${x} 160 C ${x - 22} 128, ${x + 20} 104, ${x} 76 S ${x - 18} 34, ${x + 6} 4`} />
    ))}
  </svg>
)
/** Hand-drawn map of the Sangam: the Ganga and the Yamuna meet; the Saraswati runs unseen. */
const SangamMap = () => (
  <svg className="sangam-map" viewBox="0 0 420 300" aria-hidden="true">
    <path className="river" pathLength="1" d="M410 18 C 340 60, 330 120, 262 150 S 200 168, 176 176" />
    <path className="river" pathLength="1" d="M8 104 C 70 120, 118 168, 176 176" />
    <path className="river river-hidden" pathLength="1" d="M120 292 C 140 250, 168 214, 176 176" />
    <path className="river river-out" pathLength="1" d="M176 176 C 200 214, 236 250, 300 290" />
    <text x="330" y="40" className="map-label">Ganga</text>
    <text x="14" y="94" className="map-label">Yamuna</text>
    <text x="70" y="280" className="map-label map-faint">Saraswati (unseen)</text>
    <path className="map-star" d="M176 160 l5 11 12 1 -9 8 3 12 -11 -6 -11 6 3 -12 -9 -8 12 -1z" />
    <text x="196" y="196" className="map-label map-here">Sangam: home</text>
  </svg>
)
const Circle = () => (
  <svg className="doodle circle" viewBox="0 0 200 90" preserveAspectRatio="none" aria-hidden="true">
    <path pathLength="1" d="M152 12 C 110 -2, 30 4, 12 36 C -4 66, 60 86, 116 82 C 172 78, 198 52, 186 30 C 176 12, 140 6, 108 10" />
  </svg>
)
const Whoosh = () => (
  <svg className="doodle whoosh boil" viewBox="0 0 160 100" aria-hidden="true">
    <path d="M4 30 H 120" />
    <path d="M24 50 H 140" />
    <path d="M8 70 H 110" />
  </svg>
)

/* -------------------------------------------------------------- pieces */

function Piece({ it }) {
  const style = { left: `${it.x}%`, top: `${it.y}%`, rotate: `${it.r ?? 0}deg` }
  switch (it.kind) {
    case 'img':
      return (
        <figure className="piece" data-in="img" data-depth={it.depth ?? 0} style={{ ...style, '--w': it.w }}>
          <img src={src(it.src)} alt="" draggable="false" className={`block w-full ${it.duotone ? 'duotone' : ''} ${it.spin ? 'spin-slow' : ''}`} />
          {it.duotone && <span className="duotone-ink" aria-hidden="true" />}
          {it.steam && <Steam />}
          {it.whoosh && <Whoosh />}
          {it.tape?.map(([tx, ty, tr], i) => (
            <span key={i} className="tape" data-in="tape" style={{ left: `${tx}%`, top: `${ty}%`, rotate: `${tr}deg` }} />
          ))}
          {it.cap && <figcaption className="caption-fig">{it.cap}</figcaption>}
        </figure>
      )
    case 'poster':
      return (
        <p className={`piece poster ${it.outline ? 'poster-outline' : ''}`} data-in="poster" data-depth={it.depth ?? 0} style={{ ...style, color: it.color, '--s': it.size }} aria-hidden="true">
          {it.text}
        </p>
      )
    case 'note':
      return (
        <p className="piece note" data-in="note" style={{ ...style, '--s': it.size }}>
          {it.mark && <span className="marker" data-in="mark" aria-hidden="true" />}
          <span className="relative">{it.text}</span>
          {it.circle && <Circle />}
        </p>
      )
    case 'map':
      return (
        <figure className="piece" data-in="img" data-depth={it.depth ?? 0} style={{ ...style, '--w': it.w, filter: 'none' }}>
          <SangamMap />
        </figure>
      )
    case 'stamp':
      return (
        <p className="piece stamp" data-in="stamp" style={style}>
          {it.text}
        </p>
      )
    case 'tag':
      return (
        <p className="piece pricetag" data-in="stamp" style={style}>
          {it.text}
        </p>
      )
    case 'ticket':
      return (
        <div className="piece ticket" data-in="img" style={style}>
          <span className="ticket-kicker">Admit one</span>
          <span className="ticket-title">First day · first show</span>
          <span className="ticket-meta">Balcony · Row F</span>
        </div>
      )
    case 'card':
      return (
        <div className="piece notecard" data-in="img" style={style}>
          <p className="notecard-year">{it.year}</p>
          <p className="notecard-text">{it.text}</p>
        </div>
      )
    case 'line':
      return (
        <p className="piece closing" data-in="poster" style={style}>
          {it.text}
        </p>
      )
    default:
      return null
  }
}

/* ----------------------------------------------------------- the route */

// A hand-drawn route through all six spreads, in (vw within the strip, % of height).
const ROUTE =
  'M 30 93 C 60 97, 80 72, 104 85 S 140 97, 160 83 S 196 62, 214 89 S 250 97, 270 81 S 300 60, 318 87 S 360 97, 380 75 S 420 62, 436 89 S 480 97, 500 88 S 512 76, 514 70'
const STOPS = [[104, 85, 'Prayagraj'], [214, 89, 'Chai'], [318, 87, 'Cricket'], [436, 89, 'Cinema'], [514, 70, 'Then']]

function Route() {
  return (
    <>
      <svg className="route" viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <mask id="route-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="100">
            <path className="route-mask" d={ROUTE} pathLength="1" />
          </mask>
        </defs>
        {/* Two passes of the pen, a hair apart, so the line reads hand-drawn rather than plotted. */}
        <path className="route-line route-ghost" d={ROUTE} mask="url(#route-reveal)" transform="translate(0.15 0.35)" />
        <path className="route-line" d={ROUTE} mask="url(#route-reveal)" />
      </svg>
      {STOPS.map(([x, y, label]) => (
        <span key={label} className="route-stop" data-in="stop" style={{ left: `calc(${x} * var(--strip-unit))`, top: `${y}%` }}>
          <span className="route-pin" />
          <span className="route-label">{label}</span>
        </span>
      ))}
    </>
  )
}

/* ------------------------------------------------------------- chapter */

const TITLE = 'Chai, Cricket & Cinema'

export default function ChapterOne() {
  const ref = useRef(null)
  const strip = useRef(null)
  usePaper(ref)
  useRunningHead(ref, 'Chapter One · Chai, Cricket & Cinema')

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined
    const ctx = gsap.context(() => {
      const section = ref.current
      const el = strip.current
      const travel = () => el.scrollWidth - innerWidth
      // The scrapbook slides sideways while the page scrolls down.
      const move = gsap.to(el, {
        x: () => -travel(),
        ease: 'none',
        // Hold on the title card for the first ~60% of a screen before the scrapbook starts to travel.
        scrollTrigger: { trigger: section, start: () => `top+=${Math.round(innerHeight * 0.6)} top`, end: 'bottom bottom', scrub: 0.7, invalidateOnRefresh: true },
      })
      gsap.fromTo('.route-mask', { strokeDashoffset: 1 }, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.7 },
      })

      // Title letters assemble from scattered paper scraps as the page rises over the orb.
      gsap.from('.title-letter', {
        x: () => gsap.utils.random(-260, 260),
        y: () => gsap.utils.random(-220, 220),
        rotation: () => gsap.utils.random(-70, 70),
        opacity: 0,
        ease: 'expo.out',
        stagger: { each: 0.02, from: 'random' },
        scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 5%', scrub: 0.8 },
      })

      el.querySelectorAll('.spread').forEach((spread, i) => {
        const items = spread.querySelectorAll(':scope > .piece')
        const tl = gsap.timeline({
          scrollTrigger: i === 0
            ? { trigger: section, start: 'top 70%', end: 'top top', scrub: 0.8 }
            : { trigger: spread, containerAnimation: move, start: 'left 88%', end: 'left 20%', scrub: 0.8 },
        })
        items.forEach((it, k) => {
          const kind = it.dataset.in
          const at = k * 0.12
          if (kind === 'img') tl.from(it, { y: 160, rotation: gsap.utils.random(-22, 22), scale: 0.86, opacity: 0, duration: 0.6, ease: 'expo.out' }, at)
          else if (kind === 'poster') tl.from(it, { yPercent: 40, opacity: 0, duration: 0.6, ease: 'expo.out' }, at)
          else if (kind === 'stamp') tl.from(it, { scale: 2.2, opacity: 0, rotation: '+=18', duration: 0.3, ease: 'back.out(3)' }, at + 0.3)
          else tl.from(it, { y: 18, opacity: 0, duration: 0.4, ease: 'power3.out' }, at + 0.25)
        })
        // Tape slaps down after the photo lands; marker swipes and circles draw on last.
        // (Each only if the spread has one — GSAP warns on empty targets.)
        const all = q => spread.querySelectorAll(q)
        if (all('[data-in="tape"]').length) tl.from(all('[data-in="tape"]'), { scale: 1.9, opacity: 0, duration: 0.18, ease: 'back.out(3)', stagger: 0.06 }, '>-0.25')
        if (all('[data-in="mark"]').length) tl.from(all('[data-in="mark"]'), { scaleX: 0, transformOrigin: 'left center', duration: 0.3, ease: 'power2.out' }, '>-0.1')
        if (all('.circle path').length) tl.fromTo(all('.circle path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.inOut' }, '<')
        if (all('.river').length) tl.fromTo(all('.river'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut', stagger: 0.12 }, 0.2)

        // Depth: nearer pieces slide a little faster than the page — cheap, convincing parallax.
        items.forEach(it => {
          const depth = +it.dataset.depth || 0
          if (!depth) return
          gsap.to(it, {
            x: -depth * 120,
            ease: 'none',
            scrollTrigger: i === 0 ? { trigger: section, start: 'top top', end: () => `+=${innerHeight}`, scrub: true } : { trigger: spread, containerAnimation: move, start: 'left right', end: 'right left', scrub: true },
          })
        })
      })
      gsap.from(el.querySelectorAll('[data-in="stop"]'), {
        scale: 0,
        stagger: 0.2,
        ease: 'back.out(3)',
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.7 },
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  // Reduced motion: no sideways travel — the spreads simply stack and scroll like pages.
  const still = reducedMotion()
  return (
    <section ref={ref} id="one" aria-labelledby="one-title" className="paper relative z-20" style={{ height: still ? 'auto' : 'var(--one-height)' }}>
      <PixelFringe edge="top" />
      <PixelFringe edge="bottom" />
      <div className={still ? 'relative' : 'sticky top-0 h-svh overflow-hidden'}>
        <div ref={strip} className={`strip relative flex ${still ? 'flex-col' : 'h-full'}`}>
          {SPREADS.map((s, i) => (
            <div key={s.id} className={`spread relative shrink-0 ${still ? 'h-svh' : 'h-full'}`} aria-label={s.label}>
              {i === 0 && (
                <div className="absolute top-[18%] left-[7%] max-w-[60%]">
                  <p className="poster text-stamp" style={{ '--s': 4.2 }}>Chapter One</p>
                  <h2 id="one-title" className="mt-4 font-display text-[calc(var(--strip-unit)*8.6)] leading-[0.88] tracking-[-0.02em] text-ink" aria-label={TITLE}>
                    {/* Letters fly in individually, but each word stays unbroken across lines. */}
                    {TITLE.split(' ').map((word, w) => (
                      <span key={w} className="inline-block whitespace-nowrap" aria-hidden="true">
                        {word.split('').map((ch, k) => (
                          <span key={k} className="title-letter inline-block">
                            {ch}
                          </span>
                        ))}
                        {' '}
                      </span>
                    ))}
                  </h2>
                </div>
              )}
              {s.items.map((it, k) => (
                <Piece key={k} it={it} />
              ))}
            </div>
          ))}
          {!still && <Route />}
        </div>
      </div>
    </section>
  )
}
