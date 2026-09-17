import { generateUuidV7, isValidUuidV7 } from '@hms/shared';

describe('UUIDv7 Utility', () => {
  it('should generate a valid UUIDv7 string', () => {
    const id = generateUuidV7();
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(36);
    expect(isValidUuidV7(id)).toBe(true);
  });

  it('should generate sequentially ordered IDs', async () => {
    const id1 = generateUuidV7();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id2 = generateUuidV7();

    expect(id1 < id2).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    expect(isValidUuidV7('invalid-uuid')).toBe(false);
    expect(isValidUuidV7('12345678-1234-4234-8234-123456789abc')).toBe(false); // UUIDv4
  });
});
