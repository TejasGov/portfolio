/*
 * The score: original cues, synthesized live in Web Audio (no recordings, no samples). Each cue is written here
 * note by note in the manner of a film genre: a dance-pop groove, a swinging heroic fanfare, an ensemble march,
 * a spy ostinato in five, a dark pulse. None quotes a film's theme: the melodies, progressions and rhythms are
 * this file's own. audition.html plays every cue; sound.js plays the dance's in step with the routine.
 *
 *   playCue(ctx, out, cue, from) -> { t, stop(fade) }   plays `cue` into `out` from `from` seconds in; `t` is
 *                                                       the cue's own time now (for keeping it in step).
 * A cue: { bpm, beats, loop, gain, events: [{ b, i, n, d, v }] } (beat, instrument, midi note(s), beats, 0..1).
 * The scheduler looks 150 ms ahead every 25 ms, so a tab in the background never drops notes it has queued.
 */
const hz = n => 440 * 2 ** ((n - 69) / 12)
const cache = new WeakMap()

/** Per-context shared parts: white noise and a hall reverb (decaying noise as its impulse). */
function shared(ctx) {
  let s = cache.get(ctx)
  if (s) return s
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  noise.getChannelData(0).forEach((_, i, a) => (a[i] = Math.random() * 2 - 1))
  const len = Math.floor(ctx.sampleRate * 2.2)
  const ir = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  }
  s = { noise, ir }
  cache.set(ctx, s)
  return s
}

// ------------------------------------------------------------------ the instruments: (ctx, out, at, note, dur, vel)
function osc(ctx, type, f, at, end, detune = 0) {
  const o = new OscillatorNode(ctx, { type, frequency: f, detune })
  o.start(at)
  o.stop(end)
  return o
}
function amp(ctx, at, peak, attack, hold, release) {
  const g = new GainNode(ctx, { gain: 0 })
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(peak, at + attack)
  g.gain.setValueAtTime(peak, at + attack + hold)
  g.gain.exponentialRampToValueAtTime(1e-4, at + attack + hold + release)
  return g
}
function noise(ctx, at, dur) {
  const s = new AudioBufferSourceNode(ctx, { buffer: shared(ctx).noise, loop: true })
  s.start(at, Math.random() * 0.5)
  s.stop(at + dur)
  return s
}
const chain = (...n) => n.reduce((a, b) => (a.connect(b), b))
const notes = n => (Array.isArray(n) ? n : [n])

