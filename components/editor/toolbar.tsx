"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import {
  ArrowUUpLeft,
  ArrowUUpRight,
  BookOpen,
  CaretDown,
  Check,
  Code,
  Keyboard,
  LinkSimple,
  ListBullets,
  ListNumbers,
  Plus,
  TextB,
  TextItalic,
  TextStrikethrough,
} from "@phosphor-icons/react"
import type { Editor } from "@tiptap/core"
import { useEditorState } from "@tiptap/react"

import { SLASH_ITEMS } from "@/components/editor/slash-menu"
import { cn } from "@/lib/utils"

/* The persistent toolbar, Wikipedia-VisualEditor style: undo/redo, a
   paragraph-style dropdown, formatting, link, the page-link chip, lists,
   and an Insert menu fed by the same registry as the "/" menu. Everything
   reflects the caret's context and works on the active editor. */

function Divider() {
  return <span aria-hidden className="mx-[3px] h-[18px] w-px shrink-0 bg-black/[0.08]" />
}

function TBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-[28px] min-w-[28px] items-center justify-center rounded-[7px] px-[4px] transition-colors",
        active
          ? "bg-[#16181d] text-white"
          : "text-[#5c6470] hover:bg-black/[0.05] hover:text-[#16181d]",
        disabled && "cursor-not-allowed opacity-35 hover:bg-transparent hover:text-[#5c6470]"
      )}
    >
      {children}
    </button>
  )
}

/* A panel portaled to <body> with fixed positioning: the toolbar lives in
   an overflow-x-auto strip, which clips ANY vertical overflow - panels
   rendered in place would open invisibly inside a 46px-tall box. Closes
   on outside click, scroll, or resize. */
function PortalPanel({
  anchor,
  width,
  onClose,
  keepEditorFocus,
  children,
}: {
  anchor: HTMLElement
  width: number
  onClose: () => void
  /** preventDefault mousedowns inside, so the caret stays in the editor */
  keepEditorFocus?: boolean
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos] = useState(() => {
    const r = anchor.getBoundingClientRect()
    return {
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      top: r.bottom + 6,
    }
  })

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (anchor.contains(e.target as Node)) return
      if (panelRef.current?.contains(e.target as Node)) return
      onClose()
    }
    // page scroll makes the fixed position stale → close; scrolling the
    // panel's OWN list must not count
    const closeOnScroll = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target))
        return
      onClose()
    }
    const closeNow = () => onClose()
    window.addEventListener("mousedown", close)
    window.addEventListener("scroll", closeOnScroll, { capture: true, passive: true })
    window.addEventListener("resize", closeNow)
    return () => {
      window.removeEventListener("mousedown", close)
      window.removeEventListener("scroll", closeOnScroll, { capture: true })
      window.removeEventListener("resize", closeNow)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={panelRef}
      onMouseDown={keepEditorFocus ? (e) => e.preventDefault() : undefined}
      className="fixed z-[45] overflow-hidden rounded-[10px] border border-black/[0.08] bg-white py-[4px] shadow-[0px_14px_36px_-8px_rgba(0,0,0,0.22),0px_3px_10px_-2px_rgba(0,0,0,0.08)]"
      style={{ left: pos.left, top: pos.top, width }}
    >
      {children}
    </div>,
    document.body
  )
}

/* a toolbar dropdown - trigger inline, panel portaled */
function Drop({
  label,
  title,
  children,
  open,
  setOpen,
  width = 200,
  disabled,
}: {
  label: React.ReactNode
  title: string
  children: React.ReactNode
  open: boolean
  setOpen: (v: boolean) => void
  width?: number
  disabled?: boolean
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  // captured at click time - refs must not be read during render
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        title={title}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setAnchor(btnRef.current)
          setOpen(!open)
        }}
        className={cn(
          "flex h-[28px] items-center gap-[4px] rounded-[7px] px-[7px] text-[13px] tracking-[-0.01em] transition-colors",
          open
            ? "bg-black/[0.06] text-[#16181d]"
            : "text-[#5c6470] hover:bg-black/[0.05] hover:text-[#16181d]",
          disabled &&
            "cursor-not-allowed opacity-35 hover:bg-transparent hover:text-[#5c6470]"
        )}
      >
        {label}
        <CaretDown
          size={10}
          weight="bold"
          className={cn("shrink-0 text-[#9aa1ab] transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && anchor && (
        <PortalPanel
          anchor={anchor}
          width={width}
          onClose={() => setOpen(false)}
          keepEditorFocus
        >
          {children}
        </PortalPanel>
      )}
    </div>
  )
}

