"use client"

import { useState } from "react"

import { ArrowSquareOut, Code } from "@phosphor-icons/react"
import { PatchDiff } from "@pierre/diffs/react"

import { cn } from "@/lib/utils"

/* The byte-level view, for when the preview raises a question the rendered page
   can't answer. GitHub hands over the whole pull request as one unified diff and
   @pierre/diffs renders it with real syntax highlighting - so there is no
   hand-rolled differ here to get wrong.

   Collapsed by default: the preview above is the point, and this is the
   appendix. */

export function PatchView({
  patch,
  githubUrl,
}: {
  patch: string
  githubUrl: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="overflow-hidden rounded-[11px] border border-black/[0.09]">
      <div className="flex items-center gap-[9px] bg-[#fafafa] px-[12px] py-[7px]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-[7px] text-left text-[12.5px] font-semibold text-[#5c6470] transition-colors hover:text-[#16181d]"
        >
          <Code size={14} weight="bold" aria-hidden />
          {open ? "Hide" : "Show"} the raw diff
        </button>
        <a
          href={`${githubUrl}/files`}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-[4px] text-[11.5px] font-medium text-[#9aa1ab] transition-colors hover:text-[#16181d]"
        >
          on GitHub
          <ArrowSquareOut size={11} weight="bold" aria-hidden />
        </a>
      </div>
      {open && (
        <div
          className={cn(
            "max-h-[70vh] overflow-auto border-t border-black/[0.07] bg-white",
            "text-[12.5px]"
          )}
        >
          {patch ? (
            /* no worker pool: one appendix-sized diff isn't worth
                 spinning up workers, and it keeps bundling simple */
            <PatchDiff patch={patch} disableWorkerPool />
          ) : (
            <p className="px-[13px] py-[11px] text-[12.5px] text-[#9aa1ab]">
              GitHub didn&rsquo;t return a diff for this pull request - it may be
              too large. Read it on GitHub instead.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
