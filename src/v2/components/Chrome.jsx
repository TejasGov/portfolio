import { useRef } from 'react'
import { chapters } from '@/v2/data/chapters'
import { goTo } from '@/v2/lib/scroll'

function jump(event, id, after) {
  event.preventDefault()
  after?.()
  goTo(id)
}

/** Fixed UI over the story: name + current act (top), chapter index dialog, act progress bars (bottom). */
export default function Chrome({ active }) {
  const dialogRef = useRef(null)
  const current = chapters.find(c => c.id === active) ?? chapters[0]
  const close = () => dialogRef.current?.close()

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-4 p-4 md:p-6">
        <a href="#boot" onClick={e => jump(e, 'boot')} className="caption flex items-center gap-2 font-medium">
          <span className="size-2.5 rounded-full bg-accent" aria-hidden="true" />
          Tejas Govind
        </a>
        <p className="caption hidden opacity-70 sm:block">
          <span aria-hidden="true">## </span>act {current.act} · {current.label}
        </p>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          aria-haspopup="dialog"
          className="caption rounded-full bg-paper px-4 py-2 font-medium text-ink shadow-[0_0_0_1.5px_var(--ink)] transition-transform hover:-translate-y-0.5"
        >
          index ≡
        </button>
      </header>

      <dialog
        ref={dialogRef}
        aria-label="Chapter index"
        onClick={e => e.target === dialogRef.current && close()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl bg-paper p-0 text-ink shadow-[0_0_0_1.5px_var(--ink),8px_8px_0_var(--ink)] backdrop:bg-ink/40"
      >
        <div className="p-6 md:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="caption">Index</h2>
            <button type="button" onClick={close} autoFocus className="caption underline-offset-4 hover:underline">
              close ✕
            </button>
          </div>
          <ol className="space-y-1">
            {chapters.map(c => (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  aria-current={c.id === active ? 'true' : undefined}
                  onClick={e => jump(e, c.id, close)}
                  className="group flex items-baseline gap-4 rounded-xl px-3 py-2 hover:bg-ink/5 aria-[current]:bg-ink/5"
                >
                  <span className="caption w-6 opacity-60">{c.act}</span>
                  <span className="text-2xl font-light group-aria-[current]:font-semibold">{c.label}</span>
                  <span
                    className="ml-auto size-3 shrink-0 rounded-full shadow-[0_0_0_1.5px_var(--ink)]"
                    style={{ background: c.field }}
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ol>
        </div>
      </dialog>

      <nav aria-label="Chapters" className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 md:p-6">
        <ol className="flex gap-1.5">
          {chapters.map(c => (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                aria-current={c.id === active ? 'true' : undefined}
                onClick={e => jump(e, c.id)}
                className="act-bar group block py-2"
              >
                <span className="sr-only">
                  Act {c.act}: {c.label}
                </span>
                <span className="act-bar-track" aria-hidden="true">
                  <span className="act-bar-fill" style={{ animationTimeline: `--ch-${c.id}` }} />
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
