/**
 * Registry Metadata Tests
 *
 * Tests for Phase 2 type additions:
 * - NodeMetadata support in registry
 * - listWithMetadata() method
 * - NodePosition in NodeSpec
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { NodeRegistry } from "../../src/flow/registry.js";
import {
	NodePositionSchema,
	NodeSpecSchema,
} from "../../src/flow/validator.js";
import type { NodeMetadata } from "../../src/protocol/flow.js";

describe("NodeRegistry.listWithMetadata()", () => {
	it("returns empty array for empty registry", () => {
		const registry = new NodeRegistry();
		expect(registry.listWithMetadata()).toEqual([]);
	});

	it("returns type without metadata when none provided", () => {
		const registry = new NodeRegistry();
		registry.register({
			type: "basic.node",
			inputSchema: z.object({}),
			outputSchema: z.object({}),
			run: async () => ({}),
		});

		const result = registry.listWithMetadata();
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("basic.node");
		expect(result[0].metadata).toBeUndefined();
		expect(result[0].capabilities).toBeUndefined();
	});

	it("returns metadata when provided", () => {
		const registry = new NodeRegistry();
		const metadata: NodeMetadata = {
			displayName: "Test Node",
			description: "A test node for validation",
			category: "Testing",
			icon: "test-icon",
			color: "#ff0000",
		};

		registry.register({
			type: "test.node",
			inputSchema: z.object({}),
			outputSchema: z.object({}),
			metadata,
			run: async () => ({}),
		});

		const result = registry.listWithMetadata();
		expect(result).toHaveLength(1);
		expect(result[0].metadata).toEqual(metadata);
	});

	it("returns capabilities when provided", () => {
		const registry = new NodeRegistry();
		registry.register({
			type: "streaming.node",
			inputSchema: z.object({}),
			outputSchema: z.object({}),
			capabilities: {
				isStreaming: true,
				supportsMultiTurn: true,
			},
			run: async () => ({}),
		});

		const result = registry.listWithMetadata();
		expect(result[0].capabilities?.isStreaming).toBe(true);
		expect(result[0].capabilities?.supportsMultiTurn).toBe(true);
	});

	it("returns both metadata and capabilities", () => {
		const registry = new NodeRegistry();
		registry.register({
			type: "full.node",
			inputSchema: z.object({}),
			outputSchema: z.object({}),
			metadata: {
				displayName: "Full Node",
				category: "Complete",
			},
			capabilities: {
				isContainer: true,
				createsSession: true,
			},
			run: async () => ({}),
		});

		const result = registry.listWithMetadata();
		expect(result[0].metadata?.displayName).toBe("Full Node");
		expect(result[0].capabilities?.isContainer).toBe(true);
	});

	it("returns all registered nodes", () => {
		const registry = new NodeRegistry();

		registry.register({
			type: "node.a",
			inputSchema: z.object({}),
			outputSchema: z.object({}),
			metadata: { displayName: "Node A" },
			run: async () => ({}),
		});

		registry.register({
			type: "node.b",
			inputSchema: z.object({}),
			outputSchema: z.object({}),
			metadata: { displayName: "Node B" },
			run: async () => ({}),
		});

		registry.register({
			type: "node.c",
			inputSchema: z.object({}),
			outputSchema: z.object({}),
			run: async () => ({}),
		});

		const result = registry.listWithMetadata();
		expect(result).toHaveLength(3);

		const types = result.map((r) => r.type);
		expect(types).toContain("node.a");
		expect(types).toContain("node.b");
		expect(types).toContain("node.c");
	});

	it("includes port definitions in metadata", () => {
		const registry = new NodeRegistry();
		registry.register({
			type: "io.node",
			inputSchema: z.object({ prompt: z.string() }),
			outputSchema: z.object({ result: z.string() }),
			metadata: {
				displayName: "IO Node",
				ports: [
					{ name: "prompt", type: "input", dataType: "string" },
					{
						name: "result",
						type: "output",
						dataType: "string",
						description: "The processed result",
					},
				],
			},
			run: async () => ({ result: "" }),
		});

		const result = registry.listWithMetadata();
		expect(result[0].metadata?.ports).toHaveLength(2);
		expect(result[0].metadata?.ports?.[0].name).toBe("prompt");
		expect(result[0].metadata?.ports?.[1].description).toBe(
			"The processed result",
		);
	});
});

describe("NodePosition Schema", () => {
	it("validates valid position", () => {
		const result = NodePositionSchema.safeParse({ x: 100, y: 200 });
		expect(result.success).toBe(true);
	});

	it("allows negative coordinates", () => {
		const result = NodePositionSchema.safeParse({ x: -50, y: -100 });
		expect(result.success).toBe(true);
	});

	it("allows decimal coordinates", () => {
		const result = NodePositionSchema.safeParse({ x: 100.5, y: 200.75 });
		expect(result.success).toBe(true);
	});

	it("rejects missing x", () => {
		const result = NodePositionSchema.safeParse({ y: 100 });
		expect(result.success).toBe(false);
	});

	it("rejects missing y", () => {
		const result = NodePositionSchema.safeParse({ x: 100 });
		expect(result.success).toBe(false);
	});

	it("rejects non-numeric values", () => {
		const result = NodePositionSchema.safeParse({ x: "100", y: 200 });
		expect(result.success).toBe(false);
	});
});

describe("NodeSpec with position", () => {
	it("validates NodeSpec without position", () => {
		const result = NodeSpecSchema.safeParse({
			id: "myNode",
			type: "basic.node",
			input: {},
		});
		expect(result.success).toBe(true);
	});

	it("validates NodeSpec with position", () => {
		const result = NodeSpecSchema.safeParse({
			id: "myNode",
			type: "basic.node",
			input: {},
			position: { x: 100, y: 200 },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.position).toEqual({ x: 100, y: 200 });
		}
	});

	it("rejects invalid position in NodeSpec", () => {
		const result = NodeSpecSchema.safeParse({
			id: "myNode",
			type: "basic.node",
			input: {},
			position: { x: "invalid" },
		});
		expect(result.success).toBe(false);
	});
});
