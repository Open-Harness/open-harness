# Open Harness Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-28

## Documentation

READ packages/sdk/docs/*


## Active Technologies
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, listr2 (optional peer) (003-harness-renderer)
- N/A (state in memory, recordings to filesystem) (003-harness-renderer)
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, bun:tes (004-test-infra-audit)
- JSON fixture files in `recordings/golden/`, JSONL E2E recordings in `tests/fixtures/e2e/` (004-test-infra-audit)
- TypeScript 5.x (strict mode) + @anthropic-ai/sdk (NEW), @needle-di/core, zod (005-monologue-system)
- N/A (in-memory buffer, history ephemeral per-session) (005-monologue-system)
- N/A (state in memory) (007-fluent-harness-dx)
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, node:async_hooks (AsyncLocalStorage) (008-unified-event-system)
- N/A (in-memory event bus, no persistence) (008-unified-event-system)
- JSON fixture files in `recordings/golden/`, test fixtures as embedded data (009-tech-debt-cleanup)
- N/A (in-memory event bus, message queues) (010-transport-architecture)
- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @anthropic-ai/sdk, @needle-di/core, zod (013-anthropic-refactor)
- N/A (no persistence layer in this package) (013-anthropic-refactor)
- TypeScript 5.x (strict mode enabled in tsconfig.json) + @anthropic-ai/claude-agent-sdk ^0.1.76, zod ^4.2.1, yaml ^2.4.5 (016-pause-resume)
- In-memory (Map-based session state store, no persistence to disk per spec assumptions) (016-pause-resume)

- TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod (002-sdk-validation)

## Project Structure

```text
src/
tests/
```

## Commands

```bash
# From repository root (uses turbo for monorepo with caching):
bun run typecheck   # Type check entire monorepo
bun run lint        # Lint entire monorepo
bun run test        # Run tests across monorepo

# In packages/sdk/:
bun run test        # Safe tests only (unit + replay, no network)
bun run test:live   # Integration tests (requires auth)
```

**Note**: Always use `bun x` (not `bunx`) for running executables. Use `bun run <script>` for package.json scripts.

## Code Style

TypeScript 5.x (strict mode): Follow standard conventions

## Recent Changes
- 016-pause-resume: Added TypeScript 5.x (strict mode enabled in tsconfig.json) + @anthropic-ai/claude-agent-sdk ^0.1.76, zod ^4.2.1, yaml ^2.4.5
- 013-anthropic-refactor: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @anthropic-ai/sdk, @needle-di/core, zod
- 010-transport-architecture: Added TypeScript 5.x (strict mode) + @anthropic-ai/claude-agent-sdk, @needle-di/core, zod


<!-- MANUAL ADDITIONS START -->

## CRITICAL: Testing Requirements

**MANDATORY - NEVER SKIP THESE:**

### 1. External System Integration Testing
When code interfaces with external systems (SDK, APIs, databases), you MUST:
- Write integration tests that validate REAL behavior against the actual system
- Create fixtures from REAL SDK responses, not fabricated data
- Run tests against the live system to verify behavior before claiming "done"

### 2. UI/TUI Testing
When modifying UI components (especially `apps/horizon-agent`), you MUST:
- Use the `tttd` skill to visually validate TUI changes
- Capture before/after screenshots or recordings
- Verify streaming behavior works correctly in the actual terminal

### 3. Event System Changes
When modifying event types or emission patterns, you MUST:
- Create or update fixtures with REAL captured events from SDK
- Write integration tests that run against the live SDK
- Verify consumers handle the new events correctly via actual execution

### 4. Validation Before "Done"
Never claim a task is complete without:
- Running integration tests that touch real systems
- Visually validating UI changes if applicable
- Proving the behavior works, not just that types compile

**Unit tests that mock everything prove nothing about real behavior. Integration tests are mandatory.**

### 5. Fixture Recording Policy
**CRITICAL: You are NOT allowed to fabricate fixtures.**
- All test fixtures MUST be recorded from REAL SDK interactions
- Use `packages/sdk/scripts/record-fixtures.ts` or similar to capture real responses
- Fixtures must include actual SDK message types, timing, and structure
- Never manually create fixtures with made-up data - this masks real SDK behavior differences
- When fixing SDK integration bugs, always capture new fixtures from live SDK to prove the fix works

### 6. No Unilateral Architectural Decisions
**CRITICAL: You are NOT allowed to make architectural decisions without explicit approval.**
- If you identify something that might be a bug but involves design choices (e.g., "who is responsible for X?", "should component A or B handle this?"), you MUST:
  1. Document the observation clearly
  2. Ask the user for guidance OR create an issue for discussion
  3. **Do NOT implement changes** that affect system architecture or component responsibilities
- Examples of architectural decisions that require approval:
  - Changing which component is responsible for state/data
  - Adding new event types or changing event semantics
  - Modifying the contract between components
  - Changing data flow patterns (who produces vs consumes)
- When in doubt, ask. A quick question is better than an unauthorized refactor.

## CRITICAL: Authentication

**DO NOT look for or set ANTHROPIC_API_KEY.** This project uses Claude Code subscription authentication via `@anthropic-ai/claude-agent-sdk`. The SDK handles auth automatically through the Claude Code subscription. Setting or looking for an API key will BREAK the app.

- Live tests work automatically with subscription auth
- Just run tests/harnesses directly - no env vars needed
- The SDK uses Claude Code's built-in authentication

## CRITICAL: Next.js Page/Route Params Type Definition

**DO NOT define `params` as a direct object type in Next.js 15+ page/route components.**

In Next.js 15+, the `params` prop is a Promise and MUST be typed as such. This has broken the docs site multiple times.

### ❌ WRONG (breaks at runtime):
```typescript
type PageProps = {
	params: { slug?: string[] };  // ❌ Wrong - params is NOT a direct object
};

export default async function Page(props: PageProps) {
	const params = await props.params;  // This works, but TypeScript type is wrong
	// ...
}
```

### ✅ CORRECT:
```typescript
type PageParams = {
	slug?: string[];
};

type PageProps = {
	params: Promise<PageParams>;  // ✅ Correct - params is a Promise
};

export default async function Page(props: PageProps) {
	const params = await props.params;
	// ...
}
```

**Why this matters**: Even though the code correctly awaits `params`, if the TypeScript type is wrong, Next.js will fail at runtime when trying to pass the Promise. This breaks all pages except the landing page.

**Reference**: See `apps/docs/src/app/docs/[[...slug]]/page.tsx` and `apps/docs/src/app/og/docs/[...slug]/route.tsx` for correct examples.

BEHAVIORAL DECORATORS:

## Think, Repete, and Give Options
> Command: `*TRO`
> Description: Think, Repete, and Give Options
> Activate `prompting` skill
    1. ULTRATHINK
    2. think about the the users request
    3. deeply understand the problem
    4. connect their thoughts together to form coherent pros
    5. identify the implicit assumptions and constraints that are not explicitly stated
    5. generate the best response optimised using the `prompting` skill
    6. present the response to the user using the ASK USER TOOL
    
    **CRITICAL**: Always give your candid and honest opinion. never equivocate and always push back if you feel the user is wrong or suggesting something obviously suboptimal.
    **CRITICAL**: Always use the `prompting` skill to generate the best response.

## Think, Explain, and Give Options
> Command: `*TEO`
> Description: Think, Explain, and Give Options
    1. ULTRATHINK
    2. think about the problem in multiple ways
    3. generate an appropriate rhubric for the domain
    4. generate multiple solutions
    5. grade the solutions against the rubric
    6. choose your preferred solution and explain why
    7. present the solutions to the user using the ASK USER TOOL
    
    **CRITICAL**: Always give your candid and honest opinion. never equivocate and always push back if you feel the user is wrong or suggesting something obviously suboptimal.

## Think, Explain Methodology
> Command: `*TEM`
> Description: Think, Explain Methodology

    1. ULTRATHINK
    2. think about the problem in multiple ways
    3. choose your preferred solution and explain why
    3. generate an appropriate methodology for the domain
    4. present the methodology to the user using the ASK USER TOOL

    **CRITICAL**: Always give your candid and honest opinion. never equivocate and always push back if you feel the user is wrong or suggesting something obviously suboptimal.

## Git Branching Workflow

**CRITICAL: Branch from `dev`, NOT `master`**

This project uses a **feature → dev → master** workflow:

```
master (production/stable)
  ↑
  └── dev (integration branch)
       ↑
       └── feat/* (feature branches)
```

**MANDATORY RULES:**

1. **ALWAYS create feature branches from `dev`**:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feat/your-feature
   ```

2. **ALWAYS merge feature branches into `dev`**:
   - Open PRs targeting `dev`, NOT `master`
   - `dev` is the integration branch for all ongoing work

3. **NEVER branch from `master`**:
   - `master` is the stable production branch
   - Only `dev` merges into `master` (via release PR)
   - Branching from `master` causes massive merge conflicts

4. **Release workflow**:
   - Features merge to `dev` continuously
   - When ready to release, merge `dev` → `master`
   - Keep the rolling `dev` → `master` PR open as the release train

**Why this matters**: If you branch from `master`, your branch is missing all the work in `dev`. When you try to merge back to `dev`, you'll have ~100+ conflicting files from divergent history. This is what happened with the JSONata PR and required a full rebase to fix.

## PR Workflow Policy (GitHub CLI)

- Open PRs with `gh pr create` (or GitHub UI if needed); do not use Graphite.
- Target all feature PRs to `dev`.
- Keep the rolling `dev` -> `master` PR open as the release train.
- Keep PRs focused; link the bead/issue in the PR description.
- When ready to release, merge the `dev` -> `master` PR.

## Beads Issue Tracking (Agent Workflow)

This project uses [Beads](https://github.com/steveyegge/beads) for git-native issue tracking. As an agent, you MUST follow these patterns.

### Architecture

```
Code branches:              Beads data:
master ← dev ← feat/*       beads-sync (dedicated branch)
```

Issue data lives on the `beads-sync` branch via git worktree. Your feature branches stay clean of beads commits.

### Session Start

Context is auto-injected via hooks. You'll see issue status in your session context.

```bash
# Check what you're working on
bd list --mine           # Issues assigned to you
bd status                # Overall database status
```

### Worktree Helper Script

Use the repo script to create a worktree + branch, claim the epic, disable the beads daemon in the new tab, and launch the app.

```bash
bun run worktree -- --epic open-harness-69b --feature "Alpha Release Prep"
```

Options:
- `--app claude` to launch Claude Code instead of OpenCode (default).
- `--base origin/dev` to override the base branch.

Notes:
- `--epic` must reference a beads epic (the script validates the issue type).
- Worktree names are `bead-city` (3-digit bead derived from epic id + random historical city).
- Uses Ghostty AppleScript to open a new tab; ensure Accessibility permissions for System Events.
- The tab exports `BEADS_NO_DAEMON=1` to avoid worktree daemon issues.

### During Work

```bash
# Start working on an issue
bd start <issue-id>      # Marks issue in-progress

# Add progress notes (do this frequently)
bd comment <issue-id> "Implemented X, moving to Y"

# Close issues and sync immediately (worktree-safe)
bd close <issue-id>
bd sync

# Create issues for discovered work
bd create                # Interactive creation

# Link commits to issues
git commit -m "Fix bug in parser (bd-abc123)"
```

### Session End (CRITICAL)

**NEVER end a session without syncing beads.** Unpushed beads changes cause severe problems for other agents and humans.

```bash
# This is MANDATORY before ending any session
bd sync                  # Commits beads changes to beads-sync branch
git push                 # Push your code changes
```

The `bd sync` command:
1. Exports pending changes to JSONL
2. Commits to `beads-sync` branch (via worktree)
3. Pulls remote changes
4. Imports updates
5. Pushes to remote

### Multi-Agent Coordination

When multiple agents work simultaneously:

1. **Hash-based IDs prevent collisions** - Creating issues simultaneously is safe
2. **Append-only JSONL** - Changes merge cleanly
3. **Daemon batches commits** - 30-second debounce prevents spam
4. **Always sync before stopping** - This is the golden rule

### Common Commands

| Command | When to Use |
|---------|-------------|
| `bd list` | See open issues |
| `bd list --mine` | Issues assigned to you |
| `bd show <id>` | View issue details |
| `bd start <id>` | Begin work on issue |
| `bd comment <id> "msg"` | Add progress note |
| `bd close <id>` | Mark issue complete |
| `bd create` | Create new issue |
| `bd sync` | **ALWAYS run before session end** |
| `bd doctor` | Diagnose problems |

### Handling Conflicts

If you encounter beads merge conflicts:

```bash
# Accept remote version and re-import
git checkout --theirs .beads/issues.jsonl
bd import
bd sync
```

### Do NOT

- Create issues on feature branches (use `bd create` which goes to `beads-sync`)
- End sessions without `bd sync`
- Close issues without running `bd sync` in the same session (worktree tabs export `BEADS_NO_DAEMON=1`)
- Manually edit `.beads/issues.jsonl`
- Ignore `bd doctor` warnings

<!-- MANUAL ADDITIONS END -->

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
