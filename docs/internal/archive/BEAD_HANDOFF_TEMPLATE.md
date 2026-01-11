# Bead Hand-Off Template: Epic Execution Guide

**Purpose:** This template ensures every bead includes rich context so agents can work autonomously.  
**Format:** Each bead's Beads issue will follow this structure exactly.  
**Status:** Ready to use for Epic 1 generation

---

## Template Structure

Every bead will include these 8 sections:

### 1. TITLE & METADATA
```
[bd-XXXXX.N] {Epic Name}: {Task Name}

Epic: {Epic number and name}
Bead: {N} of {Total in epic}
Effort: {Estimated hours}
Timeline: Week {X}, Day {Y}
Dependencies: {List of 1-3 blocking beads or "open-harness-9mq"}
Blocks: {List of beads this unblocks}
Critical Path: {YES/NO}
```

### 2. ONE-LINE SUMMARY
```
{Single sentence describing the work - can be copy-pasted into commit message}
```

### 3. WHAT IS THIS?
```
{2-3 paragraphs explaining:}
- What code change is being made
- Where it lives in the codebase
- Why this specific module/file
- How it fits into the epic's overall goal

Example:
"Add neverthrow error handling to the HTTP client utilities layer.
This creates a consistent error type (HttpClientError) and Result-based 
API for all HTTP operations (GET, POST, timeout, network errors).

This is the foundation for the client SDK layer (bd-xxxxx.6), which wraps
these error types and exposes them in the public API.

Files affected: packages/internal/client/src/*.ts (~5-8 files)"
```

### 4. WHY DOES THIS MATTER?
```
{Explain the business/architectural value:}
- What becomes possible after this bead
- Who depends on this (which team/epic)
- What would break if this bead was skipped
- Impact on error handling pattern across codebase

Example:
"This bead establishes the error handling pattern for all client code.
Without it, the public client SDK (bd-xxxxx.6) cannot have proper
error types. Skipping this would force the SDK to either throw raw
exceptions or invent its own error handling separately.

This is CRITICAL because the server integration layer (Epic 3) depends
on having a consistent client API that returns Results."
```

### 5. WHAT CHANGED IN DEPENDENCIES?
```
{For each bead after #1 in the epic, explain what previous beads delivered:}

From {previous-bead-number}: {What was completed}
- Benefit: {How this bead leverages it}

From open-harness-9mq: {What the foundation provides}
- ExpressionError, ExecutionError, CompilationError patterns established
- Result<T, Error> type alias available in neverthrow
- Auto-sync metadata script integrated into lefthook
- All quality gates: typecheck, lint, test, push
- Benefit: Can follow exact same pattern without reinventing

Example for bd-xxxxx.3:
"From bd-xxxxx.2: Result-based methods added to all HTTP client classes
- Benefit: Documentation now has real code to reference
- Can show usage examples of wrapHttpThrow, match(), mapErr()

From bd-xxxxx.1: HttpClientError types and error codes defined
- Benefit: Can explain 5+ error scenarios in README
"
```

### 6. YOUR ACCEPTANCE CRITERIA (Must All Be ✅)
```
□ {Specific, measurable criterion 1}
□ {Specific, measurable criterion 2}
□ {Specific, measurable criterion 3}
□ {Specific, measurable criterion 4}
□ {Specific, measurable criterion 5}
□ {Specific, measurable criterion 6}
□ {Specific, measurable criterion 7 (if applicable)}

Examples for bd-xxxxx.1 (error handling):
□ HttpClientError class created with 5+ error codes (NETWORK_ERROR, TIMEOUT, PARSE_ERROR, STATUS_ERROR, INVALID_REQUEST)
□ wrapHttpThrow and wrapHttpThrowAsync helpers defined and exported
□ All public HTTP methods have corresponding *Result variants marked @internal
□ errors.ts exports all types, codes, and helpers correctly
□ Import statements added to main index.ts
□ Typecheck passes (0 errors)
□ Lint passes (0 issues)
□ Unit tests cover all 5+ error codes and success cases (15-20 tests minimum)
□ All changes committed to git and pushed to remote

Examples for bd-xxxxx.3 (documentation):
□ README.md created at packages/internal/client/README.md
□ Architecture diagram shows HTTP client structure
□ 3+ usage examples showing both throwing and Result variants
□ Error codes documented with recovery strategies
□ YAML frontmatter added with title, lastUpdated, lastCommit, scope
□ Cross-references to related modules (server, runtime)
□ No broken links (internal references verified)
□ Lint/spell check passed
```

