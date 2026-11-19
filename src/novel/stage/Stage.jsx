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
      resize()
      canvas.current.style.opacity = '1'
      loop()
      // Projects arrive after the first frame, nearest-first.
      for (const id of PROJECT_IDS) {
        if (!alive) return
        await world.loadProject(id).catch(() => {})
      }
    })

    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!store.night) return
      const k = reduced() ? 0 : 0.06
      mouse.x += (store.mouse.x - mouse.x) * k
      mouse.y += (store.mouse.y - mouse.y) * k
      const st = stateAt(store, mouse, innerWidth / innerHeight)
      // Make sure the reel being screened is loaded first.
      if (section(store) === 'work') world.loadProject(PROJECT_IDS[workSlot(store.work).i])
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
