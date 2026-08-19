"use client"

import { useEffect, useRef, useState } from "react"

import { Lightbulb, MagnifyingGlass, Wrench } from "@phosphor-icons/react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"

import { useEditorCtx, type LinkIndexEntry } from "@/components/editor/context"
import { cn } from "@/lib/utils"

/* Jolts links - ONE concept in the editor: a chip that points at a
   concept or tool page. The two serialized forms (<ConceptLink>/<Tool>)
   and their reader styling stay exactly as they are; the picker simply
   searches both kinds together, and choosing the other kind swaps the
   node type under the hood. Labels are editable text; an empty label
   means "use the entry's title" and round-trips self-closing. */

const chipTheme = {
  conceptLink: {
    icon: Lightbulb,
    kind: "Concept",
    bg: "#F8EEFC",
    text: "#8A21B8",
    accent: "#A633D6",
  },
  toolLink: {
    icon: Wrench,
    kind: "Tool",
    bg: "#E9FAF3",
    text: "#067A54",
    accent: "#0EBF80",
  },
} as const

export type LinkKind = "conceptLink" | "toolLink"

export function makeChipView(type: LinkKind) {
  return function ChipView(props: NodeViewProps) {
    const ctx = useEditorCtx()
    const theme = chipTheme[type]
    const Icon = theme.icon
    const slug = String(props.node.attrs.slug ?? "")
    const entries =
      type === "conceptLink" ? ctx.linkIndex.concepts : ctx.linkIndex.tools
    const entry = entries.find((e) => e.slug === slug)
    const empty = props.node.content.size === 0

    const [picking, setPicking] = useState(
      // a chip born without a target immediately asks for one
      () => slug === ""
    )
    useEffect(() => {
      if (!props.selected && slug !== "") setPicking(false)
    }, [props.selected, slug])

    const retarget = (kind: LinkKind, nextSlug: string) => {
      setPicking(false)
      if (kind === type) {
        props.updateAttributes({ slug: nextSlug })
        return
      }
      // became the other kind: swap the node type, keep any custom label
      const pos = props.getPos()
      if (pos === undefined) return
      const { state, view } = props.editor
      const node = state.doc.nodeAt(pos)
      if (!node) return
      const newType = state.schema.nodes[kind]
      view.dispatch(
        state.tr.replaceWith(
          pos,
          pos + node.nodeSize,
          newType.create({ slug: nextSlug }, node.content, node.marks)
        )
      )
    }

    return (
      <NodeViewWrapper as="span" className="relative inline-block">
        <span
          className={cn(
            "mx-[1px] inline-flex translate-y-[2px] items-center gap-[4px] rounded-[6px] px-[7px] py-[1.5px] text-[0.94em] font-semibold tracking-[-0.02em]",
            props.selected && "ring-2 ring-offset-1"
          )}
          style={{
            background: theme.bg,
            color: theme.text,
            ...(props.selected ? { ["--tw-ring-color" as string]: theme.accent } : {}),
          }}
        >
          <button
            type="button"
            contentEditable={false}
            title={`${theme.kind}: ${entry?.title ?? (slug || "pick a page")} - click to change`}
            onClick={() => setPicking((p) => !p)}
            className="flex items-center"
          >
            <Icon size={14} weight="fill" aria-hidden />
          </button>
          {empty && (
            <span contentEditable={false} className="opacity-90">
              {entry?.title ?? (slug || "pick a page…")}
            </span>
          )}
          <NodeViewContent<"span">
            as="span"
            className={cn("inline [&_.ProseMirror-trailingBreak]:hidden", empty && "inline-block w-px")}
          />
        </span>
        {picking && (
          <LinkPicker
            linkIndex={ctx.linkIndex}
            current={{ kind: type, slug }}
            onPick={retarget}
          />
        )}
      </NodeViewWrapper>
    )
  }
}

/* one picker for everything linkable: concepts and tools together, each
   row wearing its kind's color */
