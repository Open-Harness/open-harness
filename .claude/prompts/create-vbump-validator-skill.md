# Prompt: Create Version Bump Cross-Cutting Validator Skill

## Your Task
Create a Claude Code skill for comprehensive cross-cutting validation after major version bumps. This skill orchestrates multiple specialized review agents (fan-out) and synthesizes findings (fan-in) into an actionable report.

## Context
When a framework undergoes a major version bump (v0.2 → v0.3, v1.0 → v2.0), many things can break or become inconsistent:
- Old naming persists in forgotten corners
- Test fixtures become stale
- Documentation drifts from implementation
- Public APIs leak internals
- DX suffers from incomplete migration

This skill performs exhaustive validation across all dimensions.

## Skill Requirements

### 1. Skill Metadata
```yaml
name: vbump-validator
description: Cross-cutting validation for major version bumps
triggers:
  - "/vbump-validate"
  - "validate version bump"
  - "cross-cutting review"
```

### 2. Input Parameters
The skill should accept:
- `version`: The new version being validated (e.g., "v0.3.0")
- `rename_map`: Optional YAML/JSON mapping old→new terminology
- `focus_areas`: Optional list to narrow scope (default: all)

### 3. Review Dimensions (Fan-Out Agents)

Create 6 specialized review agents that run in parallel:

#### A. Code Quality Agent
- Review core implementation files
- Check for type correctness
- Verify error handling patterns
- Look for obvious bugs or logic errors
- Check for security anti-patterns
- **Output:** Code issues with file:line references

#### B. Semantics Consistency Agent
- Grep for old terminology violations
- Verify rename is complete across:
  - Source code
  - Documentation
  - Test files
  - Configuration
  - Comments
- Check signal/event name consistency
- **Output:** Violations with context and fix actions

#### C. Documentation Accuracy Agent
- Cross-reference docs against actual implementation
- Verify code examples compile/run
- Check for broken internal links
- Validate API references match exports
- **Output:** Stale docs with corrections needed

#### D. API Surface Agent
- Audit public package exports
- Detect internal leakage
- Find duplicate exports
- Verify type exports accompany implementations
- Check for legacy types that should be removed
- **Output:** Export analysis with recommendations

#### E. Testing Integrity Agent
- Verify test fixtures match current implementation
- Check signal/event names in test data
- Validate mock patterns are current
- Ensure tests actually test new behavior
- **Output:** Stale fixtures and test gaps

#### F. Developer Experience (DX) Agent
**This is critical and often overlooked.**

Evaluate from a new user's perspective:
- **Progressive Disclosure:** Does the "getting started" path show minimal API first?
- **Feature Discovery:** Are all framework capabilities demonstrated somewhere?
- **Example Coverage:** Do examples cover the 80% use cases?
- **Copy-Paste Ready:** Can users copy examples and they work?
- **Error Messages:** Are errors helpful or cryptic?
- **Mental Model:** Does the naming help or hinder understanding?
- **Consistency:** Do similar things work similarly?
- **Escape Hatches:** Can advanced users access lower-level APIs?

DX Checklist:
```markdown
## DX Validation Checklist
- [ ] Quickstart works in <5 minutes
- [ ] First example is <20 lines
- [ ] Each feature has at least one example
- [ ] Examples progress from simple → advanced
- [ ] Error messages include fix suggestions
- [ ] Type hints provide useful IntelliSense
- [ ] README shows real use case, not toy example
- [ ] API naming is consistent (all verbs, all nouns, etc.)
- [ ] No "magic" behavior without documentation
- [ ] Advanced features don't pollute basic API
```

**Output:** DX score with specific improvement recommendations

### 4. Synthesis (Fan-In)

After all agents complete, synthesize into:

```yaml
vbump_validation_report:
  version: "<version>"
  timestamp: "<ISO-8601>"

  overall_score: <0-100>
  verdict: PASS | NEEDS_WORK | BLOCK

  dimension_scores:
    code_quality: <score>
    semantics_consistency: <score>
    documentation_accuracy: <score>
    api_surface: <score>
    testing_integrity: <score>
    developer_experience: <score>

  critical_issues:
    - dimension: <which>
      issue: <description>
      location: <file:line or path>
      fix: <action required>

  warnings:
    - dimension: <which>
      issue: <description>
      recommendation: <suggested fix>

  notes:
    - dimension: <which>
      observation: <minor item>

  dx_highlights:
    strengths: []
    gaps: []
    quick_wins: []

  action_plan:
    p0_blockers: []
    p1_should_fix: []
    p2_nice_to_have: []
```

### 5. Scoring Rubric

| Score | Verdict | Meaning |
|-------|---------|---------|
| 90-100 | PASS | Ready for release |
| 70-89 | NEEDS_WORK | Fix issues before release |
| <70 | BLOCK | Major problems, do not release |

Each dimension weighted:
- Code Quality: 20%
- Semantics Consistency: 20%
- Documentation: 15%
- API Surface: 15%
- Testing: 15%
- DX: 15%

### 6. Skill File Structure

Create these files:
```
.claude/skills/vbump-validator/
├── SKILL.md              # Main skill definition
├── agents/
│   ├── code-quality.md
│   ├── semantics.md
│   ├── documentation.md
│   ├── api-surface.md
│   ├── testing.md
│   └── dx.md
└── templates/
    └── report.yaml       # Output template
```

### 7. Usage Examples

```bash
# Full validation
/vbump-validate v0.3.0

# With rename map
/vbump-validate v0.3.0 --rename-map specs/v030-semantics-map.md

# Focus on specific areas
/vbump-validate v0.3.0 --focus dx,semantics
```

## Constraints

1. **Parallel Execution:** All 6 agents MUST run in parallel (single message with multiple Task calls)
2. **Fresh Eyes:** Each agent starts with NO prior context - sees codebase fresh
3. **Evidence-Based:** Every issue must cite specific file:line or path
4. **Actionable:** Every issue must have a concrete fix recommendation
5. **No False Positives:** Migration docs mentioning old names for context are OK
6. **DX is First-Class:** Don't treat DX as afterthought - it's 15% of score

## Output

Generate the complete skill with all files. The skill should be immediately usable after creation.

## Success Criteria

The skill is successful if:
1. Running `/vbump-validate` produces comprehensive report
2. Report correctly identifies real issues (no major false positives)
3. Action plan is prioritized and actionable
4. DX section provides genuine user-perspective insights
5. Total runtime is <3 minutes for typical codebase
