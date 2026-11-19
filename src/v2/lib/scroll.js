import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let lenis = null

/** Smooth scroll (Lenis) driven by GSAP's ticker so ScrollTrigger stays in sync. Skipped for reduced motion. */
export function startSmoothScroll() {
  if (lenis || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  lenis = new Lenis({ lerp: 0.09 })
  lenis.on('scroll', ScrollTrigger.update)
  const tick = time => lenis.raf(time * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
  return () => {
    gsap.ticker.remove(tick)
    lenis.destroy()
    lenis = null
  }
}

/** Freeze or release page scrolling (used while the Boot gate is up). */
export function setScrollLocked(locked) {
  document.documentElement.style.overflow = locked ? 'hidden' : ''
  if (lenis) locked ? lenis.stop() : lenis.start()
}

/** Scroll to a chapter and move focus there, so keyboard and screen-reader users land in it too. */
export function goTo(id) {
  const el = document.getElementById(id)
  if (!el) return
  if (lenis) lenis.scrollTo(el, { duration: 1.4 })
  else el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  el.focus({ preventScroll: true })
  history.replaceState(null, '', `#${id}`)
}
