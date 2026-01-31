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
  tsconfig: "tsconfig.src.json",
  // Bundle internal @open-scaffold/* packages into the output
  noExternal: [
    "@open-scaffold/core",
    "@open-scaffold/server",
    "@open-scaffold/client",
    "@open-scaffold/testing"
  ]
})
