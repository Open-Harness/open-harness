---
name: doc-audit
description: Fan out sub-agents to audit documentation against codebase for accuracy, completeness, and quality
---

# Documentation Audit

You are auditing the Open Harness documentation against the actual codebase. The documentation lives in `apps/docs/content/docs/` and the kernel code is in `packages/kernel/src/`.

## Goal

Find and fix:
1. **Outdated content** - API signatures, types, or behavior that don't match current code
2. **Missing documentation** - Exported functions/types not documented
3. **Dead links** - References to pages/anchors that don't exist
4. **Inconsistencies** - Terminology mismatches, conflicting information
5. **Poor quality** - Unclear writing, bad flow, missing examples

## Documentation Structure

```
apps/docs/content/docs/
├── learn/           → Tutorials (first-flow, bindings, channels, etc.)
├── guides/          → How-to guides organized by topic
│   ├── flows/       → Flow execution guides
│   ├── nodes/       → Custom node guides
│   ├── hub/         → Event system guides
│   ├── channels/    → Channel implementation guides
│   ├── agents/      → Agent definition guides
│   ├── testing/     → Testing workflow guides
│   └── debugging/   → Debugging guides
├── concepts/        → Architecture explanations
│   ├── architecture/
│   ├── execution/
│   ├── hub/
│   └── visual-editing/
└── reference/       → API reference
    ├── api/         → Function documentation
    ├── types/       → Type definitions
    ├── nodes/       → Node catalog
    ├── channels/    → Channel reference
    ├── providers/   → Provider reference
    └── kernel-spec/ → Protocol specification (synced from packages/kernel/docs/)
```

## Codebase Mapping

| Doc Section | Source Location | What to Check |
|-------------|-----------------|---------------|
| reference/api/ | packages/kernel/src/*.ts | Function signatures match exports |
| reference/types/ | packages/kernel/src/types/*.ts | Type definitions current |
| guides/flows/ | packages/kernel/src/flow/*.ts | Flow API usage examples work |
| guides/hub/ | packages/kernel/src/hub/*.ts | Hub API examples accurate |
| guides/channels/ | packages/kernel/src/channels/*.ts | Channel interfaces match |
| guides/agents/ | packages/kernel/src/agent/*.ts | Agent patterns current |
| concepts/ | packages/kernel/docs/*.md | Concepts align with spec |

## Execution Plan

Launch these sub-agents IN PARALLEL to audit different sections:

### Agent 1: API Reference Audit
```
Audit reference/api/ against packages/kernel/src/

1. List all exported functions from kernel
2. Check each has documentation page
3. Verify signatures match
4. Flag missing/outdated docs
```

### Agent 2: Type Reference Audit
```
Audit reference/types/ against packages/kernel/src/types/

1. List all exported types/interfaces
2. Check documentation exists and is current
3. Verify property descriptions match code
4. Flag missing type docs
```

### Agent 3: Guide Examples Audit
```
Audit guides/ code examples

1. For each guide with code blocks
2. Verify imports exist in kernel
3. Check API usage is current
4. Flag broken examples
```

### Agent 4: Link Integrity Check
```
Check all internal links in docs

1. Find all markdown links [text](/docs/...)
2. Verify target pages exist
3. Check anchor links resolve
4. Flag broken links
```

### Agent 5: Terminology Consistency
```
Check terminology across docs

1. Scan for key terms: Hub, FlowRuntime, Agent, Channel, Node
2. Verify consistent usage
3. Flag conflicting definitions
4. Check against kernel-spec canonical naming
```

### Agent 6: Content Quality Review
```
Review writing quality in learn/ and guides/

1. Check each page flows logically
2. Identify unclear explanations
3. Find missing context/prerequisites
4. Flag pages needing rewrite
```

## Output Format

Each agent should output:

```yaml
section: <section audited>
files_checked: <count>
issues:
  - severity: critical|high|medium|low
    file: <path>
    line: <if applicable>
    issue: <description>
    fix: <suggested fix>
summary: <one paragraph summary>
```

## After Audit

1. Consolidate all agent outputs
2. Prioritize by severity
3. Create action plan with specific file edits
4. Present to user for approval before making changes

---

**START THE AUDIT NOW** - Launch all 6 agents in parallel using the Task tool with subagent_type="Explore" or "general-purpose" as appropriate. Do not wait for one to finish before starting others.
