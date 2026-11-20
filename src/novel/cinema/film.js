import * as THREE from 'three'
import { loadTraveller, FRAME } from './films/kit'
import { yudhveer } from './films/yudhveer'
import { smash } from './films/smash'
import { cogniflow } from './films/cogniflow'
import { revere } from './films/revere'
import { commitCity } from './films/commitcity'

/*
 * The film that plays on the cinema screen in Chapter Two, and the world you enter when the camera
 * goes into the screen. Each project is its own short, animated scene in an ink-and-paint style,
 * starring the traveller (a stylised Tejas, generated and rigged with Meshy) doing what the project
 * does. Scenes live in ./films/.
 *
 * It renders into `rt` (2.4:1, the screen's aspect) for the hall, or straight to the frame (with a view
 * offset that matches the crop of the screen) once the camera is inside.
 */
export const FILM_ASPECT = 2.4
const SCENES = { 'smash-cricket': smash, cognifight: cogniflow, revere, yudhveer, 'commit-city': commitCity } // keyed by project id

export function createFilm(renderer, { mobile = false, loader }) {
  const W = mobile ? 1152 : 2048
  const rt = new THREE.WebGLRenderTarget(W, Math.round(W / FILM_ASPECT), { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 })
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace

  // Between scenes (or while one loads): black leader.
  const blank = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(30, FILM_ASPECT, 0.1, 10), update() {}, tick() {} }
  blank.scene.background = new THREE.Color('#000')

  let traveller = null
  const scenes = {}
  const loading = {}
  const load = id => (loading[id] ??= (async () => {
    if (!SCENES[id]) return null
    traveller ??= loadTraveller(loader)
    scenes[id] = await SCENES[id]({ traveller: await traveller, mobile })
    return scenes[id]
  })())

  let active = blank, activeId = null, clock = 0, lastT = null
  const out = { scene: blank.scene, camera: blank.camera }

  /** state: { id, time? }: the film playing now; its clock runs from when it came on. */
  function update(state, t) {
    const s = scenes[state.id] ?? blank
    if (state.id !== activeId || s !== active) {
      activeId = state.id
      active = s
      clock = 0
    }
    const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT))
    lastT = t
    clock += dt
    FRAME.portrait = !!state.portrait
    active.tick(dt)
    active.update(state.time ?? clock)
    out.scene = active.scene
    out.camera = active.camera
  }

  function renderToTexture() {
    out.camera.clearViewOffset()
    const prev = renderer.getRenderTarget()
    renderer.setRenderTarget(rt)
    renderer.clear() // the composer turns autoClear off; without this every frame smears into the last
    renderer.render(out.scene, out.camera)
    renderer.setRenderTarget(prev)
  }

  /** Point the film camera at the crop of the frame that a viewport of this aspect sees, filling it. */
  function cropFor(aspect, heightPx) {
    const fullH = heightPx, fullW = heightPx * FILM_ASPECT
    if (aspect <= FILM_ASPECT) out.camera.setViewOffset(fullW, fullH, (fullW - aspect * fullH) / 2, 0, aspect * fullH, fullH)
    else {
      const h = fullW / aspect
      out.camera.setViewOffset(fullW, fullH, 0, (fullH - h) / 2, fullW, h)
    }
  }

  return {
    rt, load, update, renderToTexture, cropFor,
    get scene() { return out.scene },
    get camera() { return out.camera },
  }
}
