import { useRef } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { CONTACT } from '../content'
import credits from '../credits.json'

/*
 * Epilogue: the last project's pixels fold back into the orb (stage/timeline.js), and the book
 * closes on contact details, then the colophon with every image credit.
 */
const BEATS = [
  { at: [0.05, 0.42], kind: 'line' },
  { at: [0.5, 1.6], kind: 'contact' },
]
const ext = { target: '_blank', rel: 'noreferrer' }

export default function Epilogue() {
  const ref = useRef(null)
  useProgress(ref, 'epilogue')
  useRunningHead(ref, 'Epilogue · Write to me')
  const bind = useBeats('epilogue', BEATS)

  return (
    <>
      <section ref={ref} id="epilogue" aria-labelledby="epilogue-title" className="relative" style={{ height: '320svh' }}>
        <div className="sticky top-0 h-svh">
          <div className="absolute inset-0 grid px-6 md:px-[6vw]">
            <div ref={bind(0)} className="pointer-events-none col-start-1 row-start-1 self-center opacity-0">
              <p className="max-w-[16ch] font-display text-[clamp(2.4rem,5vw,4.6rem)] leading-[1] italic [text-shadow:0_4px_50px_rgb(3_5_11/0.95)]">
                Everything goes back into the noise, eventually. That’s where the next thing starts.
              </p>
            </div>
            <div ref={bind(1)} className="col-start-1 row-start-1 self-end pb-[11svh] opacity-0">
              <p className="kicker text-glow/80">Epilogue</p>
              <h2 id="epilogue-title" className="mt-5 font-display text-[clamp(3.6rem,9vw,8rem)] leading-[0.86] tracking-[-0.02em]">
                Write to <em>me.</em>
              </h2>
              <a
                href={`mailto:${CONTACT.email}`}
                className="mt-8 inline-block border-b border-night-ink/40 pb-1 font-serif text-[clamp(1.2rem,2vw,1.6rem)] transition-colors hover:border-glow hover:text-glow"
              >
                {CONTACT.email}
              </a>
              <ul className="kicker mt-8 flex flex-wrap gap-x-7 gap-y-3 text-night-ink/70">
                {CONTACT.links.map(l => (
                  <li key={l.label}>
                    <a href={l.href} {...ext} className="underline-offset-4 hover:text-night-ink hover:underline">
                      {l.label} ↗
                    </a>
                  </li>
                ))}
                <li>
                  <a href="/os/" className="underline-offset-4 hover:text-night-ink hover:underline">
                    The 2023 site →
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 bg-night px-6 pt-[14svh] pb-[16svh] md:px-[6vw]" aria-label="Colophon">
        <div className="mx-auto max-w-5xl border-t border-night-ink/15 pt-10">
          <h2 className="font-display text-4xl italic">Colophon</h2>
          <p className="mt-4 max-w-[62ch] font-serif text-base leading-relaxed text-night-ink/65">
            Set in Instrument Serif, Newsreader, Geist Mono, Anton and Caveat. The orb and the holograms are drawn live in WebGL, about ninety
            thousand pixels at a time. Photographs in Chapter One come from Wikimedia Commons under the licences below; they were cut out, torn and
            taped for this book.
          </p>
          <ul className="mt-8 grid gap-x-10 gap-y-2 font-mono text-[11px] leading-relaxed text-night-ink/50 md:grid-cols-2">
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
          <p className="kicker mt-12 text-night-ink/40">© {new Date().getFullYear()} Tejas Govind · The end.</p>
        </div>
      </footer>
    </>
  )
}
