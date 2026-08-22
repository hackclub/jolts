import type { ContentType } from "@/lib/content"

/* Per-content-type visual identity, following the header's language:
   a saturated accent, a two-tone conic checkerboard, and a light "wash"
   gradient that fades the checker out toward a corner. Builds inherit the
   orange/yellow family from the "Start here!" card; the blue family stays
   reserved for site chrome (header, search). */
export type TypeTheme = {
  /** Singular label, e.g. "Build" */
  label: string
  labelPlural: string
  accent: string
  /** Checkerboard square pair */
  checkerA: string
  checkerB: string
  /** rgb triplet for the wash gradient, e.g. "255,211,1" */
  wash: string
  /** Very light tint for chips/rows on white */
  tint: string
}

export const typeTheme: Record<ContentType, TypeTheme> = {
  guides: {
    label: "Guide",
    labelPlural: "Guides",
    accent: "#FF902F",
    checkerA: "#FFBA01",
    checkerB: "#FF9D00",
    wash: "255,211,1",
    tint: "#FFF4E6",
  },
  concepts: {
    label: "Concept",
    labelPlural: "Concepts",
    accent: "#A633D6",
    checkerA: "#BB4FE8",
    checkerB: "#A633D6",
    wash: "222,141,255",
    tint: "#F8EEFC",
  },
  tools: {
    label: "Tool",
    labelPlural: "Tools",
    accent: "#0EBF80",
    checkerA: "#33D6A6",
    checkerB: "#14C98F",
    wash: "141,255,216",
    tint: "#E9FAF3",
  },
  /* Site pages borrow the guides family on purpose: "Start here" is the
     door into the builds, and the header's Start here card is already
     bordered in the same orange. */
  pages: {
    label: "Page",
    labelPlural: "Pages",
    accent: "#FF902F",
    checkerA: "#FFBA01",
    checkerB: "#FF9D00",
    wash: "255,211,1",
    tint: "#FFF4E6",
  },
}

/* Site chrome - the header's nav dropdown, search, and the editor's save
   dialog - keeps the blue family. It's the one palette not tied to a content
   type, which is what makes those surfaces read as "the site talking" rather
   than "this guide". Shaped to drop straight into CheckerFrame. */
export const chromeTheme = {
  accent: "#01A6FF",
  checkerA: "#01BBFF",
  checkerB: "#01A6FF",
  wash: "1,206,242",
}

export const difficultyLabel = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const

export const difficultyLevel = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
} as const
