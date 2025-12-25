# Self-Assessment Rubrics for DI-Driven Development

## Purpose

These rubrics exist to make you **self-critical**. Before committing any service code, grade yourself. If you don't pass, refactor.

**The goal isn't to check boxes. It's to write code you're confident in.**

---

## Rubric 1: Service Design Quality

Grade each service you write or modify.

### Scoring

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| **Constructor Injection** | 20 | All dependencies in constructor params |
| **Abstraction Dependencies** | 20 | Uses InjectionToken or abstract class, not concrete |
| **No Internal Construction** | 15 | No `new ConcreteClass()` inside service |
| **Single Responsibility** | 15 | Can describe purpose in one sentence |
| **Testable Without Infra** | 20 | Can instantiate with mocks, no real DB/API needed |
| **No Service Locator** | 10 | No `container.get()` inside service |

**Total: 100 points**

### Grading Scale

| Score | Grade | Action |
|-------|-------|--------|
| 90-100 | A | Ready to commit |
| 80-89 | B | Minor cleanup, then commit |
| 70-79 | C | Refactor before commit |
| < 70 | F | Significant redesign needed |

### Self-Assessment Template

Copy and fill out for each service:

```markdown
## Service Assessment: [ServiceName]

| Criterion | Points | Score | Evidence |
|-----------|--------|-------|----------|
| Constructor Injection | 20 | /20 | |
| Abstraction Dependencies | 20 | /20 | |
| No Internal Construction | 15 | /15 | |
| Single Responsibility | 15 | /15 | |
| Testable Without Infra | 20 | /20 | |
| No Service Locator | 10 | /10 | |
| **TOTAL** | **100** | **/100** | |

**Grade:** [A/B/C/F]
**Ready to commit:** [Yes/No]
**Issues to fix:** [List]
```

---

## Rubric 2: Dependency Graph Health

Evaluate the overall architecture, not just individual services.

### Scoring

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| **Single Composition Root** | 25 | All bindings in one container.ts file |
| **No Circular Dependencies** | 25 | Services don't depend on each other in cycles |
| **Shallow Dependency Trees** | 20 | Max 3-4 levels of nesting |
| **Clear Layer Boundaries** | 15 | Infrastructure → Domain → Application |
| **Consistent Patterns** | 15 | Same injection style throughout |

**Total: 100 points**

### Warning Signs

| Symptom | Likely Problem | Fix |
|---------|----------------|-----|
| `container.get()` in multiple files | Scattered composition | Centralize in composition root |
| Service A → B → C → A | Circular dependency | Use lazy injection or redesign |
| Service with 8+ dependencies | Too many responsibilities | Split the service |
| Can't test without real DB | Hidden infrastructure coupling | Abstract behind interface |
| Different injection styles | Inconsistent patterns | Standardize on constructor injection |

---

## Rubric 3: Test Quality (Not Coverage)

**Coverage is a lie.** 100% coverage with bad tests is worse than 60% with good tests.

### What Makes a Good Test?

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| **Tests Behavior, Not Implementation** | 25 | Doesn't break when refactoring internals |
| **No Infrastructure Required** | 25 | Runs without DB, API, filesystem |
| **Clear Arrange-Act-Assert** | 15 | Structure is obvious |
| **Single Assertion Focus** | 15 | Tests one thing per test |
| **Descriptive Names** | 10 | Name explains what's tested |
| **No Test Interdependence** | 10 | Tests can run in any order |

**Total: 100 points**

### Test Quality Checklist

Before committing tests, verify:

```markdown
- [ ] Test would still pass if I refactored implementation
- [ ] Test doesn't require starting servers or databases
- [ ] Test name describes the scenario and expected outcome
- [ ] Test has clear setup, action, and verification phases
- [ ] Test doesn't depend on other tests running first
- [ ] Mock setup is minimal (only what's needed)
```

### Bad Test Indicators

