import type { Metadata } from "next"

import { EntryList } from "@/components/entry-card"
import { HubHero } from "@/components/hub-hero"
import { listTools } from "@/lib/content"

export const metadata: Metadata = {
  title: "Tools - jolts",
  description:
    "How to use this specific thing - soldering irons, multimeters, KiCad. Each tool gets a first-hour page and deeper dives.",
}

export default function ToolsPage() {
  const tools = listTools()
  return (
    <div className="mx-auto w-full max-w-[760px] px-[28px] pt-[46px]">
      <HubHero
        type="tools"
        title="Tools"
        blurb="How to use this specific thing. Every tool starts with a first-hour page - enough to be dangerous - and software tools count as hardware here."
      />
      <div className="mt-[26px] border-t border-black/10">
        <EntryList entries={tools} />
      </div>
    </div>
  )
}
