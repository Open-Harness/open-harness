import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// Only apply basePath in production builds (for GitHub Pages deployment)
// In dev mode, basePath causes routing issues with static exports
const isProduction = process.env.NODE_ENV === "production";
const basePath = isProduction ? "/open-harness" : "";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "export",
  ...(basePath && {
    basePath,
    assetPrefix: `${basePath}/`,
  }),
  images: {
    unoptimized: true, // Required for static export
  },
  // Skip TypeScript errors during build - fumadocs types are incomplete for React 19
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withMDX(config);
