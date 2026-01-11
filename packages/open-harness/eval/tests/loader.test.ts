/**
 * YAML loader and schema validation tests.
 */

import { describe, expect, it } from "vitest";
import { AssertionSchema, EvalCaseSchema, EvalDatasetSchema } from "../src/loader/schema.js";
import { parseDataset } from "../src/loader/yaml.js";

describe("parseDataset", () => {
	it("parses a valid dataset", () => {
		const yaml = `
name: Test Dataset
description: A test dataset
cases:
  - id: case-1
    name: Basic test
    input: "hello world"
    assertions:
      - type: signal.contains
        pattern: agent.start
`;

		const dataset = parseDataset(yaml);
		expect(dataset.name).toBe("Test Dataset");
		expect(dataset.cases).toHaveLength(1);
		expect(dataset.cases[0].id).toBe("case-1");
	});

	it("parses signal assertions", () => {
		const yaml = `
name: Signal Tests
cases:
  - id: signal-test
    input: test
    assertions:
      - type: signal.contains
        pattern: agent.*
        payload:
          key: value
      - type: signal.not
        pattern: error.*
      - type: signal.count
        pattern: tool.call
        min: 1
        max: 5
`;

		const dataset = parseDataset(yaml);
		expect(dataset.cases[0].assertions).toHaveLength(3);
		expect(dataset.cases[0].assertions[0].type).toBe("signal.contains");
		expect(dataset.cases[0].assertions[1].type).toBe("signal.not");
		expect(dataset.cases[0].assertions[2].type).toBe("signal.count");
	});

	it("parses trajectory assertions", () => {
		const yaml = `
name: Trajectory Tests
cases:
  - id: trajectory-test
    input: test
    assertions:
      - type: signal.trajectory
        patterns:
          - agent.start
          - pattern: tool.call
            payload:
              name: read_file
          - agent.end
        strict: true
`;

		const dataset = parseDataset(yaml);
		const assertion = dataset.cases[0].assertions[0];
		expect(assertion.type).toBe("signal.trajectory");
		if (assertion.type === "signal.trajectory") {
			expect(assertion.patterns).toHaveLength(3);
			expect(assertion.strict).toBe(true);
		}
	});

	it("parses snapshot assertions", () => {
		const yaml = `
name: Snapshot Tests
cases:
  - id: snapshot-test
    input: test
    assertions:
      - type: snapshot.at
        afterSignal: agent.start
        path: count
        value: 5
      - type: snapshot.final
        path: status
        value: complete
`;

		const dataset = parseDataset(yaml);
		expect(dataset.cases[0].assertions).toHaveLength(2);
		expect(dataset.cases[0].assertions[0].type).toBe("snapshot.at");
		expect(dataset.cases[0].assertions[1].type).toBe("snapshot.final");
	});

	it("parses value matchers in assertions", () => {
		const yaml = `
name: Matcher Tests
cases:
  - id: matcher-test
    input: test
    assertions:
      - type: snapshot.final
        path: count
        value:
          gte: 10
      - type: snapshot.final
        path: value
        value:
          between: [0, 100]
`;

		const dataset = parseDataset(yaml);
		expect(dataset.cases[0].assertions).toHaveLength(2);
	});

	it("parses tool assertions", () => {
		const yaml = `
name: Tool Tests
cases:
  - id: tool-test
    input: test
    assertions:
      - type: tool.called
        name: read_file
        min: 1
      - type: tool.notCalled
        name: dangerous_tool
      - type: tool.sequence
        tools:
          - read_file
          - process
          - write_file
`;

		const dataset = parseDataset(yaml);
		expect(dataset.cases[0].assertions).toHaveLength(3);
		expect(dataset.cases[0].assertions[0].type).toBe("tool.called");
		expect(dataset.cases[0].assertions[1].type).toBe("tool.notCalled");
		expect(dataset.cases[0].assertions[2].type).toBe("tool.sequence");
	});

	it("parses output assertions", () => {
		const yaml = `
name: Output Tests
cases:
  - id: output-test
    input: test
    assertions:
      - type: output.contains
        text: expected text
        caseSensitive: false
      - type: output.notContains
        text: error
      - type: output.matches
        regex: "^Success.*$"
        flags: i
`;

		const dataset = parseDataset(yaml);
		expect(dataset.cases[0].assertions).toHaveLength(3);
	});

	it("parses composition assertions", () => {
		const yaml = `
name: Composition Tests
cases:
  - id: composition-test
    input: test
    assertions:
      - type: all
        assertions:
          - type: signal.contains
            pattern: agent.start
          - type: signal.contains
            pattern: agent.end
      - type: any
        assertions:
          - type: signal.contains
            pattern: success
          - type: signal.contains
            pattern: partial_success
      - type: not
        assertion:
          type: signal.contains
          pattern: error
`;

		const dataset = parseDataset(yaml);
		expect(dataset.cases[0].assertions).toHaveLength(3);
		expect(dataset.cases[0].assertions[0].type).toBe("all");
		expect(dataset.cases[0].assertions[1].type).toBe("any");
		expect(dataset.cases[0].assertions[2].type).toBe("not");
	});

	it("supports case metadata", () => {
		const yaml = `
name: Metadata Tests
cases:
  - id: case-with-metadata
    name: Named Case
    description: A case with full metadata
    input: test
    assertions:
      - type: signal.contains
        pattern: agent.start
    tags:
      - smoke
      - integration
    timeout: 30000
    skip: false
    only: false
`;

		const dataset = parseDataset(yaml);
		const testCase = dataset.cases[0];
		expect(testCase.name).toBe("Named Case");
		expect(testCase.description).toBe("A case with full metadata");
		expect(testCase.tags).toEqual(["smoke", "integration"]);
		expect(testCase.timeout).toBe(30000);
	});

	it("supports default assertions and timeout", () => {
		const yaml = `
name: Defaults Tests
description: Tests default assertions
defaultTimeout: 60000
defaultAssertions:
  - type: signal.contains
    pattern: agent.start
  - type: signal.contains
    pattern: agent.end
cases:
  - id: case-1
    input: test1
    assertions:
      - type: signal.contains
        pattern: specific_signal
  - id: case-2
    input: test2
    assertions:
      - type: output.contains
        text: result
`;

		const dataset = parseDataset(yaml);
		expect(dataset.defaultTimeout).toBe(60000);
		expect(dataset.defaultAssertions).toHaveLength(2);
	});

	it("throws on invalid assertion type", () => {
		const yaml = `
name: Invalid Test
cases:
  - id: invalid
    input: test
    assertions:
      - type: invalid.assertion.type
        foo: bar
`;

		expect(() => parseDataset(yaml)).toThrow();
	});

	it("throws on missing required fields", () => {
		const yaml = `
name: Missing Fields
cases:
  - id: missing-assertions
    input: test
`;

		expect(() => parseDataset(yaml)).toThrow();
	});

	it("throws on missing case id", () => {
		const yaml = `
name: Missing ID
cases:
  - input: test
    assertions:
      - type: signal.contains
        pattern: test
`;

		expect(() => parseDataset(yaml)).toThrow();
	});
});

