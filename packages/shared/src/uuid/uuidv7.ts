import * as crypto from 'crypto';

/**
 * Generates a UUIDv7 per RFC 9562
 * Combines 48-bit Unix timestamp with 74 bits of cryptographically secure randomness.
 */
export function generateUuidV7(): string {
  const bytes = crypto.randomBytes(16);
  const now = Date.now();

  // Timestamp in ms (48 bits)
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;

  // Version 7 in bits 48-51
  bytes[6] = (bytes[6] & 0x0f) | 0x70;

  // Variant 1 (RFC 4122) in bits 64-65
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

/**
 * Validates if a string is a valid UUIDv7
 */
export function isValidUuidV7(uuid: string): boolean {
  const uuidv7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv7Regex.test(uuid);
}
