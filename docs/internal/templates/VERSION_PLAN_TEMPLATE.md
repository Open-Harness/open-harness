# v{X.Y.Z} Version Plan

**Status:** {Planning | In Progress | Release Candidate | Shipped}
**Branch:** `{branch-name}`
**Target Date:** {YYYY-MM-DD or "TBD"}
**Created:** {YYYY-MM-DD}
**Last Updated:** {YYYY-MM-DD}

---

## Vision & User Narrative

**What is v{X.Y.Z} to users?**

{2-3 paragraphs explaining the value proposition of this version. What problem does it solve? Why should users upgrade? What's the "headline feature"?}

**One-sentence pitch:** "{Complete this sentence in under 15 words}"

---

## Scope

### In Scope (Release Blockers)

| Area | Description | Status |
|------|-------------|--------|
| **{Feature 1}** | {Brief description} | {Not started | In Progress | Done} |
| **{Feature 2}** | {Brief description} | {Status} |
| **Documentation** | {What docs must exist} | {Status} |
| **Release Announcement** | Draft of "What's New" | {Status} |

### Out of Scope (Future Versions)

| Area | Reason |
|------|--------|
| **{Feature X}** | {Why it's not in this version} |
| **{Feature Y}** | {Why it's deferred} |

### Scope Lock Policy

Once this VERSION_PLAN.md is approved:
- Scope is **locked**
- New ideas go to "{Next Version} Preview" section
- Scope changes require explicit approval + changelog entry

---

## What's Done

{List completed work that this version builds on. Reference prior version work if applicable.}

### {Prior Work Area 1}
- ✅ {Completed item}
- ✅ {Completed item}

### {Prior Work Area 2}
- ✅ {Completed item}

---

## What's Pending

### Critical Path 1: {Name}

**Reference:** {Link to detailed planning doc if exists}

**Files to Create/Modify:**
```
{file paths}
```

**Acceptance Criteria:**
- [ ] {Specific, measurable criterion}
- [ ] {Specific, measurable criterion}
- [ ] {Tests passing criterion}

### Critical Path 2: {Name}

{Same structure as above}

### Critical Path 3: Documentation

**Required Sections:**
- [ ] {Doc section 1}
- [ ] {Doc section 2}

**Verification:**
- [ ] All docs compile without errors
- [ ] All code examples verified working
- [ ] No stale API references

### Critical Path 4: Release Announcement

**Content Required:**
- [ ] "What's New" summary
- [ ] Breaking changes (if any)
- [ ] Upgrade path
- [ ] Links to docs

---

## Critical Path Dependency Graph

```
{ASCII diagram showing what depends on what}

Example:
           ┌─────────────┐
           │   Release   │
           └─────────────┘
                  ▲
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
   ┌────────┐ ┌────────┐ ┌────────┐
   │Feature1│ │  Docs  │ │Announce│
   └────────┘ └────────┘ └────────┘
```

**Sequencing:**
1. {What can run in parallel}
2. {What must be sequential}
3. {Final steps}

---

## Release Criteria

**v{X.Y.Z} ships when ALL of these are true:**

### Code
- [ ] {Feature acceptance criteria met}
- [ ] All tests green: `bun run test`
- [ ] Types clean: `bun run typecheck`
- [ ] Lint clean: `bun run lint`

### Documentation
- [ ] {Required doc sections complete}
- [ ] All code examples verified working

### Quality
- [ ] {Quality gate 1}
- [ ] {Quality gate 2}

### Release
- [ ] Release announcement draft complete
- [ ] CHANGELOG updated
- [ ] Version bumped
- [ ] PR from dev → master ready

---

## {Next Version} Preview

**Purpose:** Capture ideas for the next version so they don't get lost.

### Likely In Scope
- **{Idea 1}** — {Brief description}
- **{Idea 2}** — {Brief description}

### Under Consideration
- **{Idea 3}** — {Brief description}

---

## Retrospective

{Fill this in as the version progresses and at completion}

### What Worked
1. {Learning 1}
2. {Learning 2}

### What Didn't Work
1. {Issue 1}
2. {Issue 2}

### Process Improvements for {Next Version}
1. {Improvement 1}
2. {Improvement 2}

---

## How to Use This Document

**If you have 10 minutes:** Read "Vision & User Narrative" + "Scope" + "Critical Path Dependency Graph"

**If you have 30 minutes:** Add "What's Pending" sections for your work area

**If you have 2 hours:** Read full document + referenced planning docs

**To track progress:** Update checkbox items in "What's Pending" and "Release Criteria"

**When blocked:** Check dependency graph. Is prerequisite work done?

---

## References

| Document | Purpose |
|----------|---------|
| {Link} | {Purpose} |

---

## Changelog

| Date | Change |
|------|--------|
| {Date} | {What changed} |

---

# VERSION_PLAN.md Usage Guide

## When to Create

Create VERSION_PLAN.md **BEFORE** starting any implementation work for a new version.

## Process

1. **Draft Vision** — What is this version to users? One-sentence pitch.
2. **Define Scope** — What's in, what's out. Be explicit.
3. **Identify Critical Paths** — What work must happen? What blocks what?
4. **Set Release Criteria** — How do we know we're done?
5. **Capture Next Version Ideas** — Park ideas that don't fit this scope.
6. **Get Approval** — Review with stakeholders before locking scope.
7. **Track Progress** — Update checkboxes as work completes.
8. **Retrospect** — Fill in learnings as you go and at completion.

## Anti-Patterns

- ❌ Starting implementation before VERSION_PLAN.md exists
- ❌ Vague scope ("make it better")
- ❌ No release criteria ("we'll know when it's done")
- ❌ Scope creep without explicit approval
- ❌ Skipping retrospective ("we'll remember")

## Good Patterns

- ✅ Vision-first planning
- ✅ Explicit in/out scope
- ✅ Measurable acceptance criteria
- ✅ Dependency graph for sequencing
- ✅ Regular progress updates
- ✅ Capturing learnings in real-time
