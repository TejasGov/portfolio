import { Suspense, lazy, useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { progress } from './progress'
import { CONTACT, PROJECTS, ROLES } from './content'
import { LAMP_P, PROJECT_P } from './route'

const Scene = lazy(() => import('./Scene'))

const hasWebGL = (() => {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
})()

/**
 * What surfaces along the way, each with an [in, out] window in scroll progress.
 * Lines float in the sky; cards (projects, roles, contact) sit to one side and carry real links.
 */
const BEATS = [
  { at: [0, 0.035], kind: 'name' },
  { at: [0.03, 0.068], text: 'Everything I build starts as a line I can’t stop following.' },
  { at: [0.125, 0.185], text: 'Follow enough of them, and they turn into a place.' },
  { at: [0.262, 0.315], top: true, text: 'It started here. A hilltop, a taped tennis ball, three stumps that were never quite straight.' },
  { at: [0.342, 0.39], top: true, text: 'After every match: cutting chai in a kulhad, and a long argument about who was really out.' },
  { at: [0.418, 0.462], top: true, text: 'Friday first shows. Then Interstellar happened, and I started hearing the score before the dialogue.' },
  { at: [0.468, 0.495], text: 'Some lines I followed further. These are the ones that turned into things.' },
  ...PROJECTS.map((project, i) => ({ at: [PROJECT_P[i] - 0.008, PROJECT_P[i] + 0.034], kind: 'project', project, index: i })),
  { at: [0.722, 0.742], text: 'Every place I’ve worked left a light on.' },
  ...ROLES.map((role, j) => ({ at: [LAMP_P[j] - 0.005, LAMP_P[j] + 0.012], kind: 'role', role })),
  { at: [0.845, 0.905], text: 'Right now I’m in New York. Next, I’d like to be in San Francisco.' },
  // Ends past 1 so the contact card is fully shown, and stays, at the bottom of the scroll.
  { at: [0.91, 1.1], kind: 'contact' },
]

/** Visibility of a beat at progress p: fades over the first and last quarter of its window. */
function amount(p, [a, b]) {
  const edge = (b - a) * 0.25
  return Math.min(1, Math.max(0, Math.min((p - a) / edge, (b - p) / edge)))
}

function Card({ children, className = '' }) {
  return (
    <div className={`pointer-events-auto max-w-md rounded-2xl bg-[#0b0d16]/55 p-6 backdrop-blur-md md:p-7 ${className}`}>{children}</div>
  )
}

const ext = { target: '_blank', rel: 'noreferrer' }

function Beat({ beat }) {
  if (beat.kind === 'name')
    return (
      <div className="text-center">
        <h1 className="font-serif text-[clamp(3rem,9vw,7.5rem)] leading-none italic">Tejas Govind</h1>
        <p className="mt-5 font-mono text-xs tracking-[0.2em] uppercase opacity-70">scroll, slowly</p>
      </div>
    )
  if (beat.kind === 'project') {
    const p = beat.project
    return (
      <Card className="md:mr-auto md:ml-[6vw]">
        <p className="font-mono text-[11px] tracking-[0.16em] uppercase opacity-70">
          {String(beat.index + 1).padStart(2, '0')} · {p.category}
        </p>
        <h2 className="mt-3 font-serif text-[clamp(2.2rem,4vw,3.4rem)] leading-none italic">{p.title}</h2>
        <p className="mt-4 text-lg leading-snug opacity-90">{p.line}</p>
        <p className="mt-4 font-mono text-[11px] leading-relaxed opacity-60">{p.tech}</p>
        <div className="mt-5 flex flex-wrap gap-4 font-mono text-xs tracking-[0.1em] uppercase">
          {p.link && <a href={p.link} {...ext} className="underline-offset-4 hover:underline">{p.linkLabel} ↗</a>}
          {p.github && <a href={p.github} {...ext} className="underline-offset-4 hover:underline">Source ↗</a>}
        </div>
      </Card>
    )
  }
  if (beat.kind === 'role') {
    const r = beat.role
    return (
      <Card className="md:mr-[6vw] md:ml-auto">
        <p className="font-mono text-[11px] tracking-[0.16em] uppercase opacity-70">
          {r.period} · {r.place}
        </p>
        <h2 className="mt-3 font-serif text-[clamp(1.9rem,3.4vw,2.8rem)] leading-none italic">{r.role}</h2>
        <p className="mt-1 text-lg opacity-85">{r.org}</p>
        <p className="mt-4 leading-snug opacity-80">{r.impact}</p>
      </Card>
    )
  }
  if (beat.kind === 'contact')
    return (
      <Card className="text-center md:max-w-lg">
        <h2 className="font-serif text-[clamp(2.4rem,5vw,4rem)] leading-none italic">Let’s build something.</h2>
        <a href={`mailto:${CONTACT.email}`} className="mt-6 inline-block rounded-full bg-[#f3efe6] px-6 py-3 font-medium text-[#0b0d16] transition-transform hover:-translate-y-0.5">
          {CONTACT.email}
        </a>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-xs tracking-[0.1em] uppercase">
          {CONTACT.links.map(l => (
            <li key={l.label}>
              <a href={l.href} {...ext} className="underline-offset-4 hover:underline">{l.label} ↗</a>
            </li>
          ))}
          <li>
            <a href="/os/" className="underline-offset-4 hover:underline">The 2023 site →</a>
          </li>
        </ul>
      </Card>
    )
  return (
    <p className={`max-w-3xl text-center font-serif text-[clamp(1.75rem,4vw,3.25rem)] leading-tight italic [text-shadow:0_2px_24px_rgb(0_0_0/0.35)] ${beat.top ? 'pt-[14svh]' : ''}`}>
      {beat.text}
    </p>
  )
}

function Beats() {
  const refs = useRef([])
  useEffect(() => {
    let raf
    const tick = () => {
      const p = progress.current
      BEATS.forEach((b, i) => {
        const el = refs.current[i]
        if (!el) return
        const k = amount(p, b.at)
        const rising = p < (b.at[0] + b.at[1]) / 2
        el.style.opacity = k.toFixed(3)
        el.style.transform = `translateY(${((1 - k) * (rising ? 16 : -16)).toFixed(1)}px)`
        el.style.filter = k > 0.99 ? 'none' : `blur(${((1 - k) * 6).toFixed(1)}px)`
        // Hidden cards leave the tab order, so keyboard users only meet links they can see.
        el.inert = k < 0.5
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-10 grid place-items-center px-5 pb-[8svh] md:pb-0">
      {BEATS.map((b, i) => {
        const card = b.kind === 'project' || b.kind === 'role'
        return (
          <div
            key={i}
            ref={el => (refs.current[i] = el)}
            className={`col-start-1 row-start-1 flex w-full justify-center opacity-0 ${card ? 'self-end md:self-center' : ''} ${b.top ? 'self-start' : ''}`}
          >
            <Beat beat={b} />
          </div>
        )
      })}
    </div>
  )
}

export default function App() {
  const veil = useRef(null)

  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight
      progress.target = max > 0 ? Math.min(1, scrollY / max) : 0
    }
    update()
    addEventListener('scroll', update, { passive: true })
    addEventListener('resize', update)
    const lenis = matchMedia('(prefers-reduced-motion: reduce)').matches ? null : new Lenis({ lerp: 0.08, autoRaf: true })
    return () => {
      removeEventListener('scroll', update)
      removeEventListener('resize', update)
      lenis?.destroy()
    }
  }, [])

  return (
    <>
      {hasWebGL ? (
        <Suspense fallback={null}>
          <Scene veil={veil} />
        </Suspense>
      ) : (
        <p className="fixed inset-x-0 bottom-10 text-center font-mono text-xs opacity-70">This world needs WebGL2 to render.</p>
      )}
      {/* The bright haze you pass through inside the orb; opacity is driven by the camera rig. */}
      <div ref={veil} className="pointer-events-none fixed inset-0 z-20 bg-[#e6eeff] opacity-0" aria-hidden="true" />
      <main className="relative">
        <Beats />
        {/* The scroll runway: long on purpose, the journey is meant to be taken slowly. */}
        <div style={{ height: '3200svh' }} aria-hidden="true" />
      </main>
    </>
  )
}
