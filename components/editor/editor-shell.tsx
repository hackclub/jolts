"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

const emptySubscribe = () => () => {}

import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  ArrowLeft,
  CloudCheck,
  Code,
  DownloadSimple,
} from "@phosphor-icons/react"
import { Editor, EditorContent } from "@tiptap/react"

import { BlockHandle } from "@/components/editor/block-handle"
import { EditorBubbleMenu } from "@/components/editor/bubble"
import {
  EditorCtxProvider,
  type EditorContextValue,
  type LinkIndex,
  type UploadedImage,
} from "@/components/editor/context"
import { buildExtensions } from "@/components/editor/extensions"
import { ExportDialog } from "@/components/editor/export-dialog"
import { MetaHeader } from "@/components/editor/meta-header"
import { PageRail, type RailPage } from "@/components/editor/page-rail"
import { SourceEditor } from "@/components/editor/source-editor"
import { EditorToolbar } from "@/components/editor/toolbar"
import { GhostInput } from "@/components/editor/views/bits"
import {
  schemaByType,
  slugifyHeading,
  type ContentType,
  type EntryMeta,
} from "@/lib/content-schema"
import { computeChanges, splitRaw, type PageDraftOut } from "@/lib/editor/changes"
import { splitFrontmatter } from "@/lib/editor/frontmatter"
import {
  deleteDraft,
  loadDraft,
  saveDraft,
  type Draft,
  type DraftPage,
} from "@/lib/editor/draft-db"
import { parseMdxDoc, type ParsedDoc } from "@/lib/editor/mdx-parse"
import { serializeMdxDoc } from "@/lib/editor/mdx-serialize"
import type { FileChange } from "@/lib/editor/patch"
import { remapSliceKeys, type BlockSlice, type PMNode } from "@/lib/editor/pm-doc"
import { typeTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

/* The editor. One EditorShell per entry: the left rail switches pages
   (each page is its own Tiptap instance, so undo histories stay per
   page), the frontmatter renders as the editable header card, and the
   only way out is a git patch. Everything autosaves to IndexedDB. */

export type EditorFileIn = { name: string; raw: string }

export type EditorSource = {
  contentType: ContentType
  slug: string
  mode: "edit" | "create"
  files: EditorFileIn[]
  linkIndex: LinkIndex
  existingImages: string[]
  initialPage?: string
  /** create mode: pre-fill the title typed on the start screen */
  initialTitle?: string
}

/* a fresh guide starts with the two blocks every guide needs */
const GUIDE_STARTER: PMNode = {
  type: "doc",
  content: [
    { type: "paragraph" },
    { type: "partsList" },
    { type: "shipIt", content: [{ type: "paragraph" }] },
  ],
}

type PageState = {
  id: string
  fileName: string
  originalName: string | null
  title: string
  isOverview: boolean
  deleted: boolean
  originalRaw: string | null
}

type EditorEntry = {
  mode: "visual" | "source"
  editor?: Editor
  slices?: BlockSlice[]
  baseline?: string
  sourceText?: string
  originalBody?: string
  /** landed in source mode because the original MDX couldn't be parsed */
  autoFallback?: boolean
  /** why the last switch back to visual was refused */
  sourceError?: string
}

function pageTitleOf(raw: string): string {
  const m = raw.match(/^---[\s\S]*?\btitle:\s*("?)(.*?)\1\s*$/m)
  return m ? m[2] : "Untitled"
}

function pageBaseSlug(fileName: string): string {
  const m = fileName.match(/^\d+-(.+)\.mdx$/)
  return m ? m[1] : fileName.replace(/\.mdx$/, "")
}

let nextId = 1
const genId = () => `p${nextId++}`

export function EditorShell(props: EditorSource) {
  const theme = typeTheme[props.contentType]
  const router = useRouter()

  /* ---------- initial state from the files on disk ---------- */

  const initial = useMemo(() => {
    const index = props.files.find((f) => f.name === "index.mdx")
    const meta = index
      ? (schemaByType[props.contentType].parse(
          splitFrontmatterData(index.raw)
        ) as EntryMeta)
      : defaultMeta(props.contentType, props.initialTitle ?? "")
    const pages: PageState[] = props.files.map((f) => ({
      id: genId(),
      fileName: f.name,
      originalName: f.name,
      title: f.name === "index.mdx" ? "Overview" : pageTitleOf(f.raw),
      isOverview: f.name === "index.mdx",
      deleted: false,
      originalRaw: f.raw,
    }))
    if (pages.length === 0) {
      pages.push({
        id: genId(),
        fileName: "index.mdx",
        originalName: null,
        title: "Overview",
        isOverview: true,
        deleted: false,
        originalRaw: null,
      })
    }
    return { meta, pages }
  }, [props.files, props.contentType, props.initialTitle])

  const [meta, setMetaState] = useState<EntryMeta>(initial.meta)
  const [pages, setPages] = useState<PageState[]>(initial.pages)
  const [activeId, setActiveId] = useState<string>(() => {
    const match = props.initialPage
      ? initial.pages.find((p) => p.fileName === props.initialPage)
      : null
    return (match ?? initial.pages[0]).id
  })
  const [uploads, setUploads] = useState<Map<string, UploadedImage>>(new Map())
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [exportOpen, setExportOpen] = useState(false)
  const [exportChanges, setExportChanges] = useState<FileChange[]>([])
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  const [, forceRender] = useState(0)
  const rerender = () => forceRender((n) => n + 1)

  const dirtyIdsRef = useRef(dirtyIds)
  useEffect(() => {
    dirtyIdsRef.current = dirtyIds
  }, [dirtyIds])

  /* latest-value refs for the debounced autosave and export paths, which
     run from timers/handlers and must never see stale closures */
  const metaRef = useRef(meta)
  const uploadsRef = useRef(uploads)
  const pagesRef = useRef(pages)
  useEffect(() => {
    metaRef.current = meta
    uploadsRef.current = uploads
    pagesRef.current = pages
  }, [meta, uploads, pages])

  const editorsRef = useRef(new Map<string, EditorEntry>())

  /* ---------- autosave ---------- */

  const draftKey = `${props.contentType}/${props.slug}`

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* set after buildFileChanges exists - lets the autosave check whether
     anything REALLY changed without a declaration-order tangle */
  const buildChangesRef = useRef<() => FileChange[]>(() => [])

  const saveDraftNow = useCallback(async (): Promise<boolean> => {
    // back at the published state (e.g. after undoing everything)?
    // then there is nothing worth a draft - clear any stale one
    if (props.mode === "edit" && buildChangesRef.current().length === 0) {
      await deleteDraft(draftKey)
      return false
    }
    const draft: Draft = {
      key: draftKey,
      savedAt: Date.now(),
      meta: metaRef.current,
      pages: pagesRef.current.map((p): DraftPage => {
        const entry = editorsRef.current.get(p.id)
        return {
          fileName: p.fileName,
          originalName: p.originalName,
          title: p.title,
          mode: entry?.mode ?? "visual",
          doc:
            entry?.mode === "visual" && entry.editor
              ? (entry.editor.getJSON() as PMNode)
              : null,
          sourceText: entry?.mode === "source" ? (entry.sourceText ?? "") : null,
          deleted: p.deleted,
        }
      }),
      uploads: [...uploadsRef.current.entries()].map(([name, u]) => ({
        name,
        mime: u.mime,
        data: u.data.buffer.slice(0) as ArrayBuffer,
      })),
    }
    await saveDraft(draft)
    return true
  }, [draftKey, props.mode])

  const scheduleAutosave = useCallback(() => {
    setSaveState("saving")
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      const saved = await saveDraftNow()
      setSaveState(saved ? "saved" : "idle")
    }, 900)
  }, [saveDraftNow])

  /* ---------- image resolution + uploads ---------- */

  const resolveImage = useCallback(
    (src: string): string => {
      if (!src.startsWith("./")) return src
      const name = src.slice(2)
      const up = uploads.get(name)
      if (up) return up.url
      return `/content-images/${props.contentType}/${props.slug}/${name}`
    },
    [uploads, props.contentType, props.slug]
  )

  const addUpload = useCallback(
    async (file: File): Promise<string> => {
      const data = new Uint8Array(await file.arrayBuffer())
      const base = file.name
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, "-")
        .replace(/^-+|-+$/g, "")
      let name = base || "photo.jpg"
      const taken = (n: string) =>
        uploadsRef.current.has(n) || props.existingImages.includes(n)
      if (taken(name)) {
        const dot = name.lastIndexOf(".")
        const stem = dot > 0 ? name.slice(0, dot) : name
        const ext = dot > 0 ? name.slice(dot) : ""
        let i = 2
        while (taken(`${stem}-${i}${ext}`)) i++
        name = `${stem}-${i}${ext}`
      }
      const url = URL.createObjectURL(new Blob([data], { type: file.type }))
      setUploads((m) => {
        const next = new Map(m)
        next.set(name, { url, data, mime: file.type })
        return next
      })
      scheduleAutosave()
      return `./${name}`
    },
    [props.existingImages, scheduleAutosave]
  )

  /* ---------- editors ---------- */

  const markDirtyCheck = useCallback((pageId: string) => {
    const entry = editorsRef.current.get(pageId)
    if (!entry) return
    const dirty =
      entry.mode === "source"
        ? (entry.sourceText ?? "") !== (entry.originalBody ?? "")
        : JSON.stringify(entry.editor?.getJSON()) !== entry.baseline
    setDirtyIds((prev) => {
      if (prev.has(pageId) === dirty) return prev
      const next = new Set(prev)
      if (dirty) next.add(pageId)
      else next.delete(pageId)
      return next
    })
  }, [])

  const makeEditor = useCallback(
    (page: PageState, doc?: PMNode | null): EditorEntry => {
      const body = page.originalRaw ? splitRaw(page.originalRaw)[1] : ""
      const normalizedBody = body.replace(/^\n+/, "").replace(/\n+$/, "")
      try {
        // the ORIGINAL body is only needed for diff slices and the dirty
        // baseline - when an explicit doc is provided (draft restore,
        // source-mode toggle), an unparseable original isn't fatal
        let parsed: ParsedDoc | null = null
        try {
          parsed = parseMdxDoc(body)
        } catch (err) {
          if (!doc) throw err
        }
        // extensions (TrailingNode etc.) mutate the doc during creation -
        // those transactions must not count as user edits
        let live = false
        const onContentError = () => {
          // surface it - the catch below flips this page to source mode
          // rather than silently dropping content
          throw new Error("invalid content for the editor schema")
        }
        const starter =
          props.mode === "create" &&
          page.isOverview &&
          page.originalRaw === null &&
          props.contentType === "guides"
            ? GUIDE_STARTER
            : null
        const editor = new Editor({
          extensions: buildExtensions(
            page.isOverview
              ? "Tell the story: what is it, why build it, what will it feel like when it works? Press / for blocks."
              : "Write this stage of the build. Press / for blocks - steps, warnings, photos…"
          ),
          content: (doc ?? starter ?? parsed!.doc) as object,
          enableContentCheck: true,
          onContentError,
          editorProps: {
            attributes: {
              class: "jolts-editor-prose focus:outline-none",
              spellcheck: "true",
            },
          },
          onUpdate: () => {
            if (!live) return
            markDirtyCheck(page.id)
            scheduleAutosave()
          },
        })
        // keys must come from the PM-normalized shape of the ORIGINAL doc
        let slices: BlockSlice[] = []
        let baseline = "«unparseable-original»" // always-dirty sentinel
        if (parsed) {
          const fresh = doc
            ? new Editor({
                extensions: buildExtensions(""),
                content: parsed.doc as object,
                enableContentCheck: true,
                onContentError,
              })
            : editor
          const normalizedOriginal = fresh.getJSON() as PMNode
          slices = remapSliceKeys(parsed.original, normalizedOriginal)
          baseline = JSON.stringify(normalizedOriginal)
          if (doc) fresh.destroy()
        }
        live = true
        return { mode: "visual", editor, slices, baseline }
      } catch {
        return {
          mode: "source",
          sourceText: normalizedBody,
          originalBody: normalizedBody,
          autoFallback: true,
        }
      }
    },
    [markDirtyCheck, scheduleAutosave, props.contentType, props.mode]
  )

  const getEntry = useCallback(
    (page: PageState): EditorEntry => {
      let entry = editorsRef.current.get(page.id)
      // StrictMode's simulated remount destroys cached editors (see the
      // cleanup below) - never hand a dead one to EditorContent
      if (!entry || (entry.mode === "visual" && entry.editor?.isDestroyed)) {
        entry = makeEditor(page)
        editorsRef.current.set(page.id, entry)
      }
      return entry
    },
    [makeEditor]
  )

  /* visual ⇄ source toggle. Visual → source is lossless (the same
     serializer the patch uses). Source → visual only switches when the
     MDX parses AND fits the editor schema - otherwise the page stays in
     source mode with the error shown, so nothing is ever dropped. */
  const switchMode = useCallback(
    (pageId: string) => {
      const page = pagesRef.current.find((p) => p.id === pageId)
      const entry = editorsRef.current.get(pageId)
      if (!page || !entry) return
      if (entry.mode === "visual" && entry.editor) {
        const body = serializeMdxDoc(
          entry.editor.getJSON() as PMNode,
          entry.slices
        )
        const originalBody = page.originalRaw
          ? splitRaw(page.originalRaw)[1].replace(/^\n+/, "").replace(/\n+$/, "")
          : ""
        entry.editor.destroy()
        editorsRef.current.set(pageId, {
          mode: "source",
          sourceText: body.replace(/\n+$/, ""),
          originalBody,
        })
      } else if (entry.mode === "source") {
        let parsed: ParsedDoc
        try {
          parsed = parseMdxDoc(entry.sourceText ?? "")
        } catch (err) {
          entry.sourceError = `This isn't valid MDX yet: ${(err as Error).message}`
          rerender()
          return
        }
        const next = makeEditor(page, parsed.doc)
        if (next.mode !== "visual") {
          entry.sourceError =
            "This MDX is valid but uses something the visual editor can't represent - keep editing it as source."
          rerender()
          return
        }
        editorsRef.current.set(pageId, next)
      }
      markDirtyCheck(pageId)
      scheduleAutosave()
      rerender()
    },
    [makeEditor, markDirtyCheck, scheduleAutosave]
  )

  /* destroy editors on unmount. Under StrictMode the cleanup also runs
     once right after mount, killing any editor created during the first
     render with no re-render to replace it - the rerender() heals that
     by sending the next render through getEntry's isDestroyed check. */
  useEffect(() => {
    // deliberate: syncs React with the editor cache this effect's own
    // cleanup mutates during StrictMode's simulated remount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    rerender()
    const editors = editorsRef.current
    return () => {
      for (const e of editors.values()) e.editor?.destroy()
      editors.clear()
    }
  }, [])

  const restoreDraft = useCallback(
    (draft: Draft) => {
      for (const e of editorsRef.current.values()) e.editor?.destroy()
      editorsRef.current.clear()

      const nextUploads = new Map<string, UploadedImage>()
      for (const u of draft.uploads) {
        const data = new Uint8Array(u.data)
        nextUploads.set(u.name, {
          data,
          mime: u.mime,
          url: URL.createObjectURL(new Blob([data], { type: u.mime })),
        })
      }
      setUploads(nextUploads)
      uploadsRef.current = nextUploads

      const byOriginal = new Map(
        initial.pages.map((p) => [p.originalName, p] as const)
      )
      const nextPages: PageState[] = draft.pages.map((dp) => {
        const orig = dp.originalName ? byOriginal.get(dp.originalName) : null
        const page: PageState = {
          id: genId(),
          fileName: dp.fileName,
          originalName: dp.originalName,
          title: dp.title,
          isOverview: dp.fileName === "index.mdx",
          deleted: dp.deleted,
          originalRaw: orig?.originalRaw ?? null,
        }
        const entry = makeEditor(page, dp.mode === "visual" ? dp.doc : null)
        if (dp.mode === "source" && entry.mode === "source") {
          entry.sourceText = dp.sourceText ?? entry.sourceText
        }
        editorsRef.current.set(page.id, entry)
        return page
      })
      setPages(nextPages)
      setMetaState(draft.meta)
      // keep whatever page is open (?page= deep links land before the
      // async restore resolves) - match it into the restored list
      setActiveId((cur) => {
        const curFile = pagesRef.current.find((p) => p.id === cur)?.fileName
        const match = curFile
          ? nextPages.find((p) => p.fileName === curFile && !p.deleted)
          : null
        return (match ?? nextPages[0]).id
      })
      // recompute dirty dots
      setTimeout(() => nextPages.forEach((p) => markDirtyCheck(p.id)), 0)
    },
    [initial.pages, makeEditor, markDirtyCheck]
  )

  /* ---------- draft auto-restore ----------
     A draft is picked up silently on return - editing simply continues
     where it stopped. The top-bar Reset button is the way back to the
     published version. */

  const didRestore = useRef(false)
  useEffect(() => {
    if (didRestore.current) return
    let alive = true
    loadDraft(draftKey).then((d) => {
      if (!alive || didRestore.current) return
      if (!d || d.pages.length === 0) return
      // never clobber something typed in the first moments after load
      if (dirtyIdsRef.current.size > 0) return
      didRestore.current = true
      restoreDraft(d)
    })
    return () => {
      alive = false
    }
  }, [draftKey, restoreDraft])

  /* ---------- meta ---------- */

  const setMeta = useCallback(
    (updater: (m: EntryMeta) => EntryMeta) => {
      setMetaState((m) => updater(m))
      scheduleAutosave()
    },
    [scheduleAutosave]
  )

  const metaDirty =
    JSON.stringify(meta) !== JSON.stringify(initial.meta) || props.mode === "create"

  /* ---------- page operations ---------- */

  const renumber = useCallback((list: PageState[]): PageState[] => {
    let n = 0
    return list.map((p) => {
      if (p.isOverview || p.deleted) return p
      n++
      const base = p.originalName
        ? pageBaseSlug(p.originalName)
        : slugifyHeading(p.title) || "page"
      const fileName = `${String(n).padStart(2, "0")}-${base}.mdx`
      return fileName === p.fileName ? p : { ...p, fileName }
    })
  }, [])

  const addPage = useCallback(() => {
    const page: PageState = {
      id: genId(),
      fileName: "",
      originalName: null,
      title: "New page",
      isOverview: false,
      deleted: false,
      originalRaw: null,
    }
    setPages((prev) => renumber([...prev, page]))
    setActiveId(page.id)
    scheduleAutosave()
  }, [renumber, scheduleAutosave])

  const renamePage = useCallback(
    (id: string, title: string) => {
      setPages((prev) =>
        renumber(prev.map((p) => (p.id === id ? { ...p, title } : p)))
      )
      scheduleAutosave()
    },
    [renumber, scheduleAutosave]
  )

  const deletePage = useCallback(
    (id: string) => {
      setPages((prev) => {
        const target = prev.find((p) => p.id === id)
        if (!target || target.isOverview) return prev
        const next = target.originalName
          ? prev.map((p) => (p.id === id ? { ...p, deleted: true } : p))
          : prev.filter((p) => p.id !== id)
        return renumber(next)
      })
      setActiveId((cur) => (cur === id ? pagesRef.current[0].id : cur))
      scheduleAutosave()
    },
    [renumber, scheduleAutosave]
  )

  const restorePage = useCallback(
    (id: string) => {
      setPages((prev) =>
        renumber(prev.map((p) => (p.id === id ? { ...p, deleted: false } : p)))
      )
      scheduleAutosave()
    },
    [renumber, scheduleAutosave]
  )

  const movePage = useCallback(
    (id: string, dir: -1 | 1) => {
      setPages((prev) => {
        const i = prev.findIndex((p) => p.id === id)
        const j = i + dir
        if (i < 0 || j < 1 || j >= prev.length) return prev // 0 = overview
        const next = [...prev]
        ;[next[i], next[j]] = [next[j], next[i]]
        return renumber(next)
      })
      scheduleAutosave()
    },
    [renumber, scheduleAutosave]
  )

  /* ---------- export ---------- */

  const buildFileChanges = useCallback((): FileChange[] => {
    const pageOuts: PageDraftOut[] = pagesRef.current.map((p) => {
      // a page whose editor never existed was never opened - untouched,
      // except brand-new pages, which need their (empty) body serialized
      const entry = p.deleted
        ? undefined
        : (editorsRef.current.get(p.id) ??
          (p.originalRaw === null ? getEntry(p) : undefined))
      let newBody: string | null = null
      if (entry && !p.deleted) {
        if (entry.mode === "source") {
          const text = (entry.sourceText ?? "").replace(/\n+$/, "") + "\n"
          newBody =
            (entry.sourceText ?? "") !== (entry.originalBody ?? "") ? text : null
        } else if (entry.editor) {
          const json = JSON.stringify(entry.editor.getJSON())
          if (json !== entry.baseline || p.originalRaw === null) {
            newBody = serializeMdxDoc(
              entry.editor.getJSON() as PMNode,
              entry.slices
            )
          }
        }
      }
      return {
        fileName: p.fileName,
        originalName: p.originalName,
        title: p.title,
        deleted: p.deleted,
        newBody,
        originalRaw: p.originalRaw,
      }
    })

    const base = {
      contentType: props.contentType,
      slug: props.slug,
      meta: metaRef.current,
      originalMeta: props.mode === "create" ? null : initial.meta,
      pages: pageOuts,
      uploads: [...uploadsRef.current.entries()].map(([name, u]) => ({
        name,
        data: u.data,
      })),
    }
    // first pass without the `updated` stamp: did anything really change?
    const dry = computeChanges({ ...base, bumpUpdated: false })
    if (dry.length === 0) return dry
    return computeChanges({ ...base, bumpUpdated: props.mode === "edit" })
  }, [getEntry, initial.meta, props.contentType, props.mode, props.slug])

  useEffect(() => {
    buildChangesRef.current = buildFileChanges
  }, [buildFileChanges])

  const openExport = useCallback(() => {
    setExportChanges(buildFileChanges())
    setExportOpen(true)
  }, [buildFileChanges])

  /* ---------- render ---------- */

  // Tiptap instances need the DOM - skip them during SSR/hydration pass
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  /* switching pages lands at the top, like the reader */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [activeId])

  /* deep links: /edit/guides/x?page=03-usb-c.mdx opens that page */
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("page")
    if (!wanted) return
    const match = pagesRef.current.find(
      (p) => p.fileName === wanted || p.originalName === wanted
    )
    if (match) setActiveId(match.id)
  }, [])

  const activePage = pages.find((p) => p.id === activeId) ?? pages[0]
  // lazy initialization of the per-page Tiptap instance - the sanctioned
  // exception to "no refs during render" (react.dev/reference/react/useRef)
  // eslint-disable-next-line react-hooks/refs
  const activeEntry = mounted ? getEntry(activePage) : null

  /* dev-only hook for end-to-end tests */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    ;(window as unknown as Record<string, unknown>).__jolts = {
      editor: activeEntry?.editor,
      buildFileChanges,
      setMeta,
      addPage,
      renamePage,
      deletePage,
      movePage,
      pages: pagesRef.current,
      validateAll: () =>
        pagesRef.current.map((p) => ({
          file: p.fileName,
          mode: getEntry(p).mode,
        })),
    }
  })

  const ctxValue: EditorContextValue = useMemo(
    () => ({
      contentType: props.contentType,
      slug: props.slug,
      linkIndex: props.linkIndex,
      meta,
      setMeta,
      existingImages: props.existingImages,
      uploads,
      addUpload,
      resolveImage,
    }),
    [props.contentType, props.slug, props.linkIndex, meta, setMeta, props.existingImages, uploads, addUpload, resolveImage]
  )

  const railPages: RailPage[] = pages.map((p) => ({
    id: p.id,
    title: p.isOverview ? "Overview" : p.title,
    isOverview: p.isOverview,
    dirty: dirtyIds.has(p.id) || (p.isOverview && metaDirty),
    deleted: p.deleted,
  }))

  const anythingDirty =
    dirtyIds.size > 0 ||
    metaDirty ||
    uploads.size > 0 ||
    pages.some((p) => p.deleted || p.originalName !== p.fileName)

  const viewHref =
    props.mode === "edit"
      ? `/${props.contentType}/${props.slug}${
          activePage.isOverview ? "" : `/${pageBaseSlug(activePage.fileName)}`
        }`
      : `/${props.contentType}`

  return (
    <EditorCtxProvider value={ctxValue}>
      {/* ---------- top bar ---------- */}
      {/* z-30: below the site header (z-40) so its dropdowns paint over
          the toolbar; the export dialog stays above everything at z-50 */}
      <div className="sticky top-0 z-30 border-b border-black/[0.07] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-[46px] w-full max-w-[1020px] items-center gap-[14px] px-[28px]">
          <Link
            href={viewHref}
            onClick={(e) => {
              if (anythingDirty) {
                e.preventDefault()
                setLeaveTo(viewHref)
              }
            }}
            className="flex items-center gap-[6px] text-[13px] font-medium text-[#5c6470] transition-colors hover:text-[#16181d]"
          >
            <ArrowLeft size={14} weight="bold" aria-hidden />
            <span className="hidden sm:inline">Exit edit mode</span>
          </Link>
          {/* Wikipedia-VisualEditor-style formatting toolbar, bound to the
              active page's editor */}
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
            {activeEntry?.mode === "visual" && activeEntry.editor ? (
              <EditorToolbar key={activePage.id} editor={activeEntry.editor} />
            ) : (
              <span className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#16181d]">
                {meta.title || "Untitled"}
              </span>
            )}
          </div>
          <span
            className={cn(
              "hidden items-center gap-[5px] text-[12px] text-[#9aa1ab] transition-opacity lg:flex",
              saveState === "idle" && "opacity-0"
            )}
          >
            <CloudCheck size={14} weight={saveState === "saved" ? "fill" : "regular"} aria-hidden />
            {saveState === "saved" ? "Draft saved" : "Saving…"}
          </span>
          {activeEntry && (
            <button
              type="button"
              title={
                activeEntry.mode === "visual"
                  ? "Edit this page's MDX source"
                  : "Back to visual editing"
              }
              onClick={() => switchMode(activePage.id)}
              className={cn(
                "rounded-[7px] p-[6px] transition-colors hover:bg-black/[0.05] hover:text-[#16181d]",
                activeEntry.mode === "source"
                  ? "bg-black/[0.06] text-[#16181d]"
                  : "text-[#5c6470]"
              )}
            >
              <Code size={15} weight="bold" />
            </button>
          )}
          <button
            type="button"
            onClick={openExport}
            disabled={!anythingDirty}
            className={cn(
              "flex items-center gap-[7px] rounded-[9px] px-[13px] py-[6px] text-[13.5px] font-semibold tracking-[-0.01em] text-white transition-all",
              anythingDirty ? "hover:brightness-105" : "cursor-not-allowed opacity-40"
            )}
            style={{ background: theme.accent }}
          >
            <DownloadSimple size={15} weight="bold" aria-hidden />
            Export patch
          </button>
        </div>
      </div>

      {/* ---------- leaving with changes: keep or discard the draft ---------- */}
      {leaveTo && (
        <ChoiceDialog
          title="Keep working on this later?"
          body="Your edits live as a draft in this browser - come back any time and they'll be right here."
          confirmLabel="Keep my draft"
          confirmClass="bg-[#16181d] hover:bg-black"
          altLabel="Discard changes"
          onConfirm={async () => {
            await saveDraftNow()
            router.push(leaveTo)
          }}
          onAlt={async () => {
            await deleteDraft(draftKey)
            router.push(leaveTo)
          }}
          onCancel={() => setLeaveTo(null)}
        />
      )}

      {/* ---------- the guide layout, editable ---------- */}
      <div className="mx-auto grid w-full max-w-[1020px] gap-x-[52px] gap-y-[28px] px-[28px] pt-[28px] lg:grid-cols-[190px_minmax(0,1fr)]">
        <PageRail
          contentType={props.contentType}
          entryTitle={meta.title}
          pages={railPages}
          activeId={activeId}
          onSelect={setActiveId}
          onAdd={addPage}
          onRename={renamePage}
          onDelete={deletePage}
          onRestore={restorePage}
          onMove={movePage}
        />

        <div className="min-w-0 max-w-[720px] pb-[80px]">
          {activePage.isOverview ? (
            <MetaHeader />
          ) : (
            <header className="mb-[6px]">
              <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-[#16181d]">
                <GhostInput
                  value={activePage.title}
                  onChange={(v) => renamePage(activePage.id, v)}
                  placeholder="Name this stage"
                />
              </h1>
              <p className="mt-[3px] font-mono text-[11px] text-black/25">
                content/{props.contentType}/{props.slug}/{activePage.fileName}
              </p>
            </header>
          )}

          <div
            className="jolts-guide jolts-editor-article relative pt-[6px]"
            style={
              {
                "--guide-accent": theme.accent,
                "--guide-checker-a": theme.checkerA,
                "--guide-checker-b": theme.checkerB,
              } as React.CSSProperties
            }
          >
            {activeEntry === null ? (
              <div className="pt-[20px]">
                <div className="h-[18px] w-[70%] animate-pulse rounded bg-black/[0.05]" />
                <div className="mt-[10px] h-[18px] w-[92%] animate-pulse rounded bg-black/[0.05]" />
                <div className="mt-[10px] h-[18px] w-[84%] animate-pulse rounded bg-black/[0.05]" />
              </div>
            ) : activeEntry.mode === "source" ? (
              <div>
                {activeEntry.sourceError ? (
                  <p className="mb-[8px] rounded-[9px] border border-[#d43c3c]/30 bg-[#fdecec] px-[12px] py-[8px] text-[13px] leading-[1.5] text-[#a32b2b]">
                    {activeEntry.sourceError}
                  </p>
                ) : activeEntry.autoFallback ? (
                  <p className="mb-[8px] rounded-[9px] border border-[#FF902F]/30 bg-[#FFF4E6] px-[12px] py-[8px] text-[13px] leading-[1.5] text-[#9a5a1d]">
                    This page uses MDX the visual editor doesn&rsquo;t
                    understand yet, so you&rsquo;re editing the source
                    directly - nothing will be lost.
                  </p>
                ) : null}
                <SourceEditor
                  key={activePage.id}
                  value={activeEntry.sourceText ?? ""}
                  onChange={(text) => {
                    const entry = editorsRef.current.get(activePage.id)
                    if (entry) {
                      entry.sourceText = text
                      if (entry.sourceError) {
                        entry.sourceError = undefined
                        rerender()
                      }
                    }
                    markDirtyCheck(activePage.id)
                    scheduleAutosave()
                  }}
                />
              </div>
            ) : (
              activeEntry.editor && (
                <>
                  <EditorBubbleMenu
                    key={activePage.id}
                    editor={activeEntry.editor}
                  />
                  <BlockHandle
                    key={`handle-${activePage.id}`}
                    editor={activeEntry.editor}
                  />
                  {/* click-to-type strip: adding a line ABOVE the first
                      block is otherwise fiddly */}
                  <div
                    aria-hidden
                    className="h-[18px] cursor-text"
                    onClick={() => {
                      const editor = activeEntry.editor!
                      const first = editor.state.doc.firstChild
                      if (
                        first?.type.name === "paragraph" &&
                        first.childCount === 0
                      ) {
                        editor.commands.focus("start")
                      } else {
                        editor
                          .chain()
                          .insertContentAt(0, { type: "paragraph" })
                          .focus(1)
                          .run()
                      }
                    }}
                  />
                  <EditorContent editor={activeEntry.editor} />
                </>
              )
            )}
          </div>
        </div>
      </div>

      {exportOpen && (
        <ExportDialog
          onClose={() => setExportOpen(false)}
          changes={exportChanges}
          defaultSubject={
            props.mode === "create"
              ? `Add ${meta.title || props.slug} ${theme.label.toLowerCase()}`
              : `Update ${meta.title || props.slug}`
          }
          slug={props.slug}
        />
      )}
    </EditorCtxProvider>
  )
}