const INST = {
  kick(ctx, out, at, _n, _d, v) {
    const o = osc(ctx, 'sine', 150, at, at + 0.5)
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12)
    chain(o, amp(ctx, at, v, 0.002, 0.02, 0.34), out)
  },
  snare(ctx, out, at, _n, _d, v) {
    chain(noise(ctx, at, 0.3), new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 1900, Q: 0.7 }), amp(ctx, at, v * 0.7, 0.001, 0.01, 0.16), out)
    chain(osc(ctx, 'triangle', 185, at, at + 0.2), amp(ctx, at, v * 0.4, 0.001, 0, 0.09), out)
  },
  clap(ctx, out, at, _n, _d, v) {
    for (const k of [0, 0.011, 0.023]) chain(noise(ctx, at + k, 0.25), new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 1300, Q: 1.2 }), amp(ctx, at + k, v * 0.55, 0.001, 0, k < 0.02 ? 0.03 : 0.17), out)
  },
  hat(ctx, out, at, open, _d, v) {
    chain(noise(ctx, at, 0.4), new BiquadFilterNode(ctx, { type: 'highpass', frequency: 7500 }), amp(ctx, at, v * 0.22, 0.001, 0, open ? 0.22 : 0.045), out)
  },
  roll(ctx, out, at, _n, d, v) { // a snare roll (a march's, or a build), as fast strokes swelling
    const spb = d / 12
    for (let k = 0; k < 12; k++) INST.snare(ctx, out, at + k * spb, 0, 0, v * (0.25 + 0.75 * (k / 11) ** 1.5))
  },
  timp(ctx, out, at, n, _d, v) {
    const o = osc(ctx, 'sine', hz(n) * 1.12, at, at + 1.6)
    o.frequency.exponentialRampToValueAtTime(hz(n), at + 0.08)
    chain(o, amp(ctx, at, v, 0.004, 0.05, 1.3), out)
    chain(noise(ctx, at, 0.2), new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 380 }), amp(ctx, at, v * 0.5, 0.002, 0, 0.12), out)
  },
  bongo(ctx, out, at, n, _d, v) {
    const o = osc(ctx, 'sine', n, at, at + 0.25)
    o.frequency.exponentialRampToValueAtTime(n * 0.82, at + 0.06)
    chain(o, amp(ctx, at, v * 0.6, 0.001, 0, 0.13), out)
  },
  bass(ctx, out, at, n, d, v) {
    const f = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 4, frequency: 260 })
    f.frequency.setValueAtTime(1400, at)
    f.frequency.exponentialRampToValueAtTime(260, at + 0.16)
    const g = amp(ctx, at, v * 0.5, 0.004, Math.max(0, d - 0.06), 0.06)
    for (const n2 of notes(n)) {
      osc(ctx, 'sawtooth', hz(n2), at, at + d + 0.1).connect(f)
      osc(ctx, 'square', hz(n2 - 12), at, at + d + 0.1).connect(f)
    }
    chain(f, g, out)
  },
  stab(ctx, out, at, n, d, v) {
    const f = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 3200, Q: 1 })
    f.frequency.setValueAtTime(3200, at)
    f.frequency.exponentialRampToValueAtTime(900, at + d)
    const g = amp(ctx, at, v * 0.13, 0.004, d * 0.4, d * 0.6)
    for (const n2 of notes(n)) for (const dt of [-9, 9]) osc(ctx, 'sawtooth', hz(n2), at, at + d + 0.05, dt).connect(f)
    chain(f, g, out)
  },
  lead(ctx, out, at, n, d, v) {
    const f = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 3600 })
    const g = amp(ctx, at, v * 0.16, 0.01, Math.max(0, d - 0.08), 0.12)
    osc(ctx, 'square', hz(n), at, at + d + 0.15).connect(f)
    osc(ctx, 'sawtooth', hz(n), at, at + d + 0.15, 7).connect(f)
    chain(f, g, out)
  },
  pad(ctx, out, at, n, d, v) {
    const f = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1500 })
    const g = amp(ctx, at, v * 0.07, Math.min(0.35, d * 0.3), Math.max(0, d * 0.7 - 0.2), 0.7)
    for (const n2 of notes(n)) for (const dt of [-12, 0, 12]) osc(ctx, 'sawtooth', hz(n2), at, at + d + 0.8, dt).connect(f)
    chain(f, g, out)
  },
  brass(ctx, out, at, n, d, v) {
    const f = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 2, frequency: 500 })
    f.frequency.setValueAtTime(500, at)
    f.frequency.linearRampToValueAtTime(2600 * (0.6 + 0.4 * v), at + 0.09)
    f.frequency.exponentialRampToValueAtTime(1500, at + 0.09 + d)
    const g = amp(ctx, at, v * 0.12, 0.05, Math.max(0, d - 0.1), 0.28)
    const vib = new OscillatorNode(ctx, { frequency: 5.2 }), depth = new GainNode(ctx, { gain: 6 })
    vib.connect(depth); vib.start(at + 0.25); vib.stop(at + d + 0.4)
    for (const n2 of notes(n)) for (const dt of [-6, 6]) { const o = osc(ctx, 'sawtooth', hz(n2), at, at + d + 0.4, dt); depth.connect(o.detune); o.connect(f) }
    chain(f, g, out)
  },
  strings(ctx, out, at, n, d, v) { // a bowed note: short ones bite (an ostinato), long ones swell
    const f = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 2400 })
    const g = amp(ctx, at, v * 0.09, d < 0.3 ? 0.012 : 0.12, Math.max(0, d - (d < 0.3 ? 0.05 : 0.2)), d < 0.3 ? 0.06 : 0.35)
    for (const n2 of notes(n)) for (const dt of [-5, 4]) osc(ctx, 'sawtooth', hz(n2), at, at + d + 0.4, dt).connect(f)
    chain(f, g, out)
  },
  pizz(ctx, out, at, n, _d, v) {
    chain(osc(ctx, 'triangle', hz(n), at, at + 0.4), new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1800 }), amp(ctx, at, v * 0.45, 0.002, 0, 0.26), out)
  },
  flute(ctx, out, at, n, d, v) {
    const o = osc(ctx, 'sine', hz(n), at, at + d + 0.2)
    const vib = new OscillatorNode(ctx, { frequency: 5.5 }), depth = new GainNode(ctx, { gain: 9 })
    vib.connect(depth).connect(o.detune); vib.start(at); vib.stop(at + d + 0.2)
    chain(o, amp(ctx, at, v * 0.16, 0.03, Math.max(0, d - 0.08), 0.12), out)
  },
  bell(ctx, out, at, n, d, v) {
    const c = osc(ctx, 'sine', hz(n), at, at + d + 3), m = osc(ctx, 'sine', hz(n) * 3.5, at, at + d + 3)
    const idx = new GainNode(ctx, { gain: hz(n) * 4 })
    idx.gain.exponentialRampToValueAtTime(1, at + 2.2)
    m.connect(idx).connect(c.frequency)
    chain(c, amp(ctx, at, v * 0.18, 0.002, 0, 2.8), out)
  },
}

