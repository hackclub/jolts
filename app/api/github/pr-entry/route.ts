import { NextResponse } from "next/server"

import { getViewer, readPrEntry } from "@/lib/github/api"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"

/* An entry as one of the contributor's own open pull requests leaves it, so a
   second machine can continue that work rather than start a rival to it. Only
   ever their own pull requests, and only while still open. */

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(req: Request) {
  const token = await readToken()
  const missing = requireToken(token)
  if (missing) return missing

  const n = Number(new URL(req.url).searchParams.get("number"))
  if (!Number.isInteger(n) || n <= 0) {
    return NextResponse.json({ error: "Not a pull request number." }, { status: 400 })
  }

  try {
    const user = await getViewer(token!)
    return NextResponse.json(await readPrEntry(token!, user.login, n))
  } catch (err) {
    return failure(err)
  }
}
