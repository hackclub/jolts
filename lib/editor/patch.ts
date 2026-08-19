import { structuredPatch } from "diff"
import { deflate } from "pako"

/* Builds a real `git am`-able patch in the browser. Text changes become
   unified diffs; added photos become GIT binary patches (zlib "literal"
   blocks in git's base85), so a contributor's images travel inside the
   same .patch file as their words. No login, no fork - download, and a
   maintainer (or the author) applies it with `git am`. */

export type FileChange =
  | { kind: "modify"; path: string; before: string; after: string }
  | { kind: "add"; path: string; after: string }
  | { kind: "delete"; path: string; before: string }
  | {
      kind: "rename"
      fromPath: string
      path: string
      before: string
      after: string
    }
  | { kind: "add-binary"; path: string; data: Uint8Array }

export type PatchAuthor = {
  /** display name, e.g. a GitHub username */
  name: string
  email: string
}

export type PatchInput = {
  author: PatchAuthor
  subject: string
  /** optional long-form description under the subject */
  body?: string
  changes: FileChange[]
  date?: Date
}

/* ---------- text diffs ---------- */

function hunksFor(
  oldName: string,
  newName: string,
  before: string,
  after: string
): string {
  const patch = structuredPatch(oldName, newName, before, after, "", "", {
    context: 3,
  })
  let out = ""
  for (const hunk of patch.hunks) {
    out += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`
    for (const line of hunk.lines) out += line + "\n"
  }
  return out
}

function textDiff(change: Exclude<FileChange, { kind: "add-binary" }>): string {
  switch (change.kind) {
    case "modify": {
      const body = hunksFor(change.path, change.path, change.before, change.after)
      if (!body) return ""
      return (
        `diff --git a/${change.path} b/${change.path}\n` +
        `--- a/${change.path}\n+++ b/${change.path}\n` +
        body
      )
    }
    case "add":
      return (
        `diff --git a/${change.path} b/${change.path}\n` +
        `new file mode 100644\n` +
        `--- /dev/null\n+++ b/${change.path}\n` +
        hunksFor("/dev/null", change.path, "", change.after)
      )
    case "delete":
      return (
        `diff --git a/${change.path} b/${change.path}\n` +
        `deleted file mode 100644\n` +
        `--- a/${change.path}\n+++ /dev/null\n` +
        hunksFor(change.path, "/dev/null", change.before, "")
      )
    case "rename": {
      const body = hunksFor(change.fromPath, change.path, change.before, change.after)
      let out =
        `diff --git a/${change.fromPath} b/${change.path}\n` +
        (body ? `similarity index 90%\n` : `similarity index 100%\n`) +
        `rename from ${change.fromPath}\n` +
        `rename to ${change.path}\n`
      if (body)
        out += `--- a/${change.fromPath}\n+++ b/${change.path}\n` + body
      return out
    }
  }
}

/* ---------- binary (git "literal" format) ---------- */

const BASE85 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  "!#$%&()*+-;<=>?@^_`{|}~"

function encodeBase85Line(bytes: Uint8Array): string {
  const n = bytes.length // 1..52
  const lenChar =
    n <= 26
      ? String.fromCharCode(64 + n) // A-Z = 1..26
      : String.fromCharCode(96 + n - 26) // a-z = 27..52
  let out = lenChar
  for (let i = 0; i < n; i += 4) {
    let acc = 0
    for (let j = 0; j < 4; j++) {
      acc = acc * 256 + (i + j < n ? bytes[i + j] : 0)
    }
    const chars = new Array<string>(5)
    for (let j = 4; j >= 0; j--) {
      chars[j] = BASE85[acc % 85]
      acc = Math.floor(acc / 85)
    }
    out += chars.join("")
  }
  return out
}

function gitBinaryLiteral(data: Uint8Array): string {
  const compressed = deflate(data)
  let out = `literal ${data.length}\n`
  for (let i = 0; i < compressed.length; i += 52) {
    out += encodeBase85Line(compressed.subarray(i, i + 52)) + "\n"
  }
  return out
}

async function blobSha1(data: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${data.length}\0`)
  const buf = new Uint8Array(header.length + data.length)
  buf.set(header, 0)
  buf.set(data, header.length)
  const digest = await crypto.subtle.digest("SHA-1", buf as BufferSource)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function binaryDiff(change: { path: string; data: Uint8Array }): Promise<string> {
  const sha = await blobSha1(change.data)
  return (
    `diff --git a/${change.path} b/${change.path}\n` +
    `new file mode 100644\n` +
    `index ${"0".repeat(40)}..${sha}\n` +
    `GIT binary patch\n` +
    gitBinaryLiteral(change.data) +
    `\n`
  )
}

/* ---------- diffstat (cosmetic - git am ignores it) ---------- */

function statLine(change: FileChange): string {
  const label = change.kind === "rename"
    ? `${change.fromPath} => ${change.path}`
    : change.path
  if (change.kind === "add-binary") return ` ${label} | Bin`
  const before = "before" in change ? change.before : ""
  const after = "after" in change ? change.after : ""
  const p = structuredPatch("a", "b", before, after, "", "", { context: 0 })
  let plus = 0
  let minus = 0
  for (const h of p.hunks)
    for (const l of h.lines) {
      if (l.startsWith("+")) plus++
      else if (l.startsWith("-")) minus++
    }
  return ` ${label} | ${plus + minus} ${"+".repeat(Math.min(plus, 30))}${"-".repeat(Math.min(minus, 30))}`
}

/* ---------- assembly ---------- */

function rfc2822(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  const pad = (n: number) => String(n).padStart(2, "0")
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? "+" : "-"
  const abs = Math.abs(offset)
  return (
    `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ` +
    `${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ` +
    `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
  )
}

/** Sanitize header text (no newlines; keep it mbox-safe). */
function headerText(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim()
}

export async function buildPatch(input: PatchInput): Promise<string> {
  const date = input.date ?? new Date()
  const diffs: string[] = []
  for (const change of input.changes) {
    if (change.kind === "add-binary") diffs.push(await binaryDiff(change))
    else {
      const d = textDiff(change)
      if (d) diffs.push(d)
    }
  }

  const stats = input.changes.map(statLine).join("\n")
  const summary = ` ${input.changes.length} file${input.changes.length === 1 ? "" : "s"} changed`

  let out = ""
  out += `From ${"0".repeat(40)} Mon Sep 17 00:00:00 2001\n`
  out += `From: ${headerText(input.author.name)} <${headerText(input.author.email)}>\n`
  out += `Date: ${rfc2822(date)}\n`
  out += `Subject: [PATCH] ${headerText(input.subject)}\n`
  out += `\n`
  if (input.body?.trim()) out += input.body.trim() + "\n"
  out += `---\n`
  out += stats + "\n" + summary + "\n\n"
  out += diffs.join("")
  out += `-- \ncreated with the jolts editor - jolts.hackclub.com\n`
  return out
}
