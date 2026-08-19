import type {
  BlockContent,
  Definition,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  Table,
} from "mdast"
import type {
  MdxJsxAttribute,
  MdxJsxExpressionAttribute,
  MdxJsxFlowElement,
  MdxJsxTextElement,
} from "mdast-util-mdx-jsx"
import remarkGfm from "remark-gfm"
import remarkMdx from "remark-mdx"
import remarkParse from "remark-parse"
import { unified } from "unified"

import { evaluateEstree } from "@/lib/editor/estree"
import {
  sortMarks,
  type BlockSlice,
  type PMMark,
  type PMNode,
  type PinRow,
} from "@/lib/editor/pm-doc"

/* MDX body → ProseMirror JSON, via mdast (the real MDX grammar - remark +
   remark-mdx + gfm, the same stack the site renders with).

   Every top-level block also records its original source slice keyed by
   the exact PM JSON it produced. The serializer reuses those slices for
   blocks the author never touched, so a patch only rewrites the blocks
   that actually changed - Wikipedia-tier diff hygiene.

   Anything outside the closed vocabulary (unknown JSX, imports, exports,
   non-comment expressions) becomes a locked "rawMdx" block that
   round-trips verbatim - the editor can never destroy what it doesn't
   understand. A file that fails to parse at all is caught by the caller
   and opened in source mode instead. */

export class MdxParseError extends Error {}

export type ParsedDoc = {
  doc: PMNode
  /** Top-level blocks in order, with original source and separators - the
      serializer reuses these for blocks the author never touched. */
  original: BlockSlice[]
}

const processor = unified().use(remarkParse).use(remarkMdx).use(remarkGfm)

export function parseMdxDoc(src: string): ParsedDoc {
  const root = processor.parse(src) as Root
  const ctx = new Ctx(src, root)
  const content: PMNode[] = []
  const original: BlockSlice[] = []
  let prevEnd: number | null = null

  for (const child of root.children) {
    if (child.type === "definition") continue // resolved into links below
    const blocks = toArray(convertBlock(child as RootContent, ctx))
    const start = child.position?.start.offset
    const end = child.position?.end.offset
    const slice = sliceOf(src, child)
    for (const block of blocks) {
      content.push(block)
      if (slice !== null && blocks.length === 1 && start !== undefined) {
        original.push({
          key: JSON.stringify(block),
          src: slice,
          sep: prevEnd === null ? "" : src.slice(prevEnd, start),
          index: content.length - 1,
        })
      }
    }
    if (end !== undefined) prevEnd = end
  }

  if (content.length === 0) content.push({ type: "paragraph" })
  return { doc: { type: "doc", content }, original }
}

/* ---------- context ---------- */

class Ctx {
  definitions = new Map<string, Definition>()
  constructor(
    public src: string,
    root: Root
  ) {
    const collect = (nodes: RootContent[]) => {
      for (const n of nodes) {
        if (n.type === "definition") this.definitions.set(n.identifier, n)
        if ("children" in n) collect(n.children as RootContent[])
      }
    }
    collect(root.children)
  }
}

function sliceOf(src: string, node: RootContent): string | null {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (start === undefined || end === undefined) return null
  return src.slice(start, end)
}

function toArray<T>(v: T | T[] | null): T[] {
  if (v === null) return []
  return Array.isArray(v) ? v : [v]
}

/* ---------- attributes ---------- */

type JsxAttr = MdxJsxAttribute | MdxJsxExpressionAttribute

function attrValue(attrs: JsxAttr[], name: string): unknown {
  for (const a of attrs) {
    if (a.type !== "mdxJsxAttribute" || a.name !== name) continue
    if (a.value === null || a.value === undefined) return true // bare attr
    if (typeof a.value === "string") return a.value
    // expression attribute - evaluate the literal AST
    const estree = a.value.data?.estree
    if (!estree) throw new MdxParseError(`attribute ${name} has no AST`)
    return evaluateEstree(estree as unknown as { type: string })
  }
  return undefined
}

function stringAttr(attrs: JsxAttr[], name: string): string | undefined {
  const v = attrValue(attrs, name)
  return typeof v === "string" ? v : undefined
}

function hasSpread(attrs: JsxAttr[]): boolean {
  return attrs.some((a) => a.type === "mdxJsxExpressionAttribute")
}

/* ---------- block conversion ---------- */

