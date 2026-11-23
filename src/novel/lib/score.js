/*
 * The score, synthesized live in Web Audio (no recordings, no samples): the fan tributes' themes, each written
 * here note by note from a transcription of its tune (Spider-Man, the Avengers, Mission: Impossible, the Dark
 * Knight; credited in each cue's note and CUE_NAMES) and arranged for these synths, and an original dance groove
 * (the dance itself plays the song). audition.html plays every cue; sound.js plays each world's theme.
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

/**
 * A melody in letter notation (as fan piano transcriptions write it): rows of 'octave|letters and dashes|', each
 * character one step; lowercase a natural note, uppercase its sharp. A block's rows (one line in two octaves)
 * play in step; the blocks follow one another. Each note lasts to the next one, at most `hold` steps.
 * Returns { notes: [[step, midi, steps]], steps }.
 */
const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
function letters(blocks, hold = 8) {
  const on = []
  let at = 0
  for (const block of blocks) {
    let len = 0
    for (const row of block) {
      const [oct, body] = row.split('|')
      ;[...body].forEach((ch, i) => {
        const pc = PC[ch.toLowerCase()]
        if (pc !== undefined) on.push([at + i, 12 * (+oct + 1) + pc + (ch === ch.toUpperCase() ? 1 : 0)])
      })
      len = Math.max(len, body.length)
    }
    at += len
  }
  on.sort((x, y) => x[0] - y[0])
  return { notes: on.map(([t, n], i) => [t, n, Math.min(hold, (on[i + 1]?.[0] ?? at) - t)]), steps: at }
}

/**
 * Spider-Man (the 1967 cartoon's theme, Paul Francis Webster and Bob Harris): its tune from a fan's piano
 * transcription (pianoletternotes), in C minor, a step a sixteenth; brass with a muted lead on the tune over a
 * swinging walking bass, ride and brushes, the chords under each phrase.
 */
const SPIDER = letters([
  ['4|c---D---g-------f---D---c-|'],
  ['4|------c---D---gggf-D--c---|'],
  ['5|----c---------------------|', '4|----------------------f---|'],
  ['4|f-G-----A-G-f---c-D-gggDc-|'],
  ['4|G-g---f---f-f-f-D-c---c---|'],
])
const WEB = cue(176, 36, put => {
  const S = 0.25 // beats a step
  for (const [t, n, d] of SPIDER.notes) {
    put('brass', t * S, [n + 12, n], Math.max(0.2, d * S - 0.05), 0.9)
    put('lead', t * S, n + 12, Math.max(0.15, d * S - 0.08), 0.45)
  }
  // The harmony under the phrases (from beat, bass root, chord): C minor, F minor, A-flat, G7, C minor; a G7 turnaround.
  const HARM = [[0, 36, [48, 51, 55, 58]], [12, 41, [53, 56, 60, 63]], [16, 36, [48, 51, 55, 60]], [19.5, 41, [53, 56, 60, 63]],
    [26, 44, [56, 60, 63, 67]], [28, 43, [55, 59, 62, 65]], [30.5, 36, [48, 51, 55, 58]], [33, 43, [55, 59, 62, 65]]]
  HARM.forEach(([b, root, ch], k) => {
    const end = HARM[k + 1]?.[0] ?? 36, next = HARM[k + 1]?.[1] ?? 36
    put('pad', b, ch, end - b, 0.7)
    // a walking bass: root, fifth, octave, a half step above the next chord's root
    for (let q = b; q < end; q++) {
      const w = (q - b) % 4
      put('bass', q, w === 0 ? root : w === 1 ? root + 7 : w === 2 ? root + 12 : next + 1, 0.8, 0.7)
    }
  })
  for (let q = 0; q < 36; q++) {
    put('hat', q, q % 2, 0.1, 0.5) // the ride's swing: on the beat, and the late "and"
    put('hat', q + 2 / 3, 0, 0.1, 0.32)
    if (q % 2) put('snare', q, 0, 0.2, 0.28)
    if (q % 4 === 0) put('kick', q, 0, 0.4, 0.5)
  }
}, { loop: true, gain: 0.55, wet: 0.2 })

