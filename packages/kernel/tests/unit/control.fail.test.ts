// Unit tests for control.fail node
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import {
	controlFailNode,
	FlowFailError,
} from "../../src/flow/nodes/control.fail.js";
import type { NodeRunContext } from "../../src/protocol/flow.js";

describe("control.fail node", () => {
	test("throws FlowFailError with message", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const ctx: NodeRunContext = {
			hub,
			runId: "run-0",
		};

		await expect(
			controlFailNode.run(ctx, { message: "Something went wrong" }),
		).rejects.toThrow("Something went wrong");
	});

	test("throws FlowFailError instance", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const ctx: NodeRunContext = {
			hub,
			runId: "run-0",
		};

		try {
			await controlFailNode.run(ctx, { message: "Test failure" });
			expect.unreachable("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(FlowFailError);
			expect((error as FlowFailError).isFlowFailError).toBe(true);
			expect((error as FlowFailError).name).toBe("FlowFailError");
		}
	});

	test("FlowFailError has discriminator property", () => {
		const error = new FlowFailError("test");

		expect(error.isFlowFailError).toBe(true);
		expect(error.message).toBe("test");
		expect(error.name).toBe("FlowFailError");
	});

	test("has correct type", () => {
		expect(controlFailNode.type).toBe("control.fail");
	});

	test("has metadata with danger color", () => {
		expect(controlFailNode.metadata?.displayName).toBe("Fail");
		expect(controlFailNode.metadata?.category).toBe("control");
		expect(controlFailNode.metadata?.color).toBe("#ef4444"); // Red
	});

	test("has no special capabilities", () => {
		expect(controlFailNode.capabilities?.isContainer).toBeFalsy();
		expect(controlFailNode.capabilities?.needsBindingContext).toBeFalsy();
	});
});
