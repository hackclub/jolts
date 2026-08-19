/* One place for everything the GitHub round-trip needs to know: which repo
   contributions land in, which cookies carry the session, and the OAuth
   app credentials. Contributions are pull requests now - a contributor
   connects GitHub once and the editor drives fork → branch → commit → PR
   on their behalf. */

export const UPSTREAM_OWNER = "hackclub"
export const UPSTREAM_REPO = "jolts"
export const UPSTREAM_SLUG = `${UPSTREAM_OWNER}/${UPSTREAM_REPO}`

/** Preferred name for the contributor's fork, and the fallback used when
    they already own an unrelated repo by that name. */
export const FORK_NAME = UPSTREAM_REPO
export const FORK_FALLBACK_NAME = `${UPSTREAM_REPO}-contributions`

/* Scope we ask GitHub for.

   `repo` is required ONLY because hackclub/jolts is currently private: a
   `public_repo` token cannot even see a private repo, so every call 404s. The
   cost is that `repo` grants read/write to all of the contributor's private
   repositories, which is far more than this editor needs.

   THE DAY jolts GOES PUBLIC, change this back to "public_repo" - it is the
   narrowest scope that can fork, push a branch and open the pull request.
   (A GitHub App with `contents: write` on this one repo would be narrower
   still, at the cost of an installation step per contributor.) */
export const OAUTH_SCOPE = "repo"

/** sealed access token - httpOnly, never readable from JS */
export const SESSION_COOKIE = "jolts_gh"
/** login + avatar only, readable, so the dialog paints before any fetch */
export const HINT_COOKIE = "jolts_gh_user"
/** CSRF state for the authorize round-trip */
export const STATE_COOKIE = "jolts_gh_state"

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
export const STATE_MAX_AGE = 60 * 10
