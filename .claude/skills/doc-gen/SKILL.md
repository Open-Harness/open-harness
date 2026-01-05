---
name: Open Harness Documentation Skill
description: Open Harness documentation site maintenance and updates. Use when updating docs after protocol changes, adding new pages, fixing broken links, or generating API references. Covers Fumadocs components, code-generated docs, and the Diátaxis framework.
---

# Open Harness Documentation Skill

## Documentation Architecture

```
apps/docs/content/docs/           → Fumadocs site (MDX)
├── learn/                        → Tutorials (task-oriented learning)
├── guides/                       → How-to guides (task-focused)
├── concepts/                     → Explanations (understanding-oriented)
├── reference/                    → API & type reference
│   ├── api/                      → Function docs (AUTO-GENERATED)
│   ├── types/                    → Type definitions (AUTO-GENERATED)
│   ├── schemas/                  → Zod schemas
│   ├── events/                   → Event types
│   ├── bindings/                 → A3 syntax
│   ├── when/                     → Conditional expressions
│   ├── config/                   → Configuration options
│   └── kernel-spec/              → SYNCED from packages/sdk/docs/
└── contributing/                 → Contributor documentation

packages/sdk/docs/             → Protocol specs (source of truth for kernel-spec)
packages/sdk/src/              → TypeScript source (source of truth for API/types)
```

## Source of Truth Strategy

| Documentation Type | Source | Method |
|-------------------|--------|--------|
| Protocol Specs | `packages/sdk/docs/*.md` | Sync script (`sync:kernel-docs`) |
| API Functions | `packages/sdk/src/**/*.ts` | Auto-generated from TSDoc |
| Type Definitions | `packages/sdk/src/**/*.ts` | Auto-generated from TypeScript |
| Tutorials/Guides | `apps/docs/content/docs/` | Manual |
| Concepts | `apps/docs/content/docs/` | Manual |

## CRITICAL: Link Prefix Rule

**ALL internal links MUST include `/docs/` prefix:**

```mdx
<!-- WRONG - will 404 -->
[API Reference](/reference/api)
[Learn](/learn/first-flow)

<!-- CORRECT -->
[API Reference](/docs/reference/api)
[Learn](/docs/learn/first-flow)
```

This applies to:
- Markdown links: `[text](/docs/path)`
- Card hrefs: `href="/docs/path"`
- Any internal navigation

## Available Fumadocs Components

All components are pre-registered in `apps/docs/src/mdx-components.tsx`:

### TypeTable (for type documentation)
```mdx
<TypeTable
  type={{
    propertyName: {
      type: 'string',
      description: 'Property description',
      required: true,
      default: 'defaultValue',
      typeDescriptionLink: '/docs/reference/types/related',
    },
  }}
/>
```

### Steps (for procedures)
```mdx
<Steps>
  <Step>First step content</Step>
  <Step>Second step content</Step>
</Steps>
```

### Accordion (for collapsible content)
```mdx
<Accordions>
  <Accordion title="Question">Answer content</Accordion>
</Accordions>
```

### Banner (for callouts)
```mdx
<Banner>Important information</Banner>
```

### Mermaid (for diagrams)
```mdx
<Mermaid chart={`
graph LR
  A --> B
  B --> C
`} />
```

### Cards (from fumadocs-ui)
```mdx
<Cards>
  <Card title="Title" href="/docs/path" description="Description" />
</Cards>
```

## Code-Generated API Docs (fumadocs-typescript)

### Setup (if not already configured)
```bash
cd apps/docs
bun add fumadocs-typescript
```

### Configuration (source.config.ts)
```typescript
import { createGenerator, createFileSystemGeneratorCache } from 'fumadocs-typescript';

const generator = createGenerator({
  // Point to kernel source
  input: ['../../packages/sdk/src/**/*.ts'],
  // Use cache for faster builds
  cache: createFileSystemGeneratorCache(),
});
```

### Auto Type Tables in MDX
```mdx
---
title: Hub
---

# Hub

The central event bus.

```ts doc
// This generates a TypeTable automatically from the type
import { Hub } from "@open-harness/sdk"
```
```

