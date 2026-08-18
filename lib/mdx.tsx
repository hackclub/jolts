import { evaluate } from "@mdx-js/mdx"
import type { MDXComponents } from "mdx/types"
import * as runtime from "react/jsx-runtime"
import remarkGfm from "remark-gfm"

/* Compiles a guide's MDX body to a React tree at build time. Authors never
   import anything - the closed component registry is injected via
   `components`, which is also what makes the WYSIWYG editor possible. */
export async function renderMDX(
  source: string,
  components: MDXComponents
): Promise<React.ReactNode> {
  const { default: MDXContent } = await evaluate(source, {
    ...runtime,
    remarkPlugins: [remarkGfm],
  })
  return <MDXContent components={components} />
}
