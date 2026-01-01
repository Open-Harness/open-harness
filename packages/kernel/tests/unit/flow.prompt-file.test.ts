import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlowYaml, resolvePromptFiles } from "../../src/flow/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "fixtures", "prompt-files");

describe("promptFile loader", () => {
	test("resolves promptFile relative to YAML", async () => {
		const yaml = `flow:\n  name: test\n  nodePacks: [core]\n\nnodes:\n  - id: ask\n    type: claude.agent\n    input:\n      promptFile: "./ask.txt"\nedges: []\n`;
		const flow = parseFlowYaml(yaml);
		const resolved = await resolvePromptFiles(flow, fixturesDir);

		const node = resolved.nodes[0];
		expect(node?.input.prompt).toBe(
			"Write a greeting for {{flow.input.name}}.\n",
		);
		expect(node?.input.promptFile).toBeUndefined();
	});

	test("throws when promptFile is missing", async () => {
		const yaml = `flow:\n  name: test\n\nnodes:\n  - id: ask\n    type: claude.agent\n    input:\n      promptFile: "./missing.txt"\nedges: []\n`;
		const flow = parseFlowYaml(yaml);
		await expect(resolvePromptFiles(flow, fixturesDir)).rejects.toThrow(
			/Failed to read promptFile/,
		);
	});

	test("throws when prompt and promptFile are both set", async () => {
		const yaml = `flow:\n  name: test\n\nnodes:\n  - id: ask\n    type: claude.agent\n    input:\n      prompt: "Hi"\n      promptFile: "./ask.txt"\nedges: []\n`;
		const flow = parseFlowYaml(yaml);
		await expect(resolvePromptFiles(flow, fixturesDir)).rejects.toThrow(
			/cannot specify both prompt and promptFile/,
		);
	});
});