function convertBlock(node: RootContent, ctx: Ctx): PMNode | PMNode[] | null {
  switch (node.type) {
    case "paragraph": {
      const content = convertInline(node.children, [], ctx)
      return { type: "paragraph", ...(content.length ? { content } : {}) }
    }
    case "heading":
      return {
        type: "heading",
        attrs: { level: node.depth },
        content: orNone(convertInline(node.children, [], ctx)),
      }
    case "list": {
      const items = node.children.map((li) => convertListItem(li, ctx))
      // "spread" (loose) lists put blank lines between items; losing it
      // would merge multi-paragraph items on re-serialization
      const spread =
        (node.spread ?? false) || node.children.some((li) => li.spread ?? false)
      return node.ordered
        ? {
            type: "orderedList",
            attrs: { start: node.start ?? 1, spread },
            content: items,
          }
        : { type: "bulletList", attrs: { spread }, content: items }
    }
    case "blockquote":
      return {
        type: "blockquote",
        content: blocksOf(node.children as RootContent[], ctx),
      }
    case "code":
      return {
        type: "codeBlock",
        attrs: { language: node.lang ?? null },
        content: node.value ? [{ type: "text", text: node.value }] : undefined,
      }
    case "thematicBreak":
      return { type: "horizontalRule" }
    case "table":
      return convertTable(node, ctx)
    case "mdxJsxFlowElement":
      return convertJsxFlow(node, ctx)
    case "mdxFlowExpression": {
      const m = node.value.match(/^\s*\/\*([\s\S]*?)\*\/\s*$/)
      if (m) {
        // per-line trim: micromark dedents expression bodies inconsistently,
        // so normalized text is the only stable representation
        const text = m[1]
          .split("\n")
          .map((l) => l.trim())
          .join("\n")
          .trim()
        return { type: "mdxComment", attrs: { text } }
      }
      return rawBlock(node, ctx)
    }
    case "mdxjsEsm":
      return rawBlock(node, ctx)
    case "html":
      return rawBlock(node, ctx)
    default:
      throw new MdxParseError(`unsupported block: ${node.type}`)
  }
}

function orNone(content: PMNode[]): PMNode[] | undefined {
  return content.length ? content : undefined
}

function blocksOf(children: RootContent[], ctx: Ctx): PMNode[] {
  const out: PMNode[] = []
  for (const child of children) {
    if (child.type === "definition") continue
    out.push(...toArray(convertBlock(child, ctx)))
  }
  if (out.length === 0) out.push({ type: "paragraph" })
  return out
}

function convertListItem(item: ListItem, ctx: Ctx): PMNode {
  return {
    type: "listItem",
    content: blocksOf(item.children as RootContent[], ctx),
  }
}

function convertTable(table: Table, ctx: Ctx): PMNode {
  const rows = table.children.map((row, ri) => ({
    type: "tableRow",
    content: row.children.map((cell) => ({
      type: ri === 0 ? "tableHeader" : "tableCell",
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [
        {
          type: "paragraph",
          ...(() => {
            const c = convertInline(cell.children, [], ctx)
            return c.length ? { content: c } : {}
          })(),
        },
      ],
    })),
  }))
  return {
    type: "table",
    attrs: { align: table.align ?? null },
    content: rows,
  }
}

function rawBlock(node: RootContent, ctx: Ctx): PMNode {
  const slice = sliceOf(ctx.src, node)
  if (slice === null) throw new MdxParseError("raw block without position")
  return { type: "rawMdx", attrs: { value: slice } }
}

/* ---------- the block registry ---------- */

function convertJsxFlow(node: MdxJsxFlowElement, ctx: Ctx): PMNode | PMNode[] {
  const { name, attributes: attrs } = node
  if (!name || hasSpread(attrs)) return rawBlock(node, ctx)

  switch (name) {
    case "Step":
      return {
        type: "step",
        attrs: {
          title: stringAttr(attrs, "title") ?? "",
          image: stringAttr(attrs, "image") ?? null,
          alt: stringAttr(attrs, "alt") ?? null,
        },
        content: blocksOf(node.children as RootContent[], ctx),
      }
    case "Warning":
    case "Checkpoint":
      return {
        type: name === "Warning" ? "warning" : "checkpoint",
        attrs: { title: stringAttr(attrs, "title") ?? null },
        content: blocksOf(node.children as RootContent[], ctx),
      }
    case "PartsList":
      return { type: "partsList" }
    case "Schematic":
      return {
        type: "schematic",
        attrs: {
          src: stringAttr(attrs, "src") ?? "",
          alt: stringAttr(attrs, "alt") ?? "",
          caption: stringAttr(attrs, "caption") ?? null,
        },
      }
    case "Video":
      return {
        type: "video",
        attrs: {
          id: stringAttr(attrs, "id") ?? "",
          title: stringAttr(attrs, "title") ?? "",
        },
      }
    case "PinTable": {
      if (node.children.length > 0) return rawBlock(node, ctx)
      const pins = attrValue(attrs, "pins")
      if (!Array.isArray(pins)) return rawBlock(node, ctx)
      return { type: "pinTable", attrs: { pins: pins as PinRow[] } }
    }
    case "ReadMore":
      return {
        type: "readMore",
        content: blocksOf(node.children as RootContent[], ctx),
      }
    case "ExternalGuide":
      return {
        type: "externalGuide",
        attrs: {
          href: stringAttr(attrs, "href") ?? "",
          title: stringAttr(attrs, "title") ?? "",
          source: stringAttr(attrs, "source") ?? null,
        },
        content: node.children.length
          ? blocksOf(node.children as RootContent[], ctx)
          : [{ type: "paragraph" }],
      }
    case "ShipIt":
      // empty <ShipIt /> still gets one paragraph so the cursor has a home;
      // the serializer drops empty paragraphs, so it round-trips self-closing
      return {
        type: "shipIt",
        content: blocksOf(node.children as RootContent[], ctx),
      }
    // inline chips written on their own line arrive as flow elements
    case "ConceptLink":
    case "Tool":
    case "Difficulty": {
      const inline = convertJsxText(
        node as unknown as MdxJsxTextElement,
        [],
        ctx
      )
      return { type: "paragraph", content: toArray(inline) }
    }
    default:
      return rawBlock(node, ctx)
  }
}

