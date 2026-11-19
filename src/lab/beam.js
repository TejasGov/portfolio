import '../novel/index.css'
import './lab.css'
import * as THREE from 'three'
import Lenis from 'lenis'
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ChromaticAberrationEffect, NoiseEffect,
  VignetteEffect, ToneMappingEffect, ToneMappingMode, BlendFunction,
} from 'postprocessing'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { noiseVolume, beamFrame, VolumetricPass, makeDust, glowTexture, smooth } from '../novel/cinema/core'
import { createPixelSweep } from '../novel/cinema/sweep'

/*
 * Prologue sandbox: a dark cinema, one projector port, its beam through haze, dust in the beam.
 * Scroll rises into the light until it blooms blue-white, then the light breaks into paper pixels.
 */
const mobile = matchMedia('(max-width: 760px)').matches
const canvas = document.getElementById('gl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, powerPreference: 'high-performance' })
const dpr = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75)
renderer.setPixelRatio(dpr)
renderer.outputColorSpace = THREE.SRGBColorSpace
RectAreaLightUniformsLib.init()

const scene = new THREE.Scene()
scene.background = new THREE.Color('#020308')
scene.fog = new THREE.FogExp2('#03050b', 0.045)
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120)

// --- The hall -------------------------------------------------------------------------------
const PORT = new THREE.Vector3(0.9, 7.6, -11.4)
const SCREEN = new THREE.Vector3(0, 3.6, 15)
const beam = beamFrame(PORT, SCREEN, 0.27, 0.115, 0.3)

const wallMat = new THREE.MeshStandardMaterial({ color: '#0b0d13', roughness: 0.92 })
const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), wallMat)
wall.position.set(0, 6, -11.5)
scene.add(wall)
for (const x of [-11, 11]) {
  const side = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), wallMat)
  side.position.set(x, 6, 4)
  side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2
  scene.add(side)
}
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(24, 40), wallMat)
ceiling.position.set(0, 12.5, 4)
ceiling.rotation.x = Math.PI / 2
scene.add(ceiling)
// Raked floor: rows climb toward the booth.
const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 18.4), new THREE.MeshStandardMaterial({ color: '#08070a', roughness: 1 }))
floor.position.set(0, 2.45, -2.75)
floor.rotation.x = -Math.PI / 2 + Math.atan(5.9 / 17.5)
scene.add(floor)

// Velvet seats, instanced. One seat = back + cushion + arm, facing the screen (+z).
const back = new RoundedBoxGeometry(0.52, 0.68, 0.13, 3, 0.05)
back.rotateX(-0.2)
back.translate(0, 0.66, -0.2)
const cushion = new RoundedBoxGeometry(0.5, 0.13, 0.46, 2, 0.04)
cushion.translate(0, 0.36, 0.03)
const arm = new RoundedBoxGeometry(0.07, 0.09, 0.52, 2, 0.025)
arm.translate(0.29, 0.62, -0.02)
const seatGeo = mergeGeometries([back, cushion, arm])
const seatMat = new THREE.MeshStandardMaterial({ color: '#2a0710', roughness: 0.62, sheen: 1, sheenColor: new THREE.Color('#ff6a7a') })
const ROWS = 15, COLS = 30
const seats = new THREE.InstancedMesh(seatGeo, seatMat, ROWS * COLS)
const m = new THREE.Matrix4()
let n = 0
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x = (c - (COLS - 1) / 2) * 0.58 + (c >= COLS / 2 ? 0.6 : -0.6) // centre aisle
    const z = 4.4 - r * 1.02 + x * x * 0.006
    const y = r * 0.346 + 0.02 * Math.sin(r * 3.1 + c)
    m.makeRotationY(-x * 0.012).setPosition(x, y, z)
    seats.setMatrixAt(n++, m)
  }
}
scene.add(seats)

