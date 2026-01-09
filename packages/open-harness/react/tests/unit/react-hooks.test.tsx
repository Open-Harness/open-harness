import { describe, expect, test } from "bun:test";
import { MockRuntime } from "@open-harness/testing";
import { act, create } from "react-test-renderer";
import { useHarness } from "../../src/react/use-harness.js";
import { useRuntime } from "../../src/react/use-runtime.js";

describe("react hooks", () => {
	test("useRuntime collects events and forwards controls to runtime", async () => {
		const runtime = new MockRuntime();

		let latest: ReturnType<typeof useRuntime> | undefined;

		function TestComponent() {
			latest = useRuntime(runtime);
			return null;
		}

		const root = (() => {
			let root: ReturnType<typeof create> | undefined;
			act(() => {
				root = create(<TestComponent />);
			});
			if (!root) {
				throw new Error("Expected react-test-renderer root");
			}
			return root;
		})();
		expect(latest?.events).toEqual([]);

		act(() => {
			runtime.emit({
				type: "flow:start",
				flowName: "test",
				timestamp: Date.now(),
			});
		});

		expect(latest?.events.length).toBe(1);
		expect(latest?.events[0]?.type).toBe("flow:start");

		act(() => {
			latest?.pause();
		});
		expect(runtime.getPauseCount()).toBe(1);

		await act(async () => {
			await latest?.resume("resume-message");
		});
		expect(runtime.getResumeMessages()).toEqual(["resume-message"]);

		act(() => {
			latest?.stop();
		});
		expect(runtime.getStopCount()).toBe(1);

		const beforeUnmountCount = latest?.events.length ?? 0;
		act(() => {
			root.unmount();
		});

		act(() => {
			runtime.emit({
				type: "flow:complete",
				flowName: "test",
				status: "complete",
				timestamp: Date.now(),
			});
		});
		expect(latest?.events.length ?? 0).toBe(beforeUnmountCount);
	});

	test("useHarness returns idle state by default and sendMessage rejects", async () => {
		let latest: ReturnType<typeof useHarness> | undefined;

		function TestComponent() {
			latest = useHarness({ autoConnect: false });
			return null;
		}

		act(() => {
			create(<TestComponent />);
		});
		if (!latest) {
			throw new Error("Expected useHarness return");
		}

		expect(latest?.status).toBe("idle");
		expect(latest?.events).toEqual([]);
		expect(latest?.isConnected).toBe(false);

		await expect(latest.sendMessage("hi")).rejects.toThrow("sendMessage not yet implemented");
	});
});
