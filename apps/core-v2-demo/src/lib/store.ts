/**
 * Shared Store Instance
 *
 * Provides a singleton MemoryStore instance for the demo app.
 * This is shared between all API routes and the workflow handler.
 *
 * NOTE: Using MemoryStore means sessions are not persisted across server restarts.
 * For production, you would use SqliteStore with proper native module configuration.
 */

import { createMemoryStore, type PublicStore } from "@open-harness/core-v2";

/**
 * Singleton store Promise.
 * Cached to ensure we reuse the same store across all requests.
 */
let storePromise: Promise<PublicStore> | null = null;

/**
 * Get or create the shared store instance.
 *
 * @returns Promise resolving to the shared MemoryStore instance
 */
export function getStore(): Promise<PublicStore> {
  if (!storePromise) {
    storePromise = createMemoryStore();
  }
  return storePromise;
}
