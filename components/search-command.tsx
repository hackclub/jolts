"use client"

import { useEffect, useState } from "react"

import {
  ArrowElbowDownLeft,
  FileText,
  HashStraight,
  MagnifyingGlass,
} from "@phosphor-icons/react"
import { useRouter } from "next/navigation"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "@/lib/utils"

/* Site search: a command palette in the navigation dropdown's blue
   checker chrome, DocSearch-style - grouped results, two-line items,
   kbd footer. The index is a static JSON route, fetched once on first
   open and cached for the session. Opens from the header button or
   Ctrl/Cmd+K. */

type SearchDoc = {
  href: string
  title: string
  crumb: string
  group: string
  kind: "page" | "section"
  excerpt?: string
}

let cachedDocs: SearchDoc[] | null = null

export function SearchButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<SearchDoc[] | null>(cachedDocs)
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!open || cachedDocs) return
    fetch("/search-index.json")
      .then((r) => r.json())
      .then((data: SearchDoc[]) => {
        cachedDocs = data
        setDocs(data)
      })
      .catch(() => setDocs([]))
  }, [open])

  const groups = new Map<string, SearchDoc[]>()
  for (const doc of docs ?? []) {
    const list = groups.get(doc.group) ?? []
    list.push(doc)
    groups.set(doc.group, list)
  }

  return (
    <>
      <button
        type="button"
        aria-label="Search (Ctrl+K)"
        onClick={() => setOpen(true)}
        className={className}
      >
        <MagnifyingGlass
          size={22}
          weight="bold"
          aria-hidden
          className="relative z-10 text-white [filter:drop-shadow(0px_1.5px_4px_rgba(0,0,0,0.35))]"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogContent
          showCloseButton={false}
          className="top-[14%] w-full max-w-[calc(100%-2rem)] translate-y-0 gap-0 bg-transparent p-0 ring-0 sm:max-w-[580px]"
        >
          {/* the navigation dropdown's chrome: blue checker frame */}
          <div className="relative overflow-hidden rounded-[14px] p-[6px] shadow-[0px_10px_40px_-6px_rgba(0,0,0,0.4)]">
            <div
              aria-hidden
              className="absolute -inset-[60%] rotate-[-16.06deg] bg-[#01A6FF]"
              style={{
                backgroundImage:
                  "conic-gradient(#01BBFF 0 25%, #01A6FF 0 50%, #01BBFF 0 75%, #01A6FF 0)",
                backgroundSize: "150px 150px",
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-[rgba(1,206,242,0)] to-[rgba(1,206,242,0.7)]"
            />
            <div className="relative overflow-hidden rounded-[9px] bg-white shadow-[0px_3px_5px_0px_rgba(0,0,0,0.2)]">
              <Command
                className="rounded-none! bg-white p-0"
                loop
              >
                {/* input row */}
                <div className="flex items-center gap-[10px] border-b border-black/[0.07] px-[16px]">
                  <MagnifyingGlass
                    size={18}
                    weight="bold"
                    className="shrink-0 text-[#01A6FF]"
                    aria-hidden
                  />
                  <CommandPrimitive.Input
                    autoFocus
                    placeholder="Search guides, concepts, tools…"
                    className="h-[52px] w-full bg-transparent text-[15.5px] tracking-[-0.01em] text-[#16181d] outline-none placeholder:text-[#9aa1ab]"
                  />
                  <kbd className="shrink-0 rounded-[5px] border border-black/10 bg-[#fafafa] px-[6px] py-[2px] text-[11px] font-medium text-[#9aa1ab]">
                    esc
                  </kbd>
                </div>

                <CommandList className="max-h-[380px] scroll-py-2 p-[6px]">
                  <CommandEmpty className="py-[32px] text-center text-[14px] tracking-[-0.01em] text-[#9aa1ab]">
                    {docs === null ? "Loading…" : "No results."}
                  </CommandEmpty>
                  {[...groups.entries()].map(([group, items]) => (
                    <CommandGroup
                      key={group}
                      heading={group}
                      className="p-0 pt-[6px] **:[[cmdk-group-heading]]:px-[10px] **:[[cmdk-group-heading]]:pb-[4px] **:[[cmdk-group-heading]]:text-[11.5px] **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-[0.02em] **:[[cmdk-group-heading]]:text-[#9aa1ab] **:[[cmdk-group-heading]]:uppercase"
                    >
                      {items.map((doc) => (
                        <CommandItem
                          key={doc.href + doc.title}
                          value={`${doc.title} ${doc.crumb} ${doc.excerpt ?? ""}`}
                          onSelect={() => {
                            setOpen(false)
                            router.push(doc.href)
                          }}
                          className={cn(
                            "group/result mx-0 my-[2px] flex items-center gap-[11px] rounded-[8px] px-[10px] py-[8px]",
                            "data-selected:bg-[#01A6FF] data-selected:text-white",
                            // hide the base component's trailing check icon
                            "[&>svg:last-child]:hidden"
                          )}
                        >
                          {doc.kind === "page" ? (
                            <FileText
                              size={17}
                              weight="regular"
                              className="shrink-0 text-[#9aa1ab] group-data-selected/result:text-white/80"
                              aria-hidden
                            />
                          ) : (
                            <HashStraight
                              size={16}
                              weight="bold"
                              className="ml-[2px] shrink-0 text-[#c2c7ce] group-data-selected/result:text-white/70"
                              aria-hidden
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-[#16181d] group-data-selected/result:text-white">
                              {doc.title}
                            </span>
                            <span className="block truncate text-[12px] tracking-[-0.01em] text-[#9aa1ab] group-data-selected/result:text-white/70">
                              {doc.excerpt ?? doc.crumb}
                            </span>
                          </span>
                          <ArrowElbowDownLeft
                            size={14}
                            weight="bold"
                            className="shrink-0 text-transparent group-data-selected/result:text-white/80"
                            aria-hidden
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>

                {/* footer */}
                <div className="flex items-center gap-[14px] border-t border-black/[0.07] px-[14px] py-[8px] text-[11.5px] tracking-[-0.01em] text-[#9aa1ab]">
                  <span className="flex items-center gap-[5px]">
                    <kbd className="rounded-[4px] border border-black/10 bg-[#fafafa] px-[4px] py-[1px] font-medium">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-[5px]">
                    <kbd className="rounded-[4px] border border-black/10 bg-[#fafafa] px-[4px] py-[1px] font-medium">↵</kbd>
                    open
                  </span>
                  <span className="ml-auto font-semibold tracking-[-0.02em] text-[#01A6FF]">
                    jolts
                  </span>
                </div>
              </Command>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
