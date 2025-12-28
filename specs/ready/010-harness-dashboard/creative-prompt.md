# Creative Dashboard Prompt

> Give this prompt to multiple agents and let them create their own unique interpretations.

---

## The Challenge

Design and build a **visual dashboard** for watching and interacting with AI agents executing tasks in real-time. Think of it like a mission control for an AI workforce - you're observing agents as they read code, make decisions, and complete work. **And sometimes they ask you questions.**

The magic ingredients:

1. **Monologue** - Each agent produces a first-person, human-readable stream of consciousness explaining what it's doing
2. **Human-in-the-Loop** - Sometimes the agent needs your input to make a decision (like Claude Code asking "Which approach should I use?")
3. **Task Data** - You can inspect the full details of any task/ticket

Instead of seeing cryptic log output, you see:

> "I'm reading the config file to understand the project structure..."
> "Found two possible approaches. **I need your input on which to use.**"
> "Done! Created 3 files and modified 2 existing ones."

Your dashboard should make this experience **informative, engaging, interactive, and visually compelling**.

---

## Technology Stack

**REQUIRED**: Build this using:

- **HTML5 + CSS3 + JavaScript/TypeScript** - Web-based dashboard
- **Terminal/Retro Aesthetic** - Make it LOOK like a terminal, but it's actually a web app

### The Terminal Aesthetic

This is a web app that **looks and feels like a terminal**:

```
┌─────────────────────────────────────────────────┐
│  Use monospace fonts everywhere                  │
│  Box-drawing characters: ┌─┐│└┘├┤┬┴┼           │
│  Dark backgrounds: #0d1117, #1a1b26, #282c34    │
│  Bright text on dark: green, amber, cyan, white │
│  Optional: scanlines, CRT glow, pixel effects   │
│  Blinking cursor on inputs: █                    │
└─────────────────────────────────────────────────┘
```

**Font suggestions**: `JetBrains Mono`, `Fira Code`, `Source Code Pro`, `IBM Plex Mono`

**Theme options you might explore**:
- Classic green-on-black (Matrix/hacker)
- Amber phosphor (vintage CRT)
- Modern dark (VS Code, GitHub Dark)
- Retro computing (C64 blue, Apple II green)
- Cyberpunk/synthwave (neon pink, cyan, purple)

**Markdown Rendering**: Use `marked`, `markdown-it`, or similar. Code blocks should have syntax highlighting via `highlight.js` or `prism`.

**Real-time**: Connect via WebSocket or Server-Sent Events for live updates.

---

## What You're Visualizing

### The Workflow Structure

```
Session
├── Phase 1: Setup
│   ├── Task T001 (complete)
│   ├── Task T002 (complete)
│   └── Task T003 (running) ← you are here
├── Phase 2: Implementation
│   ├── Task T004 (pending, depends on T003)
│   └── Task T005 (pending)
└── Phase 3: Testing
    └── Task T006 (pending)
```

### What Each Task Contains

| Data Point | Description | Example |
|------------|-------------|---------|
| **ID** | Task identifier | `T015` |
| **Description** | What the task does | "Implement Zod validation for user input" |
| **Status** | Current state | pending → running → validating → awaiting-input → complete/failed |
| **Phase** | Which phase it belongs to | "Phase 2: Implementation" |
| **Dependencies** | Tasks that must complete first | `["T012", "T013"]` |
| **Files** | Referenced file paths | `["src/validation.ts", "src/types.ts"]` |
| **User Story** | Related user story | `"US2"` |
| **Validation Criteria** | How to verify completion | "All schemas exported and type-safe" |
| **Flags** | Special markers | `{ parallel: true, constitution: null }` |
| **Monologue** | Agent's narrative stream | "I'm looking at the schema..." |
| **Duration** | How long it took | `2.5s` |
| **Tokens** | LLM token usage | `{ input: 1500, output: 800, cached: 200 }` |
| **Validation** | Pass/fail with confidence | `{ passed: true, confidence: 0.95 }` |
| **Retries** | Attempt count if failed | `attempt 2 of 3` |

### Event Stream (What Arrives in Real-Time)

