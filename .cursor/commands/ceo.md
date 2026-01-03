---
description: Universal CEO translator - explains code, checks velocity, evaluates ideas, translates jargon
---

## User Input

```text
$ARGUMENTS
```

Optional: Any question, idea, or text to analyze

## What This Does

Smart command that detects what the CEO needs and routes to the appropriate specialized command:
- `/ceo.velocity` - Project progress and velocity
- `/ceo.feasibility` - Evaluate new ideas
- `/ceo.explain` - Explain code/concepts
- `/ceo.translate` - Translate technical jargon
- `/ceo.spec` - Convert ideas to specifications

## Execution

### 1. Intent Detection

Analyze the input to determine intent:

**Velocity Indicators**:
- Keywords: "progress", "velocity", "status", "timeline", "what's done", "how fast"
- Patterns: "where are we", "what's completed", "show progress"
- **Route to**: `/ceo.velocity`

**Feasibility Indicators**:
- Keywords: "can we", "should we", "feasible", "possible", "add feature", "new idea"
- Patterns: "what if we", "I want to", "could we build"
- **Route to**: `/ceo.feasibility`

**Explanation Indicators**:
- Keywords: "how does", "what is", "explain", "show me", "understand"
- Patterns: "how works", "what's the architecture", "explain [file/concept]"
- **Route to**: `/ceo.explain`

**Translation Indicators**:
- Keywords: "translate", "what does", "CTO said", "jargon", "mean"
- Patterns: Quotes from technical messages, technical terms in input
- **Route to**: `/ceo.translate`

**Specification Indicators**:
- Keywords: "users need", "feature request", "build", "implement", "create spec"
- Patterns: Business problem descriptions, customer requests
- **Route to**: `/ceo.spec`

### 2. Intent Classification Logic

```typescript
function detectIntent(input: string): Command {
  // Check for velocity keywords
  if (input.match(/\b(progress|velocity|status|timeline|done|completed)\b/i)) {
    return "ceo.velocity"
  }

  // Check for feasibility questions
  if (input.match(/\b(can we|should we|feasible|possible)\b/i)) {
    return "ceo.feasibility"
  }

  // Check for explanation requests
  if (input.match(/\b(how does|what is|explain|show me)\b/i)) {
    return "ceo.explain"
  }

  // Check for translation requests (quoted text or jargon)
  if (input.includes('"') || input.match(/\b[A-Z]{2,}\b/)) {
    return "ceo.translate"
  }

  // Check for specification requests (business language)
  if (input.match(/\b(users? need|customers? want|feature request|business)\b/i)) {
    return "ceo.spec"
  }

  // Default to explain if unclear
  return "ceo.explain"
}
```

### 3. Route to Specialized Command

Once intent is detected:

```markdown
## Detected Intent: [Command Name]

Routing your request to `/[command]` which specializes in [what it does].

---

[Execute the specialized command with original input]
```

### 4. Handle Ambiguous Input

If multiple intents detected or unclear:

```markdown
## I can help with that in a few ways:

Your message could be asking about:

1. **Project Velocity** - Show progress and timeline
2. **Feasibility** - Evaluate if this idea is doable
3. **Explanation** - Explain how [concept] works
4. **Translation** - Translate technical terms to plain English
5. **Specification** - Convert this to a dev spec

Which would be most helpful? (or say "all" for comprehensive answer)
```

### 5. Multi-Intent Handling

If CEO asks for multiple things:

```markdown
## Comprehensive Answer

Your question touches on multiple areas. I'll address each:

### 1. [First aspect] - [Intent type]
[Answer using appropriate command]

### 2. [Second aspect] - [Intent type]
[Answer using appropriate command]

---

Want me to go deeper on any of these?
```

### 6. Empty Input (Just `/ceo`)

Provide helpful menu:

```markdown
# CEO Command Suite

I'm your technical translator. I can:

## 📊 Check Velocity
`/ceo.velocity` or `/ceo what's our progress?`
- Show completed features
- Timeline visualization
- Health indicators

## 🎯 Evaluate Ideas
`/ceo.feasibility [your idea]` or `/ceo can we add X?`
- Triage complexity (Easy/Medium/Hard)
- Implementation sketch
- Compare to existing patterns

## 💡 Explain Concepts
`/ceo.explain [concept]` or `/ceo how does X work?`
- ASCII diagrams
- Business analogies
- Code walkthroughs

## 🔄 Translate Jargon
`/ceo.translate [technical text]` or `/ceo what does "DI" mean?`
- Plain English translations
- Visual comparisons
- Jargon dictionary

## 📝 Create Specifications
`/ceo.spec [business idea]` or `/ceo users need X`
- Convert ideas to dev specs
- Validate scope
- Hand off to dev team

---

**Quick Examples**:
- `/ceo what's our progress this month?`
- `/ceo can we add two-factor authentication?`
- `/ceo explain the event bus architecture`
- `/ceo translate "we're refactoring the DI container"`
- `/ceo users need a dashboard to track metrics`
```

## Key Rules

- **Auto-detect intent**: CEO shouldn't need to choose the right command
- **Fallback gracefully**: If unclear, ask for clarification
- **Multi-intent support**: Handle requests that span multiple categories
- **Always visual**: Include ASCII diagrams regardless of route
- **Maintain context**: Pass full original input to specialized commands
- **Update cache**: Ensure codebase map and jargon dictionary stay fresh

## Intent Priority Order

When multiple intents match, prioritize:
1. **Specification** - If it's a feature request, route to spec first
2. **Feasibility** - If it's a "can we" question
3. **Velocity** - If asking about status/progress
4. **Translation** - If contains quoted text or excessive jargon
5. **Explanation** - Default for everything else

## Examples

**Input**: "What's our progress this quarter?"
**Intent**: Velocity
**Route**: `/ceo.velocity "last quarter"`

**Input**: "Can we add two-factor authentication for our users?"
**Intent**: Feasibility + Spec (feasibility first, then offer to spec if viable)
**Route**: `/ceo.feasibility "two-factor authentication"`

**Input**: "The CTO said we need to refactor the event bus architecture. What does that mean?"
**Intent**: Translation
**Route**: `/ceo.translate "refactor the event bus architecture"`

**Input**: "How does our dependency injection system work?"
**Intent**: Explanation
**Route**: `/ceo.explain "dependency injection system"`

**Input**: "Users are complaining about slow load times. We need to fix this."
**Intent**: Spec (business problem → specification)
**Route**: `/ceo.spec "users complaining about slow load times"`

**Input**: "Show me the architecture"
**Intent**: Explanation (high-level overview)
**Route**: `/ceo.explain "system architecture"`
