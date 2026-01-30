import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts", "src/internal.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: false,
  outDir: "dist",
  external: ["@open-scaffold/core"],
  tsconfig: "tsconfig.src.json"
})
