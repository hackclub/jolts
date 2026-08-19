"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

import {
  ArrowUpRight,
  ChatCircleDots,
  CheckCircle,
  Code,
  Image as ImageIcon,
  Lightbulb,
  ListBullets,
  ListNumbers,
  Minus,
  MonitorPlay,
  Package,
  Quotes,
  RocketLaunch,
  Table as TableIcon,
  TextHOne,
  TextHTwo,
  TreeStructure,
  Warning as WarningIcon,
  type Icon,
} from "@phosphor-icons/react"
import type { Editor, Range } from "@tiptap/core"
import { Extension } from "@tiptap/core"
import { ReactRenderer } from "@tiptap/react"
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion"

import { cn } from "@/lib/utils"

/* The "/" menu - the whole closed vocabulary, discoverable at the caret.
   Structure blocks insert with sensible starter content; media blocks
   insert empty and invite a drop. */

export type SlashItem = {
  title: string
  hint: string
  icon: Icon
  keywords: string
  group: "Basic blocks" | "Jolts blocks"
  run: (editor: Editor, range: Range) => void
}

const insertBlock =
  (json: object) => (editor: Editor, range: Range) =>
    editor.chain().focus().deleteRange(range).insertContent(json).run()

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Section heading",
    hint: "Big heading - starts a new section in the page nav",
    icon: TextHOne,
    keywords: "h2 heading section",
    group: "Basic blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Subheading",
    hint: "Smaller heading inside a section",
    icon: TextHTwo,
    keywords: "h3 subheading",
    group: "Basic blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    hint: "One action or fact per line",
    icon: ListBullets,
    keywords: "ul list bullets",
    group: "Basic blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    hint: "Ordered steps in miniature",
    icon: ListNumbers,
    keywords: "ol ordered numbers",
    group: "Basic blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    title: "Image",
    hint: "A photo in the flow of the text",
    icon: ImageIcon,
    keywords: "photo picture img",
    group: "Basic blocks",
    run: insertBlock({
      type: "paragraph",
      content: [{ type: "image", attrs: { src: "", alt: "" } }],
    }),
  },
  {
    title: "Code block",
    hint: "Firmware, configs, terminal commands",
    icon: Code,
    keywords: "code pre fence",
    group: "Basic blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("codeBlock").run(),
  },
  {
    title: "Quote",
    hint: "A pulled quote or aside",
    icon: Quotes,
    keywords: "blockquote quote",
    group: "Basic blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    title: "Table",
    hint: "Free-form table (for pins, use Pin table)",
    icon: TableIcon,
    keywords: "table grid",
    group: "Basic blocks",
    run: (e, r) =>
      e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Divider",
    hint: "A horizontal rule",
    icon: Minus,
    keywords: "hr rule divider",
    group: "Basic blocks",
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
  {
    title: "Step",
    hint: "One photo, one action - the unit of instruction",
    icon: CheckCircle,
    keywords: "step instruction",
    group: "Jolts blocks",
    run: insertBlock({
      type: "step",
      attrs: { title: "" },
      content: [{ type: "paragraph" }],
    }),
  },
  {
    title: "Warning",
    hint: "Anything they shouldn't learn the hard way",
    icon: WarningIcon,
    keywords: "warning careful danger",
    group: "Jolts blocks",
    run: insertBlock({
      type: "warning",
      content: [{ type: "paragraph" }],
    }),
  },
  {
    title: "Checkpoint",
    hint: "What they should have before building further",
    icon: CheckCircle,
    keywords: "checkpoint verify",
    group: "Jolts blocks",
    run: insertBlock({
      type: "checkpoint",
      content: [{ type: "paragraph" }],
    }),
  },
  {
    title: "Parts list",
    hint: "Renders the frontmatter parts - edit them in place",
    icon: Package,
    keywords: "parts bom materials",
    group: "Jolts blocks",
    run: insertBlock({ type: "partsList" }),
  },
  {
    title: "Pin table",
    hint: "Pin → signal → why",
    icon: TreeStructure,
    keywords: "pins pinout gpio",
    group: "Jolts blocks",
    run: insertBlock({
      type: "pinTable",
      attrs: { pins: [{ pin: "", signal: "", note: "" }] },
    }),
  },
  {
    title: "Schematic",
    hint: "Wiring diagram or figure with a caption",
    icon: TreeStructure,
    keywords: "schematic diagram figure",
    group: "Jolts blocks",
    run: insertBlock({ type: "schematic", attrs: { src: "", alt: "" } }),
  },
  {
    title: "Video",
    hint: "YouTube embed, for technique that reads badly",
    icon: MonitorPlay,
    keywords: "video youtube embed",
    group: "Jolts blocks",
    run: insertBlock({ type: "video", attrs: { id: "", title: "" } }),
  },
  {
    title: "Link",
    hint: "Link a concept or tool page - never explain them inline",
    icon: Lightbulb,
    keywords: "link concept tool chip page",
    group: "Jolts blocks",
    run: insertBlock({ type: "conceptLink", attrs: { slug: "" } }),
  },
  {
    title: "External guide",
    hint: "Link out to Codex, Adafruit, datasheets",
    icon: ArrowUpRight,
    keywords: "external link out reference",
    group: "Jolts blocks",
    run: insertBlock({
      type: "externalGuide",
      attrs: { href: "", title: "" },
      content: [{ type: "paragraph" }],
    }),
  },
  {
    title: "Read more",
    hint: "Wraps guide-end external links",
    icon: ArrowUpRight,
    keywords: "read more further reading",
    group: "Jolts blocks",
    run: insertBlock({
      type: "readMore",
      content: [
        {
          type: "externalGuide",
          attrs: { href: "", title: "" },
          content: [{ type: "paragraph" }],
        },
      ],
    }),
  },
  {
    title: "Ship it",
    hint: "The end-of-guide banner",
    icon: RocketLaunch,
    keywords: "ship it finish end",
    group: "Jolts blocks",
    run: insertBlock({ type: "shipIt", content: [{ type: "paragraph" }] }),
  },
  {
    title: "Hidden comment",
    hint: "A note for future editors - readers never see it",
    icon: ChatCircleDots,
    keywords: "comment note hidden",
    group: "Jolts blocks",
    run: insertBlock({ type: "mdxComment", attrs: { text: "" } }),
  },
]

