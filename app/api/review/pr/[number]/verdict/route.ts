import { NextResponse } from "next/server"

import { requireCurator, submitVerdict, type Verdict } from "@/lib/github/review"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"

/* A verdict, submitted as the curator's own GitHub review - so it shows up on
   github.com exactly as if they had clicked it there, with their name on it.
   Nothing here is a jolts-only record. */

export const dynamic = "force-dynamic"

const VERDICTS: Verdict[] = ["APPROVE", "REQUEST_CHANGES", "COMMENT"]

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/review/pr/[number]/verdict">
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
    .then((v) => v as { verdict?: string; body?: string })
    .catch(() => null)
  const verdict = input?.verdict as Verdict | undefined
  if (!verdict || !VERDICTS.includes(verdict)) {
    return NextResponse.json({ error: "Pick a verdict first." }, { status: 400 })
  }
  const body = (input?.body ?? "").trim()
  // GitHub rejects an empty REQUEST_CHANGES, and a bare rejection is unkind
  if (verdict === "REQUEST_CHANGES" && !body) {
    return NextResponse.json(
      { error: "Say what needs changing - a rejection with no note isn't reviewable." },
      { status: 400 }
    )
  }
  if (verdict === "COMMENT" && !body) {
    return NextResponse.json({ error: "Write a comment first." }, { status: 400 })
  }

  try {
    await requireCurator(token!)
    return NextResponse.json(await submitVerdict(token!, n, verdict, body))
  } catch (err) {
    return failure(err)
  }
}
