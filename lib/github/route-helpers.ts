import { NextResponse } from "next/server"

import { GitHubError } from "@/lib/github/api"
import { ConfigError } from "@/lib/github/oauth"
import { clearSession } from "@/lib/github/session"

/* Shared shape for the save endpoints: every failure comes back as
   { error, reconnect? } so the dialog can either show the message or bounce
   the contributor through GitHub again. */

export type ApiFailure = { error: string; reconnect?: boolean }

export function requireToken(token: string | null): NextResponse | null {
  if (token) return null
  return NextResponse.json<ApiFailure>(
    { error: "Connect your GitHub account first.", reconnect: true },
    { status: 401 }
  )
}

export function failure(err: unknown): NextResponse {
  if (err instanceof ConfigError) {
    return NextResponse.json<ApiFailure>({ error: err.message }, { status: 500 })
  }
  if (err instanceof GitHubError) {
    // a missing scope or a revoked grant is fixed by signing in again, and
    // GitHub's own 401/403 mean the same thing
    const reconnect = err.reconnect || err.status === 401 || err.status === 403
    if (err.status === 401) {
      const res = NextResponse.json<ApiFailure>(
        {
          error: "GitHub no longer accepts that sign-in - reconnect and try again.",
          reconnect: true,
        },
        { status: 401 }
      )
      clearSession(res)
      return res
    }

    let error = err.message
    if (err.status === 403) {
      error =
        `GitHub turned this down: ${err.message}. If you granted limited ` +
        `access, reconnect and allow this app to reach the repository.`
    }
    // a bare "Not Found" is unactionable without knowing what was requested
    if (err.call && !/\)\s*$/.test(error)) error += ` (${err.call})`

    const res = NextResponse.json<ApiFailure>(
      { error, ...(reconnect ? { reconnect: true } : {}) },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
    )
    // the token itself is stale whenever reconnecting is the fix
    if (reconnect) clearSession(res)
    return res
  }
  return NextResponse.json<ApiFailure>(
    { error: (err as Error)?.message || "Something went wrong talking to GitHub." },
    { status: 500 }
  )
}
