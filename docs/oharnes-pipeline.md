# Oharnes Pipeline

The Oharnes Pipeline is an automated GitHub Actions workflow that orchestrates the complete specification-to-implementation-ready workflow. It automatically runs the planning, task generation, and analysis phases after a feature specification is created and pushed to a spec branch.

## Overview

When you create a new feature specification using `/oharnes.specify` and push the branch to GitHub, the pipeline automatically:

1. **Creates a draft PR** for the feature branch
2. **Runs `/oharnes.plan`** to generate implementation plan artifacts
3. **Runs `/oharnes.tasks`** to break down the plan into actionable tasks
4. **Runs `/oharnes.analyze`** to validate consistency and generate analysis report
5. **Updates the PR** with progress comments and final status

All generated artifacts are automatically committed and pushed back to the branch, making the PR ready for review and implementation.

## How It Works

### Trigger

The pipeline triggers automatically when:

- A branch matching the pattern `[0-9][0-9][0-9]-*` is pushed (e.g., `012-feature-name`)
- The branch contains a `specs/[branch-name]/spec.md` file

This pattern matches the standard spec branch naming convention used by `/oharnes.specify`.

### Workflow Steps

#### 1. Branch Validation

The pipeline first validates that:
- The branch name matches the spec branch pattern
- A `spec.md` file exists in `specs/[branch-name]/spec.md`

If validation fails, the pipeline exits early with an error.

#### 2. PR Management

- **Check for existing PR**: The pipeline checks if a PR already exists for the branch
- **Create draft PR**: If no PR exists, creates a new draft PR with:
  - Title: `Spec: [feature-name]`
  - Initial checklist in the description
  - Base branch: `main`
  - Head branch: the spec branch

#### 3. Artifact Existence Checks

Before each phase, the pipeline checks if artifacts already exist:
- `plan.md` → Skip plan generation if exists
- `tasks.md` → Skip task generation if exists
- `ANALYSIS.md` → Skip analysis if exists

This allows the pipeline to resume from where it left off if re-run, and prevents duplicate work.

#### 4. Plan Generation (`/oharnes.plan`)

**When**: Runs if `plan.md` doesn't exist

**What it does**:
- Generates `plan.md` with technical implementation plan
- Creates `research.md` with technical decisions
- Generates `data-model.md` with entity definitions
- Creates `contracts/` directory with API contracts
- Generates `quickstart.md` with test scenarios

**After completion**:
- Commits all artifacts with message: `docs(plan): generate plan artifacts for [feature-name]`
- Pushes commits to the branch
- Updates PR with progress comment

#### 5. Task Generation (`/oharnes.tasks`)

**When**: Runs if `tasks.md` doesn't exist (and plan completed or already exists)

**What it does**:
- Reads `plan.md` and `spec.md`
- Generates `tasks.md` with actionable, dependency-ordered tasks
- Organizes tasks by user story phases
- Creates parallel execution examples

**After completion**:
- Commits `tasks.md` with message: `docs(tasks): generate tasks.md for [feature-name]`
- Pushes commits to the branch
- Updates PR with progress comment

**Note**: In CI mode, user approval prompts are automatically skipped.

#### 6. Analysis (`/oharnes.analyze`)

**When**: Runs if `ANALYSIS.md` doesn't exist (and tasks completed or already exists)

**What it does**:
- Validates consistency between `spec.md`, `plan.md`, and `tasks.md`
- Checks for duplicates, ambiguities, coverage gaps, and constitutional violations
- Generates `ANALYSIS.md` with findings and overall score (0-100)
- Includes recommendations and blocking issues

**After completion**:
- Commits `ANALYSIS.md` regardless of score (for visibility)
- Pushes commits to the branch
- Updates PR with final status including:
  - Analysis score
  - Status emoji (✅ passed, ⚠️ warnings, ❌ failed)
  - Next steps guidance

**Note**: In CI mode, the pipeline does not handoff to implementation. It only generates the analysis report.

#### 7. Progress Updates

After each phase, the pipeline posts a comment to the PR with an updated checklist:

```markdown
## Pipeline Progress

- [x] Plan generation ✅
- [x] Task generation ✅
- [x] Analysis ✅ passed (score: 85/100)
- [x] Ready for implementation ✅
```

If artifacts already exist, they're marked with ⏭️ (already exists).

#### 8. Error Handling

If any phase fails:
- The pipeline posts an error comment to the PR
- Identifies which step failed
- Provides guidance on checking logs and retrying
- The PR remains in draft status for manual intervention

## Usage

### Starting the Pipeline