| Smell | Problem | Fix |
|-------|---------|-----|
| Test name: `test1`, `testUserService` | Unclear purpose | Name: `createUser_withValidData_returnsUser` |
| 10+ assertions in one test | Testing too much | Split into focused tests |
| Mocking implementation details | Brittle to refactoring | Mock at abstraction boundaries |
| Test requires database setup | Infrastructure coupling | Use in-memory fakes |
| Test order matters | Hidden dependencies | Isolate test state |

---

## Rubric 4: InjectionToken Design

For each token you create:

### Scoring

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| **Type-Safe Generic** | 25 | `InjectionToken<T>` with correct type |
| **Descriptive Name** | 20 | Name explains what it provides |
| **Interface Defined** | 25 | Token has matching interface |
| **Tree-Shakeable (if applicable)** | 15 | Uses factory for optional features |
| **Documented Contract** | 15 | Interface methods have clear purposes |

**Total: 100 points**

### Token Design Template

```typescript
// ✅ Well-designed token

/**
 * Provides logging capabilities.
 * Implementations must be synchronous and side-effect free for log/warn.
 */
interface ILogger {
  /** Log informational message */
  log(message: string): void;
  /** Log warning message */
  warn(message: string): void;
  /** Log error with optional stack trace */
  error(message: string, error?: Error): void;
}

export const ILoggerToken = new InjectionToken<ILogger>("ILogger");
```

---

## Rubric 5: Integration Test Strategy

Integration tests are preferred, but they must be strategic.

### What to Integration Test

| Should Test | Should NOT Test |
|-------------|-----------------|
| User-facing workflows end-to-end | Internal implementation details |
| Critical business logic paths | Every code branch |
| Error handling and edge cases | Happy path variations |
| Boundaries between layers | Pure utility functions |

### Integration Test Quality

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| **Tests Real User Scenarios** | 30 | Matches actual usage patterns |
| **Minimal Mocking** | 25 | Only mocks external boundaries |
| **Fast Execution** | 20 | Completes in seconds, not minutes |
| **Deterministic** | 15 | Same result every run |
| **Self-Contained** | 10 | Doesn't need external setup |

**Total: 100 points**

---

## The Meta-Rubric: Am I Being Honest?

After grading yourself, ask:

1. **Did I actually check each criterion?** Or just assume I passed?
2. **Would a senior engineer agree with my scores?** Be harder on yourself.
3. **Am I rationalizing failures?** "It's fine because..." is a red flag.
4. **Would I be confident if this code broke production?** That I did due diligence?

### The Ultimate Test

> "If this code had a bug in production, would I be comfortable showing this rubric to my team lead and saying 'I checked all of this'?"

If no, you know what to do.

---

## Using These Rubrics

### During Development

1. **Before writing**: Review relevant rubrics
2. **While writing**: Keep criteria in mind
3. **After writing**: Grade yourself honestly
4. **Before committing**: Verify passing grades

### During Code Review

1. Grade the code against rubrics
2. Note specific criterion failures
3. Request changes with rubric references
4. Re-grade after changes

### Continuous Improvement

Track your grades over time. If you consistently fail certain criteria:
- That's a skill gap to work on
- Consider pairing with someone strong in that area
- Study examples that score highly

---

## Quick Reference Card

Print this or keep it visible:

```
┌─────────────────────────────────────────────────┐
│ BEFORE COMMITTING ANY SERVICE, VERIFY:          │
├─────────────────────────────────────────────────┤
│ □ All deps in constructor                       │
│ □ Deps are abstractions (tokens/interfaces)     │
│ □ No `new ConcreteClass()` inside              │
│ □ No `container.get()` inside                  │
│ □ Can test with zero infrastructure            │
│ □ Does ONE thing (describable in one sentence) │
├─────────────────────────────────────────────────┤
│ IF ANY FAIL → REFACTOR FIRST                   │
└─────────────────────────────────────────────────┘
```
