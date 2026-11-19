import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { atmosphere, contourMaterial, orbMaterial, skyMaterial } from './materials'
import { HILL, PLATEAU, terrainGeometry, treeSpots } from './terrain'
import { ORB, PALETTE, STUMPS_Z, curveU, lookCurve, posCurve, sunDir, veilAt } from './route'
import { ChaiStall, Cinema, Lake, Lamps, Landmarks } from './places'
import { progress } from './progress'

const ORB_R = 6
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const mobile = () => matchMedia('(max-width: 767px)').matches
const sun = new THREE.Vector3()

function applyPalette(p) {
  let i = 0
  while (i < PALETTE.length - 2 && p > PALETTE[i + 1].p) i++
  const a = PALETTE[i]
  const b = PALETTE[i + 1]
  const t = THREE.MathUtils.smoothstep(p, a.p, b.p)
  atmosphere.uSkyTop.value.lerpColors(a.top, b.top, t)
  atmosphere.uHorizon.value.lerpColors(a.hor, b.hor, t)
  atmosphere.uGroundLow.value.lerpColors(a.low, b.low, t)
  atmosphere.uGroundHigh.value.lerpColors(a.high, b.high, t)
  atmosphere.uLine.value.lerpColors(a.line, b.line, t)
  atmosphere.uSunColor.value.lerpColors(a.sun, b.sun, t)
  atmosphere.uLight.value = THREE.MathUtils.lerp(a.light, b.light, t)
  atmosphere.uFog.value = THREE.MathUtils.lerp(a.fog, b.fog, t)
  atmosphere.uSunDir.value.copy(sunDir(p, sun))
}

function CameraRig({ veil }) {
  const camera = useThree(s => s.camera)
  const look = useMemo(() => new THREE.Vector3(), [])
  const pointer = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const move = e => {
      pointer.current.x = (e.clientX / innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / innerHeight) * 2 - 1
    }
    addEventListener('pointermove', move, { passive: true })
    return () => removeEventListener('pointermove', move)
  }, [])

  useFrame((state, delta) => {
    // Inertia on scroll: the world glides to where you scrolled instead of snapping.
    progress.current = reduced() ? progress.target : THREE.MathUtils.damp(progress.current, progress.target, 2.4, delta)
    const p = progress.current
    const u = curveU(p)
    posCurve.getPoint(u, camera.position)
    lookCurve.getPoint(u, look)
    if (!reduced()) {
      // A breath of handheld drift and a little parallax toward the cursor; gentler once on the ground.
      const t = state.clock.elapsedTime
      const amp = p < 0.2 ? 1 : 0.3
      camera.position.x += (Math.sin(t * 0.21) * 0.15 + pointer.current.x * 0.4) * amp
      camera.position.y += (Math.sin(t * 0.17) * 0.12 - pointer.current.y * 0.25) * amp
    }
    camera.lookAt(look)
    // Portrait screens get a wider lens so landmarks and buildings aren't cropped at the sides.
    const fov = camera.aspect < 0.85 ? 60 : 42
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    applyPalette(p)
    atmosphere.uTime.value = state.clock.elapsedTime
    if (veil.current) veil.current.style.opacity = veilAt(p).toFixed(3)
  })
  return null
}

function Orb() {
  const group = useRef()
  const mat = useMemo(orbMaterial, [])
  // Double-sided: once the camera is inside, the lines wrap all around you.
  mat.side = THREE.DoubleSide
  const dust = useMemo(() => {
    const n = 900
    const a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(ORB_R * (1.15 + Math.random() * 1.4))
      v.toArray(a, i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(a, 3))
    return g
  }, [])
  useFrame((_, delta) => {
    const g = group.current
    g.visible = progress.current < 0.105
    if (!reduced()) g.rotation.y += delta * 0.05
  })
  return (
    <group ref={group} position={ORB}>
      <mesh material={mat}>
        <sphereGeometry args={[ORB_R, 128, 96]} />
      </mesh>
      <points geometry={dust}>
        <pointsMaterial color="#bfe0ff" size={0.09} sizeAttenuation transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}

function Land() {
  const group = useRef()
  // Dense enough that contour lines stay smooth where the hilltop flattens.
  const segments = mobile() ? 180 : 320
  const terrain = useMemo(() => ({ geometry: terrainGeometry(segments), material: contourMaterial({ pitch: true }) }), [segments])
  const trees = useMemo(() => {
    const spots = treeSpots(mobile() ? 260 : 520)
    const geometry = new THREE.IcosahedronGeometry(1, 1)
    const material = contourMaterial({ spacing: 3.5, tint: '#2f4632', lineStrength: 0.12 })
    const mesh = new THREE.InstancedMesh(geometry, material, spots.length)
    const m = new THREE.Matrix4()
    spots.forEach((s, i) => {
      m.compose(
        new THREE.Vector3(s.x, s.y + s.s * 1.1, s.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.r, 0)),
        new THREE.Vector3(s.s, s.s * 1.7, s.s),
      )
      mesh.setMatrixAt(i, m)
    })
    return mesh
  }, [])
  useEffect(() => () => {
    terrain.geometry.dispose()
    terrain.material.dispose()
    trees.geometry.dispose()
    trees.material.dispose()
  }, [terrain, trees])
  useFrame(() => {
    group.current.visible = progress.current > 0.08
  })
  return (
    <group ref={group}>
      <mesh geometry={terrain.geometry} material={terrain.material} />
      <primitive object={trees} />
      <Hilltop />
      <CloudBank />
      <ChaiStall />
      <Cinema />
      <Landmarks />
      <Lamps />
      <Lake />
    </group>
  )
}

