/**
 * Open Harness Starter Kit
 *
 * A demonstration of the Open Harness eval system for prompt comparison.
 *
 * @example
 * ```bash
 * # Run eval in live mode
 * bun run eval --mode live
 *
 * # Record fixtures
 * bun run record
 *
 * # Run eval in replay mode
 * bun run eval --mode replay
 * ```
 */

export { promptComparisonSuite } from "./evals/prompt-comparison.js";
export { simpleCoderWorkflow } from "./workflows/simple-coder.js";
