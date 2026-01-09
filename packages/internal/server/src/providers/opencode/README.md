---
lastUpdated: "2026-01-07T17:51:20.440Z"
lastCommit: "b8ad3969f2c5fcbd138a1cadb681a889510968e8"
lastCommitDate: "2026-01-07T17:48:20Z"
---
# Providers Package

This directory contains provider implementations for various AI coding assistants.

## Structure

```
packages/providers/
├── BASE-CONTEXT.md       # Shared context for all providers
├── opencode/             # OpenCode provider implementation
│   └── PROMPT.md         # Implementation prompt for external AI agents
├── codex/                # Codex provider implementation
│   └── PROMPT.md         # Implementation prompt for external AI agents
└── [other-providers]/    # Additional providers
```

## Adding a New Provider

1. Create a new directory: `packages/providers/[provider-name]/`
2. Copy the provider-specific prompt file: `PROMPT.md`
3. The prompt contains complete implementation instructions
4. Use the prompt with external AI agents (ChatGPT, Claude, etc.) to implement the provider

## Using the Prompts

Each provider's `PROMPT.md` file contains:

- Complete implementation instructions
- SDK-specific integration details
- Code examples and patterns
- Testing requirements
- Integration steps

To implement a provider, copy the prompt to an external AI assistant and follow the instructions.

## Base Context

`BASE-CONTEXT.md` contains shared information applicable to all providers:

- Provider trait contract
- Stream event types
- Error handling patterns
- Abort signal guidelines
- Testing requirements

Reference this alongside the provider-specific prompts.

## Implementation Checklist

For each provider implementation:

- [ ] Create package structure (`src/`, `package.json`, `tsconfig.json`)
- [ ] Implement `ProviderTrait` interface
- [ ] Define input/output schemas with Zod
- [ ] Integrate with provider SDK
- [ ] Handle streaming events
- [ ] Implement error handling
- [ ] Support abort signals
- [ ] Write integration tests (MUST use real SDK)
- [ ] Record fixtures from live SDK
- [ ] Register in provider registry
- [ ] Add documentation

## See Also

- `packages/internal/core/src/providers/README.md` - Core provider traits
- `specs/providers/` - Prompt templates documentation
