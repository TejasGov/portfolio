import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { store } from '../lib/store'
import { createCinema, LENS } from '../cinema/world'
import { stateAt, PROJECT_IDS, section, workSlot } from '../cinema/timeline'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The cinema behind every night chapter. One canvas, one render loop; it stops drawing while a paper
 * chapter covers the screen. It also tells the takeover overlay where the lens is on screen.
 */
export default function Stage() {
  const canvas = useRef(null)

  useEffect(() => {
    let world
    let raf
    let alive = true
    const mobile = matchMedia('(max-width: 760px)').matches
    const mouse = new THREE.Vector2()
    const lens = new THREE.Vector3()
    const resize = () => world?.resize(innerWidth, innerHeight)

    createCinema(canvas.current, { mobile }).then(async w => {
      if (!alive) return
      world = w
      if (import.meta.env.DEV) window.__world = w
      since = performance.now()
      resize()
      canvas.current.style.opacity = '1'
      raf = requestAnimationFrame(loop)
      // The films arrive after the first frame, in screening order.
      for (const id of PROJECT_IDS) {
        if (!alive) return
        await world.loadFilm(id).catch(() => {})
      }
    })

    // Adaptive resolution: if frames run long for about a second, render at 80% of the pixel ratio
    // (never below 0.7). Long gaps (a tab switch, a paper chapter) don't count.
    // shortcut: it only steps down, so a display capped at 30 fps (battery saver) also lands at 0.7; add a step back up if that matters.
    let last = 0, ema = 16.7, slow = 0, since = performance.now()
    const govern = now => {
      const dt = now - last
      last = now
      if (dt > 100 || now - since < 2500) return
      ema += (dt - ema) * 0.05
      slow = ema > 24 ? slow + 1 : 0
      if (slow < 45 || world.dpr <= 0.7) return
      world.setDpr(Math.max(0.7, world.dpr * 0.8))
      slow = 0
      ema = 16.7
    }

    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (!store.night) return
      govern(now)
      const k = reduced() ? 0 : 0.06
      mouse.x += (store.mouse.x - mouse.x) * k
      mouse.y += (store.mouse.y - mouse.y) * k
      const st = stateAt(store, mouse, innerWidth / innerHeight)
      // Make sure the reel being screened is loaded first.
      if (section(store) === 'work') world.loadFilm(PROJECT_IDS[workSlot(store.work).i])
      world.render(st)
      lens.copy(LENS).project(world.camera)
      store.lens = [(lens.x * 0.5 + 0.5) * 100, (0.5 - lens.y * 0.5) * 100]
      store.takeover = { flood: st.flood, sweep: st.sweep }
      store.camDist = world.camera.position.distanceTo(LENS)
    }

    addEventListener('resize', resize)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      world?.renderer.dispose()
    }
  }, [])

  return <canvas ref={canvas} className="fixed inset-0 h-svh w-screen opacity-0 transition-opacity duration-[1500ms]" aria-hidden="true" />
}
