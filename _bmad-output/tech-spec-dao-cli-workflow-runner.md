# Tech-Spec: DAO CLI Workflow Runner

**Created:** 2024-12-24
**Status:** Completed

## Review Notes

- Adversarial review completed: 16 findings
- Resolution approach: Walk-through with fixes
- Findings addressed: 14 fixed, 2 skipped (intentional design decisions)
- Key improvements: Input validation, error handling, graceful shutdown, O(n) progress calculation

## Overview

### Problem Statement

We need a CLI executable that wraps the autonomous agent workflow from the bun-vi SDK, making it configurable and generalizable for other workflow types. Currently, the autonomous agent example requires direct code modification to change configuration (model, prompts, project directory, etc.).

### Solution

Build a general-purpose workflow runner CLI (`apps/cli/`) that:
- Reads YAML workflow configurations
- Supports configurable agents, prompts, and data sources  
- Provides rich CLI experience with Clack prompts and Chalk colors
- Starts with autonomous agent support but extensible to other workflows
- Uses direct SDK imports for type safety and performance

### Scope (In/Out)

**In Scope:**
- YAML workflow configuration schema
- Task schema standardization with extensible metadata
- CLI commands: `run`, `init`, `status`
- JSON file data source adapter
- Autonomous agent workflow implementation
- Interactive config generation with Clack
- Progress display with colors and real-time updates

**Out of Scope (Future):**
- Complex DAG workflows (YAML lays foundation)
- Database/API data source adapters
- Workflow visual editor
- Distributed execution

## Context for Development

### Codebase Patterns

**Project Structure:**
```
dao/
├── packages/sdk/               # bun-vi SDK (direct import)
├── apps/cli/                   # This CLI package  
│   ├── src/
│   │   ├── commands/           # CLI commands
│   │   ├── config/             # YAML loading/validation
│   │   ├── schemas/            # Task & workflow schemas
│   │   ├── workflows/          # Workflow implementations
│   │   └── index.ts            # CLI entry point
```

**Technology Stack:**
- **Runtime**: Bun (following project conventions)
- **CLI Framework**: Commander.js for commands
- **Interactive Prompts**: Clack for beautiful CLI UX
- **Colors/Styling**: Chalk for terminal output
- **Config Format**: YAML for workflow definitions
- **Validation**: Zod for schema validation
- **Formatting**: Biome (configured with tabs, double quotes)

### Files to Reference

**SDK Integration Points:**
- `packages/sdk/src/examples/autonomous-agent/index.ts` - Main execution logic
- `packages/sdk/src/examples/autonomous-agent/src/agents/` - Agent creation patterns
- `packages/sdk/src/examples/autonomous-agent/src/utils.ts` - File operations, progress tracking
- `packages/sdk/src/index.ts` - Main SDK exports

**Existing Package Structure:**
- `apps/cli/package.json` - Already has basic Bun setup
- `apps/cli/biome.jsonc` - Linting configuration
- `packages/sdk/` - Target for direct import

### Technical Decisions

1. **YAML over TypeScript config**: Enables future DAG workflow orchestration
2. **Direct SDK import**: Type safety, performance, no subprocess overhead  
3. **Zod schemas**: Runtime validation for YAML configs
4. **Commander + Clack**: Professional CLI experience with beautiful prompts
5. **JSON file data source first**: Simplest adapter, matches autonomous agent pattern

## Implementation Plan

### Tasks

- [x] **Task 1**: Define core schemas (task schema, workflow YAML spec)
- [x] **Task 2**: Set up CLI package dependencies and structure
- [x] **Task 3**: Build CLI shell with Commander + Clack + Chalk  
- [x] **Task 4**: Implement YAML config loading and validation
- [x] **Task 5**: Wire up SDK integration for autonomous agent workflow
- [x] **Task 6**: Add data source abstraction with JSON file adapter
- [x] **Task 7**: Add interactive config generation (`dao init`)
- [x] **Task 8**: Add progress monitoring (`dao status`)
- [x] **Task 9**: Polish CLI UX with colors and real-time updates

