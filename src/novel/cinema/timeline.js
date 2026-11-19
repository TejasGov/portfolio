import * as THREE from 'three'
import { PROJECTS } from '../content'
import { PROJECT_MODELS, LENS } from './world'

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

// Chapter Two: a seat in the middle of the hall, the stage in front of the screen.
const WORK_POS = V(0, 3.05, 5.9)
const WORK_LOOK = V(1.25, 3.6, 12) // +x is screen-left when facing the screen: the object sits right of the card
const WORK_POS_PORTRAIT = V(0, 3.2, 3.2)
const WORK_LOOK_PORTRAIT = V(0, 3.0, 12)
// Epilogue: back up the rake as the house lights come up.
const EPI_POS = new THREE.CatmullRomCurve3([V(0, 3.05, 5.9), V(-1.2, 4.6, -2.5), V(-2.6, 6.4, -8.4)], false, 'centripetal')
const EPI_LOOK = new THREE.CatmullRomCurve3([V(1.25, 3.6, 12), V(0, 3.9, 14), V(0, 4.1, 15)], false, 'centripetal')

export const PROJECT_IDS = PROJECTS.map(p => p.id)
const tints = Object.fromEntries(PROJECT_IDS.map(id => [id, new THREE.Color(PROJECT_MODELS[id].tint).lerp(new THREE.Color('#9ec2ff'), 0.45)]))
const BEAM_WHITE = new THREE.Color(0.6, 0.76, 1.0)

/** Which world section is driving: the one whose progress is mid-way. */
export function section(s) {
  if (s.epilogue > 0) return 'epilogue'
  if (s.work > 0) return 'work'
  return 'prologue'
}

/** Progress through one project within Chapter Two (0..1 each), plus its index. */
export function workSlot(w) {
  const f = Math.min(0.9999, Math.max(0, (w - 0.07) / 0.93)) * PROJECT_IDS.length
  return { i: Math.floor(f), t: f - Math.floor(f) }
}

const out = { pos: V(0, 0, 0), target: V(0, 0, 0) }

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
    // A booth this close to the lens: the projector's own glow is softer until you leave it.
    st.exposure = 3
  } else if (sec === 'work') {
    const w = s.work
    out.pos.copy(portrait ? WORK_POS_PORTRAIT : WORK_POS)
    out.target.copy(portrait ? WORK_LOOK_PORTRAIT : WORK_LOOK)
    const { i, t } = workSlot(w)
    const id = PROJECT_IDS[i]
    if (w < 0.07) {
      st.card = { key: 'work-title', kicker: 'Chapter Two', title: 'Things I built' }
    } else {
      const p = PROJECTS[i]
      const m = PROJECT_MODELS[id]
      st.card = { key: id, kicker: `${String(i + 1).padStart(2, '0')} / ${String(PROJECT_IDS.length).padStart(2, '0')} · ${p.category}`, title: p.title, field: m.field }
      // Dust streams down the beam and condenses (0–.35), the shell glows (.3–.5), the solid dissolves in
      // (.42–.7), holds, then breaks back into dust for the next reel (.9–1).
      const out1 = ss(0.9, 1, t)
      st.project = {
        id,
        morph: ss(0.02, 0.38, t) * (1 - out1),
        fade: ss(0.0, 0.08, t) * (1 - ss(0.6, 0.74, t)) + out1 * 0.6,
        dissolve: ss(0.42, 0.72, t) * (1 - out1),
        spin: -0.3 + t * 0.6 + mouse.x * 0.3,
      }
      st.beamColor = tints[id]
    }
    st.focus = 8.5
    st.exposure = 3
    // Sitting under the beam: thinner haze and a dimmer lamp so the screened object stays the subject.
    st.density = 0.26
    st.lamp = 0.65
  } else {
    const e = s.epilogue
    const u = ss(0.05, 0.85, e)
    EPI_POS.getPoint(u, out.pos)
    EPI_LOOK.getPoint(u, out.target)
    st.house = ss(0.15, 0.55, e)
    st.lamp = 1 - 0.55 * ss(0.1, 0.4, e)
    st.exposure = THREE.MathUtils.lerp(3, 1.6, st.house)
    st.card = { key: 'end', kicker: 'Thank you for watching', title: 'The End' }
  }

  // A hand on the camera: gentle parallax from the pointer.
  out.pos.x += mouse.x * 0.18
  out.pos.y += mouse.y * 0.1
  return st
}

export { LENS }
