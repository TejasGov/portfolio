import { useEffect, useRef } from 'react'
import { store } from '../lib/store'
import { createPixelSweep } from '../cinema/sweep'

/**
 * The end of the prologue: the projector's light floods the frame blue-white (centred on the lens), then
 * breaks into paper pixels that become Chapter One. Both are driven by scroll, so they run in reverse too.
 */
export default function Takeover() {
  const flood = useRef(null)
  const px = useRef(null)
  const grain = useRef(null)

  useEffect(() => {
    const sweep = createPixelSweep(px.current, { origin: [0.5, 0.45] })
    const t0 = performance.now()
    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const { flood: f = 0, sweep: s = 0 } = store.takeover ?? {}
      // Once a paper chapter covers the screen the overlay has done its job.
      const show = store.night ? 1 : 0
      const el = flood.current
      el.style.opacity = (f * show).toFixed(3)
      if (f > 0) {
        const [x, y] = store.lens ?? [50, 45]
        const r = 10 + 160 * f
        el.style.background = `radial-gradient(circle at ${x}% ${y}%, #ffffff 0, #dce9ff ${r * 0.18}vmax, rgb(120 170 255 / ${0.95 * f}) ${r * 0.55}vmax, rgb(36 86 230 / ${0.9 * f}) ${r * 0.85}vmax, rgb(20 50 160 / 0) ${r}vmax)`
      }
      sweep.draw(show ? s : 0, (performance.now() - t0) / 1000)
      grain.current.style.opacity = (show * s).toFixed(3)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      <div ref={flood} className="pointer-events-none fixed inset-0 z-[2] opacity-0" aria-hidden="true" />
      <canvas ref={px} className="pointer-events-none fixed inset-0 z-[3] [image-rendering:pixelated]" aria-hidden="true" />
      <div ref={grain} className="paper-grain pointer-events-none fixed inset-0 z-[3] opacity-0" aria-hidden="true" />
    </>
  )
}