// ------------------------------------------------------------------ the scheduler
export function playCue(ctx, out, cue, from = 0) {
  const spb = 60 / cue.bpm
  const bus = new GainNode(ctx, { gain: cue.gain ?? 1 })
  const dry = new GainNode(ctx, { gain: 1 }), wet = new GainNode(ctx, { gain: cue.wet ?? 0.22 })
  const verb = new ConvolverNode(ctx, { buffer: shared(ctx).ir })
  bus.connect(dry).connect(out)
  bus.connect(wet).connect(verb).connect(out)
  const ev = cue.events
  const span = cue.beats * spb
  let t0 = ctx.currentTime + 0.06 - from // audio time of the cue's start
  let i = ev.findIndex(e => e.b * spb >= from - 1e-6)
  if (i < 0) i = ev.length
  let done = false
  const pump = () => {
    const horizon = ctx.currentTime + 0.15
    for (;;) {
      if (i >= ev.length) {
        if (!cue.loop) return
        t0 += span
        i = 0
      }
      const e = ev[i], at = t0 + e.b * spb
      if (at > horizon) return
      if (at >= ctx.currentTime - 0.01) INST[e.i](ctx, bus, Math.max(at, ctx.currentTime), e.n, e.d * spb, e.v)
      i++
    }
  }
  pump()
  const timer = setInterval(pump, 25)
  return {
    get t() {
      return ctx.currentTime - t0
    },
    stop(fade = 0.1) {
      if (done) return
      done = true
      clearInterval(timer)
      bus.gain.setTargetAtTime(0, ctx.currentTime, fade / 3)
      setTimeout(() => bus.disconnect(), fade * 1000 + 3000) // the queued notes and the reverb tail die with it
    },
  }
}

// ------------------------------------------------------------------ writing cues
/** A cue from tracks of steps: `put(i, beat, n, dur, vel)` pushes one event; `beats` is its whole length. */
function cue(bpm, beats, write, opts = {}) {
  const events = []
  write((i, b, n, d = 0.25, v = 0.8) => events.push({ i, b, n, d, v }))
  events.sort((a, z) => a.b - z.b)
  return { bpm, beats, events, ...opts }
}
const chord = (root, kind) => (kind === 'm' ? [root, root + 3, root + 7] : [root, root + 4, root + 7])