/* ---------- inline conversion ---------- */

function cleanText(value: string): string {
  // soft line breaks in wrapped source read as spaces
  return value.replace(/[ \t]*\n[ \t]*/g, " ")
}

function textNode(text: string, marks: PMMark[]): PMNode | null {
  if (text.length === 0) return null
  return {
    type: "text",
    text,
    ...(marks.length ? { marks: sortMarks(marks) } : {}),
  }
}

function convertInline(
  children: PhrasingContent[],
  marks: PMMark[],
  ctx: Ctx
): PMNode[] {
  const out: PMNode[] = []
  for (const child of children) {
    const converted = convertPhrasing(child, marks, ctx)
    for (const n of toArray(converted)) out.push(n)
  }
  return out
}

function withMark(marks: PMMark[], mark: PMMark): PMMark[] {
  return [...marks.filter((m) => m.type !== mark.type), mark]
}

function convertPhrasing(
  node: PhrasingContent,
  marks: PMMark[],
  ctx: Ctx
): PMNode | PMNode[] | null {
  switch (node.type) {
    case "text":
      return textNode(cleanText(node.value), marks)
    case "strong":
      return convertInline(node.children, withMark(marks, { type: "bold" }), ctx)
    case "emphasis":
      return convertInline(
        node.children,
        withMark(marks, { type: "italic" }),
        ctx
      )
    case "delete":
      return convertInline(
        node.children,
        withMark(marks, { type: "strike" }),
        ctx
      )
    case "inlineCode":
      return textNode(node.value, withMark(marks, { type: "code" }))
    case "link":
      return convertInline(
        node.children,
        withMark(marks, {
          type: "link",
          attrs: { href: node.url, title: node.title ?? null },
        }),
        ctx
      )
    case "linkReference": {
      const def = ctx.definitions.get(node.identifier)
      if (!def) throw new MdxParseError(`unresolved link ref ${node.identifier}`)
      return convertInline(
        node.children,
        withMark(marks, {
          type: "link",
          attrs: { href: def.url, title: def.title ?? null },
        }),
        ctx
      )
    }
    case "image":
      return {
        type: "image",
        attrs: { src: node.url, alt: node.alt ?? "", title: node.title ?? null },
      }
    case "imageReference": {
      const def = ctx.definitions.get(node.identifier)
      if (!def) throw new MdxParseError(`unresolved image ref`)
      return {
        type: "image",
        attrs: { src: def.url, alt: node.alt ?? "", title: def.title ?? null },
      }
    }
    case "break":
      return { type: "hardBreak" }
    case "mdxJsxTextElement":
      return convertJsxText(node, marks, ctx)
    case "mdxTextExpression":
      return {
        type: "rawInline",
        attrs: { value: `{${node.value}}` },
      }
    case "footnoteReference":
      throw new MdxParseError("footnotes aren't supported")
    case "html":
      throw new MdxParseError("raw html isn't supported")
    default:
      throw new MdxParseError(
        `unsupported inline: ${(node as { type: string }).type}`
      )
  }
}

function convertJsxText(
  node: MdxJsxTextElement,
  marks: PMMark[],
  ctx: Ctx
): PMNode | PMNode[] {
  const { name, attributes: attrs } = node
  if (!name || hasSpread(attrs)) {
    const slice = sliceOf(ctx.src, node as unknown as RootContent)
    if (slice === null) throw new MdxParseError("raw inline without position")
    return { type: "rawInline", attrs: { value: slice } }
  }

  switch (name) {
    case "ConceptLink":
    case "Tool": {
      const slug = stringAttr(attrs, "slug") ?? ""
      const content = convertInline(node.children, [], ctx)
      return {
        type: name === "ConceptLink" ? "conceptLink" : "toolLink",
        attrs: { slug },
        ...(content.length ? { content } : {}),
        ...(marks.length ? { marks: sortMarks(marks) } : {}),
      }
    }
    case "Difficulty":
      return {
        type: "difficulty",
        attrs: { level: stringAttr(attrs, "level") ?? "beginner" },
        ...(marks.length ? { marks: sortMarks(marks) } : {}),
      }
    case "kbd":
      return convertInline(node.children, withMark(marks, { type: "kbd" }), ctx)
    default: {
      const slice = sliceOf(ctx.src, node as unknown as RootContent)
      if (slice === null) throw new MdxParseError("raw inline without position")
      return { type: "rawInline", attrs: { value: slice } }
    }
  }
}

/* re-exported for tests */
export type { BlockContent }
