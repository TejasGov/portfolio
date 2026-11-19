import '../novel/index.css'
import './lab.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createCinema, STAGE } from '../novel/cinema/world'

// Free-camera inspector for the cinema world. window.cin exposes everything for live tuning.
const VIEWS = {
  1: [[-1.4, 8.0, -14.6], [0.9, 7.5, -11.5]], // booth, beside the projector
  2: [[0.9, 7.9, -10.2], [0, 4.2, 15]], // out of the window, down the beam
  3: [[-7.4, 2.3, 10.5], [0.6, 6.6, -11.4]], // seats, looking back at the booth
  4: [[0, 3.4, 3.2], [0, 3.6, 12]], // mid-hall toward the stage
  5: [[0, 9, 13], [0, 3, -6]], // from the screen
}
const world = await createCinema(document.getElementById('gl'))
const cam = world.camera
const controls = new OrbitControls(cam, document.getElementById('gl'))
const go = k => {
  cam.position.set(...VIEWS[k][0])
  controls.target.set(...VIEWS[k][1])
  controls.update()
}
go(3)
const state = { pos: cam.position, target: controls.target, lamp: 1, pull: 0, swirl: 1, bloom: 1, house: 0, focus: 9, project: null }
addEventListener('keydown', async e => {
  if (VIEWS[e.key]) go(e.key)
  if (e.key === 'h') state.house = state.house ? 0 : 1
  if (e.key === 'p') {
    await world.loadProject('revere')
    state.project = state.project ? null : { id: 'revere', morph: 1, fade: 0, dissolve: 1 }
  }
})
const resize = () => world.resize(innerWidth, innerHeight)
resize()
addEventListener('resize', resize)
const loop = () => {
  controls.update()
  world.render(state)
  requestAnimationFrame(loop)
}
loop()
window.cin = { world, state, go, STAGE, THREE }
