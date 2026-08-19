"use client"

import { ImageSquare } from "@phosphor-icons/react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewContent } from "@tiptap/react"

import { useEditorCtx } from "@/components/editor/context"
import { BlockShell, GhostInput, ImageSlot } from "@/components/editor/views/bits"

/* The Step block, editable: same two-segment flag heading as the real
   renderer (components/mdx/registry.tsx), with the title as a ghost input
   and the side photo as a drop/replace slot. The body is real editable
   content. Step numbers keep working because the CSS counter classes
   (.jolts-step / .jolts-step-num) are identical. */

export function StepView(props: NodeViewProps) {
  const ctx = useEditorCtx()
  const { node, updateAttributes } = props
  const title = String(node.attrs.title ?? "")
  const image = (node.attrs.image as string | null) ?? null

  return (
    <BlockShell props={props} label="step">
      <section className="jolts-step mt-[40px]">
        {/* isolate: the flag's z-10 layering stays inside the heading -
            without it the flag pierces the bubble menu and other overlays */}
        <h3
          className="isolate flex items-stretch text-[17px] font-semibold tracking-[-0.03em]"
          contentEditable={false}
        >
          <span aria-hidden className="relative z-10 flex shrink-0">
            <span
              className="absolute top-0 right-[4px] h-full w-[18px] -skew-x-[16deg] rounded-r-[7px]"
              style={{ background: "var(--guide-accent, #01A6FF)" }}
            />
            <span
              className="relative flex items-center gap-[4px] rounded-l-[8px] py-[5px] pr-[15px] pl-[13px] text-[13px] tracking-[-0.02em] text-white"
              style={{
                background: "var(--guide-accent, #01A6FF)",
                clipPath:
                  "polygon(0 0, calc(100% - 9px) 0, calc(100% - 18px) 100%, 0 100%)",
              }}
            >
              <span>Step</span>
              <span className="jolts-step-num tabular-nums" />
            </span>
          </span>
          <span className="-ml-[20px] flex min-w-0 flex-1 items-center gap-[10px] rounded-r-[8px] bg-[#f3f3f3] py-[5px] pr-[10px] pl-[30px] text-[#16181d]">
            <GhostInput
              value={title}
              onChange={(v) => updateAttributes({ title: v })}
              placeholder="What happens in this step?"
              className="flex-1"
            />
            {!image && (
              <button
                type="button"
                title="Add a side photo"
                onClick={() => updateAttributes({ image: "" })}
                className="shrink-0 rounded-[6px] p-[3px] text-[#c2c7ce] opacity-0 transition-opacity duration-100 group-hover/block:opacity-100 hover:bg-black/[0.06] hover:text-[#5c6470]"
              >
                <ImageSquare size={16} weight="bold" />
              </button>
            )}
          </span>
        </h3>
        <div
          className={
            "mt-[14px] grid gap-x-[26px] gap-y-[14px]" +
            (image !== null ? " sm:grid-cols-[minmax(0,44%)_minmax(0,1fr)]" : "")
          }
        >
          {image !== null && (
            <ImageSlot
              src={image || null}
              resolved={image ? ctx.resolveImage(image) : null}
              alt={String(node.attrs.alt ?? "")}
              onPick={async (file) => {
                const ref = await ctx.addUpload(file)
                updateAttributes({ image: ref })
              }}
              onRemove={() => updateAttributes({ image: null, alt: null })}
              imgClassName="!my-0 aspect-[4/3] w-full rounded-[8px] border border-black/10 object-cover"
              emptyLabel="Add the step photo"
            />
          )}
          <NodeViewContent className="jolts-step-body min-w-0 text-[15.5px] leading-[1.65] tracking-[-0.01em]" />
        </div>
      </section>
    </BlockShell>
  )
}