// Warm points in the dark: aisle step lights and wall sconces. They bloom into soft bokeh.
const lamps = []
for (let r = 0; r < ROWS; r++) for (const x of [-0.55, 0.55]) lamps.push([x, r * 0.346 + 0.06, 4.9 - r * 1.02, 0.05])
for (let i = 0; i < 6; i++) for (const x of [-10.9, 10.9]) lamps.push([x, 3.6 + i * 0.25, 6 - i * 3.2, 0.16])
const lampMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.5, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0.2).multiplyScalar(2.2), toneMapped: false, fog: false }), lamps.length)
lamps.forEach(([x, y, z, s], i) => {
  m.makeScale(s, s, s).setPosition(x, y, z)
  lampMesh.setMatrixAt(i, m)
})
scene.add(lampMesh)

// The port: the only light in the room that matters.
const port = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.92, 1).multiplyScalar(9), toneMapped: false, fog: false }))
port.position.copy(PORT).add(new THREE.Vector3(0, 0, 0.05))
scene.add(port)

const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('radial'), color: new THREE.Color(0.7, 0.82, 1).multiplyScalar(2.2), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, fog: false }))
flare.scale.setScalar(5)
flare.position.copy(port.position).add(new THREE.Vector3(0, 0, 0.1))
scene.add(flare)
const streak = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('streak'), color: new THREE.Color(0.35, 0.6, 1).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, fog: false }))
streak.scale.set(16, 0.22, 1)
streak.position.copy(flare.position)
scene.add(streak)

// Light: the screen washes the seat fronts; the beam itself spills from the port.
const screenLight = new THREE.RectAreaLight('#a9c6ff', 1.1, 18, 7.5)
screenLight.position.copy(SCREEN)
screenLight.lookAt(0, 2.5, 0)
scene.add(screenLight)
const spill = new THREE.SpotLight('#cfe0ff', 900, 0, Math.atan(0.3), 0.6, 2)
spill.position.copy(PORT)
spill.target.position.copy(PORT).addScaledVector(beam.axis, 10)
scene.add(spill, spill.target)
scene.add(new THREE.HemisphereLight('#1b2540', '#060405', 0.08))

// Dust: the pixel vortex, now living in the light.
const dust = makeDust(mobile ? 8000 : 15000, beam, new THREE.Box3(new THREE.Vector3(-10, 0, -11), new THREE.Vector3(10, 12, 12)))
dust.material.uniforms.uDpr.value = dpr
scene.add(dust)

// --- Post -----------------------------------------------------------------------------------
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
composer.addPass(new RenderPass(scene, camera))
const vol = new VolumetricPass(camera, beam, noiseVolume(64), { scale: 0.5, steps: mobile ? 26 : 48 })
composer.addPass(vol)
const bloom = new BloomEffect({ mipmapBlur: true, intensity: 1.0, luminanceThreshold: 0.32, luminanceSmoothing: 0.3, radius: 0.74 })
const ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0009, 0.0006), radialModulation: true, modulationOffset: 0.25 })
const grain = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT })
grain.blendMode.opacity.value = 0.16
composer.addPass(new EffectPass(camera, ca, bloom, new ToneMappingEffect({ mode: ToneMappingMode.AGX }), new VignetteEffect({ offset: 0.28, darkness: 0.72 }), grain))

// --- Camera path ----------------------------------------------------------------------------
const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-7.4, 2.3, 10.5),
  new THREE.Vector3(-6.8, 4.0, 3.8),
  new THREE.Vector3(-3.6, 6.2, -3.6),
  new THREE.Vector3(0.82, 7.45, -9.6),
])
const look = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.4, 6.1, -11),
  new THREE.Vector3(1.2, 6.4, -11.4),
  new THREE.Vector3(1.0, 7.3, -11.4),
  new THREE.Vector3(0.9, 7.6, -11.4),
])
const target = new THREE.Vector3()

function resize() {
  const w = innerWidth, h = innerHeight
  renderer.setSize(w, h, false)
  composer.setSize(w, h)
  camera.aspect = w / h
  camera.fov = w / h < 0.75 ? 62 : w / h < 1.1 ? 52 : 42
  camera.updateProjectionMatrix()
}
resize()
addEventListener('resize', resize)

