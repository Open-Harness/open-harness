// Replay tests for Claude provider adapter
// Uses fixtures from tests/fixtures/golden/providers/claude/

import { describe, expect, test } from "bun:test";
import { createHub } from "../../../src/engine/hub.js";
import { AgentInboxImpl } from "../../../src/engine/inbox.js";
import { createClaudeAgent } from "../../../src/providers/claude.js";
import { loadProviderFixture } from "../../helpers/fixture-loader.js";

describe("Claude Provider (replay)", () => {
	test("agent adapter returns replay output", async () => {
		const fixture = await loadProviderFixture("providers/claude/agent");

		for (const entry of fixture.cases) {
			const input = entry.input as { prompt: string; model?: string };
			if (!entry.expected) {
				throw new Error(`Missing expected output for case: ${entry.name}`);
			}

			const expected = entry.expected as { text: string };
			const agent = createClaudeAgent({
				replay: (candidate) =>
					candidate.prompt === input.prompt ? expected : undefined,
			});

			const hub = createHub(fixture.sessionId);
			const inbox = new AgentInboxImpl();
			const output = await agent.execute(input, {
				hub,
				inbox,
				runId: "run-0",
			});

			expect(output).toEqual(expected);
		}
	});
});
