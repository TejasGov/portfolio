import '../novel/index.css'
import './lab.css'
import * as THREE from 'three'
import Lenis from 'lenis'
import { createCinema } from '../novel/cinema/world'

/*
 * Sandbox: the seams between paper and the cinema. The scrapbook page catches like film in a hot gate
 * and burns open onto the hall; later a wave of the projector's light rolls out and leaves the next
 * page behind. Scroll drives both, so they run backwards too.
 */
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const world = await createCinema(document.getElementById('gl'), { mobile: matchMedia('(max-width: 760px)').matches })
const resize = () => world.resize(innerWidth, innerHeight)
resize()
addEventListener('resize', resize)
world.loadFilm('revere')

const lenis = new Lenis({ lerp: 0.08 })
const pos = new THREE.Vector3(0, 4.0, -4.8), look = new THREE.Vector3(0.5, 3.2, 15)
const $ = id => document.getElementById(id)

function stateAt(P, time) {
  const burn = ss(0.12, 0.42, P)
  const wash = ss(0.6, 0.9, P)
  $('a').style.visibility = P < 0.5 ? 'visible' : 'hidden'
  $('b').style.visibility = P >= 0.5 ? 'visible' : 'hidden'
  $('cue').style.opacity = P < 0.02 ? '0.6' : '0'
  const wave = P < 0.5 ? { mode: 'burn', p: burn, origin: [0.52, 0.56] } : { mode: 'wave', p: wash, origin: [0.5, 0.62] }
  // A slow push toward the screen while the cinema is on.
  const k = ss(0.12, 0.9, P)
  return {
    pos: pos.clone().lerp(new THREE.Vector3(0, 4.1, 0.5), k * 0.5), target: look, fov: 40,
    lamp: 1.6, pull: 0, swirl: 1, bloom: 1, house: 0, exposure: 3, focus: 15, flare: 1, density: 0.12, dust: 0.15,
    project: null, card: null,
    film: { from: 'dust', to: 'revere', morph: ss(0.3, 0.55, P), orbit: time * 0.05, inside: 0 },
    wave,
  }
}

const t0 = performance.now()
const loop = now => {
  requestAnimationFrame(loop)
  lenis.raf(now)
  const P = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)
  world.render(stateAt(P, (now - t0) / 1000))
}
requestAnimationFrame(loop)
window.cin = { world, THREE, stateAt }
