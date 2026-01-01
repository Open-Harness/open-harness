/**
 * AnthropicRunner - Executes real LLM queries via Claude Agent SDK
 *
 * This is the Anthropic-specific implementation of IAgentRunner.
 * It consumes the SDK's async generator internally and fires callbacks.
 *
 * For other providers (OpenCode, Gemini, etc.), create separate runner
 * implementations that implement the same interface.
 */
import { type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { IAgentRunner, RunnerCallbacks } from "@openharness/sdk";
/**
 * AnthropicRunner - Production runner for Claude/Anthropic API
 *
 * Uses the @anthropic-ai/claude-agent-sdk to execute prompts.
 * Wraps the SDK's async generator pattern in a simpler Promise + callbacks API.
 */
export declare class AnthropicRunner implements IAgentRunner {
    run(args: {
        prompt: string;
        options: Options;
        callbacks?: RunnerCallbacks;
    }): Promise<SDKMessage | undefined>;
}
