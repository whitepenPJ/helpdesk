import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, too small for ticket attachments.
      bodySizeLimit: "10mb",
    },
  },
  // pdfkit reads its bundled font metrics (.afm files) via fs at runtime,
  // relative to its own package directory — bundling it breaks that lookup
  // (unlike @prisma/client/pg, which Next already excludes by default).
  // Excluding it here makes the report PDF export use a plain Node
  // `require` instead, matching how it already runs standalone.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
