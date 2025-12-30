// Local runtime shim for the Claude Agent SDK.
//
// Why this exists:
// - This spike lives inside a monorepo where dependencies are already present under
//   `packages/anthropic/node_modules/**`.
// - We want `spike-minimal-kernel` examples to be runnable without doing an install here.
//
// In a real package, you'd just depend on `@anthropic-ai/claude-agent-sdk` normally and remove this file.

export type * from "../../../../packages/anthropic/node_modules/@anthropic-ai/claude-agent-sdk/sdk";

import type * as Types from "../../../../packages/anthropic/node_modules/@anthropic-ai/claude-agent-sdk/sdk";
// This is runtime JS shipped by the SDK. It has no adjacent .d.ts, so we import it
// with an explicit suppress and then re-type exports using the SDK's .d.ts.
// @ts-expect-error - runtime module has no declaration file in this monorepo layout
import * as runtime from "../../../../packages/anthropic/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs";

export const query: typeof Types.query = runtime.query;
export const tool: typeof Types.tool = runtime.tool;
export const createSdkMcpServer: typeof Types.createSdkMcpServer = runtime.createSdkMcpServer;

export const HOOK_EVENTS: typeof Types.HOOK_EVENTS = runtime.HOOK_EVENTS;
export const EXIT_REASONS: typeof Types.EXIT_REASONS = runtime.EXIT_REASONS;
export const AbortError: typeof Types.AbortError = runtime.AbortError;

export const unstable_v2_createSession: typeof Types.unstable_v2_createSession = runtime.unstable_v2_createSession;
export const unstable_v2_resumeSession: typeof Types.unstable_v2_resumeSession = runtime.unstable_v2_resumeSession;
export const unstable_v2_prompt: typeof Types.unstable_v2_prompt = runtime.unstable_v2_prompt;
