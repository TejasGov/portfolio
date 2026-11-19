import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { atmosphere, contourMaterial } from './materials'
import { LAKE, SITES, WATER_Y, height } from './terrain'
import { SHAPES, sliceShape } from './sculptures'
import { PROJECTS } from './content'
import { LAMPS, LAMP_P, PROJECT_P } from './route'
import { progress } from './progress'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)

/** Contour materials for props, made once per tint and disposed with their owner. */
function useMats(spec) {
  const mats = useMemo(() => Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, contourMaterial(v)])), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(mats).forEach(m => m.dispose()), [mats])
  return mats
}

/** A glow that blooms: an unlit colour pushed past 1 so the bloom pass picks it up. */
function glowMaterial(hex, boost = 2.2) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(boost), toneMapped: false })
  return m
}

function lathe(points, segments = 28) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments)
}

/* ------------------------------------------------------------------ chai */

/** A roadside tapri: counter, tin roof, a kettle on the stove, kulhads waiting, a bench out front. */
export function ChaiStall() {
  const s = SITES.chai
  const m = useMats({
    wood: { spacing: 0.12, tint: '#7d5136' },
    top: { spacing: 0.12, tint: '#c49a6c' },
    post: { spacing: 0.12, tint: '#5c3d2a' },
    roof: { spacing: 0.12, tint: '#a9543a' },
    board: { spacing: 0.12, tint: '#e3c46a' },
    brass: { spacing: 0.05, tint: '#c9a14a' },
    clay: { spacing: 0.03, tint: '#b85a35' },
    iron: { spacing: 0.12, tint: '#2f2c2c' },
  })
  const geo = useMemo(() => ({
    kettle: lathe([[0, 0], [0.15, 0], [0.19, 0.08], [0.18, 0.2], [0.11, 0.27], [0.05, 0.3], [0.06, 0.33], [0, 0.34]]),
    kulhad: lathe([[0, 0], [0.04, 0], [0.055, 0.1], [0.05, 0.1], [0.035, 0.012], [0, 0.012]]),
  }), [])
  const steam = useMemo(() => [-0.06, 0.05].map((x, i) => {
    const pts = []
    for (let k = 0; k <= 20; k++) {
      const t = k / 20
      pts.push(new THREE.Vector3(x + Math.sin(t * 6 + i * 2) * 0.05, 1.55 + t * 0.9, Math.cos(t * 5 + i) * 0.03))
    }
    return pts
  }), [])
  const steamRef = useRef()
  useFrame(({ clock }) => {
    if (!steamRef.current || reduced()) return
    steamRef.current.children.forEach((l, i) => {
      l.position.x = Math.sin(clock.elapsedTime * 0.8 + i) * 0.03
      l.scale.y = 1 + Math.sin(clock.elapsedTime * 0.6 + i * 2) * 0.1
    })
  })
  const box = (args, pos, mat, rot) => (
    <mesh key={pos.join()} material={mat} position={pos} rotation={rot}>
      <boxGeometry args={args} />
    </mesh>
  )
  const post = (pos, h) => (
    <mesh key={pos.join()} material={m.post} position={[pos[0], h / 2, pos[1]]}>
      <cylinderGeometry args={[0.05, 0.05, h, 8]} />
    </mesh>
  )
  return (
    // Built facing local +z; turned so the counter faces the path from the hilltop (west).
    <group position={[s.x, s.y, s.z]} rotation={[0, -Math.PI / 2, 0]}>
      {box([2.4, 1, 0.9], [0, 0.5, 0], m.wood)}
      {box([2.6, 0.06, 1.0], [0, 1.03, 0.05], m.top)}
      {post([-1.2, -0.45], 2.45)}
      {post([1.2, -0.45], 2.45)}
      {post([-1.2, 0.5], 2.2)}
      {post([1.2, 0.5], 2.2)}
      {box([3.0, 0.05, 1.7], [0, 2.33, 0.05], m.roof, [-0.12, 0, 0])}
      {box([1.6, 0.38, 0.04], [0, 2.0, 0.56], m.board)}
      {box([0.42, 0.14, 0.36], [-0.55, 1.13, -0.05], m.iron)}
      <mesh geometry={geo.kettle} material={m.brass} position={[-0.55, 1.2, -0.05]} />
      <mesh material={m.brass} position={[-0.36, 1.37, -0.05]} rotation={[0, 0, -0.9]}>
        <cylinderGeometry args={[0.012, 0.022, 0.16, 8]} />
      </mesh>
      {[[0.25, 0.22], [0.42, 0.08], [0.6, 0.26], [0.78, 0.12]].map(([x, z]) => (
        <mesh key={x} geometry={geo.kulhad} material={m.clay} position={[x, 1.06, z]} />
      ))}
      {box([1.7, 0.07, 0.36], [0, 0.46, 1.45], m.wood)}
      {[-0.75, 0.75].map(x => box([0.07, 0.43, 0.3], [x, 0.215, 1.45], m.post))}
      <group ref={steamRef} position={[-0.55, 0, -0.05]}>
        {steam.map((pts, i) => (
          <Line key={i} points={pts} color="#ffffff" lineWidth={1.6} transparent opacity={0.55} />
        ))}
      </group>
    </group>
  )
}

