"use client"

import { useState } from "react"

import {
  CheckCircle,
  ChatCircleText,
  CircleNotch,
  GitMerge,
  PencilSimpleLine,
  WarningCircle,
} from "@phosphor-icons/react"

import { postMerge, postVerdict } from "@/lib/review/client"
import type { PrDetail } from "@/lib/github/review"
import { cn } from "@/lib/utils"

/* The verdict. Sticky at the bottom of the review so ruling on a pull request
   never means scrolling back up, and posted as the curator's own GitHub review
   so github.com stays the record of truth - jolts is a nicer window onto it,
   not a second system to keep in sync. */

type Choice = "APPROVE" | "REQUEST_CHANGES" | "COMMENT"

const CHOICES: {
  id: Choice
  label: string
  icon: typeof CheckCircle
  active: string
  hint: string
}[] = [
  {
    id: "APPROVE",
    label: "Approve",
    icon: CheckCircle,
    active: "bg-[#0d9c6b] text-white",
    hint: "Anything to add? (optional)",
  },
  {
    id: "REQUEST_CHANGES",
    label: "Request changes",
    icon: PencilSimpleLine,
    active: "bg-[#d43c3c] text-white",
    hint: "What needs fixing?",
  },
  {
    id: "COMMENT",
    label: "Comment",
    icon: ChatCircleText,
    active: "bg-[#16181d] text-white",
    hint: "Your note…",
  },
]

export function VerdictBar({
  detail,
  onDone,
}: {
  detail: PrDetail
  onDone: () => void
}) {
  const [choice, setChoice] = useState<Choice | null>(null)
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState<"verdict" | "merge" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const number = detail.summary.number
  const chosen = CHOICES.find((c) => c.id === choice)
  const needsBody = choice === "REQUEST_CHANGES" || choice === "COMMENT"
  const canSubmit = Boolean(choice) && (!needsBody || body.trim().length > 0)

  const approved = detail.reviews.some((r) => r.state === "APPROVED")
  const mergeBlocked = detail.mergeable === false

  const submit = async () => {
    if (!choice) return
    setBusy("verdict")
    setError(null)
    try {
      await postVerdict(number, choice, body.trim())
      setDone(
        choice === "APPROVE"
          ? "Approved."
          : choice === "REQUEST_CHANGES"
            ? "Changes requested."
            : "Comment posted."
      )
      setBody("")
      setChoice(null)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const merge = async () => {
    setBusy("merge")
    setError(null)
    try {
      const res = await postMerge(number, detail.summary.title, body.trim())
      setDone(res.merged ? "Merged. It's live once the deploy finishes." : "GitHub declined the merge.")
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="sticky bottom-0 z-20 mt-[26px] -mx-[28px] border-t border-black/[0.09] bg-white/95 px-[28px] py-[14px] backdrop-blur-md">
      {detail.myLastVerdict && (
        <p className="mb-[9px] text-[12px] text-[#9aa1ab]">
          You last left{" "}
          <span className="font-semibold text-[#5c6470]">
            {detail.myLastVerdict.toLowerCase().replace(/_/g, " ")}
          </span>{" "}
          on this one.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-[7px]">
        {CHOICES.map((c) => {
          const Icon = c.icon
          const active = choice === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setChoice(active ? null : c.id)}
              disabled={busy !== null}
              className={cn(
                "flex items-center gap-[6px] rounded-[9px] px-[12px] py-[7px] text-[13.5px] font-semibold tracking-[-0.01em] transition-colors disabled:opacity-50",
                active
                  ? c.active
                  : "border border-black/12 bg-white text-[#5c6470] hover:border-black/25 hover:text-[#16181d]"
              )}
            >
              <Icon size={15} weight="bold" aria-hidden />
              {c.label}
            </button>
          )
        })}

        <div className="ml-auto flex items-center gap-[7px]">
          {!approved && (
            <span className="text-[12px] text-[#9aa1ab]">Nobody has approved yet</span>
          )}
          <button
            type="button"
            onClick={merge}
            disabled={busy !== null || mergeBlocked}
            title={
              mergeBlocked
                ? `GitHub says this can't merge right now (${detail.mergeableState})`
                : "Squash and merge"
            }
            className={cn(
              "flex items-center gap-[6px] rounded-[9px] px-[13px] py-[7px] text-[13.5px] font-semibold tracking-[-0.01em] text-white transition-colors",
              mergeBlocked
                ? "cursor-not-allowed bg-black/[0.12] text-black/35"
                : "bg-[#6f42c1] hover:bg-[#5c37a1]"
            )}
          >
            {busy === "merge" ? (
              <CircleNotch size={15} weight="bold" className="animate-spin" aria-hidden />
            ) : (
              <GitMerge size={15} weight="bold" aria-hidden />
            )}
            Squash &amp; merge
          </button>
        </div>
      </div>

      {chosen && (
        <div className="mt-[10px]">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            autoFocus
            placeholder={chosen.hint}
            className="w-full resize-y rounded-[10px] border border-black/12 px-[12px] py-[9px] text-[14px] leading-[1.55] outline-none placeholder:text-[#c3c8ce] focus:border-[#01A6FF]"
          />
          <div className="mt-[8px] flex items-center gap-[9px]">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || busy !== null}
              className={cn(
                "flex items-center gap-[7px] rounded-[9px] px-[14px] py-[7px] text-[13.5px] font-semibold tracking-[-0.01em] transition-colors",
                canSubmit && busy === null
                  ? "bg-[#16181d] text-white hover:bg-black"
                  : "cursor-not-allowed bg-black/[0.06] text-black/30"
              )}
            >
              {busy === "verdict" && (
                <CircleNotch size={15} weight="bold" className="animate-spin" aria-hidden />
              )}
              Submit {chosen.label.toLowerCase()}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-[9px] flex items-start gap-[7px] rounded-[9px] border border-[#d43c3c]/25 bg-[#fdecec] px-[11px] py-[8px] text-[12.5px] leading-[1.5] text-[#a12222]">
          <WarningCircle size={14} weight="fill" className="mt-[2px] shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {done && !error && (
        <p className="mt-[9px] flex items-center gap-[6px] text-[12.5px] font-medium text-[#067A54]">
          <CheckCircle size={14} weight="fill" aria-hidden />
          {done}
        </p>
      )}
    </div>
  )
}
