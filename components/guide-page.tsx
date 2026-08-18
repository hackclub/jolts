import type { Metadata } from "next"
import { ViewTransition } from "react"

import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"

import { Breadcrumb } from "@/components/breadcrumb"
import { AuthorLine, ContributorsLine } from "@/components/entry-card"
import { GuideNav, type NavItem } from "@/components/guide-nav"
import { Difficulty, getMDXComponents } from "@/components/mdx/registry"
import {
  extractToc,
  getEntry,
  getGuidePage,
  listEntries,
  listGuidePages,
  type ContentType,
  type Entry,
  type GuidePageEntry,
} from "@/lib/content"
import { renderMDX } from "@/lib/mdx"
import { typeTheme } from "@/lib/theme"

/* One renderer for all three content types, fully static.

   Guides are small books: the overview (index.mdx) plus one page per
   stage. Their left panel lives in the guides/[slug]/layout so it
   persists across page switches; GuideContent renders only the right
   column. Concepts and tools are single pages that carry their own
   panel (in-page table of contents) when they have sections. */

const REPO = "https://github.com/hackclub/jolts"

export function guideStaticParams(contentType: ContentType) {
  // aliases are prerendered too - they exist only to 301 to the new slug
  return listEntries(contentType).flatMap((e) =>
    [e.slug, ...e.meta.aliases].map((slug) => ({ slug }))
  )
}

export function guidePageStaticParams() {
  return listEntries("guides").flatMap((e) =>
    listGuidePages(e.slug).map((p) => ({ slug: e.slug, page: p.slug }))
  )
}

export function guideMetadata(
  contentType: ContentType,
  slug: string,
  pageSlug?: string
): Metadata {
  const entry = getEntry(contentType, slug)
  if (!entry) return {}
  if (pageSlug) {
    const page = getGuidePage(entry.slug, pageSlug)
    if (!page) return {}
    return {
      title: `${page.title} - ${entry.meta.title} - jolts`,
      description: entry.meta.subtitle,
    }
  }
  return {
    title: `${entry.meta.title} - jolts`,
    description: entry.meta.subtitle,
  }
}

/* ---------- left panel items (serializable for the client nav) ---------- */

export function buildNavItems(
  entry: Entry,
  pages: GuidePageEntry[]
): NavItem[] {
  const base = `/${entry.contentType}/${entry.slug}`
  return [
    {
      slug: null,
      title: "Overview",
      href: base,
      toc: extractToc(entry.body),
    },
    ...pages.map((p) => ({
      slug: p.slug as string | null,
      title: p.title,
      href: `${base}/${p.slug}`,
      toc: extractToc(p.body),
    })),
  ]
}

/* ---------- prev / next ---------- */

function PageFooterNav({
  entry,
  pages,
  current,
}: {
  entry: Entry
  pages: GuidePageEntry[]
  current: string | null
}) {
  const seq = [
    { slug: null as string | null, title: "Overview", href: `/guides/${entry.slug}` },
    ...pages.map((p) => ({
      slug: p.slug as string | null,
      title: p.title,
      href: `/guides/${entry.slug}/${p.slug}`,
    })),
  ]
  const i = seq.findIndex((s) => s.slug === current)
  const prev = i > 0 ? seq[i - 1] : null
  const next = i < seq.length - 1 ? seq[i + 1] : null
  if (!prev && !next) return null
  return (
    <div className="mt-[44px] flex items-baseline justify-between gap-[16px] border-t border-black/10 pt-[16px] text-[14.5px] tracking-[-0.01em]">
      {prev ? (
        <Link
          href={prev.href}
          className="text-[#5c6470] transition-colors duration-150 hover:text-[#16181d]"
        >
          ← {prev.title}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          href={next.href}
          className="font-semibold hover:underline [text-underline-offset:3px]"
          style={{ color: typeTheme.guides.accent }}
        >
          {next.title} →
        </Link>
      )}
    </div>
  )
}

/* ---------- headers ---------- */

