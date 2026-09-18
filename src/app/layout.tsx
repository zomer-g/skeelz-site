import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { PreviewBar, SkipLink } from "@/components/PreviewBar";
import "./globals.css";

// next/font downloads Rubik at build time and serves it from this app: nothing loads cross-origin.
const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-rubik", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Skeelz · המשרות שלנו", template: "%s · Skeelz" },
  // Admin-only preview: never indexed (robots.txt and the X-Robots-Tag header say the same).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <PreviewBar />
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
