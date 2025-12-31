// Flow validation schemas
// Implements docs/flow/flow-spec.md, when.md, registry.md

import { z } from "zod";
import type { WhenExpr } from "../protocol/flow.js";

const nodeIdPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const NodeIdSchema = z
	.string()
	.regex(nodeIdPattern, "NodeId must match ^[A-Za-z_][A-Za-z0-9_]*$");

export const NodeTypeIdSchema = z.string();

export const FlowPolicySchema = z
	.object({
		failFast: z.boolean().optional().default(true),
	})
	.default({ failFast: true });

export const FlowSpecSchema = z.object({
	name: z.string(),
	version: z.number().optional().default(1),
	description: z.string().optional(),
	input: z.record(z.string(), z.unknown()).optional(),
	nodePacks: z.array(z.string()).optional(),
	policy: FlowPolicySchema.optional().default({ failFast: true }),
});

export const WhenExprSchema: z.ZodType<WhenExpr> = z.lazy(() =>
	z.union([
		z.object({
			equals: z.object({ var: z.string(), value: z.unknown() }),
		}),
		z.object({
			not: WhenExprSchema,
		}),
		z.object({
			and: z.array(WhenExprSchema),
		}),
		z.object({
			or: z.array(WhenExprSchema),
		}),
	]),
);

export const RetryPolicySchema = z.object({
	maxAttempts: z.number().int().min(1),
	backoffMs: z.number().int().nonnegative().optional().default(0),
});

export const NodePolicySchema = z.object({
	timeoutMs: z.number().int().nonnegative().optional(),
	retry: RetryPolicySchema.optional(),
	continueOnError: z.boolean().optional(),
});

export const NodeSpecSchema = z.object({
	id: NodeIdSchema,
	type: NodeTypeIdSchema,
	input: z.record(z.string(), z.unknown()),
	config: z.record(z.string(), z.unknown()).optional(),
	when: WhenExprSchema.optional(),
	policy: NodePolicySchema.optional(),
});

export const EdgeSchema = z.object({
	from: NodeIdSchema,
	to: NodeIdSchema,
});

export const FlowYamlSchema = z
	.object({
		flow: FlowSpecSchema,
		nodes: z.array(NodeSpecSchema),
		edges: z.array(EdgeSchema),
	})
	.superRefine((value, ctx) => {
		const ids = value.nodes.map((node) => node.id);
		const unique = new Set(ids);
		if (unique.size !== ids.length) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Node IDs must be unique",
				path: ["nodes"],
			});
		}

		for (const edge of value.edges) {
			if (!unique.has(edge.from)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Edge from "${edge.from}" does not reference a node`,
					path: ["edges"],
				});
			}
			if (!unique.has(edge.to)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Edge to "${edge.to}" does not reference a node`,
					path: ["edges"],
				});
			}
		}
	});

export type FlowSpecValidated = z.infer<typeof FlowSpecSchema>;
export type FlowYamlValidated = z.infer<typeof FlowYamlSchema>;

export function validateFlowSpec(input: unknown): FlowSpecValidated {
	return FlowSpecSchema.parse(input);
}

export function validateFlowYaml(input: unknown): FlowYamlValidated {
	return FlowYamlSchema.parse(input);
}
