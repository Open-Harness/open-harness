/**
 * Validates an email address according to RFC 5322 standards
 *
 * @param email - The email address to validate
 * @returns true if the email is valid, false otherwise
 *
 * @example
 * ```typescript
 * validateEmail('user@example.com') // true
 * validateEmail('invalid.email') // false
 * validateEmail('user+tag@example.co.uk') // true
 * ```
 */
export function validateEmail(email: string): boolean {
	if (!email || typeof email !== "string") {
		return false;
	}

	// Trim whitespace
	email = email.trim();

	// Check basic length constraints
	if (email.length === 0 || email.length > 254) {
		return false;
	}

	// Check for consecutive dots
	if (email.includes("..")) {
		return false;
	}

	// Split into local and domain parts
	const parts = email.split("@");

	// Must have exactly one @ symbol
	if (parts.length !== 2) {
		return false;
	}

	const [localPart, domain] = parts;

	// Validate local part length (before @)
	if (localPart.length === 0 || localPart.length > 64) {
		return false;
	}

	// Local part cannot start or end with dot
	if (localPart.startsWith(".") || localPart.endsWith(".")) {
		return false;
	}

	// Regular expression for email validation
	// This pattern covers most common email formats while being practical
	const emailRegex =
		/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

	if (!emailRegex.test(email)) {
		return false;
	}

	// Validate domain part length (after @)
	if (domain.length === 0 || domain.length > 253) {
		return false;
	}

	// Domain must contain at least one dot
	if (!domain.includes(".")) {
		return false;
	}

	// Check that domain parts are valid
	const domainParts = domain.split(".");

	// Each domain part must be non-empty and not start/end with hyphen
	for (const part of domainParts) {
		if (part.length === 0 || part.length > 63) {
			return false;
		}
		if (part.startsWith("-") || part.endsWith("-")) {
			return false;
		}
	}

	// Last domain part (TLD) must be at least 2 characters and all letters
	const tld = domainParts[domainParts.length - 1];
	if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
		return false;
	}

	return true;
}

/**
 * Extended email validation that also checks for common typos and issues
 *
 * @param email - The email address to validate
 * @returns An object with validation result and optional error message
 *
 * @example
 * ```typescript
 * validateEmailExtended('user@example.com')
 * // { isValid: true }
 *
 * validateEmailExtended('user@example..com')
 * // { isValid: false, error: 'Domain contains consecutive dots' }
 * ```
 */
export function validateEmailExtended(email: string): {
	isValid: boolean;
	error?: string;
} {
	if (!email || typeof email !== "string") {
		return { isValid: false, error: "Email must be a non-empty string" };
	}

	email = email.trim();

	if (email.length === 0) {
		return { isValid: false, error: "Email cannot be empty" };
	}

	if (email.length > 254) {
		return { isValid: false, error: "Email is too long (max 254 characters)" };
	}

	// Check for consecutive dots
	if (email.includes("..")) {
		return { isValid: false, error: "Email contains consecutive dots" };
	}

	// Check for @ symbol
	if (!email.includes("@")) {
		return { isValid: false, error: "Email must contain @ symbol" };
	}

	const parts = email.split("@");

	if (parts.length !== 2) {
		return { isValid: false, error: "Email must contain exactly one @ symbol" };
	}

	const [localPart, domain] = parts;

	if (localPart.length === 0) {
		return { isValid: false, error: "Local part (before @) cannot be empty" };
	}

	if (localPart.length > 64) {
		return { isValid: false, error: "Local part is too long (max 64 characters)" };
	}

	if (localPart.startsWith(".") || localPart.endsWith(".")) {
		return { isValid: false, error: "Local part cannot start or end with a dot" };
	}

	if (domain.length === 0) {
		return { isValid: false, error: "Domain (after @) cannot be empty" };
	}

	if (domain.length > 253) {
		return { isValid: false, error: "Domain is too long (max 253 characters)" };
	}

	if (!domain.includes(".")) {
		return { isValid: false, error: "Domain must contain at least one dot" };
	}

	if (domain.startsWith(".") || domain.endsWith(".")) {
		return { isValid: false, error: "Domain cannot start or end with a dot" };
	}

	const domainParts = domain.split(".");

	for (const part of domainParts) {
		if (part.length === 0) {
			return { isValid: false, error: "Domain parts cannot be empty" };
		}
		if (part.length > 63) {
			return { isValid: false, error: "Domain part is too long (max 63 characters)" };
		}
		if (part.startsWith("-") || part.endsWith("-")) {
			return { isValid: false, error: "Domain parts cannot start or end with hyphen" };
		}
	}

	const tld = domainParts[domainParts.length - 1];
	if (tld.length < 2) {
		return { isValid: false, error: "Top-level domain must be at least 2 characters" };
	}

	if (!/^[a-zA-Z]+$/.test(tld)) {
		return { isValid: false, error: "Top-level domain must contain only letters" };
	}

	// Final regex check for allowed characters
	const emailRegex =
		/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

	if (!emailRegex.test(email)) {
		return { isValid: false, error: "Email contains invalid characters" };
	}

	return { isValid: true };
}
