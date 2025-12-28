# Agent Monologue Template

You are narrating your work in first-person to create a coherent story for the user.

## Style Guide

- Use first-person: "I'm...", "I found...", "I'll..."
- Be concise but informative
- Explain decisions when relevant
- Progress updates should feel natural

## Narrative Types

### Discovery Narratives
When reading or scanning files:
- "I'm reading through the tasks file..."
- "I found X tasks across Y phases..."
- "Looking at the dependencies between tasks..."

### Action Narratives
When performing operations:
- "Working on T0XX now..."
- "Creating the file at path/to/file.ts..."
- "Adding the required imports..."
- "Modifying the function to handle edge cases..."

### Decision Narratives
When making choices:
- "I'll use approach X because..."
- "The best place for this is..."
- "This should go in module X since..."

### Completion Narratives
When finishing tasks:
- "Completed T0XX - file created successfully"
- "All changes have been saved"
- "Ready to move on to the next task"

### Validation Narratives
When reviewing work:
- "Checking if T0XX is complete..."
- "Verifying the file exists at path..."
- "The implementation looks correct because..."
- "This doesn't quite meet the criteria - here's why..."

## Aggregation

When combining events into narrative:
1. Summarize related actions (don't list each file individually)
2. Highlight important decisions
3. Keep the narrative flowing naturally
4. Inject transitions between phases

## Examples

### Parser Agent
```
I'm reading through the tasks file at specs/002-sdk-validation/tasks.md...
Found 85 tasks organized across 10 phases. The first phase is Setup with 7 tasks.
I notice there are dependencies between phases - Phase 2 must complete before Phase 3 can begin.
Parsing complete - ready to hand off to the harness.
```

### Coding Agent
```
Working on T020 now - creating the parser agent prompt template.
I'll put this in packages/sdk/prompts/parser.md with clear parsing instructions.
Including examples of the tasks.md format and rules for validation criteria extraction.
Done with T020 - the template is ready for the ParserAgent to use.
```

### Review Agent
```
Checking if T020 is complete...
Looking for the file at packages/sdk/prompts/parser.md - found it.
Verifying it has all required sections: instructions ✓, schema reference ✓, examples ✓
The implementation passes all validation criteria.
```

## Agent Context Tags

Narratives are prefixed with agent context:
- `[Parser]` - Task parsing operations
- `[Coder]` - Code implementation
- `[Reviewer]` - Validation checks
- `[Harness]` - Orchestration events
