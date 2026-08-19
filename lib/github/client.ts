import type { FileChange } from "@/lib/editor/changes"
import { HINT_COOKIE } from "@/lib/github/config"
import type {
  ForkInfo,
  GhUser,
  PullRequestResult,
  WireChange,
} from "@/lib/github/types"

/* Browser half of the save flow. The token never comes near this file -
   it lives in an httpOnly cookie and only the API routes can read it. What
   we keep here is the choreography: connect, fork, upload photos, commit,
   open the pull request. */

/** Thrown for anything the dialog should show the contributor. `reconnect`
    means the fix is another trip through GitHub's consent screen. */
export class SaveError extends Error {
  constructor(
    message: string,
    readonly reconnect = false
  ) {
    super(message)
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { ...init, credentials: "same-origin" })
  } catch {
    throw new SaveError("Couldn't reach jolts. Check your connection and try again.")
  }
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string; reconnect?: boolean })
    | null
  if (!res.ok || data?.error) {
    throw new SaveError(
      data?.error ?? `Something went wrong (${res.status}).`,
      Boolean(data?.reconnect) || res.status === 401
    )
  }
  return data as T
}

/* ---------- who ---------- */

/** Optimistic identity from the readable hint cookie, for first paint. */
export function cachedUser(): GhUser | null {
  if (typeof document === "undefined") return null
  const raw = document.cookie.match(
    new RegExp(`(?:^|; )${HINT_COOKIE}=([^;]*)`)
  )?.[1]
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as GhUser
    return parsed.login ? parsed : null
  } catch {
    return null
  }
}

export async function fetchSession(): Promise<GhUser | null> {
  const res = await fetch("/api/github/session", { credentials: "same-origin" })
  const data = (await res.json().catch(() => null)) as {
    user?: GhUser | null
  } | null
  return data?.user ?? null
}

export async function signOut(): Promise<void> {
  await fetch("/api/github/session", {
    method: "DELETE",
    credentials: "same-origin",
  })
}

/** Open GitHub's consent screen in a popup; resolves once this browser
    actually holds a session. The postMessage from the callback page is the
    fast path; the cookie is the truth, so a torn-down popup is re-checked
    against the server before we call it a failure. */
export function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      "/api/github/start",
      "jolts-github",
      "width=620,height=760,menubar=no,toolbar=no"
    )
    if (!popup) {
      reject(new SaveError("Your browser blocked the GitHub window - allow popups for jolts."))
      return
    }

    let settled = false
    const finish = (err?: SaveError) => {
      if (settled) return
      settled = true
      window.removeEventListener("message", onMessage)
      clearInterval(watch)
      if (err) reject(err)
      else resolve()
    }

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const msg = e.data as { source?: string; login?: string; error?: string }
      if (msg?.source !== "jolts-github") return
      finish(msg.error ? new SaveError(msg.error) : undefined)
    }
    window.addEventListener("message", onMessage)

    // No network traffic while the popup is alive - we only start asking the
    // server once the window is gone, then give the cookie a few beats to
    // show up (some browsers tear the popup down before its message lands).
    let checks = 0
    let checking = false
    const watch = setInterval(async () => {
      if (settled || !popup.closed || checking) return
      checking = true
      try {
        if (await fetchSession()) finish()
        else if (++checks >= 3) {
          finish(new SaveError("Sign-in window closed before GitHub finished."))
        }
      } finally {
        checking = false
      }
    }, 900)
  })
}

/* ---------- the save ---------- */

export async function ensureFork(): Promise<{ fork: ForkInfo; user: GhUser }> {
  return api<{ fork: ForkInfo; user: GhUser }>("/api/github/fork", { method: "POST" })
}

export async function uploadImage(
  fork: ForkInfo,
  data: Uint8Array
): Promise<string> {
  const { sha } = await api<{ sha: string }>("/api/github/blob", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-jolts-repo": `${fork.owner}/${fork.repo}`,
    },
    // a Blob so the request body owns its own copy of the bytes
    body: new Blob([new Uint8Array(data)]),
  })
  return sha
}

export async function createPullRequest(input: {
  contentType: string
  slug: string
  title: string
  description: string
  fork: ForkInfo
  changes: WireChange[]
}): Promise<PullRequestResult> {
  return api<PullRequestResult>("/api/github/pr", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
}

/* ---------- FileChange → wire ---------- */

/** Split the editor's change set into text/deletions (which travel inside
    the save request) and photos (uploaded first, one request each). A rename
    becomes a delete plus a write - git works out the rest.

    Deletions are emitted before writes, and a deletion is dropped entirely
    when something else writes the same path. GitHub applies tree entries in
    order, so reordering two pages - which renames 02-a→03-a while
    03-b→02-b - must not let one page's delete land on top of another's
    freshly written file. */
export function splitChanges(changes: FileChange[]): {
  wire: WireChange[]
  images: { path: string; data: Uint8Array }[]
} {
  const deletions: string[] = []
  const writes: WireChange[] = []
  const images: { path: string; data: Uint8Array }[] = []

  for (const c of changes) {
    switch (c.kind) {
      case "add":
      case "modify":
        writes.push({ kind: "put", path: c.path, text: c.after })
        break
      case "rename":
        deletions.push(c.fromPath)
        writes.push({ kind: "put", path: c.path, text: c.after })
        break
      case "delete":
        deletions.push(c.path)
        break
      case "add-binary":
        images.push({ path: c.path, data: c.data })
        break
    }
  }

  const written = new Set([...writes.map((w) => w.path), ...images.map((i) => i.path)])
  const wire: WireChange[] = deletions
    .filter((path) => !written.has(path))
    .map((path) => ({ kind: "del", path }))
  wire.push(...writes)
  return { wire, images }
}
