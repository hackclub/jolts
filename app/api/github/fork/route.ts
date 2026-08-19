import { NextResponse } from "next/server"

import { ensureFork, getViewer } from "@/lib/github/api"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"

/* Make sure the contributor has a fork of the content repo, and resolve
   upstream's tip while we're here. Idempotent: on every save after the
   first this is three cheap reads and no writes. */

export const dynamic = "force-dynamic"
// creating a brand-new fork is asynchronous on GitHub's side and we wait it
// out, which can outlast the default function timeout
export const maxDuration = 30

export async function POST() {
  const token = await readToken()
  const missing = requireToken(token)
  if (missing) return missing
  try {
    const user = await getViewer(token!)
    const fork = await ensureFork(token!, user.login)
    return NextResponse.json({ fork, user })
  } catch (err) {
    return failure(err)
  }
}
