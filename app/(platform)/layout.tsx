import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-white">{children}</main>
      <SiteFooter />
    </>
  )
}
