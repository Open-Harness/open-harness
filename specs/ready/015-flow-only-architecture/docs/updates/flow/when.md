# WhenExpr Protocol

Defines the conditional expression grammar for node and edge gating.

## JSONata Expressions (Preferred)

The preferred way to write when conditions is using JSONata expression strings:

```yaml
# Simple boolean check
when: "reviewer.passed = true"

# Negation
when: "$not(reviewer.passed = true)"

# Existence check (missing values don't crash)
when: "$exists(reviewer)"

# Complex conditions
when: "$exists(reviewer) and reviewer.score > 80"

# Iteration context (available in loops)
when: "$iteration < $maxIterations"
when: "$not($first)"  # Skip first iteration
when: "$last"          # Only on last iteration
```

### Available Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `=` | `status = "done"` | Equality |
| `!=` | `count != 0` | Inequality |
| `>`, `<`, `>=`, `<=` | `score > 80` | Comparison |
| `and` | `a and b` | Logical AND |
| `or` | `a or b` | Logical OR |

### Available Functions

| Function | Example | Description |
|----------|---------|-------------|
| `$not()` | `$not(passed)` | Logical negation |
| `$exists()` | `$exists(reviewer)` | Check if value exists |
| `$count()` | `$count(items)` | Count array elements |

### Iteration Context Variables

These are available inside `control.foreach` loops:

| Variable | Type | Description |
|----------|------|-------------|
| `$iteration` | number | Current iteration index (0-based) |
| `$first` | boolean | True on first iteration |
| `$last` | boolean | True on last iteration |
| `$maxIterations` | number | Total number of iterations |

## YAML AST Format (Legacy)

For backward compatibility, the YAML AST format is still supported:

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

> **Note**: The YAML AST format is deprecated. Use JSONata expressions for new flows.

## Scope

- `when` may appear on **nodes** or **edges**.
- Edge `when` is evaluated against the binding context after the source node completes.

## Key Invariants

1. `when` evaluation is deterministic and pure.
2. `when` uses binding context (flow input + node outputs + iteration context).
3. Missing paths return `false` (no crash) in JSONata expressions.
4. JSONata expressions are evaluated asynchronously.
