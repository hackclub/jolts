import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /guides/macropad.md → raw markdown (see app/md/[type]/[slug]/route.ts)
  async rewrites() {
    return [
      {
        source: "/:type(guides|concepts|tools)/:slug.md",
        destination: "/md/:type/:slug",
      },
      // page entries are top-level, so /start.md has no type segment
      {
        source: "/:slug(start).md",
        destination: "/md/pages/:slug",
      },
    ];
  },
  // the section used to be called "builds" — old links keep working
  async redirects() {
    return [
      {
        source: "/builds/:path*",
        destination: "/guides/:path*",
        permanent: true,
      },
    ];
  },
  // content/ is read with fs at runtime by the content-images route,
  // so it must ship in the serverless bundle on Vercel
  outputFileTracingIncludes: {
    "/content-images/[...path]": ["./content/**/*"],
  },
};

export default nextConfig;