/**
 * The Avengers (Alan Silvestri's theme): its tune from a fan's piano transcription (pianoletternotes, 120 BPM),
 * the slow chromatic climb from D and back with the repeated-note rhythm in it, a step a sixteenth; in G minor
 * over i, VI, IV, VII (Hooktheory's analysis): horns and trumpets on the tune, strings driving eighths, snare,
 * timpani on each change of chord.
 */
const AVENGERS = letters([
  ['4|d-----ddd---ddddDDD---DDe-|'],
  ['4|--eeeefff---ffe---eeeeDDD-|'],
  ['4|--DD----c---ddd---ddd---dd|', '3|----A---------------------|'],
  ['4|ddDDD---DDe---eeeefff---ff|'],
  ['4|e---eeeeDDD---DD----c-----|'],
], 6)
const ASSEMBLE = cue(120, 34, put => {
  const S = 0.25
  // The chord under each melody note: D over G minor, D-sharp over E-flat, E over C (the raised sixth), F over F, C over F.
  const UNDER = { 2: [43, 'm'], 3: [39, 'M'], 4: [36, 'M'], 5: [41, 'M'], 10: [43, 'm'], 0: [41, 'M'] }
  let last = null
  const roots = []
  for (const [t, n, d] of AVENGERS.notes) {
    put('brass', t * S, [n + 12, n], Math.max(0.12, d * S - 0.03), 0.95)
    const u = UNDER[n % 12]
    if (u && u !== last) {
      last = u
      roots.push([t * S, u[0]])
      put('brass', t * S, chord(u[0] + 12, u[1]), 1.5, 0.5)
      put('pad', t * S, chord(u[0] + 24, u[1]), 2, 0.6)
      put('timp', t * S, u[0], 1, 0.8)
    }
  }
  for (let e = 0, k = 0; e < 68; e++) {
    const b = e / 2
    while (k + 1 < roots.length && roots[k + 1][0] <= b) k++
    const r = roots[k][1]
    put('strings', b, [r, r + 12], 0.2, e % 2 ? 0.45 : 0.65)
  }
  for (let q = 0; q < 34; q++) {
    put('snare', q, 0, 0.2, q % 2 ? 0.35 : 0.5)
    if (q % 4 === 3) put('roll', q + 0.5, 0, 0.5, 0.35)
  }
}, { loop: true, gain: 0.62, wet: 0.3 })

/**
 * Mission: Impossible (Lalo Schifrin's theme): in 5/4, G minor, 170 BPM. The bass's two bars, G G B-flat C and
 * G G F F-sharp (two dotted quarters and two quarters); the horn call, two quick notes falling to a held one,
 * B-flat G D, B-flat G C-sharp, B-flat G C, then B-flat C; bongos, a shaker, a flute doubling the call.
 */
const VAULT = cue(170, 80, put => {
  const BASS = [[[0, 43, 1.5], [1.5, 43, 1.5], [3, 46, 1], [4, 48, 1]], [[0, 43, 1.5], [1.5, 43, 1.5], [3, 41, 1], [4, 42, 1]]]
  const CALL = [[70, 67, 62], [70, 67, 61], [70, 67, 60], [58, 60]] // a bar each
  for (let bar = 0; bar < 16; bar++) {
    const b0 = bar * 5
    for (const [o, n, d] of BASS[bar % 2]) {
      put('pizz', b0 + o, n, d, o === 0 ? 1 : 0.8)
      put('bass', b0 + o, n, d * 0.9, 0.45)
    }
    put('bongo', b0, 420, 0, 0.8); put('bongo', b0 + 1.5, 300, 0, 0.6); put('bongo', b0 + 3, 420, 0, 0.7); put('bongo', b0 + 4, 300, 0, 0.6)
    for (let e = 0; e < 10; e++) put('hat', b0 + e / 2, 0, 0.1, e % 3 === 0 ? 0.55 : 0.3)
    if (bar >= 4) {
      const call = CALL[(bar - 4) % 4], loud = bar >= 8
      call.forEach((n, k) => {
        const long = k === call.length - 1, d = long ? 5 - k * 0.5 - 0.2 : 0.42
        put('brass', b0 + k * 0.5, loud ? [n + 12, n] : n + 12, d, loud ? 1 : 0.8)
        put('flute', b0 + k * 0.5, n + 24, d, 0.6)
      })
      put('strings', b0, [55, 58, 62], 5, bar >= 12 ? 0.5 : 0.3)
    }
    if (bar % 4 === 3) put('roll', b0 + 4, 0, 1, 0.4)
  }
}, { loop: true, gain: 0.75, wet: 0.18 })