```typescript
// Session lifecycle
"harness:start"    → { tasks: [...], sessionId: "abc123", mode: "live" }
"harness:complete" → { summary: { totalTasks: 10, completed: 8, failed: 2, ... } }

// Phase progression
"phase:start"      → { phase: "Phase 2: Implementation", phaseNumber: 2, taskCount: 5 }
"phase:complete"   → { phaseNumber: 2 }

// Task lifecycle
"task:start"       → { task: { id: "T015", description: "...", dependencies: [...] } }
"task:narrative"   → { taskId: "T015", entry: { agentName: "Coder", text: "I'm reading..." } }
"task:complete"    → { taskId: "T015", result: { durationMs: 2500, filesModified: [...] } }
"task:failed"      → { taskId: "T015", failure: { error: "...", retryable: true } }
"task:retry"       → { taskId: "T015", attempt: 2, maxAttempts: 3, reason: "..." }

// Validation
"validation:start"    → { taskId: "T015" }
"validation:complete" → { taskId: "T015", result: { passed: true, confidence: 0.92 } }

// ═══════════════════════════════════════════════════════════════════════════
// HUMAN-IN-THE-LOOP (This is the interactive part!)
// ═══════════════════════════════════════════════════════════════════════════

"human:request" → {
  questions: [{
    id: "q1",
    type: "select",                    // or "multiselect", "text", "confirm"
    question: "Which validation approach should I use?",
    context: "**Context:** The existing code uses both Zod and manual validation...",
    options: [
      { label: "Zod schemas", value: "zod", description: "Type-safe, composable" },
      { label: "Manual validation", value: "manual", description: "Explicit, no deps" },
      { label: "Keep both", value: "both", description: "Maintain compatibility" }
    ]
  }],
  context: "I found two possible approaches for the validation...",
  taskId: "T015",
  blocking: true                       // Execution paused until answered!
}

"human:response" → {
  responses: [{ questionId: "q1", value: "zod", timestamp: 1703520000000 }]
}
```

---

## Required Elements

Your dashboard MUST include:

1. **Session Header** - Show we're in a live session, display overall progress
2. **Phase Grouping** - Tasks organized by their phase
3. **Task Sections** - Each task gets its own visual segment
4. **Monologue Display** - The agent's narrative (Markdown rendered!)
5. **Status Indicators** - Visual distinction between states including "awaiting-input"
6. **Metadata** - Duration, tokens, files modified, validation result
7. **Summary** - End-of-session aggregate stats
8. **Input Modal/Panel** - For human-in-the-loop questions
   - Select (radio buttons, keyboard navigable)
   - Multiselect (checkboxes, toggle with space)
   - Text input (free-form text box)
   - Confirm (Yes/No)
9. **Task Data View** - Expandable/modal to see full ParsedTask details
10. **Markdown Rendering** - Proper formatting for narratives and question context

---

## Human-in-the-Loop UX

When a `human:request` event arrives with `blocking: true`:

1. **Interrupt the flow** - Make it clear execution is paused
2. **Show the question prominently** - Modal, overlay, or highlighted panel
3. **Render context as Markdown** - The agent provides context to help you decide
4. **Provide input controls**:
   - **Select**: Up/down arrows to navigate, Enter to submit
   - **Multiselect**: Space to toggle, Enter to submit all selected
   - **Text**: Full text input with cursor, Enter to submit
   - **Confirm**: Y/N keys or button selection
5. **Emit response** - On submit, emit `human:response` event
6. **Resume** - Clear the modal, execution continues

---

## Creative Freedom

Everything else is up to you:

### Framework Choice
- Vanilla JS (pure, no dependencies)
- React (component-based)
- Vue (reactive, approachable)
- Svelte (compiled, minimal)
- Or anything else you prefer

### Terminal Theme Variations
- **Matrix** - Green text, black background, falling characters
- **Amber CRT** - Orange/amber text, subtle glow, scanlines
- **Modern Terminal** - Clean dark theme like VS Code or iTerm2
- **Retro Computing** - C64 blue, Apple II green, DOS aesthetic
- **Cyberpunk** - Neon accents, glitch effects, synthwave vibes

### Layout Approach
- Vertical timeline scrolling down
- Split pane with list + detail view
- Card-based with expandable sections
- CSS Grid dashboard layout

