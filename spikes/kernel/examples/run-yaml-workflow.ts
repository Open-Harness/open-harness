import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
	AnthropicAgentDefinition,
	type AgentDefinition,
	type BaseEvent,
	defineChannel,
	defineHarness,
} from "../src/index.ts";
import { buildAnthropicOptions, OutputSchemas, type McpServerId, type OutputSchemaId } from "./yaml-registry.ts";
import { countryInfo } from "./yaml-registry.ts";

type WorkflowYaml = {
	workflow: {
		name: string;
		version?: number;
		description?: string;
		input?: Record<string, unknown>;
		policy?: { failFast?: boolean };
	};
	nodes: Array<{
		id: string;
		type: "anthropic.text" | "anthropic.structured" | "condition.equals" | "mcp.geo.country_info";
		when?: WhenExpr;
		input: Record<string, unknown>;
		config?: { mcp?: McpServerId[]; outputSchemaId?: OutputSchemaId };
		policy?: {
			timeoutMs?: number;
			continueOnError?: boolean;
			retry?: { maxAttempts: number; backoffMs?: number };
		};
	}>;
	edges: Array<{ from: string; to: string }>;
};

type WhenExpr =
	| { equals: { var: string; value: unknown } }
	| { not: WhenExpr }
	| { and: WhenExpr[] }
	| { or: WhenExpr[] };

const WhenSchema: z.ZodType<WhenExpr> = z.lazy(() =>
	z.union([
		z.object({
			equals: z.object({
				var: z.string(),
				value: z.unknown(),
			}),
		}),
		z.object({
			not: WhenSchema,
		}),
		z.object({
			and: z.array(WhenSchema).min(1),
		}),
		z.object({
			or: z.array(WhenSchema).min(1),
		}),
	]),
);

const WorkflowYamlSchema: z.ZodType<WorkflowYaml> = z.object({
	workflow: z.object({
		name: z.string(),
		version: z.number().int().positive().optional(),
		description: z.string().optional(),
		input: z.record(z.string(), z.unknown()).optional(),
		policy: z
			.object({
				failFast: z.boolean().optional(),
			})
			.optional(),
	}),
	nodes: z
		.array(
			z.object({
				id: z.string().min(1).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Node id must be ^[A-Za-z_][A-Za-z0-9_]*$"),
				type: z.enum(["anthropic.text", "anthropic.structured", "condition.equals", "mcp.geo.country_info"]),
				when: WhenSchema.optional(),
				input: z.record(z.string(), z.unknown()),
				config: z
					.object({
						mcp: z.array(z.enum(["geo"])).optional(),
						outputSchemaId: z.enum(["CountryFactsV1"]).optional(),
					})
					.optional(),
				policy: z
					.object({
						timeoutMs: z.number().positive().optional(),
						continueOnError: z.boolean().optional(),
						retry: z
							.object({
								maxAttempts: z.number().int().min(1),
								backoffMs: z.number().int().min(0).optional(),
							})
							.optional(),
					})
					.optional(),
			}),
		)
		.min(1),
	edges: z
		.array(
			z.object({
				from: z.string().min(1),
				to: z.string().min(1),
			}),
		)
		.min(0),
});

function getPath(root: unknown, path: string): unknown {
	const parts = path.split(".").filter(Boolean);
	let cur: unknown = root;
	for (const p of parts) {
		if (typeof cur !== "object" || cur === null) return undefined;
		cur = (cur as Record<string, unknown>)[p];
	}
	return cur;
}

function renderTemplateString(template: string, ctx: Record<string, unknown>): string {
	return template.replace(/\{\{\s*([^\}]+)\s*\}\}/g, (_m, raw) => {
		const expr = String(raw ?? "").trim();

		// A3 binding grammar (MVP):
		// - {{path}} strict: missing -> error
		// - {{?path}} optional: missing -> ""
		// - {{path | default:<json>}} fallback when missing
		// - {{?path | default:<json>}} optional + fallback (fallback wins)
		const segments = expr.split("|").map((s) => s.trim()).filter(Boolean);
		const head = segments[0] ?? "";

		const optional = head.startsWith("?");
		const path = (optional ? head.slice(1) : head).trim();

		let defaultValue: unknown = undefined;
		for (const seg of segments.slice(1)) {
			if (!seg.startsWith("default:")) continue;
			const rawDefault = seg.slice("default:".length).trim();
			try {
				defaultValue = JSON.parse(rawDefault);
			} catch {
				// Keep MVP simple: if it's not valid JSON, treat as a raw string token.
				defaultValue = rawDefault;
			}
		}

		const v = getPath(ctx, path);
		const missing = v === null || v === undefined;
		if (missing) {
			if (defaultValue !== undefined) return typeof defaultValue === "string" ? defaultValue : JSON.stringify(defaultValue);
			if (optional) return "";
			throw new Error(`Missing binding: {{${path}}}`);
		}

		if (typeof v === "string") return v;
		return JSON.stringify(v);
	});
}

function renderInputObject(input: Record<string, unknown>, ctx: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(input)) {
		if (typeof v === "string") out[k] = renderTemplateString(v, ctx);
		else out[k] = v;
	}
	return out;
}

function evalWhen(when: WhenExpr | undefined, ctx: Record<string, unknown>): boolean {
	if (!when) return true;
	if ("equals" in when) {
		const actual = getPath(ctx, when.equals.var);
		return actual === when.equals.value;
	}
	if ("not" in when) return !evalWhen(when.not, ctx);
	if ("and" in when) return when.and.every((w) => evalWhen(w, ctx));
	if ("or" in when) return when.or.some((w) => evalWhen(w, ctx));
	// Exhaustive guard
	const _never: never = when;
	return _never;
}

