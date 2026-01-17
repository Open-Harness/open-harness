import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineSignal } from "./define-signal.js";
import { isSignal, type Signal } from "./signal.js";

describe("defineSignal", () => {
	describe("basic definition", () => {
		test("creates a SignalDefinition with name and schema", () => {
			const PayloadSchema = z.object({ value: z.number() });
			const TestSignal = defineSignal({
				name: "test:event",
				schema: PayloadSchema,
			});

			expect(TestSignal.name).toBe("test:event");
			expect(TestSignal.schema).toBe(PayloadSchema);
		});

		test("stores meta when provided", () => {
			const TestSignal = defineSignal({
				name: "test:event",
				schema: z.object({}),
				meta: { level: "info", category: "lifecycle" },
			});

			expect(TestSignal.meta).toEqual({ level: "info", category: "lifecycle" });
		});

		test("stores displayConfig when provided", () => {
			const TestSignal = defineSignal({
				name: "test:event",
				schema: z.object({ count: z.number() }),
				display: {
					type: "notification",
					title: (p) => `Count: ${p.count}`,
					status: "success",
				},
			});

			expect(TestSignal.displayConfig?.type).toBe("notification");
			expect(TestSignal.displayConfig?.status).toBe("success");
			// Verify title function works
			const titleFn = TestSignal.displayConfig?.title as (p: { count: number }) => string;
			expect(titleFn({ count: 42 })).toBe("Count: 42");
		});
	});

	describe("create()", () => {
		test("creates a valid signal with correct structure", () => {
			const TestSignal = defineSignal({
				name: "test:created",
				schema: z.object({ message: z.string() }),
			});

			const signal = TestSignal.create({ message: "hello" });

			expect(signal.id).toMatch(/^sig_/);
			expect(signal.name).toBe("test:created");
			expect(signal.payload).toEqual({ message: "hello" });
			expect(typeof signal.timestamp).toBe("string");
			expect(isSignal(signal)).toBe(true);
		});

		test("attaches display metadata from definition", () => {
			const TaskSignal = defineSignal({
				name: "task:complete",
				schema: z.object({ taskId: z.string(), duration: z.number() }),
				display: {
					type: "notification",
					title: (p) => `Task ${p.taskId} completed`,
					subtitle: (p) => `Completed in ${p.duration}ms`,
					status: "success",
					icon: "✓",
				},
			});

			const signal = TaskSignal.create({ taskId: "T-001", duration: 150 });

			expect(signal.display).toBeDefined();
			expect(signal.display?.type).toBe("notification");
			expect(signal.display?.status).toBe("success");
			expect(signal.display?.icon).toBe("✓");

			// Verify functions work with payload
			const titleFn = signal.display?.title as (p: unknown) => string;
			const subtitleFn = signal.display?.subtitle as (p: unknown) => string;
			expect(titleFn(signal.payload)).toBe("Task T-001 completed");
			expect(subtitleFn(signal.payload)).toBe("Completed in 150ms");
		});

		test("attaches source when provided in options", () => {
			const TestSignal = defineSignal({
				name: "test:event",
				schema: z.object({}),
			});

			const signal = TestSignal.create(
				{},
				{
					source: { agent: "test-agent", parent: "sig_parent" },
				},
			);

			expect(signal.source?.agent).toBe("test-agent");
			expect(signal.source?.parent).toBe("sig_parent");
		});

		test("allows display overrides via options", () => {
			const TestSignal = defineSignal({
				name: "test:event",
				schema: z.object({}),
				display: {
					type: "notification",
					status: "pending",
				},
			});

			const signal = TestSignal.create(
				{},
				{
					display: { status: "success" },
				},
			);

			// Override should take precedence
			expect(signal.display?.status).toBe("success");
			// But base type should still be present
			expect(signal.display?.type).toBe("notification");
		});

		test("validates payload against schema", () => {
			const StrictSignal = defineSignal({
				name: "strict:event",
				schema: z.object({
					count: z.number().min(0).max(100),
					label: z.string().min(1),
				}),
			});

			// Valid payload should work
			const valid = StrictSignal.create({ count: 50, label: "test" });
			expect(valid.payload).toEqual({ count: 50, label: "test" });

			// Invalid payload should throw
			expect(() => {
				StrictSignal.create({ count: 150, label: "test" }); // count too high
			}).toThrow();

			expect(() => {
				StrictSignal.create({ count: 50, label: "" }); // empty label
			}).toThrow();
		});

		test("provides type inference from schema", () => {
			const TypedSignal = defineSignal({
				name: "typed:event",
				schema: z.object({
					id: z.string(),
					items: z.array(z.number()),
					nested: z.object({
						flag: z.boolean(),
					}),
				}),
			});

			// TypeScript should infer the payload type correctly
			const signal = TypedSignal.create({
				id: "abc",
				items: [1, 2, 3],
				nested: { flag: true },
			});

			// These assertions verify the type inference is working
			expect(signal.payload.id).toBe("abc");
			expect(signal.payload.items).toEqual([1, 2, 3]);
			expect(signal.payload.nested.flag).toBe(true);
		});
	});

	describe("is()", () => {
		test("returns true for matching signals", () => {
			const TestSignal = defineSignal({
				name: "test:match",
				schema: z.object({ value: z.number() }),
			});

			const signal = TestSignal.create({ value: 42 });
			expect(TestSignal.is(signal)).toBe(true);
		});

		test("returns false for non-matching signal names", () => {
			const TestSignal = defineSignal({
				name: "test:match",
				schema: z.object({ value: z.number() }),
			});

			const OtherSignal = defineSignal({
				name: "other:event",
				schema: z.object({ value: z.number() }),
			});

			const otherSignal = OtherSignal.create({ value: 42 });
			expect(TestSignal.is(otherSignal)).toBe(false);
		});

		test("returns false for non-signal values", () => {
			const TestSignal = defineSignal({
				name: "test:event",
				schema: z.object({}),
			});

			expect(TestSignal.is(null)).toBe(false);
			expect(TestSignal.is(undefined)).toBe(false);
			expect(TestSignal.is({})).toBe(false);
			expect(TestSignal.is({ name: "test:event" })).toBe(false); // missing required fields
			expect(TestSignal.is("string")).toBe(false);
		});

		test("validates payload when validatePayload is true", () => {
			const StrictSignal = defineSignal({
				name: "strict:event",
				schema: z.object({ count: z.number().min(0) }),
			});

			// Create a valid signal
			const validSignal = StrictSignal.create({ count: 10 });
			expect(StrictSignal.is(validSignal, true)).toBe(true);

			// Manually construct an invalid signal (bypassing validation)
			const invalidSignal: Signal<{ count: number }> = {
				id: "sig_test",
				name: "strict:event",
				payload: { count: -5 }, // Invalid: below min
				timestamp: new Date().toISOString(),
			};

			// Without payload validation, name match is enough
			expect(StrictSignal.is(invalidSignal, false)).toBe(true);
			// With payload validation, it should fail
			expect(StrictSignal.is(invalidSignal, true)).toBe(false);
		});

		test("narrows type correctly in conditionals", () => {
			const PlanCreated = defineSignal({
				name: "plan:created",
				schema: z.object({
					taskCount: z.number(),
					milestones: z.array(z.string()),
				}),
			});

			const signal = PlanCreated.create({ taskCount: 5, milestones: ["M1", "M2"] });
			const unknownSignal: Signal = signal;

			if (PlanCreated.is(unknownSignal)) {
				// TypeScript should know this is Signal<PlanPayload>
				expect(unknownSignal.payload.taskCount).toBe(5);
				expect(unknownSignal.payload.milestones).toEqual(["M1", "M2"]);
			} else {
				// Should not reach here
				expect(true).toBe(false);
			}
		});
	});

	describe("display types", () => {
		test("supports status display type", () => {
			const StatusSignal = defineSignal({
				name: "status:update",
				schema: z.object({ phase: z.string() }),
				display: {
					type: "status",
					title: (p) => `Phase: ${p.phase}`,
					status: "active",
				},
			});

			const signal = StatusSignal.create({ phase: "planning" });
			expect(signal.display?.type).toBe("status");
		});

		test("supports progress display type with percentage", () => {
			const ProgressSignal = defineSignal({
				name: "build:progress",
				schema: z.object({ percent: z.number() }),
				display: {
					type: "progress",
					progress: 50,
				},
			});

			const signal = ProgressSignal.create({ percent: 50 });
			expect(signal.display?.type).toBe("progress");
			expect(signal.display?.progress).toBe(50);
		});

		test("supports progress display type with steps", () => {
			const TaskProgress = defineSignal({
				name: "tasks:progress",
				schema: z.object({ current: z.number(), total: z.number() }),
				display: {
					type: "progress",
					progress: { current: 3, total: 10 },
					title: (p) => `Task ${p.current}/${p.total}`,
				},
			});

			const signal = TaskProgress.create({ current: 3, total: 10 });
			expect(signal.display?.progress).toEqual({ current: 3, total: 10 });
		});

		test("supports stream display type with append", () => {
			const StreamDelta = defineSignal({
				name: "stream:delta",
				schema: z.object({ content: z.string() }),
				display: {
					type: "stream",
					append: true,
				},
			});

			const signal = StreamDelta.create({ content: "chunk" });
			expect(signal.display?.type).toBe("stream");
			expect(signal.display?.append).toBe(true);
		});

		test("supports log display type", () => {
			const LogEvent = defineSignal({
				name: "log:event",
				schema: z.object({ message: z.string(), level: z.string() }),
				meta: { level: "debug" },
				display: {
					type: "log",
					title: (p) => p.message,
				},
			});

			const signal = LogEvent.create({ message: "Debug info", level: "debug" });
			expect(signal.display?.type).toBe("log");
			expect(LogEvent.meta?.level).toBe("debug");
		});
	});

	describe("edge cases", () => {
		test("handles empty object schema", () => {
			const EmptySignal = defineSignal({
				name: "empty:event",
				schema: z.object({}),
			});

			const signal = EmptySignal.create({});
			expect(signal.payload).toEqual({});
		});

		test("handles union types in schema", () => {
			const UnionSignal = defineSignal({
				name: "result:complete",
				schema: z.discriminatedUnion("type", [
					z.object({ type: z.literal("success"), data: z.string() }),
					z.object({ type: z.literal("error"), error: z.string() }),
				]),
			});

			const successSignal = UnionSignal.create({ type: "success", data: "result" });
			expect(successSignal.payload.type).toBe("success");

			const errorSignal = UnionSignal.create({ type: "error", error: "failed" });
			expect(errorSignal.payload.type).toBe("error");
		});

		test("handles optional fields in schema", () => {
			const OptionalSignal = defineSignal({
				name: "optional:event",
				schema: z.object({
					required: z.string(),
					optional: z.string().optional(),
				}),
			});

			const withOptional = OptionalSignal.create({ required: "yes", optional: "also" });
			expect(withOptional.payload.optional).toBe("also");

			const withoutOptional = OptionalSignal.create({ required: "yes" });
			expect(withoutOptional.payload.optional).toBeUndefined();
		});

		test("handles default values in schema", () => {
			const DefaultSignal = defineSignal({
				name: "default:event",
				schema: z.object({
					value: z.number().default(42),
				}),
			});

			const withDefault = DefaultSignal.create({});
			expect(withDefault.payload.value).toBe(42);

			const withOverride = DefaultSignal.create({ value: 100 });
			expect(withOverride.payload.value).toBe(100);
		});

		test("preserves schema transformation", () => {
			const TransformSignal = defineSignal({
				name: "transform:event",
				schema: z.object({
					date: z.string().transform((s) => new Date(s)),
				}),
			});

			const signal = TransformSignal.create({ date: "2026-01-19T12:00:00Z" });
			expect(signal.payload.date).toBeInstanceOf(Date);
		});

		test("static title and subtitle work correctly", () => {
			const StaticSignal = defineSignal({
				name: "static:event",
				schema: z.object({}),
				display: {
					title: "Static Title",
					subtitle: "Static Subtitle",
					status: "pending",
				},
			});

			const signal = StaticSignal.create({});
			expect(signal.display?.title).toBe("Static Title");
			expect(signal.display?.subtitle).toBe("Static Subtitle");
		});
	});
});
