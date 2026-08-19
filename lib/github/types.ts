/* Shapes shared by both halves of the save flow. Server-only concerns
   (tokens, Buffer, node:crypto) stay out of this file so the browser can
   import it without dragging any of that into the bundle. */

export type GhUser = {
  login: string
  name: string | null
  avatarUrl: string
}

/** Where a contribution gets committed, and what it's based on. */
export type ForkInfo = {
  /** the contributor's login */
  owner: string
  /** their fork's repo name (usually "jolts") */
  repo: string
  /** upstream's default branch, e.g. "main" */
  baseBranch: string
  /** upstream tip commit - the parent of the contribution commit */
  baseSha: string
  /** upstream tip's tree, the base_tree for the new tree */
  baseTreeSha: string
  /** true when the fork was created by this request */
  created: boolean
}

/** What the client asks the save endpoint to write. Text rides along inline
    (MDX is kilobytes); photos are uploaded separately and referenced by the
    git blob SHA that came back. */
export type WireChange =
  | { kind: "put"; path: string; text: string }
  | { kind: "put-blob"; path: string; sha: string }
  | { kind: "del"; path: string }

export type PullRequestResult = {
  url: string
  number: number
  branch: string
  /** "owner/repo" of the fork the branch lives in */
  fork: string
}
