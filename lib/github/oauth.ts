/* Server-only half of the GitHub config: the OAuth app credentials and the
   public origin. Kept out of lib/github/config.ts so cookie names can be
   shared with the browser bundle without dragging secrets near it. */

export type OAuthConfig = { clientId: string; clientSecret: string }

export class ConfigError extends Error {}

export function oauthConfig(): OAuthConfig {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new ConfigError(
      "GitHub sign-in isn't configured on this deployment (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)."
    )
  }
  return { clientId, clientSecret }
}

/** Same, but as a value the caller can narrow instead of a throw - the OAuth
    routes answer with a friendly page rather than a stack trace. */
export function oauthConfigOrError(): OAuthConfig | { error: string } {
  try {
    return oauthConfig()
  } catch (err) {
    if (err instanceof ConfigError) return { error: err.message }
    throw err
  }
}

/** Public origin of this deployment, honouring Vercel's proxy headers so
    the OAuth redirect_uri matches what the browser actually asked for. */
export function originOf(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https")
  if (host) return `${proto}://${host}`
  return new URL(req.url).origin
}
