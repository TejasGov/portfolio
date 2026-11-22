import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loadTraveller, wearSuit, sky } from './films/kit'

/*
 * Chapter Five, world 4: the chase (The Dark Knight, a fan's tribute). A night street of stone and glass
 * under elevated train tracks, wet asphalt carrying every light, sodium lamps in haze, burning wrecks and
 * drifting smoke. He rides the armoured bike (chase/bike.glb) in the armoured suit and cowl
 * (suits/bat.glb): toward a low camera, the twin guns flashing, through a shopping arcade in a burst of
 * glass, up a wall and back down in a 180, and past a big articulated truck that flips end over end
 * behind him in slow motion and lands in a fireball (which the FLASH burns out from). No logos, signs or
 * lettering anywhere.
 *
 * CONTRACT (world.js, timeline.js and movies.js rely on it; do not change the export or its signature)
 *   export function createChase(renderer, { loader, normalize, mobile }) -> { scene, camera, update, built }
 *     loader: the shared GLTFLoader (Meshopt + Draco). normalize(root, size, yaw): a model's meshes as
 *     one centred group scaled to `size` metres. mobile: phone-sized screen, build lighter.
 *   update(state, t, aspect) is called once per rendered frame while this world is drawn.
 *     state.p         0..1, this world's own progress (movies.js: Five's P 0.5669..0.6923, 300 svh of
 *                     scroll), driven by scroll: it scrubs both ways and can jump, so derive everything
 *                     from p and t and keep no one-way state. The BATS cover (a swarm over a moonlit
 *                     night) leaves over p 0..0.092; p 0.092..0.908 is seen clear; the FLASH whiteout
 *                     burns in over p 0.908..1 from the frame's highlights, so a muzzle flash or the
 *                     truck's explosion there is what it burns out from.
 *     state.onScreen  never true for this world.
 *     state.still     reduced motion: no camera flourishes or shake; the ride still follows p.
 *     state.portrait  the frame is a phone's (aspect < 0.85): frame for it. Decide framing from this.
 *     state.mobile    same as the option. state.cover: 0..1, how much a transition hides the frame
 *                     (kind 'bats' | 'flash' | null, phase 0..1): skip work the cover hides.
 *     t               seconds, monotonic. aspect: width / height of what is being drawn; set
 *                     camera.aspect from it.
 *     Returns { here, dream, grade? }: here = a Vector3 at the traveller (world space; the same object
 *     every frame is fine); dream = 0..1 extra bloom for a held beat (0 otherwise); grade = optional
 *     overrides of GRADE.chase in movies.js ({ bloom, threshold, vignette, grain, scan }).
 *   Units: metres, y up, the street at y = 0 running along z, the traveller 1.72 m tall. Camera: a
 *   PerspectiveCamera with a 40 degree vertical fov.
 *   Colour: the frame has no sRGB encode after tone mapping, so a hex colour reads darker and richer
 *   than on a page, and a painted canvas texture reads as painted with colorSpace NoColorSpace.
 *   Build in steps: build the set a piece at a time, yielding (await a timeout) whenever a step has run
 *   ~4 ms, and report `built` false until it is whole; until then update() only places the camera
 *   (world.js holds the BATS cover over it and compiles it once it is whole).
 *   Budget: the whole frame is about 5.6 ms on the desktop GPU today; keep this scene within that:
 *   at most ~150 draw calls and ~400k triangles in view (instance repeats), one shadow-casting light
 *   (2048 map, 1024 on mobile), textures at most 2048 px (a suit's base colour; 1024 for other maps), new
 *   GLBs under ~6 MB in all, no allocation or geometry rebuilds in update().
 *   world.prepare() builds this while the reader is paused in the landing, then compiles it and draws it
 *   once at p = 0: anything hidden then (visible = false) is skipped and would compile mid-scroll, so
 *   keep things that appear later in the scene, scaled to nothing, and add late-loading models to
 *   `scene` (prepare compiles again when the scene grows).
 *   GPU memory: Stage.jsx may release this world while the reader is two worlds away (world.release:
 *   its geometries, textures, materials and shadow maps are disposed, the objects kept) and prepare it
 *   again on approach: keep every GPU resource reachable from `scene` (no render targets of its own
 *   unless they are rebuilt on use), and never dispose anything yourself.
 *
 * THE SET (world space): the street runs along z, kerbs at x = +-10, facades at x = +-14. The elevated
 * tracks run over its middle from far back to z = 146, then turn off along the cross street at z = 158
 * toward -x. Beyond, the street is an open canyon of taller stone. The shopping arcade is the ground floor
 * of the +x block at z 176..240 (glass front at x = 14, shops at x = 22); the wall he rides up is the -x
 * facade at z = 266. Cross streets at z 40..56, 148..168 and 300..318.
 */
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const clamp01 = x => Math.min(1, Math.max(0, x))
const PI = Math.PI
let seed = 23
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

const FACE = 14, KERB = 10
const GAPS = [[40, 56], [148, 168], [300, 318]] // cross streets
const ARC = { z0: 176, z1: 240, x0: 14, x1: 22, h: 6.5 }
const EL = { end: 146, r: 12, z: 158 } // the tracks' straight run ends at z = end, turns (radius r) onto the cross street at z
const BREAK = [0.457, 0.545] // the arcade's glass: in and out
const WALL = [0.628, 0.70] // on the wall
const FLIP = [0.785, 0.875] // the truck: over, and down
const GUNS = [0.3, 0.425]

/** A smooth curve through keys [p, ...values] (cubic Hermite, Catmull-Rom slopes, flat at turns). */
function keyed(keys) {
  const n = keys[0].length - 1, last = keys.length - 1
  const slope = (i, j) => {
    const a = keys[Math.max(0, i - 1)], c = keys[Math.min(last, i + 1)]
    return (c[j] - a[j]) / (c[0] - a[0])
  }
  return (p, out) => {
    const i = p <= keys[0][0] ? -1 : p >= keys[last][0] ? last : keys.findLastIndex(k => k[0] <= p)
    if (i < 0 || i === last) {
      for (let j = 0; j < n; j++) out[j] = keys[Math.max(0, i)][j + 1]
      return out
    }
    const k1 = keys[i], k2 = keys[i + 1], h = k2[0] - k1[0], s = (p - k1[0]) / h
    const s2 = s * s, s3 = s2 * s
    for (let j = 1; j <= n; j++) {
      const d = (k2[j] - k1[j]) / h
      let m1 = slope(i, j), m2 = slope(i + 1, j)
      if (d === 0 || m1 * d < 0) m1 = 0
      if (d === 0 || m2 * d < 0) m2 = 0
      out[j - 1] = (2 * s3 - 3 * s2 + 1) * k1[j] + (s3 - 2 * s2 + s) * h * m1 + (-2 * s3 + 3 * s2) * k2[j] + (s3 - s2) * h * m2
    }
    return out
  }
}

// ---------------------------------------------------------------- the ride, in the chase's own p
// The bike's ground point (between the wheels, on the tyres' plane): x, y, z. Its heading follows its
// own track on the road; on the wall it is keyed (WALLQ). Down the street toward the camera, the guns,
// a left swerve through the arcade's glass and out again, across to the -x facade, up it and back down
// facing the other way, after the truck, past it close on the right (so a phone can hold both in one
// frame), and on in slow motion as it flips.
const BIKE = keyed([
  [0, 1.5, 0, -14], [0.1, 0.8, 0, 26], [0.2, -1.2, 0, 66], [0.3, 0.6, 0, 106], [0.37, 1.2, 0, 132],
  [0.42, 2.6, 0, 156], [0.445, 8.2, 0, 175], [0.457, 14, 0, 183], [0.475, 17.2, 0, 193], [0.5, 17.6, 0, 204],
  [0.528, 17.2, 0, 217], [0.545, 14, 0, 229], [0.56, 9.6, 0, 236], [0.58, 4.5, 0, 246], [0.6, 0.5, 0, 256],
  [0.615, -6, 0, 262.5], [0.628, -12.6, 0, 266], [0.66, -12.7, 0, 266], [0.7, -10.2, 0, 266],
  [0.72, -5, 0, 262.5], [0.74, -1, 0, 241], [0.755, 2.6, 0, 222], [0.775, 3, 0, 196], [0.79, 3.6, 0, 185],
  [0.83, 3.1, 0, 177], [0.875, 3.0, 0, 169], [0.91, 3.1, 0, 164], [1, 3.2, 0, 153],
])
// At the wall: yaw and pitch (nose up is negative), and a spin about the bike's own up (unused). The front
// tyre climbs the wall while the rear stays on the road, then the bike pivots 180 on its rear tyre, the
// front swinging round past the camera, and drops back down heading out.
const WALLQ = keyed([
  [0.618, -1.2, 0, 0], [0.628, -PI / 2, -0.12, 0], [0.64, -PI / 2, -1.0, 0], [0.648, -PI / 2, -1.08, 0],
  [0.668, -PI, -0.95, 0], [0.688, -1.5 * PI, -0.55, 0], [0.698, -1.5 * PI, -0.12, 0], [0.706, -1.5 * PI, 0, 0],
])
// The rear axle there (x, z; at the axle's height): it rolls up to the wall as the front climbs, holds
// for the pivot, and rolls away.
const PIV = keyed([[0.618, -6.6, 263.2], [0.628, -11.7, 266], [0.645, -12.7, 266], [0.688, -12.7, 266], [0.708, -11.2, 266]])
const REAR = new THREE.Vector3(0, 0.345, -0.954) // the rear axle in the bike's frame (bike.glb's wheel_back)
// The truck's front bumper on the road (x = -3.5, heading -z); it passes him, he turns after it.
const TRUCK = keyed([[0.54, 330], [0.56, 288], [0.58, 264], [0.6, 246], [0.62, 232], [0.66, 216], [0.72, 204], [0.75, 197.5], [0.785, 190], [0.83, 187], [0.875, 184], [1, 182.5]])
const TRUCK_X = -3.5, TRUCK_L = 18, TRUCK_H = 4.1

// ---------------------------------------------------------------- his pose on the bike
// Each bone's direction (from its head toward its child) in his own frame (facing +z, his left +x): low
// and long over the tank, arms down to the side grips by the front wheel, knees in, feet back on the pegs.
const RIDE = {
  Spine02: [0, 0.5, 0.86], Spine01: [0, 0.36, 0.93], Spine: [0, 0.3, 0.95], neck: [0, 0.5, 0.86], Head: [0, 0.82, 0.57],
  LeftShoulder: [0.92, 0.05, 0.38], LeftArm: [0.38, -0.55, 0.74], LeftForeArm: [0.12, -0.6, 0.79], LeftHand: [0.05, -0.55, 0.83],
  LeftUpLeg: [0.22, -0.82, 0.52], LeftLeg: [0.06, -0.35, -0.93], LeftFoot: [0.05, -0.75, -0.66], LeftToeBase: [0, -0.4, -0.9],
}
for (const k of Object.keys(RIDE)) if (k.startsWith('Left')) { const [x, y, z] = RIDE[k]; RIDE['Right' + k.slice(4)] = [-x, y, z] }
const SEAT = new THREE.Vector3(0, 0.98, -0.28) // where his hips sit, in the bike's own frame

/** The pose as bone-local quaternions: each named bone turned so it points along its direction. */
function aimPose(bones, rest, aims) {
  const I = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), world = new Map(), turn = new Map(), posed = new Map()
  return bones.map(b => {
    const w = (world.get(b.parent) ?? I).clone().multiply(rest.get(b))
    const a = aims[b.name]
    const d = a ? new THREE.Quaternion().setFromUnitVectors(Y.clone().applyQuaternion(w), new THREE.Vector3(...a).normalize()) : turn.get(b.parent) ?? I
    const e = d.clone().multiply(w)
    world.set(b, w)
    turn.set(b, d)
    posed.set(b, e)
    return (posed.get(b.parent) ?? I).clone().invert().multiply(e)
  })
}

// ---------------------------------------------------------------- shared shader bits
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
// The fog's uniforms (cloned) with ours by reference, so update() reaches them through our own handles.
const fogged = extra => Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), extra)
const NOISE = /* glsl */ `
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + 1.0), f.x), f.y); }
  float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.03 + 3.1) * 0.3 + vnoise(p * 4.1 + 7.7) * 0.2; }`
// The street's fog fades additive things to nothing (adding none of the haze's own colour).
const FADE = /* glsl */ `
  #ifdef USE_FOG
    gl_FragColor.rgb *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #endif`

/**
 * A cool backlit rim on his suit and the bike: a view-angle term, so the cowl, cape, armour and tyres
 * stand out of the dark in every shot without a light that would also flare on the wet road.
 */
function rimLit(m, rim) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uRim = rim // its colour: cool night, or the fire's warm rim on the wall and the flip (update())
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);')
  }
  m.customProgramCacheKey = () => 'chase-rim'
}

/** Box instances' local metres, for patterns drawn in each box's own frame whatever its scale. */
const LOCAL_V = /* glsl */ `
  vec3 iSc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vL = position * iSc; vNl = normal; vSz = iSc;
  vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);`

