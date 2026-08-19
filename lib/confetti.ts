/* The one moment in the editor worth celebrating: a contribution actually
   landed on GitHub. canvas-confetti is loaded on demand so nobody pays for it
   until they've earned it, and the whole thing is skipped for anyone who has
   asked their OS for less motion. */

const PALETTE = [
  "#01A6FF", // chrome blue
  "#01BBFF",
  "#FF902F", // guides
  "#FFBA01",
  "#14B87A", // tools
  "#A633D6", // concepts
]

/** above the save dialog (z-50), or the confetti lands behind the modal */
const Z_INDEX = 60

/* The fireworks tail. The demo runs for 15s; that is a long time to be pinned
   under a modal you are trying to read, so it's trimmed to a beat that still
   reads as celebration. Raise it if you disagree. */
const FIREWORKS_MS = 2800

const randomInRange = (min: number, max: number) =>
  Math.random() * (max - min) + min

type Confetti = typeof import("canvas-confetti")

/* canvas-confetti ships as CommonJS (`export =`), so a dynamic import lands
   either on the function itself or on a namespace holding it in `.default`,
   depending on how the bundler applies interop - and only the former exists in
   the type declarations. Accept both instead of betting on one. */
async function loadConfetti(): Promise<Confetti | null> {
  try {
    const mod: unknown = await import("canvas-confetti")
    const fn =
      typeof mod === "function" ? mod : (mod as { default?: unknown }).default
    return typeof fn === "function" ? (fn as Confetti) : null
  } catch {
    return null
  }
}

/** Fire the celebration. Returns a stop function - call it if the dialog
    closes mid-flight so no stray canvas keeps animating. */
export async function celebrate(): Promise<() => void> {
  if (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return () => {}
  }

  // celebration is decoration - never let it break the success screen
  const confetti = await loadConfetti()
  if (!confetti) return () => {}

  /* the "realistic look" burst: five overlapping shots with different
     spreads and decays, which reads far less mechanical than one big pop */
  const count = 200
  const burstDefaults = {
    origin: { y: 0.7 },
    zIndex: Z_INDEX,
    colors: PALETTE,
  }
  const fire = (particleRatio: number, opts: Record<string, unknown>) => {
    void confetti({
      ...burstDefaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    })
  }

  fire(0.25, { spread: 26, startVelocity: 55 })
  fire(0.2, { spread: 60 })
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
  fire(0.1, { spread: 120, startVelocity: 45 })

  /* then fireworks from both upper corners, thinning out as time runs down */
  const end = Date.now() + FIREWORKS_MS
  const fireworkDefaults = {
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: Z_INDEX,
    colors: PALETTE,
  }
  const interval = setInterval(() => {
    const timeLeft = end - Date.now()
    if (timeLeft <= 0) {
      clearInterval(interval)
      return
    }
    const particleCount = 50 * (timeLeft / FIREWORKS_MS)
    void confetti({
      ...fireworkDefaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    })
    void confetti({
      ...fireworkDefaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    })
  }, 250)

  return () => {
    clearInterval(interval)
    confetti.reset()
  }
}
