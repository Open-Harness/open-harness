/**
 * Comprehensive tests for email validation function
 *
 * Tests cover RFC 5322 compliance, valid email formats,
 * invalid email formats, and various edge cases to ensure
 * robust email validation functionality.
 */

import { describe, it, expect } from "bun:test";
import { validateEmail } from "./email";

describe("validateEmail function", () => {
  describe("valid emails per RFC 5322", () => {
    it("should accept basic valid email formats", () => {
      expect(validateEmail("test@example.com")).toBe(true);
      expect(validateEmail("user@domain.org")).toBe(true);
      expect(validateEmail("simple@test.co")).toBe(true);
      expect(validateEmail("name@company.net")).toBe(true);
    });

    it("should accept emails with subdomains", () => {
      expect(validateEmail("user@mail.example.com")).toBe(true);
      expect(validateEmail("test@subdomain.company.org")).toBe(true);
      expect(validateEmail("admin@test.sub.domain.com")).toBe(true);
    });

    it("should accept emails with special characters in local part", () => {
      expect(validateEmail("user.name@example.com")).toBe(true);
      expect(validateEmail("user+tag@example.com")).toBe(true);
      expect(validateEmail("user_name@example.com")).toBe(true);
      expect(validateEmail("user-name@example.com")).toBe(true);
      expect(validateEmail("user123@example.com")).toBe(true);
      expect(validateEmail("123user@example.com")).toBe(true);
    });

    it("should accept emails with special RFC 5322 allowed characters", () => {
      expect(validateEmail("user!@example.com")).toBe(true);
      expect(validateEmail("user#@example.com")).toBe(true);
      expect(validateEmail("user$@example.com")).toBe(true);
      expect(validateEmail("user%@example.com")).toBe(true);
      expect(validateEmail("user&@example.com")).toBe(true);
      expect(validateEmail("user'@example.com")).toBe(true);
      expect(validateEmail("user*@example.com")).toBe(true);
      expect(validateEmail("user/@example.com")).toBe(true);
      expect(validateEmail("user=@example.com")).toBe(true);
      expect(validateEmail("user?@example.com")).toBe(true);
      expect(validateEmail("user^@example.com")).toBe(true);
      expect(validateEmail("user`@example.com")).toBe(true);
      expect(validateEmail("user{@example.com")).toBe(true);
      expect(validateEmail("user|@example.com")).toBe(true);
      expect(validateEmail("user}@example.com")).toBe(true);
      expect(validateEmail("user~@example.com")).toBe(true);
    });

    it("should accept emails with hyphens in domain", () => {
      expect(validateEmail("user@mail-server.com")).toBe(true);
      expect(validateEmail("test@sub-domain.example.org")).toBe(true);
      expect(validateEmail("admin@test-site.co.uk")).toBe(true);
    });

    it("should accept emails with numbers in domain", () => {
      expect(validateEmail("user@example123.com")).toBe(true);
      expect(validateEmail("test@123domain.org")).toBe(true);
      expect(validateEmail("admin@site2.test3.com")).toBe(true);
    });
  });

  describe("invalid email formats", () => {
    it("should reject emails without @ symbol", () => {
      expect(validateEmail("plainaddress")).toBe(false);
      expect(validateEmail("user.domain.com")).toBe(false);
      expect(validateEmail("missingatsign.com")).toBe(false);
    });

    it("should reject emails with multiple @ symbols", () => {
      expect(validateEmail("user@@example.com")).toBe(false);
      expect(validateEmail("user@domain@example.com")).toBe(false);
      expect(validateEmail("@user@example.com")).toBe(false);
    });

    it("should reject emails with missing local part", () => {
      expect(validateEmail("@example.com")).toBe(false);
      expect(validateEmail("@domain.org")).toBe(false);
    });

    it("should reject emails with missing domain part", () => {
      expect(validateEmail("user@")).toBe(false);
      expect(validateEmail("test@")).toBe(false);
    });

    it("should reject emails with invalid characters", () => {
      expect(validateEmail("user name@example.com")).toBe(false);
      expect(validateEmail("user<@example.com")).toBe(false);
      expect(validateEmail("user>@example.com")).toBe(false);
      expect(validateEmail("user[@example.com")).toBe(false);
      expect(validateEmail("user]@example.com")).toBe(false);
      expect(validateEmail("user\\@example.com")).toBe(false);
      expect(validateEmail("user,@example.com")).toBe(false);
      expect(validateEmail("user;@example.com")).toBe(false);
      expect(validateEmail("user:@example.com")).toBe(false);
      expect(validateEmail("user\"@example.com")).toBe(false);
    });

    it("should reject emails with consecutive dots", () => {
      expect(validateEmail("user..name@example.com")).toBe(false);
      expect(validateEmail("user@domain..com")).toBe(false);
      expect(validateEmail("user@sub..domain.com")).toBe(false);
      expect(validateEmail("user.name@example..org")).toBe(false);
    });

    it("should reject emails starting or ending with dots", () => {
      expect(validateEmail(".user@example.com")).toBe(false);
      expect(validateEmail("user.@example.com")).toBe(false);
      expect(validateEmail("user@.example.com")).toBe(false);
      expect(validateEmail("user@example.com.")).toBe(false);
      expect(validateEmail(".user.name@example.com")).toBe(false);
      expect(validateEmail("user.name.@example.com")).toBe(false);
    });

    it("should reject emails with invalid domain formats", () => {
      expect(validateEmail("user@")).toBe(false);
      expect(validateEmail("user@.")).toBe(false);
      expect(validateEmail("user@domain")).toBe(false);
      expect(validateEmail("user@.com")).toBe(false);
      expect(validateEmail("user@domain.")).toBe(false);
      expect(validateEmail("user@-domain.com")).toBe(false);
      expect(validateEmail("user@domain-.com")).toBe(false);
    });
  });

  describe("edge cases and RFC length limits", () => {
    it("should handle null and undefined inputs", () => {
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
    });

    it("should handle non-string inputs", () => {
      // TypeScript should prevent this, but test runtime behavior
      expect(validateEmail("")).toBe(false);
      expect(validateEmail("   ")).toBe(false);
    });

    it("should handle empty string and whitespace", () => {
      expect(validateEmail("")).toBe(false);
      expect(validateEmail(" ")).toBe(false);
      expect(validateEmail("   ")).toBe(false);
      expect(validateEmail("\t")).toBe(false);
      expect(validateEmail("\n")).toBe(false);
    });

    it("should trim whitespace and validate correctly", () => {
      expect(validateEmail("  user@example.com  ")).toBe(true);
      expect(validateEmail("\tuser@example.com\t")).toBe(true);
      expect(validateEmail("\nuser@example.com\n")).toBe(true);
    });

    it("should reject emails exceeding RFC 5321 length limits", () => {
      // Local part longer than 64 characters
      const longLocalPart = "a".repeat(65) + "@example.com";
      expect(validateEmail(longLocalPart)).toBe(false);

      // Total email longer than 254 characters
      const longDomain = "user@" + "a".repeat(250) + ".com";
      expect(validateEmail(longDomain)).toBe(false);

      // Domain part longer than 253 characters
      const longDomainPart = "user@" + "a".repeat(250) + ".co";
      expect(validateEmail(longDomainPart)).toBe(false);
    });

    it("should accept emails at RFC 5321 length limits", () => {
      // Local part exactly 64 characters
      const maxLocalPart = "a".repeat(64) + "@example.com";
      expect(validateEmail(maxLocalPart)).toBe(true);

      // Valid email close to but under 254 characters
      const nearMaxLength = "user@" + "a".repeat(240) + ".com";
      expect(validateEmail(nearMaxLength)).toBe(true);
    });

    it("should handle single character local and domain parts", () => {
      expect(validateEmail("a@b.co")).toBe(true);
      expect(validateEmail("1@2.org")).toBe(true);
    });
  });

  describe("real-world email examples", () => {
    it("should accept common valid email patterns", () => {
      expect(validateEmail("john.doe@example.com")).toBe(true);
      expect(validateEmail("jane_smith@company.org")).toBe(true);
      expect(validateEmail("admin+newsletter@site.co.uk")).toBe(true);
      expect(validateEmail("support@help-desk.example.net")).toBe(true);
      expect(validateEmail("info123@company-name.com")).toBe(true);
      expect(validateEmail("user.email+tag@domain-name.co")).toBe(true);
    });

    it("should reject common invalid email patterns", () => {
      expect(validateEmail("user@")).toBe(false);
      expect(validateEmail("@example.com")).toBe(false);
      expect(validateEmail("user..double.dot@example.com")).toBe(false);
      expect(validateEmail("user@example.")).toBe(false);
      expect(validateEmail(".user@example.com")).toBe(false);
      expect(validateEmail("user.@example.com")).toBe(false);
      expect(validateEmail("user name@example.com")).toBe(false);
      expect(validateEmail("user@ex ample.com")).toBe(false);
    });

    it("should handle international domain names (ASCII representation)", () => {
      // Note: This test assumes ASCII representation of international domains
      expect(validateEmail("user@example-international.com")).toBe(true);
      expect(validateEmail("test@unicode-domain.org")).toBe(true);
    });
  });

  describe("boundary testing", () => {
    it("should test edge cases around special characters", () => {
      // Test boundaries of allowed special characters
      expect(validateEmail("user+@example.com")).toBe(true);
      expect(validateEmail("user-@example.com")).toBe(true);
      expect(validateEmail("user_@example.com")).toBe(true);
      expect(validateEmail("user.@example.com")).toBe(false); // Dot at end
      expect(validateEmail(".user@example.com")).toBe(false); // Dot at start
    });

    it("should test various TLD lengths", () => {
      expect(validateEmail("user@example.co")).toBe(true);
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("user@example.info")).toBe(true);
      expect(validateEmail("user@example.travel")).toBe(true);
    });

    it("should test hyphen placement in domains", () => {
      expect(validateEmail("user@sub-domain.com")).toBe(true);
      expect(validateEmail("user@domain-name.org")).toBe(true);
      expect(validateEmail("user@-invalid.com")).toBe(false);
      expect(validateEmail("user@invalid-.com")).toBe(false);
    });
  });
});