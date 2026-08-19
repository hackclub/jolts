"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Copy, DotsSixVertical, Plus, Trash } from "@phosphor-icons/react"
import type { Node as PMDocNode } from "@tiptap/pm/model"
import { NodeSelection } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"

/* Notion-style block chrome, no native HTML5 drag anywhere.

   One floating handle follows the pointer. Targeting is NESTED: inside a
   Step/Warning/... body the handle grabs the inner paragraph or list, not
   the whole container - hover the container's header or frame to move the
   whole thing. Dragging is pure pointer events: a compact labeled pill
   follows the cursor (cloning framed blocks looks broken - their chrome
   is absolutely positioned), an accent line marks the drop slot (sized to
   the container it belongs to), the viewport auto-scrolls near its edges,
   Esc cancels, and the drop is one mapped ProseMirror transaction. */

const DRAG_THRESHOLD = 4
const SCROLL_ZONE = 90
const HANDLE_LEFT = -54

/* dev probe: lets tests confirm which build of this module is running */
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  ;(window as unknown as Record<string, unknown>).__blockHandleVersion = 5
}


/* containers whose direct children are individually draggable */
const CONTAINERS = new Set([
  "step",
  "warning",
  "checkpoint",
  "shipIt",
  "readMore",
  "externalGuide",
  "blockquote",
])

type Row = {
  /** absolute doc position of the node's start */
  from: number
  node: PMDocNode
  el: HTMLElement
  /** container row's `from`, null at top level */
  parentFrom: number | null
  /** 0 = top level, 1 = inside a container, 2 = bullet in a step's list… */
  depth: number
}

type Slot = {
  /** insert position in the ORIGINAL doc */
  insertPos: number
  /** the element whose rect defines the indicator's x-range */
  groupEl: HTMLElement
  /** rows adjacent to this slot, for live y computation */
  beforeRow: Row | null
  afterRow: Row | null
  parentNode: PMDocNode
  parentIndex: number
  /** nesting depth of blocks living at this slot */
  depth: number
  /** the block's own spot - selectable so releasing there puts it back */
  noop?: boolean
}

function isElement(n: unknown): n is HTMLElement {
  return n instanceof HTMLElement
}

function blockElements(dom: HTMLElement): HTMLElement[] {
  return [...dom.children].filter(
    (c): c is HTMLElement =>
      isElement(c) &&
      !c.classList.contains("ProseMirror-widget") &&
      !c.classList.contains("prosemirror-dropcursor-block") &&
      !c.classList.contains("ProseMirror-gapcursor")
  )
}

/** the DOM element holding a container's child blocks. Tiptap React
    renders NodeViewContent as a div whose REAL contentDOM is a nested
    [data-node-view-content-react] child - the blocks live in there. */
function contentDomOf(el: HTMLElement, typeName: string): HTMLElement | null {
  if (typeName === "blockquote") return el
  const nvc = el.querySelector("[data-node-view-content]") as HTMLElement | null
  if (!nvc) return null
  return (
    (nvc.querySelector("[data-node-view-content-react]") as HTMLElement | null) ??
    nvc
  )
}

const LISTS = new Set(["bulletList", "orderedList"])

/* what a landing step bar auto-groups beneath itself - plain prose only;
   any structural block (another step, heading, warning, media…) ends the
   step's region */
const ADOPTABLE = new Set([
  "paragraph",
  "bulletList",
  "orderedList",
  "codeBlock",
  "blockquote",
])

/* recursive: container children are rows, and each list ITEM is its own
   row - grabbing one bullet moves that bullet, never the whole list */
function pushRows(
  rows: Row[],
  node: PMDocNode,
  el: HTMLElement,
  from: number,
  parentFrom: number | null,
  depth: number
) {
  rows.push({ from, node, el, parentFrom, depth })
  const name = node.type.name
  let contentEl: HTMLElement | null = null
  if (CONTAINERS.has(name)) contentEl = contentDomOf(el, name)
  else if (LISTS.has(name)) contentEl = el // the ul/ol itself; li children
  if (!contentEl) return
  const kids = [...contentEl.children].filter(isElement)
  let cpos = from + 1
  const kcount = Math.min(kids.length, node.childCount)
  for (let j = 0; j < kcount; j++) {
    pushRows(rows, node.child(j), kids[j], cpos, from, depth + 1)
    cpos += node.child(j).nodeSize
  }
}

