import * as THREE from 'three'

/*
 * The neon coast of Chapter Four, modelled the way 1980s Miami Beach actually looked: an Ocean Drive of
 * Art Deco hotels (symmetrical stucco facades, eyebrow ledges over every window row, a central fin
 * rising past a stepped parapet with its name in neon, rounded corner towers, porthole windows, café
 * awnings, neon tracing the cornice), a road, a palm-lined promenade, a beach with lifeguard huts and
 * the sea, at dusk. Physically based materials (CC0 Poly Haven stucco, asphalt, pavement and sand),
 * lit by the sky itself (a PMREM of it) and by the neon. Every name and sign is our own.
 *
 * `wrap(material)` lets the caller hang its wave on every material (see arcade.js).
 */
const TEX = '/cinema/arcade/tex/'

const PALETTES = [
  { wall: '#f7c9cf', trim: '#ffffff', accent: '#e9809a', neon: '#ff4fa3' },
  { wall: '#bfeee0', trim: '#fdfbf4', accent: '#4fbfa3', neon: '#3dffd8' },
  { wall: '#fde4b8', trim: '#ffffff', accent: '#f2a65a', neon: '#ffb83d' },
  { wall: '#dccff7', trim: '#fdfbff', accent: '#9b7fe0', neon: '#c46bff' },
  { wall: '#f9f6ee', trim: '#bfe7f2', accent: '#4fb0d6', neon: '#3dd6ff' },
  { wall: '#c9e8f7', trim: '#ffffff', accent: '#f08ab0', neon: '#ff5fb0' },
]
const NAMES = ['Solara', 'Miramar', 'Coral Bay', 'Paloma', 'Starlite', 'Azura', 'Neptune', 'Estrella', 'Laguna']

/** Box with UVs in metres (one texture tile per `tile` m on every face), so stucco never stretches. */
function box(w, h, d, tile = 3) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]] // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile)
    }
  return g
}

