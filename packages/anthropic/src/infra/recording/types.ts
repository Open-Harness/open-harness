/**
 * Recording Types - Type definitions for the recording system
 *
 * Uses GenericMessage for provider-agnostic recording.
 */

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { GenericMessage, RunnerCallbacks } from "@openharness/sdk";

/**
 * A recorded session containing prompt, options, and messages.
 */
export type RecordedSession = {
	prompt: string;
	options: Options;
	messages: GenericMessage[];
};

/**
 * Interface for a single recording session.
 */
export interface IVaultSession {
	exists(): boolean;
	getMessages(): GenericMessage[];
	save(messages: GenericMessage[]): Promise<void>;
}

/**
 * Interface for the Vault - manages recording sessions.
 */
export interface IVault {
	startSession(category: string, id: string): Promise<IVaultSession>;
}

/**
 * Recorder handles the actual record/replay logic for a single session.
 */
export interface IRecorder {
	run(args: {
		prompt: string;
		options: Options;
		callbacks?: RunnerCallbacks;
		runFn: (args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }) => Promise<GenericMessage | undefined>;
	}): Promise<GenericMessage | undefined>;
}

/**
 * Factory for creating Recorder instances.
 */
export interface IRecordingFactory {
	createRecorder(category: string, id: string): IRecorder;
}
