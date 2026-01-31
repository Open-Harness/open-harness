import { mergeConfig } from "vitest/config"
import shared from "../testing/src/vitest.shared.js"

export default mergeConfig(shared, {
  test: {
    root: __dirname,
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"]
  }
})
