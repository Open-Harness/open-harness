import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Transpile workspace packages that use ESM-style .js imports in TypeScript
  transpilePackages: ["@open-harness/core-v2"],
  webpack: (config) => {
    // Fix module resolution for workspace packages using TypeScript ESM pattern
    // (files import with .js extension but only .ts files exist)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
};

export default nextConfig;
