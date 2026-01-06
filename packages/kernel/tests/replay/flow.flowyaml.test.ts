// Replay tests for FlowYaml structure
// Uses fixtures from tests/fixtures/golden/flow/

import { describe, expect, test } from "bun:test";
import { validateFlowYaml } from "../../src/flow/validator.js";
import { loadFlowFixture } from "../helpers/fixture-loader.js";

describe("FlowYaml Structure (replay)", () => {
	test("FlowYaml has flow, nodes, edges", async () => {
		const fixture = await loadFlowFixture("flow/flowyaml-structure");

		for (const entry of fixture.cases) {
			let success = true;
			try {
				validateFlowYaml(entry.input);
			} catch {
				success = false;
			}
			const expectedValid = entry.valid ?? true;
			expect(success).toBe(expectedValid);
		}
	});
});
