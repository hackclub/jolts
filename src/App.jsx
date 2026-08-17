import './App.css'

const WORD = 'jolts'

// The wordmark is painted in three full-word passes rather than as five
// self-contained character stacks: every character's halo goes down, then every
// character's ink, then every fill.
//
// Painting pass-by-pass instead of character-by-character is what welds
// neighbouring outlines into one continuous silhouette. With per-character
// stacks, the next character's white halo paints straight over the previous
// character's black outline and cuts a seam between them.
//
// Within a pass, `shadow` is the offset copy and `base` sits on top of it - both
// are the same colour, so they fuse into a single shape.
const PASSES = [
  { key: 'halo', copies: ['shadow', 'base'] },
  { key: 'ink', copies: ['shadow', 'base'] },
  { key: 'fill', copies: ['base'] },
]

export default function App() {
  return (
    <main className="page">
      <div className="backdrop" aria-hidden="true" />
      <div className="haze" aria-hidden="true" />

      <h1 className="logo" aria-label={WORD}>
        {PASSES.map(({ key, copies }) => (
          <span className={`pass pass--${key}`} key={key} aria-hidden="true">
            {WORD.split('').map((char, i) => (
              // every pass repeats the same characters with the same delay, so
              // the three passes float in lockstep and never come apart
              <span className="char" key={i} style={{ '--i': i }}>
                {copies.map((copy) => (
                  <span className={`copy copy--${copy}`} key={copy}>
                    {char}
                  </span>
                ))}
              </span>
            ))}
          </span>
        ))}
      </h1>
    </main>
  )
}
