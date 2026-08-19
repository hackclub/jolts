/* Round-trip harness for the visual editor's MDX layer. Run with:
     npx tsx scripts/test-roundtrip.mts
   For every content file:
   1. parse → serialize WITH slices  → must equal the original byte-for-byte
      (an untouched document produces an empty diff)
   2. parse → serialize WITHOUT slices (full rewrite) → reparse → the PM
      JSON must be identical (nothing lost), and serializing again must be
      a fixed point (stable output). */

import fs from "node:fs"
import path from "node:path"

import matter from "gray-matter"

import { getSchema } from "@tiptap/core"

import { buildExtensions } from "../components/editor/extensions"
import { parseMdxDoc } from "../lib/editor/mdx-parse"
import { serializeMdxDoc } from "../lib/editor/mdx-serialize"

const schema = getSchema(buildExtensions(""))

const CONTENT = path.join(process.cwd(), "content")

const files: string[] = []
for (const type of ["guides", "concepts", "tools"]) {
  const dir = path.join(CONTENT, type)
  if (!fs.existsSync(dir)) continue
  for (const slug of fs.readdirSync(dir)) {
    const folder = path.join(dir, slug)
    if (!fs.statSync(folder).isDirectory()) continue
    for (const f of fs.readdirSync(folder)) {
      if (f.endsWith(".mdx")) files.push(path.join(folder, f))
    }
  }
}
files.push(path.join(CONTENT, "TEMPLATE.mdx"))

let pass = 0
let fail = 0

function firstDiff(a: string, b: string): string {
  const al = a.split("\n")
  const bl = b.split("\n")
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] !== bl[i]) {
      return `line ${i + 1}:\n  orig: ${JSON.stringify(al[i])}\n  got:  ${JSON.stringify(bl[i])}`
    }
  }
  return "(no line diff - trailing whitespace?)"
}

for (const file of files) {
  const rel = path.relative(CONTENT, file)
  const raw = fs.readFileSync(file, "utf8")
  const { content: body } = matter(raw)
  try {
    // 1. identity with slices
    const parsed = parseMdxDoc(body)
    const withSlices = serializeMdxDoc(parsed.doc, parsed.original)
    const normBody = body.replace(/^\n+/, "").replace(/\n+$/, "") + "\n"
    if (withSlices !== normBody) {
      fail++
      console.error(`✗ ${rel} - slice serialization differs\n${firstDiff(normBody, withSlices)}`)
      continue
    }

    // 1b. the doc must satisfy the live editor schema (else the page
    //     falls back to source mode)
    schema.nodeFromJSON(parsed.doc).check()

    // 2. full rewrite is lossless + stable
    const rewritten = serializeMdxDoc(parsed.doc)
    const reparsed = parseMdxDoc(rewritten)
    const a = JSON.stringify(parsed.doc)
    const b = JSON.stringify(reparsed.doc)
    if (a !== b) {
      fail++
      console.error(`✗ ${rel} - full rewrite loses information`)
      // locate first differing block
      const ac = parsed.doc.content ?? []
      const bc = reparsed.doc.content ?? []
      for (let i = 0; i < Math.max(ac.length, bc.length); i++) {
        if (JSON.stringify(ac[i]) !== JSON.stringify(bc[i])) {
          console.error(`  block ${i}:\n  orig: ${JSON.stringify(ac[i])?.slice(0, 400)}\n  got:  ${JSON.stringify(bc[i])?.slice(0, 400)}`)
          break
        }
      }
      continue
    }
    const again = serializeMdxDoc(reparsed.doc)
    if (again !== rewritten) {
      fail++
      console.error(`✗ ${rel} - serialization not a fixed point\n${firstDiff(rewritten, again)}`)
      continue
    }
    pass++
  } catch (err) {
    fail++
    console.error(`✗ ${rel} - ${(err as Error).message}`)
  }
}

console.log(`\n${pass} passed, ${fail} failed (of ${files.length})`)
process.exit(fail > 0 ? 1 : 0)
