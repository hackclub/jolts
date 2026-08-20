"use client"

import { useState } from "react"

import { ArrowSquareOut, ArrowsOut, Eye } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/* The point of the whole page: the guide as a reader will see it, rendered with
   the site's real components from the pull request's own MDX.

   It lives in an iframe. That keeps the guide's typography, frames and prose
   styles from colliding with the review chrome around it, and it makes the
   preview a plain URL - handy when a curator wants it full-width on a second
   monitor while reading the raw diff on the first. */

export function PreviewPane({
  prNumber,
  paths,
}: {
  prNumber: number
  paths: string[]
}) {
  const [active, setActive] = useState(paths[0] ?? "")
  const [tall, setTall] = useState(false)

  if (paths.length === 0) {
    return (
      <p className="rounded-[10px] border border-black/[0.09] bg-[#fafafa] px-[13px] py-[11px] text-[13px] text-[#9aa1ab]">
        No .mdx pages in this pull request to preview.
      </p>
    )
  }

  const src = `/review/${prNumber}/preview?path=${encodeURIComponent(active)}`

  return (
    <div className="overflow-hidden rounded-[11px] border border-black/[0.09]">
      <div className="flex items-center gap-[7px] overflow-x-auto border-b border-black/[0.07] bg-[#fafafa] px-[10px] py-[6px] [scrollbar-width:none]">
        {paths.map((path) => {
          const label = path.endsWith("/index.mdx")
            ? "Overview"
            : (path.split("/").pop() ?? path).replace(/^\d+-/, "").replace(/\.mdx$/, "")
          return (
            <button
              key={path}
              type="button"
              onClick={() => setActive(path)}
              className={cn(
                "shrink-0 rounded-[7px] px-[9px] py-[3px] text-[12px] font-medium transition-colors",
                path === active
                  ? "bg-[#16181d] text-white"
                  : "text-[#5c6470] hover:bg-black/[0.05] hover:text-[#16181d]"
              )}
            >
              {label}
            </button>
          )
        })}
        <div className="ml-auto flex shrink-0 items-center gap-[6px] pl-[8px]">
          <button
            type="button"
            onClick={() => setTall((t) => !t)}
            title={tall ? "Shorter" : "Taller"}
            className="flex items-center gap-[4px] rounded-[6px] px-[6px] py-[3px] text-[11.5px] font-medium text-[#9aa1ab] transition-colors hover:bg-black/[0.05] hover:text-[#16181d]"
          >
            <ArrowsOut size={12} weight="bold" aria-hidden />
            {tall ? "Shorter" : "Taller"}
          </button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-[4px] rounded-[6px] px-[6px] py-[3px] text-[11.5px] font-medium text-[#9aa1ab] transition-colors hover:bg-black/[0.05] hover:text-[#16181d]"
          >
            Open
            <ArrowSquareOut size={11} weight="bold" aria-hidden />
          </a>
        </div>
      </div>
      <iframe
        key={active}
        src={src}
        title={`Preview of ${active}`}
        /* allow-same-origin ONLY. Without it the frame gets an opaque
           origin and the site's self-hosted fonts fail CORS, so the whole
           preview falls back to serif and looks nothing like the page.
           Scripts, forms and top-level navigation stay blocked. */
        sandbox="allow-same-origin"
        loading="lazy"
        className={cn("w-full bg-white transition-[height]", tall ? "h-[1400px]" : "h-[620px]")}
      />
    </div>
  )
}

export const PreviewLabel = Eye
