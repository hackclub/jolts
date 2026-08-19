import type { Metadata } from "next"
import Link from "next/link"

import { Breadcrumb } from "@/components/breadcrumb"
import { GuideCard } from "@/components/entry-card"
import { NewEntryCard } from "@/components/new-entry-link"
import { HubHero } from "@/components/hub-hero"
import { listGuides } from "@/lib/content"

export const metadata: Metadata = {
  title: "Guides - jolts",
  description:
    "Make a specific thing, start to finish. Every guide declares its cost, time, and prerequisites up front.",
}

export default function GuidesPage() {
  const guides = listGuides()
  return (
    <div className="mx-auto w-full max-w-[1100px] px-[28px] pt-[40px]">
      <Breadcrumb
        trail={[{ label: "Guides", href: "/guides" }]}
        accent="#FF902F"
      />
      <HubHero
        type="guides"
        title="Guides"
        blurb="Make this specific thing, start to finish. Every guide says what it costs, how long it takes, and what it assumes - nothing here is a checkpoint, they're all things you'll actually use."
      />

      <p className="mt-[18px] text-[14.5px] tracking-[-0.01em] text-[#5c6470]">
        First time touching hardware?{" "}
        <Link
          href="/start"
          className="font-semibold text-[#16181d] underline decoration-[#ff902f] decoration-[1.5px] underline-offset-[3px] hover:decoration-[2px]"
        >
          Start here
        </Link>
        .
      </p>

      <div className="mt-[28px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((entry) => (
          <GuideCard key={entry.slug} entry={entry} />
        ))}
        <NewEntryCard type="guides" />
      </div>

      <p className="mt-[36px] text-[13.5px] tracking-[-0.01em] text-[#9aa1ab]">
        Made something worth teaching?{" "}
        <Link
          href="/contribute"
          className="font-medium text-[#5c6470] underline decoration-black/25 underline-offset-[3px] hover:text-[#16181d] hover:decoration-black"
        >
          Write it as a guide
        </Link>{" "} - if a teen would show it off, use it daily, or keep it alive a week
        later, it belongs here.
      </p>
    </div>
  )
}
