import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ORB_R } from './targets'
import { orbState } from './timeline'
import { store } from '../lib/store'

/*
 * The orb's instrument rig: two thin tilted orbit rings with degree ticks (every 5°, long every 30°)
 * and a dashed outer ring, turning slowly like a measuring device around the specimen.
 * 1px GL lines stay crisp at any DPR; colours sit just above 1.0 so only the ticks catch bloom.
 */
function ring(radius, ticks, long, len) {
  const pts = []
  const seg = 256
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2
    const a1 = ((i + 1) / seg) * Math.PI * 2
    pts.push(Math.cos(a0) * radius, 0, Math.sin(a0) * radius, Math.cos(a1) * radius, 0, Math.sin(a1) * radius)
  }
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2
    const l = i % long === 0 ? len * 2.6 : len
    pts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius, Math.cos(a) * (radius + l), 0, Math.sin(a) * (radius + l))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return g
}

function dashed(radius, dashes) {
  const pts = []
  for (let i = 0; i < dashes; i++) {
    const a0 = (i / dashes) * Math.PI * 2
    const a1 = ((i + 0.45) / dashes) * Math.PI * 2
    pts.push(Math.cos(a0) * radius, 0, Math.sin(a0) * radius, Math.cos(a1) * radius, 0, Math.sin(a1) * radius)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return g
}

export default function Instrument() {
  const a = useRef()
  const b = useRef()
  const c = useRef()
  const { geo, mat } = useMemo(() => ({
    geo: { inner: ring(ORB_R * 1.18, 72, 6, ORB_R * 0.025), outer: ring(ORB_R * 1.34, 120, 10, ORB_R * 0.018), dash: dashed(ORB_R * 1.52, 96) },
    mat: new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.75, 1.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  }), [])
  useEffect(() => () => {
    Object.values(geo).forEach(g => g.dispose())
    mat.dispose()
  }, [geo, mat])

  useFrame((state, delta) => {
    mat.opacity = 0.42 * orbState(store).opacity
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    a.current.rotation.y += delta * 0.06
    b.current.rotation.y -= delta * 0.035
    c.current.rotation.y += delta * 0.02
  })

  return (
    <>
      <group rotation={[0.32, 0, 0.18]}>
        <lineSegments ref={a} geometry={geo.inner} material={mat} />
      </group>
      <group rotation={[-0.22, 0, -0.42]}>
        <lineSegments ref={b} geometry={geo.outer} material={mat} />
      </group>
      <group rotation={[1.25, 0, 0.1]}>
        <lineSegments ref={c} geometry={geo.dash} material={mat} />
      </group>
    </>
  )
}
