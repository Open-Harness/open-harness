import Link from "next/link";

export default function HomePage() {
	return (
		<div className="flex flex-col items-center justify-center flex-1 px-4 py-12">
			{/* Hero */}
			<div className="text-center max-w-3xl">
				<h1 className="text-4xl md:text-5xl font-bold mb-4">Open Harness</h1>
				<p className="text-xl md:text-2xl text-muted-foreground mb-2">
					Signal-based reactive workflows for AI agents
				</p>
				<p className="text-base text-muted-foreground mb-8">
					Define agents that react to signals. Workflow emerges from signal flow.
					TypeScript-first with full type safety.
				</p>
				<div className="flex gap-4 justify-center mb-12">
					<Link
						href="/docs/learn/quickstart"
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

			{/* Mental Model */}
			<div className="w-full max-w-2xl mb-12">
				<div className="flex items-center justify-center gap-2 text-sm font-mono text-muted-foreground flex-wrap">
					<span className="px-3 py-1.5 bg-accent rounded">Signal</span>
					<span>→</span>
					<span className="px-3 py-1.5 bg-accent rounded">Agent</span>
					<span>→</span>
					<span className="px-3 py-1.5 bg-accent rounded">Signal</span>
					<span>→</span>
					<span className="px-3 py-1.5 bg-accent rounded">Agent</span>
					<span>→</span>
					<span className="px-3 py-1.5 bg-primary text-primary-foreground rounded">Result</span>
				</div>
				<p className="text-center text-xs text-muted-foreground mt-2">
					Signals flow, agents react, workflow emerges
				</p>
			</div>

			{/* Code Example */}
			<div className="w-full max-w-3xl mb-12 rounded-lg border border-border bg-card overflow-hidden">
				<div className="px-4 py-2 border-b border-border bg-muted/50">
					<span className="text-xs font-mono text-muted-foreground">example.ts</span>
				</div>
				<pre className="p-4 overflow-x-auto text-sm">
					<code className="language-typescript">{`import { createHarness, ClaudeProvider } from "@open-harness/core";

type State = { input: string; result: string | null };
const { agent, runReactive } = createHarness<State>();

const analyzer = agent({
  prompt: "Analyze: {{ state.input }}",
  activateOn: ["harness:start"],
  emits: ["analysis:complete"],
  updates: "result",
});

const result = await runReactive({
  agents: { analyzer },
  state: { input: "Hello world", result: null },
  provider: new ClaudeProvider(),
  endWhen: (s) => s.result !== null,
});`}</code>
				</pre>
			</div>

			{/* Features */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
				<div className="p-6 border border-border rounded-lg">
					<h3 className="font-semibold mb-2">Signal-Based Orchestration</h3>
					<p className="text-sm text-muted-foreground">
						No explicit edges. Agents declare what signals they react to with{" "}
						<code className="text-xs bg-muted px-1 rounded">activateOn</code> and what they emit.
						Workflow emerges naturally.
					</p>
				</div>
				<div className="p-6 border border-border rounded-lg">
					<h3 className="font-semibold mb-2">Typed State Guards</h3>
					<p className="text-sm text-muted-foreground">
						Full TypeScript autocomplete in{" "}
						<code className="text-xs bg-muted px-1 rounded">when</code> guards. Conditional
						activation with compile-time type safety.
					</p>
				</div>
				<div className="p-6 border border-border rounded-lg">
					<h3 className="font-semibold mb-2">Recording & Replay</h3>
					<p className="text-sm text-muted-foreground">
						Event-sourced signal log for deterministic testing. Record live runs, replay without
						provider calls. Perfect for CI.
					</p>
				</div>
			</div>

			{/* Secondary Features */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full mt-6">
				<div className="p-6 border border-border rounded-lg">
					<h3 className="font-semibold mb-2">Parallel Execution</h3>
					<p className="text-sm text-muted-foreground">
						Multiple agents subscribing to the same signal run in parallel automatically.
						No manual concurrency management.
					</p>
				</div>
				<div className="p-6 border border-border rounded-lg">
					<h3 className="font-semibold mb-2">Vitest Integration</h3>
					<p className="text-sm text-muted-foreground">
						Custom matchers like{" "}
						<code className="text-xs bg-muted px-1 rounded">toContainSignal</code> and{" "}
						<code className="text-xs bg-muted px-1 rounded">toHaveSignalsInOrder</code> for
						testing agent behavior.
					</p>
				</div>
			</div>
		</div>
	);
}
