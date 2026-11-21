import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'

/*
 * The ink-and-paint kit every film shares: cel shading with a three-step ramp, an ink outline that
 * follows skinned meshes (an inverted hull pushed out along the skinned normal), a painted sky, and
 * the traveller himself, cloned per film with his own animation mixer.
 */
const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]), 3, 1)
  t.minFilter = t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
})()

export function toon(opts = {}) {
  return new THREE.MeshToonMaterial({ gradientMap: ramp, ...opts })
}

/**
 * Ink outline: a back-face shell around the mesh. Skinned meshes push their shell out along the
 * (smooth) normals; rigid props, whose hard edges have split normals, use a scaled shell instead.
 */
export function outline(mesh, { ink = '#120d0a', width = 0.012 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide })
  if (!mesh.isSkinnedMesh) {
    mesh.geometry.computeBoundingBox()
    const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3())
    const c = mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
    const shell = new THREE.Mesh(mesh.geometry, mat)
    shell.scale.set(...size.toArray().map(v => (v + 2 * width) / Math.max(v, 1e-4)))
    shell.position.copy(c).multiply(new THREE.Vector3(1, 1, 1).sub(shell.scale)) // scale about the centre
    mesh.add(shell)
    return shell
  }
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWidth = { value: width }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWidth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uWidth;')
  }
  const shell = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, mat) : new THREE.Mesh(mesh.geometry, mat)
  if (mesh.isSkinnedMesh) shell.bind(mesh.skeleton, mesh.bindMatrix)
  shell.frustumCulled = false
  mesh.add(shell)
  return shell
}

/** A painted dusk sky: a vertical gradient with a soft sun glow. */
export function sky({ top = '#2b1b3a', mid = '#c2563a', low = '#f2b277', sunDir = new THREE.Vector3(0, 0.12, 1), sun = '#ffe2b0' } = {}) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(200, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color(top) }, uMid: { value: new THREE.Color(mid) }, uLow: { value: new THREE.Color(low) }, uSunDir: { value: sunDir.clone().normalize() }, uSun: { value: new THREE.Color(sun) } },
      // Pinned to the far plane (z = w): the sky is always the background, for depth and for the ink pass.
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = (projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0)).xyww; }',
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uMid, uLow, uSun; uniform vec3 uSunDir; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = mix(uLow, uMid, smoothstep(-0.02, 0.18, h));
          c = mix(c, uTop, smoothstep(0.18, 0.7, h));
          float s = max(dot(d, uSunDir), 0.0);
          c += uSun * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.35);
          gl_FragColor = vec4(c, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  )
}

/** A canvas texture of soft painted blotches, for floors and walls. */
export function paintTexture(base, spots, { size = 512, count = 220, seed = 1 } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < count; i++) {
    const x = rnd() * size, y = rnd() * size, r = 6 + rnd() * 40
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, spots[i % spots.length])
    grad.addColorStop(1, 'transparent')
    g.globalAlpha = 0.18 + rnd() * 0.2
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * The traveller. Each film clones him with its own mixer. `look` restyles him: 'self' keeps his painted
 * texture; 'shadow' makes him a dark double with a glowing outline.
 */
// Every clip loops in place: take out the hips' net drift across a clip (a dance step that travels),
// so a loop never snaps him back to where it started.
function inPlace(clips) {
  for (const clip of clips) {
    const tr = clip.tracks.find(k => k.name.endsWith('Hips.position'))
    if (!tr || !clip.duration) continue
    const v = tr.values, n = tr.times.length
    const drift = [0, 1, 2].map(i => v[(n - 1) * 3 + i] - v[i])
    for (let k = 0; k < n; k++) for (let i = 0; i < 3; i++) v[k * 3 + i] -= drift[i] * (tr.times[k] / clip.duration)
  }
  return clips
}

/**
 * Extra animations for the traveller from a clips-only GLB on the same rig (same bone names), made
 * in-place like his own, without touching traveller.glb. Give them to a made traveller with add().
 */
export const loadClips = (loader, url) => loader.loadAsync(url).then(gltf => inPlace(gltf.animations))

// One load and one parse for the whole site: the films, the journey and every game world clone this.
let shared = null
export const loadTraveller = loader => (shared ??= parseTraveller(loader))

// His aloha shirt (scripts/cinema/aloha.py) read as painted, with no sRGB decode: one copy on the GPU
// for the village and night ops, whose frames are shown without an encode (it would turn his skin red).
let alohaFlat = null
export const alohaLinear = () => (alohaFlat ??= Object.assign(new THREE.TextureLoader().load('/cinema/traveller_aloha.webp'), { flipY: false, colorSpace: THREE.NoColorSpace }))

