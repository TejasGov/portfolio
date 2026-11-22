import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from '../lib/scroll'
import { store } from '../lib/store'
import { PROGRAMME } from '../content'
import { goTo, goToId } from '../Book'
import './boxoffice.css'

/*
 * The box office: the way a visitor chooses what to watch instead of scrolling the whole feature.
 * One programme (content.js PROGRAMME), shown twice: as the front door right after the poster
 * (Prologue.jsx, one ticket per screen) and as the header's dialog (every showing). Picking a ticket
 * tears its stub, prints while the target's 3D warms (Stage.jsx 'novel:warm' / 'novel:warmed', capped
 * at 2.5 s: world.js holds a cover past that), then jumps straight there. A ticket starts warming at the
 * first sign of intent (hover, focus, touch). Reduced motion: no tearing or printing, the status text
 * while it warms, then an instant jump.
 */
export const openBoxOffice = () => document.getElementById('boxoffice')?.showModal()
// The front door's window in the prologue's progress (Prologue.jsx BEATS; Book.jsx pulses its pill past it).
export const DOOR = [0.1, 0.42]

const wait = ms => new Promise(r => setTimeout(r, ms))
const warm = worlds => dispatchEvent(new CustomEvent('novel:warm', { detail: { worlds } }))
// Intent: each ticket asks once, so a hover across the grid doesn't queue the same world again and again.
const hinted = new Set()
const hint = s => s.worlds && !hinted.has(s.id) && (hinted.add(s.id), warm(s.worlds))
const warmed = worlds =>
  new Promise(res => {
    const done = () => {
      clearTimeout(cap)
      removeEventListener('novel:warmed', on)
      res()
    }
    const on = e => e.detail?.worlds?.join() === worlds.join() && done()
    const cap = setTimeout(done, 2500)
    addEventListener('novel:warmed', on)
    warm(worlds)
  })
// Instant: the ticket is the transition, and a smooth scroll would sweep through every world on the way.
function jump(go) {
  if (go.chapter) goTo(go, 'instant')
  else if (document.getElementById(go.id)) goToId(go.id, 'instant')
  else if (go.or) goTo(go.or, 'instant') // a scene anchor not placed yet: its chapter
}

/** One pick at a time: { id, phase: 'print' | 'admit' } while a ticket prints, and `cancel` for a closed dialog. */
function useAdmit() {
  const [picked, setPicked] = useState(null)
  const run = useRef(0)
  const pick = async s => {
    if (picked) return
    const calm = reducedMotion() // no stub to watch: wait only for the world, so no cover holds a loud still
    const me = ++run.current
    setPicked({ id: s.id, phase: 'print' })
    await Promise.all([s.worlds ? warmed(s.worlds) : null, calm ? null : wait(800)]) // long enough to see the stub go
    if (me !== run.current) return
    if (!calm) {
      setPicked({ id: s.id, phase: 'admit' })
      await wait(420)
      if (me !== run.current) return
    }
    setPicked(null)
    jump(s.go)
  }
  const cancel = () => {
    run.current++
    setPicked(null)
  }
  return [picked, pick, cancel]
}

/** The sign over the window: chasing bulbs above and below, brass trim. */
export const Marquee = ({ id, small }) => (
  <div className={`marquee ${small ? 'marquee-small' : ''}`}>
    <span className="bulbs" aria-hidden="true"><i /><i /></span>
    <p className="marquee-kicker kicker">Now showing</p>
    <h2 id={id} className="marquee-title display-title">
      <span>Box</span> <span className="title-heavy">office</span>
    </h2>
    <span className="bulbs bulbs-low" aria-hidden="true"><i /><i /></span>
  </div>
)

const STATUS = { print: 'Printing your ticket', admit: 'Admitted' }

/**
 * A ticket: the showing, then a stub past the perforation that tears off when it is picked. `wall` is the
 * front door's portrait ticket, pinned to the lit wall (stub at its foot); otherwise the dialog's, stub at its side.
 */
