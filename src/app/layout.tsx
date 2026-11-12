import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Lora, Noto_Serif } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/** Serif face for the reading text. */
const reading = Noto_Serif({
  variable: "--font-reading",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

/** Optional reading face, only fetched when a reader picks it. */
const lora = Lora({
  variable: "--font-lora",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Readly", template: "%s · Readly" },
  description: "Đọc tác phẩm văn học lớp 12 cùng hướng dẫn đọc, câu hỏi và nhận xét bằng AI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script adds "dark" to <html> before hydration; React must not undo it.
    <html lang="vi" className={`${sans.variable} ${reading.variable} ${lora.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
