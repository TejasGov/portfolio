import * as THREE from 'three'
import { loadTraveller, alohaLinear, wearSuit, sky } from './films/kit'

/*
 * Chapter Five, world 2: the landing. Dusk on a misty highland ridge above a valley: grass, scattered
 * stones, distant mountains, a storm sky. A pillar of lightning strikes; he drops out of it and lands on
 * one knee, a shockwave ring flattening the grass and lifting dust, sparks crawling over the ground; he
 * rises in Thor's armour and crimson cape (his own head and hair, no helmet) holding Stormbreaker, faint
 * lightning crawling over its blade. Slow, heavy camera; a low hero angle on the landing.
 * Beats in p (all derived from p and t, so it scrubs both ways):
 *   0     .13  out of the storm cloud: the ridge at dusk under a boiling overcast, lightning in it
 *   .135  .16  the leader feels down from the vortex; .16 the return stroke: a sustained pillar
 *   .15   .30  he drops out of it (the landing clip, public/cinema/landing/land.glb), lands at .30
 *   .30   .56  the impact, slowed by the scroll: shockwave ring through the grass, dust, sparks,
 *              arcs crawling over the scorched ground; the camera low on the one-knee landing
 *   .56   .80  he rises with the axe; the storm breaks, god-rays through the gaps
 *   .835  1    he raises the axe and a last bolt strikes it: the BATS sweep in over that
 * The armour and the cape (armour, headOnly) and Stormbreaker (makeAxe) are at the end of the file.
 *
 * CONTRACT (world.js, timeline.js and movies.js rely on it; do not change the export or its signature)
 *   export function createLanding(renderer, { loader, normalize, mobile }) -> { scene, camera, update, built }
 *     loader: the shared GLTFLoader (Meshopt + Draco). normalize(root, size, yaw): a model's meshes as
 *     one centred group scaled to `size` metres. mobile: phone-sized screen, build lighter.
 *   update(state, t, aspect) is called once per rendered frame while this world is drawn.
 *     state.p         0..1, this world's own progress (movies.js: Five's P 0.4473..0.5577), driven by scroll:
 *                     it scrubs both ways and can jump, so derive everything from p and t and keep no
 *                     one-way state. The STORM cover parts over p 0..0.104 (come out of the cloud there);
 *                     p 0.104..0.896 is seen clear; the BATS sweep in over p 0.896..1, so a
 *                     raised weapon or a last strike there is what they cover.
 *     state.onScreen  never true for this world (only the dive and the final are drawn on the screen).
 *     state.still     reduced motion: no camera flourishes or shake; the strike, the drop and the
 *                     landing still follow p.
 *     state.portrait  the frame is a phone's (aspect < 0.85): frame for it. Decide framing from this.
 *     state.mobile    same as the option. state.cover: 0..1, how much a transition hides the frame
 *                     (kind 'storm' | 'bats' | null, phase 0..1): skip work the cover hides.
 *     t               seconds, monotonic. aspect: width / height of what is being drawn; set
 *                     camera.aspect from it.
 *     Returns { here, dream, grade? }: here = a Vector3 at the traveller (world space; the same object
 *     every frame is fine); dream = 0..1 extra bloom for a held beat (0 otherwise); grade = optional
 *     overrides of GRADE.landing in movies.js ({ bloom, threshold, vignette, grain, scan }).
 *   Units: metres, y up, the ridge's crest at y = 0 where he lands (the origin), the traveller 1.72 m
 *   tall; the valley falls away toward -z, the camera sits on the +z side. Camera: a PerspectiveCamera
 *   with a 40 degree vertical fov.
 *   Colour: the frame has no sRGB encode after tone mapping, so a hex colour reads darker and richer
 *   than on a page, and a painted canvas texture reads as painted with colorSpace NoColorSpace.
 *   Build in steps: build the set a piece at a time, yielding (await a timeout) whenever a step has run
 *   ~4 ms, and report `built` false until it is whole; until then update() only places the camera
 *   (world.js holds the STORM cover over it and compiles it once it is whole).
 *   Budget: the whole frame is about 5.6 ms on the desktop GPU today; keep this scene within that:
 *   at most ~150 draw calls and ~400k triangles in view (instance repeats), one shadow-casting light
 *   (2048 map, 1024 on mobile), textures at most 2048 px, no allocation or geometry rebuilds in update().
 *   world.prepare() builds this while the reader is paused in the dive, then compiles it and draws it
 *   once at p = 0: anything hidden then (visible = false) is skipped and would compile mid-scroll, so
 *   keep things that appear later in the scene, scaled to nothing, and add late-loading models to
 *   `scene` (prepare compiles again when the scene grows).
 */
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
let seed = 3
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
// The ridge: a crest along x through the origin, falling steeply to the valley at -z and gently at +z.
const ground = (x, z) => -0.004 * z * z * (z < 0 ? 2.2 : 0.6) + 1.6 * Math.sin(x * 0.05) * Math.sin(z * 0.07) - 0.0004 * x * x
// The beats, in p (see the header).
const LEADER = [0.135, 0.16], PILLAR = [0.16, 0.335], IMPACT = 0.3, RAISE = [0.835, 0.895], LAST = 0.895
// The landing clip's own times (s): the drop to touchdown, the crouch, the rise, standing.
const CLIP = { touch: 0.58, rise: 1.42, up: 2.2, end: 3.05 }
// Seconds of "slow motion" after the impact per unit of p: the ring, dust and sparks run on this clock.
const SLOW = 12
const RING = 36 // how far the shockwave reaches (m)
const ringAt = c => RING * (1 - Math.exp(-1.1 * c))

// Value noise and fbm, shared by the sky, the grass, the ground's arcs, the shafts and the mist.
const NOISE = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= .5; } return s; }
  float fbm3(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= .5; } return s; }