/* ---------- the dropdown ---------- */

type ListProps = SuggestionProps<SlashItem>

export type SlashListHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const SlashList = forwardRef<SlashListHandle, ListProps>(
  function SlashList({ items, command }, ref) {
    const [index, setIndex] = useState(0)
    useEffect(() => setIndex(0), [items])

    // keyboard selection must stay in view - the list scrolls with it
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
    useEffect(() => {
      itemRefs.current[index]?.scrollIntoView({ block: "nearest" })
    }, [index])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowDown") {
          setIndex((i) => (i + 1) % Math.max(items.length, 1))
          return true
        }
        if (event.key === "ArrowUp") {
          setIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1))
          return true
        }
        if (event.key === "Enter") {
          if (items[index]) command(items[index])
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="w-[300px] rounded-[10px] border border-black/[0.08] bg-white px-[14px] py-[10px] text-[13px] text-[#9aa1ab] shadow-[0px_14px_36px_-8px_rgba(0,0,0,0.22),0px_3px_10px_-2px_rgba(0,0,0,0.08)]">
          No results
        </div>
      )
    }

    let lastGroup: string | null = null
    return (
      <div className="max-h-[344px] w-[300px] overflow-y-auto overscroll-contain rounded-[10px] border border-black/[0.08] bg-white px-[4px] py-[4px] shadow-[0px_14px_36px_-8px_rgba(0,0,0,0.22),0px_3px_10px_-2px_rgba(0,0,0,0.08)]">
        {items.map((item, i) => {
          const groupHeader =
            item.group !== lastGroup ? (
              <p
                className={cn(
                  "px-[10px] pb-[4px] text-[12px] font-medium text-[#9aa1ab]",
                  lastGroup === null ? "pt-[6px]" : "pt-[12px]"
                )}
              >
                {item.group}
              </p>
            ) : null
          lastGroup = item.group
          const Icon = item.icon
          return (
            <div key={item.title}>
              {groupHeader}
              <button
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                type="button"
                onClick={() => command(item)}
                onMouseEnter={() => setIndex(i)}
                className={cn(
                  "flex w-full items-center gap-[10px] rounded-[7px] px-[10px] py-[4.5px] text-left",
                  i === index && "bg-black/[0.045]"
                )}
              >
                <Icon
                  size={17}
                  weight="regular"
                  className="shrink-0 text-[#5c6470]"
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 items-baseline gap-[8px]">
                  <span className="shrink-0 text-[14px] tracking-[-0.01em] text-[#16181d]">
                    {item.title}
                  </span>
                  <span className="truncate text-[12px] text-[#b3b9c2]">
                    {item.hint}
                  </span>
                </span>
              </button>
            </div>
          )
        })}
      </div>
    )
  }
)

/* ---------- the extension ---------- */

export const SlashCommands = Extension.create({
  name: "joltsSlashCommands",
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        items: ({ query }) => {
          const q = query.toLowerCase()
          return SLASH_ITEMS.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              item.keywords.includes(q)
          )
        },
        command: ({ editor, range, props }) => {
          props.run(editor, range)
        },
        render: () => {
          let component: ReactRenderer<SlashListHandle, ListProps> | null = null
          let unmount: (() => void) | null = null
          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashList, {
                props,
                editor: props.editor,
              })
              const el = component.element as HTMLElement
              // above every block's stacking context (checker frames etc.)
              el.style.zIndex = "45"
              unmount = props.mount?.(el) ?? null
            },
            onUpdate: (props) => {
              component?.updateProps(props)
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                unmount?.()
                component?.destroy()
                component = null
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              unmount?.()
              component?.destroy()
              component = null
            },
          }
        },
      }),
    ]
  },
})
