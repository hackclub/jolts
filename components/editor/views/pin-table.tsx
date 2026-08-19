"use client"

import { Plus, Trash } from "@phosphor-icons/react"
import type { NodeViewProps } from "@tiptap/react"

import { BlockShell, GhostInput } from "@/components/editor/views/bits"
import type { PinRow } from "@/lib/editor/pm-doc"

/* <PinTable pins={[...]}> - the pins array lives in node attrs and edits
   as a grid that looks exactly like the rendered table. */

export function PinTableView(props: NodeViewProps) {
  const { node, updateAttributes } = props
  const pins = (node.attrs.pins ?? []) as PinRow[]

  const update = (i: number, patch: Partial<PinRow>) =>
    updateAttributes({
      pins: pins.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    })

  return (
    <BlockShell props={props} label="pin table">
      <div contentEditable={false} className="my-[30px]">
        <table className="w-full border-collapse text-[14px] tracking-[-0.01em]">
          <thead>
            <tr className="border-b border-black/15 text-left text-[12.5px] font-semibold tracking-[0.01em] text-[#9aa1ab] uppercase">
              <th className="w-[110px] py-[7px] pr-[16px] font-semibold">Pin</th>
              <th className="py-[7px] pr-[16px] font-semibold">Connects to</th>
              <th className="py-[7px] font-semibold">Why</th>
              <th className="w-[26px]" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.07]">
            {pins.map((p, i) => (
              <tr key={i} className="group/pin">
                <td className="py-[8px] pr-[16px] font-mono text-[13px] font-medium text-[#16181d]">
                  <GhostInput
                    value={p.pin}
                    onChange={(v) => update(i, { pin: v })}
                    placeholder="GP0"
                  />
                </td>
                <td className="py-[8px] pr-[16px] text-[#16181d]">
                  <GhostInput
                    value={p.signal}
                    onChange={(v) => update(i, { signal: v })}
                    placeholder="Row 0"
                  />
                </td>
                <td className="py-[8px] text-[#5c6470]">
                  <GhostInput
                    value={p.note ?? ""}
                    onChange={(v) => update(i, { note: v || undefined })}
                    placeholder="why (optional)"
                  />
                </td>
                <td className="py-[8px] pl-[4px]">
                  <button
                    type="button"
                    title="Remove row"
                    onClick={() =>
                      updateAttributes({ pins: pins.filter((_, j) => j !== i) })
                    }
                    className="rounded-[5px] p-[2px] text-[#c2c7ce] opacity-0 transition-opacity group-hover/pin:opacity-100 hover:bg-[#fdecec] hover:text-[#d43c3c]"
                  >
                    <Trash size={12} weight="bold" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() =>
            updateAttributes({ pins: [...pins, { pin: "", signal: "", note: "" }] })
          }
          className="mt-[6px] inline-flex items-center gap-[5px] rounded-[7px] px-[8px] py-[4px] text-[12.5px] font-medium text-[#9aa1ab] transition-colors hover:bg-black/[0.04] hover:text-[#5c6470]"
        >
          <Plus size={12} weight="bold" aria-hidden />
          Add pin
        </button>
      </div>
    </BlockShell>
  )
}
