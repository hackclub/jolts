"use client"

import { useEffect, useRef } from "react"

import { markdown } from "@codemirror/lang-markdown"
import { EditorView } from "@codemirror/view"
import { basicSetup } from "codemirror"

/* The MDX source editor - a real code editor (CodeMirror 6): markdown
   highlighting, line numbers, bracket matching, its own undo history,
   search - not a bare textarea. One instance per page (keyed by the
   caller), so `value` only seeds it. */

const joltsTheme = EditorView.theme({
  "&": {
    fontSize: "13px",
    backgroundColor: "#fbfbfc",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.1)",
    minHeight: "60vh",
  },
  "&.cm-focused": {
    outline: "none",
    borderColor: "rgba(0,0,0,0.3)",
  },
  ".cm-scroller": {
    fontFamily:
      "var(--font-geist-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    lineHeight: "1.6",
    borderRadius: "10px",
  },
  ".cm-content": {
    padding: "14px 0",
    caretColor: "#FF902F",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "#c2c7ce",
    paddingLeft: "6px",
  },
  ".cm-activeLine": { backgroundColor: "rgba(0,0,0,0.03)" },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "#5c6470",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(1,166,255,0.18) !important",
  },
  ".cm-cursor": { borderLeftColor: "#FF902F", borderLeftWidth: "2px" },
})

export function SourceEditor({
  value,
  onChange,
}: {
  /** initial document - later external changes are ignored (keyed usage) */
  value: string
  onChange: (text: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const initialValue = useRef(value)

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      doc: initialValue.current,
      parent: hostRef.current,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        joltsTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
      ],
    })
    return () => view.destroy()
  }, [])

  return <div ref={hostRef} className="jolts-source-editor" />
}
