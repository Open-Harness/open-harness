# Content Outlines: /contributing/

**Priority**: P2 - After Reference and Concepts
**Audience**: Core Contributor
**Voice**: Technical, direct, assumes strong TypeScript background

---

## Design Principles for Contributor Docs

1. **Focused on extension**: How to extend/maintain the codebase
2. **Architecture-first**: Understand before contributing
3. **Workflow-oriented**: Development, testing, releasing
4. **Internal details**: Not oharnes (stays in .claude/), but architecture

---

## Section: /contributing/ (Root)

### Page: index.mdx
**Purpose**: Contributor welcome and overview
**Effort**: Small (1-2 hours)

**Content**:
1. **Welcome Contributors**
   - Brief welcome message
   - What you can contribute (nodes, channels, providers, core)

2. **Getting Started**
   - Link to setup guide
   - Link to architecture overview

3. **Contribution Areas**
   - Bug fixes
   - New features
   - Documentation
   - Tests

4. **Quick Links**
   - Setup, architecture, development workflow

---

### Page: setup.mdx
**Purpose**: Development environment setup
**Effort**: Medium (2-3 hours)

**Content**:
1. **Prerequisites**
   - Bun (required version)
   - Git
   - VS Code recommended

2. **Clone and Install**
   ```bash
   git clone <repo>
   cd open-harness
   bun install
   ```

3. **Verify Setup**
   ```bash
   bun run typecheck
   bun run test
   ```

4. **IDE Setup**
   - VS Code extensions
   - ESLint, TypeScript
   - Recommended settings

5. **Project Structure Overview**
   - Brief preview (details in architecture)

6. **Running Examples**
   - How to run demo scripts
   - How to try things out

---

## Section: /contributing/architecture/

### Page: overview.mdx
**Purpose**: Codebase architecture for contributors
**Effort**: Large (4-5 hours)

**Content**:
1. **Monorepo Structure**
   - Visual: Package diagram
   - packages/kernel, packages/rtv-channel, etc.

2. **Kernel Package Deep Dive**
   - src/protocol/ (interfaces)
   - src/engine/ (implementations)
   - src/flow/ (flow runtime)
   - src/providers/ (AI providers)

3. **Build and Test**
   - How code is built
   - Test organization

4. **Key Patterns**
   - Dependency injection (Needle DI)
   - Protocol/Implementation split
   - Event-driven architecture

**Links**: packages, protocol-vs-engine

---

### Page: packages.mdx
**Purpose**: Package structure explanation
**Effort**: Medium (2-3 hours)

**Content**:
1. **Package Overview**
   - kernel: Core runtime
   - rtv-channel: Voice channel
   - github-channel: GitHub integration (planned)
   - config: Shared configuration

2. **Package Dependencies**
   - Who imports whom
   - Dependency graph

3. **Adding a New Package**
   - When to create a package
   - Setup steps
   - Conventions

**Links**: new-channel guide

---

### Page: protocol-vs-engine.mdx
**Purpose**: Protocol/implementation split explanation
**Effort**: Medium (2-3 hours)

**Content**:
1. **The Split**
   - src/protocol/: Type definitions, interfaces
   - src/engine/: Implementations
   - src/flow/: Flow runtime implementations

2. **Why This Pattern?**
   - Clear contracts
   - Testability
   - Swappable implementations

3. **Navigation**
   - How to find things
   - Interface → Implementation mapping

4. **Contributing to Protocol**
   - When to modify protocol
   - Backward compatibility

**Links**: reading-specs

---

### Page: directory-layout.mdx
**Purpose**: Detailed src/ structure
**Effort**: Medium (2-3 hours)

**Content**:
1. **src/ Directory Tree**
   - Full annotated tree

