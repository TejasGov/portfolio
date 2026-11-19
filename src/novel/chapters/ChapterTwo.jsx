import { useRef } from 'react'
import { useProgress, useRunningHead } from '../lib/chapters'

// Placeholder while the chapter is built.
export default function ChapterTwo() {
  const ref = useRef(null)
  useProgress(ref, 'work')
  useRunningHead(ref, 'ChapterTwo')
  return (
    <section ref={ref} id="two" className="relative" style={{ height: '500svh' }}>
      <h2 className="sticky top-0 p-20 font-display text-6xl italic">ChapterTwo</h2>
    </section>
  )
}