### TSDoc Comments in Source
```typescript
/**
 * Central event bus for Open Harness.
 * @remarks Hub - Core Primitive
 */
export interface Hub {
  /**
   * Emit an event to all subscribers.
   * @param event - The event to emit
   */
  emit(event: BaseEvent): void;

  /**
   * Subscribe to events matching a pattern.
   * @param pattern - Event type pattern (supports wildcards)
   * @param handler - Callback for matching events
   * @internal - Hidden from docs
   */
  subscribe(pattern: string, handler: EventHandler): Unsubscribe;
}
```

## Diátaxis Framework

Structure documentation by user needs:

| Quadrant | Purpose | Format | Example |
|----------|---------|--------|---------|
| **Tutorials** (Learn) | Learning-oriented | Step-by-step lessons | "Build your first flow" |
| **How-to Guides** (Guides) | Task-oriented | Problem/solution pairs | "Add error handling" |
| **Explanation** (Concepts) | Understanding-oriented | Conceptual discussion | "Why event-driven?" |
| **Reference** | Information-oriented | Accurate, complete | API signatures, types |

## Protocol Change Workflow

When the kernel protocol changes:

### 1. Update Kernel Docs (if protocol spec changed)
```bash
# Edit the source
vim packages/sdk/docs/spec/hub.md

# Sync will happen automatically on next dev/build
cd apps/docs && bun run sync:kernel-docs
```

### 2. Regenerate API Docs (if signatures changed)
```bash
# With fumadocs-typescript configured:
# Just rebuild - types are extracted from source
bun run build
```

### 3. Update Cross-References
Search for broken references:
```bash
# Find references to removed/renamed types
grep -r "OldTypeName" apps/docs/content/docs/
```

### 4. Update Examples
Check tutorials and guides for outdated code:
```bash
# Search for old API patterns
grep -r "oldFunction(" apps/docs/content/docs/learn/
grep -r "oldFunction(" apps/docs/content/docs/guides/
```

## File Templates

### API Function Page
```mdx
---
title: functionName
description: One-line description
---

# functionName

Brief description.

## Signature

\`\`\`typescript
function functionName(param: Type): ReturnType
\`\`\`

## Parameters

<TypeTable
  type={{
    param: {
      type: 'Type',
      description: 'Description',
      required: true,
    },
  }}
/>

## Returns

\`ReturnType\` - Description.

## Example

\`\`\`typescript
import { functionName } from "@open-harness/sdk";

const result = functionName(value);
\`\`\`

## See Also

- [Related](/docs/reference/api/related) - Description
```

### Type Definition Page
```mdx
---
title: TypeName
description: One-line description
---

# TypeName

Brief description.

## Definition

\`\`\`typescript
interface TypeName {
  property: string;
}
\`\`\`

## Properties

<TypeTable
  type={{
    property: {
      type: 'string',
      description: 'Description',
      required: true,
    },
  }}
/>

## Example

\`\`\`typescript
const example: TypeName = {
  property: "value",
};
\`\`\`

## See Also

- [Related Type](/docs/reference/types/related) - Description
```

## Commands

```bash
# Development
cd apps/docs && bun run dev

# Sync kernel specs
bun run sync:kernel-docs

# Type check
bun run types:check

# Build
bun run build
```

## Validation Checklist

Before committing documentation changes:

- [ ] All internal links include `/docs/` prefix
- [ ] Code examples are tested and work
- [ ] TypeTable `required` field is set correctly
- [ ] Cross-references point to existing pages
- [ ] New pages are added to appropriate meta.json (if needed)
- [ ] Frontmatter has title and description

## Troubleshooting

### 404 on links
Links missing `/docs/` prefix. Fix with:
```bash
# Find broken links
grep -r '](/reference/' apps/docs/content/docs/
grep -r '](/learn/' apps/docs/content/docs/
# etc.

# Bulk fix
find apps/docs/content/docs -name "*.mdx" -exec sed -i '' 's/](\/reference\//](\/docs\/reference\//g' {} \;
```

### MDX parsing errors
Escape curly braces and angle brackets in inline code:
- `{foo}` → `&#123;foo&#125;`
- `<T>` → `&#60;T&#62;`

### TypeTable not rendering
Ensure component is imported in `mdx-components.tsx`:
```typescript
import { TypeTable } from 'fumadocs-ui/components/type-table';
```
