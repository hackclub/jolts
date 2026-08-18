import type { Metadata } from "next"
import Link from "next/link"

import { GuideCard } from "@/components/entry-card"
import { listGuides } from "@/lib/content"

export const metadata: Metadata = {
  title: "Start here - jolts",
  description:
    "Never touched hardware? Here's how Jolts works and how to pick a first build you'll actually use.",
}

const contentTypes = [
  {
    href: "/guides",
    accent: "#FF902F",
    title: "Guides",
    text: "make this specific thing, start to finish. This is where you spend most of your time.",
  },
  {
    href: "/concepts",
    accent: "#8A21B8",
    title: "Concepts",
    text: "understand this idea. Builds link here the moment you need one - you rarely browse these cold.",
  },
  {
    href: "/tools",
    accent: "#067A54",
    title: "Tools",
    text: "how to use this specific thing - an iron, a multimeter, KiCad. Each starts with a first-hour page.",
  },
]

export default function StartPage() {
  // prerequisite-light builds first - the whole point of this page
  const guides = [...listGuides()].sort(
    (a, b) =>
      Number(a.meta.soldering) - Number(b.meta.soldering) ||
      a.meta.title.localeCompare(b.meta.title)
  )

  return (
    <div className="mx-auto w-full max-w-[1100px] px-[28px] pt-[46px]">
      {/* hero - the "Start here!" card's yellow checker family, the page's
          one loud moment */}
      <div className="relative overflow-hidden rounded-[12px]">
        <div
          aria-hidden
          className="absolute -inset-[60%] rotate-[-8.66deg]"
          style={{
            backgroundImage:
              "conic-gradient(#FFBA01 0 25%, #FF9D00 0 50%, #FFBA01 0 75%, #FF9D00 0)",
            backgroundSize: "107px 107px",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(67.21deg, rgba(255,211,1,0) 0%, rgba(255,211,1,0.75) 100%)",
          }}
        />
        <div className="relative px-[36px] py-[42px]">
          <h1 className="max-w-[560px] text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-[#211505] text-balance">
            Never touched hardware? Start here.
          </h1>
          <p className="mt-[12px] max-w-[500px] text-[16px] leading-[1.55] tracking-[-0.01em] text-[#4a3a12]">
            You don&rsquo;t need a physics class, a lab, or permission. You
            need one project you actually want to exist - everything else
            gets learned on the way there.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[680px]">
        {/* how the site works */}
        <h2 className="mt-[52px] text-[25px] font-semibold tracking-[-0.03em] text-[#16181d]">
          How Jolts works
        </h2>
        <p className="mt-[10px] text-[15.5px] leading-[1.7] tracking-[-0.01em] text-[#33383f]">
          Everything on this site is one of three things, and they link to
          each other at the moment of need - a build never stops to lecture
          you.
        </p>
        <ul className="mt-[14px] space-y-[10px] text-[15.5px] leading-[1.65] tracking-[-0.01em] text-[#33383f]">
          {contentTypes.map((ct) => (
            <li key={ct.href} className="flex gap-[10px]">
              <span
                aria-hidden
                className="mt-[9px] size-[7px] shrink-0 rounded-full"
                style={{ background: ct.accent }}
              />
              <span>
                <Link
                  href={ct.href}
                  className="font-semibold text-[#16181d] underline decoration-[1.5px] underline-offset-[3px] hover:decoration-[2px]"
                  style={{ textDecorationColor: ct.accent }}
                >
                  {ct.title}
                </Link>{" "} - {ct.text}
              </span>
            </li>
          ))}
        </ul>

        {/* first build */}
        <h2 className="mt-[52px] text-[25px] font-semibold tracking-[-0.03em] text-[#16181d]">
          Pick your first build
        </h2>
        <p className="mt-[10px] text-[15.5px] leading-[1.7] tracking-[-0.01em] text-[#33383f]">
          Jolts doesn&rsquo;t prescribe a first project - pick the thing you
          want to own. Every card declares what it assumes, so &ldquo;no
          soldering&rdquo; means exactly that. Builds that skip the iron are
          listed first.
        </p>
      </div>

      <div className="mt-[24px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((entry) => (
          <GuideCard key={entry.slug} entry={entry} />
        ))}
      </div>

      <div className="mx-auto max-w-[680px]">
        {/* what you need */}
        <h2 className="mt-[52px] text-[25px] font-semibold tracking-[-0.03em] text-[#16181d]">
          Do I need to buy stuff?
        </h2>
        <p className="mt-[10px] text-[15.5px] leading-[1.7] tracking-[-0.01em] text-[#33383f]">
          Less than you think. Every build lists its exact parts and total
          cost up front - most first builds land around $20–30. Read your
          chosen build&rsquo;s parts list before buying anything, and if it
          needs an iron, spend the first hour with the{" "}
          <Link
            href="/tools/soldering-iron"
            className="font-medium text-[#16181d] underline decoration-black/25 decoration-[1.5px] underline-offset-[3px] hover:decoration-black"
          >
            soldering iron guide
          </Link>{" "}
          first. Stuck at any point? Ask in{" "}
          <a
            href="https://hackclub.slack.com"
            className="font-medium text-[#16181d] underline decoration-black/25 decoration-[1.5px] underline-offset-[3px] hover:decoration-black"
          >
            the Hack Club Slack
          </a>{" "} - that&rsquo;s what it&rsquo;s for.
        </p>
      </div>
    </div>
  )
}
