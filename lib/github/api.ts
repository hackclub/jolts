import {
  FORK_FALLBACK_NAME,
  FORK_NAME,
  UPSTREAM_OWNER,
  UPSTREAM_REPO,
  UPSTREAM_SLUG,
} from "@/lib/github/config"
import type {
  ForkInfo,
  GhUser,
  PullRequestResult,
  WireChange,
} from "@/lib/github/types"

/* Thin GitHub REST client plus the four moves a contribution needs:
   identify the contributor, make sure they have a fork, put their bytes in
   it as one commit, and open the pull request upstream.

   The commit is built with the git data API (blobs/trees/commits) rather
   than the contents API, so a whole entry - new files, edits, deletions,
   renames, photos - lands as a single reviewable commit. Its parent is
   UPSTREAM's tip, not the fork's: forks share GitHub's object store, so a
   stale fork still produces a branch based on fresh upstream main and
   nobody has to think about syncing. */

const API = "https://api.github.com"

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** the API call that failed, e.g. "GET /repos/hackclub/jolts" - a bare
        "Not Found" from GitHub is undebuggable without it */
    readonly call?: string,
    /** true when the fix is another trip through GitHub's consent screen
        (missing scope, revoked grant) rather than anything the user typed */
    readonly reconnect = false
  ) {
    super(message)
  }
}

export type Init = Omit<RequestInit, "body"> & { body?: unknown }

export async function gh<T>(
  token: string,
  path: string,
  init: Init = {}
): Promise<T> {
  const { body, ...rest } = init
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "jolts-editor",
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...rest.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const parsed: unknown = text ? safeJson(text) : null
  if (!res.ok) {
    throw new GitHubError(
      githubMessage(parsed, res.status),
      res.status,
      `${rest.method ?? "GET"} ${path}`
    )
  }
  return parsed as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { message: text.slice(0, 300) }
  }
}

function githubMessage(parsed: unknown, status: number): string {
  const obj = parsed as { message?: string; errors?: { message?: string }[] } | null
  const first = obj?.errors?.find((e) => e.message)?.message
  return obj?.message ? (first ? `${obj.message}: ${first}` : obj.message) : `GitHub returned ${status}`
}

/** Escape hatch for endpoints that answer with a file's bytes rather than
    JSON. Returns null for 404 - "this path doesn't exist at that ref" is a
    normal answer when a file was added or deleted. */
export async function ghRaw(
  token: string,
  path: string
): Promise<string | null> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      accept: "application/vnd.github.raw",
      "x-github-api-version": "2022-11-28",
      "user-agent": "jolts-editor",
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new GitHubError(`GitHub returned ${res.status}`, res.status, `GET ${path}`)
  }
  return res.text()
}

/* ---------- who ---------- */

export async function getViewer(token: string): Promise<GhUser> {
  const u = await gh<{ login: string; name: string | null; avatar_url: string }>(
    token,
    "/user"
  )
  return { login: u.login, name: u.name, avatarUrl: u.avatar_url }
}

/* ---------- fork ---------- */

type Repo = {
  name: string
  default_branch: string
  fork: boolean
  parent?: { full_name: string }
}

async function repoOrNull(token: string, owner: string, repo: string) {
  try {
    return await gh<Repo>(token, `/repos/${owner}/${repo}`)
  } catch (err) {
    if (err instanceof GitHubError && err.status === 404) return null
    throw err
  }
}

const isOurFork = (r: Repo) =>
  r.fork && r.parent?.full_name.toLowerCase() === `${UPSTREAM_OWNER}/${UPSTREAM_REPO}`

