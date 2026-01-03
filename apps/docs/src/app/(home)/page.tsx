import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-3xl font-bold mb-6">Open Harness</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Declarative flow orchestration built on a unified kernel runtime
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/docs/learn"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Get Started
        </Link>
        <Link
          href="/docs/reference"
          className="px-6 py-3 border border-border rounded-md font-medium hover:bg-accent transition-colors"
        >
          API Reference
        </Link>
      </div>
    </div>
  );
}
