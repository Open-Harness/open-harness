
<!-- MANUAL ADDITIONS START -->

## ⚠️ CRITICAL: TYPESCRIPT BUILD ARTIFACTS - READ THIS FIRST ⚠️

**NEVER emit TypeScript build artifacts into source directories.**

The build system is:
- **tsdown** → outputs to `dist/` (for bundling/publishing)
- **tsc -b** → outputs to `build/` (for type checking with project references)

**FORBIDDEN:**
- NEVER run `tsc` without proper config that sets `outDir`
- NEVER emit `.js`, `.d.ts`, `.js.map`, `.d.ts.map` files into `src/` directories
- If you see these files in `src/`, DELETE THEM IMMEDIATELY

**Correct commands:**
- `bun run build` → runs `turbo run build` → tsdown to dist/
- `bun run typecheck` → runs `turbo run typecheck` → tsc -b to build/
- `bun run lint` → ESLint (no file emission)
- `bun run test` → Vitest (no file emission)

**The .gitignore blocks these patterns but files still pollute the working directory:**
```
packages/*/src/**/*.js
packages/*/src/**/*.d.ts
apps/*/src/**/*.js
apps/*/src/**/*.d.ts
```

**If you accidentally emit files to src/, clean with:**
```bash
find packages apps -path "*/src/*" -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" -o -name "*.d.ts.map" \) -delete
```

---

## ⚠️ CRITICAL: ANTHROPIC SDK TESTING - READ THIS FIRST ⚠️

**WE HAVE AN ANTHROPIC SUBSCRIPTION. NO API KEY IS NEEDED.**

The Anthropic SDK works automatically via subscription. DO NOT:
- Add `ANTHROPIC_API_KEY` environment variable checks
- Create mock providers for testing
- Skip real SDK testing because "we don't have an API key"
- Suggest integration tests "require an API key"

**TESTING APPROACH - MANDATORY:**
1. **Record fixtures with REAL SDK**: Run provider against real Anthropic API
2. **Use ProviderRecorder**: We built this infrastructure specifically for recording/playback
3. **Tests use playback mode**: Replay recorded fixtures deterministically
4. **Never mock the SDK**: Real responses, recorded and replayed

**Why this matters:**
- We spent significant effort building ProviderRecorder for exactly this purpose
- Mock tests don't validate real SDK behavior
- The subscription handles auth automatically
- Adding API key checks BREAKS the subscription flow

**The infrastructure exists:**
- `ProviderRecorder` service records stream events
- `ProviderModeContext` switches between "live" and "playback"
- `runAgentWithStreaming` handles recording automatically in live mode

**When writing provider tests:**
1. First run: Use "live" mode → records to ProviderRecorder
2. Subsequent runs: Use "playback" mode → replays from recordings
3. Commit recorded fixtures to repo for CI

---

## ⚠️ CRITICAL: NO MOCKS TESTING PHILOSOPHY ⚠️

**NEVER use mocks or stubs that fake behavior. Every test must exercise real code paths.**

### Rules

- **No mock services**: Never create stubs that return `Effect.succeed([])` or `Effect.void`
- **No fabricated fixtures**: Test data must come from real recordings, not invented by agents
- **No in-memory fakes**: Use LibSQL `:memory:` (real SQLite with real migrations) instead of fake `Map<>`-based stubs
- **No dual code paths**: There should be ONE implementation, not "real" and "test" versions

### What to use instead

| Instead of... | Use... |
|---------------|--------|
| `EventStoreStub` | `EventStoreLive({ url: ":memory:" })` |
| `EventBusStub` | `EventBusLive` (PubSub is inherently in-memory) |
| `ProviderRecorderStub` | `ProviderRecorderLive({ url: ":memory:" })` |
| `StateSnapshotStoreStub` | `StateSnapshotStoreLive({ url: ":memory:" })` |
| Mock providers | `ProviderRecorder` playback of real recorded responses |
| Fabricated JSON fixtures | Record real API responses, commit to repo |

### Test layer setup

All tests use real implementations with ephemeral databases:

```typescript
const makeTestLayer = () =>
  Layer.mergeAll(
    EventStoreLive({ url: ":memory:" }),
    StateSnapshotStoreLive({ url: ":memory:" }),
    ProviderRecorderLive({ url: ":memory:" }),
    Layer.effect(EventBus, EventBusLive),
    Layer.succeed(ProviderModeContext, { mode: "playback" })
  )
```

### Pure functions are fine

Functions like `computeStateAt` that take arrays as input don't need services or databases. They're just functions operating on data — no mocks needed.

### Why this matters

- Stubs hide bugs (a stub that returns `[]` never tests error handling, migrations, or constraints)
- LibSQL `:memory:` is fast (no disk I/O) and exercises real SQL
- ProviderRecorder already exists for deterministic replay of real API responses
- If a test needs a mock, the architecture is wrong — fix the architecture

---

BEHAVIORAL DECORATORS:

## Think, Repete, and Give Options
> Command: `*TRO`
> Description: Think, Repete, and Give Options
> Activate `prompting` skill
    1. ULTRATHINK
    2. think about the the users request
    3. deeply understand the problem
    4. connect their thoughts together to form coherent pros
    5. identify the implicit assumptions and constraints that are not explicitly stated
    5. generate the best response optimised using the `prompting` skill
    6. present the response to the user using the ASK USER TOOL
    
    **CRITICAL**: Always give your candid and honest opinion. never equivocate and always push back if you feel the user is wrong or suggesting something obviously suboptimal.
    **CRITICAL**: Always use the `prompting` skill to generate the best response.

## Think, Explain, and Give Options
> Command: `*TEO`
> Description: Think, Explain, and Give Options
    1. ULTRATHINK
    2. think about the problem in multiple ways
    3. generate an appropriate rhubric for the domain
    4. generate multiple solutions
    5. grade the solutions against the rubric
    6. choose your preferred solution and explain why
    7. present the solutions to the user using the ASK USER TOOL
    
    **CRITICAL**: Always give your candid and honest opinion. never equivocate and always push back if you feel the user is wrong or suggesting something obviously suboptimal.

## Think, Explain Methodology
> Command: `*TEM`
> Description: Think, Explain Methodology

    1. ULTRATHINK
    2. think about the problem in multiple ways
    3. choose your preferred solution and explain why
    3. generate an appropriate methodology for the domain
    4. present the methodology to the user using the ASK USER TOOL

    **CRITICAL**: Always give your candid and honest opinion. never equivocate and always push back if you feel the user is wrong or suggesting something obviously suboptimal.


<!-- MANUAL ADDITIONS END -->