function Ticket({ s, no, picked, pick, wall, style }) {
  const phase = picked?.id === s.id ? picked.phase : null
  const dwell = useRef(0)
  return (
    <li className={`bt ${wall ? 'bt-wall' : ''}`} data-phase={phase ?? undefined} style={style}>
      <button
        type="button"
        className="bt-face"
        aria-disabled={!!picked && !phase}
        onClick={() => pick(s)}
        onFocus={() => hint(s)}
        onTouchStart={() => hint(s)}
        onPointerEnter={() => (dwell.current = setTimeout(() => hint(s), 120))} // a pause, not a pointer passing over
        onPointerLeave={() => clearTimeout(dwell.current)}
      >
        <span className="bt-body paper">
          <span className="bt-title">{s.title}</span>
          <span className="bt-line">{s.line}</span>
          <span className="bt-meta kicker">{phase ? STATUS[phase] : <>{s.screen}<span className="bt-time"> · {s.time}</span></>}</span>
          <span className="bt-print" aria-hidden="true" />
          <span className="bt-stamp kicker" aria-hidden="true">Admitted</span>
        </span>
        <span className="bt-stub paper" aria-hidden="true">
          <span className="kicker">Admit one</span>
          <span className="bt-no">{String(no).padStart(3, '0')}</span>
        </span>
      </button>
    </li>
  )
}

const Status = ({ picked }) => (
  <p className="sr-only" aria-live="polite">{picked ? `${STATUS[picked.phase]}…` : ''}</p>
)

// Every showing, numbered through the programme like a roll of tickets.
let n = 0
const GROUPS = PROGRAMME.map(g => ({ ...g, showings: (g.showings ?? [g]).map(s => ({ screen: g.screen, ...s, no: ++n })) }))
const DOOR_TICKETS = PROGRAMME.map((g, i) => ({ ...g, no: i + 1 }))
// Pinned by hand: each ticket's own lean and height on the wall.
const PINNED = [[-2.4, 6], [1.6, 22], [-0.8, 0], [2.2, 16], [-1.6, 4], [1.1, 20]]

const MID = (DOOR[0] + DOOR[1]) / 2
const SCROLL_KEYS = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']
let caught = false // once a visit (with sessionStorage across reloads)

/** The front door (Prologue.jsx): one ticket per screen, every showing behind a button, or keep scrolling. */
export function FrontDoor({ section }) {
  const [picked, pick, cancel] = useAdmit()
  const at = p => section.current.offsetTop + (section.current.offsetHeight - innerHeight) * p // the prologue's progress (useProgress 'top top' → 'bottom bottom')

  // The catch: the first scroll down onto the door settles on its middle and the rest of that gesture is
  // swallowed, so one flick past the poster can't skip the box office. Once a visit; never under reduced motion.
  useEffect(() => {
    try { caught ||= !!sessionStorage.getItem('novel:door') } catch {}
    if (caught || reducedMotion()) return
    const INPUT = ['wheel', 'touchmove', 'keydown'], HOLD = ['wheel', 'touchmove']
    const passive = { capture: true, passive: true }, blocking = { capture: true, passive: false }
    let last = store.prologue, input = -1e9, hold = 0, timer
    const heard = () => { input = performance.now() }
    const swallow = e => {
      if (e.cancelable) e.preventDefault()
      e.stopPropagation() // window, capture: before Lenis hears it
      hold = performance.now() + 250 // until the wheel or the finger goes quiet
    }
    // Blocking listeners only for the hold itself: a non-passive touchmove all visit would slow every phone scroll.
    const settle = () => scrollTo({ top: at(MID), behavior: 'smooth' })
    const release = () => {
      if (performance.now() < hold) return void (timer = setTimeout(release, hold - performance.now()))
      for (const t of HOLD) removeEventListener(t, swallow, blocking)
      removeEventListener('touchend', settle)
    }
    const onStore = (key, p) => {
      if (key !== 'prologue') return
      const was = last
      last = p
      // A reader's own scroll (not a jump from the poster's buttons) crossing onto the door, going down.
      if (!(was < DOOR[0] + 0.02 && p >= DOOR[0] + 0.02 && p < DOOR[1]) || performance.now() - input > 1000) return
      caught = true
      try { sessionStorage.setItem('novel:door', '1') } catch {}
      store.listeners.delete(onStore)
      for (const t of INPUT) removeEventListener(t, heard, passive)
      for (const t of HOLD) addEventListener(t, swallow, blocking)
      addEventListener('touchend', settle) // a finger already dragging can't be stopped mid-drag: settle again on its lift
      hold = performance.now() + 700 // the glide onto the door
      timer = setTimeout(release, 700)
      // shortcut: Lenis drops a flick's momentum on a middle-button pointerdown (lenis onPointerDown → reset);
      // swap for lenis.scrollTo(y, { lock: true }) once lib/scroll.js exports its instance.
      dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))
      settle()
    }
    for (const t of INPUT) addEventListener(t, heard, passive)
    store.listeners.add(onStore)
    return () => {
      clearTimeout(timer)
      for (const t of INPUT) removeEventListener(t, heard, passive)
      for (const t of HOLD) removeEventListener(t, swallow, blocking)
      removeEventListener('touchend', settle)
      store.listeners.delete(onStore)
    }
  }, [])

  // The door in view: start on the Big Screen's first world, the ticket most likely to be cold.
  useEffect(() => {
    const big = DOOR_TICKETS.find(g => g.id === 'screen')
    const fn = (key, p) => key === 'prologue' && p > DOOR[0] && p < DOOR[1] && (store.listeners.delete(fn), hint(big))
    store.listeners.add(fn)
    return () => store.listeners.delete(fn)
  }, [])

  // A pick still printing gives way to the reader: scrolling on, or the door leaving the screen, cancels it.
  useEffect(() => {
    if (!picked) return
    const key = e => SCROLL_KEYS.includes(e.key) && cancel()
    const left = (k, p) => k === 'prologue' && (p < DOOR[0] || p > DOOR[1]) && cancel()
    addEventListener('wheel', cancel, { passive: true })
    addEventListener('touchmove', cancel, { passive: true })
    addEventListener('keydown', key)
    store.listeners.add(left)
    return () => {
      removeEventListener('wheel', cancel)
      removeEventListener('touchmove', cancel)
      removeEventListener('keydown', key)
      store.listeners.delete(left)
    }
  }, [picked]) // eslint-disable-line react-hooks/exhaustive-deps

  const onScrollOn = () => scrollTo({ top: at(DOOR[1] + 0.03), behavior: reducedMotion() ? 'instant' : 'smooth' })
  // The wall leans a few degrees toward a mouse (CSS vars only; no tilt for touch or reduced motion).
  const wall = useRef(null)
  const lean = (x, y) => {
    wall.current.style.setProperty('--px', x.toFixed(3))
    wall.current.style.setProperty('--py', y.toFixed(3))
  }
  const onMove = e => {
    if (e.pointerType !== 'mouse' || reducedMotion()) return
    const r = wall.current.getBoundingClientRect()
    lean(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1)
  }
  return (
    <div className="door" onPointerMove={onMove} onPointerLeave={() => lean(0, 0)}>
      <Marquee small />
      <p className="door-lede">Choose a showing, or keep scrolling to watch the whole feature.</p>
      <div ref={wall} className="wall">
        <ul className="wall-plane" aria-label="The programme">
          {DOOR_TICKETS.map((g, i) => (
            <Ticket key={g.id} s={g} no={g.no} picked={picked} pick={pick} wall style={{ '--tilt': `${PINNED[i % 6][0]}deg`, '--y': `${PINNED[i % 6][1]}px` }} />
          ))}
        </ul>
      </div>
      <div className="door-actions">
        <button type="button" className="door-all kicker" onClick={openBoxOffice}>Every showing</button>
        <button type="button" className="door-on kicker" onClick={onScrollOn}>Keep scrolling <span aria-hidden="true">↓</span></button>
      </div>
      <Status picked={picked} />
    </div>
  )
}

