import { ViewTransition } from "react"

import { notFound } from "next/navigation"

import { GuideBreadcrumb } from "@/components/guide-breadcrumb"
import { GuideNav } from "@/components/guide-nav"
import { buildNavItems } from "@/components/guide-page"
import { getEntry, listGuidePages } from "@/lib/content"
import { typeTheme } from "@/lib/theme"

/* The left panel and breadcrumb live in the layout, so they persist
   across page switches - only the column below the breadcrumb
   re-renders, wrapped in a ViewTransition. Both derive the active page
   from the pathname client-side. */

export default async function GuideLayout({
  children,
  params,
}: LayoutProps<"/guides/[slug]">) {
  const { slug } = await params
  const entry = getEntry("guides", slug)
  if (!entry) notFound()

  const pages = listGuidePages(entry.slug)
  const navItems = buildNavItems(entry, pages)

  return (
    <div className="mx-auto grid w-full max-w-[1020px] gap-x-[52px] gap-y-[28px] px-[28px] pt-[40px] lg:grid-cols-[190px_minmax(0,1fr)]">
      <GuideNav
        entryTitle={entry.meta.title}
        theme={typeTheme.guides}
        items={navItems}
      />
      <div className="min-w-0 max-w-[720px]">
        {/* outside the ViewTransition: stays put while content animates */}
        <GuideBreadcrumb
          guideTitle={entry.meta.title}
          base={`/guides/${entry.slug}`}
          pages={pages.map((p) => ({
            slug: p.slug,
            title: p.title,
            file: p.file,
          }))}
          accent={typeTheme.guides.accent}
          editBase={`/edit/guides/${entry.slug}`}
        />
        <ViewTransition default="jolts-content">
          <div className="min-w-0">{children}</div>
        </ViewTransition>
      </div>
    </div>
  )
}
