/**
 * ProviderModeContext - Effect context for provider caching mode.
 *
 * Mode is set at the server level, NOT per-provider:
 * - "live": Call API and cache results (including errors)
 * - "playback": Use cached results, never call API
 *
 * @module
 */

import { Context } from "effect"

import type { ProviderMode } from "../Domain/Provider.js"

/**
 * Context value containing the provider mode.
 */
export interface ProviderModeContextValue {
  readonly mode: ProviderMode
}

/**
 * Effect Context.Tag for provider mode.
 *
 * Used by withCaching() to determine whether to call API or use cache.
 * Server sets this globally - all providers read from the same context.
 *
 * @example
 * ```typescript
 * import { Effect, Layer } from "effect"
 * import { ProviderModeContext } from "@open-scaffold/core"
 *
 * // Server sets the mode
 * const modeLayer = Layer.succeed(
 *   ProviderModeContext,
 *   { mode: "live" }
 * )
 *
 * // Provider reads the mode
 * const getMode = Effect.gen(function*() {
 *   const ctx = yield* ProviderModeContext
 *   return ctx.mode // "live" | "playback"
 * })
 * ```
 */
export class ProviderModeContext extends Context.Tag("@open-scaffold/ProviderModeContext")<
  ProviderModeContext,
  ProviderModeContextValue
>() {}
