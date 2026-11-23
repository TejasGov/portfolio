import { useEffect, useRef, useState } from 'react'
import { useProgress, usePaper } from '../lib/chapters'
import { sound } from '../lib/sound'
import { CONTACT, JOURNEY, RESUME, ROLES } from '../content'
import { goTo, SoundIcon } from '../Book'
import { openBoxOffice } from '../boxoffice/BoxOffice'
import './landing.css'

/*
 * The landing: the first thing on the page, before the Prologue. A stone circle under the Milky Way, the bust in
 * points over its pool, the name standing on the floor (the 3D: landing/scene.js, which runs once this has mounted).
 * It covers the screen for its whole length, so the cinema behind stops drawing meanwhile (usePaper), and the book's
 * own header waits until it has gone (Book.jsx, store.landing). Its last stretch fades to black into the booth.
 * Without WebGL (or if the scene fails) the name and the actions stand on their own over the dark.
 */
const DAIWA = ROLES.find(r => r.org === 'Daiwa Capital Markets America')
const COA = ROLES.find(r => r.org === 'COA')
const BILLING = [`${COA.role}, ${COA.org}`, 'Computer Science, class of 2027, University at Buffalo']

export default function Landing() {
  const ref = useRef(null)
  useProgress(ref, 'landing')
  usePaper(ref)
  const [audible, setAudible] = useState(sound.on)
  useEffect(() => sound.subscribe(setAudible), [])
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    import('./scene').then(m => m.done).catch(() => setFailed(true))
  }, [])

  return (
    <section ref={ref} id="landing" aria-label="Title" className={failed ? 'is-plain' : ''}>
      <div className="ld-stage">
        <canvas id="gl" aria-hidden="true" />
        <nav className="ld-nav kicker" aria-label="Primary">
          <span className="ld-now"><span className="ld-lamp" aria-hidden="true" />Now showing</span>
          <div className="ld-links">
            {/* Straight to the work and the newest job (Daiwa), for whoever hasn't time for the film. */}
            <button type="button" onClick={() => goTo({ chapter: 'two', i: 0 })}>Work ↓</button>
            <button type="button" onClick={() => goTo({ chapter: 'three', k: JOURNEY.length - 1 })}>Experience ↓</button>
            <a className="keep" href={RESUME} target="_blank" rel="noreferrer">Résumé ↗</a>
            <a className="keep" href={`mailto:${CONTACT.email}`}>Email ↗</a>
            <button type="button" aria-haspopup="dialog" onClick={openBoxOffice}>Box office</button>
            <button type="button" className="keep" aria-pressed={audible} aria-label="Sound" onClick={() => sound.toggle()}>
              <SoundIcon on={audible} />
            </button>
          </div>
        </nav>
        <div className="ld-sheet" id="sheet" style={{ opacity: 0 }}>
          <h1 className="sr-only">Tejas Govind</h1>
        </div>
        <p className="ld-bill kicker" id="foot-bill" style={{ opacity: failed ? 1 : 0 }}>
          <b>{DAIWA.role} · {DAIWA.org}</b>
          {BILLING.join('  ·  ')}
        </p>
        {failed && <p className="ld-plain-name" aria-hidden="true">Tejas <b>Govind</b></p>}
        <div className="ld-foot kicker" aria-hidden="true">
          <span />
          <span>Scroll to enter ↓</span>
        </div>
        {/* The threshold: hold to enter (it also goes in by itself after a few seconds; Space or Enter works too). */}
        <button className="ld-enter" id="enter" type="button">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle className="track" cx="32" cy="32" r="27" />
            <circle className="arc" cx="32" cy="32" r="27" pathLength="1" />
            <circle className="dot" cx="32" cy="32" r="2.4" />
          </svg>
          <span className="kicker">Hold to enter</span>
        </button>
        <div className="ld-veil" id="veil" />
        {/* The loader: the real load, counted, a trilithon in dots built from the ground up as it comes in. */}
        <div className={`ld-loader${failed ? ' done' : ''}`} id="loader" aria-hidden="true">
          <svg className="ld-glyph" viewBox="0 0 120 96">
            <defs>
              <clipPath id="ld-rise"><rect className="rise" x="0" y="0" width="120" height="96" /></clipPath>
            </defs>
            <g clipPath="url(#ld-rise)">
              <path d="M22 92V34h20v58M42 34l8-6v58l-8 6M22 34l8-6h20M78 92V34h20v58M98 34l8-6v58l-8 6M78 34l8-6h20M14 34V20h86v14H14M100 20l8-6v14l-8 6M14 20l8-6h86" />
            </g>
          </svg>
          <span className="ld-label kicker">Tejas Govind · Reel 1</span>
          <span className="ld-line"><i /></span>
          <span className="ld-pct" id="pct">0</span>
        </div>
      </div>
    </section>
  )
}
