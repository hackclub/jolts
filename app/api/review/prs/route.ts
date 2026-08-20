import { NextResponse } from "next/server"

import { listOpenPrs, requireCurator } from "@/lib/github/review"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"

/* The review queue. Curator-gated before anything is read, because on a
   private repo the PR list is itself privileged information. */

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET() {
  const token = await readToken()
  const missing = requireToken(token)
  if (missing) return missing
  try {
    const curator = await requireCurator(token!)
    return NextResponse.json({ prs: await listOpenPrs(token!), user: curator.user })
  } catch (err) {
    return failure(err)
  }
}
