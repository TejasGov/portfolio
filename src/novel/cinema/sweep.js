/*
 * The pixel sweep: night → paper as a moving front of small pixels, with coarser blocks consolidating
 * behind it. Driven by a progress value (so scrolling back runs it in reverse) and by time (so the
 * front keeps flickering while you pause mid-sweep).
 */
const PAPER = [239, 232, 218]
const FLASH = [226, 238, 255]
const SIZES = [8, 16, 32, 64, 128]
const LAG = [0, 0.045, 0.09, 0.15, 0.22]

export function createPixelSweep(canvas, { origin = [0.5, 0.42] } = {}) {
  const ctx = canvas.getContext('2d')
  let W = 0, H = 0, levels = []

  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return s - Math.floor(s)
  }

  function resize() {
    W = canvas.width = Math.ceil(innerWidth / 8) * 8
    H = canvas.height = Math.ceil(innerHeight / 8) * 8
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    const ox = origin[0] * W, oy = origin[1] * H
    const maxD = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy))
    // Finest level: threshold = distance from the origin, roughened so the front is ragged.
    const cols0 = W / 8, rows0 = H / 8
    const th0 = new Float32Array(cols0 * rows0)
    for (let y = 0; y < rows0; y++)
      for (let x = 0; x < cols0; x++) {
        const d = Math.hypot(x * 8 + 4 - ox, y * 8 + 4 - oy) / maxD
        const blob = hash(Math.floor(x / 6), Math.floor(y / 6))
        th0[y * cols0 + x] = d * 0.72 + blob * 0.16 + hash(x, y) * 0.12
      }
    levels = [{ cols: cols0, rows: rows0, th: th0, tone: tones(cols0 * rows0) }]
    // Each coarser block opens only once every fine cell inside it has (its max threshold).
    for (let l = 1; l < SIZES.length; l++) {
      const prev = levels[l - 1]
      const cols = Math.ceil(prev.cols / 2), rows = Math.ceil(prev.rows / 2)
      const th = new Float32Array(cols * rows)
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          let m = 0
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++) {
              const px = x * 2 + dx, py = y * 2 + dy
              if (px < prev.cols && py < prev.rows) m = Math.max(m, prev.th[py * prev.cols + px])
            }
          th[y * cols + x] = m
        }
      levels.push({ cols, rows, th, tone: tones(cols * rows) })
    }
  }

  // Paper isn't flat: every block gets its own faint tone.
  function tones(n) {
    const t = new Array(n)
    for (let i = 0; i < n; i++) {
      const k = (Math.random() - 0.5) * 6
      t[i] = `rgb(${PAPER[0] + k},${PAPER[1] + k},${PAPER[2] + k * 0.8})`
    }
    return t
  }

  function visit(l, x, y, p, time) {
    const L = levels[l]
    if (x >= L.cols || y >= L.rows) return
    const i = y * L.cols + x
    const s = SIZES[l]
    if (L.th[i] + LAG[l] <= p) {
      ctx.fillStyle = L.tone[i]
      ctx.fillRect(x * s, y * s, s, s)
      return
    }
    if (l === 0) {
      const age = p - L.th[i]
      if (age < 0) return
      // Fresh pixels flash light before they settle to paper; a few keep twinkling at the front.
      const fresh = 1 - Math.min(1, age / 0.06)
      const tw = age < 0.05 && hash(x + Math.floor(time * 9), y) > 0.7 ? 0.6 : 0
      const c = PAPER.map((v, j) => Math.round(v + (FLASH[j] - v) * Math.max(fresh, tw)))
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`
      ctx.fillRect(x * s, y * s, s, s)
      return
    }
    visit(l - 1, x * 2, y * 2, p, time)
    visit(l - 1, x * 2 + 1, y * 2, p, time)
    visit(l - 1, x * 2, y * 2 + 1, p, time)
    visit(l - 1, x * 2 + 1, y * 2 + 1, p, time)
  }

  let last = -1
  function draw(p, time) {
    if (p <= 0) {
      if (last !== 0) ctx.clearRect(0, 0, W, H)
      last = 0
      canvas.style.visibility = 'hidden'
      return
    }
    canvas.style.visibility = 'visible'
    if (p >= 1.25) {
      if (last !== 2) {
        ctx.fillStyle = `rgb(${PAPER})`
        ctx.fillRect(0, 0, W, H)
      }
      last = 2
      return
    }
    last = 1
    ctx.clearRect(0, 0, W, H)
    const top = levels.length - 1
    const T = levels[top]
    for (let y = 0; y < T.rows; y++) for (let x = 0; x < T.cols; x++) visit(top, x, y, p, time)
  }

  resize()
  addEventListener('resize', resize)
  return { draw }
}
