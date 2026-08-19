"use client"

import { LinkSimple, Package, Plus, Trash } from "@phosphor-icons/react"
import type { NodeViewProps } from "@tiptap/react"

import { CheckerFrame } from "@/components/checker-frame"
import { useEditorCtx } from "@/components/editor/context"
import { BlockShell, GhostInput, ImageSlot } from "@/components/editor/views/bits"
import type { Part } from "@/lib/content-schema"
import { typeTheme } from "@/lib/theme"

/* <PartsList /> renders from the guide's frontmatter - so in the editor
   this block IS the parts editor. Same checker chrome and tile grid as
   the reader; every field is a ghost input, tiles gain a photo slot,
   a link field, and a delete, plus an "add part" tile at the end. */

export function PartsListView(props: NodeViewProps) {
  const ctx = useEditorCtx()
  const theme = typeTheme[ctx.contentType]
  const meta = ctx.meta
  const parts: Part[] = meta.type === "guide" ? meta.parts : []
  const cost = meta.type === "guide" ? meta.cost : undefined

  const setParts = (parts: Part[]) =>
    ctx.setMeta((m) => (m.type === "guide" ? { ...m, parts } : m))

  const update = (i: number, patch: Partial<Part>) =>
    setParts(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  const clean = (v: string): string | undefined => (v === "" ? undefined : v)

  if (meta.type !== "guide") {
    return (
      <BlockShell props={props} label="parts list">
        <div className="my-[30px] rounded-[10px] border border-dashed border-black/15 px-[16px] py-[12px] text-[13.5px] text-[#9aa1ab]">
          &lt;PartsList /&gt; only renders on guides - this entry is a{" "}
          {meta.type}. You probably want to delete this block.
        </div>
      </BlockShell>
    )
  }

  return (
    <BlockShell props={props} label="parts list">
      <div contentEditable={false}>
        <CheckerFrame theme={theme} className="my-[36px]" checkerSize={150}>
          <div className="relative rounded-[7px] bg-white px-[15px] py-[13px]">
            <div className="flex items-baseline justify-between pb-[12px]">
              <h3 className="!m-0 flex items-center gap-[9px] text-[17px] font-semibold tracking-[-0.03em] text-[#16181d]">
                <Package
                  size={19}
                  weight="fill"
                  style={{ color: theme.accent }}
                  aria-hidden
                />
                What you need
              </h3>
              <span className="flex items-baseline gap-[4px] text-[13.5px] tracking-[-0.01em] text-[#5c6470]">
                <GhostInput
                  value={cost ?? ""}
                  onChange={(v) =>
                    ctx.setMeta((m) =>
                      m.type === "guide" ? { ...m, cost: v } : m
                    )
                  }
                  placeholder="~$25"
                  className="w-[64px] text-right"
                />
                total
              </span>
            </div>
            <ul className="!m-0 grid !list-none grid-cols-1 gap-[10px] !p-0 sm:grid-cols-2">
              {parts.map((part, i) => (
                <li
                  key={i}
                  className="group/part !m-0 flex items-center gap-[12px] rounded-[10px] border border-black/[0.08] bg-white p-[9px]"
                >
                  <ImageSlot
                    src={part.image ?? null}
                    resolved={part.image ? ctx.resolveImage(part.image) : null}
                    onPick={async (file) => {
                      const ref = await ctx.addUpload(file)
                      update(i, { image: ref })
                    }}
                    onRemove={() => update(i, { image: undefined })}
                    className="size-[54px] shrink-0"
                    imgClassName="!my-0 size-[54px] rounded-[8px] border border-black/[0.08] bg-white object-cover"
                    emptyLabel=""
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-[6px] text-[14.5px] leading-[1.3] font-semibold tracking-[-0.02em] text-[#16181d]">
                      <GhostInput
                        value={part.name}
                        onChange={(v) => update(i, { name: v })}
                        placeholder="Part name"
                      />
                    </span>
                    <span className="mt-[1px] block text-[12.5px] tracking-[-0.01em] text-[#9aa1ab]">
                      <GhostInput
                        value={part.note ?? ""}
                        onChange={(v) => update(i, { note: clean(v) })}
                        placeholder="note (optional)"
                      />
                    </span>
                    <span className="mt-[3px] flex items-baseline gap-[2px] text-[12.5px] tracking-[-0.01em] text-[#5c6470] tabular-nums">
                      <GhostInput
                        value={String(part.qty ?? 1)}
                        onChange={(v) => {
                          const n = Number(v)
                          update(i, {
                            qty: v !== "" && Number.isFinite(n) ? n : v,
                          })
                        }}
                        placeholder="1"
                        className="w-[26px] text-right"
                      />
                      <span>×</span>
                      <span className="pl-[4px] text-[#9aa1ab]">·</span>
                      <GhostInput
                        value={part.cost ?? ""}
                        onChange={(v) => update(i, { cost: clean(v) })}
                        placeholder="$?"
                        className="w-[48px] pl-[4px] text-[#9aa1ab]"
                      />
                    </span>
                    <span className="mt-[3px] flex items-center gap-[4px] text-[11.5px] text-[#9aa1ab]">
                      <LinkSimple size={11} aria-hidden className="shrink-0" />
                      <GhostInput
                        value={part.link ?? ""}
                        onChange={(v) => update(i, { link: clean(v) })}
                        placeholder="https:// where to buy (optional)"
                        className="font-mono text-[11px]"
                      />
                    </span>
                  </span>
                  <button
                    type="button"
                    title="Remove part"
                    onClick={() => setParts(parts.filter((_, j) => j !== i))}
                    className="self-start rounded-[6px] p-[3px] text-[#c2c7ce] opacity-0 transition-opacity duration-100 group-hover/part:opacity-100 hover:bg-[#fdecec] hover:text-[#d43c3c]"
                  >
                    <Trash size={13} weight="bold" />
                  </button>
                </li>
              ))}
              <li className="!m-0">
                <button
                  type="button"
                  onClick={() =>
                    setParts([...parts, { name: "", qty: 1 }])
                  }
                  className="flex h-full min-h-[74px] w-full items-center justify-center gap-[7px] rounded-[10px] border border-dashed border-black/15 text-[13.5px] font-medium text-[#9aa1ab] transition-colors hover:border-black/30 hover:text-[#5c6470]"
                >
                  <Plus size={14} weight="bold" aria-hidden />
                  Add a part
                </button>
              </li>
            </ul>
          </div>
        </CheckerFrame>
      </div>
    </BlockShell>
  )
}
