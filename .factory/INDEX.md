# 📑 Complete Planning Index

**Date:** 2026-01-07  
**Status:** Multiple Initiatives  

---

## 🎯 Active Initiatives

### 1. Provider Trait + Recording + Eval System (IN PROGRESS)
**Branch:** `feat/provider-trait-recording-eval`  
**Status:** Phase 1-2 Complete ✅, Phase 3 In Progress (core/provider done, tests pending)  
**Documents:**
- `docs/PROVIDER_CLEAN_BREAK_IMPLEMENTATION_PLAN.md` - **START HERE** for provider work
- `docs/PROVIDER_ARCHITECTURE.md` - Architectural decisions
- `docs/2026-01-07-eval-architecture-options-provider-workflow-level.md` - Eval design

**Progress:** Phase 1-2 complete; Phase 3 in progress (test updates + quality gates remaining)

---

### 2. Neverthrow 46-Bead Refactoring (PLANNING COMPLETE)
**Branch:** `feat/neverthrow-all-epics`  
**Status:** ✅ Planning Phase Complete, Ready for execution  
**Documents:** (see below for full details)

---

## 📚 Planning Documents (In Reading Order)

### 1️⃣ START HERE: SCRUM_MASTER_README.md
**Purpose:** Master overview of entire initiative  
**Length:** 5-10 min read  
**Contains:**
- What you're managing (5 epics, 46 beads, 6 weeks)
- How to use the planning documents
- Dependency rules (what blocks what)
- Quality gates (mandatory for every bead)
- Decision points (parallelization options)
- Your job as scrum master

**→ Read this first to understand the big picture**

---

### 2️⃣ EPIC_DEPENDENCY_MATRIX.md
**Purpose:** Detailed breakdown of all work  
**Length:** 15-20 min read  
**Contains:**
- Executive summary with visual hierarchy
- 5 epic breakdowns (dependencies, timeline, effort)
- All 46 beads with:
  - Dependencies (what must complete first)
  - Status (pending)
  - Effort estimate (hours)
  - Notes (what it includes)
- Parallelization strategies (A/B/C with analysis)
- Hard dependencies (cannot work around)
- Timeline summary table

**→ Use this for sprint planning and capacity allocation**

---

### 3️⃣ DEPENDENCY_GRAPH.txt
**Purpose:** Visual reference of execution flow  
**Length:** 10 min read  
**Contains:**
- ASCII art showing all beads in dependency tree
- "WAIT HERE" checkpoints (where epics merge)
- Critical path highlighted
- Quick reference matrix (bead → depends on → blocks → effort)
- Parallelization analysis
- Legend explaining symbols

**→ Show this to teams to explain why work is blocked**

---

### 4️⃣ BEAD_HANDOFF_TEMPLATE.md
**Purpose:** Template for creating individual bead issues  
**Length:** 20-30 min read  
**Contains:**
- 11-section template structure:
  1. Title & metadata
  2. One-line summary
  3. What is this?
  4. Why does this matter?
  5. What changed in dependencies?
  6. Acceptance criteria (✅ checkboxes)
  7. How to do it (step-by-step)
  8. How to validate (copy-paste commands)
  9. What unblocks next
  10. Troubleshooting
  11. Hand-off checklist
- Filled example (bd-tpl01.1 complete walkthrough)
- Quality gate requirements

**→ Copy this template when creating each bead issue in Beads**

---

## 🎯 What Each Document Is For

| Document | When to Use | Who Should Read |
|----------|-------------|-----------------|
| SCRUM_MASTER_README.md | Session start, decision-making | You (scrum master) |
| EPIC_DEPENDENCY_MATRIX.md | Sprint planning, capacity decisions | You, team leads, agents |
| DEPENDENCY_GRAPH.txt | Explaining blockers, showing flow | Team, agents asking "why blocked?" |
| BEAD_HANDOFF_TEMPLATE.md | Creating new beads, agent pickup | You (when creating beads), agents |

