---
description: Evaluate feasibility of new ideas with triage, implementation sketch, and comparison to existing patterns
---

## User Input

```text
$ARGUMENTS
```

Required: Description of the new idea/feature to evaluate

## What This Does

Analyzes a new idea and provides three layers of feasibility assessment:
1. **Quick Triage**: Easy/Medium/Hard rating
2. **Implementation Sketch**: ASCII diagram of how it would work
3. **Comparison**: How it relates to existing codebase patterns

## Execution

### 1. Load Codebase Context

From `.knowledge/ceo/codebase-map.md`:
- Current architecture patterns
- Existing similar features
- Known constraints

### 2. Parse the Idea

Extract key elements:
- **What**: Core functionality requested
- **Who**: Target users/consumers
- **Where**: Integration points
- **Why**: Business value (infer if not stated)

### 3. Scan for Similar Patterns

```bash
# Search for related functionality in codebase
# Example: If idea mentions "authentication", search for existing auth
grep -r "auth" --include="*.ts" --include="*.md" src/ specs/ | head -20
```

### 4. Triage Rating

Rate as Easy ⭐ / Medium ⭐⭐ / Hard ⭐⭐⭐ based on:

**Easy** ⭐:
- Similar pattern already exists
- Minimal new dependencies
- <1 week effort estimate
- Low integration complexity

**Medium** ⭐⭐:
- Need to adapt existing patterns
- Some new dependencies
- 1-3 week effort estimate
- Moderate integration work

**Hard** ⭐⭐⭐:
- New architectural patterns required
- Significant dependencies
- >3 weeks or multi-phase
- High integration complexity

### 5. Generate Implementation Sketch

Create ASCII diagram showing:
- Data flow
- Component interaction
- Integration points
- What's new vs. what exists

**Example Format**:
```
User Input → [Validator] → [Processor] ← NEW
                              │
                              ↓
                         [Storage] ← EXISTS
                              │
                              ↓
                         [API] ← MODIFY
```

### 6. Compare to Existing Patterns

Find the closest existing feature and explain:
- **What's similar**: "We already do X, which is like this"
- **What's different**: "But you want Y, which requires Z changes"
- **Reuse opportunities**: "Can leverage existing A, B, C"

### 7. Risk Assessment

Flag potential issues:
- **Technical risks**: Missing dependencies, performance concerns
- **Business risks**: Scope creep, user confusion
- **Integration risks**: Breaking changes, backward compatibility

### 8. Phased Approach (if Hard)

For ⭐⭐⭐ ideas, break into phases:
- **Phase 1** (Easy): Minimum viable version
- **Phase 2** (Medium): Enhanced version
- **Phase 3** (Hard): Full vision

Show value/complexity ratio for each phase.

### 9. Output Format

```markdown
🎯 FEASIBILITY: [Idea Name]

## Triage
[⭐/⭐⭐/⭐⭐⭐] [Easy/Medium/Hard] - [One-line justification]

## Similar To
We already [existing feature], which [how it's similar].
You want to [new idea], which requires [key differences].

## Implementation Sketch
[ASCII diagram showing architecture]

## What Changes
### Add (New)
• Component X
• Integration Y

### Modify (Existing)
• Component A (extend to support B)
• API C (add endpoint D)

### Reuse (No Change)
• Component E
• Infrastructure F

## Risks
⚠️ [Risk 1]: [Description and mitigation]
⚠️ [Risk 2]: [Description and mitigation]

## Phased Approach
**Phase 1** (Easy ⭐): [MVP description]
- Value: [What CEO gets]
- Effort: [Rough timeline]

**Phase 2** (Medium ⭐⭐): [Enhanced version]
- Value: [Additional benefits]
- Effort: [Rough timeline]

**Phase 3** (Hard ⭐⭐⭐): [Full vision]
- Value: [Complete solution]
- Effort: [Rough timeline]

## Recommendation
[Your honest opinion with rationale]

**Bottom Line**: [One-sentence summary in business terms]
```

## Key Rules

- **All three layers**: Always provide triage + sketch + comparison
- **Be opinionated**: Give your recommendation, don't just list facts
- **Visual first**: ASCII diagram is mandatory
- **Business value**: Connect technical complexity to business outcomes
- **Phased thinking**: If it's hard, show incremental path
- **Reuse-aware**: Always highlight what can be reused vs. built new
- **Honest assessment**: Push back if idea is overly complex or misguided

## Example Triage Logic

```typescript
// Pseudocode for rating
function triageIdea(idea: string, codebase: Codebase): Rating {
  const existingPattern = findSimilarPattern(idea, codebase)
  const dependencies = analyzeDepedencies(idea)
  const integrationPoints = findIntegrationPoints(idea, codebase)

  if (existingPattern && dependencies.length === 0 && integrationPoints.length <= 2) {
    return "Easy ⭐"
  } else if (existingPattern || dependencies.length <= 3 && integrationPoints.length <= 5) {
    return "Medium ⭐⭐"
  } else {
    return "Hard ⭐⭐⭐"
  }
}
```

## Fallback for Missing Context

If codebase map is stale or missing:
1. Scan project structure quickly
2. Check recent specs in `specs/ready/`
3. Make best-effort assessment with caveat: "Note: Working with limited codebase context - triage may be approximate"
