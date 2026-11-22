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
  const reel = useRef(null)

  useEffect(() => {
    let world
    let raf
    let alive = true
    const mobile = matchMedia('(max-width: 760px)').matches
    const mouse = new THREE.Vector2()
    const lens = new THREE.Vector3()
    let poster = false // the last frame drawn was under the poster, which hides the booth: hold it
    const resize = () => ((poster = false), world?.resize(innerWidth, innerHeight))

    // The poster's lattice (hero/lattice.js) resolves over its first few seconds: the booth's startup (its
    // noise volume, the bakes' uploads, its first compile: frames of 70-300 ms) waits until about when that
    // is done, or until the reader scrolls or asks the box office. A scroll asks in the browser's idle time
    // (at most 400 ms on), so the startup's first step doesn't land inside the reader's scroll frame.
    let started = false, later = 0, asked = false
    const start = () => {
      if (started || !alive) return
      started = true
      clearTimeout(later)
      removeEventListener('scroll', early)
      removeEventListener('novel:warm', start)
      boot()
    }
    const early = () => scrollY > 0 && !asked && ((asked = true), window.requestIdleCallback ? requestIdleCallback(start, { timeout: 400 }) : setTimeout(start, 100))
    const onLoad = () => (later = setTimeout(start, reduced() ? 0 : 5500))
    addEventListener('scroll', early, { passive: true })
    addEventListener('novel:warm', start)
    if (document.readyState === 'complete') onLoad()
    else addEventListener('load', onLoad, { once: true })

    const boot = () => createCinema(canvas.current, { mobile }).then(async w => {
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
    if (scrollY > 0) start() // a reload part-way down: no poster to wait for

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
    // A jump is a gap of more than about 330 svh of scroll: Five's P is longer, so its threshold is smaller.
    const SNAP = { five: 0.3 * five.UNIT }
    // A ticket or contents jump moves the scroll by more than a screen in one frame: then everything snaps
    // for a moment (the store can follow the scroll a frame late), wherever the chapter's own P was.
    // dir: which way the reader travels (1 down, -1 up), so Five prepares the world they are heading into.
    // It turns only after a quarter screen the other way, so a nudge doesn't swap what is kept.
    // landed: no scroll since the last jump (cleared by the reader's own scroll, unlike jumped).
    let lastFrame = 0, gliding = false, lastY = scrollY, snapUntil = 0, jumped = false, landed = false, dir = 1, turnY = scrollY
    const glide = now => {
      const y = scrollY
      if (Math.abs(y - lastY) > innerHeight) (snapUntil = now + 200), (jumped = landed = true), (dir = 1), (turnY = y) // a jump lands to watch on
      else if (y !== lastY) {
        jumped = landed = false // the reader scrolls on from where the jump landed
        if ((y - lastY) * dir > 0) turnY = y
        else if (Math.abs(y - turnY) > innerHeight / 4) (dir = -dir), (turnY = y)
      }
      lastY = y
      const k = reduced() || !lastFrame || now < snapUntil ? 1 : 1 - Math.exp(-Math.min(0.1, (now - lastFrame) / 1000) * 4.5)
      lastFrame = now
      gliding = false
      for (const key of KEYS) {
        const to = store[key] ?? 0, from = Object.hasOwn(view, key) ? view[key] : to
        // A tiny gap snaps, so a chapter heading back to 0 really reaches 0 and hands the stage back.
        const d = to - from
        view[key] = Math.abs(d) > (SNAP[key] ?? 0.3) || Math.abs(d) < 1e-4 ? to : from + d * k
        if (view[key] !== to) gliding = true
      }
    }

    const loop = now => {
      raf = requestAnimationFrame(loop)
      const gap = lastFrame ? now - lastFrame : 0
      world.gap = gap
      glide(now)
      warmStep(now)
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
      // Under the poster (opaque over the booth until its wipe begins, ~0.065): the frame drawn stands.
      if (poster && view.prologue < 0.06 && section(view) === 'prologue') return
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
      // and from its last level on, Five's first world (the pause at Four's end warms the swing, and on a
      // desktop the dive, so neither compiles over the push-in). In Five, in this order, the world on
      // screen, the next in the reader's direction and, on a desktop, the one after it (the dance has too
      // many programs to compile within the final alone) and the one behind (a phone keeps GPU memory to
      // two worlds); in the epilogue, Five's last world, which plays on the screen as it rises. On a phone
      // the world after next is built (fetched and set up, nothing on the GPU) a world ahead.
      const at = sec === 'four' ? levelAt(view.four) : sec === 'five' ? five.levelAt(view.five) : null, lv = at ? at.i : 0
      const ahead = (list, then = []) => list.slice(lv, lv + 2).map(l => l.name).concat(lv === list.length - 1 ? then : [])
      const near = (mobile ? [lv, lv + dir] : [lv, lv + dir, lv + 2 * dir, lv - dir]).filter(i => i >= 0 && i < five.LEVELS.length).map(i => five.LEVELS[i].name)
      const todo = { work: ['journey'], three: ['journey', 'arcade'], four: ahead(LEVELS, KEEP.four), five: near, epilogue: [five.LAST] }[sec]
      // Paused: the scroll has rested and the picture has glided to a stop, so a prepare step's hitch is not seen on a moving frame.
      const paused = now - scrolled > 400 && !gliding
      // Just after a jump into Five, only the world landed on (the ticket warmed it): its neighbours wait
      // for the reader to scroll, rather than compiling over a scene that plays on the clock; or, once the
      // landed world is warm, for a second's pause, so a reader who watches first still finds the next warm.
      if (jumped && paused && world.isWarm(near[0]) && now - snapUntil > 1000) jumped = false
      // Then, until the reader scrolls, only the world on screen and the one they head into: the one after waits.
      const run = sec === 'five' && jumped ? near.slice(0, 1) : sec === 'five' && landed ? near.slice(0, 2) : todo
      // A world further ahead only builds (its models fetch and parse, nothing on the GPU) once what is
      // nearer is built: Five's world after next; Four's level after next; from Three, Four's second level,
      // so a fling through the arcade finds the village built, not held under its cloud while it loads.
      const after = sec === 'five' ? (landed ? null : five.LEVELS[lv + 2 * dir]?.name) : sec === 'four' ? LEVELS[lv + 2]?.name : sec === 'three' ? LEVELS[1]?.name : null
      if (after && !world.debug.built[after] && todo.every(n => world.debug.built[n])) world.prepare(after)
      world.still = paused
      if (run && paused && sec !== 'five') for (const name of run) world.prepare(name)
      else if (run && paused) {
        // Five's worlds play on the clock: one prepares at a time, and a second's rest follows each, so
        // their builds and compiles (each within budget) never run back to back over a scene being watched.
        if (spacing && world.isWarm(spacing)) (restUntil = now + 1000), (spacing = null)
        const next = run.find(n => !world.isWarm(n))
        if (next && (next === spacing || now >= restUntil)) world.prepare((spacing = next))
      }
      if (paused) evict(sec, todo, now)
      // Five's worlds play on the clock, so a paused stall is seen too: there the next world prepares while
      // scrolling, its compile and uploads sliced a step a calm frame (world.js), never under a cover; and
      // what is no longer near is released, a world a calm frame (the one two behind, one on a phone).
      else if (sec === 'five') {
        if (world.calm && !at.kind) {
          for (const name of run) if (!world.isWarm(name)) world.prepare(name)
          if (tidy !== (lv + 1) * dir && evict(sec, todo, now)) tidy = (lv + 1) * dir
        }
      }
      // A reader who never pauses in Four: still build and compile the next level, in the browser's idle time, before its seam.
      else if (at && !at.kind && todo && now - scrolled <= 400 && !idleAsk && window.requestIdleCallback) { // not during a covering transition: it is the heaviest frame there is
        idleAsk = true
        requestIdleCallback(() => { idleAsk = false; if (alive) for (const name of todo) world.prepare(name) }, { timeout: 1500 })
      }
      world.render(st)
      poster = sec === 'prologue' && view.prologue < 0.06
      // A world reached before it was ready holds its seam's cover: after a moment, say so.
      heldAt = world.held ? heldAt || now : 0
      const wait = !!heldAt && now - heldAt > 300
      if (wait !== waiting && reel.current) (waiting = wait), (reel.current.style.opacity = wait ? '1' : '0')
      lens.copy(LENS).project(world.camera)
      store.lens = [(lens.x * 0.5 + 0.5) * 100, (0.5 - lens.y * 0.5) * 100]
      store.takeover = { flood: st.flood, sweep: st.sweep }
      store.camDist = world.camera.position.distanceTo(LENS)
    }

    // GPU memory: Five's seven worlds are not all kept on the GPU (desktop estimates with world.debug.gpu(), MB:
    // swing 61.5, dive 80.7, landing 96.4, chase 77, vault (measure once built), dance 80.7, final 29.5;
    // journey 118, arcade 189): at most four of them on a desktop, two on a phone. While the reader is in Four, Five or the epilogue, a Five world outside what that section prepares
    // (the world on screen, the next, on a desktop the one after it and the one behind; in Four the first one or two, in the epilogue the last one or two)
    // is released, one per paused frame (in Five also per calm scrolling frame), the furthest behind the
    // reader first, and prepared again on approach exactly as the first time; a box office jump asks for
    // its worlds first ('novel:warm'), and they are kept for a while after. Once inside Five's screen, and
    // in the epilogue, the journey and Four's worlds are released too (nothing draws them there); earlier
    // chapters keep whatever is resident.
    const KEEP = mobile ? { four: [five.FIRST], epilogue: [five.LAST] } : { four: [five.FIRST, five.LEVELS[1].name], epilogue: [five.LAST, five.LEVELS[five.LEVELS.length - 2].name] }
    const pinned = new Map() // world -> kept until (ms): asked for by 'novel:warm'
    const OLD = ['journey', ...LEVELS.map(l => l.name)], FWD = five.LEVELS.map(l => l.name), BWD = [...FWD].reverse()
    const evict = (sec, todo, now) => {
      if (!(sec === 'four' || sec === 'five' || sec === 'epilogue')) return // release() itself skips the world being compiled
      const keep = new Set(KEEP[sec] ?? todo)
      for (const req of requests) req.worlds.forEach(n => keep.add(n))
      for (const [n, until] of pinned) if (until > now) keep.add(n)
      const drop = n => !keep.has(n) && world.isWarm(n) && world.release(n)
      // Not in the push-in: Four's last world is still fading off the cinema's screen there.
      if (sec === 'epilogue' || (sec === 'five' && view.five >= five.LEVELS[0].walk[0])) for (const n of OLD) if (drop(n)) return false
      // A phone lets the journey go once the arcade is behind (~120 MB): Three prepares it again on the way back.
      if (mobile && sec === 'four' && levelAt(view.four).i > 0 && drop('journey')) return false
      for (const n of dir > 0 ? FWD : BWD) if (drop(n)) return false
      return true // nothing left to release
    }
    let spacing = null, restUntil = 0 // Five, paused: the world being prepared, and the rest after it
    let tidy = null // Five, scrolling: the world and direction evict() last found nothing to release in

    // The warm-up contract (the box office): window 'novel:warm' with detail { worlds: [names] } prepares
    // them in order, a step a frame whether or not the reader is paused (the booth is a still overlay),
    // then 'novel:warmed' goes out with the same detail; at once if they are all warm already.
    const requests = []
    const onWarm = e => {
      const names = [].concat(e.detail?.worlds ?? []).filter(n => typeof n === 'string')
      requests.push({ detail: e.detail, worlds: names, t0: performance.now() })
      if (world && requests.length === 1) warmStep(performance.now()) // all warm already: answered now, not a frame later
    }
    const warmStep = now => {
      if (!world || !requests.length) return
      const req = requests[0]
      // A world that never warms (its models failed to load) gives up after 6 s, so it can't hold every later ticket.
      const cold = now - req.t0 < 6000 && req.worlds.find(n => !world.isWarm(n) && (n in world.debug.built || KNOWN.has(n)))
      if (cold) return void world.prepare(cold)
      requests.shift()
      for (const n of req.worlds) pinned.set(n, now + 20000)
      if (import.meta.env.DEV) console.info(`[stage] warmed ${req.worlds.join(', ')} in ${Math.round(performance.now() - req.t0)} ms`)
      dispatchEvent(new CustomEvent('novel:warmed', { detail: req.detail }))
    }
    const KNOWN = new Set(['journey', ...LEVELS.map(l => l.name), ...five.LEVELS.map(l => l.name)])
    addEventListener('novel:warm', onWarm)

    let scrolled = 0, warmed = false, idleAsk = false, heldAt = 0, waiting = false
    const onScroll = () => { scrolled = performance.now() }
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', resize)
    return () => {
      alive = false
      clearTimeout(later)
      removeEventListener('scroll', early)
      removeEventListener('novel:warm', start)
      removeEventListener('load', onLoad)
      cancelAnimationFrame(raf)
      removeEventListener('scroll', onScroll)
      removeEventListener('novel:warm', onWarm)
      removeEventListener('resize', resize)
      world?.renderer.dispose()
    }
  }, [])

  return (
    <>
      <canvas ref={canvas} className="fixed inset-0 h-svh w-screen opacity-0 transition-opacity duration-[1500ms]" aria-hidden="true" />
      {/* Shown over a held cover (world.held): the white cloud or laser flare is a reel still loading, not a blank page. */}
      <p ref={reel} aria-hidden="true" className="kicker pointer-events-none fixed bottom-[max(96px,14svh)] left-1/2 z-[2] -translate-x-1/2 rounded-sm bg-[rgb(6_10_20/0.82)] px-4 py-2 whitespace-nowrap text-white opacity-0 motion-safe:transition-opacity motion-safe:duration-300">
        Loading reel…
      </p>
    </>
  )
}
