import { NextResponse } from "next/server"

import { entryOf, readPrImage, requireCurator } from "@/lib/github/review"
import { failure, requireToken } from "@/lib/github/route-helpers"
import { readToken } from "@/lib/github/session"

/* Photos out of a pull request, proxied with the curator's own token. The
   content repo is private, so an <img src> pointing at GitHub would 404 - and
   reviewing a hardware guide without seeing its photos is not reviewing it. */

export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  ctx: RouteContext<"/api/review/pr/[number]/image">
) {
  const token = await readToken()
  const missing = requireToken(token)
  if (missing) return missing

  const { number } = await ctx.params
  const n = Number(number)
  const path = new URL(req.url).searchParams.get("path") ?? ""
  // only ever serve colocated content images, never an arbitrary repo path
  if (!Number.isInteger(n) || n <= 0 || !entryOf(path) || path.includes("..")) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    await requireCurator(token!)
    const image = await readPrImage(token!, n, path)
    if (!image) return new NextResponse("Not found", { status: 404 })
    return new NextResponse(image.data as unknown as BodyInit, {
      headers: {
        "content-type": image.mime,
        // private content: never let a shared cache keep it
        "cache-control": "private, max-age=300",
      },
    })
  } catch (err) {
    return failure(err)
  }
}
