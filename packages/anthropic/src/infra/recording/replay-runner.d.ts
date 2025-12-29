/**
 * ReplayRunner - Replays recorded LLM sessions for testing
 *
 * Reads from recorded .jsonl files and fires callbacks as if live.
 * No async generators - pure Promise + callbacks.
 *
 * Node.js compatible - uses fs/promises instead of Bun APIs.
 */
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { GenericMessage, IAgentRunner, RunnerCallbacks } from "@openharness/sdk";
export declare class ReplayRunner implements IAgentRunner {
    private config;
    private currentScenarioId;
    constructor(config?: import("@openharness/sdk").IConfig);
    /**
     * Set the scenario ID for replay.
     * This is a convenience method for tests that set up a scenario once.
     */
    setScenario(id: string): void;
    run(args: {
        prompt: string;
        options: Options & {
            scenarioId?: string;
        };
        callbacks?: RunnerCallbacks;
    }): Promise<GenericMessage | undefined>;
}
