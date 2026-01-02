# The Call: Islamic Prayer Companion

> **Production OpenHarness application demonstrating the Temporal Accumulation Pattern**

---

## What is The Call?

**The Call** is a voice-first AI companion that helps Muslim professionals organize their lives around prayer times. Unlike simple prayer apps that just calculate times and send notifications, The Call uses a sophisticated multi-agent system to:

- **Learn your patterns** - Understands your routine over weeks
- **Make smart decisions** - Notifies at the right time based on context
- **Build confidence** - Gets smarter as evidence accumulates
- **Provide reasoning** - Every decision is explainable

---

## Documentation in this Folder

### 📐 [architecture.md](./architecture.md)
**Overall system architecture** - How The Call works at a high level

- System components (iOS app, harness, agents)
- Architectural patterns (hybrid agent-supervisor)
- Multi-agent system design
- Real-world user scenarios
- Channel composition (voice, console, database)

**Read this first** to understand the big picture.

---

### 🧠 [tap-implementation.md](./tap-implementation.md)
**Complete TAP implementation** - Real code showing temporal accumulation in action

- Full harness implementation
- Three detailed agents (Location, Brain, TaskScheduler)
- Step-by-step execution example (4 runs showing confidence: 0.72 → 0.89 → 0.92)
- Learned patterns after 4 weeks
- Week 5: smart behavior based on accumulated knowledge

**Read this** to see the Temporal Accumulation Pattern in a real application.

---

### 🎨 [diagrams-channels.excalidraw](./diagrams-channels.excalidraw)
**Multi-channel composition diagram**

Visual showing how The Call uses multiple channels simultaneously:
- ElevenLabs Channel (voice conversation)
- Console Channel (developer logs)
- Database Channel (audit trail)
- Push Notification Channel (reminders)

Embedded in OPENHARNESS.md as an example of channel composition.

---

## Key Concepts Demonstrated

### 1. Temporal Accumulation Pattern (TAP)
Agents accumulate outputs over time, building confidence and learning patterns:

```typescript
// Run 1: 0.95 confidence (HOME)
// Run 2: 0.72 confidence (COMMUTING) - just transitioned
// Run 3: 0.89 confidence (COMMUTING) - higher, consistent!
// Run 4: 0.92 confidence (AT_WORK) - high, matches pattern
```

### 2. Scheduling Architecture
Brain agent outputs TASKS (not actions). Everything is scheduled, even "immediately":

```typescript
{
  action: "send_notification",
  executeAt: "immediately",  // Schedule NOW
  reasoning: "Prayer in 5 min!"
}
```

### 3. State Transitions
Agents detect and track location changes with reasoning:

```typescript
{
  from: "COMMUTING",
  to: "AT_WORK",
  transitionTime: "08:45",
  reasoning: "Arrived at work after typical commute duration"
}
```

### 4. Pattern Learning
After 4 weeks, the system learns user habits:

```typescript
prayerHabits: {
  preferredPrayerTimes: {
    dhuhr: "12:30-12:45 PM (after arrival at work)"
  },
  preferredLocations: {
    dhuhr: "WORK"
  },
  averageResponseTime: 8  // User needs 8 min lead time
}
```

---

## How They Work Together

1. **Start with architecture.md** - Understand the overall system
2. **Read tap-implementation.md** - See the actual code and execution
3. **View diagrams-channels.excalidraw** - Visualize multi-channel composition
4. **Reference parent docs** - TAP pattern, OpenHarness framework

All docs are **congruent** and reference each other appropriately.

---

## Related Documentation

- [Temporal Accumulation Pattern](../../patterns/TEMPORAL-ACCUMULATION-PATTERN.md) - The pattern explained
- [OpenHarness](../../OPENHARNESS.md) - The framework
- [TAP Diagrams](../../diagrams/) - Visual representations

---

*The Call - Intelligence through temporal accumulation*
