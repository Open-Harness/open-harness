// Unit tests for control.noop node
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { controlNoopNode } from "../../src/flow/nodes/control.noop.js";
import type { NodeRunContext } from "../../src/protocol/flow.js";

describe("control.noop node", () => {
	test("passes through value unchanged", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const ctx: NodeRunContext = {
			hub,
			runId: "run-0",
		};

		const result = await controlNoopNode.run(ctx, { value: "hello" });

		expect(result.value).toBe("hello");
	});

	test("handles undefined value", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const ctx: NodeRunContext = {
			hub,
			runId: "run-0",
		};

		const result = await controlNoopNode.run(ctx, {});

		expect(result.value).toBeUndefined();
	});

	test("passes through complex objects", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const ctx: NodeRunContext = {
			hub,
			runId: "run-0",
		};

		const complexValue = {
			nested: { deep: { value: [1, 2, 3] } },
			array: ["a", "b"],
		};

		const result = await controlNoopNode.run(ctx, { value: complexValue });

		expect(result.value).toEqual(complexValue);
	});

	test("has no special capabilities", () => {
		// noop is just a passthrough - no container, no session creation
		expect(controlNoopNode.capabilities?.isContainer).toBeFalsy();
		expect(controlNoopNode.capabilities?.createsSession).toBeFalsy();
		expect(controlNoopNode.capabilities?.needsBindingContext).toBeFalsy();
	});

	test("has correct type", () => {
		expect(controlNoopNode.type).toBe("control.noop");
	});

	test("has metadata for visual editor", () => {
		expect(controlNoopNode.metadata?.displayName).toBe("No-Op");
		expect(controlNoopNode.metadata?.category).toBe("control");
	});
});
