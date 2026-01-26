import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Transpile workspace packages that use ESM-style .js imports in TypeScript
  transpilePackages: ["@open-harness/core-v2"],
  // Turbopack config (Next.js 16+ uses Turbopack by default)
  // Turbopack handles .js/.ts extension resolution natively, so minimal config needed
  turbopack: {
    resolveExtensions: [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mts",
      ".mjs",
      ".cts",
      ".cjs",
    ],
  },
  webpack: (config, { isServer }) => {
    // Fix module resolution for workspace packages using TypeScript ESM pattern
    // (files import with .js extension but only .ts files exist)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };

    // Enable browser condition for package.json exports (so @open-harness/core-v2
    // resolves to the browser-safe entry point that excludes SqliteStore)
    if (!isServer) {
      config.resolve.conditionNames = [
        "browser",
        "import",
        "module",
        "default",
      ];
    }

    return config;
  },
};

export default nextConfig;
