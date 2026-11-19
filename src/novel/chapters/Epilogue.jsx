import { useRef } from 'react'
import { useProgress, useRunningHead } from '../lib/chapters'

// Placeholder while the chapter is built.
export default function Epilogue() {
  const ref = useRef(null)
  useProgress(ref, 'epilogue')
  useRunningHead(ref, 'Epilogue')
  return (
    <section ref={ref} id="epilogue" className="relative" style={{ height: '500svh' }}>
      <h2 className="sticky top-0 p-20 font-display text-6xl italic">Epilogue</h2>
    </section>
  )
}
