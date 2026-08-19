import type {
  BlockContent,
  ListItem,
  PhrasingContent,
  RootContent,
} from "mdast"
import { gfmToMarkdown } from "mdast-util-gfm"
import { mdxToMarkdown } from "mdast-util-mdx"
import type { MdxJsxAttribute } from "mdast-util-mdx-jsx"
import { toMarkdown, type Options } from "mdast-util-to-markdown"

import { printExpression } from "@/lib/editor/estree"
import {
  MARK_PRIORITY,
  type BlockSlice,
  type PMMark,
  type PMNode,
  type PinRow,
} from "@/lib/editor/pm-doc"

/* ProseMirror JSON → MDX source, the inverse of mdx-parse.

   Two-tier: a top-level block whose JSON matches what parsing produced is
   emitted as its ORIGINAL source slice, byte for byte - only blocks the
   author actually touched are re-serialized. Patches stay reviewable. */

export class MdxSerializeError extends Error {}

const TO_MARKDOWN: Options = {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  rule: "-",
  listItemIndent: "one",
  fence: "`",
  fences: true,
  quote: '"',
  setext: false,
  tightDefinitions: true,
  extensions: [
    mdxToMarkdown({ printWidth: 100, quote: '"' }),
    gfmToMarkdown(),
  ],
  handlers: {
    // verbatim escape hatch for rawMdx / rawInline content
    joltsRaw: (node: { value: string }) => node.value,
  } as Options["handlers"],
}

export function serializeMdxDoc(
  doc: PMNode,
  original: BlockSlice[] = []
): string {
  /* Positional matching: scan forward through the original blocks. A PM
     block whose JSON matches an original is emitted as its source slice;
     when it also directly follows the previously consumed original, the
     exact separator between them is reproduced too (lists that interrupt
     paragraphs, extra blank lines, ...). Everything else re-serializes. */
  let out = ""
  let cursor = 0
  let lastConsumed = -2 // never adjacent to index 0's predecessor
  let first = true

  for (const block of doc.content ?? []) {
    if (isEmptyParagraph(block)) continue
    const key = JSON.stringify(block)
    let found = -1
    for (let j = cursor; j < original.length; j++) {
      if (original[j].key === key) {
        found = j
        break
      }
    }
    let sep = first ? "" : "\n\n"
    let src: string
    if (found >= 0) {
      if (!first && found === lastConsumed + 1 && original[found].sep)
        sep = original[found].sep
      src = original[found].src
      cursor = found + 1
      lastConsumed = found
    } else {
      src = serializeBlockToMarkdown(block)
      lastConsumed = -2
    }
    out += sep + src
    first = false
  }
  if (out === "") return ""
  return out.replace(/\n+$/, "") + "\n"
}

function isEmptyParagraph(block: PMNode): boolean {
  return block.type === "paragraph" && !(block.content ?? []).length
}

export function serializeBlockToMarkdown(block: PMNode): string {
  const mdast = blockToMdast(block)
  const root = { type: "root", children: toArray(mdast) } as never
  return toMarkdown(root, TO_MARKDOWN).replace(/\n+$/, "")
}

function toArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v]
}

/* ---------- attributes ---------- */

function jsxAttr(name: string, value: string): MdxJsxAttribute {
  return { type: "mdxJsxAttribute", name, value }
}

function jsxExprAttr(name: string, value: unknown): MdxJsxAttribute {
  return {
    type: "mdxJsxAttribute",
    name,
    value: {
      type: "mdxJsxAttributeValueExpression",
      value: printExpression(value, 2),
    },
  }
}

function flowEl(
  name: string,
  attributes: MdxJsxAttribute[],
  children: BlockContent[]
): RootContent {
  return {
    type: "mdxJsxFlowElement",
    name,
    attributes,
    children,
  } as RootContent
}

/* ---------- blocks ---------- */

function blocksToMdast(blocks: PMNode[] | undefined): BlockContent[] {
  const out: BlockContent[] = []
  for (const b of blocks ?? []) {
    if (isEmptyParagraph(b)) continue
    out.push(...(toArray(blockToMdast(b)) as BlockContent[]))
  }
  return out
}

