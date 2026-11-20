import * as THREE from 'three'
import { PROJECTS } from '../content'
import { LENS, SCREEN, insideDistance } from './world'

/*
 * Scroll → the cinema. One function maps the store (prologue / work / epilogue progress) to what the
 * world renders: camera, lamp, the takeover, which project is being screened and how far it has formed.
 * Tune timing here.
 */
const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const V = (x, y, z) => new THREE.Vector3(x, y, z)

// The prologue camera: booth → out through the window down the beam → over the seats → turn back to
// face the booth → rise into the light. Keys are evenly spaced in time.
const PRO_POS = new THREE.CatmullRomCurve3([
  V(3.1, 8.5, -14.7), V(1.7, 7.95, -13.0), V(0.95, 7.75, -10.6), V(-2.6, 5.0, 1.5),
  V(-6.9, 2.6, 8.6), V(-6.2, 3.6, 4.0), V(-3.4, 6.2, -3.8), V(0.78, 7.55, -9.7),
], false, 'centripetal')
const PRO_LOOK = new THREE.CatmullRomCurve3([
  V(0.9, 7.55, -12.3), V(0.9, 7.6, -10.5), V(0.5, 5.4, 8), V(0, 3.8, 15),
  V(0.5, 6.4, -11.2), V(0.7, 6.9, -11.4), V(0.9, 7.4, -11.6), V(0.9, 7.58, -12.15),
], false, 'centripetal')

// Chapter Two: seated at eye height in row ten, the whole screen between the curtains and a few seat
// backs in silhouette below. +x is screen-left facing the screen, so a target at +0.5 sits the screen a
// little right of centre and leaves its dark left masking under the text card.
const WORK_POS = V(0, 4.0, -4.8)
const WORK_LOOK = V(0.5, 3.2, 15)
const WORK_POS_PORTRAIT = V(0, 5.4, -8.2)
const WORK_LOOK_PORTRAIT = V(0.2, 3.6, 15)
// Epilogue: back up the rake as the house lights come up.
const EPI_POS = new THREE.CatmullRomCurve3([V(0, 4.0, -4.8), V(-1.4, 5.2, -7.4), V(-2.6, 6.4, -9.4)], false, 'centripetal')
const EPI_LOOK = new THREE.CatmullRomCurve3([V(0.5, 3.2, 15), V(0.2, 3.7, 15), V(0, 4.1, 15)], false, 'centripetal')

export const PROJECT_IDS = PROJECTS.map(p => p.id)
const BEAM_WHITE = new THREE.Color(0.6, 0.76, 1.0)

/** Which world section is driving: the one whose progress is mid-way. */
export function section(s) {
  if (s.epilogue > 0 || s.epiIn > 0) return 'epilogue'
  if (s.four > 0) return 'four'
  if (s.three > 0) return 'three'
  if (s.work > 0 || s.workIn > 0) return 'work'
  return 'prologue'
}

/*
 * Chapter Two, in work progress w:
 *   0    – .045 the hall arrives as an ink drawing on the India chapter's paper; colour blooms from the screen
 *   .07  – .15  the camera walks into the screen
 *   .15  – .85  five films, one slot each; each blooms from ink and washes back to ink before the cut
 *   .85  – .93  back out into the hall
 *   .93  – 1    the hall washes back into ink, as Chapter Three's paper arrives
 */
export const FILMS = [0.15, 0.85]
export function workSlot(w) {
  const f = Math.min(0.9999, Math.max(0, (w - FILMS[0]) / (FILMS[1] - FILMS[0]))) * PROJECT_IDS.length
  return { i: Math.floor(f), t: f - Math.floor(f) }
}
const HALL_REACH = 40 // from the screen to past the booth
const FILM_ORIGIN = V(0, 1.1, 0) // where each film's subject stands
/** A film's own wave: near things first, the painted sky last. */
const filmReach = k => (k < 0.7 ? -2 + (k / 0.7) * 16 : 14 + ((k - 0.7) / 0.3) * 250)

const out = { pos: V(0, 0, 0), target: V(0, 0, 0) }
const inPos = V(0, 0, 0)
const ALONG = V(1, 0, 0) // the journey's path runs along +x
// Each seam's own light (sketch.js): the projector's warm white in the hall, neon in the game, and
// in the films and the journey the hue of whatever the wave reveals.
const PROJECTOR = { tint: '#ffd394', tint2: '#fff3dc', grid: 0.3, shimmer: 0.7 }
const NEON = { tint: '#ff4fc3', tint2: '#4fe3ff', grid: 1, shimmer: 1 }