### Interaction
- Keyboard shortcuts (j/k navigation, d for data, etc.)
- Focus management between panels
- Search and filter
- Vim-style keybindings?

### Monologue Presentation
- Chat bubbles (terminal-styled)
- Log stream with timestamps
- Typewriter effect for streaming text
- Agent avatars using ASCII art

### Data Visualization
- ASCII progress bars: `[████████░░░░░░░░] 52%`
- Token sparklines using block characters
- Validation confidence as color gradient
- File trees using box-drawing characters

### Polish & Effects
- CRT scanline overlay
- Subtle screen flicker
- Typing/cursor animations
- Glowing text effects (CSS text-shadow)
- Boot sequence animation on load
- Sound effects (keyboard clicks, beeps)?

---

## Inspiration Sketches

### Task Execution View
```
╔═══════════════════════════════════════════════════════════════╗
║  DAO SPEC KIT • HARNESS DASHBOARD                             ║
║  Session: abc123 │ Mode: LIVE │ Progress: ▓▓▓▓░░░░░░ 4/10     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ┌─ Phase 2: Implementation ─ ACTIVE ───────────────────────┐ ║
║  │                                                          │ ║
║  │ ● T004  Validation logic                      RUNNING    │ ║
║  │   ├────────────────────────────────────────────────────┤ │ ║
║  │   │ 🤖 "I'm reading the schema file to understand      │ │ ║
║  │   │     the validation requirements..."                │ │ ║
║  │   │                                                    │ │ ║
║  │   │ 🤖 "Found 5 fields that need validation. Starting  │ │ ║
║  │   │     with the **email field** which needs regex..." │ │ ║
║  │   ├────────────────────────────────────────────────────┤ │ ║
║  │   │ ⏱ 12.3s │ 📄 3 files │ 🔤 2.4k tokens │ 🔄 1/3     │ │ ║
║  │   └────────────────────────────────────────────────────┘ │ ║
║  │                                                          │ ║
║  │ ○ T005  Error handling                        PENDING    │ ║
║  └──────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  [d] Task Data  [↑↓] Navigate  [q] Quit                       ║
╚═══════════════════════════════════════════════════════════════╝
```

