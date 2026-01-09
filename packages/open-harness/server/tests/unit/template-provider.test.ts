import { describe, expect, test } from "bun:test";
import type { ExecutionContext, ProviderTrait, StreamEvent } from "@internal/core";
import type { TemplateProviderInput, TemplateProviderOutput, TemplateResponder } from "@internal/server";
import { createTemplateProvider } from "@internal/server";

async function runTemplateProvider(
	trait: ProviderTrait<TemplateProviderInput, TemplateProviderOutput>,
	input: TemplateProviderInput,
	ctx: ExecutionContext,
): Promise<TemplateProviderOutput> {
	const generator = trait.execute(input, ctx);
	for (;;) {
		const result = await generator.next();
		if (result.done) {
			return result.value;
		}
	}
}

describe("Template Provider", () => {
	test("emits the expected events and structured output", async () => {
		const events: StreamEvent[] = [];
		const ctx: ExecutionContext = {
			signal: new AbortController().signal,
			emit: (event) => events.push(event),
		};

		const trait = createTemplateProvider();
		const output = await runTemplateProvider(trait, { prompt: "hello world" }, ctx);

		expect(output.text).toBe("hello world");
		expect(output.summary).toBe("hello world");
		expect(output.sentiment).toBe("neutral");
		expect(output.sessionId).toMatch(/^template-/);

		expect(events.map((event) => event.type)).toEqual(["thinking", "text", "text", "tool"]);

		const maybeToolEvent = events.at(-1);
		expect(maybeToolEvent).toEqual(
			expect.objectContaining({
				type: "tool",
				phase: "complete",
				name: "template.summary",
			}),
		);
	});

	test("honors a custom responder", async () => {
		const events: StreamEvent[] = [];
		const ctx: ExecutionContext = {
			signal: new AbortController().signal,
			emit: (event) => events.push(event),
		};

		const responder: TemplateResponder = async ({ prompt, sessionId }) => ({
			text: prompt.toUpperCase(),
			summary: `handled ${prompt.length}`,
			sentiment: "reflective",
			sessionId: sessionId ?? "session-static",
		});

		const trait = createTemplateProvider({ responder });
		const output = await runTemplateProvider(trait, { prompt: "custom" }, ctx);

		expect(output.text).toBe("CUSTOM");
		expect(output.summary).toBe("handled 6");
		expect(output.sentiment).toBe("reflective");
		expect(output.sessionId).toBe("session-static");
		expect(events).toHaveLength(4);
	});
});
