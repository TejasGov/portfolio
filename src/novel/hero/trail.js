/*
 * The first frame's pointer effect. The pointer is the projector beam: cells on a fixed grid light where it
 * passes and cool on their own clocks. A cell's energy picks its glyph (thin marks, and at the head a letter
 * of the name); the hottest few are inverse video (a solid ink cell, the letter knocked out). The ink changes
 * every BAND px of travel, so colour arrives in bands along the path, not as confetti.
 *
 * Cost: only live cells are stored and drawn, and the loop stops when none are left (no frames at idle).
 * Cells under text ([data-quiet]) never light; the name's letters ([data-ink]) take the
 * current ink for a moment instead. Reduced motion: nothing is drawn and nothing answers the pointer; the
 * billing block's three ink pixels (index.css) are the colour at rest.
 */
let CW = 14, CH = 20 // the grid, CSS px; 18 x 26 from 1280 px wide (setup), so it holds up beside the title
const RAMP = ':+*x' // thin → dense (no dots or dashes: they read as specks or a streak)
const NAME = 'TEJASGOVIND' // the dense end of the ramp: only the head of the trail spells
const LAMP = '#fff4dc' // fresh light, before it splits
const DARK = '#050506'
const SCREEN = '#f4efe6' // the title's own white (index.css .hero --screen), where a tinted letter returns
const INKS = ['#ffb23e', '#ff4f36', '#2ec4c6', '#6f7dff'] // amber, vermilion, teal, blue: flat inks
const BAND = 250 // px of travel per ink: a sweep carries two or three
const mix = (a, b, s) => '#' + [1, 3, 5].map(k => Math.round(parseInt(a.slice(k, k + 2), 16) * s + parseInt(b.slice(k, k + 2), 16) * (1 - s)).toString(16).padStart(2, '0')).join('')
const CAP = 300 // live cells; past it the tail cools faster, so a fast sweep stays a trail
const GAP_MS = 120, GAP_PX = 420 // no line is drawn across a pause or a jump (re-entering the window)

// Deterministic per-cell noise: a cell keeps its threshold, its pace and its letter.
const hash = n => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const ease = u => u * u * (3 - 2 * u)

