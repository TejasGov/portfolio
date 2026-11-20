import { useLayoutEffect, useRef } from 'react'
import PixelFringe from '../lib/PixelFringe'
import { usePaper, useRunningHead } from '../lib/chapters'
import { gsap, reducedMotion } from '../lib/scroll'
import { store } from '../lib/store'
import { SPREADS, src } from './collage'
import { ALL_ROLES, CONTACT } from '../content'
import { SUMMARY } from '@/data/aboutData'

// Intrinsic sizes, so each photo reserves its box before it decodes (and decodes off the main thread).
const SIZE = {
  'amitabh2-s': [611, 640], 'ball-s': [1086, 1134], 'bat-s': [177, 1134], 'cathedral-t': [1100, 746], 'chaiwala-t': [1440, 973],
  'csk-t': [1000, 684], 'deepika-s': [709, 1134], 'dhoni2-s': [776, 900], 'gully-cricket-t': [1440, 973], 'kareena-s': [611, 640],
  'khusro-bagh-t': [1100, 839], 'kulhad-s': [1044, 1063], 'kulhad-trio-s': [1134, 985], 'mela-night-t': [1440, 973],
  'muir-college-t': [1100, 720], 'naini-bridge-t': [1440, 973], 'pvr-t': [1000, 762], 'ranbir-s': [611, 640], 'reel-s': [1112, 1134],
  'sangam-t': [1440, 973], 'srk2-s': [611, 640], 'sunflower-s': [1004, 942], 'tejas-t': [1026, 1266], 'thornhill-t': [1100, 839],
  'wc2011-t': [1070, 726],
}
const photo = name => ({ src: src(name), width: SIZE[name]?.[0], height: SIZE[name]?.[1], decoding: 'async', draggable: 'false' })
/** Decode a spread's photos ahead of time, so none decodes on the frame it scrolls in. */
const decodeAll = root => root?.querySelectorAll('img').forEach(img => img.decode().catch(() => {}))

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

/* ------------------------------------------------------------ about me */

// What a visitor should know first. Every line comes from Tejas's own data: his summary (the 2023
// site's), his current main roles, his links.
const NOW = ['Daiwa Capital Markets America', 'COA']
const HIS_LINE = SUMMARY.slice(SUMMARY.indexOf('The kind of person'))
const link = label => CONTACT.links.find(l => l.label === label)?.href

