import { useEffect, useRef, useState } from 'react'
import { store } from './lib/store'
import { sound } from './lib/sound'
import { reducedMotion } from './lib/scroll'
import { ALSO_BUILT, ALSO_SHOWING, CONTACT, JOURNEY, LAB, PROJECTS, RESUME } from './content'

export const CONTENTS = [
  { id: 'prologue', n: '—', title: 'Prologue', sub: 'Lights down' },
  { id: 'one', n: 'I', title: 'About me', sub: 'Who I am, where I’m from' },
  { id: 'two', n: 'II', title: 'Now Showing', sub: 'Five films, and more' },
  { id: 'three', n: 'III', title: 'Places I Worked', sub: 'Prayagraj to New York' },
  { id: 'four', n: 'IV', title: 'Press Start', sub: 'An ode to games' },
  { id: 'five', n: 'V', title: 'The Big Screen', sub: 'Heroes, and a final' },
  { id: 'epilogue', n: '—', title: 'Epilogue', sub: 'House lights' },
]

// Deep links for the Contents: every film, and every role newest first (Daiwa first).
const FILMS_TOC = PROJECTS.map((p, i) => ({ key: p.id, label: p.title, chapter: 'two', i }))
// ...then the lobby after the films: the poster wall and the lab's index.
const LOBBY_TOC = [['Also showing', ALSO_SHOWING.map(p => ({ id: `also-${p.id}`, label: p.title }))], ['In the lab', LAB.map(p => ({ id: `lab-${p.id}`, label: p.title }))]]
const ROLES_TOC = [...JOURNEY].reverse().flatMap((s, r) => [...s.roles].reverse().map(x => ({ key: `${x.org}·${x.role}`, label: `${x.role} · ${x.org} · ${x.period}`, chapter: 'three', k: JOURNEY.length - 1 - r })))

// Reduced motion: no long sweep through every world on the way down.
const glide = () => (reducedMotion() ? 'instant' : 'smooth')
// Set while we move focus ourselves: a Jump's onFocus (land, or the dialog handing focus back) would re-jump.
let quiet = false
const hush = fn => {
  quiet = true
  try { fn() } finally { quiet = false }
}
const closeContents = () => hush(() => document.querySelector('dialog[open]')?.close())
// Keyboard and screen-reader users land where they jumped, not back at the top of the tab order.
function land(el) {
  if (!el) return
  if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.tabIndex = -1
  hush(() => el.focus({ preventScroll: true }))
}
const jumpKey = ({ chapter, i, k }) => `${chapter}${i ?? k ?? ''}`

export function goToId(id) {
  closeContents()
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: glide() })
  land(el)
}
// The exact scroll where an item's card is opaque, from each chapter's progress range (lib/chapters useProgress).
export function goTo(to, behavior = glide()) {
  const { chapter, i, k } = to
  closeContents()
  const el = document.getElementById(chapter)
  if (!el) return
  const h = el.offsetHeight, top = el.getBoundingClientRect().top + scrollY
  const y = chapter === 'one'
    ? top + innerHeight * 0.3 // the About card at rest (ChapterOne.jsx onFocus)
    : chapter === 'two'
    ? top + (h - innerHeight) * (0.15 + (i + 0.5) * 0.14) // 'top top' → 'bottom bottom'; the middle of film i
    : chapter === 'five'
    ? top - innerHeight + h * 0.035 // 'top bottom' → 'bottom bottom'; the title card over the push into the screen, before the tower's wide shot
    : top - innerHeight + h * ((k + (k ? 0.6 : 0.85)) / JOURNEY.length) // 'top bottom' → 'bottom bottom'; inside every stop's opaque window, the last one's too; the first lands after the chapter sticks (a phone's sheet is still rising before)
  scrollTo({ top: y, behavior })
  // The item's Jump (its next Tab enters the card's links), else the chapter itself.
  land(document.querySelector(`[data-jump="${jumpKey(to)}"]`) ?? el)
}

/**
 * Keyboard way into a card that only exists at one scroll position (a film, a job): hidden cards are inert,
 * so Tab would skip the whole chapter. Focusing this jumps to the card; the next Tab enters its links.
 */
export const Jump = ({ to, children }) => (
  <button
    type="button"
    data-jump={jumpKey(to)}
    onFocus={() => quiet || requestAnimationFrame(() => goTo(to, 'instant'))} // after the browser's own focus scroll
    onClick={() => goTo(to, 'instant')}
    className="kicker sr-only z-50 rounded-sm bg-[rgb(10_10_14/0.92)] text-white focus-visible:not-sr-only focus-visible:px-3 focus-visible:py-2 focus-visible:fixed focus-visible:top-20 focus-visible:left-5 md:focus-visible:top-24 md:focus-visible:left-7"
  >
    {children}
  </button>
)

