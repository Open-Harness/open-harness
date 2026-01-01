import { describe, expect, it } from "bun:test";
import { hashContent, render } from "../src/renderer.js";
import type { GithubChannelState } from "../src/types.js";

function createState(
	overrides: Partial<GithubChannelState> = {},
): GithubChannelState {
	return {
		run: { id: "run-1", status: "running" },
		phase: { name: "Planning", status: "running" },
		tasks: [],
		agents: [],
		prompts: [],
		recent: [],
		errors: [],
		updatedAt: new Date().toISOString(),
		...overrides,
	};
}

describe("renderer", () => {
	it("should render basic state", () => {
		const state = createState();
		const rendered = render(state);

		expect(rendered).toContain("Workflow Dashboard");
		expect(rendered).toContain("Planning");
	});

	it("should render tasks", () => {
		const state = createState({
			tasks: [
				{ id: "task-1", state: "done", summary: "Completed" },
				{ id: "task-2", state: "running" },
			],
		});
		const rendered = render(state);

		expect(rendered).toContain("### Tasks");
		expect(rendered).toContain("task-1");
		expect(rendered).toContain("task-2");
		expect(rendered).toContain("Completed");
	});

	it("should render agents", () => {
		const state = createState({
			agents: [{ name: "planner", status: "running", last: "Analyzing..." }],
		});
		const rendered = render(state);

		expect(rendered).toContain("### Agents");
		expect(rendered).toContain("planner");
		expect(rendered).toContain("Analyzing...");
	});

	it("should render open prompts", () => {
		const state = createState({
			prompts: [
				{
					promptId: "prompt-1",
					prompt: "Which approach?",
					choices: ["A", "B"],
					status: "open",
				},
			],
		});
		const rendered = render(state);

		expect(rendered).toContain("### ⚠️ Prompts (Needs Attention)");
		expect(rendered).toContain("prompt-1");
		expect(rendered).toContain("Which approach?");
		expect(rendered).toContain("`A`");
		expect(rendered).toContain("`B`");
	});

	it("should render errors", () => {
		const state = createState({
			errors: [{ ts: new Date().toISOString(), message: "Task failed" }],
		});
		const rendered = render(state);

		expect(rendered).toContain("### ❌ Errors");
		expect(rendered).toContain("Task failed");
	});

	it("should render recent activity", () => {
		const state = createState({
			recent: [
				{ ts: new Date().toISOString(), type: "phase:start", text: "Planning" },
				{ ts: new Date().toISOString(), type: "task:start", text: "task-1" },
			],
		});
		const rendered = render(state);

		expect(rendered).toContain("Recent Activity");
		expect(rendered).toContain("<details>");
		expect(rendered).toContain("phase:start");
		expect(rendered).toContain("task:start");
	});

	it("should render summary if present", () => {
		const state = createState({
			summary: "Previous events summary",
		});
		const rendered = render(state);

		expect(rendered).toContain("### Summary");
		expect(rendered).toContain("Previous events summary");
	});

	it("should include control hints", () => {
		const state = createState();
		const rendered = render(state);

		expect(rendered).toContain("/pause");
		expect(rendered).toContain("/resume");
		expect(rendered).toContain("+1");
		expect(rendered).toContain("rocket");
	});

	it("should produce stable hash for same state", () => {
		const state = createState();
		const rendered1 = render(state);
		const rendered2 = render(state);

		expect(hashContent(rendered1)).toBe(hashContent(rendered2));
	});

	it("should produce different hash for different state", () => {
		const state1 = createState({
			phase: { name: "Planning", status: "running" },
		});
		const state2 = createState({
			phase: { name: "Coding", status: "running" },
		});

		const hash1 = hashContent(render(state1));
		const hash2 = hashContent(render(state2));

		expect(hash1).not.toBe(hash2);
	});

	it("should truncate long text", () => {
		const longText = "a".repeat(200);
		const state = createState({
			tasks: [{ id: "task-1", state: "done", summary: longText }],
		});
		const rendered = render(state);

		expect(rendered).toContain("...");
		expect(rendered.length).toBeLessThan(longText.length + 1000);
	});
});
