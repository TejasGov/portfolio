import { useMemo } from 'react'

/**
 * A display title whose letters fly in from scattered positions and settle (CSS transitions),
 * whenever an ancestor carries data-on="1" — set by useBeats, or always on when `standalone`.
 * Words never break mid-word; screen readers get the plain text.
 * parts: [['Things I ', false], ['built', true]] — the boolean marks the heavy word (index.css .title-heavy);
 * the rest is set light. Titles are upright expanded capitals; the weight pair is the emphasis.
 */
export default function Assemble({ parts, as: Tag = 'span', className = '', standalone = false, id }) {
  const text = parts.map(p => p[0]).join('')
  const letters = useMemo(() => {
    let seed = text.length * 97 + 13
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    let n = 0
    return parts.map(([chunk, heavy]) =>
      chunk.split(/(\s+)/).map(word => ({
        space: /^\s+$/.test(word),
        word,
        heavy,
        chars: word.split('').map(ch => ({
          ch,
          style: {
            '--tx': `${Math.round((rand() - 0.5) * 220)}px`,
            '--ty': `${Math.round((rand() - 0.5) * 160)}px`,
            '--tr': `${Math.round((rand() - 0.5) * 80)}deg`,
            '--d': `${(n++ * 0.028 + rand() * 0.12).toFixed(3)}s`,
          },
        })),
      })),
    )
  }, [parts, text])

  return (
    <Tag id={id} className={`assemble ${className}`} data-on={standalone ? '1' : undefined} aria-label={text}>
      {letters.flat().map((w, i) =>
        w.space ? (
          ' '
        ) : (
          <span key={i} className={`inline-block whitespace-nowrap ${w.heavy ? 'title-heavy' : ''}`} aria-hidden="true">
            {w.chars.map((c, k) => (
              <span key={k} className="assemble-letter" style={c.style}>
                {c.ch}
              </span>
            ))}
          </span>
        ),
      )}
    </Tag>
  )
}
