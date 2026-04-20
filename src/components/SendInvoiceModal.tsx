import { useEffect, useMemo, useState } from 'react';
import { X, Eye, Send, ArrowLeft, Receipt } from 'lucide-react';
import { api } from '../lib/api';
import type { Transaction } from '../lib/database.types';

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

function toDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  const s = String(value).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function formatMoney(n: number) {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

export default function SendInvoiceModal({ customer, onClose, onSent }: SendInvoiceModalProps) {
  const [stage, setStage] = useState<Stage>('select');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewTotal, setPreviewTotal] = useState<number>(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);

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
        const defaults = new Set<number>(rows.filter((t) => !t.paid_fully).map((t) => t.id));
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

  const selectedRows = useMemo(
    () => transactions.filter((t) => selectedIds.has(t.id)),
    [transactions, selectedIds]
  );
  const selectedTotal = useMemo(
    () => selectedRows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [selectedRows]
  );

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
      setPreviewTotal(res.total);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {stage === 'select' ? 'Send invoice' : 'Preview invoice'}
              </h2>
              <p className="text-xs text-gray-500">
                {stage === 'select'
                  ? `Select transactions to include for ${customer.name}`
                  : `Final review before sending to ${customer.email}`}
              </p>
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

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {stage === 'select' && (
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
                      {transactions.filter((t) => !t.paid_fully).length} unpaid pre-selected
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-blue-600 hover:underline"
                      >
                        Select all
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={selectNone}
                        className="text-blue-600 hover:underline"
                      >
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
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => {
                          const paid = !!t.paid_fully;
                          const selected = selectedIds.has(t.id);
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
                                {formatMoney(Number(t.amount) || 0)}
                              </td>
                              <td className="px-3 py-2">
                                {paid ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs">
                                    Paid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs">
                                    Unpaid
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {stage === 'preview' && (
            <div className="p-6">
              <div className="text-sm text-gray-600 mb-3">
                This is exactly what will be emailed to <strong>{customer.email}</strong>.
              </div>
              <iframe
                title="Invoice preview"
                srcDoc={previewHtml}
                className="w-full h-[60vh] border border-gray-200 rounded-lg bg-white"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-gray-700">
            {stage === 'select' ? (
              <>
                Selected: <strong>{selectedIds.size}</strong> ·{' '}
                Invoice total: <strong>{formatMoney(selectedTotal)}</strong>
              </>
            ) : (
              <>
                Invoice total: <strong>{formatMoney(previewTotal)}</strong>
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
      </div>
    </div>
  );
}
