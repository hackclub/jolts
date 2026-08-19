import { NextResponse } from "next/server"

import { getViewer, GitHubError } from "@/lib/github/api"
import { clearSession, readToken } from "@/lib/github/session"

/* Is this browser connected, and to whom? GET is the source of truth the
   save dialog trusts (the readable hint cookie is only for first paint).
   DELETE signs out - the token is dropped here, and GitHub keeps its own
   revoke page for the paranoid. */

export const dynamic = "force-dynamic"

export async function GET() {
  const token = await readToken()
  if (!token) return NextResponse.json({ connected: false, user: null })
  try {
    return NextResponse.json({ connected: true, user: await getViewer(token) })
  } catch (err) {
    // token revoked or expired - stop pretending we're signed in
    const res = NextResponse.json({
      connected: false,
      user: null,
      ...(err instanceof GitHubError && err.status === 401
        ? { expired: true }
        : { error: (err as Error).message }),
    })
    clearSession(res)
    return res
  }
}

export async function DELETE() {
  const res = NextResponse.json({ connected: false, user: null })
  clearSession(res)
  return res
}
