import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "export",
  basePath: "/open-harness",
  assetPrefix: "/open-harness/",
  images: {
    unoptimized: true, // Required for static export
  },
  // Skip TypeScript errors during build - fumadocs types are incomplete for React 19
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withMDX(config);