### 7. HOW TO DO IT (Step-by-Step Implementation Guide)
```
STEP 1: {First action - often code exploration}
- Command: {Exact command to run}
- What to look for: {What you should find}
- Files affected: {List of files you'll modify}

STEP 2: {Second action}
- Command: {Exact command}
- What to look for: {...}
- Files affected: {...}

... (continue for all steps)

Example for bd-xxxxx.1 (errors):
STEP 1: Review open-harness-9mq error handling pattern
  Command: read packages/internal/core/src/runtime/expressions/errors.ts
  What to look for:
    - ExpressionError class structure
    - Error code type union (ExpressionErrorCode)
    - wrapThrow/wrapThrowAsync helper pattern
    - JSDoc comments for each function
  Benefit: Understand the exact pattern to replicate

STEP 2: Create packages/internal/client/src/errors.ts
  - Copy ExpressionError structure as template
  - Replace "Expression" with "HttpClient" everywhere
  - Define 5+ error codes:
    * NETWORK_ERROR: Cannot reach server
    * TIMEOUT: Request exceeded timeoutMs
    * PARSE_ERROR: Response JSON parsing failed
    * STATUS_ERROR: HTTP status >= 400
    * INVALID_REQUEST: Input validation failed
  - Add wrapHttpThrow/wrapHttpThrowAsync
  - Add JSDoc with @internal markers

STEP 3: Add Result-based methods to HTTP client classes
  - For each public method:
    * Identify what it throws currently
    * Create corresponding *Result method
    * Mark with @internal comment
    * Add 2-3 line JSDoc example
  - Example: runNode() → runNodeResult()

STEP 4: Update imports and exports
  - packages/internal/client/src/index.ts
  - Add: export * from "./errors.js"
  - Verify no import cycles

STEP 5: Write tests
  - Create packages/internal/client/tests/unit/errors.test.ts
  - Test each error code can be created
  - Test wrapHttpThrow catches exceptions
  - Test Result.match() patterns
  - Test Result.mapErr() patterns
  - Minimum 15 tests

Example for bd-xxxxx.3 (docs):
STEP 1: Gather reference material
  Command: read packages/internal/core/src/runtime/expressions/README.md
  What to look for: Section structure, example format, error documentation

STEP 2: Create packages/internal/client/README.md
  Structure:
  - YAML frontmatter (copy from core, update metadata)
  - "HTTP Client Layer" heading
  - "What's here" section (quick file listing)
  - "Architecture" section (diagram or text)
  - "Usage" section (3+ examples)
  - "Error Handling" section (table of 5+ codes + recovery)
  - "Performance" section
  - "Testing" section
  - "See Also" links to related modules

STEP 3: Add usage examples
  - Show basic HTTP GET with Result
  - Show error handling with match()
  - Show error transformation with mapErr()
  - Show retry pattern with throwAsync
  - All marked with ✅ or ❌ for clarity

STEP 4: Verify cross-references
  - Add link to: packages/internal/core/src/runtime/README.md (main hub)
  - Add link to: packages/open-harness/client/README.md (public API)
  - Verify links are correct relative paths

STEP 5: Add YAML frontmatter
  - title: "HTTP Client Utilities"
  - lastUpdated: (will auto-sync on commit)
  - lastCommit: (will auto-sync on commit)
  - lastCommitDate: (will auto-sync on commit)
  - scope: [http, client, error-handling, transport]
```

