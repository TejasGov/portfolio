import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import Field from './Field'
import Orb from './Orb'
import { HOME, ORB_LINKS, ORB_MARKS, WORK_NOTES } from './anchors'
import { cameraState, chapter, hudState, pixelState, workPosition } from './timeline'
import { store } from '../lib/store'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const v = new THREE.Vector3()
const n = new THREE.Vector3()
const toCam = new THREE.Vector3()

/** Shortest-path angle blend. */
function blendAngle(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a))
  return a + d * t
}

function Rig({ orb, field }) {
  const camera = useThree(s => s.camera)
  const look = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const spin = useRef(0)
  const nodes = useRef(null)
  const frame = useRef(0)

  useFrame((state, delta) => {
    const cam = cameraState(store)
    const k = reduced() ? 1 : 1 - Math.exp(-delta * 3.2)
    camera.position.lerp(target.set(...cam.pos), k)
    look.lerp(target.set(...cam.look), k)
    if (!reduced()) {
      camera.position.x += store.mouse.x * 0.12
      camera.position.y += store.mouse.y * 0.08
    }
    camera.lookAt(look)

    // The orb turns slowly; near the end of the prologue it swings home so Prayagraj faces you.
    const hud = hudState(store)
    if (!reduced()) spin.current += delta * 0.05
    const homeY = (HOME.lon * Math.PI) / 180 - Math.PI / 2
    const homeX = (HOME.lat * Math.PI) / 180
    const o = orb.current
    o.rotation.y = blendAngle(spin.current, homeY, hud.home)
    o.rotation.x = homeX * hud.home
    o.position.set(...pixelState(store).offset)

    const f = field.current
    if (f) f.position.set(...pixelState(store).offset)
    if (f) f.rotation.y = chapter(store) === 'work' && !reduced() ? Math.sin(state.clock.elapsedTime * 0.25) * 0.28 : 0

    project(state, o, f, hud)
  })

  function project(state, o, f, hud) {
    if (!nodes.current) {
      nodes.current = {
        orb: [...document.querySelectorAll('[data-hud="orb"]')],
        home: document.querySelector('[data-hud="home"]'),
        work: [...document.querySelectorAll('[data-hud="work"]')],
        links: [...document.querySelectorAll('[data-hud-link]')],
      }
    }
    const { width, height } = state.size
    const refresh = frame.current++ % 5 === 0 // numbers tick like a readout, not every frame
    const screen = []
    const place = (el, local, obj, alpha, normalCheck) => {
      v.set(...local)
      obj.localToWorld(v)
      let a = alpha
      if (normalCheck) {
        n.set(...local).normalize().transformDirection(obj.matrixWorld)
        toCam.copy(camera.position).sub(v).normalize()
        // Fade out just past the limb, so markers can ride the edge as on the reference plate.
        a *= THREE.MathUtils.smoothstep(n.dot(toCam), -0.12, 0.12)
      }
      v.project(camera)
      const x = (v.x * 0.5 + 0.5) * width
      const y = (-v.y * 0.5 + 0.5) * height
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      el.style.opacity = a.toFixed(3)
      return { x, y, a }
    }
    nodes.current.orb.forEach((el, i) => {
      const s = place(el, ORB_MARKS[i].at, o, hud.orb, true)
      screen.push(s)
      if (refresh && s.a > 0.01) el.querySelector('.hud-label').textContent = `${ORB_MARKS[i].id}  ${Math.round(s.x)}, ${Math.round(s.y)}`
    })
    nodes.current.links.forEach((el, i) => {
      const [a, b] = ORB_LINKS[i]
      el.setAttribute('x1', screen[a].x)
      el.setAttribute('y1', screen[a].y)
      el.setAttribute('x2', screen[b].x)
      el.setAttribute('y2', screen[b].y)
      el.style.opacity = (Math.min(screen[a].a, screen[b].a) * 0.6).toFixed(3)
    })
    place(nodes.current.home, HOME.at, o, hud.home, true)

    const { i, local } = workPosition(store.work)
    nodes.current.work.forEach(el => {
      const s = +el.dataset.shape
      const k = +el.dataset.note
      const on = hud.work && s === i && store.work > 0.06 ? THREE.MathUtils.smoothstep(local, 0.08, 0.2) * (1 - THREE.MathUtils.smoothstep(local, 0.62, 0.72)) : 0
      if (f && on > 0) place(el, WORK_NOTES[s][k].at, f, on, false)
      else el.style.opacity = '0'
    })
  }
  return null
}

function Scene() {
  const orb = useRef()
  const field = useRef()
  const setFrameloop = useThree(s => s.setFrameloop)
  useEffect(() => {
    // Only render while a night chapter is on screen; paper chapters cover the canvas.
    const apply = () => setFrameloop(store.night ? 'always' : 'never')
    const fn = key => key === 'night' && apply()
    store.listeners.add(fn)
    apply()
    return () => store.listeners.delete(fn)
  }, [setFrameloop])

  return (
    <>
      <color attach="background" args={['#03050b']} />
      <group ref={orb}>
        <Orb group={orb} />
      </group>
      <group ref={field}>
        <Field />
      </group>
      <Rig orb={orb} field={field} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.72} luminanceSmoothing={0.22} radius={0.7} />
        <ChromaticAberration offset={new THREE.Vector2(0.0012, 0.0012)} radialModulation modulationOffset={0.35} />
        <Noise opacity={0.055} premultiply blendFunction={BlendFunction.SCREEN} />
        <Vignette offset={0.22} darkness={0.72} />
      </EffectComposer>
    </>
  )
}

export default function Stage() {
  return (
    <Canvas
      className="stage"
      style={{ position: 'fixed', inset: 0 }}
      dpr={[1, 1.75]}
      camera={{ fov: 38, near: 0.05, far: 100, position: [0, 3.6, 8.2] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <Scene />
    </Canvas>
  )
}
