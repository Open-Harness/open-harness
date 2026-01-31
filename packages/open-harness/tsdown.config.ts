import { defineConfig } from "tsdown"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core.ts",
    "src/server.ts",
    "src/client.ts",
    "src/testing.ts"
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  outDir: "dist",
  tsconfig: "tsconfig.build.json",
  // Bundle internal @open-harness/* packages into the output
  noExternal: [
    "@open-harness/core",
    "@open-harness/server",
    "@open-harness/client",
    "@open-harness/testing"
  ],
  // Acknowledge we intentionally bundle transitive dependencies
  inlineOnly: false
})