function DropItem({
  onClick,
  active,
  children,
  icon,
}: {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-[9px] px-[11px] py-[5px] text-left text-[13.5px] tracking-[-0.01em] text-[#16181d] hover:bg-black/[0.04]"
    >
      {icon && <span className="shrink-0 text-[#5c6470]">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {active && <Check size={13} weight="bold" className="shrink-0 text-[#FF902F]" aria-hidden />}
    </button>
  )
}

/* static: which insert-menu rows start a new group */
const INSERT_ITEMS = SLASH_ITEMS.map((item, i) => ({
  item,
  showHeader: i === 0 || SLASH_ITEMS[i - 1].group !== item.group,
  firstHeader: i === 0,
}))

const STYLES = [
  { label: "Paragraph", is: (e: Editor) => e.isActive("paragraph") && !e.isActive("blockquote"), run: (e: Editor) => e.chain().focus().setParagraph().run() },
  { label: "Section heading", is: (e: Editor) => e.isActive("heading", { level: 2 }), run: (e: Editor) => e.chain().focus().setNode("heading", { level: 2 }).run() },
  { label: "Subheading", is: (e: Editor) => e.isActive("heading", { level: 3 }), run: (e: Editor) => e.chain().focus().setNode("heading", { level: 3 }).run() },
  { label: "Quote", is: (e: Editor) => e.isActive("blockquote"), run: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
  { label: "Code block", is: (e: Editor) => e.isActive("codeBlock"), run: (e: Editor) => e.chain().focus().toggleCodeBlock().run() },
]

export function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const e = ctx.editor
      const style = STYLES.find((s) => s.is(e))?.label ?? "Paragraph"
      return {
        style,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        code: e.isActive("code"),
        kbd: e.isActive("kbd"),
        strike: e.isActive("strike"),
        link: e.isActive("link"),
        href: (e.getAttributes("link").href as string) ?? "",
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        hasSelection: !e.state.selection.empty,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      }
    },
  })

  /* Wikipedia-style: the toolbar is inert until the caret is actually in
     the editor - otherwise "Paragraph style" etc. would apply to a caret
     the user can't see (or to nothing at all). Toolbar clicks preventDefault
     on mousedown, so using the toolbar doesn't blur the editor. */
  const [engaged, setEngaged] = useState(editor.isFocused)
  useEffect(() => {
    const on = () => setEngaged(true)
    const off = () => setEngaged(false)
    editor.on("focus", on)
    // selection changes only happen from inside the editor - a second
    // engagement signal for browsers with focus quirks
    editor.on("selectionUpdate", on)
    editor.on("blur", off)
    return () => {
      editor.off("focus", on)
      editor.off("selectionUpdate", on)
      editor.off("blur", off)
    }
  }, [editor])

  const [styleOpen, setStyleOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [draftHref, setDraftHref] = useState("")
  const linkInput = useRef<HTMLInputElement>(null)
  const linkRef = useRef<HTMLDivElement>(null)
  const [linkAnchor, setLinkAnchor] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (linkOpen) linkInput.current?.focus()
  }, [linkOpen])
  // outside-click/scroll closing is handled by PortalPanel

  const applyLink = () => {
    const href = draftHref.trim()
    if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    else editor.chain().focus().extendMarkRange("link").unsetLink().run()
    setLinkOpen(false)
  }

  const makeChip = () => {
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, " ")
    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({
        type: "conceptLink",
        attrs: { slug: "" },
        content: text ? [{ type: "text", text }] : undefined,
      })
      .run()
  }

  return (
    <div className="flex min-w-0 items-center gap-[1px]">
      <TBtn title="Undo (⌘Z)" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <ArrowUUpLeft size={15} weight="bold" />
      </TBtn>
      <TBtn title="Redo (⇧⌘Z)" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <ArrowUUpRight size={15} weight="bold" />
      </TBtn>

      <Divider />

      <Drop
        label={<span className="w-[104px] truncate text-left">{state.style}</span>}
        title="Paragraph style"
        disabled={!engaged}
        open={styleOpen}
        setOpen={setStyleOpen}
        width={190}
      >
        {STYLES.map((s) => (
          <DropItem
            key={s.label}
            active={state.style === s.label}
            onClick={() => {
              s.run(editor)
              setStyleOpen(false)
            }}
          >
            {s.label}
          </DropItem>
        ))}
      </Drop>

      <Divider />

      <TBtn title="Bold (⌘B)" disabled={!engaged} active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <TextB size={15} weight="bold" />
      </TBtn>
      <TBtn title="Italic (⌘I)" disabled={!engaged} active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <TextItalic size={15} />
      </TBtn>
      <Drop
        label={<span className={cn("font-serif text-[15px] leading-none underline underline-offset-2", (state.code || state.kbd || state.strike) && "text-[#16181d]")}>A</span>}
        title="More formatting"
        disabled={!engaged}
        open={moreOpen}
        setOpen={setMoreOpen}
        width={190}
      >
        <DropItem icon={<Code size={14} />} active={state.code} onClick={() => { editor.chain().focus().toggleCode().run(); setMoreOpen(false) }}>
          Inline code
        </DropItem>
        <DropItem icon={<Keyboard size={14} />} active={state.kbd} onClick={() => { editor.chain().focus().toggleMark("kbd").run(); setMoreOpen(false) }}>
          Keyboard key
        </DropItem>
        <DropItem icon={<TextStrikethrough size={14} />} active={state.strike} onClick={() => { editor.chain().focus().toggleStrike().run(); setMoreOpen(false) }}>
          Strikethrough
        </DropItem>
        <div className="my-[3px] h-px bg-black/[0.06]" />
        <DropItem onClick={() => { editor.chain().focus().unsetAllMarks().run(); setMoreOpen(false) }}>
          Clear formatting
        </DropItem>
      </Drop>

      <Divider />

      <div ref={linkRef} className="relative">
        <TBtn
          title="Link (⌘K)"
          active={state.link}
          disabled={!engaged || (!state.hasSelection && !state.link)}
          onClick={() => {
            setDraftHref(state.href)
            setLinkAnchor(linkRef.current)
            setLinkOpen(!linkOpen)
          }}
        >
          <LinkSimple size={15} />
        </TBtn>
        {linkOpen && linkAnchor && (
          <PortalPanel
            anchor={linkAnchor}
            width={286}
            onClose={() => setLinkOpen(false)}
          >
            <form
              className="flex items-center gap-[4px] px-[6px] py-[2px]"
              onSubmit={(e) => {
                e.preventDefault()
                applyLink()
              }}
            >
              <input
                ref={linkInput}
                value={draftHref}
                onChange={(e) => setDraftHref(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setLinkOpen(false)}
                placeholder="https://… (empty removes)"
                className="w-[210px] border-none bg-transparent px-[5px] text-[13px] outline-none placeholder:text-black/30"
              />
              <button type="submit" className="rounded-[6px] bg-[#16181d] px-[9px] py-[4px] text-[12px] font-semibold text-white">
                Set
              </button>
            </form>
          </PortalPanel>
        )}
      </div>
      <TBtn title="Link a concept or tool page" disabled={!engaged || !state.hasSelection} onClick={makeChip}>
        <BookOpen size={15} className="text-[#A633D6]" />
      </TBtn>

      <Divider />

      <Drop
        label={state.ordered ? <ListNumbers size={15} /> : <ListBullets size={15} />}
        title="Lists"
        disabled={!engaged}
        open={listOpen}
        setOpen={setListOpen}
        width={180}
      >
        <DropItem icon={<ListBullets size={14} />} active={state.bullet} onClick={() => { editor.chain().focus().toggleBulletList().run(); setListOpen(false) }}>
          Bullet list
        </DropItem>
        <DropItem icon={<ListNumbers size={14} />} active={state.ordered} onClick={() => { editor.chain().focus().toggleOrderedList().run(); setListOpen(false) }}>
          Numbered list
        </DropItem>
      </Drop>

      <Drop
        label={
          <span className="flex items-center gap-[4px]">
            <Plus size={13} weight="bold" />
            <span className="hidden lg:inline">Insert</span>
          </span>
        }
        title="Insert a block"
        disabled={!engaged}
        open={insertOpen}
        setOpen={setInsertOpen}
        width={280}
      >
        <div className="max-h-[340px] overflow-y-auto overscroll-contain">
          {INSERT_ITEMS.map(({ item, showHeader, firstHeader }) => {
            const Icon = item.icon
            return (
              <div key={item.title}>
                {showHeader && (
                  <p className={cn("px-[11px] pb-[3px] text-[12px] font-medium text-[#9aa1ab]", firstHeader ? "pt-[4px]" : "pt-[10px]")}>
                    {item.group}
                  </p>
                )}
                <DropItem
                  icon={<Icon size={14} />}
                  onClick={() => {
                    const pos = editor.state.selection.from
                    item.run(editor, { from: pos, to: pos })
                    setInsertOpen(false)
                  }}
                >
                  {item.title}
                </DropItem>
              </div>
            )
          })}
        </div>
      </Drop>
    </div>
  )
}
