# CEO Command Suite

**Purpose**: Translate technical codebase into business-friendly insights for non-technical CEO

## Commands Created

### Main Router
- **`/ceo`** - Smart command that auto-detects intent and routes to specialized commands

### Specialized Commands
- **`/ceo.velocity`** - Show project velocity and progress with ASCII charts
- **`/ceo.feasibility`** - Evaluate new ideas (triage + sketch + comparison)
- **`/ceo.explain`** - Explain code/concepts with diagrams and analogies
- **`/ceo.translate`** - Translate technical jargon to plain English
- **`/ceo.spec`** - Convert business ideas to developer specifications

## Quick Start

### Check Project Progress
```
/ceo what's our progress this month?
/ceo.velocity
```

**Output**: Timeline charts, completed features, velocity trends, health indicators

### Evaluate New Idea
```
/ceo can we add two-factor authentication?
/ceo.feasibility Add user dashboard for analytics
```

**Output**: Easy/Medium/Hard rating, implementation sketch, similar patterns, phased approach

### Understand Code
```
/ceo how does the event bus work?
/ceo.explain src/di/container.ts
```

**Output**: ASCII diagrams, business analogies, code walkthrough, related concepts

### Translate Jargon
```
/ceo translate "We're refactoring the DI container for better ergonomics"
/ceo what does "high code churn" mean?
```

**Output**: Plain English translation, visual comparisons, updated jargon dictionary

### Convert Idea to Spec
```
/ceo.spec Users need a way to export their data to CSV
/ceo users are complaining about slow load times
```

**Output**: Structured spec preview, validation questions, handoff to dev team

## Auto-Detection Examples

The main `/ceo` command automatically routes based on your question:

| You Say | Routes To | Why |
|---------|-----------|-----|
| "What's our progress?" | `/ceo.velocity` | Keywords: progress, status |
| "Can we add X?" | `/ceo.feasibility` | Keywords: can we, possible |
| "How does X work?" | `/ceo.explain` | Keywords: how, what is |
| "CTO said 'refactor'" | `/ceo.translate` | Contains jargon/quotes |
| "Users need X" | `/ceo.spec` | Business problem statement |

## Cache Files

Located in `.knowledge/ceo/`:

- **`codebase-map.md`** - Compressed mental model of codebase
  - Updated: Weekly or on structural changes
  - Contains: Architecture, components, velocity baseline

- **`jargon-dictionary.md`** - Technical term translations
  - Updated: After each translate/explain command
  - Contains: Terms → Plain English + analogies

- **`README.md`** - Cache documentation

## Key Features

### Always Visual
Every command includes ASCII diagrams:
- Timeline charts for velocity
- Architecture diagrams for explanations
- Flow diagrams for feasibility
- Before/after comparisons for translations

### Business Analogies
Technical concepts mapped to real-world equivalents:
- Event Bus = Company bulletin board
- DI Container = Company toolbox
- Harness = Flight simulator for code
- Cache = Office filing cabinet

### Smart Context Loading
**Hybrid caching**:
- Quick structure from cache (fast)
- Live queries for specifics (accurate)
- Auto-refresh when stale

### Self-Improving
- Jargon dictionary grows with each use
- Analogies improve based on context
- Codebase map stays current

## Example Sessions

### Session 1: Check Progress
```
CEO: /ceo what's our velocity?

📊 PROJECT VELOCITY: Last 30 Days

Completed:
✅ API Cleanup (shipped Dec 15)
✅ Error Handling (shipped Dec 22)

In Progress:
🔄 DI Architecture (37% done - 15/40 tasks)

Timeline:
Dec    Jan    Feb
███░   ██░░   ░░░░
3 done 2 prog planned

Health:
✅ Test Coverage: Solid
⚠️  High Churn: src/di/container.ts (being perfected)

What This Means:
"We're like a restaurant perfecting recipes - slight slowdown now
for long-term speed gains."
```

### Session 2: Evaluate Idea
```
CEO: /ceo can we auto-generate tests from user sessions?

🎯 FEASIBILITY: Auto-Generate Tests

Triage: Hard ⭐⭐⭐ (but doable in phases)

Similar To:
We already REPLAY sessions (harness architecture).
You want to AUTO-CONVERT them to tests.

Implementation Sketch:
User Session → [Capture] → Recording
                              │
                              ↓
                         [Analyzer] ← NEW
                              │
                              ↓
                         Test Generator ← NEW

Phased Approach:
Phase 1 (Easy ⭐): Manual "save as test" button
- Value: Instant test creation
- Effort: ~1 week

Phase 2 (Medium ⭐⭐): Suggested scenarios
- Value: Smart test recommendations
- Effort: ~2-3 weeks

Phase 3 (Hard ⭐⭐⭐): Full auto-generation
- Value: Complete automation
- Effort: ~4-6 weeks

Recommendation: Start with Phase 1 - 80% value, 20% complexity
```

