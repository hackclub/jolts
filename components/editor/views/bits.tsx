"use client"

import { useEffect, useRef, useState } from "react"

import type { NodeViewProps } from "@tiptap/react"
import { NodeViewWrapper } from "@tiptap/react"

import { cn } from "@/lib/utils"

/* Small shared pieces for block node views. Block chrome (drag, insert,
   delete) is global - the Notion-style BlockHandle follows the pointer
   and serves EVERY block - so the shell is just the wrapper. */

export function BlockShell({
  props,
  children,
  className,
  label,
}: {
  props: NodeViewProps
  children: React.ReactNode
  className?: string
  /** kind label, surfaced to assistive tech */
  label?: string
}) {
  return (
    <NodeViewWrapper
      className={cn("group/block relative", className)}
      data-selected={props.selected || undefined}
      aria-label={label}
    >
      {children}
    </NodeViewWrapper>
  )
}

/* borderless input that inherits the surrounding typography */
export function GhostInput({
  value,
  onChange,
  placeholder,
  className,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      className={cn(
        "w-full min-w-0 border-none bg-transparent p-0 font-[inherit] text-[inherit] tracking-[inherit] text-[inherit] outline-none placeholder:text-black/30",
        className
      )}
      {...rest}
    />
  )
}

/* textarea that grows with its content, same ghost treatment */
export function GhostTextarea({
  value,
  onChange,
  placeholder,
  className,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = el.scrollHeight + "px"
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      spellCheck={false}
      className={cn(
        "block w-full resize-none border-none bg-transparent p-0 font-[inherit] text-[inherit] tracking-[inherit] text-[inherit] outline-none placeholder:text-black/30",
        className
      )}
      {...rest}
    />
  )
}

/* auto-width input for text that sits inline (flag labels, chips) */
export function InlineSizedInput({
  value,
  onChange,
  placeholder,
  className,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <span className={cn("relative inline-grid", className)}>
      {/* the sizer: same font, same content, invisible */}
      <span className="invisible col-start-1 row-start-1 whitespace-pre">
        {value || placeholder || " "}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        size={1}
        spellCheck={false}
        className="col-start-1 row-start-1 w-full border-none bg-transparent p-0 font-[inherit] text-[inherit] tracking-[inherit] text-[inherit] outline-none placeholder:text-white/60"
        {...rest}
      />
    </span>
  )
}

/* an image slot: shows the picture with hover controls, or an upload
   dropzone when empty */
export function ImageSlot({
  src,
  resolved,
  alt,
  onPick,
  onRemove,
  className,
  imgClassName,
  emptyLabel = "Add a photo",
}: {
  /** the stored reference ("./x.jpg" or URL), null when empty */
  src: string | null
  /** what the <img> can actually display */
  resolved: string | null
  alt?: string
  onPick: (file: File) => void
  onRemove?: () => void
  className?: string
  imgClassName?: string
  emptyLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const pick = () => inputRef.current?.click()

  return (
    <div
      className={cn("group/img relative", className)}
      contentEditable={false}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file && file.type.startsWith("image/")) onPick(file)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          e.target.value = ""
        }}
      />
      {src && resolved ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolved} alt={alt ?? ""} className={imgClassName} />
          <div className="absolute right-[8px] bottom-[8px] flex gap-[5px] opacity-0 transition-opacity duration-100 group-hover/img:opacity-100">
            <button
              type="button"
              onClick={pick}
              className="rounded-[7px] bg-black/70 px-[9px] py-[4px] text-[12px] font-semibold text-white backdrop-blur-sm hover:bg-black/85"
            >
              Replace
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-[7px] bg-black/70 px-[9px] py-[4px] text-[12px] font-semibold text-white backdrop-blur-sm hover:bg-[#d43c3c]"
              >
                Remove
              </button>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={pick}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-[6px] rounded-[8px] border border-dashed py-[26px] text-[13px] font-medium transition-colors",
            dragOver
              ? "border-[var(--guide-accent)] bg-[rgba(255,144,47,0.06)] text-[var(--guide-accent)]"
              : "border-black/15 text-[#9aa1ab] hover:border-black/30 hover:text-[#5c6470]"
          )}
        >
          <span aria-hidden className="text-[20px] leading-none">
            📷
          </span>
          {dragOver ? "Drop it!" : emptyLabel}
        </button>
      )}
    </div>
  )
}