/** Neon lettering on a dark-transparent canvas: a glowing core and a soft halo, for an emissive plane. */
function neonTexture(text, color, { vertical = false, font = 'Caveat', weight = 700 } = {}) {
  const c = document.createElement('canvas')
  const W = vertical ? 256 : 1024, H = vertical ? 1024 : 256
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const draw = (blur, col, lw) => {
    g.shadowColor = color
    g.shadowBlur = blur
    g.fillStyle = col
    g.strokeStyle = col
    g.lineWidth = lw
    if (vertical) {
      const letters = text.toUpperCase().replace(/ /g, '').split('')
      const step = H / (letters.length + 1)
      g.font = `400 ${Math.min(step * 0.92, 180)}px Anton, Impact, sans-serif`
      letters.forEach((ch, i) => g.fillText(ch, W / 2, step * (i + 1)))
    } else {
      g.font = `${weight} ${H * 0.62}px "${font}", cursive`
      g.fillText(text, W / 2, H / 2)
    }
  }
  draw(40, color, 0)
  draw(12, '#ffffff', 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function stripes(a, b, n = 8) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 16
  const g = c.getContext('2d')
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? b : a
    g.fillRect((i * 256) / n, 0, 256 / n + 1, 16)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function buildOceanDrive(scene, { wrap = m => m, mobile = false } = {}) {
  const loader = new THREE.TextureLoader()
  const tex = (name, srgb, rep) => {
    const t = loader.load(TEX + name)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    if (rep) t.repeat.set(...rep)
    return t
  }
  const pbrSet = (name, rep) => ({ map: tex(`${name}_col.webp`, true, rep), normalMap: tex(`${name}_nor.webp`, false, rep), roughnessMap: tex(`${name}_rough.webp`, false, rep) })
  const stucco = pbrSet('stucco')
  const std = opts => wrap(new THREE.MeshStandardMaterial(opts))
  const glow = (color, k = 4) => wrap(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: true }))

  const signs = []
  const neonLights = []
  const updates = []
  const add = (o, parent = scene) => {
    o.traverse?.(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    parent.add(o)
    return o
  }

  // ------------------------------------------------------------ ground: sidewalk, road, promenade, lawn, beach
  const X0 = -24, X1 = 72, L = X1 - X0
  const strip = (z0, z1, mat, y = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, z1 - z0).rotateX(-Math.PI / 2), mat)
    m.position.set((X0 + X1) / 2, y, (z0 + z1) / 2)
    m.receiveShadow = true
    scene.add(m)
    return m
  }
  strip(-8.6, -6.2, std({ ...pbrSet('pavement', [L / 3, 1]), color: '#efe2dc' }), 0.12)
  const road = std({ ...pbrSet('asphalt', [L / 4, 1.2]), color: '#5c5868', roughness: 0.55 }) // damp at dusk
  strip(-6.2, -1.8, road)
  strip(-1.8, 1.8, std({ ...pbrSet('pavement', [L / 2.5, 1.4]), color: '#f6d9cf' }), 0.1)
  strip(1.8, 6.5, std({ color: '#86b062', roughness: 0.95 }), 0.05)
  strip(6.5, 26, std({ ...pbrSet('sand', [L / 4, 5]), color: '#f6dcae' }), 0.02)
  // Kerbs and lane marks.
  for (const z of [-6.2, -1.8]) {
    const k = new THREE.Mesh(box(L, 0.16, 0.25, 1), std({ color: '#d9d2cf', roughness: 0.8 }))
    k.position.set((X0 + X1) / 2, 0.08, z)
    scene.add(k)
  }
  for (let x = X0; x < X1; x += 4) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.13).rotateX(-Math.PI / 2), std({ color: '#f3e6a8', roughness: 0.6 }))
    d.position.set(x, 0.012, -4)
    scene.add(d)
  }

  // ------------------------------------------------------------ the hotels
  const FLOOR = 3.1
  function hotel(x, i) {
    const P = PALETTES[i % PALETTES.length]
    const floors = [3, 4, 3, 5, 3, 4, 3, 4, 3][i % 9]
    const w = [12, 10, 14, 11, 12, 13, 10, 12, 11][i % 9]
    const H = floors * FLOOR + 0.9
    const D = 12
    const g = new THREE.Group()
    g.position.set(x, 0, -8.6)
    const wall = std({ ...stucco, color: P.wall })
    const trim = std({ ...stucco, color: P.trim })
    const accent = std({ ...stucco, color: P.accent })
    const body = new THREE.Mesh(box(w, H, D), wall)
    body.position.set(0, H / 2, -D / 2)
    g.add(body)
    // Ground-floor base band and a raised entrance.
    const base = new THREE.Mesh(box(w + 0.1, 0.9, 0.3), accent)
    base.position.set(0, 0.45, 0.1)
    g.add(base)
    // Window rows with eyebrow ledges; some rooms are lit at dusk.
    const n = Math.max(3, Math.floor((w - 2.4) / 2.2))
    const glass = std({ color: '#2b3d4f', roughness: 0.08, metalness: 0.6 })
    const lit = std({ color: '#2b2a30', roughness: 0.2, metalness: 0.2, emissive: '#ffcf8a', emissiveIntensity: 0.9 })
    const finW = Math.max(1.6, w * 0.16)
    for (let f = 1; f < floors; f++) {
      const y = f * FLOOR + 1.1
      const brow = new THREE.Mesh(box(w + 0.3, 0.12, 0.7, 1), trim)
      brow.position.set(0, y + 1.0, 0.35)
      g.add(brow)
      for (let k = 0; k < n; k++) {
        const wx = -w / 2 + 1.4 + (k + 0.5) * ((w - 2.8) / n)
        if (Math.abs(wx) < finW / 2 + 0.5) continue // the fin runs up the middle
        const frame = new THREE.Mesh(box(1.5, 1.7, 0.1, 1), trim)
        frame.position.set(wx, y, 0.03)
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.45), (k * 7 + f * 3 + i) % 5 === 0 ? lit : glass)
        pane.position.set(wx, y, 0.085)
        g.add(frame, pane)
      }
    }
    // Ground floor: glass shopfront under a striped café awning, with a couple of porthole windows.
    // The shopfront: dark glass with a warm room behind it, split by slim mullions.
    const shopW = w * 0.62
    const shop = new THREE.Mesh(new THREE.PlaneGeometry(shopW, 2.1), std({ color: '#1d1b22', roughness: 0.12, metalness: 0.4, emissive: '#ff9f5a', emissiveIntensity: 0.28 }))
    shop.position.set(0, 1.9, 0.02)
    g.add(shop)
    for (let k = 0; k <= 4; k++) {
      const mull = new THREE.Mesh(box(0.08, 2.1, 0.08, 1), trim)
      mull.position.set(-shopW / 2 + (k * shopW) / 4, 1.9, 0.06)
      g.add(mull)
    }
    const awn = new THREE.Mesh(box(w * 0.7, 0.08, 1.8, 1), std({ map: stripes(P.accent, '#ffffff', Math.round(w)), roughness: 0.8 }))
    awn.position.set(0, 3.15, 0.95)
    awn.rotation.x = 0.18
    g.add(awn)
    for (const s of [-1, 1]) {
      const port = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 28).rotateX(Math.PI / 2), trim)
      port.position.set(s * (w / 2 - 1.4), 1.9, 0.06)
      const pg = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), glass)
      pg.position.set(s * (w / 2 - 1.4), 1.9, 0.13)
      g.add(port, pg)
    }
    // The fin: up the middle and past the roof, with the hotel's name stacked in neon.
    const finH = H + 3.6
    const fin = new THREE.Mesh(box(finW, finH, 1.0), accent)
    fin.position.set(0, finH / 2, 0.5)
    g.add(fin)
    const name = NAMES[i % NAMES.length]
    const vsign = new THREE.Mesh(new THREE.PlaneGeometry(finW * 0.8, finH * 0.62), wrap(new THREE.MeshBasicMaterial({ map: neonTexture(name, P.neon, { vertical: true }), transparent: true, depthWrite: false, color: new THREE.Color(2.6, 2.6, 2.6) })))
    vsign.position.set(0, finH * 0.6, 1.02)
    g.add(vsign)
    // A stepped parapet either side of the fin, and neon tracing the cornice.
    for (const [sw, sh] of [[w * 0.62, 0.7], [w * 0.36, 1.5]]) {
      const step = new THREE.Mesh(box(sw, sh, 2.2), trim)
      step.position.set(0, H + sh / 2, -1.1)
      g.add(step)
    }
    const tube = (len, y, z = 0.12) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), glow(P.neon, 5))
      t.position.set(0, y, z)
      g.add(t)
    }
    tube(w, H - 0.25)
    tube(w * 0.7, 3.32, 1.0)
    // Rounded corner towers on the larger hotels, with banded windows.
    if (w >= 12) {
      for (const s of [-1, 1]) {
        const r = 1.6
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 40), wall)
        cyl.position.set(s * (w / 2 - r * 0.7), H / 2, 0.2 - r * 0.6)
        g.add(cyl)
        for (let f = 1; f < floors; f++) {
          const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.9, 40, 1, true, s > 0 ? -0.2 : Math.PI * 0.2, Math.PI * 1.0), glass)
          band.position.set(s * (w / 2 - r * 0.7), f * FLOOR + 1.1, 0.2 - r * 0.6)
          const brow = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.35, r + 0.35, 0.1, 40), trim)
          brow.position.set(s * (w / 2 - r * 0.7), f * FLOOR + 2.1, 0.2 - r * 0.6)
          g.add(band, brow)
        }
      }
    }
    // A script sign over the awning.
    const script = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, w * 0.125), wrap(new THREE.MeshBasicMaterial({ map: neonTexture(name, P.neon), transparent: true, depthWrite: false, color: new THREE.Color(2.4, 2.4, 2.4) })))
    script.position.set(0, 3.9, 1.6)
    g.add(script)
    signs.push(vsign, script)
    add(g)
    // Neon spill onto the facade and the street.
    neonLights.push({ x, color: P.neon, y: finH * 0.6 })
    return g
  }
  const hotels = []
  let hx = -18
  for (let i = 0; i < 9; i++) {
    const w = [12, 10, 14, 11, 12, 13, 10, 12, 11][i % 9]
    hotel(hx + w / 2, i)
    hotels.push({ x: hx + w / 2, w, floors: [3, 4, 3, 5, 3, 4, 3, 4, 3][i % 9] })
    hx += w + 1.2
  }
  // A handful of real lights for the neon (the rest is bloom): the nearest few to where you walk.
  const pool = Array.from({ length: mobile ? 3 : 6 }, () => {
    const l = new THREE.PointLight('#ffffff', 0, 14, 1.6)
    scene.add(l)
    return l
  })

  // ------------------------------------------------------------ the promenade: lamps, palms' places
  const lampMat = std({ color: '#e9e4f0', roughness: 0.4, metalness: 0.6 })
  for (let x = -20; x < 70; x += 8) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.2, 10), lampMat)
    pole.position.set(x, 2.1, -1.55)
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), glow('#ffe2b3', 3))
    globe.position.set(x, 4.35, -1.55)
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.25, 16), lampMat)
    cap.position.set(x, 4.66, -1.55)
    add(pole); add(globe); add(cap)
  }
  // Lifeguard huts on the sand, in the beach's own pastel stripes.
  for (const [x, c] of [[4, '#ff9fc4'], [30, '#8fe3d0'], [52, '#ffd27f']]) {
    const hut = new THREE.Group()
    const cabin = new THREE.Mesh(box(2.6, 2.0, 2.2, 1), std({ map: stripes(c, '#ffffff', 6), roughness: 0.7 }))
    cabin.position.y = 2.6
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.9, 4).rotateY(Math.PI / 4), std({ color: c, roughness: 0.6 }))
    roof.position.y = 4.05
    const deck = new THREE.Mesh(box(3.4, 0.12, 3.0, 1), std({ color: '#f4efe6', roughness: 0.8 }))
    deck.position.y = 1.55
    hut.add(cabin, roof, deck)
    for (const [sx, sz] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8), std({ color: '#efe9df' }))
      leg.position.set(sx, 0.8, sz)
      hut.add(leg)
    }
    hut.position.set(x, 0, 14)
    hut.rotation.y = -0.3
    add(hut)
  }
  // Neon on the wet road: long soft streaks under each fin.
  const streak = (() => {
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 256
    const g = c.getContext('2d')
    const gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, 'rgba(255,255,255,0.9)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 32, 256)
    return new THREE.CanvasTexture(c)
  })()
  for (const n of neonLights) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4.2).rotateX(-Math.PI / 2), wrap(new THREE.MeshBasicMaterial({ map: streak, color: new THREE.Color(n.color).multiplyScalar(0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })))
    s.position.set(n.x, 0.02, -4.5)
    scene.add(s)
  }

  function update(t, walkerX) {
    // Move the real neon lights to the hotels nearest the walker.
    const near = [...neonLights].sort((a, b) => Math.abs(a.x - walkerX) - Math.abs(b.x - walkerX)).slice(0, pool.length)
    pool.forEach((l, k) => {
      const n = near[k]
      if (!n) return
      l.color.set(n.color)
      l.intensity = 30 * (0.92 + 0.08 * Math.sin(t * 13 + k * 2)) // a slight neon buzz
      l.position.set(n.x, Math.min(n.y, 9), -6.6)
    })
    updates.forEach(f => f(t))
  }

  return { signs, hotels, update }
}

