import { describe, expect, it } from "vitest";
import { validateEmail, validateEmailExtended } from "./email-validator";

describe("validateEmail", () => {
	describe("valid emails", () => {
		it("should validate simple email addresses", () => {
			expect(validateEmail("user@example.com")).toBe(true);
			expect(validateEmail("test@test.org")).toBe(true);
			expect(validateEmail("admin@site.net")).toBe(true);
		});

		it("should validate emails with subdomains", () => {
			expect(validateEmail("user@mail.example.com")).toBe(true);
			expect(validateEmail("admin@subdomain.example.co.uk")).toBe(true);
		});

		it("should validate emails with special characters in local part", () => {
			expect(validateEmail("user+tag@example.com")).toBe(true);
			expect(validateEmail("user.name@example.com")).toBe(true);
			expect(validateEmail("user_name@example.com")).toBe(true);
			expect(validateEmail("user-name@example.com")).toBe(true);
			expect(validateEmail("first.last@example.com")).toBe(true);
		});

		it("should validate emails with numbers", () => {
			expect(validateEmail("user123@example.com")).toBe(true);
			expect(validateEmail("123user@example.com")).toBe(true);
			expect(validateEmail("user@example123.com")).toBe(true);
		});

		it("should validate emails with hyphens in domain", () => {
			expect(validateEmail("user@my-domain.com")).toBe(true);
			expect(validateEmail("user@example-site.co.uk")).toBe(true);
		});

		it("should validate long but valid emails", () => {
			const longLocal = "a".repeat(64);
			expect(validateEmail(`${longLocal}@example.com`)).toBe(true);
		});
	});

	describe("invalid emails", () => {
		it("should reject empty or invalid inputs", () => {
			expect(validateEmail("")).toBe(false);
			expect(validateEmail("   ")).toBe(false);
			// biome-ignore lint/suspicious/noExplicitAny: Testing edge case with invalid input
			expect(validateEmail(null as any)).toBe(false);
			// biome-ignore lint/suspicious/noExplicitAny: Testing edge case with invalid input
			expect(validateEmail(undefined as any)).toBe(false);
		});

		it("should reject emails without @ symbol", () => {
			expect(validateEmail("userexample.com")).toBe(false);
			expect(validateEmail("user.example.com")).toBe(false);
		});

		it("should reject emails with multiple @ symbols", () => {
			expect(validateEmail("user@@example.com")).toBe(false);
			expect(validateEmail("user@example@com")).toBe(false);
		});

		it("should reject emails without domain extension", () => {
			expect(validateEmail("user@example")).toBe(false);
			expect(validateEmail("user@localhost")).toBe(false);
		});

		it("should reject emails with invalid characters", () => {
			expect(validateEmail("user name@example.com")).toBe(false);
			expect(validateEmail("user@exam ple.com")).toBe(false);
			expect(validateEmail("user<>@example.com")).toBe(false);
		});

		it("should reject emails with consecutive dots", () => {
			expect(validateEmail("user..name@example.com")).toBe(false);
			expect(validateEmail("user@example..com")).toBe(false);
		});

		it("should reject emails starting or ending with dots", () => {
			expect(validateEmail(".user@example.com")).toBe(false);
			expect(validateEmail("user.@example.com")).toBe(false);
			expect(validateEmail("user@.example.com")).toBe(false);
			expect(validateEmail("user@example.com.")).toBe(false);
		});

		it("should reject emails with invalid domain hyphens", () => {
			expect(validateEmail("user@-example.com")).toBe(false);
			expect(validateEmail("user@example-.com")).toBe(false);
		});

		it("should reject emails that are too long", () => {
			const tooLong = "a".repeat(256);
			expect(validateEmail(`${tooLong}@example.com`)).toBe(false);
		});

		it("should reject emails with local part too long", () => {
			const longLocal = "a".repeat(65);
			expect(validateEmail(`${longLocal}@example.com`)).toBe(false);
		});

		it("should reject emails with invalid TLD", () => {
			expect(validateEmail("user@example.c")).toBe(false);
			expect(validateEmail("user@example.123")).toBe(false);
			expect(validateEmail("user@example.c1")).toBe(false);
		});

		it("should reject emails with missing local or domain part", () => {
			expect(validateEmail("@example.com")).toBe(false);
			expect(validateEmail("user@")).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("should handle whitespace trimming", () => {
			expect(validateEmail("  user@example.com  ")).toBe(true);
			expect(validateEmail("\tuser@example.com\n")).toBe(true);
		});

		it("should validate emails with multiple subdomains", () => {
			expect(validateEmail("user@mail.subdomain.example.com")).toBe(true);
		});

		it("should validate emails with allowed special characters", () => {
			expect(validateEmail("user!name@example.com")).toBe(true);
			expect(validateEmail("user#name@example.com")).toBe(true);
			expect(validateEmail("user$name@example.com")).toBe(true);
		});
	});
});

describe("validateEmailExtended", () => {
	describe("valid emails", () => {
		it("should return isValid true for valid emails", () => {
			expect(validateEmailExtended("user@example.com")).toEqual({
				isValid: true,
			});
			expect(validateEmailExtended("test.user@example.co.uk")).toEqual({
				isValid: true,
			});
		});
	});

	describe("invalid emails with error messages", () => {
		it("should provide error for empty email", () => {
			const result = validateEmailExtended("");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Email must be a non-empty string");
		});

		it("should provide error for non-string input", () => {
			// biome-ignore lint/suspicious/noExplicitAny: Testing edge case with invalid input
			const result = validateEmailExtended(null as any);
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Email must be a non-empty string");
		});

		it("should provide error for email too long", () => {
			const longEmail = `${"a".repeat(256)}@example.com`;
			const result = validateEmailExtended(longEmail);
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Email is too long (max 254 characters)");
		});

		it("should provide error for consecutive dots", () => {
			const result = validateEmailExtended("user..name@example.com");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Email contains consecutive dots");
		});

		it("should provide error for missing @ symbol", () => {
			const result = validateEmailExtended("userexample.com");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Email must contain @ symbol");
		});

		it("should provide error for multiple @ symbols", () => {
			const result = validateEmailExtended("user@@example.com");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Email must contain exactly one @ symbol");
		});

		it("should provide error for empty local part", () => {
			const result = validateEmailExtended("@example.com");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Local part (before @) cannot be empty");
		});

		it("should provide error for local part too long", () => {
			const longLocal = "a".repeat(65);
			const result = validateEmailExtended(`${longLocal}@example.com`);
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Local part is too long (max 64 characters)");
		});

		it("should provide error for local part starting with dot", () => {
			const result = validateEmailExtended(".user@example.com");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Local part cannot start or end with a dot");
		});

		it("should provide error for missing domain", () => {
			const result = validateEmailExtended("user@");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Domain (after @) cannot be empty");
		});

		it("should provide error for domain without dot", () => {
			const result = validateEmailExtended("user@example");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Domain must contain at least one dot");
		});

		it("should provide error for domain starting with dot", () => {
			const result = validateEmailExtended("user@.example.com");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Domain cannot start or end with a dot");
		});

		it("should provide error for invalid TLD", () => {
			const result = validateEmailExtended("user@example.c");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Top-level domain must be at least 2 characters");
		});

		it("should provide error for TLD with numbers", () => {
			const result = validateEmailExtended("user@example.c1m");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Top-level domain must contain only letters");
		});

		it("should provide error for domain part with leading hyphen", () => {
			const result = validateEmailExtended("user@-example.com");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Domain parts cannot start or end with hyphen");
		});

		it("should provide error for invalid characters", () => {
			const result = validateEmailExtended("user name@example.com");
			expect(result.isValid).toBe(false);
			expect(result.error).toBe("Email contains invalid characters");
		});
	});

	describe("edge cases", () => {
		it("should handle whitespace trimming", () => {
			const result = validateEmailExtended("  user@example.com  ");
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should validate complex valid emails", () => {
			const emails = ["user+tag@example.com", "first.last@example.co.uk", "user123@sub.domain.example.com"];

			for (const email of emails) {
				const result = validateEmailExtended(email);
				expect(result.isValid).toBe(true);
				expect(result.error).toBeUndefined();
			}
		});
	});
});
