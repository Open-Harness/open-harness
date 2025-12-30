# Validation Handoff: Testing Infrastructure Documentation

**Date**: 2025-12-28  
**Scope**: Complete validation of testing infrastructure documentation for kernel-v2  
**Context**: Documentation was created to establish testing protocol before implementation. Must be rock solid.

## Validation Objective

Perform **multi-spectrum validation** across multiple dimensions to ensure the testing infrastructure documentation is:
- Complete (nothing missing)
- Consistent (naming, format, structure)
- Accurate (references valid, content correct)
- Actionable (clear enough to guide implementation)
- Robust (addresses previous audit findings)

## Files to Validate

### Documentation (5 files)
- `docs/testing/README.md`
- `docs/testing/testing-protocol.md`
- `docs/testing/test-spec-template.md`
- `docs/testing/validation.md`
- `docs/testing/workflow.md`

### Test Specs (6 files)
- `tests/specs/events.test-spec.md`
- `tests/specs/hub.test-spec.md`
- `tests/specs/harness.test-spec.md`
- `tests/specs/agent.test-spec.md`
- `tests/specs/channel.test-spec.md`
- `tests/specs/flow.test-spec.md`

### Updated Files
- `docs/README.md` (added Testing section)

## Validation Dimensions

### Dimension 1: Structural Completeness

**Check**:
- [ ] All 5 documentation files exist in `docs/testing/`
- [ ] All 6 test spec files exist in `tests/specs/`
- [ ] Main README updated with Testing section
- [ ] All files are valid Markdown (no syntax errors)
- [ ] Directory structure matches plan

**Commands**:
```bash
find spikes/kernel-v2/docs/testing -name "*.md" | wc -l  # Should be 5
find spikes/kernel-v2/tests/specs -name "*.md" | wc -l   # Should be 6
grep -q "Testing" spikes/kernel-v2/docs/README.md        # Should find Testing section
```

### Dimension 2: Template Compliance

**Check**:
- [ ] All 6 test specs follow the template structure from `test-spec-template.md`
- [ ] Each spec has: Component header, Overview, Test Requirements (R1, R2, ...), Live Test section, Coverage Checklist
- [ ] Each requirement (R[N]) has: Fixture path, Test file, Test name, Scenario, Assertions, Fixture Recording command
- [ ] Coverage checklists are present and accurate

**Validation**:
- Read `docs/testing/test-spec-template.md` to understand required structure
- For each spec in `tests/specs/*.test-spec.md`:
  - Verify all required sections exist
  - Verify R[N] format matches template
  - Verify coverage checklist lists all requirements

### Dimension 3: Cross-Reference Validation

**Check**:
- [ ] All internal links work (relative paths correct)
- [ ] All fixture paths follow pattern: `fixtures/golden/<component>/<fixture-name>.jsonl`
- [ ] All test file paths follow pattern: `tests/replay/<component>.<feature>.test.ts`
- [ ] All live test script paths follow pattern: `scripts/live/<component>-live.ts`
- [ ] Component names are consistent (hub, harness, agent, channel, events, flow)

**Commands**:
```bash
# Check fixture paths
grep -h "Fixture.*fixtures/golden" spikes/kernel-v2/tests/specs/*.md | sort -u

# Check test file paths
grep -h "Test File.*tests/replay" spikes/kernel-v2/tests/specs/*.md | sort -u

# Check live test paths
grep -h "Script.*scripts/live" spikes/kernel-v2/tests/specs/*.md | sort -u
```

### Dimension 4: Content Accuracy

**Check**:
- [ ] Component paths in specs match actual protocol files:
  - `events.test-spec.md` → `src/protocol/events.ts`
  - `hub.test-spec.md` → `src/protocol/hub.ts`
  - `harness.test-spec.md` → `src/protocol/harness.ts`
  - `agent.test-spec.md` → `src/protocol/agent.ts`
  - `channel.test-spec.md` → `src/protocol/channel.ts`
  - `flow.test-spec.md` → `src/protocol/flow.ts`
- [ ] Test requirements accurately describe protocol interface contracts
- [ ] Scenarios are realistic and testable
- [ ] Assertions are specific and verifiable

**Validation**:
- Read each protocol file in `src/protocol/`
- Compare interface definitions with test spec requirements
- Verify requirements test the right aspects of each interface

### Dimension 5: Naming Consistency

**Check**:
- [ ] Component names are consistent across all files:
  - Use: `hub`, `harness`, `agent`, `channel`, `events`, `flow`
  - NOT: `Hub`, `HUB`, `hub-impl`, etc.
- [ ] Fixture names use kebab-case: `subscribe-basic`, `scoped-context`, etc.
- [ ] Test file names follow pattern: `<component>.<feature>.test.ts`
- [ ] Live test script names follow pattern: `<component>-live.ts`

**Commands**:
```bash
# Check component name consistency
grep -h "Component.*src/protocol" spikes/kernel-v2/tests/specs/*.md

# Check fixture naming
grep -h "Fixture.*fixtures/golden" spikes/kernel-v2/tests/specs/*.md | grep -oE "[a-z-]+\.jsonl"
```

### Dimension 6: Coverage Completeness

