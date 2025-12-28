# Retrospective: Monologue System Failure

**Date**: 2025-12-25
**Severity**: Critical (Spec/Task/Code Mismatch)
**Feature**: 002-sdk-validation

---

## Executive Summary

The monologue/narrative system implementation failed due to an **undocumented mid-session architectural pivot** that was never propagated back to the official spec artifacts. Tasks T051-T056 were marked as complete, but the code is orphaned and non-functional.

---

## What Happened

### Timeline of Events

1. **001-sdk-core spec** defined monologue as a **decorator pattern**:
   - FR-020: "Monologue MUST be opt-in via decorator pattern"
   - FR-024: "Monologue decorator MUST be injectable (DI-native)"
   - FR-025: "Monologue MUST emit via `onMonologue(narrative)` callback"

2. **002-sdk-validation spec** inherited this assumption:
   - Line 19: "All three agents are wrapped with monologue"
   - FR-014: "All agents MUST be wrapped with monologue"
   - US4: Full user story about monologue wrapping

3. **tasks.md was generated** from spec:
   - T051-T056 describe wrapping agents with monologue
   - All 6 tasks marked `[X]` complete

4. **Mid-session architectural pivot** (documented ONLY in `rescue/NARRATIVE-INTEGRATION-SPEC.md`):
   - Decision: Switch from decorator pattern to **callback extension pattern**
   - Rationale: "Zero state added to base class", "Perfect backward compatibility"
   - This was a CORRECT architectural decision but...

5. **Critical failure**: The pivot was NOT propagated back to:
   - `spec.md` (still describes decorator pattern)
   - `tasks.md` (still describes decorator tasks)
   - The agent implementing tasks didn't know about the pivot

6. **Result**:
   - Two orphaned files exist: `src/agents/monologue.ts`, `src/monologue/wrapper.ts`
   - Neither is integrated into anything
   - `BaseAnthropicAgent` does NOT fire `onNarrative` callbacks
   - Only `TaskHarness` has working narrative (built its own inline implementation)

---

## Root Cause Analysis

### Primary Failure: Undocumented Architectural Pivot

| What Should Have Happened | What Actually Happened |
|---------------------------|------------------------|
| Architectural change → Update spec.md | Change documented in `rescue/` folder only |
| Spec change → Regenerate tasks.md | tasks.md never updated |
| tasks.md guides implementation | Agent implemented OLD spec literally |
| Verification catches mismatch | Tasks marked complete despite orphaned code |

### Where the Spec-Kit Process Failed

