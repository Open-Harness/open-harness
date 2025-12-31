/**
 * Recording Types - Type definitions for the recording system
 *
 * These types are Anthropic-specific as they use SDKMessage.
 */

import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunnerCallbacks } from "@openharness/sdk";

/**
 * A recorded session containing prompt, options, and messages.
 */
export type RecordedSession = {
	prompt: string;
	options: Options;
	messages: SDKMessage[];
};

/**
 * Interface for a single recording session.
 */
export interface IVaultSession {
	exists(): boolean;
	getMessages(): SDKMessage[];
	save(messages: SDKMessage[]): Promise<void>;
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
		runFn: (args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }) => Promise<SDKMessage | undefined>;
	}): Promise<SDKMessage | undefined>;
}

/**
 * Factory for creating Recorder instances.
 */
export interface IRecordingFactory {
	createRecorder(category: string, id: string): IRecorder;
}