---

## 🚀 Execution Workflow

### Step 1: Prepare (You - Scrum Master)
1. ✅ Read SCRUM_MASTER_README.md
2. ✅ Review EPIC_DEPENDENCY_MATRIX.md
3. ✅ Choose parallelization strategy (A/B/C)
4. ✅ Confirm team size and assignments

### Step 2: Create Epic 1 (You - Scrum Master)
1. Open BEAD_HANDOFF_TEMPLATE.md
2. Create 12 bead issues in Beads (one per bead in Epic 1)
3. Fill in each bead with template sections:
   - Title & metadata
   - Summary
   - What/Why sections
   - Acceptance criteria
   - Step-by-step guide
   - Validation commands
   - Unblocks next
4. Assign agents

### Step 3: Execute (Agent)
1. Claim bead in Beads (mark in_progress)
2. Follow step-by-step guide in bead issue
3. Run validation commands (copy-paste from bead)
4. Check off all acceptance criteria
5. Commit and push
6. Close bead in Beads
7. Comment: "✅ Complete - unblocks: bd-XXXXX.N"

### Step 4: Verify (You - Scrum Master)
1. Confirm validation commands ran
2. Check no regressions (compare to master)
3. Verify beads synced
4. Mark epic progress

### Step 5: Next Epic (You - Scrum Master)
1. When current epic completes
2. Review DEPENDENCY_GRAPH.txt for unblocked work
3. Create new epic's beads
4. Assign agents
5. Repeat from Step 3

---

## 📊 Epic Timeline (Balanced Approach - Option C)

```
Week 1-2: Epic 1 (Transport) + Epic 2 (Persistence) [PARALLEL]
  12 + 8 beads
  40-60 hours + 30-40 hours
  Agent(s) can work on both if coordinated

Week 3-4: Epic 3 (Server Integration) [MUST wait for E1+E2]
  12 beads
  50-70 hours
  Depends on stable client + persistence

Week 5: Epic 4 (Framework Integration) [MUST wait for E3]
  8 beads
  35-45 hours
  Depends on stable server

Week 6: Epic 5 (Final Pass & Validation) [MUST wait for E4]
  6 beads
  25-35 hours
  Cross-cutting validation + docs
  Release ready ✅
```

**Total:** 46 beads, 180-250 hours, 6 weeks

---

## ⚙️ Quick Reference: Dependency Rules

### Critical (Cannot Work Around)
- Epic 2 blocks until Epic 1 bead 1.12 is complete
- Epic 3 blocks until Epic 1 AND Epic 2 are 100% complete
- Epic 4 blocks until Epic 3 is 100% complete
- Epic 5 blocks until Epic 4 is 100% complete

### Safe to Parallelize
- Epic 1 and Epic 2 can run side-by-side (weeks 1-2)
- Within same epic, beads are sequential (1.1 → 1.2 → 1.3 etc.)

### Quality Gates (All Beads)
```
☐ typecheck: 0 errors
☐ lint: 0 issues
☐ test: 100% passing, no regressions
☐ git: committed and pushed
☐ beads: issue closed and synced
```

---

## 🎓 How to Hand Off Work to Agents

### Copy-Paste Bead Template
When creating a new bead issue in Beads:
1. Open BEAD_HANDOFF_TEMPLATE.md
2. Copy the full template (11 sections)
3. Fill in the specific details for your bead
4. Paste into Beads issue
5. Assign agent

### Example: Creating bd-xxxxx.1 (Epic 1, Bead 1)
```
Use template from BEAD_HANDOFF_TEMPLATE.md
Change:
  - [bd-XXXXX.N] → [bd-xxxxx.1]
  - {Epic Name} → Transport Layer
  - {Task Name} → HTTP Client Error Handling
  - {Module} → @internal/client
  - Effort: 4h
  - Blocks: bd-xxxxx.2, bd-xxxxx.6
```

