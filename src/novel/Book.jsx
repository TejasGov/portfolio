import { useEffect, useRef, useState } from 'react'
import { store } from './lib/store'
import { sound } from './lib/sound'
import { CONTACT, JOURNEY, PROJECTS } from './content'

export const CONTENTS = [
  { id: 'prologue', n: '—', title: 'Prologue', sub: 'Lights down' },
  { id: 'one', n: 'I', title: 'About me', sub: 'Who I am, where I’m from' },
  { id: 'two', n: 'II', title: 'Now Showing', sub: 'Five projects' },
  { id: 'three', n: 'III', title: 'Places I Worked', sub: 'Prayagraj to New York' },
  { id: 'four', n: 'IV', title: 'Press Start', sub: 'An ode to games' },
  { id: 'epilogue', n: '—', title: 'Epilogue', sub: 'House lights' },
]

// Deep links for the Contents: every film, and every role newest first (Daiwa first).
const FILMS_TOC = PROJECTS.map((p, i) => ({ key: p.id, label: p.title, chapter: 'two', i }))
const ROLES_TOC = [...JOURNEY].reverse().flatMap((s, r) => [...s.roles].reverse().map(x => ({ key: `${x.org}·${x.role}`, label: `${x.role} · ${x.org} · ${x.period}`, chapter: 'three', k: JOURNEY.length - 1 - r })))

export function goToId(id) {
  document.querySelector('dialog[open]')?.close()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}
// The exact scroll where an item's card is opaque, from each chapter's progress range (lib/chapters useProgress).
export function goTo({ chapter, i, k }) {
  document.querySelector('dialog[open]')?.close()
  const el = document.getElementById(chapter)
  if (!el) return
  const h = el.offsetHeight, top = el.getBoundingClientRect().top + scrollY
  const y = chapter === 'two'
    ? top + (h - innerHeight) * (0.15 + (i + 0.5) * 0.14) // 'top top' → 'bottom bottom'; the middle of film i
    : top - innerHeight + h * ((k + 0.6) / JOURNEY.length) // 'top bottom' → 'bottom bottom'; inside every stop's opaque window, the last one's too
  scrollTo({ top: y, behavior: 'smooth' })
}

// Speaker, with two waves when the cinema is audible and an x when it is not.
const SoundIcon = ({ on }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 6.5h3l4-3.5v12l-4-3.5h-3z" />
    {on ? <path d="M12 6.5a3.5 3.5 0 0 1 0 5M14.2 4.3a6.6 6.6 0 0 1 0 9.4" /> : <path d="M12.2 6.8l4 4.4M16.2 6.8l-4 4.4" />}
  </svg>
)

/**
 * The book's chrome: a running head (name · current chapter · contents) and a page counter.
 * Every item sits on a small pill, like the corner readouts: blend modes went grey or vanished over the
 * bright worlds. Dark over the films (0.72 keeps white at 4.5:1), cream over paper, so it never fights the page.
 */
