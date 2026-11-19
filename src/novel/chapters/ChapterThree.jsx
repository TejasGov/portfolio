import { useRef } from 'react'
import PixelFringe from '../lib/PixelFringe'
import { usePaper, useRunningHead } from '../lib/chapters'

// Placeholder while the chapter is built.
export default function ChapterThree() {
  const ref = useRef(null)
  usePaper(ref)
  useRunningHead(ref, 'ChapterThree')
  return (
    <section ref={ref} id="three" className="paper relative z-20" style={{ minHeight: '200svh' }}>
      <PixelFringe edge="top" />
      <PixelFringe edge="bottom" />
      <h2 className="p-20 font-display text-6xl italic">ChapterThree</h2>
    </section>
  )
}
