import { z } from "zod";
import type { ProviderTrait, StreamEvent } from "@internal/core";

/**
 * Sentiment classification that the template provider emits as structured output.
 */
export type TemplateSentiment = "positive" | "neutral" | "reflective";

/**
 * Input accepted by the template provider.
 *
 * The goal of this demo provider is to show the minimal contract every provider
 * must satisfy: input validation, session handling, and stream event emission.
 */
export interface TemplateProviderInput {
	/** Human prompt (required). Providers should be defensive around user input. */
	prompt: string;

	/** Optional session identifier used for pause/resume workflows. */
	sessionId?: string;

	/** Arbitrary metadata that the workflow can forward to the provider. */
	metadata?: Record<string, unknown>;
}

export const TemplateProviderInputSchema = z
	.object({
		prompt: z.string().min(1).describe("User-facing prompt"),
		sessionId: z.string().optional().describe("Existing session ID (resume support)"),
		metadata: z
			.record(z.string(), z.unknown())
			.optional()
			.describe("Opaque metadata from the workflow"),
	})
	.describe("Template provider input");

/**
 * Output returned from the template provider.
 * Includes both textual and structured pieces to illustrate streaming + structured output.
 */
export interface TemplateProviderOutput {
	/** Primary user-visible text. */
	text: string;

	/** Short summary of the prompt evaluation. */
	summary: string;

	/** Derived sentiment to show structured data support. */
	sentiment: TemplateSentiment;

	/** Session token returned for resume/passthrough scenarios. */
	sessionId: string;

	/** Echoed metadata in case downstream consumers need it later. */
	metadata?: Record<string, unknown>;
}

export const TemplateProviderOutputSchema = z
	.object({
		text: z.string().describe("Final text emitted by the provider"),
		summary: z.string().describe("Explains how the prompt was interpreted"),
		sentiment: z.enum(["positive", "neutral", "reflective"]).describe("Structured sentiment signal"),
		sessionId: z.string().describe("Session identifier for future resumes"),
		metadata: z
			.record(z.string(), z.unknown())
			.optional()
			.describe("Metadata carried forward for downstream logic"),
	})
	.describe("Template provider output");

/**
 * The context passed to the responder function so integrations can access prompt + signal.
 */
export interface TemplateResponderContext {
	prompt: string;
	sessionId?: string;
	metadata?: Record<string, unknown>;
	signal: AbortSignal;
}

/**
 * Structured result the responder must return.
 */
export interface TemplateResponderResult {
	text: string;
	summary: string;
	sentiment: TemplateSentiment;
	sessionId: string;
}

/**
 * Provider-specific responder callback.
 *
 * Real LLM integrations can replace this with async calls to their SDK.
 */
export type TemplateResponder = (context: TemplateResponderContext) => Promise<TemplateResponderResult>;

/**
 * Options that consumers can supply when constructing the template provider.
 */
export interface TemplateProviderOptions {
	/**
	 * Override the default responder with one that talks to a real model.
	 * The callback receives the normalized prompt, session ID, metadata, and abort signal.
	 */
	responder?: TemplateResponder;
}

const defaultResponder: TemplateResponder = async ({ prompt, sessionId }) => {
	const normalized = prompt.trim();
	const fallbackText = normalized.length ? normalized : "<empty prompt>";
	const shortSummary = fallbackText.split(/\s+/).slice(0, 12).join(" ");
	const sentiment: TemplateSentiment = normalized.endsWith("!")
		? "positive"
		: normalized.includes("?")
		? "reflective"
		: "neutral";
	return {
		text: fallbackText,
		summary: shortSummary,
		sentiment,
		sessionId: sessionId ?? `template-${Math.floor(Date.now() / 1000)}`,
	};
};

/**
 * Factory that produces the template provider trait.
 *
 * The implementation mirrors production providers:
 * - Validates inputs via Zod
 * - Emits thinking/text/tool events
 * - Returns structured output that includes a session token
 */
export function createTemplateProvider(
	options: TemplateProviderOptions = {},
): ProviderTrait<TemplateProviderInput, TemplateProviderOutput> {
	const responder = options.responder ?? defaultResponder;

	return {
		type: "template.provider",
		displayName: "Template Provider",
		capabilities: { streaming: true, structuredOutput: true },
		inputSchema: TemplateProviderInputSchema,
		outputSchema: TemplateProviderOutputSchema,
		async *execute(input, ctx) {
			if (ctx.signal.aborted) {
				throw new Error("Template provider aborted before execution");
			}

			ctx.emit({ type: "thinking", content: "Analyzing prompt", delta: true });

			const response = await responder({
				prompt: input.prompt,
				sessionId: input.sessionId,
				metadata: input.metadata,
				signal: ctx.signal,
			});

			if (ctx.signal.aborted) {
				throw new Error("Template provider aborted mid-response");
			}

			const textEvent: StreamEvent = { type: "text", content: response.text, delta: true };
			ctx.emit(textEvent);
			ctx.emit({ type: "text", content: response.text });
			ctx.emit({
				type: "tool",
				phase: "complete",
				name: "template.summary",
				data: {
					summary: response.summary,
					sentiment: response.sentiment,
				},
			});

			return {
				text: response.text,
				summary: response.summary,
				sentiment: response.sentiment,
				sessionId: response.sessionId,
				metadata: input.metadata,
			};
		},
	};
}
