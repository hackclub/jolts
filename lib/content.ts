import fs from "node:fs"
import path from "node:path"

import matter from "gray-matter"
import { cache } from "react"
import { z } from "zod"

/* The content layer. Plain MDX files on disk - no database, no CMS.
   content/{builds,concepts,tools}/<slug>/index.mdx, images colocated.
   Everything is read at build time (all routes are statically generated),
   so none of this code runs per-request in production. */

export const CONTENT_TYPES = ["guides", "concepts", "tools"] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const CONTENT_DIR = path.join(process.cwd(), "content")

/* ---------- frontmatter schemas (validated in CI by scripts/validate-content.mjs) ---------- */

const authorSchema = z.union([z.string(), z.array(z.string()).min(1)])

const baseSchema = z.object({
  title: z.string().min(1),
  /** One-to-two lines selling the outcome. Shown on cards and page headers. */
  subtitle: z.string().min(1),
  /** GitHub username(s). Contributors get credited on the page. */
  author: authorSchema,
  /** Old slugs that should keep working after a rename. */
  aliases: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  /** ISO date of last meaningful revision. */
  updated: z.union([z.string(), z.date()]).optional(),
  /** Drafts build locally but are hidden from listings and static params. */
  draft: z.boolean().default(false),
})

export const partSchema = z.object({
  name: z.string().min(1),
  qty: z.union([z.number(), z.string()]).default(1),
  cost: z.string().optional(),
  link: z.string().url().optional(),
  note: z.string().optional(),
  /** Part photo - "./file.jpg" colocated in the guide folder, or a URL. */
  image: z.string().optional(),
})

export const guideSchema = baseSchema.extend({
  type: z.literal("guide"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  /** Human estimate, e.g. "1 weekend" or "3–4 hours". */
  time: z.string().min(1),
  /** Total-cost estimate, e.g. "~$30". */
  cost: z.string().min(1),
  /** Declared up front - Jolts doesn't prescribe a first project,
      so every card must say what it assumes. */
  soldering: z.boolean(),
  /** "You'll learn: X" chips on the card. */
  learns: z.array(z.string()).min(1),
  parts: z.array(partSchema).min(1),
  /** Slugs of tool pages this build uses. */
  tools: z.array(z.string()).default([]),
  /** Hero image, relative to the guide folder. */
  hero: z.string().optional(),
})

export const conceptSchema = baseSchema.extend({
  type: z.literal("concept"),
  hero: z.string().optional(),
})

export const toolSchema = baseSchema.extend({
  type: z.literal("tool"),
  /** Rough price band for the physical tool, e.g. "$15–40". Omit for software. */
  cost: z.string().optional(),
  hero: z.string().optional(),
})

export const schemaByType = {
  guides: guideSchema,
  concepts: conceptSchema,
  tools: toolSchema,
} as const

export type GuideMeta = z.infer<typeof guideSchema>
export type ConceptMeta = z.infer<typeof conceptSchema>
export type ToolMeta = z.infer<typeof toolSchema>
export type EntryMeta = GuideMeta | ConceptMeta | ToolMeta

export type Entry<M extends EntryMeta = EntryMeta> = {
  slug: string
  contentType: ContentType
  meta: M
  /** Raw MDX body (frontmatter stripped). */
  body: string
}

/* ---------- loaders ---------- */

function readEntry(contentType: ContentType, slug: string): Entry | null {
  const file = path.join(CONTENT_DIR, contentType, slug, "index.mdx")
  if (!fs.existsSync(file)) return null
  const { data, content } = matter(fs.readFileSync(file, "utf8"))
  const meta = schemaByType[contentType].parse(data)
  return { slug, contentType, meta, body: content }
}

export const getEntry = cache((contentType: ContentType, slug: string) => {
  const direct = readEntry(contentType, slug)
  if (direct) return direct
  // aliases: old slugs keep resolving after a rename
  for (const entry of listEntries(contentType)) {
    if (entry.meta.aliases.includes(slug)) return entry
  }
  return null
})

export const listEntries = cache((contentType: ContentType): Entry[] => {
  const dir = path.join(CONTENT_DIR, contentType)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readEntry(contentType, d.name))
    .filter((e): e is Entry => e !== null && !e.meta.draft)
    .sort((a, b) => a.meta.title.localeCompare(b.meta.title))
})