`
const BOLT_RGB = [0.72, 0.84, 1]

export function createLanding(renderer, { loader, mobile = false }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900)
  scene.add(camera)
  let run = null
  const held = { here: new THREE.Vector3(0, 0.9, 0), dream: 0 }
  const hold = aspect => {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    camera.position.set(-14, 4, 30)
    camera.lookAt(0, 8, -30)
    return held
  }
  ;(async () => {
    let t0 = performance.now()
    const step = async () => {
      if (performance.now() - t0 < 4) return
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }
    seed = 3
    const FOG = new THREE.Color(0.2, 0.17, 0.22)
    scene.fog = new THREE.Fog(FOG, 30, 360)
    const SUN_DIR = new THREE.Vector3(-0.32, 0.2, -1).normalize() // low, behind the far mountains: he is rimmed against it
    const time = { value: 0 }, flash = { value: 0 }, flashPos = { value: new THREE.Vector3(0, 2, 0) }, sunK = { value: 0.3 }
    const lift = { value: 1 } // the frame's exposure: half a stop up once he has landed (the lights and the painted shaders)

    // ------------------------------------------------------------ the storm sky
    const skyU = {
      uTime: time, uSunDir: { value: SUN_DIR }, uCover: { value: 1 }, uFlash: { value: 0 }, uFlashDir: { value: new THREE.Vector3(0, 1, 0) },
      uBolt: { value: 0 }, uSwirl: { value: 0 }, uRays: { value: 0 }, uLift: lift,
    }
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(400, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: skyU,
        vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = (projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0)).xyww; }',
        fragmentShader: /* glsl */ `
          uniform float uTime, uCover, uFlash, uBolt, uSwirl, uRays, uLift; uniform vec3 uSunDir, uFlashDir; varying vec3 vDir;
          ${NOISE}
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y, sunA = max(dot(d, uSunDir), 0.);
            // Dusk: a warm band low toward the sun, mauve round the rest, indigo overhead.
            vec3 horizon = mix(vec3(.34, .24, .32), vec3(.98, .52, .28), pow(sunA, 3.));
            vec3 col = mix(horizon, mix(vec3(.2, .16, .26), vec3(.05, .05, .1), smoothstep(.15, .6, h)), smoothstep(-.02, .22, h));
            float open = 1. - uCover * .8;
            col += vec3(1., .62, .32) * (pow(sunA, 10.) * .7 + pow(sunA, 400.) * 5.) * open;
            // The overcast: a cloud deck 600 m up, turning round the column above the strike.
            float hy = max(h, .015);
            vec2 q = cameraPosition.xz + d.xz * (600. / hy);
            float r = length(q);
            float ang = uSwirl * 2.6 * exp(-r / 700.) + uTime * .012;
            float ca = cos(ang), sa = sin(ang);
            q = mat2(ca, -sa, sa, ca) * q;
            vec2 uv = q / 900. + vec2(uTime * .006, 0.);
            float n = fbm(uv);
            float n2 = fbm3(uv + uSunDir.xz * .05);
            float thr = mix(.62, .3, uCover);
            float dens = smoothstep(thr, thr + .2, n);
            float lit = clamp((n - n2) * 5. + .45, 0., 1.);
            vec3 body = mix(vec3(.07, .07, .1), vec3(.26, .22, .29), lit);
            body += vec3(1., .5, .26) * pow(sunA, 3.) * lit * (.25 + open);
            // Lightning inside the deck, the pillar's glow under the vortex.
            body += vec3(.62, .72, 1.) * uFlash * (.25 + .75 * smoothstep(.2, 1., dot(d, uFlashDir))) * (.4 + n);
            body += vec3(.55, .7, 1.) * uBolt * exp(-r / 260.) * 2.4;
            float fade = smoothstep(-.02, .1, h);
            col = mix(col, body, dens * fade);
            // Crepuscular streaks from the sun through the gaps, once it breaks.
            vec3 t1 = normalize(cross(uSunDir, vec3(0., 1., 0.))), t2 = cross(t1, uSunDir);
            float a = atan(dot(d, t2), dot(d, t1));
            float st = vnoise(vec2(a * 14., 3.1)) * vnoise(vec2(a * 31., 7.7));
            col += vec3(1., .66, .36) * st * pow(sunA, 3.) * (1. - dens * .7) * uRays * 1.2;
            gl_FragColor = vec4(col * sqrt(uLift), 1.); // the sky lifts half as much: its break is bright already
          }`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    )
    dome.frustumCulled = false
    scene.add(dome)
    await step()

    // ------------------------------------------------------------ layered mountains, hazed by distance
    {
      const pos = [], col = [], idx = []
      // Backlit by the low sun behind them: the near range a dark silhouette, the far ones paler with
      // haze; each fades into the valley's mist at its foot and catches a thin rim at its crest.
      const LAYERS = [
        { r: 175, base: -10, amp: 62, f: 1 / 55, body: [0.045, 0.04, 0.06], haze: [0.16, 0.12, 0.16], rim: 0.05 },
        { r: 250, base: 0, amp: 80, f: 1 / 70, body: [0.09, 0.075, 0.11], haze: [0.22, 0.16, 0.2], rim: 0.08 },
        { r: 340, base: 15, amp: 105, f: 1 / 85, body: [0.17, 0.13, 0.17], haze: [0.3, 0.21, 0.24], rim: 0.12 },
      ]
      const lattice = []
      for (let i = 0; i < 512; i++) lattice.push(rnd())
      const vn = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lattice[i & 511] * (1 - u) + lattice[(i + 1) & 511] * u }
      const M = 220
      LAYERS.forEach((L, li) => {
        const o = pos.length / 3
        for (let i = 0; i <= M; i++) {
          const a = -Math.PI * 0.99 + (i / M) * Math.PI * 0.98
          // Ridged noise along the arc by distance: sharp crests, worn shoulders.
          let h = 0, amp = 1, fr = L.f, s = a * L.r + li * 977
          for (let k = 0; k < 5; k++) { h += amp * (1 - Math.abs(2 * vn(s * fr) - 1)) ** 1.5; amp *= 0.47; fr *= 2.03 }
          const y = L.base + L.amp * h * 0.62
          const x = Math.cos(a) * L.r, z = Math.sin(a) * L.r
          const toSun = Math.max(0, (Math.cos(a) * SUN_DIR.x + Math.sin(a) * SUN_DIR.z) / Math.hypot(SUN_DIR.x, SUN_DIR.z)) ** 4
          const rim = L.rim * (0.4 + toSun)
          pos.push(x, -170, z, x, y - 6 - 0.35 * (y + 40), z, x, y, z)
          col.push(...L.haze, ...L.body, L.body[0] + rim * 1.4, L.body[1] + rim * 0.8, L.body[2] + rim * 0.6)
          if (i < M) for (const k of [0, 1]) idx.push(o + i * 3 + k, o + i * 3 + 3 + k, o + i * 3 + 1 + k, o + i * 3 + 1 + k, o + i * 3 + 3 + k, o + i * 3 + 4 + k)
        }
      })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      g.setIndex(idx)
      const mts = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: { uFlash: flash, uSun: sunK, uLift: lift, uSunDir: { value: SUN_DIR } },
        vertexShader: 'attribute vec3 color; varying vec3 vC; varying vec3 vP; void main() { vC = color; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: `uniform float uFlash, uSun, uLift; uniform vec3 uSunDir; varying vec3 vC; varying vec3 vP;
          ${NOISE}
          void main() {
            float a = atan(vP.z, vP.x) * length(vP.xz);
            float rock = vnoise(vec2(a * .08, vP.y * .012)) * .6 + vnoise(vec2(a * .3, vP.y * .05)) * .4; // gullies down the faces
            vec3 c = vC * (.8 + .4 * rock) * (1. + uSun * .15) + vec3(.5, .58, .8) * uFlash * .08 * smoothstep(-60., 80., vP.y);
            // Deep in the dusk's haze, more the further and the lower, so the ranges read as air, not facets.
            float toSun = pow(max(dot(normalize(vP.xz), normalize(uSunDir.xz)), 0.), 6.);
            vec3 haze = vec3(.3, .22, .28) * (1. + uSun * .4) + vec3(.9, .5, .3) * toSun * .25 * (.3 + uSun);
            float k = .25 + .45 * smoothstep(160., 360., length(vP.xz)) + .25 * (1. - smoothstep(-40., 60., vP.y));
            gl_FragColor = vec4(mix(c, haze, min(k, .85)) * uLift, 1.);
          }`,
        fog: false,
        side: THREE.DoubleSide,
      }))
      mts.frustumCulled = false
      scene.add(mts)
    }
    await step()

    // ------------------------------------------------------------ the ridge and the valley
    {
      const N = mobile ? 120 : 160
      const land = new THREE.PlaneGeometry(2, 2, N, N).rotateX(-Math.PI / 2)
      const P = land.attributes.position, col = new Float32Array(P.count * 3)
      const warp = u => 260 * (0.22 * u + 0.78 * u * u * u) // dense under him, coarse toward the edges
      for (let i = 0; i < P.count; i++) {
        const x = warp(P.getX(i)), z = warp(P.getZ(i)), y = ground(x, z)
        P.setXYZ(i, x, y, z)
        // Dusky olive turf, darker in hollows, bare rock down the valley side.
        const rock = Math.min(1, Math.max(0, (-z - 25) / 60)), k = (0.8 + 0.35 * rnd()) * 1.4 // turf under the blades, not black between them
        col[i * 3] = (0.075 + 0.05 * rock) * k
        col[i * 3 + 1] = (0.085 + 0.02 * rock) * k
        col[i * 3 + 2] = (0.045 + 0.05 * rock) * k
      }
      land.setAttribute('color', new THREE.BufferAttribute(col, 3))
      land.computeVertexNormals()
      const mesh = new THREE.Mesh(land, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
      mesh.receiveShadow = true
      scene.add(mesh)
    }
    await step()

    // Stones: weathered boulders scattered on the ridge, and three tall standing stones framing it.
    {
      const rock = (detail, sx, sy, sz, rough) => {
        const g = new THREE.IcosahedronGeometry(1, detail)
        const p = g.attributes.position, v = new THREE.Vector3(), col = new Float32Array(p.count * 3)
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i)
          const n = 1 + rough * (Math.sin(v.x * 3.1 + v.y * 1.7) * Math.cos(v.z * 2.3 - v.y * 2.9) + 0.5 * Math.sin(v.x * 7 + v.z * 5))
          p.setXYZ(i, v.x * sx * n, v.y * sy * n, v.z * sz * n)
          // Weathered stone, warm enough that the storm's blue light leaves it grey: darker toward the turf,
          // lichen in patches.
          const lichen = Math.max(0, Math.sin(v.x * 5.3 - v.z * 4.1) * Math.sin(v.y * 6.7 + v.x * 2.2))
          const k = (0.75 + 0.25 * Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1)) * (0.55 + 0.45 * Math.min(1, (v.y + 1) * 0.8))
          col[i * 3] = (0.36 + 0.06 * lichen) * k
          col[i * 3 + 1] = (0.27 + 0.1 * lichen) * k
          col[i * 3 + 2] = (0.17 + 0.01 * lichen) * k
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3))
        g.computeVertexNormals()
        return g
      }
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })
      const COUNT = mobile ? 40 : 70
      const stones = new THREE.InstancedMesh(rock(1, 1.2, 0.7, 1, 0.16), mat, COUNT)
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), axis = new THREE.Vector3()
      for (let i = 0; i < COUNT; i++) {
        let x, z
        do { x = (rnd() - 0.5) * 80; z = (rnd() - 0.55) * 46 } while (Math.hypot(x, z) < 7 || (z > 0 && Math.abs(x + z * 0.3) < 6)) // clear of where he lands and of the camera's path
        const r = 0.15 + rnd() ** 2.5 * 1.3
        stones.setMatrixAt(i, m.compose(v.set(x, ground(x, z) + r * 0.15, z), q.setFromAxisAngle(axis.set(rnd() - 0.5, 1, rnd() - 0.5).normalize(), rnd() * 6), s.setScalar(r)))
      }
      stones.castShadow = stones.receiveShadow = true
      scene.add(stones)
      const tall = new THREE.InstancedMesh(rock(2, 0.55, 2.2, 0.4, 0.17), mat, 3)
      ;[[-11, -7, 1.6, 0.2], [8.5, -10, 1.25, -0.15], [17, -4, 0.9, 0.1]].forEach(([x, z, k, tilt], i) => {
        tall.setMatrixAt(i, m.compose(v.set(x, ground(x, z) + 1.4 * k, z), q.setFromAxisAngle(axis.set(0.3, 0, 1).normalize(), tilt), s.setScalar(k)))
      })
      tall.castShadow = tall.receiveShadow = true
      scene.add(tall)
    }
    await step()

    // ------------------------------------------------------------ grass: instanced blades in one draw
    const shock = { uRing: { value: 0 }, uShock: { value: 0 }, uCrater: { value: 0 } }
    const grassU = {
      uTime: time, ...shock, uWind: { value: 1 }, uFlash: flash, uFlashPos: flashPos, uSun: sunK, uLift: lift,
      uSunDir: { value: SUN_DIR }, uFogCol: { value: FOG }, uFogNear: { value: 30 }, uFogFar: { value: 360 },
    }
    {
      const blade = new THREE.InstancedBufferGeometry()
      blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.33, 0.5, 0, 0.33, 0.5, 0, 0, 1, 0], 3))
      blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4])
      const COUNT = mobile ? 22000 : 46000
      const at = new Float32Array(COUNT * 3), info = new Float32Array(COUNT * 4)
      for (let i = 0; i < COUNT; ) {
        const x = (rnd() - 0.5) * 100, z = -34 + rnd() * 66
        const d = Math.hypot(x, z - 4)
        if (rnd() > Math.exp(-d / 11) + 0.08) continue
        const r = Math.hypot(x, z)
        at[i * 3] = x
        at[i * 3 + 1] = ground(x, z) - 0.03
        at[i * 3 + 2] = z
        // yaw, height (shorter where he lands, for the low camera), lean, tint
        info[i * 4] = rnd() * Math.PI
        info[i * 4 + 1] = (0.28 + 0.42 * rnd()) * (0.5 + 0.5 * ss(2.5, 12, r)) * (1 + d / 50)
        info[i * 4 + 2] = rnd()
        info[i * 4 + 3] = rnd()
        i++
        if ((i & 4095) === 0) await step()
      }
      blade.setAttribute('iPos', new THREE.InstancedBufferAttribute(at, 3))
      blade.setAttribute('iBlade', new THREE.InstancedBufferAttribute(info, 4))
      blade.instanceCount = COUNT
      const grass = new THREE.Mesh(blade, new THREE.ShaderMaterial({
        uniforms: grassU,
        vertexShader: /* glsl */ `
          attribute vec3 iPos; attribute vec4 iBlade;
          uniform float uTime, uRing, uShock, uCrater, uWind;
          varying float vY, vTint, vFlat; varying vec3 vW;
          void main() {
            float y = position.y, h = iBlade.y * smoothstep(.3, 1.4, distance(iPos.xz, cameraPosition.xz)); // parted round the lens
            vec2 rel = iPos.xz; float r = length(rel) + 1e-3; vec2 outward = rel / r;
            // The shockwave: blades bow out ahead of the ring and lie flat as it passes, then spring
            // back behind it; inside the crater they stay down.
            float passed = uRing - r;
            float front = smoothstep(-1.4, 0., passed) * (passed < 0. ? 1. : exp(-passed / 6.));
            // (and round the landing, out to where the camera works, they stay laid over)
            float flat_ = clamp(front * uShock + uCrater * (1. - smoothstep(1.8, 5.5, r)) + uCrater * .75 * step(0., passed) * (1. - smoothstep(6., 11., r)), 0., 1.);
            float sway = sin(uTime * 1.9 + iPos.x * .35 + iPos.z * .27) * .6 + sin(uTime * 3.3 + iPos.x * .9 - iPos.z * .4) * .25;
            vec2 bend = vec2(.8, .6) * ((iBlade.z - .3) * .7 + sway * uWind) * (1. - flat_) + outward * flat_ * 1.5;
            float a = max(length(bend), 1e-3); vec2 dir = bend / a;
            float ay = a * y;
            float horiz = h * (1. - cos(ay)) / a, vert = h * sin(ay) / a;
            vec2 side = vec2(cos(iBlade.x), sin(iBlade.x));
            float w = .028 + .03 * smoothstep(5., 30., r); // fine blades near, broader where they only read as turf
            vec3 p = iPos + vec3(side.x * position.x * w, 0., side.y * position.x * w) + vec3(dir.x * horiz, vert, dir.y * horiz);
            vY = y; vTint = iBlade.w; vFlat = flat_; vW = p;
            gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uFlash, uSun, uFogNear, uFogFar, uLift; uniform vec3 uSunDir, uFogCol, uFlashPos;
          varying float vY, vTint, vFlat; varying vec3 vW;
          void main() {
            vec3 base = mix(vec3(.025, .035, .02), vec3(.11, .12, .055), vY) * (.75 + .5 * vTint);
            vec3 V = normalize(cameraPosition - vW);
            float back = pow(max(dot(-V, uSunDir), 0.), 5.) * vY * vY;
            vec3 c = base * 1.75 + vec3(1., .6, .3) * (.12 + 1.6 * back) * uSun * vY * (.3 + .7 * vTint) * .35;
            c += vec3(.1, .09, .13) * vY * .8;
            float dF = length(vW - uFlashPos);
            c += vec3(.62, .74, 1.) * uFlash * (.1 + vY) * .45 / (1. + dF * dF * .08);
            c *= mix(1., .55, vFlat * (1. - vY));
            float fog = smoothstep(uFogNear, uFogFar, length(vW - cameraPosition));
            gl_FragColor = vec4(mix(c, uFogCol, fog) * uLift, 1.);
          }`,
        side: THREE.DoubleSide,
      }))
      grass.frustumCulled = false
      scene.add(grass)
    }
    await step()

    // ------------------------------------------------------------ the scorched ground, the arcs, the ring
    const groundU = { uTime: time, ...shock, uScorch: { value: 0 }, uArcs: { value: 0 }, uArcR: { value: 5 }, uGlow: { value: 0 }, uStill: { value: 0 } }
    {
      const g = new THREE.PlaneGeometry(90, 90, 120, 120).rotateX(-Math.PI / 2)
      const p = g.attributes.position
      for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)) + 0.06)
      const decal = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: groundU,
        vertexShader: 'varying vec2 vXZ; void main() { vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: /* glsl */ `
          uniform float uTime, uRing, uShock, uScorch, uArcs, uArcR, uGlow, uStill; varying vec2 vXZ;
          ${NOISE}
          void main() {
            float r = length(vXZ);
            // Each layer only where it can show (the uniforms branch the same way for every pixel).
            if (r > 16. && abs(r - uRing) > 3. || uScorch + uArcs + uGlow + uShock < .002) discard;
            vec3 rgb = vec3(0.);
            float a = 0., sc = 0.;
            if (uScorch > 0. && r < 11.) {
              // Scorch: burned turf round the landing, ragged at its edge, with radial cracks.
              float edge = 3.2 + fbm3(vXZ * .7) * 2.4;
              float cr = vnoise(vec2(atan(vXZ.y, vXZ.x) * 9., r * .4));
              sc = uScorch * (1. - smoothstep(edge - 1.2, edge, r)) + uScorch * smoothstep(.75, .9, cr) * (1. - smoothstep(4., 9., r)) * .7;
              a = clamp(sc, 0., 1.) * .88;
              rgb = vec3(.01, .008, .006) * a;
              // Embers glowing in the scorch as it cools.
              if (uShock > .01) rgb += vec3(1., .42, .12) * smoothstep(.72, .9, fbm3(vXZ * 2.2)) * sc * uShock * .8;
            }
            if (uArcs > 0. && r < uArcR) {
              // Arcs crawling over the ground: thin, broken, ever-shifting lines.
              float tt = uStill > .5 ? 1.3 : uTime;
              float n = fbm3(vXZ * .5 + vec2(tt * 1.7, -tt * 1.3));
              float line = 1. - smoothstep(0., .012, abs(n - .5));
              line *= smoothstep(.4, .62, vnoise(vXZ * 1.4 - tt * 2.6));
              float flick = uStill > .5 ? 1. : .55 + .45 * step(.4, fract(uTime * 13.1));
              rgb += vec3(.5, .66, 1.) * line * uArcs * (1. - smoothstep(uArcR * .6, uArcR, r)) * flick * 2.2 * smoothstep(1.5, 5., length(vXZ - cameraPosition.xz));
            }
            // The shock ring's bright foot, and the strike's glow on the turf.
            if (uShock > .01) rgb += vec3(.62, .8, 1.) * exp(-abs(r - uRing) * 3.) * uShock * (.6 + .4 * vnoise(vXZ * 3.)) * smoothstep(3., 9., length(vXZ - cameraPosition.xz)); // a ring, not a puddle at the lens
            rgb += vec3(.85, .9, 1.) * uGlow * .6 * exp(-r * .5);
            gl_FragColor = vec4(rgb, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        fog: false,
      }))
      decal.frustumCulled = false
      decal.renderOrder = 1
      scene.add(decal)
    }
    // The wave's wall of air, rising off the ring.
    const wallU = { uShock: shock.uShock, uTime: time }
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true).translate(0, 0.5, 0), new THREE.ShaderMaterial({
      uniforms: wallU,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */ `
        uniform float uShock, uTime; varying vec2 vUv;
        ${NOISE}
        void main() {
          float a = exp(-vUv.y * 4.) * smoothstep(0., .08, vUv.y) * uShock * (.5 + .5 * vnoise(vec2(vUv.x * 80., vUv.y * 3. - uTime)));
          gl_FragColor = vec4(vec3(.6, .72, .95) * a * .5, 1.);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    }))
    wall.position.y = -0.6
    wall.frustumCulled = false
    scene.add(wall)
    await step()

    // ------------------------------------------------------------ dust lifting off the ring, and sparks
    const clockU = { value: -1 }
    {
      const COUNT = mobile ? 160 : 340
      const g = new THREE.InstancedBufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
      g.setIndex([0, 1, 2, 0, 2, 3])
      const A = new Float32Array(COUNT * 4), B = new Float32Array(COUNT * 4)
      for (let i = 0; i < COUNT; i++) {
        const rb = 0.6 + rnd() ** 1.4 * (RING - 4), ang = rnd() * Math.PI * 2
        A.set([ang, rb, -Math.log(1 - rb / RING) / 1.1, (1.2 + rnd() * 2.2) * (1 + rb / 25)], i * 4)
        B.set([ground(Math.cos(ang) * rb, Math.sin(ang) * rb) + 0.2, 0.6 + rnd() * 2.4, 1 + rnd() * 3, rnd()], i * 4)
      }
      g.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4))
      g.setAttribute('aB', new THREE.InstancedBufferAttribute(B, 4))
      g.instanceCount = COUNT
      const dust = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: { uClock: clockU, uFlash: flash, uSun: sunK },
        vertexShader: /* glsl */ `
          attribute vec4 aA, aB; uniform float uClock; varying float vA; varying vec2 vUv; varying float vSeed;
          void main() {
            float age = uClock - aA.z, life = 2.6 + aB.w * 2.;
            float k = clamp(age / life, 0., 1.), alive = step(0., age) * step(age, life);
            vec2 dir = vec2(cos(aA.x), sin(aA.x));
            float rr = aA.y + aB.z * (1. - exp(-age * 1.4));
            vec3 c = vec3(dir.x * rr, aB.x + aB.y * (1. - exp(-age * .7)), dir.y * rr);
            float s = aA.w * (.3 + 1.1 * sqrt(k)) * alive;
            vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
            vec3 w = c + (right * position.x + up * position.y) * s;
            vA = alive * smoothstep(0., .12, age) * (1. - smoothstep(.3, 1., k)) * .3 * smoothstep(1.5, 5., length(c - cameraPosition));
            vUv = position.xy + .5; vSeed = aB.w;
            gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uFlash, uSun; varying float vA; varying vec2 vUv; varying float vSeed;
          ${NOISE}
          void main() {
            float d = length(vUv - .5);
            float a = (1. - smoothstep(.15, .5, d)) * vA * (.55 + .45 * vnoise(vUv * 5. + vSeed * 20.));
            vec3 c = vec3(.2, .17, .18) + vec3(.5, .6, .85) * uFlash * .2 + vec3(.3, .18, .1) * uSun * .3;
            gl_FragColor = vec4(c, a);
          }`,
        transparent: true, depthWrite: false, fog: false,
      }))
      dust.frustumCulled = false
      dust.renderOrder = 2
      scene.add(dust)
    }
    {
      // Sparks: thrown off the impact on ballistic arcs, and kicked up where the arcs crawl.
      const COUNT = mobile ? 160 : 300
      const S = new Float32Array(COUNT * 2 * 4), T = new Float32Array(COUNT * 2 * 4), pos = new Float32Array(COUNT * 2 * 3)
      for (let i = 0; i < COUNT; i++) {
        const late = i % 3 === 0
        const a = rnd() * Math.PI * 2, up = late ? 0.4 + rnd() * 0.6 : 0.15 + rnd() * 0.85, sp = late ? 1 + rnd() * 2.5 : 3 + rnd() * 7
        const r0 = late ? 1 + rnd() * 9 : rnd() * 0.6
        const o = [Math.cos(a) * r0, 0, Math.sin(a) * r0]
        o[1] = ground(o[0], o[2]) + 0.08
        const h = Math.sqrt(1 - up * up)
        for (let e = 0; e < 2; e++) {
          const j = i * 2 + e
          pos.set(o, j * 3)
          S.set([Math.cos(a) * h * sp, up * sp, Math.sin(a) * h * sp, e], j * 4)
          T.set([late ? 0.2 + rnd() * 2.6 : rnd() * 0.15, 0.5 + rnd() * (late ? 0.5 : 1.3), rnd(), 0], j * 4)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      g.setAttribute('aS', new THREE.BufferAttribute(S, 4))
      g.setAttribute('aT', new THREE.BufferAttribute(T, 4))
      const sparks = new THREE.LineSegments(g, new THREE.ShaderMaterial({
        uniforms: { uClock: clockU },
        vertexShader: /* glsl */ `
          attribute vec4 aS, aT; uniform float uClock; varying float vL;
          void main() {
            float age = uClock - aT.x;
            float alive = step(0., age) * step(age, aT.y);
            float tau = max(age - aS.w * .045, 0.);
            vec3 p = position + aS.xyz * tau + vec3(0., -4.9 * tau * tau, 0.);
            p.y = max(p.y, position.y);
            vL = alive * (1. - age / aT.y) * smoothstep(2., 5., length(p - cameraPosition)); // none streaking past the lens
            gl_Position = projectionMatrix * viewMatrix * vec4(mix(position, p, alive), 1.);
          }`,
        fragmentShader: 'varying float vL; void main() { gl_FragColor = vec4(mix(vec3(1., .45, .15), vec3(.8, .9, 1.), vL) * vL * 6., 1.); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      }))
      sparks.frustumCulled = false
      scene.add(sparks)
    }
    await step()

    // ------------------------------------------------------------ the lightning: branching bolts and the pillar
    const boltU = { uVariant: { value: -9 }, uReach: { value: 0 }, uWidth: { value: 1 }, uBright: { value: 0 } }
    const bolts = new THREE.Object3D()
    {
      const P = [], TAN = [], INFO = [], IDX = []
      // A jagged path by midpoint displacement, as a camera-facing ribbon (built in the vertex shader).
      const path = (a, b, levels, jag) => {
        let pts = [a, b]
        for (let l = 0; l < levels; l++) {
          const next = [pts[0]]
          for (let i = 1; i < pts.length; i++) {
            const p0 = pts[i - 1], p1 = pts[i], len = p0.distanceTo(p1)
            const mid = p0.clone().add(p1).multiplyScalar(0.5)
            mid.x += (rnd() - 0.5) * len * jag
            mid.z += (rnd() - 0.5) * len * jag
            mid.y += (rnd() - 0.5) * len * jag * 0.3
            next.push(mid, p1)
          }
          pts = next
        }
        return pts
      }
      const ribbon = (pts, w0, w1, variant, t0, t1) => {
        const o = P.length / 3
        pts.forEach((p, i) => {
          const q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)]
          const tan = q.clone().sub(r).normalize()
          const f = i / (pts.length - 1)
          for (const side of [-1, 1]) {
            P.push(p.x, p.y, p.z)
            TAN.push(tan.x, tan.y, tan.z)
            INFO.push(THREE.MathUtils.lerp(w0, w1, f), variant, THREE.MathUtils.lerp(t0, t1, f), side)
          }
          if (i) IDX.push(o + i * 2 - 2, o + i * 2 - 1, o + i * 2, o + i * 2 - 1, o + i * 2 + 1, o + i * 2)
        })
      }
      const TOP = 160
      for (let v = 0; v < 4; v++) {
        const trunk = path(new THREE.Vector3((rnd() - 0.5) * 6, TOP, (rnd() - 0.5) * 6), new THREE.Vector3(0, 0, 0), 8, 0.32)
        ribbon(trunk, 0.45, 0.35, v, 0, 1)
        const branches = 4 + Math.floor(rnd() * 3)
        for (let k = 0; k < branches; k++) {
          const i = Math.floor((0.08 + rnd() * 0.7) * trunk.length), a = trunk[i]
          const len = 14 + rnd() * 38, ang = rnd() * Math.PI * 2
          const b = a.clone().add(new THREE.Vector3(Math.cos(ang) * len * 0.8, -len * (0.5 + rnd() * 0.5), Math.sin(ang) * len * 0.8))
          const t0 = i / (trunk.length - 1)
          const br = path(a, b, 6, 0.6)
          ribbon(br, 0.22, 0.03, v, t0, t0 + len / TOP)
          if (k % 2) continue
          // A twig off every other branch.
          const j = Math.floor(br.length * (0.3 + rnd() * 0.4)), c = br[j]
          ribbon(path(c, c.clone().add(new THREE.Vector3((rnd() - 0.5) * 14, -6 - rnd() * 10, (rnd() - 0.5) * 14)), 5, 0.7), 0.12, 0.02, v, t0 + 0.05, t0 + 0.15)
        }
        await step()
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
      g.setAttribute('aTan', new THREE.Float32BufferAttribute(TAN, 3))
      g.setAttribute('aInfo', new THREE.Float32BufferAttribute(INFO, 4))
      g.setIndex(IDX)
      const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: boltU,
        vertexShader: /* glsl */ `
          attribute vec3 aTan; attribute vec4 aInfo; uniform float uVariant, uReach, uWidth; varying float vSide, vOn;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.);
            vec3 tanW = normalize(mat3(modelMatrix) * aTan);
            vec3 V = normalize(cameraPosition - wp.xyz);
            vec3 side = normalize(cross(tanW, V) + 1e-5);
            float on = (1. - step(.5, abs(aInfo.y - uVariant))) * step(aInfo.z, uReach);
            float dist = length(cameraPosition - wp.xyz);
            float w = max(aInfo.x * uWidth * 1.1, dist * .0016) * on; // never thinner than a couple of pixels
            wp.xyz += side * w * aInfo.w;
            vSide = aInfo.w; vOn = on;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uBright; varying float vSide, vOn;
          void main() {
            float core = exp(-vSide * vSide * 18.) * 2.5 + exp(-vSide * vSide * 3.) * .45;
            gl_FragColor = vec4(vec3(${BOLT_RGB.join(',')}) * core * uBright * vOn, 1.);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
      }))
      mesh.frustumCulled = false
      bolts.add(mesh)
      scene.add(bolts)
    }
    // The pillar: a column of light round the bolt, turned to the camera about its own axis.
    const pillarU = { uTime: time, uOn: { value: 0 }, uHalf: { value: 9 } }
    {
      const g = new THREE.PlaneGeometry(2, 170, 1, 40).translate(0, 85, 0)
      const pillar = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: pillarU,
        vertexShader: /* glsl */ `
          uniform float uHalf; varying vec2 vP;
          void main() {
            vec3 base = (modelMatrix * vec4(0., position.y, 0., 1.)).xyz;
            vec3 toCam = cameraPosition - base; toCam.y = 0.;
            vec3 side = normalize(vec3(-toCam.z, 0., toCam.x) + 1e-5);
            vP = vec2(position.x * uHalf, position.y);
            gl_Position = projectionMatrix * viewMatrix * vec4(base + side * position.x * uHalf, 1.);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uOn; varying vec2 vP;
          ${NOISE}
          void main() {
            float x = vP.x;
            float flow = vnoise(vec2(x * 1.4, vP.y * .05 + uTime * 5.)) * .6 + .7;
            float core = exp(-x * x * 2.2) * 2.2 + exp(-abs(x) * .55) * .32 * flow;
            core *= 1. + 1.5 * exp(-vP.y * .35); // brightest where it meets the ground
            core *= smoothstep(170., 120., vP.y);
            gl_FragColor = vec4(vec3(.7, .82, 1.) * core * uOn, 1.);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
      }))
      pillar.frustumCulled = false
      scene.add(pillar)
    }
    await step()

    // ------------------------------------------------------------ god-rays and the valley mist
    const raysU = { uTime: time, uRays: { value: 0 } }
    {
      const P = [], AX = [], INFO = [], IDX = []
      for (let k = 0; k < 7; k++) {
        const q = new THREE.Vector3(-30 + k * 10 + (rnd() - 0.5) * 6, -2 + rnd() * 8, -12 - rnd() * 30)
        const a = q.clone().addScaledVector(SUN_DIR, 220), b = q.clone().addScaledVector(SUN_DIR, -25)
        const w = 6 + rnd() * 14, o = P.length / 3
        for (const [p, u] of [[a, 0], [b, 1]]) for (const s of [-1, 1]) {
          P.push(p.x, p.y, p.z)
          AX.push(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z)
          INFO.push(u, s, w, rnd())
        }
        IDX.push(o, o + 1, o + 2, o + 1, o + 3, o + 2)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
      g.setAttribute('aAxis', new THREE.Float32BufferAttribute(AX, 3))
      g.setAttribute('aInfo', new THREE.Float32BufferAttribute(INFO, 4))
      g.setIndex(IDX)
      const rays = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: raysU,
        vertexShader: /* glsl */ `
          attribute vec3 aAxis; attribute vec4 aInfo; varying vec2 vI; varying float vSeed;
          void main() {
            vec3 V = normalize(cameraPosition - position);
            vec3 side = normalize(cross(aAxis, V) + 1e-5);
            vI = aInfo.xy; vSeed = aInfo.w;
            gl_Position = projectionMatrix * viewMatrix * vec4(position + side * aInfo.y * aInfo.z, 1.);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uRays; varying vec2 vI; varying float vSeed;
          ${NOISE}
          void main() {
            float across = pow(1. - vI.y * vI.y, 3.);
            float along = smoothstep(0., .25, vI.x) * (1. - smoothstep(.55, 1., vI.x));
            float n = .45 + .55 * vnoise(vec2(vI.y * 2.5 + vSeed * 9., vI.x * 3. - uTime * .05));
            gl_FragColor = vec4(vec3(1., .7, .42) * across * along * n * uRays * .035, 1.);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
      }))
      rays.frustumCulled = false
      rays.renderOrder = 3
      scene.add(rays)

      // Mist: decks lying in the valley, and two veils hung across it, drifting.
      const MP = [], MI = [], MIDX = []
      const quad = (c, ax, ay, op) => {
        const o = MP.length / 3, id = o / 4
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          MP.push(c.x + ax.x * u + ay.x * v, c.y + ax.y * u + ay.y * v, c.z + ax.z * u + ay.z * v)
          MI.push((u + 1) / 2, (v + 1) / 2, op, id)
        }
        MIDX.push(o, o + 1, o + 2, o, o + 2, o + 3)
      }
      const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1)
      quad(new THREE.Vector3(0, -28, -190), X.clone().multiplyScalar(340), Z.clone().multiplyScalar(150), 0.75)
      quad(new THREE.Vector3(0, -55, -210), X.clone().multiplyScalar(360), Z.clone().multiplyScalar(170), 0.9)
      quad(new THREE.Vector3(0, -12, -60), X.clone().multiplyScalar(160), Y.clone().multiplyScalar(26), 0.35)
      quad(new THREE.Vector3(0, -20, -120), X.clone().multiplyScalar(300), Y.clone().multiplyScalar(45), 0.5)
      const mg = new THREE.BufferGeometry()
      mg.setAttribute('position', new THREE.Float32BufferAttribute(MP, 3))
      mg.setAttribute('aInfo', new THREE.Float32BufferAttribute(MI, 4))
      mg.setIndex(MIDX)
      const mist = new THREE.Mesh(mg, new THREE.ShaderMaterial({
        uniforms: { uTime: time, uFlash: flash, uSun: sunK, uSunDir: { value: SUN_DIR } },
        vertexShader: 'attribute vec4 aInfo; varying vec4 vI; varying vec3 vW; void main() { vI = aInfo; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }',
        fragmentShader: /* glsl */ `
          uniform float uTime, uFlash, uSun; uniform vec3 uSunDir; varying vec4 vI; varying vec3 vW;
          ${NOISE}
          void main() {
            vec2 uv = vI.xy;
            float edge = smoothstep(0., .25, uv.x) * smoothstep(1., .75, uv.x) * smoothstep(0., .3, uv.y) * smoothstep(1., .55, uv.y);
            float n = fbm3(uv * vec2(5., 2.5) + vec2(uTime * .012 + vI.w * 3., vI.w));
            float a = smoothstep(.35, .8, n) * edge * vI.z;
            vec3 V = normalize(vW - cameraPosition);
            vec3 c = vec3(.3, .24, .3) + vec3(.9, .5, .3) * pow(max(dot(V, uSunDir), 0.), 4.) * (.2 + uSun * .6) + vec3(.5, .6, .9) * uFlash * .15;
            gl_FragColor = vec4(c, a);
          }`,
        transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      }))
      mist.frustumCulled = false
      mist.renderOrder = 1
      scene.add(mist)
    }
    await step()

    // ------------------------------------------------------------ light
    const hemi = new THREE.HemisphereLight('#8a90c8', '#2c2226', 1.9)
    const sun = new THREE.DirectionalLight('#ffa66a', 1.1) // low behind him: his rim
    sun.castShadow = true
    const HALF = 9
    sun.shadow.mapSize.setScalar(mobile ? 1024 : 2048)
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.04
    Object.assign(sun.shadow.camera, { left: -HALF, right: HALF, top: HALF, bottom: -HALF, near: 1, far: 140 })
    sun.position.copy(SUN_DIR).multiplyScalar(70)
    const fill = new THREE.DirectionalLight('#8a98d0', 2.4) // the storm's cool light from the camera's side
    fill.position.set(-20, 30, 40)
    const strike = new THREE.PointLight('#dfe6ff', 0, 0, 2)
    strike.position.set(0, 3, 0)
    // A weak front fill on him from the camera's side, reaching little past him.
    const front = new THREE.PointLight('#d6d2ea', 24, 9, 2)
    front.position.set(-1.4, 1.6, 3.2)
    // The storm's cold top-key: steep from above, a little in front, so the discs and the cape's folds catch it; flares with the lightning.
    const top = new THREE.DirectionalLight('#c4d2ff', 0)
    top.position.set(3, 30, 9)
    scene.add(hemi, sun, sun.target, fill, fill.target, strike, front, top, top.target)
    await step()

    // ------------------------------------------------------------ the traveller, his armour and Stormbreaker
    let you = null, land = null, stance = null, axe = null
    const bones = {}
    const charge = { value: 0 }
    const capeU = { uCapeT: { value: 0 }, uWind: { value: 1 }, uFall: { value: 0 }, uFloor: { value: 0 }, uScale: { value: 1 }, uRimDir: { value: new THREE.Vector3() }, uRimCol: { value: new THREE.Color() } }
    try {
      const [t, clips, suit, axeGltf] = await Promise.all([
        loadTraveller(loader),
        loader.loadAsync('/cinema/landing/land.glb').then(g => g.animations),
        loader.loadAsync('/cinema/suits/thor.glb'),
        loader.loadAsync('/cinema/landing/axe.glb'),
      ])
      you = t.make({ look: 'pbr' })
      you.root.traverse(o => {
        if (!o.isSkinnedMesh) return
        o.material.map = alohaLinear()
        o.castShadow = false // the armour casts his shadow
        headOnly(o.material, o.skeleton.bones.map(b => (['neck', 'Head', 'head_end', 'headfront'].includes(b.name) ? 1 : 0)))
      })
      // The dusk for the metal to reflect (the armour's discs and mail, the axe): the storm deck above, the
      // soft band toward the low sun, the dark ridge below. Only theirs, not the scene's.
      await new Promise(r => setTimeout(r))
      const envScene = new THREE.Scene()
      envScene.add(sky({ top: '#2c2c3a', mid: '#4c4858', low: '#6a5e66', sunDir: SUN_DIR, sun: '#b08870' }))
      const pm = new THREE.PMREMGenerator(renderer)
      const env = pm.fromScene(envScene, 0, 0.1, 400, { size: 64 }).texture
      pm.dispose()
      envScene.traverse(o => { o.geometry?.dispose(); o.material?.dispose() })
      await new Promise(r => setTimeout(r))
      // A phone takes the suit's 2048 px maps at 1024 (as dive.js does the spider's): a quarter of the memory.
      if (mobile) {
        const maps = new Set()
        suit.scene.traverse(o => { for (const v of Object.values(o.material ?? {})) if (v?.isTexture && v.image?.width > 1024) maps.add(v) })
        for (const tex of maps) {
          const c = document.createElement('canvas')
          c.width = c.height = 1024
          c.getContext('2d').drawImage(tex.image, 0, 0, 1024, 1024)
          tex.image = c
          tex.needsUpdate = true
        }
        await new Promise(r => setTimeout(r))
      }
      t0 = performance.now()
      const worn = wearSuit(you.root, suit.scene)
      for (const m of worn.meshes) armour(m.material, capeU, m.skeleton.bones.findIndex(b => b.name === 'Spine'), m.skeleton.bones.map(b => (/UpLeg|Leg|Foot|Toe/.test(b.name) ? 1 : 0)), env)
      capeU.uScale.value = you.root.scale.x
      you.root.rotation.y = -0.38 // three-quarters to the camera
      axe = makeAxe(axeGltf.scene.getObjectByName('stormbreaker') ?? axeGltf.scene, charge, capeU.uCapeT, env, capeU) // its crawl holds still under reduced motion, as the cape does
      // Laid about the fist in his rest pose (fist at x -0.7, y 1.26; its grip runs front to back), then
      // parented to the hand, as the other worlds' gear is.
      axe.group.position.set(-0.7, 1.26, 0)
      you.root.add(axe.group)
      you.root.updateMatrixWorld(true)
      you.bone('RightHand').attach(axe.group)
      for (const n of ['RightArm', 'RightForeArm', 'RightHand']) bones[n] = you.bone(n)
      land = you.mixer.clipAction(clips[0])
      stance = you.actions.Axe_Breathe_and_Look_Around
      for (const a of [land, stance]) {
        a.setLoop(THREE.LoopRepeat, Infinity)
        a.play()
        a.setEffectiveTimeScale(0)
      }
      scene.add(you.root)
    } catch (e) {
      console.warn('landing: the traveller did not load', e)
      you = null
    }
    await step()

    // ------------------------------------------------------------ the camera's path
    // Keys: [p, camera, target]. Wide on the storm; up the pillar; down with the drop; low on the landing;
    // round as he rises; back for the storm breaking; up at the raised axe.
    const KEYS = [
      [0, [-15, 4.5, 32], [0, 9, -30]],
      [0.12, [-12, 3, 26], [0, 11, -6]],
      [0.15, [-11, 2.4, 24], [0, 24, -2]],
      [0.2, [-9, 1.8, 20], [0, 15, 0]],
      [0.25, [-7, 1.3, 15], [0, 6, 0]],
      [0.3, [-3.4, 0.4, 4.9], [0, 1.7, -1]], // the impact: low in the grass, looking up past him into the pillar
      [0.43, [-2.5, 0.38, 4.7], [0, 1.5, -1]], // held low for the shockwave; up to the old height only as he rises
      [0.56, [-1.6, 0.45, 4.2], [0, 1, 0]], // the rise: a low hero angle, half a metre up, looking up at him
      [0.7, [0.8, 0.55, 3.7], [0, 1.25, 0]], // close on him as he stands: about 60% of the frame's height
      [0.82, [1.2, 0.6, 3.8], [0, 1.35, -0.6]], // not far round: the blade stays in profile
      [0.92, [2.3, 0.45, 5.6], [0, 2.7, -1]],
      [1, [2.1, 0.4, 5.9], [0, 3.6, -1]],
    ]
    const curve = i => new THREE.CatmullRomCurve3(KEYS.map(k => new THREE.Vector3(...k[i])), false, 'centripetal')
    const PATH = curve(1), AIM = curve(2), KP = KEYS.map(k => k[0])
    const uAt = p => {
      let i = 0
      while (i < KP.length - 2 && p > KP[i + 1]) i++
      return (i + Math.min(1, Math.max(0, (p - KP[i]) / (KP[i + 1] - KP[i])))) / (KP.length - 1)
    }

    const at = new THREE.Vector3(), cam = new THREE.Vector3(), look = new THREE.Vector3(), tip = new THREE.Vector3(), rimQ = new THREE.Quaternion()
    const head = new THREE.Vector3(), near = new THREE.Vector3()
    let rimK = 0
    const UP = new THREE.Vector3(0.12, 1, 0.18).normalize()
    // The axe head laid on the turf at his right as his fist meets the ground; carried head-up at his side as
    // he rises, so it stands against the sky rather than in the grass.
    const PLANT = new THREE.Vector3(-0.9, -0.13, -0.3).normalize(), HANG = new THREE.Vector3(-0.3, 0.8, 0.5).normalize()
    const out = { here: at, dream: 0, grade: { bloom: 0.6, threshold: 0.8, vignette: 0.5, grain: 0.35, scan: 0 } }
    const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
    run = (state, t, aspect) => {
      const p = state.p, portrait = !!state.portrait, still = !!state.still
      time.value = t
      // The insert: a push-in on Stormbreaker's head as he stands, lightning crawling over its runes.
      const ins = axe ? ss(0.6, 0.64, p) * (1 - ss(0.69, 0.72, p)) : 0

      // ---- the strike, the pillar and the last bolt
      const leader = ss(LEADER[0], LEADER[1], p)
      const pillar = ss(PILLAR[0], PILLAR[0] + 0.006, p) * (1 - ss(PILLAR[1] - 0.03, PILLAR[1], p))
      const last = ss(LAST, LAST + 0.012, p)
      const slot = Math.floor(t * 18)
      const flick = still ? 0.85 : 0.6 + 0.4 * hash(slot)
      const clock = (p - IMPACT) * SLOW
      const landed = p >= IMPACT
      const burst = landed ? Math.exp(-clock * 2.2) : 0
      // Far flashes in the deck: at times of their own while the storm holds (none under reduced motion).
      const fslot = Math.floor(t * 1.2), fe = t * 1.2 - fslot
      const storm = (1 - ss(0.62, 0.8, p)) + ss(0.86, 0.9, p)
      const far = still ? 0 : (hash(fslot + 0.5) > 0.5 ? Math.exp(-fe * 6) * (0.6 + 0.4 * (Math.floor(fe * 9) % 2)) : 0) * storm
      const bolt = Math.max(pillar, leader * (1 - ss(PILLAR[0], PILLAR[0] + 0.006, p)) * 0.9, last)
      boltU.uVariant.value = bolt > 0.001 ? (still ? 0 : slot % 4) : -9
      boltU.uReach.value = last > 0 ? 1 : pillar > 0 ? 1 : leader
      boltU.uBright.value = bolt * flick * (last > 0 ? 1.4 : 1)
      boltU.uWidth.value = 0.6 + 0.6 * pillar
      pillarU.uOn.value = pillar * (0.7 + 0.3 * flick) + burst * 0.4 + last * 0.6
      pillarU.uHalf.value = 7 + 3 * burst
      // The last bolt comes down onto the axe's head; the others onto the ridge.
      if (last > 0 && axe) {
        axe.head.getWorldPosition(tip)
        bolts.position.copy(tip)
        bolts.scale.set(1, (160 - tip.y) / 160, 1)
      } else {
        bolts.position.set(0, 0, 0)
        bolts.scale.set(1, 1, 1)
      }
      const lightK = pillar * flick + burst * 1.2 + last * flick * 1.4
      flash.value = Math.max(lightK, far)
      flashPos.value.set(0, last > 0 ? 2.6 : 1.5, 0)
      strike.intensity = 320 * (pillar * flick + burst * 0.7 + last * flick * 1.4)
      strike.position.set(0, last > 0 ? 3 : 2.5, 0)
      const L = (lift.value = 1 + 0.41 * ss(0.33, 0.42, p)) // half a stop up once the pillar is gone
      hemi.intensity = (1.9 + 0.9 * far + 0.6 * lightK) * L
      fill.intensity = 2.4 * L
      front.intensity = 24 * L
      top.intensity = (1.4 + 3 * flash.value) * ss(0.3, 0.4, p)
      skyU.uFlash.value = Math.max(far, lightK * 0.6)
      skyU.uBolt.value = Math.max(pillar * flick, last)
      skyU.uSwirl.value = ss(0.05, 0.2, p) * (1 - ss(0.5, 0.85, p)) + ss(0.84, 0.95, p) * 0.6
      // The storm breaks after he rises: the deck opens, the low sun comes through it.
      const breakK = ss(0.64, 0.86, p) * (1 - 0.6 * ss(0.88, 0.96, p))
      skyU.uCover.value = 1 - 0.72 * breakK
      skyU.uRays.value = breakK
      raysU.uRays.value = breakK
      sunK.value = 0.25 + 1.6 * breakK
      sun.intensity = (0.5 + 3.2 * breakK) * L
      rimK = 0.15 + 0.85 * breakK
      grassU.uWind.value = still ? 0.15 : 0.6 + 0.5 * storm

      // ---- the impact: ring, wall, dust, sparks, scorch, arcs
      const ring = landed ? ringAt(clock) : 0
      shock.uRing.value = ring
      shock.uShock.value = landed ? Math.exp(-clock * 0.55) : 0
      shock.uCrater.value = ss(IMPACT - 0.004, IMPACT + 0.006, p)
      wall.scale.set(Math.max(ring, 0.01), 2.6 * shock.uShock.value + 0.01, Math.max(ring, 0.01))
      clockU.value = landed ? clock : -1
      groundU.uScorch.value = shock.uCrater.value
      groundU.uArcs.value = Math.max(ss(PILLAR[0], PILLAR[0] + 0.02, p) * (1 - ss(0.45, 0.62, p)), last * 0.8)
      groundU.uArcR.value = 4 + 5 * ss(IMPACT, 0.4, p)
      groundU.uGlow.value = pillar * flick * 0.4 + burst * 0.3 + last * 0.4
      groundU.uStill.value = still ? 1 : 0

      // ---- him: down out of the pillar, the landing scrubbed by p, then the stance, then the raise
      at.set(0, 0, 0)
      if (you) {
        const drop = ss(0.15, 0.215, p)
        you.root.position.set(0, 55 * (1 - drop) ** 2, 0)
        let ct
        if (p < 0.215) ct = 0
        else if (p < IMPACT) ct = CLIP.touch * ss(0.215, IMPACT, p) ** 0.7
        else if (p < 0.56) ct = THREE.MathUtils.lerp(CLIP.touch, CLIP.rise, (p - IMPACT) / (0.56 - IMPACT))
        else if (p < 0.72) ct = THREE.MathUtils.lerp(CLIP.rise, CLIP.up, ss(0.56, 0.72, p))
        else ct = THREE.MathUtils.lerp(CLIP.up, CLIP.end, Math.min(1, (p - 0.72) / 0.1))
        const ws = ss(0.76, 0.83, p)
        land.time = Math.min(ct, land.getClip().duration - 1e-3)
        stance.time = still ? 0.5 : t % stance.getClip().duration
        land.setEffectiveWeight(1 - ws)
        stance.setEffectiveWeight(ws)
        you.mixer.update(0)
        // The raise: the right arm straight up, the axe to the sky.
        const k = ss(RAISE[0], RAISE[1], p), kp = ss(0.25, 0.3, p) * (1 - ss(0.6, 0.7, p)), kh = ss(0.6, 0.68, p) * (1 - ss(0.76, 0.83, p))
        if (k > 0 || kp > 0 || kh > 0) you.root.updateMatrixWorld(true)
        if (kp > 0) aim(bones.RightHand, axe.end, PLANT, kp)
        if (kh > 0) aim(bones.RightHand, axe.end, HANG, kh)
        if (k > 0) {
          aim(bones.RightArm, bones.RightForeArm, UP, k)
          aim(bones.RightForeArm, bones.RightHand, UP, k)
          aim(bones.RightHand, axe.end, UP, k)
        }
        // Lightning crawls over the blade as he rises with it, and blazes when the last bolt takes it.
        charge.value = 0.15 * pillar + 0.5 * burst + 0.35 * ss(0.56, 0.8, p) + 0.6 * ss(RAISE[0], LAST, p) + 1.4 * last + 0.7 * ins
        // The cape: the storm's wind in it (calm under reduced motion), streaming up behind him as he falls.
        capeU.uCapeT.value = still ? 1.3 : t
        capeU.uWind.value = (still ? 0.4 : 0.7 + 0.5 * storm) + 1.2 * burst
        capeU.uFall.value = ss(0.15, 0.17, p) * (1 - ss(0.205, 0.235, p))
        capeU.uFloor.value = (0.03 - you.root.position.y) / capeU.uScale.value
        at.copy(you.root.position)
      }
      at.y += 0.9

      // ---- the camera: slow and heavy, with a jolt at the impact
      const u = uAt(p)
      PATH.getPoint(u, cam)
      AIM.getPoint(u, look)
      if (portrait) {
        // A phone sees a narrow slice: stand back along the same line, and keep him above the text.
        const y = cam.y
        cam.sub(look).multiplyScalar(1.7 - 0.45 * ss(0.56, 0.66, p) * (1 - ss(0.82, 0.88, p))).add(look) // closer as he stands, as on a desktop
        cam.y = Math.max(cam.y, y) + 0.3
        look.y -= 0.35 * ss(0.25, 0.4, p)
      }
      if (ins > 0) {
        axe.end.getWorldPosition(head)
        near.subVectors(cam, head).setLength(portrait ? 2 : 1.25).add(head) // the head about a third of the frame (a phone's narrow width)
        near.y += 0.08
        cam.lerp(near, ins)
        look.lerp(head, ins)
      }
      if (!still) {
        const jolt = landed ? 0.11 * Math.exp(-clock * 3.5) : 0
        const rumble = 0.025 * pillar
        const a = jolt + rumble
        cam.x += Math.sin(t * 41) * a
        cam.y += Math.sin(t * 53 + 1.3) * a * 0.8
        look.x += Math.sin(t * 37 + 2.1) * a * 0.6
        look.y += Math.sin(t * 47 + 0.4) * a * 0.6
      }
      // Never under the turf.
      cam.y = Math.max(cam.y, ground(cam.x, cam.z) + 0.35)
      camera.aspect = aspect
      camera.updateProjectionMatrix()
      camera.position.copy(cam)
      camera.lookAt(look)
      dome.position.copy(camera.position)
      // The rim on the armour and the axe head: from the low sun behind him (camera space), warming as the storm breaks.
      capeU.uRimDir.value.copy(SUN_DIR).applyQuaternion(rimQ.copy(camera.quaternion).invert())
      capeU.uRimCol.value.setRGB(0.07 + 0.75 * rimK, 0.09 + 0.48 * rimK, 0.15 + 0.3 * rimK)

      out.dream = Math.min(1, lightK * 0.35)
      out.grade.bloom = 0.6 + 0.5 * Math.min(1, lightK)
      out.grade.threshold = 0.8 - 0.15 * Math.min(1, lightK)
      return out
    }
  })()

  return { scene, camera, update: (state, t, aspect) => (run ? run(state, t, aspect) : hold(aspect)), get built() { return !!run } }
}

