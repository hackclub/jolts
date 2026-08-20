import { SaveError } from "@/lib/github/client"
import type { PrDetail, PrSummary } from "@/lib/github/review"
import type { GhUser } from "@/lib/github/types"

/* Browser side of the review pages. Same contract as the editor's save client:
   the token stays in an httpOnly cookie, every failure arrives as a message the
   page can show, and `reconnect` means the fix is another trip through GitHub. */

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

export type CuratorState =
  | { status: "curator"; user: GhUser; permission: string }
  | { status: "signed-out" }
  | { status: "denied"; message: string }

/** Who is here, and may they curate? Distinguishes "not signed in" from
    "signed in but no write access", because the fix differs. */
export async function checkCurator(): Promise<CuratorState> {
  const res = await fetch("/api/review/curator", { credentials: "same-origin" })
  if (res.status === 401) return { status: "signed-out" }
  const data = (await res.json().catch(() => null)) as {
    curator?: boolean
    user?: GhUser
    permission?: string
    error?: string
  } | null
  if (res.ok && data?.curator && data.user) {
    return { status: "curator", user: data.user, permission: data.permission ?? "write" }
  }
  return {
    status: "denied",
    message: data?.error ?? "You don't have review access to this repository.",
  }
}

export const fetchQueue = () =>
  api<{ prs: PrSummary[]; user: GhUser }>("/api/review/prs")

export const fetchPr = (number: number) =>
  api<{ detail: PrDetail; user: GhUser }>(`/api/review/pr/${number}`)

export const postVerdict = (
  number: number,
  verdict: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  body: string
) =>
  api<{ id: number; state: string }>(`/api/review/pr/${number}/verdict`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ verdict, body }),
  })

export const postMerge = (number: number, title: string, message: string) =>
  api<{ sha: string; merged: boolean }>(`/api/review/pr/${number}/merge`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, message }),
  })
