import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Lenis on GSAP's clock so ScrollTrigger and the smooth scroll never disagree. */
export function startScroll() {
  if (reducedMotion()) return () => {}
  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 })
  lenis.on('scroll', ScrollTrigger.update)
  const tick = t => lenis.raf(t * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
  return () => {
    gsap.ticker.remove(tick)
    lenis.destroy()
  }
}

export { gsap, ScrollTrigger }
