/**
 * Email Validation Utilities
 *
 * Comprehensive email validation including:
 * - Format validation
 * - TLD validation
 * - Disposable email detection
 * - Common typo suggestions
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 */

/** Common valid TLDs */
const VALID_TLDS = new Set([
  // Generic
  'com', 'net', 'org', 'edu', 'gov', 'info', 'biz', 'io', 'co', 'app', 'dev',
  // European
  'de', 'at', 'ch', 'nl', 'be', 'fr', 'uk', 'es', 'it', 'pt', 'pl', 'cz', 'eu',
  // Other major
  'us', 'ca', 'au', 'nz', 'jp', 'kr', 'cn', 'in', 'br', 'mx', 'ru',
]);

/** Common disposable email domains to block */
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'throwaway.email', '10minutemail.com', 'guerrillamail.com',
  'mailinator.com', 'trashmail.com', 'fakeinbox.com', 'temp-mail.org',
  'disposablemail.com', 'yopmail.com', 'tempail.com', 'mohmal.com',
  'getnada.com', 'mailnesia.com', 'emailondeck.com', 'dispostable.com',
]);

/** Common email provider typos */
const EMAIL_TYPO_SUGGESTIONS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.de': 'gmail.com', // Gmail doesn't have .de
  'gmx.com': 'gmx.de', // GMX is mostly .de
  'outook.com': 'outlook.com',
  'outlok.com': 'outlook.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'web.com': 'web.de',
};

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Enhanced email validation
 * Checks format, TLD validity, disposable domains, and common typos
 */
export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim().toLowerCase();

  // Basic format check
  if (!trimmed) {
    return { isValid: false, error: 'E-Mail ist erforderlich' };
  }

  // More comprehensive regex: local@domain.tld
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Bitte gib eine gültige E-Mail-Adresse ein' };
  }

  // Extract domain parts
  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Ungültiges E-Mail-Format' };
  }

  const [localPart, domain] = parts;

  // Local part checks
  if (localPart.length < 1) {
    return { isValid: false, error: 'E-Mail-Adresse vor @ ist zu kurz' };
  }
  if (localPart.length > 64) {
    return { isValid: false, error: 'E-Mail-Adresse vor @ ist zu lang' };
  }

  // Domain checks
  if (domain.length < 4) {
    return { isValid: false, error: 'Domain ist zu kurz' };
  }
  if (domain.length > 255) {
    return { isValid: false, error: 'Domain ist zu lang' };
  }

  // Check for typos in common providers
  const suggestion = EMAIL_TYPO_SUGGESTIONS[domain];
  if (suggestion) {
    return {
      isValid: false,
      error: `Meintest du ${localPart}@${suggestion}?`,
      suggestion: `${localPart}@${suggestion}`,
    };
  }

  // Check for disposable email domains
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Wegwerf-E-Mail-Adressen sind nicht erlaubt',
    };
  }

  // Extract and validate TLD
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];

  if (tld.length < 2) {
    return { isValid: false, error: 'Ungültige Domain-Endung' };
  }

  // Check if TLD is in our known list (warning, not blocking)
  // We don't block unknown TLDs as new ones are created regularly
  if (!VALID_TLDS.has(tld) && tld.length > 6) {
    // Very long unknown TLDs are suspicious
    return {
      isValid: false,
      error: 'Bitte überprüfe die Domain-Endung',
    };
  }

  return { isValid: true };
}