/* ---------------------------------------------------------------- cinema */

/** A single-screen talkies: deco front, red canopy ringed with chasing bulbs, posters either side. */
export function Cinema() {
  const s = SITES.cinema
  const m = useMats({
    plaster: { spacing: 1.4, tint: '#d9c3a0', lineStrength: 0.45 },
    deco: { spacing: 1.4, tint: '#e8d4ae', lineStrength: 0.45 },
    canopy: { spacing: 0.3, tint: '#a8323a' },
    door: { spacing: 0.3, tint: '#2a1e1a' },
    sign: { spacing: 0.3, tint: '#f2c230' },
    frame: { spacing: 0.3, tint: '#3b2f4e' },
  })
  const bulbs = useRef()
  const spots = useMemo(() => {
    const out = []
    for (const y of [3.95, 5.25]) for (let x = -7.6; x <= 7.61; x += 0.5) out.push([x, y, -3.9])
    for (let y = 4.2; y <= 5.0; y += 0.4) out.push([-7.95, y, -3.9], [7.95, y, -3.9])
    return out
  }, [])
  const bulbMats = useMemo(() => ({ on: new THREE.Color('#ffd27a').multiplyScalar(2.4), off: new THREE.Color('#5a3f22') }), [])
  const poster = useMemo(() => glowMaterial('#ff9a6a', 0.9), [])
  useEffect(() => () => poster.dispose(), [poster])
  useFrame(({ clock }) => {
    const b = bulbs.current
    if (!b) return
    const step = reduced() ? 0 : Math.floor(clock.elapsedTime * 5)
    const d = new THREE.Object3D()
    spots.forEach((p, i) => {
      d.position.set(...p)
      d.updateMatrix()
      b.setMatrixAt(i, d.matrix)
      b.setColorAt(i, (i + step) % 4 === 0 ? bulbMats.off : bulbMats.on)
    })
    b.instanceMatrix.needsUpdate = true
    b.instanceColor.needsUpdate = true
  })
  const box = (args, pos, mat) => (
    <mesh key={pos.join()} material={mat} position={pos}>
      <boxGeometry args={args} />
    </mesh>
  )
  return (
    <group position={[s.x, s.y, s.z]}>
      {box([22, 11, 12], [0, 5.5, 4], m.plaster)}
      {box([12, 3, 10], [0, 12.5, 4], m.deco)}
      {box([6, 2.6, 8], [0, 15.3, 4], m.deco)}
      {box([2.2, 4.5, 2.2], [0, 18.8, 4], m.deco)}
      {box([10, 1.6, 0.3], [0, 8.6, -2.15], m.sign)}
      {box([16, 1.5, 2.6], [0, 4.6, -2.6], m.canopy)}
      {[-4, 0, 4].map(x => box([2.2, 3.3, 0.2], [x, 1.65, -2.05], m.door))}
      {[-8.6, 8.6].map(x => (
        <group key={x}>
          {box([3.2, 4.6, 0.25], [x, 3.4, -2.1], m.frame)}
          <mesh material={poster} position={[x, 3.4, -2.25]}>
            <planeGeometry args={[2.6, 4]} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={bulbs} args={[null, null, spots.length]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/* ------------------------------------------------------------ landmarks */

/** One project: its shape as stacked contour rings that rise out of the ground as you arrive. */
function Sculpture({ index }) {
  const s = SITES.projects[index]
  const group = useRef()
  const size = useThree(st => st.size)
  const { line, ring } = useMemo(() => {
    const geometry = new LineSegmentsGeometry().setPositions(sliceShape(SHAPES[PROJECTS[index].shape], { half: 9, top: 15.5 }))
    const material = new LineMaterial({ color: new THREE.Color('#ffe9c4').multiplyScalar(2.1), linewidth: 2.2, transparent: true, toneMapped: false })
    const ringPts = []
    for (let k = 0; k < 96; k++) {
      const a0 = (k / 96) * Math.PI * 2
      const a1 = ((k + 1) / 96) * Math.PI * 2
      ringPts.push(Math.cos(a0) * 9.5, 0.08, Math.sin(a0) * 9.5, Math.cos(a1) * 9.5, 0.08, Math.sin(a1) * 9.5)
    }
    const ringGeometry = new LineSegmentsGeometry().setPositions(ringPts)
    return { line: new LineSegments2(geometry, material), ring: new LineSegments2(ringGeometry, material) }
  }, [index])
  useEffect(() => () => {
    line.geometry.dispose()
    line.material.dispose()
    ring.geometry.dispose()
  }, [line, ring])
  useEffect(() => {
    line.material.resolution.set(size.width, size.height)
  }, [line, size])

  // Face the direction the camera arrives from.
  const yaw = Math.atan2(-14, -6)
  useFrame(({ clock }) => {
    const p = progress.current
    const rise = reduced() ? (p > PROJECT_P[index] - 0.03 ? 1 : 0) : smooth(PROJECT_P[index] - 0.06, PROJECT_P[index] - 0.005, p)
    const g = group.current
    g.visible = p > 0.42 && p < 0.86
    line.scale.y = Math.max(0.001, THREE.MathUtils.smootherstep(rise, 0, 1))
    line.material.opacity = 0.35 + 0.65 * rise
    if (!reduced()) g.rotation.y = yaw + Math.sin(clock.elapsedTime * 0.15 + index) * 0.12
  })
  return (
    <group ref={group} position={[s.x, s.y, s.z]} rotation={[0, yaw, 0]}>
      <primitive object={line} />
      <primitive object={ring} />
    </group>
  )
}

export function Landmarks() {
  return PROJECTS.map((_, i) => <Sculpture key={i} index={i} />)
}

/* ----------------------------------------------------------------- lamps */

/** Lamp posts on the dusk path, one per role; each lantern lights as you reach it. */
export function Lamps() {
  const m = useMats({ iron: { spacing: 0.4, tint: '#24242a' } })
  const glass = useMemo(() => LAMPS.map(() => new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color() })), [])
  useEffect(() => () => glass.forEach(g => g.dispose()), [glass])
  const warm = useMemo(() => new THREE.Color('#ffcf8a'), [])
  const cold = useMemo(() => new THREE.Color('#3a3228'), [])
  useFrame(() => {
    const p = progress.current
    glass.forEach((g, j) => g.color.lerpColors(cold, warm, smooth(LAMP_P[j] - 0.03, LAMP_P[j] - 0.004, p)).multiplyScalar(1 + 1.6 * smooth(LAMP_P[j] - 0.02, LAMP_P[j], p)))
  })
  return LAMPS.map((l, j) => (
    <group key={j} position={l}>
      <mesh material={m.iron} position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 3.4, 10]} />
      </mesh>
      <mesh material={glass[j]} position={[0, 3.62, 0]}>
        <boxGeometry args={[0.34, 0.46, 0.34]} />
      </mesh>
      <mesh material={m.iron} position={[0, 3.98, 0]}>
        <coneGeometry args={[0.32, 0.26, 4]} />
      </mesh>
    </group>
  ))
}

/* ------------------------------------------------------------------ lake */

function Water() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { ...atmosphere },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSkyTop, uHorizon, uLine;
      uniform float uTime, uLight;
      varying vec3 vWorld;
      float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
        return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
      void main() {
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(v.y, 0.0), 3.0);
        vec3 col = mix(uSkyTop * 0.9, uHorizon, fres);
        // Even the water is drawn in contour lines: slow ripple bands that drift.
        float h = vnoise(vWorld.xz * 0.045 + vec2(uTime * 0.02, -uTime * 0.013)) + 0.5 * vnoise(vWorld.xz * 0.11 - uTime * 0.03);
        float b = h * 10.0;
        float dist = min(fract(b), 1.0 - fract(b));
        float line = 1.0 - smoothstep(fwidth(b) * 0.6, fwidth(b) * 1.8, dist);
        col = mix(col, uLine * 0.9, line * 0.45 * (1.0 - fres * 0.5));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }), [])
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh material={material} position={[LAKE.x, WATER_Y, LAKE.z]} rotation-x={-Math.PI / 2}>
      <circleGeometry args={[LAKE.r + LAKE.blend, 96]} />
    </mesh>
  )
}