/**
 * The Dark Knight (Hans Zimmer and James Newton Howard's Batman): the two-note motif, a rising minor third from D
 * to F held long in the horns, over driving sixteenths in the low strings (accented three, three, two), D minor
 * turning to B-flat, G minor and A; a kick and timpani on each bar, a tolling low bell.
 */
const KNIGHT = cue(136, 64, put => {
  const PROG = [[38, 'm'], [38, 'm'], [34, 'M'], [34, 'M'], [43, 'm'], [43, 'm'], [45, 'M'], [45, 'M']] // a bar each
  const ACC = [1, 0, 0, 1, 0, 0, 1, 0]
  for (let bar = 0; bar < 16; bar++) {
    const b0 = bar * 4, [root, kind] = PROG[bar % 8]
    for (let s = 0; s < 16; s++) put('strings', b0 + s / 4, [root, root + 12], 0.2, ACC[s % 8] ? 0.85 : 0.5)
    put('kick', b0, 0, 0.5, 1); put('kick', b0 + 1.5, 0, 0.5, 0.6); put('timp', b0, root, 1, 0.8)
    if (bar >= 2) { put('snare', b0 + 1, 0, 0.3, 0.45); put('snare', b0 + 3, 0, 0.3, 0.55) }
    if (bar % 4 === 0) put('bell', b0, 62, 4, 0.4)
    put('pad', b0, chord(root + 12, kind), 4, 0.55)
  }
  // The motif: D for two beats rising to F, held; four times through the loop, louder each time.
  for (const [at, v] of [[0, 0.75], [16, 0.85], [32, 0.95], [48, 1]]) {
    put('brass', at, [62, 50], 2, v)
    put('brass', at + 2, [65, 53], 9.5, v)
  }
}, { loop: true, gain: 0.42, wet: 0.3 })

export const CUES = { bye: BYE, web: WEB, assemble: ASSEMBLE, vault: VAULT, knight: KNIGHT }
export const CUE_NAMES = {
  web: 'Spider-Man (1967 theme, Webster and Harris)',
  assemble: 'The Avengers (Alan Silvestri)',
  vault: 'Mission: Impossible (Lalo Schifrin)',
  knight: 'The Dark Knight (Hans Zimmer and James Newton Howard)',
  bye: 'Deadpool: the dance groove (in step with the routine)',
}

// Self-check: every event names an instrument, and the dance cue's last pose lands on the routine's 99th beat.
for (const [k, c] of Object.entries(CUES)) for (const e of c.events) console.assert(INST[e.i], `score: ${k} uses an unknown instrument ${e.i}`)
console.assert(BYE.events.some(e => e.b === 99 && e.i === 'stab'), 'score: the dance cue ends on beat 99')
// The transcriptions read whole: Spider-Man opens C E-flat G, the Avengers on D, each 130 steps.
console.assert(SPIDER.notes.slice(0, 3).map(x => x[1]).join() === '60,63,67' && SPIDER.steps === 130, 'score: the Spider-Man tune')
console.assert(AVENGERS.notes[0][1] === 62 && AVENGERS.steps === 130, 'score: the Avengers tune')
