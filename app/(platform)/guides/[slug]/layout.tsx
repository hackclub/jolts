import { ViewTransition } from "react"

import { notFound } from "next/navigation"

import { GuideNav } from "@/components/guide-nav"
import { buildNavItems } from "@/components/guide-page"
import { getEntry, listGuidePages } from "@/lib/content"
import { typeTheme } from "@/lib/theme"

/* The left panel lives in the layout, so it persists across page
   switches - only the right column re-renders, wrapped in a
   ViewTransition crossfade. The nav derives the active page from the
   pathname client-side. */

export default async function GuideLayout({
  children,
  params,
}: LayoutProps<"/guides/[slug]">) {
  const { slug } = await params
  const entry = getEntry("guides", slug)
  if (!entry) notFound()

  const navItems = buildNavItems(entry, listGuidePages(entry.slug))

  return (
    <div className="mx-auto grid w-full max-w-[1020px] gap-x-[52px] gap-y-[28px] px-[28px] pt-[40px] lg:grid-cols-[190px_minmax(0,1fr)]">
      <GuideNav
        entryTitle={entry.meta.title}
        theme={typeTheme.guides}
        items={navItems}
      />
      <ViewTransition default="jolts-content">
        <div className="min-w-0 max-w-[720px]">{children}</div>
      </ViewTransition>
    </div>
  )
}
