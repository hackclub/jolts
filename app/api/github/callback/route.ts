import { NextResponse } from "next/server"

import { getViewer } from "@/lib/github/api"
import { STATE_COOKIE } from "@/lib/github/config"
import { oauthConfigOrError, originOf } from "@/lib/github/oauth"
import { applySession } from "@/lib/github/session"

/* Step two: GitHub sends the contributor back here with a code. We trade
   it for a token, seal the token into an httpOnly cookie, then close the
   popup and tell the editor to carry on. The editor page never reloads, so
   nothing in the draft is disturbed. */

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const origin = originOf(req)
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const denied = url.searchParams.get("error")

  if (denied) return closer(origin, { error: friendlyDenial(denied) })
  if (!code || !state) return closer(origin, { error: "GitHub sent us back without a code." })

  const expected = req.headers.get("cookie")?.match(
    new RegExp(`(?:^|; )${STATE_COOKIE}=([^;]+)`)
  )?.[1]
  if (!expected || expected !== state) {
    return closer(origin, {
      error: "That sign-in link expired. Close this window and try again.",
    })
  }

  const config = oauthConfigOrError()
  if ("error" in config) return closer(origin, { error: config.error })

  const exchanged = await exchangeCode({
    ...config,
    code,
    redirectUri: `${origin}/api/github/callback`,
  })
  if ("error" in exchanged) return closer(origin, { error: exchanged.error })

  try {
    const user = await getViewer(exchanged.token)
    const res = closer(origin, { login: user.login })
    applySession(res, exchanged.token, user)
    res.cookies.delete(STATE_COOKIE)
    return res
  } catch {
    return closer(origin, {
      error: "GitHub signed you in but wouldn't tell us who you are. Try again.",
    })
  }
}

/** Trade the one-shot code for an access token. */
async function exchangeCode(opts: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}): Promise<{ token: string } | { error: string }> {
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
        code: opts.code,
        redirect_uri: opts.redirectUri,
      }),
      cache: "no-store",
    })
    const data = (await res.json()) as {
      access_token?: string
      error_description?: string
      error?: string
    }
    if (!data.access_token) {
      return {
        error: data.error_description ?? data.error ?? "GitHub declined the sign-in.",
      }
    }
    return { token: data.access_token }
  } catch {
    return { error: "Couldn't reach GitHub. Check your connection." }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  )
}

function friendlyDenial(error: string): string {
  return error === "access_denied"
    ? "Sign-in cancelled - nothing was saved to GitHub."
    : `GitHub said: ${error}`
}

/* A page whose only job is to notify the opener and disappear. Messages can
   quote GitHub's own error text, so they go through JSON (with `<` escaped)
   for the script tag and through escapeHtml for the visible paragraph. */
function closer(
  origin: string,
  payload: { login?: string; error?: string }
): NextResponse {
  const json = JSON.stringify({ source: "jolts-github", ...payload }).replace(
    /</g,
    "\\u003c"
  )
  const html = `<!doctype html><meta charset="utf-8"><title>${
    payload.error ? "Sign-in failed" : "Connected"
  }</title>
<body style="font:15px/1.6 system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;text-align:center;color:#5c6470">
<p>${
    payload.error
      ? escapeHtml(payload.error) + "<br><small>You can close this window.</small>"
      : "Connected! Closing this window…<br><small>If it stays open, close it and head back to your editor tab.</small>"
  }</p>
<script>
(function () {
  var msg = ${json};
  try { if (window.opener) window.opener.postMessage(msg, ${JSON.stringify(origin)}); } catch (e) {}
  try { window.close() } catch (e) {}
})();
</script>
</body>`
  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}
