---
description: Convert CEO's business ideas into developer specifications
handoffs:
  - label: Create Full Specification
    agent: speckit.specify
    prompt: Create a full specification from this CEO input
    send: true
---

## User Input

```text
$ARGUMENTS
```

Required: Business idea, feature request, or customer need in CEO's own words

## What This Does

Translates business language into a structured specification that developers can implement. Acts as a bridge between "I want X for customers" and "Here's what needs to be built."

## Execution

### 1. Parse CEO Input

Extract business context:
- **Business Goal**: What problem are we solving?
- **Target User**: Who benefits?
- **Success Metric**: How do we measure success?
- **Priority**: Why now?

### 2. Translate to Technical Scope

Map business language to technical requirements:

**CEO Says** → **Dev Needs**:
- "Make it faster" → Performance requirements (load time, response time)
- "Users are confused" → UX improvements (what specifically?)
- "Need this for partnership" → Integration requirements
- "Compliance requirement" → Security/audit features
- "Scale to more users" → Performance/infrastructure needs

### 3. Ask Clarifying Questions

**Don't assume** - validate understanding with CEO:

```markdown
## Understanding Your Idea

Based on your description, I understand:

**Problem**: [Restate the problem in plain English]
**Solution**: [What you think CEO wants]
**Users**: [Who this helps]
**Success**: [How we'll know it worked]

**Quick Questions** (choose relevant ones):

1. **Scope**: Should this handle [edge case A] or start simple?
2. **Users**: Is this for [user type X] only, or everyone?
3. **Priority**: Launch with [must-have features] or include [nice-to-have]?

[Ask max 3 questions that matter most]
```

### 4. Generate Specification Preview

Create simplified spec structure:

```markdown
# [Feature Name]

## What We're Building
[2-3 sentences in plain English]

## Who It's For
[User types and their needs]

## How It Works (User View)
1. User [does action A]
2. System [shows/does B]
3. User [achieves outcome C]

## Success Looks Like
- [Measurable outcome 1]
- [Measurable outcome 2]

## What's In Scope
✅ [Feature component 1]
✅ [Feature component 2]
✅ [Feature component 3]

## What's Out of Scope (For Now)
❌ [Feature component 4] - Maybe later
❌ [Feature component 5] - Too complex for v1

## Assumptions
- [Assumption 1 about users/context]
- [Assumption 2 about technical constraints]

## Open Questions for Dev Team
- [Technical decision 1]
- [Technical decision 2]
```

### 5. Validate with CEO

Present spec preview and ask:

```markdown
## Does This Capture Your Vision?

[Show specification preview]

---

**If this looks good**, I'll convert this into a full technical specification for the dev team using `/speckit.specify`.

**If adjustments needed**, let me know what to change:
- Scope too big/small?
- Missing important features?
- Wrong priority?
```

### 6. Convert to Dev Specification

Once CEO approves, hand off to `/speckit.specify`:

**Prepare handoff context**:
```markdown
CEO Input: [Original message]

Validated Specification Preview:
[Approved spec preview]

Business Context:
- Goal: [Business objective]
- Success Metric: [How CEO measures success]
- Priority: [Why this matters now]
- Target Users: [Who needs this]

Developer Notes:
- [Any technical constraints CEO mentioned]
- [Integration requirements]
- [Performance expectations]
```

### 7. Translation Quality Check

Before handoff, ensure spec avoids:

❌ **Vague terms**: "better", "faster", "easier" (without metrics)
❌ **Solution bias**: Specifying HOW instead of WHAT
❌ **Missing context**: Why this matters for users
❌ **Unbounded scope**: No clear out-of-scope items

✅ **Good spec has**:
- Measurable success criteria
- Clear user scenarios
- Explicit scope boundaries
- Business context preserved

### 8. Output Format

```markdown
# CEO Input → Developer Specification

## Original Request
> [Quote CEO's input]

## Translation Summary

**Business Problem**: [What we're solving]
**For Whom**: [Target users]
**Success Metric**: [How we measure it]

## Specification Preview

[Show the spec structure from step 4]

## Next Steps

✅ If this looks right, I'll create the full spec using `/speckit.specify`
✏️ If changes needed, tell me what to adjust

---

**What the Dev Team Will Get**:
- Complete functional requirements
- User scenarios and acceptance criteria
- Technical scope boundaries
- Success metrics for validation
```

## Key Rules

- **Preserve business context**: Don't lose the "why" during translation
- **Validate understanding**: Always confirm with CEO before generating full spec
- **No premature tech decisions**: Don't specify HOW to build (that's for devs)
- **Scope boundaries**: Always define what's OUT of scope
- **Measurable outcomes**: Convert vague goals to concrete metrics
- **User-centric**: Keep focus on user needs, not system internals

## Common Translation Patterns

| CEO Language | Specification Language |
|--------------|------------------------|
| "Make login easier" | "Reduce login steps from 4 to 2; enable social auth; success = 80% fewer support tickets" |
| "Need analytics" | "Dashboard showing [metrics X, Y, Z]; updated daily; success = CEO can answer [business questions]" |
| "Users complain about speed" | "Page load <2s; API response <500ms; success = bounce rate drops 20%" |
| "Compliance requirement" | "Audit trail for [actions]; data retention policy; success = passes [specific audit]" |
| "Scale for growth" | "Support [N concurrent users]; handle [M transactions/day]; success = no degradation at 2x load" |

## Handling Incomplete Ideas

If CEO input lacks key information:

```markdown
## Great Idea - Need a Bit More Context

I understand you want [restate idea], but to spec this properly, I need:

**Critical Questions**:
1. [Question about scope]
2. [Question about users]
3. [Question about priority]

**Why these matter**:
- [Question 1] determines [implementation choice]
- [Question 2] affects [user experience design]
- [Question 3] influences [what goes in v1]

[Provide default assumptions if CEO wants to move fast]
```

## Success Criteria Translation

CEO often states goals vaguely - translate to measurable criteria:

**CEO**: "Make it faster"
**Spec**:
- Page load: < 2 seconds (currently 5s)
- API response: < 500ms (currently 2s)
- Time to interactive: < 3 seconds (currently 8s)
- **Measured by**: Lighthouse scores, New Relic APM

**CEO**: "Improve user satisfaction"
**Spec**:
- Task completion rate: 90% (currently 65%)
- Support tickets: Reduce by 40%
- NPS score: Increase from 30 to 50
- **Measured by**: User surveys, support metrics, analytics

## Handoff to Technical Team

After CEO approval, invoke `/speckit.specify` with enriched context:

```bash
/speckit.specify

Feature: [Feature name from CEO]

Business Context:
[CEO's original request]

Validated Scope:
[Approved specification preview]

Success Criteria:
[Measurable outcomes]

This request comes from CEO - preserve business context throughout spec generation.
```

## Anti-Patterns to Avoid

❌ **Over-promising**: Don't commit to timelines (that's for devs to estimate)
❌ **Over-specifying**: Don't design the UI or architecture
❌ **Losing context**: Don't drop the business "why" during translation
❌ **Jargon injection**: Keep spec in business language, not tech language
❌ **Scope creep**: Clearly mark what's out of scope for v1