/** The far shore: a city of towers whose contour lines read as lit floors at night. */
function Skyline() {
  const mesh = useMemo(() => {
    let seed = 11
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const blocks = []
    for (let x = -90; x < 170; x += 4 + rand() * 5) {
      const z = 306 + rand() * 12
      const near = Math.exp(-((x - 30) ** 2) / (2 * 55 ** 2))
      const h = 7 + rand() * 13 + near * 21
      const w = 4 + rand() * 5
      const d = 6 + rand() * 6
      const y0 = height(x, z) - 3
      blocks.push([x, y0 + h / 2, z, w, h, d])
      if (rand() > 0.5) blocks.push([x, y0 + h + h * 0.15, z, w * 0.65, h * 0.3, d * 0.65])
    }
    // One tall stepped tower with a spire, slightly left of centre.
    const ty = height(24, 312) - 3
    blocks.push([24, ty + 21, 312, 6, 42, 6], [24, ty + 46, 312, 4, 8, 4], [24, ty + 53, 312, 2.1, 6, 2.1], [24, ty + 61, 312, 0.35, 10, 0.35])
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = contourMaterial({ spacing: 2.4, tint: '#141a2a', lineStrength: 0.6 })
    const inst = new THREE.InstancedMesh(geometry, material, blocks.length)
    const mtx = new THREE.Matrix4()
    blocks.forEach(([x, y, z, w, h, d], i) => inst.setMatrixAt(i, mtx.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d))))
    return inst
  }, [])
  useEffect(() => () => {
    mesh.geometry.dispose()
    mesh.material.dispose()
  }, [mesh])
  return <primitive object={mesh} />
}

