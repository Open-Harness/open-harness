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
  // Bundle internal @open-scaffold/* packages into the output
  noExternal: [
    "@open-scaffold/core",
    "@open-scaffold/server"
  ]
})
