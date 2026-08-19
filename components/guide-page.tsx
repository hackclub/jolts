import type { Metadata } from "next"
import { ViewTransition } from "react"

import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"

import { Clock, Coins, Wrench } from "@phosphor-icons/react/dist/ssr"

import { Breadcrumb } from "@/components/breadcrumb"
import { AuthorLine, ContributorsLine } from "@/components/entry-card"
import { GuideNav, type NavItem } from "@/components/guide-nav"
import { getMDXComponents } from "@/components/mdx/registry"
import { contentImageHasAlpha } from "@/lib/content-image"
import {
  contentImageUrl,
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

/* a pill tag with a dark tooltip that floats up on hover */
function FactTag({
  info,
  children,
}: {
  info: string
  children: React.ReactNode
}) {
  return (
    <span className="group relative inline-flex h-[29px] cursor-default items-center gap-[7px] rounded-full border border-black/10 bg-white px-[12px] text-[13px] tracking-[-0.01em] text-[#33383f]">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+7px)] left-1/2 z-10 -translate-x-1/2 translate-y-[3px] rounded-[7px] bg-[#16181d] px-[10px] py-[5.5px] text-[12px] leading-[1.4] whitespace-nowrap text-white opacity-0 shadow-[0px_4px_12px_rgba(0,0,0,0.25)] transition-[opacity,transform] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100"
      >
        {info}
      </span>
    </span>
  )
}

const DIFFICULTY_INFO = {
  beginner: "No experience needed - every step is spelled out",
  intermediate: "Assumes you've built something simple before",
  advanced: "Sparse hand-holding - expect to debug on your own",
} as const

function FactTags({ meta }: { meta: Entry["meta"] }) {
  const tags: React.ReactNode[] = []
  if (meta.type === "guide") {
    const filled = { beginner: 1, intermediate: 2, advanced: 3 }[
      meta.difficulty
    ]
    tags.push(
      <FactTag key="difficulty" info={DIFFICULTY_INFO[meta.difficulty]}>
        <span className="flex gap-[2.5px]" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className="size-[6px] rounded-full"
              style={{
                background:
                  i <= filled ? typeTheme.guides.accent : "rgba(0,0,0,0.12)",
              }}
            />
          ))}
        </span>
        <span className="capitalize">{meta.difficulty}</span>
      </FactTag>,
      <FactTag
        key="time"
        info="Hands-on time - spread it over as many sessions as you like"
      >
        <Clock size={14} weight="fill" className="text-[#9aa1ab]" aria-hidden />
        {meta.time}
      </FactTag>,
      <FactTag key="cost" info="Approximate parts cost - shipping not included">
        <Coins size={14} weight="fill" className="text-[#9aa1ab]" aria-hidden />
        {meta.cost}
      </FactTag>,
      <FactTag
        key="solder"
        info={
          meta.soldering
            ? "You'll need an iron and basic soldering"
            : "The fab assembles everything - no iron needed"
        }
      >
        <Wrench size={14} weight="fill" className="text-[#9aa1ab]" aria-hidden />
        {meta.soldering ? "soldering required" : "no soldering"}
      </FactTag>
    )
  }
  if (meta.type === "tool" && meta.cost) {
    tags.push(
      <FactTag key="cost" info="What this tool costs to use">
        <Coins size={14} weight="fill" className="text-[#9aa1ab]" aria-hidden />
        {meta.cost}
      </FactTag>
    )
  }
  if (tags.length === 0) return null
  return (
    <div className="mt-[12px] flex flex-wrap items-center gap-[7px]">{tags}</div>
  )
}

async function OverviewHeader({ entry }: { entry: Entry }) {
  const meta = entry.meta
  const theme = typeTheme[entry.contentType]
  const heroTransparent = meta.hero
    ? await contentImageHasAlpha(entry.contentType, entry.slug, meta.hero)
    : false

  return (
    <>
    <header className="relative overflow-hidden rounded-[12px] border border-black/10 bg-[#FCFCFA]">
      {/* graph-paper grid, fading out toward the bottom so the meta rows
          sit on quieter ground */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(22,24,29,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(22,24,29,0.055) 1px, transparent 1px)",
          backgroundSize: "21px 21px",
          maskImage:
            "linear-gradient(180deg, black 0%, rgba(0,0,0,0.3) 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, black 0%, rgba(0,0,0,0.3) 100%)",
        }}
      />
      {/* soft accent glow behind the photo corner */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(880px 560px at 90% -10%, ${theme.tint}, transparent 72%)`,
        }}
      />

      <div className="relative flex items-center gap-[26px] px-[24px] pt-[22px] pb-[16px]">
        <div className="min-w-0 flex-1">
          <h1 className="font-augie text-[40px] leading-[1.02] text-[#16181d] text-balance">
            {meta.title}
          </h1>
          <p className="mt-[10px] text-[16px] leading-[1.55] tracking-[-0.01em] text-[#5c6470]">
            {meta.subtitle}
          </p>

          {meta.type === "guide" && (
            <p className="mt-[10px] text-[14px] tracking-[-0.01em] text-[#9aa1ab]">
              You&rsquo;ll learn {meta.learns.join(", ")}
            </p>
          )}
        </div>

        {meta.hero &&
          (heroTransparent ? (
            /* transparent render: no frame - larger, floating on the grid
               with its own drop shadow. Negative margin lets it use the
               card's padding without growing the card. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contentImageUrl(entry.contentType, entry.slug, meta.hero)}
              alt=""
              className="hidden aspect-[4/3] w-[252px] shrink-0 -my-[10px] -mr-[4px] rotate-[2.5deg] object-contain [filter:drop-shadow(0px_12px_16px_rgba(0,0,0,0.28))] md:block"
            />
          ) : (
            /* opaque photo: polaroid frame */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contentImageUrl(entry.contentType, entry.slug, meta.hero)}
              alt=""
              className="hidden aspect-[4/3] w-[196px] shrink-0 rotate-[2.5deg] rounded-[9px] border-[5px] border-white object-cover shadow-[0px_6px_18px_-4px_rgba(0,0,0,0.28)] md:block"
            />
          ))}
      </div>

      <div className="relative flex flex-wrap items-center gap-x-[18px] gap-y-[8px] border-t border-black/[0.07] px-[24px] py-[11px]">
        <AuthorLine meta={meta} />
        <ContributorsLine names={meta.contributors} />
      </div>
    </header>

    <div className="mb-[14px]">
      <FactTags meta={meta} />
    </div>
    </>
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
          editUrl={`/edit/${entry.contentType}/${entry.slug}`}
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
          editUrl={`/edit/${entry.contentType}/${entry.slug}`}
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