### 8. HOW TO VALIDATE (Copy-Paste Ready)
```
After you complete the work, run these commands IN ORDER:

1. Verify TypeScript compilation:
   cd /Users/abuusama/projects/open-harness/open-harness
   bun run typecheck
   # Expected: All 8 tasks successful, 0 errors, 0 warnings

2. Verify code style:
   bun run lint
   # Expected: All 8 tasks successful, 0 issues

3. Run all tests:
   bun run test
   # Expected: All tests passing, especially tests for this package
   # Look for: "{ModuleName} tests: X pass, 0 fail"

4. Verify git status:
   git status
   # Expected: All changes committed, working tree clean
   # If dirty: git add . && git commit -m "..."

5. Verify git push:
   git push
   # Expected: "To github.com/Open-Harness/open-harness.git"
   # Should say "feat/neverthrow-* -> feat/neverthrow-*"

6. Verify no regressions:
   git log --oneline -1
   # Copy the commit hash, then:
   git diff HEAD~1 HEAD --stat
   # Review changed files match your expectations

If any validation fails:
- Do NOT mark bead complete
- Fix the issue (see troubleshooting section)
- Re-run validation
- Only mark complete when ALL 6 checks pass ✅
```

### 9. WHAT UNBLOCKS NEXT
```
After this bead is complete, the following becomes unblocked:

- bd-XXXXX.(N+1): {Task name}
  Status: BLOCKED until this bead closes
  Why: {One sentence explaining dependency}

- bd-XXXXX.(N+2): {Task name}  
  Status: BLOCKED until this bead closes
  Why: {...}

- Epic X, Bead Y: {Task name}
  Status: BLOCKED until this bead closes
  Why: {...}

Example for bd-xxxxx.5 (final commit for @internal/client):
"After this bead closes:

- bd-xxxxx.6: @open-harness/client errors
  Status: UNBLOCKED (ready to start immediately)
  Why: Depends on @internal/client being stable + pushed to remote
  
- bd-xxxxx.11: Integration tests
  Status: PARTIALLY UNBLOCKED (needs both E1.5 + E2.5)
  Why: Needs stable versions of both client and persistence

- Epic 3 (Server Integration)
  Status: WAITING (needs both E1.12 + E2.8 complete)
  Why: Server must coordinate client and persistence layers"
```

### 10. TROUBLESHOOTING SECTION
```
Common Issues & Solutions:

Q: "typecheck fails with 'Cannot find module'"
A: Clear cache and reinstall: bun install && bun run typecheck

Q: "Import path ./errors is wrong"
A: Verify correct path: packages/internal/{module}/src/errors.ts

Q: "Tests fail with 'no such file'"
A: Create test file at: packages/internal/{module}/tests/unit/{feature}.test.ts

Q: "git push rejected"
A: Pull and rebase: git pull --rebase origin feat/neverthrow-http-sse-client

Q: "Lint complains about formatting"
A: Lint fixes automatically: bun run lint (should auto-fix)

Q: "Tests pass locally but fail in CI"
A: Make sure you ran: bun run test (not bun test)
```

### 11. HAND-OFF CHECKLIST (For Agent Completion)
```
Before marking this bead COMPLETE in Beads, verify:

☐ All acceptance criteria checked off (Section 6)
☐ All validation steps passed (Section 8)
☐ Commit pushed to remote (verify with git push output)
☐ Beads issue closed (bd close {id})
☐ Beads synced (bd sync, then git push)
☐ Next agent can view this issue for context (check Github)

When finished, comment in the bead issue:
"✅ Complete: All acceptance criteria met, validation passed, changes pushed to remote.

Unblocks:
- bd-xxxxx.(N+1): {Task}
- bd-xxxxx.(N+2): {Task}
"
```

---

## Example Complete Bead (Filled Template)

