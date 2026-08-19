"use client"

import { useEffect, useMemo, useState } from "react"

import {
  CheckCircle,
  DownloadSimple,
  FileArrowDown,
  FileDashed,
  FilePlus,
  FileX,
  GitPullRequest,
  Swap,
  X,
} from "@phosphor-icons/react"
import { structuredPatch } from "diff"

import { buildPatch, type FileChange } from "@/lib/editor/patch"
import { cn } from "@/lib/utils"

/* The way out: your edits become a real git patch. Asks who you are
   (goes on the commit - credit is the currency here), shows exactly
   what changed, and downloads a .patch that `git am` applies. */

const AUTHOR_KEY = "jolts-editor-author"

function diffCounts(change: FileChange): { plus: number; minus: number } {
  if (change.kind === "add-binary") return { plus: 0, minus: 0 }
  const before = "before" in change ? change.before : ""
  const after = "after" in change ? change.after : ""
  let plus = 0
  let minus = 0
  for (const h of structuredPatch("a", "b", before, after, "", "", { context: 0 }).hunks) {
    for (const l of h.lines) {
      if (l.startsWith("+")) plus++
      else if (l.startsWith("-")) minus++
    }
  }
  return { plus, minus }
}

const KIND_META: Record<
  FileChange["kind"],
  { icon: typeof FilePlus; label: string; color: string }
> = {
  add: { icon: FilePlus, label: "new", color: "#14B87A" },
  "add-binary": { icon: FilePlus, label: "new image", color: "#14B87A" },
  modify: { icon: FileDashed, label: "edited", color: "#FF902F" },
  rename: { icon: Swap, label: "renamed", color: "#01A6FF" },
  delete: { icon: FileX, label: "deleted", color: "#d43c3c" },
}