### Acceptance Criteria

- [x] **AC 1**: Given a valid YAML workflow file, when I run `dao run workflow.yaml`, then it executes the autonomous agent with configured parameters
- [x] **AC 2**: Given no config file, when I run `dao init`, then it guides me through interactive setup and generates a valid YAML workflow
- [x] **AC 3**: Given a running workflow project, when I run `dao status <project-dir>`, then it shows current progress from feature_list.json
- [x] **AC 4**: Given custom prompt files, when referenced in YAML config, then agents use those prompts instead of defaults
- [x] **AC 5**: Given different models specified in config, when workflow runs, then each agent uses its configured model
- [x] **AC 6**: Given monologue/narrator enabled in config, when workflow runs, then narrative output appears with colors
- [x] **AC 7**: Given a workflow with custom task schema, when it runs, then it processes the data source according to schema
- [x] **AC 8**: Given command line flags, when they conflict with YAML config, then CLI flags take precedence

## Additional Context

### Dependencies

**Add to `apps/cli/package.json`:**
```json
{
  "dependencies": {
    "@dao/sdk": "workspace:*",
    "commander": "^11.0.0",
    "@clack/prompts": "^0.7.0", 
    "chalk": "^5.3.0",
    "yaml": "^2.3.0",
    "zod": "^3.22.0"
  },
  "bin": {
    "dao": "./dist/index.js"
  }
}
```

### Core Schemas

**Task Schema (extensible base):**
```typescript
interface Task {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority?: number;
  metadata?: Record<string, any>;
  // Extensible for specific workflow needs
}

interface TestCaseTask extends Task {
  category: 'functional' | 'style';
  description: string; 
  steps: string[];
  result?: {
    completedAt?: string;
    sessionId?: string;
    notes?: string;
    error?: string;
  };
}
```

**Workflow YAML Schema:**
```yaml
workflow:
  name: "autonomous-coding"
  projectDir: "./my_project"
  maxIterations: 10
  autoContinueDelay: 3000

dataSources:
  - name: "features"
    type: "json-file"
    path: "./feature_list.json" 
    schema: "test-case-schema-v1"

agents:
  initializer:
    model: "sonnet"
    prompt: "./prompts/initializer.md"
    permissions:
      mode: "bypassPermissions"
      allowDangerous: true
      
  builder:
    model: "haiku"
    prompt: "./prompts/builder.md" 
    permissions:
      mode: "bypassPermissions"
      allowDangerous: true
    
  narrator:
    enabled: true
    bufferSize: 15

execution:
  workOn: "features"
  strategy: "sequential"
```

### Testing Strategy

**Unit Tests:**
- Schema validation (Zod schemas)
- YAML parsing/loading
- CLI argument parsing
- Data source adapters

**Integration Tests:**
- End-to-end workflow execution with test data
- SDK integration points
- File I/O operations

**Manual Testing:**
- Interactive `dao init` flow
- Real autonomous agent execution
- Progress monitoring during long runs

### Notes

**Evolution Path:**
1. **Phase 1**: Basic autonomous agent wrapper (this spec)
2. **Phase 2**: Multiple workflow types, database data sources
3. **Phase 3**: DAG workflows, visual editor, distributed execution

**CLI Commands Detail:**
- `dao run <workflow.yaml>` - Execute workflow with config
- `dao run <workflow.yaml> --project-dir ./custom --max-iterations 5` - Override config with flags  
- `dao init` - Interactive workflow config generation
- `dao init --template autonomous-coding` - Quick start with template
- `dao status <project-dir>` - Show progress from data source
- `dao validate <workflow.yaml>` - Validate config without running

**Data Source Adapter Interface:**
```typescript
interface DataSource<T> {
  load(): Promise<T[]>;
  getNext(filter?: any): Promise<T | null>;
  markInProgress(id: string): Promise<void>;
  markComplete(id: string, result?: any): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  getProgress(): Promise<ProgressStats>;
}
```

This foundation enables quick iteration while maintaining extensibility for complex future workflows.