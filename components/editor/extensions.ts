"use client"

import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core"
import { Code } from "@tiptap/extension-code"
import { TableKit } from "@tiptap/extension-table"
import { CharacterCount, Placeholder } from "@tiptap/extensions"
import { ReactNodeViewRenderer } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"

import { SlashCommands } from "@/components/editor/slash-menu"

import { DifficultyView, makeChipView } from "@/components/editor/views/chips"
import {
  CheckpointView,
  ShipItView,
  WarningView,
} from "@/components/editor/views/frames"
import { ImageView, SchematicView, VideoView } from "@/components/editor/views/media"
import { CommentView, RawInlineView, RawMdxView } from "@/components/editor/views/misc"
import { PartsListView } from "@/components/editor/views/parts-list"
import { PinTableView } from "@/components/editor/views/pin-table"
import { ExternalGuideView, ReadMoreView } from "@/components/editor/views/read-more"
import { StepView } from "@/components/editor/views/step"

/* The editing schema: StarterKit prose + GFM tables + the closed Jolts
   block registry, one custom node per block, each rendered by a React
   node view wearing the reader's exact styles. Node type names and attrs
   must match lib/editor/mdx-parse + mdx-serialize. */

/* ---------- helpers ---------- */

const dataAttrs = (names: string[]) =>
  Object.fromEntries(
    names.map((n) => [
      n,
      {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute(`data-${n}`),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs[n] == null ? {} : { [`data-${n}`]: String(attrs[n]) },
      },
    ])
  )

/* ---------- container blocks ---------- */

export const Step = Node.create({
  name: "step",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      title: { default: "" },
      image: { default: null },
      alt: { default: null },
    }
  },
  parseHTML: () => [{ tag: "section[data-jolts-step]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "section",
    mergeAttributes({ "data-jolts-step": "" }, HTMLAttributes),
    0,
  ],
  addNodeView() {
    return ReactNodeViewRenderer(StepView)
  },
})

const frameNode = (
  name: "warning" | "checkpoint",
  view: typeof WarningView
) =>
  Node.create({
    name,
    group: "block",
    content: "block+",
    defining: true,
    isolating: true,
    addAttributes: () => ({ title: { default: null } }),
    parseHTML: () => [{ tag: `aside[data-jolts-${name}]` }],
    renderHTML: ({ HTMLAttributes }) => [
      "aside",
      mergeAttributes({ [`data-jolts-${name}`]: "" }, HTMLAttributes),
      0,
    ],
    addNodeView() {
      return ReactNodeViewRenderer(view)
    },
  })

export const Warning = frameNode("warning", WarningView)
export const Checkpoint = frameNode("checkpoint", CheckpointView)

