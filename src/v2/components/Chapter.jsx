import { lazy, Suspense, useState } from 'react'
import { contact, sampleLabels } from '@/v2/data/chapters'
import { hasWebGL } from '@/v2/lib/webgl'
import PixelDisplaceField from '@/v2/components/pixel-perfect/pixel-displace-field'

const SceneView = lazy(() => import('@/v2/three/SceneView'))

/** 3D still life for chapters that have objects; the CSS sketch everywhere else (and without WebGL). */
function Tableau({ id, note, objects }) {
  const [index, setIndex] = useState(0)
  if (!objects || !hasWebGL) return <TableauSketch note={note} />
  const key = objects[index]
  return (
    <figure className="flex flex-col items-center gap-2" aria-hidden="true">
      <Suspense fallback={<TableauSketch note={note} />}>
        <SceneView className="h-[min(62svh,560px)] w-full" objects={objects} sectionId={id} onIndex={setIndex} />
      </Suspense>
      <figcaption className="caption opacity-70">
        sample {String(index).padStart(3, '0')} — {sampleLabels[key]}
      </figcaption>
    </figure>
  )
}

/** Stand-in for the Phase 2 3D tableau: an inked orb on a plinth. */
function TableauSketch({ note }) {
  return (
    <figure className="flex flex-col items-center gap-3" aria-hidden="true">
      <div className="tableau-orb size-28 rounded-full bg-paper shadow-[0_0_0_2px_var(--ink),inset_-10px_-12px_0_color-mix(in_srgb,var(--ink)_14%,transparent)] md:size-40" />
      <div className="h-16 w-36 rounded-sm bg-paper shadow-[0_0_0_2px_var(--ink),inset_0_-10px_0_color-mix(in_srgb,var(--ink)_10%,transparent)] md:h-20 md:w-48" />
      <figcaption className="caption mt-2 max-w-56 text-center opacity-70">tableau — {note}</figcaption>
    </figure>
  )
}

export default function Chapter({ chapter, shown }) {
  const { id, caption, title, line, tableau, accent, objects, height = '170svh' } = chapter
  const isInterval = id === 'interval'
  // Boot carries the page's only h1 (the name); every other act is an h2.
  const Heading = id === 'boot' ? 'h1' : 'h2'

  return (
    // Tall section + sticky stage gives each act dwell time; the 3D tableau scrubs against this runway.
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-title`} className="chapter relative outline-none" style={{ minHeight: height, viewTimeline: `--ch-${id}` }}>
      <div className="sticky top-0 grid min-h-svh items-center gap-10 px-6 pt-24 pb-24 md:grid-cols-[1.2fr_1fr] md:px-12">
        {id === 'boot' && <PixelDisplaceField className="absolute inset-0 -z-10 opacity-50" />}
        <div className={`t-stagger ${shown ? 'is-shown' : ''} ${isInterval ? 'text-center md:col-span-2' : ''}`}>
          <p className="t-stagger-line caption mb-5 opacity-80">{caption}</p>
          <Heading id={`${id}-title`} className={`t-stagger-line t-stagger-line--2 act-title ${isInterval ? 'text-[clamp(4rem,16vw,14rem)]' : 'text-[clamp(3rem,9vw,8rem)]'}`}>
            {title}
          </Heading>
          <p className={`t-stagger-line t-stagger-line--3 mt-6 max-w-2xl text-[clamp(1.5rem,3.2vw,2.5rem)] leading-tight font-light ${isInterval ? 'mx-auto' : ''}`}>
            {line[0]}{' '}
            <em className="font-serif" style={{ color: accent ?? 'var(--accent)' }}>
              {line[1]}.
            </em>
          </p>

          {id === 'deploy' && (
            <div className="t-stagger-line t-stagger-line--4 mt-10 space-y-6">
              <a href={`mailto:${contact.email}`} className="inline-block rounded-full bg-paper px-6 py-3 text-lg font-medium text-ink transition-transform hover:-translate-y-0.5">
                {contact.email} →
              </a>
              <ul className="caption flex flex-wrap gap-x-6 gap-y-2">
                {contact.links.map(l => (
                  <li key={l.label}>
                    <a href={l.href} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      {l.label} ↗
                    </a>
                  </li>
                ))}
                <li>
                  <a href="/os/" className="underline-offset-4 hover:underline">
                    The 2023 site →
                  </a>
                </li>
              </ul>
            </div>
          )}
        </div>

        {tableau && <Tableau id={id} note={tableau} objects={objects} />}
      </div>
    </section>
  )
}
