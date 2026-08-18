import path from "path"

import sharp from "sharp"

import { CONTENT_DIR, type ContentType } from "@/lib/content"

/* Server-only (sharp): kept out of lib/content.ts so client components can
   keep importing content types/helpers without pulling in a native module. */

const alphaCache = new Map<string, Promise<boolean>>()

/** Whether a guide-relative image actually uses transparency - a
    transparent render gets a different hero treatment than a photo.
    Decodes the image and checks the alpha channel's minimum, because
    plenty of exports carry a fully-opaque alpha channel. Pages are
    static, so this runs at build time; cached per file regardless. */
export function contentImageHasAlpha(
  contentType: ContentType,
  slug: string,
  src: string
): Promise<boolean> {
  if (!src.startsWith("./")) return Promise.resolve(false)
  const file = path.join(CONTENT_DIR, contentType, slug, src.slice(2))
  let result = alphaCache.get(file)
  if (!result) {
    result = sharp(file)
      .stats()
      .then(
        (s) => (s.channels[3] ? s.channels[3].min < 255 : false),
        () => false
      )
    alphaCache.set(file, result)
  }
  return result
}
