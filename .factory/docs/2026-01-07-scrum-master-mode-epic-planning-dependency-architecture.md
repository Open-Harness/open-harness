## Scrum Master: Epic Planning & Dependency Management

### Role & Approach
I'm now functioning as **Scrum Master** for the runtime refactoring initiative. My responsibilities:

1. **Define all work** with clear acceptance criteria
2. **Map dependencies** between beads systematically
3. **Write hand-off prompts** that agents can execute independently
4. **Track dependency chains** to prevent blocked work
5. **Ensure rich context** in each bead for human understanding

### Proposed Plan Structure

**5 Epics, 46 Beads Total** (after open-harness-9mq's 14)

**Epic 1: Transport Layer** (12 beads)
- @internal/client (HTTP/SSE utilities)
- @open-harness/client (public client SDK)
- Dependencies: open-harness-9mq ✅
- Timeline: 40-60 hours

**Epic 2: Persistence Layer** (8 beads)  
- adapters/run-store/sqlite
- adapters/run-store/testing
- Dependencies: open-harness-9mq ✅
- Timeline: 30-40 hours

**Epic 3: Server Integration** (12 beads)
- @internal/server
- @open-harness/server
- Dependencies: Epic 1 + Epic 2
- Timeline: 50-70 hours

**Epic 4: Framework Integration** (8 beads)
- @open-harness/react
- @open-harness/testing
- Dependencies: Epic 3
- Timeline: 35-45 hours

**Epic 5: Final Pass & Validation** (6 beads)
- Cross-cutting error propagation
- Master SDK documentation
- Migration guide
- E2E validation
- Dependencies: Epics 1-4
- Timeline: 25-35 hours

### Each Bead Will Include

1. **Description** - Why this work matters
2. **Context** - What changed in dependencies
3. **Dependencies** - What must be done first
4. **Acceptance Criteria** - How to know it's done
5. **Implementation Guide** - Step-by-step instructions
6. **Validation Checklist** - Quality gates to pass
7. **Hand-off Template** - Copy-paste ready for next agent

### Example Bead Structure

```
[bd-xxxxx.1] Transport Layer: HTTP Client Error Handling

DESCRIPTION:
Add neverthrow Result-based error handling to HTTP client utilities.
This is the foundation for all client code and must be completed before
public client API can be refactored.

CONTEXT:
- @internal/core runtime now has structured error types (CompilationError, ExecutionError, ExpressionError)
- All public APIs remain backward compatible (still throw)
- Internal methods expose Result variants marked @internal
- This pattern must extend to all packages

DEPENDENCIES:
- open-harness-9mq CLOSED ✅
- No blocking dependencies (can start immediately)

ACCEPTANCE CRITERIA:
- HttpClientError class created with 5+ error codes
- wrapHttpThrow/wrapHttpThrowAsync helpers defined
- Result-based methods added to main classes
- errors.ts exports all types and helpers
- Typecheck 100% passing
- Lint 0 issues
- Tests cover all error paths
- All changes pushed to remote

WHAT TO BUILD:
See detailed implementation guide below...

VALIDATION:
Run these commands at end:
1. bun run typecheck
2. bun run lint
3. bun run test
4. git push
5. Confirm no regressions
```

### Benefits of This Approach

✅ **Clarity** - Each bead is self-contained with full context
✅ **Parallelization** - Teams see dependencies clearly, can work in parallel where safe
✅ **Autonomy** - Agents can pick up a bead and execute without asking questions
✅ **Traceability** - Clear chain from requirements → code → validation
✅ **Handoff** - Next agent knows exactly what was done and why
✅ **Reversibility** - Each bead can be reverted/retried independently

### Next Step

Create **Epic 1 Detailed Spec** with:
- 12 beads fully specified
- Dependency graph visualized
- Hand-off prompts ready to copy-paste
- Implementation templates for each bead type
- Quality gate requirements documented

Ready to generate Epic 1 detailed specification? This will be a complete playbook that agents can execute sequentially or in parallel (Epics 1+2 can run in parallel since both depend only on core).
