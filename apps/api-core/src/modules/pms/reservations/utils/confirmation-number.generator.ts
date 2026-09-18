import * as crypto from 'crypto';

// Crockford's Base32 alphabet: 32 uppercase characters omitting I, L, O, U to prevent reading ambiguity
const CROCKFORD_BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generates a human-readable, collision-resistant confirmation number
 * adhering to the canonical format: RES-<PROP_CODE>-<CROCKFORD32>
 * Example: RES-HOTL-7K9M2P
 */
export function generateConfirmationNumber(propertyCode: string, length: number = 6): string {
  // Normalize property code prefix (alphanumeric uppercase, max 6 chars)
  const cleanCode =
    propertyCode
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'PROP';

  const randomBytes = crypto.randomBytes(length);
  let randomPart = '';
  for (let i = 0; i < length; i++) {
    const index = randomBytes[i] % 32;
    randomPart += CROCKFORD_BASE32_ALPHABET[index];
  }

  return `RES-${cleanCode}-${randomPart}`;
}
