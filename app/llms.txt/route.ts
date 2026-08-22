import { CONTENT_TYPES, entryPath, listEntries } from "@/lib/content"

/* Open-access citizenship from day one: a machine-readable index of every
   guide, each available as raw markdown at <url>.md. Statically generated. */

export const dynamic = "force-static"

const SITE = "https://jolts.hackclub.com"

export function GET() {
  const lines: string[] = [
    "# Jolts",
    "",
    "> Hack Club's platform for learning to build hardware: project guides",
    "> (builds), concept explainers, and tool documentation, cross-linked.",
    "> Community-written, PR-reviewed. Text/images CC BY-SA 4.0, code MIT.",
    "",
    `Every page below is also available as raw markdown by appending .md`,
    "",
  ]
  for (const type of CONTENT_TYPES) {
    const entries = listEntries(type)
    if (entries.length === 0) continue
    lines.push(`## ${type[0].toUpperCase()}${type.slice(1)}`, "")
    for (const e of entries) {
      lines.push(
        `- [${e.meta.title}](${SITE}${entryPath(type, e.slug)}.md): ${e.meta.subtitle}`
      )
    }
    lines.push("")
  }
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
