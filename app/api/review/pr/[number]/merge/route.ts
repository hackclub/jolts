import { NextResponse } from "next/server"

import { mergePr, requireCurator } from "@/lib/github/review"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"

/* Squash-merge. One commit per contribution keeps `git log` on the content
   repo readable as a list of guides that landed, rather than a contributor's
   editing history. */

export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/review/pr/[number]/merge">
) {
  const token = await readToken()
  const missing = requireToken(token)
  if (missing) return missing

  const { number } = await ctx.params
  const n = Number(number)
  if (!Number.isInteger(n) || n <= 0) {
    return NextResponse.json({ error: "Not a pull request number." }, { status: 400 })
  }

  const input = await req
    .json()
    .then((v) => v as { title?: string; message?: string })
    .catch(() => null)
  const title = (input?.title ?? "").replace(/[\r\n]+/g, " ").trim()
  if (!title) {
    return NextResponse.json({ error: "The merge needs a commit title." }, { status: 400 })
  }

  try {
    await requireCurator(token!)
    return NextResponse.json(
      await mergePr(token!, n, `${title} (#${n})`, (input?.message ?? "").trim())
    )
  } catch (err) {
    return failure(err)
  }
}
