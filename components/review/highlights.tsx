"use client"

import {
  CheckCircle,
  FileCode,
  ImageSquare,
  Scissors,
  Sparkle,
  TextAa,
  Trash,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react"

import type { PrDetail } from "@/lib/github/review"
import { cn } from "@/lib/utils"

/* "What's up with this one." Everything a curator would otherwise reconstruct
   by scrolling a diff, ordered by how likely it is to change the verdict.

   These state facts and stop. A curator knows how to review; a line telling
   them to "check the photos are in focus" is noise sitting between them and the
   thing they're judging. Details only earn their place when they carry
   information the fact alone doesn't - a field name, a failing check. */

type Tone = "good" | "bad" | "warn" | "info"

type Highlight = {
  tone: Tone
  icon: typeof CheckCircle
  text: string
  detail?: string
}

export function Highlights({ detail }: { detail: PrDetail }) {
  const items = buildHighlights(detail)

  return (
    <ul className="space-y-[6px]">
      {items.map((item, i) => {
        const Icon = item.icon
        return (
          <li
            key={i}
            className={cn(
              "flex items-start gap-[8px] rounded-[9px] border px-[11px] py-[8px] text-[13px] leading-[1.5]",
              item.tone === "good" && "border-[#14B87A]/25 bg-[#f2fcf7] text-[#0a6b48]",
              item.tone === "bad" && "border-[#d43c3c]/25 bg-[#fdf4f4] text-[#a12222]",
              item.tone === "warn" && "border-[#FF902F]/30 bg-[#fff8f0] text-[#95591b]",
              item.tone === "info" && "border-black/[0.09] bg-[#fafafa] text-[#5c6470]"
            )}
          >
            <Icon size={15} weight="fill" className="mt-[2px] shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="font-semibold">{item.text}</span>
              {item.detail && <span className="opacity-80"> {item.detail}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function buildHighlights(detail: PrDetail): Highlight[] {
  const { summary, audits, checks, prose, files } = detail
  const out: Highlight[] = []

  /* 1. is this a new page or an edit - changes what you're even judging */
  const isNew = summary.entries?.some((e) => e.isNew)
  if (isNew) {
    const entry = summary.entries?.find((e) => e.isNew)
    out.push({
      tone: "info",
      icon: Sparkle,
      text: "Brand-new page.",
      detail: entry ? `${entry.contentType}/${entry.slug}` : undefined,
    })
  }

  /* 2. the mechanical gate - if this fails, nothing else matters yet */
  const bad = audits.filter((a) => !a.ok)
  if (bad.length > 0) {
    const first = bad[0]
    out.push({
      tone: "bad",
      icon: XCircle,
      text: "Frontmatter won't validate.",
      detail: `${first.issues[0]?.field}: ${first.issues[0]?.message}${
        first.issues.length > 1 ? ` (+${first.issues.length - 1} more)` : ""
      }`,
    })
  } else if (audits.length > 0) {
    out.push({ tone: "good", icon: CheckCircle, text: "Frontmatter validates." })
  }

  if (audits.some((a) => a.draft)) {
    out.push({
      tone: "warn",
      icon: WarningCircle,
      text: "Marked draft.",
      detail: "Stays hidden from listings after merge.",
    })
  }

  /* 3. CI */
  if (checks.state === "failure") {
    const failed = checks.runs.filter((r) => r.conclusion === "failure").map((r) => r.name)
    out.push({
      tone: "bad",
      icon: XCircle,
      text: "CI failed.",
      detail: failed.length ? failed.join(", ") : undefined,
    })
  } else if (checks.state === "pending") {
    out.push({ tone: "info", icon: WarningCircle, text: "CI still running." })
  }

  /* 4. how much actually changed, in words rather than lines */
  if (prose.wordsAdded || prose.wordsRemoved) {
    out.push({
      tone: "info",
      icon: TextAa,
      text:
        prose.wordsAdded && prose.wordsRemoved
          ? `About ${prose.wordsAdded} words added, ${prose.wordsRemoved} removed.`
          : prose.wordsAdded
            ? `About ${prose.wordsAdded} words of new prose.`
            : `About ${prose.wordsRemoved} words of prose removed.`,
    })
  } else if (files.length > 0) {
    out.push({ tone: "info", icon: TextAa, text: "No net prose change." })
  }

  /* 5. photos - most of a hardware guide */
  if ((summary.photoCount ?? 0) > 0) {
    out.push({
      tone: "info",
      icon: ImageSquare,
      text: `${summary.photoCount} photo${summary.photoCount === 1 ? "" : "s"} added.`,
    })
  } else if (isNew) {
    out.push({
      tone: "warn",
      icon: ImageSquare,
      text: "A new page with no photos.",
    })
  }

  /* 6. the unusual stuff */
  const removed = files.filter((f) => f.status === "removed")
  if (removed.length > 0) {
    out.push({
      tone: "warn",
      icon: Trash,
      text: `${removed.length} file${removed.length === 1 ? "" : "s"} deleted.`,
      detail: removed.map((f) => f.path.split("/").pop()).join(", "),
    })
  }
  const renamed = files.filter((f) => f.status === "renamed")
  if (renamed.length > 0) {
    out.push({
      tone: "info",
      icon: Scissors,
      text: `${renamed.length} file${renamed.length === 1 ? "" : "s"} renamed.`,
      detail: renamed.map((f) => f.path.split("/").pop()).join(", "),
    })
  }
  if (summary.touchesCode) {
    out.push({
      tone: "warn",
      icon: FileCode,
      text: "Touches files outside content/.",
    })
  }

  return out
}
