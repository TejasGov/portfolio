import { useEffect, useRef, useState } from 'react'
import { store } from './lib/store'
import { sound } from './lib/sound'

export const CONTENTS = [
  { id: 'prologue', n: '—', title: 'Prologue', sub: 'Lights down' },
  { id: 'one', n: 'I', title: 'About me', sub: 'Who I am, where I’m from' },
  { id: 'two', n: 'II', title: 'Now Showing', sub: 'Five projects' },
  { id: 'three', n: 'III', title: 'Places I Worked', sub: 'Prayagraj to New York' },
  { id: 'four', n: 'IV', title: 'Press Start', sub: 'An ode to games' },
  { id: 'epilogue', n: '—', title: 'Epilogue', sub: 'House lights' },
]

/**
 * The book's chrome: a running head (name · current chapter · contents) and a page counter.
 * mix-blend-mode: difference keeps it legible on both night and paper without swapping colours.
 */
export default function Book() {
  const [label, setLabel] = useState('Prologue · Lights down')
  const [audible, setAudible] = useState(sound.on)
  useEffect(() => sound.subscribe(setAudible), [])
  const page = useRef(null)
  const dialog = useRef(null)

  useEffect(() => {
    const fn = (key, value) => key === 'chapterLabel' && setLabel(value)
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

  const go = id => {
    dialog.current?.close()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between p-5 text-white mix-blend-difference md:p-7">
        <a href="#prologue" className="kicker pointer-events-auto">Tejas Govind</a>
        <p className="kicker hidden opacity-70 md:block">{label}</p>
        <div className="flex items-start gap-6">
          <button type="button" aria-pressed={audible} onClick={() => sound.toggle()} className="kicker pointer-events-auto flex items-center gap-2 underline-offset-4 hover:underline">
            <span className={`sound-bars${audible ? ' is-on' : ''}`} aria-hidden="true"><i /><i /><i /></span>
            Sound<span aria-hidden="true">{audible ? ' on' : ' off'}</span>
          </button>
          <button type="button" onClick={() => dialog.current?.showModal()} className="kicker pointer-events-auto underline-offset-4 hover:underline">
            Contents
          </button>
        </div>
      </header>
      <p ref={page} className="kicker pointer-events-none fixed right-5 bottom-5 z-50 text-white tabular-nums opacity-70 mix-blend-difference md:right-7 md:bottom-7" aria-hidden="true">
        p. 01 / 96
      </p>
      {/* The other edition, in the corner opposite the page number: there if you look, never in the way. */}
      <a href="/os/" aria-label="The OS edition: this portfolio as a desktop, from 2023" className="kicker fixed bottom-5 left-5 z-50 text-white opacity-50 mix-blend-difference transition-opacity hover:opacity-100 focus-visible:opacity-100 md:bottom-7 md:left-7">
        OS edition →
      </a>

      <dialog
        ref={dialog}
        aria-label="Contents"
        onClick={e => e.target === dialog.current && dialog.current.close()}
        className="paper m-auto w-[min(34rem,calc(100vw-2rem))] p-0 shadow-[0_30px_80px_rgb(0_0_0/0.45)] backdrop:bg-black/50"
      >
        <div className="p-8 md:p-10">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-4xl italic">Contents</p>
            <button type="button" autoFocus onClick={() => dialog.current?.close()} className="kicker underline-offset-4 hover:underline">
              Close
            </button>
          </div>
          <ol className="mt-8 space-y-1">
            {CONTENTS.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => go(c.id)} className="group flex w-full items-baseline gap-4 py-2 text-left">
                  <span className="kicker w-8 opacity-60">{c.n}</span>
                  <span className="font-display text-2xl group-hover:italic">{c.title}</span>
                  <span className="mx-2 flex-1 border-b border-dotted border-ink/30" aria-hidden="true" />
                  <span className="font-serif text-sm italic opacity-70">{c.sub}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-8 border-t border-ink/15 pt-5 font-serif italic opacity-80">
            Also available: <a href="/os/" className="underline underline-offset-4 hover:opacity-70">the 2023 edition, as a desktop OS →</a>
          </p>
        </div>
      </dialog>
    </>
  )
}
