/**
 * Tests for planner.agent.ts
 *
 * Verifies the planner agent is correctly configured using defineAgent:
 * 1. Has proper tag and reactive markers
 * 2. Activates on "workflow:start" signal
 * 3. Emits "plan:created" signal
 * 4. Uses PlanCreatedPayloadSchema for structured output
 * 5. Has dynamic prompt that injects PRD content
 * 6. Has when guard checking planning phase
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createInitialState } from "../types.js";
import { PlanCreatedPayloadSchema, plannerAgent } from "./index.js";

describe("plannerAgent", () => {
	describe("agent structure", () => {
		it("has correct tag and reactive markers", () => {
			expect(plannerAgent._tag).toBe("Agent");
			expect(plannerAgent._reactive).toBe(true);
		});

		it("has zodSchema defined", () => {
			expect(plannerAgent.zodSchema).toBeDefined();
		});

		it("has jsonSchema defined", () => {
			expect(plannerAgent.jsonSchema).toBeDefined();
		});
	});

	describe("activation configuration", () => {
		it("activates on workflow:start signal", () => {
			expect(plannerAgent.config.activateOn).toContain("workflow:start");
		});

		it("emits plan:created signal", () => {
			expect(plannerAgent.config.emits).toBeDefined();
			expect(plannerAgent.config.emits).toContain("plan:created");
		});
	});

	describe("JSON Schema output", () => {
		it("generates valid JSON Schema from outputSchema", () => {
			const jsonSchema = plannerAgent.jsonSchema;
			expect(jsonSchema).toBeDefined();
			expect(jsonSchema?.type).toBe("object");
			expect(jsonSchema?.properties).toBeDefined();
		});

		it("JSON Schema matches PlanCreatedPayloadSchema structure", () => {
			const jsonSchema = plannerAgent.jsonSchema;
			const props = jsonSchema?.properties as Record<string, unknown> | undefined;

			expect(props?.tasks).toBeDefined();
			expect(props?.milestones).toBeDefined();
			expect(props?.taskOrder).toBeDefined();
		});

		it("JSON Schema has required fields", () => {
			const jsonSchema = plannerAgent.jsonSchema;
			const required = jsonSchema?.required;

			expect(required).toContain("tasks");
			expect(required).toContain("milestones");
			expect(required).toContain("taskOrder");
		});

		it("JSON Schema matches independently generated schema", () => {
			// Verify the agent's jsonSchema matches what we'd get from direct conversion
			const directSchema = z.toJSONSchema(PlanCreatedPayloadSchema);
			const agentSchema = plannerAgent.jsonSchema;

			// Both should have the same structure
			expect(agentSchema?.type).toBe(directSchema.type);
			expect(agentSchema?.required?.sort()).toEqual((directSchema.required as string[] | undefined)?.sort() ?? []);
		});
	});

	describe("dynamic prompt", () => {
		it("has a function prompt", () => {
			expect(typeof plannerAgent.config.prompt).toBe("function");
		});

		it("prompt includes PRD content from state", () => {
			if (typeof plannerAgent.config.prompt === "function") {
				const prdContent = "# My Test PRD\n\nBuild a hello world app";
				const mockCtx = {
					signal: {
						id: "sig-1",
						name: "workflow:start",
						payload: {},
						timestamp: new Date().toISOString(),
					},
					state: createInitialState(prdContent),
					input: {},
				};

				const prompt = plannerAgent.config.prompt(mockCtx);

				// Should include the PRD content
				expect(prompt).toContain(prdContent);
				expect(prompt).toContain("PRD Content:");
			}
		});

		it("prompt includes task extraction instructions", () => {
			if (typeof plannerAgent.config.prompt === "function") {
				const mockCtx = {
					signal: {
						id: "sig-1",
						name: "workflow:start",
						payload: {},
						timestamp: new Date().toISOString(),
					},
					state: createInitialState("test prd"),
					input: {},
				};

				const prompt = plannerAgent.config.prompt(mockCtx);

				// Should have instructions for extracting tasks
				expect(prompt).toContain("Extract");
				expect(prompt).toContain("task");
				expect(prompt).toContain("milestone");
			}
		});
	});

	describe("when guard", () => {
		it("has a when guard defined", () => {
			expect(plannerAgent.config.when).toBeDefined();
		});

		it("activates when planning phase is idle", () => {
			if (plannerAgent.config.when) {
				const mockCtx = {
					signal: {
						id: "sig-1",
						name: "workflow:start",
						payload: {},
						timestamp: new Date().toISOString(),
					},
					state: createInitialState("test prd"),
					input: {},
				};

				// Initial state has planning.phase = "idle"
				expect(plannerAgent.config.when(mockCtx)).toBe(true);
			}
		});

		it("does not activate when planning phase is not idle", () => {
			if (plannerAgent.config.when) {
				const state = createInitialState("test prd");
				// Mutate state to simulate a different phase
				(state.planning as { phase: string }).phase = "planning";

				const mockCtx = {
					signal: {
						id: "sig-1",
						name: "workflow:start",
						payload: {},
						timestamp: new Date().toISOString(),
					},
					state,
					input: {},
				};

				expect(plannerAgent.config.when(mockCtx)).toBe(false);
			}
		});

		it("does not activate when plan is complete", () => {
			if (plannerAgent.config.when) {
				const state = createInitialState("test prd");
				(state.planning as { phase: string }).phase = "plan_complete";

				const mockCtx = {
					signal: {
						id: "sig-1",
						name: "workflow:start",
						payload: {},
						timestamp: new Date().toISOString(),
					},
					state,
					input: {},
				};

				expect(plannerAgent.config.when(mockCtx)).toBe(false);
			}
		});
	});
});
