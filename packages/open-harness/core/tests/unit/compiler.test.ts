// Tests for flow compiler and scheduler

import { describe, expect, test } from "bun:test";
import type { RunSnapshot } from "../../src/index.js";
import { CompilationError, DefaultScheduler, GraphCompiler } from "../../src/index.js";

describe("GraphCompiler", () => {
	const compiler = new GraphCompiler();

	const simpleFlow = {
		name: "simple",
		nodes: [
			{ id: "a", type: "input", input: {} },
			{ id: "b", type: "process", input: {} },
			{ id: "c", type: "output", input: {} },
		],
		edges: [
			{ id: "e1", from: "a", to: "b" },
			{ id: "e2", from: "b", to: "c" },
		],
	};

	describe("compile", () => {
		test("simple linear flow", () => {
			const compiled = compiler.compile(simpleFlow);

			expect(compiled.nodes).toHaveLength(3);
			expect(compiled.edges).toHaveLength(2);
			expect(compiled.adjacency.get("a")).toEqual(["b"]);
			expect(compiled.adjacency.get("b")).toEqual(["c"]);
			expect(compiled.adjacency.get("c")).toEqual([]);
		});

		test("multiple outputs from single node", () => {
			const compiled = compiler.compile({
				name: "multi-output",
				nodes: [
					{ id: "split", type: "split", input: {} },
					{ id: "path1", type: "process", input: {} },
					{ id: "path2", type: "process", input: {} },
				],
				edges: [
					{ id: "e1", from: "split", to: "path1" },
					{ id: "e2", from: "split", to: "path2" },
				],
			});

			expect(compiled.adjacency.get("split")).toEqual(["path1", "path2"]);
		});

		test("incoming edges map", () => {
			const compiled = compiler.compile({
				name: "incoming-test",
				nodes: [
					{ id: "a", type: "input", input: {} },
					{ id: "b", type: "process", input: {} },
					{ id: "c", type: "process", input: {} },
					{ id: "d", type: "output", input: {} },
				],
				edges: [
					{ id: "e1", from: "a", to: "d" },
					{ id: "e2", from: "b", to: "d" },
					{ id: "e3", from: "c", to: "d" },
				],
			});

			const incoming = compiled.incoming.get("d");
			expect(incoming).toHaveLength(3);
			expect(incoming?.map((e) => e.from)).toEqual(["a", "b", "c"]);
		});

		test("gate settings", () => {
			const compiled = compiler.compile({
				name: "gates",
				nodes: [
					{ id: "a", type: "input", input: {} },
					{ id: "b", type: "input", input: {} },
					{ id: "merge", type: "merge", input: {} },
				],
				edges: [
					{ id: "e1", from: "a", to: "merge", gate: "any" },
					{ id: "e2", from: "b", to: "merge", gate: "any" },
				],
			});

			expect(compiled.gateByNode.get("merge")).toBe("any");
		});

		test("error on conflicting gates", () => {
			expect(() => {
				compiler.compile({
					name: "conflict",
					nodes: [
						{ id: "a", type: "input", input: {} },
						{ id: "b", type: "input", input: {} },
						{ id: "c", type: "merge", input: {} },
					],
					edges: [
						{ id: "e1", from: "a", to: "c", gate: "all" },
						{ id: "e2", from: "b", to: "c", gate: "any" },
					],
				});
			}).toThrow();
		});
	});

	describe("compileResult", () => {
		test("successful compilation returns ok", () => {
			const result = compiler.compileResult(simpleFlow);

			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.nodes).toHaveLength(3);
			}
		});

		test("invalid compilation returns err with INVALID_FLOW_DEFINITION", () => {
			const result = compiler.compileResult({
				name: "conflict",
				nodes: [
					{ id: "a", type: "input", input: {} },
					{ id: "b", type: "input", input: {} },
					{ id: "c", type: "merge", input: {} },
				],
				edges: [
					{ id: "e1", from: "a", to: "c", gate: "all" },
					{ id: "e2", from: "b", to: "c", gate: "any" },
				],
			});

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.code).toBe("INVALID_FLOW_DEFINITION");
				expect(result.error.details?.flowName).toBe("conflict");
			}
		});

		test("match pattern for ok", () => {
			const result = compiler.compileResult(simpleFlow);

			let matched = false;
			result.match(
				(compiled) => {
					expect(compiled.nodes).toHaveLength(3);
					matched = true;
				},
				() => {
					throw new Error("Should not hit err");
				},
			);
			expect(matched).toBe(true);
		});

		test("match pattern for err", () => {
			const result = compiler.compileResult({
				name: "bad",
				nodes: [
					{ id: "a", type: "input", input: {} },
					{ id: "b", type: "merge", input: {} },
				],
				edges: [
					{ id: "e1", from: "a", to: "b", gate: "all" },
					{ id: "e2", from: "a", to: "b", gate: "any" },
				],
			});

			let matched = false;
			result.match(
				() => {
					throw new Error("Should not hit ok");
				},
				(err) => {
					expect(err.code).toBe("INVALID_FLOW_DEFINITION");
					matched = true;
				},
			);
			expect(matched).toBe(true);
		});
	});
});