```
┌─────────────────────────────────────────────────────────────────┐
│                     SPEC-KIT PROCESS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  spec.md ─────────────────┐                                     │
│     │                     │                                     │
│     ▼                     │                                     │
│  plan.md ─────────────────┤                                     │
│     │                     │                                     │
│     ▼                     │                                     │
│  tasks.md ───────────────▶│ ◄──── ARCHITECTURAL PIVOT HERE      │
│     │                     │       (rescue/ folder bypass)       │
│     │                     │                                     │
│     ▼                     │                                     │
│  implementation ──────────┘                                     │
│     │                                                           │
│     ▼                                                           │
│  verification ◄──── SHOULD HAVE CAUGHT THIS                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**The bypass**: An architectural decision was made and documented in `rescue/NARRATIVE-INTEGRATION-SPEC.md` without updating the canonical artifacts. This created two parallel "sources of truth":

1. **Official**: `spec.md` → `tasks.md` (decorator pattern)
2. **Actual**: `rescue/NARRATIVE-INTEGRATION-SPEC.md` (callback pattern)

### Secondary Failures

1. **Tasks T051-T056 marked complete** when code was orphaned
2. **No integration test** that would have caught non-functional monologue
3. **Verification command** didn't detect spec/code mismatch for narrative

---

## What Code Currently Exists

### Orphaned Code (NOT INTEGRATED)

| File | Purpose | Status |
|------|---------|--------|
| `src/agents/monologue.ts` | AgentMonologue class (OLD decorator approach) | Uses deprecated `IAgentRunnerToken`, never called |
| `src/monologue/wrapper.ts` | `withMonologue` wrapper (OLD approach) | Never called, exports broken |
| `src/runner/models.ts:15` | `MONOLOGUE` event type | Valid but unused |

### Working Narrative (TaskHarness-only)

| File | Purpose | Status |
|------|---------|--------|
| `src/harness/task-harness.ts:708-719` | `emitNarrative()` method | Works, but only for TaskHarness |
| `src/harness/task-state.ts:205-216` | `createNarrativeEntry()` helper | Works |
| `src/callbacks/types.ts:226-240` | `onNarrative` callback in IAgentCallbacks | Defined but never fired by BaseAnthropicAgent |

### What Was Supposed to Happen (NEW Approach)

Per `rescue/NARRATIVE-INTEGRATION-SPEC.md`:

1. `BaseAnthropicAgent` should integrate narrative natively
2. Agents pass `onNarrative` + `narrativeConfig` callbacks to `execute()`
3. No decorator/wrapper needed
4. BUT: `BaseAnthropicAgent` was "accidentally deleted" and needs recreation

---

## Two Approaches: OLD vs NEW

### OLD Approach (001-sdk-core spec, tasks T051-T056)

```typescript
// Decorator pattern - wrap agents
const agent = withMonologue(
  createAgent('coder'),
  { onNarrative: (text) => console.log(text) }
);
```

**Status**: Partially implemented, orphaned, broken

### NEW Approach (rescue/NARRATIVE-INTEGRATION-SPEC.md)

```typescript
// Callback extension - native to BaseAnthropicAgent
await agent.execute(input, sessionId, {
  onNarrative: (text) => console.log(text),
  narrativeConfig: { bufferSize: 3 },
});
```

**Status**: Interfaces defined, implementation incomplete

---

## Impact Assessment

| Impact Area | Severity | Description |
|-------------|----------|-------------|
| User Story 4 (Monologue) | **CRITICAL** | Marked complete but non-functional |
| FR-014 (Monologue wrap) | **CRITICAL** | Requirement not met |
| FR-015 (Unified narrative) | **CRITICAL** | Only works for TaskHarness |
| Tasks T051-T056 | **HIGH** | Marked done, code orphaned |
| Constitution III (DI) | **MEDIUM** | Orphaned code uses deprecated tokens |

---

## Remediation Options

### Option A: Complete the NEW Approach

**Effort**: Medium (2-3 hours)
**Risk**: Low

1. Delete orphaned OLD code (`src/agents/monologue.ts`, `src/monologue/wrapper.ts`)
2. Implement narrative integration in `BaseAnthropicAgent` per rescue spec
3. Update spec.md to reflect callback pattern (not decorator)
4. Update tasks.md T051-T056 to reflect new approach
5. Add integration test for narrative

### Option B: Complete the OLD Approach

**Effort**: Medium (2-3 hours)
**Risk**: Medium (goes against rescue decision rationale)

1. Fix orphaned code to use non-deprecated tokens
2. Integrate `withMonologue` wrapper into agent factory
3. Wire up monologue to BaseAnthropicAgent event stream
4. Keep spec.md as-is (decorator pattern)

### Option C: Defer Monologue to Next Feature

**Effort**: Low (30 min)
**Risk**: Low

1. Mark T051-T056 as `[ ]` incomplete
2. Update spec.md to mark FR-014, FR-015 as P3/deferred
3. Remove orphaned code
4. Create new spec/tasks for monologue in future feature

**Recommendation**: Option A (NEW approach) or Option C (defer)

---

## Lessons Learned

### Process Improvements Needed

1. **Architectural pivots MUST update spec.md**
   - Never document decisions in ad-hoc locations (rescue/, notes/, etc.)
   - Spec is the single source of truth

2. **Task completion requires verification**
   - Tasks should not be marked `[X]` until code is proven working
   - Add integration tests as task completion gates

3. **Spec-kit analysis should catch orphaned code**
   - Add check: "Do spec requirements have working code?"
   - Add check: "Is there code that doesn't map to requirements?"

4. **Mid-session pivots need explicit handling**
   - If architecture changes mid-implementation, STOP
   - Update artifacts BEFORE continuing implementation

### Signs This Was Happening

These were warning signs that should have triggered a stop:

- `rescue/` folder existing at all (bypassing normal process)
- Tasks marked complete without integration tests
- Exports referencing non-existent files (build would fail)
- Two different patterns documented in two places

---

## Artifacts to Update

If proceeding with Option A or C:

| Artifact | Update Needed |
|----------|---------------|
| `spec.md` | Change FR-014/FR-015 to callback pattern OR mark deferred |
| `plan.md` | Update AD-003 (Unified Narrative Stream) |
| `tasks.md` | Unmark T051-T056 OR update descriptions |
| `src/agents/monologue.ts` | DELETE (orphaned) |
| `src/monologue/wrapper.ts` | DELETE (orphaned) |
| `src/index.ts:102` | Remove broken `withMonologue` export |
| `src/agents/index.ts:15` | Remove broken `AgentMonologue` export |
| `src/core/container.ts:143` | Remove broken `AgentMonologue` binding |

---

## Decision Required

Before starting a new cycle, the user must decide:

1. **Which approach for monologue?** (Callback pattern recommended)
2. **Implement now or defer?** (Defer recommended if time-sensitive)
3. **How to prevent future bypasses?** (Process gate needed)

---

## Multi-Perspective Analysis

### 🎩 The Architect's Perspective

**Core Failure**: Lack of contract enforcement.

The spec said "agents MUST be wrapped with monologue" but:
- No interface defined what "wrapped" means
- No test contract verifying agents fire `onNarrative`
- No schema defining what agent narratives look like

**What was needed**: If an agent is "wrapped with monologue", there should be an `IMonologueAgent` interface that REQUIRES `onNarrative` to be fired. The type system should enforce the contract.

```typescript
// This should have existed in the spec
interface IMonologueAgent<TInput, TOutput> extends IAgent<TInput, TOutput> {
  // Contract: execute MUST call onNarrative at least once
  execute(input: TInput, sessionId: string, callbacks: RequiredNarrativeCallbacks): Promise<TOutput>;
}

