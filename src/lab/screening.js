import '../novel/index.css'
import './lab.css'
import * as THREE from 'three'
import Lenis from 'lenis'
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ChromaticAberrationEffect, NoiseEffect,
  VignetteEffect, ToneMappingEffect, ToneMappingMode, BlendFunction,
} from 'postprocessing'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { noiseVolume, beamFrame, VolumetricPass, makeDust, smooth } from '../novel/cinema/core'
import { PROJECTS } from '../novel/content'

/*
 * Screening sandbox: a project "projected" into being. Dust in the beam condenses onto the object's
 * surface, a blueprint of its edges flickers on, then the solid model dissolves in with a hot edge.
 */
const mobile = matchMedia('(max-width: 760px)').matches
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, stencil: false, powerPreference: 'high-performance' })
const dpr = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75)
renderer.setPixelRatio(dpr)
renderer.outputColorSpace = THREE.SRGBColorSpace
const scene = new THREE.Scene()
scene.background = new THREE.Color('#020308')
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.55
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80)
const noise = noiseVolume(64)

// --- Revere, built in code ------------------------------------------------------------------
function rim(w, h, r, top) {
  const s = new THREE.Shape()
  const hw = w / 2, hh = h / 2, tw = top / 2
  s.moveTo(-tw + r, hh)
  s.lineTo(tw - r, hh)
  s.quadraticCurveTo(tw, hh, tw - r * 0.2, hh - r)
  s.lineTo(hw, -hh + r)
  s.quadraticCurveTo(hw, -hh, hw - r, -hh)
  s.lineTo(-hw + r, -hh)
  s.quadraticCurveTo(-hw, -hh, -hw, -hh + r)
  s.lineTo(-tw + r * 0.2, hh - r)
  s.quadraticCurveTo(-tw, hh, -tw + r, hh)
  return s
}
const dissolve = { uDissolve: { value: 0 }, uEdgeColor: { value: new THREE.Color(0.45, 0.72, 1).multiplyScalar(8) }, tNoise: { value: noise } }
function dissolvable(mat) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, dissolve)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal; uniform float uDissolve; uniform vec3 uEdgeColor; uniform highp sampler3D tNoise;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float dn = texture(tNoise, vLocal * 1.7).r * 0.42 + clamp((vLocal.x + 0.85) / 1.7, 0.0, 1.0) * 0.58;
        float dh = mix(-0.15, 1.12, uDissolve);
        if (dn > dh) discard;
        float dEdge = 1.0 - smoothstep(0.0, 0.05, dh - dn);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uEdgeColor * dEdge;')
  }
  return mat
}
const acetate = dissolvable(new THREE.MeshPhysicalMaterial({ color: '#0d0d10', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }))
const metal = dissolvable(new THREE.MeshStandardMaterial({ color: '#c8ccd8', metalness: 1, roughness: 0.22 }))
const glass = dissolvable(new THREE.MeshPhysicalMaterial({ color: '#41506e', transmission: 0.55, thickness: 0.04, roughness: 0.03, ior: 1.5, iridescence: 0.8, iridescenceIOR: 1.35, specularIntensity: 1, clearcoat: 1 }))
const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.7, 1).multiplyScalar(6), toneMapped: false })

const glasses = new THREE.Group()
const parts = []
const add = (geo, mat, x = 0, y = 0, z = 0) => {
  geo.translate(x, y, z)
  const mesh = new THREE.Mesh(geo, mat)
  glasses.add(mesh)
  if (mat !== led) parts.push(geo)
  return mesh
}
for (const side of [-1, 1]) {
  const outer = rim(0.6, 0.44, 0.13, 0.68)
  const inner = rim(0.5, 0.34, 0.09, 0.57)
  outer.holes.push(inner)
  const front = new THREE.ExtrudeGeometry(outer, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 3, curveSegments: 18 })
  add(front, acetate, side * 0.38, 0, 0)
  add(new THREE.ExtrudeGeometry(rim(0.51, 0.35, 0.09, 0.58), { depth: 0.008, bevelEnabled: false, curveSegments: 18 }), glass, side * 0.38, 0, 0.018)
  // Temple: a flat bar swept back from the hinge, dropping behind the ear.
  const bar = new THREE.Shape()
  bar.moveTo(-0.014, -0.03).lineTo(0.014, -0.03).lineTo(0.014, 0.03).lineTo(-0.014, 0.03).lineTo(-0.014, -0.03)
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.71, 0.13, -0.01),
    new THREE.Vector3(side * 0.73, 0.12, -0.6),
    new THREE.Vector3(side * 0.72, 0.09, -1.12),
    new THREE.Vector3(side * 0.7, -0.06, -1.36),
  ])
  add(new THREE.ExtrudeGeometry(bar, { steps: 48, bevelEnabled: false, extrudePath: path }), acetate)
  // The smart part: battery + compute housing on each temple, hinge pins.
  add(new RoundedBoxGeometry(0.07, 0.1, 0.42, 3, 0.03), acetate, side * 0.735, 0.12, -0.36)
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 16), metal, side * 0.7, 0.13, 0.0)
}
add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.09, 0.13, 0.03), new THREE.Vector3(0, 0.19, 0.05), new THREE.Vector3(0.09, 0.13, 0.03)), 24, 0.024, 10), acetate)
// Camera module top-right, status LED top-left.
const cam = new THREE.CylinderGeometry(0.034, 0.034, 0.03, 28)
cam.rotateX(Math.PI / 2)
add(cam, metal, 0.64, 0.17, 0.06)
const camGlass = new THREE.CylinderGeometry(0.022, 0.022, 0.032, 24)
camGlass.rotateX(Math.PI / 2)
add(camGlass, glass, 0.64, 0.17, 0.065)
add(new THREE.SphereGeometry(0.011, 12, 8), led, -0.64, 0.17, 0.06)
glasses.rotation.set(0.12, -0.5, 0)
scene.add(glasses)

