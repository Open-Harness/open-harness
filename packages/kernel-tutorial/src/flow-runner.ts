import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	type Attachment,
	defineHarness,
	executeFlow,
	loadFlowYamlFile,
	NodeRegistry,
	type NodePack,
	type FlowYaml,
} from "@open-harness/kernel";

export type NodePackMap = Record<string, NodePack>;

function findConfigPath(configPath?: string): string {
	if (configPath) {
		return resolve(process.cwd(), configPath);
	}

	let current = process.cwd();
	while (true) {
		const candidate = resolve(current, "oh.config.ts");
		if (existsSync(candidate)) {
			return candidate;
		}
		const parent = dirname(current);
		if (parent === current) {
			return candidate;
		}
		current = parent;
	}
}

export async function loadNodePacks(configPath?: string): Promise<NodePackMap> {
	const resolvedPath = findConfigPath(configPath);
	try {
		const module = await import(pathToFileURL(resolvedPath).href);
		const packs = module.nodePacks as NodePackMap | undefined;
		if (!packs || typeof packs !== "object") {
			throw new Error("oh.config.ts must export a nodePacks object");
		}
		return packs;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to load oh.config.ts: ${resolvedPath} (${message})`);
	}
}

export function buildRegistry(
	requestedPacks: string[],
	availablePacks: NodePackMap,
): NodeRegistry {
	const registry = new NodeRegistry();
	for (const packName of requestedPacks) {
		const pack = availablePacks[packName];
		if (!pack) {
			throw new Error(
				`Unknown node pack: ${packName}. Allowed: ${Object.keys(availablePacks).join(", ")}`,
			);
		}
		pack.register(registry);
	}
	return registry;
}

export async function runFlowFile(options: {
	filePath: string;
	inputOverrides?: Record<string, unknown>;
	attachments?: Attachment[];
	configPath?: string;
}): Promise<Record<string, unknown>> {
	const flow = await loadFlowYamlFile(options.filePath);
	return runFlow({
		flow,
		inputOverrides: options.inputOverrides,
		attachments: options.attachments,
		configPath: options.configPath,
	});
}

export async function runFlow(options: {
	flow: FlowYaml;
	inputOverrides?: Record<string, unknown>;
	attachments?: Attachment[];
	configPath?: string;
}): Promise<Record<string, unknown>> {
	const requestedPacks = options.flow.flow.nodePacks;
	if (!requestedPacks || requestedPacks.length === 0) {
		throw new Error(
			"Flow YAML must declare flow.nodePacks (e.g. [core, claude])",
		);
	}

	const availablePacks = await loadNodePacks(options.configPath);
	const registry = buildRegistry(requestedPacks, availablePacks);

	const FlowRunner = defineHarness<{}, {}, Record<string, unknown>>({
		name: options.flow.flow.name ?? "flow-runner",
		agents: {},
		state: () => ({}),
		run: async ({ phase, task, hub }) => {
			const result = await executeFlow(
				options.flow,
				registry,
				{ hub, phase, task },
				options.inputOverrides,
			);
			return result.outputs;
		},
	});

	const harness = FlowRunner.create({});
	for (const attachment of options.attachments ?? []) {
		harness.attach(attachment);
	}

	const result = await harness.run();
	return result.result;
}
