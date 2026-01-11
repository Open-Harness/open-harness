import Link from "next/link";

export default function HomePage() {
	return (
		<div className="flex flex-col items-center justify-center flex-1 px-4 py-12">
			{/* Hero */}
			<div className="text-center max-w-3xl">
				<h1 className="text-4xl md:text-5xl font-bold mb-4">Open Harness</h1>
				<p className="text-xl md:text-2xl text-muted-foreground mb-2">
					The harness-agnostic framework for deep agents.
				</p>
				<p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto">
					Build, evaluate, and deploy AI agents that operate computers like users do. Plug in Claude Code, Codex,
					OpenCode, or your own harness. No vendor lock-in.
				</p>
				<div className="flex gap-4 justify-center mb-12">
					<Link
						href="/docs/learn/quickstart"
						className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
					>
						Get Started
					</Link>
					<Link
						href="/docs/concepts/architecture"
						className="px-6 py-3 border border-border rounded-md font-medium hover:bg-accent transition-colors"
					>
						How It Works
					</Link>
				</div>
			</div>

			{/* What are Deep Agents? */}
			<div className="w-full max-w-3xl mb-12 p-6 rounded-lg border border-border bg-card">
				<h2 className="text-lg font-semibold mb-3">What are Deep Agents?</h2>
				<p className="text-sm text-muted-foreground mb-4">
					Deep agents are AI systems that operate computers like users do — they run bash commands, read and write
					files, execute code, and interact with real infrastructure. Think{" "}
					<a
						href="https://docs.anthropic.com/en/docs/build-with-claude/computer-use"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						Claude Code
					</a>
					,{" "}
					<a
						href="https://github.com/openai/codex"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						Codex
					</a>
					, or{" "}
					<a
						href="https://github.com/sst/opencode"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						OpenCode
					</a>
					.
				</p>
				<p className="text-sm text-muted-foreground">
					These harnesses provide the basic tools (bash, file I/O, MCP) that any agent needs. Open Harness lets you
					build on top of them — and swap between them — without rewriting your agent logic.
				</p>
			</div>

			{/* The Problem */}
			<div className="w-full max-w-3xl mb-12">
				<h2 className="text-lg font-semibold mb-4 text-center">The Problem with Agent Development</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="p-4 rounded-lg border border-border bg-muted/30">
						<p className="text-sm font-medium mb-1">Building demos is easy</p>
						<p className="text-xs text-muted-foreground">
							Wire up some prompts, add tools, and it works... maybe 60-70% of the time.
						</p>
					</div>
					<div className="p-4 rounded-lg border border-border bg-muted/30">
						<p className="text-sm font-medium mb-1">But how does it actually perform?</p>
						<p className="text-xs text-muted-foreground">
							How does your prompt affect success rate? What's the cost? Does it work across models?
						</p>
					</div>
					<div className="p-4 rounded-lg border border-border bg-muted/30">
						<p className="text-sm font-medium mb-1">Iteration without data is just vibes</p>
						<p className="text-xs text-muted-foreground">
							You can't improve what you can't measure. Every change is a guess.
						</p>
					</div>
					<div className="p-4 rounded-lg border border-border bg-muted/30">
						<p className="text-sm font-medium mb-1">Vendor lock-in is real</p>
						<p className="text-xs text-muted-foreground">
							Your agent is tied to one harness. Switching providers means rewriting everything.
						</p>
					</div>
				</div>
			</div>

			{/* The Solution - Build, Eval, Deploy */}
			<div className="w-full max-w-4xl mb-12">
				<h2 className="text-lg font-semibold mb-6 text-center">Open Harness: Build → Eval → Deploy</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div className="p-6 border border-border rounded-lg">
						<div className="text-2xl mb-2">🔧</div>
						<h3 className="font-semibold mb-2">Build</h3>
						<p className="text-sm text-muted-foreground mb-3">
							Define agents with typed state, conditional activation, and signal-based coordination. Swap harnesses
							without changing your agent logic.
						</p>
						<code className="text-xs bg-muted px-2 py-1 rounded block">
							provider: new ClaudeProvider()
							<br />
							provider: new CodexProvider()
						</code>
					</div>
					<div className="p-6 border border-border rounded-lg">
						<div className="text-2xl mb-2">🧪</div>
						<h3 className="font-semibold mb-2">Eval</h3>
						<p className="text-sm text-muted-foreground mb-3">
							Record agent runs, replay them deterministically. Test across harnesses. Measure cost, latency, and
							success rate with real data.
						</p>
						<code className="text-xs bg-muted px-2 py-1 rounded block">
							recording: {"{"} mode: "record" {"}"}
							<br />
							recording: {"{"} mode: "replay" {"}"}
						</code>
					</div>
					<div className="p-6 border border-border rounded-lg">
						<div className="text-2xl mb-2">🚀</div>
						<h3 className="font-semibold mb-2">Deploy</h3>
						<p className="text-sm text-muted-foreground mb-3">
							Production-ready observability with structured logging. Signal traces for debugging. Run in CI with
							deterministic replay.
						</p>
						<code className="text-xs bg-muted px-2 py-1 rounded block">
							LOG_LEVEL=debug
							<br />
							result.signals // full trace
						</code>
					</div>
				</div>
			</div>

			{/* Code Example */}
			<div className="w-full max-w-3xl mb-12 rounded-lg border border-border bg-card overflow-hidden">
				<div className="px-4 py-2 border-b border-border bg-muted/50 flex justify-between items-center">
					<span className="text-xs font-mono text-muted-foreground">coding-agent.ts</span>
					<span className="text-xs text-muted-foreground">A deep agent that fixes bugs</span>
				</div>
				<pre className="p-4 overflow-x-auto text-sm">
					<code className="language-typescript">{`import { createHarness, ClaudeProvider } from "@open-harness/core";

type State = {
  issue: string;
  diagnosis: string | null;
  fix: string | null;
};

const { agent, runReactive } = createHarness<State>();

const diagnoser = agent({
  prompt: \`Analyze this issue and identify the root cause:
{{ state.issue }}

Use bash tools to inspect the codebase.\`,
  activateOn: ["harness:start"],
  emits: ["diagnosis:complete"],
  updates: "diagnosis",
});

const fixer = agent({
  prompt: \`Apply a fix for this diagnosis:
{{ state.diagnosis }}

Edit the relevant files and run tests.\`,
  activateOn: ["diagnosis:complete"],
  when: (ctx) => ctx.state.diagnosis !== null,
  emits: ["fix:complete"],
  updates: "fix",
});

// Run with Claude Code
const result = await runReactive({
  agents: { diagnoser, fixer },
  state: { issue: "Tests failing in auth module", diagnosis: null, fix: null },
  provider: new ClaudeProvider(),
  recording: { mode: "record", store }, // Capture for replay
});`}</code>
				</pre>
			</div>

			{/* Why Open Harness */}
			<div className="w-full max-w-4xl mb-12">
				<h2 className="text-lg font-semibold mb-6 text-center">Why Open Harness?</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="p-6 border border-border rounded-lg">
						<h3 className="font-semibold mb-2">Harness Agnostic</h3>
						<p className="text-sm text-muted-foreground">
							Plug in Claude Code, Codex, OpenCode, or build your own provider. Your agent logic stays the same. Test
							performance across harnesses with the same recordings.
						</p>
					</div>
					<div className="p-6 border border-border rounded-lg">
						<h3 className="font-semibold mb-2">Deterministic Evals</h3>
						<p className="text-sm text-muted-foreground">
							Record agent runs once, replay them forever. No more flaky tests. No more "it worked on my machine."
							Iterate with actual data, not vibes.
						</p>
					</div>
					<div className="p-6 border border-border rounded-lg">
						<h3 className="font-semibold mb-2">TypeScript-First</h3>
						<p className="text-sm text-muted-foreground">
							Full type safety for state, guards, and agent configuration. Autocomplete everywhere. Catch errors at
							compile time, not runtime.
						</p>
					</div>
					<div className="p-6 border border-border rounded-lg">
						<h3 className="font-semibold mb-2">Production Ready</h3>
						<p className="text-sm text-muted-foreground">
							Structured logging with Pino. Signal traces for debugging. Vitest matchers for CI. Built for real
							deployments, not just demos.
						</p>
					</div>
				</div>
			</div>

			{/* CTA */}
			<div className="text-center">
				<p className="text-sm text-muted-foreground mb-4">
					Open Harness is open source and free to use.
				</p>
				<div className="flex gap-4 justify-center">
					<Link
						href="/docs/learn/quickstart"
						className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
					>
						Get Started
					</Link>
					<a
						href="https://github.com/open-harness/open-harness"
						target="_blank"
						rel="noopener noreferrer"
						className="px-6 py-3 border border-border rounded-md font-medium hover:bg-accent transition-colors"
					>
						GitHub
					</a>
				</div>
			</div>
		</div>
	);
}