describe("AssertionSchema", () => {
	it("validates signal.contains", () => {
		const assertion = { type: "signal.contains", pattern: "test.*" };
		const result = AssertionSchema.safeParse(assertion);
		expect(result.success).toBe(true);
	});

	it("validates signal.trajectory with mixed patterns", () => {
		const assertion = {
			type: "signal.trajectory",
			patterns: ["pattern1", { pattern: "pattern2", payload: { key: "value" } }],
		};
		const result = AssertionSchema.safeParse(assertion);
		expect(result.success).toBe(true);
	});

	it("validates metric assertions", () => {
		const latency = { type: "metric.latency.max", value: 5000 };
		const cost = { type: "metric.cost.max", value: 0.5 };
		const tokens = { type: "metric.tokens.max", value: 10000, field: "total" };

		expect(AssertionSchema.safeParse(latency).success).toBe(true);
		expect(AssertionSchema.safeParse(cost).success).toBe(true);
		expect(AssertionSchema.safeParse(tokens).success).toBe(true);
	});

	it("validates llm.judge assertion", () => {
		const assertion = {
			type: "llm.judge",
			criteria: ["Is the response helpful?", "Is it accurate?"],
			minScore: 7,
			model: "claude-3-haiku",
		};
		const result = AssertionSchema.safeParse(assertion);
		expect(result.success).toBe(true);
	});

	it("rejects invalid assertion type", () => {
		const assertion = { type: "invalid.type", foo: "bar" };
		const result = AssertionSchema.safeParse(assertion);
		expect(result.success).toBe(false);
	});
});

describe("EvalCaseSchema", () => {
	it("validates a minimal case", () => {
		const evalCase = {
			id: "test-1",
			input: "test input",
			assertions: [{ type: "signal.contains", pattern: "test" }],
		};
		const result = EvalCaseSchema.safeParse(evalCase);
		expect(result.success).toBe(true);
	});

	it("validates a full case", () => {
		const evalCase = {
			id: "test-1",
			name: "Test Case",
			description: "A test case",
			input: { complex: "input" },
			assertions: [{ type: "signal.contains", pattern: "test" }],
			tags: ["smoke"],
			timeout: 30000,
			skip: false,
			only: false,
		};
		const result = EvalCaseSchema.safeParse(evalCase);
		expect(result.success).toBe(true);
	});

	it("rejects case without id", () => {
		const evalCase = {
			input: "test",
			assertions: [{ type: "signal.contains", pattern: "test" }],
		};
		const result = EvalCaseSchema.safeParse(evalCase);
		expect(result.success).toBe(false);
	});

	it("rejects case without assertions", () => {
		const evalCase = {
			id: "test-1",
			input: "test",
		};
		const result = EvalCaseSchema.safeParse(evalCase);
		expect(result.success).toBe(false);
	});
});

describe("EvalDatasetSchema", () => {
	it("validates a minimal dataset", () => {
		const dataset = {
			name: "Test Dataset",
			cases: [
				{
					id: "case-1",
					input: "test",
					assertions: [{ type: "signal.contains", pattern: "test" }],
				},
			],
		};
		const result = EvalDatasetSchema.safeParse(dataset);
		expect(result.success).toBe(true);
	});

	it("validates a full dataset", () => {
		const dataset = {
			name: "Test Dataset",
			description: "A test dataset",
			defaultTimeout: 60000,
			defaultAssertions: [{ type: "signal.contains", pattern: "default" }],
			cases: [
				{
					id: "case-1",
					input: "test",
					assertions: [{ type: "signal.contains", pattern: "test" }],
				},
			],
			metadata: { version: "1.0", author: "test" },
		};
		const result = EvalDatasetSchema.safeParse(dataset);
		expect(result.success).toBe(true);
	});

	it("rejects dataset without name", () => {
		const dataset = {
			cases: [
				{
					id: "case-1",
					input: "test",
					assertions: [{ type: "signal.contains", pattern: "test" }],
				},
			],
		};
		const result = EvalDatasetSchema.safeParse(dataset);
		expect(result.success).toBe(false);
	});

	it("rejects dataset without cases", () => {
		const dataset = {
			name: "Test Dataset",
		};
		const result = EvalDatasetSchema.safeParse(dataset);
		expect(result.success).toBe(false);
	});
});
