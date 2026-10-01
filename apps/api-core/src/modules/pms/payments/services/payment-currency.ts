import { BadRequestException } from '@nestjs/common';

const CURRENCY_EXPONENTS: Readonly<Record<string, number>> = Object.freeze({
  JPY: 0, KRW: 0,
  USD: 2, EUR: 2, AED: 2, SAR: 2, QAR: 2, INR: 2,
  GBP: 2, CAD: 2, AUD: 2, PLN: 2, COP: 2,
  KWD: 3, BHD: 3, OMR: 3,
});

export function currencyExponent(currency: string): number {
  const code = currency.trim().toUpperCase();
  const exponent = CURRENCY_EXPONENTS[code];
  if (exponent === undefined) throw new BadRequestException(`Unsupported payment currency '${code}'.`);
  return exponent;
}

/** Convert provider minor units into the finance ledger's four-decimal representation. */
export function minorUnitsToFolioAmount(amount: number, currency: string): string {
  const exponent = currencyExponent(currency);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new BadRequestException('Gateway amount must be a positive safe integer in minor units.');
  }
  const digits = String(amount).padStart(exponent + 1, '0');
  const major = exponent === 0 ? digits : digits.slice(0, -exponent);
  const minor = exponent === 0 ? '' : digits.slice(-exponent);
  const fraction = `${minor}${'0'.repeat(4 - exponent)}`;
  return `${major}.${fraction}`;
}

/** Convert a four-decimal ledger balance to integer units at scale 10^-4. */
export function folioAmountToLedgerUnits(amount: string | number, currency: string): bigint {
  currencyExponent(currency);
  const value = String(amount).trim();
  if (!/^-?\d+(\.\d{1,4})?$/.test(value)) throw new BadRequestException('Invalid folio balance precision.');
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ''] = unsigned.split('.');
  const units = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0'));
  return negative ? -units : units;
}

export function minorUnitsToLedgerUnits(amount: number, currency: string): bigint {
  const exponent = currencyExponent(currency);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new BadRequestException('Gateway amount must be a positive safe integer in minor units.');
  }
  return BigInt(amount) * 10n ** BigInt(4 - exponent);
}

/** Convert a finance ledger decimal back to an exact provider minor-unit amount. */
export function folioAmountToMinorUnits(amount: string | number, currency: string): number {
  const exponent = currencyExponent(currency);
  const ledgerUnits = folioAmountToLedgerUnits(amount, currency);
  const scale = 10n ** BigInt(4 - exponent);
  if (ledgerUnits % scale !== 0n) throw new BadRequestException('Folio amount cannot be represented in the currency minor unit scale.');
  const minorUnits = ledgerUnits / scale;
  const absolute = minorUnits < 0n ? -minorUnits : minorUnits;
  if (absolute > BigInt(Number.MAX_SAFE_INTEGER)) throw new BadRequestException('Folio amount exceeds the supported safe integer range.');
  return Number(minorUnits);
}
