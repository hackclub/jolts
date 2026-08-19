"use client"

import { ChatCircleDots, LockSimple } from "@phosphor-icons/react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewWrapper } from "@tiptap/react"

import { BlockShell, GhostTextarea } from "@/components/editor/views/bits"

/* The escape hatches: MDX comments (editable, invisible to readers) and
   raw MDX the editor doesn't understand (locked, round-trips verbatim). */

export function CommentView(props: NodeViewProps) {
  const { node, updateAttributes } = props
  return (
    <BlockShell props={props} label="comment">
      <div
        contentEditable={false}
        className="my-[20px] flex gap-[10px] rounded-[9px] border border-dashed border-black/12 bg-[#fafafa] px-[13px] py-[10px]"
      >
        <ChatCircleDots
          size={15}
          weight="fill"
          className="mt-[3px] shrink-0 text-[#c2c7ce]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="!m-0 text-[11px] font-semibold tracking-[0.02em] text-[#c2c7ce] uppercase">
            Hidden comment - readers never see this
          </p>
          <GhostTextarea
            value={String(node.attrs.text ?? "")}
            onChange={(v) => updateAttributes({ text: v })}
            placeholder="A note for future editors…"
            className="mt-[3px] text-[13px] leading-[1.55] text-[#9aa1ab]"
          />
        </div>
      </div>
    </BlockShell>
  )
}

export function RawMdxView(props: NodeViewProps) {
  const value = String(props.node.attrs.value ?? "")
  return (
    <BlockShell props={props} label="raw MDX">
      <div
        contentEditable={false}
        className="my-[20px] rounded-[9px] border border-black/[0.08] bg-[#f7f7f8]"
      >
        <p className="!m-0 flex items-center gap-[6px] border-b border-black/[0.06] px-[13px] py-[6px] text-[11px] font-semibold tracking-[0.02em] text-[#9aa1ab] uppercase">
          <LockSimple size={11} weight="fill" aria-hidden />
          Raw MDX - kept exactly as written
        </p>
        <pre className="!m-0 overflow-x-auto !bg-transparent px-[13px] py-[9px] font-mono text-[12.5px] leading-[1.55] whitespace-pre !text-[#5c6470]">
          {value}
        </pre>
      </div>
    </BlockShell>
  )
}

export function RawInlineView(props: NodeViewProps) {
  return (
    <NodeViewWrapper as="span" className="inline">
      <code
        title="Raw MDX - kept exactly as written"
        className="rounded-[4px] bg-[#f3e8ff] px-[5px] py-[1.5px] font-mono text-[0.85em] text-[#8a21b8]"
      >
        {String(props.node.attrs.value ?? "")}
      </code>
    </NodeViewWrapper>
  )
}