function blockToMdast(block: PMNode): RootContent | RootContent[] {
  switch (block.type) {
    case "paragraph":
      return { type: "paragraph", children: inlineToMdast(block.content ?? []) }
    case "heading":
      return {
        type: "heading",
        depth: clampDepth(block.attrs?.level),
        children: inlineToMdast(block.content ?? []),
      }
    case "bulletList": {
      const spread = Boolean(block.attrs?.spread)
      return {
        type: "list",
        ordered: false,
        spread,
        children: (block.content ?? []).map((li) => listItemToMdast(li, spread)),
      }
    }
    case "orderedList": {
      const spread = Boolean(block.attrs?.spread)
      return {
        type: "list",
        ordered: true,
        start: Number(block.attrs?.start ?? 1),
        spread,
        children: (block.content ?? []).map((li) => listItemToMdast(li, spread)),
      }
    }
    case "blockquote":
      return { type: "blockquote", children: blocksToMdast(block.content) }
    case "codeBlock":
      return {
        type: "code",
        lang: (block.attrs?.language as string | null) ?? null,
        value: (block.content ?? []).map((n) => n.text ?? "").join(""),
      }
    case "horizontalRule":
      return { type: "thematicBreak" }
    case "table":
      return tableToMdast(block)
    case "step": {
      const attrs = [jsxAttr("title", String(block.attrs?.title ?? ""))]
      if (block.attrs?.image) attrs.push(jsxAttr("image", String(block.attrs.image)))
      if (block.attrs?.alt) attrs.push(jsxAttr("alt", String(block.attrs.alt)))
      return flowEl("Step", attrs, blocksToMdast(block.content))
    }
    case "warning":
    case "checkpoint": {
      const name = block.type === "warning" ? "Warning" : "Checkpoint"
      const attrs = block.attrs?.title
        ? [jsxAttr("title", String(block.attrs.title))]
        : []
      return flowEl(name, attrs, blocksToMdast(block.content))
    }
    case "partsList":
      return flowEl("PartsList", [], [])
    case "schematic": {
      const attrs = [
        jsxAttr("src", String(block.attrs?.src ?? "")),
        jsxAttr("alt", String(block.attrs?.alt ?? "")),
      ]
      if (block.attrs?.caption)
        attrs.push(jsxAttr("caption", String(block.attrs.caption)))
      return flowEl("Schematic", attrs, [])
    }
    case "video":
      return flowEl(
        "Video",
        [
          jsxAttr("id", String(block.attrs?.id ?? "")),
          jsxAttr("title", String(block.attrs?.title ?? "")),
        ],
        []
      )
    case "pinTable": {
      const pins = (block.attrs?.pins ?? []) as PinRow[]
      return flowEl("PinTable", [jsxExprAttr("pins", pins)], [])
    }
    case "readMore":
      return flowEl("ReadMore", [], blocksToMdast(block.content))
    case "externalGuide": {
      const attrs = [
        jsxAttr("href", String(block.attrs?.href ?? "")),
        jsxAttr("title", String(block.attrs?.title ?? "")),
      ]
      if (block.attrs?.source)
        attrs.push(jsxAttr("source", String(block.attrs.source)))
      return flowEl("ExternalGuide", attrs, blocksToMdast(block.content))
    }
    case "shipIt":
      return flowEl("ShipIt", [], blocksToMdast(block.content))
    case "mdxComment": {
      const text = String(block.attrs?.text ?? "")
      return {
        type: "mdxFlowExpression",
        value: text.includes("\n")
          ? `/*\n  ${text.replace(/\n/g, "\n  ")}\n*/`
          : `/* ${text} */`,
      } as RootContent
    }
    case "rawMdx":
      return { type: "joltsRaw", value: String(block.attrs?.value ?? "") } as never
    default:
      throw new MdxSerializeError(`unsupported block: ${block.type}`)
  }
}

function clampDepth(level: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const n = Number(level ?? 2)
  return Math.min(6, Math.max(1, Math.round(n))) as 1 | 2 | 3 | 4 | 5 | 6
}

function listItemToMdast(item: PMNode, spread: boolean): ListItem {
  return {
    type: "listItem",
    spread,
    children: blocksToMdast(item.content),
  }
}

