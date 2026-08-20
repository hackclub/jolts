import {
  CONTENT_TYPES,
  schemaByType,
  type ContentType,
} from "@/lib/content-schema"
import { splitFrontmatter } from "@/lib/editor/frontmatter"
import { gh, ghRaw, GitHubError } from "@/lib/github/api"
import { UPSTREAM_OWNER, UPSTREAM_REPO } from "@/lib/github/config"
import type { GhUser } from "@/lib/github/types"

/* Everything the curator review page runs on.

   The premise: reviewing a content pull request on github.com means reading a
   unified diff of YAML and MDX and guessing what the page will look like. What
   a curator actually needs to decide is narrower - is the frontmatter valid,
   are the photos any good, does the prose read well, did CI pass - so this
   layer answers those questions directly instead of handing over a patch.

   Curator = anyone GitHub says can push to the content repo. We never keep our
   own list of maintainers; the repo's collaborators ARE the list, so access
   granted or revoked on GitHub takes effect here immediately. */

const REPO = `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}`

/** How many PRs the list view enriches with file data (one call each, run in
    parallel). Beyond this the list still shows, just without entry identity. */
const ENRICH_LIMIT = 20
/** Cap on .mdx files whose full before/after we fetch for one PR. */
const DIFF_FILE_LIMIT = 12

/* ---------- curator gate ---------- */

export type Curator = {
  user: GhUser
  /** GitHub's own word: "admin" | "maintain" | "write" | "triage" | "read" */
  permission: string
}

type RepoPermissions = {
  permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; triage?: boolean }
}

/** Resolve the caller and confirm the repo lets them push. Throws a 403 with
    something human in it otherwise - this is the only authorisation check the
    review endpoints need, and every one of them calls it first. */
export async function requireCurator(token: string): Promise<Curator> {
  const me = await gh<{ login: string; name: string | null; avatar_url: string }>(
    token,
    "/user"
  )
  const repo = await gh<RepoPermissions>(token, REPO)
  const p = repo.permissions ?? {}
  const permission = p.admin
    ? "admin"
    : p.maintain
      ? "maintain"
      : p.push
        ? "write"
        : p.triage
          ? "triage"
          : "read"

  if (!p.push && !p.maintain && !p.admin) {
    throw new GitHubError(
      `Reviewing is for curators - GitHub says your access to ` +
        `${UPSTREAM_OWNER}/${UPSTREAM_REPO} is "${permission}". Ask an existing ` +
        `curator to give you write access, then reload.`,
      403
    )
  }
  return {
    user: { login: me.login, name: me.name, avatarUrl: me.avatar_url },
    permission,
  }
}

/* ---------- shapes the UI consumes ---------- */

/** Which content entry a pull request is about, worked out from its paths. */
export type EntryRef = {
  contentType: ContentType
  slug: string
  /** true when this PR introduces the entry rather than editing one */
  isNew: boolean
}

export type PrSummary = {
  number: number
  title: string
  author: { login: string; avatarUrl: string }
  createdAt: string
  updatedAt: string
  draft: boolean
  url: string
  headSha: string
  /** null while unenriched (past ENRICH_LIMIT) */
  entries: EntryRef[] | null
  changedFiles: number | null
  additions: number | null
  deletions: number | null
  photoCount: number | null
  /** paths outside content/ - the thing a curator most wants flagged */
  touchesCode: boolean | null
}

export type ChangedFile = {
  path: string
  status: string
  additions: number
  deletions: number
  /** raw text at the base and head refs; null when absent at that ref */
  before: string | null
  after: string | null
  /** GitHub's own patch, used when we chose not to fetch full contents */
  patch?: string
}

export type FrontmatterIssue = {
  field: string
  message: string
}

export type FrontmatterAudit = {
  path: string
  contentType: ContentType
  /** valid against the same zod schema CI enforces */
  ok: boolean
  issues: FrontmatterIssue[]
  /** a few fields worth showing even when valid */
  title?: string
  subtitle?: string
  draft?: boolean
}

export type CheckSummary = {
  state: "success" | "failure" | "pending" | "none"
  runs: { name: string; conclusion: string | null; url: string | null }[]
  /** Vercel (or any) deployment preview, surfaced because it is the fastest
      way for a curator to see the real rendered page */
  previewUrl: string | null
}

export type ReviewNote = {
  id: number
  author: string
  avatarUrl: string
  state: string
  body: string
  submittedAt: string | null
}

/** One number a curator actually reads: how much prose moved, ignoring
    frontmatter and markup churn. */
export type ProseDelta = { wordsAdded: number; wordsRemoved: number }

