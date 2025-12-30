import { type AgentDefinition, type BaseEvent, defineChannel, defineHarness } from "../src/index.ts";

// Agent that waits for an injected message while “running”.
const StreamingLikeAgent: AgentDefinition<{ goal: string }, { summary: string }> = {
	name: "Streamer",
	async execute(input, { hub, inbox, runId }) {
		hub.emit({ type: "agent:thinking", content: `Started run ${runId} with goal: ${input.goal}`, runId });

		// Simulate “streaming work” while also listening for injected messages.
		// In a real provider wrapper, this would forward messages into the SDK session.
		hub.emit({ type: "agent:text", content: "Working...", runId });

		const msg = await inbox.pop();
		hub.emit({ type: "agent:thinking", content: `Received injected message: "${msg.content}"`, runId });

		return { summary: `Goal="${input.goal}", injected="${msg.content}"` };
	},
};

// Channel that targets the correct run by listening for agent:start.
const InjectorChannel = defineChannel({
	name: "injector",
	on: {
		"agent:start": ({ hub, event }) => {
			const e = event.event as Extract<BaseEvent, { type: "agent:start" }>;
			console.log(`[injector] saw agent:start runId=${e.runId}`);
			setTimeout(() => {
				console.log(`[injector] sending message to runId=${e.runId}`);
				hub.sendToRun(e.runId, "please continue with extra constraints");
			}, 250);
		},
	},
});

const Logger = defineChannel({
	name: "logger",
	on: {
		"*": ({ event }) => console.log(`[${event.event.type}]`, event.event),
	},
});

const Workflow = defineHarness({
	name: "inbox-injection",
	agents: { streamer: StreamingLikeAgent },
	state: () => ({}),
	run: async ({ agents }) => {
		const out = await agents.streamer.execute({ goal: "demonstrate sendToRun + inbox" });
		return out;
	},
});

async function main() {
	const result = await Workflow.create({}).attach(Logger).attach(InjectorChannel).startSession().run();
	console.log("\nresult:", result.result);
}

main().catch((e) => console.error(e));
