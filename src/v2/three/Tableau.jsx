import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { inkOutlineMaterial, palette, pixelMorphMaterial, toonMaterial } from './inkMaterials'
import { buildObject } from './objects'

const POINTS = 7000
const PLINTH_TOP = 0.525
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Normalised pointer position (-1..1), shared by every tableau. */
const pointer = { x: 0, y: 0 }
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', e => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1
    pointer.y = (e.clientY / innerHeight) * 2 - 1
  }, { passive: true })
}

/** Surface samples for one object, sorted bottom-to-top so morphs flow upward instead of scrambling. */
function sampleObject(def) {
  const pos = new Float32Array(POINTS * 3)
  const nor = new Float32Array(POINTS * 3)
  const col = new Float32Array(POINTS * 3)
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  const total = def.parts.reduce((s, part) => s + part.weight, 0)
  let i = 0
  def.parts.forEach((part, idx) => {
    const count = idx === def.parts.length - 1 ? POINTS - i : Math.round((POINTS * part.weight) / total)
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(part.position ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0]))),
      new THREE.Vector3(1, 1, 1),
    )
    const g = part.geometry.clone().applyMatrix4(m)
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(g)).build()
    for (let k = 0; k < count; k++, i++) {
      sampler.sample(p, n)
      p.toArray(pos, i * 3)
      n.toArray(nor, i * 3)
      part.color.toArray(col, i * 3)
    }
    g.dispose()
  })
  const order = [...Array(POINTS).keys()].sort((a, b) => pos[a * 3 + 1] - pos[b * 3 + 1])
  const pick = arr => {
    const out = new Float32Array(arr.length)
    order.forEach((src, dst) => out.set(arr.subarray(src * 3, src * 3 + 3), dst * 3))
    return out
  }
  return { pos: pick(pos), nor: pick(nor), col: pick(col) }
}

/** Which object is showing, and whether we're mid-morph, for a scroll progress p in 0..1. */
function morphState(p, count) {
  const f = THREE.MathUtils.clamp((p - 0.06) / 0.88, 0, 1) * (count - 1)
  const i = Math.min(Math.floor(f), count - 2)
  const k = (f - i - 0.2) / 0.6 // morph occupies the middle 60% between two stops
  return { from: i, to: i + 1, k, dominant: Math.round(f) }
}

function Plinth({ geo, mat }) {
  return (
    <group>
      <mesh geometry={geo.shadow} rotation-x={-Math.PI / 2} position={[0.28, -0.52, -0.18]} scale={[1.35, 1.05, 1]}>
        <meshBasicMaterial color={palette.ink} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh geometry={geo.plinth} material={mat.plinth} />
      <mesh geometry={geo.plinth} material={mat.plinthLine} />
      {/* Material hidden, not the mesh: a hidden mesh would hide its Edges child too. */}
      <mesh>
        <boxGeometry args={[1.7, 1.05, 1.7]} />
        <meshBasicMaterial visible={false} />
        <Edges lineWidth={1.4} threshold={20} color={palette.ink} />
      </mesh>
    </group>
  )
}

/**
 * A still life: plinth plus one or more objects. With several objects it scroll-morphs through them
 * inside `sectionId`, dissolving each into grid-locked pixels that re-form as the next.
 */
