/**
 * Tests for SignalReporter interface and utility functions
 */

import { describe, expect, it, mock } from "bun:test";
import { createSignal } from "@signals/core";
import { SignalBus } from "../src/bus.js";
import { attachReporter, attachReporters, type SignalReporter } from "../src/reporter.js";

describe("SignalReporter", () => {
	describe("attachReporter", () => {
		it("subscribes reporter to its patterns", () => {
			const bus = new SignalBus();
			const signals: string[] = [];

			const reporter: SignalReporter = {
				name: "test",
				patterns: ["test:*"],
				onSignal: (signal) => signals.push(signal.name),
			};

			attachReporter(bus, reporter);

			bus.emit(createSignal("test:one", {}));
			bus.emit(createSignal("test:two", {}));
			bus.emit(createSignal("other:signal", {}));

			expect(signals).toEqual(["test:one", "test:two"]);
		});

		it("calls onAttach when attached", () => {
			const bus = new SignalBus();
			const onAttach = mock(() => {});

			const reporter: SignalReporter = {
				name: "test",
				patterns: ["**"],
				onSignal: () => {},
				onAttach,
			};

			attachReporter(bus, reporter);

			expect(onAttach).toHaveBeenCalledTimes(1);
		});

		it("calls onDetach when unsubscribed", () => {
			const bus = new SignalBus();
			const onDetach = mock(() => {});

			const reporter: SignalReporter = {
				name: "test",
				patterns: ["**"],
				onSignal: () => {},
				onDetach,
			};

			const unsubscribe = attachReporter(bus, reporter);
			expect(onDetach).not.toHaveBeenCalled();

			unsubscribe();
			expect(onDetach).toHaveBeenCalledTimes(1);
		});

		it("passes context to onSignal", () => {
			const bus = new SignalBus();
			let receivedRunId: string | undefined;

			const reporter: SignalReporter = {
				name: "test",
				patterns: ["**"],
				onSignal: (_signal, ctx) => {
					receivedRunId = ctx.runId;
				},
			};

			attachReporter(bus, reporter, { runId: "test-run-123" });
			bus.emit(createSignal("test", {}));

			expect(receivedRunId).toBe("test-run-123");
		});

		it("stops receiving signals after unsubscribe", () => {
			const bus = new SignalBus();
			const signals: string[] = [];

			const reporter: SignalReporter = {
				name: "test",
				patterns: ["**"],
				onSignal: (signal) => signals.push(signal.name),
			};

			const unsubscribe = attachReporter(bus, reporter);
			bus.emit(createSignal("before", {}));

			unsubscribe();
			bus.emit(createSignal("after", {}));

			expect(signals).toEqual(["before"]);
		});
	});

	describe("attachReporters", () => {
		it("attaches multiple reporters", () => {
			const bus = new SignalBus();
			const signals1: string[] = [];
			const signals2: string[] = [];

			const reporter1: SignalReporter = {
				name: "reporter1",
				patterns: ["a:*"],
				onSignal: (signal) => signals1.push(signal.name),
			};

			const reporter2: SignalReporter = {
				name: "reporter2",
				patterns: ["b:*"],
				onSignal: (signal) => signals2.push(signal.name),
			};

			attachReporters(bus, [reporter1, reporter2]);

			bus.emit(createSignal("a:one", {}));
			bus.emit(createSignal("b:one", {}));

			expect(signals1).toEqual(["a:one"]);
			expect(signals2).toEqual(["b:one"]);
		});

		it("unsubscribes all reporters at once", () => {
			const bus = new SignalBus();
			const onDetach1 = mock(() => {});
			const onDetach2 = mock(() => {});

			const reporter1: SignalReporter = {
				name: "reporter1",
				patterns: ["**"],
				onSignal: () => {},
				onDetach: onDetach1,
			};

			const reporter2: SignalReporter = {
				name: "reporter2",
				patterns: ["**"],
				onSignal: () => {},
				onDetach: onDetach2,
			};

			const unsubscribe = attachReporters(bus, [reporter1, reporter2]);
			unsubscribe();

			expect(onDetach1).toHaveBeenCalledTimes(1);
			expect(onDetach2).toHaveBeenCalledTimes(1);
		});
	});
});
