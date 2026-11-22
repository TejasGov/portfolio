import * as THREE from 'three'
import { PROJECTS } from '../content'
import { LENS, SCREEN, insideDistance, CARDS } from './world'
import { BACK, LAST as FOUR_LAST, levelAt } from './levels'
import * as five from './movies'

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
// Your seat, where a game or a film is left on the screen: Four's and Five's back-outs end here, Five's push-in starts here.
const SEAT_POS = EPI_POS.getPoint(0), SEAT_LOOK = EPI_LOOK.getPoint(0)

export const PROJECT_IDS = PROJECTS.map(p => p.id)
const BEAM_WHITE = new THREE.Color(0.6, 0.76, 1.0)

/** Which world section is driving: the one whose progress is mid-way. */
export function section(s) {
  if (s.epilogue > 0 || s.epiIn > 0) return 'epilogue'
  if (s.five > 0) return 'five'
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
// The hall's bloom front, measured so the share of the frame in colour grows evenly with scroll (it is
// mostly the screen and the hall within ~14 of it), at 1440x900 and 390x844; past 30 it is behind the camera.
const HALL_BLOOM = [-6, 2, 4.4, 6.3, 7.7, 8.9, 10, 11.4, 13.6, 18.8, 22.1, 30, HALL_REACH]
const hallBloom = t => {
  const x = Math.min(1, Math.max(0, t)) * (HALL_BLOOM.length - 1), i = Math.min(HALL_BLOOM.length - 2, Math.floor(x))
  return THREE.MathUtils.lerp(HALL_BLOOM[i], HALL_BLOOM[i + 1], x - i)
}
const filmReach = k => (k < 0.7 ? -2 + (k / 0.7) * 16 : 14 + ((k - 0.7) / 0.3) * 250)

const out = { pos: V(0, 0, 0), target: V(0, 0, 0) }
const inPos = V(0, 0, 0)
const ALONG = V(1, 0, 0) // the journey's path runs along +x
const R3 = 30 // the journey's front runs this far ahead of the traveller: past the right edge, far ground included
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
    st.lamp = 1 + 7 * ss(0.7, 0.82, p)
    st.pull = ss(0.62, 0.84, p)
    st.swirl = 1 + st.pull * 6
    st.bloom = 1 + 3.2 * ss(0.7, 0.84, p)
    st.flare = 1 + 9 * ss(0.68, 0.82, p)
    st.focus = THREE.MathUtils.lerp(4, 11, ss(0.1, 0.4, p))
    // A short flash: the flood is up by .82, then the pixel front crosses it and the screen is all
    // paper (>= 1.25) by p ~.89, just as Chapter One's title (rising from p ~.76, --one-overlap) arrives.
    st.flood = ss(0.72, 0.82, p)
    st.sweep = ss(0.79, 0.9, p) * 1.3
    st.card = { key: 'prologue', kicker: 'Now showing', title: 'Tejas Govind' }
    // Clear the air while the camera faces the screen, so the name reads through the beam.
    const facingScreen = ss(0.16, 0.26, p) * (1 - ss(0.42, 0.52, p))
    st.density = 0.6 * (1 - 0.8 * facingScreen)
    st.dust = 1 - 0.7 * facingScreen
    // A booth this close to the lens: the projector's own glow is softer until you leave it.
    st.exposure = 3
    // A portrait frame is mostly the dark hall around a thin beam: widen, thicken, brighten and lift it
    // there (the lift waits until the name has left the screen, so the title card keeps its framing).
    if (portrait) {
      const w = ss(0.22, 0.3, p) * (1 - ss(0.66, 0.74, p))
      st.fov = 62 + 10 * w
      st.density = (0.6 + 0.6 * w) * (1 - 0.8 * facingScreen)
      st.lamp *= 1 + 2.2 * w
      st.exposure = 3 + 3 * w
      out.target.y += 2.5 * w * (1 - facingScreen)
    }
  } else if (sec === 'work') {
    const w = s.work
    const seat = portrait ? WORK_POS_PORTRAIT : WORK_POS
    const seatLook = portrait ? WORK_LOOK_PORTRAIT : WORK_LOOK
    inPos.copy(SCREEN).setZ(SCREEN.z - insideDistance(portrait ? 62 : 40, aspect))
    const push = ss(0.075, 0.15, w) * (1 - ss(0.85, 0.93, w))
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
    // Still on the India chapter's paper: the drawing inks itself onto it as One leaves, never shown shredded.
    // Full ink early: wherever One's paper has already uncovered the hall, the drawing is there.
    if (w <= 0) st.sketch = { r: -4, origin: SCREEN, band: 1.6, ink: ss(0.08, 0.4, s.workIn), ...PROJECTOR }
    // A wide, soft front over ~half a screen of scroll: light spreading from the screen, not a cut. raw: the
    // colour it reveals is the hall exactly as it stays after the seam, so its end is not a jump in brightness.
    else if (w < 0.07) st.sketch = { r: hallBloom(w / 0.065), origin: SCREEN, band: 3.0, raw: true, ...PROJECTOR }
    // ...and the drawing lifts off the page, so the journey can be drawn on it.
    else if (w > 0.93) st.sketch = { r: -4 + ss(0.93, 0.97, w) * (HALL_REACH + 4), origin: SCREEN, band: 1.6, colourBehind: false, ink: 1 - ss(0.985, 0.999, w), ...PROJECTOR }
    // Reduced motion: no ink wave between films, they cut straight.
    else if (st.film.inside >= 1 && !s.still) {
      // Inside: each film blooms out of ink, plays, and washes back to ink before the cut to the next.
      // The first film is already on the screen in colour during the push, so it does not restart from ink.
      const bloom = i === 0 ? 1 : ss(0, 0.05, t), wash = ss(0.91, 1, t)
      st.sketch = wash > 0
        ? { r: filmReach(wash), origin: FILM_ORIGIN, band: 0.8, colourBehind: false, grid: 0.7, shimmer: 1 }
        : { r: bloom >= 1 ? 1e5 : filmReach(bloom), origin: FILM_ORIGIN, band: 0.8, grid: 0.7, shimmer: 1 }
    }
  } else if (sec === 'three') {
    // The journey: drawn onto the page, colour blooms around the traveller and travels with him,
    // and at the end the colour recedes to a faint drawing that Chapter Four's drawing replaces (never bare paper).
    const p = s.three
    st.journey = { p }
    const q = ss(0.97, 0.99, p) // the recede; its tail sweeps past the far ground too, so none is left in colour
    const r = THREE.MathUtils.lerp(-6, R3, ss(0.025, 0.06, p)) - q * 60 - q ** 6 * 2000
    st.sketch = { follow: true, dir: ALONG, r, band: 1.0, ink: ss(0, 0.02, p) * (1 - 0.65 * ss(0.99, 0.999, p)), grid: 0.3, shimmer: 0.6, tint: '#3b2f22', tint2: '#7a6448' } // an ink crest, not the grass's lime
  } else if (sec === 'four') {
    // Press Start: drawn onto the page around you and blooming into the neon coast; the wave to the
    // block world is the coast's own (arcade.js), then clouds to the village and a console boot to
    // night ops (levels.js: one world at a time, swapped under a covering transition). It ends as a
    // film does: the game is on the cinema's screen, and the camera backs out of it to your seat in
    // the hall, where Chapter Five begins.
    const p = s.four
    st.game = levelAt(p, s.still) // { level, p (the level's own), kind, phase, cover }
    st.game.still = s.still // reduced motion: the wave and the transitions are cuts
    const ap = st.game.i === 0 ? st.game.p : 1 // the coast's own progress, for its opening seam
    const bloom = ss(0.012, 0.07, ap)
    if (bloom < 1) st.sketch = { follow: true, r: -4 + bloom * 70, origin: SCREEN, band: 1.4, ink: 0.35 + 0.65 * ss(0, 0.012, ap), ...NEON }
    else if (p > BACK) {
      const back = ss(BACK, 0.995, p)
      st.game.onScreen = true
      st.game.back = back
      inPos.copy(SCREEN).setZ(SCREEN.z - insideDistance(st.fov, aspect)) // where the screen exactly fills the frame
      out.pos.copy(inPos).lerp(SEAT_POS, back)
      out.target.copy(SCREEN).lerp(SEAT_LOOK, back)
      Object.assign(st, { focus: 15, exposure: 3, lamp: 1.6, density: 0.08 * back, dust: 0.05 * back })
    }
  } else if (sec === 'five') {
    // The Big Screen. It opens where Four left you, in your seat with Four's last world on the screen:
    // that fades to black, the projector flares white for a new reel and goes dark, the swing comes up on
    // the screen and the camera pushes into it. Inside, six worlds swap under covering transitions
    // (movies.js). It ends as a film does: the dance plays on the screen and the camera backs out of it
    // to your seat, where the epilogue begins.
    const P = s.five
    const IN = five.LEVELS[0].walk[0] // inside the screen from here
    // The hall's moves keep their length in svh as the chapter grows: timed in the three-world chapter's
    // P (where the push-in ended at 0.06 and the back-out ran 0.93..1), mapped from today's.
    const p = P < IN ? (P / IN) * 0.06 : P > five.BACK ? 0.93 + ((P - five.BACK) / (1 - five.BACK)) * 0.07 : P
    inPos.copy(SCREEN).setZ(SCREEN.z - insideDistance(st.fov, aspect))
    if (P < IN) {
      const push = ss(0.035, 0.06, p)
      // The screen's own light: the lamp dims with Four's world (so the bare screen is dark when it goes),
      // flares on the white leader, goes dark again, and is back under the dive (lighting only the haze).
      const flare = ss(0.012, 0.017, p) * (1 - ss(0.019, 0.025, p))
      st.game = p < 0.0125
        ? { level: FOUR_LAST, p: 1, onScreen: true, show: 1 - ss(0.002, 0.012, p) }
        : { level: five.FIRST, p: 0, onScreen: true, show: ss(0.025, 0.035, p), back: 1 - push }
      st.game.still = s.still
      st.card = CARDS.leader // Five's new reel: a blank white leader, which the projector flares on
      out.pos.copy(SEAT_POS).lerp(inPos, push)
      out.target.copy(SEAT_LOOK).lerp(SCREEN, push)
      Object.assign(st, {
        focus: 15, exposure: 3, lamp: 1.6 * (1 - ss(0.002, 0.012, p)) + 9 * flare + 1.6 * ss(0.025, 0.035, p),
        density: (0.08 + 0.3 * flare) * (1 - push), dust: (0.05 + 0.2 * flare) * (1 - push), bloom: 1 + 1.5 * flare,
      })
    } else if (P > five.BACK) {
      const back = ss(0.93, 0.995, p)
      st.game = { level: five.LAST, p: 1, onScreen: true, back, still: s.still }
      out.pos.copy(inPos).lerp(SEAT_POS, back)
      out.target.copy(SCREEN).lerp(SEAT_LOOK, back)
      Object.assign(st, { focus: 15, exposure: 3, lamp: 1.6, density: 0.08 * back, dust: 0.05 * back })
    } else {
      st.game = five.levelAt(P, s.still) // { level, p (the world's own), kind, phase, cover }
      st.game.still = s.still // reduced motion: the transitions are cuts, the suit-up is shown finished
    }
    st.game.pointer = mouse // the eased pointer, for a world's own parallax (the swing's perch)
  } else {
    const e = s.epilogue
    const u = ss(0.05, 1.0, e) // the dolly runs to the last frame, so the house never freezes under the panel
    EPI_POS.getPoint(u, out.pos)
    EPI_LOOK.getPoint(u, out.target)
    const up = ss(0.08, 0.6, e)
    // The house lights wash the screen (their light floors its dark field), so they stop at 45%, the hall's
    // exposure holds it bright, and the projector rises well above them while the beam's haze and bloom
    // thin out: "The End" stays lit on a dark field. The screen keeps "The End": the address lives only
    // in the contact card below it (Epilogue.jsx), so it is never shown twice.
    // The projector leads the house, on the arrival: the lamp is up and haze, dust and bloom are cleared
    // by the time the epilogue is 40% risen, so "The End" is lit as the contact card arrives below it.
    const lampUp = ss(0.12, 0.4, s.epiIn)
    st.house = 0.45 * up
    st.lamp = 1 + 17 * lampUp // bright enough that the title reads near white; the field below is darker to match
    st.exposure = THREE.MathUtils.lerp(3, 2.6, up)
    st.dust = 0.3 * (1 - 0.8 * lampUp)
    st.density = 0.2 * (1 - lampUp) // a thinner beam than the prologue's, so the card reads through it
    st.bloom = 1 - 0.8 * lampUp
    st.card = CARDS.end
    // Arriving from Chapter Five's back-out: the final is still on the screen; it fades out as the
    // epilogue rises, and "The End" comes up behind it.
    const fade = 1 - ss(0.08, 0.3, s.epiIn) // off the screen before the title is fully lit
    if (fade > 0) st.game = { level: five.LAST, p: 1, onScreen: true, show: fade }
  }

  // A hand on the camera: gentle parallax from the pointer.
  out.pos.x += mouse.x * 0.18
  out.pos.y += mouse.y * 0.1
  return st
}

export { LENS }
