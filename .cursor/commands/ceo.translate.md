---
description: Translate technical jargon from CTO-speak into plain English
---

## User Input

```text
$ARGUMENTS
```

Required: Technical text or jargon to translate (can be a quote, message, or document)

## What This Does

Takes technical communication (like CTO messages, docs, or commit messages) and translates it into plain English with analogies.

## Execution

### 1. Load Jargon Dictionary

Check `.knowledge/ceo/jargon-dictionary.md`:
- Pre-loaded translations from codebase
- Project-specific terminology
- Previously translated concepts

### 2. Parse Input

Identify jargon types:

**Technical Terms**: API, SDK, CLI, DI, event bus, harness, etc.
**Code Concepts**: async, promises, middleware, dependency injection
**Process Terms**: refactoring, tech debt, code review, CI/CD
**Architecture Terms**: monorepo, package, module, service

### 3. Extract Jargon

```bash
# Find technical terms in input
echo "$ARGUMENTS" | grep -oE '\b[A-Z]{2,}\b|\b(async|refactor|pipeline|container)\b'
```

### 4. Translate Each Term

For each jargon term found:

1. **Check dictionary** for existing translation
2. **Search codebase** for context if not in dictionary
3. **Generate analogy** based on usage
4. **Add to dictionary** for future use

### 5. Provide Context-Aware Translation

**Don't just define terms** - translate the whole message:

**Before** (CTO-speak):
> "We're refactoring the DI container to use a fluent API pattern. This will reduce boilerplate and improve developer ergonomics. The harness architecture enables type-safe injection with zero runtime overhead."

**After** (CEO-speak):
> "We're reorganizing our code toolbox to make it easier to use. Think of it like switching from a messy drawer where you have to dig around, to a well-organized pegboard where tools are labeled and easy to grab. This saves developer time and reduces mistakes. The testing framework we built makes sure everything still works correctly while being faster."

### 6. Visual Comparison (if helpful)

For architectural concepts, show before/after:

```
BEFORE (Old Way):
Developer → [Manually connect A] → [Manually connect B] → [Manually connect C]
            ❌ Error-prone         ❌ Repetitive         ❌ Fragile

AFTER (New Way):
Developer → [Toolbox auto-provides A, B, C]
            ✅ Automatic           ✅ Fast               ✅ Reliable
```

### 7. Output Format

```markdown
# Translation

## Original Message
> [Quote the CTO message/text]

## Plain English
[Full translation in business language]

## Key Terms Explained

**[Term 1]** = [Analogy]
- [One-sentence definition]
- Why it matters: [Business value]

**[Term 2]** = [Analogy]
- [One-sentence definition]
- Why it matters: [Business value]

## Visual Explanation
[ASCII diagram if architectural concept]

## Bottom Line
[One-sentence summary of what this means for the business]
```

### 8. Jargon Dictionary Format

Maintain in `.knowledge/ceo/jargon-dictionary.md`:

```markdown
# Technical Jargon Dictionary

Last updated: [date]

## Terms

### API (Application Programming Interface)
**Analogy**: Restaurant menu
**Definition**: List of actions you can request from a system
**Why it matters**: Defines what our software can do for others

### DI Container (Dependency Injection Container)
**Analogy**: Company toolbox
**Definition**: System that provides components with the tools they need automatically
**Why it matters**: Reduces code complexity and speeds up development

### Event Bus
**Analogy**: Company bulletin board
**Definition**: Central place where system parts post announcements others can listen to
**Why it matters**: Allows features to work together without being tightly connected
```

### 9. Handle Documents/Long Text

If input is a document path:

1. **Read file**
2. **Extract key technical sections**
3. **Translate section by section**
4. **Provide summary** at top
5. **Offer**: "Want me to explain any section in more detail?"

### 10. Interactive Clarification

If unclear what needs translation:

```markdown
I found [N] technical terms in that message:

1. [Term 1]
2. [Term 2]
3. [Term 3]

Which ones need translation? (or say "all")
```

## Common Translation Patterns

| CTO Says | CEO Hears |
|----------|-----------|
| "Refactoring the codebase" | "Reorganizing code for better maintainability" |
| "High code churn" | "This area is being changed frequently (might be unstable)" |
| "Tech debt" | "Shortcuts we took that will slow us down later" |
| "CI/CD pipeline" | "Automated testing and deployment system" |
| "Breaking change" | "Update that requires other parts to change too" |
| "Type-safe" | "Catches mistakes before code runs" |
| "Zero runtime overhead" | "No performance cost" |
| "Developer ergonomics" | "How easy/pleasant it is for developers to use" |
| "Monorepo" | "One big shared codebase instead of many separate ones" |
| "Middleware" | "Code that runs between request and response" |

## Auto-Update Dictionary

After each translation:

1. **Extract new terms** not in dictionary
2. **Generate definitions** from context
3. **Append to `.knowledge/ceo/jargon-dictionary.md`**
4. **Sort alphabetically** for easy lookup

## Key Rules

- **Full message translation**: Don't just define terms, rewrite the whole message
- **Business value focus**: Always answer "why should I care?"
- **Analogies from CEO's world**: Use business/real-world comparisons
- **Maintain dictionary**: Every new term gets added
- **Be honest about complexity**: If something is genuinely complex, say so
- **Highlight what matters**: Bold the important business implications

## Special Cases

### CTO Using Excessive Jargon

If message is >50% jargon:
```markdown
⚠️ **High Jargon Alert**

This message is very technical. Here's the summary:

[One-paragraph plain English version]

---

**Full Translation**:
[Detailed translation with terms explained]
```

### Ambiguous Context

If term could mean multiple things:
```markdown
"Pipeline" could mean:
1. Data pipeline (how data flows through the system)
2. CI/CD pipeline (automated testing/deployment)
3. Processing pipeline (sequence of operations)

Which one is the CTO talking about? [Auto-detect from context if possible]
```

### No Jargon Found

If input is already plain English:
```markdown
✅ This message is already clear - no technical jargon detected!

[Optional: Provide business summary if message is long]
```
