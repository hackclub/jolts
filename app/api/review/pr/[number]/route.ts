import { NextResponse } from "next/server"

import { getPrDetail, requireCurator } from "@/lib/github/review"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"

/* Everything one pull request's review page needs, in a single round trip:
   files with full before/after, the frontmatter audit, CI, and prior verdicts. */

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/review/pr/[number]">
) {
  const token = await readToken()
  const missing = requireToken(token)
  if (missing) return missing

  const { number } = await ctx.params
  const n = Number(number)
  if (!Number.isInteger(n) || n <= 0) {
    return NextResponse.json({ error: "Not a pull request number." }, { status: 400 })
  }
  try {
    const curator = await requireCurator(token!)
    const detail = await getPrDetail(token!, n, curator.user.login)
    return NextResponse.json({ detail, user: curator.user })
  } catch (err) {
    return failure(err)
  }
}