// Speaker, with two waves when the cinema is audible and an x when it is not.
export const SoundIcon = ({ on }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 6.5h3l4-3.5v12l-4-3.5h-3z" />
    {on ? <path d="M12 6.5a3.5 3.5 0 0 1 0 5M14.2 4.3a6.6 6.6 0 0 1 0 9.4" /> : <path d="M12.2 6.8l4 4.4M16.2 6.8l-4 4.4" />}
  </svg>
)

/**
 * The book's chrome: a running head (name · current chapter · contents) and a page counter.
 * Every item sits on a small pill, like the corner readouts: blend modes went grey or vanished over the
 * bright worlds. Dark over the films, cream over paper, so it never fights the page; the swap crossfades.
 */
const DARK = 'bg-[rgb(10_10_14/0.92)] text-white' // near opaque, so lit geometry never shows through
const CREAM = 'bg-paper text-ink ring-1 ring-ink/15' // opaque: on paper the text scrolling under it is the same colour as the pill's own
export default function Book() {
  const [label, setLabel] = useState('Prologue · Lights down')
  const [night, setNight] = useState(store.night)
  const [bright, setBright] = useState(!!store.bright) // a bright 3D frame (Chapter Four's clouds, village): the stage publishes 'bright'
  const [audible, setAudible] = useState(sound.on)
  // The first frame is a poster with its own actions (chapters/Prologue.jsx): the chrome waits until it leaves.
  const [landing, setLanding] = useState(true)
  const OFF = landing ? 'invisible opacity-0' : ''
  useEffect(() => sound.subscribe(setAudible), [])
  const page = useRef(null)
  const dialog = useRef(null)
  // Paper: a paper chapter covers the screen (store.night), or Chapter Three's paper-coloured world is up.
  const sheet = !night || label.endsWith('Also showing') // a paper page in the DOM (the lobby is a paper sheet over a live stage)
  const paper = sheet || label.startsWith('Chapter Three')
  const PILL = `rounded-sm px-2 whitespace-nowrap backdrop-blur-sm transition-[background-color,color,box-shadow] duration-200 md:px-3 ${paper ? CREAM : DARK}` // px-2 on phones: the four pills fit 390 px on one line
  const TAP = `inline-flex items-center min-h-11 ${PILL}` // 44 px tap target

  useEffect(() => {
    const fn = (key, value) => (key === 'chapterLabel' ? setLabel(value) : key === 'night' ? setNight(value) : key === 'bright' && setBright(!!value))
    store.listeners.add(fn)
    let raf, land = true
    const tick = () => {
      if (land !== store.prologue < 0.09) setLanding((land = !land)) // once the poster has wiped out (Prologue.jsx BEATS[0])
      const max = document.documentElement.scrollHeight - innerHeight
      const n = 1 + Math.round((scrollY / Math.max(1, max)) * 95)
      if (page.current && page.current.dataset.n !== String(n)) {
        page.current.dataset.n = n
        page.current.textContent = `p. ${String(n).padStart(2, '0')} / 96`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // The folio steps aside for the colophon, so it never sits on its text.
    const io = new IntersectionObserver(([e]) => page.current?.classList.toggle('invisible', e.isIntersecting))
    const colophon = document.querySelector('footer[aria-label="Colophon"]')
    if (colophon) io.observe(colophon)
    return () => {
      io.disconnect()
      store.listeners.delete(fn)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {/* Over the night worlds, the screen's lit top rail fades out under the header band. Not over a bright frame: there it reads as a smear. */}
      <div aria-hidden="true" className={`pointer-events-none fixed inset-x-0 top-0 z-[49] h-[104px] bg-gradient-to-b from-[rgb(3_5_11/0.9)] via-[rgb(3_5_11/0.55)] to-transparent transition-opacity duration-200 md:h-[120px] ${paper || landing || bright ? 'opacity-0' : 'opacity-100'}`} />
      {/* On a paper page, its text fades into paper before it reaches the pills, so nothing reads half-hidden between them. */}
      <div aria-hidden="true" className={`pointer-events-none fixed inset-x-0 top-0 z-[49] h-[88px] bg-gradient-to-b from-paper from-65% to-transparent transition-opacity duration-200 min-[380px]:h-[104px] md:h-[120px] ${sheet && !landing ? 'opacity-100' : 'opacity-0'}`} />
      <header className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between p-3 transition-[opacity,visibility] duration-300 min-[380px]:p-5 md:p-7 ${OFF}`}>
        <a href="#prologue" className={`kicker pointer-events-auto ${TAP}`}>Tejas Govind</a>
        <p className={`kicker hidden min-h-11 items-center md:inline-flex ${PILL}`}>{label}</p>
        {/* Under 380px the four 12px pills need the tighter gutter and gap to fit. */}
        <div className="flex items-start gap-1 min-[380px]:gap-2 md:gap-3">
          <button type="button" aria-pressed={audible} aria-label="Sound" onClick={() => sound.toggle()} className={`kicker pointer-events-auto min-w-11 justify-center gap-2 underline-offset-4 hover:underline ${TAP}`}>
            <SoundIcon on={audible} />
            {/* On a phone the icon alone says it. */}
            <span className="hidden md:inline" aria-hidden="true">Sound {audible ? 'on' : 'off'}</span>
          </button>
          {/* Desktop only: a phone's header has room for four pills, and its Contents carries the résumé. */}
          <a href={RESUME} target="_blank" rel="noreferrer" className={`kicker pointer-events-auto hidden min-h-11 items-center underline-offset-4 hover:underline lg:inline-flex ${PILL}`}>
            Résumé
          </a>
          <a href={`mailto:${CONTACT.email}`} className={`kicker pointer-events-auto underline-offset-4 hover:underline ${TAP}`}>
            Email
          </a>
          <button type="button" data-contents onClick={() => dialog.current?.showModal()} className={`kicker pointer-events-auto underline-offset-4 hover:underline ${TAP}`}>
            Contents
          </button>
        </div>
      </header>
      <p ref={page} className={`kicker pointer-events-none fixed right-5 bottom-5 z-50 py-1 tabular-nums md:right-7 md:bottom-7 ${PILL} ${landing ? 'opacity-0' : ''}`} aria-hidden="true">
        p. 01 / 96
      </p>

      <dialog
        ref={dialog}
        aria-label="Contents"
        onClick={e => e.target === dialog.current && dialog.current.close()}
        className="paper m-auto w-[min(34rem,calc(100vw-2rem))] p-0 shadow-[0_30px_80px_rgb(0_0_0/0.45)] backdrop:bg-black/50"
      >
        <div className="p-8 md:p-10">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-3xl tracking-[-0.01em]">Contents</p>
            <button type="button" autoFocus onClick={() => dialog.current?.close()} className="kicker inline-flex min-h-11 items-center px-2 underline-offset-4 hover:underline">
              Close
            </button>
          </div>
          <ol className="mt-8 space-y-1">
            {CONTENTS.map(c => (
              <li key={c.id}>
                {/* Under 480px the subtitle stacks under the title instead of squeezing the leader to a stub. */}
                <button type="button" onClick={() => (c.id === 'five' ? goTo({ chapter: 'five' }) : goToId(c.id))} className="group flex w-full flex-wrap items-baseline gap-x-4 py-2 text-left min-[480px]:flex-nowrap">
                  <span className="kicker w-8 opacity-60">{c.n}</span>
                  <span className="font-display text-xl whitespace-nowrap group-hover:text-stamp">{c.title}</span>
                  <span className="mx-2 hidden flex-1 border-b border-dotted border-ink/30 min-[480px]:block" aria-hidden="true" />
                  <span className="block basis-full pl-12 font-serif text-sm opacity-70 min-[480px]:basis-auto min-[480px]:pl-0">{c.sub}</span>
                </button>
                {(c.id === 'two' || c.id === 'three') && (
                  <ul className="mb-2 ml-12">
                    {(c.id === 'two' ? FILMS_TOC : ROLES_TOC).map(t => (
                      <li key={t.key}>
                        <button type="button" onClick={() => goTo(t)} className="flex min-h-11 w-full items-center text-left font-serif text-[15px] leading-snug underline-offset-4 hover:underline">
                          {t.label}
                        </button>
                      </li>
                    ))}
                    {c.id === 'two' && LOBBY_TOC.map(([name, items]) => (
                      <li key={name} className="flex flex-wrap items-center gap-x-3 font-serif text-[15px] leading-snug">
                        <span className="basis-full pt-2 opacity-60">{name}</span>
                        {items.map(t => (
                          <button key={t.id} type="button" onClick={() => goToId(t.id)} className="inline-flex min-h-11 items-center text-left underline underline-offset-4 hover:opacity-70">
                            {t.label}
                          </button>
                        ))}
                      </li>
                    ))}
                    {c.id === 'two' && (
                      <li className="flex min-h-11 flex-wrap items-center gap-x-3 font-serif text-[15px] leading-snug">
                        {/* Under 480px the label takes its own line, so the two links never split across rows. */}
                        <span className="basis-full pt-2 opacity-60 min-[480px]:basis-auto min-[480px]:pt-0">Also built</span>
                        {ALSO_BUILT.map(p => (
                          <a key={p.title} href={p.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:opacity-70">
                            {p.title} ↗
                          </a>
                        ))}
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-8 border-t border-ink/15 pt-5">
            <p className="kicker opacity-60">Write to me</p>
            <a href={`mailto:${CONTACT.email}`} className="mt-3 flex min-h-11 w-full items-center justify-center border border-ink/30 px-4 py-2 font-display text-lg break-all hover:bg-ink min-[480px]:text-2xl hover:text-paper">
              {CONTACT.email}
            </a>
            <ul className="kicker mt-2 flex flex-wrap gap-x-4">
              {CONTACT.links.map(l => (
                <li key={l.label}>
                  <a href={l.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                    {l.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 border-t border-ink/15 pt-5 font-serif opacity-80">
            Also available: <a href="/os/" className="underline underline-offset-4 hover:opacity-70">the 2023 edition, as a desktop OS →</a>
          </p>
        </div>
      </dialog>
    </>
  )
}
