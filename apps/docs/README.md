# Open Harness Documentation

This is the official documentation site for Open Harness, built with Next.js and Fumadocs.

## Development

Run the development server:

```bash
bun run dev
```

Open http://localhost:3000 with your browser to see the result.

## Structure

- `content/docs/` - Documentation content (tutorials, guides, reference, concepts)
- `src/app/(home)` - Landing page and marketing pages
- `src/app/docs` - Documentation layout and pages
- `src/app/api/search` - Search API endpoint

## Adding Documentation

Documentation is written in MDX format. Add new content to `content/docs/`:

```
content/docs/
├── learn/           # Tutorials
├── guides/          # How-to guides
├── reference/       # API reference
└── concepts/        # Conceptual explanations
```

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [Fumadocs](https://fumadocs.dev) - Documentation framework
- [MDX](https://mdxjs.com/) - Markdown with JSX
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Learn More

- [Fumadocs Documentation](https://fumadocs.dev) - Learn about Fumadocs
- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js
