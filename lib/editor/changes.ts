import type { ContentType, EntryMeta } from "@/lib/content-schema"
import { emitFrontmatter } from "@/lib/editor/frontmatter"
import type { FileChange } from "@/lib/editor/patch"

/* Turns the editor's state into the minimal set of file changes. The
   guiding rule: a byte the author didn't touch is a byte the patch
   doesn't touch - unchanged frontmatter and unchanged bodies are reused
   verbatim, files without changes don't appear at all. */

export type PageDraftOut = {
  /** target filename, e.g. "index.mdx" or "03-usb-c.mdx" */
  fileName: string
  /** filename on disk, null when the page is new */
  originalName: string | null
  /** page title (ignored for index.mdx) */
  title: string
  deleted: boolean
  /** serialized MDX body (no frontmatter), normalized, or null when the
      body is untouched */
  newBody: string | null
  /** full original file text, null when new */
  originalRaw: string | null
}

export type ChangesInput = {
  contentType: ContentType
  slug: string
  meta: EntryMeta
  originalMeta: EntryMeta | null
  pages: PageDraftOut[]
  uploads: { name: string; data: Uint8Array }[]
  /** stamp meta.updated with today when anything changed */
  bumpUpdated: boolean
}

function fmScalar(s: string): string {
  // page frontmatter has a single title key; quote conservatively
  return /^[A-Za-z0-9]/.test(s) && !/[:#]/.test(s) && !s.includes("\n")
    ? s
    : JSON.stringify(s)
}

export function pageFrontmatter(title: string): string {
  return `---\ntitle: ${fmScalar(title)}\n---\n`
}

/** replace or insert the `updated:` line without touching anything else */
export function spliceUpdated(front: string, date: string): string {
  if (/^updated:.*$/m.test(front)) {
    return front.replace(/^updated:.*$/m, `updated: ${date}`)
  }
  // insert right before the closing fence, preserving its trailing newline
  return front.replace(/\n---(\r?\n?)$/, `\nupdated: ${date}\n---$1`)
}

/** original file text → [frontmatterText, bodyRaw] */
export function splitRaw(raw: string): [string, string] {
  const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  if (!m) return ["", raw]
  return [m[0], raw.slice(m[0].length)]
}

function joinBody(front: string, body: string): string {
  // house style: one blank line between the frontmatter fence and prose
  return front + "\n" + body.replace(/^\n+/, "")
}

export function computeChanges(input: ChangesInput): FileChange[] {
  const dir = `content/${input.contentType}/${input.slug}`
  const changes: FileChange[] = []
  const outputs: string[] = [] // new file texts, for upload reference scan

  const metaChanged =
    input.originalMeta === null ||
    JSON.stringify(input.meta) !== JSON.stringify(input.originalMeta)

  for (const page of input.pages) {
    const isIndex = page.fileName === "index.mdx"
    const path = `${dir}/${page.fileName}`

    // deleted (and not new): a delete change
    if (page.deleted) {
      if (page.originalName && page.originalRaw !== null) {
        changes.push({
          kind: "delete",
          path: `${dir}/${page.originalName}`,
          before: page.originalRaw,
        })
      }
      continue
    }

    const [origFront, origBody] = page.originalRaw
      ? splitRaw(page.originalRaw)
      : ["", ""]

    let front: string
    let frontChanged: boolean
    if (isIndex) {
      const today = new Date().toISOString().slice(0, 10)
      if (metaChanged) {
        const metaOut: Record<string, unknown> = {
          ...(input.meta as unknown as Record<string, unknown>),
        }
        if (input.bumpUpdated) metaOut.updated = today
        front = emitFrontmatter(metaOut)
        frontChanged = true
      } else if (input.bumpUpdated && page.originalRaw !== null) {
        // meta untouched: splice ONLY the `updated:` line, keep every
        // other byte of the author's hand-written frontmatter
        front = spliceUpdated(origFront, today)
        frontChanged = front !== origFront
      } else {
        front = origFront
        frontChanged = false
      }
    } else {
      front = pageFrontmatter(page.title)
      frontChanged = page.originalRaw === null || front !== origFront
    }

    const bodyChanged = page.newBody !== null
    const body = bodyChanged ? page.newBody! : origBody.replace(/^\n+/, "")
    const newRaw = bodyChanged || frontChanged ? joinBody(front, body) : page.originalRaw!

    const renamed =
      page.originalName !== null && page.originalName !== page.fileName

    if (page.originalRaw === null) {
      changes.push({ kind: "add", path, after: newRaw })
      outputs.push(newRaw)
    } else if (renamed) {
      changes.push({
        kind: "rename",
        fromPath: `${dir}/${page.originalName}`,
        path,
        before: page.originalRaw,
        after: newRaw,
      })
      outputs.push(newRaw)
    } else if (newRaw !== page.originalRaw) {
      changes.push({ kind: "modify", path, before: page.originalRaw, after: newRaw })
      outputs.push(newRaw)
    } else {
      outputs.push(page.originalRaw)
    }
  }

  // uploads: only ship images something actually references
  const haystack =
    outputs.join("\n") + "\n" + JSON.stringify(input.meta)
  for (const upload of input.uploads) {
    if (haystack.includes(`./${upload.name}`)) {
      changes.push({
        kind: "add-binary",
        path: `${dir}/${upload.name}`,
        data: upload.data,
      })
    }
  }

  return changes
}
