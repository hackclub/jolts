"use client"

import { useEffect, useRef, useState } from "react"

import {
  ArrowCounterClockwise,
  CaretDown,
  CaretUp,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react"

import { CheckerFrame } from "@/components/checker-frame"
import { typeTheme } from "@/lib/theme"
import type { ContentType } from "@/lib/content-schema"
import { cn } from "@/lib/utils"

/* The editor's left panel - the same checker chrome as the reader's
   GuideNav, but the pages are editable: switch, rename, reorder, add,
   delete (with undo). Every page shows a dot when it has unexported
   changes. */

export type RailPage = {
  id: string
  title: string
  isOverview: boolean
  dirty: boolean
  deleted: boolean
}

export function PageRail({
  contentType,
  entryTitle,
  pages,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onRestore,
  onMove,
}: {
  contentType: ContentType
  entryTitle: string
  pages: RailPage[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}) {
  const theme = typeTheme[contentType]
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const renameInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (renaming) renameInput.current?.select()
  }, [renaming])

  const multi = pages.length > 1
  const movable = pages.filter((p) => !p.isOverview)

  const commitRename = () => {
    if (renaming && draft.trim()) onRename(renaming, draft.trim())
    setRenaming(null)
  }

  return (
    <div className="relative min-w-0">
      <div className="lg:absolute lg:top-0 lg:-bottom-[600px] lg:w-[190px]">
        <nav
          aria-label="Guide pages"
          className="relative overflow-hidden rounded-[12px] p-[5px] shadow-[0px_3px_13px_0px_rgba(0,0,0,0.14)] lg:sticky lg:top-[74px] lg:flex lg:max-h-[calc(100vh-102px)] lg:flex-col"
        >
          <CheckerFrame
            theme={theme}
            checkerSize={110}
            pinned
            className="absolute inset-0 rounded-[12px] p-0"
          >
            {null}
          </CheckerFrame>

          <p className="relative px-[10px] pt-[4px] pb-[8px] text-[14.5px] font-semibold tracking-[-0.02em] text-white [filter:drop-shadow(0px_1px_3px_rgba(0,0,0,0.25))]">
            {entryTitle || "Untitled"}
          </p>

          <div className="relative min-h-0 overflow-y-auto rounded-[7px] bg-white px-[9px] py-[9px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)]">
            <ol className="space-y-[1px]">
              {pages.map((page, i) => {
                const active = page.id === activeId
                const moveIndex = movable.indexOf(page)
                return (
                  <li key={page.id} className="group/page">
                    <div className="flex items-center gap-[6px] rounded-[7px] px-[4px] py-[1px] transition-colors group-hover/page:bg-black/[0.03]">
                      {multi && (
                        <span
                          aria-hidden
                          className="w-[13px] shrink-0 text-right text-[11.5px] tabular-nums"
                          style={{ color: active ? theme.accent : "#c2c7ce" }}
                        >
                          {page.isOverview ? "•" : i}
                        </span>
                      )}
                      {renaming === page.id ? (
                        <input
                          ref={renameInput}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename()
                            if (e.key === "Escape") setRenaming(null)
                          }}
                          className="min-w-0 flex-1 rounded-[4px] border border-black/15 px-[4px] py-[2px] text-[13px] tracking-[-0.02em] outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            page.deleted ? onRestore(page.id) : onSelect(page.id)
                          }
                          className={cn(
                            "min-w-0 flex-1 truncate py-[3px] text-left text-[13.5px] tracking-[-0.02em] transition-colors",
                            page.deleted
                              ? "text-[#c2c7ce] line-through"
                              : active
                                ? "font-semibold"
                                : "text-[#5c6470] hover:text-[#16181d]"
                          )}
                          style={
                            active && !page.deleted
                              ? { color: theme.accent }
                              : undefined
                          }
                          aria-current={active ? "page" : undefined}
                        >
                          {page.title || "Untitled"}
                        </button>
                      )}
                      {page.dirty && !page.deleted && (
                        <span
                          aria-label="unsaved changes"
                          title="Has changes"
                          className="size-[6px] shrink-0 rounded-full"
                          style={{ background: theme.accent }}
                        />
                      )}
                      {/* hidden (not just transparent) so titles get the
                          full width until the row is actually hovered */}
                      <span className="hidden shrink-0 items-center group-hover/page:flex">
                        {page.deleted ? (
                          <button
                            type="button"
                            title="Restore page"
                            onClick={() => onRestore(page.id)}
                            className="rounded-[4px] p-[2px] text-[#9aa1ab] hover:bg-black/[0.06] hover:text-[#16181d]"
                          >
                            <ArrowCounterClockwise size={12} weight="bold" />
                          </button>
                        ) : (
                          <>
                            {!page.isOverview && (
                              <>
                                <button
                                  type="button"
                                  title="Rename page"
                                  onClick={() => {
                                    setDraft(page.title)
                                    setRenaming(page.id)
                                  }}
                                  className="rounded-[4px] p-[2px] text-[#c2c7ce] hover:bg-black/[0.06] hover:text-[#16181d]"
                                >
                                  <PencilSimple size={12} weight="bold" />
                                </button>
                                <span className="flex flex-col">
                                  <button
                                    type="button"
                                    title="Move up"
                                    disabled={moveIndex <= 0}
                                    onClick={() => onMove(page.id, -1)}
                                    className="rounded-[3px] px-[2px] text-[#c2c7ce] hover:text-[#16181d] disabled:opacity-30"
                                  >
                                    <CaretUp size={9} weight="bold" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Move down"
                                    disabled={
                                      moveIndex < 0 ||
                                      moveIndex >= movable.length - 1
                                    }
                                    onClick={() => onMove(page.id, 1)}
                                    className="rounded-[3px] px-[2px] text-[#c2c7ce] hover:text-[#16181d] disabled:opacity-30"
                                  >
                                    <CaretDown size={9} weight="bold" />
                                  </button>
                                </span>
                                <button
                                  type="button"
                                  title="Delete page"
                                  onClick={() => onDelete(page.id)}
                                  className="rounded-[4px] p-[2px] text-[#c2c7ce] hover:bg-[#fdecec] hover:text-[#d43c3c]"
                                >
                                  <Trash size={12} weight="bold" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
            {contentType === "guides" && (
              <button
                type="button"
                onClick={onAdd}
                className="mt-[7px] flex w-full items-center justify-center gap-[6px] rounded-[7px] border border-dashed border-black/15 py-[6px] text-[12.5px] font-medium text-[#9aa1ab] transition-colors hover:border-black/30 hover:text-[#5c6470]"
              >
                <Plus size={12} weight="bold" aria-hidden />
                Add a page
              </button>
            )}
          </div>
        </nav>
      </div>
    </div>
  )
}