/**
 * The dance (Deadpool's world): a fast dance-pop groove at the routine's own tempo (pose_splice.py BPM, 172.5)
 * in D minor, 99 beats to match the routine's 99, its downbeat on the routine's t = 0. Two bars of drums, the
 * groove with off-beat stabs, the hook from bar 4, a half-time drop through the brawl among the fallen, the
 * hook back, and a last stab on the final pose.
 */
const BYE = cue(172.5, 104, put => {
  const PROG = [[50, 'm'], [46, 'M'], [48, 'M'], [45, 'M']] // Dm Bb C A, a bar each
  const HOOK = [74, 0, 77, 0, 76, 74, 0, 72, 74, 0, 69, 0, 0, 0, 67, 69] // two bars of eighths (0 = rest)
  const HOOK2 = [74, 0, 77, 0, 79, 77, 0, 76, 74, 0, 72, 0, 74, 0, 0, 0]
  for (let bar = 0; bar < 25; bar++) {
    const b0 = bar * 4, [root, kind] = PROG[bar % 4]
    const drop = bar >= 12 && bar < 16, last = bar === 24
    if (last) break
    // drums
    for (let e = 0; e < 8; e++) put('hat', b0 + e / 2, e % 2 ? 0 : 0, 0.1, e % 2 ? 0.7 : 0.45)
    if (drop) {
      put('kick', b0, 0, 0.5, 1); put('snare', b0 + 2, 0, 0.3, 0.9); put('clap', b0 + 2, 0, 0.3, 0.6)
    } else {
      put('kick', b0, 0, 0.5, 1); put('kick', b0 + 1.5, 0, 0.5, 0.8); put('kick', b0 + 2.5, 0, 0.5, 0.6)
      if (bar >= 2) { put('snare', b0 + 1, 0, 0.3, 0.85); put('snare', b0 + 3, 0, 0.3, 0.9); put('clap', b0 + 3, 0, 0.3, 0.5) }
    }
    if (bar % 4 === 3 && !drop) put('roll', b0 + 3, 0, 1, 0.5)
    if (bar < 1) continue
    // bass: root on the beat, octave on the "and" of two, a pickup into the next bar
    const bassLine = drop ? [[0, root - 12, 1.6]] : [[0, root - 12, 0.4], [0.5, root - 12, 0.3], [1.5, root, 0.3], [2.5, root - 12, 0.4], [3, root - 10, 0.3], [3.5, root - 12, 0.3]]
    for (const [o, n, d] of bassLine) put('bass', b0 + o, n, d, 0.85)
    // chords: off-beat stabs in the groove, a held pad in the drop
    if (drop) put('pad', b0, chord(root + 12, kind), 4, 0.9)
    else for (const o of [0.5, 1.5, 2.5, 3.5]) if (bar >= 2) put('stab', b0 + o, chord(root + 12, kind), 0.3, 0.75)
    // the hook
    if (bar >= 4 && !drop) {
      const h = Math.floor(bar / 8) % 2 ? HOOK2 : HOOK, half = bar % 2
      for (let e = 0; e < 8; e++) { const n = h[half * 8 + e]; if (n) put('lead', b0 + e / 2, n, 0.42, 0.8) }
    }
  }
  // the final pose (the routine's last beat, 99): a held chord with a crash of drums
  put('kick', 99, 0, 0.5, 1); put('clap', 99, 0, 0.3, 0.8); put('hat', 99, 1, 0.3, 0.8)
  put('stab', 99, chord(62, 'm'), 2.5, 1); put('bass', 99, 38, 2.5, 0.9); put('pad', 99, chord(62, 'm'), 4, 0.8)
}, { gain: 0.6, wet: 0.16 })

