import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // exceljs (.xlsx report) and mammoth (.docx import) rely on Node APIs; load them with plain require.
  serverExternalPackages: ["exceljs", "mammoth"],
  experimental: {
    // .docx uploads go through a Server Action (files up to 5 MB, plus form overhead).
    serverActions: { bodySizeLimit: "6mb" },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
