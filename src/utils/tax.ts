import type { InvoiceTemplate } from '../lib/api';

export type TaxSettings = Pick<InvoiceTemplate, 'tax_enabled' | 'tax_label' | 'tax_rate' | 'tax_inclusive'>;

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  tax_enabled: true,
  tax_label: 'GST',
  tax_rate: 10,
  tax_inclusive: false,
};

export function taxActive(t: TaxSettings | null | undefined): boolean {
  if (!t || !t.tax_enabled) return false;
  const rate = Math.max(0, Number(t.tax_rate) || 0);
  return rate > 0;
}

/**
 * Break a stored transaction amount into (price, tax, lineTotal) according to the user's tax settings.
 * Must match the server-side `computeInvoiceTotals` logic exactly so the transaction history, the
 * send-invoice modal, and the generated invoice email all show the same numbers.
 *
 * `applyTax` is the per-line override (e.g. for GST-free items). When it's false the tax is
 * skipped for this line regardless of the global tax setting.
 */
export function splitLine(
  amount: number,
  t: TaxSettings | null | undefined,
  applyTax: boolean = true,
) {
  const raw = Number(amount) || 0;
  if (!taxActive(t) || !applyTax) return { price: raw, tax: 0, lineTotal: raw };
  const rate = Math.max(0, Number(t!.tax_rate) || 0);
  const factor = rate / 100;
  if (t!.tax_inclusive) {
    const price = raw / (1 + factor);
    const tax = raw - price;
    return { price, tax, lineTotal: raw };
  }
  const tax = raw * factor;
  return { price: raw, tax, lineTotal: raw + tax };
}

export function formatMoney(n: number): string {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}