/**
 * Stone and glass facades on instanced boxes (unit box, base at y = 0): each building (a hash of its
 * place) is pale limestone, brown brick, dark granite or a glass curtain wall; piers and punched windows
 * floor by floor, some rooms lit; at street level a lit lobby behind tall glass, or a shuttered front.
 * instanceColor.g = 0 drops the street floor (the arcade's upper block). Lit by the scene's lights.
 */
function facadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0 })
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vL; varying vec3 vNl; varying vec3 vSz; varying float vSeed;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LOCAL_V)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vL; varying vec3 vNl; varying vec3 vSz; varying float vSeed; float fGlass; vec3 fLit;\n' + NOISE)
      .replace('#include <map_fragment>', /* glsl */ `
        fGlass = 0.0; fLit = vec3(0.0);
        float style = floor(vSeed * 4.0);
        vec3 stone = style < 1.0 ? vec3(0.5, 0.44, 0.36) : style < 2.0 ? vec3(0.24, 0.15, 0.11) : style < 3.0 ? vec3(0.09, 0.085, 0.08) : vec3(0.16, 0.17, 0.17);
        float y = vL.y;
        bool side = abs(vNl.y) < 0.5;
        float u = abs(vNl.x) > 0.5 ? vL.z : vL.x;
        vec3 col = stone;
        float lobbyOn = vColor.g;
        if (side) {
          // Soot and rain: darker toward the street and in streaks down from every sill.
          float grime = fbm(vec2(u * 0.35, y * 0.08) + vSeed * 40.0);
          col *= 0.7 + 0.45 * grime;
          col *= mix(0.55, 1.0, smoothstep(0.0, 14.0, y));
          if (y < 5.4 && lobbyOn > 0.5) {
            // The street floor: a granite plinth, tall lobby glass between dark mullions under a transom.
            float bay = fract(u / 1.6), bid = floor(u / 1.6);
            float glass = step(0.07, bay) * step(bay, 0.93) * step(0.45, y) * step(y, 4.3) * (1.0 - step(4.05, y) * step(y, 4.2));
            float shut = step(0.72, h21(vec2(floor(u / 9.6), vSeed * 31.0))); // a few fronts shuttered for the night
            col = mix(vec3(0.05, 0.048, 0.045), col * 0.7, step(4.4, y));
            float rib = 0.6 + 0.4 * step(0.5, fract(y * 9.0));
            vec3 inside = mix(vec3(1.0, 0.62, 0.3), vec3(0.8, 0.88, 1.0), step(0.75, h21(vec2(floor(u / 9.6), 3.0 + vSeed)))) * (0.35 + 0.65 * smoothstep(0.4, 4.0, y)) * (0.55 + 0.45 * h21(vec2(bid, vSeed)));
            fLit = glass * (1.0 - shut) * inside * 1.6;
            fGlass = glass;
            col = mix(col, mix(vec3(0.01), vec3(0.05, 0.05, 0.055) * rib, shut), glass);
          } else if (y < 6.3 && lobbyOn < 0.5) {
            // A rusticated stone base: deep courses, staggered joints.
            float cr = (y - 0.0) / 0.62, ci = floor(cr);
            float jx = fract(u / 1.5 + 0.5 * mod(ci, 2.0));
            float groove = max(1.0 - smoothstep(0.0, 0.06, fract(cr)), 1.0 - smoothstep(0.0, 0.025, min(jx, 1.0 - jx)));
            col = vec3(0.2, 0.18, 0.15) * (0.7 + 0.35 * h21(vec2(ci, floor(u / 1.5 + 0.5 * mod(ci, 2.0))))) * (0.7 + 0.45 * fbm(vec2(u, y) * 1.3));
            col *= 1.0 - 0.7 * groove;
          } else if (y >= 5.4 && y < 6.3) {
            col *= 0.8; // the fascia over the shops
          } else {
            // Upper floors: floor-high cells; piers and sills in the stone, glass between.
            float fh = style > 2.0 ? 3.7 : 3.6, bw = style < 1.0 ? 1.8 : style < 2.0 ? 1.5 : style < 3.0 ? 2.1 : 1.6;
            vec2 w = vec2(u, y - 6.3) / vec2(bw, fh), f = fract(w), id = floor(w);
            float win = style > 2.0 ? step(0.04, f.x) * step(f.x, 0.96) * step(0.12, f.y) : step(0.22, f.x) * step(f.x, 0.78) * step(0.2, f.y) * step(f.y, 0.85);
            // Frames: a mullion down the middle and a transom, in a dark frame colour.
            float frame = win * max(step(abs(f.x - 0.5), 0.018), step(abs(f.y - 0.66), 0.018));
            win *= 1.0 - frame;
            float aa = clamp(2.0 - 3.0 * max(fwidth(w.x), fwidth(w.y)), 0.0, 1.0);
            win = mix(0.4, win, aa);
            float lit = step(0.8, h21(id + vSeed * 91.0)) * step(y, vSz.y - 1.0);
            vec3 warm = mix(vec3(1.0, 0.6, 0.3), vec3(0.75, 0.85, 1.0), step(0.7, h21(id.yx + vSeed)));
            float blind = step(0.55, h21(id + 4.2)) * step(1.0 - 0.5 * h21(id + 8.1), f.y);
            fLit = win * lit * warm * (0.18 + 0.45 * h21(id * 1.7)) * (0.45 + 0.55 * f.y) * (1.0 - 0.6 * blind);
            fGlass = win * (1.0 - lit);
            col = mix(col, vec3(0.03, 0.026, 0.024) * (0.6 + 0.8 * f.y) + vec3(0.04, 0.025, 0.015) * blind, win);
            col = mix(col, vec3(0.02), frame);
            col *= 1.0 - 0.35 * (1.0 - step(0.06, f.y)) * (1.0 - win); // a shadow line under each sill
          }
          // A cornice at the top.
          col *= 1.0 - 0.4 * step(vSz.y - 1.2, y) * step(y, vSz.y - 0.9);
          fLit += col * vec3(1.0, 0.55, 0.24) * 0.5 * exp(-y / 8.0) * (1.0 - fGlass);
        } else col = vec3(0.03);
        diffuseColor.rgb = col;`)
      .replace('#include <color_fragment>', '')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, fGlass);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.6, fGlass);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fLit;')
  }
  m.customProgramCacheKey = () => 'chase-facade'
  return m
}

/**
 * The elevated structure's riveted steel on instanced boxes: rows of rivet heads along each face's long
 * edges and down stiffener plates every 1.6 m, grime and rust in the dark green paint. LATTICE: the
 * outer girders are open lattice trusses (diamonds cut out between the chords).
 */
function steelMaterial(lattice = false) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0.55, side: lattice ? THREE.DoubleSide : THREE.FrontSide })
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vL; varying vec3 vNl; varying vec3 vSz; varying float vSeed;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LOCAL_V)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vL; varying vec3 vNl; varying vec3 vSz; varying float vSeed; float sRiv;\n' + NOISE)
      .replace('#include <map_fragment>', /* glsl */ `
        // Along the member's longest axis (u) and across it (v), on whichever face this is.
        vec3 an = abs(vNl);
        vec2 fa = an.x > 0.5 ? vL.zy : an.y > 0.5 ? vL.xz : vL.xy;
        vec2 fs = an.x > 0.5 ? vSz.zy : an.y > 0.5 ? vSz.xz : vSz.xy;
        bool swap = fs.y > fs.x;
        float u = swap ? fa.y : fa.x, v = swap ? fa.x : fa.y, len = max(fs.x, fs.y), wid = min(fs.x, fs.y);
        float ev = wid * 0.5 - abs(v);
        float row = step(length(vec2(fract(u / 0.13) - 0.5, (ev - 0.07) / 0.13)), 0.28);
        float stiff = step(abs(fract(u / 1.6) - 0.5) * 1.6, 0.09);
        float col2 = stiff * step(length(vec2((abs(fract(u / 1.6) - 0.5) * 1.6 - 0.05) / 0.13, fract(v / 0.13) - 0.5)), 0.32);
        sRiv = max(row, col2);
        #ifdef LATTICE
          if (an.y < 0.5 && ev > 0.22) {
            float d = fract((u + v) / 1.3), e = fract((u - v) / 1.3);
            if (min(min(d, 1.0 - d), min(e, 1.0 - e)) > 0.09) discard;
          }
        #endif
        float rust = smoothstep(0.55, 0.8, fbm(vec2(u * 0.6, v * 2.0) + vSeed * 17.0));
        vec3 col = mix(vec3(0.07, 0.085, 0.075), vec3(0.16, 0.075, 0.035), rust * 0.7);
        col *= 0.75 + 0.35 * vnoise(vec2(u * 3.0, v * 9.0));
        col *= 1.0 - 0.35 * stiff;
        col = mix(col, vec3(0.2, 0.21, 0.19), sRiv);
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, sRiv);')
  }
  if (lattice) m.defines = { LATTICE: '' }
  m.customProgramCacheKey = () => 'chase-steel' + (lattice ? '-l' : '')
  return m
}

/**
 * Wet asphalt: puddles (near mirror) in a rougher wet road, tar seams and patches, lane lines worn into
 * it, iron covers, a crossing at each cross street. Sidewalks are concrete slabs (SIDEWALK).
 */
function roadMaterial(env) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.1, envMapIntensity: env })
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; float wet;\n' + NOISE)
      .replace('#include <map_fragment>', /* glsl */ `
        vec2 q = vW.xz;
        float n = fbm(q * 0.11), n2 = vnoise(q * 1.7);
        wet = smoothstep(0.5, 0.62, n + 0.06 * n2);
        vec3 col = vec3(0.028, 0.027, 0.026) * (0.75 + 0.5 * n2);
        float patch1 = step(0.68, fbm(q * 0.05 + 9.0));
        col *= 1.0 - 0.3 * patch1;
        float seam = 1.0 - smoothstep(0.0, 0.03, abs(fbm(q * vec2(0.09, 0.02)) - 0.5));
        col *= 1.0 - 0.5 * seam;
        #ifdef SIDEWALK
          vec2 sl = fract(q / 1.5);
          col = vec3(0.13, 0.12, 0.11) * (0.7 + 0.4 * n2) * (1.0 - 0.6 * (1.0 - step(0.015, sl.x) * step(0.015, sl.y)));
          wet *= 0.6;
        #else
          float ax = abs(vW.x);
          bool cross = (vW.z > 40.0 && vW.z < 56.0) || (vW.z > 148.0 && vW.z < 168.0) || (vW.z > 300.0 && vW.z < 318.0);
          float paint = 0.0;
          if (!cross && ax < 10.0) {
            paint = step(abs(ax - 3.4), 0.06) * step(fract(vW.z / 9.0), 0.36); // dashed lane lines
            paint += step(abs(ax - 9.5), 0.07);
          }
          if (ax < 10.0 && ((vW.z > 36.0 && vW.z < 40.0) || (vW.z > 56.0 && vW.z < 60.0) || (vW.z > 144.0 && vW.z < 148.0) || (vW.z > 168.0 && vW.z < 172.0) || (vW.z > 296.0 && vW.z < 300.0) || (vW.z > 318.0 && vW.z < 322.0)))
            paint = step(0.5, fract(vW.x / 1.2));
          paint *= 0.55 + 0.45 * smoothstep(0.3, 0.7, vnoise(q * 2.3)); // worn
          col = mix(col, vec3(0.15, 0.145, 0.135), paint);
          // Iron covers.
          vec2 mc = vec2(mod(vW.x + 1.7, 7.0) - 3.5, mod(vW.z + 11.0, 23.0) - 11.5);
          float cover = 1.0 - step(0.42, length(mc));
          col = mix(col, vec3(0.03, 0.028, 0.026) * (0.8 + 0.4 * step(0.5, fract((mc.x + mc.y) * 6.0))), cover * step(ax, 9.0));
        #endif
        col *= mix(1.0, 0.55, wet); // wet asphalt is darker
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.52, 0.04, wet);')
  }
  m.customProgramCacheKey = () => 'chase-road'
  return m
}

