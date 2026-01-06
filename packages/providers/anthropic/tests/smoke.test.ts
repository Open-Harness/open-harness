import { describe, expect, test } from "bun:test";
import { createClaudeNode } from "../src/claude.agent.js";

describe("@open-harness/provider-anthropic", () => {
	test("smoke: package exports work", () => {
		expect(createClaudeNode).toBeDefined();
		expect(typeof createClaudeNode).toBe("function");
	});

	test("smoke: can create Claude node", () => {
		const node = createClaudeNode();
		expect(node).toBeDefined();
		expect(node.type).toBe("claude.agent");
		expect(typeof node.run).toBe("function");
	});
});
