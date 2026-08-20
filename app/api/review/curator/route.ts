import { NextResponse } from "next/server"

import { requireCurator } from "@/lib/github/review"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"

/* Is whoever is signed in allowed to curate? The answer comes from GitHub's
   own permissions on the content repo, never a list we keep - so granting or
   revoking write access takes effect here on the next page load. */

export const dynamic = "force-dynamic"

export async function GET() {
  const token = await readToken()
  const missing = requireToken(token)
  if (missing) return missing
  try {
    const curator = await requireCurator(token!)
    return NextResponse.json({ curator: true, ...curator })
  } catch (err) {
    return failure(err)
  }
}
