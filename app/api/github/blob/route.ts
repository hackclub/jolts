import { NextResponse } from "next/server"

import { createBlob } from "@/lib/github/api"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"

/* One photo per request, raw bytes in the body (no base64 on the wire, so
   a 4MB photo stays a 4MB request). Returns the git blob SHA, which the
   save call then stitches into the tree. Splitting uploads out keeps every
   request small no matter how photo-heavy a guide gets. */

export const dynamic = "force-dynamic"

const MAX_BYTES = 8 * 1024 * 1024

export async function POST(req: Request) {
  const token = await readToken()
  const missing = requireToken(token)
  if (missing) return missing

  const repo = req.headers.get("x-jolts-repo") // "owner/name"
  const match = repo?.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/)
  if (!match) {
    return NextResponse.json({ error: "Missing target repository." }, { status: 400 })
  }

  const buf = new Uint8Array(await req.arrayBuffer())
  if (buf.length === 0) {
    return NextResponse.json({ error: "That image was empty." }, { status: 400 })
  }
  if (buf.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "That image is too large to upload - keep photos under 8MB." },
      { status: 413 }
    )
  }

  try {
    const sha = await createBlob(token!, match[1], match[2], buf)
    return NextResponse.json({ sha })
  } catch (err) {
    return failure(err)
  }
}
