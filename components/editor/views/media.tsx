"use client"

import { useState } from "react"

import { Play } from "@phosphor-icons/react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewWrapper } from "@tiptap/react"

import { useEditorCtx } from "@/components/editor/context"
import {
  BlockShell,
  GhostInput,
  ImageSlot,
} from "@/components/editor/views/bits"
import { cn } from "@/lib/utils"

/* Schematic, Video, and inline images. */

export function SchematicView(props: NodeViewProps) {
  const ctx = useEditorCtx()
  const { node, updateAttributes } = props
  const src = String(node.attrs.src ?? "")
  return (
    <BlockShell props={props} label="schematic">
      <figure className="my-[30px]" contentEditable={false}>
        <ImageSlot
          src={src || null}
          resolved={src ? ctx.resolveImage(src) : null}
          alt={String(node.attrs.alt ?? "")}
          onPick={async (file) => {
            const ref = await ctx.addUpload(file)
            updateAttributes({ src: ref })
          }}
          imgClassName="!my-0 w-full rounded-[8px] border border-black/10 bg-white"
          emptyLabel="Add the schematic or figure"
        />
        <figcaption className="mt-[8px] flex flex-col gap-[2px] text-[13px] tracking-[-0.01em] text-[#9aa1ab]">
          <GhostInput
            value={String(node.attrs.caption ?? "")}
            onChange={(v) => updateAttributes({ caption: v || null })}
            placeholder="One caption line (optional)"
          />
          <GhostInput
            value={String(node.attrs.alt ?? "")}
            onChange={(v) => updateAttributes({ alt: v })}
            placeholder="Alt text - what does it show?"
            className="text-[11.5px] text-black/30"
          />
        </figcaption>
      </figure>
    </BlockShell>
  )
}

/* accepts a plain id or any youtube URL shape */
export function parseYouTubeId(input: string): string {
  const trimmed = input.trim()
  const m = trimmed.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/
  )
  if (m) return m[1]
  return trimmed.replace(/^https?:\/\//, "")
}

export function VideoView(props: NodeViewProps) {
  const { node, updateAttributes } = props
  const id = String(node.attrs.id ?? "")
  const [playing, setPlaying] = useState(false)

  return (
    <BlockShell props={props} label="video">
      <div className="my-[30px]" contentEditable={false}>
        {id ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-[8px] border border-black/10 bg-black">
            {playing ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
                title={String(node.attrs.title ?? "")}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 size-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="group/vid absolute inset-0"
                title="Preview the video"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
                  alt=""
                  className="!my-0 size-full object-cover opacity-90 transition-opacity group-hover/vid:opacity-100"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-[52px] items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm transition-transform group-hover/vid:scale-110">
                    <Play size={22} weight="fill" aria-hidden />
                  </span>
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-[8px] border border-dashed border-black/15 text-[13.5px] text-[#9aa1ab]">
            Paste a YouTube link below
          </div>
        )}
        <div className="mt-[8px] flex flex-col gap-[2px] text-[13px] tracking-[-0.01em] text-[#9aa1ab]">
          <GhostInput
            value={String(node.attrs.title ?? "")}
            onChange={(v) => updateAttributes({ title: v })}
            placeholder="Title - why should they watch it?"
          />
          <GhostInput
            value={id}
            onChange={(v) => updateAttributes({ id: parseYouTubeId(v) })}
            placeholder="YouTube link or video id"
            className="font-mono text-[11.5px] text-black/30"
          />
        </div>
      </div>
    </BlockShell>
  )
}

/* inline markdown image - keeps the reader's natural-size treatment */
export function ImageView(props: NodeViewProps) {
  const ctx = useEditorCtx()
  const { node, updateAttributes, selected } = props
  const src = String(node.attrs.src ?? "")
  return (
    <NodeViewWrapper as="span" className="inline-block max-w-full" data-drag-handle>
      <span className={cn("block", selected && "rounded-[10px] ring-2 ring-[var(--guide-accent)] ring-offset-2")}>
        <ImageSlot
          src={src || null}
          resolved={src ? ctx.resolveImage(src) : null}
          alt={String(node.attrs.alt ?? "")}
          onPick={async (file) => {
            const ref = await ctx.addUpload(file)
            updateAttributes({ src: ref })
          }}
          onRemove={() => props.deleteNode()}
          imgClassName="!my-0 block h-auto max-h-[480px] w-auto max-w-full rounded-[8px] border border-black/10"
          emptyLabel="Add an image"
        />
      </span>
      {selected && (
        <span
          className="mt-[4px] block text-[12px] text-[#9aa1ab]"
          contentEditable={false}
        >
          <GhostInput
            value={String(node.attrs.alt ?? "")}
            onChange={(v) => updateAttributes({ alt: v })}
            placeholder="Alt text - describe the image"
          />
        </span>
      )}
    </NodeViewWrapper>
  )
}
