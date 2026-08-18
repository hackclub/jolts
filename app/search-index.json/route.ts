import {
  extractSections,
  leadText,
  listConcepts,
  listGuidePages,
  listGuides,
  listTools,
} from "@/lib/content"

/* The search index: every page and every section of the site, flat, each
   row carrying its own prose. Statically generated; the command palette
   fetches it once on first open and ranks it locally with MiniSearch.

   The whole corpus is a few dozen KB of text, so shipping all of it beats
   any hosted search - no crawl lag, no keys, and preview branches search
   their own content. If the site ever outgrows that, this route is the
   seam to swap. */

export const dynamic = "force-static"

export type SearchDoc = {
  href: string
  /** page or section title */
  title: string
  /** where it lives, e.g. "Tamagotchi · Schematic" */
  crumb: string
  /** result grouping, e.g. "Guides" | "Concepts" | "Tools" | "Pages" */
  group: string
  kind: "page" | "section"
  /** Searchable prose. The palette also cuts result subtitles from this,
      so it is stored once and never duplicated into a separate excerpt. */
  text: string
}

/* One page becomes a page row plus a row per section. The page row carries
   only the intro, since each section owns the prose beneath its heading -
   that keeps every run of text in exactly one row, so a deep match ranks
   the section (which scrolls to the anchor) rather than the page. */
function docsFor(opts: {
  group: string
  base: string
  title: string
  body: string
  crumb: string
  /** Frontmatter terms worth matching that aren't in the prose. */
  keywords?: string
}): SearchDoc[] {
  const { group, base, title, body, crumb, keywords = "" } = opts
  const lead = leadText(body)
  return [
    {
      href: base,
      title,
      crumb,
      group,
      kind: "page" as const,
      text: keywords ? `${keywords} ${lead}` : lead,
    },
    ...extractSections(body).map((section) => ({
      href: `${base}#${section.id}`,
      title: section.title,
      crumb: `${crumb} · ${title}`,
      group,
      kind: "section" as const,
      text: section.text,
    })),
  ]
}

export function GET() {
  const docs: SearchDoc[] = []

  for (const guide of listGuides()) {
    const base = `/guides/${guide.slug}`
    const keywords = [guide.meta.subtitle, ...guide.meta.tags, ...guide.meta.learns].join(" ")
    docs.push(
      ...docsFor({
        group: "Guides",
        base,
        title: guide.meta.title,
        body: guide.body,
        crumb: "Guides",
        keywords,
      })
    )
    for (const page of listGuidePages(guide.slug)) {
      docs.push(
        ...docsFor({
          group: "Guides",
          base: `${base}/${page.slug}`,
          title: page.title,
          body: page.body,
          crumb: guide.meta.title,
          keywords: guide.meta.tags.join(" "),
        })
      )
    }
  }
  for (const concept of listConcepts()) {
    docs.push(
      ...docsFor({
        group: "Concepts",
        base: `/concepts/${concept.slug}`,
        title: concept.meta.title,
        body: concept.body,
        crumb: "Concepts",
        keywords: [concept.meta.subtitle, ...concept.meta.tags].join(" "),
      })
    )
  }
  for (const tool of listTools()) {
    docs.push(
      ...docsFor({
        group: "Tools",
        base: `/tools/${tool.slug}`,
        title: tool.meta.title,
        body: tool.body,
        crumb: "Tools",
        keywords: [tool.meta.subtitle, ...tool.meta.tags].join(" "),
      })
    )
  }
  docs.push(
    {
      href: "/start",
      title: "Start here",
      crumb: "Pages",
      group: "Pages",
      kind: "page",
      text: "Never touched hardware? How Jolts works and picking a first build.",
    },
    {
      href: "/contribute",
      title: "Write a guide",
      crumb: "Pages",
      group: "Pages",
      kind: "page",
      text: "The PR flow, the block registry, and licensing.",
    }
  )

  return Response.json(docs)
}