function buildAgentsFromYaml(def: WorkflowYaml): Record<string, AgentDefinition<Record<string, unknown>, unknown>> {
	const agents: Record<string, AgentDefinition<Record<string, unknown>, unknown>> = {};

	for (const node of def.nodes) {
		if (node.type === "mcp.geo.country_info") {
			agents[node.id] = {
				name: node.id,
				async execute(input) {
					const country = String(input.country ?? "");
					return countryInfo(country);
				},
			};
			continue;
		}

		if (node.type === "condition.equals") {
			agents[node.id] = {
				name: node.id,
				async execute(input) {
					// expects { left, right }
					return { value: input.left === input.right };
				},
			};
			continue;
		}

		if (node.type === "anthropic.text") {
			const mcp = node.config?.mcp ?? [];
			const options = buildAnthropicOptions({ mcp });
			agents[node.id] = new AnthropicAgentDefinition({
				name: node.id,
				options,
				resultMode: "text",
				prompt: (input: Record<string, unknown>) => String(input.prompt ?? ""),
			});
			continue;
		}

		if (node.type === "anthropic.structured") {
			const mcp = node.config?.mcp ?? [];
			const outputSchemaId = node.config?.outputSchemaId;
			if (!outputSchemaId) throw new Error(`Node "${node.id}" anthropic.structured requires config.outputSchemaId`);
			const options = buildAnthropicOptions({ mcp, outputSchemaId });

			const agent = new AnthropicAgentDefinition<Record<string, unknown>, "structured">({
				name: node.id,
				options,
				resultMode: "structured",
				prompt: (input) => String(input.prompt ?? ""),
			});

			// Wrap to validate structured output with Zod.
			agents[node.id] = {
				name: node.id,
				emitsStartComplete: true,
				async execute(input, ctx) {
					const raw = await agent.execute(input, ctx);
					const parsed = OutputSchemas[outputSchemaId].zod.safeParse(raw);
					if (!parsed.success) {
						throw new Error(`Structured output validation failed for ${node.id}: ${parsed.error.message}`);
					}
					return parsed.data;
				},
			};
			continue;
		}

		// Exhaustive
		const _never: never = node.type;
		throw new Error(`Unknown node type: ${_never}`);
	}

	return agents;
}

function buildTopo(def: WorkflowYaml): string[] {
	const nodeIds = new Set(def.nodes.map((n) => n.id));
	const edges = def.edges;

	const indegree: Record<string, number> = {};
	const out: Record<string, string[]> = {};
	for (const id of nodeIds) {
		indegree[id] = 0;
		out[id] = [];
	}
	for (const e of edges) {
		if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
		out[e.from]?.push(e.to);
		indegree[e.to] = (indegree[e.to] ?? 0) + 1;
	}

	const q: string[] = [];
	for (const [id, deg] of Object.entries(indegree)) if (deg === 0) q.push(id);

	const order: string[] = [];
	while (q.length) {
		const id = q.shift() as string;
		order.push(id);
		for (const nxt of out[id] ?? []) {
			indegree[nxt] = (indegree[nxt] ?? 0) - 1;
			if (indegree[nxt] === 0) q.push(nxt);
		}
	}
	return order;
}

const ConsoleChannel = defineChannel({
	name: "console",
	on: {
		"agent:*": ({ event }) => {
			if (event.event.type === "agent:text") {
				const e = event.event as Extract<BaseEvent, { type: "agent:text" }>;
				process.stdout.write(e.content);
				return;
			}
			if (event.event.type === "agent:tool:start") {
				const e = event.event as Extract<BaseEvent, { type: "agent:tool:start" }>;
				console.log(`\n[tool:start] ${e.toolName}`);
				return;
			}
			if (event.event.type === "agent:tool:complete") {
				const e = event.event as Extract<BaseEvent, { type: "agent:tool:complete" }>;
				console.log(`\n[tool:complete] ${e.toolName}`);
				return;
			}
			console.log(`[agent] ${event.event.type}`, event.event);
		},
		"phase:*": ({ event }) => console.log(`[phase] ${event.event.type}`),
		"task:*": ({ event }) => console.log(`[task] ${event.event.type}`),
	},
});

async function main() {
	const yamlUrl = new URL("./workflow.benin.yaml", import.meta.url);
	const text = await Bun.file(yamlUrl).text();
	const parsed = WorkflowYamlSchema.parse(parseYaml(text));

	const nodesById = new Map(parsed.nodes.map((n) => [n.id, n]));
	const agents = buildAgentsFromYaml(parsed);
	const order = buildTopo(parsed);

	const Workflow = defineHarness({
		name: parsed.workflow.name,
		agents,
		state: () => ({
			workflowInput: parsed.workflow.input ?? {},
			outputs: {} as Record<string, unknown>,
		}),
		run: async ({ agents, state, phase, task }) => {
			await phase("Run DAG", async () => {
				for (const nodeId of order) {
					const node = nodesById.get(nodeId);
					if (!node) continue;

					const templateCtx = {
						workflow: { input: state.workflowInput },
						...state.outputs,
					} as Record<string, unknown>;

					if (!evalWhen(node.when, templateCtx)) {
						state.outputs[nodeId] = { skipped: true };
						continue;
					}

					const renderedInput = renderInputObject(node.input, templateCtx);
					await task(`node:${nodeId}`, async () => {
						const out = await (agents as any)[nodeId].execute(renderedInput);
						state.outputs[nodeId] = out;
						return out;
					});
				}
			});

			return state.outputs;
		},
	});

	const res = await Workflow.create({})
		.attach(ConsoleChannel)
		.startSession()
		.run();

	console.log("\n\n=== Outputs ===");
	for (const [k, v] of Object.entries(res.result)) {
		console.log(k, v);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