function OverviewHeader({ entry }: { entry: Entry }) {
  const meta = entry.meta
  const theme = typeTheme[entry.contentType]
  const facts: React.ReactNode[] = []
  if (meta.type === "guide") {
    facts.push(
      <Difficulty key="difficulty" level={meta.difficulty} />,
      <span key="time">{meta.time}</span>,
      <span key="cost">{meta.cost}</span>,
      <span key="solder">
        {meta.soldering ? "soldering required" : "no soldering"}
      </span>
    )
  }
  if (meta.type === "tool" && meta.cost) {
    facts.push(<span key="cost">{meta.cost}</span>)
  }

  return (
    <header>
      <h1 className="text-[38px] leading-[1.08] font-semibold tracking-[-0.03em] text-[#16181d] text-balance">
        {meta.title}
      </h1>
      <p className="mt-[8px] text-[17px] leading-[1.55] tracking-[-0.01em] text-[#5c6470]">
        {meta.subtitle}
      </p>

      {facts.length > 0 && (
        <p className="mt-[14px] flex flex-wrap items-center gap-x-[8px] gap-y-[4px] text-[14px] tracking-[-0.01em] text-[#5c6470]">
          {facts.map((fact, i) => (
            <span key={i} className="flex items-center gap-[8px]">
              {i > 0 && (
                <span aria-hidden className="text-black/20">
                  ·
                </span>
              )}
              {fact}
            </span>
          ))}
        </p>
      )}

      {meta.type === "guide" && (
        <p className="mt-[6px] text-[14px] tracking-[-0.01em] text-[#9aa1ab]">
          You&rsquo;ll learn {meta.learns.join(", ")}
        </p>
      )}

      <div className="mt-[16px] flex flex-wrap items-center gap-x-[18px] gap-y-[8px] border-b border-black/10 pb-[16px]">
        <AuthorLine meta={meta} />
        <ContributorsLine names={meta.contributors} />
      </div>
    </header>
  )
}

/* ---------- guide right column (panel lives in the layout) ---------- */

export async function GuideContent({
  slug,
  pageSlug,
}: {
  slug: string
  pageSlug?: string
}) {
  const entry = getEntry("guides", slug)
  if (!entry) notFound()
  // old slugs (aliases) 301 to the canonical URL
  if (entry.slug !== slug) {
    permanentRedirect(
      `/guides/${entry.slug}${pageSlug ? `/${pageSlug}` : ""}`
    )
  }

  const theme = typeTheme.guides
  const pages = listGuidePages(entry.slug)
  const page = pageSlug ? getGuidePage(entry.slug, pageSlug) : null
  if (pageSlug && !page) notFound()

  const body = await renderMDX(
    page ? page.body : entry.body,
    getMDXComponents(entry, page?.file)
  )

  return (
    <>
      {page ? (
        <header>
          <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-[#16181d] text-balance">
            {page.title}
          </h1>
        </header>
      ) : (
        <OverviewHeader entry={entry} />
      )}
      <article
        className="jolts-guide pt-[6px] pb-[10px]"
        style={
          {
            "--guide-accent": theme.accent,
            "--guide-checker-a": theme.checkerA,
            "--guide-checker-b": theme.checkerB,
          } as React.CSSProperties
        }
      >
        {body}
      </article>
      <div className="pb-[30px]">
        <PageFooterNav
          entry={entry}
          pages={pages}
          current={page?.slug ?? null}
        />
      </div>
    </>
  )
}

/* ---------- concepts & tools: single page, own panel ---------- */

export async function GuidePage({
  contentType,
  slug,
}: {
  contentType: ContentType
  slug: string
}) {
  const entry = getEntry(contentType, slug)
  if (!entry) notFound()
  if (entry.slug !== slug) permanentRedirect(`/${contentType}/${entry.slug}`)

  const theme = typeTheme[contentType]
  const body = await renderMDX(entry.body, getMDXComponents(entry))
  const accentStyle = {
    "--guide-accent": theme.accent,
    "--guide-checker-a": theme.checkerA,
    "--guide-checker-b": theme.checkerB,
  } as React.CSSProperties

  const navItems = buildNavItems(entry, [])
  const showPanel = navItems.some((item) => item.toc.length > 0)

  const trail = [
    { label: theme.labelPlural, href: `/${entry.contentType}` },
    { label: entry.meta.title, href: `/${entry.contentType}/${entry.slug}` },
  ]

  if (!showPanel) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-[28px] pt-[40px]">
        <Breadcrumb
          trail={trail}
          accent={theme.accent}
          editUrl={`${REPO}/edit/main/content/${entry.contentType}/${entry.slug}/index.mdx`}
        />
        <OverviewHeader entry={entry} />
        <article className="jolts-guide pt-[8px] pb-[30px]" style={accentStyle}>
          {body}
        </article>
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-[1020px] gap-x-[52px] gap-y-[28px] px-[28px] pt-[40px] lg:grid-cols-[190px_minmax(0,1fr)]">
      <GuideNav
        entryTitle={entry.meta.title}
        theme={theme}
        items={navItems}
      />
      <div className="min-w-0 max-w-[720px]">
        <Breadcrumb
          trail={trail}
          accent={theme.accent}
          editUrl={`${REPO}/edit/main/content/${entry.contentType}/${entry.slug}/index.mdx`}
        />
        <ViewTransition default="jolts-content">
          <div className="min-w-0">
            <OverviewHeader entry={entry} />
            <article
              className="jolts-guide pt-[8px] pb-[30px]"
              style={accentStyle}
            >
              {body}
            </article>
          </div>
        </ViewTransition>
      </div>
    </div>
  )
}
