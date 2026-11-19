import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { inkOutlineMaterial, palette, toonMaterial } from './inkMaterials'

/*
 * The still-life objects. Each sits on the plinth top (y = 0) in its own space and is made of
 * parts: a geometry, a toon material, an ink hull, and a share of the pixel samples used when
 * it morphs. `Extras` are decorations that simply vanish while the object is pixels.
 */

const c = hex => new THREE.Color(hex)

function orb() {
  return {
    key: 'orb',
    parts: [{
      geometry: new THREE.SphereGeometry(0.85, 128, 96),
      material: toonMaterial({ contours: true }),
      outline: 0.028,
      position: [0, 1.03, 0],
      color: palette.paper,
      weight: 1,
    }],
    bob: true,
  }
}

function cricketBall() {
  return {
    key: 'ball',
    parts: [{
      geometry: new THREE.SphereGeometry(0.6, 96, 72),
      material: toonMaterial({ base: c('#a8302a'), seam: true }),
      outline: 0.024,
      position: [0, 0.6, 0],
      rotation: [0.25, 0.35, 0.55],
      color: c('#a8302a'),
      weight: 1,
    }],
  }
}

function kulhad() {
  // Clay cup profile: outside up to the lip, then back down the inside.
  const profile = [
    [0, 0], [0.29, 0], [0.32, 0.03], [0.44, 0.56], [0.49, 0.8], [0.51, 0.84],
    [0.47, 0.84], [0.45, 0.78], [0.31, 0.1], [0, 0.1],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  return {
    key: 'kulhad',
    parts: [
      {
        geometry: new THREE.LatheGeometry(profile, 72),
        material: toonMaterial({ base: c('#b85a35') }),
        outline: 0.02,
        color: c('#b85a35'),
        weight: 0.78,
      },
      {
        // The milk swirl is the same contour line as the orb: the motif, poured.
        geometry: new THREE.CircleGeometry(0.455, 64).rotateX(-Math.PI / 2),
        material: toonMaterial({ base: c('#c99a64'), contours: true, contourScale: 3.2, contourBands: 3 }),
        position: [0, 0.69, 0],
        color: c('#c99a64'),
        weight: 0.22,
      },
    ],
    Extras: Steam,
  }
}

function filmReel() {
  return {
    key: 'reel',
    parts: [{
      geometry: new THREE.CylinderGeometry(0.72, 0.72, 0.14, 72).rotateX(Math.PI / 2),
      material: toonMaterial({ base: c('#d4a03a'), reel: true }),
      outline: 0.022,
      position: [0, 0.76, 0],
      color: c('#d4a03a'),
      weight: 1,
    }],
    Extras: MarqueeBulbs,
  }
}

const builders = { orb, ball: cricketBall, kulhad, reel: filmReel }

/** Builds an object once per scene; call dispose() on unmount. */
export function buildObject(key) {
  const def = builders[key]()
  def.parts.forEach(p => { p.hull = p.outline ? inkOutlineMaterial({ width: p.outline }) : null })
  def.dispose = () => def.parts.forEach(p => { p.geometry.dispose(); p.material.dispose(); p.hull?.dispose() })
  return def
}

/** Ink curls of steam rising off the chai, swaying like breath. */
function Steam() {
  const group = useRef()
  const curls = useMemo(() => [-0.16, 0.02, 0.18].map((x, i) => {
    const pts = []
    for (let k = 0; k <= 24; k++) {
      const t = k / 24
      pts.push(new THREE.Vector3(x + Math.sin(t * 7 + i * 2) * 0.07 * (1 - t * 0.3), 0.95 + t * 0.75, 0.05 * i))
    }
    return pts
  }), [])
  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    group.current.children.forEach((line, i) => {
      line.position.x = Math.sin(t * 0.9 + i) * 0.04
      line.scale.y = 1 + Math.sin(t * 0.7 + i * 1.7) * 0.08
    })
  })
  return (
    <group ref={group}>
      {curls.map((pts, i) => (
        <Line key={i} points={pts} color={palette.ink} lineWidth={2.2} transparent opacity={0.75} />
      ))}
    </group>
  )
}

/** Marquee bulbs round the reel, chasing like a single-screen cinema sign. */
function MarqueeBulbs() {
  const mesh = useRef()
  const spots = useMemo(() => {
    const out = []
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2
      const y = 0.76 + Math.sin(a) * 0.88
      if (y > 0.08) out.push([Math.cos(a) * 0.88, y, 0])
    }
    return out
  }, [])
  const on = useMemo(() => c('#ffd27a'), [])
  const off = useMemo(() => c('#8a6a3a'), [])
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    const step = Math.floor(clock.elapsedTime * 4)
    const dummy = new THREE.Object3D()
    spots.forEach((p, i) => {
      dummy.position.set(...p)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, (i + step) % 3 === 0 ? off : on)
    })
    m.instanceMatrix.needsUpdate = true
    m.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[null, null, spots.length]}>
      <sphereGeometry args={[0.05, 12, 10]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
