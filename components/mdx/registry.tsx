import {
  ArrowUpRight,
  CheckCircle,
  Lightbulb,
  Package,
  RocketLaunch,
  Warning as WarningIcon,
  Wrench,
} from "@phosphor-icons/react/dist/ssr"
import type { MDXComponents } from "mdx/types"

import {
  CheckerFrame,
  FlagFrame,
  type FrameTheme,
} from "@/components/checker-frame"
import { PreviewLink, type PreviewTheme } from "@/components/preview-link"
import {
  contentImageUrl,
  getEntry,
  plainExcerpt,
  slugifyHeading,
  type Entry,
  type GuideMeta,
} from "@/lib/content"
import { typeTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

/* The closed component registry. Authors never write arbitrary JSX - these
   ~12 blocks are the whole vocabulary, which keeps guides consistent and
   makes a WYSIWYG editor possible (each block round-trips as a form).

   Design intent (Read surface): the article is typography and whitespace.
   Grouping comes from proximity and hairlines, not containers - the only
   tinted surfaces are Warning/Checkpoint (they signal state) and the one
   loud moment at the end (ShipIt). Cross-links carry Wikipedia-style
   hover previews baked in at build time.

   Everything except PreviewLink is a server component: guides ship almost
   zero client JS. Blocks are bound per-entry (getMDXComponents) so they can
   read frontmatter, resolve relative images, and inherit the content type's
   accent via --guide-accent on the article wrapper. */

/* ---------- Step - the iFixit-style unit of instruction ---------- */

export function Step({
  title,
  image,
  alt,
  children,
}: {
  title: string
  image?: string
  alt?: string
  children?: React.ReactNode
}) {
  return (
    <section
      id={slugifyHeading(title)}
      className="jolts-step mt-[40px] scroll-mt-[24px]"
    >
      {/* the step heading is one two-segment tab: "Step N" in the guide
          accent with the tilted flag edge, continuing into a grey segment
          that carries the title */}
      <h3 className="flex items-stretch text-[17px] font-semibold tracking-[-0.03em]">
        {/* accent segment: the body's right edge is clipped diagonally so
            nothing can leak past the seam, and a skewed rounded cap rides
            the same diagonal (outside the clipped span - clip-path clips
            children) to keep the flag tip fluid */}
        <span aria-hidden className="relative z-10 flex shrink-0">
          <span
            className="absolute top-0 right-[4px] h-full w-[18px] -skew-x-[16deg] rounded-r-[7px]"
            style={{ background: "var(--guide-accent, #01A6FF)" }}
          />
          <span
            className="relative flex items-center gap-[4px] rounded-l-[8px] py-[5px] pr-[15px] pl-[13px] text-[13px] tracking-[-0.02em] text-white"
            style={{
              background: "var(--guide-accent, #01A6FF)",
              clipPath:
                "polygon(0 0, calc(100% - 9px) 0, calc(100% - 18px) 100%, 0 100%)",
            }}
          >
            <span>Step</span>
            <span className="jolts-step-num tabular-nums" />
          </span>
        </span>
        <span className="-ml-[20px] min-w-0 rounded-r-[8px] bg-[#f3f3f3] py-[5px] pr-[16px] pl-[30px] text-[#16181d]">
          {title}
        </span>
      </h3>
      <div
        className={cn(
          "mt-[14px] grid gap-x-[26px] gap-y-[14px]",
          image ? "sm:grid-cols-[minmax(0,44%)_minmax(0,1fr)]" : ""
        )}
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={alt ?? title}
            loading="lazy"
            className="!my-0 aspect-[4/3] w-full rounded-[8px] border border-black/10 object-cover"
          />
        )}
        <div className="jolts-step-body min-w-0 text-[15.5px] leading-[1.65] tracking-[-0.01em]">
          {children}
        </div>
      </div>
    </section>
  )
}

/* ---------- PartsList - renders from the guide's frontmatter ---------- */

