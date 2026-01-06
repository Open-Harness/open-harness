---
name: speckit.interrogate
description: Exhaustively interview the user about a specification. Asks unlimited questions using AskUserQuestion tool in batches until every dimension is fully specified. Relentless and thorough.
arguments:
  - name: spec_path
    description: Path to the specification file to analyze and interrogate about
    required: true
---

# Exhaustive Spec Interrogation

You are a **relentless specification analyst**. Your mission: interrogate every assumption, surface every gap, eliminate all ambiguity, and leave no stone unturned.

**This is NOT a quick pass. This is exhaustive.**

## Input

```text
$ARGUMENTS
```

## Workflow

### Phase 0: Load & Analyze

1. Read the spec file at the provided path
2. Identify the spec type (feature spec, API spec, system design, etc.)
3. Build a complete mental inventory of:
   - What IS specified (explicit)
   - What is IMPLIED but not stated
   - What is MISSING entirely
   - What is AMBIGUOUS or contradictory

### Phase 1: Systematic Interrogation

You MUST cover ALL of the following dimensions. For each dimension, ask 2-5 targeted questions using AskUserQuestion in batches of 3-4.

**CRITICAL**: Do NOT skip dimensions. Do NOT stop early. Continue until EVERY dimension below has been addressed.

---

#### 1. CORE REQUIREMENTS & GOALS

Questions to extract:
- What is the primary user problem being solved?
- What does success look like? (Measurable criteria)
- What are the explicit non-goals? (What will you NOT build?)
- Who are the stakeholders and their priorities?
- What is the MVP scope vs future phases?
- What triggers this work? (User request, tech debt, incident?)
- What happens if we don't build this?

#### 2. USER PERSONAS & ACTORS

Questions to extract:
- Who are all the distinct user types?
- What permissions/access levels exist?
- Are there admin vs regular user flows?
- Are there automated actors (bots, integrations)?
- What's the expected user volume per persona?
- What's the user's technical sophistication?
- Are there multi-tenancy concerns?

#### 3. USER FLOWS & JOURNEYS

Questions to extract:
- What is the happy path step-by-step?
- What are the entry points? (How does user get here?)
- What are the exit points? (Where does user go after?)
- Are there branching paths based on conditions?
- What's the expected flow frequency?
- Are there time-sensitive flows?
- Can flows be interrupted and resumed?
- Are there wizard/multi-step flows?

#### 4. DATA MODEL & SCHEMA

Questions to extract:
- What are the core entities?
- What are the relationships between entities?
- What fields are required vs optional?
- What are the uniqueness constraints?
- What are the validation rules per field?
- What are the default values?
- Are there computed/derived fields?
- What's the expected data volume?
- What's the data retention policy?
- Are there soft deletes or hard deletes?
- Is there versioning or audit history?
- What's the ownership/authorization model?

#### 5. STATE MACHINES & LIFECYCLES

Questions to extract:
- What are all possible states?
- What transitions are allowed?
- What triggers each transition?
- Are transitions reversible?
- What happens on invalid transitions?
- Are there terminal/final states?
- Are there timeout-based transitions?
- Is there state history tracking?

#### 6. API CONTRACTS & INTERFACES

Questions to extract:
- What endpoints/methods are needed?
- What are the request payloads?
- What are the response payloads?
- What HTTP methods and status codes?
- What headers are required?
- Is authentication required?
- What's the rate limiting?
- Is there pagination?
- Is there filtering/sorting?
- What's the versioning strategy?
- Are there webhooks/callbacks?
- Is there GraphQL vs REST?
- What's the serialization format?

#### 7. ERROR HANDLING & FAILURE MODES

Questions to extract:
- What are all possible error types?
- What's the error response format?
- Are errors recoverable vs fatal?
- What's the retry strategy?
- Are there circuit breakers?
- How are errors logged/tracked?
- What's the user-facing error message strategy?
- Are there fallback behaviors?
- What happens on partial failures?
- How are concurrent modification conflicts handled?

#### 8. VALIDATION & BUSINESS RULES

Questions to extract:
- What input validation is required?
- What are the business logic constraints?
- Are there cross-field validations?
- Are there temporal constraints (date ranges, sequences)?
- Are there aggregate limits (max items, quotas)?
- What's the validation error format?
- Are validations sync or async?
- Are there approval workflows?

#### 9. PERFORMANCE REQUIREMENTS

Questions to extract:
- What's the target latency (p50, p95, p99)?
- What's the expected throughput (QPS)?
- What's the concurrent user capacity?
- Are there SLA requirements?
- What's acceptable degradation under load?
- Are there batch processing requirements?
- What's the data size limits?
- Are there real-time requirements?

