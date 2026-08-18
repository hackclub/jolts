"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  ArrowElbowDownLeft,
  FileText,
  HashStraight,
  MagnifyingGlass,
} from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import MiniSearch from "minisearch"

import {
  Command,
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
   Ctrl/Cmd+K.

   Ranking is MiniSearch, not cmdk. cmdk's built-in filter scores
   characters rather than words, so it matches scattered letters across a
   row's whole value and buries the real answer under near-misses. Here it
   runs with shouldFilter={false} and does only what it is good at -
   roving selection and keyboard nav - over a list ordered in this file. */

type SearchDoc = {
  href: string
  title: string
  crumb: string
  group: string
  kind: "page" | "section"
  text: string
}

/** A doc plus the id MiniSearch keys results by: its index in the array. */
type Indexed = SearchDoc & { id: number }

let cachedDocs: Indexed[] | null = null
let cachedIndex: MiniSearch<Indexed> | null = null

function buildIndex(docs: Indexed[]): MiniSearch<Indexed> {
  const index = new MiniSearch<Indexed>({
    fields: ["title", "crumb", "text"],
    /* Nothing is stored: hits come back as ids and we read the doc out of
       the array, so the corpus lives in memory exactly once. */
    storeFields: [],
    searchOptions: {
      boost: { title: 5, crumb: 2 },
      // match half-typed words; MIN_QUERY keeps this off a lone letter
      prefix: true,
      /* Typo tolerance only where a typo is plausible. Short electronics
         terms ("i2c", "5v", "gnd") stay exact or they collide. */
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      /* Every word has to match something. This is the precision knob
         cmdk was missing. */
      combineWith: "AND",
    },
  })
  index.addAll(docs)
  return index
}

/* A single letter can't say anything useful about an electronics guide, so
   the browse list stays up until the second character. It also keeps prefix
   matching from having to answer "everything starting with i". */
const MIN_QUERY = 2
const RESULT_LIMIT = 30
const SNIPPET_TAIL = 100
const SNIPPET_LEAD = 32

/** The stretch of prose around the first matched term, so a result's
    second line shows why it matched instead of the same opening every
    time. Null when the match was in the title or crumb only. */
function snippetAround(text: string, terms: string[]) {
  if (!text) return null
  const haystack = text.toLowerCase()
  let at = -1
  let length = 0
  for (const term of terms) {
    const found = haystack.indexOf(term.toLowerCase())
    if (found !== -1 && (at === -1 || found < at)) {
      at = found
      length = term.length
    }
  }
  if (at === -1) return null

  let from = Math.max(0, at - SNIPPET_LEAD)
  if (from > 0) {
    // open on a word boundary rather than mid-word
    const space = text.indexOf(" ", from)
    from = space !== -1 && space < at ? space + 1 : from
  }
  return {
    lead: (from > 0 ? "…" : "") + text.slice(from, at),
    hit: text.slice(at, at + length),
    tail: text.slice(at + length, at + length + SNIPPET_TAIL),
  }
}

type Result = {
  doc: Indexed
  snippet: ReturnType<typeof snippetAround>
}

const GROUP_ORDER = ["Guides", "Concepts", "Tools", "Pages"]

/* Groups come out ordered by their best-scoring member, so the first row
   of the list is always the strongest match site-wide. A fixed group order
   would be steadier to look at but can bury the answer three headings
   down, which was the old palette's worst habit. */
function rank(
  index: MiniSearch<Indexed>,
  docs: Indexed[],
  query: string
): [string, Result[]][] {
  const groups = new Map<string, Result[]>()
  for (const hit of index.search(query).slice(0, RESULT_LIMIT)) {
    const doc = docs[hit.id as number]
    if (!doc) continue
    const list = groups.get(doc.group) ?? []
    list.push({ doc, snippet: snippetAround(doc.text, hit.terms) })
    groups.set(doc.group, list)
  }
  return [...groups.entries()]
}

/* Empty query: the pages, not every section on the site. Listing all of
   the section rows up front is a wall of text nobody reads. */
function browse(docs: Indexed[]): [string, Result[]][] {
  const groups = new Map<string, Result[]>()
  for (const doc of docs) {
    if (doc.kind !== "page") continue
    const list = groups.get(doc.group) ?? []
    list.push({ doc, snippet: null })
    groups.set(doc.group, list)
  }
  return [...groups.entries()].sort(
    (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0])
  )
}