/** Start the effect on `canvas`, which fills `hero`. Returns a stop function. */
export function startTrail(hero, canvas) {
  const ctx = canvas.getContext('2d')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const touch = matchMedia('(hover: none)')
  const on = () => hero.dataset.on === '1' // lib/Beats: the first frame is on screen

  let W = 0, H = 0, cols = 0, rows = 0
  let e, rate, ink, quiet, thr, isLive, live = []
  let raf = 0, last = 0, lx = null, ly = 0, lt = 0, travel = 0, cur = 0
  let letters = [] // the surname's letters and their boxes
  let script = null // the one scripted pass after load
  let dirty = null // last frame's painted box, so only that is cleared
  let frames = 0

  const box = (el, r, pad) => {
    const q = el.getBoundingClientRect()
    return { el, x0: q.left - r.left - pad, x1: q.right - r.left + pad, y0: q.top - r.top - pad, y1: q.bottom - r.top + pad, at: 0, ink: -1 }
  }

  function setup() {
    cancelAnimationFrame(raf)
    raf = 0
    const r = hero.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2)
    W = r.width
    H = r.height
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ;[CW, CH] = W >= 1280 ? [18, 26] : [14, 20]
    ctx.font = `600 ${CW}px "Geist Mono Variable", ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    cols = Math.ceil(W / CW)
    rows = Math.ceil(H / CH)
    const n = cols * rows
    e = new Float32Array(n)
    rate = new Float32Array(n)
    thr = new Float32Array(n)
    ink = new Uint8Array(n)
    quiet = new Uint8Array(n)
    isLive = new Uint8Array(n)
    live = []
    lx = dirty = null
    for (let i = 0; i < n; i++) {
      rate[i] = 0.69 + 0.36 * hash(i) // each cell cools at its own pace: 0.95–1.45 s
      thr[i] = 0.12 + 0.9 * hash(i + 104729) // its threshold: the rim thins to single scattered glyphs
    }
    for (const el of hero.querySelectorAll('[data-quiet]')) {
      const q = box(el, r, 7)
      const c1 = Math.min(cols - 1, Math.floor(q.x1 / CW)), r1 = Math.min(rows - 1, Math.floor(q.y1 / CH))
      for (let y = Math.max(0, Math.floor(q.y0 / CH)); y <= r1; y++) for (let x = Math.max(0, Math.floor(q.x0 / CW)); x <= c1; x++) quiet[y * cols + x] = 1
    }
    letters = [...hero.querySelectorAll('[data-ink]')].map(el => ({ ...box(el, r, 12), light: el.dataset.ink === 'light' }))
  }

  function stamp(px, py, r, power) {
    const c1 = Math.min(cols - 1, Math.floor((px + r) / CW)), r1 = Math.min(rows - 1, Math.floor((py + r) / CH))
    for (let y = Math.max(0, Math.floor((py - r) / CH)); y <= r1; y++) {
      for (let x = Math.max(0, Math.floor((px - r) / CW)); x <= c1; x++) {
        const i = y * cols + x
        const f = 1 - Math.hypot((x + 0.5) * CW - px, (y + 0.5) * CH - py) / r
        if (f <= thr[i] || quiet[i]) continue
        const v = power * (0.45 + 0.55 * f)
        if (v > e[i]) {
          e[i] = v
          ink[i] = cur
        }
        if (!isLive[i]) {
          isLive[i] = 1
          live.push(i)
        }
      }
    }
  }

  // The name answers the beam: the letter it crosses takes the current ink, its two or three neighbours a
  // falling share of it (Tejas, the light word, less), then all cool back to white.
  function tint(x, y, now) {
    for (const l of letters) {
      if (y < l.y0 || y > l.y1) continue
      const w = l.x1 - l.x0, dx = Math.max(0, l.x0 - x, x - l.x1)
      const s = Math.max(0, 1 - dx / (2.6 * w)) * (l.light ? 0.6 : 1)
      if (s < 0.15 || (l.ink === cur && now - l.at < 320 && s <= l.s + 0.1)) continue
      l.at = now
      l.ink = cur
      l.s = s
      const c = mix(INKS[cur], SCREEN, s)
      // 100 ms in (from whatever it shows now: no snap), held, then a short cut to white
      l.el.animate([{ color: c, offset: 0.13 }, { color: c, offset: 0.7 }, { color: SCREEN }], { duration: 780 })
    }
  }

  // Every move lights the cells along the segment the beam travelled.
  function beam(x, y, now, power = 1) {
    if (lx === null || now - lt > GAP_MS || Math.hypot(x - lx, y - ly) > GAP_PX) {
      lx = x
      ly = y
    }
    const dx = x - lx, dy = y - ly, d = Math.hypot(dx, dy)
    travel += d
    while (travel > BAND) {
      travel -= BAND
      cur = (cur + 1) % INKS.length
    }
    const r = (24 + Math.min(14, d * 0.35)) * (CW / 14), n = Math.max(1, Math.ceil(d / 10)) // scaled with the cells
    for (let k = 1; k <= n; k++) stamp(lx + (dx * k) / n, ly + (dy * k) / n, r, power)
    tint(x, y, now)
    lx = x
    ly = y
    lt = now
  }

  function draw() {
    if (dirty) ctx.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1])
    if (!live.length) return (dirty = null)
    let x0 = W, y0 = H, x1 = 0, y1 = 0
    for (let k = 0; k < live.length; k++) {
      const i = live[k], v = e[i], x = (i % cols) * CW, y = ((i / cols) | 0) * CH
      const letter = NAME[(thr[i] * 977) % NAME.length | 0]
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
      if (v > 0.85 || (v > 0.7 && rate[i] < 0.79)) {
        // the head of the trail (all of its hottest cells, some of the next): inverse video
        ctx.globalAlpha = 1
        ctx.fillStyle = INKS[ink[i]]
        ctx.fillRect(x, y, CW - 1, CH - 1)
        ctx.fillStyle = DARK
        ctx.fillText(letter, x + CW / 2 - 0.5, y + CH / 2)
        continue
      }
      ctx.globalAlpha = Math.min(1, v * 1.7)
      ctx.fillStyle = v > 0.9 ? LAMP : INKS[ink[i]]
      // a cell's own offset on the ramp, so a row of equal energy is not a row of one glyph
      ctx.fillText(v > 0.8 ? letter : RAMP[Math.max(0, Math.min(RAMP.length - 1, ((v / 0.8) * RAMP.length + thr[i] * 3.2 - 2.2) | 0))], x + CW / 2 - 0.5, y + CH / 2)
    }
    ctx.globalAlpha = 1
    dirty = [x0 - 1, y0 - 1, x1 + CW + 1, y1 + CH + 1]
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000)
    last = t
    frames++
    if (import.meta.env.DEV) canvas.dataset.frames = frames // for measuring: it must not grow at idle
    if (script) {
      const u = (t - script.t0) / script.dur
      if (u >= 1 || !on()) script = lx = null
      else if (u > 0) {
        const [x, y] = script.at(ease(u))
        beam(x, y, t, script.power)
        if (script.row) tint(x, script.row, t) // the pass runs just over the letters: light them as if it touched
      }
    }
    const hurry = live.length > CAP ? 1 + (4 * (live.length - CAP)) / CAP : 1
    let w = 0
    for (let k = 0; k < live.length; k++) {
      const i = live[k]
      e[i] -= dt * rate[i] * hurry
      if (e[i] > 0.03) live[w++] = i
      else e[i] = isLive[i] = 0
    }
    live.length = w
    draw()
    raf = live.length || script ? requestAnimationFrame(frame) : 0 // nothing alive: the loop stops
  }
  function kick() {
    if (raf || reduce.matches) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  // Once per visit, after load: one short pass, so the effect is seen to exist. With a mouse it grazes the
  // top of the surname (the letters warm in turn); on touch it drifts once through the dark above the
  // reels. Any real touch ends it for good.
  function intro() {
    if (reduce.matches || !on() || !letters.length) return
    try {
      if (sessionStorage.getItem('lamp-struck')) return
      sessionStorage.setItem('lamp-struck', '1')
    } catch {
      /* private mode: play it */
    }
    const heavy = letters.filter(l => !l.light)
    const a = heavy[0], z = heavy[heavy.length - 1]
    script = touch.matches
      ? { t0: performance.now(), dur: 2400, power: 0.9, at: u => [W * (0.16 + 0.68 * u), H * (0.19 - 0.04 * Math.sin(Math.PI * u))] }
      : { t0: performance.now(), dur: 700, power: 1, row: a.y0 + 20, at: u => [a.x0 + (z.x1 - a.x0) * u, a.y0 - 2 - 16 * Math.sin(Math.PI * u)] }
    lx = null
    kick()
  }

  const move = (x, y, t) => {
    if (reduce.matches || !on()) return
    beam(x, y, t) // the hero is pinned at the viewport's origin while it is on
    kick()
  }
  const onPointer = ev => ev.pointerType !== 'touch' && move(ev.clientX, ev.clientY, ev.timeStamp)
  const onTouch = ev => {
    if (script) script = lx = null
    if (ev.type === 'touchstart') lx = null
    move(ev.touches[0].clientX, ev.touches[0].clientY, ev.timeStamp)
  }
  const lift = () => (lx = null)
  const passive = { passive: true }
  addEventListener('pointermove', onPointer, passive)
  addEventListener('touchstart', onTouch, passive)
  addEventListener('touchmove', onTouch, passive)
  document.documentElement.addEventListener('pointerleave', lift)
  reduce.addEventListener('change', setup)

  let timer = 0, later = 0, stopped = false
  const ro = new ResizeObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(setup, 120)
  })
  ro.observe(hero)
  setup()
  // Fonts move the text boxes; the pass waits for them and for the 3D to have had its first frames
  // (Stage sets its canvas's opacity to 1 once createCinema's main-thread work is done). No WebGL: ~8 s.
  const lit = () => [...document.querySelectorAll('canvas')].some(c => c.style.opacity === '1')
  let tries = 0
  const wait = () => {
    if (stopped) return
    if (lit() || ++tries > 32) later = setTimeout(intro, 900)
    else later = setTimeout(wait, 250)
  }
  ;(document.fonts?.ready ?? Promise.resolve()).then(() => {
    if (stopped) return
    setup()
    wait()
  })

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    clearTimeout(timer)
    clearTimeout(later)
    ro.disconnect()
    removeEventListener('pointermove', onPointer)
    removeEventListener('touchstart', onTouch)
    removeEventListener('touchmove', onTouch)
    document.documentElement.removeEventListener('pointerleave', lift)
    reduce.removeEventListener('change', setup)
  }
}
