"use client"

import { useEffect, useState } from "react"

import Link from "next/link"

import {
  ArrowLeft,
  ArrowSquareOut,
  CircleNotch,
  Eye,
  ImageSquare,
  Lightning,
  WarningCircle,
} from "@phosphor-icons/react"

import { Highlights } from "@/components/review/highlights"
import { PatchView } from "@/components/review/patch-view"
import { PreviewPane } from "@/components/review/preview-pane"
import { relativeTime } from "@/components/review/queue"
import { VerdictBar } from "@/components/review/verdict-bar"
import { fetchPr } from "@/lib/review/client"
import type { PrDetail } from "@/lib/github/review"
import { typeTheme } from "@/lib/theme"

/* One pull request, arranged in the order a curator decides in: what is this
   and does it pass the mechanical checks, then are the photos usable, then read
   the words, then rule on it. The verdict bar is sticky because scrolling back
   up to find the approve button is exactly the friction we're removing. */

export function PrView({ number }: { number: number }) {
  const [detail, setDetail] = useState<PrDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  /* bumped after a verdict lands, to re-read the pull request - a submitted
     review changes CI, mergeability and the review list all at once */
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let alive = true
    fetchPr(number)
      .then((r) => {
        if (!alive) return
        setDetail(r.detail)
        setError(null)
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [number, reloads])

  if (error) {
    return (
      <Shell number={number}>
        <p className="flex items-start gap-[8px] rounded-[10px] border border-[#d43c3c]/25 bg-[#fdecec] px-[13px] py-[10px] text-[13.5px] leading-[1.55] text-[#a12222]">
          <WarningCircle size={16} weight="fill" className="mt-[2px] shrink-0" aria-hidden />
          {error}
        </p>
      </Shell>
    )
  }

  if (!detail) {
    return (
      <Shell number={number}>
        <p className="flex items-center gap-[9px] py-[24px] text-[14px] text-[#9aa1ab]">
          <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden />
          Loading #{number}…
        </p>
      </Shell>
    )
  }

  const { summary, checks, photos } = detail
  const entry = summary.entries?.[0]
  const theme = entry ? typeTheme[entry.contentType] : null

  return (
    <Shell number={number}>
      {/* ---------- what is this ---------- */}
      <div className="flex items-start gap-[12px]">
        {theme && (
          <span
            aria-hidden
            className="mt-[5px] h-[42px] w-[5px] shrink-0 rounded-full"
            style={{ background: theme.accent }}
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.03em] text-[#16181d]">
            {summary.title}
          </h1>
          <div className="mt-[7px] flex flex-wrap items-center gap-x-[11px] gap-y-[3px] text-[12.5px] text-[#9aa1ab]">
            <span className="flex items-center gap-[5px]">
              {summary.author.avatarUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={summary.author.avatarUrl}
                  alt=""
                  width={17}
                  height={17}
                  className="size-[17px] rounded-full bg-[#f3f3f3]"
                />
              )}
              @{summary.author.login}
            </span>
            <span>opened {relativeTime(summary.createdAt)}</span>
            {entry && theme && (
              <Link
                href={`/${entry.contentType}/${entry.slug}`}
                className="font-mono font-medium hover:text-[#16181d]"
              >
                {entry.contentType}/{entry.slug}
              </Link>
            )}
            <span className="font-mono tabular-nums">
              <span className="text-[#14B87A]">+{summary.additions}</span>{" "}
              <span className="text-[#d43c3c]">−{summary.deletions}</span>
            </span>
            <a
              href={summary.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-[4px] font-medium hover:text-[#16181d]"
            >
              on GitHub
              <ArrowSquareOut size={11} weight="bold" aria-hidden />
            </a>
          </div>
        </div>
      </div>

      {/* ---------- what's up with this one ---------- */}
      <section className="mt-[18px]">
        <SectionTitle icon={<Lightning size={14} weight="fill" aria-hidden />}>
          What&rsquo;s up
        </SectionTitle>
        <div className="mt-[9px]">
          <Highlights detail={detail} />
        </div>
        {checks.previewUrl && (
          <a
            href={checks.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-[8px] inline-flex items-center gap-[5px] text-[12.5px] font-medium text-[#5c6470] transition-colors hover:text-[#16181d]"
          >
            <Eye size={13} weight="bold" aria-hidden />
            Deploy preview of the whole site
            <ArrowSquareOut size={11} weight="bold" aria-hidden />
          </a>
        )}
      </section>

      {/* ---------- photos ---------- */}
      {photos.length > 0 && (
        <section className="mt-[22px]">
          <SectionTitle icon={<ImageSquare size={14} weight="bold" aria-hidden />}>
            {photos.length} photo{photos.length === 1 ? "" : "s"} added
          </SectionTitle>
          <div className="mt-[9px] grid grid-cols-2 gap-[9px] sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <figure key={photo.path} className="min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.downloadUrl}
                  alt={photo.path}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-[9px] border border-black/[0.08] bg-[#f6f7f8] object-cover"
                />
                <figcaption className="mt-[4px] truncate font-mono text-[10.5px] text-[#9aa1ab]">
                  {photo.path.split("/").pop()}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ---------- the page itself ---------- */}
      <section className="mt-[22px]">
        <SectionTitle icon={<Eye size={14} weight="bold" aria-hidden />}>
          Preview
        </SectionTitle>
        <div className="mt-[9px]">
          <PreviewPane prNumber={summary.number} paths={detail.previewable} />
        </div>
      </section>

      {/* ---------- the bytes, if it comes to that ---------- */}
      <section className="mt-[16px]">
        <PatchView patch={detail.patch} githubUrl={summary.url} />
      </section>

      {/* ---------- rule on it ---------- */}
      <VerdictBar detail={detail} onDone={() => setReloads((n) => n + 1)} />
    </Shell>
  )
}

/* ---------- pieces ---------- */

function Shell({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[860px] px-[28px] py-[26px]">
      <Link
        href="/review"
        className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#5c6470] transition-colors hover:text-[#16181d]"
      >
        <ArrowLeft size={14} weight="bold" aria-hidden />
        Review queue
      </Link>
      <p className="mt-[3px] font-mono text-[11.5px] text-[#c3c8ce]">#{number}</p>
      <div className="mt-[14px]">{children}</div>
    </div>
  )
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <h2 className="flex items-center gap-[6px] text-[11.5px] font-semibold tracking-[0.04em] text-[#9aa1ab] uppercase">
      {icon}
      {children}
    </h2>
  )
}