export function ExportDialog({
  onClose,
  changes,
  defaultSubject,
  slug,
}: {
  onClose: () => void
  changes: FileChange[]
  defaultSubject: string
  slug: string
}) {
  // mounted fresh on every open (conditional render in the shell), so
  // plain initializers do the resetting
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem(AUTHOR_KEY) ?? ""
    } catch {
      return ""
    }
  })
  const [subject, setSubject] = useState(defaultSubject)
  const [done, setDone] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [preview, setPreview] = useState("")

  const counts = useMemo(() => changes.map(diffCounts), [changes])

  useEffect(() => {
    if (!showDiff) return
    let alive = true
    buildPatch({
      author: {
        name: username.trim() || "anonymous",
        email: `${username.trim() || "anonymous"}@users.noreply.github.com`,
      },
      subject: subject.trim() || defaultSubject,
      changes,
    }).then((p) => {
      if (alive) setPreview(p)
    })
    return () => {
      alive = false
    }
  }, [showDiff, changes, username, subject, defaultSubject])

  const canExport = changes.length > 0 && username.trim().length > 0

  const download = async () => {
    const name = username.trim()
    try {
      localStorage.setItem(AUTHOR_KEY, name)
    } catch {
      /* ignore */
    }
    const patch = await buildPatch({
      author: {
        name,
        email: `${name}@users.noreply.github.com`,
      },
      subject: subject.trim() || defaultSubject,
      body: "Written with the jolts visual editor.",
      changes,
    })
    const blob = new Blob([patch], { type: "text/x-patch" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `jolts-${slug}.patch`
    a.click()
    URL.revokeObjectURL(url)
    setDone(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-[20px] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="mt-[6vh] w-full max-w-[560px] overflow-hidden rounded-[14px] bg-white shadow-[0px_24px_60px_-12px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between border-b border-black/[0.07] px-[22px] py-[14px]">
          <h2 className="flex items-center gap-[9px] text-[17px] font-semibold tracking-[-0.02em] text-[#16181d]">
            <GitPullRequest size={18} weight="bold" className="text-[#FF902F]" aria-hidden />
            Export your changes
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[7px] p-[5px] text-[#9aa1ab] hover:bg-black/[0.05] hover:text-[#16181d]"
            aria-label="Close"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="px-[22px] py-[16px]">
          {changes.length === 0 ? (
            <p className="py-[16px] text-center text-[14px] text-[#9aa1ab]">
              Nothing has changed yet - edit something first!
            </p>
          ) : (
            <>
              <label className="block text-[12.5px] font-semibold tracking-[-0.01em] text-[#5c6470]">
                Your GitHub username
                <span className="ml-[6px] font-normal text-[#9aa1ab]">
                  goes on the commit - you keep the credit
                </span>
              </label>
              <div className="mt-[5px] flex items-center gap-[8px]">
                <span className="text-[15px] text-[#9aa1ab]">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@/, ""))}
                  placeholder="orpheus"
                  spellCheck={false}
                  className="w-full rounded-[9px] border border-black/12 px-[11px] py-[7px] text-[14.5px] outline-none focus:border-[#FF902F]"
                />
              </div>

              <label className="mt-[14px] block text-[12.5px] font-semibold tracking-[-0.01em] text-[#5c6470]">
                What did you do?
                <span className="ml-[6px] font-normal text-[#9aa1ab]">
                  becomes the commit message
                </span>
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-[5px] w-full rounded-[9px] border border-black/12 px-[11px] py-[7px] text-[14.5px] outline-none focus:border-[#FF902F]"
              />

              <div className="mt-[16px] overflow-hidden rounded-[10px] border border-black/[0.08]">
                <p className="border-b border-black/[0.06] bg-[#fafafa] px-[12px] py-[6px] text-[11px] font-semibold tracking-[0.03em] text-[#9aa1ab] uppercase">
                  {changes.length} file{changes.length === 1 ? "" : "s"} in this patch
                </p>
                <ul className="max-h-[180px] divide-y divide-black/[0.05] overflow-y-auto">
                  {changes.map((c, i) => {
                    const meta = KIND_META[c.kind]
                    const Icon = meta.icon
                    const { plus, minus } = counts[i]
                    return (
                      <li
                        key={c.path + c.kind}
                        className="flex items-center gap-[9px] px-[12px] py-[6px]"
                      >
                        <Icon size={14} weight="bold" style={{ color: meta.color }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#33383f]">
                          {c.kind === "rename"
                            ? `${c.fromPath.split("/").pop()} → ${c.path.split("/").pop()}`
                            : c.path.replace(/^content\//, "")}
                        </span>
                        <span className="shrink-0 text-[11px] font-medium" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        {c.kind !== "add-binary" && (plus > 0 || minus > 0) && (
                          <span className="shrink-0 font-mono text-[11px] tabular-nums">
                            <span className="text-[#14B87A]">+{plus}</span>{" "}
                            <span className="text-[#d43c3c]">−{minus}</span>
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setShowDiff((s) => !s)}
                className="mt-[8px] text-[12px] font-medium text-[#9aa1ab] hover:text-[#16181d]"
              >
                {showDiff ? "Hide" : "Peek at"} the raw patch
              </button>
              {showDiff && (
                <pre className="mt-[6px] max-h-[220px] overflow-auto rounded-[10px] bg-[#15181d] p-[12px] font-mono text-[11px] leading-[1.5] whitespace-pre text-[#e8eaed]">
                  {preview || "…"}
                </pre>
              )}

              {done ? (
                <div className="mt-[16px] rounded-[10px] border border-[#14B87A]/30 bg-[#E9FAF3] px-[14px] py-[11px]">
                  <p className="flex items-center gap-[7px] text-[14px] font-semibold text-[#067A54]">
                    <CheckCircle size={16} weight="fill" aria-hidden />
                    Patch downloaded!
                  </p>
                  <p className="mt-[4px] text-[13px] leading-[1.55] text-[#067A54]/85">
                    Post <code className="font-mono text-[12px]">jolts-{slug}.patch</code> in{" "}
                    <a
                      href="https://hackclub.slack.com/archives/jolts"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline underline-offset-2"
                    >
                      #jolts on the Hack Club Slack
                    </a>{" "}
                    and someone will land it - or open the PR yourself:
                  </p>
                  <pre className="mt-[7px] overflow-x-auto rounded-[8px] bg-[#0b3d2c] p-[10px] font-mono text-[11px] leading-[1.6] text-[#c8f5e2]">
{`git clone https://github.com/hackclub/jolts
cd jolts && git checkout -b ${slug}-improvements
git am ~/Downloads/jolts-${slug}.patch
git push  # then open the pull request`}
                  </pre>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!canExport}
                  onClick={download}
                  className={cn(
                    "mt-[16px] flex w-full items-center justify-center gap-[8px] rounded-[10px] py-[10px] text-[15px] font-semibold tracking-[-0.01em] transition-colors",
                    canExport
                      ? "bg-[#16181d] text-white hover:bg-black"
                      : "cursor-not-allowed bg-black/[0.06] text-black/30"
                  )}
                >
                  <DownloadSimple size={17} weight="bold" aria-hidden />
                  Download the patch
                </button>
              )}
              {!done && (
                <p className="mt-[8px] flex items-center justify-center gap-[5px] text-center text-[11.5px] text-[#9aa1ab]">
                  <FileArrowDown size={12} aria-hidden />
                  A .patch is a git commit in a file - photos included. By
                  exporting you agree to CC BY-SA 4.0 / MIT.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