/** Lights as glowing points sized in metres, with a faint anamorphic streak (dive.js's). */
function lightPoints(list, scale) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(list.flatMap(l => l.p), 3))
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(list.flatMap(l => l.c), 3))
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(list.map(l => l.s), 1))
  const m = new THREE.ShaderMaterial({
    uniforms: fogged({ uScale: scale }),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec3 aCol; attribute float aSize; uniform float uScale; varying vec3 vCol;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float px = aSize * uScale / max(1.0, -mvPosition.z);
        vCol = aCol * min(1.0, px * px / 4.0);
        gl_PointSize = max(px, 2.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      varying vec3 vCol;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q) * 2.0;
        float glow = exp(-r * r * 7.0) + exp(-abs(q.y) * 70.0) * max(0.0, 1.0 - abs(q.x) * 2.0) * 0.4;
        gl_FragColor = vec4(vCol * glow, 1.0);
        ${FADE}
      }`,
    fog: true,
    ...ADD,
  })
  const pts = new THREE.Points(g, m)
  pts.frustumCulled = false
  return pts
}

/**
 * The wet road's reflections of every light: for each light a streak lying on the road, centred where the
 * mirror image meets the road as seen from the camera (between the camera and the light's foot) and
 * stretched toward and away from the camera, so in perspective it stands as a long vertical shimmer
 * under the light. Broken where the road is drier. The last DYN lights are moving ones (headlight,
 * muzzle flashes, fireball, truck lamps) whose attributes update() rewrites.
 */
function reflections(list, dyn) {
  const base = new THREE.PlaneGeometry(1, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  g.setAttribute('position', base.attributes.position)
  const n = list.length + dyn
  const L = new Float32Array(n * 4), C = new Float32Array(n * 3)
  list.forEach((l, i) => {
    L.set([...l.p, l.w ?? 0.5], i * 4)
    C.set(l.c, i * 3)
  })
  const aL = new THREE.InstancedBufferAttribute(L, 4), aC = new THREE.InstancedBufferAttribute(C, 3)
  g.setAttribute('aL', aL)
  g.setAttribute('aC', aC)
  g.instanceCount = n
  const m = new THREE.ShaderMaterial({
    uniforms: fogged({}),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aL; attribute vec3 aC;
      varying vec2 vUv; varying vec3 vC; varying vec2 vW;
      void main() {
        vec2 c = cameraPosition.xz, l = aL.xz - c;
        float D = max(length(l), 0.01);
        vec2 d = l / D, side = vec2(-d.y, d.x);
        float hc = max(cameraPosition.y, 0.05), hl = max(aL.y, 0.05);
        float r = D * hc / (hc + hl);
        float len = (1.2 + hl * 0.9) * (0.6 + 0.4 * min(1.0, r / 12.0)) + r * 0.12;
        vec2 xz = c + d * (r + position.y * len) + side * position.x * aL.w;
        vUv = position.xy * 2.0;
        vC = aC * step(0.3, r);
        vW = xz;
        vec4 mvPosition = viewMatrix * vec4(xz.x, 0.02, xz.y, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      varying vec2 vUv; varying vec3 vC; varying vec2 vW;
      ${NOISE}
      void main() {
        float wet = smoothstep(0.42, 0.62, fbm(vW * 0.11));
        float ripple = 0.65 + 0.35 * vnoise(vW * vec2(6.0, 1.5));
        float a = exp(-vUv.y * vUv.y * 2.6) * exp(-vUv.x * vUv.x * 9.0) * (0.25 + 0.75 * wet) * ripple;
        gl_FragColor = vec4(vC * a, 1.0);
        ${FADE}
      }`,
    fog: true,
    ...ADD,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.frustumCulled = false
  mesh.renderOrder = 1
  return { mesh, aL, aC, first: list.length }
}

/** Sodium haze under a lamp: a soft cone of light, brightest down its middle. */
function coneMaterial(color, k) {
  return new THREE.ShaderMaterial({
    uniforms: fogged({ uC: { value: new THREE.Color(...color).multiplyScalar(k) } }),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying float vY; varying vec3 vN; varying vec3 vV; varying float vD;
      void main() {
        vY = position.y;
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = m * instanceMatrix;
        #endif
        vec4 w = m * vec4(position, 1.0);
        vec4 mvPosition = viewMatrix * w;
        vN = normalize(mat3(viewMatrix) * mat3(m) * normal);
        vV = normalize(-mvPosition.xyz);
        vD = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uC; varying float vY; varying vec3 vN; varying vec3 vV; varying float vD;
      void main() {
        float core = pow(min(1.0, abs(dot(normalize(vN), normalize(vV)))), 2.0);
        // Faded out close to the lens, so a beam pointed at the camera never fills the frame.
        float a = core * (0.25 + 0.75 * smoothstep(-0.5, 0.5, vY)) * smoothstep(-0.5, -0.38, vY) * smoothstep(2.0, 7.0, vD);
        gl_FragColor = vec4(uC * a, 1.0);
        ${FADE}
      }`,
    fog: true,
    side: THREE.DoubleSide,
    ...ADD,
  })
}

/**
 * Fire: tall camera-facing flame sheets, licking noise rising through them, white-yellow at the root to
 * deep red at the tips. Each flame belongs to a group whose (intensity, scale) a uniform sets: the
 * wrecks burn always, the fireball grows on its own clock in p.
 */
function flames(list, groups, U) {
  const base = new THREE.PlaneGeometry(1, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  g.setAttribute('position', base.attributes.position)
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(f => [f.x, f.y, f.z, f.g])), 4))
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(f => [f.w, f.h, f.s, f.o ?? 0])), 4))
  g.instanceCount = list.length
  const m = new THREE.ShaderMaterial({
    uniforms: fogged({ uT: U.uT, uG: { value: groups } }),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aA; attribute vec4 aB;
      uniform vec2 uG[${groups.length}];
      varying vec2 vUv; varying float vS; varying float vI;
      void main() {
        vec2 gr = uG[int(aA.w + 0.5)];
        vec3 base = aA.xyz;
        vec3 toCam = cameraPosition - base;
        vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + 1e-5);
        vec3 up = vec3(0.0, 1.0, 0.0);
        float s = gr.y;
        vec3 p = base + right * position.x * aB.x * s + up * (position.y + 0.5 - aB.w) * aB.y * s;
        vUv = vec2(position.x, position.y + 0.5);
        vS = aB.z; vI = gr.x;
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uT;
      varying vec2 vUv; varying float vS; varying float vI;
      ${NOISE}
      void main() {
        if (vI <= 0.0) discard;
        float y = vUv.y, x = vUv.x;
        float n = fbm(vec2(x * 2.2 + vS * 13.0, y * 1.6 - uT * 1.9 + vS * 7.0));
        float n2 = vnoise(vec2(x * 5.0 - vS * 3.0, y * 3.5 - uT * 3.3));
        float width = 0.5 * pow(1.0 - y, 0.55) * (0.55 + 0.45 * smoothstep(0.0, 0.12, y));
        float body = smoothstep(width, width * 0.35, abs(x + (n - 0.5) * 0.35 * y)) * smoothstep(0.98, 0.35, y + (n2 - 0.5) * 0.5);
        float heat = body * (1.0 - y * 0.85) * (0.6 + 0.6 * n);
        vec3 c = mix(vec3(0.6, 0.06, 0.01), vec3(1.0, 0.42, 0.06), smoothstep(0.1, 0.45, heat));
        c = mix(c, vec3(1.0, 0.85, 0.55), smoothstep(0.5, 0.85, heat));
        gl_FragColor = vec4(c * heat * 2.2 * vI, 1.0);
        ${FADE}
      }`,
    fog: true,
    side: THREE.DoubleSide,
    ...ADD,
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.frustumCulled = false
  mesh.renderOrder = 3
  return mesh
}

/**
 * Smoke: soft dark billows rising from every fire and drifting off with the wind, lit orange from below
 * by the fire they leave; each puff on its own loop of the (slow-motion-aware) clock. Groups as flames.
 */
function smoke(list, groups, U) {
  const base = new THREE.PlaneGeometry(1, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  g.setAttribute('position', base.attributes.position)
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(f => [f.x, f.y, f.z, f.g])), 4))
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(f => [f.r, f.h, f.s, f.k])), 4))
  g.instanceCount = list.length
  const m = new THREE.ShaderMaterial({
    uniforms: fogged({ uT: U.uT, uG: { value: groups } }),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aA; attribute vec4 aB;
      uniform float uT; uniform vec2 uG[${groups.length}];
      varying vec2 vUv; varying float vAge; varying float vS; varying float vI;
      void main() {
        vec2 gr = uG[int(aA.w + 0.5)];
        float age = fract(uT * aB.w + aB.z);
        vec3 c = aA.xyz + vec3(age * age * 9.0 + sin(aB.z * 40.0) * 1.5 * age, age * aB.y, -age * 3.0 + cos(aB.z * 30.0) * 1.2 * age);
        float r = aB.x * (0.45 + 1.4 * age) * gr.y;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float a = aB.z * 6.2831 + uT * 0.15;
        vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
        vec3 p = c + (right * q.x + up * q.y) * r;
        vUv = position.xy * 2.0;
        vAge = age; vS = aB.z; vI = gr.x;
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uT;
      varying vec2 vUv; varying float vAge; varying float vS; varying float vI;
      ${NOISE}
      void main() {
        if (vI <= 0.0) discard;
        float r = length(vUv);
        float n = fbm(vUv * 1.6 + vS * 17.0 + vec2(0.0, -uT * 0.08));
        float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7) * smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(0.55, 1.0, vAge));
        vec3 c = mix(vec3(0.5, 0.17, 0.04), vec3(0.035, 0.03, 0.028), smoothstep(0.02, 0.3, vAge));
        c += vec3(0.05, 0.035, 0.02) * (1.0 - vUv.y) * 0.5;
        gl_FragColor = vec4(c, a * 0.62 * vI);
        #include <fog_fragment>
      }`,
    fog: true,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.frustumCulled = false
  mesh.renderOrder = 4
  return mesh
}

/**
 * Embers and sparks as points: embers rise from the fires on the clock; bursts (the glass, the wall, the
 * guns' hits, the crash) fly out from a point at a given p and fall, a pure function of p.
 */
function sparkPoints(embers, bursts, U, scale) {
  const pos = [], aA = [], aB = []
  for (const e of embers) {
    pos.push(e.x, e.y, e.z)
    aA.push(rnd() * 2 - 1, rnd(), rnd() * 2 - 1, -1)
    aB.push(rnd(), 0.15 + rnd() * 0.25, e.h, 0)
  }
  bursts.forEach((b, bi) => {
    for (let i = 0; i < b.n; i++) {
      pos.push(...b.at)
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(b.v * (0.3 + rnd() * 0.7)).add(new THREE.Vector3(...(b.dir ?? [0, 0, 0])))
      aA.push(v.x, v.y, v.z, bi)
      aB.push(rnd(), b.life * (0.5 + rnd() * 0.5), 0, b.col ?? 0)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aA', new THREE.Float32BufferAttribute(aA, 4))
  g.setAttribute('aB', new THREE.Float32BufferAttribute(aB, 4))
  const m = new THREE.ShaderMaterial({
    uniforms: fogged({ uT: U.uT, uAge: { value: new Float32Array(Math.max(1, bursts.length)) }, uScale: scale }),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aA; attribute vec4 aB;
      uniform float uT, uScale; uniform float uAge[${Math.max(1, bursts.length)}];
      varying float vHot; varying float vCol;
      void main() {
        vec3 p = position; float hot;
        if (aA.w < 0.0) {
          float age = fract(uT * aB.y + aB.x);
          p += vec3(aA.x * age * 1.5 + sin(uT * 2.0 + aB.x * 30.0) * 0.3 * age, age * aB.z, aA.z * age * 1.5);
          hot = (1.0 - age) * smoothstep(0.0, 0.05, age);
        } else {
          float age = uAge[int(aA.w + 0.5)] / aB.y;
          p += aA.xyz * age * aB.y + vec3(0.0, -4.9, 0.0) * age * age * aB.y * aB.y;
          p.y = max(p.y, 0.03);
          hot = (age > 0.0 && age < 1.0) ? pow(1.0 - age, 1.5) : 0.0;
        }
        vHot = hot; vCol = aB.w;
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = hot > 0.0 ? max(1.5, 0.05 * uScale / max(0.5, -mvPosition.z)) : 0.0;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      varying float vHot; varying float vCol;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        vec3 c = vCol > 0.5 ? vec3(0.7, 0.85, 1.0) : mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.85, 0.5), vHot);
        gl_FragColor = vec4(c * exp(-r * r * 3.0) * vHot * 3.0, 1.0);
        ${FADE}
      }`,
    fog: true,
    ...ADD,
  })
  const pts = new THREE.Points(g, m)
  pts.frustumCulled = false
  pts.renderOrder = 5
  return pts
}

/** A soft round glow with an anamorphic streak (dive.js's flare). */
function flareTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')
  let grad = g.createRadialGradient(128, 64, 0, 128, 64, 60)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.12, 'rgba(255,255,255,0.55)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.12)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 128)
  grad = g.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.8)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 62, 256, 4)
  g.globalAlpha = 0.35
  g.fillRect(0, 59, 256, 10)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  return t
}

// Box geometry helpers: a unit box with its base at y = 0, and a sized, placed box for merging.
const unitBox = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)
const cyl = (r, l, x, y, z, seg = 14) => new THREE.CylinderGeometry(r, r, l, seg).rotateZ(PI / 2).translate(x, y, z)

