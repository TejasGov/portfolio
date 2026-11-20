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

/** Ink outline for a mesh (skinned or not): a back-face shell pushed out along the normal. */
export function outline(mesh, { ink = '#120d0a', width = 0.012 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide })
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
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
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
export async function loadTraveller(loader) {
  const gltf = await loader.loadAsync('/cinema/traveller.glb')
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
