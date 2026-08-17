import './App.css'

const WORD = 'jolts'

// Every layer is the same glyph stacked in the same place, so the black outline
// and the black drop shadow fuse into one silhouette instead of reading as two
// separate shapes. Order (back -> front):
//   1. halo of the shadow copy   (white, fat stroke)
//   2. halo of the glyph         (white, fat stroke)
//   3. shadow copy               (black, thin stroke)
//   4. glyph outline             (black, thin stroke)
//   5. glyph fill                (white, no stroke)
const LAYERS = ['halo-shadow', 'halo', 'ink-shadow', 'ink', 'fill']

export default function App() {
  return (
    <main className="page">
      <div className="backdrop" aria-hidden="true" />

      <h1 className="logo" aria-label={WORD}>
        {WORD.split('').map((char, i) => (
          <span
            className="char"
            key={i}
            aria-hidden="true"
            style={{ '--i': i, '--n': WORD.length }}
          >
            {LAYERS.map((layer) => (
              <span className={`layer layer--${layer}`} key={layer}>
                {char}
              </span>
            ))}
          </span>
        ))}
      </h1>
    </main>
  )
}
