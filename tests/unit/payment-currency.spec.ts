import { BadRequestException } from '@nestjs/common';
import {
  currencyExponent,
  folioAmountToLedgerUnits,
  folioAmountToMinorUnits,
  minorUnitsToFolioAmount,
  minorUnitsToLedgerUnits,
} from '../../apps/api-core/src/modules/pms/payments/services/payment-currency';

describe('payment currency exponent and conversions', () => {
  it.each([['JPY', 0], ['KRW', 0], ['USD', 2], ['EUR', 2], ['AED', 2], ['SAR', 2], ['QAR', 2], ['INR', 2], ['KWD', 3], ['BHD', 3], ['OMR', 3]])('uses %s exponent %i', (currency, exponent) => {
    expect(currencyExponent(currency)).toBe(exponent);
  });

  it.each([
    ['JPY', 123, '123.0000'],
    ['AED', 123, '1.2300'],
    ['SAR', 123, '1.2300'],
    ['QAR', 123, '1.2300'],
    ['KWD', 1234, '1.2340'],
    ['BHD', 1234, '1.2340'],
    ['OMR', 1234, '1.2340'],
  ])('converts %s minor units exactly without /100 assumptions', (currency, units, ledger) => {
    expect(minorUnitsToFolioAmount(Number(units), currency)).toBe(ledger);
    expect(folioAmountToMinorUnits(ledger, currency)).toBe(Number(units));
  });

  it('uses 4-decimal ledger units consistently', () => {
    expect(minorUnitsToLedgerUnits(123, 'JPY')).toBe(1230000n);
    expect(minorUnitsToLedgerUnits(123, 'AED')).toBe(12300n);
    expect(minorUnitsToLedgerUnits(1234, 'KWD')).toBe(12340n);
    expect(folioAmountToLedgerUnits('1.2340', 'KWD')).toBe(12340n);
  });

  it('rejects unknown currencies and inexact minor-unit conversion', () => {
    expect(() => currencyExponent('XXX')).toThrow(BadRequestException);
    expect(() => folioAmountToMinorUnits('1.2345', 'AED')).toThrow(BadRequestException);
  });
});
