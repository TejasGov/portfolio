import { useEffect, useRef } from 'react'

/**
 * A dithered band of paper-coloured squares on the edge of a paper chapter, so night dissolves
 * into paper pixel by pixel as you scroll (and back again at the far edge).
 */
export default function PixelFringe({ edge = 'top', color = '#efe8da', height = '42svh', cell = 14 }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const draw = () => {
      const dpr = Math.min(devicePixelRatio, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color
      const cols = Math.ceil(w / cell)
      const rows = Math.ceil(h / cell)
      let seed = 7
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (let r = 0; r < rows; r++) {
        // Density rises toward the paper; a few strays reach far out into the night.
        const t = edge === 'top' ? (r + 1) / rows : 1 - r / rows
        const p = Math.pow(t, 2.2)
        for (let c = 0; c < cols; c++) if (rand() < p) ctx.fillRect(c * cell, r * cell, cell, cell)
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [edge, color, cell])
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 w-full"
      style={{ height, [edge === 'top' ? 'bottom' : 'top']: '100%' }}
    />
  )
}
