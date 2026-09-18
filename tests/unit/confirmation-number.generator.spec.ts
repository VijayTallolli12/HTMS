import { generateConfirmationNumber } from '../../apps/api-core/src/modules/pms/reservations/utils/confirmation-number.generator';

describe('ConfirmationNumberGenerator (W1-T05)', () => {
  it('1. should generate a confirmation number matching canonical format RES-<PROP_CODE>-<CROCKFORD32>', () => {
    const conf = generateConfirmationNumber('HOTEL1');
    expect(conf).toMatch(/^RES-HOTEL1-[0-9A-HJKMNP-TV-Z]{6}$/);
  });

  it('2. should only contain Crockford Base32 characters (omitting I, L, O, U)', () => {
    for (let i = 0; i < 50; i++) {
      const conf = generateConfirmationNumber('PRP01');
      const randomPart = conf.split('-')[2];
      expect(randomPart).toHaveLength(6);
      expect(randomPart).not.toMatch(/[ILOU]/);
    }
  });

  it('3. should generate collision-free unique confirmation numbers across 100 iterations', () => {
    const generated = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const conf = generateConfirmationNumber('PROP');
      expect(generated.has(conf)).toBe(false);
      generated.add(conf);
    }
    expect(generated.size).toBe(100);
  });

  it('4. should normalize and sanitize property codes with special characters', () => {
    const conf = generateConfirmationNumber('prp-01_res!');
    expect(conf.startsWith('RES-PRP01R-')).toBe(true);
  });
});