/** Spider-Man's world: a bright swinging fanfare in E major, strings running under a brass call. */
const WEB = cue(138, 64, put => {
  const PROG = [[52, 'M'], [49, 'm'], [45, 'M'], [47, 'M']] // E C#m A B
  const CALL = [[0, 71, 1], [1, 76, 0.75], [1.75, 78, 0.25], [2, 80, 1.5], [3.5, 78, 0.5], [4, 76, 0.75], [4.75, 78, 0.25], [5, 83, 2], [7, 80, 1],
    [8, 81, 1], [9, 80, 0.5], [9.5, 78, 0.5], [10, 76, 1.5], [11.5, 73, 0.5], [12, 75, 1], [13, 76, 0.5], [13.5, 78, 0.5], [14, 76, 2]]
  for (let bar = 0; bar < 16; bar++) {
    const b0 = bar * 4, [root, kind] = PROG[bar % 4], c = chord(root, kind)
    // strings: a running arpeggio in sixteenths, up and back down
    const arp = [c[0] + 12, c[1] + 12, c[2] + 12, c[0] + 24, c[2] + 12, c[1] + 12]
    for (let s = 0; s < 16; s++) put('strings', b0 + s / 4, arp[s % arp.length], 0.22, 0.55 + 0.2 * (s % 4 === 0))
    put('bass', b0, root - 12, 1.8, 0.5); put('bass', b0 + 2, root - 12, 1.8, 0.45)
    put('timp', b0, root - 12, 1, bar % 4 === 0 ? 0.8 : 0.45)
    if (bar >= 2) { put('kick', b0, 0, 0.4, 0.55); put('snare', b0 + 2, 0, 0.3, 0.4) }
    if (bar >= 4) put('pad', b0, chord(root + 12, kind), 4, 0.6)
  }
  for (const rep of [16, 48]) for (const [o, n, d] of CALL) put('brass', rep + o, [n, n - 12], d, 0.85)
  for (const [o, n, d] of CALL) put('brass', 32 + o, [n, n - 5], d, 0.7) // the call again, voiced in fourths, softer
}, { loop: true, gain: 0.6 })

/** The ensemble (Iron Man, Thor): a broad march in C minor turning to E-flat, snare and timpani under brass. */
const ASSEMBLE = cue(92, 64, put => {
  const PROG = [[48, 'm'], [44, 'M'], [51, 'M'], [46, 'M']] // Cm Ab Eb Bb
  const THEME = [[0, 67, 1.5], [1.5, 72, 0.5], [2, 70, 1], [3, 67, 1], [4, 68, 1.5], [5.5, 67, 0.5], [6, 65, 1], [7, 63, 1],
    [8, 63, 1.5], [9.5, 67, 0.5], [10, 70, 2], [12, 72, 1], [13, 74, 1], [14, 75, 2]]
  for (let bar = 0; bar < 16; bar++) {
    const b0 = bar * 4, [root, kind] = PROG[bar % 4]
    // low strings: driving eighths on the root
    for (let e = 0; e < 8; e++) put('strings', b0 + e / 2, root - 12, 0.2, e % 2 ? 0.45 : 0.6)
    // the march: snare on every beat with a ruff before three, timpani on one and three
    for (let q = 0; q < 4; q++) put('snare', b0 + q, 0, 0.2, q === 0 ? 0.6 : 0.35)
    put('roll', b0 + 2.5, 0, 0.5, 0.35)
    put('timp', b0, root - 12, 1, 0.8); put('timp', b0 + 2, root - 5, 1, 0.5)
    if (bar >= 4) put('brass', b0, chord(root, kind), 3.8, 0.55)
    if (bar >= 2) put('pad', b0, chord(root + 12, kind), 4, 0.5)
  }
  for (const rep of [16, 32, 48]) for (const [o, n, d] of THEME) put('brass', rep + o, [n, n + 12], d, rep === 48 ? 1 : 0.8)
}, { loop: true, gain: 1.2, wet: 0.3 })

