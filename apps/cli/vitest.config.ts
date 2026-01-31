import * as path from "node:path"
import { defineConfig } from "vitest/config"

const packagesRoot = path.join(__dirname, "../../packages")

const scopedAlias = (name: string) => {
  const target = process.env.TEST_DIST !== undefined ? "dist/dist/esm" : "src"
  return {
    [`@open-scaffold/${name}/test`]: path.join(packagesRoot, name, "test"),
    [`@open-scaffold/${name}/internal`]: path.join(packagesRoot, name, target, "internal.ts"),
    [`@open-scaffold/${name}`]: path.join(packagesRoot, name, target, "index.ts")
  }
}

const aliases = {
  ...scopedAlias("core"),
  ...scopedAlias("server"),
  ...scopedAlias("client")
}

export default defineConfig({
  esbuild: {
    target: "es2020"
  },
  resolve: {
    alias: aliases
  },
  optimizeDeps: {
    exclude: ["bun:sqlite"]
  },
  test: {
    root: __dirname,
    fakeTimers: { toFake: undefined },
    sequence: { concurrent: true },
    include: ["test/**/*.test.ts"],
    alias: aliases
  }
})
