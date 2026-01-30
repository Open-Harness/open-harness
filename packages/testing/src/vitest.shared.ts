import * as path from "node:path"
import type { UserConfig } from "vitest/config"

const root = path.join(__dirname, "../..")

const scopedAlias = (name: string) => {
  const target = process.env.TEST_DIST !== undefined ? "dist/dist/esm" : "src"
  return {
    [`@open-scaffold/${name}/test`]: path.join(root, name, "test"),
    [`@open-scaffold/${name}/internal`]: path.join(root, name, target, "internal.ts"),
    [`@open-scaffold/${name}`]: path.join(root, name, target, "index.ts")
  }
}

const aliases = {
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