/** The vault: a spy ostinato in five (grouped two and three), pizzicato bass, bongos, a flute's stabs. */
const VAULT = cue(150, 80, put => {
  const BASS = [[0, 45], [1, 45], [2, 52], [3, 50], [4, 48]] // A A E D C over five beats
  const BASS2 = [[0, 45], [1, 45], [2, 53], [3, 52], [4, 47]]
  for (let bar = 0; bar < 16; bar++) {
    const b0 = bar * 5
    for (const [o, n] of (bar % 4 === 3 ? BASS2 : BASS)) put('pizz', b0 + o, n, 0.5, o === 0 ? 0.95 : 0.7)
    put('bongo', b0, 420, 0, 0.8); put('bongo', b0 + 0.5, 300, 0, 0.5); put('bongo', b0 + 2, 420, 0, 0.7); put('bongo', b0 + 3.5, 300, 0, 0.5)
    for (let e = 0; e < 10; e++) put('hat', b0 + e / 2, 0, 0.1, e === 0 || e === 4 ? 0.6 : 0.3)
    if (bar >= 4) put('strings', b0, [69, 72, 76], 5, 0.35) // a held, uneasy chord
    if (bar >= 8 && bar % 2 === 0) for (const [o, n, d] of [[0.5, 81, 0.4], [1, 84, 0.4], [2.5, 83, 0.9], [4, 76, 0.8]]) put('flute', b0 + o, n, d, 0.8)
    if (bar >= 8 && bar % 2 === 1) for (const [o, n, d] of [[0.5, 81, 0.4], [1, 79, 0.4], [2, 77, 0.5], [2.5, 76, 1.8]]) put('flute', b0 + o, n, d, 0.75)
  }
}, { loop: true, gain: 1.9, wet: 0.18 })

/** The chase: a dark pulse in D minor, low strings in sixteenths, brass swells, a tolling bell every two bars. */
const KNIGHT = cue(120, 64, put => {
  const PROG = [[38, 'm'], [34, 'M'], [43, 'm'], [45, 'M']] // Dm Bb Gm A
  const FIG = [0, 0, 12, 0, 0, 7, 0, 3] // the ostinato's shape over the root, in sixteenths (then repeated)
  const LINE = [[0, 57, 1.5], [1.5, 55, 0.5], [2, 53, 1], [3, 52, 1], [4, 50, 3], [8, 57, 1.5], [9.5, 58, 0.5], [10, 57, 1], [11, 55, 1], [12, 57, 4]]
  for (let bar = 0; bar < 16; bar++) {
    const b0 = bar * 4, [root, kind] = PROG[bar % 4]
    for (let s = 0; s < 16; s++) put('strings', b0 + s / 4, root + FIG[s % 8], 0.2, s % 4 === 0 ? 0.75 : 0.5)
    put('kick', b0, 0, 0.5, 0.9); put('kick', b0 + 2.75, 0, 0.5, 0.6)
    put('timp', b0, root, 1, 0.7)
    if (bar % 2 === 0) put('bell', b0, root + 24, 4, 0.5)
    if (bar >= 4) put('brass', b0, chord(root + 12, kind), 3.9, 0.6)
    if (bar >= 6) { put('snare', b0 + 1, 0, 0.3, 0.5); put('snare', b0 + 3, 0, 0.3, 0.6) }
  }
  for (const rep of [32, 48]) for (const [o, n, d] of LINE) put('brass', rep + o, [n, n + 12], d, 0.85)
}, { loop: true, gain: 0.65, wet: 0.28 })

export const CUES = { bye: BYE, web: WEB, assemble: ASSEMBLE, vault: VAULT, knight: KNIGHT }
export const CUE_NAMES = {
  web: 'Spider-Man: a swinging fanfare',
  assemble: 'Iron Man and Thor: the ensemble march',
  vault: 'Mission: Impossible: a spy ostinato in five',
  knight: 'The Dark Knight: a dark pulse',
  bye: 'Deadpool: the dance groove (in step with the routine)',
}

// Self-check: every event names an instrument, and the dance cue's last pose lands on the routine's 99th beat.
for (const [k, c] of Object.entries(CUES)) for (const e of c.events) console.assert(INST[e.i], `score: ${k} uses an unknown instrument ${e.i}`)
console.assert(BYE.events.some(e => e.b === 99 && e.i === 'stab'), 'score: the dance cue ends on beat 99')