```
[bd-tpl01.1] Transport Layer: HTTP Client Error Handling

Epic: 1 (Transport Layer)
Bead: 1 of 12
Effort: 4 hours
Timeline: Week 1, Day 1-2
Dependencies: open-harness-9mq COMPLETE ✅
Blocks: bd-tpl01.2, bd-tpl01.6
Critical Path: YES

---

## ONE-LINE SUMMARY
Add neverthrow Result-based error handling to HTTP client utilities with structured error types for network operations.

---

## WHAT IS THIS?

This bead creates a consistent error handling foundation for the HTTP client layer. It adds:
- HttpClientError class with 5+ error codes (NETWORK, TIMEOUT, PARSE, STATUS, INVALID)
- wrapHttpThrow/wrapHttpThrowAsync helpers following the open-harness-9mq pattern
- Result-based methods (*Result suffix) on all public HTTP classes

Files affected:
- packages/internal/client/src/errors.ts (NEW)
- packages/internal/client/src/index.ts (MODIFY: add export)
- packages/internal/client/tests/unit/errors.test.ts (NEW)

---

## WHY DOES THIS MATTER?

The HTTP client is the lowest layer in the client SDK. Without proper error types here, the public client API (bd-tpl01.6) cannot expose consistent error handling.

This is CRITICAL because:
1. Establishes error pattern for all client code to follow
2. Enables public API to wrap these errors cleanly
3. Server integration (Epic 3) depends on having a stable client error contract
4. Skipping this forces SDK to invent error handling twice (client + server)

---

## WHAT CHANGED IN DEPENDENCIES?

From open-harness-9mq:
- ExpressionError pattern shows error class structure with codes
- wrapThrow/wrapThrowAsync pattern ready to replicate
- neverthrow library already installed
- Benefit: Can copy-paste pattern with s/Expression/HttpClient/

---

## YOUR ACCEPTANCE CRITERIA

☐ HttpClientError class with 5 error codes: NETWORK_ERROR, TIMEOUT, PARSE_ERROR, STATUS_ERROR, INVALID_REQUEST
☐ wrapHttpThrow and wrapHttpThrowAsync helpers defined and exported
☐ All public HTTP client classes have *Result method variants marked @internal
☐ errors.ts properly exports all types and helpers
☐ typecheck 0 errors, lint 0 issues
☐ 15+ unit tests covering all error paths and Result patterns
☐ All changes committed and pushed

---

## HOW TO DO IT

STEP 1: Study the pattern
  Command: read packages/internal/core/src/runtime/expressions/errors.ts
  Look for: Class structure, wrapThrow pattern, JSDoc style

STEP 2: Create errors.ts
  Create: packages/internal/client/src/errors.ts
  - Copy ExpressionError as template
  - Replace "Expression" with "HttpClient"
  - Define error codes for HTTP scenarios
  - Implement wrapHttpThrow/wrapHttpThrowAsync

STEP 3: Add Result methods to HTTP classes
  Modify: packages/internal/client/src/{client,transport,connection}.ts
  - For each public method, add *Result variant
  - Use wrapHttpThrowAsync for async methods
  - Mark with @internal

STEP 4: Update exports
  Modify: packages/internal/client/src/index.ts
  - Add: export * from "./errors.js"

STEP 5: Write tests
  Create: packages/internal/client/tests/unit/errors.test.ts
  - Test each error code creation
  - Test wrapHttpThrow catches exceptions correctly
  - Test Result.match() and Result.mapErr() patterns
  - Minimum 15 tests

---

## HOW TO VALIDATE

1. bun run typecheck
   Expected: 0 errors

2. bun run lint
   Expected: 0 issues

3. bun run test
   Expected: All passing, especially "Internal Client" tests

4. git status
   Expected: Working tree clean (all changes committed)

5. git push
   Expected: Successfully pushed to feat/neverthrow-*

6. git log -1 --oneline
   Expected: Commit about "feat(client): add error handling"

---

## WHAT UNBLOCKS NEXT

- bd-tpl01.2: @internal/client Result methods
  Status: UNBLOCKED
  Why: Depends on error types being defined

- bd-tpl01.6: @open-harness/client errors (public API)
  Status: UNBLOCKED
  Why: Can now wrap these internal errors

- Epic 3: Server Integration
  Status: PARTIALLY WAITING (needs E1.12 complete)
  Why: Server must coordinate with stable client layer

---

## TROUBLESHOOTING

Q: "Cannot find module neverthrow"
A: Already in package.json from open-harness-9mq; run: bun install

Q: "TypeError: wrapThrow is not defined"
A: Make sure to import from "./errors.js" in your test file

---

## HAND-OFF CHECKLIST

☐ All acceptance criteria ✅
☐ All validation steps passed
☐ Changes pushed to remote
☐ Beads issue closed
☐ Beads synced (bd sync)

When done, comment:
"✅ Complete: HTTP client error handling established. Ready for bd-tpl01.2 to start."
```

---

## Summary

This template ensures:
- ✅ Every bead is self-contained
- ✅ Agents know exactly what to build
- ✅ Clear validation criteria (not subjective)
- ✅ Step-by-step instructions (no guessing)
- ✅ Explicit dependency info for team coordination
- ✅ Copy-paste commands for validation
- ✅ Clear hand-off to next agent

**All 46 remaining beads will use this structure.**
