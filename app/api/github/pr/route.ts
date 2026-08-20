import crypto from "node:crypto"

import { NextResponse } from "next/server"

import { CONTENT_TYPES, type ContentType } from "@/lib/content-schema"
import {
  NothingToCommitError,
  branchPrefix,
  getViewer,
  openPullRequest,
  updatePullRequest,
} from "@/lib/github/api"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"
import type { ForkInfo, WireChange } from "@/lib/github/types"

/* The save itself: tree → commit → branch → pull request, in one request.
   Photos are already blobs in the fork by the time we get here, so the body
   is just MDX text and SHAs.

   Everything the client sends is treated as a request, not a fact: the fork
   must belong to whoever the token says they are, SHAs must look like SHAs,
   and every path must live under content/<type>/<slug>/. A contributor
   can't be talked into opening a pull request that touches CI. */

export const dynamic = "force-dynamic"
export const maxDuration = 30

const SHA = /^[0-9a-f]{40}$/
const SLUG = /^[a-z0-9][a-z0-9-]*$/
const REPO_NAME = /^[A-Za-z0-9._-]+$/
const BRANCH_NAME = /^[A-Za-z0-9._-]+$/

type Body = {
  contentType?: string
  slug?: string
  title?: string
  description?: string
  fork?: Partial<ForkInfo>
  changes?: WireChange[]
  /** revise this open pull request instead of opening another one */
  updates?: number
}

export async function POST(req: Request) {
  const token = await readToken()
  const missing = requireToken(token)
  if (missing) return missing

  const input = await req
    .json()
    .then((v) => v as Body)
    .catch(() => null)
  if (!input || typeof input !== "object") {
    return bad("That save request didn't arrive intact - try again.")
  }

  const { contentType, slug } = input
  if (!contentType || !CONTENT_TYPES.includes(contentType as ContentType)) {
    return bad("Unknown content type.")
  }
  if (!slug || !SLUG.test(slug)) return bad("That slug isn't usable as a folder name.")

  const title = (input.title ?? "").replace(/[\r\n]+/g, " ").trim()
  if (!title) return bad("Give your change a title first.")

  const changes = input.changes
  if (!Array.isArray(changes) || changes.length === 0) {
    return bad("Nothing has changed yet.")
  }

  // every write stays inside this entry's folder
  const prefix = `content/${contentType}/${slug}/`
  for (const c of changes) {
    if (typeof c?.path !== "string" || !c.path.startsWith(prefix) || c.path.includes("..")) {
      return bad("That change touches a file outside this entry.")
    }
    if (c.kind === "put-blob" && !SHA.test(c.sha)) return bad("Bad image reference.")
    if (c.kind === "put" && typeof c.text !== "string") return bad("Bad file contents.")
    if (c.kind !== "put" && c.kind !== "put-blob" && c.kind !== "del") {
      return bad("Unknown change type.")
    }
  }

  const f = input.fork
  if (
    !f?.owner ||
    !f.repo ||
    !f.baseBranch ||
    !REPO_NAME.test(f.repo) ||
    !BRANCH_NAME.test(f.baseBranch) ||
    !SHA.test(f.baseSha ?? "") ||
    !SHA.test(f.baseTreeSha ?? "")
  ) {
    return bad("Missing fork details - reload the editor and save again.")
  }

  try {
    // the fork has to be the caller's own, whatever the client claimed
    const user = await getViewer(token!)
    if (f.owner.toLowerCase() !== user.login.toLowerCase()) {
      return bad("That fork isn't yours.")
    }

    const fork = {
      owner: user.login,
      repo: f.repo,
      baseBranch: f.baseBranch,
      baseSha: f.baseSha!,
      baseTreeSha: f.baseTreeSha!,
      created: false,
    }
    const body = prBody(input.description, contentType, slug)

    const revising = Number(input.updates)
    const result =
      Number.isInteger(revising) && revising > 0
        ? await updatePullRequest(token!, {
            fork,
            number: revising,
            title,
            body,
            changes,
          })
        : await openPullRequest(token!, {
            fork,
            branch: `${branchPrefix(slug)}${crypto.randomBytes(3).toString("hex")}`,
            title,
            body,
            changes,
          })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof NothingToCommitError) {
      return NextResponse.json(
        {
          error:
            "This is already what's on main - your work must have been merged. Reload the editor to start from the published version.",
        },
        { status: 409 }
      )
    }
    return failure(err)
  }
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

function prBody(description: string | undefined, contentType: string, slug: string): string {
  const preview = `https://jolts.hackclub.com/${contentType}/${slug}`
  const credit =
    `Written with the [jolts visual editor](${preview}). Text and images are ` +
    `contributed under CC BY-SA 4.0, code under MIT.`
  const note = description?.trim()
  return note ? `${note}\n\n${credit}` : credit
}
