export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <main className="flex-1 bg-white">{children}</main>
}
