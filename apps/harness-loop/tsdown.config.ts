import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node"
  },
  // Bundle internal @open-harness/* packages into the output
  noExternal: [
    "@open-harness/core",
    "@open-harness/server"
  ],
  // Acknowledge we intentionally bundle transitive dependencies
  inlineOnly: false
})