function collectRows(editor: Editor, dom: HTMLElement): Row[] {
  const doc = editor.state.doc
  const rows: Row[] = []
  const tops = blockElements(dom)
  let pos = 0
  const count = Math.min(tops.length, doc.childCount)
  for (let i = 0; i < count; i++) {
    pushRows(rows, doc.child(i), tops[i], pos, null, 0)
    pos += doc.child(i).nodeSize
  }
  return rows
}

/** Deepest row whose rect contains y AND whose left edge is near enough
    to the pointer's x (children listed after parents). Depth-aware x-rule:
    top-level rows own the whole left gutter; nested rows only match when
    the pointer is at their own text or their own (indented) handle. So
    the far gutter, a step's header, or its image column grab the WHOLE
    step - only the nested content itself grabs the inner block. */
function pickRow(
  rows: Row[],
  x: number,
  y: number,
  articleLeft: number
): Row | null {
  let best: Row | null = null
  for (const row of rows) {
    const r = row.el.getBoundingClientRect()
    if (y < r.top || y > r.bottom) continue
    const minX = row.parentFrom === null ? articleLeft - 70 : r.left - 58
    if (x >= minX) best = row
  }
  return best
}

function collectSlots(editor: Editor, dom: HTMLElement, rows: Row[]): Slot[] {
  const doc = editor.state.doc
  const slots: Slot[] = []
  const groups = new Map<number | null, Row[]>()
  for (const row of rows) {
    const list = groups.get(row.parentFrom) ?? []
    list.push(row)
    groups.set(row.parentFrom, list)
  }
  for (const [parentFrom, members] of groups) {
    const parentNode =
      parentFrom === null ? doc : (doc.nodeAt(parentFrom) as PMDocNode)
    if (!parentNode) continue
    const groupEl =
      parentFrom === null ? dom : (members[0].el.parentElement as HTMLElement)
    if (!groupEl) continue
    for (let j = 0; j <= members.length; j++) {
      slots.push({
        insertPos:
          j < members.length
            ? members[j].from
            : members[members.length - 1].from +
              members[members.length - 1].node.nodeSize,
        groupEl,
        beforeRow: j > 0 ? members[j - 1] : null,
        afterRow: j < members.length ? members[j] : null,
        parentNode,
        parentIndex: j,
        depth: members[0].depth,
      })
    }
  }
  return slots
}

function slotY(slot: Slot): number {
  if (slot.afterRow) return slot.afterRow.el.getBoundingClientRect().top - 2
  if (slot.beforeRow) return slot.beforeRow.el.getBoundingClientRect().bottom + 2
  return slot.groupEl.getBoundingClientRect().top
}

/* ---------- the ghost pill ---------- */

/* A real clone of the block, made to survive leaving its home: the guide's
   CSS variables (accent, checkers) and the step counter live on the
   article root, so a bare clone attached to <body> loses its colors and
   numbering - the wrapper re-supplies all of it. */