export type PrDetail = {
  summary: PrSummary
  body: string
  baseSha: string
  mergeable: boolean | null
  mergeableState: string
  /** true when this PR came from a fork, which is the normal contributor path */
  fromFork: boolean
  headLabel: string
  files: ChangedFile[]
  /** images added by this PR, as data the page can show directly */
  photos: { path: string; downloadUrl: string }[]
  audits: FrontmatterAudit[]
  checks: CheckSummary
  reviews: ReviewNote[]
  /** did the signed-in curator already leave a verdict? */
  myLastVerdict: string | null
  /** the whole pull request as one unified diff, straight from GitHub, for
      @pierre/diffs to render - no need to reassemble patches by hand */
  patch: string
  prose: ProseDelta
  /** .mdx files worth previewing, in reading order */
  previewable: string[]
}

/* ---------- path reading ---------- */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i
const CONTENT_PREFIX = "content/"

/** "content/guides/macropad/03-firmware.mdx" → guides + macropad */
export function entryOf(path: string): { contentType: ContentType; slug: string } | null {
  if (!path.startsWith(CONTENT_PREFIX)) return null
  const [type, slug] = path.slice(CONTENT_PREFIX.length).split("/")
  if (!type || !slug) return null
  if (!CONTENT_TYPES.includes(type as ContentType)) return null
  return { contentType: type as ContentType, slug }
}

type ApiFile = {
  filename: string
  status: string
  additions: number
  deletions: number
  patch?: string
  raw_url?: string
  contents_url?: string
}

function summariseFiles(files: ApiFile[]) {
  const byEntry = new Map<string, EntryRef>()
  let photoCount = 0
  let touchesCode = false
  for (const f of files) {
    const entry = entryOf(f.filename)
    if (!entry) {
      touchesCode = true
      continue
    }
    if (IMAGE_EXT.test(f.filename)) photoCount++
    const key = `${entry.contentType}/${entry.slug}`
    const isNew = f.filename.endsWith("/index.mdx") && f.status === "added"
    const seen = byEntry.get(key)
    if (seen) seen.isNew = seen.isNew || isNew
    else byEntry.set(key, { ...entry, isNew })
  }
  return { entries: [...byEntry.values()], photoCount, touchesCode }
}

/* ---------- list ---------- */

type ApiPull = {
  number: number
  title: string
  body: string | null
  draft: boolean
  created_at: string
  updated_at: string
  html_url: string
  user: { login: string; avatar_url: string } | null
  head: { sha: string; label: string; repo: { full_name: string } | null }
  base: { sha: string }
  mergeable?: boolean | null
  mergeable_state?: string
}

function baseSummary(pr: ApiPull): PrSummary {
  return {
    number: pr.number,
    title: pr.title,
    author: {
      login: pr.user?.login ?? "ghost",
      avatarUrl: pr.user?.avatar_url ?? "",
    },
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    draft: pr.draft,
    url: pr.html_url,
    headSha: pr.head.sha,
    entries: null,
    changedFiles: null,
    additions: null,
    deletions: null,
    photoCount: null,
    touchesCode: null,
  }
}

/** Open pull requests, newest activity first, enriched with what they touch. */
export async function listOpenPrs(token: string): Promise<PrSummary[]> {
  const pulls = await gh<ApiPull[]>(
    token,
    `${REPO}/pulls?state=open&sort=updated&direction=desc&per_page=50`
  )
  const summaries = pulls.map(baseSummary)

  // one files call per PR, in parallel, for the ones we show detail for
  await Promise.all(
    summaries.slice(0, ENRICH_LIMIT).map(async (summary) => {
      try {
        const files = await gh<ApiFile[]>(
          token,
          `${REPO}/pulls/${summary.number}/files?per_page=100`
        )
        const { entries, photoCount, touchesCode } = summariseFiles(files)
        summary.entries = entries
        summary.photoCount = photoCount
        summary.touchesCode = touchesCode
        summary.changedFiles = files.length
        summary.additions = files.reduce((n, f) => n + f.additions, 0)
        summary.deletions = files.reduce((n, f) => n + f.deletions, 0)
      } catch {
        // leave this one unenriched rather than failing the whole list
      }
    })
  )
  return summaries
}

/* ---------- detail ---------- */

