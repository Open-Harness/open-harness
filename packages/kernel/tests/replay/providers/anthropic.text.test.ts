// Replay tests for Anthropic provider adapter
// Uses fixtures from tests/fixtures/golden/providers/anthropic/

import { describe, expect, test } from "bun:test";
import { createHub } from "../../../src/engine/hub.js";
import { AgentInboxImpl } from "../../../src/engine/inbox.js";
import { createAnthropicTextAgent } from "../../../src/providers/anthropic.js";
import { loadProviderFixture } from "../../helpers/fixture-loader.js";

describe("Anthropic Provider (replay)", () => {
	test("text adapter returns replay output", async () => {
		const fixture = await loadProviderFixture("providers/anthropic/text");

		for (const entry of fixture.cases) {
			const input = entry.input as { prompt: string; model?: string };
			if (!entry.expected) {
				throw new Error(`Missing expected output for case: ${entry.name}`);
			}

			const expected = entry.expected as { text: string };
			const agent = createAnthropicTextAgent({
				replay: { [input.prompt]: expected.text },
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
