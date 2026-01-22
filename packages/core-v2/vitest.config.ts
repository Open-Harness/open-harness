import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		globals: false,
		// Use jsdom for React testing
		environment: "jsdom",
	},
});