/** The header's box office (Book.jsx): every showing, then contact and a collapsed "Full contents". */
export function BoxOffice({ dialogRef, children }) {
  const [picked, pick, cancel] = useAdmit()
  useEffect(() => {
    const d = dialogRef.current
    d.addEventListener('close', cancel)
    return () => d.removeEventListener('close', cancel)
  })
  return (
    <dialog
      ref={dialogRef}
      id="boxoffice"
      aria-labelledby="boxoffice-title"
      data-lenis-prevent
      onClick={e => e.target === dialogRef.current && dialogRef.current.close()}
      className="boxoffice"
    >
      {/* The sign and Close stay put above the scrolling programme, so nothing ever scrolls under the button. */}
      <div className="bo-top">
        <Marquee id="boxoffice-title" small />
        <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="bo-close kicker">Close</button>
      </div>
      <div className="bo-inner" data-lenis-prevent>
        <p className="bo-lede">Pick a ticket and it takes you straight to that showing.</p>
        {GROUPS.map(g => (
          <section key={g.id} className="bo-group" aria-labelledby={`bo-${g.id}`}>
            <h3 id={`bo-${g.id}`} className="bo-screen">
              <span className="kicker">{g.screen}</span>
              <span className="bo-screen-title">{g.title}</span>
              {g.showings.length > 1 && <span className="bo-screen-line">{g.line}</span>}
            </h3>
            <ul className="bo-tickets">
              {g.showings.map(s => <Ticket key={s.id} s={s} no={s.no} picked={picked} pick={pick} />)}
            </ul>
          </section>
        ))}
        <section className="bo-all paper" aria-label="Contact and full contents">
          {children}
        </section>
      </div>
      <Status picked={picked} />
    </dialog>
  )
}
