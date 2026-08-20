/* Curator tooling, not public content: never indexed, and it sits on the same
   white ground as the rest of the platform. */

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <main className="flex-1 bg-white">{children}</main>
}
