// Flow file loader utilities (promptFile and outputSchemaFile support)

import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { parseFlowYaml } from "./parser.js";
import type { FlowYamlValidated } from "./validator.js";
import { validateFlowYaml } from "./validator.js";

function resolveFilePath(baseDir: string, filePath: string): string {
	return isAbsolute(filePath) ? filePath : resolve(baseDir, filePath);
}

async function readFileContent(
	nodeId: string,
	fileType: string,
	baseDir: string,
	filePath: string,
): Promise<string> {
	const resolvedPath = resolveFilePath(baseDir, filePath);
	try {
		return await readFile(resolvedPath, "utf-8");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Failed to read ${fileType} for node "${nodeId}": ${resolvedPath} (${message})`,
		);
	}
}

export async function resolveFileReferences(
	flow: FlowYamlValidated,
	baseDir: string,
): Promise<FlowYamlValidated> {
	const updatedNodes = await Promise.all(
		flow.nodes.map(async (node) => {
			if (!node.input) {
				return node;
			}

			const input = node.input as Record<string, unknown>;
			let updatedInput = { ...input };

			// Handle promptFile
			if ("promptFile" in input) {
				const promptFile = input.promptFile;
				if (typeof promptFile !== "string") {
					throw new Error(`Node "${node.id}" promptFile must be a string path`);
				}

				if ("prompt" in input) {
					throw new Error(
						`Node "${node.id}" cannot specify both prompt and promptFile`,
					);
				}

				const content = await readFileContent(
					node.id,
					"promptFile",
					baseDir,
					promptFile,
				);
				const { promptFile: _promptFile, ...rest } = updatedInput;
				updatedInput = { ...rest, prompt: content };
			}

			// Handle outputSchemaFile
			if ("outputSchemaFile" in input) {
				const outputSchemaFile = input.outputSchemaFile;
				if (typeof outputSchemaFile !== "string") {
					throw new Error(
						`Node "${node.id}" outputSchemaFile must be a string path`,
					);
				}

				const schemaContent = await readFileContent(
					node.id,
					"outputSchemaFile",
					baseDir,
					outputSchemaFile,
				);

				let schema: unknown;
				try {
					schema = JSON.parse(schemaContent);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					throw new Error(
						`Node "${node.id}" outputSchemaFile must contain valid JSON: ${message}`,
					);
				}

				// Remove outputSchemaFile and merge schema into options.output_schema
				const {
					outputSchemaFile: _outputSchemaFile,
					options,
					...rest
				} = updatedInput;
				const existingOptions =
					typeof options === "object" && options !== null ? options : {};

				// Check for conflicting output_schema in options
				if (
					"output_schema" in existingOptions ||
					"outputSchema" in existingOptions
				) {
					throw new Error(
						`Node "${node.id}" cannot specify both outputSchemaFile and options.output_schema (or options.outputSchema). Use outputSchemaFile OR set the schema directly in options.output_schema.`,
					);
				}

				updatedInput = {
					...rest,
					options: {
						...existingOptions,
						output_schema: schema,
					},
				};
			}

			return {
				...node,
				input: updatedInput,
			};
		}),
	);

	return validateFlowYaml({
		...flow,
		nodes: updatedNodes,
	});
}

/**
 * @deprecated Use resolveFileReferences instead. This function only handles promptFile.
 */
export async function resolvePromptFiles(
	flow: FlowYamlValidated,
	baseDir: string,
): Promise<FlowYamlValidated> {
	return resolveFileReferences(flow, baseDir);
}

export async function loadFlowYamlFile(
	filePath: string,
): Promise<FlowYamlValidated> {
	const source = await readFile(filePath, "utf-8");
	const parsed = parseFlowYaml(source);
	const baseDir = dirname(filePath);
	return resolveFileReferences(parsed, baseDir);
}
