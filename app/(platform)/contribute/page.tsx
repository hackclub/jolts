import type { Metadata } from "next"
import Link from "next/link"

import {
  ArrowUpRight,
  GitPullRequest,
  PencilSimple,
} from "@phosphor-icons/react/dist/ssr"

import { Breadcrumb } from "@/components/breadcrumb"

export const metadata: Metadata = {
  title: "Contribute - jolts",
  description:
    "Jolts is community-written. How to write a guide, the block registry, and how pull requests get reviewed.",
}

const REPO = "https://github.com/hackclub/jolts"

const registry = [
  ["<Step>", "one photo, one action"],
  ["<PartsList>", "renders the frontmatter parts table"],
  ["<Tool>", "chip linking to a tool page - never teach a tool inline"],
  ["<ConceptLink>", "inline link to a concept - never explain one inline"],
  ["<Warning>", "anything they shouldn't learn the hard way"],
  ["<Checkpoint>", "what they should have before building further"],
  ["<Schematic>", "wiring diagram or figure with a caption"],
  ["<PinTable>", "pin → signal → why"],
  ["<Video>", "embedded YouTube, for technique that reads badly"],
  ["<Difficulty>", "inline difficulty chip"],
  ["<ExternalGuide>", "link out to Codex, Adafruit, datasheets"],
  ["<ReadMore>", "wraps guide-end ExternalGuides into a further-reading section"],
  ["<ShipIt>", "the end-of-guide banner"],
] as const

export default function ContributePage() {
  return (
    <div className="mx-auto w-full max-w-[820px] px-[32px] pt-[40px]">
      <Breadcrumb trail={[{ label: "Contribute", href: "/contribute" }]} />
      <h1 className="text-[38px] leading-[1.08] font-semibold tracking-[-0.03em] text-black">
        Write a guide
      </h1>
      <p className="mt-[10px] max-w-[640px] text-[17px] leading-[1.55] tracking-[-0.01em] text-black/55">
        Every guide on Jolts was written by someone who built the thing.
      </p>

      <div className="mt-[22px] flex flex-wrap items-center gap-[10px]">
        <Link
          href="/edit/new"
          className="group inline-flex items-center gap-[9px] rounded-[9px] bg-[#FF902F] px-[18px] py-[11px] text-[15px] font-semibold tracking-[-0.02em] text-white transition-all duration-150 hover:brightness-105"
        >
          <PencilSimple size={18} weight="fill" aria-hidden />
          Write in the browser
        </Link>
        <a
          href={`${REPO}/new/main/content`}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-[9px] rounded-[9px] bg-[#16181d] px-[18px] py-[11px] text-[15px] font-semibold tracking-[-0.02em] text-white transition-colors duration-150 hover:bg-black"
        >
          <GitPullRequest size={18} weight="bold" aria-hidden />
          Start on GitHub
          <ArrowUpRight
            size={14}
            weight="bold"
            className="transition-transform duration-150 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]"
            aria-hidden
          />
        </a>
      </div>
      <p className="mt-[10px] text-[13px] tracking-[-0.01em] text-black/45">
        The visual editor shows the page as it will ship.
      </p>

      <h2 className="mt-[44px] text-[26px] font-semibold tracking-[-0.03em] text-black">
        How it works
      </h2>
      <ol className="mt-[12px] list-decimal space-y-[10px] pl-[22px] text-[15.5px] leading-[1.65] tracking-[-0.01em] text-black/75 marker:font-semibold marker:text-black/40">
        <li>
          Write in the browser (photos drop right in), or fork the repo and
          copy <code className="rounded-[5px] bg-[#f3f3f3] px-[5px] py-[1.5px] font-mono text-[0.88em]">content/TEMPLATE.mdx</code>{" "}
          into <code className="rounded-[5px] bg-[#f3f3f3] px-[5px] py-[1.5px] font-mono text-[0.88em]">content/guides/your-slug/index.mdx</code>{" "}
          (or concepts/tools). Take plenty of photos while you build.
        </li>
        <li>
          Write with the block registry below. Plain markdown for prose,
          blocks for structure - no arbitrary JSX.
        </li>
        <li>
          Hit <strong className="font-semibold text-black/85">Save changes</strong>{" "}
          and the editor opens a pull request for you. A reviewer goes
          through it with you before it ships.
        </li>
        <li>
          Once it merges, your guide is live with your name and GitHub avatar
          on it.
        </li>
      </ol>

      <h2 className="mt-[44px] text-[26px] font-semibold tracking-[-0.03em] text-black">
        The bar for guides
      </h2>
      <p className="mt-[10px] text-[15.5px] leading-[1.7] tracking-[-0.01em] text-black/75">
        A guide has to be clear, easy to follow, and structured well enough
        that someone can build the thing from it without getting lost.
        Concepts and tools are held to the same bar.
      </p>

      <h2 className="mt-[44px] text-[26px] font-semibold tracking-[-0.03em] text-black">
        The block registry
      </h2>
      <p className="mt-[10px] text-[15.5px] leading-[1.7] tracking-[-0.01em] text-black/75">
        These blocks are the whole vocabulary. Anything else fails CI.
      </p>
      <table className="mt-[14px] w-full border-collapse border-t border-black/10 text-[14px] tracking-[-0.01em]">
        <tbody className="divide-y divide-black/[0.07]">
          {registry.map(([tag, what]) => (
            <tr key={tag}>
              <td className="w-[160px] py-[8px] pr-[16px] font-mono text-[13px] font-medium whitespace-nowrap text-[#16181d]">
                {tag}
              </td>
              <td className="py-[8px] text-[#5c6470]">{what}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-[44px] text-[26px] font-semibold tracking-[-0.03em] text-black">
        Linking discipline
      </h2>
      <p className="mt-[10px] text-[15.5px] leading-[1.7] tracking-[-0.01em] text-black/75">
        Link to a concept page instead of explaining the concept inline, and
        to a tool page instead of teaching the tool. Guides stay short that
        way, and each idea is written once, where people go looking for it.
        For anything outside what Jolts covers, link out with <code className="rounded-[5px] bg-[#f3f3f3] px-[5px] py-[1.5px] font-mono text-[0.88em]">&lt;ExternalGuide&gt;</code>.
      </p>

      <h2 className="mt-[44px] text-[26px] font-semibold tracking-[-0.03em] text-black">
        Licensing
      </h2>
      <p className="mt-[10px] text-[15.5px] leading-[1.7] tracking-[-0.01em] text-black/75">
        By submitting a pull request you agree that your guide text, images,
        and design files (KiCad, STLs) are licensed{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/"
          className="font-medium text-black underline decoration-black/30 underline-offset-2 hover:decoration-black"
        >
          CC BY-SA 4.0
        </a>{" "}
        and code snippets are{" "}
        <a
          href="https://opensource.org/license/mit"
          className="font-medium text-black underline decoration-black/30 underline-offset-2 hover:decoration-black"
        >
          MIT
        </a>
        . Your name stays on the guide.
      </p>

      <p className="mt-[34px] text-[13.5px] tracking-[-0.01em] text-black/45">
        If you&rsquo;ve built something that isn&rsquo;t in{" "}
        <Link
          href="/guides"
          className="font-semibold text-black/70 underline decoration-black/25 underline-offset-2 hover:decoration-black"
        >
          the guides
        </Link>{" "} yet, write it up.
      </p>
    </div>
  )
}
