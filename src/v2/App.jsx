import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { hasWebGL } from '@/v2/lib/webgl'
import { chapters } from '@/v2/data/chapters'
import { setScrollLocked, startSmoothScroll } from '@/v2/lib/scroll'
import Chrome from '@/v2/components/Chrome'
import Chapter from '@/v2/components/Chapter'
import Gate from '@/v2/components/Gate'

const Stage = lazy(() => import('@/v2/three/Stage'))

/** The chapter crossing the middle of the viewport is "active": it sets the colour field, tone and nav state. */
function useActiveChapter() {
  const [active, setActive] = useState(chapters[0].id)
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-50% 0px -50% 0px' },
    )
    chapters.forEach(c => {
      const el = document.getElementById(c.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])
  return active
}

/** Show the gate once per session, and never in front of a deep link (#training etc.). */
function needsGate() {
  if (location.hash) return false
  try {
    return sessionStorage.getItem('tg-entered') !== '1'
  } catch {
    return true
  }
}

export default function App() {
  const active = useActiveChapter()
  const current = chapters.find(c => c.id === active)
  const [gated, setGated] = useState(needsGate)
  const [seen, setSeen] = useState(() => new Set())

  useEffect(startSmoothScroll, [])
  useEffect(() => {
    setScrollLocked(gated)
  }, [gated])
  useEffect(() => {
    document.documentElement.dataset.tone = current.tone ?? 'light'
  }, [current])
  // Each act's headline plays its reveal the first time it becomes active (after the gate lifts).
  useEffect(() => {
    if (!gated) setSeen(s => (s.has(active) ? s : new Set(s).add(active)))
  }, [active, gated])

  const enter = () => {
    try {
      sessionStorage.setItem('tg-entered', '1')
    } catch {
      /* private mode: the gate will simply show again next visit */
    }
    setGated(false)
  }
  // Once the gate has unmounted (and inert is gone), land keyboard users at the top of the story.
  const wasGated = useRef(gated)
  useEffect(() => {
    if (wasGated.current && !gated) document.getElementById('boot')?.focus({ preventScroll: true })
    wasGated.current = gated
  }, [gated])

  return (
    // timeline-scope lets the fixed act bars read each section's view-timeline.
    <div style={{ timelineScope: chapters.map(c => `--ch-${c.id}`).join(', ') }}>
      {gated && <Gate onEnter={enter} />}
      <div className="colour-field" style={{ background: current.field }} aria-hidden="true" />
      {hasWebGL && (
        <Suspense fallback={null}>
          <Stage />
        </Suspense>
      )}
      <div className="paper-grain" aria-hidden="true" />
      {/* inert while gated: the gate is modal, so nothing behind it can take focus. */}
      <div inert={gated ? '' : undefined}>
        <a href="#hero" className="caption sr-only z-50 rounded-full bg-paper px-4 py-2 focus:not-sr-only focus:fixed focus:top-4 focus:left-4">
          Skip intro
        </a>
        <Chrome active={active} />
        <main className="relative z-10">
          {chapters.map(c => (
            <Chapter key={c.id} chapter={c} shown={seen.has(c.id)} />
          ))}
        </main>
      </div>
    </div>
  )
}