export const ShipIt = Node.create({
  name: "shipIt",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  parseHTML: () => [{ tag: "aside[data-jolts-shipit]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "aside",
    mergeAttributes({ "data-jolts-shipit": "" }, HTMLAttributes),
    0,
  ],
  addNodeView() {
    return ReactNodeViewRenderer(ShipItView)
  },
})

export const ReadMore = Node.create({
  name: "readMore",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  parseHTML: () => [{ tag: "aside[data-jolts-readmore]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "aside",
    mergeAttributes({ "data-jolts-readmore": "" }, HTMLAttributes),
    0,
  ],
  addNodeView() {
    return ReactNodeViewRenderer(ReadMoreView)
  },
})

export const ExternalGuide = Node.create({
  name: "externalGuide",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes: () => ({
    href: { default: "" },
    title: { default: "" },
    source: { default: null },
  }),
  parseHTML: () => [{ tag: "div[data-jolts-external]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes({ "data-jolts-external": "" }, HTMLAttributes),
    0,
  ],
  addNodeView() {
    return ReactNodeViewRenderer(ExternalGuideView)
  },
})

/* ---------- leaf blocks ---------- */

const atomBlock = (
  name: string,
  attrs: Record<string, { default: unknown }>,
  view: typeof PartsListView
) =>
  Node.create({
    name,
    group: "block",
    atom: true,
    selectable: true,
    addAttributes: () => attrs,
    parseHTML: () => [{ tag: `div[data-jolts-${name.toLowerCase()}]` }],
    renderHTML: ({ HTMLAttributes }) => [
      "div",
      mergeAttributes({ [`data-jolts-${name.toLowerCase()}`]: "" }, HTMLAttributes),
    ],
    addNodeView() {
      return ReactNodeViewRenderer(view)
    },
  })

export const PartsList = atomBlock("partsList", {}, PartsListView)
export const Schematic = atomBlock(
  "schematic",
  { src: { default: "" }, alt: { default: "" }, caption: { default: null } },
  SchematicView
)
export const Video = atomBlock(
  "video",
  { id: { default: "" }, title: { default: "" } },
  VideoView
)
export const PinTable = atomBlock(
  "pinTable",
  { pins: { default: [] } },
  PinTableView
)
export const MdxComment = atomBlock(
  "mdxComment",
  { text: { default: "" } },
  CommentView
)
export const RawMdx = atomBlock("rawMdx", { value: { default: "" } }, RawMdxView)

/* ---------- inline nodes ---------- */

export const JoltsImage = Node.create({
  name: "image",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,
  addAttributes: () => ({
    src: { default: "" },
    alt: { default: "" },
    title: { default: null },
  }),
  parseHTML: () => [{ tag: "img[src]" }],
  renderHTML: ({ HTMLAttributes }) => ["img", mergeAttributes(HTMLAttributes)],
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})

const chipNode = (name: "conceptLink" | "toolLink") =>
  Node.create({
    name,
    group: "inline",
    inline: true,
    content: "text*",
    addAttributes: () => dataAttrs(["slug"]),
    parseHTML: () => [{ tag: `span[data-jolts-${name.toLowerCase()}]` }],
    renderHTML: ({ HTMLAttributes }) => [
      "span",
      mergeAttributes({ [`data-jolts-${name.toLowerCase()}`]: "" }, HTMLAttributes),
      0,
    ],
    addNodeView() {
      return ReactNodeViewRenderer(makeChipView(name), {
        contentDOMElementTag: "span",
      })
    },
  })

export const ConceptLink = chipNode("conceptLink")
export const ToolLink = chipNode("toolLink")

export const Difficulty = Node.create({
  name: "difficulty",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ level: { default: "beginner" } }),
  parseHTML: () => [{ tag: "span[data-jolts-difficulty]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "span",
    mergeAttributes({ "data-jolts-difficulty": "" }, HTMLAttributes),
  ],
  addNodeView() {
    return ReactNodeViewRenderer(DifficultyView)
  },
})

export const RawInline = Node.create({
  name: "rawInline",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ value: { default: "" } }),
  parseHTML: () => [{ tag: "span[data-jolts-rawinline]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "span",
    mergeAttributes({ "data-jolts-rawinline": "" }, HTMLAttributes),
  ],
  addNodeView() {
    return ReactNodeViewRenderer(RawInlineView)
  },
})

/* ---------- marks ---------- */

/* markdown happily nests code inside links and bold ([`x`](url), **`x`**);
   Tiptap's default Code mark excludes everything, which would kick those
   pages into source mode */
const JoltsCode = Code.extend({ excludes: "" })

export const Kbd = Mark.create({
  name: "kbd",
  parseHTML: () => [{ tag: "kbd" }],
  renderHTML: ({ HTMLAttributes }) => ["kbd", mergeAttributes(HTMLAttributes), 0],
})

/* Containers are `isolating`, so Backspace can't merge across their edge -
   correct for content safety, but it would trap the caret in an EMPTY
   Warning/Step/… with a dead Backspace. Notion rule: Backspace at the
   start of an empty container deletes the container. */
const CONTAINER_NAMES = new Set([
  "step",
  "warning",
  "checkpoint",
  "shipIt",
  "readMore",
  "externalGuide",
])

const ContainerKeymap = Extension.create({
  name: "joltsContainerKeymap",
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection
        if (!empty || $from.parentOffset !== 0) return false
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d)
          if (!CONTAINER_NAMES.has(node.type.name)) continue
          // caret must sit at the very first position inside the container
          let atStart = true
          for (let dd = d; dd < $from.depth; dd++) {
            if ($from.index(dd) !== 0) atStart = false
          }
          if (!atStart) return false
          const isEmpty =
            node.childCount === 1 &&
            node.firstChild?.type.name === "paragraph" &&
            node.firstChild.childCount === 0
          if (!isEmpty) return false
          const from = $from.before(d)
          return editor
            .chain()
            .deleteRange({ from, to: from + node.nodeSize })
            .focus()
            .run()
        }
        return false
      },
    }
  },
})

/* markdown fidelity attrs: list "spread" (loose vs tight), table column
   alignment, and link titles - all invisible in the editor, all
   round-tripped */
const JoltsAttrs = Extension.create({
  name: "joltsAttrs",
  addGlobalAttributes() {
    return [
      {
        types: ["bulletList", "orderedList"],
        attributes: {
          spread: { default: false, rendered: false },
        },
      },
      {
        types: ["table"],
        attributes: {
          align: { default: null, rendered: false },
        },
      },
      {
        types: ["link"],
        attributes: {
          title: { default: null, rendered: false },
        },
      },
    ]
  },
})

/* ---------- assembly ---------- */

export function buildExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      },
      codeBlock: {
        HTMLAttributes: { spellcheck: "false" },
      },
      underline: false,
      code: false,
    }),
    JoltsCode,
    TableKit.configure({
      table: { resizable: false },
    }),
    SlashCommands,
    ContainerKeymap,
    JoltsAttrs,
    Kbd,
    Step,
    Warning,
    Checkpoint,
    ShipIt,
    ReadMore,
    ExternalGuide,
    PartsList,
    Schematic,
    Video,
    PinTable,
    MdxComment,
    RawMdx,
    JoltsImage,
    ConceptLink,
    ToolLink,
    Difficulty,
    RawInline,
    CharacterCount,
    Placeholder.configure({
      placeholder: ({ editor }) =>
        editor.state.doc.childCount === 1 &&
        editor.state.doc.firstChild?.childCount === 0
          ? placeholder
          : "Type, or press / for blocks…",
      showOnlyCurrent: true,
      includeChildren: true,
    }),
  ]
}