/** Diyas set afloat: clay lamps drifting slowly round the lake, each flame doubled in the water. */
function Diyas() {
  const N = 90
  const base = useMemo(() => {
    let seed = 5
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    // Scattered along the line of sight from the shore to the city, then held inside the lake.
    return Array.from({ length: N }, () => {
      const t = 0.03 + rand() ** 1.8 * 0.9 // bunched toward the shore, so some float close by
      const side = (rand() - 0.5) * (18 + t * 70) // a narrow stream near you, opening out toward the city
      let x = 94 + (28 - 94) * t + side * 0.9
      let z = 132 + (258 - 132) * t + side * 0.45
      const dx = x - LAKE.x
      const dz = z - LAKE.z
      const r = Math.min(Math.hypot(dx, dz), LAKE.r - 3)
      return { a: Math.atan2(dz, dx), r, phase: rand() * 10, speed: 0.6 + rand() * 0.8 }
    })
  }, [])
  const bowls = useRef()
  const flames = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(Float32Array.from({ length: N }, (_, i) => base[i].phase), 1))
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: atmosphere.uTime, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uScale;
        varying float vFlicker;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFlicker = 0.8 + 0.2 * sin(uTime * 9.0 + aSeed * 13.0) * sin(uTime * 5.3 + aSeed * 7.0);
          gl_PointSize = max(7.0, uScale * 420.0 * vFlicker / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vFlicker;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          // A small hot flame inside a wide warm halo; kept orange rather than clipping to white.
          float core = exp(-dot(c * vec2(9.0, 5.5), c * vec2(9.0, 5.5)) * 3.0);
          float halo = exp(-dot(c, c) * 14.0) * 0.45;
          gl_FragColor = vec4(vec3(1.0, 0.62, 0.28) * (core * 1.5 + halo) * vFlicker, 1.0);
        }`,
    })
    return new THREE.Points(g, m)
  }, [base])
  const geometry = useMemo(() => lathe([[0, 0], [0.12, 0], [0.2, 0.05], [0.22, 0.1], [0.19, 0.1], [0.1, 0.03], [0, 0.03]], 16), [])
  const material = useMemo(() => contourMaterial({ spacing: 0.04, tint: '#a5502f', lineStrength: 0.4 }), [])
  const dpr = useThree(s => s.viewport.dpr)
  const sizeH = useThree(s => s.size.height)
  useEffect(() => {
    flames.material.uniforms.uScale.value = (dpr * sizeH) / 800
  }, [flames, dpr, sizeH])
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
    flames.geometry.dispose()
    flames.material.dispose()
  }, [geometry, material, flames])

  useFrame(({ clock }) => {
    const t = reduced() ? 0 : clock.elapsedTime
    const d = new THREE.Object3D()
    const pos = flames.geometry.attributes.position
    base.forEach((b, i) => {
      const a = b.a + t * 0.0025 * b.speed
      const x = LAKE.x + Math.cos(a) * b.r
      const z = LAKE.z + Math.sin(a) * b.r
      const y = WATER_Y + Math.sin(t * 0.8 + b.phase) * 0.04
      d.position.set(x, y, z)
      d.rotation.set(Math.sin(t + b.phase) * 0.06, b.phase, Math.cos(t * 0.9 + b.phase) * 0.06)
      d.updateMatrix()
      bowls.current?.setMatrixAt(i, d.matrix)
      pos.setXYZ(i, x, y + 0.2, z)
    })
    if (bowls.current) bowls.current.instanceMatrix.needsUpdate = true
    pos.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={bowls} args={[geometry, material, N]} frustumCulled={false} />
      <primitive object={flames} frustumCulled={false} />
    </>
  )
}

export function Lake() {
  const group = useRef()
  useFrame(() => {
    group.current.visible = progress.current > 0.66
  })
  return (
    <group ref={group}>
      <Water />
      <Skyline />
      <Diyas />
    </group>
  )
}