export function stateAt(s, mouse, aspect) {
  const portrait = aspect < 0.85
  const sec = section(s)
  const st = { pos: out.pos, target: out.target, fov: portrait ? 62 : 40, lamp: 1, pull: 0, swirl: 1, bloom: 1, house: 0, exposure: 3, focus: 9, flare: 1, project: null, card: null, beamColor: BEAM_WHITE, flood: 0, sweep: 0 }

  if (sec === 'prologue') {
    const p = s.prologue
    const u = ss(0.0, 0.88, p)
    PRO_POS.getPoint(u, out.pos)
    PRO_LOOK.getPoint(u, out.target)
    st.lamp = 1 + 7 * ss(0.74, 0.9, p)
    st.pull = ss(0.66, 0.88, p)
    st.swirl = 1 + st.pull * 6
    st.bloom = 1 + 3.2 * ss(0.74, 0.92, p)
    st.flare = 1 + 9 * ss(0.72, 0.9, p)
    st.focus = THREE.MathUtils.lerp(4, 11, ss(0.1, 0.4, p))
    st.flood = ss(0.8, 0.93, p)
    st.sweep = ss(0.9, 0.995, p) * 1.3
    st.card = { key: 'prologue', kicker: 'Now showing', title: 'Tejas Govind' }
    // Clear the air while the camera faces the screen, so the name reads through the beam.
    const facingScreen = ss(0.16, 0.26, p) * (1 - ss(0.42, 0.52, p))
    st.density = 0.6 * (1 - 0.8 * facingScreen)
    st.dust = 1 - 0.7 * facingScreen
    // A booth this close to the lens: the projector's own glow is softer until you leave it.
    st.exposure = 3
  } else if (sec === 'work') {
    const w = s.work
    const seat = portrait ? WORK_POS_PORTRAIT : WORK_POS
    const seatLook = portrait ? WORK_LOOK_PORTRAIT : WORK_LOOK
    inPos.copy(SCREEN).setZ(SCREEN.z - insideDistance(portrait ? 62 : 40, aspect))
    const push = ss(0.07, 0.15, w) * (1 - ss(0.85, 0.93, w))
    const k = push * push * (3 - 2 * push)
    out.pos.copy(seat).lerp(inPos, k)
    out.target.copy(seatLook).lerp(SCREEN, k)
    const { i, t } = workSlot(w)
    st.card = { key: 'work-title', kicker: 'Chapter Two', title: 'Things I built' }
    st.film = { id: PROJECT_IDS[i], inside: push > 0.9995 ? 1 : push }
    st.focus = 15
    st.exposure = 3
    st.lamp = 1.6
    st.density = 0.08 * (1 - push)
    st.dust = 0.05 * (1 - push)
    if (w <= 0) st.sketch = { r: -4, origin: SCREEN, band: 1.6, ...PROJECTOR } // still on the India chapter's paper
    else if (w < 0.05) st.sketch = { r: -4 + ss(0, 0.045, w) * (HALL_REACH + 4), origin: SCREEN, band: 1.6, ...PROJECTOR }
    // ...and the drawing lifts off the page, so the journey can be drawn on it.
    else if (w > 0.93) st.sketch = { r: -4 + ss(0.93, 0.975, w) * (HALL_REACH + 4), origin: SCREEN, band: 1.6, colourBehind: false, ink: 1 - ss(0.975, 0.998, w), ...PROJECTOR }
    else if (st.film.inside >= 1) {
      // Inside: each film blooms out of ink, plays, and washes back to ink before the cut to the next.
      const bloom = ss(0, 0.16, t), wash = ss(0.84, 1, t)
      st.sketch = wash > 0
        ? { r: filmReach(wash), origin: FILM_ORIGIN, band: 0.8, colourBehind: false, grid: 0.7, shimmer: 1 }
        : { r: bloom >= 1 ? 1e5 : filmReach(bloom), origin: FILM_ORIGIN, band: 0.8, grid: 0.7, shimmer: 1 }
    }
  } else if (sec === 'three') {
    // The journey: drawn onto the page, colour blooms around the traveller and travels with him,
    // and at the end the colour recedes and the drawing lifts off the page again.
    const p = s.three
    st.journey = { p }
    const q = ss(0.955, 0.985, p) // the recede; its tail sweeps past the far ground too, so none is left in colour
    const r = THREE.MathUtils.lerp(-6, 3.2, ss(0.025, 0.06, p)) - q * 60 - q ** 6 * 2000
    st.sketch = { follow: true, dir: ALONG, r, band: 1.0, ink: ss(0, 0.02, p) * (1 - ss(0.985, 0.999, p)), grid: 0.3, shimmer: 0.6 }
  } else if (sec === 'four') {
    // Press Start: drawn onto the page around you and blooming into the neon coast; the wave to the
    // block world is the chapter's own (arcade.js); at the end the drawing lifts off for the epilogue.
    const p = s.four
    st.arcade = { p }
    const bloom = ss(0.012, 0.07, p)
    if (bloom < 1) st.sketch = { follow: true, r: -4 + bloom * 70, origin: SCREEN, band: 1.4, ink: ss(0, 0.012, p), ...NEON }
    else if (p > 0.955) st.sketch = { follow: true, r: 70 - ss(0.955, 0.985, p) * 74, origin: SCREEN, band: 1.4, ink: 1 - ss(0.985, 0.999, p), tint: '#8fe3ff', tint2: '#ffffff', grid: 0.8, shimmer: 1 }
  } else {
    const e = s.epilogue
    const u = ss(0.05, 0.85, e)
    EPI_POS.getPoint(u, out.pos)
    EPI_LOOK.getPoint(u, out.target)
    st.house = ss(0.15, 0.55, e)
    st.lamp = 1 - 0.55 * ss(0.1, 0.4, e)
    st.exposure = THREE.MathUtils.lerp(3, 1.6, st.house)
    st.dust = 0.3
    st.density = 0.2 // a thinner beam than the prologue's, so "The End" reads through it
    st.card = { key: 'end', kicker: 'Thank you for watching', title: 'The End' }
    // Arriving from Chapter Three's paper: the hall in ink, then colour from the screen.
    const bloom = ss(0, 0.1, e)
    if (bloom < 1) st.sketch = { r: -4 + bloom * (HALL_REACH + 4), origin: SCREEN, band: 1.6, ink: ss(0, 0.6, s.epiIn), ...PROJECTOR }
  }

  // A hand on the camera: gentle parallax from the pointer.
  out.pos.x += mouse.x * 0.18
  out.pos.y += mouse.y * 0.1
  return st
}

export { LENS }