function makeGhost(
  source: Row,
  root: HTMLElement,
  shellOnly = false
): HTMLElement {
  const wrap = document.createElement("div")
  wrap.className = "jolts-guide jolts-editor-prose"

  const rootStyle = getComputedStyle(root)
  for (const v of [
    "--guide-accent",
    "--guide-checker-a",
    "--guide-checker-b",
  ]) {
    const val = rootStyle.getPropertyValue(v)
    if (val) wrap.style.setProperty(v, val)
  }

  // keep the dragged step's real number: counters restart in the clone,
  // so pre-advance the counter past all preceding steps
  const allSteps = [...root.querySelectorAll(".jolts-step")]
  const ownStep = source.el.classList.contains("jolts-step")
    ? source.el
    : source.el.querySelector(".jolts-step")
  if (ownStep) {
    const n = allSteps.indexOf(ownStep)
    if (n > 0) wrap.style.counterReset = `step ${n}`
  }

  let clone = source.el.cloneNode(true) as HTMLElement
  clone.removeAttribute("contenteditable")
  clone
    .querySelectorAll("[contenteditable]")
    .forEach((el) => el.removeAttribute("contenteditable"))
  clone.style.margin = "0"
  const inner = clone.firstElementChild as HTMLElement | null
  if (inner) {
    inner.style.marginTop = "0"
    inner.style.marginBottom = "0"
  }
  // a bare <li> outside its list loses the bullet - re-wrap it
  if (source.el.tagName === "LI" && source.el.parentElement) {
    const list = source.el.parentElement.cloneNode(false) as HTMLElement
    list.style.margin = "0"
    list.appendChild(clone)
    clone = list
  }
  // shell moves (steps) drag only the bar - the ghost matches
  if (shellOnly) {
    const sec = clone.querySelector(".jolts-step")
    if (sec) {
      for (const child of [...sec.children]) {
        if (child.tagName !== "H3") child.remove()
      }
    }
  }
  wrap.appendChild(clone)

  Object.assign(wrap.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "60",
    width: `${source.el.offsetWidth}px`,
    maxHeight: "280px",
    overflow: "hidden",
    opacity: "0.65",
    pointerEvents: "none",
    borderRadius: "12px",
    boxShadow: "0px 16px 40px -8px rgba(0,0,0,0.35)",
    background: "rgba(255,255,255,0.95)",
    padding: "8px 10px",
  } satisfies Partial<CSSStyleDeclaration>)
  return wrap
}

/* ---------- the component ---------- */

type Target = { row: Row; top: number; left: number }

