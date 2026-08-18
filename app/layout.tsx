import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
