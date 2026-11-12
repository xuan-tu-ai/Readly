import type { MetadataRoute } from "next";

/** Web app manifest: lets students install Readly and is required for web push (phase 7). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Readly – Đọc văn lớp 12",
    short_name: "Readly",
    description: "Đọc 45 tác phẩm văn học lớp 12 cùng hướng dẫn đọc bằng AI.",
    lang: "vi",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8f1",
    theme_color: "#3cbf6b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
