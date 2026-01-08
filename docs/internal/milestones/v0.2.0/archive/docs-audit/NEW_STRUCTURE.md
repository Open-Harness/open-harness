# Proposed Documentation Structure

**Principle:** Outcome-first navigation, progressive disclosure, AI-readable

---

## Current Structure (Diátaxis)

```
docs/
├── index.mdx
├── learn/
│   ├── quickstart.mdx
│   ├── your-first-agent.mdx
│   ├── multi-agent-flow.mdx
│   └── persistence.mdx
├── guides/
│   ├── agents/
│   ├── channels/
│   ├── deployment/
│   ├── expressions/
│   └── flows/
├── reference/
│   ├── api/
│   ├── expressions/
│   ├── types/
│   └── schemas/
└── concepts/
    ├── architecture.mdx
    ├── event-system.mdx
    ├── expressions.mdx
    ├── persistence.mdx
    ├── why-jsonata.mdx
    └── design-decisions/
```

**Problems:**
- Organized by internal structure, not user outcomes
- "Learn" is passive, "Getting Started" is active
- Concepts come last but are referenced early
- No clear user journey

---

## Proposed Structure (Outcome-First)

```
docs/
├── index.mdx                    # Landing: What + Why + Where to Start
│
├── getting-started/             # 5-minute path to working code
│   ├── index.mdx               # Installation + Framework chooser
│   ├── quickstart.mdx          # Level 1: Hello Reviewer (5 min)
│   ├── bun.mdx                 # Framework-specific: Bun
│   ├── nodejs.mdx              # Framework-specific: Node.js
│   └── troubleshooting.mdx     # NEW: Common errors & fixes
│
├── build/                       # Progressive complexity tutorials
│   ├── index.mdx               # Learning path overview
│   ├── single-agent.mdx        # Level 2: Stateful Agent
│   ├── multi-node.mdx          # Level 3: Data Flow
│   ├── branching.mdx           # Level 4: Conditions
│   ├── loops.mdx               # Level 5: Iteration patterns
│   └── custom-nodes.mdx        # Creating your own nodes
│
├── production/                  # Shipping to production
│   ├── index.mdx               # Production checklist
│   ├── persistence.mdx         # Level 5: Persistent Reviews
│   ├── recording.mdx           # Level 6: Testing without APIs
│   ├── evaluation.mdx          # Level 7: Measuring Quality
│   └── deployment.mdx          # Hosting & infrastructure
│
├── connect/                     # Integrations
│   ├── index.mdx               # Integration overview
│   ├── websocket.mdx           # WebSocket integration
│   ├── http.mdx                # HTTP/REST endpoints
│   └── streaming.mdx           # Real-time streaming
│
├── reference/                   # Lookup (no learning)
│   ├── index.mdx               # Quick-find guide
│   ├── api/
│   │   ├── runtime.mdx         # Renamed from hub.mdx
│   │   ├── node-types.mdx      # Renamed from agent.mdx
│   │   ├── transport.mdx       # Renamed from channel.mdx
│   │   ├── events.mdx          # Keep
│   │   ├── run-store.mdx       # Keep
│   │   └── node-registry.mdx   # Keep
│   ├── yaml/
│   │   ├── flow-schema.mdx     # Complete YAML reference
│   │   ├── node-config.mdx     # Node configuration
│   │   └── edge-config.mdx     # Edge configuration
│   ├── expressions/
│   │   ├── syntax.mdx          # Keep
│   │   ├── functions.mdx       # Keep
│   │   └── context.mdx         # Keep
│   └── eval/                    # NEW: Eval system reference
│       ├── assertions.mdx      # All assertion types
│       ├── gates.mdx           # All gate types
│       └── scorers.mdx         # All scorer types
│
├── understand/                  # Deep dives (explanation)
│   ├── index.mdx               # Conceptual overview
│   ├── architecture.mdx        # Rewrite: Runtime-centric
│   ├── event-model.mdx         # Rewrite: No hub.subscribe
│   ├── expressions.mdx         # Keep
│   ├── philosophy.mdx          # From zen.md
│   └── decisions/
│       ├── graph-first.mdx     # Keep
│       └── why-jsonata.mdx     # Keep
│
└── future/                      # v0.3.0+ content
    ├── telemetry.mdx           # Move from 0.2.0
    ├── skills.mdx              # Move from 0.2.0
    └── scripts.mdx             # Move from 0.2.0
```

---

## Navigation (Sidebar)