const DARK = 'bg-[rgb(10_10_14/0.72)] text-white'
const CREAM = 'bg-[rgb(239_232_218/0.88)] text-ink ring-1 ring-ink/15'
export default function Book() {
  const [label, setLabel] = useState('Prologue · Lights down')
  const [night, setNight] = useState(store.night)
  const [audible, setAudible] = useState(sound.on)
  useEffect(() => sound.subscribe(setAudible), [])
  const page = useRef(null)
  const dialog = useRef(null)
  // Paper: a paper chapter covers the screen (store.night), or Chapter Three's paper-coloured world is up.
  const PILL = `rounded-sm px-2 whitespace-nowrap backdrop-blur-sm md:px-3 ${!night || label.startsWith('Chapter Three') ? CREAM : DARK}` // px-2 on phones: the four pills fit 390 px on one line
  const TAP = `inline-flex items-center min-h-11 ${PILL}` // 44 px tap target

  useEffect(() => {
    const fn = (key, value) => (key === 'chapterLabel' ? setLabel(value) : key === 'night' && setNight(value))
    store.listeners.add(fn)
    let raf
    const tick = () => {
      const max = document.documentElement.scrollHeight - innerHeight
      const n = 1 + Math.round((scrollY / Math.max(1, max)) * 95)
      if (page.current && page.current.dataset.n !== String(n)) {
        page.current.dataset.n = n
        page.current.textContent = `p. ${String(n).padStart(2, '0')} / 96`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      store.listeners.delete(fn)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between p-5 md:p-7">
        <a href="#prologue" className={`kicker pointer-events-auto ${TAP}`}>Tejas Govind</a>
        <p className={`kicker hidden min-h-11 items-center md:inline-flex ${PILL}`}>{label}</p>
        <div className="flex items-start gap-2 md:gap-3">
          <button type="button" aria-pressed={audible} aria-label="Sound" onClick={() => sound.toggle()} className={`kicker pointer-events-auto min-w-11 justify-center gap-2 underline-offset-4 hover:underline ${TAP}`}>
            <SoundIcon on={audible} />
            {/* On a phone the icon alone says it. */}
            <span className="hidden md:inline" aria-hidden="true">Sound {audible ? 'on' : 'off'}</span>
          </button>
          <a href={`mailto:${CONTACT.email}`} className={`kicker pointer-events-auto underline-offset-4 hover:underline ${TAP}`}>
            Email
          </a>
          <button type="button" data-contents onClick={() => dialog.current?.showModal()} className={`kicker pointer-events-auto underline-offset-4 hover:underline ${TAP}`}>
            Contents
          </button>
        </div>
      </header>
      <p ref={page} className={`kicker pointer-events-none fixed right-5 bottom-5 z-50 py-1 tabular-nums md:right-7 md:bottom-7 ${PILL}`} aria-hidden="true">
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
            <p className="font-display text-4xl italic">Contents</p>
            <button type="button" autoFocus onClick={() => dialog.current?.close()} className="kicker inline-flex min-h-11 items-center px-2 underline-offset-4 hover:underline">
              Close
            </button>
          </div>
          <ol className="mt-8 space-y-1">
            {CONTENTS.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => goToId(c.id)} className="group flex w-full items-baseline gap-4 py-2 text-left">
                  <span className="kicker w-8 opacity-60">{c.n}</span>
                  <span className="font-display text-2xl group-hover:italic">{c.title}</span>
                  <span className="mx-2 flex-1 border-b border-dotted border-ink/30" aria-hidden="true" />
                  <span className="font-serif text-sm italic opacity-70">{c.sub}</span>
                </button>
                {(c.id === 'two' || c.id === 'three') && (
                  <ul className="mb-2 ml-12">
                    {(c.id === 'two' ? FILMS_TOC : ROLES_TOC).map(t => (
                      <li key={t.key}>
                        <button type="button" onClick={() => goTo(t)} className="flex min-h-11 w-full items-center text-left font-serif text-[15px] leading-snug hover:italic">
                          {t.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-8 border-t border-ink/15 pt-5">
            <p className="kicker opacity-60">Write to me</p>
            <a href={`mailto:${CONTACT.email}`} className="mt-3 flex min-h-11 w-full items-center justify-center border border-ink/30 px-4 py-2 font-display text-2xl break-all hover:bg-ink hover:text-paper">
              {CONTACT.email}
            </a>
            <ul className="kicker mt-2 flex flex-wrap gap-x-6">
              {CONTACT.links.map(l => (
                <li key={l.label}>
                  <a href={l.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                    {l.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 border-t border-ink/15 pt-5 font-serif italic opacity-80">
            Also available: <a href="/os/" className="underline underline-offset-4 hover:opacity-70">the 2023 edition, as a desktop OS →</a>
          </p>
        </div>
      </dialog>
    </>
  )
}
