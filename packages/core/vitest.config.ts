import { mergeConfig } from "vitest/config"
import shared from "../config/vitest.shared.js"

export default mergeConfig(shared, {
  test: {
    root: __dirname
  }
})