// Turn a bone so the direction to its child points along `dir` (world), by k (0..1): a one-bone aim.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _qk = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _id = new THREE.Quaternion()
function aim(bone, child, dir, k) {
  bone.getWorldPosition(_a)
  child.getWorldPosition(_b)
  _q.setFromUnitVectors(_b.sub(_a).normalize(), dir)
  _qk.slerpQuaternions(_id, _q, k)
  bone.getWorldQuaternion(_qw).premultiply(_qk)
  bone.parent.getWorldQuaternion(_qp).invert()
  bone.quaternion.copy(_qp.multiply(_qw))
  bone.updateMatrixWorld(true)
}

/*
 * Stormbreaker (public/cinema/landing/axe.glb, scripts/cinema/props.py): its origin at the grip, the haft
 * along +y, the blade toward +x. Laid in a frame like the old maul's (the haft along +z from the grip, so
 * the hand's aims still work), unrolled, so the low front camera sees the crescent blade in profile, not
 * edge-on as a hammer block. Faint lightning crawls over its head as it charges: lines of noise in the
 * metal's own space, lit by `charge` (a uniform, 0 off).
 */
const AXE_ROLL = 0
// A rim from behind (uRimDir: toward the sun, camera space): glancing edges facing it catch uRimCol.
const RIM = k => /* glsl */ `totalEmissiveRadiance += uRimCol * (${k}) * pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 2.5) * clamp(dot(normal, uRimDir) * .8 + .35, 0., 1.);`
function makeAxe(src, charge, time, env, rim) {
  const group = new THREE.Group(), spin = new THREE.Group()
  spin.rotation.z = AXE_ROLL
  src.rotation.set(Math.PI / 2, 0, 0)
  src.position.set(0, 0, 0)
  spin.add(src)
  group.add(spin)
  src.traverse(o => {
    if (!o.isMesh) return
    o.castShadow = true
    const m = o.material
    if (m.map) m.map.colorSpace = THREE.NoColorSpace
    m.envMap = env
    m.envMapIntensity = 1
    if (!/metal/.test(m.name) && o.name !== 'stormbreaker_1') return
    m.onBeforeCompile = sh => {
      sh.uniforms.uCharge = charge
      sh.uniforms.uTime = time
      sh.uniforms.uRimDir = rim.uRimDir
      sh.uniforms.uRimCol = rim.uRimCol
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAxe;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAxe = position;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform float uCharge, uTime; uniform vec3 uRimDir, uRimCol; varying vec3 vAxe;\n${NOISE}`)
        .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
          ${RIM('1.')}
          if (uCharge > .01) {
            float tt = floor(uTime * 14.) * .37;
            vec2 q = vAxe.xy * 16. + vec2(tt, -tt * .6);
            float line = 1. - smoothstep(0., .035, abs(fbm3(q) - .5));
            line *= smoothstep(.35, .6, vnoise(vAxe.xy * 9. - tt * 1.7));
            float head = smoothstep(.5, .62, vAxe.y);
            totalEmissiveRadiance += vec3(.55, .74, 1.) * line * head * uCharge * 2.6 + vec3(.3, .42, .7) * head * uCharge * .04;
          }`)
    }
    m.customProgramCacheKey = () => 'landing-axe'
  })
  const head = new THREE.Object3D()
  head.position.set(0, 0, 0.87) // the forged cap on the haft's end: where the last bolt lands
  const end = new THREE.Object3D()
  end.position.set(0, 0, 0.7) // the head's centre on the haft: aimed by the wrist
  group.add(head, end)
  return { group, head, end }
}

