---
description: Show project velocity and progress in plain English with visual charts
---

## User Input

```text
$ARGUMENTS
```

Optional: Specify timeframe (default: last 30 days). Examples: "last week", "this month", "Q1"

## What This Does

Translates git commits, feature specs, and task progress into a business-friendly velocity report with ASCII charts.

## Execution

### 1. Load Codebase Map Cache

Check for `.knowledge/ceo/codebase-map.md`:
- If missing or >7 days old → regenerate (see refresh logic below)
- If fresh → load baseline metrics

### 2. Gather Velocity Data

**Completed Features** (last 30 days or specified timeframe):
```bash
# Find completed features by checking specs/ready/*/tasks.md
find specs/ready -name "tasks.md" -exec grep -l "status: completed" {} \;
```

**In-Progress Features**:
```bash
# Check current branch and spec
git branch --show-current
# Find corresponding spec and calculate % done from tasks.md
```

**Recent Commits**:
```bash
# Get commit activity timeline
git log --since="30 days ago" --pretty=format:"%h %ad %s" --date=short --all
```

**Churn Analysis** (identify problem areas):
```bash
# Files changed most frequently (potential trouble spots)
git log --since="30 days ago" --pretty=format: --name-only --all | sort | uniq -c | sort -rn | head -10
```

### 3. Generate ASCII Visualizations

**Timeline Chart**:
```
Jan    Feb    Mar    Apr
████   ███░   ██░░   ░░░░
4 done 3 done 2 prog planned
```

**Velocity Bar Chart** (features/month):
```
Nov ████░  4
Dec ███░░  3
Jan ██░░░  2 (in progress)
```

**Health Indicators**:
```
✅ Test Coverage: Solid
✅ Build Stability: Green
⚠️  High Churn: src/di/container.ts (being perfected)
🔴 Blocked: None
```

### 4. Create Business Analogy

Based on completed vs. in-progress ratio:
- High completion: "Assembly line running smoothly"
- High WIP: "Multiple irons in fire - focus needed"
- High churn: "Perfecting recipes - temporary slowdown for long-term gains"

### 5. Output Format

```markdown
📊 PROJECT VELOCITY: [Timeframe]

## Completed
✅ Feature 1 (shipped [date])
✅ Feature 2 (shipped [date])

## In Progress
🔄 Feature 3 (37% done - [tasks completed]/[total tasks])
🔄 Feature 4 (12% done)

## Timeline
[ASCII timeline chart]

## Velocity Trend
[ASCII bar chart]

## Health Check
[Health indicators with icons]

## What This Means
[Business analogy explaining the current state]

## Risk Areas
[Files/features showing high churn or blockers]
```

## Refresh Logic for Codebase Map

If cache is stale or missing:

1. **Scan Project Structure**:
```bash
# Get high-level structure
tree -L 2 -I 'node_modules|.git' --dirsfirst
```

2. **Extract Main Components** from package.json, README.md, and directory structure

3. **Build Jargon Dictionary** from recent commits:
```bash
# Find technical terms from commit messages
git log --since="90 days ago" --pretty=format:"%s" | grep -oE '\b[A-Z][a-z]+[A-Z]\w+\b|\b(DI|API|SDK|CLI)\b' | sort -u
```

4. **Save to `.knowledge/ceo/codebase-map.md`** with timestamp

## Key Rules

- **Always visual**: Include at least one ASCII chart
- **No jargon**: If you use technical terms, translate them inline
- **Concrete numbers**: "3 features shipped" not "several features"
- **Analogies matter**: Use business/real-world comparisons
- **Highlight risks**: Call out high-churn areas proactively
