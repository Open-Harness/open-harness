# Store LibSQL Source

LibSQL/Turso storage implementation.

## Files

| File | Purpose |
|------|---------|
| index.ts | Public exports |
| Config.ts | LibSQLConfig type |
| EventStore.ts | EventStore Layer (stub) |
| StateSnapshotStore.ts | StateSnapshotStore Layer |
| AgentFixtureStore.ts | AgentFixtureStore Layer (stub) |
| Migrations.ts | Schema SQL |

## Architecture

```
                    ┌─────────────────┐
                    │    index.ts     │
                    │ (public exports)│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │ Config.ts   │    │EventStore.ts│    │AgentFixture │
  │             │    │             │    │ Store.ts    │
  └─────────────┘    └──────┬──────┘    └──────┬──────┘
                            │                   │
                            └───────┬───────────┘
                                    ▼
                           ┌─────────────┐
                           │Migrations.ts│
                           │(SQL schema) │
                           └─────────────┘
```

StateSnapshotStore lives alongside EventStore and shares the same migrations.