export const listGuides = () => listEntries("guides") as Entry<GuideMeta>[]
export const listConcepts = () => listEntries("concepts") as Entry<ConceptMeta>[]
export const listTools = () => listEntries("tools") as Entry<ToolMeta>[]

export function authors(meta: EntryMeta): string[] {
  return Array.isArray(meta.author) ? meta.author : [meta.author]
}

/* ---------- guide pages ----------
   A guide is a small book: index.mdx is the overview (frontmatter + intro
   + parts list) and numbered siblings are its pages, one per stage - content/guides/macropad/01-soldering.mdx → /guides/macropad/soldering.
   The number gives the order; the rest of the filename is the URL slug. */

const guidePageSchema = z.object({
  title: z.string().min(1),
})

export type GuidePageEntry = {
  slug: string
  order: number
  title: string
  body: string
  /** filename within the guide folder, e.g. "02-soldering.mdx" */
  file: string
}

export const listGuidePages = cache((guideSlug: string): GuidePageEntry[] => {
  const dir = path.join(CONTENT_DIR, "guides", guideSlug)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .map((f) => f.match(/^(\d+)-(.+)\.mdx$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => {
      const { data, content } = matter(
        fs.readFileSync(path.join(dir, m[0]), "utf8")
      )
      const meta = guidePageSchema.parse(data)
      return {
        slug: m[2],
        order: Number(m[1]),
        title: meta.title,
        body: content,
        file: m[0],
      }
    })
    .sort((a, b) => a.order - b.order)
})

export function getGuidePage(
  guideSlug: string,
  pageSlug: string
): GuidePageEntry | null {
  return listGuidePages(guideSlug).find((p) => p.slug === pageSlug) ?? null
}

/* ---------- in-page table of contents ---------- */

/** Anchor id for a heading or step title. Must match what the renderer
    stamps on h2s and Step sections. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_[\]]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

export type TocEntry = { id: string; title: string }

/** The two things that become anchors on a page: ## headings and <Step>
    titles. Shared by the toc and the search index so they never drift. */
const SECTION_RE = /^##\s+(.+)$|<Step\s[^>]*?title="([^"]+)"/gm

function cleanHeading(raw: string): string {
  return raw
    .replace(/[`*_]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim()
}

/** Section list of one page: ## headings and <Step> titles, in order. */
export function extractToc(body: string): TocEntry[] {
  return [...body.matchAll(SECTION_RE)].map((m) => {
    const title = cleanHeading(m[1] ?? m[2])
    return { id: slugifyHeading(title), title }
  })
}

export type Section = TocEntry & {
  /** The section's own prose, plain text, up to the next heading. */
  text: string
}

/** extractToc's sections, each carrying the prose that follows it. The
    search index needs the text, not just the anchor - matching headings
    alone misses almost everything a page actually says. */
export function extractSections(body: string): Section[] {
  const matches = [...body.matchAll(SECTION_RE)]
  return matches.map((m, i) => {
    const title = cleanHeading(m[1] ?? m[2])
    const from = m.index + m[0].length
    const to = matches[i + 1]?.index ?? body.length
    return {
      id: slugifyHeading(title),
      title,
      text: plainText(body.slice(from, to)),
    }
  })
}

/** Everything before the first section heading - the page's own intro.
    Kept separate from extractSections so the index stores each run of
    prose exactly once. */
export function leadText(body: string): string {
  const [first] = body.matchAll(SECTION_RE)
  return plainText(first ? body.slice(0, first.index) : body)
}

/** MDX body → readable prose. Strips code fences, comments, JSX tags,
    headings, images, and markdown punctuation. */
export function plainText(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+.*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Plain-text opening of a guide's body - used by the hover previews on
    cross-links, Wikipedia-style. Cuts at a word boundary. */
export function plainExcerpt(body: string, maxLength = 220): string {
  const text = plainText(body)
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength)
  return cut.slice(0, cut.lastIndexOf(" ")) + " …"
}

/** Map a guide-relative image path ("./photo.jpg") to its served URL. */
export function contentImageUrl(
  contentType: ContentType,
  slug: string,
  src: string
): string {
  if (!src.startsWith("./")) return src
  return `/content-images/${contentType}/${slug}/${src.slice(2)}`
}
