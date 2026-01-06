/**
 * Anthropic provider implementation for Open Harness.
 */

export {
	type ClaudeAgentExtendedOptions,
	type ClaudeAgentInput,
	type ClaudeAgentOutput,
	type ClaudeMessageInput,
	type ClaudeNodeOptions,
	claudeNode,
	createClaudeNode,
	resolveOutputSchema,
} from "./claude.agent.js";

// Export testing utilities
export {
	createMockQuery,
	type FixtureCall,
	type FixtureFile,
	type FixtureSet,
} from "./testing/mock-query.js";
