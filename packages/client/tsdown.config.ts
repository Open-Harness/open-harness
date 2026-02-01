import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts", "src/internal.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  outDir: "dist",
  external: ["@open-harness/core", "react", "react-dom"],
  tsconfig: "tsconfig.src.json"
})