type RequiredNarrativeCallbacks = IAgentCallbacks & {
  onNarrative: (text: string) => void;  // NOT optional
};
```

---

### 🧪 The QA Engineer's Perspective

**Core Failure**: Missing acceptance tests.

Acceptance Scenario #1 (spec.md line 117):
> "Given Parser Agent with monologue, When parsing tasks.md, Then it narrates discovery..."

There was no test that:
1. Instantiates ParserAgent with narrative callbacks
2. Runs parse()
3. Asserts `onNarrative` was called
4. Asserts narrative content matches expected pattern

**What was needed**: Generate stub acceptance tests FROM the spec BEFORE implementation.

```typescript
// This test should have been auto-generated from spec
describe("FR-014: Agents wrapped with monologue", () => {
  it("ParserAgent fires onNarrative during parse", async () => {
    const narratives: string[] = [];
    const parser = container.get(ParserAgent);

    await parser.parse(sampleInput, {
      onNarrative: (text) => narratives.push(text),
      narrativeConfig: { bufferSize: 1 },
    });

    expect(narratives.length).toBeGreaterThan(0);
    expect(narratives[0]).toMatch(/reading|parsing|found/i);
  });
});
```

Task isn't complete until this test passes.

---

### ⚙️ The Process Engineer's Perspective

**Core Failure**: Bypassing the feedback loop.

The spec-kit process should be a CLOSED cycle:

```
spec.md ←──────────────────────────────────────┐
   │                                            │
   ▼                                            │
plan.md                                         │
   │                                            │
   ▼                                            │
tasks.md                                        │ FEEDBACK
   │                                            │ (changes flow back)
   ▼                                            │
implementation                                  │
   │                                            │
   ▼                                            │
verification ───────────────────────────────────┘
```

**What broke it**: The `rescue/` folder bypass created an open loop. The architectural decision never flowed back to update spec.md.

**What was needed**:
1. Forbid out-of-band documentation (no rescue/, notes/, etc. for decisions)
2. If architecture changes, STOP, update spec.md, regenerate downstream
3. Add "spec drift detection" as a pre-flight check

---

### 🤖 The Autonomous Agent's Perspective

If this harness were executing autonomously, how would it have caught this?

**Detection Point 1: Contradictory Documentation**

Before starting, scan ALL documentation files:
```
Found: specs/002-sdk-validation/spec.md → "decorator pattern"
Found: rescue/NARRATIVE-INTEGRATION-SPEC.md → "callback pattern"
⚠️ CONFLICT DETECTED: Two sources describe different architectures
ACTION: Cannot proceed. Ask user which is authoritative.
```

**Detection Point 2: Task Completion Without Evidence**

Before marking T052 complete:
```
Task: "Wrap ParserAgent with monologue"
Acceptance: "Agent fires onNarrative during parse"

Checking evidence:
  ❌ No test file: tests/unit/parser-narrative.test.ts
  ❌ ParserAgent.parse() does not call onNarrative
  ❌ No recording shows narrative emission

ACTION: Cannot mark complete. Criteria not met.
```

**Detection Point 3: Spec Ambiguity**

When encountering "wrap with monologue":
```
Parsing task: "Wrap ParserAgent with monologue"

Searching for disambiguation:
  ❌ No withMonologue() function exists
  ❌ No IMonologueAgent interface exists
  ❌ No example in spec.md

