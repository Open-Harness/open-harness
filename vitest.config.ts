import { defineConfig } from "vitest/config"
import shared from "./packages/config/vitest.shared.js"

export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    projects: ["packages/*"]
  }
})