/** The childhood hilltop: three not-quite-straight stumps, a bat leaning on them, a taped tennis ball. */
function Hilltop() {
  const mats = useMemo(() => ({
    stump: contourMaterial({ spacing: 0.09, tint: '#efe3c9' }),
    bat: contourMaterial({ spacing: 0.09, tint: '#d6ad72' }),
    ball: contourMaterial({ spacing: 0.02, tint: '#d9df5c' }),
  }), [])
  useEffect(() => () => Object.values(mats).forEach(m => m.dispose()), [mats])
  const y = PLATEAU
  return (
    <group position={[HILL.x, y, STUMPS_Z]}>
      {[-0.11, 0, 0.11].map((x, i) => (
        <mesh key={x} material={mats.stump} position={[x, 0.36, 0]} rotation={[0, 0, [0.05, -0.02, 0.07][i]]}>
          <cylinderGeometry args={[0.019, 0.019, 0.72, 10]} />
        </mesh>
      ))}
      {[-0.055, 0.055].map(x => (
        <mesh key={x} material={mats.stump} position={[x, 0.73, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.011, 0.011, 0.11, 8]} />
        </mesh>
      ))}
      <group position={[0.42, 0, 0.12]} rotation={[0, 0.4, 0.32]}>
        <mesh material={mats.bat} position={[0, 0.3, 0]}>
          <boxGeometry args={[0.11, 0.58, 0.045]} />
        </mesh>
        <mesh material={mats.bat} position={[0, 0.74, 0]}>
          <cylinderGeometry args={[0.017, 0.017, 0.3, 10]} />
        </mesh>
      </group>
      <mesh material={mats.ball} position={[-0.35, 0.034, -3.6]}>
        <sphereGeometry args={[0.034, 20, 14]} />
      </mesh>
    </group>
  )
}

/** Soft painted cloud billboards the camera sinks through on the way down to the hilltop. */
function CloudBank() {
  const group = useRef()
  const camera = useThree(s => s.camera)
  const puffs = useMemo(() => {
    let seed = 3
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    // Strung along the stretch of path between the high dawn view and the hilltop.
    return Array.from({ length: 24 }, () => ({
      pos: [30 + rand() * 22, PLATEAU + 14 + rand() * 30, -30 + rand() * 46],
      scale: 16 + rand() * 24,
      seed: rand() * 100,
    }))
  }, [])
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { ...atmosphere, uSeed: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon, uSunColor;
      uniform float uLight, uSeed;
      varying vec2 vUv;
      float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
        return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
      void main() {
        vec2 q = vUv - 0.5;
        float n = vnoise(vUv * 3.0 + uSeed) * 0.55 + vnoise(vUv * 7.0 - uSeed) * 0.3 + vnoise(vUv * 15.0 + uSeed) * 0.15;
        float a = smoothstep(0.5, 0.15, length(q) + (n - 0.5) * 0.35) * 0.38;
        // Kept under the bloom threshold so flying through reads as haze, not a white-out.
        vec3 col = mix(vec3(0.62, 0.62, 0.72), vec3(0.8, 0.76, 0.74), uLight);
        col = mix(col, uSunColor, 0.25 * uLight) * (0.85 + 0.25 * n);
        col = mix(col, uHorizon, 0.25);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  }), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useFrame(() => {
    group.current?.children.forEach(m => m.quaternion.copy(camera.quaternion))
  })
  return (
    <group ref={group}>
      {puffs.map((c, i) => (
        <mesh
          key={i}
          geometry={geometry}
          position={c.pos}
          scale={c.scale}
          material={material}
          onBeforeRender={() => {
            // Shared material: force a uniform upload so each puff gets its own noise.
            material.uniforms.uSeed.value = c.seed
            material.uniformsNeedUpdate = true
          }}
          renderOrder={2}
        />
      ))}
    </group>
  )
}

export default function World({ veil }) {
  const sky = useMemo(skyMaterial, [])
  return (
    <>
      <mesh material={sky} frustumCulled={false}>
        <sphereGeometry args={[900, 32, 16]} />
      </mesh>
      <Orb />
      <Land />
      <CameraRig veil={veil} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.62} luminanceSmoothing={0.25} intensity={0.9} />
        <Noise opacity={0.045} premultiply />
        <Vignette offset={0.28} darkness={0.55} />
      </EffectComposer>
    </>
  )
}

