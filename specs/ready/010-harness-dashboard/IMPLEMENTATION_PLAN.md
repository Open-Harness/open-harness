# Harness Dashboard Implementation Plan

**Feature**: 010-harness-dashboard  
**Status**: Planning → Implementation  
**Created**: 2025-12-27

## Overview

Build a terminal-based dashboard using Blessed/Blessed-contrib to visualize harness execution in real-time. The dashboard subscribes to UnifiedEventBus and renders:
- Task execution progress grouped by phases
- Streaming monologue/narrative updates
- Metadata (duration, tokens, files, validation)
- Human-in-the-loop input handling
- Task data inspection

## Architecture

### Core Components

1. **DashboardState** - Internal state management
2. **EventSubscription** - Subscribe to UnifiedEventBus
3. **UI Components**:
   - SessionHeader - Session info and progress
   - PhaseContainer - Phase grouping
   - TaskSection - Individual task display
   - MonologueStream - Narrative display
   - MetadataPanel - Duration, tokens, files
   - InputModal - Human-in-the-loop questions
   - TaskDataPanel - Full task details
   - SummaryFooter - Session summary

### Technology Stack

- **Blessed** - Terminal UI framework
- **Blessed-contrib** - Dashboard widgets
- **TypeScript 5.x** - Strict mode
- **UnifiedEventBus** - Event subscription

## Implementation Steps

### Phase 1: Foundation
1. ✅ Add dependencies (blessed, blessed-contrib, @types/blessed)
2. ✅ Create dashboard types/interfaces
3. ✅ Create DashboardState class
4. ✅ Create event subscription wrapper

### Phase 2: Core UI
5. ✅ Create Blessed screen and layout
6. ✅ Implement SessionHeader
7. ✅ Implement PhaseContainer
8. ✅ Implement TaskSection

### Phase 3: Content Display
9. ✅ Implement MonologueStream with Markdown
10. ✅ Implement MetadataPanel
11. ✅ Implement status indicators

### Phase 4: Interactive Features
12. ✅ Implement InputModal (select, multiselect, text, confirm)
13. ✅ Implement TaskDataPanel
14. ✅ Add keyboard navigation

### Phase 5: Polish
15. ✅ Implement SummaryFooter
16. ✅ Add error handling
17. ✅ Test with real harness execution

## File Structure

```
packages/sdk/src/dashboard/
├── index.ts                    # Main export
├── dashboard.ts                # Main Dashboard class
├── state.ts                    # DashboardState management
├── types.ts                    # Type definitions
├── components/
│   ├── session-header.ts       # Session header component
│   ├── phase-container.ts      # Phase grouping
│   ├── task-section.ts         # Task display
│   ├── monologue-stream.ts     # Narrative display
│   ├── metadata-panel.ts        # Metadata display
│   ├── input-modal.ts          # Human-in-the-loop input
│   ├── task-data-panel.ts      # Task data view
│   └── summary-footer.ts       # Session summary
└── utils/
    ├── markdown.ts             # Markdown rendering helpers
    └── layout.ts               # Layout utilities
```

## Key Design Decisions

1. **State Management**: Centralized DashboardState class tracks all UI state
2. **Event Handling**: Single subscription to UnifiedEventBus, route events to handlers
3. **Markdown Rendering**: Use Blessed's markdown widget or custom renderer
4. **Layout**: Grid-based layout using blessed-contrib grid
5. **Focus Management**: Blessed's built-in focus system
6. **Keyboard Navigation**: Standard vim-style (j/k) + custom shortcuts

## Testing Strategy

1. Unit tests for state management
2. Integration tests with mock event bus
3. Manual testing with real harness execution
4. Test all question types (select, multiselect, text, confirm)
5. Test edge cases (no tasks, all failures, empty phases)

## Success Criteria

- ✅ All events render correctly
- ✅ Narratives stream in real-time
- ✅ All metadata displays correctly
- ✅ Human-in-the-loop questions work
- ✅ Markdown renders properly
- ✅ Keyboard navigation works
- ✅ Task data view accessible
- ✅ Session summary displays