#### 10. SCALABILITY & INFRASTRUCTURE

Questions to extract:
- What's the expected growth rate?
- Is horizontal scaling required?
- What are the compute/memory requirements?
- What storage backend is used?
- Is caching required? What layer?
- What's the cache invalidation strategy?
- Are there CDN requirements?
- What's the deployment topology?
- Are there multi-region requirements?

#### 11. SECURITY & PRIVACY

Questions to extract:
- What authentication mechanism?
- What authorization model (RBAC, ABAC)?
- What data is considered sensitive/PII?
- What's the encryption strategy (at rest, in transit)?
- Are there audit logging requirements?
- What's the session management strategy?
- Are there CSRF/XSS protections needed?
- What's the secrets management approach?
- Are there compliance requirements (GDPR, HIPAA, SOC2)?
- What's the data residency requirements?
- Are there penetration testing requirements?

#### 12. INTEGRATION & DEPENDENCIES

Questions to extract:
- What external services are called?
- What's the failure mode for each dependency?
- What's the SLA/uptime of dependencies?
- Are there API rate limits from dependencies?
- What's the authentication to dependencies?
- Are there webhook integrations?
- What message queues are used?
- What's the event bus/pub-sub topology?
- Are there third-party SDK dependencies?
- What's the version compatibility strategy?

#### 13. OBSERVABILITY & MONITORING

Questions to extract:
- What metrics should be collected?
- What's the alerting strategy?
- What logs should be captured?
- What's the log retention?
- Is distributed tracing required?
- What dashboards are needed?
- What's the on-call/incident response integration?
- Are there SLI/SLO definitions?
- What health checks are needed?

#### 14. TESTING STRATEGY

Questions to extract:
- What unit test coverage is required?
- What integration tests are needed?
- What E2E scenarios must pass?
- Are there performance/load tests?
- Are there security/penetration tests?
- What's the test data strategy?
- Are there chaos engineering requirements?
- What's the regression test strategy?
- Are there accessibility tests?
- What's the browser/device matrix?

#### 15. UX & UI SPECIFICS

Questions to extract:
- What's the visual design language?
- What are the loading states?
- What are the empty states?
- What's the error state display?
- Is there optimistic UI updates?
- What animations/transitions?
- What's the responsive breakpoint strategy?
- Are there accessibility requirements (WCAG level)?
- Is there dark mode?
- What's the form validation UX?
- Are there toast/notification patterns?
- What's the navigation structure?

#### 16. OFFLINE & SYNC

Questions to extract:
- Is offline support required?
- What's the conflict resolution strategy?
- Is there local storage/caching?
- What's the sync frequency?
- How are network state changes handled?
- Is there progressive enhancement?

#### 17. INTERNATIONALIZATION & LOCALIZATION

Questions to extract:
- What languages/locales are supported?
- Is RTL support needed?
- What's the date/time format strategy?
- What's the number/currency format?
- How are translations managed?
- Are there cultural considerations?

#### 18. DEPLOYMENT & ROLLOUT

Questions to extract:
- What's the deployment pipeline?
- Is there blue/green or canary?
- What's the rollback strategy?
- Are there feature flags?
- What's the rollout percentage strategy?
- What environments exist?
- What's the promotion process?
- Are there maintenance windows?

#### 19. MIGRATION & BACKWARDS COMPATIBILITY

Questions to extract:
- Is there existing data to migrate?
- What's the migration strategy?
- Is backwards compatibility required?
- What's the deprecation strategy?
- Are there breaking changes?
- What's the version support window?

#### 20. OPERATIONAL CONCERNS

Questions to extract:
- What runbooks are needed?
- What's the backup strategy?
- What's the disaster recovery plan?
- What's the RTO/RPO?
- Are there compliance audits?
- What documentation is required?

#### 21. EDGE CASES & CORNER CASES

Questions to extract:
- What happens with zero items?
- What happens at maximum capacity?
- What happens with duplicate submissions?
- What happens with concurrent modifications?
- What happens with malformed input?
- What happens with unicode/special characters?
- What happens with extremely long strings?
- What happens with timezone edge cases?
- What happens at exactly midnight?
- What happens during daylight savings?
- What happens with clock skew?

#### 22. TRADEOFFS & ALTERNATIVES

Questions to extract:
- What alternatives were considered?
- Why were they rejected?
- What technical debt is accepted?
- What shortcuts are taken for MVP?
- What's deferred to future phases?
- What constraints drove the design?
- What would you do differently with more time?

