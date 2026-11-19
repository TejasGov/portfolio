import { useRef } from 'react'
import PixelFringe from '../lib/PixelFringe'
import { usePaper, useRunningHead } from '../lib/chapters'

// Placeholder while the chapter is built.
export default function ChapterOne() {
  const ref = useRef(null)
  usePaper(ref)
  useRunningHead(ref, 'ChapterOne')
  return (
    <section ref={ref} id="one" className="paper relative z-20" style={{ minHeight: '200svh' }}>
      <PixelFringe edge="top" />
      <PixelFringe edge="bottom" />
      <h2 className="p-20 font-display text-6xl italic">ChapterOne</h2>
    </section>
  )
}
