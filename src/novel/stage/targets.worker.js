import { dust, galaxy, orbLines, shapeRings } from './targets.js'

// Builds every pixel target off the main thread; buffers are transferred back, not copied.
self.onmessage = ({ data: { n, shapes } }) => {
  const out = { galaxy: galaxy(n), orb: orbLines(n), dust: dust(n) }
  for (const key of shapes) out[key] = shapeRings(key, n)
  self.postMessage(out, Object.values(out).map(a => a.buffer))
}
