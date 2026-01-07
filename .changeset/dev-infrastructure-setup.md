---
"@open-harness/core": patch
---

Initial developer infrastructure setup including git hooks, CI/CD, and package configuration.

- Add lefthook for pre-commit (lint-staged, beads) and pre-push (lint, typecheck, test) hooks
- Configure package.json exports and TypeScript build process
- Set up GitHub Actions CI workflow for quality checks
- Add lint-staged for fast incremental linting
- Exclude .beads/issues.jsonl from git hooks to prevent sync conflicts
