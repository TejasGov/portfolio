import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { store } from '../lib/store'
import { createCinema, LENS } from '../cinema/world'
import { stateAt, PROJECT_IDS, section, workSlot } from '../cinema/timeline'
import { LEVELS, levelAt } from '../cinema/levels'
import * as five from '../cinema/movies'

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
      // Then start fetching the journey's models, so they're in hand long before Three; it compiles while the reader pauses.
      const build = () => alive && world.prepare('journey')
      if (window.requestIdleCallback) requestIdleCallback(build, { timeout: 3000 })
      else setTimeout(build, 1000)
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

    // The 3D follows the scroll with a little weight: each chapter's progress glides toward the scroll's
    // (on top of Lenis's own smoothing), so waves, walks and camera moves never step with the wheel.
    // A jump (the contents menu) lands at once rather than playing every chapter on the way.
    const view = Object.create(store)
    const KEYS = ['prologue', 'workIn', 'work', 'three', 'four', 'five', 'epilogue', 'epiIn']
    let lastFrame = 0, gliding = false
    const glide = now => {
      const k = reduced() || !lastFrame ? 1 : 1 - Math.exp(-Math.min(0.1, (now - lastFrame) / 1000) * 4.5)
      lastFrame = now
      gliding = false
      for (const key of KEYS) {
        const to = store[key] ?? 0, from = Object.hasOwn(view, key) ? view[key] : to
        // A tiny gap snaps, so a chapter heading back to 0 really reaches 0 and hands the stage back.
        const d = to - from
        view[key] = Math.abs(d) > 0.3 || Math.abs(d) < 1e-4 ? to : from + d * k
        if (view[key] !== to) gliding = true
      }
    }

    const loop = now => {
      raf = requestAnimationFrame(loop)
      glide(now)
      if (!store.night) {
        // Chapter One's paper covers the canvas: once the reader pauses, draw Two's first frame unseen,
        // so the seam back to the hall doesn't stall ~60 ms on its first draw.
        if (!warmed && world && now - scrolled > 400) {
          warmed = true
          world.render(stateAt(Object.assign(Object.create(view), { workIn: 0.15, work: 0.004 }), mouse, innerWidth / innerHeight))
        }
        return
      }
      warmed = false
      govern(now)
      const k = reduced() ? 0 : 0.06
      mouse.x += (store.mouse.x - mouse.x) * k
      mouse.y += (store.mouse.y - mouse.y) * k
      view.still = reduced()
      const st = stateAt(view, mouse, innerWidth / innerHeight)
      // Make sure the reel being screened is loaded first.
      const sec = section(view)
      if (sec === 'work') world.loadFilm(PROJECT_IDS[workSlot(view.work).i])
      // Build the next chapter's world while the reader is paused, so its seam doesn't stall mid-scroll.
      // In Three, keep the journey's late-loading dioramas warm before the arcade (prepare skips while compiling).
      // In Four, the level on screen and the one after it (the next is built and compiled a level ahead),
      // and from its last level on, all of Five's worlds (the pause at Four's end warms the dive, the landing and
      // the final, so none compiles over the push-in or the tower's wide). In Five, every world still ahead.
      const at = sec === 'four' ? levelAt(view.four) : sec === 'five' ? five.levelAt(view.five) : null, lv = at ? at.i : 0
      const ahead = (list, then = []) => list.slice(lv, lv + 2).map(l => l.name).concat(lv === list.length - 1 ? then : [])
      // In the epilogue, Five's last world, which plays on the screen as it rises (for a reader who jumped there).
      const todo = { work: ['journey'], three: ['journey', 'arcade'], four: ahead(LEVELS, five.LEVELS.map(l => l.name)), five: five.LEVELS.slice(lv).map(l => l.name), epilogue: [five.LAST] }[sec]
      // Paused: the scroll has rested and the picture has glided to a stop, so a prepare step's hitch is not seen on a moving frame.
      if (todo && now - scrolled > 400 && !gliding) for (const name of todo) world.prepare(name)
      // A reader who never pauses in Four: still build and compile the next level, in the browser's idle time, before its seam.
      else if (at && !at.kind && todo && now - scrolled <= 400 && !idleAsk && window.requestIdleCallback) { // not during a covering transition: it is the heaviest frame there is
        idleAsk = true
        requestIdleCallback(() => { idleAsk = false; if (alive) for (const name of todo) world.prepare(name) }, { timeout: 1500 })
      }
      world.render(st)
      lens.copy(LENS).project(world.camera)
      store.lens = [(lens.x * 0.5 + 0.5) * 100, (0.5 - lens.y * 0.5) * 100]
      store.takeover = { flood: st.flood, sweep: st.sweep }
      store.camDist = world.camera.position.distanceTo(LENS)
    }

    let scrolled = 0, warmed = false, idleAsk = false
    const onScroll = () => { scrolled = performance.now() }
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', resize)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', resize)
      world?.renderer.dispose()
    }
  }, [])

  return <canvas ref={canvas} className="fixed inset-0 h-svh w-screen opacity-0 transition-opacity duration-[1500ms]" aria-hidden="true" />
}
