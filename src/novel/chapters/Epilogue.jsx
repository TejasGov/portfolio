import { useLayoutEffect, useRef } from 'react'
import { gsap } from '../lib/scroll'
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
const BEATS = [
  { at: [0.03, 0.24], kind: 'line' },
  { at: [0.32, 1.6], kind: 'contact' }, // after the lamp dip (timeline.js), as the screen turns to the address
]
const ext = { target: '_blank', rel: 'noreferrer' }

export default function Epilogue() {
  const ref = useRef(null)
  const whole = useRef(null) // the section and the colophon: the running head holds to the last line
  useProgress(ref, 'epilogue')
  useProgress(ref, 'epiIn', { start: 'top bottom', end: 'top top' })
  useRunningHead(whole, 'Epilogue · House lights', { start: 'top bottom' })
  const bind = useBeats('epilogue', BEATS)
  const stage = useRef(null)
  const colophon = useRef(null)
  // As the colophon rises, the contact card goes, so it never slides up under the header.
  useLayoutEffect(() => {
    const t = gsap.to(stage.current, { opacity: 0, ease: 'none', scrollTrigger: { trigger: colophon.current, start: 'top bottom', end: 'top 70%', scrub: true } })
    return () => { t.scrollTrigger?.kill(); t.kill() }
  }, [])

  return (
    <div ref={whole}>
      <section ref={ref} id="epilogue" aria-labelledby="epilogue-title" className="relative" style={{ height: '170svh' }}>
        <div className="sticky top-0 h-svh">
          <div ref={stage} className="absolute inset-0 grid px-6 md:px-[6vw]">
            {/* Bottom-left, over the seats: the screen above is still showing "The End". */}
            <div ref={bind(0)} className="pointer-events-none col-start-1 row-start-1 self-end pb-[11svh] opacity-0">
              <p className="max-w-[18ch] font-display text-[clamp(2rem,3.6vw,3.4rem)] leading-[1] italic [text-shadow:0_4px_50px_rgb(3_5_11/0.95)]">
                House lights up.
              </p>
            </div>
            {/* Centred under the screen, low enough to leave the address on it clear; mb clears the phone's folio pill. */}
            <div ref={bind(1)} className="beat-sharp col-start-1 row-start-1 mb-[52px] max-w-[40rem] self-end justify-self-center rounded-sm bg-[rgb(3_5_11/0.82)] p-5 text-center opacity-0 shadow-[0_30px_80px_rgb(0_0_0/0.5)] md:mb-[5svh] md:p-7">
              <p className="kicker text-glow/80">Epilogue</p>
              <Assemble as="h2" id="epilogue-title" parts={TITLE} className="mt-4 block font-display text-[clamp(2.2rem,4.5vw,3.6rem)] leading-[0.9] tracking-[-0.02em]" />
              <a
                href={`mailto:${CONTACT.email}`}
                className="mt-5 inline-block border-b border-night-ink/40 pb-1 font-serif text-[clamp(1.2rem,5vw,1.9rem)] break-all transition-colors hover:border-glow hover:text-glow"
              >
                {CONTACT.email}
              </a>
              <div className="mt-5">
                <a href={`mailto:${CONTACT.email}`} className="inline-flex min-h-11 items-center bg-glow px-6 font-mono text-[13px] tracking-[0.18em] text-night uppercase hover:opacity-90">
                  Email me
                </a>
              </div>
              <ul className="kicker mt-4 flex flex-wrap justify-center gap-x-7 text-[15px] text-night-ink/90">
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

      <footer ref={colophon} className="relative z-10 bg-night px-6 pt-[14svh] pb-[16svh] md:px-[6vw]" aria-label="Colophon">
        <div className="mx-auto max-w-5xl border-t border-night-ink/15 pt-10">
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
