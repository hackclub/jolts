"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"

import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  FileDashed,
  FilePlus,
  FileX,
  GitBranch,
  GitFork,
  GitPullRequest,
  ImageSquare,
  SignOut,
  Swap,
  WarningCircle,
  X,
} from "@phosphor-icons/react"
import { structuredPatch } from "diff"

import { CheckerFrame } from "@/components/checker-frame"
import { GithubMark } from "@/components/github-mark"
import { celebrate } from "@/lib/confetti"
import { signatureOf, type FileChange } from "@/lib/editor/changes"
import {
  SaveError,
  cachedUser,
  connect,
  createPullRequest,
  ensureFork,
  fetchEntryPrs,
  fetchSession,
  myOpenPr,
  othersOpenPrs,
  signOut,
  splitChanges,
  uploadImage,
} from "@/lib/github/client"
import type { EntryPr, GhUser, PullRequestResult } from "@/lib/github/types"
import { chromeTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

/* The way out: your edits become a pull request. Connect GitHub once, and
   from then on saving is one button - we fork the repo if you haven't, put
   your work on a fresh branch off current main, and open the PR under your
   own name. No patch files, no terminal, no forking by hand. */

type Phase = "form" | "working" | "done"

type StepId = "fork" | "images" | "pr"
type Step = { id: StepId; label: string; icon: typeof GitFork }

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
  "add-binary": { icon: ImageSquare, label: "new photo", color: "#14B87A" },
  modify: { icon: FileDashed, label: "edited", color: "#FF902F" },
  rename: { icon: Swap, label: "renamed", color: "#01A6FF" },
  delete: { icon: FileX, label: "deleted", color: "#d43c3c" },
}

