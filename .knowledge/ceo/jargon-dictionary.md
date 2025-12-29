# Technical Jargon Dictionary

**Purpose**: Translate CTO-speak into CEO-speak
**Last Updated**: Auto-updated by `/ceo.translate` and `/ceo.explain`
**Usage**: Referenced by all CEO commands for consistent translations

---

## Common Terms (Auto-Generated)

### API (Application Programming Interface)
**Analogy**: Restaurant menu
**Definition**: List of actions you can request from a system
**Example**: "Our API lets partners pull customer data"
**Why it matters**: Defines what our software can do for others

### Async / Asynchronous
**Analogy**: "I'll get back to you" promise
**Definition**: Code that starts a task and continues without waiting for it to finish
**Example**: "Send email async so user doesn't wait"
**Why it matters**: Keeps the app fast and responsive

### CI/CD (Continuous Integration/Continuous Deployment)
**Analogy**: Automated factory assembly line
**Definition**: Automated testing and deployment of code changes
**Example**: "CI/CD pipeline catches bugs before production"
**Why it matters**: Ship features faster with fewer bugs

### DI / Dependency Injection
**Analogy**: Company toolbox that hands out tools
**Definition**: System that provides components with what they need automatically
**Example**: "DI container provides database connection to services"
**Why it matters**: Reduces code complexity and speeds up development

### Event Bus
**Analogy**: Company bulletin board
**Definition**: Central place where system parts post announcements others can listen to
**Example**: "When user signs up, event bus notifies email service"
**Why it matters**: Features can work together without being tightly coupled

### Harness
**Analogy**: Flight simulator for code
**Definition**: Testing framework that simulates real usage
**Example**: "Harness replays user sessions to catch bugs"
**Why it matters**: Test features before customers see them

### Middleware
**Analogy**: Security checkpoint
**Definition**: Code that runs between request and response
**Example**: "Auth middleware checks login before showing data"
**Why it matters**: Handles cross-cutting concerns (security, logging, etc.)

### Monorepo
**Analogy**: One big company warehouse vs. many small storage units
**Definition**: Single repository containing multiple related projects
**Example**: "Our monorepo has CLI, SDK, and docs together"
**Why it matters**: Easier to coordinate changes across projects

### Refactoring
**Analogy**: Reorganizing the office for better workflow
**Definition**: Improving code structure without changing what it does
**Example**: "Refactoring auth code to be more maintainable"
**Why it matters**: Prevents future slowdowns and bugs

### Tech Debt / Technical Debt
**Analogy**: Business loan - borrowed time that must be repaid
**Definition**: Shortcuts taken in code that will slow us down later
**Example**: "We have tech debt in the payment system"
**Why it matters**: Accumulates interest - gets more expensive to fix over time

### Type-Safe / Type Safety
**Analogy**: Quality control checklist
**Definition**: System that catches certain mistakes before code runs
**Example**: "TypeScript provides type safety"
**Why it matters**: Fewer bugs make it to production

---

## Project-Specific Terms

### [Custom Term 1]
**Analogy**: [Custom analogy]
**Definition**: [Custom definition]
**Example**: [Usage in this project]
**Why it matters**: [Business impact]

---

## Process Terms

### Code Review
**Analogy**: Peer review before publishing
**Definition**: Developer checks another developer's code before merging
**Why it matters**: Catches bugs and shares knowledge

### Sprint / Iteration
**Analogy**: Two-week work cycle
**Definition**: Fixed timeframe for completing set of features
**Why it matters**: Predictable delivery rhythm

### Stand-up / Standup
**Analogy**: Daily team check-in
**Definition**: Brief meeting to share progress and blockers
**Why it matters**: Keep team coordinated

### PR / Pull Request
**Analogy**: Proposed change waiting for approval
**Definition**: Code changes submitted for review before merging
**Why it matters**: Gate to ensure quality before changes go live

---

## Architecture Terms

### Container (in context of DI)
**Analogy**: Tool storage and distribution system
**Definition**: Manages creation and lifetime of components
**Why it matters**: Simplifies code organization

### Pipeline (Data)
**Analogy**: Assembly line for data processing
**Definition**: Sequence of operations that transform data
**Why it matters**: Organize complex data transformations

### Service
**Analogy**: Department in a company
**Definition**: Independent component that handles specific functionality
**Why it matters**: Organize code by responsibility

### Module / Package
**Analogy**: Department or division
**Definition**: Self-contained unit of functionality
**Why it matters**: Organize large codebases into manageable pieces

---

## Performance Terms

### Cache / Caching
**Analogy**: Office filing cabinet for quick access
**Definition**: Store frequently-used data temporarily for fast retrieval
**Why it matters**: Makes app much faster

### Latency
**Analogy**: Time between asking and receiving
**Definition**: Delay between request and response
**Why it matters**: Affects user experience ("feels slow")

### Throughput
**Analogy**: How many customers served per hour
**Definition**: Amount of work system can handle in given time
**Why it matters**: Determines how many users we can support

### Bottleneck
**Analogy**: Narrow part of funnel that slows everything down
**Definition**: Component that limits overall system performance
**Why it matters**: Fixing bottlenecks has biggest performance impact

---

## Security Terms

### OAuth / OAuth2
**Analogy**: "Sign in with Google" button
**Definition**: Standard way to let users log in using another service
**Why it matters**: Users don't need new password; we don't store credentials

### Token
**Analogy**: Temporary access badge
**Definition**: Proof of identity that expires after some time
**Why it matters**: More secure than passwords

### Encryption
**Analogy**: Secret code that only authorized people can read
**Definition**: Scrambling data so only authorized parties can read it
**Why it matters**: Protects sensitive customer data

---

## Common Phrases

| CTO Says | CEO Hears |
|----------|-----------|
| "High code churn" | "This area is being changed frequently (might be unstable or being improved)" |
| "Breaking change" | "Update that requires other parts to change too" |
| "Zero runtime overhead" | "No performance cost" |
| "Developer ergonomics" | "How easy/pleasant it is for developers to use" |
| "Edge case" | "Unusual scenario that rarely happens but needs handling" |
| "Regression" | "Bug that reappeared after being fixed" |
| "Hotfix" | "Emergency bug fix deployed immediately" |
| "Feature flag" | "Toggle to turn features on/off without deploying code" |
| "Backward compatible" | "New version works with old data/integrations" |
| "Idempotent" | "Safe to run multiple times - same result" |

---

**Auto-Update Log**:
- [Timestamp]: Added [term] from `/ceo.translate` command
- [Timestamp]: Updated [term] analogy for clarity

**Note**: This dictionary is automatically updated when new terms are encountered. Analogies are tailored to this project's domain.
