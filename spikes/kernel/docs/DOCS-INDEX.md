# Docs Index (Kernel + Workflow Engine)

This folder contains two sets of docs:

- **Kernel (minimal runtime primitives)**: `Hub`, `Harness`, `AgentDefinition`, `Channel`
- **Workflow engine (YAML DAG)**: declarative workflows + TypeScript node registry (layered on the kernel)

If you’re new, start with:

- [[DESIGN]] (kernel “why + invariants”)
- [[API]] (kernel public API)
- [[EVENTS]] (canonical event contract)
- [[WORKFLOW-ENGINE-INDEX]] (workflow engine entrypoint)

---

## Kernel docs

- [[00-kernel]] — high-level explanation of “unification”
- [[DESIGN]] — minimal kernel goals + invariants
- [[DESIGN-OPTIONS]] — alternative kernel shapes and tradeoffs
- [[01-unified-bus-options]] — deeper discussion of hub/bus options
- [[API]] — canonical API contract (what we try not to break)
- [[02-minimal-public-api]] — ergonomics notes and naming
- [[EVENTS]] — canonical event envelope + minimal event set

---

## Workflow engine docs (YAML DAG)

- [[WORKFLOW-ENGINE-INDEX]] — entrypoint + overview
- [[WORKFLOW-YAML-SCHEMA]] — **canonical YAML contract** (A3 bindings, B1 edges)
- [[WORKFLOW-ENGINE-ARCHITECTURE]] — major abstractions + boundaries
- [[WORKFLOW-ENGINE-UML]] — Mermaid diagrams (components/classes/sequences)
- [[WORKFLOW-ENGINE-MVP]] — MVP vs later scope
- [[WORKFLOW-ENGINE-FILE-SKELETON]] — proposed folder/file skeleton

