import { lazy, Suspense, useEffect, useState } from 'react'
import { hasWebGL } from '@/v2/lib/webgl'

const Stage = lazy(() => import('@/v2/three/Stage'))
import { chapters } from '@/v2/data/chapters'
import { startSmoothScroll } from '@/v2/lib/scroll'
import Chrome from '@/v2/components/Chrome'
import Chapter from '@/v2/components/Chapter'

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

export default function App() {
  const active = useActiveChapter()
  const current = chapters.find(c => c.id === active)

  useEffect(startSmoothScroll, [])
  useEffect(() => {
    document.documentElement.dataset.tone = current.tone ?? 'light'
  }, [current])

  return (
    // timeline-scope lets the fixed act bars read each section's view-timeline.
    <div style={{ timelineScope: chapters.map(c => `--ch-${c.id}`).join(', ') }}>
      <a href="#hero" className="caption sr-only z-50 rounded-full bg-paper px-4 py-2 focus:not-sr-only focus:fixed focus:top-4 focus:left-4">
        Skip intro
      </a>
      <div className="colour-field" style={{ background: current.field }} aria-hidden="true" />
      {hasWebGL && (
        <Suspense fallback={null}>
          <Stage />
        </Suspense>
      )}
      <div className="paper-grain" aria-hidden="true" />
      <Chrome active={active} />
      <main className="relative z-10">
        {chapters.map(c => (
          <Chapter key={c.id} chapter={c} />
        ))}
      </main>
    </div>
  )
}
