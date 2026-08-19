import "./editor.css"

/* The editor lives under the global site header; this layout only carries
   the editor stylesheet and the white ground. */

export default function EditLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <main className="jolts-editor-page flex-1 bg-white">{children}</main>
}
