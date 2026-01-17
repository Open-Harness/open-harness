import { describe, expect, test } from "bun:test";
import {
	createSignal,
	isSignal,
	type Signal,
	type SignalDisplay,
	type SignalDisplayStatus,
	type SignalDisplayType,
} from "../src/signal.js";

describe("Signal", () => {
	describe("createSignal", () => {
		test("creates signal with id, name, payload, and auto-timestamp", () => {
			const signal = createSignal("test:event", { value: 42 });

			expect(signal.id).toMatch(/^sig_/);
			expect(signal.name).toBe("test:event");
			expect(signal.payload).toEqual({ value: 42 });
			expect(typeof signal.timestamp).toBe("string");
			expect(new Date(signal.timestamp).getTime()).not.toBeNaN();
		});

		test("includes source when provided", () => {
			const signal = createSignal(
				"analysis:complete",
				{ result: "bullish" },
				{
					agent: "analyst",
					parent: "harness:start",
				},
			);

			expect(signal.source?.agent).toBe("analyst");
			expect(signal.source?.parent).toBe("harness:start");
		});

		test("handles primitive payloads", () => {
			const stringSignal = createSignal("log:message", "hello");
			const numberSignal = createSignal("counter:increment", 1);
			const nullSignal = createSignal("state:cleared", null);

			expect(stringSignal.payload).toBe("hello");
			expect(numberSignal.payload).toBe(1);
			expect(nullSignal.payload).toBe(null);
		});
	});

	describe("createSignal with display metadata", () => {
		test("creates signal with display metadata via options object", () => {
			interface PlanPayload {
				taskCount: number;
			}
			const signal = createSignal<PlanPayload>(
				"plan:created",
				{ taskCount: 5 },
				{
					display: {
						type: "notification",
						title: (payload) => {
							const p = payload as PlanPayload;
							return `Plan created with ${p.taskCount} tasks`;
						},
						status: "success",
						icon: "✓",
					},
				},
			);

			expect(signal.display).toBeDefined();
			expect(signal.display?.type).toBe("notification");
			expect(signal.display?.status).toBe("success");
			expect(signal.display?.icon).toBe("✓");
			// Test title function
			const titleFn = signal.display?.title as (p: unknown) => string;
			expect(titleFn(signal.payload)).toBe("Plan created with 5 tasks");
		});

		test("creates signal with both source and display", () => {
			const signal = createSignal(
				"task:complete",
				{ taskId: "T1", outcome: "success" },
				{
					source: { agent: "planner", parent: "sig_parent" },
					display: {
						type: "notification",
						title: "Task completed",
						status: "success",
					},
				},
			);

			expect(signal.source?.agent).toBe("planner");
			expect(signal.source?.parent).toBe("sig_parent");
			expect(signal.display?.type).toBe("notification");
			expect(signal.display?.title).toBe("Task completed");
			expect(signal.display?.status).toBe("success");
		});

		test("maintains backward compatibility with legacy source parameter", () => {
			// Old API: createSignal(name, payload, source)
			const signal = createSignal("test:event", { value: 1 }, { agent: "legacy-agent" });

			expect(signal.source?.agent).toBe("legacy-agent");
			expect(signal.display).toBeUndefined();
		});

		test("supports all display types", () => {
			const displayTypes: SignalDisplayType[] = ["status", "progress", "notification", "stream", "log"];

			for (const type of displayTypes) {
				const signal = createSignal(
					`test:${type}`,
					{},
					{
						display: { type },
					},
				);
				expect(signal.display?.type).toBe(type);
			}
		});

		test("supports all display statuses", () => {
			const statuses: SignalDisplayStatus[] = ["pending", "active", "success", "error", "warning"];

			for (const status of statuses) {
				const signal = createSignal(
					`test:${status}`,
					{},
					{
						display: { status },
					},
				);
				expect(signal.display?.status).toBe(status);
			}
		});

		test("supports progress as percentage", () => {
			const signal = createSignal(
				"build:progress",
				{},
				{
					display: {
						type: "progress",
						progress: 75,
					},
				},
			);

			expect(signal.display?.progress).toBe(75);
		});

		test("supports progress as step-based object", () => {
			const signal = createSignal(
				"task:progress",
				{},
				{
					display: {
						type: "progress",
						progress: { current: 3, total: 10 },
					},
				},
			);

			expect(signal.display?.progress).toEqual({ current: 3, total: 10 });
		});

		test("supports append mode for streaming", () => {
			const signal = createSignal(
				"stream:delta",
				{ chunk: "Hello" },
				{
					display: {
						type: "stream",
						append: true,
					},
				},
			);

			expect(signal.display?.type).toBe("stream");
			expect(signal.display?.append).toBe(true);
		});

		test("supports subtitle function", () => {
			interface TaskPayload {
				name: string;
				duration: number;
			}
			const signal = createSignal<TaskPayload>(
				"task:complete",
				{ name: "Build", duration: 120 },
				{
					display: {
						title: (payload) => (payload as TaskPayload).name,
						subtitle: (payload) => `Completed in ${(payload as TaskPayload).duration}s`,
					},
				},
			);

			const subtitleFn = signal.display?.subtitle as (p: unknown) => string;
			expect(subtitleFn(signal.payload)).toBe("Completed in 120s");
		});
	});

	describe("isSignal", () => {
		test("returns true for valid signals", () => {
			const signal = createSignal("test:event", { foo: "bar" });
			expect(isSignal(signal)).toBe(true);
		});

		test("returns true for manually constructed signals", () => {
			const manual: Signal = {
				id: "sig_test123",
				name: "manual:signal",
				payload: undefined,
				timestamp: "2026-01-09T12:00:00.000Z",
			};
			expect(isSignal(manual)).toBe(true);
		});

		test("returns false for non-objects", () => {
			expect(isSignal(null)).toBe(false);
			expect(isSignal(undefined)).toBe(false);
			expect(isSignal("string")).toBe(false);
			expect(isSignal(42)).toBe(false);
		});

		test("returns false for objects missing required fields", () => {
			expect(isSignal({})).toBe(false);
			expect(isSignal({ name: "test" })).toBe(false);
			expect(isSignal({ name: "test", payload: {} })).toBe(false);
			expect(isSignal({ payload: {}, timestamp: "2026-01-09" })).toBe(false);
		});

		test("returns false for wrong field types", () => {
			expect(isSignal({ name: 123, payload: {}, timestamp: "2026-01-09" })).toBe(false);
			expect(isSignal({ name: "test", payload: {}, timestamp: 123 })).toBe(false);
		});

		test("returns true for signals with display metadata", () => {
			const signal = createSignal(
				"test:event",
				{ foo: "bar" },
				{
					display: {
						type: "notification",
						title: "Test Event",
						status: "success",
					},
				},
			);
			expect(isSignal(signal)).toBe(true);
		});
	});
});

