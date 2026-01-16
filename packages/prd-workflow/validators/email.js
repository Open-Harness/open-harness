"use strict";
/**
 * Email validation function that follows RFC 5322 standard
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEmail = validateEmail;
/**
 * Validates an email address according to RFC 5322 standard
 * @param email - The email address to validate
 * @returns true if the email is valid, false otherwise
 */
function validateEmail(email) {
    // Handle edge cases
    if (!email || typeof email !== 'string') {
        return false;
    }
    // Trim whitespace
    const trimmedEmail = email.trim();
    // Check for empty string after trimming
    if (trimmedEmail === '') {
        return false;
    }
    // RFC 5322 compliant email regex
    // This regex is a simplified but practical implementation of RFC 5322
    // It covers the most common valid email formats while rejecting invalid ones
    const rfc5322Regex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    // Basic length checks
    if (trimmedEmail.length > 254) {
        return false; // RFC 5321 limit for email addresses
    }
    // Split into local and domain parts
    const atIndex = trimmedEmail.lastIndexOf('@');
    if (atIndex === -1) {
        return false; // No @ symbol
    }
    const localPart = trimmedEmail.substring(0, atIndex);
    const domainPart = trimmedEmail.substring(atIndex + 1);
    // Local part length check (RFC 5321)
    if (localPart.length === 0 || localPart.length > 64) {
        return false;
    }
    // Domain part length check
    if (domainPart.length === 0 || domainPart.length > 253) {
        return false;
    }
    // Check for consecutive dots
    if (trimmedEmail.includes('..')) {
        return false;
    }
    // Check for leading or trailing dots in local part
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
        return false;
    }
    // Check for leading or trailing dots in domain part
    if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
        return false;
    }
    // Use the regex for final validation
    return rfc5322Regex.test(trimmedEmail);
}
