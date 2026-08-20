"use client"

import { useEffect, useState } from "react"

import Link from "next/link"

import {
  ArrowRight,
  CircleNotch,
  Cube,
  FileCode,
  ImageSquare,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react"

import { fetchQueue } from "@/lib/review/client"
import type { PrSummary } from "@/lib/github/review"
import { typeTheme } from "@/lib/theme"

/* The queue. Sorted by what a curator actually triages on rather than by PR
   number: which entry it touches, whether it is a brand-new page or an edit,
   how much prose changed, how many photos came with it, and whether it strays
   outside content/ - that last one being the flag that says "read this like
   code, not like a guide". */

export function ReviewQueue() {
  const [prs, setPrs] = useState<PrSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQueue()
      .then((r) => setPrs(r.prs))
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) {
    return (
      <p className="flex items-start gap-[8px] rounded-[10px] border border-[#d43c3c]/25 bg-[#fdecec] px-[13px] py-[10px] text-[13.5px] leading-[1.5] text-[#a12222]">
        <WarningCircle size={16} weight="fill" className="mt-[2px] shrink-0" aria-hidden />
        {error}
      </p>
    )
  }

  if (!prs) {
    return (
      <p className="flex items-center gap-[9px] py-[24px] text-[14px] text-[#9aa1ab]">
        <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden />
        Loading the queue…
      </p>
    )
  }

  if (prs.length === 0) {
    return (
      <div className="rounded-[12px] border border-black/[0.08] bg-[#fafafa] px-[18px] py-[28px] text-center">
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#16181d]">
          Nothing waiting
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-[10px]">
      {prs.map((pr) => (
        <QueueRow key={pr.number} pr={pr} />
      ))}
    </ul>
  )
}

function QueueRow({ pr }: { pr: PrSummary }) {
  const entry = pr.entries?.[0]
  const theme = entry ? typeTheme[entry.contentType] : null
  const extra = (pr.entries?.length ?? 0) - 1

  return (
    <li>
      <Link
        href={`/review/${pr.number}`}
        className="group block rounded-[12px] border border-black/[0.09] bg-white px-[15px] py-[12px] transition-all hover:border-black/20 hover:shadow-[0px_3px_12px_-4px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-start gap-[12px]">
          {/* entry-type stripe: the fastest read of "what is this" */}
          <span
            aria-hidden
            className="mt-[3px] h-[34px] w-[4px] shrink-0 rounded-full"
            style={{ background: theme?.accent ?? "#c3c8ce" }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[8px]">
              {entry && theme && (
                <span
                  className="shrink-0 rounded-[5px] px-[6px] py-[1.5px] text-[10.5px] font-semibold tracking-[0.02em] uppercase"
                  style={{ background: theme.tint, color: theme.accent }}
                >
                  {entry.isNew ? `new ${theme.label}` : theme.label}
                </span>
              )}
              {entry?.isNew && (
                <Sparkle size={13} weight="fill" className="shrink-0 text-[#FFBA01]" aria-hidden />
              )}
              {pr.draft && (
                <span className="shrink-0 rounded-[5px] bg-black/[0.06] px-[6px] py-[1.5px] text-[10.5px] font-semibold tracking-[0.02em] text-[#5c6470] uppercase">
                  draft
                </span>
              )}
              {pr.touchesCode && (
                <span
                  title="Changes files outside content/"
                  className="flex shrink-0 items-center gap-[3px] rounded-[5px] bg-[#fdecec] px-[6px] py-[1.5px] text-[10.5px] font-semibold tracking-[0.02em] text-[#a12222] uppercase"
                >
                  <FileCode size={11} weight="bold" aria-hidden />
                  code
                </span>
              )}
            </div>

            <p className="mt-[5px] truncate text-[15px] font-semibold tracking-[-0.015em] text-[#16181d]">
              {pr.title}
            </p>

            <div className="mt-[4px] flex flex-wrap items-center gap-x-[10px] gap-y-[2px] text-[12px] text-[#9aa1ab]">
              <span className="flex items-center gap-[5px]">
                {pr.author.avatarUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={pr.author.avatarUrl}
                    alt=""
                    width={16}
                    height={16}
                    className="size-[16px] rounded-full bg-[#f3f3f3]"
                  />
                )}
                @{pr.author.login}
              </span>
              <span>#{pr.number}</span>
              <span>{relativeTime(pr.updatedAt)}</span>
              {entry && (
                <span className="font-mono">
                  {entry.slug}
                  {extra > 0 && ` +${extra}`}
                </span>
              )}
              {pr.additions !== null && (
                <span className="font-mono tabular-nums">
                  <span className="text-[#14B87A]">+{pr.additions}</span>{" "}
                  <span className="text-[#d43c3c]">−{pr.deletions}</span>
                </span>
              )}
              {(pr.photoCount ?? 0) > 0 && (
                <span className="flex items-center gap-[3px]">
                  <ImageSquare size={12} weight="bold" aria-hidden />
                  {pr.photoCount}
                </span>
              )}
              {pr.changedFiles === null && (
                <span className="flex items-center gap-[3px]">
                  <Cube size={12} aria-hidden />
                  details on open
                </span>
              )}
            </div>
          </div>
          <ArrowRight
            size={15}
            weight="bold"
            aria-hidden
            className="mt-[10px] shrink-0 text-[#c3c8ce] transition-transform group-hover:translate-x-[2px] group-hover:text-[#16181d]"
          />
        </div>
      </Link>
    </li>
  )
}

/* ---------- helpers ---------- */

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 31) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
