import { useEffect, useMemo, useState } from 'react';
import { X, Eye, Send, ArrowLeft, Receipt, History } from 'lucide-react';
import { api, type InvoiceSummary } from '../lib/api';
import type { Transaction } from '../lib/database.types';
import { DEFAULT_TAX_SETTINGS, splitLine, taxActive, type TaxSettings } from '../utils/tax';

type CustomerLike = {
  id: number;
  name: string;
  email: string;
};

interface SendInvoiceModalProps {
  customer: CustomerLike;
  onClose: () => void;
  onSent: () => void;
}

type Stage = 'select' | 'preview';
type Tab = 'new' | 'history';

function toDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  const s = String(value).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function formatMoney(n: number) {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export default function SendInvoiceModal({ customer, onClose, onSent }: SendInvoiceModalProps) {
  const [tab, setTab] = useState<Tab>('new');
  const [stage, setStage] = useState<Stage>('select');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubtotal, setPreviewSubtotal] = useState<number>(0);
  const [previewTax, setPreviewTax] = useState<number>(0);
  const [previewTotal, setPreviewTotal] = useState<number>(0);
  const [previewNumber, setPreviewNumber] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [pastInvoices, setPastInvoices] = useState<InvoiceSummary[] | null>(null);
  const [pastLoading, setPastLoading] = useState(false);
  const [viewInvoiceHtml, setViewInvoiceHtml] = useState<{ number: string; html: string } | null>(null);
  const [tax, setTax] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);

  useEffect(() => {
    api.invoiceTemplate
      .get()
      .then((t) => setTax({ tax_enabled: t.tax_enabled, tax_label: t.tax_label, tax_rate: t.tax_rate, tax_inclusive: t.tax_inclusive }))
      .catch(() => { /* keep defaults */ });
  }, []);

  const showTax = taxActive(tax);

  useEffect(() => {
    let alive = true;
    api.transactions
      .list(customer.id)
      .then((data) => {
        if (!alive) return;
        const rows = ((data || []) as Transaction[]).slice().sort((a, b) => {
          const da = toDateOnly(a.date);
          const db = toDateOnly(b.date);
          return db.localeCompare(da);
        });
        setTransactions(rows);
        // Pre-select rows that are unpaid AND not yet invoiced (those are the ones that still need billing).
        const defaults = new Set<number>(
          rows.filter((t) => !t.paid_fully && !t.invoiced_at).map((t) => t.id),
        );
        setSelectedIds(defaults);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Failed to load transactions');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [customer.id]);

  async function loadPastInvoices() {
    setPastLoading(true);
    try {
      const list = await api.customers.listInvoices(customer.id);
      setPastInvoices(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load past invoices');
    } finally {
      setPastLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'history' && pastInvoices === null && !pastLoading) {
      loadPastInvoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const selectedRows = useMemo(
    () => transactions.filter((t) => selectedIds.has(t.id)),
    [transactions, selectedIds],
  );
  const selectedTotals = useMemo(() => {
    let price = 0, tx = 0, line = 0;
    for (const r of selectedRows) {
      const applyTax = (r as Transaction & { apply_tax?: boolean }).apply_tax === false ? false : true;
      const s = splitLine(Number(r.amount) || 0, tax, applyTax);
      price += s.price; tx += s.tax; line += s.lineTotal;
    }
    return { price, tax: tx, total: line };
  }, [selectedRows, tax]);

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(transactions.map((t) => t.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  async function goToPreview() {
    setError(null);
    setPreviewLoading(true);
    try {
      const res = await api.customers.invoicePreview(customer.id, {
        transaction_ids: Array.from(selectedIds),
      });
      setPreviewHtml(res.html);
      setPreviewSubtotal(res.subtotal);
      setPreviewTax(res.tax_amount);
      setPreviewTotal(res.total);
      setPreviewNumber(res.invoice_number);
      setStage('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to build invoice preview');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmSend() {
    setError(null);
    setSending(true);
    try {
      await api.customers.sendInvoice(customer.id, {
        transaction_ids: Array.from(selectedIds),
      });
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  }

  async function openPastInvoice(id: number, number: string) {
    setError(null);
    try {
      const detail = await api.invoices.get(id);
      setViewInvoiceHtml({ number: number || detail.invoice_number, html: detail.html });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoice');
    }
  }

  const headerTitle = stage === 'preview' ? 'Preview invoice' : tab === 'history' ? 'Past invoices' : 'Send invoice';
  const headerSub =
    stage === 'preview'
      ? `Final review before sending to ${customer.email}`
      : tab === 'history'
      ? `Invoices you've already sent to ${customer.name}`
      : `Select transactions to include for ${customer.name}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{headerTitle}</h2>
              <p className="text-xs text-gray-500">{headerSub}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {stage === 'select' && (
          <div className="px-6 pt-3 border-b border-gray-100 flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => setTab('new')}
              className={`px-3 py-2 border-b-2 -mb-px ${
                tab === 'new'
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              New invoice
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`px-3 py-2 border-b-2 -mb-px flex items-center gap-1.5 ${
                tab === 'history'
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <History className="w-4 h-4" />
              Past invoices
              {pastInvoices && pastInvoices.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  {pastInvoices.length}
                </span>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {stage === 'select' && tab === 'new' && (
            <div className="p-6">
              {loading ? (
                <div className="text-gray-500 py-6">Loading transactions…</div>
              ) : transactions.length === 0 ? (
                <div className="text-gray-500 py-6">
                  This customer has no transactions yet. Add transactions first, then try again.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-gray-600">
                      {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} ·{' '}
                      {transactions.filter((t) => !t.paid_fully && !t.invoiced_at).length} not-yet-invoiced pre-selected
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button type="button" onClick={selectAll} className="text-blue-600 hover:underline">
                        Select all
                      </button>
                      <span className="text-gray-300">|</span>
                      <button type="button" onClick={selectNone} className="text-blue-600 hover:underline">
                        Select none
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-3 py-2 text-left w-10"> </th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-right">{showTax ? 'Price' : 'Amount'}</th>
                          {showTax && (
                            <>
                              <th className="px-3 py-2 text-right">{tax.tax_label} ({tax.tax_rate}%)</th>
                              <th className="px-3 py-2 text-right">Total</th>
                            </>
                          )}
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => {
                          const paid = !!t.paid_fully;
                          const invoiced = !!t.invoiced_at;
                          const selected = selectedIds.has(t.id);
                          const applyTax = (t as Transaction & { apply_tax?: boolean }).apply_tax === false ? false : true;
                          const line = splitLine(Number(t.amount) || 0, tax, applyTax);
                          return (
                            <tr
                              key={t.id}
                              className={`border-t border-gray-100 ${selected ? 'bg-blue-50/40' : ''}`}
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggle(t.id)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-3 py-2 text-gray-700">{toDateOnly(t.date)}</td>
                              <td className="px-3 py-2 text-gray-700">
                                {t.description || `Order #${t.id}`}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900">
                                {formatMoney(showTax ? line.price : Number(t.amount) || 0)}
                              </td>
                              {showTax && (
                                <>
                                  <td className="px-3 py-2 text-right text-gray-700">
                                    {applyTax ? (
                                      formatMoney(line.tax)
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500" title={`${tax.tax_label} not applied to this line`}>
                                        {tax.tax_label}-free
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium text-gray-900">{formatMoney(line.lineTotal)}</td>
                                </>
                              )}
                              <td className="px-3 py-2">
                                <div className="flex gap-1 flex-wrap">
                                  {paid && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs">
                                      Paid
                                    </span>
                                  )}
                                  {!paid && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs">
                                      Unpaid
                                    </span>
                                  )}
                                  {invoiced && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">
                                      Invoiced
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-gray-500 mt-3">
                    {showTax
                      ? `${tax.tax_label} ${tax.tax_rate}% is applied${tax.tax_inclusive ? ' (already included in stored amounts)' : ' on top of each price'}. Change in Business profile.`
                      : 'Tax is currently disabled in Business profile — amounts shown are as entered.'}
                  </p>
                </>
              )}
            </div>
          )}

          {stage === 'select' && tab === 'history' && (
            <div className="p-6">
              {pastLoading ? (
                <div className="text-gray-500 py-6">Loading past invoices…</div>
              ) : !pastInvoices || pastInvoices.length === 0 ? (
                <div className="text-gray-500 py-6">
                  No invoices have been sent to this customer yet. Use the <strong>New invoice</strong> tab to send one.
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Invoice</th>
                        <th className="px-3 py-2 text-left">Sent</th>
                        <th className="px-3 py-2 text-left">Sent to</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right">Lines</th>
                        <th className="px-3 py-2 w-20"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastInvoices.map((inv) => (
                        <tr key={inv.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-gray-900">{inv.invoice_number}</td>
                          <td className="px-3 py-2 text-gray-700">{formatDateTime(inv.sent_at)}</td>
                          <td className="px-3 py-2 text-gray-700">{inv.sent_to || '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{formatMoney(Number(inv.total))}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{inv.tx_count ?? 0}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => openPastInvoice(inv.id, inv.invoice_number)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {stage === 'preview' && (
            <div className="p-6">
              <div className="text-sm text-gray-600 mb-3">
                Invoice <strong>{previewNumber}</strong> will be emailed to <strong>{customer.email}</strong>.
              </div>
              <iframe
                title="Invoice preview"
                srcDoc={previewHtml}
                className="w-full h-[60vh] border border-gray-200 rounded-lg bg-white"
              />
            </div>
          )}
        </div>

        {/* Footer (hidden on history tab when not previewing) */}
        {!(stage === 'select' && tab === 'history') && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-700">
              {stage === 'select' ? (
                <>
                  Selected: <strong>{selectedIds.size}</strong>
                  {showTax ? (
                    <>
                      {' '}· Subtotal: <strong>{formatMoney(selectedTotals.price)}</strong>
                      {' '}· {tax.tax_label}: <strong>{formatMoney(selectedTotals.tax)}</strong>
                      {' '}· Total: <strong>{formatMoney(selectedTotals.total)}</strong>
                    </>
                  ) : (
                    <>
                      {' '}· Total: <strong>{formatMoney(selectedTotals.total)}</strong>
                    </>
                  )}
                </>
              ) : (
                <>
                  Subtotal: <strong>{formatMoney(previewSubtotal)}</strong>
                  {previewTax > 0 && (
                    <>
                      {' '}· Tax: <strong>{formatMoney(previewTax)}</strong>
                    </>
                  )}
                  {' '}· Total: <strong>{formatMoney(previewTotal)}</strong>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {stage === 'select' ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={goToPreview}
                    disabled={previewLoading || selectedIds.size === 0}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4" />
                    {previewLoading ? 'Preparing preview…' : 'Preview invoice'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStage('select')}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to edit
                  </button>
                  <button
                    type="button"
                    onClick={confirmSend}
                    disabled={sending}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending…' : `Send invoice (${formatMoney(previewTotal)})`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Past invoice viewer (nested modal) */}
        {viewInvoiceHtml && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <h3 className="text-base font-semibold text-gray-900">Invoice {viewInvoiceHtml.number}</h3>
                </div>
                <button
                  onClick={() => setViewInvoiceHtml(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <iframe
                  title={`Invoice ${viewInvoiceHtml.number}`}
                  srcDoc={viewInvoiceHtml.html}
                  className="w-full h-[65vh] border border-gray-200 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
