"use client"

import { useEffect, useRef, useState } from "react"

import {
  BookOpen,
  Code,
  Keyboard,
  LinkSimple,
  TextB,
  TextItalic,
  TextStrikethrough,
} from "@phosphor-icons/react"
import type { Editor } from "@tiptap/core"
import { TextSelection } from "@tiptap/pm/state"
import { useEditorState } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"

import { cn } from "@/lib/utils"

/* The selection bubble: formatting, links, and the two linking-discipline
   chips (select a phrase → make it a Concept/Tool link). */

function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-[28px] items-center justify-center rounded-[7px] transition-colors",
        active
          ? "bg-[#16181d] text-white"
          : "text-[#5c6470] hover:bg-black/[0.06] hover:text-[#16181d]"
      )}
    >
      {children}
    </button>
  )
}

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor.isActive("bold"),
      italic: ctx.editor.isActive("italic"),
      code: ctx.editor.isActive("code"),
      kbd: ctx.editor.isActive("kbd"),
      strike: ctx.editor.isActive("strike"),
      link: ctx.editor.isActive("link"),
      href: (ctx.editor.getAttributes("link").href as string) ?? "",
    }),
  })
  const [linkMode, setLinkMode] = useState(false)
  const [draftHref, setDraftHref] = useState("")
  const linkInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (linkMode) linkInput.current?.focus()
  }, [linkMode])

  const applyLink = () => {
    const href = draftHref.trim()
    if (href) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href })
        .run()
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    }
    setLinkMode(false)
  }

  /* one "link" for concepts and tools alike - the chip's picker (which
     auto-opens on an empty target) offers both and sets the real kind */
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
    <BubbleMenu
      editor={editor}
      pluginKey="joltsBubble"
      updateDelay={150}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: e, from, to }) => {
        if (from === to) return false
        // formatting doesn't apply inside code blocks or atom selections
        if (e.isActive("codeBlock")) return false
        return e.state.selection instanceof TextSelection
      }}
    >
      <div className="relative z-[45] flex items-center gap-[2px] rounded-[10px] border border-black/10 bg-white p-[3px] shadow-[0px_8px_24px_-6px_rgba(0,0,0,0.28)]">
        {linkMode ? (
          <form
            className="flex items-center gap-[4px] px-[4px]"
            onSubmit={(e) => {
              e.preventDefault()
              applyLink()
            }}
          >
            <LinkSimple size={14} className="shrink-0 text-[#9aa1ab]" aria-hidden />
            <input
              ref={linkInput}
              value={draftHref}
              onChange={(e) => setDraftHref(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setLinkMode(false)
              }}
              placeholder="https://… (empty removes)"
              className="w-[220px] border-none bg-transparent py-[5px] text-[13px] outline-none placeholder:text-black/30"
            />
            <button
              type="submit"
              className="rounded-[6px] bg-[#16181d] px-[9px] py-[4px] text-[12px] font-semibold text-white"
            >
              Set
            </button>
          </form>
        ) : (
          <>
            <Btn
              title="Bold (⌘B)"
              active={state.bold}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <TextB size={15} weight="bold" />
            </Btn>
            <Btn
              title="Italic (⌘I)"
              active={state.italic}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <TextItalic size={15} />
            </Btn>
            <Btn
              title="Inline code"
              active={state.code}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Code size={15} />
            </Btn>
            <Btn
              title="Keyboard key, like S"
              active={state.kbd}
              onClick={() => editor.chain().focus().toggleMark("kbd").run()}
            >
              <Keyboard size={15} />
            </Btn>
            <Btn
              title="Strikethrough"
              active={state.strike}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <TextStrikethrough size={15} />
            </Btn>
            <span aria-hidden className="mx-[2px] h-[16px] w-px bg-black/10" />
            <Btn
              title="Link (⌘K)"
              active={state.link}
              onClick={() => {
                setDraftHref(state.href)
                setLinkMode(true)
              }}
            >
              <LinkSimple size={15} />
            </Btn>
            <Btn
              title="Link a concept or tool page"
              onClick={makeChip}
            >
              <BookOpen size={15} className="text-[#A633D6]" />
            </Btn>
          </>
        )}
      </div>
    </BubbleMenu>
  )
}