export function BlockHandle({ editor }: { editor: Editor }) {
  const [target, setTarget] = useState<Target | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [indicator, setIndicator] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const draggingRef = useRef(false)
  const targetRef = useRef<Target | null>(null)
  useEffect(() => {
    targetRef.current = target
  }, [target])
  const menuOpenRef = useRef(false)
  useEffect(() => {
    menuOpenRef.current = menuOpen
  }, [menuOpen])
  const menuRef = useRef<HTMLDivElement>(null)

  const container = (): HTMLElement | null =>
    (editor.view.dom.closest(".jolts-editor-article") as HTMLElement) ?? null

  /* the editor is constructed before EditorContent attaches its view, and
     v3 THROWS on editor.view until then. Event timing around the attach
     is unreliable (the editor instance can also be swapped under us), so
     poll one frame at a time until THIS editor's view exists. */
  const [readyEditor, setReadyEditor] = useState<Editor | null>(() =>
    editor.isInitialized ? editor : null
  )
  useEffect(() => {
    // setInterval, NOT requestAnimationFrame: rAF never fires in hidden /
    // non-composited tabs, which would leave the handle dead forever
    if (editor.isDestroyed) return
    if (editor.isInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReadyEditor(editor)
      return
    }
    const timer = setInterval(() => {
      if (editor.isDestroyed) {
        clearInterval(timer)
        return
      }
      if (editor.isInitialized) {
        clearInterval(timer)
        setReadyEditor(editor)
      }
    }, 50)
    return () => clearInterval(timer)
  }, [editor])
  const viewReady = readyEditor === editor

  /* ---------- hover tracking ----------
     Zone-based, not element-based: the handle lives in the left gutter,
     OUTSIDE the article box, so element hover would drop the target the
     moment the pointer crosses the gap on its way to the handle. The
     article plus a left corridor counts as the zone; the row is picked
     by Y coordinate, deepest match wins. */

  useEffect(() => {
    if (!viewReady || editor.isDestroyed) return
    const dom = editor.view.dom as HTMLElement
    const root = container()
    if (!root) return

    // time-based throttle (not rAF - see the readiness poll above)
    let lastRun = 0

    const onMove = (e: MouseEvent) => {
      const now = performance.now()
      if (now - lastRun < 30) return
      lastRun = now
      if (draggingRef.current || menuOpenRef.current) return
      const rootRect = root.getBoundingClientRect()
      const inZone =
        e.clientX >= rootRect.left + HANDLE_LEFT - 16 &&
        e.clientX <= rootRect.right &&
        e.clientY >= rootRect.top - 4 &&
        e.clientY <= rootRect.bottom + 4
      if (!inZone) {
        if (targetRef.current) setTarget(null)
        return
      }
      // stickiness, narrowly: keep the current target only while the
      // pointer is in ITS handle corridor (just left of its content) -
      // wide enough to reach the handle without the target flipping,
      // narrow enough that hovering actual content re-picks normally
      const cur = targetRef.current
      if (cur && cur.row.el.isConnected) {
        const r = cur.row.el.getBoundingClientRect()
        if (
          e.clientY >= r.top &&
          e.clientY <= r.bottom &&
          e.clientX >= r.left + HANDLE_LEFT - 12 &&
          e.clientX <= r.left + 8
        )
          return
      }
      const row = pickRow(
        collectRows(editor, dom),
        e.clientX,
        e.clientY,
        rootRect.left
      )
      if (!row) return // between blocks - keep the current target
      if (row.el === targetRef.current?.row.el) return
      const r = row.el.getBoundingClientRect()
      setTarget({
        row,
        top: r.top - rootRect.top,
        // the handle sits just left of the block it will move - indented
        // for nested blocks, so what's being grabbed is never ambiguous
        left: r.left - rootRect.left + HANDLE_LEFT,
      })
    }

    document.addEventListener("mousemove", onMove, { passive: true })
    return () => {
      document.removeEventListener("mousemove", onMove)
    }
  }, [editor, viewReady])

  /* the doc can change under a stale target (typing, undo) - drop it */
  useEffect(() => {
    const clear = () => {
      if (!draggingRef.current) setTarget(null)
    }
    editor.on("update", clear)
    return () => {
      editor.off("update", clear)
    }
  }, [editor])

  /* ---------- block ops (work on the targeted row, nested or not) ---------- */

  const insertBelow = useCallback(() => {
    const t = targetRef.current
    if (!t) return
    const at = t.row.from + t.row.node.nodeSize
    if (t.row.node.type.name === "listItem") {
      // inside a list, "a line below" means a new bullet
      editor
        .chain()
        .insertContentAt(at, {
          type: "listItem",
          content: [{ type: "paragraph" }],
        })
        .focus(at + 2)
        .run()
      return
    }
    editor
      .chain()
      .insertContentAt(at, { type: "paragraph" })
      .focus(at + 1)
      .run()
    editor.commands.insertContent("/")
  }, [editor])

  const deleteBlock = useCallback(() => {
    const t = targetRef.current
    if (!t) return
    editor
      .chain()
      .deleteRange({ from: t.row.from, to: t.row.from + t.row.node.nodeSize })
      .focus()
      .run()
    setMenuOpen(false)
    setTarget(null)
  }, [editor])

  const duplicateBlock = useCallback(() => {
    const t = targetRef.current
    if (!t) return
    editor
      .chain()
      .insertContentAt(t.row.from + t.row.node.nodeSize, t.row.node.toJSON())
      .run()
    setMenuOpen(false)
  }, [editor])

  /* ---------- pointer-based dragging ---------- */

  const startPointer = useCallback(
    (e: React.PointerEvent) => {
      const t = targetRef.current
      if (!t || e.button !== 0) return
      e.preventDefault()

      const dom = editor.view.dom as HTMLElement
      const root = container()
      if (!root) return

      const source = t.row
      const srcFrom = source.from
      const srcTo = source.from + source.node.nodeSize
      // steps drag like headings: the BAR moves, the content stays put
      // (unwrapped in place) - never "stuff inside the step too"
      const shellMove =
        source.node.type.name === "step" && source.node.content.size > 0

      const startX = e.clientX
      const startY = e.clientY
      let started = false
      let ghost: HTMLElement | null = null
      let chosen: Slot | null = null
      let lastY = e.clientY
      let raf: number | null = null
      let cancelled = false

      // slots are structural - collect once; rects re-read live. The
      // block's OWN slots stay in the list flagged noop: releasing an
      // accidental drag near where it started must put it back, not fling
      // it to the nearest other gap.
      const slots = collectSlots(editor, dom, collectRows(editor, dom))
        .filter((s) => {
          // no dropping inside the dragged node itself
          if (s.insertPos > srcFrom && s.insertPos < srcTo) return false
          if (s.insertPos === srcFrom || s.insertPos === srcTo) return true
          // never NEST deeper than where the block came from: a top-level
          // step stays top-level, a bullet can hop lists but not gain depth
          if (s.depth > source.depth) return false
          // the parent must accept this node type there
          return s.parentNode.canReplaceWith(
            s.parentIndex,
            s.parentIndex,
            source.node.type
          )
        })
        .map((s) =>
          s.insertPos === srcFrom || s.insertPos === srcTo
            ? { ...s, noop: true }
            : s
        )

      const dimEl = shellMove
        ? ((source.el.querySelector(".jolts-step > h3") as HTMLElement | null) ??
          source.el)
        : source.el

      const begin = () => {
        started = true
        draggingRef.current = true
        setMenuOpen(false)
        // a real drag selects what's being dragged (a plain click doesn't).
        // Shell moves skip it: selecting the step node would highlight the
        // content that ISN'T coming along.
        if (!shellMove) {
          try {
            editor.view.dispatch(
              editor.state.tr.setSelection(
                NodeSelection.create(editor.state.doc, srcFrom)
              )
            )
          } catch {
            /* non-selectable node - fine */
          }
        }
        ghost = makeGhost(source, root, shellMove)
        document.body.appendChild(ghost)
        dimEl.style.opacity = "0.3"
        document.body.style.userSelect = "none"

        const tick = () => {
          if (!draggingRef.current) return
          if (lastY < SCROLL_ZONE) {
            window.scrollBy(0, -Math.ceil((SCROLL_ZONE - lastY) / 5))
            recompute()
          } else if (lastY > window.innerHeight - SCROLL_ZONE) {
            window.scrollBy(
              0,
              Math.ceil((lastY - (window.innerHeight - SCROLL_ZONE)) / 5)
            )
            recompute()
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      }

      const recompute = () => {
        if (slots.length === 0) {
          chosen = null
          setIndicator(null)
          return
        }
        let best: Slot = slots[0]
        let bestDist = Infinity
        for (const s of slots) {
          const d = Math.abs(slotY(s) - lastY)
          if (d < bestDist) {
            bestDist = d
            best = s
          }
        }
        chosen = best
        if (best.noop) {
          // releasing here keeps the block where it is - say so by
          // showing no destination
          setIndicator(null)
          return
        }
        const rootRect = root.getBoundingClientRect()
        const g = best.groupEl.getBoundingClientRect()
        setIndicator({
          top: slotY(best) - rootRect.top,
          left: g.left - rootRect.left,
          width: g.width,
        })
      }

      const onMove = (ev: PointerEvent) => {
        lastY = ev.clientY
        if (!started) {
          if (
            Math.hypot(ev.clientX - startX, ev.clientY - startY) <
            DRAG_THRESHOLD
          )
            return
          begin()
        }
        if (ghost) {
          ghost.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`
        }
        recompute()
      }

      const cleanup = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("keydown", onKey, true)
        if (raf) cancelAnimationFrame(raf)
        ghost?.remove()
        dimEl.style.opacity = ""
        document.body.style.userSelect = ""
        draggingRef.current = false
        setIndicator(null)
      }

      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          cancelled = true
          cleanup()
        }
      }

      const onUp = () => {
        const wasStarted = started
        const finalSlot = chosen
        cleanup()
        if (cancelled) return
        if (!wasStarted) {
          // a plain click on the grip opens the menu - it must NOT select
          // the block (a NodeSelection paints the whole step and reads
          // like everything got multi-selected)
          setMenuOpen((o) => !o)
          return
        }
        if (!finalSlot || finalSlot.noop) return
        const tr = editor.state.tr.delete(srcFrom, srcTo)
        let mapped: number
        if (shellMove) {
          // flat-step semantics: the step is just the bar, grouping is
          // automatic. Leaving: its content unwraps in place. Landing:
          // it adopts the adoptable blocks under the drop point, up to
          // the next structural boundary.
          tr.insert(srcFrom, source.node.content)
          mapped = tr.mapping.map(finalSlot.insertPos, -1)
          const doc = tr.doc
          let idx = doc.resolve(mapped).index(0)
          let end = mapped
          while (idx < doc.childCount) {
            const child = doc.child(idx)
            if (!ADOPTABLE.has(child.type.name)) break
            end += child.nodeSize
            idx++
          }
          const adopted = end > mapped ? doc.slice(mapped, end).content : null
          const landed =
            adopted && adopted.size > 0
              ? source.node.type.create(source.node.attrs, adopted)
              : (source.node.type.createAndFill(source.node.attrs) ??
                source.node.type.create(source.node.attrs))
          tr.replaceWith(mapped, end, landed)
        } else {
          mapped = tr.mapping.map(finalSlot.insertPos, -1)
          tr.insert(mapped, source.node)
        }
        // the moved block stays selected, like Notion - but focus the view
        // directly: commands.focus() would scroll to the old selection
        try {
          tr.setSelection(NodeSelection.create(tr.doc, mapped))
        } catch {
          /* non-selectable node - fine */
        }
        editor.view.dispatch(tr)
        editor.view.focus()
        setTarget(null)
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("keydown", onKey, true)
    },
    [editor]
  )

  /* close the menu on outside clicks */
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as globalThis.Node))
        setMenuOpen(false)
    }
    window.addEventListener("mousedown", close)
    return () => window.removeEventListener("mousedown", close)
  }, [menuOpen])

  return (
    <>
      {target && (
        <div
          ref={menuRef}
          contentEditable={false}
          className="absolute z-30 hidden items-start sm:flex"
          style={{ top: target.top + 2, left: target.left }}
        >
          <button
            type="button"
            tabIndex={-1}
            title="Add a line below"
            onClick={insertBelow}
            className="rounded-[6px] p-[3px] text-[#c2c7ce] transition-colors hover:bg-black/[0.05] hover:text-[#5c6470]"
          >
            <Plus size={15} weight="bold" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            title="Drag to move · click for options"
            onPointerDown={startPointer}
            className="cursor-grab touch-none rounded-[6px] p-[3px] text-[#c2c7ce] transition-colors hover:bg-black/[0.05] hover:text-[#5c6470] active:cursor-grabbing"
          >
            <DotsSixVertical size={15} weight="bold" />
          </button>

          {menuOpen && (
            <div className="absolute top-[26px] left-0 z-50 w-[150px] overflow-hidden rounded-[10px] border border-black/10 bg-white py-[4px] shadow-[0px_10px_28px_-6px_rgba(0,0,0,0.28)]">
              <button
                type="button"
                onClick={duplicateBlock}
                className="flex w-full items-center gap-[8px] px-[11px] py-[5px] text-left text-[13px] text-[#33383f] hover:bg-black/[0.04]"
              >
                <Copy size={13} aria-hidden />
                Duplicate
              </button>
              <button
                type="button"
                onClick={deleteBlock}
                className="flex w-full items-center gap-[8px] px-[11px] py-[5px] text-left text-[13px] text-[#d43c3c] hover:bg-[#fdecec]"
              >
                <Trash size={13} aria-hidden />
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {indicator && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-30 h-[3px] rounded-full"
          style={{
            top: indicator.top,
            left: indicator.left,
            width: indicator.width,
            background: "var(--guide-accent, #FF902F)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.6)",
          }}
        />
      )}
    </>
  )
}
