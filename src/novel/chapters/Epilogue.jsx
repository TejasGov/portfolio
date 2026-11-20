import { useEffect, useLayoutEffect, useRef } from 'react'
import { ScrollTrigger } from '../lib/scroll'
import { store } from '../lib/store'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { CONTACT } from '../content'
import credits from '../credits.json'
import Assemble from '../lib/Assemble'

const TITLE = [['Write to ', false], ['me.', true]]

/*
 * Epilogue: the projector dims and the house lights come up over the hall (a second Blender bake,
 * crossfaded in cinema/world.js). Contact details, then the colophon with every credit.
 */
// On one progress, epiIn (0..1) then 1 + epilogue (1..2): the card comes up during the arrival, just after
// the screen lights "The End" (timeline.js), and holds until the colophon covers it.
const BEATS = [{ at: [0.4, 2.6], edge: [0.03, 0.03], kind: 'contact' }]
const epiAll = () => store.set('epiAll', store.epilogue > 0 ? 1 + store.epilogue : store.epiIn)
const ext = { target: '_blank', rel: 'noreferrer' }

export default function Epilogue() {
  const ref = useRef(null)
  const whole = useRef(null) // the section and the colophon: the running head holds to the last line
  useProgress(ref, 'epilogue')
  useProgress(ref, 'epiIn', { start: 'top bottom', end: 'top top' })
  useRunningHead(whole, 'Epilogue · House lights', { start: 'top bottom' })
  useEffect(() => {
    epiAll()
    const on = key => (key === 'epilogue' || key === 'epiIn') && epiAll()
    store.listeners.add(on)
    return () => store.listeners.delete(on)
  }, [])
  const bind = useBeats('epiAll', BEATS)
  const stage = useRef(null)
  const colophon = useRef(null)
  // As the colophon rises, the card wipes away from its lower edge, a little ahead of the colophon covering
  // it: its button goes first, its address last, as the colophon's own contact row comes into view, so
  // there is always one way to write on screen and never two buttons. A wipe, not a fade: a half-clear
  // card would show the screen's title through it.
  const card = useRef(null)
  useLayoutEffect(() => {
    const st = ScrollTrigger.create({
      trigger: colophon.current,
      start: 'top bottom',
      end: 'top 88%',
      onUpdate: self => {
        const cut = self.progress * (stage.current.offsetHeight - card.current.offsetTop)
        stage.current.style.clipPath = cut ? `inset(-100px -100px ${cut.toFixed(1)}px -100px)` : ''
      },
    })
    return () => st.kill()
  }, [])

  return (
    <div ref={whole}>
      <section ref={ref} id="epilogue" aria-labelledby="epilogue-title" className="relative" style={{ height: '130svh' }}>
        {/* Fixed, not sticky: the card stays put from the arrival on; the colophon (z-10, opaque) rises over it. */}
        <div ref={stage} className="pointer-events-none fixed inset-0 z-[5] grid px-6 md:px-[6vw]">
          {/* Under the screen, clear of its lower frame (compact on a phone, where the frame sits low); mb clears the folio pill. */}
          <div ref={el => { bind(0)(el); card.current = el }} className="beat-sharp pointer-events-auto col-start-1 row-start-1 mb-[52px] max-w-[40rem] self-end justify-self-center rounded-sm bg-[rgb(10_12_18)] p-4 text-center opacity-0 shadow-[0_30px_80px_rgb(0_0_0/0.5)] md:mb-[3svh] md:max-w-[46rem] md:p-6">
            <p className="kicker hidden text-glow/80 md:block">Epilogue</p>
            <Assemble as="h2" id="epilogue-title" parts={TITLE} className="block font-display text-[clamp(1.9rem,4.5vw,3.6rem)] leading-[0.9] tracking-[-0.02em] md:mt-2" />
            <a
              href={`mailto:${CONTACT.email}`}
              className="mt-2 inline-block border-b border-night-ink/40 pb-1 font-serif text-[clamp(1.2rem,5vw,1.9rem)] break-all transition-colors hover:border-glow hover:text-glow md:text-[1.7rem] md:leading-tight"
            >
              {CONTACT.email}
            </a>
            {/* On desktop the button and links share a row, so the card stays clear of the screen's lower frame. */}
            <div className="mt-3 flex flex-col items-center md:flex-row md:flex-wrap md:justify-center md:gap-x-6">
              <a href={`mailto:${CONTACT.email}`} className="inline-flex min-h-11 items-center bg-glow px-6 font-mono text-[13px] tracking-[0.18em] text-night uppercase hover:opacity-90">
                Email me
              </a>
              <ul className="kicker mt-1 flex flex-wrap justify-center gap-x-6 text-[15px] text-night-ink/90 md:mt-0 md:gap-x-6">
                {CONTACT.links.map(l => (
                  <li key={l.label}>
                    <a href={l.href} {...ext} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-night-ink hover:underline">
                      {l.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer ref={colophon} className="relative z-10 bg-night px-6 pt-[6svh] pb-[16svh] md:px-[6vw]" aria-label="Colophon">
        {/* High in the footer, so it is in full view before the card above goes, and held under the header to the last line. The address itself is the card's alone. */}
        <div className="sticky top-[72px] z-10 mx-auto flex max-w-5xl flex-wrap items-center gap-x-7 gap-y-2 bg-night py-2 md:top-[84px]">
          <a href={`mailto:${CONTACT.email}`} className="inline-flex min-h-11 items-center bg-glow px-6 font-mono text-[13px] tracking-[0.18em] text-night uppercase hover:opacity-90">
            Email me
          </a>
          <ul className="kicker flex flex-wrap gap-x-7 text-[15px] text-night-ink/90">
            {CONTACT.links.map(l => (
              <li key={l.label}>
                <a href={l.href} {...ext} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-night-ink hover:underline">
                  {l.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto mt-[8svh] max-w-5xl border-t border-night-ink/15 pt-10">
          <h2 className="font-display text-4xl italic">Colophon</h2>
          <p className="mt-4 max-w-[62ch] font-serif text-base leading-relaxed text-night-ink/65">
            Set in Instrument Serif, Newsreader, Geist Mono, Anton and Caveat. The cinema was modelled and light-baked in Blender, with
            surface textures from Poly Haven (CC0) and a carpet drawn for it; the projector, the recliners, the traveller (a stylised me) and
            the six little worlds of Chapter Three were generated with Meshy. The five films, the ink drawings and the waves between them, the
            beam, the haze and the dust are all drawn live in WebGL, and the projector you can hear is synthesized in the browser.
            Photographs in Chapter One come from Wikimedia Commons under the licences below; they were cut out, torn and taped for this book.
          </p>
          {/* The licences are owed, not the last thing to read: folded away under the colophon. */}
          <details className="mt-8">
            <summary className="kicker inline-flex min-h-11 cursor-pointer items-center text-night-ink/70">Image credits ({credits.length})</summary>
            <ul className="mt-4 grid gap-x-10 gap-y-2 font-mono text-[11px] leading-relaxed text-night-ink/50 md:grid-cols-2">
              {credits.map(c => (
                <li key={c.file}>
                  <a href={c.page} {...ext} className="underline-offset-2 hover:text-night-ink hover:underline">
                    {c.title}
                  </a>
                  {' — '}
                  {c.author}, {c.license} ({c.edit})
                </li>
              ))}
            </ul>
          </details>
          <p className="mt-6 font-serif text-base text-night-ink/65">
            Also: <a href="/os/" className="underline underline-offset-4 hover:text-night-ink">the 2023 edition, as a desktop OS →</a>
          </p>
          <p className="kicker mt-12 text-night-ink/40">© {new Date().getFullYear()} Tejas Govind · The end.</p>
        </div>
      </footer>
    </div>
  )
}
