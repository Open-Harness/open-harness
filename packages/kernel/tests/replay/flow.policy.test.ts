// Replay tests for NodePolicy structure
// Uses fixtures from tests/fixtures/golden/flow/

import { describe, expect, test } from "bun:test";
import { NodePolicySchema } from "../../src/flow/validator.js";
import { loadFlowFixture } from "../helpers/fixture-loader.js";

describe("NodePolicy Structure (replay)", () => {
	test("NodePolicy supports timeout, retry, continueOnError", async () => {
		const fixture = await loadFlowFixture("flow/node-policy");

		for (const entry of fixture.cases) {
			const parsed = NodePolicySchema.safeParse(entry.input);
			const expectedValid = entry.valid ?? true;
			expect(parsed.success).toBe(expectedValid);
		}
	});
});
