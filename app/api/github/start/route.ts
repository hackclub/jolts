import crypto from "node:crypto"

import { NextResponse } from "next/server"

import {
  OAUTH_SCOPE,
  STATE_COOKIE,
  STATE_MAX_AGE,
} from "@/lib/github/config"
import { oauthConfigOrError, originOf } from "@/lib/github/oauth"

/* Step one of connecting GitHub. Opened in a popup from the save dialog:
   we mint a CSRF state, park it in a short-lived cookie, and hand the
   browser to GitHub's consent screen. */

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const config = oauthConfigOrError()
  if ("error" in config) {
    return new NextResponse(errorPage(config.error), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    })
  }

  const origin = originOf(req)
  const state = crypto.randomBytes(16).toString("hex")

  const authorize = new URL("https://github.com/login/oauth/authorize")
  authorize.searchParams.set("client_id", config.clientId)
  authorize.searchParams.set("redirect_uri", `${origin}/api/github/callback`)
  authorize.searchParams.set("scope", OAUTH_SCOPE)
  authorize.searchParams.set("state", state)
  // someone without a GitHub account can make one mid-flow rather than
  // bouncing off a dead end
  authorize.searchParams.set("allow_signup", "true")

  const res = NextResponse.redirect(authorize, 302)
  res.cookies.set(STATE_COOKIE, state, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: STATE_MAX_AGE,
  })
  return res
}

function errorPage(message: string): string {
  return `<!doctype html><meta charset="utf-8"><title>GitHub sign-in unavailable</title>
<body style="font:15px/1.6 system-ui,sans-serif;max-width:34em;margin:12vh auto;padding:0 1.5em;color:#16181d">
<h1 style="font-size:19px;margin:0 0 .5em">GitHub sign-in isn't available</h1>
<p style="color:#5c6470">${escapeHtml(message)}</p>
<p style="color:#9aa1ab;font-size:13px">Your draft is safe in this browser - nothing was lost.</p>
</body>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  )
}