/** A dusk sky (deep blue overhead, violet, a peach-orange horizon, a low sun and lit clouds); `uDay` turns it to clear day. */
export function duskSky(U) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(300, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: { uDay: U.uDay },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = (projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0)).xyww; }',
      fragmentShader: /* glsl */ `
        uniform float uDay; varying vec3 vDir;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p) { float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += vnoise(p) * w; p *= 2.03; w *= 0.5; } return a; }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 sunDir = normalize(vec3(1.0, 0.035, -0.55));
          float sd = max(dot(d, sunDir), 0.0);
          vec3 dusk = mix(vec3(1.0, 0.62, 0.38), vec3(0.96, 0.42, 0.52), smoothstep(-0.02, 0.1, h));
          dusk = mix(dusk, vec3(0.44, 0.27, 0.62), smoothstep(0.08, 0.3, h));
          dusk = mix(dusk, vec3(0.09, 0.11, 0.3), smoothstep(0.3, 0.8, h));
          dusk += vec3(1.0, 0.65, 0.35) * pow(sd, 8.0) * 0.6 + vec3(1.0, 0.9, 0.7) * smoothstep(0.9985, 0.9993, sd) * 3.0;
          // Clouds: streaks of lit cirrus in the low sky, pink on the sun side.
          vec2 cp = d.xz / max(h + 0.12, 0.05) * 1.4;
          float cl = smoothstep(0.52, 0.8, fbm(cp * vec2(0.6, 1.8) + 3.0)) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.45, 0.7, h));
          vec3 cloudCol = mix(vec3(0.55, 0.3, 0.55), vec3(1.0, 0.62, 0.55), pow(sd, 2.0));
          dusk = mix(dusk, cloudCol, cl * 0.8);
          vec3 day = mix(vec3(0.78, 0.9, 1.0), vec3(0.3, 0.58, 0.98), smoothstep(0.0, 0.5, h));
          day = mix(day, vec3(1.0), smoothstep(0.55, 0.78, fbm(cp * 0.8 + 9.0)) * smoothstep(0.03, 0.2, h) * 0.85);
          gl_FragColor = vec4(mix(dusk, day, uDay), 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  )
}