export async function getPrDetail(
  token: string,
  number: number,
  viewer: string
): Promise<PrDetail> {
  const pr = await gh<ApiPull>(token, `${REPO}/pulls/${number}`)
  const files = await gh<ApiFile[]>(token, `${REPO}/pulls/${number}/files?per_page=100`)
  const { entries, photoCount, touchesCode } = summariseFiles(files)

  const summary: PrSummary = {
    ...baseSummary(pr),
    entries,
    photoCount,
    touchesCode,
    changedFiles: files.length,
    additions: files.reduce((n, f) => n + f.additions, 0),
    deletions: files.reduce((n, f) => n + f.deletions, 0),
  }

  /* Full before/after for the text files, so the page can diff at word level
     instead of showing GitHub's line patch. A fork's head commit is reachable
     from the base repo (GitHub keeps it as refs/pull/N/head), so both refs are
     read from one repo and nothing needs the contributor's fork. */
  const textFiles = files.filter((f) => !IMAGE_EXT.test(f.filename))
  const detailed = await Promise.all(
    textFiles.slice(0, DIFF_FILE_LIMIT).map(async (f): Promise<ChangedFile> => {
      const path = encodeURI(f.filename)
      const [before, after] = await Promise.all([
        f.status === "added"
          ? Promise.resolve(null)
          : ghRaw(token, `${REPO}/contents/${path}?ref=${pr.base.sha}`).catch(() => null),
        f.status === "removed"
          ? Promise.resolve(null)
          : ghRaw(token, `${REPO}/contents/${path}?ref=${pr.head.sha}`).catch(() => null),
      ])
      return {
        path: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        before,
        after,
        patch: f.patch,
      }
    })
  )
  // anything past the cap still appears, with GitHub's patch as the fallback
  for (const f of textFiles.slice(DIFF_FILE_LIMIT)) {
    detailed.push({
      path: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      before: null,
      after: null,
      patch: f.patch,
    })
  }

  const photos = files
    .filter((f) => IMAGE_EXT.test(f.filename) && f.status !== "removed")
    .map((f) => ({
      path: f.filename,
      downloadUrl: `/api/review/pr/${number}/image?path=${encodeURIComponent(f.filename)}`,
    }))

  const [checks, reviews, patch] = await Promise.all([
    getChecks(token, pr.head.sha),
    getReviews(token, number),
    getPatch(token, number),
  ])

  const mine = [...reviews].reverse().find((r) => r.author === viewer)

  return {
    summary,
    body: pr.body ?? "",
    baseSha: pr.base.sha,
    mergeable: pr.mergeable ?? null,
    mergeableState: pr.mergeable_state ?? "unknown",
    fromFork:
      pr.head.repo?.full_name.toLowerCase() !==
      `${UPSTREAM_OWNER}/${UPSTREAM_REPO}`.toLowerCase(),
    headLabel: pr.head.label,
    files: detailed,
    photos,
    audits: auditAll(detailed),
    checks,
    reviews,
    myLastVerdict: mine?.state ?? null,
    patch,
    prose: proseDelta(detailed),
    previewable: detailed
      .filter((f) => f.path.endsWith(".mdx") && f.after !== null)
      .map((f) => f.path)
      .sort(readingOrder),
  }
}

/** index.mdx first, then numbered pages in order - the order a reader meets
    them, which is the order a curator should review them in. */
function readingOrder(a: string, b: string): number {
  const rank = (p: string) => (p.endsWith("/index.mdx") ? "" : (p.split("/").pop() ?? p))
  return rank(a).localeCompare(rank(b))
}

/** GitHub will hand over the whole pull request as one unified diff. */
async function getPatch(token: string, number: number): Promise<string> {
  try {
    const res = await fetch(`https://api.github.com${REPO}/pulls/${number}`, {
      headers: {
        accept: "application/vnd.github.diff",
        authorization: `Bearer ${token}`,
        "user-agent": "jolts-editor",
        "x-github-api-version": "2022-11-28",
      },
      cache: "no-store",
    })
    return res.ok ? await res.text() : ""
  } catch {
    return ""
  }
}

/* Words, not lines. A reflowed paragraph is a huge line diff and a tiny prose
   change; a curator wants to know which one this is before opening anything. */
function proseDelta(files: ChangedFile[]): ProseDelta {
  let wordsAdded = 0
  let wordsRemoved = 0
  for (const f of files) {
    if (!f.path.endsWith(".mdx")) continue
    const before = countWords(splitFrontmatter(f.before ?? "").body)
    const after = countWords(splitFrontmatter(f.after ?? "").body)
    if (after > before) wordsAdded += after - before
    else wordsRemoved += before - after
  }
  return { wordsAdded, wordsRemoved }
}

const countWords = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0

/* ---------- frontmatter audit ---------- */

/** Run every changed index.mdx through the schema CI enforces, so a curator
    sees "cost is required" instead of hunting for it in a YAML diff. */
function auditAll(files: ChangedFile[]): FrontmatterAudit[] {
  const audits: FrontmatterAudit[] = []
  for (const f of files) {
    if (!f.path.endsWith("/index.mdx") || f.after === null) continue
    const entry = entryOf(f.path)
    if (!entry) continue
    audits.push(auditFrontmatter(f.path, entry.contentType, f.after))
  }
  return audits
}