/*
 * The armour (public/cinema/suits/thor.glb via wearSuit): its paint read as painted, both faces drawn
 * (the cape is one sheet). The cape is skinned to his torso alone, so it gets its motion here, in his
 * root's space after skinning: a ripple travelling down it in the storm's wind, streaming up behind him
 * as he falls, and its hem held above the turf when he kneels. Which vertices are cape: those the rig
 * gave the fixed Spine mix (Spine near 0.55), behind him, more the further below the shoulders.
 */
function armour(m, U, spine, legs, env) {
  if (m.map) m.map.colorSpace = THREE.NoColorSpace
  m.side = THREE.DoubleSide
  m.envMap = env
  m.envMapIntensity = 0.9
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, { uLegB: { value: legs } })
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uCapeT, uWind, uFall, uFloor, uScale; uniform float uLegB[${legs.length}]; varying float vLeg;`)
      .replace('#include <skinning_vertex>', /* glsl */ `#include <skinning_vertex>
        vLeg = dot(skinWeight, vec4(uLegB[int(skinIndex.x + .5)], uLegB[int(skinIndex.y + .5)], uLegB[int(skinIndex.z + .5)], uLegB[int(skinIndex.w + .5)]));
        float wS = dot(skinWeight, vec4(lessThan(abs(skinIndex - ${spine}.), vec4(.5))));
        float hang = clamp((1.3 - position.y) / 1.2, 0., 1.);
        float cape = smoothstep(.4, .5, wS) * smoothstep(-.02, -.1, position.z) * hang * hang;
        if (cape > 0.) {
          float ph = uCapeT * 2.4 - position.y * 5.5 + position.x * 3.;
          vec3 d = vec3(.05 * sin(ph * .7 + 1.3), 0., -.07 - .05 * sin(ph)) * uWind;
          d += vec3(0., .9 * hang, -.3) * uFall;
          transformed += d * cape / uScale;
          transformed.y = max(transformed.y, uFloor);
        }
        // and the cloth below the belt in front (the rig gave some of it the cape's Spine mix): only the cape behind stays red
        vLeg = max(vLeg, smoothstep(.9, .84, position.y) * (1. - smoothstep(.4, .5, wS) * smoothstep(.02, -.06, position.z)));`)
    // The paint: the cape stays crimson; the plate (Meshy's slate blue, which the storm light pushed to royal
    // blue) goes to near-black gunmetal, a little metallic; the trousers (red in the paint) to dark leather.
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimDir, uRimCol; varying float vLeg;')
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
        float legK = smoothstep(.3, .7, vLeg);
        float plateK = (1. - smoothstep(.06, .18, diffuseColor.r - max(diffuseColor.g, diffuseColor.b))) * (1. - legK);
        float lum = dot(diffuseColor.rgb, vec3(.3, .59, .11));
        // the cape: crimson, including the paint's stray skin-coloured patches in it
        float cr = min(diffuseColor.r, .42);
        diffuseColor.rgb = mix(vec3(cr, min(diffuseColor.g, cr * .12), min(diffuseColor.b, cr * .16)), vec3(lum) * vec3(1.03, 1., .95), plateK);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.06, .058, .056) * (.6 + lum), legK); // the paint's stray skin patches too
        if (!gl_FrontFacing) diffuseColor.rgb *= .3; // the cape's lining (and any inside face) in its own shade, not glaring in the low sun`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, .55, plateK);
        roughnessFactor = mix(roughnessFactor, .45, plateK);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${RIM('1. - .7 * legK')}`)
  }
  m.customProgramCacheKey = () => 'landing-armour'
}

/* His own body under the armour: only his head and neck are drawn (each vertex follows its strongest
 * bone, as dive.js's undersuit does), so no shirt or shoe shows through it. */
function headOnly(m, keep) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uKeep = { value: keep }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying float vGone; uniform float uKeep[${keep.length}];`)
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        float bi = skinIndex.x, bw = skinWeight.x;
        if (skinWeight.y > bw) { bw = skinWeight.y; bi = skinIndex.y; }
        if (skinWeight.z > bw) { bw = skinWeight.z; bi = skinIndex.z; }
        if (skinWeight.w > bw) bi = skinIndex.w;
        vGone = 1. - uKeep[int(bi + .5)];`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGone;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vGone > .5) discard;')
  }
  m.customProgramCacheKey = () => 'landing-head'
}
