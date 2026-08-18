import {
  extractToc,
  listConcepts,
  listGuidePages,
  listGuides,
  listTools,
  plainExcerpt,
  type Entry,
} from "@/lib/content"

/* The search index: every page and every section of the site, flat.
   Statically generated; the command palette fetches it lazily the first
   time it opens. Small by design (~100 rows of titles and excerpts). */

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
  excerpt?: string
}

function docsFor(
  entry: Entry,
  group: string,
  base: string,
  pageTitle: string,
  body: string,
  crumbPrefix: string
): SearchDoc[] {
  return [
    {
      href: base,
      title: pageTitle,
      crumb: crumbPrefix,
      group,
      kind: "page" as const,
      excerpt: plainExcerpt(body, 110),
    },
    ...extractToc(body).map((section) => ({
      href: `${base}#${section.id}`,
      title: section.title,
      crumb: `${crumbPrefix} · ${pageTitle}`,
      group,
      kind: "section" as const,
    })),
  ]
}

export function GET() {
  const docs: SearchDoc[] = []

  for (const guide of listGuides()) {
    const base = `/guides/${guide.slug}`
    docs.push(
      ...docsFor(guide, "Guides", base, guide.meta.title, guide.body, "Guides")
    )
    for (const page of listGuidePages(guide.slug)) {
      docs.push(
        ...docsFor(
          guide,
          "Guides",
          `${base}/${page.slug}`,
          page.title,
          page.body,
          guide.meta.title
        )
      )
    }
  }
  for (const concept of listConcepts()) {
    docs.push(
      ...docsFor(
        concept,
        "Concepts",
        `/concepts/${concept.slug}`,
        concept.meta.title,
        concept.body,
        "Concepts"
      )
    )
  }
  for (const tool of listTools()) {
    docs.push(
      ...docsFor(
        tool,
        "Tools",
        `/tools/${tool.slug}`,
        tool.meta.title,
        tool.body,
        "Tools"
      )
    )
  }
  docs.push(
    {
      href: "/start",
      title: "Start here",
      crumb: "Pages",
      group: "Pages",
      kind: "page",
      excerpt: "Never touched hardware? How Jolts works and picking a first build.",
    },
    {
      href: "/contribute",
      title: "Write a guide",
      crumb: "Pages",
      group: "Pages",
      kind: "page",
      excerpt: "The PR flow, the block registry, and licensing.",
    }
  )

  return Response.json(docs)
}
