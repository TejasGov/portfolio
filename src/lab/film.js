import '../novel/index.css'
import './lab.css'
import * as THREE from 'three'
import Lenis from 'lenis'
import { createCinema, SCREEN, insideDistance } from '../novel/cinema/world'
import { PROJECTS } from '../novel/content'

/*
 * Sandbox: a project as a film you walk into. From row ten the screen plays Yudhveer (you, sword and
 * shield, against your shadow); the camera walks into the screen until the film is the whole frame;
 * at the end it backs out into the hall.
 */
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

const world = await createCinema(document.getElementById('gl'), { mobile: matchMedia('(max-width: 760px)').matches })
const resize = () => world.resize(innerWidth, innerHeight)
resize()
addEventListener('resize', resize)
const FILM = new URLSearchParams(location.search).get('film') ?? 'yudhveer'
await world.loadFilm(FILM)

const lenis = new Lenis({ lerp: 0.08 })
const ROW10 = { pos: new THREE.Vector3(0, 4.0, -4.8), look: new THREE.Vector3(0.5, 3.2, 15) }
const pos = new THREE.Vector3(), look = new THREE.Vector3(), inPos = new THREE.Vector3()
const $ = id => document.getElementById(id)
const p = PROJECTS.find(x => x.id === FILM)
$('kick').textContent = `Now showing · ${String(PROJECTS.indexOf(p) + 1).padStart(2, '0')} / 05`
$('cat').textContent = p.category ?? ''
$('ptitle').textContent = p.title
$('pline').textContent = p.line
$('ptech').textContent = p.tech

function stateAt(P) {
  const aspect = innerWidth / innerHeight
  const fov = aspect < 0.85 ? 62 : 40
  inPos.copy(SCREEN).setZ(SCREEN.z - insideDistance(fov, aspect))
  const push = ss(0.12, 0.34, P) * (1 - ss(0.86, 0.98, P))
  pos.copy(ROW10.pos).lerp(inPos, ease(push))
  look.copy(ROW10.look).lerp(SCREEN, ease(push))
  $('label').style.opacity = P > 0.4 && P < 0.82 ? '1' : '0'
  $('cue').style.opacity = P < 0.02 ? '0.6' : '0'
  return {
    pos, target: look, fov, lamp: 1.6, pull: 0, swirl: 1, bloom: 1, house: 0, exposure: 3, focus: 15, flare: 1,
    density: 0.08 * (1 - push), dust: 0.05 * (1 - push), project: null, card: null,
    film: { id: FILM, inside: push > 0.9995 ? 1 : push },
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
