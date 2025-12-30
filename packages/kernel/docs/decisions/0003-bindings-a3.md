# Decision 0003: Bindings A3 (Strict + Optional + Default)

## Status

Accepted

## Context

We need to decide how to handle missing bindings in template strings:
- Hard error (strict)
- Soft resolve (empty string)
- Typed optional bindings

## Decision

**A3: Typed optional bindings** with three modes:

- `{{path}}` - **strict**; missing is an error
- `{{?path}}` - **optional**; missing renders `""`
- `{{path | default:<json>}}` - fallback when missing

## Rationale

- **Strict by default** prevents silent correctness bugs (best for correctness + debugging)
- **Optional is explicit** (`{{?path}}`) makes the intent clear
- **Default values** provide flexibility for intentional fallbacks
- **UI-friendly** - a visual builder can validate immediately and highlight broken refs

## Consequences

- Missing `{{path}}` fails the node (and shows which path)
- Missing `{{?path}}` renders as empty string
- Missing `{{path | default:<json>}}` uses the default value

## Alternatives considered

- **A1: Hard error only** - rejected because it's too rigid for prototyping
- **A2: Soft resolve only** - rejected because it creates silent correctness bugs
