# Feature Specification: Harness Dashboard

**Feature Branch**: `010-harness-dashboard`
**Created**: 2025-12-27
**Status**: Draft
**Input**: User description: "Create a visual dashboard for harness/task execution with segmented sections, monologue display, human-in-the-loop support, and rich metadata"

## Overview

Build a visual dashboard for observing and interacting with task harness execution in real-time. The dashboard displays task execution as a segmented, narrative-driven interface where each task has its own section showing:

1. **The Task** - What's being done (description, dependencies, file paths) with viewable raw data
2. **The Monologue** - What the agent is saying/thinking (streaming narrative with Markdown rendering)
3. **The Metadata** - How it went (duration, tokens, retries, validation status)
4. **Human-in-the-Loop** - Interactive prompts when the agent needs user input

The dashboard subscribes to the unified event bus and renders a rich, interactive view of the execution lifecycle - from session start through phase progression to individual task completion. Like Claude Code, it supports bidirectional communication where the harness can pause for user input.

## Technology Stack

**REQUIRED**: This dashboard MUST be built using:

- **HTML5 + CSS3 + JavaScript/TypeScript** - Web-based dashboard
- **Terminal/Retro Aesthetic** - Styled to look like a terminal UI (monospace fonts, box-drawing characters, dark backgrounds, green/amber text options)

### Visual Style Requirements

The dashboard should evoke a terminal/CLI aesthetic while leveraging web capabilities:

