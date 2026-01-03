# WhenExpr Protocol

`WhenExpr` is a boolean expression that gates node execution.

## Grammar

```yaml
# equals
when:
  equals:
    var: string      # VarPath
    value: any

# not
when:
  not: <WhenExpr>

# and
when:
  and:
    - <WhenExpr>
    - <WhenExpr>

# or
when:
  or:
    - <WhenExpr>
    - <WhenExpr>
```

## VarPath

Var paths use dot notation and are resolved against the **binding context** (same as bindings):

- `flow.input.<key...>`
- `<nodeId>.<key...>` (node outputs)

### Example

```yaml
when:
  equals:
    var: "isFrench.value"
    value: true
```

This resolves `isFrench.value` from the `isFrench` node's output.

## Evaluation semantics

- If `when` evaluates to `true`, the node executes
- If `when` evaluates to `false`, the node is **skipped**
- If `when` is omitted, the node always executes

### Skip behavior

When a node is skipped:
- The engine records a skipped marker in outputs (shape is engine-defined)
- Downstream nodes can still run if they don't depend on that output
- The skipped node's output is not available for bindings (it's the skip marker)

## Examples

### Simple condition

```yaml
nodes:
  - id: isFrench
    type: condition.equals
    input:
      left: "{{facts.officialLanguage}}"
      right: "French"
    # Output: { value: true }

  - id: sayFrench
    type: anthropic.text
    when:
      equals:
        var: "isFrench.value"
        value: true
    input:
      prompt: "Write in French..."
```

### Negation

```yaml
when:
  not:
    equals:
      var: "isFrench.value"
      value: true
```

### Complex logic

```yaml
when:
  and:
    - equals:
        var: "isFrench.value"
        value: true
    - equals:
        var: "flow.input.country"
        value: "Benin"
```

```yaml
when:
  or:
    - equals:
        var: "isFrench.value"
        value: true
    - equals:
        var: "isSpanish.value"
        value: true
```

## Error handling

If a `var` path cannot be resolved:
- The expression evaluates to `false` (node is skipped)
- This prevents errors from propagating (safer than failing the flow)

## Key invariants

1. **WhenExpr is evaluated before node execution** - it gates whether the node runs
2. **Skip is not failure** - skipped nodes don't fail the flow
3. **VarPath uses the same resolution as bindings** - `flow.input.*` and `<nodeId>.*`
