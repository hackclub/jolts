"use client"

import { useEffect, useMemo, useState } from "react"

import Link from "next/link"

import {
  ArrowRight,
  Lightbulb,
  PencilSimple,
  RocketLaunch,
  Trash,
  Wrench,
} from "@phosphor-icons/react"

import type { LinkIndex } from "@/components/editor/context"
import { EditorShell } from "@/components/editor/editor-shell"
import { slugifyHeading, type ContentType } from "@/lib/content-schema"
import { deleteDraft, listDrafts, type Draft } from "@/lib/editor/draft-db"
import { typeTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

/* The start screen for writing something new: pick what it is, name it,
   and land straight in the editor. The slug is derived from the title
   but stays editable - it becomes the folder name and the URL. */

const TYPE_CARDS: {
  type: ContentType
  icon: typeof RocketLaunch
  what: string
  bar: string
}[] = [
  {
    type: "guides",
    icon: RocketLaunch,
    what: "“Make this specific thing” - steps, parts, photos.",
    bar: "The bar: would a teen show it off, use it daily, or keep it alive a week later?",
  },
  {
    type: "concepts",
    icon: Lightbulb,
    what: "“Understand this idea” - voltage, I2C, pull-ups.",
    bar: "The bar: true, clear, and linked from somewhere.",
  },
  {
    type: "tools",
    icon: Wrench,
    what: "“How to use this thing” - irons, multimeters, KiCad.",
    bar: "The bar: true, clear, and linked from somewhere.",
  },
]

export function NewEntryFlow({
  linkIndex,
  existingSlugs,
}: {
  linkIndex: LinkIndex
  existingSlugs: Record<ContentType, string[]>
}) {
  const [type, setType] = useState<ContentType>("guides")
  const [title, setTitle] = useState("")
  const [slugEdited, setSlugEdited] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  /* local drafts: a NEW entry's draft has no page anywhere on the site,
     so this screen is where it resurfaces */
  const [drafts, setDrafts] = useState<Draft[]>([])
  useEffect(() => {
    let alive = true
    listDrafts().then((d) => {
      if (alive) setDrafts(d)
    })
    return () => {
      alive = false
    }
  }, [])

  const resumeDraft = (draft: Draft) => {
    const [t, ...rest] = draft.key.split("/")
    const s = rest.join("/")
    if (!(["guides", "concepts", "tools"] as string[]).includes(t)) return
    setType(t as ContentType)
    setSlugEdited(s)
    setTitle(draft.meta.title || s)
    setStarted(true) // EditorShell auto-restores the draft by its key
  }

  /* deep links carry intent: /edit/new?type=concepts&title=Decoupling -
     Wikipedia-style "create the page you just searched for" */
  useEffect(() => {
    // deliberate setState-in-effect: syncing FROM the URL (an external
    // system) exactly once - initializers can't, they also run during SSR
    const params = new URLSearchParams(window.location.search)
    const t = params.get("type")
    if (t && (["guides", "concepts", "tools"] as string[]).includes(t)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setType(t as ContentType)
    }
    const wanted = params.get("title")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wanted) setTitle(wanted)
  }, [])

  const slug = slugEdited ?? slugifyHeading(title)
  const taken = slug !== "" && existingSlugs[type].includes(slug)
  const ready = title.trim().length > 0 && slug.length > 0 && !taken
  const theme = typeTheme[type]

  const shellKey = useMemo(() => `${type}/${slug}`, [type, slug])

  if (started) {
    return (
      <EditorShell
        key={shellKey}
        contentType={type}
        slug={slug}
        mode="create"
        files={[]}
        linkIndex={linkIndex}
        existingImages={[]}
        initialTitle={title.trim()}
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-[28px] pt-[48px] pb-[80px]">
      <h1 className="font-augie text-[42px] leading-[1.05] text-[#16181d]">
        Write something new
      </h1>
      <p className="mt-[10px] text-[16px] leading-[1.55] tracking-[-0.01em] text-[#5c6470]">
        Everything on Jolts is written by people who built the thing. Your
        name goes on the page.
      </p>

      {drafts.length > 0 && (
        <div className="mt-[24px]">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#5c6470]">
            Pick up where you left off
            <span className="ml-[6px] font-normal text-[#9aa1ab]">
              drafts live in this browser
            </span>
          </h2>
          <div className="mt-[8px] flex flex-col gap-[6px]">
            {drafts.map((draft) => {
              const [t, ...rest] = draft.key.split("/")
              const s = rest.join("/")
              if (!(["guides", "concepts", "tools"] as string[]).includes(t))
                return null
              const dtype = t as ContentType
              const dtheme = typeTheme[dtype]
              const exists = existingSlugs[dtype]?.includes(s)
              const inner = (
                <>
                  <PencilSimple
                    size={15}
                    weight="fill"
                    style={{ color: dtheme.accent }}
                    className="shrink-0"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold tracking-[-0.02em] text-[#16181d]">
                      {draft.meta.title || s}
                    </span>
                    <span className="block text-[12px] tracking-[-0.01em] text-[#9aa1ab]">
                      {exists ? `edits to an existing ${dtheme.label.toLowerCase()}` : `new ${dtheme.label.toLowerCase()}`} ·
                      saved {new Date(draft.savedAt).toLocaleString()}
                    </span>
                  </span>
                </>
              )
              return (
                <div
                  key={draft.key}
                  className="group flex items-center gap-[11px] rounded-[10px] border border-black/[0.09] px-[13px] py-[9px] transition-colors hover:border-black/25"
                >
                  {exists ? (
                    <Link
                      href={`/edit/${dtype}/${s}`}
                      className="flex min-w-0 flex-1 items-center gap-[11px]"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => resumeDraft(draft)}
                      className="flex min-w-0 flex-1 items-center gap-[11px] text-left"
                    >
                      {inner}
                    </button>
                  )}
                  <button
                    type="button"
                    title="Delete this draft"
                    onClick={async () => {
                      await deleteDraft(draft.key)
                      setDrafts((d) => d.filter((x) => x.key !== draft.key))
                    }}
                    className="shrink-0 rounded-[6px] p-[4px] text-[#c2c7ce] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#fdecec] hover:text-[#d43c3c]"
                  >
                    <Trash size={14} weight="bold" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-[26px] grid gap-[10px] sm:grid-cols-3">
        {TYPE_CARDS.map((card) => {
          const t = typeTheme[card.type]
          const active = type === card.type
          const Icon = card.icon
          return (
            <button
              key={card.type}
              type="button"
              onClick={() => setType(card.type)}
              className={cn(
                "rounded-[12px] border p-[14px] text-left transition-all",
                active
                  ? "border-transparent shadow-[0px_4px_14px_-2px_rgba(0,0,0,0.18)]"
                  : "border-black/10 hover:border-black/25"
              )}
              style={active ? { boxShadow: `inset 0 0 0 2px ${t.accent}` } : undefined}
            >
              <Icon
                size={20}
                weight="fill"
                style={{ color: t.accent }}
                aria-hidden
              />
              <span className="mt-[7px] block text-[15px] font-semibold tracking-[-0.02em] text-[#16181d]">
                {t.label}
              </span>
              <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-[#5c6470]">
                {card.what}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-[10px] text-[12.5px] leading-[1.5] text-[#9aa1ab]">
        {TYPE_CARDS.find((c) => c.type === type)?.bar}
      </p>

      <label className="mt-[24px] block text-[13px] font-semibold tracking-[-0.01em] text-[#5c6470]">
        What&rsquo;s it called?
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={
          type === "guides"
            ? "Macropad"
            : type === "concepts"
              ? "Decoupling capacitors"
              : "Oscilloscope"
        }
        autoFocus
        className="mt-[6px] w-full rounded-[10px] border border-black/12 px-[13px] py-[9px] text-[16px] outline-none focus:border-black/40"
      />
      <div className="mt-[8px] flex items-center gap-[4px] font-mono text-[12px] text-[#9aa1ab]">
        <span>content/{type}/</span>
        <input
          value={slug}
          onChange={(e) =>
            setSlugEdited(
              e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9-]+/g, "-")
                .replace(/^-+/, "")
            )
          }
          placeholder="slug"
          spellCheck={false}
          className="min-w-0 flex-1 border-none bg-transparent text-[12px] text-[#5c6470] outline-none"
        />
      </div>
      {taken && (
        <p className="mt-[6px] text-[12.5px] font-medium text-[#d43c3c]">
          That slug already exists - to improve the existing page, use its
          Edit button instead.
        </p>
      )}

      <button
        type="button"
        disabled={!ready}
        onClick={() => setStarted(true)}
        className={cn(
          "mt-[22px] inline-flex items-center gap-[9px] rounded-[10px] px-[18px] py-[10px] text-[15px] font-semibold tracking-[-0.01em] text-white transition-all",
          ready ? "hover:brightness-105" : "cursor-not-allowed opacity-40"
        )}
        style={{ background: theme.accent }}
      >
        Start writing
        <ArrowRight size={16} weight="bold" aria-hidden />
      </button>
    </div>
  )
}