⚠️ UNDERSPECIFIED: "wrap with monologue" has no clear implementation

ACTION: Cannot proceed. Ask user:
  A) Wrapper function pattern?
  B) Callback extension pattern?
  C) Harness-level generation?
```

---

### 🔧 The DevOps Perspective

**Core Failure**: No automated guardrails.

The build/CI should fail if:
- Exports reference non-existent files
- Deprecated tokens are used in new code
- Tasks marked complete but acceptance tests missing

**What was needed**:

```yaml
# .github/workflows/spec-compliance.yml
- name: Check export integrity
  run: bun run check-exports  # Fail if exports don't resolve

- name: Check deprecated usage
  run: grep -r "IAgentRunnerToken" src/agents/*.ts && exit 1

- name: Check task evidence
  run: |
    for task in $(grep -l "^\[X\]" tasks.md); do
      test_file=$(extract_test_path $task)
      [ -f "$test_file" ] || exit 1
    done
```

---

### 📋 The Product Owner's Perspective

**Core Failure**: Accepting incomplete work.

Tasks T052-T054 were marked done. The product owner should have:
1. Asked for a demo: "Show me the Parser Agent narrating"
2. Requested evidence: "What's the test that proves this works?"
3. Verified acceptance: "Can I see the narrative output?"

**What was needed**: "Demo-or-it-didn't-happen" policy for user-facing features. Each task completion requires:
- Test file path
- Recording file path
- Screenshot or log showing it works

---

## How Would the Harness Have Solved This?

### Current Harness Flow

```
ParserAgent → Parse tasks.md → Task[]
      ↓
TaskHarness → For each task:
      ↓         1. CodingAgent executes
      ↓         2. ReviewAgent validates
      ↓         3. Mark complete or retry
      ↓
Summary
```

### Where It Should Have Failed

**At ReviewAgent validation for T052**:

```
ReviewAgent receives:
  Task: "Wrap ParserAgent with monologue"
  Criteria: "Agent fires onNarrative during parse"
  Code changes: [parser-agent.ts, monologue.md]

ReviewAgent analysis:
  ✓ monologue.md created (style guide)
  ✓ parser-agent.ts exists
  ❌ parser-agent.ts does NOT call callbacks?.onNarrative
  ❌ No test exists for narrative emission
  ❌ Acceptance criteria NOT met

Result: FAIL
Reason: "ParserAgent.parse() never invokes onNarrative callback"
Suggested fix: "Add event buffering and onNarrative emission in parse()"
```

### Why It Didn't Catch This

The ReviewAgent's validation was likely:
- **Too surface-level**: Saw "monologue.md created" → Passed
- **Missing code inspection**: Didn't trace execution path
- **Missing test requirement**: No "must have passing test" gate

### Required Harness Enhancements

**1. Validation Criteria Must Be TESTABLE**

❌ Bad (current):
```
T052: Wrap ParserAgent with monologue
Validation: Agent narrates during parse
```

✅ Good (needed):
```
T052: Integrate narrative callbacks into ParserAgent.parse()
Validation:
  - Test file: tests/unit/parser-narrative.test.ts
  - Test asserts: onNarrative called during parse()
  - Test status: PASSING
```

**2. ReviewAgent Should Run Tests**

Current flow:
```
CodingAgent → makes changes → ReviewAgent reads code → pass/fail
```

Required flow:
```
CodingAgent → makes changes → ReviewAgent:
    1. Run existing tests (must pass)
    2. Check if NEW test exists for this task
    3. Run new test (must pass)
    4. Review code quality
    → PASS only if ALL 4 pass
```

**3. Pre-Flight Drift Detection**

Before executing ANY tasks:
```
DriftDetectorAgent:
  1. List all .md files in repo
  2. Extract decision statements
  3. Compare against spec.md
  4. Flag contradictions

Result for this repo:
  ⚠️ rescue/NARRATIVE-INTEGRATION-SPEC.md line 16:
     "Option Chosen: Callback Extension"
  ⚠️ spec.md line 172:
     "FR-014: All agents MUST be wrapped with monologue"

  These may conflict. Resolve before proceeding.
```

**4. Evidence-Based Completion**

Each task marked complete requires:
```typescript
interface TaskEvidence {
  testFile: string;           // Path to test
  testResult: "pass" | "fail";
  recordingFile?: string;     // Golden recording
  codeChanges: string[];      // Files modified
  acceptanceMet: boolean;     // All criteria satisfied
}
```

---

## Concrete Recommendations for Next Cycle

### R1: Specification Contracts

Every functional requirement includes:

```markdown
**FR-014**: All agents MUST emit narratives during execution

**Contract**:
```typescript
// Agent must satisfy this interface
interface INarrativeEmitter {
  // execute() must call onNarrative at least once when narrativeConfig provided
  execute(input: I, session: string, callbacks: {
    onNarrative: (text: string) => void;
    narrativeConfig: NarrativeConfig;
  }): Promise<O>;
}
```

**Test**: tests/integration/narrative-emission.test.ts

**Evidence**:
- Test passes
- Recording in recordings/golden/narrative/
```

### R2: Task Completion Gates

Tasks CANNOT be marked `[X]` without:

| Gate | Check | Fail Action |
|------|-------|-------------|
| Test exists | `[ -f $testFile ]` | Create test first |
| Test passes | `bun test $testFile` | Fix code |
| Evidence captured | Recording or screenshot | Capture before marking |
| Review approved | ReviewAgent returns PASS | Address feedback |

### R3: Drift Detection Pre-Flight

Before `/speckit.implement`:

```bash
# Check for contradictory documentation
find . -name "*.md" -exec grep -l "decision\|chose\|approach" {} \; | \
  xargs -I{} check-against-spec {}

# Fail if rescue/, notes/, scratch/ contain decisions
[ -d rescue ] && echo "ERROR: rescue/ folder detected. Merge into spec.md first."
```

### R4: Acceptance Scenario → Test Mapping

For each acceptance scenario in spec.md:

```
Scenario: "Given Parser Agent with monologue, When parsing, Then narrates"
                    ↓
Auto-generate test stub:
                    ↓
tests/acceptance/us4-parser-narrative.test.ts
```

Implementation only proceeds AFTER test stub exists (spec-level TDD).

### R5: No Out-of-Band Documentation

**Policy**:
- Architectural decisions ONLY in spec.md or plan.md
- No rescue/, notes/, scratch/ for decision capture
- If architecture changes mid-session → STOP → Update artifacts → Continue

### R6: Enhanced ReviewAgent

```typescript
class EnhancedReviewAgent {
  async validate(task: ParsedTask, codeChanges: FileChange[]): Promise<ValidationResult> {
    // 1. Parse acceptance criteria into testable assertions
    const criteria = this.parseAcceptanceCriteria(task.validationCriteria);

    // 2. Check if required test exists
    const testFile = this.inferTestPath(task);
    if (!await exists(testFile)) {
      return { passed: false, reason: `Missing test: ${testFile}` };
    }

    // 3. Run test
    const testResult = await this.runTest(testFile);
    if (!testResult.passed) {
      return { passed: false, reason: `Test failed: ${testResult.error}` };
    }

    // 4. Verify acceptance criteria met
    for (const criterion of criteria) {
      if (!await this.verifyCriterion(criterion, codeChanges)) {
        return { passed: false, reason: `Criterion not met: ${criterion}` };
      }
    }

    return { passed: true };
  }
}
```

---

## Meta-Insight: What the Harness Was Missing

The current harness has:
- ✅ ParserAgent (parses tasks.md)
- ✅ CodingAgent (writes code)
- ✅ ReviewAgent (reviews code)

What was MISSING to catch this:

| Missing Agent | Purpose | Would Have Caught |
|---------------|---------|-------------------|
| **SpecParserAgent** | Parse spec.md into testable requirements | Ambiguous "wrap with monologue" |
| **TestGeneratorAgent** | Generate stub tests from acceptance scenarios | Missing test for T052 |
| **DriftDetectorAgent** | Check for contradictions across docs | rescue/ vs spec.md conflict |
| **EvidenceCollectorAgent** | Capture proof after each task | No recording = task incomplete |
| **ComplianceReviewAgent** | Verify all FR-XXX have passing tests | FR-014 has no test coverage |

If these agents existed, the harness would have:
1. Detected the rescue/ contradiction → Asked user to resolve
2. Generated a test for "ParserAgent fires onNarrative"
3. Failed the test → Refused to mark T052 complete
4. Never reached the broken state

---

## Appendix: File References

- Original spec: `/specs/001-sdk-core/spec.md` (lines 52-65, 149-156)
- Current spec: `/specs/002-sdk-validation/spec.md` (lines 103-123, 172-175)
- Rescue doc: `/rescue/NARRATIVE-INTEGRATION-SPEC.md`
- Orphaned code: `/packages/sdk/src/agents/monologue.ts`, `/packages/sdk/src/monologue/wrapper.ts`
- Working narrative: `/packages/sdk/src/harness/task-harness.ts` (lines 708-719)
