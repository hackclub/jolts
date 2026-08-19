/* Photos come off phones at 8-12 megapixels and several megabytes each - fine
   for a camera roll, wrong for a git repo that every reader clones and every
   contribution ships through an API. Before a drop becomes an upload we
   downscale it to something a guide actually renders at and re-encode to
   WebP, keeping the original whenever that would be a downgrade.

   Everything degrades safely: an animated GIF, an SVG, or a browser without
   the canvas bits keeps its original bytes. */

const MAX_EDGE = 1600
/** below this, re-encoding buys little and can cost quality */
const LEAVE_ALONE_UNDER = 320 * 1024
/** animation and vectors don't survive a canvas round-trip */
const PASSTHROUGH = /^image\/(gif|svg\+xml|avif)$/
const QUALITY = 0.82

export type PreparedImage = {
  /** explicitly ArrayBuffer-backed: `new Blob([view])` rejects the default
      Uint8Array<ArrayBufferLike>, since that could be a SharedArrayBuffer */
  data: Uint8Array<ArrayBuffer>
  mime: string
  /** may differ from the original when we re-encoded (…jpg → …webp) */
  fileName: string
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const original: PreparedImage = {
    data: new Uint8Array(await file.arrayBuffer()),
    mime: file.type || "application/octet-stream",
    fileName: file.name,
  }
  if (!file.type.startsWith("image/") || PASSTHROUGH.test(file.type)) return original

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && original.data.length <= LEAVE_ALONE_UNDER) {
      bitmap.close()
      return original
    }
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const blob = await drawToBlob(bitmap, width, height)
    bitmap.close()
    if (!blob || blob.size >= original.data.length) return original

    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      mime: "image/webp",
      fileName: original.fileName.replace(/\.[^.]+$/, "") + ".webp",
    }
  } catch {
    // no createImageBitmap, a decode failure, a tainted canvas - ship as-is
    return original
  }
}

async function drawToBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number
): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, width, height)
    return canvas.convertToBlob({ type: "image/webp", quality: QUALITY })
  }
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", QUALITY)
  )
}
