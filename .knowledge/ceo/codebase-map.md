# Codebase Map (For CEO)

**Last Updated**: Auto-generated on first `/ceo.velocity` or `/ceo.explain` run
**Refresh Frequency**: Weekly or when structure changes significantly

---

## What This Project Does

[One paragraph business value statement - generated from README and package.json]

## Main Components

**Component 1**: [Name] = [Business analogy]
- Purpose: [What it does for users/business]
- Location: [Directory path]

**Component 2**: [Name] = [Business analogy]
- Purpose: [What it does for users/business]
- Location: [Directory path]

## System Architecture

```
[ASCII diagram showing how components interact]

Example:
┌─────────────────────────────────────┐
│         User Interface              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Command Layer               │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌──────────┐    ┌──────────────┐
│ Business │    │   Workers    │
│  Logic   │    │   (Agents)   │
└────┬─────┘    └──────┬───────┘
     │                 │
     └────────┬────────┘
              ▼
      ┌──────────────┐
      │   Storage    │
      └──────────────┘
```

## How Components Talk

**Event Bus** = Company bulletin board
- Components post announcements
- Other components listen and react
- No direct connections needed

**DI Container** = Company toolbox
- Provides tools to workers automatically
- Workers don't need to know where tools come from

[Other communication patterns]

## Current Velocity Baseline

- **Features/Month**: ~X (calculated from git history)
- **Avg Completion Time**: X weeks (from specs/ready)
- **Focus Areas**: [From recent commits and active branches]
- **Last Major Release**: [Date and feature count]

## Active Work

**In Progress**:
- [Feature 1] - XX% done
- [Feature 2] - XX% done

**Recently Completed**:
- [Feature 3] - Shipped [date]
- [Feature 4] - Shipped [date]

## Technical Debt Hotspots

Areas being frequently modified (may indicate active improvement or instability):
1. [File/component 1] - [Why it's being touched]
2. [File/component 2] - [Why it's being touched]

## Jargon Quick Reference

See `.knowledge/ceo/jargon-dictionary.md` for full dictionary.

**Top 5 Terms**:
1. **[Term 1]** = [One-line translation]
2. **[Term 2]** = [One-line translation]
3. **[Term 3]** = [One-line translation]
4. **[Term 4]** = [One-line translation]
5. **[Term 5]** = [One-line translation]

---

**Note**: This file is auto-generated and updated by CEO commands. Manual edits will be preserved in custom sections.