describe("DefaultScheduler", () => {
	const scheduler = new DefaultScheduler();
	const compiler = new GraphCompiler();

	describe("nextReadyNodes", () => {
		test("start node with no incoming edges", () => {
			const compiled = compiler.compile({
				name: "linear",
				nodes: [
					{ id: "start", type: "input", input: {} },
					{ id: "middle", type: "process", input: {} },
					{ id: "end", type: "output", input: {} },
				],
				edges: [
					{ id: "e1", from: "start", to: "middle" },
					{ id: "e2", from: "middle", to: "end" },
				],
			});

			const state = {
				nodeStatus: { start: "pending", middle: "pending", end: "pending" },
				edgeStatus: {},
			};

			const ready = scheduler.nextReadyNodes(state, compiled);
			expect(ready).toEqual(["start"]);
		});

		test("node ready after predecessor completes", () => {
			const compiled = compiler.compile({
				name: "linear",
				nodes: [
					{ id: "a", type: "input", input: {} },
					{ id: "b", type: "process", input: {} },
				],
				edges: [{ id: "e1", from: "a", to: "b" }],
			});

			const state = {
				nodeStatus: { a: "done", b: "pending" },
				edgeStatus: { e1: "done" },
			};

			const ready = scheduler.nextReadyNodes(state, compiled);
			expect(ready).toEqual(["b"]);
		});

		test("node not ready if predecessor pending", () => {
			const compiled = compiler.compile({
				name: "linear",
				nodes: [
					{ id: "a", type: "input", input: {} },
					{ id: "b", type: "process", input: {} },
				],
				edges: [{ id: "e1", from: "a", to: "b" }],
			});

			const state = {
				nodeStatus: { a: "running", b: "pending" },
				edgeStatus: { e1: "pending" },
			};

			const ready = scheduler.nextReadyNodes(state, compiled);
			expect(ready).toEqual([]);
		});

		test("parallel branches all ready", () => {
			const compiled = compiler.compile({
				name: "parallel",
				nodes: [
					{ id: "start", type: "input", input: {} },
					{ id: "path1", type: "process", input: {} },
					{ id: "path2", type: "process", input: {} },
				],
				edges: [
					{ id: "e1", from: "start", to: "path1" },
					{ id: "e2", from: "start", to: "path2" },
				],
			});

			const state = {
				nodeStatus: { start: "done", path1: "pending", path2: "pending" },
				edgeStatus: { e1: "done", e2: "done" },
			};

			const ready = scheduler.nextReadyNodes(state, compiled);
			expect(ready).toHaveLength(2);
			expect(ready).toContain("path1");
			expect(ready).toContain("path2");
		});

		test("skip completed and failed nodes", () => {
			const compiled = compiler.compile({
				name: "skip",
				nodes: [
					{ id: "a", type: "input", input: {} },
					{ id: "b", type: "process", input: {} },
					{ id: "c", type: "process", input: {} },
				],
				edges: [
					{ id: "e1", from: "a", to: "b" },
					{ id: "e2", from: "a", to: "c" },
				],
			});

			const state = {
				nodeStatus: { a: "done", b: "done", c: "failed" },
				edgeStatus: { e1: "done", e2: "done" },
			};

			const ready = scheduler.nextReadyNodes(state, compiled);
			expect(ready).toEqual([]);
		});
	});

	describe("nextReadyNodesResult", () => {
		test("successful scheduling returns ok", () => {
			const compiled = compiler.compile({
				name: "test",
				nodes: [
					{ id: "a", type: "input", input: {} },
					{ id: "b", type: "process", input: {} },
				],
				edges: [{ id: "e1", from: "a", to: "b" }],
			});

			const state = {
				nodeStatus: { a: "pending", b: "pending" },
				edgeStatus: {},
			};

			const result = scheduler.nextReadyNodesResult(state, compiled);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual(["a"]);
			}
		});

		test("error returns err with SCHEDULING_ERROR code", () => {
			const compiled = compiler.compile({
				name: "test",
				nodes: [{ id: "a", type: "input", input: {} }],
				edges: [],
			});

			const result = scheduler.nextReadyNodesResult(undefined as unknown as RunSnapshot, compiled);
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.code).toBe("SCHEDULING_ERROR");
			}
		});

		test("match pattern for ok", () => {
			const compiled = compiler.compile({
				name: "test",
				nodes: [{ id: "start", type: "input", input: {} }],
				edges: [],
			});

			const state = {
				nodeStatus: { start: "pending" },
				edgeStatus: {},
			};

			const result = scheduler.nextReadyNodesResult(state, compiled);
			let matched = false;
			result.match(
				(ready) => {
					expect(ready).toContain("start");
					matched = true;
				},
				() => {
					throw new Error("Should not hit err");
				},
			);
			expect(matched).toBe(true);
		});
	});
});

describe("CompilationError", () => {
	test("creates error with code and details", () => {
		const err = new CompilationError("CYCLE_DETECTED", "Circular dependency found", undefined, { nodeId: "a" });

		expect(err.code).toBe("CYCLE_DETECTED");
		expect(err.message).toBe("Circular dependency found");
		expect(err.details?.nodeId).toBe("a");
		expect(err.name).toBe("CompilationError");
	});

	test("all error codes are valid", () => {
		const codes = [
			"INVALID_FLOW_DEFINITION",
			"INVALID_NODE_DEFINITION",
			"INVALID_EDGE_DEFINITION",
			"CYCLE_DETECTED",
			"SCHEDULING_ERROR",
			"SCHEMA_VALIDATION_ERROR",
			"MISSING_REQUIRED_FIELD",
		] as const;

		codes.forEach((code) => {
			const err = new CompilationError(code, `Error: ${code}`);
			expect(err.code).toBe(code);
		});
	});
});