### Session 3: Translate Jargon
```
CEO: /ceo translate "We need to refactor the event bus to reduce coupling"

# Translation

## Original Message
> "We need to refactor the event bus to reduce coupling"

## Plain English
We need to reorganize our announcement system (how different parts
of the software communicate) to make components more independent.

Think of it like this: Right now, different departments are too
interconnected - if one changes their process, others break. We
want to make them work more independently through the bulletin
board system, so changes in one area don't affect others.

## Key Terms Explained

**Refactor** = Reorganize for better quality
- Like cleaning up a messy filing system
- Same functionality, better structure

**Event Bus** = Company bulletin board
- Central announcement system
- Components post updates, others listen

**Coupling** = How tightly connected components are
- Low coupling = Independent (good)
- High coupling = Tangled dependencies (bad)

## Bottom Line
Making the system more modular so future changes are easier and safer.
```

## Customization

### Domain-Specific Analogies

Edit `.knowledge/ceo/jargon-dictionary.md` to customize analogies for your business domain:

```markdown
### Smart Contract
**Analogy**: Self-executing legal agreement (for DAO/Web3 domain)
**Definition**: Code that automatically enforces terms
**Why it matters**: Trustless automation of business logic
```

### Velocity Metrics

Commands adapt to your workflow:
- Reads from `specs/ready/*/tasks.md` for feature progress
- Analyzes git history for churn patterns
- Tracks completion rates over time

### Custom Cache Refresh

Force cache regeneration:
```bash
rm .knowledge/ceo/codebase-map.md
/ceo.velocity  # Will regenerate fresh
```

## Architecture

```
                    ┌─────────────┐
                    │    /ceo     │
                    │   (Router)  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ ceo.velocity│    │ceo.feasibility│  │ ceo.explain │
└──────┬──────┘    └──────┬───────┘    └──────┬──────┘
       │                  │                   │
       │         ┌────────┴────────┐          │
       │         ▼                 ▼          │
       │  ┌─────────────┐  ┌─────────────┐   │
       │  │ceo.translate│  │  ceo.spec   │   │
       │  └──────┬──────┘  └──────┬──────┘   │
       │         │                │           │
       └─────────┴────────────────┴───────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  Cache Layer     │
              │  .knowledge/ceo/ │
              │  - codebase-map  │
              │  - jargon-dict   │
              └──────────────────┘
```

## Integration with Existing Commands

**Handoff to Dev Workflow**:
```
/ceo.spec [business idea]
    ↓
  [Validates with CEO]
    ↓
  /speckit.specify
    ↓
  [Full dev specification created]
```

**Velocity Tracking Sources**:
- Git history (commits, branches)
- Specs system (`specs/ready/*/tasks.md`)
- Project structure
- Recent activity patterns

## Best Practices

### For CEO
1. **Use natural language** - Commands understand plain English
2. **Ask follow-ups** - Commands offer "want to know more?" options
3. **Reference cache** - `.knowledge/ceo/` files are readable Markdown

### For CTO
1. **Keep cache fresh** - Commands auto-update, but manual refresh available
2. **Customize analogies** - Edit jargon dictionary for domain-specific terms
3. **Review translations** - Check that jargon dictionary reflects your architecture

### For Both
1. **Iterate together** - Use `/ceo.feasibility` to evaluate ideas collaboratively
2. **Shared vocabulary** - Jargon dictionary becomes common language
3. **Visual thinking** - ASCII diagrams facilitate alignment

## Troubleshooting

### "Cache is stale"
Commands will auto-refresh if cache is >7 days old. For manual refresh:
```bash
rm .knowledge/ceo/codebase-map.md
```

### "Command didn't understand my question"
Use specific command instead of main router:
```
/ceo can we add X?  # Ambiguous
/ceo.feasibility Add feature X  # Explicit
```

### "Analogy doesn't fit our domain"
Edit `.knowledge/ceo/jargon-dictionary.md` directly:
```markdown
### Event Bus
**Analogy**: DAO proposal queue (if building DAO tooling)
**Analogy**: Patient notification system (if building healthcare)
```

## Files Created

```
.cursor/commands/
├── ceo.md                    # Main smart router
├── ceo.velocity.md           # Velocity tracking
├── ceo.feasibility.md        # Idea evaluation
├── ceo.explain.md            # Concept explanation
├── ceo.translate.md          # Jargon translation
├── ceo.spec.md               # Spec generation
└── README-CEO-COMMANDS.md    # This file

.knowledge/ceo/
├── README.md                 # Cache documentation
├── codebase-map.md           # Codebase mental model (auto-gen)
└── jargon-dictionary.md      # Term translations (auto-gen)
```

## Next Steps

1. **Test main router**: `/ceo what's our progress?`
2. **Customize analogies**: Edit `.knowledge/ceo/jargon-dictionary.md`
3. **Evaluate an idea**: `/ceo can we add [feature]?`
4. **Build shared vocabulary**: Use translate command on CTO messages

---

**Philosophy**: Every command should make the codebase feel less like alien technology and more like a familiar business operation with visual clarity and plain English communication.
