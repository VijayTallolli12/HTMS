/**
 * Shared currency formatting utility — single source of truth for money display.
 *
 * The currency must always come from the active property context
 * (OrganizationService.activePropertyContext → PropertyDto.currency),
 * never from a hardcoded default. Callers pass the active property's
 * currency; an empty currency degrades gracefully to a plain number.
 */
export function formatMoney(amount: number, currency: string): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  if (!currency) {
    return safeAmount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(safeAmount);
  } catch {
    // Unknown currency code — show ISO code prefix instead of a wrong symbol.
    return `${currency} ${safeAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}