export function createChase(renderer, { loader, mobile = false }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 700)
  scene.add(camera)
  const here = new THREE.Vector3()
  const grade = { bloom: 0.9, threshold: 0.62, vignette: 0.62, grain: 0.55, scan: 0 }
  const out = { here, dream: 0, grade }
  const K3 = [0, 0, 0], K3b = [0, 0, 0], KW = [0, 0, 0], KT = [0]
  const bikeAt = new THREE.Vector3(), cam = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3()
  let truckZ = 330

  // ---- the shots, cut between: each places cam and look from where the bike (and the truck) are
  const shot = (p, portrait, t, still) => {
    const b = bikeAt, k = portrait ? 1.55 : 1
    if (p < 0.3) {
      // A: head-on, low, the camera backing away as he gains on it (close from the first clear frame).
      const d = 6.5 - 2.5 * ss(0.05, 0.3, p)
      cam.set(b.x + 0.8 * k, portrait ? 1.35 : 0.5, b.z + d * k)
      look.set(b.x, portrait ? 1.7 : 0.8, b.z - 1) // a phone holds him low, over the wet road's lights
    } else if (p < 0.37) {
      // B: a low three-quarter front at the guns, arcing across the nose.
      const u = (p - 0.3) / 0.07
      cam.set(b.x + (2.1 - 3.6 * u) * k, portrait ? 0.75 : 0.42, b.z + (3.9 - 0.4 * u) * k)
      look.set(b.x, 0.7, b.z + 0.3)
    } else if (p < 0.43) {
      // B2: over his shoulder, high: the tracers down the street into the burning barricade.
      cam.set(b.x - 1.3, 2.7 + (portrait ? 0.5 : 0), b.z - 6.5 * k)
      look.set(b.x + 0.8, 0.2, b.z + 16)
    } else if (p < 0.56) {
      // C: inside the arcade by the shops: he comes at the glass, bursts through, and the camera rides
      // alongside him down the arcade until he bursts out again.
      if (portrait) {
        // A phone looks down the arcade at him coming, shops either side, him low in the frame.
        cam.set(20, 2.1, Math.min(ARC.z1 - 3, Math.max(190, b.z + 8)))
        look.set(b.x, 2.3, b.z)
      } else {
        cam.set(ARC.x1 - 0.45, 1.35, Math.min(ARC.z1 - 12, Math.max(188, b.z + 1.2)))
        look.set(b.x, 0.85, b.z - 0.3)
      }
    } else if (p < 0.612) {
      // D: low on the +x side: the truck goes by the other way, he comes past the camera and cuts behind it.
      cam.set(5.6 + (portrait ? 1 : 0), 0.75, 238 - (portrait ? 6 : 0))
      tmp.set(-3, 2.2, 262)
      look.copy(b).setY(b.y + 0.9).lerp(tmp, 0.6)
    } else if (p < 0.72) {
      // D2: pushing in as he reaches the wall, so the bike stands a third of the frame: the front up the
      // wall, then the camera swings round with him as he pivots 180 on the rear tyre.
      const u = ss(0.612, 0.645, p), v = ss(0.645, 0.705, p)
      const r = 14.5 - 6.5 * u + 1.5 * v + (portrait ? 2.5 : 0), a = -0.95 - 0.25 * u + 0.45 * v
      cam.set(-12.7 + r * Math.cos(a), 1.3 + 0.5 * u, 266 + r * Math.sin(a))
      tmp.set(-13, 2.6, 266)
      look.copy(b).setY(1.4).lerp(tmp, 0.45 - 0.35 * u)
    } else if (p < 0.79) {
      // E0: a side dolly on his right as he runs up alongside the truck.
      cam.set(b.x + 3.3 * k, 0.8, b.z - 0.9 * k)
      look.set(b.x - 0.3, 1.1 + 0.6 * ss(0.74, 0.78, p), b.z + 0.1)
    } else {
      // E: low ahead of him, slow motion: the truck goes over behind him and comes down in fire.
      // Off to his side, so the truck goes over in profile behind him. A phone stands far back down the
      // road and up (held just past the tracks' turn, so their deck never cuts the arc), where the truck's
      // whole arc goes over end-on above him: him in the lower third, 30% from the left (a phone's
      // half-width at his depth is 0.168 of it), it up right.
      if (portrait) {
        cam.set(6.5, 4, 151)
        look.set(b.x - 0.4 * (b.z - 151) * 0.168, 5.5, b.z)
      } else {
        cam.set(b.x + 3.6, 0.45, b.z - 11.5)
        look.set(b.x - 4.2, 2.0 + 4.6 * ss(0.79, 0.835, p) - 3.6 * ss(0.86, 0.9, p), b.z + 12)
      }
    }
  }

  const frame = (state, aspect) => {
    const p = state.p ?? 0
    bikeAt.fromArray(BIKE(p, K3))
    shot(p, !!state.portrait, 0, true)
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    camera.position.copy(cam)
    camera.lookAt(look)
    here.copy(bikeAt).setY(bikeAt.y + 1)
    return out
  }

  let run = null
  ;(async () => {
    let t0 = performance.now()
    const step = async () => {
      if (performance.now() - t0 < 4) return
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }
    const traveller = loadTraveller(loader), bikeFile = loader.loadAsync('/cinema/chase/bike.glb'), suitFile = loader.loadAsync('/cinema/suits/bat.glb')
    const pxScale = { value: 900 }, size = new THREE.Vector2()
    const clockU = { uT: { value: 0 } }
    const COOL = new THREE.Color(0.3, 0.4, 0.65), FIRE = new THREE.Color(1.6, 0.68, 0.2)
    const rimBike = { value: COOL.clone() }, rimSuit = { value: COOL.clone() }, rimTruck = { value: new THREE.Color(0, 0, 0) }
    const SODIUM = [1, 0.55, 0.2]
    scene.fog = new THREE.FogExp2('#2c1b10', mobile ? 0.0105 : 0.0095)
    const dome = sky({ top: '#120f10', mid: '#2e211b', low: '#5a3520', sunDir: new THREE.Vector3(0, 1, 0), sun: '#000000' })
    scene.add(dome)
    // The night street as the metal and the wet see it: sodium glow low and all round, fire on the
    // horizon, a few lit lobbies, the dark sky above.
    {
      const env = new THREE.Scene()
      env.add(sky({ top: '#010102', mid: '#070505', low: '#140b06', sunDir: new THREE.Vector3(0, 1, 0), sun: '#000000' }))
      for (let i = 0; i < 10; i++) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(i < 6 ? 14 : 40, i < 6 ? 4 : 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(...(i < 6 ? SODIUM : [1, 0.4, 0.1])).multiplyScalar(i < 6 ? 1.2 : 0.7), side: THREE.DoubleSide }))
        const a = (i / 10) * PI * 2 + 0.3, e = i < 6 ? 0.35 : 0.05
        s.position.set(Math.cos(a) * 60 * Math.cos(e), Math.sin(e) * 60, Math.sin(a) * 60 * Math.cos(e))
        s.lookAt(0, 0, 0)
        env.add(s)
      }
      await new Promise(r => setTimeout(r))
      const pm = new THREE.PMREMGenerator(renderer)
      scene.environment = pm.fromScene(env, 0, 0.1, 200, { size: 64 }).texture
      scene.environmentIntensity = 0.9
      pm.dispose()
      await new Promise(r => setTimeout(r))
      t0 = performance.now()
    }

    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler()
    const inst = (geo, mat, list, put, { cast = false, receive = true } = {}) => {
      const m = new THREE.InstancedMesh(geo, mat, list.length)
      list.forEach((r, i) => m.setMatrixAt(i, put(r, i)))
      m.castShadow = cast
      m.receiveShadow = receive
      m.frustumCulled = false
      scene.add(m)
      return m
    }
    const inGap = z => GAPS.some(([a, b]) => z > a && z < b)

    // ------------------------------------------------------------ the street
    const road = new THREE.Mesh(new THREE.PlaneGeometry(600, 900).rotateX(-PI / 2).translate(0, 0, 160), roadMaterial(0.55))
    road.receiveShadow = true
    scene.add(road)
    const walkMat = roadMaterial(0.35)
    walkMat.defines = { SIDEWALK: '' }
    walkMat.customProgramCacheKey = () => 'chase-walk'
    const walks = []
    for (const s of [-1, 1]) {
      let z = -140
      for (const [a, b] of [...GAPS, [520, 520]]) {
        walks.push([s * (KERB + FACE) / 2, a - z, z + (a - z) / 2])
        z = b
      }
    }
    inst(unitBox(), walkMat, walks, ([x, l, z]) => M.compose(P.set(x, 0, z), Q.identity(), S.set(FACE - KERB, 0.15, l)))
    await step()

    // ------------------------------------------------------------ the buildings
    // Each side a row of blocks of 18..34 m frontage; low under the tracks, taller beyond the turn; the
    // arcade's block (ground floor open) on +x; a second row of towers behind; a stone tower closing the
    // street's far end.
    const blocks = [], params = []
    const addBlock = (x0, x1, z0, z1, h, lobby = 1) => {
      blocks.push([(x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(z1 - z0), h, 0])
      params.push(lobby)
    }
    seed = 23
    for (const s of [-1, 1]) {
      let z = -160
      while (z < 470) {
        const next = GAPS.find(([, b]) => b > z)
        if (next && z >= next[0] - 4) { z = next[1]; continue }
        const lim = next ? next[0] : 470
        let w = 18 + rnd() * 16
        if (lim - (z + w) < 10) w = lim - z
        if (s > 0 && z < ARC.z1 && z + w > ARC.z0) {
          // The arcade's block: its upper floors over the open ground floor.
          if (z < ARC.z0) w = ARC.z0 - z
          else {
            addBlock(FACE, FACE + 26, ARC.z0, ARC.z1, 30, 0)
            blocks[blocks.length - 1][5] = 8.4
            z = ARC.z1
            continue
          }
        }
        const h = z > 150 ? 40 + rnd() ** 1.3 * 90 : 18 + rnd() * 34
        addBlock(s * FACE, s * (FACE + 22 + rnd() * 10), z, z + w, h, s < 0 && z < 272 && z + w > 260 ? 0 : 1)
        z += w
      }
    }
    for (const s of [-1, 1]) for (let z = 120; z < 470; z += 26 + rnd() * 14) addBlock(s * (44 + rnd() * 6), s * (68 + rnd() * 10), z, z + 18 + rnd() * 6, 70 + rnd() * 120)
    addBlock(-30, 30, 470, 500, 150)
    const facades = new THREE.InstancedMesh(unitBox(), facadeMaterial(), blocks.length)
    blocks.forEach(([x, z, w, d, h, y0], i) => {
      facades.setMatrixAt(i, M.compose(P.set(x, y0, z), Q.identity(), S.set(w, h - y0, d)))
      facades.setColorAt(i, new THREE.Color(0, params[i], 0))
    })
    facades.frustumCulled = false
    facades.receiveShadow = true
    scene.add(facades)
    // Cornices and the fascia over the shops: stone ledges standing proud of every street face.
    const ledges = []
    for (let i = 0; i < blocks.length; i++) {
      const [x, z, w, d, h, y0] = blocks[i]
      if (Math.abs(x) > 40 || Math.abs(x) < FACE) continue
      const fx = Math.sign(x) * FACE
      ledges.push([fx, h - 1.2, z, 1.1, 0.5, d + 0.4])
      if (params[i]) ledges.push([fx, 5.4, z, 0.7, 0.35, d])
      if (h > 30 && rnd() < 0.7) ledges.push([fx, 16.3, z, 0.6, 0.4, d])
      void y0, w
    }
    ledges.push([FACE + 0.3, ARC.h, (ARC.z0 + ARC.z1) / 2, 0.6, 8.4 - ARC.h, ARC.z1 - ARC.z0]) // the stone band over the arcade's glass
    inst(unitBox(), new THREE.MeshStandardMaterial({ color: '#3a332b', roughness: 0.9 }), ledges, ([x, y, z, w, h, d]) => M.compose(P.set(x, y, z), Q.identity(), S.set(w, h, d)))
    await step()

    // ------------------------------------------------------------ the elevated tracks
    // The centre line: straight up the street, a quarter turn of radius r, then off along the cross street.
    const line = [[0, -170]]
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (PI / 2)
      line.push([-EL.r + EL.r * Math.cos(a), EL.end + EL.r * Math.sin(a)])
    }
    line.push([-260, EL.z])
    // Members as boxes along the line, offset sideways: each run's segments.
    // Each vertex's sideways normal (averaged at the turn's joints, a mitre near enough at 11 degrees).
    const norms = line.map((_, i) => {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1])
      return [(b[1] - a[1]) / L, -(b[0] - a[0]) / L]
    })
    // Members as boxes along the line, offset sideways, long runs cut into 40 m pieces.
    const along = (off, y, w, h, list) => {
      for (let i = 0; i < line.length - 1; i++) {
        const p0x = line[i][0] + norms[i][0] * off, p0z = line[i][1] + norms[i][1] * off
        const p1x = line[i + 1][0] + norms[i + 1][0] * off, p1z = line[i + 1][1] + norms[i + 1][1] * off
        const pieces = Math.max(1, Math.round(Math.hypot(p1x - p0x, p1z - p0z) / 40))
        for (let k = 0; k < pieces; k++) {
          const u0 = k / pieces, u1 = (k + 1) / pieces
          const sx = p0x + (p1x - p0x) * u0, sz = p0z + (p1z - p0z) * u0, ex = p0x + (p1x - p0x) * u1, ez = p0z + (p1z - p0z) * u1
          list.push([(sx + ex) / 2, y, (sz + ez) / 2, w, h, Math.hypot(ex - sx, ez - sz) + 0.02, Math.atan2(ex - sx, ez - sz)])
        }
      }
    }
    const girders = [], fascia = [], deck = []
    for (const o of [-2.9, -1.1, 1.1, 2.9]) along(o, 6.6, 0.36, 1.35, girders)
    for (const o of [-7.3, 7.3]) along(o, 6.4, 0.3, 1.9, fascia)
    along(0, 8.0, 7.4, 0.14, deck)
    const putMember = ([x, y, z, w, h, l, yaw]) => M.compose(P.set(x, y, z), Q.setFromAxisAngle(S.set(0, 1, 0), yaw), S.set(w, h, l))
    const steel = steelMaterial(), lattice = steelMaterial(true)
    inst(unitBox(), steel, girders, putMember, { cast: true })
    inst(unitBox(), lattice, fascia, putMember, { cast: true })
    // Ties under the rails seen from below: dark timbers with the night's glow between.
    const tieMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })
    tieMat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW2;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW2 = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;')
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW2; float gapT;')
        .replace('#include <map_fragment>', 'float tz = length(vW2.xz - vec2(-12.0, 146.0)) > 30.0 ? (vW2.z < 146.0 ? vW2.z : vW2.x) : atan(vW2.z - 146.0, vW2.x + 12.0) * 12.0;\ngapT = step(0.62, fract(tz / 0.6));\ndiffuseColor.rgb = mix(vec3(0.04, 0.03, 0.025), vec3(0.0), gapT);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.09, 0.05, 0.03) * gapT;')
    }
    tieMat.customProgramCacheKey = () => 'chase-ties'
    inst(unitBox(), tieMat, deck, putMember, { cast: true })
    await step()
    // Columns (riveted I-sections on footings, with knee braces up to the cross girders) at the kerb lines
    // every 16 m, and the cross girders (bents) they carry.
    const cols = [], bents = []
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1], L = Math.hypot(bx - ax, bz - az)
      const nx = (bz - az) / L, nz = -(bx - ax) / L, yaw = Math.atan2(bx - ax, bz - az)
      const n = L > 30 ? Math.floor(L / 16) : 1
      for (let k = 0; k < n; k++) {
        const u = L > 30 ? (k + 0.5) / n : 0.5, x = ax + (bx - ax) * u, z = az + (bz - az) * u
        if (L < 30 && i % 2) continue
        if (x < -100) continue
        bents.push([x, 5.6, z, 15.4, 1.0, 0.55, yaw])
        for (const s of [-1, 1]) {
          const cx = x + nx * 7 * s, cz = z + nz * 7 * s
          if (Math.abs(cx) > 9 && Math.abs(cz - EL.z) > 9) continue // never through a facade
          if (L < 30 && s > 0) continue // the turn's outer side spans the street on its girders
          cols.push([cx, 0, cz, yaw])
        }
      }
    }
    const colGeo = mergeGeometries([
      box(0.55, 5.7, 0.07, 0, 2.85 + 0.1, 0.22), box(0.55, 5.7, 0.07, 0, 2.85 + 0.1, -0.22), box(0.06, 5.7, 0.42, 0, 2.85 + 0.1, 0),
      box(0.9, 0.2, 0.9, 0, 0.1, 0), box(0.7, 0.25, 0.7, 0, 5.75, 0),
      box(0.12, 2.0, 0.12, 0, 0, 0).rotateZ(0.75).translate(0.62, 5.0, 0), box(0.12, 2.0, 0.12, 0, 0, 0).rotateZ(-0.75).translate(-0.62, 5.0, 0),
    ])
    const colMat = new THREE.MeshStandardMaterial({ color: '#17201b', roughness: 0.6, metalness: 0.5 })
    inst(colGeo, colMat, cols, ([x, , z, yaw]) => M.compose(P.set(x, 0, z), Q.setFromAxisAngle(S.set(0, 1, 0), yaw + PI / 2), S.set(1, 1, 1)), { cast: true })
    inst(unitBox(), steel, bents, putMember, { cast: true })
    await step()

    // ------------------------------------------------------------ street lights
    // Cobra-head sodium lamps on the kerbs (staggered), and bare lamps hung under the tracks.
    const lights = [], lampHeads = [], poles = [], cones = [], pools = [], streakList = []
    for (let z = -150; z < 460; z += 32) for (const s of [-1, 1]) {
      const zz = z + (s > 0 ? 16 : 0)
      if (inGap(zz) || (s > 0 && zz > ARC.z0 - 2 && zz < ARC.z1 + 2)) continue
      poles.push([s * 10.4, zz, s])
      const hx = s * 8.7, hy = 7.4
      lampHeads.push([hx, hy, zz])
      lights.push({ p: [hx, hy - 0.2, zz], c: SODIUM.map(v => v * 1.4), s: 0.8 })
      cones.push([hx, hy - 0.2, zz, 4.2, 7.2])
      pools.push([hx * 0.85, zz, 12])
      streakList.push({ p: [hx, hy, zz], c: SODIUM.map(v => v * 0.9), w: 0.7 })
    }
    for (let z = -150; z < EL.end - 4; z += 32) for (const x of [-3.6, 3.6]) {
      const zz = z + 8 + (x > 0 ? 16 : 0)
      lights.push({ p: [x, 5.0, zz], c: [1.3, 0.75, 0.35], s: 0.5 })
      lampHeads.push([x, 5.25, zz])
      cones.push([x, 5.0, zz, 3.0, 5.0])
      pools.push([x, zz, 8])
      streakList.push({ p: [x, 5.0, zz], c: [0.7, 0.4, 0.16], w: 0.5 })
    }
    const poleGeo = mergeGeometries([new THREE.CylinderGeometry(0.09, 0.14, 7.6, 8).translate(0, 3.8, 0), new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6).rotateZ(PI / 2 - 0.12).translate(-0.9, 7.55, 0)])
    const darkMetal = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5, metalness: 0.6 })
    inst(poleGeo, darkMetal, poles, ([x, z, s]) => M.compose(P.set(x, 0, z), Q.setFromAxisAngle(S.set(0, 1, 0), s > 0 ? 0 : PI), S.set(1, 1, 1)))
    inst(new THREE.BoxGeometry(0.5, 0.12, 0.28), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.62, 0.3).multiplyScalar(1.7) }), lampHeads, ([x, y, z]) => M.makeTranslation(x, y, z))
    inst(unitBox(), darkMetal, lampHeads.filter(([, y]) => y < 6), ([x, y, z]) => M.compose(P.set(x, y, z), Q.identity(), S.set(0.05, 6.6 - y, 0.05)))
    const coneMat = coneMaterial(SODIUM, 0.06)
    inst(new THREE.CylinderGeometry(0.15, 1, 1, 16, 1, true), coneMat, cones, ([x, y, z, r, h]) => M.compose(P.set(x, y - h / 2, z), Q.identity(), S.set(r, h, r)), { receive: false }).renderOrder = 2
    // Pools of lamplight on the road and the walks.
    const pc = document.createElement('canvas')
    pc.width = pc.height = 64
    const pg = pc.getContext('2d'), grad = pg.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    pg.fillStyle = grad
    pg.fillRect(0, 0, 64, 64)
    const poolTex = new THREE.CanvasTexture(pc)
    poolTex.colorSpace = THREE.NoColorSpace
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: new THREE.Color(0.5, 0.26, 0.09), ...ADD, polygonOffset: true, polygonOffsetFactor: -1 })
    inst(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), poolMat, pools, ([x, z, r]) => M.compose(P.set(x, 0.16, z), Q.identity(), S.set(r, 1, r)), { receive: false }).renderOrder = 1
    await step()

    // ------------------------------------------------------------ the arcade
    // A glass front of tall panes between iron posts at x = 14; inside, a polished stone floor, shops lit
    // along x = 22, a glass barrel vault with globe lamps. The two panes he goes through burst (BREAK).
    const posts = [], panes = [], paneBreak = []
    for (let z = ARC.z0; z <= ARC.z1 + 0.01; z += 2) posts.push([ARC.x0, z])
    for (let z = ARC.z0 + 1; z < ARC.z1; z += 2) {
      panes.push(z)
      paneBreak.push(Math.abs(z - 183) < 2 ? 0 : Math.abs(z - 229) < 2 ? 1 : -1)
    }
    const iron = new THREE.MeshStandardMaterial({ color: '#1a1a18', roughness: 0.45, metalness: 0.7 })
    inst(mergeGeometries([box(0.22, ARC.h, 0.22, 0, ARC.h / 2, 0), box(0.4, 0.3, 0.4, 0, 0.15, 0)]), iron, posts, ([x, z]) => M.makeTranslation(x, 0, z), { cast: true })
    scene.add(new THREE.Mesh(mergeGeometries([box(0.5, 0.7, ARC.z1 - ARC.z0, ARC.x0, ARC.h - 0.35, (ARC.z0 + ARC.z1) / 2), box(0.12, 0.08, ARC.z1 - ARC.z0, ARC.x0, 4.6, (ARC.z0 + ARC.z1) / 2)]), iron))
    const paneGeo = new THREE.PlaneGeometry(1.78, ARC.h - 0.75).rotateY(PI / 2).translate(0, (ARC.h - 0.75) / 2, 0)
    const paneMesh = new THREE.InstancedMesh(paneGeo, new THREE.MeshStandardMaterial({ color: '#0b0d0e', roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }), panes.length)
    panes.forEach((z, i) => paneMesh.setMatrixAt(i, M.makeTranslation(ARC.x0, 0, z)))
    paneMesh.frustumCulled = false
    paneMesh.renderOrder = 2
    scene.add(paneMesh)
    const paneM = panes.map((z, i) => paneBreak[i] < 0 ? null : { i, z })
    // Floor, shops, vault.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARC.x1 - ARC.x0, ARC.z1 - ARC.z0).rotateX(-PI / 2).translate((ARC.x0 + ARC.x1) / 2, 0.03, (ARC.z0 + ARC.z1) / 2), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.08, metalness: 0.2 }))
    floor.receiveShadow = true
    scene.add(floor)
    const shopMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 })
    shopMat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW3;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW3 = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW3; vec3 shopLit;\n' + NOISE)
        .replace('#include <map_fragment>', /* glsl */ `
          float bayU = (vW3.z - ${ARC.z0.toFixed(1)}) / 8.0, bf = fract(bayU), bid = floor(bayU);
          float y = vW3.y;
          float win = step(0.08, bf) * step(bf, 0.92) * step(0.5, y) * step(y, 3.6);
          float door = step(0.62, bf) * step(bf, 0.82) * step(y, 3.6);
          float shut = step(0.8, h21(vec2(bid, 5.0)));
          vec3 tint = h21(vec2(bid, 1.0)) < 0.5 ? vec3(1.0, 0.75, 0.45) : h21(vec2(bid, 2.0)) < 0.5 ? vec3(0.85, 0.92, 1.0) : vec3(1.0, 0.55, 0.35);
          float shelves = 0.6 + 0.4 * step(0.5, fract(y * 2.2)) * step(0.3, fract(vW3.z * 1.3));
          shopLit = win * (1.0 - shut) * tint * shelves * (0.5 + 0.5 * smoothstep(0.5, 3.6, y)) * 1.5;
          float sign = step(3.9, y) * step(y, 4.5) * step(0.1, bf) * step(bf, 0.9);
          shopLit += sign * tint * 0.5 * (1.0 - shut);
          diffuseColor.rgb = mix(vec3(0.09, 0.08, 0.07), vec3(0.02), win) * (1.0 - 0.5 * door);`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += shopLit;')
    }
    shopMat.customProgramCacheKey = () => 'chase-shops'
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(ARC.z1 - ARC.z0, ARC.h).rotateY(-PI / 2).translate(ARC.x1, ARC.h / 2, (ARC.z0 + ARC.z1) / 2), shopMat))
    const vaultR = (ARC.x1 - ARC.x0) / 2
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(vaultR, vaultR, ARC.z1 - ARC.z0, 20, 1, true, -PI / 2, PI).rotateX(-PI / 2).scale(1, 0.45, 1).translate((ARC.x0 + ARC.x1) / 2, ARC.h, (ARC.z0 + ARC.z1) / 2), new THREE.MeshBasicMaterial({ color: '#0c0a0a', side: THREE.DoubleSide }))
    scene.add(vault)
    const ribs = []
    for (let z = ARC.z0; z <= ARC.z1; z += 4) ribs.push(z)
    inst(new THREE.TorusGeometry(vaultR, 0.07, 4, 20, PI).scale(1, 0.45, 1), iron, ribs, z => M.makeTranslation((ARC.x0 + ARC.x1) / 2, ARC.h, z))
    for (let z = ARC.z0 + 6; z < ARC.z1; z += 8) {
      lights.push({ p: [(ARC.x0 + ARC.x1) / 2, 5.0, z], c: [1.6, 1.25, 0.85], s: 0.55 })
      streakList.push({ p: [(ARC.x0 + ARC.x1) / 2, 5.0, z], c: [0.5, 0.38, 0.24], w: 0.4 })
    }
    await step()

    // ------------------------------------------------------------ wrecks, fires, smoke, debris
    // Cars as merged boxes (body, cabin, wheels): wrecks along the street, some burning; three across the
    // street at its turn as a barricade (burning, and shot at).
    const profile = new THREE.Shape([[-2.3, 0.3], [-2.36, 0.74], [-1.25, 0.86], [-0.55, 1.36], [0.75, 1.36], [1.35, 0.9], [2.28, 0.78], [2.32, 0.3], [1.82, 0.3], [1.8, 0.62], [1.1, 0.62], [1.08, 0.3], [-1.1, 0.3], [-1.12, 0.62], [-1.82, 0.62], [-1.84, 0.3]].map(([z, y]) => new THREE.Vector2(z, y)))
    const carGeo = mergeGeometries([
      new THREE.ExtrudeGeometry(profile, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1 }).translate(0, 0, -0.85).rotateY(PI / 2),
      cyl(0.32, 0.22, 0.8, 0.32, 1.45), cyl(0.32, 0.22, -0.8, 0.32, 1.45), cyl(0.32, 0.22, 0.8, 0.32, -1.46), cyl(0.32, 0.22, -0.8, 0.32, -1.46),
    ].map(g => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g }))
    const charred = new THREE.MeshStandardMaterial({ color: '#141210', roughness: 0.75, metalness: 0.35 })
    const cars = [
      [-8.4, 30, 0.1, 1], [8.0, 72, -0.2, 1], [-7.9, 108, 0.35, 1], [8.4, 18, 0.05, 0], [-8.6, 88, -0.05, 0], [8.5, 128, 0.1, 0],
      [-6.5, 171, 1.45, 1], [-2.0, 173, 1.75, 1], [-0.2, 168, 1.45, 0], // the barricade (he swerves round its end, then back past it)
      [8.3, 290, 0.05, 0], [-8.2, 330, 0.1, 1], [8.4, 352, -0.1, 0], [-8.3, 215, 0.05, 0],
      [-12.3, 270.6, 0.2, 1], [-10.5, 207, -0.25, 1], // burning at the wall's foot, and behind the truck's flip: backlight
    ].filter((c, i) => !mobile || i < 9 || c[3])
    inst(carGeo, charred, cars, ([x, z, yaw]) => M.compose(P.set(x, 0, z), Q.setFromAxisAngle(S.set(0, 1, 0), yaw), S.set(1, 1, 1)), { cast: true })
    const fireList = [], smokeList = [], embers = []
    const burn = (x, y, z, k, g = 0) => {
      const n = mobile ? 4 : 7
      for (let i = 0; i < n; i++) fireList.push({ x: x + (rnd() - 0.5) * 1.6 * k, y, z: z + (rnd() - 0.5) * 2.4 * k, g, w: (0.9 + rnd() * 0.9) * k, h: (1.6 + rnd() * 1.8) * k, s: rnd(), o: 0.05 })
      const m = mobile ? 4 : 8
      for (let i = 0; i < m; i++) smokeList.push({ x: x + (rnd() - 0.5) * k, y: y + 1.5 * k, z, g, r: (1.4 + rnd()) * k, h: (12 + rnd() * 10) * k, s: rnd(), k: 0.05 + rnd() * 0.03 })
      for (let i = 0; i < (mobile ? 10 : 22); i++) embers.push({ x: x + (rnd() - 0.5) * 2 * k, y: y + 0.5, z: z + (rnd() - 0.5) * 2 * k, h: (6 + rnd() * 8) * k })
    }
    for (const [x, z, , b] of cars) if (b) burn(x, 0.7, z, 1)
    burn(-12.2, 0, 140, 0.8) // a burning dumpster by the turn
    burn(12.6, 0, 96, 0.7)
    // The fireball: the truck's crash, group 1, grown in update().
    const CRASH = [TRUCK_X, 0, 172]
    for (let i = 0; i < (mobile ? 9 : 16); i++) fireList.push({ x: CRASH[0] + (rnd() - 0.5) * 7, y: 0, z: CRASH[2] + (rnd() - 0.5) * 16, g: 1, w: 4 + rnd() * 5, h: 8 + rnd() * 10, s: rnd(), o: 0.1 })
    for (let i = 0; i < (mobile ? 8 : 16); i++) smokeList.push({ x: CRASH[0] + (rnd() - 0.5) * 6, y: 4, z: CRASH[2] + (rnd() - 0.5) * 14, g: 1, r: 4 + rnd() * 3, h: 26 + rnd() * 14, s: rnd(), k: 0.06 + rnd() * 0.04 })
    const fireG = [new THREE.Vector2(1, 1), new THREE.Vector2(0, 0)], smokeG = [new THREE.Vector2(1, 1), new THREE.Vector2(0, 0)]
    scene.add(flames(fireList, fireG, clockU))
    const smokeMesh = smoke(smokeList, smokeG, clockU)
    scene.add(smokeMesh)
    // Each fire's own light on the wet road and in the glass.
    for (const [x, z, , b] of cars) if (b) streakList.push({ p: [x, 1.6, z], c: [1.2, 0.45, 0.1], w: 1.4 })
    // Debris: chunks of concrete and glass and paper on the road.
    const debris = []
    for (let i = 0; i < (mobile ? 140 : 300); i++) debris.push([(rnd() - 0.5) * 19, -120 + rnd() * 460, rnd() * PI, 0.03 + rnd() ** 2 * 0.09])
    inst(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.8 }), debris, ([x, z, a, s]) => M.compose(P.set(x, s * 0.3, z), Q.setFromEuler(E.set(a, a * 2, 0)), S.set(s, s * 0.6, s)))
    await step()

    // Sparks: embers off the fires; bursts at the two panes, the wall's scrape, the barricade's hits, the crash.
    const bursts = [
      { at: [14, 1.4, 183], n: mobile ? 40 : 90, v: 6, dir: [5, 1, 3], life: 1.2, col: 1, p: BREAK[0], k: 70 },
      { at: [14, 1.4, 229], n: mobile ? 40 : 90, v: 6, dir: [-5, 1, 3], life: 1.2, col: 1, p: BREAK[1], k: 70 },
      { at: [-14, 0.4, 266], n: mobile ? 40 : 80, v: 4, dir: [2, 2, 0], life: 1.0, p: WALL[0] + 0.002, k: 60 },
      { at: [-10.9, 0.1, 266], n: mobile ? 40 : 80, v: 5, dir: [3, 1, -1], life: 1.0, p: 0.696, k: 60 },
      { at: [TRUCK_X, 1, 186], n: mobile ? 60 : 140, v: 12, dir: [0, 5, -4], life: 2.5, p: FLIP[1], k: 25 },
      { at: [0, 1.2, 172], n: mobile ? 30 : 70, v: 5, dir: [0, 2, -3], life: 0.8, p: 0.36, k: 30 },
      // The front tyre scraping up the wall, then a trail off the rear tyre as it pivots (thrown outward).
      ...[[0.632, -13.9, 0.9, 4, 0, 0], [0.64, -13.9, 1.8, 4, -1, 0]].map(([p, x, y, dx, dy, dz]) => ({ at: [x, y, 266], n: mobile ? 25 : 50, v: 3, dir: [dx, dy, dz], life: 0.9, p, k: 60 })),
      ...[0.652, 0.662, 0.672, 0.682].map((p, i) => ({ at: [-12.7, 0.05, 266], n: mobile ? 25 : 55, v: 3, dir: [2 * Math.cos(i), 2.5, -4 + 2 * i], life: 0.9, p, k: 60 })),
    ]
    const sparks = sparkPoints(embers, bursts, clockU, pxScale)
    scene.add(sparks)
    // Glass shards: thin triangles flung from the two panes (and down the arcade), a pure function of p.
    const SH = mobile ? 160 : 360
    const shardGeo = new THREE.InstancedBufferGeometry()
    shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.3, 0, 0.5, -0.4, 0, 0.1, 0.6, 0], 3))
    const sA = [], sB = []
    for (let i = 0; i < SH; i++) {
      const w = i % 2, z = w ? 229 : 183, dir = w ? -1 : 1
      sA.push(14 + (rnd() - 0.5) * 0.1, 0.5 + rnd() * 4.8, z + (rnd() - 0.5) * 1.8, w)
      sB.push(dir * (3 + rnd() * 9), 1 + rnd() * 3, (rnd() - 0.3) * 6, 0.05 + rnd() * 0.14)
    }
    shardGeo.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(sA), 4))
    shardGeo.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(sB), 4))
    shardGeo.instanceCount = SH
    const shardU = { uAge: { value: new THREE.Vector2(-1, -1) } }
    const shards = new THREE.Mesh(shardGeo, new THREE.ShaderMaterial({
      uniforms: fogged(shardU),
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        attribute vec4 aA; attribute vec4 aB; uniform vec2 uAge;
        varying float vGlint; varying float vOn;
        void main() {
          float age = aA.w > 0.5 ? uAge.y : uAge.x;
          vOn = age > 0.0 && age < 2.5 ? 1.0 : 0.0;
          float a = max(age, 0.0);
          vec3 v = aB.xyz;
          vec3 c = aA.xyz + v * a + vec3(0.0, -4.9, 0.0) * a * a;
          float landed = step(c.y, 0.02);
          c.y = max(c.y, 0.02);
          float spin = a * (6.0 + 10.0 * fract(aB.w * 37.0)) * (1.0 - landed) + aB.w * 80.0;
          vec3 ax = normalize(vec3(sin(aB.w * 91.0), cos(aB.w * 53.0), sin(aB.w * 17.0)));
          vec3 pp = position * aB.w * vOn;
          pp = pp * cos(spin) + cross(ax, pp) * sin(spin) + ax * dot(ax, pp) * (1.0 - cos(spin));
          vec3 n = normalize(cross(ax, vec3(0.0, 0.0, 1.0)) * sin(spin) + vec3(0.0, 0.0, 1.0) * cos(spin));
          vec3 V = normalize(cameraPosition - c);
          vGlint = pow(abs(dot(reflect(-V, n), normalize(vec3(-0.4, 0.7, -0.5)))), 24.0);
          vec4 mvPosition = viewMatrix * vec4(c + pp, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        varying float vGlint; varying float vOn;
        void main() {
          if (vOn < 0.5) discard;
          gl_FragColor = vec4(vec3(0.5, 0.42, 0.32) * (0.12 + 3.0 * vGlint), 1.0);
          ${FADE}
        }`,
      fog: true,
      side: THREE.DoubleSide,
      ...ADD,
    }))
    shards.frustumCulled = false
    shards.renderOrder = 5
    scene.add(shards)
    await step()

    // ------------------------------------------------------------ the truck
    // A tractor and a long box trailer as merged boxes, its front bumper at the origin, facing -z: hood,
    // cab, sleeper, tanks and stacks; the trailer on two axles; lamps. Pivots on its nose to flip.
    const tGroup = new THREE.Group(), tBody = new THREE.Group()
    tGroup.add(tBody)
    const tDark = mergeGeometries([
      box(2.5, 1.2, 2.3, 0, 1.25, 1.35), box(2.55, 2.0, 1.9, 0, 2.35, 3.4), box(2.55, 2.4, 1.2, 0, 2.15, 4.9), box(2.5, 0.4, 0.3, 0, 0.75, 0.15),
      box(1.0, 0.35, 6.5, 0.55, 0.85, 4.2), box(1.0, 0.35, 6.5, -0.55, 0.85, 4.2),
      new THREE.CylinderGeometry(0.32, 0.32, 1.1, 12).rotateX(PI / 2).translate(1.0, 0.95, 3.6), new THREE.CylinderGeometry(0.32, 0.32, 1.1, 12).rotateX(PI / 2).translate(-1.0, 0.95, 3.6),
      new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8).translate(1.25, 3.4, 4.35), new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8).translate(-1.25, 3.4, 4.35),
      ...[[1.6], [5.6], [6.9], [14.6], [15.9]].flatMap(([z]) => [cyl(0.52, 0.32, 1.05, 0.52, z, 16), cyl(0.52, 0.32, -1.05, 0.52, z, 16)]),
      box(2.4, 0.35, 12.8, 0, 1.15, 10.9),
    ].map(g => g.toNonIndexed()))
    const tWhite = box(2.6, 2.9, 13.4, 0, 2.75, 10.9)
    const truckDark = new THREE.MeshStandardMaterial({ color: '#2a2725', roughness: 0.55, metalness: 0.4 })
    const truckSide = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.2 })
    truckSide.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;')
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;\n' + NOISE)
        .replace('#include <map_fragment>', 'float rib = 0.85 + 0.15 * step(0.5, fract(vP.z * 1.1));\nfloat dirt = fbm(vP.zy * vec2(0.4, 1.2));\ndiffuseColor.rgb = vec3(0.42, 0.42, 0.4) * rib * (0.6 + 0.5 * dirt) * mix(0.5, 1.0, smoothstep(1.3, 3.0, vP.y));')
    }
    truckSide.customProgramCacheKey = () => 'chase-trailer'
    const tm1 = new THREE.Mesh(tDark, truckDark), tm2 = new THREE.Mesh(tWhite, truckSide)
    const tLamps = new THREE.Mesh(mergeGeometries([box(0.4, 0.22, 0.05, 0.85, 1.0, -0.02), box(0.4, 0.22, 0.05, -0.85, 1.0, -0.02), box(0.18, 0.08, 0.05, 0.9, 3.4, 2.43), box(0.18, 0.08, 0.05, -0.9, 3.4, 2.43), box(0.18, 0.08, 0.05, 0, 3.4, 2.43)]), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.85, 0.6).multiplyScalar(4) }))
    const tTail = new THREE.Mesh(mergeGeometries([box(0.3, 0.15, 0.05, 1.0, 1.1, 17.62), box(0.3, 0.15, 0.05, -1.0, 1.1, 17.62)]), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.05, 0.02).multiplyScalar(3) }))
    // Amber clearance lamps outline it as it goes over.
    const marks = [box(0.1, 0.1, 0.1, 0.8, 3.4, 4.43), box(0.1, 0.1, 0.1, -0.8, 3.4, 4.43)]
    for (const x of [1.31, -1.31]) {
      for (let z = 4.6; z < 17.6; z += 2.6) marks.push(box(0.06, 0.2, 0.3, x, 1.45, z))
      for (const z of [4.35, 17.45]) marks.push(box(0.06, 0.2, 0.3, x, 4.08, z))
    }
    const tMarks = new THREE.Mesh(mergeGeometries(marks), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.42, 0.05).multiplyScalar(4) }))
    for (const m of [tm1, tm2]) { m.castShadow = true; m.receiveShadow = true }
    rimLit(truckDark, rimTruck)
    tBody.add(tm1, tm2, tLamps, tTail, tMarks)
    tGroup.position.set(TRUCK_X, 0, 330)
    scene.add(tGroup)
    const flareTex = flareTexture()
    const flareSprite = (color, w) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color, ...ADD, fog: false }))
      s.scale.set(w, w / 2, 1)
      s.frustumCulled = false
      return s
    }
    // The fireball's glow through the smoke.
    const fireGlow = flareSprite(new THREE.Color(1, 0.45, 0.12).multiplyScalar(1.3), 1e-4)
    fireGlow.position.set(CRASH[0], 5, CRASH[2])
    scene.add(fireGlow)
    // The city's glow down both ends of the street, low in the haze: things stand dark against it.
    for (const z of [400, -160]) {
      const h = flareSprite(new THREE.Color(0.5, 0.26, 0.12), 1)
      h.material.map = poolTex
      h.scale.set(260, 120, 1)
      h.position.set(0, 25, z)
      scene.add(h)
    }
    // The fire flaring in the smoke far beyond the truck as it goes over (centred clear of the facades, so
    // no hard edge): it turns over dark against it. Sized in update().
    const backGlow = flareSprite(new THREE.Color(1.1, 0.48, 0.13), 1e-4)
    backGlow.material.map = poolTex
    backGlow.position.set(-2, 9, 240)
    scene.add(backGlow)
    const tFlares = [0.85, -0.85].map(x => {
      const f = flareSprite(new THREE.Color(1, 0.9, 0.7).multiplyScalar(1.6), 3.4)
      f.position.set(x, 1.0, -0.15)
      tBody.add(f)
      return f
    })
    await step()

    // ------------------------------------------------------------ the bike, the suit, him
    const bikeG = new THREE.Group()
    scene.add(bikeG)
    const bikeScene = (await bikeFile).scene
    const wheels = []
    bikeScene.traverse(o => {
      if (!o.isMesh) return
      o.castShadow = true
      o.receiveShadow = true
      const m = o.material
      if (m.map) m.map.colorSpace = THREE.NoColorSpace
      m.envMapIntensity = 0.55
      m.metalnessMap = null // the Meshy metal reads silver: the film's bike is matte black armour
      m.metalness = 0.45
      m.roughness = 0.55
      m.color.setScalar(0.5)
      rimLit(m, rimBike)
    })
    for (const n of ['wheel_front', 'wheel_back']) wheels.push(bikeScene.getObjectByName(n))
    bikeG.add(bikeScene)
    // Headlight, the guns' muzzles (flash sprites and their light), all on the bike.
    const headFlare = flareSprite(new THREE.Color(1, 0.95, 0.85).multiplyScalar(1.1), 1.5)
    headFlare.position.set(0, 0.62, 1.32)
    const sc = document.createElement('canvas')
    sc.width = sc.height = 128
    {
      const g = sc.getContext('2d'), rg = g.createRadialGradient(64, 64, 0, 64, 64, 40)
      rg.addColorStop(0, 'rgba(255,255,255,1)')
      rg.addColorStop(0.25, 'rgba(255,255,255,0.5)')
      rg.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = rg
      g.fillRect(0, 0, 128, 128)
      g.translate(64, 64)
      for (let i = 0; i < 5; i++) {
        g.rotate((PI * 2) / 5 + 0.3)
        const lg = g.createLinearGradient(0, 0, 60, 0)
        lg.addColorStop(0, 'rgba(255,255,255,0.9)')
        lg.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = lg
        g.beginPath()
        g.moveTo(0, -5)
        g.lineTo(62, 0)
        g.lineTo(0, 5)
        g.fill()
      }
    }
    const starTex = new THREE.CanvasTexture(sc)
    starTex.colorSpace = THREE.NoColorSpace
    const muzzles = [0.27, -0.27].map(x => {
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: new THREE.Color(1, 0.86, 0.58).multiplyScalar(1.5), ...ADD, fog: false }))
      f.scale.set(1e-4, 1e-4, 1)
      f.frustumCulled = false
      f.position.set(x, 0.42, 1.38)
      bikeG.add(f)
      return f
    })
    bikeG.add(headFlare)
    // Tracers: bright ribbons streaming from the muzzles down the bike's forward line.
    const TR = mobile ? 10 : 18
    const trGeo = new THREE.InstancedBufferGeometry()
    trGeo.index = new THREE.PlaneGeometry(1, 1).index
    trGeo.setAttribute('position', new THREE.PlaneGeometry(1, 1).attributes.position)
    trGeo.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: TR }, (_, i) => [i % 2 ? -0.27 : 0.27, rnd()]).flat()), 2))
    trGeo.instanceCount = TR
    const trU = { uT: clockU.uT, uOn: { value: 0 }, uM: { value: new THREE.Matrix4() } }
    const tracers = new THREE.Mesh(trGeo, new THREE.ShaderMaterial({
      uniforms: fogged(trU),
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        attribute vec2 aS; uniform float uT, uOn; uniform mat4 uM; varying float vA; varying float vU;
        void main() {
          float d = fract(uT * 3.2 + aS.y) * 70.0;
          vec3 a = (uM * vec4(aS.x, 0.42, 1.5 + d, 1.0)).xyz, b = (uM * vec4(aS.x, 0.42, 1.5 + d + 4.0, 1.0)).xyz;
          vec3 dir = normalize(b - a), side = normalize(cross(dir, cameraPosition - a));
          vec3 p = mix(a, b, position.y + 0.5) + side * position.x * 0.11;
          vA = uOn * (1.0 - d / 70.0); vU = position.y + 0.5;
          vec4 mvPosition = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        varying float vA; varying float vU;
        void main() {
          gl_FragColor = vec4(vec3(1.0, 0.75, 0.4) * vA * vU * 5.0, 1.0);
          ${FADE}
        }`,
      fog: true,
      side: THREE.DoubleSide,
      ...ADD,
    }))
    tracers.frustumCulled = false
    scene.add(tracers)
    await step()

    const you = (await traveller).make({ look: 'pbr' })
    const root = you.root
    const body = []
    root.traverse(o => o.isSkinnedMesh && body.push(o))
    const suit = wearSuit(root, (await suitFile).scene)
    for (const o of body) o.visible = false // only the suit: his own clothes are far wider than it
    for (const m of suit.meshes) {
      const mat = m.material
      if (mat.map) mat.map.colorSpace = THREE.NoColorSpace
      mat.envMapIntensity = 1.1
      rimLit(mat, rimSuit)
      m.receiveShadow = true
    }
    bikeG.add(root)
    const bones = []
    root.traverse(o => o.isBone && bones.push(o))
    const restQ = new Map(bones.map(b => [b, b.quaternion.clone()]))
    const rideQ = aimPose(bones, restQ, RIDE)
    bones.forEach((b, i) => b.quaternion.copy(rideQ[i]))
    const hips = you.bone('Hips'), head = you.bone('Head')
    const headQ = head.quaternion.clone()
    root.updateMatrixWorld(true)
    bikeG.updateMatrixWorld(true)
    const hipsAt = bikeG.worldToLocal(hips.getWorldPosition(new THREE.Vector3()))
    root.position.copy(SEAT).sub(hipsAt)
    await step()

    // ------------------------------------------------------------ light
    const key = new THREE.SpotLight('#dfe4f4', 420, 40, 0.5, 0.6, 1.5) // the streetlamp over him: the one shadow
    key.castShadow = true
    key.shadow.mapSize.setScalar(mobile ? 1024 : 2048)
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    key.shadow.camera.near = 2
    key.shadow.camera.far = 40
    const glow = [0, 1, 2].map(() => new THREE.PointLight('#ff8a3a', 0, 26, 1.8))
    const flash = new THREE.PointLight('#ffb070', 0, 30, 1.6) // the guns, then the fireball
    // A cool night from above and behind for the rims, the street's warm bounce from below.
    const moon = new THREE.DirectionalLight('#8ea4d6', 1.1)
    moon.position.set(-30, 60, -40)
    scene.add(moon.target)
    // The headlight's beam in the haze (its glint on the wet road is a reflection streak, below: a real
    // light there flares into a blob on the mirror-wet road).
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 1, 1, 16, 1, true), coneMaterial([0.8, 0.86, 1], 0.05))
    beam.rotation.x = -PI / 2 // its narrow end (local +y) back at the lamp, flaring forward along +z
    beam.scale.set(1.5, 9, 1.5)
    beam.position.set(0, 0.62, 1.32 + 4.5)
    beam.renderOrder = 2
    bikeG.add(beam)
    scene.add(key, key.target, moon, ...glow, flash, new THREE.HemisphereLight('#34425e', '#4a2c14', 1.6))
    const lamps = lightPoints(lights, pxScale)
    scene.add(lamps)
    // Reflections: the static lights, then the headlight, two muzzles, the truck's lamps and the fireball.
    const refl = reflections(streakList, 6)
    scene.add(refl.mesh)
    const burning = cars.filter(c => c[3]).map(([x, z]) => new THREE.Vector3(x, 1.6, z))
    burning.push(new THREE.Vector3(-12.2, 1.2, 140), new THREE.Vector3(12.6, 1.2, 96))
    await step()

    // ------------------------------------------------------------ each frame
    const wq = new THREE.Quaternion(), rq = new THREE.Quaternion(), qa = new THREE.Quaternion(), Yx = new THREE.Vector3(0, 1, 0), Xx = new THREE.Vector3(1, 0, 0), Zx = new THREE.Vector3(0, 0, 1)
    const mz = new THREE.Vector3(), tmp2 = new THREE.Vector3()
    // His distance along the ride, sampled once, for the wheels' turn as a function of p.
    const DIST = new Float32Array(401)
    for (let i = 1, prev = BIKE(0, [0, 0, 0]).slice(); i <= 400; i++) {
      const c = BIKE(i / 400, [0, 0, 0])
      DIST[i] = DIST[i - 1] + Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2])
      prev = c
    }
    const distAt = p => { const f = clamp01(p) * 400, i = Math.min(399, Math.floor(f)); return DIST[i] + (DIST[i + 1] - DIST[i]) * (f - i) }
    let lastT = null, clock = 0, paneState = 0
    const setDyn = (k, x, y, z, w, r, g, b) => {
      const i = refl.first + k
      refl.aL.array[i * 4] = x; refl.aL.array[i * 4 + 1] = y; refl.aL.array[i * 4 + 2] = z; refl.aL.array[i * 4 + 3] = w
      refl.aC.array[i * 3] = r; refl.aC.array[i * 3 + 1] = g; refl.aC.array[i * 3 + 2] = b
    }
    run = (state, t, aspect) => {
      const p = state.p ?? 0, still = !!state.still, portrait = !!state.portrait
      const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT))
      lastT = t
      // Slow motion for the flip: the city's own clock slows with it.
      const slow = ss(0.78, 0.8, p) * (1 - ss(0.9, 0.95, p))
      clock += dt * (1 - 0.8 * slow) * (still ? 0.5 : 1)
      clockU.uT.value = clock
      renderer.getDrawingBufferSize(size)
      pxScale.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(20)))

      // ---- the bike: on the road it faces along its track and leans into its turns; on the wall, keyed.
      BIKE(p, K3)
      bikeAt.fromArray(K3)
      const e = 0.004
      BIKE(Math.min(1, p + e), K3b)
      const vx = K3b[0] - K3[0], vz = K3b[2] - K3[2]
      BIKE(Math.max(0, p - e), KW)
      const ux = K3[0] - KW[0], uz = K3[2] - KW[2]
      const hA = Math.atan2(ux, uz), hB = Math.atan2(vx, vz)
      let turnRate = hB - hA
      if (turnRate > PI) turnRate -= 2 * PI
      if (turnRate < -PI) turnRate += 2 * PI
      const ds = Math.hypot(vx, vz) + Math.hypot(ux, uz)
      const heading = Math.atan2(vx + ux, vz + uz)
      const roll = THREE.MathUtils.clamp(-(turnRate / Math.max(ds, 0.05)) * 9, -0.6, 0.6)
      rq.setFromAxisAngle(Yx, heading).multiply(qa.setFromAxisAngle(Zx, roll))
      const onWall = ss(0.616, 0.626, p) * (1 - ss(0.698, 0.708, p))
      if (onWall > 0) {
        WALLQ(p, KW)
        wq.setFromAxisAngle(Yx, KW[0]).multiply(qa.setFromAxisAngle(Xx, KW[1])).multiply(qa.setFromAxisAngle(Yx, KW[2]))
        rq.slerp(wq, onWall)
        // Pivot about the rear axle: the bike's origin is the axle less its offset turned with the bike.
        PIV(p, KW)
        tmp.copy(REAR).applyQuaternion(wq)
        bikeAt.lerp(mz.set(KW[0] - tmp.x, 0.345 - tmp.y, KW[1] - tmp.z), onWall)
      }
      bikeG.quaternion.copy(rq)
      bikeG.position.copy(bikeAt)
      // Wheels: their travel, plus a turn on the clock so a held frame still runs.
      const spin = distAt(p) / 0.344 + clock * (still ? 0 : 14) * (1 - 0.8 * slow)
      for (const w of wheels) w.rotation.x = -spin
      // His head turns to watch the truck go by, and the bike shudders on the road.
      const watch = ss(0.565, 0.585, p) * (1 - ss(0.6, 0.615, p))
      head.quaternion.copy(headQ).multiply(qa.setFromAxisAngle(Yx, -0.9 * watch))
      if (!still && onWall < 0.5) {
        bikeG.position.y += Math.sin(clock * 37) * 0.006 + Math.sin(clock * 23.7) * 0.004
        bikeG.rotateZ(Math.sin(clock * 11) * 0.012)
      }
      bikeG.updateMatrixWorld(true)
      here.copy(bikeAt).setY(bikeAt.y + 1)

      // ---- the guns: bursts of flashes in the guns' stretch; tracers ride the bike's line.
      const gunsOn = ss(GUNS[0], GUNS[0] + 0.01, p) * (1 - ss(GUNS[1] - 0.01, GUNS[1], p))
      const strobe = still ? 0.45 : (Math.sin(clock * 75) > 0.1 ? 1 : 0.15) * (0.6 + 0.4 * Math.sin(clock * 9.0))
      for (let i = 0; i < 2; i++) {
        const f = gunsOn * (still ? 0.5 : (i ? strobe : 1.15 - strobe))
        muzzles[i].scale.set(Math.max(1e-4, f * 0.75), Math.max(1e-4, f * 0.75), 1)
        muzzles[i].material.rotation = clock * 31 + i
      }
      trU.uOn.value = gunsOn * (still ? 0.6 : 1)
      trU.uM.value.copy(bikeG.matrixWorld)
      // ---- glass and sparks: ages from p.
      shardU.uAge.value.set((p - BREAK[0]) * 70, (p - BREAK[1]) * 70)
      const broken = (p > BREAK[0] ? 1 : 0) + (p > BREAK[1] ? 2 : 0)
      if (broken !== paneState) {
        paneState = broken
        for (const pm of paneM) if (pm) paneMesh.setMatrixAt(pm.i, M.makeTranslation(ARC.x0, p > BREAK[paneBreak[pm.i]] ? -50 : 0, pm.z))
        paneMesh.instanceMatrix.needsUpdate = true
      }
      const ages = sparks.material.uniforms.uAge.value
      for (let i = 0; i < bursts.length; i++) ages[i] = (p - bursts[i].p) * bursts[i].k
      if (!still) ages[5] = gunsOn > 0.5 ? (clock * 1.7) % 1 * bursts[5].life : -1 // the barricade's hits, on the clock
      else ages[5] = -1

      // ---- the truck: along its lane, then over its nose and down on its roof (pivot rolling forward).
      truckZ = TRUCK(p, KT)[0]
      const fu = clamp01((p - FLIP[0]) / (FLIP[1] - FLIP[0]))
      const over = fu < 1 ? 0.5 * fu * fu * (3 - 2 * fu) + 0.5 * Math.pow(fu, 2.2) : 1
      const a = -PI * over + (fu >= 1 ? 0.06 * Math.exp(-(p - FLIP[1]) * 60) * Math.sin((p - FLIP[1]) * 400) : 0)
      const hp = TRUCK_H * ss(0.45, 0.85, over)
      tGroup.position.set(TRUCK_X, 0.3 * Math.sin(PI * over), truckZ - hp * 0.6)
      tGroup.rotation.set(a, 0, 0)
      tBody.position.set(0, -hp, 0)
      // The fireball: lit as it lands, growing and rising, burning on.
      const boom = ss(FLIP[1] - 0.004, FLIP[1] + 0.03, p)
      fireG[1].set(boom * (2.0 - 0.5 * ss(0.95, 1, p)), 0.3 + 0.9 * ss(FLIP[1], FLIP[1] + 0.05, p))
      fireGlow.scale.set(Math.max(1e-4, 36 * boom), Math.max(1e-4, 24 * boom), 1)
      smokeG[1].set(ss(FLIP[1], FLIP[1] + 0.03, p), 0.6 + 0.8 * ss(FLIP[1], 1, p))
      for (const f of tFlares) f.material.opacity = 1 - ss(FLIP[1] - 0.01, FLIP[1], p)

      shot(p, portrait, t, still)
      // The headlight flares as it swings toward the camera.
      const toCam = Math.max(0, tmp.set(0, 0, 1).applyQuaternion(bikeG.quaternion).dot(tmp2.copy(cam).sub(bikeAt).normalize()))
      const hf = 1.5 + 1.6 * toCam ** 8
      headFlare.scale.set(hf, hf / 2, 1)
      // ---- lights that move: the key over him, the headlight, the gun flash, the fireball, the fires.
      key.position.set(bikeAt.x + 2, 7, bikeAt.z + (p > 0.7 ? -6 : 6))
      key.intensity = 400
      key.target.position.set(bikeAt.x, 0.5, bikeAt.z)
      key.target.updateMatrixWorld()
      moon.position.copy(bikeAt).sub(cam).setY(0).normalize().multiplyScalar(40).add(bikeAt).setY(50)
      moon.target.position.copy(bikeAt)
      moon.target.updateMatrixWorld()
      flash.position.set(bikeAt.x, 1.2, bikeAt.z)
      const gunLight = gunsOn * (still ? 0.4 : strobe) * 14
      const fire = boom * (1.2 - 0.3 * ss(0.95, 1, p)) * (still ? 1 : 0.85 + 0.15 * Math.sin(clock * 17))
      if (fire > gunLight / 40) flash.position.set(TRUCK_X, 4, CRASH[2])
      flash.intensity = Math.max(gunLight, fire * 900)
      flash.distance = fire > 0 ? 80 : 30
      // The three fires nearest the camera light the scene.
      for (let i = 0; i < 3; i++) {
        let best = -1, bd = 1e9
        for (let j = 0; j < burning.length; j++) {
          const d = burning[j].distanceToSquared(cam) + (i > 0 && burning[j] === glow[0].userData.f ? 1e8 : 0) + (i > 1 && burning[j] === glow[1].userData.f ? 1e8 : 0)
          if (d < bd) { bd = d; best = j }
        }
        glow[i].userData.f = burning[best]
        glow[i].position.copy(burning[best])
        glow[i].intensity = (still ? 50 : 50 * (0.8 + 0.2 * Math.sin(clock * 13 + i * 2.1) + 0.1 * Math.sin(clock * 31 + i)))
      }
      // Behind the wall and the truck, fire: they stand dark against it. For the truck, on the line from
      // the camera through it, beyond it (and kept off the -x facade).
      const behind = ss(0.75, 0.8, p) * (1 - ss(0.9, 0.95, p))
      tmp2.set(TRUCK_X - cam.x, 0, truckZ - 3 - cam.z).normalize()
      const reach = Math.min(30, 6 / Math.max(0.05, -tmp2.x))
      backGlow.position.set(TRUCK_X + tmp2.x * reach, 8, truckZ - 3 + tmp2.z * reach)
      backGlow.scale.set(Math.max(1e-4, 30 * behind), Math.max(1e-4, 32 * behind), 1)
      if (p > 0.555 && p < FLIP[1]) {
        if (p < 0.72) glow[1].position.set(-12, 2.4, 270)
        else glow[1].position.set(TRUCK_X + tmp2.x * 7, 6, truckZ - 3 + tmp2.z * 7)
        glow[1].intensity = p < 0.72 ? 60 : 450
      }
      if (p > 0.612 && p < 0.72) {
        key.intensity = 140
        key.position.set(-6, 9.5, 259)
        key.target.position.copy(bikeAt)
        key.target.updateMatrixWorld()
      }
      // In the arcade one of them is its globes' warm light instead.
      if (p > 0.43 && p < 0.56) {
        glow[2].position.set(18, 4.5, Math.min(ARC.z1 - 4, Math.max(ARC.z0 + 4, bikeAt.z)))
        glow[2].color.setRGB(1, 0.78, 0.5)
        glow[2].intensity = 80
      } else glow[2].color.setRGB(1, 0.54, 0.23)
      // The flip: one of them a sodium key low on the truck's near side, lighting its side and underside as
      // it goes over, and a warm rim on its tractor.
      const lit = ss(0.765, 0.79, p) * (1 - ss(FLIP[1], FLIP[1] + 0.02, p))
      glow[2].distance = 26
      if (lit > 0) {
        glow[2].position.set(TRUCK_X + 4.5, 1.2, truckZ - 5)
        glow[2].color.setRGB(1, 0.6, 0.26)
        glow[2].intensity = 900 * lit
        glow[2].distance = 45
      }
      rimTruck.value.copy(FIRE).multiplyScalar(0.35 * lit)
      // His cowl and cape take the fire's warm rim at the wall and under the truck, so he stands off the bike.
      rimSuit.value.lerpColors(COOL, FIRE, Math.max(ss(0.6, 0.625, p) * (1 - ss(0.71, 0.725, p)), lit))

      // ---- moving reflections
      mz.set(0, 0.62, 1.3).applyMatrix4(bikeG.matrixWorld)
      setDyn(0, mz.x, Math.max(0.3, mz.y), mz.z, 0.3, 0.7, 0.66, 0.58)
      tmp2.set(0.27, 0.42, 1.4).applyMatrix4(bikeG.matrixWorld)
      setDyn(1, tmp2.x, 0.42, tmp2.z, 0.5, gunLight * 0.12, gunLight * 0.08, gunLight * 0.03)
      tmp2.set(-0.27, 0.42, 1.4).applyMatrix4(bikeG.matrixWorld)
      setDyn(2, tmp2.x, 0.42, tmp2.z, 0.5, gunLight * 0.12, gunLight * 0.08, gunLight * 0.03)
      const tl = 1 - ss(0.82, 0.835, p)
      setDyn(3, TRUCK_X + 0.85, 1, truckZ, 0.5, tl, tl * 0.85, tl * 0.6)
      setDyn(4, TRUCK_X - 0.85, 1, truckZ, 0.5, tl, tl * 0.85, tl * 0.6)
      setDyn(5, TRUCK_X, 5, CRASH[2] - 4, 4, fire * 2.5, fire * 1.0, fire * 0.25)
      refl.aL.needsUpdate = refl.aC.needsUpdate = true

      // ---- the camera: the shot (placed above, before the lights), with weight: a rumble, and jolts at
      // the glass, the wall and the crash.
      if (!still) {
        const jolt = Math.exp(-Math.abs(p - BREAK[0]) * 300) + Math.exp(-Math.abs(p - BREAK[1]) * 300) + 0.7 * Math.exp(-Math.abs(p - WALL[0]) * 300) + 1.6 * Math.exp(-Math.max(0, p - FLIP[1]) * 80) * (p > FLIP[1] ? 1 : 0)
        const rumble = 0.012 + 0.05 * jolt
        cam.x += Math.sin(t * 31) * rumble
        cam.y += Math.sin(t * 43 + 1.3) * rumble * 0.7
        look.x += Math.sin(t * 27 + 2.1) * rumble * 0.6
        look.y += Math.sin(t * 37 + 0.4) * rumble * 0.6
      }
      cam.y = Math.max(cam.y, 0.18)
      camera.fov = portrait && p >= 0.79 ? 46 : 40 // a phone's flip: a little wider, so the truck's whole arc fits
      camera.aspect = aspect
      camera.updateProjectionMatrix()
      camera.position.copy(cam)
      camera.lookAt(look)
      dome.position.copy(camera.position)

      out.dream = still ? 0 : 0.5 * boom * (1 - ss(0.93, 1, p)) + 0.2 * gunsOn * strobe
      grade.bloom = 0.9 + 0.6 * boom
      grade.threshold = 0.62 - 0.12 * boom
      return out
    }
  })()

  return { scene, camera, update: (state, t, aspect) => (run ? run(state, t, aspect) : frame(state, aspect)), get built() { return !!run } }
}
