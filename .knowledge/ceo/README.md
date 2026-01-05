# CEO Knowledge Cache

This directory contains auto-generated cache files used by the CEO command suite to provide fast, accurate translations between technical codebase and business language.

## Files

### `codebase-map.md`
**Purpose**: Compressed mental model of the codebase for non-technical CEO
**Updated**: Weekly or when project structure changes
**Used by**: `/ceo.velocity`, `/ceo.explain`, `/ceo.feasibility`

**Contains**:
- Business value statement
- Main components with analogies
- Architecture diagrams (ASCII)
- Communication patterns
- Velocity baseline metrics
- Active work status
- Technical debt hotspots

**Refresh Triggers**:
- File is >7 days old
- Major structural changes (new packages, architectural shifts)
- Manual refresh requested

### `jargon-dictionary.md`
**Purpose**: Technical term translations with project-specific context
**Updated**: After each `/ceo.translate` or `/ceo.explain` command
**Used by**: All CEO commands

**Contains**:
- Common technical terms → Plain English
- Business analogies for concepts
- Project-specific terminology
- Process and workflow terms
- Translation phrase table

**Update Strategy**:
- New terms encountered → added automatically
- Existing terms → analogies improved based on context
- Sorted alphabetically for quick lookup

## Update Philosophy

These files use **hybrid caching**:

✅ **Fast**: Pre-computed structure and baselines
✅ **Fresh**: Live queries for specific data
✅ **Accurate**: Auto-refresh on staleness

**Not** static documentation - they're living cache files that evolve with the codebase.

## Manual Edits

You can manually edit these files, but:
- Structural changes may be overwritten on auto-refresh
- Add custom sections with clear markers: `<!-- CUSTOM: ... -->`
- Custom content will be preserved during auto-updates

## Usage by CEO Commands

| Command | Reads | Writes | When |
|---------|-------|--------|------|
| `/ceo.velocity` | codebase-map.md | Updates velocity baseline | Each run |
| `/ceo.feasibility` | codebase-map.md | None | Each run |
| `/ceo.explain` | Both | Updates jargon dict | When new term |
| `/ceo.translate` | jargon-dictionary.md | Updates dict | Each new term |
| `/ceo.spec` | Both | None | Each run |
| `/ceo` (main) | Both | None | Routes to above |

## Regeneration

To force full regeneration:
```bash
# Delete cache files
rm .knowledge/ceo/codebase-map.md
rm .knowledge/ceo/jargon-dictionary.md

# Next CEO command will regenerate fresh
```

## .gitignore Consideration

**Current**: These files ARE tracked in git
**Rationale**: Provides CEO with instant context on fresh clone

**Alternative** (if desired):
```gitignore
# .gitignore
.knowledge/ceo/*.md
!.knowledge/ceo/README.md
```

This would make cache files local-only (regenerated per machine).

## Related Commands

- `/ceo` - Main smart router
- `/ceo.velocity` - Project velocity and progress
- `/ceo.feasibility` - Evaluate new ideas
- `/ceo.explain` - Explain code/concepts
- `/ceo.translate` - Translate technical jargon
- `/ceo.spec` - Convert ideas to specifications

See `.cursor/commands/ceo.*.md` for command documentation.
