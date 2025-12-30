// Minimal Node.js type shims for this spike folder.
//
// This repo's root TS config may not include @types/node, but the spike intends
// to run in Node/Bun. These declarations keep the spike self-contained.

declare module "node:async_hooks" {
	export class AsyncLocalStorage<T = unknown> {
		getStore(): T | undefined;
		run<R>(store: T, callback: (...args: unknown[]) => R): R;
	}
}

declare module "node:crypto" {
	export function randomUUID(): string;
}

// TypeScript shim for the local runtime import used by `src/vendor/claude-agent-sdk.ts`.
// This makes the `.mjs` entrypoint type-safe by re-exporting its `.d.ts` types.
declare module "../../../packages/anthropic/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs" {
	export * from "../../../packages/anthropic/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts";
}