- **Monospace fonts** - Use `JetBrains Mono`, `Fira Code`, `Source Code Pro`, or similar
- **Box-drawing characters** - Unicode box drawing (┌─┐│└─┘├┤┬┴┼) or CSS borders styled to match
- **Color palette** - Dark backgrounds (#0d1117, #1a1b26, #282c34) with bright accents
- **Terminal colors** - Support classic terminal palettes (green-on-black, amber-on-black, or modern themes)
- **Scanlines/CRT effects** - Optional subtle retro effects
- **Blinking cursor** - For text inputs
- **ASCII art** - Headers, logos, status indicators

### Technical Capabilities

The web stack provides:
- Real-time updates via WebSocket or Server-Sent Events
- Markdown rendering via `marked`, `markdown-it`, or similar
- Syntax highlighting for code blocks via `highlight.js` or `prism`
- Keyboard navigation and focus management
- Responsive layouts with CSS Grid/Flexbox
- Animations and transitions
- Local storage for preferences

## System Context (For Implementers)

### What is the Harness?

The harness is a **step-aware orchestration framework** for executing workflows through specialized agents. It:

- Parses `tasks.md` files into structured tasks with dependencies
- Executes tasks in topologically-sorted order through agents (Parser → Coder → Reviewer)
- Emits events at every lifecycle point (start, progress, complete, fail)
- Maintains state including retry history, token usage, and validation results

### What is the Monologue System?

The monologue system transforms verbose tool call logs into **first-person, human-readable narratives**:

- Instead of: `tool_call: Read { path: "config.json" }`
- You see: "I'm reading the config file to understand the project structure..."

Monologues are LLM-generated summaries that create a coherent story of what the agent is doing. They're streamed in real-time as `task:narrative` events.

### Event Flow

```
harness:start (session begins)
  └── phase:start (e.g., "Phase 1: Setup")
        └── task:start (task begins execution)
              ├── task:narrative (streaming monologue updates)
              ├── task:narrative (more updates...)
              └── task:complete OR task:failed
                    └── validation:start
                          └── validation:complete OR validation:failed
        └── task:start (next task)
              └── ...
  └── phase:complete
  └── phase:start (e.g., "Phase 2: Implementation")
        └── ...
  └── harness:complete (session ends with summary)
```

---

## Data Contracts

### Core Types Available

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// SESSION LEVEL
// ═══════════════════════════════════════════════════════════════════════════

interface HarnessSummary {
  totalTasks: number
  completedTasks: number
  validatedTasks: number
  failedTasks: number
  skippedTasks: number
  totalRetries: number
  durationMs: number
  tokenUsage: TokenUsage
}

interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK LEVEL
// ═══════════════════════════════════════════════════════════════════════════

interface ParsedTask {
  id: string                    // "T001", "T030a"
  phase: string                 // "Phase 1: Setup"
  phaseNumber: number           // 1, 2, 3...
  description: string           // Full task description
  filePaths: string[]          // Referenced files
  userStory: string | null     // "US1" reference
  dependencies: string[]       // Task IDs: ["T006", "T007"]
  status: "complete" | "pending"
  validationCriteria: string   // How to validate completion
  flags: {
    parallel: boolean          // Can run in parallel [P]
    constitution: string | null // Constitution ref if present
  }
}

interface TaskResult {
  taskId: string
  success: boolean
  summary: string              // What was done
  filesModified: string[]
  durationMs: number
  tokenUsage: TokenUsage
}

interface ValidationResult {
  taskId: string
  passed: boolean
  reasoning: string            // Why pass/fail
  suggestedFixes: string[]
  confidence: number           // 0-1
  checksPerformed: Array<{
    check: string
    passed: boolean
    details: string
  }>
}

interface FailureRecord {
  taskId: string
  stage: "coding" | "validation"
  error: string
  retryable: boolean
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// MONOLOGUE / NARRATIVE
// ═══════════════════════════════════════════════════════════════════════════

type AgentName = "Parser" | "Coder" | "Reviewer" | "Validator" | "Harness"

interface NarrativeEntry {
  timestamp: number
  agentName: AgentName
  taskId: string | null
  text: string                 // The human-readable narrative
  importance?: "critical" | "important" | "detailed"
}

interface NarrativeMetadata {
  eventCount: number           // Events summarized
  historyLength: number        // Context window size
  isFinal?: boolean           // Last narrative for this scope
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS (Subscribe to these)
// ═══════════════════════════════════════════════════════════════════════════

// Lifecycle
type HarnessStartEvent = { type: "harness:start"; tasks: ParsedTask[]; sessionId: string; mode: "live" | "replay" }
type HarnessCompleteEvent = { type: "harness:complete"; summary: HarnessSummary }
type HarnessErrorEvent = { type: "harness:error"; error: Error }

// Phases
type PhaseStartEvent = { type: "phase:start"; phase: string; phaseNumber: number; taskCount: number }
type PhaseCompleteEvent = { type: "phase:complete"; phaseNumber: number }

// Tasks
type TaskStartEvent = { type: "task:start"; task: ParsedTask }
type TaskNarrativeEvent = { type: "task:narrative"; taskId: string; entry: NarrativeEntry; metadata?: NarrativeMetadata }
type TaskCompleteEvent = { type: "task:complete"; taskId: string; result: TaskResult }
type TaskFailedEvent = { type: "task:failed"; taskId: string; failure: FailureRecord }
type TaskSkippedEvent = { type: "task:skipped"; taskId: string; reason: string }
type TaskRetryEvent = { type: "task:retry"; taskId: string; attempt: number; maxAttempts: number; reason: string }

// Validation
type ValidationStartEvent = { type: "validation:start"; taskId: string }
type ValidationCompleteEvent = { type: "validation:complete"; taskId: string; result: ValidationResult }
type ValidationFailedEvent = { type: "validation:failed"; taskId: string; failure: FailureRecord }

// ═══════════════════════════════════════════════════════════════════════════
// HUMAN-IN-THE-LOOP (Interactive Input)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Question option for multiple-choice prompts
 */
interface QuestionOption {
  label: string                // Display text for the option
  value: string                // Value returned when selected
  description?: string         // Optional longer description
  isDefault?: boolean          // Pre-selected option
}

/**
 * A question the agent is asking the user
 */
interface HumanLoopQuestion {
  id: string                   // Unique question ID
  type: "select" | "multiselect" | "text" | "confirm"
  question: string             // The question text (supports Markdown)
  context?: string             // Additional context (supports Markdown)
  options?: QuestionOption[]   // For select/multiselect types
  placeholder?: string         // For text input
  required?: boolean           // Must answer before continuing
  taskId?: string              // Associated task (if any)
}

/**
 * User's response to a question
 */
interface HumanLoopResponse {
  questionId: string
  value: string | string[] | boolean  // Depends on question type
  timestamp: number
}

// Human-in-the-loop events
type HumanLoopRequestEvent = {
  type: "human:request"
  questions: HumanLoopQuestion[]      // Can ask multiple questions at once
  context?: string                     // Markdown context for the entire prompt
  taskId?: string                      // If related to a specific task
  blocking: boolean                    // If true, execution pauses until answered
}

type HumanLoopResponseEvent = {
  type: "human:response"
  responses: HumanLoopResponse[]
}

type HumanLoopCancelEvent = {
  type: "human:cancel"
  reason?: string
}
```

### Render State (Suggested Internal State)

```typescript
interface DashboardState {
  sessionId: string
  mode: "live" | "replay"

  // Phases
  phases: Array<{
    number: number
    name: string
    status: "pending" | "active" | "complete"
    taskIds: string[]
  }>
  currentPhaseNumber: number | null

  // Tasks (keyed by taskId)
  tasks: Map<string, TaskRenderState>
  currentTaskId: string | null

  // Human-in-the-loop
  pendingQuestions: HumanLoopQuestion[] | null  // Currently awaiting input
  questionContext: string | null                 // Markdown context for questions
  isBlocking: boolean                           // If true, execution paused

  // UI state
  activePanel: "tasks" | "input" | "taskData"   // Which panel has focus
  selectedTaskId: string | null                 // For task data viewing

  // Session
  startTime: number
  endTime: number | null
  summary: HarnessSummary | null
}

interface TaskRenderState {
  task: ParsedTask

  // Status progression
  status: "pending" | "running" | "validating" | "complete" | "failed" | "skipped" | "retrying" | "awaiting-input"

  // Timing
  startTime: number | null
  endTime: number | null
  durationMs: number | null

  // Monologue
  narratives: NarrativeEntry[]
  currentNarrative: string | null  // Most recent, for streaming display

  // Results
  result: TaskResult | null
  validationResult: ValidationResult | null
  failure: FailureRecord | null

  // Retries
  retryCount: number
  maxRetries: number

  // Token tracking
  tokenUsage: TokenUsage | null
}

interface InputState {
  // For select/multiselect
  selectedIndex: number
  selectedValues: Set<string>  // For multiselect

  // For text input
  textValue: string
  cursorPosition: number
}
```

---

## User Scenarios & Testing

### User Story 1 - Real-Time Task Observation (Priority: P1)

As a developer running a harness, I want to see each task's progress in real-time so that I understand what the agent is doing and can intervene if needed.

**Acceptance Scenarios**:

1. **Given** harness starts, **When** a task begins, **Then** the dashboard shows the task section with status "running".
2. **Given** a task is running, **When** narrative events arrive, **Then** the monologue streams into the task section.
3. **Given** a task completes, **When** results arrive, **Then** duration, files modified, and token usage are displayed.

### User Story 2 - Segmented Phase/Task View (Priority: P1)

As a user, I want tasks grouped by phase with clear visual separation so I can understand the workflow structure.

**Acceptance Scenarios**:

1. **Given** tasks belong to different phases, **When** displayed, **Then** they're grouped under phase headers.
2. **Given** a phase starts, **When** phase:start event arrives, **Then** the phase section expands/activates.
3. **Given** multiple tasks in a phase, **When** viewing, **Then** I can see all tasks' status at a glance.

### User Story 3 - Monologue-Centric Display (Priority: P1)

As a user, I want the agent's monologue to be prominent so I understand what's happening in human terms.

**Acceptance Scenarios**:

1. **Given** a task section, **When** narratives stream in, **Then** they appear as the primary content.
2. **Given** multiple narrative entries, **When** displayed, **Then** they form a coherent story.
3. **Given** narrative metadata, **When** available, **Then** I can optionally see event count and latency.

### User Story 4 - Rich Metadata Display (Priority: P2)

As a user, I want to see execution metrics so I can understand performance characteristics.

**Acceptance Scenarios**:

1. **Given** task completes, **When** result arrives, **Then** duration is shown (e.g., "2.5s").
2. **Given** token usage data, **When** displayed, **Then** I see input/output/cache tokens.
3. **Given** validation result, **When** displayed, **Then** I see pass/fail with confidence score.
4. **Given** retry events, **When** displayed, **Then** I see attempt count and failure reason.

### User Story 5 - Session Summary (Priority: P2)

As a user, I want a final summary when execution completes so I know the overall outcome.

**Acceptance Scenarios**:

1. **Given** harness completes, **When** summary arrives, **Then** aggregate stats are displayed.
2. **Given** failed tasks exist, **When** viewing summary, **Then** failures are highlighted.
3. **Given** session data, **When** displayed, **Then** total duration and token usage are shown.

### User Story 6 - Human-in-the-Loop Input (Priority: P1)

As a user, I want to respond to agent questions so that the harness can make informed decisions requiring human judgment.

**Why this priority**: Like Claude Code, the harness needs human input for ambiguous decisions, confirmations, or choices. Without this, automation is limited.

**Acceptance Scenarios**:

1. **Given** a `human:request` event arrives, **When** blocking is true, **Then** an input modal/panel appears prominently.
2. **Given** a select question, **When** displayed, **Then** I see options as selectable choices (keyboard navigable).
3. **Given** a multiselect question, **When** displayed, **Then** I can toggle multiple options before submitting.
4. **Given** a text question, **When** displayed, **Then** I see a text input box with optional placeholder.
5. **Given** a confirm question, **When** displayed, **Then** I see Yes/No buttons or similar.
6. **Given** question context in Markdown, **When** displayed, **Then** the Markdown is rendered properly.
7. **Given** I submit a response, **When** submitted, **Then** a `human:response` event is emitted and execution continues.

### User Story 7 - View Task Data (Priority: P2)

As a user, I want to see the full task data/ticket so I understand exactly what the agent is working on.

**Acceptance Scenarios**:

1. **Given** a task section, **When** I press a key (e.g., 'd' for data), **Then** I see the full `ParsedTask` object.
2. **Given** task data view, **When** displayed, **Then** it shows: ID, description, phase, dependencies, file paths, validation criteria, flags.
3. **Given** task data view, **When** data is long, **Then** it's scrollable.
4. **Given** file paths in task data, **When** displayed, **Then** they're clearly listed and readable.

### User Story 8 - Markdown Rendering (Priority: P1)

As a user, I want Markdown content to be rendered properly so that formatted text, code blocks, and lists are readable.

**Why this priority**: Monologues, questions, and context often contain Markdown. Raw Markdown is hard to read.

**Acceptance Scenarios**:

1. **Given** narrative text with Markdown, **When** displayed, **Then** formatting is applied (bold, italic, code).
2. **Given** code blocks in Markdown, **When** displayed, **Then** they appear in a distinct style (monospace, different background).
3. **Given** lists in Markdown, **When** displayed, **Then** bullets/numbers render correctly.
4. **Given** headers in Markdown, **When** displayed, **Then** they stand out visually.

---

## Requirements

### Functional Requirements

**Core Display:**
- **FR-001**: Dashboard MUST subscribe to the unified event bus to receive all harness events.
- **FR-002**: Dashboard MUST display tasks grouped by phase with visual separation.
- **FR-003**: Dashboard MUST show each task in a segmented section with status, monologue, and metadata.
- **FR-004**: Dashboard MUST stream narrative updates in real-time as they arrive.
- **FR-005**: Dashboard MUST display task metadata including duration, files modified, and token usage.
- **FR-006**: Dashboard MUST show validation status with pass/fail and confidence.
- **FR-007**: Dashboard MUST handle retry events with attempt count and failure reason.
- **FR-008**: Dashboard MUST display a session summary on harness completion.
- **FR-009**: Dashboard MUST support both "live" and "replay" modes.
- **FR-010**: Dashboard MUST be responsive to different terminal/screen sizes.

**Human-in-the-Loop:**
- **FR-011**: Dashboard MUST handle `human:request` events by displaying an input interface.
- **FR-012**: Dashboard MUST support question types: `select`, `multiselect`, `text`, and `confirm`.
- **FR-013**: Dashboard MUST allow keyboard navigation through select/multiselect options.
- **FR-014**: Dashboard MUST emit `human:response` events when user submits answers.
- **FR-015**: Dashboard MUST display question context with Markdown rendering.
- **FR-016**: Dashboard MUST visually indicate when execution is blocked awaiting input.
- **FR-017**: Dashboard MUST support canceling/skipping optional questions.

**Task Data Viewing:**
- **FR-018**: Dashboard MUST allow viewing full task data (ParsedTask) for any task.
- **FR-019**: Dashboard MUST display task data in a readable, formatted panel.
- **FR-020**: Dashboard MUST support scrolling through long task data.

**Markdown Rendering:**
- **FR-021**: Dashboard MUST render Markdown in narratives, questions, and context.
- **FR-022**: Dashboard MUST render code blocks with distinct styling.
- **FR-023**: Dashboard MUST render lists, headers, bold, italic, and inline code.

**Technology:**
- **FR-024**: Dashboard MUST be implemented using HTML5, CSS3, and JavaScript/TypeScript.
- **FR-025**: Dashboard MUST use a terminal/retro aesthetic with monospace fonts and box-drawing styling.
- **FR-026**: Dashboard MUST use a Markdown library (marked, markdown-it, etc.) with syntax highlighting for code blocks.
- **FR-027**: Dashboard MUST support real-time updates via WebSocket or Server-Sent Events.
- **FR-028**: Dashboard MUST support keyboard navigation throughout the interface.

### Required Components (MUST implement)

| Component | Description |
|-----------|-------------|
| **Session Header** | Shows session ID, mode (live/replay), start time, overall progress |
| **Phase Container** | Groups tasks by phase, shows phase name and task count |
| **Task Section** | Individual task display with status, monologue, and metadata |
| **Monologue Stream** | Real-time narrative display within task section (Markdown rendered) |
| **Metadata Panel** | Duration, tokens, files modified, validation status |
| **Status Indicator** | Visual status (pending/running/validating/complete/failed/retrying/awaiting-input) |
| **Summary Footer** | Final session summary with aggregate stats |
| **Input Modal** | For human-in-the-loop questions (select, multiselect, text, confirm) |
| **Task Data Panel** | Expandable/modal view of full ParsedTask data |
| **Text Input Box** | For free-form text input responses |
| **Option Selector** | For select/multiselect question types |

---

## Creative Freedom Areas

**You have full creative latitude in these areas:**

### Visual Design
- Color schemes and theming (dark mode, light mode, custom palettes)
- Typography and font choices
- Icon sets and visual indicators
- Animation and transitions
- Layout proportions and spacing

### Layout Architecture
- Vertical timeline vs horizontal flow
- Accordion/collapsible sections vs always-visible
- Split pane (task list + detail) vs unified view
- Fixed header/footer vs scrolling
- Mobile-responsive breakpoints

### Interaction Patterns
- Keyboard navigation
- Click-to-expand vs hover-to-reveal
- Search and filter functionality
- Zoom/focus modes for individual tasks
- History scrollback behavior

### Monologue Presentation
- Chat bubble style vs log stream vs prose blocks
- Avatar/agent icons vs text labels
- Timestamp display format
- Narrative importance highlighting
- "Typing" indicator animations

### Metadata Visualization
- Progress bars vs percentage text
- Token usage charts (pie, bar, sparkline)
- Duration display format (2.5s vs 2500ms vs "about 3 seconds")
- Validation confidence as color gradient, percentage, or stars
- File path display (full path, filename only, tree view)

### Web Framework Choices
- Vanilla JS, React, Vue, Svelte, or other frameworks
- CSS-in-JS, Tailwind, vanilla CSS, or SCSS
- Component libraries (if any) for terminal-style widgets
- Chart libraries for visualizations (Chart.js, D3, etc.)

### Terminal Aesthetic Variations
- Classic green-on-black (Matrix style)
- Amber/orange phosphor CRT look
- Modern dark theme (VS Code, GitHub Dark)
- Retro computing (C64, Apple II, DOS)
- Cyberpunk/synthwave neon

### Personality & Polish
- Loading states and skeletons
- Error presentation style
- Empty states
- Sound effects or audio cues (optional)
- Easter eggs

---

## Inspirational Examples

### GitHub Actions Style
```
┌─ Phase 1: Setup ────────────────────────────────────────────┐
│  ✓ T001 Create project structure              2.3s   1.2k ▼ │
│  ● T002 Initialize dependencies...                          │
│    │ "I'm reading package.json to understand the deps..."   │
│    │ "Found 12 dependencies, checking for conflicts..."     │
│    └────────────────────────────────────────────────────────│
│  ○ T003 Configure TypeScript                      (waiting) │
└─────────────────────────────────────────────────────────────┘
```

### Chat/Messenger Style
```
╭──────────────────────────────────────────────────────────────╮
│ T015 - Implement validation logic                    RUNNING │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🤖 Coder                                          12:34:56  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ I'm looking at the validation requirements...           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  🤖 Coder                                          12:35:02  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Found the schema, now implementing Zod validation.     ││
│  │ Adding checks for required fields...                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
╰─────────────────────────────── tokens: 2.1k │ elapsed: 12s ──╯
```

### Dashboard/Metrics Style
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  SESSION abc123   │   LIVE   │   ▰▰▰▰▱▱▱▱▱▱ 4/10 tasks        ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                               ┃
┃  ╔══ T004 ══════════════════════════════════════════════════╗ ┃
┃  ║ ● RUNNING │ Phase 2 │ deps: T001, T002                   ║ ┃
┃  ║─────────────────────────────────────────────────────────║ ┃
┃  ║                                                          ║ ┃
┃  ║ "I've analyzed the existing code structure and found    ║ ┃
┃  ║  three areas that need modification. Starting with the  ║ ┃
┃  ║  config parser..."                                       ║ ┃
┃  ║                                                          ║ ┃
┃  ║─────────────────────────────────────────────────────────║ ┃
┃  ║ ⏱ 8.2s   📄 2 files   🔤 1,847 tokens   🔄 attempt 1/3   ║ ┃
┃  ╚══════════════════════════════════════════════════════════╝ ┃
┃                                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Human-in-the-Loop Modal
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  SESSION abc123   │   AWAITING INPUT   │   ▰▰▰▱▱▱▱▱▱▱ 3/10    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                               ┃
┃  ╔══════════════════════════════════════════════════════════╗ ┃
┃  ║                    🤔 Question                            ║ ┃
┃  ╠══════════════════════════════════════════════════════════╣ ┃
┃  ║                                                          ║ ┃
┃  ║  I found two possible approaches for the validation:    ║ ┃
┃  ║                                                          ║ ┃
┃  ║  **Context:** The existing code uses both Zod and       ║ ┃
┃  ║  manual validation. Which should I standardize on?      ║ ┃
┃  ║                                                          ║ ┃
┃  ╠──────────────────────────────────────────────────────────╣ ┃
┃  ║  Which validation approach should I use?                ║ ┃
┃  ║                                                          ║ ┃
┃  ║    ● Zod schemas (type-safe, composable)                ║ ┃
┃  ║    ○ Manual validation (explicit, no dependencies)      ║ ┃
┃  ║    ○ Keep both (maintain compatibility)                 ║ ┃
┃  ║                                                          ║ ┃
┃  ╠──────────────────────────────────────────────────────────╣ ┃
┃  ║                            [Enter] Submit  [Esc] Cancel  ║ ┃
┃  ╚══════════════════════════════════════════════════════════╝ ┃
┃                                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Text Input Example
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  SESSION abc123   │   AWAITING INPUT   │   ▰▰▰▰▰▱▱▱▱▱ 5/10    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                               ┃
┃  ╔══════════════════════════════════════════════════════════╗ ┃
┃  ║                    📝 Input Required                      ║ ┃
┃  ╠══════════════════════════════════════════════════════════╣ ┃
┃  ║                                                          ║ ┃
┃  ║  The config file needs an API endpoint. I couldn't      ║ ┃
┃  ║  find one in the environment or existing config.        ║ ┃
┃  ║                                                          ║ ┃
┃  ║  Please provide the API base URL:                       ║ ┃
┃  ║                                                          ║ ┃
┃  ║  ┌──────────────────────────────────────────────────┐   ║ ┃
┃  ║  │ https://api.example.com/v1█                      │   ║ ┃
┃  ║  └──────────────────────────────────────────────────┘   ║ ┃
┃  ║                                                          ║ ┃
┃  ╠──────────────────────────────────────────────────────────╣ ┃
┃  ║                            [Enter] Submit  [Esc] Cancel  ║ ┃
┃  ╚══════════════════════════════════════════════════════════╝ ┃
┃                                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Task Data View
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  SESSION abc123   │   LIVE   │   ▰▰▰▰▱▱▱▱▱▱ 4/10 tasks        ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                               ┃
┃  ╔══ T004 - Task Data ══════════════════════════════════════╗ ┃
┃  ║                                                          ║ ┃
┃  ║  ID:           T004                                      ║ ┃
┃  ║  Phase:        Phase 2: Implementation                   ║ ┃
┃  ║  Status:       running                                   ║ ┃
┃  ║                                                          ║ ┃
┃  ║  Description:                                            ║ ┃
┃  ║  ────────────────────────────────────────────────────    ║ ┃
┃  ║  Implement Zod validation schemas for all API request   ║ ┃
┃  ║  and response types. Ensure type safety across the      ║ ┃
┃  ║  entire data flow.                                       ║ ┃
┃  ║                                                          ║ ┃
┃  ║  Dependencies:  T001, T002, T003                         ║ ┃
┃  ║  User Story:    US2                                      ║ ┃
┃  ║                                                          ║ ┃
┃  ║  Files:                                                  ║ ┃
┃  ║    • src/schemas/request.ts                              ║ ┃
┃  ║    • src/schemas/response.ts                             ║ ┃
┃  ║    • src/types/api.ts                                    ║ ┃
┃  ║                                                          ║ ┃
┃  ║  Validation Criteria:                                    ║ ┃
┃  ║  ────────────────────────────────────────────────────    ║ ┃
┃  ║  All request/response schemas defined and exported.     ║ ┃
┃  ║  Type inference works correctly with TypeScript.        ║ ┃
┃  ║                                                          ║ ┃
┃  ║  Flags:  [P] parallel                                    ║ ┃
┃  ║                                                          ║ ┃
┃  ╠──────────────────────────────────────────────────────────╣ ┃
┃  ║                                        [d] Close  [↑↓] ▼ ║ ┃
┃  ╚══════════════════════════════════════════════════════════╝ ┃
┃                                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Dashboard renders all task events correctly (start, narrative, complete, failed, skipped, retry).
- **SC-002**: Narratives stream in real-time without buffering delay visible to user.
- **SC-003**: All core metadata is displayed (duration, tokens, files, validation).
- **SC-004**: Phase grouping correctly separates tasks.
- **SC-005**: Session summary displays accurate aggregate stats.
- **SC-006**: Dashboard handles edge cases gracefully (no tasks, all failures, empty phases).
- **SC-007**: Human-in-the-loop questions display correctly and capture user input.
- **SC-008**: Markdown renders properly in narratives, questions, and context.
- **SC-009**: Task data view shows complete ParsedTask information.
- **SC-010**: Keyboard navigation works for select/multiselect question types.
- **SC-011**: Text input captures and submits user-provided values.

---

## Notes for Creative Agents

When implementing this dashboard, feel free to:

1. **Express a visual personality** - The examples above are just starting points. Invent your own aesthetic.
2. **Prioritize what matters** - You decide how much prominence each piece of data gets.
3. **Add delightful touches** - Loading animations, transitions, subtle polish.
4. **Make it usable** - Good UX is creative work too.
5. **Push boundaries** - ASCII art, Unicode box drawing, color gradients, whatever serves the user.

The goal is a dashboard that makes watching task execution **interesting, informative, and even enjoyable**. Make something you'd want to stare at.
