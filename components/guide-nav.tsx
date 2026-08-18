"use client"

import { useEffect, useRef, useState } from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { CheckerFrame, type FrameTheme } from "@/components/checker-frame"
import type { TocEntry } from "@/lib/content"

/* The left panel: guide title on the checker chrome, page list on the
   white surface, and the ACTIVE page's table of contents nested beneath
   its name.

   For guides this renders from the [slug] layout, so it persists across
   page switches - the DOM never remounts. The active page comes from
   usePathname, and flipping it swaps grid-rows classes on the always-
   mounted TOC nodes: the old list collapses while the new one expands in
   one fast-settling transition. A scrollspy highlights the section
   currently being read. */

export type NavItem = {
  /** null = the overview / the page itself */
  slug: string | null
  title: string
  href: string
  toc: TocEntry[]
}

export function GuideNav({
  entryTitle,
  theme,
  items,
}: {
  entryTitle: string
  theme: FrameTheme
  items: NavItem[]
}) {
  const pathname = usePathname()
  const normalized = pathname.replace(/\/$/, "")
  const current =
    items.find((item) => item.href === normalized)?.slug ?? null
  const multi = items.length > 1

  /* the persistent layout means Next only scrolls the changed segment
     into view - a page switch should land at the very top instead
     (unless we're deep-linking to a #section) */
  const prevPath = useRef(pathname)
  useEffect(() => {
    if (prevPath.current === pathname) return
    prevPath.current = pathname
    if (!window.location.hash) {
      window.scrollTo({ top: 0, behavior: "instant" })
    }
  }, [pathname])

  /* scrollspy: the last section whose anchor has passed the reading line */
  const [readingId, setReadingId] = useState<string | null>(null)
  useEffect(() => {
    const item = items.find((i) => i.slug === current)
    const targets = (item?.toc ?? [])
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => el !== null)
    const onScroll = () => {
      let id: string | null = targets[0]?.id ?? null
      for (const el of targets) {
        if (el.getBoundingClientRect().top <= 140) id = el.id
      }
      setReadingId(id)
    }
    // initial read deferred a frame: no sync setState inside the effect,
    // and the new page's sections exist in the DOM by then
    const raf = requestAnimationFrame(onScroll)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
    }
  }, [items, current])

  return (
    /* the placeholder keeps the grid column; the nav itself is fixed on
       desktop (left: auto = its static position, so it stays aligned with
       the column) - unlike sticky it never detaches when the content
       column ends, no matter how tall the expanded TOC is */
    <div className="min-w-0 lg:relative">
    <nav
      aria-label="Guide pages"
      className="relative overflow-hidden rounded-[12px] p-[5px] shadow-[0px_3px_13px_0px_rgba(0,0,0,0.14)] lg:fixed lg:top-[119px] lg:flex lg:max-h-[calc(100vh-147px)] lg:w-[190px] lg:flex-col"
    >
      <CheckerFrame
        theme={theme}
        checkerSize={110}
        pinned
        className="absolute inset-0 rounded-[12px] p-0"
      >
        {null}
      </CheckerFrame>

      {/* guide title on the frame itself, like the header's nav text */}
      <p className="relative px-[10px] pt-[4px] pb-[8px] text-[14.5px] font-semibold tracking-[-0.02em] text-white [filter:drop-shadow(0px_1px_3px_rgba(0,0,0,0.25))]">
        {entryTitle}
      </p>

      <div className="relative min-h-0 overflow-y-auto rounded-[7px] bg-white px-[13px] py-[9px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)]">
        <ol className="space-y-[1px]">
          {items.map((item, i) => {
            const active = item.slug === current
            return (
              <li key={item.href}>
                <div className="flex items-baseline gap-[8px]">
                  {multi && (
                    <span
                      aria-hidden
                      className="w-[13px] shrink-0 text-right text-[11.5px] tabular-nums transition-colors duration-200"
                      style={{ color: active ? theme.accent : "#c2c7ce" }}
                    >
                      {i + 1}
                    </span>
                  )}
                  {active ? (
                    <span
                      aria-current="page"
                      className="min-w-0 flex-1 py-[3px] text-[13.5px] font-semibold tracking-[-0.02em]"
                      style={{ color: theme.accent }}
                    >
                      {item.title}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="min-w-0 flex-1 py-[3px] text-[13.5px] tracking-[-0.02em] text-[#5c6470] transition-colors duration-150 hover:text-[#16181d]"
                    >
                      {item.title}
                    </Link>
                  )}
                </div>

                {/* always mounted, collapsed to 0fr when inactive - the
                    class flip animates both directions at once */}
                {item.toc.length > 0 && (
                  <div
                    inert={active ? undefined : true}
                    className={
                      "grid transition-[grid-template-rows] duration-200 [transition-timing-function:cubic-bezier(0.3,0,0,1)] " +
                      (active ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
                    }
                  >
                    <div className="min-h-0 overflow-hidden">
                      <ul
                        className={
                          "mt-[2px] mb-[4px] space-y-[1px] border-l border-black/[0.08] pl-[10px] " +
                          (multi ? "ml-[19px]" : "ml-[2px]")
                        }
                      >
                        {item.toc.map((section) => {
                          const reading = active && readingId === section.id
                          return (
                            <li key={section.id}>
                              <a
                                href={`${active ? "" : item.href}#${section.id}`}
                                className={
                                  "block truncate py-[2.5px] text-[12.5px] tracking-[-0.01em] transition-colors duration-150 " +
                                  (reading
                                    ? "font-medium"
                                    : "text-[#9aa1ab] hover:text-[#16181d]")
                                }
                                style={
                                  reading ? { color: theme.accent } : undefined
                                }
                              >
                                {section.title}
                              </a>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
    </div>
  )
}