/** Find (or create) the contributor's fork, and resolve upstream's tip. */
export async function ensureFork(
  token: string,
  login: string
): Promise<ForkInfo> {
  /* First call, and the one that fails loudest when the deployment is
     misconfigured. GitHub answers 404 (never 403) for a repo the token can't
     see, so "Not Found" here means one of three things - all worth naming,
     because a bare 404 sends people hunting in the wrong place. */
  const upstream = await gh<Repo>(
    token,
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}`
  ).catch((err: unknown): never => {
    if (err instanceof GitHubError && err.status === 404) {
      throw new GitHubError(
        `GitHub can't see ${UPSTREAM_SLUG} with your sign-in. If the repo is ` +
          `private, this sign-in needs the "repo" scope - reconnect to grant ` +
          `it. If it's an organisation repo, an owner may also need to approve ` +
          `this OAuth app. Otherwise you may not have access to ${UPSTREAM_SLUG} yet.`,
        404,
        err.call,
        true
      )
    }
    throw err
  })
  const baseBranch = upstream.default_branch
  const ref = await gh<{ object: { sha: string } }>(
    token,
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/git/ref/heads/${baseBranch}`
  )
  const baseSha = ref.object.sha
  const commit = await gh<{ tree: { sha: string } }>(
    token,
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/git/commits/${baseSha}`
  )
  const base = { owner: login, baseBranch, baseSha, baseTreeSha: commit.tree.sha }

  // already forked? (the common case on every visit after the first)
  const preferred = await repoOrNull(token, login, FORK_NAME)
  if (preferred && isOurFork(preferred)) {
    return { ...base, repo: preferred.name, created: false }
  }
  const fallback = await repoOrNull(token, login, FORK_FALLBACK_NAME)
  if (fallback && isOurFork(fallback)) {
    return { ...base, repo: fallback.name, created: false }
  }

  /* Nothing usable under either name - ask GitHub to fork.

     Two things make this the reliable move rather than guessing: forking a
     repo you have ALREADY forked returns that existing fork instead of
     creating a second one, and the response names it. So a contributor who
     forked jolts years ago and renamed it to "my-macropad-notes" is found
     here, even though neither name we probed matched. We trust GitHub's
     answer over our guess. */
  const requestedName = preferred
    ? fallback
      ? undefined // both names taken; let GitHub pick or tell us why not
      : FORK_FALLBACK_NAME
    : FORK_NAME

  const forked = await gh<Repo>(
    token,
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/forks`,
    {
      method: "POST",
      body: requestedName && requestedName !== FORK_NAME ? { name: requestedName } : {},
    }
  ).catch((err: unknown): never => {
    if (
      err instanceof GitHubError &&
      err.status === 422 &&
      /already exists|name/i.test(err.message)
    ) {
      // Report the ACTUAL state rather than assuming both names are taken -
      // this is also the message that surfaces if GitHub ever stops honouring
      // the `name` parameter, so it carries GitHub's own words too.
      const taken = [
        preferred ? `"${FORK_NAME}"` : null,
        fallback ? `"${FORK_FALLBACK_NAME}"` : null,
      ].filter((n): n is string => n !== null)
      throw new GitHubError(
        `GitHub wouldn't fork ${UPSTREAM_SLUG} into your account: ${err.message}. ` +
          (taken.length
            ? `You already own ${taken.join(" and ")}, and neither is a fork of ` +
              `${UPSTREAM_SLUG} - rename or delete one, or fork ${UPSTREAM_SLUG} ` +
              `yourself, then save again.`
            : `Fork ${UPSTREAM_SLUG} yourself and save again.`),
        409
      )
    }
    throw err
  })

  const forkName = forked.name

  // forking is asynchronous: wait until the repo answers AND has a tip
  for (let i = 0; i < 12; i++) {
    const made = await repoOrNull(token, login, forkName)
    if (made) {
      try {
        await gh(
          token,
          `/repos/${login}/${forkName}/git/ref/heads/${made.default_branch}`
        )
        return { ...base, repo: made.name, created: true }
      } catch {
        /* refs not published yet - keep waiting */
      }
    }
    await sleep(i === 0 ? 700 : 1000)
  }
  throw new GitHubError(
    "GitHub is still setting up your fork. Give it a few seconds and press save again.",
    504
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ---------- blobs ---------- */

/** Upload one binary (a photo) into the fork; returns its blob SHA. */
export async function createBlob(
  token: string,
  owner: string,
  repo: string,
  data: Uint8Array
): Promise<string> {
  const blob = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    body: {
      content: Buffer.from(data).toString("base64"),
      encoding: "base64",
    },
  })
  return blob.sha
}

/* ---------- commit + pull request ---------- */

const FILE_MODE = "100644"

export async function openPullRequest(
  token: string,
  opts: {
    fork: ForkInfo
    branch: string
    title: string
    body: string
    changes: WireChange[]
  }
): Promise<PullRequestResult> {
  const { fork, branch } = opts
  const forkPath = `/repos/${fork.owner}/${fork.repo}`

  const tree = await gh<{ sha: string }>(token, `${forkPath}/git/trees`, {
    method: "POST",
    body: {
      base_tree: fork.baseTreeSha,
      tree: opts.changes.map((c) =>
        c.kind === "del"
          ? { path: c.path, mode: FILE_MODE, type: "blob", sha: null }
          : c.kind === "put-blob"
            ? { path: c.path, mode: FILE_MODE, type: "blob", sha: c.sha }
            : { path: c.path, mode: FILE_MODE, type: "blob", content: c.text }
      ),
    },
  })

  const commit = await gh<{ sha: string }>(token, `${forkPath}/git/commits`, {
    method: "POST",
    body: {
      message: opts.body ? `${opts.title}\n\n${opts.body}` : opts.title,
      tree: tree.sha,
      parents: [fork.baseSha],
    },
  })

  const ref = await createBranch(token, forkPath, branch, commit.sha)

  const pr = await gh<{ html_url: string; number: number }>(
    token,
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pulls`,
    {
      method: "POST",
      body: {
        title: opts.title,
        body: opts.body,
        head: `${fork.owner}:${ref}`,
        // A fork named like upstream resolves from "owner:branch" alone -
        // the decade-old documented form. Only a fork under our fallback
        // name needs head_repo to point GitHub at the right repository.
        ...(fork.repo === UPSTREAM_REPO
          ? {}
          : { head_repo: `${fork.owner}/${fork.repo}` }),
        base: fork.baseBranch,
        maintainer_can_modify: true,
      },
    }
  )
  return {
    url: pr.html_url,
    number: pr.number,
    branch: ref,
    fork: `${fork.owner}/${fork.repo}`,
  }
}

/** Create refs/heads/<name>, stepping the name aside if it already exists. */
async function createBranch(
  token: string,
  forkPath: string,
  name: string,
  sha: string
): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? name : `${name}-${i + 1}`
    try {
      await gh(token, `${forkPath}/git/refs`, {
        method: "POST",
        body: { ref: `refs/heads/${candidate}`, sha },
      })
      return candidate
    } catch (err) {
      const taken =
        err instanceof GitHubError &&
        err.status === 422 &&
        /already exists/i.test(err.message)
      if (!taken) throw err
    }
  }
  throw new GitHubError("Couldn't find a free branch name in your fork.", 422)
}