export function LinkPicker({
  linkIndex,
  current,
  onPick,
}: {
  linkIndex: { concepts: LinkIndexEntry[]; tools: LinkIndexEntry[] }
  current: { kind: LinkKind; slug: string } | null
  onPick: (kind: LinkKind, slug: string) => void
}) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  const all: { kind: LinkKind; entry: LinkIndexEntry }[] = [
    ...linkIndex.concepts.map((entry) => ({
      kind: "conceptLink" as const,
      entry,
    })),
    ...linkIndex.tools.map((entry) => ({ kind: "toolLink" as const, entry })),
  ]
  const q = query.toLowerCase()
  const filtered = all.filter(
    ({ entry }) =>
      entry.title.toLowerCase().includes(q) || entry.slug.includes(q)
  )

  return (
    <span
      contentEditable={false}
      className="absolute top-[calc(100%+6px)] left-0 z-40 block w-[280px] overflow-hidden rounded-[10px] border border-black/10 bg-white shadow-[0px_8px_24px_-6px_rgba(0,0,0,0.25)]"
    >
      <span className="flex items-center gap-[6px] border-b border-black/[0.07] px-[10px] py-[7px]">
        <MagnifyingGlass size={13} className="shrink-0 text-[#9aa1ab]" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Link a concept or tool…"
          className="w-full border-none bg-transparent text-[13px] outline-none placeholder:text-black/30"
        />
      </span>
      <span className="block max-h-[220px] overflow-y-auto py-[4px]">
        {filtered.length === 0 && (
          <span className="block">
            <span className="block px-[10px] py-[6px] text-[12.5px] text-[#9aa1ab]">
              No page called &ldquo;{query}&rdquo; yet.
            </span>
            {/* the wiki red-link move: the missing page is one click from
                existing (opens the editor in a new tab; this chip keeps
                its slug for when the page lands) */}
            {query.trim() && (
              <>
                <a
                  href={`/edit/new?type=concepts&title=${encodeURIComponent(query.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-[7px] px-[10px] py-[6px] text-[13px] font-medium text-[#8A21B8] hover:bg-black/[0.04]"
                >
                  <Lightbulb size={13} weight="fill" aria-hidden />
                  Write &ldquo;{query.trim()}&rdquo; as a concept
                </a>
                <a
                  href={`/edit/new?type=tools&title=${encodeURIComponent(query.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-[7px] px-[10px] py-[6px] text-[13px] font-medium text-[#067A54] hover:bg-black/[0.04]"
                >
                  <Wrench size={13} weight="fill" aria-hidden />
                  Write &ldquo;{query.trim()}&rdquo; as a tool
                </a>
              </>
            )}
          </span>
        )}
        {filtered.map(({ kind, entry }) => {
          const theme = chipTheme[kind]
          const Icon = theme.icon
          const isCurrent =
            current !== null &&
            current.kind === kind &&
            current.slug === entry.slug
          return (
            <button
              key={`${kind}:${entry.slug}`}
              type="button"
              onClick={() => onPick(kind, entry.slug)}
              className={cn(
                "flex w-full items-start gap-[8px] px-[10px] py-[6px] text-left transition-colors hover:bg-black/[0.04]",
                isCurrent && "bg-black/[0.03]"
              )}
            >
              <Icon
                size={14}
                weight="fill"
                className="mt-[2px] shrink-0"
                style={{ color: theme.accent }}
                aria-hidden
              />
              <span className="min-w-0">
                <span
                  className="block text-[13px] font-semibold tracking-[-0.01em]"
                  style={{ color: isCurrent ? theme.accent : "#16181d" }}
                >
                  {entry.title}
                </span>
                <span className="block truncate text-[11.5px] text-[#9aa1ab]">
                  {entry.excerpt}
                </span>
              </span>
            </button>
          )
        })}
      </span>
    </span>
  )
}

/* ---------- Difficulty chip ---------- */

const LEVELS = ["beginner", "intermediate", "advanced"] as const

export function DifficultyView(props: NodeViewProps) {
  const level = String(props.node.attrs.level ?? "beginner") as
    | "beginner"
    | "intermediate"
    | "advanced"
  const filled = { beginner: 1, intermediate: 2, advanced: 3 }[level]
  return (
    <NodeViewWrapper as="span" className="inline">
      <button
        type="button"
        contentEditable={false}
        title="Difficulty chip - click to cycle"
        onClick={() => {
          const next = LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length]
          props.updateAttributes({ level: next })
        }}
        className={cn(
          "inline-flex items-center gap-[7px] rounded-[6px] px-[4px] text-[14px] tracking-[-0.01em] text-[#5c6470] capitalize",
          props.selected && "ring-2 ring-[var(--guide-accent)]"
        )}
      >
        <span className="flex gap-[3px]" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className="size-[7px] rounded-full"
              style={{
                background:
                  i <= filled
                    ? "var(--guide-accent, #FF902F)"
                    : "rgba(0,0,0,0.12)",
              }}
            />
          ))}
        </span>
        {level}
      </button>
    </NodeViewWrapper>
  )
}
