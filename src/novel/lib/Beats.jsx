import { useEffect, useRef } from 'react'
import { store } from './store'
import { reducedMotion } from './scroll'

// Below this a beat is hidden outright: a mid-wipe sliver is either solid or gone, never a ghost.
const SHOW = 0.9

// Style writes only when the value changed, so idle frames touch no styles.
const put = (el, prop, v) => {
  if (el['_' + prop] === v) return
  el['_' + prop] = v
  el.style[prop] = v
}

/**
 * Text that surfaces at a window of a chapter's progress: it holds solid and wipes in and out
 * (a clip-path edge plus a short rise), instead of a long opacity ramp that leaves ghosts on screen.
 * Under reduced motion it is a plain opacity fade. Driven by a rAF loop reading the store (no React
 * re-renders while scrolling). A beat's `edge` is a number or [edgeIn, edgeOut].
 */
export function useBeats(key, beats) {
  const refs = useRef([])
  useEffect(() => {
    let raf
    const still = reducedMotion()
    refs.current.forEach(el => el && (el.style.filter = '')) // drop a blur an older build left inline (HMR)
    const tick = () => {
      const p = store[key]
      beats.forEach((b, i) => {
        const el = refs.current[i]
        if (!el) return
        const [a, z] = b.at
        const edge = b.edge ?? Math.min((z - a) * 0.22, 0.035) // short ramps, long holds
        const [eIn, eOut] = Array.isArray(edge) ? edge : [edge, edge]
        const k = Math.min(1, Math.max(0, Math.min((p - a) / eIn, (z - p) / eOut)))
        const e = k * k * (3 - 2 * k)
        const rising = p < (a + z) / 2
        let op = e
        if (!still) {
          op = Math.min(1, e * 4)
          const cut = `${((1 - e) * 100).toFixed(1)}%`
          // Negative insets keep the card's shadow and the text shadows outside the box.
          put(el, 'clipPath', k >= 1 ? '' : rising ? `inset(${cut} -60px -60px -60px)` : `inset(-60px -60px ${cut} -60px)`)
          put(el, 'transform', `translate3d(0, ${((1 - k) * (rising ? 14 : -10)).toFixed(1)}px, 0)`)
        }
        const hidden = k === 0 || (!still && op < SHOW)
        put(el, 'opacity', hidden ? '0' : op.toFixed(3))
        put(el, 'visibility', hidden ? 'hidden' : '') // no frosted ghost of a hidden beat
        if (el.inert !== (hidden || k < 0.5)) el.inert = hidden || k < 0.5
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
