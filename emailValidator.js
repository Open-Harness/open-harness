/**
 * Validates an email address according to common email format standards.
 *
 * Validation rules:
 * - Must contain exactly one @ symbol
 * - Username (before @) must be 1-64 characters
 * - Domain (after @) must be valid format with at least one dot
 * - Allows alphanumeric characters, dots, hyphens, underscores in username
 * - No consecutive dots or dots at start/end of username
 * - Domain must have valid TLD
 *
 * @param {string} email - The email address to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateEmail(email) {
  // Check if email is a string and not empty
  if (typeof email !== 'string' || email.trim() === '') {
    return false;
  }

  // Trim whitespace
  email = email.trim();

  // Basic length check (max email length is 254 characters per RFC 5321)
  if (email.length > 254) {
    return false;
  }

  // Check for exactly one @ symbol
  const atCount = (email.match(/@/g) || []).length;
  if (atCount !== 1) {
    return false;
  }

  // Split into username and domain parts
  const [username, domain] = email.split('@');

  // Validate username part
  if (!username || username.length > 64) {
    return false;
  }

  // Check for invalid patterns in username
  if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) {
    return false;
  }

  // Validate username characters (alphanumeric, dot, hyphen, underscore, plus)
  const usernameRegex = /^[a-zA-Z0-9._+-]+$/;
  if (!usernameRegex.test(username)) {
    return false;
  }

  // Validate domain part
  if (!domain || domain.length > 253) {
    return false;
  }

  // Domain must contain at least one dot
  if (!domain.includes('.')) {
    return false;
  }

  // Check for invalid patterns in domain
  if (domain.startsWith('.') || domain.endsWith('.') ||
      domain.startsWith('-') || domain.endsWith('-') ||
      domain.includes('..')) {
    return false;
  }

  // Validate domain format (labels separated by dots)
  const domainParts = domain.split('.');

  // Each domain part must be valid
  for (const part of domainParts) {
    if (part.length === 0 || part.length > 63) {
      return false;
    }

    // Domain labels can only contain alphanumeric and hyphens
    // Cannot start or end with hyphen
    const domainPartRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    if (!domainPartRegex.test(part)) {
      return false;
    }
  }

  // TLD (last part) must be at least 2 characters and alphabetic
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return false;
  }

  return true;
}

/**
 * Alternative: Regex-based email validation (simpler but less granular error handling)
 *
 * @param {string} email - The email address to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateEmailRegex(email) {
  if (typeof email !== 'string' || email.trim() === '') {
    return false;
  }

  // Comprehensive regex pattern for email validation
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  return emailRegex.test(email.trim()) && email.trim().length <= 254;
}

// Export functions for use in other modules
export { validateEmail, validateEmailRegex };

// Example usage and tests
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Email Validation Tests:\n');

  // Valid emails
  const validEmails = [
    'user@example.com',
    'john.doe@company.co.uk',
    'test+tag@domain.org',
    'user_123@sub.domain.com',
    'a@b.co',
    'first.last@example.com',
    'user+filter@mail-server.com'
  ];

  console.log('Valid Emails:');
  validEmails.forEach(email => {
    console.log(`  ${email}: ${validateEmail(email) ? '✓ PASS' : '✗ FAIL'}`);
  });

  // Invalid emails
  const invalidEmails = [
    '',
    'notanemail',
    '@example.com',
    'user@',
    'user@@example.com',
    'user@domain',
    'user..name@example.com',
    '.user@example.com',
    'user.@example.com',
    'user@.example.com',
    'user@example..com',
    'user name@example.com',
    'user@domain.c',
    'user@-domain.com',
    'user@domain-.com'
  ];

  console.log('\nInvalid Emails:');
  invalidEmails.forEach(email => {
    console.log(`  "${email}": ${!validateEmail(email) ? '✓ PASS (correctly rejected)' : '✗ FAIL (should be rejected)'}`);
  });

  // Compare with regex version
  console.log('\n\nRegex Validation Comparison:');
  [...validEmails, ...invalidEmails].slice(0, 5).forEach(email => {
    const detailed = validateEmail(email);
    const regex = validateEmailRegex(email);
    console.log(`  ${email}: detailed=${detailed}, regex=${regex}`);
  });
}
