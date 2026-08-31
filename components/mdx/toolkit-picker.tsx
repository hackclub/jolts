"use client"

import { useId, useState } from "react"

import { ArrowUpRight } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"

import { CheckerFrame, type FrameTheme } from "@/components/checker-frame"

/* Three questions, one recommended set of apps.

   A beginner opening "what software do I need?" gets a wall of names -
   KiCad, EasyEDA, Thonny, Arduino, Onshape - and no way to tell which
   of them is for them. The picker narrows it to one app per job.

   The questions come from the MDX so the page can reword them; the apps
   and the rules live here, in PICKS and readTraits. The two meet at the
   question ids (device / lang / pref) and at keywords in the option text
   ("chromebook", "phone", "python"), matched loosely so rewording an
   option doesn't silently change the answer - see readTraits. */

export type ToolkitQuestion = {
  /** must be one of the ids readTraits reads: device, lang, pref */
  id: string
  prompt: string
  options: string[]
}

type Answers = Record<string, string>

/* ---------- the apps ---------- */

type App = {
  name: string
  href: string
  /** one line: what it is and why it's the pick */
  why: string
  /** the second half of a pairing, e.g. the editor a language needs */
  also?: { name: string; href: string; why: string }
  /** the honest caveat, when the pick is a compromise */
  caveat?: string
}

const KICAD = {
  name: "KiCad",
  href: "https://www.kicad.org/",
  why: "Free, open source, and what most people around here draw their boards in.",
}

const EASYEDA = {
  name: "EasyEDA",
  href: "https://easyeda.com/",
  why: "Runs in a browser tab, and its parts library is the same shop that will make your board.",
}

const CIRCUITPYTHON = {
  name: "CircuitPython",
  href: "https://circuitpython.org/",
  why: "The board turns up as a USB drive. You edit code.py, hit save, and it runs.",
}

const THONNY = {
  name: "Thonny",
  href: "https://thonny.org/",
  why: "A small editor that talks to the board and gives you a Python prompt on it.",
}

const CP_WEB_EDITOR = {
  name: "the CircuitPython web editor",
  href: "https://code.circuitpython.org/",
  why: "Edits the board straight from Chrome, so nothing needs installing.",
}

const ARDUINO = {
  name: "Arduino IDE",
  href: "https://www.arduino.cc/en/software",
  why: "C++, and the biggest pile of example code and libraries you'll find.",
}

const ARDUINO_CLOUD = {
  name: "Arduino Cloud Editor",
  href: "https://www.arduino.cc/en/software",
  why: "The same C++ and the same libraries, in a browser tab.",
}

/* No Tinkercad, ever: it can't export STEP, so nothing drawn in it can
   move on to another CAD tool, a printing service, or your board's 3D
   view. Every pick below exports STEP. */
const ONSHAPE = {
  name: "Onshape",
  href: "https://www.onshape.com/",
  why: "Proper CAD in a browser tab - sketches, constraints, the real thing.",
  caveat: "The free plan makes your designs public.",
}

const FREECAD = {
  name: "FreeCAD",
  href: "https://www.freecad.org/",
  why: "Proper CAD you install and keep. Free and open source.",
}

/* ---------- what the answers mean ---------- */

type Traits = {
  /** browser apps only, by necessity or by choice */
  browser: boolean
  /** said no to browser apps - the one answer that rules them out */
  avoidsBrowser: boolean
  phone: boolean
  codes: "python" | "other" | "none"
}

/* Keyword matching, not exact strings: the page owns the wording, so
   "School Chromebook" and "a Chromebook I don't own" must land the same. */
function readTraits(answers: Answers): Traits {
  const device = answers.device ?? ""
  const lang = answers.lang ?? ""
  const pref = answers.pref ?? ""

  const phone = /phone|tablet|ipad/i.test(device)
  const chromebook = /chromebook/i.test(device)

  return {
    browser: phone || chromebook || /^y/i.test(pref),
    avoidsBrowser: !phone && !chromebook && /^n/i.test(pref),
    phone,
    codes: /python/i.test(lang)
      ? "python"
      : /^n/i.test(lang)
        ? "none"
        : "other",
  }
}

/* ---------- the rules ---------- */

/* One pick per job, and the job names match this page's own sections. */
const PICKS: { job: string; pick: (t: Traits) => App }[] = [
  {
    job: "Circuit boards",
    pick: (t) => {
      if (t.phone) {
        return {
          ...EASYEDA,
          caveat:
            "Board design on a phone screen is rough. Read on for now, and come back to this bit on a laptop or a Chromebook.",
        }
      }
      return t.browser ? EASYEDA : KICAD
    },
  },
  {
    job: "Code",
    pick: (t) => {
      if (t.codes === "other") return t.browser ? ARDUINO_CLOUD : ARDUINO
      return {
        ...CIRCUITPYTHON,
        why:
          t.codes === "none"
            ? "Nothing to set up: the board turns up as a USB drive, you edit code.py, and it runs."
            : CIRCUITPYTHON.why,
        also: t.browser ? CP_WEB_EDITOR : THONNY,
      }
    },
  },
  {
    job: "3D parts",
    pick: (t) => {
      if (t.avoidsBrowser) return FREECAD
      if (t.phone) {
        return {
          ...ONSHAPE,
          caveat:
            "It loads on a phone, but drawing a case on one is a fight. Worth waiting for a bigger screen.",
        }
      }
      return ONSHAPE
    },
  },
]

/* ---------- the block ---------- */

/* Site pages borrow the guides family (see lib/theme), and --guide-accent
   is set on the article wrapper, so the numerals pick up whichever type
   the page belongs to. */
