import '../novel/index.css'
import './lab.css'
import * as THREE from 'three'
import Lenis from 'lenis'
import { createCinema, SCREEN, insideDistance } from '../novel/cinema/world'
import { PROJECTS } from '../novel/content'

/*
 * Sandbox: Chapter Two as a film. From row ten the screen shows the projector's dust; the camera walks
 * into the screen until the film is the whole frame; inside, each project forms out of light and flows
 * into the next; at the end the camera backs out into the hall.
 */
const IDS = PROJECTS.map(p => p.id)
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

const world = await createCinema(document.getElementById('gl'), { mobile: matchMedia('(max-width: 760px)').matches })
const resize = () => world.resize(innerWidth, innerHeight)
resize()
addEventListener('resize', resize)
IDS.forEach(id => world.loadFilm(id))

const lenis = new Lenis({ lerp: 0.08 })
const ROW10 = { pos: new THREE.Vector3(0, 4.0, -4.8), look: new THREE.Vector3(0.5, 3.2, 15) }
const pos = new THREE.Vector3(), look = new THREE.Vector3(), inPos = new THREE.Vector3()
const $ = id => document.getElementById(id)
let shown = -1

function stateAt(P, time) {
  const aspect = innerWidth / innerHeight
  const fov = aspect < 0.85 ? 62 : 40
  inPos.copy(SCREEN).setZ(SCREEN.z - insideDistance(fov, aspect))
  const push = ss(0.05, 0.19, P) * (1 - ss(0.9, 0.99, P))
  pos.copy(ROW10.pos).lerp(inPos, ease(push))
  look.copy(ROW10.look).lerp(SCREEN, ease(push))

  const s = THREE.MathUtils.clamp((P - 0.17) / 0.71, 0, 0.9999) * IDS.length
  const i = Math.floor(s), k = s - i
  let from = i === 0 ? 'dust' : IDS[i - 1], to = IDS[i], morph = ss(0, 0.42, k)
  if (P > 0.88) { from = IDS[IDS.length - 1]; to = 'dust'; morph = ss(0.88, 0.95, P) }

  const settled = P > 0.17 && P < 0.88 && morph > 0.92
  if ((settled ? i : -1) !== shown) {
    shown = settled ? i : -1
    const p = PROJECTS[i]
    if (settled) {
      $('kick').textContent = `Now showing · ${String(i + 1).padStart(2, '0')} / 05`
      $('cat').textContent = p.category ?? ''
      $('ptitle').textContent = p.title
      $('pline').textContent = p.line
      $('ptech').textContent = p.tech
    }
    $('label').style.opacity = settled ? '1' : '0'
  }
  $('cue').style.opacity = P < 0.02 ? '0.6' : '0'

  return {
    pos, target: look, fov, lamp: 1.6, pull: 0, swirl: 1, bloom: 1, house: 0, exposure: 3, focus: 15, flare: 1,
    density: 0.08 * (1 - push), dust: 0.05 * (1 - push), project: null, card: null,
    film: { from, to, morph, orbit: P * 7 + time * 0.04, inside: push > 0.9995 ? 1 : push, shift: aspect < 1 ? 0 : 1.1, dist: aspect < 1 ? 2.4 : 1 },
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