export function SaveDialog({
  onClose,
  onSaved,
  changes,
  defaultTitle,
  contentType,
  slug,
  knownPrNumber,
  basedOn,
}: {
  onClose: () => void
  onSaved: (result: PullRequestResult, signature: string) => void
  changes: FileChange[]
  defaultTitle: string
  contentType: string
  slug: string
  /** the pull request THIS browser opened, from its draft - only that one may
      be revised from here (see `revising` below) */
  knownPrNumber: number | null
  /** which tree the change set was computed against */
  basedOn: "main" | "branch"
}) {
  // mounted fresh on every open (conditional render in the shell), so plain
  // initializers do the resetting
  const [user, setUser] = useState<GhUser | null>(() => cachedUser())
  const [checking, setChecking] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [phase, setPhase] = useState<Phase>("form")
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [result, setResult] = useState<PullRequestResult | null>(null)
  /* asked fresh on every open, because the answer can have changed on another
     device since this browser last looked */
  const [entryPrs, setEntryPrs] = useState<EntryPr[] | null>(null)

  const [stepStates, setStepStates] = useState<Record<StepId, "pending" | "active" | "done">>({
    fork: "pending",
    images: "pending",
    pr: "pending",
  })
  const [uploaded, setUploaded] = useState(0)

  const openPr = useMemo(() => myOpenPr(entryPrs), [entryPrs])
  /* Revising rewrites the branch to match this editor, which is only safe when
     this browser is the one that opened it. An open pull request from another
     machine holds work this editor never loaded, so saving from here opens a
     separate one rather than quietly deleting it. */
  const revising = openPr && openPr.number === knownPrNumber ? openPr : null
  const foreignPr = openPr && !revising ? openPr : null
  /* other people mid-edit on the same page - worth saying once, never blocking */
  const others = useMemo(() => othersOpenPrs(entryPrs), [entryPrs])

  const counts = useMemo(() => changes.map(diffCounts), [changes])
  const imageCount = useMemo(
    () => changes.filter((c) => c.kind === "add-binary").length,
    [changes]
  )

  const steps = useMemo<Step[]>(() => {
    const all: (Step | null)[] = [
      { id: "fork", label: "Getting your copy of the repo", icon: GitFork },
      imageCount
        ? {
            id: "images",
            label: `Uploading ${imageCount} photo${imageCount === 1 ? "" : "s"}`,
            icon: ImageSquare,
          }
        : null,
      {
        id: "pr",
        label: revising
          ? `Updating pull request #${revising.number}`
          : "Opening the pull request",
        icon: GitBranch,
      },
    ]
    return all.filter((step): step is Step => step !== null)
  }, [imageCount, revising])

  /* the hint cookie may be stale (token revoked on github.com) - confirm */
  useEffect(() => {
    let alive = true
    fetchSession()
      .then((u) => {
        if (!alive) return
        setUser(u)
        setChecking(false)
      })
      .catch(() => {
        if (alive) setChecking(false)
      })
    return () => {
      alive = false
    }
  }, [])

  /* what already exists for this entry - the answer decides whether this save
     opens a pull request or revises one, so it is read here rather than
     trusted from the draft */
  useEffect(() => {
    if (!user) return
    let alive = true
    fetchEntryPrs(contentType, slug).then((prs) => {
      if (alive) setEntryPrs(prs)
    })
    return () => {
      alive = false
    }
  }, [user, contentType, slug])

  /* the payoff. Runs once when the pull request lands; stopped if the dialog
     closes mid-flight (including before the dynamic import resolves). */
  useEffect(() => {
    if (phase !== "done") return
    let cancelled = false
    let stop: (() => void) | null = null
    celebrate().then((s) => {
      if (cancelled) s()
      else stop = s
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [phase])

  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (user && phase === "form") titleRef.current?.focus()
  }, [user, phase])

  const onConnect = async () => {
    setError(null)
    setNeedsReconnect(false)
    setConnecting(true)
    try {
      await connect()
      setUser(await fetchSession())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setConnecting(false)
    }
  }

  const onSwitch = async () => {
    await signOut()
    setUser(null)
  }

  const save = async () => {
    setError(null)
    setNeedsReconnect(false)
    setPhase("working")
    setUploaded(0)
    setStepStates({ fork: "active", images: "pending", pr: "pending" })
    try {
      const { fork, user: me } = await ensureFork()
      setUser(me)
      setStepStates((s) => ({ ...s, fork: "done" }))

      const { wire, images } = splitChanges(changes)
      if (images.length) {
        setStepStates((s) => ({ ...s, images: "active" }))
        // sequential on purpose: photo uploads are the heavy part and a
        // burst of them just invites secondary rate limits
        for (const image of images) {
          const sha = await uploadImage(fork, image.data)
          wire.push({ kind: "put-blob", path: image.path, sha })
          setUploaded((n) => n + 1)
        }
        setStepStates((s) => ({ ...s, images: "done" }))
      }

      setStepStates((s) => ({ ...s, pr: "active" }))
      const pr = await createPullRequest({
        contentType,
        slug,
        title: title.trim() || defaultTitle,
        description,
        fork,
        changes: wire,
        ...(revising ? { updates: revising.number, basedOn } : {}),
      })
      setStepStates((s) => ({ ...s, pr: "done" }))
      setResult(pr)
      setPhase("done")
      onSaved(pr, signatureOf(changes))
    } catch (err) {
      const reconnect = err instanceof SaveError && err.reconnect
      setError((err as Error).message)
      setNeedsReconnect(reconnect)
      // the server cleared the session too, so show the connect panel again -
      // otherwise the error names a fix with nothing to click
      if (reconnect) setUser(null)
      setPhase("form")
    }
  }

  const canSave = changes.length > 0 && Boolean(user) && title.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-[20px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== "working") onClose()
      }}
    >
      <div
        className="mt-[6vh] w-full max-w-[560px]"
        style={{ "--jolts-accent": chromeTheme.accent } as CSSProperties}
      >
      <CheckerFrame
        theme={chromeTheme}
        checkerSize={150}
        className="shadow-[0px_24px_60px_-12px_rgba(0,0,0,0.45)]"
      >
        {/* ---------- title, on the frame itself ---------- */}
        <div className="relative flex items-center gap-[8px] px-[10px] pt-[3px] pb-[9px] [filter:drop-shadow(0px_1px_3px_rgba(0,0,0,0.28))]">
          <GitPullRequest size={16} weight="bold" className="shrink-0 text-white" aria-hidden />
          <h2 className="min-w-0 flex-1 truncate text-[14.5px] font-semibold tracking-[-0.02em] text-white">
            {phase === "done"
              ? revising
                ? `Pull request #${revising.number} updated`
                : "Your pull request is open"
              : revising
                ? `Update pull request #${revising.number}`
                : "Save your changes"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "working"}
            className="-mr-[2px] shrink-0 rounded-[6px] p-[3px] text-white/75 transition-colors hover:bg-white/25 hover:text-white disabled:opacity-30"
            aria-label="Close"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        <div className="relative rounded-[7px] bg-white px-[18px] py-[16px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.15)]">
          {changes.length === 0 ? (
            <p className="py-[16px] text-center text-[14px] text-[#9aa1ab]">
              Nothing has changed yet.
            </p>
          ) : phase === "done" && result ? (
            <Success result={result} updated={Boolean(revising)} />
          ) : (
            <>
              {/* ---------- who ---------- */}
              {checking && !user ? (
                <div className="flex items-center gap-[8px] rounded-[10px] border border-black/[0.08] px-[13px] py-[11px] text-[13.5px] text-[#9aa1ab]">
                  <CircleNotch size={15} weight="bold" className="animate-spin" aria-hidden />
                  Checking your GitHub connection…
                </div>
              ) : user ? (
                <Identity user={user} onSwitch={onSwitch} busy={phase === "working"} />
              ) : (
                <Connect
                  onConnect={onConnect}
                  connecting={connecting}
                  reconnect={needsReconnect}
                />
              )}

              {/* ---------- the ask ---------- */}
              <fieldset
                disabled={!user || phase === "working"}
                className="min-w-0 border-0 p-0 disabled:opacity-45"
              >
                <label className="mt-[16px] block text-[12.5px] font-semibold tracking-[-0.01em] text-[#5c6470]">
                  What did you change?
                </label>
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-[5px] w-full rounded-[9px] border border-black/12 px-[11px] py-[7px] text-[14.5px] text-[#16181d] outline-none focus:border-[var(--jolts-accent)]"
                />

                <label className="mt-[14px] block text-[12.5px] font-semibold tracking-[-0.01em] text-[#5c6470]">
                  Anything the reviewer should know?
                  <span className="ml-[6px] font-normal text-[#9aa1ab]">optional</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="I rebuilt this on a breadboard and the pinout in step 4 was wrong…"
                  className="mt-[5px] w-full resize-y rounded-[9px] border border-black/12 px-[11px] py-[7px] text-[14px] leading-[1.5] outline-none placeholder:text-[#c3c8ce] focus:border-[var(--jolts-accent)]"
                />
              </fieldset>

              {revising && (
                <p className="mt-[12px] flex items-start gap-[7px] rounded-[10px] border border-black/[0.09] bg-[#fafafa] px-[12px] py-[9px] text-[12.5px] leading-[1.5] text-[#5c6470]">
                  <GitBranch size={14} weight="bold" className="mt-[2px] shrink-0" aria-hidden />
                  <span>
                    Adds a commit to your open pull request{" "}
                    <a
                      href={revising.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline underline-offset-2 hover:text-[#16181d]"
                    >
                      #{revising.number}
                    </a>{" "}
                    instead of opening a second one.
                  </span>
                </p>
              )}

              {foreignPr && (
                <p className="mt-[12px] flex items-start gap-[7px] rounded-[10px] border border-[#FF902F]/30 bg-[#fff8f0] px-[12px] py-[9px] text-[12.5px] leading-[1.5] text-[#95591b]">
                  <WarningCircle size={14} weight="fill" className="mt-[2px] shrink-0" aria-hidden />
                  <span>
                    You already have{" "}
                    <a
                      href={foreignPr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline underline-offset-2 hover:text-[#16181d]"
                    >
                      #{foreignPr.number}
                    </a>{" "}
                    open on this page, saved from another browser. This one
                    can&rsquo;t add to it without dropping what it contains, so
                    saving here opens a separate pull request.
                  </span>
                </p>
              )}

              {others.length > 0 && (
                <p className="mt-[10px] flex items-start gap-[7px] rounded-[10px] border border-[#FF902F]/30 bg-[#fff8f0] px-[12px] py-[9px] text-[12.5px] leading-[1.5] text-[#95591b]">
                  <WarningCircle size={14} weight="fill" className="mt-[2px] shrink-0" aria-hidden />
                  <span>
                    @{others[0].author} has an open pull request on this page (
                    <a
                      href={others[0].url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline underline-offset-2 hover:text-[#16181d]"
                    >
                      #{others[0].number}
                    </a>
                    ). Yours may overlap.
                  </span>
                </p>
              )}

              <ChangeList changes={changes} counts={counts} />

              {/* ---------- progress ---------- */}
              {phase === "working" && (
                <ol className="mt-[14px] space-y-[7px] rounded-[10px] border border-black/[0.08] bg-[#fafafa] px-[13px] py-[11px]">
                  {steps.map((step) => {
                    const state = stepStates[step.id]
                    const Icon = state === "done" ? CheckCircle : step.icon
                    return (
                      <li
                        key={step.id}
                        className={cn(
                          "flex items-center gap-[9px] text-[13.5px] transition-colors",
                          state === "pending" && "text-[#c3c8ce]",
                          state === "active" && "font-medium text-[#16181d]",
                          state === "done" && "text-[#067A54]"
                        )}
                      >
                        {state === "active" ? (
                          <CircleNotch
                            size={15}
                            weight="bold"
                            className="animate-spin"
                            style={{ color: chromeTheme.accent }}
                            aria-hidden
                          />
                        ) : (
                          <Icon
                            size={15}
                            weight={state === "done" ? "fill" : "bold"}
                            aria-hidden
                          />
                        )}
                        {step.id === "images" && state === "active"
                          ? `Uploading photos - ${uploaded + 1} of ${imageCount}`
                          : step.label}
                      </li>
                    )
                  })}
                </ol>
              )}

              {error && (
                <p className="mt-[12px] flex items-start gap-[7px] rounded-[10px] border border-[#d43c3c]/25 bg-[#fdecec] px-[12px] py-[9px] text-[13px] leading-[1.5] text-[#a12222]">
                  <WarningCircle size={15} weight="fill" className="mt-[1.5px] shrink-0" aria-hidden />
                  <span>{error}</span>
                </p>
              )}

              <button
                type="button"
                disabled={!canSave || phase === "working"}
                onClick={save}
                className={cn(
                  "mt-[16px] flex w-full items-center justify-center gap-[8px] rounded-[10px] py-[10px] text-[15px] font-semibold tracking-[-0.01em] transition-all",
                  canSave && phase !== "working"
                    ? "bg-[#16181d] text-white hover:bg-black"
                    : "cursor-not-allowed bg-black/[0.06] text-black/30"
                )}
              >
                {phase === "working" ? (
                  <>
                    <CircleNotch size={17} weight="bold" className="animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  <>
                    <GitPullRequest size={17} weight="bold" aria-hidden />
                    {revising ? `Update #${revising.number}` : "Open pull request"}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </CheckerFrame>
      </div>
    </div>
  )
}

/* ---------- pieces ---------- */

function Connect({
  onConnect,
  connecting,
  reconnect,
}: {
  onConnect: () => void
  connecting: boolean
  reconnect: boolean
}) {
  return (
    <div className="rounded-[11px] border border-black/[0.09] bg-[#fafafa] p-[15px]">
      <p className="flex items-center gap-[8px] text-[14.5px] font-semibold tracking-[-0.01em] text-[#16181d]">
        <GithubMark size={17} />
        {reconnect ? "Reconnect GitHub" : "Connect GitHub to save"}
      </p>
      <p className="mt-[5px] text-[13px] leading-[1.55] text-[#5c6470]">
        After logging in, we&rsquo;ll open a Pull Request to Jolts with your
        account.
      </p>
      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className="mt-[12px] flex w-full items-center justify-center gap-[8px] rounded-[10px] bg-[#16181d] py-[9px] text-[14.5px] font-semibold tracking-[-0.01em] text-white transition-colors hover:bg-black disabled:opacity-60"
      >
        {connecting ? (
          <>
            <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden />
            Waiting for GitHub…
          </>
        ) : (
          <>
            <GithubMark size={16} />
            {reconnect ? "Reconnect with GitHub" : "Continue with GitHub"}
          </>
        )}
      </button>
    </div>
  )
}

function Identity({
  user,
  onSwitch,
  busy,
}: {
  user: GhUser
  onSwitch: () => void
  busy: boolean
}) {
  return (
    <div className="flex items-center gap-[10px] rounded-[11px] border border-black/[0.08] px-[12px] py-[9px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={user.avatarUrl}
        alt=""
        width={28}
        height={28}
        className="size-[28px] shrink-0 rounded-full bg-[#f3f3f3]"
      />
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-[#5c6470]">
        Saving as{" "}
        <span className="font-semibold text-[#16181d]">@{user.login}</span>
      </span>
      <button
        type="button"
        onClick={onSwitch}
        disabled={busy}
        className="flex shrink-0 items-center gap-[5px] rounded-[7px] px-[7px] py-[4px] text-[12px] font-medium text-[#9aa1ab] transition-colors hover:bg-black/[0.05] hover:text-[#16181d] disabled:opacity-30"
      >
        <SignOut size={13} weight="bold" aria-hidden />
        Not you?
      </button>
    </div>
  )
}

function ChangeList({
  changes,
  counts,
}: {
  changes: FileChange[]
  counts: { plus: number; minus: number }[]
}) {
  return (
    <div className="mt-[16px] overflow-hidden rounded-[10px] border border-black/[0.08]">
      <p className="border-b border-black/[0.06] bg-[#fafafa] px-[12px] py-[6px] text-[11px] font-semibold tracking-[0.03em] text-[#9aa1ab] uppercase">
        {changes.length} file{changes.length === 1 ? "" : "s"} in this pull request
      </p>
      <ul className="max-h-[180px] divide-y divide-black/[0.05] overflow-y-auto">
        {changes.map((c, i) => {
          const meta = KIND_META[c.kind]
          const Icon = meta.icon
          const { plus, minus } = counts[i]
          return (
            <li key={c.path + c.kind} className="flex items-center gap-[9px] px-[12px] py-[6px]">
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
  )
}

function Success({ result, updated }: { result: PullRequestResult; updated: boolean }) {
  return (
    <div>
      <div className="rounded-[11px] border border-[#14B87A]/30 bg-[#E9FAF3] px-[15px] py-[13px]">
        <p className="flex items-center gap-[7px] text-[14.5px] font-semibold text-[#067A54]">
          <CheckCircle size={17} weight="fill" aria-hidden />
          Pull request #{result.number} {updated ? "updated" : "is open"}
        </p>
      </div>

      <a
        href={result.url}
        target="_blank"
        rel="noreferrer"
        className="mt-[14px] flex w-full items-center justify-center gap-[8px] rounded-[10px] bg-[#16181d] py-[10px] text-[15px] font-semibold tracking-[-0.01em] text-white transition-colors hover:bg-black"
      >
        <GitPullRequest size={17} weight="bold" aria-hidden />
        View pull request
        <ArrowSquareOut size={14} weight="bold" aria-hidden />
      </a>

      <dl className="mt-[13px] space-y-[5px] text-[12px] text-[#9aa1ab]">
        <div className="flex gap-[8px]">
          <dt className="w-[52px] shrink-0">Branch</dt>
          <dd className="min-w-0 truncate font-mono text-[#5c6470]">{result.branch}</dd>
        </div>
        <div className="flex gap-[8px]">
          <dt className="w-[52px] shrink-0">Fork</dt>
          <dd className="min-w-0 truncate font-mono text-[#5c6470]">{result.fork}</dd>
        </div>
      </dl>
    </div>
  )
}