/* ---------- helpers ---------- */

function splitFrontmatterData(raw: string): Record<string, unknown> {
  return splitFrontmatter(raw).data
}

/* a small three-way modal: confirm / optional alternative / cancel */
function ChoiceDialog({
  title,
  body,
  confirmLabel,
  confirmClass,
  altLabel,
  onConfirm,
  onAlt,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  confirmClass: string
  altLabel?: string
  onConfirm: () => void
  onAlt?: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-[20px] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-[400px] rounded-[14px] bg-white p-[20px] shadow-[0px_24px_60px_-12px_rgba(0,0,0,0.4)]">
        <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-[#16181d]">
          {title}
        </h2>
        <p className="mt-[6px] text-[13.5px] leading-[1.55] text-[#5c6470]">
          {body}
        </p>
        <div className="mt-[16px] flex flex-col gap-[7px]">
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "rounded-[9px] py-[8px] text-[14px] font-semibold text-white transition-all",
              confirmClass
            )}
          >
            {confirmLabel}
          </button>
          {altLabel && onAlt && (
            <button
              type="button"
              onClick={onAlt}
              className="rounded-[9px] border border-black/10 py-[8px] text-[14px] font-semibold text-[#d43c3c] transition-colors hover:border-[#d43c3c]/40 hover:bg-[#fdecec]"
            >
              {altLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[9px] py-[7px] text-[13.5px] font-medium text-[#9aa1ab] transition-colors hover:bg-black/[0.04] hover:text-[#16181d]"
          >
            Stay here
          </button>
        </div>
      </div>
    </div>
  )
}

function defaultMeta(contentType: ContentType, title = ""): EntryMeta {
  const base = {
    title,
    subtitle: "",
    contributors: [] as string[],
    aliases: [] as string[],
    tags: [] as string[],
    draft: false,
  }
  if (contentType === "guides") {
    return {
      ...base,
      type: "guide",
      difficulty: "beginner",
      time: "",
      cost: "",
      soldering: false,
      learns: [],
      parts: [{ name: "", qty: 1 }],
      tools: [],
    } as EntryMeta
  }
  if (contentType === "tools") return { ...base, type: "tool" } as EntryMeta
  return { ...base, type: "concept" } as EntryMeta
}
