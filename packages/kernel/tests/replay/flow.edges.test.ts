// Replay tests for edge requirements
// Uses fixtures from tests/fixtures/golden/flow/

import { describe, expect, test } from "bun:test";
import { validateFlowYaml } from "../../src/flow/validator.js";
import { loadFlowFixture } from "../helpers/fixture-loader.js";

describe("Flow Edges (replay)", () => {
	test("edges define explicit dependencies", async () => {
		const fixture = await loadFlowFixture("flow/edges");

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