// --- Scroll choreography --------------------------------------------------------------------
const lenis = new Lenis({ lerp: 0.085 })
const track = document.getElementById('track')
const sweep = createPixelSweep(document.getElementById('px'), { origin: [0.5, 0.45] })
vol.uniforms.uDensity.value = 1.4
const beats = [...document.querySelectorAll('[data-beat]')]
const cue = document.getElementById('cue')
const flood = Object.assign(document.createElement('div'), { className: 'flood' })
flood.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;opacity:0'
document.body.append(flood)

// [in-start, in-end, out-start, out-end] in scroll progress.
const WINDOWS = [[-1, -1, 0.06, 0.14], [0.17, 0.22, 0.3, 0.36], [0.38, 0.44, 0.56, 0.62], [0.92, 0.97, 9, 9]]
const mouse = new THREE.Vector2()
addEventListener('pointermove', e => mouse.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5))
const eased = new THREE.Vector2()
const clock = new THREE.Clock()
const pv = new THREE.Vector3()

function frame(t) {
  lenis.raf(t)
  const max = track.offsetHeight - innerHeight
  const s = Math.min(1, Math.max(0, scrollY / max))
  const time = clock.getElapsedTime()

  beats.forEach((el, i) => {
    const [a, b, c, d] = WINDOWS[i]
    const o = Math.min(a < 0 ? 1 : smooth(a, b, s), 1 - smooth(c, d, s))
    el.style.opacity = o.toFixed(3)
    el.style.filter = o < 0.999 ? `blur(${((1 - o) * 14).toFixed(1)}px)` : 'none'
    el.style.transform = `translateY(${((1 - o) * (i === 3 ? 0 : 14)).toFixed(1)}px) scale(${(1 + (1 - o) * 0.04).toFixed(3)})`
  })
  cue.style.opacity = (0.6 * (1 - smooth(0.02, 0.06, s))).toFixed(3)

  // The light takes over: dust streams into the lamp, the lamp swells, the frame floods blue-white.
  const lamp = 1 + 7 * smooth(0.6, 0.86, s)
  const pull = smooth(0.56, 0.84, s)
  const whiteout = smooth(0.74, 0.9, s)
  const sweepP = smooth(0.84, 0.99, s) * 1.3

  const live = sweepP < 1.25
  if (live) {
    eased.lerp(mouse, 0.05)
    const u = smooth(0.1, 0.88, s)
    path.getPointAt(u, camera.position)
    look.getPointAt(u, target)
    camera.position.x += eased.x * 0.5 * (1 - u)
    camera.position.y -= eased.y * 0.3 * (1 - u)
    camera.lookAt(target)

    vol.uniforms.uTime.value = time
    vol.uniforms.uLamp.value = lamp
    const du = dust.material.uniforms
    du.uTime.value = time
    du.uLamp.value = lamp
    du.uPull.value = pull
    du.uSwirl.value = 1 + pull * 6
    du.uFocus.value = camera.position.distanceTo(PORT) * (0.55 - 0.25 * u)
    bloom.intensity = 1.0 + 3.5 * smooth(0.62, 0.9, s)
    flare.material.color.setRGB(0.7, 0.82, 1).multiplyScalar(2.2 + 14 * smooth(0.6, 0.88, s))
    streak.scale.set(16 + 50 * smooth(0.6, 0.9, s), 0.22 + 0.5 * smooth(0.7, 0.9, s), 1)
    composer.render()

    // The flood is centred on the port wherever it sits on screen.
    pv.copy(PORT).project(camera)
    const fx = (pv.x * 0.5 + 0.5) * 100, fy = (0.5 - pv.y * 0.5) * 100
    const r = 10 + 160 * whiteout
    flood.style.opacity = smooth(0.66, 0.8, s).toFixed(3)
    flood.style.background = `radial-gradient(circle at ${fx}% ${fy}%, #ffffff 0, #dce9ff ${r * 0.18}vmax, rgb(120 170 255 / ${0.95 * whiteout}) ${r * 0.55}vmax, rgb(36 86 230 / ${0.9 * whiteout}) ${r * 0.85}vmax, rgb(20 50 160 / 0) ${r}vmax)`
  }
  sweep.draw(sweepP, time)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
// Live tuning from devtools while the sandbox is under review.
window.lab = { vol, bloom, dust, grain, camera, scene, seatMat, screenLight, spill, flare, streak }

