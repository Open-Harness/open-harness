/**
 * Tests for password hashing and verification utilities
 *
 * Comprehensive unit tests to verify the hashPassword and verifyPassword
 * functions work correctly with various inputs and edge cases.
 */

import { describe, it, expect } from "bun:test";
import { hashPassword, verifyPassword } from "./password.js";

describe("password utilities", () => {
  describe("hashPassword", () => {
    it("should return a string in salt:hash format", () => {
      const password = "testpassword123";
      const hash = hashPassword(password);

      // Should be a string with salt and hash separated by colon
      expect(typeof hash).toBe("string");
      expect(hash.split(":")).toHaveLength(2);

      const [salt, hashPart] = hash.split(":");
      expect(salt).toHaveLength(32); // 16 bytes * 2 (hex)
      expect(hashPart).toHaveLength(128); // 64 bytes * 2 (hex)
    });

    it("should generate different hashes for the same password", () => {
      const password = "samepassword";
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      // Should be different due to random salt
      expect(hash1).not.toBe(hash2);

      // But both should be valid format
      expect(hash1.split(":")).toHaveLength(2);
      expect(hash2.split(":")).toHaveLength(2);
    });

    it("should handle various password types", () => {
      const passwords = [
        "simple",
        "Complex123!@#",
        "very-long-password-with-many-characters-and-symbols-!@#$%^&*()",
        "12345678",
        "   spaces   ",
        "unicode💎🔐"
      ];

      passwords.forEach(password => {
        const hash = hashPassword(password);
        expect(typeof hash).toBe("string");
        expect(hash.split(":")).toHaveLength(2);
      });
    });

    it("should handle empty string password", () => {
      const hash = hashPassword("");
      expect(typeof hash).toBe("string");
      expect(hash.split(":")).toHaveLength(2);
    });
  });

  describe("verifyPassword", () => {
    it("should return true for correct password", () => {
      const password = "correctpassword";
      const hash = hashPassword(password);

      const isValid = verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should return false for incorrect password", () => {
      const correctPassword = "correctpassword";
      const wrongPassword = "wrongpassword";
      const hash = hashPassword(correctPassword);

      const isValid = verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it("should return false for malformed hash", () => {
      const password = "testpassword";

      // Test various malformed hashes
      expect(verifyPassword(password, "invalid")).toBe(false);
      expect(verifyPassword(password, "no-colon")).toBe(false);
      expect(verifyPassword(password, ":")).toBe(false);
      expect(verifyPassword(password, "only-salt:")).toBe(false);
      expect(verifyPassword(password, ":only-hash")).toBe(false);
      expect(verifyPassword(password, "")).toBe(false);
      expect(verifyPassword(password, "too:many:colons")).toBe(false);
    });

    it("should handle case sensitivity correctly", () => {
      const password = "CaseSensitive";
      const hash = hashPassword(password);

      expect(verifyPassword(password, hash)).toBe(true);
      expect(verifyPassword("casesensitive", hash)).toBe(false);
      expect(verifyPassword("CASESENSITIVE", hash)).toBe(false);
    });

    it("should work with various password types", () => {
      const passwords = [
        "simple",
        "Complex123!@#",
        "very-long-password-with-many-characters-and-symbols-!@#$%^&*()",
        "12345678",
        "   spaces   ",
        "unicode💎🔐",
        ""
      ];

      passwords.forEach(password => {
        const hash = hashPassword(password);
        expect(verifyPassword(password, hash)).toBe(true);
        expect(verifyPassword(password + "wrong", hash)).toBe(false);
      });
    });

    it("should handle invalid hex characters in hash gracefully", () => {
      const password = "testpassword";

      // Create a hash with invalid hex characters
      const validHash = hashPassword(password);
      const [salt] = validHash.split(":");
      const invalidHash = `${salt}:invalidhexcharacters`;

      expect(verifyPassword(password, invalidHash)).toBe(false);
    });

    it("should be consistent - same password and hash should always verify true", () => {
      const password = "consistencytest";
      const hash = hashPassword(password);

      // Verify multiple times
      for (let i = 0; i < 10; i++) {
        expect(verifyPassword(password, hash)).toBe(true);
      }
    });

    it("should be secure - similar passwords should not verify", () => {
      const basePassword = "password123";
      const hash = hashPassword(basePassword);

      const similarPasswords = [
        "password124",
        "password12",
        "password1234",
        "Password123",
        " password123",
        "password123 "
      ];

      similarPasswords.forEach(similarPassword => {
        expect(verifyPassword(similarPassword, hash)).toBe(false);
      });
    });
  });

  describe("integration tests", () => {
    it("should work end-to-end for user registration and login simulation", () => {
      // Simulate user registration
      const userPassword = "user123secure!";
      const storedHash = hashPassword(userPassword);

      // Simulate login attempts
      expect(verifyPassword(userPassword, storedHash)).toBe(true); // Correct login
      expect(verifyPassword("wrongpassword", storedHash)).toBe(false); // Wrong password
      expect(verifyPassword("", storedHash)).toBe(false); // Empty password
    });

    it("should handle multiple users with same password correctly", () => {
      const commonPassword = "commonpassword123";

      // Hash same password for different users
      const user1Hash = hashPassword(commonPassword);
      const user2Hash = hashPassword(commonPassword);

      // Hashes should be different (different salts)
      expect(user1Hash).not.toBe(user2Hash);

      // But both should verify correctly
      expect(verifyPassword(commonPassword, user1Hash)).toBe(true);
      expect(verifyPassword(commonPassword, user2Hash)).toBe(true);

      // And wrong password should fail for both
      expect(verifyPassword("wrongpassword", user1Hash)).toBe(false);
      expect(verifyPassword("wrongpassword", user2Hash)).toBe(false);
    });
  });
});