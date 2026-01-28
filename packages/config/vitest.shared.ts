import * as path from "node:path"
import type { UserConfig } from "vitest/config"

const root = path.join(__dirname, "..")

const alias = (name: string) => {
  const target = process.env.TEST_DIST !== undefined ? "dist/dist/esm" : "src"
  return {
    [`${name}/test`]: path.join(root, name, "test"),
    [`${name}`]: path.join(root, name, target)
  }
}

const scopedAlias = (name: string) => {
  const target = process.env.TEST_DIST !== undefined ? "dist/dist/esm" : "src"
  return {
    [`@open-scaffold/${name}/test`]: path.join(root, name, "test"),
    [`@open-scaffold/${name}`]: path.join(root, name, target, "index.ts")
  }
}

const aliases = {
  ...alias("cli"),
  ...alias("domain"),
  ...alias("server"),
  ...scopedAlias("core"),
  ...scopedAlias("server"),
  ...scopedAlias("client")
}

const config: UserConfig = {
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
    setupFiles: [path.join(__dirname, "setupTests.ts")],
    fakeTimers: { toFake: undefined },
    sequence: { concurrent: true },
    include: ["test/**/*.test.ts"],
    alias: aliases
  }
}

export default config
