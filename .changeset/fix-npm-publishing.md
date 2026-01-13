---
"@open-harness/core": patch
"@open-harness/server": patch
"@open-harness/client": patch
"@open-harness/react": patch
"@open-harness/stores": patch
"@open-harness/testing": patch
"@open-harness/vitest": patch
---

fix: resolve npm publishing issues

- Fixed workspace:* protocol leaking to published packages
- Fixed entry points pointing to TypeScript source instead of dist/
- Moved bundled internal dependencies to devDependencies
- Updated @open-harness/vitest to import from @open-harness/core
