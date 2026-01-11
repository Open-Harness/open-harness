# s🎯 Scrum Master: 46-Bead Refactoring Initiative

**Status:** Planning Complete ✅  
**Date:** 2026-01-07  
**Total Work:** 5 Epics, 46 Beads, 180-250 hours  
**Timeline:** 6 weeks with parallelization  
**Mode:** Ready for Agent Hand-Offs

---

## 📋 What You're Looking At

This is the **complete planning documentation** for extending the neverthrow error handling pattern across the entire open-harness codebase.

**Completed Foundation:**

- ✅ open-harness-9mq: 14 beads (runtime reorganization + error layer + documentation)
- ✅ Pattern established: Error types → Result-based API → Documentation → Tests → Validation
- ✅ Template defined: Every bead follows exact structure

**Your Job:**

- Organize remaining work (46 beads across 5 epics)
- Ensure clear dependencies and blocking relationships
- Write hand-off prompts so agents can work independently
- Track progress and unblock teams

---

## 📚 Planning Documents (In Order)

### 1. **EPIC_DEPENDENCY_MATRIX.md** (Start Here!)

**What:** Complete breakdown of all 46 beads  
**Contains:**

- All 5 epics with 12, 8, 12, 8, 6 beads respectively
- Effort estimates per bead (2-8 hours)
- Dependency relationships (what blocks what)
- Parallelization opportunities (E1+E2 can run together)
- Detailed breakdown table

**Use This When:**

- Planning sprint capacity
- Assigning beads to agents
- Understanding critical path
- Checking if work is blocked

**Key Insight:** Epics 1 + 2 can run in parallel (saves 1-2 weeks)

---

### 2. **DEPENDENCY_GRAPH.txt** (Visual Reference)

**What:** ASCII art showing execution flow  
**Contains:**

- Visual dependency tree for all beads
- Critical path highlighted
- "WAIT HERE" checkpoints where epics must merge
- Quick reference matrix (bead → dependencies → blocks → effort)
- Legend and parallelization analysis

**Use This When:**

- Understanding "why can't I start Epic 3 yet?"
- Showing team members the overall structure
- Identifying parallelization opportunities
- Explaining why a bead is blocked

**Key Insight:** Critical path: open-harness-9mq → E1 → E3 → E4 → E5 (strict order)

---

### 3. **BEAD_HANDOFF_TEMPLATE.md** (Copy-Paste for Every Bead)

**What:** Template that every bead issue will follow  
**Contains:**

- 11 sections (title, summary, what, why, dependencies, criteria, implementation, validation, unblocks, troubleshooting, checklist)
- Filled example showing bd-tpl01.1
- All acceptance criteria explicit and measurable
- Step-by-step implementation guide
- Copy-paste validation commands

**Use This When:**

- Creating bead issues in Beads
- Agents picking up work and asking "what do I do?"
- Validating that beads are complete
- Handing off to next agent

**Key Insight:** Every bead is self-contained; agents don't need to ask questions

---

## 🚀 How to Use This As Scrum Master

### Phase 1: Approval & Planning (Current)

1. ✅ Review EPIC_DEPENDENCY_MATRIX.md
2. ✅ Review DEPENDENCY_GRAPH.txt
3. ✅ Confirm parallelization strategy (A/B/C):
  - **A (Sequential):** Pure sequential, safer, 6 weeks
  - **B (Aggressive Parallel):** E1+E2 together, riskier, 6 weeks end-to-end
  - **C (Balanced - Recommended):** Start E1 first, E2 parallel, then wait for both ← **RECOMMENDED**

### Phase 2: Create Epic 1 Beads (Next)

1. Use BEAD_HANDOFF_TEMPLATE.md to create 12 bead issues
2. Each issue includes: acceptance criteria, step-by-step guide, validation commands
3. Assign agents (1 agent = ~2-3 beads in parallel, controlled)

### Phase 3: Execute & Track

