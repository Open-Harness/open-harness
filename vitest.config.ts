import { defineConfig } from "vitest/config"
import shared from "./packages/testing/src/vitest.shared.js"

export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    projects: ["packages/*", "apps/cli"]
  }
})
