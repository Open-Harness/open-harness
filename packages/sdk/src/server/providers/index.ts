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
} from "@internal/providers-claude";

// Export testing utilities
export {
  createMockQuery,
  type FixtureCall,
  type FixtureFile,
  type FixtureSet,
} from "@internal/providers-testing";
