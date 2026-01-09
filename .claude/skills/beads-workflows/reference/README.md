# Beads Workflows: Technical Reference Library

This directory contains detailed, evidence-backed research reports on all Beads advanced features.

## Research Methodology

All reports were generated through systematic investigation by specialized research agents:
- 6 parallel agents each investigated one advanced feature
- Evidence gathered from official docs, source code, blog posts, and community resources
- All claims backed by direct source citations
- Documentation gaps explicitly identified

## Available References

### Core Features

| File | Feature | Status | Key Insights |
|------|---------|--------|--------------|
| `wisps.md` | Ephemeral Workflows | ✅ Well-documented | Lifecycle, GC, patrol patterns |
| `bonds.md` | Connecting Work Graphs | ✅ Well-documented | Bonding matrix, traversal, dynamic bonding |
| `formulas.md` | Reusable Templates | ⚠️ Recently added | TOML format, sparse examples |
| `variables.md` | Parameterization | ⚠️ Gaps exist | CLI usage clear, interpolation syntax unclear |
| `distills.md` | Formula Extraction | ⚠️ Poorly documented | Command exists, no user examples |
| `steps.md` | Workflow Stages | ✅ Documented | Conceptual, not a distinct type |

### Legend
- ✅ = Comprehensive documentation available
- ⚠️ = Documented but with significant gaps
- ❌ = Minimal or no documentation

## Quick Navigation

**Building workflows?** Start with:
1. Read `../SKILL.md` for quick reference
2. Read `../CLAUDE.md` for workflow design principles
3. Dive into specific features as needed

**Need technical details?** Each reference file contains:
- Complete command syntax with all flags
- Real-world examples with sources
- Common pitfalls and solutions
- Direct links to authoritative sources

## Documentation Quality

### Well-Documented Features
- **Wisps**: Complete lifecycle, examples, patterns
- **Bonds**: Bonding matrix, traversal mechanics, dynamic patterns
- **Steps**: Dependencies (`needs`, `waits_for`), execution model

### Features with Gaps
- **Variables**: CLI usage documented, template interpolation syntax unclear
- **Formulas**: Structure known (TOML), few complete examples available
- **Distills**: Command exists in source, severely under-documented for users

## Evidence Standards

All reports follow strict evidence requirements:
- ✅ Direct quotes from documentation
- ✅ Source URLs for all claims
- ✅ Changelog references for features
- ✅ Real-world example citations
- ✅ Explicit identification of unknowns

## Sources Hierarchy

Reports prioritize sources in this order:
1. Official Beads documentation (GitHub)
2. Source code (when docs are sparse)
3. Steve Yegge's blog posts/tutorials
4. Community guides and resources
5. Inferences (clearly labeled)

## Using These References

### For Quick Lookups
```bash
# Open specific reference
read ${PAI_DIR}/skills/beads-workflows/reference/wisps.md
```

### For Comprehensive Study
Read in this order:
1. `wisps.md` - Understand ephemeral vs persistent
2. `bonds.md` - Learn multi-molecule coordination
3. `formulas.md` - Build reusable templates
4. `variables.md` - Parameterize workflows
5. `distills.md` - Extract patterns from organic work
6. `steps.md` - Master dependency patterns

### For Problem Solving
- **Orphaned wisps?** → `wisps.md` (GC section)
- **Dependency confusion?** → `bonds.md` (direction semantics)
- **Template reuse?** → `formulas.md` (composition patterns)
- **Dynamic workflows?** → `bonds.md` (Christmas ornament pattern)

## Maintenance

These references are research artifacts. As Beads evolves:
- Check official docs for updates
- Verify examples still work
- Report documentation gaps to Beads project
- Update references when new features ship

## Contributing

Found errors or new information? Update the relevant reference file with:
- Source citation
- Date discovered
- Evidence (quotes, examples, screenshots)

## Related Resources

- [Beads GitHub](https://github.com/steveyegge/beads)
- [Gas Town Multi-Agent Manager](https://github.com/steveyegge/gastown)
- [Steve Yegge's Medium](https://steve-yegge.medium.com/)
- [Beads Documentation](https://github.com/steveyegge/beads/tree/main/docs)