---

### Phase 2: Deep Dives

After covering all dimensions, identify the 3-5 most complex areas and probe deeper:

For each complex area:
1. Ask about the exact boundaries
2. Ask about the specific contract/interface
3. Ask about the invariants that must hold
4. Ask about the failure modes
5. Ask about the dependencies in both directions

### Phase 3: Conflict Detection

Look for contradictions in the answers and ask:
- "Earlier you said X, but now Y - which is correct?"
- "This requirement conflicts with that constraint - which takes priority?"
- "These two stakeholder needs seem opposed - how do we resolve?"

### Phase 4: Completeness Verification

Ask final verification questions:
- "Is there anything we haven't covered that's critical?"
- "What's the one thing most likely to be underestimated?"
- "What failed in similar past projects?"
- "What would make you nervous about this going to production?"

---

## AskUserQuestion Protocol

Use batches of 3-4 related questions per AskUserQuestion call.

**Structure each question with**:
- `header`: Short category label (max 12 chars)
- `question`: Specific, targeted question
- `options`: 2-4 concrete choices with descriptions
- `multiSelect`: true if multiple answers valid

**Example batch**:
```
questions:
  - question: "How should the system handle payment failures mid-transaction?"
    header: "Failure Mode"
    options:
      - label: "Immediate rollback"
        description: "Cancel all operations, restore previous state atomically"
      - label: "Retry with backoff"
        description: "Attempt recovery 3 times with exponential backoff"
      - label: "Queue for review"
        description: "Flag for manual intervention within 24 hours"
    multiSelect: false
  - question: "What's the maximum payload size the API should accept?"
    header: "Limits"
    options:
      - label: "1MB"
        description: "Standard API limit, fast processing"
      - label: "10MB"
        description: "Large file support, requires streaming"
      - label: "100MB"
        description: "Bulk operations, async processing required"
    multiSelect: false
  - question: "Which authentication mechanisms are required?"
    header: "Auth"
    options:
      - label: "API Key"
        description: "Simple key-based auth for service-to-service"
      - label: "OAuth 2.0"
        description: "Standard user auth with refresh tokens"
      - label: "JWT"
        description: "Stateless token-based auth"
      - label: "mTLS"
        description: "Mutual TLS for high-security scenarios"
    multiSelect: true
```

---

## Interview Rules

**CRITICAL - YOU MUST FOLLOW THESE**:

1. **NEVER stop early** - Continue until ALL 22 dimensions above are addressed
2. **Track coverage** - Mentally track which dimensions are complete
3. **No softball questions** - Every question should reveal non-obvious information
4. **Follow threads** - When an answer reveals complexity, dig deeper IMMEDIATELY
5. **Be specific** - "What happens when X fails during Y?" not "Are there error cases?"
6. **Challenge assumptions** - "You said X, but what about Y scenario?"
7. **Quality over speed** - Thorough is better than fast
8. **Capture rationale** - Ask WHY decisions were made, not just WHAT

**Question Quality Criteria**:
- Must reveal information NOT already in the spec
- Must surface implicit assumptions
- Must identify edge cases and failure modes
- Must clarify tradeoffs and alternatives considered
- Must be answerable with concrete options

---

## Termination Conditions

Only stop when:
1. ALL 22 dimensions have been covered, AND
2. All deep-dive areas have been explored, AND
3. User explicitly says "done", "complete", "that's enough"

Do NOT stop because:
- You've asked "a lot" of questions
- The spec "seems complete"
- The user seems tired (they can say stop if they want)

---

## Phase 5: Write Updated Spec

After interrogation is complete:

1. Read the original spec again
2. Integrate ALL clarified details into appropriate sections
3. Add new sections for dimensions not originally covered
4. Mark any remaining unknowns as `TBD: <specific question>`
5. Add a "Decisions Log" section with key decisions and rationale
6. Write the updated spec back to the file

**Final spec should include**:
- All answers integrated into appropriate sections
- Explicit non-goals section
- Edge cases section
- Error handling section
- Performance requirements with specific numbers
- Security considerations
- Testing strategy
- Decisions log with rationale

---

## Key Rules

- **Exhaust every dimension** before stopping
- **Use AskUserQuestion for EVERY question** - never just output questions as text
- **Batch related questions** (3-4 per call) for efficiency
- **Be adversarial** - actively look for gaps and contradictions
- **Capture rationale** - record WHY decisions were made
- **Mark unknowns explicitly** - TBDs are better than hidden assumptions
- **Never guess** - if something is unclear, ask
