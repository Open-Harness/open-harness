# Handoff: Scout Agent Redesign

**From**: 004-test-infra-audit retrospective close session
**To**: Next agent session
**Priority**: P0

---

## Context

We just closed the 004-test-infra-audit retrospective cycle. Key decision:

**RC002 Decision**: Transform scout from "file lister" into "Context Curator"

Current scout at `.claude/agents/oharnes.implement-scout.md` outputs low-value file lists. We decided to make it output high-signal contextualized guidance.

---

## User's Additional Insight

The user wants the scout to be **even smarter** by leveraging historical context:

> "It shouldn't just make things up. The more context we give it, the better it's going to be at saying what's the patterns, what the anti-patterns are, what the things it should be avoiding."

> "Imagine we've done this, we're about to do this next monologue thing and it's failed a couple of times. But if the agent was looking back through Git, looking at the spec, then it will be able to make better decisions."

**Key idea**: Scout should do a **full spectrum analysis** using:
1. Previous retrospectives (look for patterns/anti-patterns)
2. Git history (what failed before, what worked)
3. Spec context (what's actually being built)
4. NOT just current file structure

---

## What Scout Should Become

### Current (Low Value)
```
Files to read:
- src/services/user.ts
- tests/unit/user.test.ts
```

### Target (High Value + Historical Context)
```markdown
## Context Manifest for T005

### Historical Patterns (from retrospectives)
- ⚠️ 003-harness-renderer RC001: Prototype code in context caused drift
- ⚠️ 004-test-infra-audit RC002: Categorization errors when scout doesn't analyze content
- ✓ Pattern: Always validate file contents match directory semantics

### Why These Files
- `src/services/user.ts:15-28`: UserService interface you MUST extend
- `tests/unit/user.test.ts:10-35`: Pattern for unit test structure

### Key Interfaces (copy-paste ready)
[Extracted code with line numbers]

### Patterns to Follow (from git history)
- DI pattern at user.ts:5 (used in 12 commits, never caused issues)
- Validation at user.ts:30 (added after bug fix in abc123)

### Anti-Patterns to Avoid (from retrospectives)
- Don't put API-calling tests in tests/unit/ (RC002 from 004)
- Don't skip behavioral verification (RC003 from 004)

### Categorization Check
- ⚠️ tests/unit/parser.test.ts imports createRecordingContainer - SHOULD BE integration
```

---

## Your Task

1. **Activate prompting skill** (`/prompting`) for context engineering principles
2. **Read current scout**: `.claude/agents/oharnes.implement-scout.md`
3. **Read retrospectives for patterns**:
   - `specs/003-harness-renderer/RETROSPECTIVE.md` (if exists)
   - `specs/004-test-infra-audit/RETROSPECTIVE.md`
   - `specs/004-test-infra-audit/next-cycle-inputs.md`
4. **Ultrathink**: How to make scout leverage historical context WITHOUT going crazy
5. **Generate 2-3 proposals** with rubric grading (Impact/Effort/Scope/Risk)
6. **Use AskUserQuestion** to get user decision
7. **Implement** the chosen approach

---

## Constraints (User's Words)

- "Let's not go crazy with it"
- "Be very targeted and specific"
- "Be high signal"
- Use the context window effectively but don't bloat

---

## Key Files

| File | Purpose |
|------|---------|
| `.claude/agents/oharnes.implement-scout.md` | Current scout to redesign |
| `specs/004-test-infra-audit/RETROSPECTIVE.md` | Patterns/anti-patterns source |
| `specs/004-test-infra-audit/next-cycle-inputs.md` | Decided implementation details |
| `specs/004-test-infra-audit/retro/synthesis.yaml` | Root causes and remediation |
| `.claude/CLAUDE.md` | Oharnes development guidelines |

---

## Rubric for Proposals

| Criterion | Weight | Question |
|-----------|--------|----------|
| Impact | 30% | Does this prevent pattern recurrence? |
| Effort | 25% | How much work to implement? |
| Scope | 25% | Local fix vs systemic improvement? |
| Risk | 20% | Could this slow down scout or add noise? |

---

## Success Criteria

- [ ] Scout outputs include historical pattern analysis
- [ ] Scout warns about known anti-patterns from retrospectives
- [ ] Scout stays fast (doesn't load entire git history)
- [ ] Output is high-signal, not bloated
- [ ] Implementer can work from scout output with confidence

---

**Start command**: Read this file, then `/prompting` to activate context engineering, then proceed with task.
