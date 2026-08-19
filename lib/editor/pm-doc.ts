/* The editor's document JSON - plain ProseMirror/Tiptap JSON shapes, kept
   in their own module so the parse/serialize layer (pure, node-testable)
   never imports Tiptap. Node type names here must match the Tiptap schema
   in components/editor. */

export type PMMark = {
  type: string
  attrs?: Record<string, unknown>
}

export type PMNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: PMNode[]
  marks?: PMMark[]
  text?: string
}

export const BLOCK_JSX = [
  "Step",
  "Warning",
  "Checkpoint",
  "PartsList",
  "Schematic",
  "Video",
  "PinTable",
  "ReadMore",
  "ExternalGuide",
  "ShipIt",
] as const

export const INLINE_JSX = ["ConceptLink", "Tool", "Difficulty", "kbd"] as const

export type PinRow = { pin: string; signal: string; note?: string }

/* Canonical mark nesting order, outermost first. Shared by the parser
   (which sorts each text node's marks into this order so identical
   formatting always produces identical JSON) and the serializer (which
   nests wrappers in the same order). Code stays innermost - inlineCode
   is a leaf in markdown. */
export const MARK_PRIORITY: Record<string, number> = {
  link: 0,
  bold: 1,
  italic: 2,
  strike: 3,
  kbd: 4,
  code: 5,
}

export function sortMarks(marks: PMMark[]): PMMark[] {
  return [...marks].sort(
    (a, b) => (MARK_PRIORITY[a.type] ?? 9) - (MARK_PRIORITY[b.type] ?? 9)
  )
}

/** One top-level source block: its PM JSON key, its original source text,
    and the exact separator that preceded it in the file. `index` is the
    block's position in doc.content, so keys can be re-derived from the
    ProseMirror-normalized doc (PM adds mark/attr defaults on load). */
export type BlockSlice = { key: string; src: string; sep: string; index: number }

export function remapSliceKeys(
  slices: BlockSlice[],
  normalizedDoc: PMNode
): BlockSlice[] {
  const content = normalizedDoc.content ?? []
  return slices.map((s) => ({
    ...s,
    key: content[s.index] !== undefined ? JSON.stringify(content[s.index]) : s.key,
  }))
}
