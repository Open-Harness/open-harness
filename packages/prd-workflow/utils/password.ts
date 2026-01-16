/**
 * Password utilities for secure password hashing and verification
 * Uses crypto module with PBKDF2 for bcrypt-like security
 */

import { pbkdf2Sync, randomBytes } from 'crypto';

/**
 * Number of iterations for PBKDF2 - chosen for security similar to bcrypt defaults
 */
const SALT_ROUNDS = 10000;

/**
 * Length of the salt in bytes
 */
const SALT_LENGTH = 16;

/**
 * Length of the derived key in bytes
 */
const KEY_LENGTH = 64;

/**
 * Hashes a plain text password using PBKDF2 with random salt
 *
 * @param password - The plain text password to hash
 * @returns A string containing the salt and hash, separated by a colon
 */
export function hashPassword(password: string): string {
  // Generate a random salt
  const salt = randomBytes(SALT_LENGTH);

  // Derive key using PBKDF2
  const hash = pbkdf2Sync(password, salt, SALT_ROUNDS, KEY_LENGTH, 'sha256');

  // Return salt and hash as hex strings, separated by colon
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verifies a plain text password against a stored hash
 *
 * @param password - The plain text password to verify
 * @param storedHash - The stored hash string (salt:hash format)
 * @returns True if the password matches the hash, false otherwise
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    // Split the stored hash into salt and hash components
    const [saltHex, hashHex] = storedHash.split(':');

    if (!saltHex || !hashHex) {
      return false;
    }

    // Convert salt from hex string back to buffer
    const salt = Buffer.from(saltHex, 'hex');

    // Derive key using the same parameters as hashPassword
    const hash = pbkdf2Sync(password, salt, SALT_ROUNDS, KEY_LENGTH, 'sha256');

    // Compare the derived hash with the stored hash
    const computedHashHex = hash.toString('hex');

    // Use constant-time comparison to prevent timing attacks
    return computedHashHex === hashHex;
  } catch (error) {
    // Return false if any error occurs during verification
    return false;
  }
}