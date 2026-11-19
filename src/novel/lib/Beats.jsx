import { useEffect, useRef } from 'react'
import { store } from './store'

/**
 * Text that surfaces at a window of a chapter's progress: blur + rise in, fade + lift out.
 * Driven by a rAF loop reading the store (no React re-renders while scrolling).
 */
export function useBeats(key, beats) {
  const refs = useRef([])
  useEffect(() => {
    let raf
    const tick = () => {
      const p = store[key]
      beats.forEach((b, i) => {
        const el = refs.current[i]
        if (!el) return
        const [a, z] = b.at
        const edge = (z - a) * 0.22
        const k = Math.min(1, Math.max(0, Math.min((p - a) / edge, (z - p) / edge)))
        const rising = p < (a + z) / 2
        el.style.opacity = k.toFixed(3)
        el.style.transform = `translate3d(0, ${((1 - k) * (rising ? 22 : -18)).toFixed(1)}px, 0)`
        el.style.filter = k > 0.995 ? 'none' : `blur(${((1 - k) * 8).toFixed(1)}px)`
        el.inert = k < 0.5
        // Titles inside a beat assemble once it is mostly visible (see Assemble.jsx).
        const on = k > 0.55 ? '1' : '0'
        if (el.dataset.on !== on) el.dataset.on = on
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [key, beats])
  // Usage: <p ref={bind(i)}>  — binds beat i's element.
  return i => el => (refs.current[i] = el)
}
