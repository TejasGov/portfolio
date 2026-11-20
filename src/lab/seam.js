import '../novel/index.css'
import './lab.css'
import * as THREE from 'three'
import Lenis from 'lenis'
import { createCinema, SCREEN } from '../novel/cinema/world'

/*
 * Sandbox: the seams as a world transformation. The scrapbook page scrolls away and the cinema is
 * underneath as an ink drawing on the same paper; a wave of colour and light rolls out from the screen
 * across the hall. Later the drawing washes back over it from the screen, and the next page arrives.
 */
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const world = await createCinema(document.getElementById('gl'), { mobile: matchMedia('(max-width: 760px)').matches })
const resize = () => world.resize(innerWidth, innerHeight)
resize()
addEventListener('resize', resize)

const lenis = new Lenis({ lerp: 0.08 })
const from = { pos: new THREE.Vector3(-3.2, 6.4, -9.6), look: new THREE.Vector3(0.6, 3.6, 15) }
const to = { pos: new THREE.Vector3(0, 4.0, -4.8), look: new THREE.Vector3(0.5, 3.2, 15) }
const pos = new THREE.Vector3(), look = new THREE.Vector3()
const REACH = 40 // far enough from the screen to have passed the booth

function stateAt(P) {
  const k = ss(0.05, 0.85, P)
  pos.copy(from.pos).lerp(to.pos, k)
  look.copy(from.look).lerp(to.look, k)
  // Colour blooms out from the screen (0.18 → 0.45), holds, then the drawing washes back (0.68 → 0.88).
  const bloom = ss(0.18, 0.45, P)
  const wash = ss(0.68, 0.88, P)
  const sketch = P < 0.56
    ? { r: -4 + bloom * (REACH + 4), origin: SCREEN, band: 1.6, colourBehind: true }
    : { r: -4 + wash * (REACH + 4), origin: SCREEN, band: 1.6, colourBehind: false }
  return {
    pos, target: look, fov: 40, lamp: 1.3, pull: 0, swirl: 1, bloom: 1, house: 0, exposure: 3, focus: 12, flare: 1,
    density: 0.25, dust: 0.4, project: null, card: { key: 'work-title', kicker: 'Chapter Two', title: 'Things I built' }, sketch,
  }
}

const loop = now => {
  requestAnimationFrame(loop)
  lenis.raf(now)
  const P = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)
  world.render(stateAt(P))
}
requestAnimationFrame(loop)
window.cin = { world, THREE, stateAt }
