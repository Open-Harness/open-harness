# Bindings Protocol (A3)

Bindings are **string interpolation only** in MVP.

## Grammar

Bindings apply to **string values only** inside `node.input`:

- `{{path}}` - **strict**; missing is an error
- `{{?path}}` - **optional**; missing renders `""`
- `{{path | default:<json>}}` - fallback when missing (`default:` is JSON literal)

## Path resolution

Paths use dot notation and are resolved against the **binding context**:

- `flow.input.<key...>`
- `<nodeId>.<key...>` (node outputs are available by node id)

### Examples

```yaml
input:
  prompt: "Write about {{flow.input.country}}."
  # Missing path is an error (strict mode)
```

```yaml
input:
  prompt: "Write about {{?optionalField}}."
  # Missing path renders as empty string
```

```yaml
input:
  prompt: "Write about {{?optionalField | default:\"Unknown\"}}."
  # Missing path uses the default value
```

## Binding context

The binding context is built from:

1. `flow.input` - workflow-level inputs
2. `outputs[nodeId]` - node outputs (available after the node completes)

### Example

```yaml
flow:
  input:
    country: Benin

nodes:
  - id: facts
    type: mcp.geo.country_info
    input:
      country: "{{flow.input.country}}"
    # Output: { country: "Benin", capital: "Porto-Novo", officialLanguage: "French" }

  - id: sayFrench
    type: anthropic.text
    input:
      prompt: "Capital: {{facts.capital}}, Language: {{facts.officialLanguage}}"
    # Resolves to: "Capital: Porto-Novo, Language: French"
```

## Error handling

### Strict mode (`{{path}}`)

If a path cannot be resolved (missing, `null`, `undefined`), the node fails with a clear error message indicating which path failed.

### Optional mode (`{{?path}}`)

If a path cannot be resolved, it renders as an empty string `""`.

### Default mode (`{{path | default:<json>}}`)

If a path cannot be resolved, it uses the provided default value (parsed as JSON).

## Type coercion

In MVP:
- Only strings are templated (objects/arrays are passed through unchanged)
- Missing paths resolve according to the binding mode (strict/optional/default)

Later scope:
- Structured mapping (JSONPath-like)
- Type-aware coercion and defaults

## Key invariants

1. **Only strings are templated** - objects/arrays in `node.input` are passed through unchanged
2. **Strict by default** - `{{path}}` fails if missing (prevents silent correctness bugs)
3. **Optional is explicit** - `{{?path}}` makes the intent clear
