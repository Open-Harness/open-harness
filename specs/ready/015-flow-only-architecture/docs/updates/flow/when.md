# WhenExpr Protocol (Draft)

Defines the conditional expression grammar for node and edge gating.

## Grammar

```yaml
# equals
when:
  equals:
    var: "nodeId.outputField"
    value: "expected"

# not
when:
  not: { equals: { var: "x", value: 1 } }

# and
when:
  and:
    - { equals: { var: "x", value: 1 } }
    - { equals: { var: "y", value: 2 } }

# or
when:
  or:
    - { equals: { var: "x", value: 1 } }
    - { equals: { var: "y", value: 2 } }
```

## Scope

- `when` may appear on **nodes** or **edges**.
- Edge `when` is evaluated against the binding context after the source node completes.

## Key invariants

1. `when` evaluation is deterministic and pure.
2. `when` uses binding context (flow input + node outputs).