```
Getting Started
├── Installation
├── 5-Minute Quickstart        ← Start here
├── Framework Guides
│   ├── Bun
│   └── Node.js
└── Troubleshooting

Build Flows
├── Overview
├── Single Agent               ← Level 2
├── Multi-Node Flows           ← Level 3
├── Conditional Branching      ← Level 4
├── Loops & Iteration          ← Level 5
└── Custom Nodes

Production
├── Overview
├── Persistence                ← Level 5
├── Recording & Replay         ← Level 6
├── Evaluation System          ← Level 7
└── Deployment

Connect
├── Overview
├── WebSocket
├── HTTP/REST
└── Streaming

───────────────

Reference
├── API
├── YAML Schema
├── Expressions
└── Eval System

Understand
├── Architecture
├── Event Model
├── Philosophy
└── Design Decisions
```

---

## Key Changes

### 1. Renamed Sections
| Old | New | Rationale |
|-----|-----|-----------|
| Learn | Getting Started | Action-oriented |
| Guides | Build + Production + Connect | Outcome-specific |
| Concepts | Understand | User action verb |

### 2. Renamed Files
| Old | New | Rationale |
|-----|-----|-----------|
| reference/api/hub.mdx | reference/api/runtime.mdx | Content is about Runtime |
| reference/api/agent.mdx | reference/api/node-types.mdx | Content is about NodeTypeDefinition |
| reference/api/channel.mdx | reference/api/transport.mdx | Content is about Transport |

### 3. New Pages
| Page | Purpose |
|------|---------|
| getting-started/troubleshooting.mdx | Common errors & fixes (top friction point) |
| getting-started/bun.mdx | Framework-specific quickstart |
| getting-started/nodejs.mdx | Framework-specific quickstart |
| production/recording.mdx | User-facing recording guide |
| reference/eval/assertions.mdx | Assertion types lookup |
| reference/eval/gates.mdx | Gate types lookup |
| reference/eval/scorers.mdx | Scorer types lookup |

### 4. Deleted Pages
| Page | Reason |
|------|--------|
| guides/channels/custom-channels.mdx | Fabricated API |

### 5. Moved to Future
| From | To | Reason |
|------|-----|--------|
| 0.2.0/telemetry.md | future/telemetry.mdx | v0.3.0 scope |
| 0.2.0/skills-pattern.md | future/skills.mdx | Not implemented |
| 0.2.0/scripts-pattern.md | future/scripts.mdx | Not implemented |

---

## Landing Page Structure

```markdown
# Open Harness

Event-driven workflow orchestration for multi-agent AI systems.

[What is Open Harness?] [Who is it for?] [Prerequisites]

---

<Grid columns={2}>
  <Card title="Getting Started" href="/docs/getting-started">
    5 minutes to your first workflow
  </Card>
  <Card title="Build Flows" href="/docs/build">
    Learn to build multi-agent systems
  </Card>
  <Card title="Production" href="/docs/production">
    Deploy with persistence & evals
  </Card>
  <Card title="Connect" href="/docs/connect">
    WebSocket, HTTP, streaming
  </Card>
</Grid>

---

## Learn the System

<Grid columns={3}>
  <Card title="Architecture" href="/docs/understand/architecture">
    How it works
  </Card>
  <Card title="Event Model" href="/docs/understand/event-model">
    Observability & debugging
  </Card>
  <Card title="Philosophy" href="/docs/understand/philosophy">
    Why we built it this way
  </Card>
</Grid>

---

## Reference

[API Reference](/docs/reference/api) |
[YAML Schema](/docs/reference/yaml) |
[Expressions](/docs/reference/expressions) |
[Eval System](/docs/reference/eval)
```

---

## Implementation Order

### Phase 1: Critical Fixes (Day 1)
1. Create `getting-started/troubleshooting.mdx`
2. Rewrite `getting-started/quickstart.mdx` with Level 1
3. Delete `guides/channels/custom-channels.mdx`
4. Move telemetry/skills/scripts to `future/`

### Phase 2: Restructure (Day 2-3)
1. Rename files (hub→runtime, agent→node-types, channel→transport)
2. Create new section directories
3. Move content to new locations
4. Update navigation/meta.json files

### Phase 3: New Content (Day 4-5)
1. Create framework-specific quickstarts
2. Create eval reference pages
3. Create recording guide
4. Write troubleshooting content

### Phase 4: Polish (Day 6-7)
1. Update all cross-references
2. Add "Next Steps" to each page
3. Create example directory with threaded example
4. Test all code examples

---

*Generated from Competitive Analysis on 2026-01-08*
