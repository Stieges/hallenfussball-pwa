
/**
 * Utility functions for generating and validating share codes.
 * Format: 6-character alphanumeric string (uppercase), avoiding ambiguous characters.
 */

// Excluding I, O, 0, 1 to avoid confusion
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Generates a random share code.
 * @returns {string} The generated code (e.g., "K9X2M4")
 */
export function generateShareCode(): string {
    let result = '';
    const randomValues = new Uint32Array(CODE_LENGTH);
    window.crypto.getRandomValues(randomValues);

    for (let i = 0; i < CODE_LENGTH; i++) {
        result += CHARS[randomValues[i] % CHARS.length];
    }

    return result;
}

/**
 * Validates the format of a share code.
 * @param code The code to validate
 * @returns {boolean} True if the format is valid
 */
export function isValidShareCodeFormat(code: string): boolean {
    if (!code || typeof code !== 'string') {return false;}
    // Case insensitive check, length 6, allowed chars only
    const regex = new RegExp(`^[${CHARS}]{${CODE_LENGTH}}$`, 'i');
    return regex.test(code);
}

/**
 * Normalizes a share code (uppercase, trimmed).
 */
export function normalizeShareCode(code: string): string {
    return code.trim().toUpperCase();
}
