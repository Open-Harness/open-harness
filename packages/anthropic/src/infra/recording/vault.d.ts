/**
 * Vault - Recording Storage for Agent Sessions
 *
 * Handles persisting and replaying LLM sessions for testing.
 * Pure Promise-based, no async generators.
 *
 * Node.js compatible - uses fs/promises instead of Bun APIs.
 */
import type { IConfig } from "@openharness/sdk";
import type { IVault, IVaultSession } from "./types.js";
/**
 * Vault manages recording sessions.
 * Injectable service that implements IVault.
 */
export declare class Vault implements IVault {
    private config;
    constructor(config?: IConfig);
    startSession(category: string, id: string): Promise<IVaultSession>;
}
