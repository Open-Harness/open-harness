/**
 * Request hashing utilities for recording lookup.
 *
 * Creates deterministic hashes from provider requests to enable
 * recording-based testing.
 *
 * @module
 */

import { createHash } from "node:crypto"

import type { ProviderRunOptions } from "./Provider.js"

/**
 * Create deterministic hash of provider request for recording lookup.
 *
 * Hash includes: prompt + outputSchema (JSON string) + providerOptions (sorted)
 * This ensures recordings are matched precisely by request content.
 *
 * @example
 * ```typescript
 * const hash = hashProviderRequest({
 *   prompt: "Create a plan",
 *   providerOptions: { model: "sonnet" },
 *   outputSchema: TaskSchema
 * })
 * // => "sha256:abc123..."
 * ```
 *
 * @param options - The provider run options to hash
 * @returns A deterministic hash string for recording lookup (sha256:hex)
 */
export const hashProviderRequest = (options: ProviderRunOptions): string => {
  // Build canonical string for hashing
  const parts: Array<string> = []

  // 1. Prompt (required)
  parts.push(`prompt:${options.prompt}`)

  // 2. Output schema (if present) - use Zod's shape description
  if (options.outputSchema) {
    // JSON.stringify the schema shape for deterministic string
    // Note: Zod schemas have _def which is the canonical definition
    try {
      parts.push(`schema:${JSON.stringify(options.outputSchema._def)}`)
    } catch {
      // Fallback to description if available
      parts.push(`schema:${options.outputSchema.description ?? "unknown"}`)
    }
  }

  // 3. Provider options (sorted keys for determinism)
  if (options.providerOptions) {
    const sortedKeys = Object.keys(options.providerOptions).sort()
    const sortedOptions: Record<string, unknown> = {}
    for (const key of sortedKeys) {
      sortedOptions[key] = options.providerOptions[key]
    }
    parts.push(`options:${JSON.stringify(sortedOptions)}`)
  }

  // 4. Tools (if present)
  if (options.tools && options.tools.length > 0) {
    parts.push(`tools:${JSON.stringify(options.tools)}`)
  }

  // Create SHA-256 hash
  const canonical = parts.join("|")
  const hash = createHash("sha256").update(canonical).digest("hex")

  return `sha256:${hash}`
}
