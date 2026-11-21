import { useEffect, useRef, useState } from 'react'
import { useBeats } from '../lib/Beats'
import { useProgress, useRunningHead } from '../lib/chapters'
import { sound } from '../lib/sound'
import { startTrail } from '../hero/trail'
import { CONTACT, JOURNEY, RESUME, ROLES } from '../content'
import { goTo, SoundIcon } from '../Book'

/*
 * Prologue: the projection booth. The camera leaves the projector, flies out through the window down
 * the beam, turns back over the seats, then rises into the lamp until it floods the frame and breaks
 * into the paper of Chapter One (stage/Takeover.jsx). Camera timing lives in cinema/timeline.js.
 *
 * Its first frame is the landing page, laid out as a film one-sheet over the live booth: the name as the
 * title, a billing block to the title's measure, five actions, and the pointer's trail (hero/trail.js).
 * Styles: index.css, "the one-sheet". Book.jsx keeps its own chrome off this frame.
 */
const BEATS = [
  { at: [-0.1, 0.1], kind: 'title' },
  { at: [0.13, 0.4], text: 'From Prayagraj to New York, by way of Buffalo.' }, // facts only (collage.js home, JOURNEY); Tejas's own lines replace these
  { at: [0.48, 0.76], text: 'Roll the flashback.' },
]

// The billing block, from the same data Chapter Three uses, newest job first: a recruiter needn't scroll for it.
const CREDITS = [
  ...ROLES.filter(r => ['Daiwa Capital Markets America', 'COA'].includes(r.org)).map(r => ({ role: r.role, name: r.org })),
  { role: 'Computer Science, class of 2027', name: 'University at Buffalo' },
]

export default function Prologue() {
  const ref = useRef(null)
  useProgress(ref, 'prologue')
  useRunningHead(ref, 'Prologue · Lights down', { end: 'bottom 143%' }) // = Chapter One's top at 75% (--one-overlap 68svh): its paper has the screen
  const bind = useBeats('prologue', BEATS)
  const phone = matchMedia('(max-width: 760px)').matches // read once: the camera is progress-driven, so only the length changes
  const hero = useRef(null)
  const fx = useRef(null)
  useEffect(() => startTrail(hero.current, fx.current), [])
  const [audible, setAudible] = useState(sound.on)
  useEffect(() => sound.subscribe(setAudible), [])

  return (
    <section ref={ref} id="prologue" aria-label="Prologue" className="relative" style={{ height: phone ? '320svh' : '380svh' }}>
      <div className="sticky top-0 h-svh">
        {/* The one-sheet. Visible from the first paint (no wait for WebGL); it wipes out with the first scroll. */}
        <div ref={el => bind(0)((hero.current = el))} className="hero opacity-0">
          <div className="hero-scrim" aria-hidden="true" />
          <canvas ref={fx} className="hero-fx" aria-hidden="true" />
          <p className="hero-kicker kicker" data-quiet>
            <span className="hero-lamp" aria-hidden="true" />
            Now showing
          </p>
          <nav className="hero-nav kicker" aria-label="Primary">
            <div className="hero-actions" data-quiet>
              {/* Straight to the work and the newest job (Daiwa), for whoever hasn't time for the film. */}
              <button type="button" onClick={() => goTo({ chapter: 'two', i: 0 })}>Work <span aria-hidden="true">↓</span></button>
              <button type="button" onClick={() => goTo({ chapter: 'three', k: JOURNEY.length - 1 })}>Experience <span aria-hidden="true">↓</span></button>
              <a href={RESUME} target="_blank" rel="noreferrer">Résumé <span aria-hidden="true">↗</span></a>
              <a href={`mailto:${CONTACT.email}`}>Email <span aria-hidden="true">↗</span></a>
            </div>
            <div className="hero-tools" data-quiet>
              {/* Book.jsx owns the dialog; its header button opens it. */}
              <button type="button" onClick={() => document.querySelector('[data-contents]')?.click()}>Contents</button>
              <button type="button" aria-pressed={audible} aria-label="Sound" onClick={() => sound.toggle()}>
                <SoundIcon on={audible} />
              </button>
            </div>
          </nav>
          <div className="hero-sheet" data-quiet>
            <h1 className="hero-title display-title" aria-label="Tejas Govind">
              <span aria-hidden="true">
                {[...'Tejas'].map((ch, k) => (
                  <span key={k} data-ink="light">{ch}</span>
                ))}
              </span>{' '}
              <span className="title-heavy" aria-hidden="true">
                {[...'Govind'].map((ch, k) => (
                  <span key={k} data-ink>{ch}</span>
                ))}
              </span>
            </h1>
            <ul className="hero-billing">
              {CREDITS.map(c => (
                <li key={c.name}>
                  <span className="role">{c.role}</span> <span className="name">{c.name}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="hero-cue kicker" aria-hidden="true" data-quiet>Scroll</p>
        </div>
        <div className="pointer-events-none absolute inset-0 grid px-6 md:px-[6vw]">
          {BEATS.map((b, i) =>
            b.kind ? null : (
              <div key={i} ref={bind(i)} className="col-start-1 row-start-1 flex w-full opacity-0">
                <p className="max-w-[20ch] self-end [text-wrap:balance] pb-[14svh] font-display text-[clamp(1.8rem,3.3vw,3.1rem)] leading-[1.06] tracking-[-0.015em] [text-shadow:0_4px_50px_rgb(3_5_11/0.95)]">
                  {b.text}
                </p>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
