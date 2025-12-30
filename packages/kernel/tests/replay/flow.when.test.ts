// Replay tests for WhenExpr grammar
// Uses fixtures from tests/fixtures/golden/flow/

import { describe, expect, test } from "bun:test";
import { WhenExprSchema } from "../../src/flow/validator.js";
import { loadFlowFixture } from "../helpers/fixture-loader.js";

describe("WhenExpr Grammar (replay)", () => {
	test("WhenExpr supports equals, not, and, or", async () => {
		const fixture = await loadFlowFixture("flow/when-expr");

		for (const entry of fixture.cases) {
			const parsed = WhenExprSchema.safeParse(entry.input);
			const expectedValid = entry.valid ?? true;
			expect(parsed.success).toBe(expectedValid);
		}
	});
});
