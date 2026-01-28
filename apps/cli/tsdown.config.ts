import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  // Externalize workspace packages so they're loaded at runtime
  // This ensures we get the latest built versions
  external: [
    "@open-scaffold/core",
    "@open-scaffold/server",
    // Also externalize OpenTUI and its deps to avoid ESM issues
    "@opentui/core",
    "@opentui/react",
    "react",
    "commander",
    "jiti"
  ],
  tsconfig: "tsconfig.json"
})
