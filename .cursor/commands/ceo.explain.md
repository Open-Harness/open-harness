---
description: Explain code concepts with ASCII diagrams and plain English analogies
---

## User Input

```text
$ARGUMENTS
```

Required: What to explain (concept, file, feature, or "how does X work?")

## What This Does

Translates technical code/concepts into visual diagrams and business analogies that a non-technical CEO can understand.

## Execution

### 1. Parse Request Type

Detect what the CEO is asking about:
- **Concept**: "What's an event bus?" → Jargon translation
- **File/Component**: "Explain src/di/container.ts" → Code walkthrough
- **Feature**: "How does user auth work?" → Flow explanation
- **Architecture**: "Show me the system" → High-level overview

### 2. Gather Context

Based on request type:

**For Concepts**:
- Check `.knowledge/ceo/jargon-dictionary.md` (if exists)
- Search codebase for usage examples
```bash
grep -r "event bus" --include="*.ts" --include="*.md" src/ specs/ | head -5
```

**For Files/Components**:
- Read the file
- Identify key functions/classes
- Find related files (imports/exports)

**For Features**:
- Find spec in `specs/ready/*/spec.md`
- Find implementation in `src/`
- Trace data flow

**For Architecture**:
- Load codebase map
- Scan package.json for main components
- Check project README

### 3. Generate ASCII Diagram

**For Concepts** (show mental model):
```
Event Bus = Company Bulletin Board

[Component A] ───posts──→ [Bulletin Board] ←──reads─── [Component B]
                              │
                              └──reads─── [Component C]

Anyone can post, anyone can read, no direct connections needed.
```

**For Data Flow**:
```
Request → [Validator] → [Processor] → [Storage]
   ↓           ↓            ↓             ↓
 Check      Clean       Apply          Save
 Input      Data        Logic          State
```

**For Architecture**:
```
┌─────────────────────────────────────┐
│         User Interface (CLI)        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Command Layer (Routes)         │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌──────────┐    ┌──────────────┐
│ Business │    │   Agents     │
│  Logic   │    │  (Workers)   │
└────┬─────┘    └──────┬───────┘
     │                 │
     └────────┬────────┘
              ▼
      ┌──────────────┐
      │   Storage    │
      └──────────────┘
```

### 4. Create Business Analogy

Map technical concepts to real-world equivalents:

**Software Concepts**:
- Event Bus → Company bulletin board
- DI Container → Company toolbox that hands out tools
- Harness → Flight simulator for code
- Validator → Quality control inspector
- Cache → Office filing cabinet for quick access
- Pipeline → Assembly line
- Middleware → Security checkpoint
- API → Restaurant menu (request → response)

**Code Patterns**:
- Function → Recipe (ingredients → steps → result)
- Class → Blueprint for making things
- Interface → Contract everyone must follow
- Async/Promise → "I'll get back to you" promise
- Observer Pattern → Newsletter subscription

### 5. Explain in Layers

Use progressive disclosure:

**Layer 1 - One Sentence Summary**:
"[Concept] is like [analogy] - it [core purpose]."

**Layer 2 - How It Works** (3-5 steps):
1. [Step one in simple terms]
2. [Step two]
3. [Result]

**Layer 3 - Why It Matters**:
"This is important because [business value]."

**Layer 4 - Where We Use It**:
"In our codebase: [specific example with file:line reference]."

### 6. Add Visual Examples

If explaining code, show simplified version:

```typescript
// BEFORE (actual code)
const container = new Container()
container.register(UserService, UserServiceImpl)

// TRANSLATED
// "Register UserService in the toolbox"
// Like telling the company toolbox:
// "When someone asks for UserService, give them UserServiceImpl"
```

### 7. Output Format

```markdown
# [Concept/Feature Name]

## In One Sentence
[Concept] is like [analogy] - it [core purpose].

## The Diagram
[ASCII diagram showing structure/flow]

## How It Works
1. [Step one]
2. [Step two]
3. [Step three]

## Why This Matters
[Business value explanation]

## Real Example from Our Code
[Specific usage with file references]

## Related Concepts
• [Concept A]: [How it relates]
• [Concept B]: [How it relates]

## Common Confusion
❌ People think [misconception]
✅ Actually [truth]
```

### 8. Handle "Show Me the Code" Requests

If CEO wants to see actual code:

1. **Simplify first**: Remove types, boilerplate, error handling
2. **Add annotations**: Comment every 2-3 lines with plain English
3. **Highlight key parts**: Use visual markers
4. **Provide context**: Show where this fits in bigger picture

**Example**:
```typescript
// ============ USER CREATES ACCOUNT ============

function createUser(email: string) {
  // 1. Check if email already exists
  if (database.hasUser(email)) {
    return "Email taken"
  }

  // 2. Save new user to database
  database.save({ email, createdAt: now() })

  // 3. Send welcome email
  emailService.send(email, "Welcome!")

  return "Success"
}

// ============ END ============
```

## Key Rules

- **Always visual**: Minimum one ASCII diagram per explanation
- **Analogy first**: Start with real-world comparison
- **Layer information**: One sentence → diagram → details
- **No jargon**: If technical term is unavoidable, define it inline
- **Show, don't tell**: Use examples over abstract descriptions
- **Context awareness**: Reference actual files from the codebase
- **Business value**: Always answer "why should CEO care?"

## Fallback Strategies

**If concept is too complex**:
1. Break into sub-concepts
2. Explain the simplest one first
3. Offer: "Want me to explain [related concept] next?"

**If file is too large**:
1. Show high-level structure first
2. Ask: "Which part should I zoom into?"

**If request is ambiguous**:
1. List possible interpretations
2. Ask CEO to pick one

## Update Jargon Dictionary

After explaining a new concept:
1. Add entry to `.knowledge/ceo/jargon-dictionary.md`
2. Include: term, analogy, one-sentence definition
3. Keep it updated for future use
