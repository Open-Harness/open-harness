/**
 * Tests for cli.ts
 *
 * Verifies the CLI module:
 * 1. Has correct dynamic imports structure
 * 2. plannerAgent is available from agents module
 * 3. CLI uses plannerAgent instead of inline agent definition
 *
 * Note: These are unit tests for the CLI structure, not integration tests.
 * Full workflow integration testing requires live Claude API.
 */

import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("CLI Module Structure", () => {
	describe("plannerAgent import", () => {
		it("plannerAgent is exported from agents module", async () => {
			const { plannerAgent } = await import("./agents/index.js");

			expect(plannerAgent).toBeDefined();
			expect(plannerAgent._tag).toBe("Agent");
			expect(plannerAgent._reactive).toBe(true);
		});

		it("plannerAgent has jsonSchema for structured output", async () => {
			const { plannerAgent } = await import("./agents/index.js");

			expect(plannerAgent.jsonSchema).toBeDefined();
			expect(plannerAgent.jsonSchema?.type).toBe("object");
		});

		it("plannerAgent activates on workflow:start", async () => {
			const { plannerAgent } = await import("./agents/index.js");

			expect(plannerAgent.config.activateOn).toContain("workflow:start");
		});

		it("plannerAgent emits plan:created signal", async () => {
			const { plannerAgent } = await import("./agents/index.js");

			expect(plannerAgent.config.emits).toContain("plan:created");
		});
	});

	describe("workflow module", () => {
		it("runPRDWorkflow is exported", async () => {
			const { runPRDWorkflow } = await import("./workflow.js");

			expect(runPRDWorkflow).toBeDefined();
			expect(typeof runPRDWorkflow).toBe("function");
		});

		it("createPRDWorkflow is exported", async () => {
			const { createPRDWorkflow } = await import("./workflow.js");

			expect(createPRDWorkflow).toBeDefined();
			expect(typeof createPRDWorkflow).toBe("function");
		});
	});

	describe("CLI source file", () => {
		it("cli.ts exists", () => {
			const cliPath = resolve(__dirname, "cli.ts");
			expect(existsSync(cliPath)).toBe(true);
		});

		it("cli.ts imports plannerAgent from agents", async () => {
			// Read the CLI source to verify the import
			const cliPath = resolve(__dirname, "cli.ts");
			const cliSource = await Bun.file(cliPath).text();

			expect(cliSource).toContain("plannerAgent");
			expect(cliSource).toContain("./agents/index.js");
		});

		it("cli.ts does not use inline agent factory", async () => {
			// Verify the old inline agent pattern is removed
			const cliPath = resolve(__dirname, "cli.ts");
			const cliSource = await Bun.file(cliPath).text();

			// Should NOT have createPRDWorkflow being destructured for agent factory
			expect(cliSource).not.toContain("createPRDWorkflow }");
			// Should NOT have "const planner = agent({" which was the old inline pattern
			expect(cliSource).not.toContain("const planner = agent(");
		});

		it("cli.ts passes plannerAgent to runPRDWorkflow", async () => {
			const cliPath = resolve(__dirname, "cli.ts");
			const cliSource = await Bun.file(cliPath).text();

			// Should have "planner: plannerAgent" in the agents config
			expect(cliSource).toContain("planner: plannerAgent");
		});
	});

	describe("agent compatibility with workflow", () => {
		it("plannerAgent type is compatible with PRDWorkflowConfig.agents", async () => {
			const { plannerAgent } = await import("./agents/index.js");
			const { runPRDWorkflow } = await import("./workflow.js");

			// This test verifies type compatibility at runtime
			// If plannerAgent wasn't compatible, TypeScript would catch it at compile time
			// but we verify the structure here for documentation

			// The config expects Record<string, ScopedReactiveAgent<unknown, PRDWorkflowState>>
			const agents = { planner: plannerAgent };

			expect(agents.planner).toBeDefined();
			expect(agents.planner._tag).toBe("Agent");
			expect(agents.planner._reactive).toBe(true);

			// Verify runPRDWorkflow exists and is callable
			expect(typeof runPRDWorkflow).toBe("function");
		});

		it("plannerAgent has dynamic prompt function", async () => {
			const { plannerAgent } = await import("./agents/index.js");

			// Dynamic prompts are functions, not strings
			expect(typeof plannerAgent.config.prompt).toBe("function");
		});

		it("plannerAgent has when guard for conditional activation", async () => {
			const { plannerAgent } = await import("./agents/index.js");

			expect(plannerAgent.config.when).toBeDefined();
			expect(typeof plannerAgent.config.when).toBe("function");
		});
	});
});
