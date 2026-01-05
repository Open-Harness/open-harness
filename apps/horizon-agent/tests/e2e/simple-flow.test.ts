/**
 * E2E Tests for Horizon Agent - Simple Flow
 *
 * Uses REAL recorded fixtures from the Claude SDK.
 * These fixtures were recorded on 2026-01-05 using:
 *   bun packages/kernel/scripts/record-fixtures.ts \
 *     --flow apps/horizon-agent/flows/test-simple.yaml \
 *     --out apps/horizon-agent/tests/fixtures/recordings \
 *     --input '{"feature": "Add a hello() function"}'
 *
 * The fixtures contain actual SDK responses with real:
 * - Session IDs (UUIDs)
 * - Message IDs
 * - Token usage and costs
 * - Streaming event structures
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
	createClaudeNode,
	createMockQuery,
	createRuntime,
	DefaultNodeRegistry,
	FixtureSchema,
	parseFlowYaml,
	type FixtureFile,
	type RuntimeEvent,
} from "@open-harness/kernel";

const FLOW_PATH = resolve(import.meta.dir, "../../flows/test-simple.yaml");
const FIXTURES_PATH = resolve(import.meta.dir, "../fixtures/recordings");

async function loadFixture(name: string): Promise<FixtureFile> {
	const file = Bun.file(resolve(FIXTURES_PATH, `${name}.json`));
	const data = await file.json();
	return FixtureSchema.parse(data) as FixtureFile;
}

describe("Horizon Agent E2E - Simple Flow", () => {
	test("executes planner → coder flow with real recorded fixtures", async () => {
		// Load the flow definition
		const flowContent = await Bun.file(FLOW_PATH).text();
		const flow = parseFlowYaml(flowContent);

		// Load real recorded fixtures
		const plannerFixture = await loadFixture("planner");
		const coderFixture = await loadFixture("coder");

		// Verify fixtures are real (have proper UUIDs, not fake session IDs)
		expect(plannerFixture.calls[0].output.sessionId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);

		// Create mock query using recorded fixtures
		const mockQuery = createMockQuery({
			fixtures: {
				planner: plannerFixture,
				coder: coderFixture,
			},
			selectFixtureKey: async ({ prompt }) => {
				const text =
					typeof prompt === "string"
						? prompt
						: await (async () => {
								for await (const msg of prompt) {
									const content = msg.message?.content;
									if (typeof content === "string") return content;
									if (Array.isArray(content) && content.length > 0) {
										const first = content[0] as { text?: string } | undefined;
										if (first?.text) return first.text;
									}
								}
								return "";
							})();

				// Route based on prompt content
				if (text.includes("planner") || text.includes("feature request")) {
					return "planner";
				}
				return "coder";
			},
		});

		// Create registry with mock claude node
		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: mockQuery }));

		// Create runtime and collect events
		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		runtime.onEvent((event) => {
			events.push(event);
		});

		// Run the flow
		const snapshot = await runtime.run({ feature: "Add a hello() function" });

		// === ASSERTIONS ===

		// 1. Flow completed successfully
		expect(snapshot.status).toBe("complete");

		// 2. Both nodes produced output
		expect(snapshot.outputs.planner).toBeDefined();
		expect(snapshot.outputs.coder).toBeDefined();

		// 3. Planner output contains expected task
		const plannerOutput = snapshot.outputs.planner as { text: string };
		expect(plannerOutput.text).toContain("task-1");
		expect(plannerOutput.text).toContain("hello");

		// 4. Coder output contains implementation
		const coderOutput = snapshot.outputs.coder as { text: string };
		expect(coderOutput.text).toBeDefined();
		expect(coderOutput.text.length).toBeGreaterThan(0);

		// 5. Agent events were emitted in correct order
		const nodeStarts = events.filter((e) => e.type === "node:start");
		const nodeCompletes = events.filter((e) => e.type === "node:complete");

		expect(nodeStarts.length).toBe(2);
		expect(nodeCompletes.length).toBe(2);

		// First node should be planner
		const firstStart = nodeStarts[0] as { nodeId: string };
		expect(firstStart.nodeId).toBe("planner");

		// 6. Agent streaming events were emitted
		const textDeltas = events.filter((e) => e.type === "agent:text:delta");
		expect(textDeltas.length).toBeGreaterThan(0);

		console.log("✅ Simple flow executed successfully with real fixtures");
		console.log(`   - Planner output: ${plannerOutput.text.slice(0, 50)}...`);
		console.log(`   - Coder output length: ${coderOutput.text.length} chars`);
		console.log(`   - Total streaming events: ${textDeltas.length}`);
	});

	test("recorded fixtures have real SDK structure", async () => {
		const plannerFixture = await loadFixture("planner");
		const call = plannerFixture.calls[0];

		// Verify this is a real recording, not fabricated
		expect(call.output.sessionId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);

		// Real fixtures have model usage breakdown
		expect(call.output.modelUsage).toBeDefined();

		// Real fixtures have events with proper structure
		expect(call.events.length).toBeGreaterThan(5);

		// Check for expected event types
		type EventWithType = { type: string; uuid?: string };
		const eventTypes = call.events.map((e) => (e as EventWithType).type);
		expect(eventTypes).toContain("system");
		expect(eventTypes).toContain("stream_event");
		expect(eventTypes).toContain("assistant");
		expect(eventTypes).toContain("result");

		// Check stream events have real UUIDs
		const streamEvent = call.events.find(
			(e) => (e as EventWithType).type === "stream_event",
		) as EventWithType | undefined;
		expect(streamEvent?.uuid).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);

		console.log("✅ Fixtures verified as real SDK recordings");
	});
});
