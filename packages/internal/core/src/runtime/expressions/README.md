---
title: "Expression Evaluation System"
lastUpdated: "2026-01-07T00:00:00Z"
lastCommit: "placeholder"
lastCommitDate: "2026-01-07T00:00:00Z"
scope:
  - expressions
  - jsonata
  - bindings
  - evaluation
  - error-handling
---

# Expression Evaluation System

JSONata-based expression evaluator for flow bindings, conditions, and dynamic data access.

## What's here

- **`expressions.ts`** — Core JSONata evaluator with template parsing
- **`bindings.ts`** — Binding resolution for `{{ expr }}` templates
- **`when.ts`** — Conditional evaluation (when clauses)
- **`errors.ts`** — Error types and Result-based API for error handling

## Architecture

```
┌─────────────────────────────────────┐
│  evaluateExpression / resolveTemplate │ (public API - throws)
├─────────────────────────────────────┤
│  evaluateExpressionResult (internal)  │ (Result-based)
│  resolveTemplateResult (internal)     │
├─────────────────────────────────────┤
│  JSONata Compiler + Cache             │
│  (getCompiledExpression)              │
├─────────────────────────────────────┤
│  JSONata Library                      │
└─────────────────────────────────────┘
```

## Usage

### Expressions (Simple Path Access)

```typescript
import { evaluateExpression } from './expressions.js';

const context = {
  task: { title: 'Complete review', reviewer: { name: 'Alice' } },
  state: { count: 5 },
  $iteration: 2,
};

// Simple path
await evaluateExpression('task.title', context)  // "Complete review"

// Nested access
await evaluateExpression('task.reviewer.name', context)  // "Alice"

// Array access
await evaluateExpression('items[0]', context)  // first item

// Operators
await evaluateExpression('task.title != ""', context)  // true

// Functions
await evaluateExpression('$exists(reviewer)', context)  // true/false
await evaluateExpression('$not(done)', context)  // negation
```

### Templates (Interpolation)

```typescript
import { resolveTemplate } from './expressions.js';

// Pure binding (returns type)
await resolveTemplate('{{ task }}', context)  // Returns object (not stringified)

// Mixed template (returns string)
await resolveTemplate('Task: {{ task.title }}', context)  // "Task: Complete review"

// Multiple expressions
await resolveTemplate('{{ reviewer.name }} has {{ count }} items', context)
```

### Bindings (Framework Internal)

```typescript
import { resolveBindings } from './bindings.js';

// Resolve an object with expression values
const resolved = await resolveBindings({
  title: '{{ task.title }}',
  reviewer: '{{ task.reviewer.name }}',
  count: 5,  // Non-expression value
}, context);
```

### Conditions (When Clauses)

```typescript
import { evaluateWhen } from './when.js';

// JSONata string format
await evaluateWhen('task.status = "done"', context)  // true/false

// Structured AST format
await evaluateWhen({
  equals: { var: 'task.status', value: 'done' }
}, context)
```

### Error Handling (Result-Based)

```typescript
import { evaluateExpressionResult, type ExpressionResult } from './expressions.js';

const result = await evaluateExpressionResult('task.title', context);

result.match(
  (value) => console.log('Success:', value),
  (err) => {
    if (err.code === 'EVALUATION_ERROR') {
      console.error('JSONata error:', err.message);
    }
  }
);
```

## JSONata Expressions

### Paths & Variables

```javascript
task.title                    // Nested path access
items[0]                      // Array access (0-based)
items[-1]                     // Last item
items[status = 'done']        // Filter array by condition
$iteration                    // Loop iteration number ($ prefix)
$first, $last                 // Boolean flags in loops
```

### Operators

```javascript
// Comparison
= != > < >= <=

// Boolean
and or $not()

// String
& (concatenation)

// Ternary
condition ? true_value : false_value
```

### Built-in Functions

```javascript
$exists(var)                  // Check if variable exists/defined
$count(array)                 // Count items
$sum(array)                   // Sum numeric values
$min(array) $max(array)       // Min/max values
$map(array, expr)             // Map function (advanced)
$filter(array, expr)          // Filter by expression
```

## Iteration Context

In forEach loops, these variables are available:

```typescript
$iteration       // Current index (0-based)
$first           // true on first iteration
$last            // true on last iteration
$maxIterations   // Total count
```

Example in flow YAML:

```yaml
edges:
  - from: generator
    to: processor
    forEach:
      in: "{{ items }}"
      as: item
# Inside processor, access: $iteration, $first, $last, $maxIterations
```

## Expression Cache

Compiled JSONata expressions are cached for performance. To clear:

```typescript
import { clearExpressionCache } from './expressions.js';
clearExpressionCache();  // Useful for testing or memory pressure
```

## Error Types

**Result-based API** (`ExpressionResult<T>`):

- `PARSE_ERROR` — Template syntax error
- `EVALUATION_ERROR` — JSONata evaluation failure
- `VALIDATION_ERROR` — Input validation failure
- `UNDEFINED_BINDING` — Required binding not found
- `TYPE_ERROR` — Type mismatch

**Public API** (throws):

- Plain `Error` for syntax/evaluation issues
- Return `undefined` for missing paths (JSONata behavior)

## Design Notes

1. **Missing Paths**: JSONata returns `undefined` for missing paths, not errors. This is preserved—`task.missing` → `undefined` (no throw).

2. **Pure vs. Mixed Bindings**:
   - Pure (`{{ expr }}`): Preserves type (returns object/array/number)
   - Mixed (`text {{ expr }}`): Always returns string

3. **API Stability**:
   - Public functions throw errors (backward compatible)
   - Internal `*Result` variants use `Result<T, Error>` from neverthrow
   - Consumers can gradually migrate to error-aware code

4. **Performance**:
   - Compiled expressions cached per-expression
   - Template segments parsed once, cached by template string
   - Bindings object flattened once per evaluation

## Testing

See `tests/unit/expressions.test.ts` for:
- Path resolution (nested, array, filter)
- Operator evaluation (comparison, boolean, ternary)
- Template parsing (pure vs mixed)
- Missing path handling
- Error cases

Run:

```bash
bun run test tests/unit/expressions.test.ts
```

## See Also

- `bindings.ts` — Input/output binding resolution
- `when.ts` — Conditional expression evaluation
- `errors.ts` — Error types and Result helpers
