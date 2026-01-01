# Handoff: Create End-to-End Validation for Refactored Coding Example

## Context: What Was Done

We just completed a major refactor of the `examples/coding` directory, migrating from old class-based agents to the new factory-based system. Changes included:

### Completed Refactor Changes
1. **Updated imports**: Agents now come from `@openharness/anthropic/presets` (not SDK)
2. **Updated API calls**: `.execute({ task })` instead of `.plan(task, sessionId)`
3. **Fixed boundary violations**: Removed `Ticket` type from SDK, now uses `PlannerTask` from anthropic
4. **Added Channel system**: Created `ConsoleChannel` with beautiful pattern-matching output
5. **Updated documentation**: README now showcases new architecture

### Current State
- **Working harness**: `examples/coding/src/harness.ts` - 3-phase workflow (Planning → Execution)
- **Beautiful channel**: `examples/coding/src/console-channel.ts` - Pattern-based event handling
- **Factory agents**: PlannerAgent, CodingAgent, ReviewAgent all working

## The Task: End-to-End Validation

Create a **validation workflow** that proves the refactored system works end-to-end.

### Requirements

#### Functional Requirements
1. **Simple task**: Generate a Python Fibonacci function
2. **3 phases**: Plan → Code → Validate
3. **Execute code**: Run the generated Python with `uv run python`
4. **Clean up**: Always delete temp files (no disk pollution)
5. **No git commits**: Avoid polluting repo history
6. **Exit codes**: Exit 1 on failure (for CI)

#### DX Requirements (CRITICAL)
**This is a showcase - the code must be beautiful and minimal.**

❌ **ANTI-PATTERNS TO AVOID**:
- Multiple `console.log()` calls in a row
- Manual string formatting in main code
- Printing results inline in the workflow
- Any logging that isn't through the channel system

✅ **PATTERNS TO FOLLOW**:
- **Use channels for ALL output** - even validation results
- **Events over logging** - Emit events, let channels format them
- **Minimal main code** - Business logic only, no presentation
- **Functions over repeated code** - Abstract common patterns
- **Type-safe everywhere** - Leverage Zod schemas

### Architecture Guidance

#### What Should Be an Agent vs. Custom Code

**Use agents for** (LLM tasks):
- Planning (PlannerAgent)
- Code generation (CodingAgent)

**Use custom code for** (deterministic tasks):
- File I/O (write temp file)
- Process execution (`execSync` with `uv run`)
- File cleanup (unlinkSync)

**Use channels for** (output/presentation):
- Progress updates
- Validation results
- Error display
- Success messages

#### Channel System - How to Use It

The channel system handles ALL presentation. Example from `console-channel.ts`:

```typescript
export const ConsoleChannel = defineChannel({
  name: "Console",

  state: () => ({ ... }),

  on: {
    "phase:start": ({ event, output }) => {
      output.line(`┌─ Phase: ${event.event.name}`);
    },

    "phase:complete": ({ event, output }) => {
      output.success(`└─ ${event.event.name} complete`);
    },

    // Your validation result could be a custom event:
    "validation:result": ({ event, output }) => {
      const { passed, output: codeOutput } = event.event;
      if (passed) {
        output.success("✅ Code executed successfully");
        output.line(`Output: ${codeOutput}`);
      } else {
        output.fail("❌ Validation failed");
      }
    },
  },
});
```

**Key insight**: If you need custom output, emit a custom event and handle it in the channel!

#### How to Emit Custom Events

Harness phases can emit custom events:

```typescript
await phase("Validation", async () => {
  // ... validation logic ...

  // Emit custom event that channel can handle
  emit("validation:result", {
    passed: true,
    output: executionOutput,
    code: generatedCode,
  });

  return { passed: true };
});
```

The channel receives it via `emit` function in context or through the event bus.

### Exploration Context

#### Available Agents (from `/packages/anthropic/src/presets/`)
- **CodingAgent**: `{ task: string }` → `{ code: string, explanation?: string, language?: string }`
- **PlannerAgent**: `{ prd: string }` → `{ tasks: PlannerTask[] }`
- **ReviewAgent**: `{ task: string, implementationSummary: string }` → `{ approved: boolean, issues[], suggestions? }`

**Note**: There is NO VerifierAgent or ValidationAgent - validation needs custom code.

#### Channel Pattern (from SDK)
```typescript
import { defineChannel } from "@openharness/sdk";

const MyChannel = defineChannel({
  name: "MyChannel",
  state: () => ({ /* fresh state */ }),
  on: {
    "event:pattern": ({ event, output, state }) => {
      // Handle events with pattern matching
      output.line("...");
    },
  },
  onStart: ({ output }) => { /* lifecycle hook */ },
  onComplete: ({ output, state }) => { /* lifecycle hook */ },
});
```

