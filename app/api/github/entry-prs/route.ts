import { NextResponse } from "next/server"

import { CONTENT_TYPES, type ContentType } from "@/lib/content-schema"
import { getViewer, listEntryPrs } from "@/lib/github/api"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"

/* "What's already happening to this entry?" - answered in one call, for every
   state at once: the contributor's own open pull request (which a second save
   should revise rather than rival), one that already merged (so a stale draft
   can say so), and anyone else's open work on the same page.

   GitHub is the source of truth here, not the local draft. That is what makes
   the flow survive switching browsers, clearing storage, or two people editing
   the same guide. */

export const dynamic = "force-dynamic"

const SLUG = /^[a-z0-9][a-z0-9-]*$/

export async function GET(req: Request) {
  const token = await readToken()
  const missing = requireToken(token)
  if (missing) return missing

  const url = new URL(req.url)
  const contentType = url.searchParams.get("type") ?? ""
  const slug = url.searchParams.get("slug") ?? ""
  if (!CONTENT_TYPES.includes(contentType as ContentType) || !SLUG.test(slug)) {
    return NextResponse.json({ error: "Unknown entry." }, { status: 400 })
  }

  try {
    const user = await getViewer(token!)
    return NextResponse.json({ prs: await listEntryPrs(token!, user.login, slug), user })
  } catch (err) {
    return failure(err)
  }
}
