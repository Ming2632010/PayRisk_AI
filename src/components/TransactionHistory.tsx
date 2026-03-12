// src/components/TransactionHistory.tsx
import { useState, useEffect } from 'react';
import { Plus, Calendar, DollarSign, Check, X, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Transaction } from '../lib/database.types';
import { formatCurrency, formatDate } from '../utils/scoring';
import { addToPendingQueue } from '../lib/offline';

interface TransactionHistoryProps {
  customerId: number;
  customerName: string;
  userId: string;
  isOffline?: boolean;
  onClose?: () => void;
  onTransactionsChange?: () => void;
  onPendingCountChange?: () => void;
}

const defaultFormData = {
  date: new Date().toISOString().split('T')[0],
  description: '',
  finish_date: '',
  amount: '',
  due_date: '',
  paid_fully: false,
  paid_at: '',
  status: 'completed' as 'pending' | 'completed' | 'failed',
};

/** Normalize API date (e.g. "2025-03-05T00:00:00.000Z" or "2025-03-05") to YYYY-MM-DD for input type="date" */
function toDateOnly(value: string | null | undefined): string {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

export function TransactionHistory({
  customerId,
  customerName,
  userId,
  isOffline = false,
  onClose,
  onTransactionsChange,
  onPendingCountChange,
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  useEffect(() => {
    loadTransactions();
  }, [customerId]);

  async function loadTransactions() {
    try {
      const data = await api.transactions.list(customerId);
      setTransactions((data || []) as Transaction[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  function notifyChange() {
    loadTransactions();
    onTransactionsChange?.();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const paidFully = formData.paid_fully;
    const paidAt = paidFully ? (formData.paid_at || formData.date) : null;
    const payload = {
      date: formData.date,
      amount: parseFloat(formData.amount),
      description: formData.description || null,
      finish_date: formData.finish_date || null,
      due_date: formData.due_date || null,
      paid_fully: paidFully,
      paid_at: paidAt,
      status: formData.status,
    };
    if (isOffline) {
      if (editingTx) {
        addToPendingQueue({ type: 'update_transaction', id: editingTx.id, customerId, payload });
      } else {
        addToPendingQueue({ type: 'create_transaction', customerId, payload });
      }
      onPendingCountChange?.();
      setFormData(defaultFormData);
      setShowForm(false);
      setEditingTx(null);
      alert('Saved locally. Changes will sync when you\'re back online.');
      return;
    }
    try {
      if (editingTx) {
        await api.transactions.update(editingTx.id, payload);
        setEditingTx(null);
      } else {
        await api.transactions.create({
          customer_id: customerId,
          ...payload,
        });
      }
      setFormData(defaultFormData);
      setShowForm(false);
      notifyChange();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction');
    }
  }

  function startEdit(tx: Transaction) {
    const t = tx as Transaction & { finish_date?: string | null; due_date?: string | null; paid_fully?: boolean; paid_at?: string | null };
    setEditingTx(tx);
    setFormData({
      date: toDateOnly(tx.date),
      description: tx.description || '',
      finish_date: toDateOnly(t.finish_date),
      amount: String(tx.amount),
      due_date: toDateOnly(t.due_date),
      paid_fully: t.paid_fully ?? false,
      paid_at: toDateOnly(t.paid_at),
      status: tx.status,
    });
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingTx(null);
    setFormData(defaultFormData);
    setShowForm(false);
  }

  async function handleTogglePaid(tx: Transaction) {
    const next = !(tx as Transaction & { paid_fully?: boolean }).paid_fully;
    if (isOffline) {
      addToPendingQueue({
        type: 'update_transaction',
        id: tx.id,
        customerId,
        payload: { paid_fully: next, paid_at: next ? new Date().toISOString().split('T')[0] : null },
      });
      onPendingCountChange?.();
      alert('Saved locally. Will sync when back online.');
      return;
    }
    try {
      await api.transactions.update(tx.id, {
        paid_fully: next,
        paid_at: next ? new Date().toISOString().split('T')[0] : null,
      });
      notifyChange();
    } catch (error) {
      console.error('Error updating paid status:', error);
      alert('Failed to update');
    }
  }

  async function handleDelete(tx: Transaction) {
    if (!confirm('Delete this transaction?')) return;
    if (isOffline) {
      addToPendingQueue({ type: 'delete_transaction', id: tx.id, customerId });
      onPendingCountChange?.();
      setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
      alert('Removed locally. Will sync when back online.');
      return;
    }
    try {
      await api.transactions.delete(tx.id);
      notifyChange();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete');
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading transactions...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      {isOffline && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You're offline. New or edited transactions will sync when you're back online.
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Transaction History — {customerName}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setEditingTx(null); setFormData(defaultFormData); setShowForm(!showForm); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-800 mb-3">{editingTx ? 'Edit Transaction' : 'Add Transaction'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <input type="text" value={customerName} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="0.00"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Items / Tasks</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g. Website redesign, 5x Widget A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Finish date</label>
              <input
                type="date"
                value={formData.finish_date}
                onChange={(e) => setFormData({ ...formData, finish_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' | 'completed' | 'failed' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.paid_fully}
                  onChange={(e) => setFormData({ ...formData, paid_fully: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Paid fully</span>
              </label>
            </div>
            {formData.paid_fully && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid date</label>
                <input
                  type="date"
                  value={formData.paid_at}
                  onChange={(e) => setFormData({ ...formData, paid_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={cancelEdit} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              {editingTx ? 'Update' : 'Add Transaction'}
            </button>
          </div>
        </form>
      )}

      {transactions.length === 0 ? (
        <p className="text-center text-gray-500 py-4">No transactions yet</p>
      ) : (
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items / Tasks</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Finish date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => {
                const t = tx as Transaction & { finish_date?: string | null; due_date?: string | null; paid_fully?: boolean; paid_at?: string | null; customer_name?: string };
                const paid = t.paid_fully ?? false;
                return (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">{formatDate(tx.date)}</td>
                    <td className="px-3 py-2 text-gray-700">{t.customer_name ?? customerName}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[12rem] truncate" title={tx.description || ''}>{tx.description || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{t.finish_date ? formatDate(t.finish_date) : '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{formatCurrency(tx.amount)}</td>
                    <td className="px-3 py-2 text-gray-600">{t.due_date ? formatDate(t.due_date) : '—'}</td>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={paid}
                          onChange={() => handleTogglePaid(tx)}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded"
                        />
                        {paid && <Check className="w-4 h-4 text-green-600" />}
                      </label>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{t.paid_at ? formatDate(t.paid_at) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(tx.status)}`}>{tx.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => startEdit(tx)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button type="button" onClick={() => handleDelete(tx)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