2. **Key Files**
   - index.ts exports
   - protocol/*.ts interfaces
   - engine/*.ts implementations

3. **Naming Conventions**
   - File naming
   - Interface/class naming

4. **Where to Add Code**
   - Decision tree for new features

---

## Section: /contributing/development/

### Page: workflow.mdx
**Purpose**: Development workflow
**Effort**: Medium (2-3 hours)

**Content**:
1. **Branch Strategy**
   - Feature branches
   - PR workflow
   - Graphite stacks (if used)

2. **Making Changes**
   - Create branch
   - Make changes
   - Run tests
   - Commit

3. **Code Review**
   - PR requirements
   - Review process

4. **Merging**
   - Squash policy
   - Commit message format

---

### Page: testing.mdx
**Purpose**: Test strategy for contributors
**Effort**: Large (4-5 hours)

**Content**:
1. **Test Tiers**
   - Unit tests: Direct function tests
   - Replay tests: Fixture-based integration
   - Live tests: Real API calls

2. **Running Tests**
   ```bash
   bun run test        # Unit + replay
   bun run test:live   # Live integration
   ```

3. **Writing Tests**
   - File naming conventions
   - Test structure
   - Assertions

4. **When to Use Each Tier**
   - Decision tree

5. **Coverage Expectations**
   - What to cover
   - What not to cover

**Links**: fixtures

---

### Page: fixtures.mdx
**Purpose**: Golden fixture recording
**Effort**: Medium (3-4 hours)

**Content**:
1. **What Are Fixtures?**
   - Recorded API responses
   - Golden (expected) outputs

2. **Recording Fixtures**
   - Enable recording mode
   - Run the flow
   - Fixtures saved automatically

3. **Fixture Location**
   - recordings/golden/
   - Naming conventions

4. **Updating Fixtures**
   - When to update
   - Review before committing

5. **Fixture Format**
   - JSONL structure
   - What's captured

---

### Page: conformance.mdx
**Purpose**: Conformance testing process
**Effort**: Medium (2-3 hours)

**Content**:
1. **Conformance Philosophy**
   - Implementation matches spec
   - Tests prove correctness

2. **Test Specs**
   - .test-spec.md files
   - Link to spec requirements

3. **CI Gates**
   - What must pass
   - How gates work

4. **Adding Conformance Tests**
   - When required
   - How to write

---

## Section: /contributing/extending/

### Page: custom-nodes.mdx
**Purpose**: Adding built-in node types
**Effort**: Medium (2-3 hours)

**Content**:
1. **Built-in vs User Nodes**
   - Built-in: ship with kernel
   - User: defined in user code

2. **Adding a Built-in Node**
   - Create in src/flow/nodes/
   - Define NodeTypeDefinition
   - Register in default registry

3. **Requirements**
   - Complete schemas
   - Tests
   - Documentation

4. **Review Checklist**
   - What reviewers look for

---

### Page: new-channel.mdx
**Purpose**: Building a new channel package
**Effort**: Large (4-5 hours)

**Content**:
1. **When to Create a Channel Package**
   - New I/O boundary (WebSocket, SMS, etc.)

2. **Package Setup**
   - Create packages/xxx-channel/
   - Package.json
   - TypeScript config

3. **Implement ChannelDefinition**
   - Interface requirements
   - Attach/detach lifecycle

4. **Testing**
   - Unit tests
   - Integration tests

5. **Documentation**
   - README
   - Example usage

---

### Page: new-provider.mdx
**Purpose**: Adding a new AI provider
**Effort**: Medium (3-4 hours)

**Content**:
1. **Provider Pattern**
   - What providers do
   - Current: Anthropic

2. **Adding a Provider**
   - Create in src/providers/
   - Implement agent factory
   - Handle authentication

3. **Requirements**
   - Match Anthropic API surface
   - Support replay mode
   - Tests

4. **Planned Providers**
   - OpenAI
   - Google
   - Custom

---

## Section: /contributing/specifications/

### Page: reading-specs.mdx
**Purpose**: How to read kernel specs
**Effort**: Medium (2-3 hours)

**Content**:
1. **Spec Location**
   - packages/kernel/docs/

2. **Spec Structure**
   - Protocol specs
   - Flow specs
   - ADRs

3. **Reading for Implementation**
   - MUST/SHOULD/MAY
   - Finding requirements

4. **Spec Updates**
   - When to update spec
   - Spec-first development

---

### Page: spec-to-code.mdx
**Purpose**: Implementing from specs
**Effort**: Medium (2-3 hours)

**Content**:
1. **Spec-First Development**
   - Read spec
   - Write test spec
   - Implement
   - Verify

2. **Traceability**
   - Link code to spec sections
   - Test coverage of spec

3. **Handling Gaps**
   - When spec is unclear
   - When to ask

---

### Page: traceability.mdx
**Purpose**: Spec → test → code mapping
**Effort**: Small (1-2 hours)

**Content**:
1. **Traceability Chain**
   - Spec requirement
   - Test spec
   - Test file
   - Implementation

2. **Finding Traceability**
   - How to navigate
   - Tools and patterns

---

## Section: /contributing/releasing/

### Page: versioning.mdx
**Purpose**: Versioning strategy
**Effort**: Small (1-2 hours)

**Content**:
1. **Semantic Versioning**
   - Major.Minor.Patch

2. **Breaking Changes**
   - What constitutes breaking
   - Protocol changes

3. **Pre-release**
   - Alpha/beta tags

---

### Page: changelog.mdx
**Purpose**: Changelog process
**Effort**: Small (1 hour)

**Content**:
1. **Changelog Format**
   - Keep a Changelog standard

2. **Adding Entries**
   - When to add
   - Format

3. **Release Process**
   - Cut release
   - Update changelog

---

## Effort Summary

| Section | Pages | Total Effort |
|---------|-------|--------------|
| root | 2 | ~4 hours |
| architecture | 4 | ~12 hours |
| development | 4 | ~12 hours |
| extending | 3 | ~10 hours |
| specifications | 3 | ~6 hours |
| releasing | 2 | ~3 hours |

**Total Contributing**: ~47 hours of content creation

---

## Note on oharnes Exclusion

The oharnes workflow system (.claude/commands/, .claude/agents/) is intentionally excluded from public contributor docs:

- It's AI tooling infrastructure
- Not relevant to external contributors
- Well-documented internally in .claude/CLAUDE.md
- May confuse users unfamiliar with Claude Code

Contributors who need oharnes can find it in .claude/.
