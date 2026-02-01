# Open Harness Documentation Site

## Goal

Create a public-facing documentation site using MkDocs Material theme at `apps/docs/`, integrated with the Turborepo monorepo via package.json scripts. Content will be fresh, inspired by existing internal docs but not linked to them.

## Context

- **Type**: New feature - documentation infrastructure
- **Monorepo**: Uses Turborepo with bun
- **Existing docs**: 35 markdown files in `docs/` (internal, uses old "Open Scaffold" naming)
- **Packages**: `@open-harness/core`, `@open-harness/server`, `@open-harness/client`, `@open-harness/testing`

## Requirements

1. MkDocs Material theme with modern features (search, dark mode, navigation tabs)
2. Package.json for monorepo integration (`bun run build`, `bun run dev`)
3. GitHub Actions workflow for automatic deployment to GitHub Pages
4. Priority content: Getting Started + Concepts first
5. Fresh content written for new users (not linked to old internal docs)

## Technical Approach

### Directory Structure
```
apps/docs/
├── package.json          # Monorepo integration
├── mkdocs.yml            # MkDocs configuration
├── requirements.txt      # Python dependencies (mkdocs-material)
├── docs/
│   ├── index.md          # Landing page
│   ├── getting-started.md
│   ├── concepts/
│   │   ├── index.md      # Overview
│   │   ├── events.md
│   │   ├── agents.md
│   │   ├── phases.md
│   │   └── workflows.md
│   ├── guides/
│   │   ├── building-workflows.md
│   │   └── react-integration.md
│   └── api/
│       └── reference.md
└── .github/
    └── workflows/
        └── docs.yml      # GitHub Pages deployment
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "mkdocs serve",
    "build": "mkdocs build",
    "deploy": "mkdocs gh-deploy"
  }
}
```

### Turbo Integration
Add to turbo.json:
```json
{
  "docs#build": {
    "outputs": ["site/**"]
  }
}
```

## Success Criteria

- [ ] `bun run dev` starts local docs server at localhost:8000
- [ ] `bun run build` generates static site in `site/` directory
- [ ] GitHub Actions deploys to GitHub Pages on push to master
- [ ] Getting Started guide enables new users to run first workflow
- [ ] Concepts page explains events, agents, phases, workflows
- [ ] All content uses `@open-harness/*` package names (not old `@open-scaffold/*`)
- [ ] Dark mode toggle works
- [ ] Search functionality works

## Files Involved

- `apps/docs/package.json` - new (monorepo integration)
- `apps/docs/mkdocs.yml` - new (MkDocs configuration)
- `apps/docs/requirements.txt` - new (Python dependencies)
- `apps/docs/docs/*.md` - new (all documentation content)
- `.github/workflows/docs.yml` - new (GitHub Pages deployment)
- `turbo.json` - modify (add docs task)

## Skill Activations

The following skills should be activated during content creation phases:

### Phase: Content Structure Design
**Activate: `/brainstorming`**
- Explore documentation architecture options
- Identify key user journeys
- Design information hierarchy

### Phase: Writing Core Pages
**Activate: `/doc-coauthoring`**
- Co-author Getting Started guide
- Co-author Concepts overview
- Ensure consistent voice and technical accuracy

## Dependencies

- Python 3.8+ (for MkDocs)
- mkdocs-material package
- GitHub repository with Pages enabled

## Notes

- Existing `docs/` folder is for internal reference only - do not link or migrate
- Package names changed from `@open-scaffold/*` to `@open-harness/*`
- Port 8000 is standard for MkDocs dev server (different from app's 42069)
