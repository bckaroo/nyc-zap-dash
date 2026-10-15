import type { NextConfig } from "next";

// GitHub Pages builds run with NEXT_OUTPUT=export: static export to out/,
// under the project-site base path /nyc-zap-dash/. The systemd-served build
// (zapdash.service) stays untouched at repo root paths.
const isPagesBuild = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
  ...(isPagesBuild
    ? {
        output: "export" as const,
        basePath: "/nyc-zap-dash",
        assetPrefix: "/nyc-zap-dash",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;