### Human-in-the-Loop Modal
```
╔═══════════════════════════════════════════════════════════════╗
║  SESSION abc123   │   ⚠ AWAITING INPUT   │   ▰▰▰▱▱▱▱▱▱▱ 3/10  ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ╔═══════════════════════════════════════════════════════════╗║
║  ║                    🤔 Question                            ║║
║  ╠═══════════════════════════════════════════════════════════╣║
║  ║                                                           ║║
║  ║  I found two possible approaches for the validation:     ║║
║  ║                                                           ║║
║  ║  **Context:** The existing code uses both `Zod` and      ║║
║  ║  manual validation. Which should I standardize on?       ║║
║  ║                                                           ║║
║  ╠───────────────────────────────────────────────────────────╣║
║  ║  Which validation approach should I use?                 ║║
║  ║                                                           ║║
║  ║    ● Zod schemas (type-safe, composable)                 ║║
║  ║    ○ Manual validation (explicit, no dependencies)       ║║
║  ║    ○ Keep both (maintain compatibility)                  ║║
║  ║                                                           ║║
║  ╠───────────────────────────────────────────────────────────╣║
║  ║                           [Enter] Submit  [Esc] Cancel    ║║
║  ╚═══════════════════════════════════════════════════════════╝║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Text Input Modal
```
╔═══════════════════════════════════════════════════════════════╗
║  SESSION abc123   │   ⚠ AWAITING INPUT   │   ▰▰▰▰▰▱▱▱▱▱ 5/10  ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ╔═══════════════════════════════════════════════════════════╗║
║  ║                    📝 Input Required                      ║║
║  ╠═══════════════════════════════════════════════════════════╣║
║  ║                                                           ║║
║  ║  The config file needs an API endpoint. I couldn't       ║║
║  ║  find one in the environment or existing config.         ║║
║  ║                                                           ║║
║  ║  Please provide the API base URL:                        ║║
║  ║                                                           ║║
║  ║  ┌───────────────────────────────────────────────────┐   ║║
║  ║  │ https://api.example.com/v1█                       │   ║║
║  ║  └───────────────────────────────────────────────────┘   ║║
║  ║                                                           ║║
║  ╠───────────────────────────────────────────────────────────╣║
║  ║                           [Enter] Submit  [Esc] Cancel    ║║
║  ╚═══════════════════════════════════════════════════════════╝║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Task Data View (Press 'd' on a task)
```
╔═══════════════════════════════════════════════════════════════╗
║  SESSION abc123   │   LIVE   │   ▰▰▰▰▱▱▱▱▱▱ 4/10 tasks        ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ╔══ T004 - Task Data ═══════════════════════════════════════╗║
║  ║                                                           ║║
║  ║  ID:           T004                                       ║║
║  ║  Phase:        Phase 2: Implementation                    ║║
║  ║  Status:       running                                    ║║
║  ║                                                           ║║
║  ║  Description:                                             ║║
║  ║  ─────────────────────────────────────────────────────    ║║
║  ║  Implement Zod validation schemas for all API request    ║║
║  ║  and response types. Ensure type safety across the       ║║
║  ║  entire data flow.                                        ║║
║  ║                                                           ║║
║  ║  Dependencies:  T001, T002, T003                          ║║
║  ║  User Story:    US2                                       ║║
║  ║                                                           ║║
║  ║  Files:                                                   ║║
║  ║    • src/schemas/request.ts                               ║║
║  ║    • src/schemas/response.ts                              ║║
║  ║    • src/types/api.ts                                     ║║
║  ║                                                           ║║
║  ║  Validation Criteria:                                     ║║
║  ║  ─────────────────────────────────────────────────────    ║║
║  ║  All request/response schemas defined and exported.      ║║
║  ║  Type inference works correctly with TypeScript.         ║║
║  ║                                                           ║║
║  ║  Flags:  [P] parallel                                     ║║
║  ║                                                           ║║
║  ╠───────────────────────────────────────────────────────────╣║
║  ║                                       [d] Close  [↑↓] ▼   ║║
║  ╚═══════════════════════════════════════════════════════════╝║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Your Mission

Create a dashboard that:

1. **Clearly shows what's happening** - Anyone should understand the execution state at a glance
2. **Makes the monologue compelling** - The agent's voice should feel alive and informative
3. **Handles input gracefully** - Human-in-the-loop should feel natural, not jarring
4. **Lets you inspect deeply** - Task data should be accessible when you want it
5. **Renders Markdown properly** - Code blocks, bold, lists should all look right
6. **Displays useful metadata** - Without overwhelming the primary experience
7. **Feels polished** - Small details matter
8. **Has personality** - Make it distinctively yours

Build something you'd want to watch (and interact with) while your agents work.

---

## Technical Notes

### Architecture
- **Frontend**: HTML/CSS/JS with terminal aesthetic
- **Real-time**: WebSocket or Server-Sent Events for live updates
- **Markdown**: Use `marked` or `markdown-it` with syntax highlighting
- **State**: Can use framework state management or vanilla JS

### Event Handling
- The dashboard connects to a WebSocket/SSE endpoint that streams events
- Events arrive in real-time; narratives may come in rapid succession
- Handle reconnection gracefully (show "Reconnecting..." state)

### Data Scale
- A session typically has 5-50 tasks across 3-8 phases
- Each task generates 2-10 narrative events during execution
- Token counts range from hundreds to tens of thousands
- Duration ranges from sub-second to several minutes per task
- Human-in-the-loop questions can arrive at any time

### CSS Tips for Terminal Style
```css
/* Base terminal look */
body {
  background: #0d1117;
  color: #c9d1d9;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 14px;
  line-height: 1.5;
}

/* Box-drawing borders */
.panel {
  border: 1px solid #30363d;
  /* Or use actual box characters in ::before/::after */
}

/* Glowing text effect */
.highlight {
  text-shadow: 0 0 10px currentColor;
}

/* Scanline effect */
.crt::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    transparent 0px,
    rgba(0,0,0,0.1) 1px,
    transparent 2px
  );
  pointer-events: none;
}

/* Blinking cursor */
.cursor {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
```

Good luck. Make something beautiful AND useful. Make it feel like hacking the mainframe.
