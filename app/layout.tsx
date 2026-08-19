import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

import { EntryReveal } from "@/components/entry-reveal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const openRunde = localFont({
  src: [
    { path: "./fonts/OpenRunde-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/OpenRunde-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/OpenRunde-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const augiePixel = localFont({
  src: "./fonts/augiepixel.ttf",
  variable: "--font-augie",
  display: "block",
});

export const metadata: Metadata = {
  title: "jolts",
  description: "Learn to build real things",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${openRunde.variable} ${augiePixel.variable} h-full scroll-smooth antialiased`}
      // the inline entry-skip script writes to <html> before hydration
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* runs synchronously before EntryReveal paints: arriving from
            another jolts page skips the entry animation, but an explicit
            refresh still plays it (see globals.css) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var n=performance.getEntriesByType("navigation")[0];if(n&&n.type!=="reload"&&document.referrer&&new URL(document.referrer).origin===location.origin)document.documentElement.setAttribute("data-entry-skip","")}catch(e){}`,
          }}
        />
        <EntryReveal />
        {/* one header/footer instance for every route, so the header's
            post-click hover-hold state survives navigating from anywhere
            (including the home page) */}
        <SiteHeader />
        {children}
        <SiteFooter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