function PartsListFor({ entry }: { entry: Entry }) {
  if (entry.meta.type !== "guide") return null
  const meta = entry.meta as GuideMeta
  const theme = typeTheme[entry.contentType]
  return (
    <CheckerFrame theme={theme} className="my-[36px]" checkerSize={150}>
      <div className="relative rounded-[7px] bg-white px-[15px] py-[13px]">
      <div className="flex items-baseline justify-between pb-[12px]">
        <h3 className="!m-0 flex items-center gap-[9px] text-[17px] font-semibold tracking-[-0.03em] text-[#16181d]">
          <Package size={19} weight="fill" style={{ color: theme.accent }} aria-hidden />
          What you need
        </h3>
        <span className="text-[13.5px] tracking-[-0.01em] text-[#5c6470]">
          {meta.cost} total
        </span>
      </div>
      <ul className="!m-0 grid !list-none grid-cols-1 gap-[10px] !p-0 sm:grid-cols-2">
        {meta.parts.map((part) => {
          const inner = (
            <>
              {part.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contentImageUrl(entry.contentType, entry.slug, part.image)}
                  alt=""
                  loading="lazy"
                  className="!my-0 size-[54px] shrink-0 rounded-[8px] border border-black/[0.08] bg-white object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex size-[54px] shrink-0 items-center justify-center rounded-[8px] bg-black/[0.04]"
                >
                  <Package size={22} weight="duotone" className="text-black/25" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-[6px] text-[14.5px] leading-[1.3] font-semibold tracking-[-0.02em] text-[#16181d]">
                  <span className="truncate">{part.name}</span>
                  {part.link && (
                    <ArrowUpRight
                      size={11}
                      weight="bold"
                      className="shrink-0 self-center text-[#9aa1ab] transition-colors group-hover/part:text-[#16181d]"
                      aria-hidden
                    />
                  )}
                </span>
                {part.note && (
                  <span className="mt-[1px] block truncate text-[12.5px] tracking-[-0.01em] text-[#9aa1ab]">
                    {part.note}
                  </span>
                )}
                <span className="mt-[3px] block text-[12.5px] tracking-[-0.01em] text-[#5c6470] tabular-nums">
                  {part.qty}×{part.cost && <span className="text-[#9aa1ab]"> · {part.cost}</span>}
                </span>
              </span>
            </>
          )
          const tileClass =
            "group/part !m-0 flex items-center gap-[12px] rounded-[10px] border border-black/[0.08] p-[9px]"
          return (
            <li key={part.name} className="!m-0 contents">
              {part.link ? (
                <a
                  href={part.link}
                  target="_blank"
                  rel="noreferrer"
                  className={
                    tileClass +
                    " bg-white no-underline transition-colors duration-150 hover:border-black/25"
                  }
                >
                  {inner}
                </a>
              ) : (
                <span className={tileClass + " bg-white"}>{inner}</span>
              )}
            </li>
          )
        })}
      </ul>
      </div>
    </CheckerFrame>
  )
}

/* ---------- cross-link chips with hover previews ---------- */

/* Chips are the linking discipline made visible in the prose, and the
   hover pane wears the navigation dropdown's checker chrome in the
   destination type's family. */

const conceptPreviewTheme: PreviewTheme = {
  accent: "#A633D6",
  checkerA: "#BB4FE8",
  checkerB: "#A633D6",
  wash: "222,141,255",
  chipBg: "#F8EEFC",
  chipText: "#8A21B8",
  chipHoverBg: "#F0DFF8",
}

const toolPreviewTheme: PreviewTheme = {
  accent: "#0EBF80",
  checkerA: "#33D6A6",
  checkerB: "#14C98F",
  wash: "141,255,216",
  chipBg: "#E9FAF3",
  chipText: "#067A54",
  chipHoverBg: "#DCF5EA",
}

function ConceptLinkInline({
  slug,
  children,
}: {
  slug: string
  children?: React.ReactNode
}) {
  const concept = getEntry("concepts", slug)
  if (!concept) return <span>{children ?? slug}</span>
  return (
    <PreviewLink
      href={`/concepts/${concept.slug}`}
      theme={conceptPreviewTheme}
      icon={<Lightbulb size={14} weight="fill" aria-hidden />}
      kindLabel="Concept"
      title={concept.meta.title}
      excerpt={plainExcerpt(concept.body)}
    >
      {children ?? concept.meta.title}
    </PreviewLink>
  )
}

function ToolLinkInline({
  slug,
  children,
}: {
  slug: string
  children?: React.ReactNode
}) {
  const tool = getEntry("tools", slug)
  if (!tool) return <span>{children ?? slug}</span>
  const cost = tool.meta.type === "tool" ? tool.meta.cost : undefined
  return (
    <PreviewLink
      href={`/tools/${tool.slug}`}
      theme={toolPreviewTheme}
      icon={<Wrench size={14} weight="fill" aria-hidden />}
      kindLabel="Tool"
      title={tool.meta.title}
      excerpt={plainExcerpt(tool.body)}
      meta={cost ? `Costs about ${cost}` : undefined}
    >
      {children ?? tool.meta.title}
    </PreviewLink>
  )
}

/* ---------- Warning / Checkpoint - framed, flag on the left ---------- */

/* same family as ShipIt / the Start-here card */
const warningFrame: FrameTheme = {
  accent: "#FF902F",
  checkerA: "#FFBA01",
  checkerB: "#FF9D00",
  wash: "255,211,1",
}

const checkpointFrame: FrameTheme = {
  accent: "#14B87A",
  checkerA: "#2FCB8F",
  checkerB: "#14B87A",
  wash: "150,255,210",
}

export function Warning({
  title = "Careful",
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <aside className="my-[30px]">
      <FlagFrame
        theme={warningFrame}
        label={title}
        icon={<WarningIcon size={15} weight="fill" aria-hidden />}
      >
        <div className="jolts-tight text-[14.5px] leading-[1.6] tracking-[-0.01em] text-[#5c6470]">
          {children}
        </div>
      </FlagFrame>
    </aside>
  )
}

export function Checkpoint({
  title = "Checkpoint",
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <aside className="my-[30px]">
      <FlagFrame
        theme={checkpointFrame}
        label={title}
        icon={<CheckCircle size={15} weight="fill" aria-hidden />}
      >
        <div className="jolts-tight text-[14.5px] leading-[1.6] tracking-[-0.01em] text-[#5c6470]">
          {children}
        </div>
      </FlagFrame>
    </aside>
  )
}

/* ---------- Schematic / figure ---------- */

function SchematicFor({
  entry,
  src,
  alt,
  caption,
}: {
  entry: Entry
  src: string
  alt: string
  caption?: string
}) {
  return (
    <figure className="my-[30px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={contentImageUrl(entry.contentType, entry.slug, src)}
        alt={alt}
        loading="lazy"
        className="!my-0 w-full rounded-[8px] border border-black/10 bg-white"
      />
      {caption && (
        <figcaption className="mt-[8px] text-[13px] tracking-[-0.01em] text-[#9aa1ab]">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

/* ---------- Video (YouTube embed) ---------- */

export function Video({ id, title }: { id: string; title: string }) {
  return (
    <div className="my-[30px]">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-[8px] border border-black/10"
      />
    </div>
  )
}

/* ---------- PinTable ---------- */

export function PinTable({
  pins,
  children,
}: {
  pins?: { pin: string; signal: string; note?: string }[]
  children?: React.ReactNode
}) {
  if (!pins) return <div className="jolts-pintable">{children}</div>
  return (
    <table className="my-[30px] w-full border-collapse text-[14px] tracking-[-0.01em]">
      <thead>
        <tr className="border-b border-black/15 text-left text-[12.5px] font-semibold tracking-[0.01em] text-[#9aa1ab] uppercase">
          <th className="py-[7px] pr-[16px] font-semibold">Pin</th>
          <th className="py-[7px] pr-[16px] font-semibold">Connects to</th>
          <th className="py-[7px] font-semibold">Why</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-black/[0.07]">
        {pins.map((p) => (
          <tr key={p.pin + p.signal}>
            <td className="py-[8px] pr-[16px] font-mono text-[13px] font-medium text-[#16181d]">
              {p.pin}
            </td>
            <td className="py-[8px] pr-[16px] text-[#16181d]">{p.signal}</td>
            <td className="py-[8px] text-[#5c6470]">{p.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------- Difficulty (inline chip, also used in page headers) ---------- */

export function Difficulty({
  level,
}: {
  level: "beginner" | "intermediate" | "advanced"
}) {
  const filled = { beginner: 1, intermediate: 2, advanced: 3 }[level]
  return (
    <span className="inline-flex items-center gap-[7px] text-[14px] tracking-[-0.01em] text-[#5c6470] capitalize">
      <span className="flex gap-[3px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className="size-[7px] rounded-full"
            style={{
              background:
                i <= filled ? "var(--guide-accent, #FF902F)" : "rgba(0,0,0,0.12)",
            }}
          />
        ))}
      </span>
      {level}
    </span>
  )
}

/* ---------- ReadMore + ExternalGuide - further reading, done elegantly ---------- */

/* Jolts is the front door, not the whole library - deep dives link out.
   Wrap the guide-end links in <ReadMore>; a lone <ExternalGuide> mid-article
   works too. */

export function ReadMore({ children }: { children: React.ReactNode }) {
  return (
    <aside className="mt-[44px]">
      <div className="flex items-center gap-[14px]">
        <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#16181d]">
          Read more
        </h2>
        <span aria-hidden className="h-px flex-1 bg-black/10" />
      </div>
      <div className="mt-[12px] flex flex-col gap-[8px] [&>*]:!my-0">
        {children}
      </div>
    </aside>
  )
}

export function ExternalGuide({
  href,
  title,
  source,
  children,
}: {
  href: string
  title: string
  source?: string
  children?: React.ReactNode
}) {
  let domain = source
  if (!domain) {
    try {
      domain = new URL(href).hostname.replace(/^www\./, "")
    } catch {
      domain = href
    }
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group my-[26px] block rounded-[10px] border border-black/[0.08] bg-[#fbfbfc] px-[15px] py-[11px] no-underline transition-colors duration-150 hover:border-black/20 hover:bg-white"
    >
      <span className="flex items-baseline gap-[8px] text-[15px] tracking-[-0.01em]">
        <span className="font-semibold text-[#16181d]">{title}</span>
        <span className="text-[13px] text-[#9aa1ab]">· {domain}</span>
        <ArrowUpRight
          size={14}
          weight="bold"
          className="ml-auto shrink-0 self-center text-[#9aa1ab] transition-transform duration-150 group-hover:translate-x-[1px] group-hover:-translate-y-[1px] group-hover:text-[#16181d]"
          aria-hidden
        />
      </span>
      <span className="jolts-tight mt-[2px] block text-[13.5px] leading-[1.55] tracking-[-0.01em] text-[#5c6470] [&_p]:!text-[13.5px] [&_p]:!leading-[1.55]">
        {children ?? `Deep dive on ${domain}.`}
      </span>
    </a>
  )
}

/* ---------- ShipIt - the page's one loud moment ---------- */

function ShipItFor({ entry, children }: { entry: Entry; children?: React.ReactNode }) {
  const theme = typeTheme[entry.contentType]
  return (
    <aside
      className="relative mt-[48px] overflow-hidden rounded-[12px] p-[6px]"
      style={{ background: theme.accent }}
    >
      {/* rotated checkerboard chrome, same family as the header */}
      <div
        aria-hidden
        className="absolute -inset-[60%] rotate-[-12deg]"
        style={{
          backgroundImage: `conic-gradient(${theme.checkerA} 0 25%, ${theme.checkerB} 0 50%, ${theme.checkerA} 0 75%, ${theme.checkerB} 0)`,
          backgroundSize: "150px 150px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(${theme.wash},0) 0%, rgba(${theme.wash},0.55) 100%)`,
        }}
      />
      <div className="relative rounded-[7px] bg-white px-[22px] py-[18px]">
        <p className="!m-0 flex items-center gap-[9px] text-[20px] font-semibold tracking-[-0.03em] text-[#16181d]">
          <RocketLaunch size={22} weight="fill" style={{ color: theme.accent }} aria-hidden />
          Ship it!
        </p>
        <div className="jolts-tight mt-[4px] text-[14.5px] leading-[1.6] tracking-[-0.01em] text-[#5c6470]">
          {children ?? (
            <p>
              Built it? Post a photo in{" "}
              <a
                href="https://hackclub.slack.com/channels/ship"
                className="font-semibold text-[#16181d] underline decoration-black/25 underline-offset-[3px] hover:decoration-black"
              >
                #ship on the Hack Club Slack
              </a>{" "} - and if you changed something, improve this guide with a pull
              request. Your name goes on it.
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}

/* ---------- prose defaults for plain markdown ---------- */

/* text content of a heading's children, for stable anchor ids */
function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node.props as { children?: React.ReactNode }).children)
  }
  return ""
}

function proseComponents(entry: Entry): MDXComponents {
  return {
    h2: (props) => (
      <h2
        id={slugifyHeading(textOf(props.children))}
        className="mt-[48px] mb-[12px] scroll-mt-[24px] text-[26px] font-semibold tracking-[-0.03em] text-[#16181d]"
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="mt-[34px] mb-[8px] text-[20px] font-semibold tracking-[-0.03em] text-[#16181d]"
        {...props}
      />
    ),
    p: (props) => (
      <p
        className="my-[14px] text-[15.5px] leading-[1.7] tracking-[-0.01em] text-[#33383f]"
        {...props}
      />
    ),
    a: (props) => (
      <a
        className="font-medium text-[#16181d] underline decoration-black/25 decoration-[1.5px] underline-offset-[3px] transition-colors duration-150 hover:decoration-black"
        {...props}
      />
    ),
    ul: (props) => (
      <ul
        className="my-[14px] list-disc space-y-[6px] pl-[20px] text-[15.5px] leading-[1.65] tracking-[-0.01em] text-[#33383f] marker:text-[var(--guide-accent)]"
        {...props}
      />
    ),
    ol: (props) => (
      <ol
        className="my-[14px] list-decimal space-y-[6px] pl-[20px] text-[15.5px] leading-[1.65] tracking-[-0.01em] text-[#33383f] marker:font-semibold marker:text-[#9aa1ab]"
        {...props}
      />
    ),
    code: (props) => (
      <code
        className="rounded-[4px] bg-black/[0.055] px-[5px] py-[1.5px] font-mono text-[0.88em] text-[#16181d]"
        {...props}
      />
    ),
    pre: (props) => (
      <pre
        className="my-[20px] overflow-x-auto rounded-[10px] bg-[#15181d] p-[18px] text-[13.5px] leading-[1.6] text-[#e8eaed] [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit"
        {...props}
      />
    ),
    blockquote: (props) => (
      <blockquote
        className="my-[20px] border-l pl-[16px] text-[#5c6470] italic"
        style={{ borderColor: "var(--guide-accent)" }}
        {...props}
      />
    ),
    hr: () => <hr className="my-[36px] border-black/10" />,
    table: (props) => (
      <div className="my-[20px] overflow-x-auto">
        <table
          className="w-full border-collapse text-[14px] tracking-[-0.01em] [&_td]:border-t [&_td]:border-black/[0.07] [&_td]:py-[8px] [&_td]:pr-[16px] [&_th]:border-b [&_th]:border-black/15 [&_th]:py-[7px] [&_th]:pr-[16px] [&_th]:text-left [&_th]:text-[12.5px] [&_th]:font-semibold [&_th]:tracking-[0.01em] [&_th]:text-[#9aa1ab] [&_th]:uppercase"
          {...props}
        />
      </div>
    ),
    img: ({ src, alt, ...rest }) => (
      // natural size, never upscaled: small UI screenshots stay small,
      // big photos cap at the column width and a sane height
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={contentImageUrl(entry.contentType, entry.slug, String(src ?? ""))}
        alt={alt ?? ""}
        loading="lazy"
        className="my-[20px] block h-auto max-h-[480px] w-auto max-w-full rounded-[8px] border border-black/10"
        {...rest}
      />
    ),
  }
}

/* ---------- the registry, bound to one guide ---------- */

export function getMDXComponents(entry: Entry): MDXComponents {
  return {
    ...proseComponents(entry),
    Step: ({ image, ...props }: React.ComponentProps<typeof Step>) => (
      <Step
        {...props}
        image={
          image ? contentImageUrl(entry.contentType, entry.slug, image) : undefined
        }
      />
    ),
    PartsList: () => <PartsListFor entry={entry} />,
    Tool: ToolLinkInline,
    Warning,
    Checkpoint,
    Schematic: (props: { src: string; alt: string; caption?: string }) => (
      <SchematicFor entry={entry} {...props} />
    ),
    Video,
    PinTable,
    Difficulty,
    ConceptLink: ConceptLinkInline,
    ExternalGuide,
    ReadMore,
    ShipIt: (props: { children?: React.ReactNode }) => (
      <ShipItFor entry={entry} {...props} />
    ),
  }
}