export function auditFrontmatter(
  path: string,
  contentType: ContentType,
  raw: string
): FrontmatterAudit {
  let data: Record<string, unknown>
  try {
    data = splitFrontmatter(raw).data
  } catch (err) {
    return {
      path,
      contentType,
      ok: false,
      issues: [{ field: "(yaml)", message: (err as Error).message }],
    }
  }
  const result = schemaByType[contentType].safeParse(data)
  if (result.success) {
    return {
      path,
      contentType,
      ok: true,
      issues: [],
      title: result.data.title,
      subtitle: result.data.subtitle,
      draft: result.data.draft,
    }
  }
  return {
    path,
    contentType,
    ok: false,
    issues: result.error.issues.map((i) => ({
      field: i.path.join(".") || "(root)",
      message: i.message,
    })),
    title: typeof data.title === "string" ? data.title : undefined,
    subtitle: typeof data.subtitle === "string" ? data.subtitle : undefined,
    draft: data.draft === true,
  }
}

/* ---------- checks + reviews ---------- */

async function getChecks(token: string, sha: string): Promise<CheckSummary> {
  try {
    const res = await gh<{
      check_runs: {
        name: string
        conclusion: string | null
        status: string
        html_url: string | null
        details_url: string | null
        output?: { summary?: string | null }
      }[]
    }>(token, `${REPO}/commits/${sha}/check-runs?per_page=50`)

    const runs = res.check_runs.map((r) => ({
      name: r.name,
      conclusion: r.status === "completed" ? r.conclusion : null,
      url: r.html_url ?? r.details_url ?? null,
    }))
    const failure = runs.some(
      (r) => r.conclusion === "failure" || r.conclusion === "timed_out"
    )
    const pending = runs.some((r) => r.conclusion === null)
    const state = runs.length === 0
      ? "none"
      : failure
        ? "failure"
        : pending
          ? "pending"
          : "success"

    // deployment previews are named by the provider ("Vercel", "Vercel Preview
     // Comments", ...) - the details URL is the rendered page
    const deploy = res.check_runs.find((r) => /vercel|preview|deploy/i.test(r.name))
    const previewUrl =
      deploy?.details_url && /^https?:\/\//.test(deploy.details_url)
        ? deploy.details_url
        : null

    return { state, runs, previewUrl }
  } catch {
    return { state: "none", runs: [], previewUrl: null }
  }
}

async function getReviews(token: string, number: number): Promise<ReviewNote[]> {
  try {
    const res = await gh<
      {
        id: number
        user: { login: string; avatar_url: string } | null
        state: string
        body: string
        submitted_at: string | null
      }[]
    >(token, `${REPO}/pulls/${number}/reviews?per_page=100`)
    return res.map((r) => ({
      id: r.id,
      author: r.user?.login ?? "ghost",
      avatarUrl: r.user?.avatar_url ?? "",
      state: r.state,
      body: r.body,
      submittedAt: r.submitted_at,
    }))
  } catch {
    return []
  }
}

/* ---------- verdicts ---------- */

export type Verdict = "APPROVE" | "REQUEST_CHANGES" | "COMMENT"

export async function submitVerdict(
  token: string,
  number: number,
  event: Verdict,
  body: string
): Promise<{ id: number; state: string }> {
  const res = await gh<{ id: number; state: string }>(
    token,
    `${REPO}/pulls/${number}/reviews`,
    { method: "POST", body: { event, body } }
  )
  return { id: res.id, state: res.state }
}

export async function mergePr(
  token: string,
  number: number,
  title: string,
  message: string
): Promise<{ sha: string; merged: boolean }> {
  const res = await gh<{ sha: string; merged: boolean }>(
    token,
    `${REPO}/pulls/${number}/merge`,
    {
      method: "PUT",
      body: {
        merge_method: "squash",
        commit_title: title,
        commit_message: message,
      },
    }
  )
  return { sha: res.sha, merged: res.merged }
}

/** Raw bytes of one file at the PR head - the review page's <img> source, so
    photos in a private repo render without a public URL. */
export async function readPrImage(
  token: string,
  number: number,
  path: string
): Promise<{ data: Uint8Array; mime: string } | null> {
  const pr = await gh<ApiPull>(token, `${REPO}/pulls/${number}`)
  const res = await fetch(
    `https://api.github.com${REPO}/contents/${encodeURI(path)}?ref=${pr.head.sha}`,
    {
      headers: {
        accept: "application/vnd.github.raw",
        authorization: `Bearer ${token}`,
        "user-agent": "jolts-editor",
        "x-github-api-version": "2022-11-28",
      },
      cache: "no-store",
    }
  )
  if (!res.ok) return null
  const ext = path.toLowerCase().match(IMAGE_EXT)?.[1] ?? "png"
  const mime =
    ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`
  return { data: new Uint8Array(await res.arrayBuffer()), mime }
}
