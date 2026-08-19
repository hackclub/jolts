"use client"

import { createContext, useContext } from "react"

import type { ContentType, EntryMeta } from "@/lib/content-schema"

/* Shared plumbing every node view needs: how to resolve "./photo.jpg"
   (existing folder image vs a fresh in-memory upload), the cross-link
   index for ConceptLink/Tool chips, and the live frontmatter draft (the
   PartsList block renders straight from it). Provided by EditorShell,
   consumed from inside Tiptap node views - they render in the same React
   tree, so context flows through. */

export type LinkIndexEntry = {
  slug: string
  title: string
  excerpt: string
  cost?: string
}

export type LinkIndex = {
  concepts: LinkIndexEntry[]
  tools: LinkIndexEntry[]
}

export type UploadedImage = {
  /** object URL for previews */
  url: string
  data: Uint8Array
  mime: string
}

export type EditorContextValue = {
  contentType: ContentType
  slug: string
  linkIndex: LinkIndex
  /** live frontmatter draft (index page) */
  meta: EntryMeta
  setMeta: (updater: (meta: EntryMeta) => EntryMeta) => void
  /** filenames already in the guide folder on disk */
  existingImages: string[]
  uploads: Map<string, UploadedImage>
  /** register a new upload; returns the "./name" reference to store */
  addUpload: (file: File) => Promise<string>
  /** "./x.jpg" or URL → something an <img> can show right now */
  resolveImage: (src: string) => string
}

const Ctx = createContext<EditorContextValue | null>(null)

export const EditorCtxProvider = Ctx.Provider

export function useEditorCtx(): EditorContextValue {
  const value = useContext(Ctx)
  if (!value) throw new Error("useEditorCtx outside EditorCtxProvider")
  return value
}
