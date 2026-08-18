import Link from "next/link"

import { Clock, Coins, Wrench } from "@phosphor-icons/react/dist/ssr"

import { contentImageHasAlpha } from "@/lib/content-image"
import {
  authors,
  contentImageUrl,
  type GuideMeta,
  type Entry,
  type EntryMeta,
} from "@/lib/content"
import { difficultyLevel, typeTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

/* Hub presentation. Builds are a catalog of equivalent, photo-led items,
   so they earn cards - hairline-bordered, no shadows, with the checker
   band standing in until a real photo exists. Concepts and tools are
   reference pages reached from moments of need: they render as a plain
   list, hairline-divided, like an index. */

function DifficultyDots({ meta }: { meta: GuideMeta }) {
  const filled = difficultyLevel[meta.difficulty]
  return (
    <span className="inline-flex items-center gap-[6px] capitalize">
      <span className="flex gap-[2.5px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className="size-[6px] rounded-full"
            style={{
              background:
                i <= filled ? typeTheme.guides.accent : "rgba(0,0,0,0.12)",
            }}
          />
        ))}
      </span>
      {meta.difficulty}
    </span>
  )
}

function CheckerHero({
  entry,
  className,
}: {
  entry: Entry
  className?: string
}) {
  const theme = typeTheme[entry.contentType]
  const hero = entry.meta.hero
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="absolute -inset-[60%] rotate-[-8.66deg]"
        style={{
          backgroundImage: `conic-gradient(${theme.checkerA} 0 25%, ${theme.checkerB} 0 50%, ${theme.checkerA} 0 75%, ${theme.checkerB} 0)`,
          backgroundSize: "88px 88px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(67.21deg, rgba(${theme.wash},0) 0%, rgba(${theme.wash},0.75) 100%)`,
        }}
      />
      {hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={contentImageUrl(entry.contentType, entry.slug, hero)}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
      )}
    </div>
  )
}

/* The card is packaging, the project is the toy inside it: one continuous
   graph-paper surface (same material as the guide header card), the
   transparent render floating in the display window, and a hover that
   picks the whole thing up - lift, extra tilt, shadow bloom. Opaque
   photos fill the window instead; guides without art keep the checker. */
export async function GuideCard({ entry }: { entry: Entry<GuideMeta> }) {
  const meta = entry.meta
  const theme = typeTheme.guides
  const heroTransparent = meta.hero
    ? await contentImageHasAlpha(entry.contentType, entry.slug, meta.hero)
    : false

  return (
    <Link
      href={`/guides/${entry.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[14px] border border-black/10 bg-[#FCFCFA]"
    >
      {/* graph paper across the whole card, fading toward the text */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(22,24,29,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(22,24,29,0.05) 1px, transparent 1px)",
          backgroundSize: "21px 21px",
          maskImage: "linear-gradient(180deg, black 0%, rgba(0,0,0,0.25) 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, black 0%, rgba(0,0,0,0.25) 100%)",
        }}
      />
      {/* warm glow rising behind the display window */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(560px 320px at 50% -45%, ${theme.tint}, transparent 72%)`,
        }}
      />

      {/* display window */}
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden">
        {meta.hero && heroTransparent ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contentImageUrl(entry.contentType, entry.slug, meta.hero)}
            alt=""
            loading="lazy"
            className="max-h-[82%] w-[70%] rotate-[-2deg] object-contain [filter:drop-shadow(0px_10px_14px_rgba(0,0,0,0.25))]"
          />
        ) : meta.hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contentImageUrl(entry.contentType, entry.slug, meta.hero)}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <CheckerHero entry={entry} className="absolute inset-0" />
        )}
      </div>

      <div className="relative flex flex-1 flex-col px-[16px] pt-[2px] pb-[14px]">
        <h3 className="font-augie text-[21px] leading-[1.15] text-[#16181d] group-hover:underline [text-decoration-thickness:1.5px] [text-underline-offset:4px]">
          {meta.title}
        </h3>
        <p className="mt-[4px] line-clamp-2 text-[13.5px] leading-[1.5] tracking-[-0.01em] text-[#5c6470]">
          {meta.subtitle}
        </p>
        <p className="mt-auto flex flex-wrap items-center gap-x-[11px] gap-y-[4px] pt-[12px] text-[12.5px] tracking-[-0.01em] text-[#5c6470]">
          <DifficultyDots meta={meta} />
          <span className="inline-flex items-center gap-[5px]">
            <Clock size={13} weight="fill" className="text-[#9aa1ab]" aria-hidden />
            {meta.time}
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <Coins size={13} weight="fill" className="text-[#9aa1ab]" aria-hidden />
            {meta.cost}
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <Wrench size={13} weight="fill" className="text-[#9aa1ab]" aria-hidden />
            {meta.soldering ? "soldering" : "no soldering"}
          </span>
        </p>
      </div>
    </Link>
  )
}

/* Concepts and tools: an index list, not a card grid. */
export function EntryList({ entries }: { entries: Entry[] }) {
  return (
    <ul className="divide-y divide-black/[0.07]">
      {entries.map((entry) => {
        const meta = entry.meta as EntryMeta
        return (
          <li key={entry.slug}>
            <Link
              href={`/${entry.contentType}/${entry.slug}`}
              className="group flex flex-wrap items-baseline gap-x-[12px] gap-y-[2px] py-[13px]"
            >
              <span className="text-[16.5px] font-semibold tracking-[-0.02em] text-[#16181d] group-hover:underline [text-decoration-thickness:1.5px] [text-underline-offset:3px]">
                {meta.title}
              </span>
              <span className="min-w-0 flex-1 text-[13.5px] tracking-[-0.01em] text-[#5c6470]">
                {meta.subtitle}
              </span>
              {"cost" in meta && meta.cost && (
                <span className="shrink-0 text-[13px] tracking-[-0.01em] text-[#9aa1ab] tabular-nums">
                  {meta.cost}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://github.com/${name}.png?size=48`}
      alt=""
      width={22}
      height={22}
      loading="lazy"
      className="size-[22px] rounded-full border-2 border-white bg-black/5"
    />
  )
}

export function AuthorLine({ meta }: { meta: EntryMeta }) {
  const names = authors(meta)
  if (names.length === 0) return null
  return (
    <span className="inline-flex items-center gap-[7px] text-[13px] tracking-[-0.01em] text-[#5c6470]">
      by
      <span className="flex -space-x-[6px]">
        {names.map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </span>
      <span>
        {names.map((name, i) => (
          <span key={name}>
            {i > 0 && ", "}
            <a
              href={`https://github.com/${name}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#33383f] hover:underline [text-underline-offset:3px]"
            >
              @{name}
            </a>
          </span>
        ))}
      </span>
    </span>
  )
}

/* everyone who improved the guide after the author - avatar stack only,
   names on hover */
export function ContributorsLine({ names }: { names: string[] }) {
  if (names.length === 0) return null
  return (
    <span className="inline-flex items-center gap-[8px] text-[13px] tracking-[-0.01em] text-[#5c6470]">
      Contributors
      <span className="flex -space-x-[6px]">
        {names.map((name) => (
          <a
            key={name}
            href={`https://github.com/${name}`}
            target="_blank"
            rel="noreferrer"
            title={`@${name}`}
            className="transition-transform duration-150 hover:-translate-y-[2px]"
          >
            <Avatar name={name} />
          </a>
        ))}
      </span>
    </span>
  )
}