function tableToMdast(table: PMNode): RootContent {
  const align = (table.attrs?.align as ("left" | "right" | "center" | null)[]) ?? null
  return {
    type: "table",
    align,
    children: (table.content ?? []).map((row) => ({
      type: "tableRow",
      children: (row.content ?? []).map((cell) => ({
        type: "tableCell",
        children: cellInline(cell),
      })),
    })),
  } as RootContent
}

function cellInline(cell: PMNode): PhrasingContent[] {
  // cells hold a single paragraph in this schema
  const out: PhrasingContent[] = []
  for (const block of cell.content ?? []) {
    if (block.type === "paragraph")
      out.push(...inlineToMdast(block.content ?? []))
  }
  return out
}

/* ---------- inline ---------- */

function outermostMark(node: PMNode): PMMark | null {
  const marks = node.marks ?? []
  if (marks.length === 0) return null
  return [...marks].sort(
    (a, b) => (MARK_PRIORITY[a.type] ?? 9) - (MARK_PRIORITY[b.type] ?? 9)
  )[0]
}

function markEquals(a: PMMark, b: PMMark): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function hasMark(node: PMNode, mark: PMMark): boolean {
  return (node.marks ?? []).some((m) => markEquals(m, mark))
}

function stripMark(node: PMNode, mark: PMMark): PMNode {
  const marks = (node.marks ?? []).filter((m) => !markEquals(m, mark))
  const { marks: _drop, ...rest } = node
  void _drop
  return marks.length ? { ...rest, marks } : rest
}

function wrapMark(mark: PMMark, children: PhrasingContent[]): PhrasingContent {
  switch (mark.type) {
    case "bold":
      return { type: "strong", children }
    case "italic":
      return { type: "emphasis", children }
    case "strike":
      return { type: "delete", children }
    case "link":
      return {
        type: "link",
        url: String(mark.attrs?.href ?? ""),
        title: (mark.attrs?.title as string | null) ?? null,
        children,
      }
    case "kbd":
      return {
        type: "mdxJsxTextElement",
        name: "kbd",
        attributes: [],
        children,
      } as PhrasingContent
    default:
      throw new MdxSerializeError(`unsupported mark: ${mark.type}`)
  }
}

export function inlineToMdast(nodes: PMNode[]): PhrasingContent[] {
  const out: PhrasingContent[] = []
  let i = 0
  while (i < nodes.length) {
    const node = nodes[i]
    const mark = outermostMark(node)
    if (!mark) {
      out.push(inlineLeaf(node))
      i++
      continue
    }
    if (mark.type === "code") {
      out.push({ type: "inlineCode", value: node.text ?? "" })
      i++
      continue
    }
    const run: PMNode[] = []
    while (i < nodes.length && hasMark(nodes[i], mark)) {
      run.push(stripMark(nodes[i], mark))
      i++
    }
    out.push(wrapMark(mark, inlineToMdast(run)))
  }
  return out
}

function inlineLeaf(node: PMNode): PhrasingContent {
  switch (node.type) {
    case "text":
      return { type: "text", value: node.text ?? "" }
    case "image":
      return {
        type: "image",
        url: String(node.attrs?.src ?? ""),
        alt: String(node.attrs?.alt ?? ""),
        title: (node.attrs?.title as string | null) ?? null,
      }
    case "hardBreak":
      return { type: "break" }
    case "conceptLink":
    case "toolLink":
      return {
        type: "mdxJsxTextElement",
        name: node.type === "conceptLink" ? "ConceptLink" : "Tool",
        attributes: [jsxAttr("slug", String(node.attrs?.slug ?? ""))],
        children: inlineToMdast(node.content ?? []),
      } as PhrasingContent
    case "difficulty":
      return {
        type: "mdxJsxTextElement",
        name: "Difficulty",
        attributes: [jsxAttr("level", String(node.attrs?.level ?? "beginner"))],
        children: [],
      } as PhrasingContent
    case "rawInline":
      return { type: "joltsRaw", value: String(node.attrs?.value ?? "") } as never
    default:
      throw new MdxSerializeError(`unsupported inline: ${node.type}`)
  }
}
