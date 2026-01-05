import Link from "next/link";

export default function HomePage() {
	return (
		<div className="flex flex-col items-center justify-center flex-1 px-4 py-12">
			{/* Hero */}
			<div className="text-center max-w-3xl">
				<h1 className="text-4xl md:text-5xl font-bold mb-4">Open Harness</h1>
				<p className="text-xl md:text-2xl text-muted-foreground mb-2">n8n for AI agents</p>
				<p className="text-base text-muted-foreground mb-8">
					Build multi-step agent workflows visually or with AI. Agents are the primitives — as models improve, your
					flows improve.
				</p>
				<div className="flex gap-4 justify-center mb-12">
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

			{/* Mental Model */}
			<div className="w-full max-w-2xl mb-12">
				<div className="flex items-center justify-center gap-2 text-sm font-mono text-muted-foreground">
					<span className="px-3 py-1.5 bg-accent rounded">Hub</span>
					<span>→</span>
					<span className="px-3 py-1.5 bg-accent rounded">Flow</span>
					<span>→</span>
					<span className="px-3 py-1.5 bg-accent rounded">Agents</span>
					<span>→</span>
					<span className="px-3 py-1.5 bg-accent rounded">Channels</span>
				</div>
				<p className="text-center text-xs text-muted-foreground mt-2">
					Hub runs • Flow defines • Agents execute • Channels connect
				</p>
			</div>

			{/* Features */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
				<div className="p-6 border border-border rounded-lg">
					<div className="text-2xl mb-2">🔀</div>
					<h3 className="font-semibold mb-2">Flow-First Design</h3>
					<p className="text-sm text-muted-foreground">
						Define workflows as declarative YAML specs. One file captures your entire agent orchestration.
					</p>
				</div>
				<div className="p-6 border border-border rounded-lg">
					<div className="text-2xl mb-2">🤖</div>
					<h3 className="font-semibold mb-2">Agents as Primitives</h3>
					<p className="text-sm text-muted-foreground">
						Provider-agnostic SDK wrappers. Claude, GPT, or any model — swap without rewriting your flows.
					</p>
				</div>
				<div className="p-6 border border-border rounded-lg">
					<div className="text-2xl mb-2">🎨</div>
					<h3 className="font-semibold mb-2">Visual or AI-Generated</h3>
					<p className="text-sm text-muted-foreground">
						Build flows in the visual editor or describe what you want — AI generates the FlowSpec.
					</p>
				</div>
			</div>
		</div>
	);
}