export function SearchButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [docs, setDocs] = useState<Indexed[] | null>(cachedDocs)
  const [selected, setSelected] = useState("")
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
        cachedDocs = data.map((doc, id) => ({ ...doc, id }))
        cachedIndex = buildIndex(cachedDocs)
        setDocs(cachedDocs)
      })
      .catch(() => setDocs([]))
  }, [open])

  const groups = useMemo(() => {
    if (!docs?.length) return []
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY) return browse(docs)
    cachedIndex ??= buildIndex(docs)
    return rank(cachedIndex, docs, trimmed)
  }, [docs, query])

  /* cmdk leaves its selection where it was when the list changes under it,
     stranding the highlight on a row that has scrolled away - and on the
     very first open it highlights nothing at all, so Enter is dead. Pin the
     highlight to the top result whenever the result set is rebuilt: on each
     keystroke, and once when the index finishes loading. Adjusted during
     render rather than in an effect so the list never paints unpinned. */
  const topId = groups[0]?.[1][0]?.doc.id
  const topValue = topId === undefined ? "" : String(topId)
  const resultsKey = `${docs?.length ?? 0}:${query}`
  // "" can never be a resultsKey, so the first render always pins
  const [lastKey, setLastKey] = useState("")
  if (lastKey !== resultsKey) {
    setLastKey(resultsKey)
    setSelected(topValue)
  }

  /* The other half of that fix. cmdk keeps the selected row in view by
     calling scrollIntoView on it, so as the results churn under you the
     list scrolls itself to wherever the highlight ended up - which reads as
     the palette lurching downwards mid-word. The highlight is pinned to the
     top row above, so send the scroll position back with it. */
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 })
  }, [resultsKey])

  const empty = docs !== null && groups.length === 0

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

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          // reopening starts clean, not on the last search
          if (!next) setQuery("")
        }}
      >
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
                shouldFilter={false}
                value={selected}
                onValueChange={setSelected}
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
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search guides, concepts, tools…"
                    className="h-[52px] w-full bg-transparent text-[15.5px] tracking-[-0.01em] text-[#16181d] outline-none placeholder:text-[#9aa1ab]"
                  />
                  <kbd className="shrink-0 rounded-[5px] border border-black/10 bg-[#fafafa] px-[6px] py-[2px] text-[11px] font-medium text-[#9aa1ab]">
                    esc
                  </kbd>
                </div>

                <CommandList
                  ref={listRef}
                  className="max-h-[380px] scroll-py-2 p-[6px]"
                >
                  {/* ours, not CommandEmpty - that one is tied to cmdk's
                      filter, which is off. role=presentation keeps a
                      non-option out of the listbox. */}
                  {(docs === null || empty) && (
                    <div
                      role="presentation"
                      className="py-[32px] text-center text-[14px] tracking-[-0.01em] text-[#9aa1ab]"
                    >
                      {docs === null ? (
                        "Loading…"
                      ) : query.trim() ? (
                        <>
                          No results for{" "}
                          <span className="font-medium text-[#16181d]">
                            {query.trim()}
                          </span>
                        </>
                      ) : (
                        // blank query and still nothing: the index failed to load
                        "Search is unavailable right now."
                      )}
                    </div>
                  )}
                  {groups.map(([group, items]) => (
                    <CommandGroup
                      key={group}
                      heading={group}
                      className="p-0 pt-[6px] **:[[cmdk-group-heading]]:px-[10px] **:[[cmdk-group-heading]]:pb-[4px] **:[[cmdk-group-heading]]:text-[11.5px] **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-[0.02em] **:[[cmdk-group-heading]]:text-[#9aa1ab] **:[[cmdk-group-heading]]:uppercase"
                    >
                      {items.map(({ doc, snippet }) => (
                        <CommandItem
                          key={doc.id}
                          value={String(doc.id)}
                          onSelect={() => {
                            setOpen(false)
                            setQuery("")
                            router.push(doc.href)
                          }}
                          className={cn(
                            "group/result mx-0 my-[2px] flex items-center gap-[11px] rounded-[8px] px-[10px] py-[8px]",
                            "data-selected:bg-[#01A6FF] data-selected:text-white",
                            // hide the base component's trailing check icon
                            "[&>svg:last-child]:hidden"
                          )}
                        >
                          {/* The icon colours need `!`: the base CommandItem
                              carries data-selected:*:[svg]:text-foreground,
                              which lands on `.item[data-selected] > svg` and
                              outweighs a group-data-selected variant, painting
                              both icons near-black on the blue row. */}
                          {doc.kind === "page" ? (
                            <FileText
                              size={17}
                              weight="regular"
                              className="shrink-0 text-[#9aa1ab] group-data-selected/result:text-white/80!"
                              aria-hidden
                            />
                          ) : (
                            <HashStraight
                              size={16}
                              weight="bold"
                              className="ml-[2px] shrink-0 text-[#c2c7ce] group-data-selected/result:text-white/70!"
                              aria-hidden
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-[#16181d] group-data-selected/result:text-white">
                              {doc.title}
                            </span>
                            <span className="block truncate text-[12px] tracking-[-0.01em] text-[#9aa1ab] group-data-selected/result:text-white/70">
                              {snippet ? (
                                <>
                                  {snippet.lead}
                                  <mark className="bg-transparent font-semibold text-[#16181d] group-data-selected/result:text-white">
                                    {snippet.hit}
                                  </mark>
                                  {snippet.tail}
                                </>
                              ) : (
                                doc.crumb
                              )}
                            </span>
                          </span>
                          <ArrowElbowDownLeft
                            size={14}
                            weight="bold"
                            className="shrink-0 text-transparent group-data-selected/result:text-white/80!"
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
                  {/* AugiePixel: a bitmap face, so no faux-bold to smear the
                      pixel grid and no negative tracking to collide it. Sized
                      up from the footer's 11.5px because pixel fonts read
                      small at a given em. */}
                  <span className="ml-auto font-augie text-[15px] text-black">
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
