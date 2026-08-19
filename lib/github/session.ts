import crypto from "node:crypto"

import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

import {
  HINT_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/github/config"
import { oauthConfig } from "@/lib/github/oauth"
import type { GhUser } from "@/lib/github/types"

/* The contributor's GitHub token lives in an httpOnly cookie, sealed with
   AES-256-GCM under a key derived from the OAuth client secret. httpOnly
   already keeps it away from page JS; sealing means a stolen cookie jar
   isn't a usable token without this deployment's secret either.

   A second, readable cookie carries only login + avatar so the save
   dialog can render "signed in as @you" before any network call. */

const ALGO = "aes-256-gcm"

function key(): Buffer {
  const { clientSecret } = oauthConfig()
  // hkdfSync hands back an ArrayBuffer - createCipheriv wants a view
  return Buffer.from(
    crypto.hkdfSync("sha256", clientSecret, "jolts-gh-session", "token-seal-v1", 32)
  )
}

export function seal(token: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key(), iv)
  const ct = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url")
}

export function unseal(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64url")
    if (raw.length < 29) return null
    const decipher = crypto.createDecipheriv(ALGO, key(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    // wrong key (secret rotated), tampered, or garbage - treat as signed out
    return null
  }
}

/** the caller's GitHub token, or null when they haven't connected */
export async function readToken(): Promise<string | null> {
  const sealed = (await cookies()).get(SESSION_COOKIE)?.value
  return sealed ? unseal(sealed) : null
}

/** Attach a fresh session to an outgoing response. */
export function applySession(
  res: NextResponse,
  token: string,
  user: GhUser
): void {
  const base = {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  }
  res.cookies.set(SESSION_COOKIE, seal(token), { ...base, httpOnly: true })
  // readable by the save dialog for first paint; identity only, never the token
  res.cookies.set(HINT_COOKIE, encodeURIComponent(JSON.stringify(user)), {
    ...base,
    httpOnly: false,
  })
}

/** Forget the connection - on sign-out, and whenever GitHub stops accepting
    the token we have. */
export function clearSession(res: NextResponse): void {
  res.cookies.delete(SESSION_COOKIE)
  res.cookies.delete(HINT_COOKIE)
}