// Blueprint edges.
const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.45, 0.7, 1).multiplyScalar(2.2), transparent: true, opacity: 0, toneMapped: false, depthWrite: false })
for (const geo of parts) glasses.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), edgeMat))

// Surface points the dust condenses onto.
const merged = mergeGeometries(parts.map(g => {
  const n = g.index ? g.toNonIndexed() : g.clone()
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k)
  return n
}))
const sampler = new MeshSurfaceSampler(new THREE.Mesh(merged)).build()
const NP = mobile ? 14000 : 30000
const to = new Float32Array(NP * 3), from = new Float32Array(NP * 3), seed = new Float32Array(NP * 3)
const v = new THREE.Vector3()
for (let i = 0; i < NP; i++) {
  sampler.sample(v)
  v.toArray(to, i * 3)
  // Start scattered in a loose cloud around the object.
  // Start as a loose nebula around the object.
  const r = 0.25 + Math.pow(Math.random(), 0.6) * 1.1, a = Math.random() * Math.PI * 2, y = (Math.random() - 0.5) * 0.9
  from.set([v.x + Math.cos(a) * r, v.y + y, v.z + Math.sin(a) * r], i * 3)
  seed.set([Math.random(), Math.random(), Math.random()], i * 3)
}
const pgeo = new THREE.BufferGeometry()
pgeo.setAttribute('position', new THREE.BufferAttribute(from, 3))
pgeo.setAttribute('aTo', new THREE.BufferAttribute(to, 3))
pgeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
const pmat = new THREE.ShaderMaterial({
  uniforms: { uMorph: { value: 0 }, uTime: { value: 0 }, uFade: { value: 1 }, uSize: { value: 2.2 }, uDpr: { value: dpr } },
  vertexShader: /* glsl */ `
    attribute vec3 aTo; attribute vec3 aSeed;
    uniform float uMorph; uniform float uTime; uniform float uFade; uniform float uSize; uniform float uDpr;
    varying float vA;
    void main() {
      float k = smoothstep(0.0, 1.0, clamp(uMorph * 1.7 - aSeed.x * 0.7, 0.0, 1.0));
      vec3 drift = vec3(sin(uTime * 0.4 + aSeed.y * 30.0), cos(uTime * 0.3 + aSeed.z * 30.0), sin(uTime * 0.35 + aSeed.x * 30.0)) * 0.08;
      vec3 p = mix(position + drift, aTo, k);
      float sw = (1.0 - k) * 2.2 * (0.5 + aSeed.z);
      p.xz = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * p.xz;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = clamp(uSize * uDpr * (1.0 + (1.0 - k) * 1.2) * 3.0 / -mv.z, 1.0, 6.0);
      vA = (0.04 + 0.96 * k) * uFade * (0.6 + 0.4 * sin(uTime * 3.0 + aSeed.y * 50.0));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying float vA;
    void main() { gl_FragColor = vec4(vec3(0.62, 0.8, 1.0) * 2.4 * vA, 1.0); }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})
const points = new THREE.Points(pgeo, pmat)
points.frustumCulled = false
glasses.add(points)

// --- Stage: a void, the beam falling on the object from the booth --------------------------
const PORT = new THREE.Vector3(-6.5, 5.6, 2.2)
const beam = beamFrame(PORT, new THREE.Vector3(0.2, -0.1, -0.4), 0.1, 0.085, 0.25)
const key = new THREE.SpotLight('#d6e6ff', 260, 0, Math.atan(0.14), 0.55, 2)
key.position.copy(PORT)
key.target.position.set(0, 0, 0)
scene.add(key, key.target)
const rimLight = new THREE.DirectionalLight('#6f9bff', 4.5)
rimLight.position.set(2.5, 1.5, -3)
scene.add(rimLight)
const dust = makeDust(mobile ? 2500 : 5000, beam, new THREE.Box3(new THREE.Vector3(-6, -0.7, -6), new THREE.Vector3(6, 6, 6)), { reach: 14, inBeam: 0.96 })
dust.material.uniforms.uDpr.value = dpr
dust.material.uniforms.uSize.value = 4
dust.material.uniforms.uFocus.value = 4.6
dust.material.uniforms.uAperture.value = 0.22
scene.add(dust)

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
composer.addPass(new RenderPass(scene, camera))
const vol = new VolumetricPass(camera, beam, noise, { scale: 0.5, steps: mobile ? 24 : 40 })
vol.uniforms.uDensity.value = 0.6
vol.uniforms.uMaxDist.value = 30
composer.addPass(vol)
const bloom = new BloomEffect({ mipmapBlur: true, intensity: 0.9, luminanceThreshold: 0.55, luminanceSmoothing: 0.25, radius: 0.7 })
const grain = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT })
grain.blendMode.opacity.value = 0.16
composer.addPass(new EffectPass(camera, new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0008, 0.0005), radialModulation: true, modulationOffset: 0.3 }), bloom, new ToneMappingEffect({ mode: ToneMappingMode.AGX }), new VignetteEffect({ offset: 0.3, darkness: 0.7 }), grain))

function resize() {
  const w = innerWidth, h = innerHeight
  renderer.setSize(w, h, false)
  composer.setSize(w, h)
  camera.aspect = w / h
  camera.fov = w / h < 0.75 ? 52 : 32
  camera.updateProjectionMatrix()
}
resize()
addEventListener('resize', resize)

// --- Card copy from the real project data ---------------------------------------------------
const revere = PROJECTS.find(p => p.id === 'revere')
document.getElementById('ptitle').textContent = revere.title
document.getElementById('pline').textContent = revere.line
document.getElementById('ptech').textContent = revere.tech

const lenis = new Lenis({ lerp: 0.085 })
const track = document.getElementById('track')
const card = document.getElementById('card')
const cue = document.getElementById('cue')
const mouse = new THREE.Vector2(), eased = new THREE.Vector2()
addEventListener('pointermove', e => mouse.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5))
const clock = new THREE.Clock()

function frame(t) {
  lenis.raf(t)
  const s = Math.min(1, Math.max(0, scrollY / (track.offsetHeight - innerHeight)))
  const time = clock.getElapsedTime()
  eased.lerp(mouse, 0.05)

  pmat.uniforms.uMorph.value = smooth(0.04, 0.42, s)
  pmat.uniforms.uTime.value = time
  pmat.uniforms.uFade.value = 1 - smooth(0.72, 0.88, s)
  edgeMat.opacity = smooth(0.3, 0.42, s) * (1 - smooth(0.62, 0.76, s)) * 0.55
  dissolve.uDissolve.value = smooth(0.46, 0.82, s)
  glasses.rotation.y = -0.75 + s * 0.85 + Math.sin(time * 0.25) * 0.22 + eased.x * 0.4
  glasses.rotation.x = 0.12 + eased.y * 0.15
  glasses.position.y = Math.sin(time * 0.8) * 0.025

  const wide = innerWidth / innerHeight > 1.1
  camera.position.set(wide ? -0.55 : 0, 0.42 - s * 0.14, (wide ? 5.1 : 5.6) - s * 0.6)
  camera.lookAt(wide ? -0.15 : 0, mobile ? -0.45 : 0.0, 0)

  vol.uniforms.uTime.value = time
  dust.material.uniforms.uTime.value = time
  const c = smooth(0.8, 0.92, s)
  card.style.opacity = c.toFixed(3)
  card.style.transform = `translateY(${((1 - c) * 18).toFixed(1)}px)`
  card.style.filter = c < 0.999 ? `blur(${((1 - c) * 10).toFixed(1)}px)` : 'none'
  cue.style.opacity = (0.6 * (1 - smooth(0.02, 0.06, s))).toFixed(3)
  composer.render()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
window.lab = { vol, bloom, dust, glasses, camera, scene, key, rimLight, dissolve, pmat, edgeMat }
