import type { Metadata } from "next"

import { EntryList } from "@/components/entry-card"
import { HubHero } from "@/components/hub-hero"
import { listConcepts } from "@/lib/content"

export const metadata: Metadata = {
  title: "Concepts - jolts",
  description:
    "Understand the ideas behind the builds: voltage, I2C, pull-ups, and everything guides link to at the moment of need.",
}

export default function ConceptsPage() {
  const concepts = listConcepts()
  return (
    <div className="mx-auto w-full max-w-[760px] px-[28px] pt-[46px]">
      <HubHero
        type="concepts"
        title="Concepts"
        blurb="Understand this idea. Builds never explain a concept inline - they link here at the exact moment you need it, so each idea gets written well once."
      />
      <div className="mt-[26px] border-t border-black/10">
        <EntryList entries={concepts} />
      </div>
    </div>
  )
}
