/**
 * Recording Factory - Injectable factory for creating Recorders
 *
 * This follows Pattern 13: Decorator with Factory Injection.
 * The factory is fully injectable, making the @Record decorator testable.
 *
 * Pure Promise-based, no async generators.
 *
 * Node.js compatible - uses fs/promises instead of Bun APIs.
 */
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { GenericMessage, IConfig, RunnerCallbacks } from "@openharness/sdk";
import type { IRecorder, IRecordingFactory } from "./types.js";
/**
 * Recorder handles the actual record/replay logic for a single session.
 * It's a simple class with no DI - dependencies are passed via constructor.
 */
export declare class Recorder implements IRecorder {
    private readonly category;
    private readonly id;
    private readonly config;
    constructor(category: string, id: string, config: IConfig);
    run(args: {
        prompt: string;
        options: Options;
        callbacks?: RunnerCallbacks;
        runFn: (args: {
            prompt: string;
            options: Options;
            callbacks?: RunnerCallbacks;
        }) => Promise<GenericMessage | undefined>;
    }): Promise<GenericMessage | undefined>;
}
/**
 * RecordingFactory creates Recorder instances with injected dependencies.
 * This is the injectable service that the @Record decorator uses.
 */
export declare class RecordingFactory implements IRecordingFactory {
    private config;
    constructor(config?: IConfig);
    createRecorder(category: string, id: string): IRecorder;
}
