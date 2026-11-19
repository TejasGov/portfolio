import { HOME, ORB_LINKS, ORB_MARKS, WORK_NOTES } from './anchors'

/*
 * The HUD is plain DOM over the canvas (crisp text at any DPR). This component only renders the
 * nodes; the stage's projector moves them every frame. data-* attributes tell it what to track.
 */
function Bracket() {
  return <span className="hud-dot" />
}

export default function Hud() {
  return (
    <div className="hud pointer-events-none fixed inset-0 z-[5]" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full">
        {ORB_LINKS.map((_, i) => (
          <line key={i} data-hud-link={i} className="hud-link" />
        ))}
      </svg>
      {ORB_MARKS.map(m => (
        <div key={m.id} data-hud="orb" data-id={m.id} className="hud-mark">
          <Bracket />
          <span className="hud-box">
            <span className="hud-label" />
          </span>
        </div>
      ))}
      <div data-hud="home" className="hud-mark hud-home">
        <Bracket />
        <span className="hud-box">
          <span className="hud-label">
            {HOME.lat.toFixed(4)}° N, {HOME.lon.toFixed(4)}° E
          </span>
        </span>
      </div>
      {WORK_NOTES.map((notes, s) =>
        notes.map((n, k) => (
          <div key={`${s}-${k}`} data-hud="work" data-shape={s} data-note={k} className="hud-mark hud-note">
            <Bracket />
            <span className="hud-box">
              <span className="hud-label">{n.text}</span>
            </span>
          </div>
        )),
      )}
    </div>
  )
}