1. Agents claim beads (mark in_progress in Beads)
2. Agents complete work (follow handoff template)
3. Mark beads completed when all acceptance criteria met
4. Sync beads when moving to new epic
5. Verify no regressions at each epic boundary

### Phase 4: Unblock Next Epic

1. When current epic's final bead closes
2. Review DEPENDENCY_GRAPH.txt to identify unblocked beads
3. Create next epic's beads
4. Repeat cycle

---

## 🔗 Dependency Rules (Critical!)

### Hard Blocks (Cannot Work Around)

```
Epic 2 MUST wait for: Epic 1 final commit (E1.12)
Epic 3 MUST wait for: Epic 1 complete (E1.12) AND Epic 2 complete (E2.8)
Epic 4 MUST wait for: Epic 3 complete (E3.12)
Epic 5 MUST wait for: Epics 1-4 all complete
```

### Safe Parallelization

```
✅ E1 and E2 can run simultaneously (no shared files, both depend only on core)
⚠️  Can't start overlapping beads within same epic (1.1 → 1.2 → 1.3 etc. is sequential)
```

### Dependency Visualization

```
open-harness-9mq ✅
    ├─ E1 (weeks 1-2) ─────────┐
    └─ E2 (weeks 1-2) ────────┬┘  [Can run together]
                               │
                          E1+E2 must complete
                               │
                               ▼
                         E3 (weeks 3-4)
                               │
                         E3 must complete
                               │
                               ▼
                         E4 (week 5)
                               │
                         E4 must complete
                               │
                               ▼
                         E5 (week 6) ✅ COMPLETE
```

---

## 📊 Effort & Timeline

### By Epic


| Epic            | Beads | Hours | Timeline  | Blocks    |
| --------------- | ----- | ----- | --------- | --------- |
| E1: Transport   | 12    | 40-60 | Weeks 1-2 | E3        |
| E2: Persistence | 8     | 30-40 | Weeks 1-2 | E3        |
| E3: Server      | 12    | 50-70 | Weeks 3-4 | E4        |
| E4: Framework   | 8     | 35-45 | Week 5    | E5        |
| E5: Final       | 6     | 25-35 | Week 6    | ✅ Release |


**Total:** 46 beads, 180-250 hours, 6 weeks

### Team Allocation

- **1 agent:** 180-250 hours (full-time 6 weeks)
- **2 agents:** 90-125 hours each (can parallelize E1+E2 fully)
- **4 agents:** 45-65 hours each (minimal waiting, maximum parallelization)

---

## ✅ Quality Gates (Non-Negotiable)

Every bead must meet these before closing:

```
☐ typecheck: 100% passing, 0 errors
☐ lint: 0 issues (auto-fix if needed)
☐ test: 100% passing, no regressions
☐ git: all changes committed and pushed
☐ beads: issue closed and synced to remote
```

---

## 🔍 How Agents Will Work

### For Bead Pickup:

1. Agent sees bead issue in Beads
2. Issue has everything in BEAD_HANDOFF_TEMPLATE format
3. Agent runs commands in "HOW TO VALIDATE" section
4. Agent checks boxes in "ACCEPTANCE CRITERIA" section
5. No guessing, no "wait let me ask the scrum master"

### For Completion:

1. All acceptance criteria checked ✅
2. All validation commands passed
3. Comment in issue: "✅ Complete - unblocks: bd-XXXXX.N"
4. Close issue in Beads
5. Move to next bead

### For Blockers:

1. Agent can't proceed → Check DEPENDENCY_GRAPH.txt
2. See what's blocking this bead → Check that bead's status
3. If blocked by another bead → Contact that agent or scrum master
4. If blocked by missing context → Check BEAD_HANDOFF_TEMPLATE

---

## 🎯 Decision Points for You

### 1. Parallelization Strategy

Choose one (impacts timeline):

- **Option A (Sequential):** Epic 1 → 2 → 3 → 4 → 5 in order
  - ✅ Safer, no coordination needed
  - ❌ Slower (6 weeks minimum)
  - **Recommendation:** For small teams or first-time
