import { store } from './store'

/*
 * The soundtrack of the cinema, synthesized live (no audio files): a projector's 24 fps sprocket
 * clatter, motor hum and fan, the hall's air, and a rising rush of air as the light floods the frame.
 * Off until the reader turns it on (browsers only allow audio after a gesture). It reads the store
 * every frame: the projector gets louder the closer the camera is to the lens, and everything in the
 * cinema falls silent while a paper chapter covers the screen.
 * In the dance (cinema/dance.js) the song plays in step with the routine (public/cinema/dance/byebyebye.mp3: the
 * owner's clip's soundtrack from the routine's first beat, credited in ChapterFive.jsx; fetched the first time
 * it is needed): it follows the routine's clock (store.danceClock) while the reader scrolls it forward, starts
 * where the routine is, re-syncs when the two drift apart, and goes quiet when the scroll stops. ChapterFive.jsx's play button scrolls the
 * routine in real time, so then the two never drift at all.
 */
let ctx, master, proj, room, rush, rushFilter, music, raf
let on = false
const listeners = new Set()

function noise(seconds, brown = false) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const d = b.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    d[i] = brown ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w
  }
  return b
}

// One second of film running through the gate: 24 claw pulls, each a click and a softer shutter tick.
function clatter() {
  const sr = ctx.sampleRate
  const b = ctx.createBuffer(1, sr, sr)
  const d = b.getChannelData(0)
  const click = (t, amp, decay) => {
    const i0 = Math.floor(t * sr)
    for (let i = 0; i < sr * 0.012 && i0 + i < d.length; i++) d[i0 + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / (sr * decay))
  }
  for (let k = 0; k < 24; k++) {
    const t = k / 24 + (Math.random() - 0.5) * 0.0016
    click(t, 0.75 + Math.random() * 0.25, 0.0011)
    click(t + 0.0105, 0.3, 0.0018)
  }
  return b
}

function loop(buffer, ...chain) {
  const s = ctx.createBufferSource()
  s.buffer = buffer
  s.loop = true
  chain.reduce((a, n) => (a.connect(n), n), s)
  s.start()
  return s
}

function filter(type, frequency, Q = 0.7) {
  return new BiquadFilterNode(ctx, { type, frequency, Q })
}

function gain(value) {
  return new GainNode(ctx, { gain: value })
}

function build() {
  ctx = new AudioContext()
  const comp = new DynamicsCompressorNode(ctx, { threshold: -18, ratio: 3 })
  comp.connect(ctx.destination)
  master = gain(0)
  master.connect(comp)

  proj = gain(0)
  proj.connect(master)
  loop(clatter(), filter('bandpass', 2400, 0.9), gain(0.55), proj)
  loop(noise(2), filter('lowpass', 900), gain(0.05), proj)
  const hum = new OscillatorNode(ctx, { type: 'sawtooth', frequency: 55 })
  hum.connect(filter('lowpass', 180)).connect(gain(0.07)).connect(proj)
  hum.start()
  const hum2 = new OscillatorNode(ctx, { type: 'sine', frequency: 110 })
  hum2.connect(gain(0.025)).connect(proj)
  hum2.start()

  room = gain(0)
  room.connect(master)
  loop(noise(3, true), filter('lowpass', 260), gain(0.5), room)

  rush = gain(0)
  rush.connect(master)
  rushFilter = filter('bandpass', 300, 1.1)
  loop(noise(2), rushFilter, rush)

  music = gain(0.8)
  music.connect(master)
}

// The song, kept in step with the routine's clock: its second 0 is the routine's.
const SONG = '/cinema/dance/byebyebye.mp3'
let song = null // the decoded song, the promise of it, or false if it could not load
function playSong(from) {
  const g = gain(0)
  g.connect(music)
  const s = new AudioBufferSourceNode(ctx, { buffer: song })
  s.connect(g)
  const t0 = ctx.currentTime + 0.02
  s.start(t0, from)
  g.gain.setTargetAtTime(1, t0, 0.015)
  return {
    get t() { return from + ctx.currentTime - t0 },
    stop(fade) {
      g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3)
      s.stop(ctx.currentTime + fade + 0.05)
    },
  }
}
const dance = { player: null, lastT: -1, moved: 0, synced: 0 }
function follow(now) {
  const c = store.danceClock
  const live = on && c && now - c.seen < 250 && c.T > 0.05 && c.T < c.end - 0.05
  if (live && c.T !== dance.lastT) dance.moved = now
  if (live) dance.lastT = c.T
  const moving = live && now - dance.moved < 350 // scrolled within the last third of a second
  if (!moving) {
    if (dance.player) dance.player.stop(0.3), (dance.player = null)
    return
  }
  if (song === null) song = fetch(SONG).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(b => (song = b), () => (song = false)) // a failed fetch: no song this visit
  if (!(song instanceof AudioBuffer)) return
  const drift = dance.player ? Math.abs(dance.player.t - c.T) : Infinity
  // Start where the routine is; re-sync on a drift a listener would hear, at most every 0.6 s (a fast scroll
  // re-syncs in steps rather than stuttering every frame).
  if (drift > 0.25 && now - dance.synced > 600) {
    dance.player?.stop(0.06)
    dance.player = playSong(c.T)
    dance.synced = now
  }
}

const clamp01 = x => Math.min(1, Math.max(0, x))

function tick() {
  raf = requestAnimationFrame(tick)
  const t = ctx.currentTime
  const night = store.night ? 1 : 0
  const { flood = 0, sweep = 0 } = store.takeover ?? {}
  const d = store.camDist ?? 12
  proj.gain.setTargetAtTime(night * clamp01(1.5 / (1 + d * 0.3)) * (1 - 0.6 * flood), t, 0.12)
  room.gain.setTargetAtTime(night * 0.06, t, 0.3)
  rush.gain.setTargetAtTime(night * Math.sin(Math.PI * clamp01(flood * 0.85 + sweep * 0.4)) * 0.32, t, 0.06)
  rushFilter.frequency.setTargetAtTime(250 + 5200 * flood * flood, t, 0.06)
  follow(performance.now())
}

export const sound = {
  get on() {
    return on
  },
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  async toggle() {
    on = !on
    if (on) {
      if (!ctx) build()
      await ctx.resume()
      master.gain.setTargetAtTime(0.7, ctx.currentTime, 0.4)
      cancelAnimationFrame(raf)
      tick()
    } else if (ctx) {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.15)
      cancelAnimationFrame(raf)
      dance.player?.stop(0.15)
      dance.player = null
      setTimeout(() => !on && ctx.suspend(), 600)
    }
    listeners.forEach(fn => fn(on))
  },
}
