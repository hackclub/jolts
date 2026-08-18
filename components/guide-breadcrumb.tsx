"use client"

import { House } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

/* Breadcrumb for guide pages: [home] / Guides / <guide> / <page>.
   Lives in the guides/[slug] layout OUTSIDE the ViewTransition, so it
   stays put while the page content animates. Every segment is clickable;
   the page segment is derived from the pathname client-side, since the
   layout doesn't re-render between page switches. */

export function GuideBreadcrumb({
  guideTitle,
  base,
  pages,
  accent,
}: {
  guideTitle: string
  /** e.g. /guides/macropad */
  base: string
  pages: { slug: string; title: string }[]
  accent: string
}) {
  const pathname = usePathname().replace(/\/$/, "")
  const pageSlug = pathname.startsWith(`${base}/`)
    ? pathname.slice(base.length + 1)
    : null
  const page = pages.find((p) => p.slug === pageSlug) ?? null

  const sep = (
    <span aria-hidden className="text-black/20">
      /
    </span>
  )

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-[18px] flex flex-wrap items-center gap-[8px] text-[13px] tracking-[-0.01em]"
    >
      <Link
        href="/"
        aria-label="Home"
        className="flex items-center text-[#9aa1ab] transition-colors duration-150 hover:text-[#16181d]"
      >
        <House size={14} weight="fill" aria-hidden />
      </Link>
      {sep}
      <Link
        href="/guides"
        className="text-[#9aa1ab] transition-colors duration-150 hover:text-[#16181d]"
      >
        Guides
      </Link>
      {sep}
      <Link
        href={base}
        className={
          page
            ? "text-[#9aa1ab] transition-colors duration-150 hover:text-[#16181d]"
            : "font-semibold"
        }
        style={page ? undefined : { color: accent }}
        aria-current={page ? undefined : "page"}
      >
        {guideTitle}
      </Link>
      {page && (
        <>
          {sep}
          <Link
            href={`${base}/${page.slug}`}
            aria-current="page"
            className="font-semibold"
            style={{ color: accent }}
          >
            {page.title}
          </Link>
        </>
      )}
    </nav>
  )
}
