/*
 * The landing's sound, synthesized live (no files), on only while the site's sound is (browsers allow audio only
 * after a gesture): a night bed of low wind and a slow, breathing drone; on entering, a rising swell; while the stars
 * fall into the bust, a scatter of glass-like glints; as each letter lands, a soft low thud.
 */
let ctx = null, master = null, on = false

function noise(seconds, brown) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const d = b.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    d[i] = brown ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w
  }
  return b
}

function bed() {
  // Wind: brown noise through a low, slowly wandering filter.
  const wind = ctx.createBufferSource()
  wind.buffer = noise(6, true)
  wind.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 380
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain()
  lfo.frequency.value = 0.07
  lfoGain.gain.value = 160
  lfo.connect(lfoGain).connect(lp.frequency)
  const g = ctx.createGain()
  g.gain.value = 0.07
  wind.connect(lp).connect(g).connect(master)
  wind.start()
  lfo.start()
  // The drone: two low sines a fifth apart, breathing.
  for (const [f, a] of [[55, 0.03], [82.4, 0.018]]) {
    const o = ctx.createOscillator(), og = ctx.createGain(), br = ctx.createOscillator(), brg = ctx.createGain()
    o.frequency.value = f
    og.gain.value = a
    br.frequency.value = 0.11 + Math.random() * 0.05
    brg.gain.value = a * 0.6
    br.connect(brg).connect(og.gain)
    o.connect(og).connect(master)
    o.start()
    br.start()
  }
}

function ensure() {
  if (ctx) return ctx.resume()
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)
  bed()
}

const at = delay => ctx.currentTime + Math.max(0, delay)

export const sfx = {
  get on() { return on },
  /** Follow the site's sound switch (lib/sound.js). */
  set(next) {
    on = !!next
    if (on) ensure()
    if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.25)
  },
  /** Entering: a swell of filtered air and a deep tone rising under the light wave. */
  swell(delay = 0) {
    if (!on) return
    const t = at(delay)
    const src = ctx.createBufferSource()
    src.buffer = noise(5, false)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.8
    bp.frequency.setValueAtTime(180, t)
    bp.frequency.exponentialRampToValueAtTime(2400, t + 3.2)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.12, t + 2.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.8)
    src.connect(bp).connect(g).connect(master)
    src.start(t)
    src.stop(t + 5)
    const o = ctx.createOscillator(), og = ctx.createGain()
    o.frequency.setValueAtTime(41, t)
    o.frequency.exponentialRampToValueAtTime(55, t + 3.5)
    og.gain.setValueAtTime(0, t)
    og.gain.linearRampToValueAtTime(0.16, t + 2.5)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 6)
    o.connect(og).connect(master)
    o.start(t)
    o.stop(t + 6.2)
  },
  /** The stars falling in: glints scattered over `span` seconds, brightest in the middle. */
  glints(delay, span) {
    if (!on) return
    for (let i = 0; i < 42; i++) {
      const u = Math.random(), t = at(delay + u * span)
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 1200 + Math.random() * 2600
      const peak = 0.018 * Math.sin(Math.PI * u) + 0.004
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6 + Math.random() * 0.8)
      o.connect(g).connect(master)
      o.start(t)
      o.stop(t + 1.6)
    }
  },
  /** A letter landing: a soft low thud with a little grit; the first is the deepest. */
  thud(delay, first) {
    if (!on) return
    const t = at(delay)
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.frequency.setValueAtTime(first ? 70 : 95, t)
    o.frequency.exponentialRampToValueAtTime(first ? 34 : 48, t + 0.25)
    g.gain.setValueAtTime(first ? 0.4 : 0.18, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + (first ? 0.9 : 0.35))
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 1)
    const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain()
    src.buffer = noise(0.2, false)
    hp.type = 'highpass'
    hp.frequency.value = 2500
    ng.gain.setValueAtTime(0.05, t)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    src.connect(hp).connect(ng).connect(master)
    src.start(t)
  },
}