function AboutCard({ style }) {
  const now = NOW.map(org => ALL_ROLES.find(r => r.org === org)).filter(Boolean)
  return (
    <div className="piece about" data-in="about" style={style}>
      <figure className="about-photo">
        <img {...photo('tejas-t')} alt="Tejas Govind" />
        <span className="tape" style={{ left: '50%', top: '-3%', rotate: '-4deg' }} />
      </figure>
      <div className="about-body">
        <p className="about-name" data-line>Tejas Govind</p>
        <ul className="about-facts">
          <li data-line><span className="kicker">Studying</span> Computer Science, University at Buffalo · class of 2027</li>
          {now.map(r => (
            <li key={r.org} data-line><span className="kicker">Now</span> {r.role}, {r.org} · {r.place}</li>
          ))}
          <li data-line><span className="kicker">From</span> Prayagraj, India</li>
        </ul>
        <p className="about-line" data-line>“{HIS_LINE}”</p>
        <p className="about-links" data-line>
          <a href={`mailto:${CONTACT.email}`}>Email</a>
          <a href={link('GitHub')} target="_blank" rel="noreferrer">GitHub ↗</a>
          <a href={link('LinkedIn')} target="_blank" rel="noreferrer">LinkedIn ↗</a>
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- pieces */

function Piece({ it }) {
  const style = { left: `${it.x}%`, top: `${it.y}%`, rotate: `${it.r ?? 0}deg` }
  switch (it.kind) {
    case 'img':
      return (
        <figure className="piece" data-in={it.fly ? 'fly' : 'img'} data-depth={it.depth ?? 0} style={{ ...style, '--w': it.w }}>
          <img {...photo(it.src)} alt="" className={`block w-full ${it.duotone ? 'duotone' : ''} ${it.spin ? 'spin-slow' : ''}`} />
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
        <p className={`piece poster ${it.outline ? 'poster-outline' : ''}`} data-in="poster" data-fx={it.fx} data-depth={it.depth ?? 0} style={{ ...style, color: it.color, '--s': it.size }} aria-hidden="true">
          {it.fx
            ? it.text.split('').map((ch, k) => (
                <span key={k} className="pl" style={{ '--k': k }}>
                  <span className="pl-in">{ch}</span>
                </span>
              ))
            : it.text}
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
        <div className={`piece ticket ${it.tone ?? ''}`} data-in="img" style={style}>
          <span className="ticket-kicker">{it.kicker ?? 'Admit one'}</span>
          <span className="ticket-title">{it.title ?? 'First day · first show'}</span>
          <span className="ticket-meta">{it.meta ?? 'Balcony · Row F'}</span>
        </div>
      )
    case 'cast':
      // A lineup of small cut-outs, overlapping like a poster's billing block.
      return (
        <div className="piece cast" data-in="cast" data-depth={it.depth ?? 0} style={{ ...style, '--w': it.w }}>
          {it.people.map(([name, file], i) => (
            <figure key={name} className="cast-member" style={{ '--i': i, '--r': `${((i * 37) % 9) - 4}deg` }}>
              <img {...photo(file)} alt={name} />
              <figcaption>{name}</figcaption>
            </figure>
          ))}
        </div>
      )
    case 'about':
      return <AboutCard style={style} />
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

/* ------------------------------------------------------------ the sheets */

/** A torn sheet's outline: points along each side, each nudged inward a little, so the edge reads torn. */
function torn(seed, n = 36, j = 1.4) {
  const r = k => Math.abs(Math.sin(seed * 91.7 + k * 12.9898) * 43758.5453) % 1
  const pts = []
  let k = 0
  for (let i = 0; i <= n; i++) pts.push([(i / n) * 100, r(k++) * j])
  for (let i = 1; i <= n; i++) pts.push([100 - r(k++) * j, (i / n) * 100])
  for (let i = n - 1; i >= 0; i--) pts.push([(i / n) * 100, 100 - r(k++) * j])
  for (let i = n - 1; i >= 1; i--) pts.push([r(k++) * j, (i / n) * 100])
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})`
}
function Sheet({ sheet, seed }) {
  const { color, x, y, w, h, r = 0, from = 'left', grid = false } = sheet
  return (
    <div className="sheet" data-from={from} style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, rotate: `${r}deg` }} aria-hidden="true">
      <div className={`sheet-paper${grid ? ' sheet-grid' : ''}`} style={{ backgroundColor: color, clipPath: torn(seed) }} />
    </div>
  )
}

/* ----------------------------------------------------------- the route */

// A hand-drawn route through all six spreads, in (vw within the strip, % of height).
const ROUTE =
  'M 30 93 C 60 97, 80 72, 104 85 S 140 97, 160 83 S 196 62, 214 89 S 240 97, 260 83 S 296 62, 314 89 S 350 97, 370 81 S 400 60, 418 87 S 460 97, 480 75 S 520 62, 536 89 S 580 97, 600 88 S 612 76, 614 70'
const STOPS = [[104, 85, 'Prayagraj'], [214, 89, 'Architecture'], [314, 89, 'Chai'], [418, 87, 'Cricket'], [536, 89, 'Cinema'], [614, 70, 'Then']]

function Route() {
  return (
    <>
      <svg className="route" viewBox="0 0 700 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <mask id="route-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="700" height="100">
            <path className="route-mask" d={ROUTE} pathLength="1" />
          </mask>
        </defs>
        {/* Two passes of the pen, a hair apart, so the line reads hand-drawn rather than plotted. */}
        <path className="route-line route-ghost" d={ROUTE} mask="url(#route-reveal)" transform="translate(0.15 0.35)" />
        <path className="route-line" d={ROUTE} mask="url(#route-reveal)" />
      </svg>
      <span className="route-nib" aria-hidden="true" />
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

const TITLE = 'About me'

export default function ChapterOne({ spreads = SPREADS }) {
  const ref = useRef(null)
  const strip = useRef(null)
  usePaper(ref)
  useRunningHead(ref, 'Chapter One · About me')

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined
    const spreadEls = strip.current.querySelectorAll('.spread')
    // The first two spreads decode now and again as the prologue nears its end; each later one as the
    // spread before it scrolls in.
    const early = () => [0, 1].forEach(i => decodeAll(spreadEls[i]))
    early()
    let primed = false
    const onStore = (key, v) => {
      if (key === 'prologue' && v > 0.5 && !primed) { primed = true; early() }
    }
    store.listeners.add(onStore)
    const ctx = gsap.context(() => {
      const section = ref.current
      const el = strip.current
      // Travel to the strip's end, but never past the closing line's left edge (+ a 20px gutter): a
      // portrait spread is wider than the screen, so the full run would cut the last sentence off.
      const last = el.querySelector('.closing')
      const travel = () => Math.min(el.scrollWidth - innerWidth, last ? last.parentElement.offsetLeft + last.offsetLeft - 20 : Infinity)
      // The scrapbook slides sideways while the page scrolls down.
      const move = gsap.to(el, {
        x: () => -travel(),
        ease: 'none',
        // Hold on the title card before the scrapbook starts to travel: ~60% of a screen, or 1.6 on a
        // portrait screen, where the About card fills the view and needs reading before it moves.
        scrollTrigger: { trigger: section, start: () => `top+=${Math.round(innerHeight * (innerWidth / innerHeight <= 1 ? 1.6 : 0.6))} top`, end: 'bottom bottom', scrub: 0.7, invalidateOnRefresh: true },
      })
      // The route draws itself across the strip, a red nib at its tip leading you from spread to spread.
      const line = el.querySelector('.route-line:not(.route-ghost)')
      const nib = el.querySelector('.route-nib')
      const length = line?.getTotalLength() ?? 0
      gsap.fromTo('.route-mask', { strokeDashoffset: 1 }, {
        strokeDashoffset: 0,
        autoRound: false, // the line is measured 0..1 (pathLength); whole-pixel rounding would snap it on at once
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.7 },
        onUpdate() {
          if (!line || !nib) return
          const k = this.progress()
          const pt = line.getPointAtLength(k * length)
          // By transform, not left/top, so the nib never relayouts the strip (it is 100svh tall).
          nib.style.translate = `calc(${pt.x.toFixed(2)} * var(--strip-unit)) ${pt.y.toFixed(2)}svh`
          nib.style.opacity = k > 0.002 && k < 0.998 ? 1 : 0
        },
      })

      // Title letters assemble from scattered paper scraps as the page takes over from the light.
      gsap.from('.title-letter', {
        x: () => gsap.utils.random(-160, 160),
        y: () => gsap.utils.random(-140, 140),
        rotation: () => gsap.utils.random(-50, 50),
        opacity: 0,
        ease: 'expo.out',
        stagger: { each: 0.02, from: 'random' },
        // Done by the time the page is three-quarters up, so a reader who stops mid-seam reads the title whole.
        scrollTrigger: { trigger: section, start: 'top 85%', end: 'top 40%', scrub: 0.8 },
      })

      spreadEls.forEach((spread, i) => {
        const items = spread.querySelectorAll(':scope > .piece')
        const onEnter = () => decodeAll(spreadEls[i + 1])
        const tl = gsap.timeline({
          scrollTrigger: i === 0
            ? { trigger: section, start: 'top 70%', end: 'top top', scrub: 0.8, onEnter }
            : { trigger: spread, containerAnimation: move, start: 'left 88%', end: 'left 20%', scrub: 0.8, onEnter },
        })
        // The sheet is laid down first, from its own edge, like a hand sliding a page into the book.
        const sheet = spread.querySelector(':scope > .sheet')
        if (sheet) {
          const from = sheet.dataset.from
          const origin = { left: 'left center', right: 'right center', top: 'center top', bottom: 'center bottom' }[from]
          tl.from(sheet, { [from === 'left' || from === 'right' ? 'scaleX' : 'scaleY']: 0, transformOrigin: origin, rotation: '+=4', duration: 0.55, ease: 'expo.out' }, 0)
        }
        items.forEach((it, k) => {
          const kind = it.dataset.in
          const at = k * 0.12 + (sheet ? 0.15 : 0)
          if (kind === 'img') tl.from(it, { y: 160, rotation: gsap.utils.random(-22, 22), scale: 0.86, opacity: 0, duration: 0.6, ease: 'expo.out' }, at)
          else if (kind === 'fly') {
            // Bowled in: a long arc from the upper left, spinning, landing where it rests.
            tl.from(it, { xPercent: -900, rotation: -900, duration: 0.7, ease: 'none' }, at)
            tl.from(it, { yPercent: -420, duration: 0.7, ease: 'power2.in' }, at)
            tl.from(it, { opacity: 0, duration: 0.1 }, at)
          } else if (kind === 'poster' && it.dataset.fx) {
            const letters = it.querySelectorAll('.pl')
            const fx = it.dataset.fx
            if (fx === 'build') tl.from(letters, { yPercent: 70, scaleY: 0.2, transformOrigin: '50% 100%', opacity: 0, duration: 0.45, ease: 'power4.out', stagger: 0.07 }, at)
            else if (fx === 'stamp') tl.from(letters, { y: -140, scale: 1.7, rotation: () => gsap.utils.random(-24, 24), opacity: 0, duration: 0.35, ease: 'back.out(2.4)', stagger: 0.08 }, at)
            else if (fx === 'steam') tl.from(letters, { y: 90, x: () => gsap.utils.random(-30, 30), opacity: 0, duration: 0.6, ease: 'sine.out', stagger: 0.1 }, at) // no blur: an animated filter repaints every frame
            else if (fx === 'bounce') tl.from(letters, { y: -260, opacity: 0, duration: 0.6, ease: 'bounce.out', stagger: 0.06 }, at)
            else tl.from(letters, { opacity: 0, duration: 0.3, ease: 'steps(4)', stagger: { each: 0.07, from: 'random' } }, at) // marquee: bulbs flicking on
          } else if (kind === 'poster') tl.from(it, { yPercent: 40, opacity: 0, duration: 0.6, ease: 'expo.out' }, at)
          else if (kind === 'about') {
            tl.from(it, { y: 120, rotation: -4, opacity: 0, duration: 0.5, ease: 'expo.out' }, 0)
            tl.fromTo(it.querySelectorAll('[data-line]'), { clipPath: 'inset(-20% 100% -20% -2%)' }, { clipPath: 'inset(-20% -2% -20% -2%)', duration: 0.3, ease: 'none', stagger: 0.07 }, 0.2)
          } else if (kind === 'note') tl.fromTo(it, { clipPath: 'inset(-60% 100% -60% -15%)' }, { clipPath: 'inset(-60% -15% -60% -15%)', duration: 0.45, ease: 'none' }, at + 0.25) // written on, left to right
          else if (kind === 'stamp') tl.from(it, { scale: 2.2, opacity: 0, rotation: '+=18', duration: 0.3, ease: 'back.out(3)' }, at + 0.3)
          else if (kind === 'cast') tl.from(it.querySelectorAll('.cast-member'), { y: 140, rotation: () => gsap.utils.random(-25, 25), opacity: 0, duration: 0.5, ease: 'back.out(1.5)', stagger: 0.06 }, at)
          else tl.from(it, { y: 18, opacity: 0, duration: 0.4, ease: 'power3.out' }, at + 0.25)
        })
        // Tape slaps down after the photo lands; marker swipes and circles draw on last.
        // (Each only if the spread has one — GSAP warns on empty targets.)
        const all = q => spread.querySelectorAll(q)
        if (all('[data-in="tape"]').length) tl.from(all('[data-in="tape"]'), { scale: 1.9, opacity: 0, duration: 0.18, ease: 'back.out(3)', stagger: 0.06 }, '>-0.25')
        if (all('[data-in="mark"]').length) tl.from(all('[data-in="mark"]'), { scaleX: 0, transformOrigin: 'left center', duration: 0.3, ease: 'power2.out' }, '>-0.1')
        if (all('.circle path').length) tl.fromTo(all('.circle path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, autoRound: false, duration: 0.35, ease: 'power2.inOut' }, '<')
        if (all('.river').length) tl.fromTo(all('.river'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, autoRound: false, duration: 0.5, ease: 'power2.inOut', stagger: 0.12 }, 0.2)

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
    return () => {
      store.listeners.delete(onStore)
      ctx.revert()
    }
  }, [])

  // Reduced motion: no sideways travel — the spreads simply stack and scroll like pages.
  const still = reducedMotion()
  return (
    <section ref={ref} id="one" aria-labelledby="one-title" className="paper relative z-20" style={{ height: still ? 'auto' : 'var(--one-height)', marginTop: still ? 0 : 'calc(-1 * var(--one-overlap))' }}>
      <PixelFringe edge="bottom" />
      <div className={still ? 'relative' : 'sticky top-0 h-svh overflow-hidden'}>
        <div ref={strip} className={`strip relative flex ${still ? 'flex-col' : 'h-full'}`}>
          {spreads.map((s, i) => (
            <div key={s.id} className={`spread relative shrink-0 ${still ? 'h-svh' : 'h-full'}`} aria-label={s.label}>
              {s.sheet && <Sheet sheet={s.sheet} seed={i + 1} />}
              {i === 0 && (
                <div className="absolute top-[18%] left-[max(16px,7%)] max-w-[60%]">
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
