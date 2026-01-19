/**
 * Tests for defineAgent utility.
 *
 * These tests verify:
 * 1. Basic agent creation with Zod schema
 * 2. JSON Schema conversion works correctly
 * 3. Dynamic prompts are supported
 * 4. Agents without schemas work
 * 5. Type inference is preserved
 */

import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { defineAgent, type CompiledAgent } from "./define-agent.js";

describe("defineAgent", () => {
	describe("basic functionality", () => {
		it("creates an agent with Zod schema", () => {
			const TaskSchema = z.object({
				id: z.string(),
				title: z.string(),
			});

			const agent = defineAgent({
				prompt: "Create tasks",
				activateOn: ["workflow:start"],
				emits: ["tasks:created"],
				outputSchema: TaskSchema,
			});

			expect(agent._tag).toBe("Agent");
			expect(agent._reactive).toBe(true);
			expect(agent.zodSchema).toBeDefined();
			expect(agent.jsonSchema).toBeDefined();
		});

		it("converts Zod schema to JSON Schema correctly", () => {
			const PlanSchema = z.object({
				tasks: z.array(
					z.object({
						id: z.string(),
						title: z.string(),
					}),
				),
				milestones: z.array(z.string()),
			});

			const agent = defineAgent({
				prompt: "Create a plan",
				activateOn: ["workflow:start"],
				outputSchema: PlanSchema,
			});

			// Verify JSON Schema structure
			expect(agent.jsonSchema).toBeDefined();
			expect(agent.jsonSchema?.type).toBe("object");
			expect(agent.jsonSchema?.properties).toBeDefined();
			expect(agent.jsonSchema?.properties?.tasks).toBeDefined();
			expect(agent.jsonSchema?.properties?.milestones).toBeDefined();
			expect(agent.jsonSchema?.required).toContain("tasks");
			expect(agent.jsonSchema?.required).toContain("milestones");
		});

		it("preserves agent configuration", () => {
			const agent = defineAgent({
				prompt: "Test prompt",
				activateOn: ["test:signal", "other:signal"],
				emits: ["result:ready"],
				updates: "result" as keyof { result: string } & string,
			});

			expect(agent.config.prompt).toBe("Test prompt");
			expect(agent.config.activateOn).toEqual(["test:signal", "other:signal"]);
			expect(agent.config.emits).toEqual(["result:ready"]);
			expect(agent.config.updates).toBe("result");
		});
	});

	describe("dynamic prompts", () => {
		it("supports function prompts", () => {
			type TestState = { count: number };

			const agent = defineAgent<unknown, TestState>({
				prompt: (ctx) => `Count is ${ctx.state.count}`,
				activateOn: ["workflow:start"],
			});

			expect(typeof agent.config.prompt).toBe("function");

			// Verify the function works
			if (typeof agent.config.prompt === "function") {
				const ctx = {
					signal: { id: "1", name: "test", payload: {}, timestamp: new Date().toISOString() },
					state: { count: 42 },
					input: {},
				};
				expect(agent.config.prompt(ctx)).toBe("Count is 42");
			}
		});
	});

	describe("when guards", () => {
		it("preserves when guard function", () => {
			type TestState = { ready: boolean };

			const agent = defineAgent<unknown, TestState>({
				prompt: "Test",
				activateOn: ["workflow:start"],
				when: (ctx) => ctx.state.ready,
			});

			expect(agent.config.when).toBeDefined();

			// Verify the guard works
			if (agent.config.when) {
				const readyCtx = {
					signal: { id: "1", name: "test", payload: {}, timestamp: new Date().toISOString() },
					state: { ready: true },
					input: {},
				};
				const notReadyCtx = {
					signal: { id: "1", name: "test", payload: {}, timestamp: new Date().toISOString() },
					state: { ready: false },
					input: {},
				};
				expect(agent.config.when(readyCtx)).toBe(true);
				expect(agent.config.when(notReadyCtx)).toBe(false);
			}
		});
	});

	describe("agents without schemas", () => {
		it("creates agent without outputSchema", () => {
			const agent = defineAgent({
				prompt: "Just return text",
				activateOn: ["workflow:start"],
				emits: ["text:ready"],
			});

			expect(agent._tag).toBe("Agent");
			expect(agent._reactive).toBe(true);
			expect(agent.zodSchema).toBeUndefined();
			expect(agent.jsonSchema).toBeUndefined();
		});
	});

	describe("complex schemas", () => {
		it("handles nested objects with enums", () => {
			const StatusEnum = z.enum(["pending", "in_progress", "complete"]);
			const TaskSchema = z.object({
				id: z.string(),
				title: z.string(),
				status: StatusEnum,
				metadata: z.object({
					priority: z.number(),
					tags: z.array(z.string()),
				}),
			});

			const agent = defineAgent({
				prompt: "Create complex task",
				activateOn: ["workflow:start"],
				outputSchema: TaskSchema,
			});

			// Verify nested schema is preserved
			expect(agent.jsonSchema?.properties?.status).toBeDefined();
			expect(agent.jsonSchema?.properties?.metadata).toBeDefined();
		});

		it("handles optional fields", () => {
			const ConfigSchema = z.object({
				name: z.string(),
				description: z.string().optional(),
				enabled: z.boolean().default(true),
			});

			const agent = defineAgent({
				prompt: "Create config",
				activateOn: ["workflow:start"],
				outputSchema: ConfigSchema,
			});

			// name should be required, description should be optional
			expect(agent.jsonSchema?.required).toContain("name");
			// In Zod 4's JSON Schema output, optional fields are not in required array
		});
	});

	describe("type inference", () => {
		it("infers output type from schema", () => {
			const ResponseSchema = z.object({
				message: z.string(),
				code: z.number(),
			});

			// This test verifies TypeScript inference at compile time
			// The actual type check happens at compile time, not runtime
			const agent: CompiledAgent<z.infer<typeof ResponseSchema>> = defineAgent({
				prompt: "Generate response",
				activateOn: ["workflow:start"],
				outputSchema: ResponseSchema,
			});

			// Runtime verification that the agent was created
			expect(agent.zodSchema).toBeDefined();
		});
	});
});