**Check**:
- [ ] All 6 protocol types have test specs
- [ ] Each spec has multiple requirements (R1, R2, ...)
- [ ] Requirements cover all major interface aspects:
  - Events: envelope, context, types, filtering
  - Hub: subscription, emission, scoping, commands, iteration, status
  - Harness: factory, attachment, session, lifecycle, phase/task, inbox
  - Agent: definition, context, inbox, lifecycle, wrapper, runId
  - Channel: definition, attachment, subscription, state, commands, lifecycle
  - Flow: FlowSpec, NodeSpec, WhenExpr, bindings, edges, policy, FlowYaml
- [ ] Each spec has live test section
- [ ] Each spec has coverage checklist

**Count Requirements**:
```bash
# Count requirements per spec
for file in spikes/kernel-v2/tests/specs/*.md; do
  echo "$(basename $file): $(grep -c '^### R[0-9]' $file) requirements"
done
```

### Dimension 7: Validation Guide Effectiveness

**Check**:
- [ ] Validation guide addresses previous audit findings:
  - Static validation only (Mistake 1) - addressed?
  - Accidental recording (Mistake 2) - addressed?
  - Missing behavioral verification (Mistake 3) - addressed?
  - Incomplete coverage (Mistake 4) - addressed?
  - Live test missing (Mistake 5) - addressed?
- [ ] Multi-layer validation strategy is clear (static → behavioral → completeness)
- [ ] Per-component checklist is actionable
- [ ] Behavioral verification steps are specific

**Reference**: Previous audit findings from `specs/004-test-infra-audit/RETROSPECTIVE.md`

### Dimension 8: Workflow Completeness

**Check**:
- [ ] Workflow guide covers all steps: spec → fixture → test → TDD → live
- [ ] Each step has clear instructions
- [ ] Each step has validation criteria
- [ ] Examples are provided
- [ ] Fixture recording workflow is explicit
- [ ] Live test workflow is clear

**Validation**:
- Read `docs/testing/workflow.md`
- Verify each step in the workflow is documented
- Verify examples are realistic and complete

### Dimension 9: Documentation Quality

**Check**:
- [ ] Testing protocol doc is clear and complete
- [ ] Test spec template is unambiguous
- [ ] Validation guide is actionable
- [ ] Workflow guide is step-by-step
- [ ] All docs use consistent terminology
- [ ] All docs link correctly to each other

**Readability Checks**:
- [ ] No broken internal links
- [ ] Code blocks are properly formatted
- [ ] Examples are clear and complete
- [ ] Terminology matches canonical naming from main README

### Dimension 10: Protocol Alignment

**Check**:
- [ ] Testing protocol aligns with kernel/flow protocol docs
- [ ] Test categories (unit/replay/live) make sense for protocol types
- [ ] Fixture format is appropriate for protocol testing
- [ ] Recording protocol prevents accidental overwrites
- [ ] Validation requirements match protocol complexity

**Validation**:
- Read `docs/spec/*.md` and `docs/flow/*.md` to understand protocols
- Verify testing approach matches protocol characteristics
- Verify fixture format can capture protocol interactions

## Validation Checklist Summary

### Must Pass (Critical)
- [ ] All files exist (11 files total)
- [ ] All test specs follow template
- [ ] All cross-references are valid
- [ ] Component paths match actual files
- [ ] All 6 protocol types have specs
- [ ] Validation guide addresses previous audit findings

### Should Pass (High Priority)
- [ ] Naming is consistent throughout
- [ ] Coverage is complete (all major aspects tested)
- [ ] Workflow is complete (all steps documented)
- [ ] Documentation quality is high (clear, actionable)
- [ ] Protocol alignment is correct

### Nice to Have (Medium Priority)
- [ ] Examples are comprehensive
- [ ] Links are all working
- [ ] Code blocks are properly formatted
- [ ] Terminology is perfectly consistent

## Validation Output Format

For each dimension, provide:
1. **Status**: Pass / Fail / Partial
2. **Findings**: List of issues found (if any)
3. **Severity**: Critical / High / Medium / Low
4. **Recommendations**: How to fix (if needed)

## Success Criteria

**Validation passes if**:
- All "Must Pass" items are ✅
- At least 8/10 dimensions pass
- No critical issues found
- All critical issues are fixable

**Validation fails if**:
- Any "Must Pass" item fails
- More than 2 dimensions fail
- Critical issues found that require major rework

## Context for Validator

**Previous Issues** (from audit):
- Static validation only (missed behavioral issues)
- Accidental fixture recording
- Missing behavioral verification gates
- Incomplete test coverage
- Missing live tests

**Key Requirements**:
- Spec-driven testing (specs define requirements)
- Explicit recording (never accidental)
- Multi-layer validation (static + behavioral + completeness)
- Interface contracts (testing protocol types, not implementations yet)

**Canonical Naming**:
- Components: `hub`, `harness`, `agent`, `channel`, `events`, `flow`
- Test types: `unit`, `replay`, `live`
- Fixtures: `fixtures/golden/`, `fixtures/scratch/`

## Deliverables

After validation, provide:
1. **Validation Report**: Summary of all 10 dimensions
2. **Issue List**: All findings with severity and recommendations
3. **Fix Priority**: Which issues must be fixed before proceeding
4. **Confidence Level**: How confident you are that docs are "rock solid"

---

**Start validation by reading**:
1. `docs/testing/README.md` (overview)
2. `docs/testing/testing-protocol.md` (the protocol)
3. `docs/testing/test-spec-template.md` (the template)
4. One test spec (e.g., `tests/specs/hub.test-spec.md`) to understand format
5. `docs/testing/validation.md` (validation strategy)
6. `docs/testing/workflow.md` (workflow guide)

Then validate across all 10 dimensions systematically.