**RenderOutput helpers**:
- `output.line(text)` - Normal text
- `output.success(text)` - Green checkmark
- `output.fail(text)` - Red X
- `output.newline()` - Blank line
- `output.spinner(text)` - Loading spinner

#### Harness Pattern (from SDK)
```typescript
import { defineHarness } from "@openharness/sdk";

const MyHarness = defineHarness({
  name: "my-workflow",
  agents: { planner: PlannerAgent, coder: CodingAgent },
  state: (input) => ({ /* initial state */ }),
  run: async ({ agents, state, phase, task, emit }) => {
    await phase("PhaseName", async () => {
      // Business logic
      const result = await agents.planner.execute({ ... });

      // Emit custom events if needed
      emit?.("custom:event", { data: "..." });

      return { metadata: "for phase" };
    });

    return { finalResult: state };
  },
});
```

### File Structure

**Create these files**:
1. `examples/coding/src/validation-harness.ts` - The workflow harness
2. `examples/coding/src/validate.ts` - Entry point (MINIMAL - just calls harness with channel)
3. `examples/coding/.gitignore` - Add `test-output/` directory

**Modify**:
1. `examples/coding/package.json` - Add `"validate": "bun src/validate.ts"` script

### Expected Behavior

```bash
$ cd examples/coding && bun run validate

╔════════════════════════════════════════╗
║   Validation Workflow                  ║
╚════════════════════════════════════════╝

┌─ Phase 1: Planning
  ├─ Starting: fibonacci-task
  ├─ Done (1/1)
└─ Planning complete

┌─ Phase 2: Coding
  ├─ Generating code...
  ├─ Done (1/1)
└─ Coding complete

┌─ Phase 3: Validation
  ├─ Executing Python code...
  ├─ Done (1/1)
└─ Validation complete

✅ Code executed successfully!
📝 Generated function returns: 55

✨ Validation complete
```

**Key**: ALL that output comes from the channel, NOT from console.log in validate.ts!

### Technical Details

#### Python Execution
```typescript
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Write temp file
const tempFile = join(process.cwd(), "test-output", `test_${Date.now()}.py`);
writeFileSync(tempFile, code, "utf-8");

try {
  // Execute with uv
  const output = execSync(`uv run python ${tempFile}`, {
    encoding: "utf-8",
    timeout: 5000,
  });

  return { passed: true, output };
} finally {
  // ALWAYS cleanup
  try { unlinkSync(tempFile); } catch {}
}
```

#### Fibonacci PRD
```typescript
const prd = `
Write a Python function called fibonacci(n) that calculates the nth Fibonacci number.
Requirements:
- Handle n=0 (return 0) and n=1 (return 1)
- Use recursion
- Print fibonacci(10) to test
`;
```

### Quality Checklist

Before considering this done:

- [ ] No `console.log()` in validate.ts (just calls harness + channel)
- [ ] All output goes through channel events
- [ ] Validation results displayed via custom event
- [ ] Clean separation: harness (logic) vs. channel (presentation)
- [ ] Type-safe throughout (proper TypeScript)
- [ ] Proper error handling with try/finally
- [ ] Temp files always cleaned up
- [ ] Exit codes: 0 on success, 1 on failure
- [ ] Code is minimal and beautiful (showcase quality)

### Success Criteria

**Functional**:
1. Generates Fibonacci function
2. Executes it with `uv run python`
3. Validates output is correct (55)
4. Cleans up temp files
5. Exits with proper code

**DX**:
1. Code is beautiful and minimal
2. Clear separation of concerns
3. Showcases channel system properly
4. Someone reading this code wants to use the framework
5. No anti-patterns (repeated console.logs, inline formatting, etc.)

### Key Files to Reference

**Harness example**: `examples/coding/src/harness.ts` (current working harness)
**Channel example**: `examples/coding/src/console-channel.ts` (beautiful output)
**Entry point example**: `examples/coding/src/index.ts` (see how minimal it is)

### Architecture Philosophy

From the project's constitution:
> **Simplicity scales.** Code should be obvious, not clever. When someone reads this, they should immediately understand the pattern and want to use it.

Your validation workflow should exemplify this. Clean, minimal, beautiful.

---

## Implementation Notes

**Start with**:
1. Read the reference files above
2. Understand the channel pattern deeply
3. Design your custom events (if needed)
4. Write the harness (business logic only)
5. Write the entry point (should be ~10 lines)
6. Extend ConsoleChannel or create ValidationChannel for custom events

**Key question to ask yourself**: "Would someone reading this code be impressed by the DX and want to use this framework?"

If the answer is yes, you've succeeded.
