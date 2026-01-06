// Flow file loader utilities (promptFile support)

import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { parseFlowYaml } from "./parser.js";
import type { FlowYamlValidated } from "./validator.js";
import { validateFlowYaml } from "./validator.js";

function resolvePromptFilePath(baseDir: string, promptFile: string): string {
	return isAbsolute(promptFile) ? promptFile : resolve(baseDir, promptFile);
}

export async function resolvePromptFiles(
	flow: FlowYamlValidated,
	baseDir: string,
): Promise<FlowYamlValidated> {
	const updatedNodes = await Promise.all(
		flow.nodes.map(async (node) => {
			if (!node.input || !("promptFile" in node.input)) {
				return node;
			}

			const promptFile = (node.input as { promptFile?: unknown }).promptFile;
			if (typeof promptFile !== "string") {
				throw new Error(`Node "${node.id}" promptFile must be a string path`);
			}

			if ("prompt" in node.input) {
				throw new Error(
					`Node "${node.id}" cannot specify both prompt and promptFile`,
				);
			}

			const resolvedPath = resolvePromptFilePath(baseDir, promptFile);
			let content: string;
			try {
				content = await readFile(resolvedPath, "utf-8");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(
					`Failed to read promptFile for node "${node.id}": ${resolvedPath} (${message})`,
				);
			}

			const { promptFile: _promptFile, ...rest } = node.input as Record<
				string,
				unknown
			>;

			return {
				...node,
				input: {
					...rest,
					prompt: content,
				},
			};
		}),
	);

	return validateFlowYaml({
		...flow,
		nodes: updatedNodes,
	});
}

export async function loadFlowYamlFile(
	filePath: string,
): Promise<FlowYamlValidated> {
	const source = await readFile(filePath, "utf-8");
	const parsed = parseFlowYaml(source);
	const baseDir = dirname(filePath);
	return resolvePromptFiles(parsed, baseDir);
}