### Agent Picks Up Bead
1. Reads issue → understands what to build
2. Follows step-by-step guide → no questions
3. Runs validation commands → knows success criteria
4. Checks off acceptance criteria → clear when done
5. Closes issue → system knows it's complete

---

## 🔗 Files in This Planning Phase

```
.factory/
├── SCRUM_MASTER_README.md        ← Start here (big picture)
├── EPIC_DEPENDENCY_MATRIX.md     ← All 46 beads detailed
├── DEPENDENCY_GRAPH.txt          ← Visual flow
├── BEAD_HANDOFF_TEMPLATE.md      ← Copy for each bead
└── INDEX.md                      ← You are here
```

All files are ready to use. No additional planning needed.

---

## ✅ Validation Checklist (Before First Bead)

Confirm all of the following before creating Epic 1 beads:

- ⚠️ **Parallelization Strategy Chosen:** Option A (Sequential) / B (Aggressive) / C (Balanced)
- ⚠️ **Team Size Confirmed:** How many agents? (impacts timeline)
- ⚠️ **Agent Assignments Ready:** Who's taking which epic?
- ⚠️ **Timeline Locked:** When does this need to be done? (impacts daily pace)
- ⚠️ **Dependencies Understood:** Reread DEPENDENCY_GRAPH.txt, understand critical path
- ⚠️ **Quality Gates Committed:** Team agrees on typecheck/lint/test requirements
- ⚠️ **Sync Process Agreed:** How often do beads sync? (daily? per-epic?)

Once all are checked ✅, you're ready to create Epic 1 beads.

---

## 🎬 Next Action

**You are ready to generate Epic 1 (12 beads) with full handoff prompts.**

To do this:
1. Confirm parallelization strategy (recommend: Option C)
2. Confirm team size
3. Say "Generate Epic 1 beads"
4. I will create 12 fully-formed bead issues using BEAD_HANDOFF_TEMPLATE
5. Copy-paste them into Beads
6. Assign first agent
7. First agent starts with bd-xxxxx.1

---

## 📞 FAQ (Common Questions)

**Q: Can I start Epic 2 before Epic 1 finishes?**
A: YES (Option C) if you have 2+ agents. E2 can start while E1.5-1.12 are finishing. But E3 CANNOT start until both E1 and E2 are 100% complete.

**Q: What if an agent asks a question mid-bead?**
A: The bead handoff should be so clear they don't need to ask. If they do, it means the handoff template was incomplete - note it and improve next bead.

**Q: Can I parallelize beads within the same epic?**
A: NOT RECOMMENDED. Beads are sequential (1.1 → 1.2 → 1.3). Parallelizing within epic risks conflicts. Safer to parallelize entire epics (E1 + E2).

**Q: What if a bead takes 2x the estimated time?**
A: Stop and investigate. Acceptance criteria unclear? Missing context in handoff? Blocker on another bead? Fix it and document the lesson.

**Q: Do I need to review every bead's work?**
A: No. If acceptance criteria are checked and validation commands passed, it's done. Trust the process.

**Q: Can I have one agent do multiple beads in parallel?**
A: Yes, but only 2-3 max. Each bead is 2-8 hours. Beads are sequential within epic, so agent must finish 1.1 before starting 1.2.

---

## 🎯 Success Metrics (Week 6)

After 6 weeks, you'll have:
- ✅ 46 beads complete
- ✅ 5 epics delivered
- ✅ 500+ new tests
- ✅ 40+ comprehensive READMEs
- ✅ neverthrow across entire codebase
- ✅ All quality gates passing
- ✅ Zero regressions
- ✅ Ready for production release

---

**You are now ready to manage the entire 46-bead refactoring initiative.**

All planning is complete. All templates are ready. All dependencies are mapped.

When ready: Say "Generate Epic 1 beads" and execution begins.
