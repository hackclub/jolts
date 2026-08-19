"use client"

import { ArrowUpRight } from "@phosphor-icons/react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewContent } from "@tiptap/react"

import { BlockShell, GhostInput } from "@/components/editor/views/bits"

/* ReadMore (the further-reading section) and ExternalGuide cards. The
   card's href/title/source are ghost inputs; the description is real
   editable content. */

export function ReadMoreView(props: NodeViewProps) {
  return (
    <BlockShell props={props} label="read more">
      <aside className="mt-[44px]">
        <div className="flex items-center gap-[14px]" contentEditable={false}>
          <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#16181d]">
            Read more
          </h2>
          <span aria-hidden className="h-px flex-1 bg-black/10" />
        </div>
        <NodeViewContent className="mt-[12px] flex flex-col gap-[8px] [&>*]:!my-0" />
      </aside>
    </BlockShell>
  )
}

function domain(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "")
  } catch {
    return href
  }
}

export function ExternalGuideView(props: NodeViewProps) {
  const { node, updateAttributes } = props
  const href = String(node.attrs.href ?? "")
  const source = (node.attrs.source as string | null) ?? null

  return (
    <BlockShell props={props} label="external guide">
      <div className="group my-[26px] block rounded-[10px] border border-black/[0.08] bg-[#fbfbfc] px-[15px] py-[11px]">
        <span
          className="flex items-baseline gap-[8px] text-[15px] tracking-[-0.01em]"
          contentEditable={false}
        >
          <span className="min-w-0 flex-1 font-semibold text-[#16181d]">
            <GhostInput
              value={String(node.attrs.title ?? "")}
              onChange={(v) => updateAttributes({ title: v })}
              placeholder="Title of the external guide"
            />
          </span>
          <span className="flex shrink-0 items-baseline text-[13px] text-[#9aa1ab]">
            ·&nbsp;
            <GhostInput
              value={source ?? ""}
              onChange={(v) => updateAttributes({ source: v || null })}
              placeholder={href ? domain(href) : "source"}
              className="w-[110px]"
            />
          </span>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              title="Open the link"
              className="shrink-0 self-center text-[#9aa1ab] hover:text-[#16181d]"
            >
              <ArrowUpRight size={14} weight="bold" aria-hidden />
            </a>
          ) : (
            <ArrowUpRight
              size={14}
              weight="bold"
              className="shrink-0 self-center text-[#e3e6ea]"
              aria-hidden
            />
          )}
        </span>
        <NodeViewContent className="jolts-tight mt-[2px] block text-[13.5px] leading-[1.55] tracking-[-0.01em] text-[#5c6470] [&_p]:!text-[13.5px] [&_p]:!leading-[1.55]" />
        <span
          className="mt-[6px] flex items-center gap-[4px] border-t border-black/[0.05] pt-[6px] text-[11.5px] text-[#9aa1ab]"
          contentEditable={false}
        >
          <span className="shrink-0 font-mono">url</span>
          <GhostInput
            value={href}
            onChange={(v) => updateAttributes({ href: v })}
            placeholder="https://…"
            className="font-mono text-[11.5px]"
          />
        </span>
      </div>
    </BlockShell>
  )
}