describe("SignalDisplay", () => {
	test("functions work with type assertions for payload", () => {
		interface MyPayload {
			count: number;
			name: string;
		}

		const display: SignalDisplay = {
			type: "status",
			title: (payload) => `Processing ${(payload as MyPayload).name}`,
			subtitle: (payload) => `${(payload as MyPayload).count} items remaining`,
			status: "active",
		};

		// Runtime verification
		const titleFn = display.title as (p: unknown) => string;
		const subtitleFn = display.subtitle as (p: unknown) => string;
		const payload: MyPayload = { count: 5, name: "Tasks" };

		expect(titleFn(payload)).toBe("Processing Tasks");
		expect(subtitleFn(payload)).toBe("5 items remaining");
	});

	test("static strings work for title and subtitle", () => {
		const display: SignalDisplay = {
			title: "Static Title",
			subtitle: "Static Subtitle",
		};

		expect(display.title).toBe("Static Title");
		expect(display.subtitle).toBe("Static Subtitle");
	});

	test("all optional fields can be omitted", () => {
		const minimal: SignalDisplay = {};

		expect(minimal.type).toBeUndefined();
		expect(minimal.title).toBeUndefined();
		expect(minimal.subtitle).toBeUndefined();
		expect(minimal.icon).toBeUndefined();
		expect(minimal.status).toBeUndefined();
		expect(minimal.progress).toBeUndefined();
		expect(minimal.append).toBeUndefined();
	});
});