const frame: FrameTheme = {
  frame: "var(--jt-guides-frame)",
  checkerA: "var(--jt-guides-checker-a)",
  checkerB: "var(--jt-guides-checker-b)",
  wash: "var(--jt-guides-wash)",
}

const ACCENT = "var(--guide-accent, var(--jt-guides-accent))"

/* The picks spring open and fade in together, so the panel growing and
   the text arriving read as one movement. The frame's checker is pinned to
   its top edge (see CheckerFrame) so the pattern doesn't slide while the
   panel moves. */
const OPEN = {
  height: { type: "spring", stiffness: 420, damping: 38 },
  opacity: { duration: 0.18, ease: [0.3, 0, 0, 1] },
} as const

function AppLink({ app }: { app: App }) {
  return (
    <a
      href={app.href}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-baseline gap-[3px] font-semibold text-[var(--jt-ink)] no-underline"
    >
      <span className="underline decoration-[var(--jt-line-strong)] decoration-[1.5px] underline-offset-[3px] transition-colors duration-150 group-hover:decoration-[var(--jt-ink)]">
        {app.name}
      </span>
      <ArrowUpRight
        size={12}
        weight="bold"
        className="shrink-0 self-center text-[var(--jt-faint)] transition-transform duration-150 group-hover:translate-x-[1px] group-hover:-translate-y-[1px] group-hover:text-[var(--jt-ink)]"
        aria-hidden
      />
    </a>
  )
}

export function ToolkitPicker({ questions }: { questions: ToolkitQuestion[] }) {
  const [answers, setAnswers] = useState<Answers>({})
  const groupId = useId()

  const done = questions.length > 0 && questions.every((q) => answers[q.id])
  const traits = readTraits(answers)

  return (
    <CheckerFrame
      theme={frame}
      className="my-[30px] shadow-[0px_4px_14px_-2px_rgba(0,0,0,0.18)]"
      checkerSize={150}
      pinned
    >
      <div className="relative rounded-[7px] bg-[var(--jt-surface)]">
        <div className="px-[16px] py-[14px]">
          {/* radiogroups, not fieldsets: a floated legend fights the chip
              row's wrapping */}
          <div className="flex flex-col gap-[14px]">
            {questions.map((q, i) => (
              <div
                key={q.id}
                role="radiogroup"
                aria-labelledby={`${groupId}-${q.id}`}
              >
                <p
                  id={`${groupId}-${q.id}`}
                  className="!m-0 flex items-baseline gap-[8px] text-[14.5px] font-semibold tracking-[-0.02em] text-[var(--jt-ink)]"
                >
                  <span
                    className="w-[11px] shrink-0 text-right text-[11.5px] tabular-nums transition-colors duration-200"
                    style={{
                      color: answers[q.id] ? ACCENT : "var(--jt-fainter)",
                    }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  {q.prompt}
                </p>
                <div className="mt-[7px] flex flex-wrap gap-[7px] pl-[19px]">
                  {q.options.map((option) => {
                    const active = answers[q.id] === option
                    return (
                      <label
                        key={option}
                        className={
                          "cursor-pointer rounded-full border px-[12px] py-[5px] text-[13.5px] tracking-[-0.01em] transition-colors duration-150 " +
                          (active
                            ? "border-transparent bg-[var(--jt-ink)] text-[var(--jt-page)]"
                            : "border-[var(--jt-line)] bg-[var(--jt-surface)] text-[var(--jt-body)] hover:border-[var(--jt-line-hover)]")
                        }
                      >
                        <input
                          type="radio"
                          name={`${groupId}-${q.id}`}
                          value={option}
                          checked={active}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: option }))
                          }
                          className="sr-only"
                        />
                        {option}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {done && (
              /* height on the wrapper, spacing on the child: a collapsing
                 element can't carry the margin it's meant to collapse */
              <motion.div
                key="picks"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={OPEN}
                className="overflow-hidden"
              >
                <div className="mt-[16px] border-t border-[var(--jt-line-soft)] pt-[14px]">
                  <div className="flex items-baseline justify-between gap-[12px]">
                    <p className="!m-0 text-[14.5px] font-semibold tracking-[-0.02em] text-[var(--jt-ink)]">
                      Install these three
                    </p>
                    <button
                      type="button"
                      onClick={() => setAnswers({})}
                      className="cursor-pointer text-[13px] tracking-[-0.01em] text-[var(--jt-faint)] transition-colors duration-150 hover:text-[var(--jt-ink)]"
                    >
                      Start over
                    </button>
                  </div>
                  <ul className="!mt-[10px] !mb-0 grid !list-none gap-[10px] !p-0">
                    {PICKS.map(({ job, pick }) => {
                      const app = pick(traits)
                      return (
                        <li
                          key={job}
                          className="!m-0 grid gap-x-[14px] gap-y-[2px] sm:grid-cols-[92px_minmax(0,1fr)]"
                        >
                          <span className="pt-[1px] text-[12.5px] leading-[1.4] tracking-[-0.01em] text-[var(--jt-faint)]">
                            {job}
                          </span>
                          <span className="text-[14.5px] leading-[1.55] tracking-[-0.01em] text-[var(--jt-muted)]">
                            <AppLink app={app} /> {app.why}
                            {app.also && (
                              <>
                                {" "}
                                Write it in <AppLink app={app.also} />
                                {" - "}
                                {app.also.why.charAt(0).toLowerCase() +
                                  app.also.why.slice(1)}
                              </>
                            )}
                            {app.caveat && (
                              <span className="mt-[1px] block text-[13px] text-[var(--jt-faint)]">
                                {app.caveat}
                              </span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </CheckerFrame>
  )
}