async function parseTraveller(loader) {
  const gltf = await loader.loadAsync('/cinema/traveller.glb') // the rig, his texture and all his clips
  inPlace(gltf.animations)
  const box = new THREE.Box3().setFromObject(gltf.scene)
  const height = box.max.y - box.min.y
  return {
    clips: gltf.animations,
    make({ look = 'self', ink = '#120d0a', glow = '#ff5a3c' } = {}) {
      const root = SkeletonUtils.clone(gltf.scene)
      root.scale.multiplyScalar(1.72 / height)
      const skinned = []
      root.traverse(o => o.isSkinnedMesh && skinned.push(o)) // collect first: outlines add skinned meshes
      skinned.forEach(o => {
        o.frustumCulled = false
        o.castShadow = true
        const map = o.material.map
        if (look === 'pbr') {
          // Physically shaded, for the realistic street of Chapter Four: no ink outline.
          o.material = new THREE.MeshStandardMaterial({ map, roughness: 0.78 })
          return
        }
        o.material = look === 'shadow'
          ? toon({ color: '#1b1420', emissive: new THREE.Color(glow).multiplyScalar(0.05) })
          : toon({ map })
        // The outline is pushed in the mesh's own units: convert from metres.
        o.geometry.computeBoundingBox()
        const local = o.geometry.boundingBox.max.y - o.geometry.boundingBox.min.y
        const perMetre = local / 1.72
        outline(o, { ink: look === 'shadow' ? glow : ink, width: (look === 'shadow' ? 0.016 : 0.01) * perMetre })
      })
      const mixer = new THREE.AnimationMixer(root)
      const actions = Object.fromEntries(gltf.animations.map(c => [c.name, mixer.clipAction(c)]))
      let current = null
      const bone = name => root.getObjectByName(name)
      return {
        root, mixer, actions, bone,
        play(name, { fade = 0.25, once = false, at = 0 } = {}) {
          const a = actions[name]
          if (!a || current === a) return a
          a.reset()
          a.time = at
          a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity)
          a.clampWhenFinished = once
          a.enabled = true
          if (current) current.crossFadeTo(a, fade, false)
          a.play()
          current = a
          return a
        },
        duration: name => actions[name]?.getClip().duration ?? 1,
        /** More clips for this one (see loadClips): playable by their names from then on. */
        add: clips => clips.forEach(c => { actions[c.name] = mixer.clipAction(c) }),
      }
    },
  }
}

/** Attach an object to a bone, undoing the bone's world scale so the prop keeps its size in metres. */
export function holdIn(bone, obj) {
  bone.updateWorldMatrix(true, false)
  const s = new THREE.Vector3().setFromMatrixScale(bone.matrixWorld)
  obj.scale.set(1 / s.x, 1 / s.y, 1 / s.z)
  bone.add(obj)
  return obj
}

/** A sprite of text drawn on a canvas (numerals, labels, HUD lines). */
export function textSprite(text, { font = '620 semi-expanded 170px "Archivo Variable", sans-serif', color = '#fff', size = 1, glow = null, width = 512, height = 256, bg = null } = {}) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const g = c.getContext('2d')
  g.font = font
  if (bg) {
    // A HUD plate behind the words, so they read over anything.
    const tw = Math.min(width - 8, g.measureText(text).width + height * 0.7)
    g.fillStyle = bg
    g.beginPath()
    g.roundRect((width - tw) / 2, 4, tw, height - 8, (height - 8) / 2)
    g.fill()
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  if (glow) {
    g.shadowColor = glow
    g.shadowBlur = 24
  }
  g.fillStyle = color
  g.fillText(text, width / 2, height / 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  sp.scale.set(size * (width / height), size, 1)
  return sp
}

/** A box with toon shading and an ink outline: the building block of every set. */
export function inkBox(w, h, d, color, { width = 0.012, ...opts } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon({ color, ...opts }))
  m.castShadow = m.receiveShadow = true
  outline(m, { width })
  return m
}

/** Same, for any geometry. */
export function inkMesh(geo, color, { width = 0.012, ...opts } = {}) {
  const m = new THREE.Mesh(geo, toon({ color, ...opts }))
  m.castShadow = m.receiveShadow = true
  outline(m, { width })
  return m
}

const _right = new THREE.Vector3()
/** Set by the film each frame: a tall phone screen sees only the middle of the frame, so centre the subject. */
export const FRAME = { portrait: false }
/** Aim the camera so `subject` sits left of centre, leaving the right third for the title card. */
export function frameLeft(camera, subject, shift = 0.9) {
  if (FRAME.portrait) shift = 0
  camera.lookAt(subject)
  _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
  camera.lookAt(_right.multiplyScalar(shift).add(subject))
  if (FRAME.portrait) lookBelow(camera, subject)
}
const _down = new THREE.Vector3()
/** Phone: aim below `subject` so it sits in the top half, above the bottom sheet of text (index.css). */
export function lookBelow(camera, subject, k = 0.38) {
  const d = camera.position.distanceTo(subject)
  camera.lookAt(_down.copy(subject).addScaledVector(camera.up, -d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * k))
}
