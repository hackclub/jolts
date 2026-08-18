import fs from "node:fs"
import path from "node:path"

import { CONTENT_DIR } from "@/lib/content"

/* Serves images colocated with guides (content/<type>/<slug>/photo.jpg).
   Colocation is what makes PR contributions simple - a guide and its
   photos travel in one folder. Long-cached: content only changes on deploy. */

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/content-images/[...path]">
) {
  const { path: segments } = await ctx.params
  const resolved = path.resolve(CONTENT_DIR, ...segments)
  // never escape the content directory
  if (!resolved.startsWith(CONTENT_DIR + path.sep)) {
    return new Response("Not found", { status: 404 })
  }
  const mime = MIME[path.extname(resolved).toLowerCase()]
  if (!mime || !fs.existsSync(resolved)) {
    return new Response("Not found", { status: 404 })
  }
  return new Response(new Uint8Array(fs.readFileSync(resolved)), {
    headers: {
      "content-type": mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  })
}
