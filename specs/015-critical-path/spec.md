# Feature Specification: Documentation Overhaul

**Feature Branch**: `015-critical-path`
**Created**: 2026-01-02
**Status**: In Progress
**Input**: Comprehensive docs audit and overhaul for Open Harness documentation

## Overview

This feature branch focuses on bringing the Open Harness documentation to production-ready quality. The work includes:

1. **Homepage positioning** - "n8n for AI agents" value proposition
2. **Quickstart rewrite** - 2-node template→agent orchestration example
3. **Navigation fixes** - meta.json files for all directories
4. **Content expansion** - Architecture overview, debugging guide
5. **Flow-UI documentation** - Reference docs for visual editor components

## User Scenarios & Testing

### User Story 1 - Clear Value Proposition (Priority: P0)

As a first-time visitor, I want to understand what Open Harness does within 10 seconds so that I can decide if it's relevant to my needs.

**Acceptance Scenarios**:

1. **Given** a user lands on the homepage, **When** they read the hero section, **Then** they see "n8n for AI agents" positioning.
2. **Given** a user is on the intro page, **When** they read it, **Then** they understand Hub→Flow→Agents→Channels mental model.

---

### User Story 2 - Working Quickstart (Priority: P0)

As a developer, I want to run a working 2-node flow example in under 10 minutes so that I can verify the system works and understand the core concepts.

**Acceptance Scenarios**:

1. **Given** a developer follows the quickstart, **When** they run the example, **Then** they see a template→agent flow with edges and bindings.
2. **Given** the quickstart code, **When** the developer runs it, **Then** it uses `createClaudeAgent()` SDK wrapper (not raw fetch).

---

### User Story 3 - Navigable Documentation (Priority: P1)

As a developer, I want to browse docs without dead ends so that I can find the information I need.

**Acceptance Scenarios**:

1. **Given** any section in docs, **When** I navigate, **Then** all pages appear in navigation (no orphan directories).
2. **Given** cross-references in docs, **When** I click links, **Then** they resolve to valid pages.

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Homepage displays "n8n for AI agents" positioning | P0 |
| FR-002 | Quickstart shows 2+ nodes with edges | P0 |
| FR-003 | Quickstart uses SDK wrapper | P0 |
| FR-004 | All directories have meta.json | P1 |
| FR-005 | Flow-UI components documented | P1 |
| FR-006 | Architecture overview expanded | P2 |
| FR-007 | Debugging guide expanded | P1 |

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | Docs build successfully without warnings |
| NFR-002 | All internal links resolve |
| NFR-003 | Content follows Diataxis framework |

## Technical Approach

Documentation-only changes to `apps/docs/`:
- Rewrite homepage and intro
- Expand quickstart with 2-node example
- Create meta.json for all directories
- Add Flow-UI reference section
- Expand existing guides

## Out of Scope

- Code changes to packages/kernel
- New features or APIs
- Visual editor implementation (that's separate 015-channel-architecture)
