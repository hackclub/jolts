import type { EntryMeta } from "@/lib/content-schema"
import type { PMNode } from "@/lib/editor/pm-doc"
import type { PullRequestResult } from "@/lib/github/types"

/* Crash-proof drafts: everything the editor holds (including uploaded
   photo bytes) autosaves into IndexedDB, keyed by entry. Close the tab
   mid-edit, come back tomorrow, pick up where you left off. */

export type DraftPage = {
  fileName: string
  originalName: string | null
  title: string
  mode: "visual" | "source"
  doc: PMNode | null
  sourceText: string | null
  deleted: boolean
}

export type Draft = {
  key: string
  savedAt: number
  meta: EntryMeta
  pages: DraftPage[]
  uploads: { name: string; mime: string; data: ArrayBuffer }[]
  /** the pull request this draft has already been saved into, if any -
      so "PR #123" survives a reload while the branch waits for review */
  pullRequest?: PullRequestResult
}

const DB_NAME = "jolts-editor"
const STORE = "drafts"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "key" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** every locally saved draft, newest first - powers "pick up where you
    left off" on the create screen (a NEW entry's draft has no page of its
    own anywhere else) */
export async function listDrafts(): Promise<Draft[]> {
  try {
    const all = (await withStore("readonly", (s) => s.getAll())) as Draft[]
    return all.sort((a, b) => b.savedAt - a.savedAt)
  } catch {
    return []
  }
}

export async function loadDraft(key: string): Promise<Draft | null> {
  try {
    return ((await withStore("readonly", (s) => s.get(key))) as Draft) ?? null
  } catch {
    return null
  }
}

export async function saveDraft(draft: Draft): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.put(draft))
  } catch {
    // storage full or blocked - editing still works, just without the net
  }
}

export async function deleteDraft(key: string): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.delete(key))
  } catch {
    /* ignore */
  }
}
