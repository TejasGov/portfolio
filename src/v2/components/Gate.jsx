import { useEffect, useRef, useState } from 'react'
import PixelDisplaceField from '@/v2/components/pixel-perfect/pixel-displace-field'
import { hasWebGL } from '@/v2/lib/webgl'

const HOLD_MS = 1100
const RING = 2 * Math.PI * 46

// The same chunks the page lazy-loads; awaiting them here makes the percentage honest.
const loaders = hasWebGL ? [() => import('@/v2/three/Stage'), () => import('@/v2/three/SceneView')] : []

/**
 * Act 0: "hold to initialise". Pixel field over the boot colour, a ring that fills while held,
 * and a real preload of the 3D chunks behind it. Keyboard (Enter/Space) and reduced-motion users
 * enter with a single press instead of a hold.
 */
export default function Gate({ onEnter }) {
  const [done, setDone] = useState(() => loaders.map(() => false))
  const [hold, setHold] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const holding = useRef(false)
  const raf = useRef(0)
  const progress = useRef(0)
  const total = loaders.length

  useEffect(() => {
    // Mark by index, not by counting: StrictMode runs this effect twice in development.
    const mark = i => () => setDone(d => d.map((v, j) => v || j === i))
    loaders.forEach((load, i) => load().then(mark(i), mark(i)))
  }, [])

  const pct = total ? Math.round((done.filter(Boolean).length / total) * 100) : 100

  const enter = () => {
    if (leaving) return
    setLeaving(true)
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    setTimeout(onEnter, still ? 0 : 700)
  }

  // Fill while held, drain when released; entering only once the ring is full.
  const tick = last => now => {
    const dt = now - last
    progress.current = Math.min(1, Math.max(0, progress.current + (holding.current ? dt / HOLD_MS : -dt / (HOLD_MS / 2))))
    setHold(progress.current)
    if (progress.current >= 1) return enter()
    if (progress.current > 0 || holding.current) raf.current = requestAnimationFrame(tick(now))
  }
  const start = e => {
    if (e.button !== 0 || leaving) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId) // keep the hold even if the finger drifts off
    } catch {
      /* synthetic or already-released pointer */
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return enter()
    holding.current = true
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick(performance.now()))
  }
  const stop = () => {
    holding.current = false
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      className={`gate fixed inset-0 z-50 grid place-items-center bg-field-boot ${leaving ? 'is-leaving' : ''}`}
    >
      <PixelDisplaceField className="absolute inset-0" />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center text-ink">
        <p className="caption rounded-full bg-paper/90 px-3 py-1" aria-live="polite">
          [ loading weights {pct}% ]<span className="blink" aria-hidden="true">_</span>
        </p>

        {/* Not a heading: the page's h1 is the Boot chapter title underneath. */}
        <p id="gate-title" className="act-title text-[clamp(3rem,10vw,7rem)]">Tejas Govind</p>

        <button
          type="button"
          autoFocus
          onPointerDown={start}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
          // detail === 0 means keyboard activation: no hold required.
          onClick={e => e.detail === 0 && enter()}
          onContextMenu={e => e.preventDefault()}
          className="group relative grid size-32 touch-none place-items-center rounded-full select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - hold)}
            />
          </svg>
          <span className="caption relative leading-snug">
            hold to
            <br />
            initialise
          </span>
        </button>

        <p className="caption rounded-full bg-paper/90 px-3 py-1 pointer-coarse:hidden">or press Enter</p>
      </div>
    </div>
  )
}
