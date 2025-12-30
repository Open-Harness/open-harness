import { createSdkMcpServer, type Options, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

export type JsonSchema = Record<string, unknown>;

export const OutputSchemas = {
	CountryFactsV1: {
		zod: z.object({
			country: z.string(),
			capital: z.string(),
			officialLanguage: z.string(),
		}),
		jsonSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				country: { type: "string" },
				capital: { type: "string" },
				officialLanguage: { type: "string" },
			},
			required: ["country", "capital", "officialLanguage"],
		} satisfies JsonSchema,
	},
} as const;

export type OutputSchemaId = keyof typeof OutputSchemas;

export function countryInfo(country: string): z.infer<(typeof OutputSchemas)["CountryFactsV1"]["zod"]> {
	// Offline demo data (no network).
	const facts: Record<string, { country: string; capital: string; officialLanguage: string }> = {
		Benin: { country: "Benin", capital: "Porto-Novo", officialLanguage: "French" },
		"United States": { country: "United States", capital: "Washington, D.C.", officialLanguage: "English" },
	};

	return facts[country] ?? { country, capital: "Unknown", officialLanguage: "Unknown" };
}

const CountryInfoTool = tool(
	"country_info",
	"Return factual info about a country (country, capital, officialLanguage).",
	{
		country: z.string(),
	},
	async ({ country }) => {
		const out = countryInfo(country);

		return {
			content: [{ type: "text", text: JSON.stringify(out) }],
			structuredContent: out,
			isError: false,
		};
	},
);

export const McpServers = {
	geo: createSdkMcpServer({
		name: "geo",
		version: "0.0.0",
		tools: [CountryInfoTool],
	}),
} as const;

export type McpServerId = keyof typeof McpServers;

export function buildAnthropicOptions(args: { mcp: McpServerId[]; outputSchemaId?: OutputSchemaId }): Options {
	const mcpServers: Options["mcpServers"] = {};
	for (const id of args.mcp) {
		(mcpServers as Record<string, unknown>)[id] = McpServers[id];
	}

	return {
		// Run like Claude Code (subscription auth, project settings)
		settingSources: ["project"],
		// Stream deltas for agent:text events
		includePartialMessages: true,
		// Keep each node bounded for CLI DAG execution (no indefinite multi-turn sessions).
		// If you want a "chat node" that stays open, make a separate node type.
		maxTurns: 3,

		// Keep demo non-interactive:
		// - Disable built-in Claude Code tools (Read/Edit/Bash/etc.)
		tools: [],

		// Auto-allow ONLY our demo MCP tool(s) + the internal StructuredOutput helper used
		// when outputFormat is enabled. Deny everything else to keep runs safe and non-interactive.
		canUseTool: async (toolName, input) => {
			const allow =
				toolName === "StructuredOutput" || toolName === "mcp__geo__country_info" || toolName.startsWith("mcp__geo__");

			if (!allow) {
				return { behavior: "deny", message: `Tool not allowed in this demo: ${toolName}`, interrupt: true };
			}

			return { behavior: "allow", updatedInput: input };
		},

		mcpServers,

		...(args.outputSchemaId
			? {
					outputFormat: {
						type: "json_schema",
						schema: OutputSchemas[args.outputSchemaId].jsonSchema,
					},
				}
			: {}),
	};
}