1. **Create a feature specification**:
   ```bash
   # In Claude Code or Cursor, run:
   /oharnes.specify "Add user authentication with OAuth2"
   ```

2. **Push the branch**:
   ```bash
   git push origin 012-user-auth
   ```

3. **Pipeline runs automatically**:
   - Creates draft PR
   - Runs plan → tasks → analyze
   - Updates PR with progress

### Re-running the Pipeline

If you need to regenerate artifacts:

1. **Delete the artifact files** you want to regenerate:
   ```bash
   git rm specs/012-user-auth/plan.md
   git commit -m "chore: regenerate plan"
   git push
   ```

2. **Or push any commit** to the branch to trigger a re-run:
   ```bash
   git commit --allow-empty -m "chore: trigger pipeline"
   git push
   ```

The pipeline will skip phases where artifacts already exist and only regenerate missing ones.

### Manual Intervention

If the pipeline fails:

1. **Check workflow logs**: Go to Actions → Oharnes Pipeline → View logs
2. **Fix issues**: Address any errors in the spec/plan/tasks
3. **Re-run**: Push a new commit or manually re-run the workflow

## Pipeline Output

### Generated Artifacts

After successful completion, the PR contains:

- **`spec.md`** - Feature specification (created by `/oharnes.specify`)
- **`plan.md`** - Technical implementation plan
- **`research.md`** - Technical decisions and rationale
- **`data-model.md`** - Entity definitions and relationships
- **`contracts/`** - API contract definitions
- **`quickstart.md`** - Test scenarios and examples
- **`tasks.md`** - Actionable task breakdown
- **`ANALYSIS.md`** - Pre-implementation analysis report

### PR Status

The PR will be:
- **Draft status** - Ready for review but not yet for implementation
- **Updated with progress** - Comments show each phase completion
- **Ready for implementation** - When analysis score >= 70

## Configuration

### Required Secrets

The pipeline requires:

- `CLAUDE_CODE_OAUTH_TOKEN` - OAuth token for Claude Code API (automatically configured)
- `GITHUB_TOKEN` - GitHub token for PR operations (automatically provided)

### Branch Pattern

The pipeline matches branches with pattern: `[0-9][0-9][0-9]-*`

To change this, edit `.github/workflows/oharnes-pipeline.yml`:

```yaml
on:
  push:
    branches:
      - '[0-9][0-9][0-9]-*'  # Change this pattern
```

### Base Branch

The pipeline creates PRs against `main` by default. To change:

```yaml
--base main  # Change to your default branch
```

## Integration with Oharnes Commands

The pipeline integrates seamlessly with the Oharnes command suite:

| Command | Pipeline Phase | Artifacts |
|---------|---------------|-----------|
| `/oharnes.specify` | Manual (before pipeline) | `spec.md` |
| `/oharnes.plan` | Automated | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| `/oharnes.tasks` | Automated | `tasks.md` |
| `/oharnes.analyze` | Automated | `ANALYSIS.md` |
| `/oharnes.implement` | Manual (after pipeline) | Implementation code |

## Best Practices

1. **Review before implementation**: Always review the generated artifacts before starting implementation
2. **Check analysis score**: Ensure analysis score >= 70 before proceeding
3. **Address critical issues**: Fix any critical issues identified in `ANALYSIS.md`
4. **Keep PR in draft**: Leave PR as draft until ready for implementation
5. **Use fresh conversations**: Start a new conversation for `/oharnes.implement` to avoid context bloat

## Troubleshooting

### Pipeline doesn't trigger

- **Check branch name**: Must match `[0-9][0-9][0-9]-*` pattern
- **Check spec.md exists**: Must be at `specs/[branch-name]/spec.md`
- **Check Actions tab**: Verify workflow is enabled in repository settings

### Artifacts not generated

- **Check workflow logs**: Look for errors in the specific phase
- **Check permissions**: Ensure `contents: write` and `pull-requests: write` permissions
- **Check git config**: Verify git user is configured correctly

### PR not created

- **Check branch exists**: Ensure branch was pushed successfully
- **Check permissions**: Verify `pull-requests: write` permission
- **Check for existing PR**: Pipeline reuses existing PRs

### Commits not pushed

- **Check git remote**: Verify remote URL is configured correctly
- **Check token**: Ensure `GITHUB_TOKEN` has write permissions
- **Check branch protection**: Ensure branch allows force push if needed

## Related Documentation

- [Oharnes Commands](../.claude/commands/) - Command reference
- [Specification Workflow](../specs/) - Specification structure
- [Project Overview](./project-overview.md) - Overall project architecture