export default function Tableau({ objects = ['orb'], sectionId, onIndex }) {
  const group = useRef()
  const objectRefs = useRef([])
  const points = useRef()
  const pair = useRef('')
  const lastIndex = useRef(-1)

  const geo = useMemo(() => ({
    plinth: new RoundedBoxGeometry(1.7, 1.05, 1.7, 4, 0.05),
    shadow: new THREE.CircleGeometry(1, 48),
  }), [])
  const mat = useMemo(() => ({ plinth: toonMaterial(), plinthLine: inkOutlineMaterial({ width: 0.022 }) }), [])
  const defs = useMemo(() => objects.map(buildObject), [objects])
  const morphs = objects.length > 1
  const samples = useMemo(() => (morphs ? defs.map(sampleObject) : null), [defs, morphs])
  const cloud = useMemo(() => {
    if (!morphs) return null
    const g = new THREE.BufferGeometry()
    const attr = size => new THREE.BufferAttribute(new Float32Array(POINTS * size), size)
    g.setAttribute('position', attr(3))
    g.setAttribute('normal', attr(3))
    g.setAttribute('aTo', attr(3))
    g.setAttribute('aNormTo', attr(3))
    g.setAttribute('aColFrom', attr(3))
    g.setAttribute('aColTo', attr(3))
    g.setAttribute('aRand', new THREE.BufferAttribute(Float32Array.from({ length: POINTS }, Math.random), 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 3)
    return { geometry: g, material: pixelMorphMaterial() }
  }, [morphs])

  useEffect(() => () => {
    Object.values(geo).forEach(g => g.dispose())
    Object.values(mat).forEach(m => m.dispose())
    defs.forEach(d => d.dispose())
    cloud?.geometry.dispose()
    cloud?.material.dispose()
  }, [geo, mat, defs, cloud])

  useFrame((state, delta) => {
    const still = reducedMotion()
    const t = state.clock.elapsedTime

    // Narrow slots (phones) pull the camera back so the 3.1-unit-wide still life always fits.
    const cam = state.camera
    const z = Math.max(8.4, 1.55 / (Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect))
    if (Math.abs(cam.position.z - z) > 0.01) {
      cam.position.z = z
      cam.lookAt(0, 0.85, 0)
    }

    if (!still) {
      for (const m of Object.values(mat)) m.uniforms.uTime.value = t
      defs.forEach(d => d.parts.forEach(p => {
        p.material.uniforms.uTime.value = t
        if (p.hull) p.hull.uniforms.uTime.value = t
      }))
      const g = group.current
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, -0.35 + pointer.x * 0.12, 3, delta)
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, pointer.y * 0.04, 3, delta)
    }

    if (!morphs) {
      const obj = objectRefs.current[0]
      if (defs[0].bob && !still) {
        obj.position.y = Math.sin(t * 0.8) * 0.06
        obj.rotation.y += delta * 0.08
      }
      return
    }

    // Progress through the (sticky) section: 0 when it reaches the top, 1 when it's about to leave.
    const el = document.getElementById(sectionId)
    if (!el) return
    const r = el.getBoundingClientRect()
    const p = THREE.MathUtils.clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1)
    const { from, to, k, dominant } = morphState(p, defs.length)

    if (dominant !== lastIndex.current) {
      lastIndex.current = dominant
      onIndex?.(dominant)
    }

    const morphing = k > 0 && k < 1
    objectRefs.current.forEach((o, idx) => {
      o.visible = !morphing && idx === (k >= 1 ? to : from)
    })
    points.current.visible = morphing
    if (!morphing) return

    const key = `${from}-${to}`
    if (pair.current !== key) {
      pair.current = key
      const g = cloud.geometry
      const a = samples[from]
      const b = samples[to]
      g.attributes.position.array.set(a.pos)
      g.attributes.normal.array.set(a.nor)
      g.attributes.aColFrom.array.set(a.col)
      g.attributes.aTo.array.set(b.pos)
      g.attributes.aNormTo.array.set(b.nor)
      g.attributes.aColTo.array.set(b.col)
      for (const name of ['position', 'normal', 'aColFrom', 'aTo', 'aNormTo', 'aColTo']) g.attributes[name].needsUpdate = true
    }
    const u = cloud.material.uniforms
    u.uMix.value = k
    u.uScatter.value = still ? 0 : Math.sin(Math.PI * k)
    u.uTime.value = t
    const dpr = state.viewport.dpr
    u.uCell.value = Math.round(6 * dpr)
    u.uViewport.value.set(state.size.width * dpr, state.size.height * dpr)
  })

  return (
    <>
      <PerspectiveCamera makeDefault fov={26} position={[0, 1.55, 8.4]} onUpdate={c => c.lookAt(0, 0.85, 0)} />
      <group ref={group} rotation={[0, -0.35, 0]}>
        <Plinth geo={geo} mat={mat} />
        <group position={[0, PLINTH_TOP, 0]}>
          {defs.map((d, idx) => (
            <group key={d.key} ref={el => (objectRefs.current[idx] = el)} visible={idx === 0}>
              {d.parts.map((p, j) => (
                <group key={j} position={p.position ?? [0, 0, 0]} rotation={p.rotation ?? [0, 0, 0]}>
                  <mesh geometry={p.geometry} material={p.material} />
                  {p.hull && <mesh geometry={p.geometry} material={p.hull} />}
                </group>
              ))}
              {d.Extras && <d.Extras />}
            </group>
          ))}
          {cloud && <points ref={points} geometry={cloud.geometry} material={cloud.material} visible={false} frustumCulled={false} />}
        </group>
      </group>
    </>
  )
}