- **Option B (Aggressive Parallel):** E1+E2 simultaneously, then E3 → E4 → E5
  - ✅ Faster (6 weeks end-to-end, but E1+E2 overlap)
  - ❌ Requires coordination, more risk
  - **Recommendation:** For experienced teams with 2+ agents
- **Option C (Balanced - RECOMMENDED):** E1 first, E2 parallel after E1.5, then E3 → E4 → E5
  - ✅ Good balance of speed (6 weeks) and safety
  - ✅ Can start E2 while E1.5-1.12 finish
  - ✅ E3 doesn't start until both truly done
  - **Recommendation:** Default choice

### 2. Agent Assignment

Decide per epic:

- **1 agent per epic:** Clear ownership, slower
- **2 agents per epic:** Can do parallel beads with caution
- **Rotating agents:** Each takes 1-2 beads (good for learning)

### 3. Frequency of Syncs

- **Daily:** Full team sync on blockers
- **Per-epic:** Sync when completing major deliverable
- **Async:** Use Beads comments for updates

---

## 📅 Recommended Timeline (Option C)

```
Week 1:
  Mon-Tue: Create Epic 1 beads (12 beads)
  Wed-Thu: Agent starts E1.1-1.5
  Fri: Create Epic 2 beads (8 beads), Agent starts E2.1

Week 2:
  Mon-Wed: E1 continues (1.6-1.12), E2 continues (2.1-2.8)
  Thu: E1.12 complete, push to remote
  Fri: E2.8 complete, both epics done ✅

Week 3:
  Mon: Create Epic 3 beads (12 beads)
  Tue-Fri: Agent works through E3 (3.1-3.12)

Week 4:
  Mon-Thu: E3 continues
  Fri: E3.12 complete ✅

Week 5:
  Mon: Create Epic 4 beads (8 beads)
  Tue-Fri: Agent works through E4 (4.1-4.8)

Week 6:
  Mon: Create Epic 5 beads (6 beads)
  Tue-Thu: Agent works through E5 (5.1-5.6)
  Fri: E5.6 complete, full validation, push ✅

Week 7: Buffer week for regression testing + final review
```

---

## 🚨 Red Flags (Stop & Investigate)

- **Bead takes 2x estimated time** → Is acceptance criteria unclear? Is there a blocker?
- **Typecheck fails on unrelated code** → Another agent may have pushed breaking changes
- **Test failure in a previous bead** → Regression detected, address immediately
- **"I don't know what to do"** → Hand-off template incomplete for that bead
- **Agent can't push** → Git rebase issue, help them resolve

---

## 📞 Your Job As Scrum Master

### Daily:

- Check Beads status
- Verify validation commands were run
- Unblock agents if stuck

### Per-Epic:

- Create beads with full hand-off template
- Assign agents
- Sync at completion

### At Epic Boundaries:

- Verify no regressions
- Create next epic's beads
- Review unblocked work

### At Release:

- Final validation across all 5 epics
- Confirm error handling pattern is consistent
- Sign off on documentation quality

---

## ✨ Success Looks Like

After 6 weeks:

- ✅ All 46 beads complete
- ✅ 5 epics fully delivered
- ✅ neverthrow error handling across entire codebase
- ✅ 500+ new tests covering error paths
- ✅ 40+ comprehensive READMEs documenting each layer
- ✅ Zero regressions from base
- ✅ All quality gates passing (typecheck, lint, test)
- ✅ Ready for production release

---

## 📖 Next Steps

1. **Review** EPIC_DEPENDENCY_MATRIX.md
2. **Choose** parallelization strategy (Option A/B/C)
3. **Confirm** team size and assignment
4. **Generate** Epic 1 detailed specs (12 beads, full BEAD_HANDOFF_TEMPLATE)
5. **Assign** first agent
6. **Execute** → sync → repeat

**Ready to create Epic 1 beads?** Say yes and I'll generate all 12 with full handoff prompts.