import { useEffect, useState, type FormEvent } from 'react';
import {
  Plus,
  Mail,
  Trash2,
  Edit,
  Calendar,
  FileText,
  Upload,
  MessageSquare,
  Receipt,
  Search,
} from 'lucide-react';
import { api } from '../lib/api';
import type { CustomerNew } from '../lib/database.types';
import { TagSelector } from './TagSelector';
import { TransactionHistory } from './TransactionHistory';
import { CustomerNotes } from './CustomerNotes';
import { DataImportExport } from './DataImportExport';
import SendInvoiceModal from './SendInvoiceModal';
import {
  calculateRiskScore,
  calculateRepurchaseScore,
  getRiskLabel,
  getRepurchaseLabel,
  formatCurrency,
  formatDate,
} from '../utils/scoring';
import {
  getCachedCustomers,
  setCachedCustomers,
  getPendingQueue,
  addToPendingQueue,
  processQueue,
  isLikelyNetworkError,
  type ProcessQueueApi,
} from '../lib/offline';

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  amount_owed: string;
  due_date: string;
  total_orders: string;
  average_order_value: string;
  last_purchase_date: string;
  is_high_risk_industry: boolean;
  tags: string[];
}

interface CustomerManagementProps {
  userId: string | null;
  onDueTodayRefresh?: () => void;
}

export function CustomerManagement({ userId, onDueTodayRefresh }: CustomerManagementProps) {
  const [customers, setCustomers] = useState<CustomerNew[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sendingAction, setSendingAction] = useState<
    'reminder' | 'offer' | 'sms' | 'invoice' | null
  >(null);
  const [invoiceModalCustomer, setInvoiceModalCustomer] = useState<CustomerNew | null>(null);

  function normalizeNullableText(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  function normalizeNullableTextArray(values: string[]): string[] | null {
    const cleaned = values.map((v) => v.trim()).filter(Boolean);
    return cleaned.length ? cleaned : null;
  }

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    street_address: '',
    city: '',
    state_province: '',
    postal_code: '',
    country: '',
    amount_owed: '',
    due_date: '',
    total_orders: '',
    average_order_value: '',
    last_purchase_date: '',
    is_high_risk_industry: false,
    tags: [],
  });
  const [editingCustomer, setEditingCustomer] = useState<CustomerNew | null>(null);
  const [selectedCustomerForTransactions, setSelectedCustomerForTransactions] =
    useState<CustomerNew | null>(null);
  const [selectedCustomerForNotes, setSelectedCustomerForNotes] = useState<CustomerNew | null>(
    null
  );
  const [showImportExport, setShowImportExport] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [searchQuery, setSearchQuery] = useState('');
  const SORT_STORAGE_KEY = 'payrisk_customers_sort';
  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window === 'undefined') return 'name_asc';
    return window.localStorage.getItem(SORT_STORAGE_KEY) || 'name_asc';
  });
  const handleSortChange = (value: string) => {
    setSortBy(value);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, value);
    } catch (_) {}
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const name = (c.name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const company = (c.company || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    return name.includes(q) || email.includes(q) || company.includes(q) || phone.includes(q);
  });

  const sortedAndFilteredCustomers = (() => {
    const list = [...filteredCustomers];
    const amount = (c: CustomerNew) => Number(c.amount_owed) ?? 0;
    const due = (c: CustomerNew) => (c.due_date ? new Date(c.due_date).getTime() : 0);
    const risk = (c: CustomerNew) => calculateRiskScore(c);
    const repurchase = (c: CustomerNew) => calculateRepurchaseScore(c);
    const name = (c: CustomerNew) => (c.name || '').toLowerCase();
    switch (sortBy) {
      case 'name_desc':
        return list.sort((a, b) => name(b).localeCompare(name(a)));
      case 'amount_asc':
        return list.sort((a, b) => amount(a) - amount(b));
      case 'amount_desc':
        return list.sort((a, b) => amount(b) - amount(a));
      case 'due_asc':
        return list.sort((a, b) => {
          const da = due(a);
          const db = due(b);
          if (da === 0 && db === 0) return name(a).localeCompare(name(b));
          if (da === 0) return 1;
          if (db === 0) return -1;
          return da - db;
        });
      case 'due_desc':
        return list.sort((a, b) => {
          const da = due(a);
          const db = due(b);
          if (da === 0 && db === 0) return name(a).localeCompare(name(b));
          if (da === 0) return 1;
          if (db === 0) return -1;
          return db - da;
        });
      case 'risk_asc':
        return list.sort((a, b) => risk(a) - risk(b));
      case 'risk_desc':
        return list.sort((a, b) => risk(b) - risk(a));
      case 'repurchase_asc':
        return list.sort((a, b) => repurchase(a) - repurchase(b));
      case 'repurchase_desc':
        return list.sort((a, b) => repurchase(b) - repurchase(a));
      default:
        return list.sort((a, b) => name(a).localeCompare(name(b)));
    }
  })();

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => {
      setOnline(false);
      setIsOffline(true);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!online) return;
    const queue = getPendingQueue();
    if (queue.length === 0) return;
    setIsSyncing(true);
    processQueue(api as unknown as ProcessQueueApi)
      .then(({ processed }) => {
        if (processed > 0) {
          loadCustomers();
          onDueTodayRefresh?.();
        }
        setPendingCount(getPendingQueue().length);
      })
      .finally(() => setIsSyncing(false));
  }, [online]);

  const refreshPendingCount = () => setPendingCount(getPendingQueue().length);

  async function loadCustomers() {
    try {
      const data = await api.customers.list();
      const list = (data || []) as CustomerNew[];
      setCustomers(list);
      setCachedCustomers(list);
      setIsOffline(false);
      setPendingCount(getPendingQueue().length);
    } catch (error) {
      console.error('Error loading customers:', error);
      if (isLikelyNetworkError(error)) {
        const cached = getCachedCustomers();
        if (cached?.length) {
          setCustomers(cached as CustomerNew[]);
          setIsOffline(true);
          setPendingCount(getPendingQueue().length);
        }
      } else {
        alert(error instanceof Error ? error.message : 'Failed to load customers');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!userId) {
      alert('Please sign in to add customers');
      return;
    }

    const customerDataForDb: Record<string, unknown> = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: normalizeNullableText(formData.phone),
      company: normalizeNullableText(formData.company),
      street_address: normalizeNullableText(formData.street_address),
      city: normalizeNullableText(formData.city),
      state_province: normalizeNullableText(formData.state_province),
      postal_code: normalizeNullableText(formData.postal_code),
      country: normalizeNullableText(formData.country),
      is_high_risk_industry: formData.is_high_risk_industry,
      tags: normalizeNullableTextArray(formData.tags),
    };
    if (editingCustomer) {
      customerDataForDb.amount_owed = editingCustomer.amount_owed ?? 0;
      customerDataForDb.due_date = editingCustomer.due_date ?? null;
      customerDataForDb.total_orders = editingCustomer.total_orders ?? 0;
      customerDataForDb.average_order_value = editingCustomer.average_order_value ?? 0;
      customerDataForDb.last_purchase_date = editingCustomer.last_purchase_date ?? null;
    } else {
      customerDataForDb.amount_owed = 0;
      customerDataForDb.due_date = null;
      customerDataForDb.total_orders = 0;
      customerDataForDb.average_order_value = 0;
      customerDataForDb.last_purchase_date = null;
    }

    if (isOffline) {
      if (editingCustomer) {
        addToPendingQueue({
          type: 'update_customer',
          id: editingCustomer.id,
          payload: customerDataForDb,
        });
      } else {
        addToPendingQueue({ type: 'create_customer', payload: customerDataForDb });
      }
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        street_address: '',
        city: '',
        state_province: '',
        postal_code: '',
        country: '',
        amount_owed: '',
        due_date: '',
        total_orders: '',
        average_order_value: '',
        last_purchase_date: '',
        is_high_risk_industry: false,
        tags: [],
      });
      setEditingCustomer(null);
      setShowForm(false);
      setPendingCount(getPendingQueue().length);
      alert("Saved locally. Changes will sync when you're back online.");
      return;
    }

    try {
      if (editingCustomer) {
        await api.customers.update(editingCustomer.id, customerDataForDb);
      } else {
        await api.customers.create(customerDataForDb);
      }

      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        street_address: '',
        city: '',
        state_province: '',
        postal_code: '',
        country: '',
        amount_owed: '',
        due_date: '',
        total_orders: '',
        average_order_value: '',
        last_purchase_date: '',
        is_high_risk_industry: false,
        tags: [],
      });
      setEditingCustomer(null);
      setShowForm(false);
      loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      if (isLikelyNetworkError(error)) {
        addToPendingQueue(
          editingCustomer
            ? { type: 'update_customer', id: editingCustomer.id, payload: customerDataForDb }
            : { type: 'create_customer', payload: customerDataForDb }
        );
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          street_address: '',
          city: '',
          state_province: '',
          postal_code: '',
          country: '',
          amount_owed: '',
          due_date: '',
          total_orders: '',
          average_order_value: '',
          last_purchase_date: '',
          is_high_risk_industry: false,
          tags: [],
        });
        setEditingCustomer(null);
        setShowForm(false);
        setPendingCount(getPendingQueue().length);
        setIsOffline(true);
        alert("No connection. Saved locally. Changes will sync when you're back online.");
      } else {
        alert(error instanceof Error ? error.message : 'Failed to save customer');
      }
    }
  }

  async function handleSendReminder(customer: CustomerNew) {
    setSendingAction('reminder');
    try {
      await api.customers.sendReminder(customer.id);
      alert(`Payment reminder sent by email to ${customer.name}.`);
      onDueTodayRefresh?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send reminder');
    } finally {
      setSendingAction(null);
    }
  }

  async function handleSendOffer(customer: CustomerNew) {
    setSendingAction('offer');
    try {
      await api.customers.sendOffer(customer.id);
      alert(`Special offer sent by email to ${customer.name}.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send offer');
    } finally {
      setSendingAction(null);
    }
  }

  async function handleSendSms(customer: CustomerNew) {
    if (!customer.phone?.trim()) {
      alert('This customer has no phone number. Add one in Edit Customer.');
      return;
    }
    setSendingAction('sms');
    try {
      await api.customers.sendSms(customer.id);
      alert(`SMS sent to ${customer.name}.`);
      onDueTodayRefresh?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send SMS');
    } finally {
      setSendingAction(null);
    }
  }

  function handleSendInvoice(customer: CustomerNew) {
    setInvoiceModalCustomer(customer);
  }

  function handleInvoiceSent() {
    const name = invoiceModalCustomer?.name;
    setInvoiceModalCustomer(null);
    if (name) alert(`Invoice sent by email to ${name}.`);
    loadCustomers();
    onDueTodayRefresh?.();
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    if (isOffline) {
      addToPendingQueue({ type: 'delete_customer', id });
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      setPendingCount(getPendingQueue().length);
      alert("Removed locally. Deletion will sync when you're back online.");
      return;
    }

    try {
      await api.customers.delete(id);
      loadCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      if (isLikelyNetworkError(error)) {
        addToPendingQueue({ type: 'delete_customer', id });
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        setPendingCount(getPendingQueue().length);
        setIsOffline(true);
        alert("No connection. Removed locally. Deletion will sync when you're back online.");
      } else {
        alert('Failed to delete customer');
      }
    }
  }

  const handleEdit = (customer: CustomerNew) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || '',
      company: customer.company || '',
      street_address: customer.street_address || '',
      city: customer.city || '',
      state_province: customer.state_province || '',
      postal_code: customer.postal_code || '',
      country: customer.country || '',
      amount_owed: customer.amount_owed.toString(),
      due_date: customer.due_date || '',
      total_orders: customer.total_orders.toString(),
      average_order_value: customer.average_order_value.toString(),
      last_purchase_date: customer.last_purchase_date || '',
      is_high_risk_industry: customer.is_high_risk_industry,
      tags: customer.tags || [],
    });
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(isOffline || isSyncing || pendingCount > 0) && (
        <div
          className={`rounded-lg border p-3 text-sm ${isSyncing ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}
        >
          {isSyncing
            ? 'Syncing your changes with the server…'
            : isOffline
              ? "You're offline. Showing last saved data. Changes will sync when you're back online."
              : `${pendingCount} change(s) will sync when you\'re back online.`}
        </div>
      )}

      {/* 标题和按钮区域 - 只有一个 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportExport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import/Export
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
          </h3>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {/* 表单字段保持不变 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1 555-123-4567"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3 mt-2">
              <h3 className="text-md font-medium text-gray-700 border-b pb-1">
                Address Information
              </h3>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address <span className="text-gray-400 text-xs">(incl. unit/suite)</span>
              </label>
              <input
                type="text"
                value={formData.street_address}
                onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="123 Main St, Unit 4"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City / Town</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Sydney / London / New York"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State / Province / County
              </label>
              <input
                type="text"
                value={formData.state_province}
                onChange={(e) => setFormData({ ...formData, state_province: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="NSW / CA / London"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="2000 / SW1A 2AA / 90210"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Australia / UK / USA / Canada"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <TagSelector
                selectedTags={formData.tags}
                onChange={(tags) => setFormData({ ...formData, tags })}
              />
            </div>

            {editingCustomer ? (
              <div className="md:col-span-2 lg:col-span-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Calculated from transactions (read-only)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Amount Owed</span>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(editingCustomer.amount_owed ?? 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Due Date</span>
                    <p className="font-medium text-gray-900">
                      {editingCustomer.due_date ? formatDate(editingCustomer.due_date) : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Orders</span>
                    <p className="font-medium text-gray-900">{editingCustomer.total_orders ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Order Value</span>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(editingCustomer.average_order_value ?? 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Purchase</span>
                    <p className="font-medium text-gray-900">
                      {editingCustomer.last_purchase_date
                        ? formatDate(editingCustomer.last_purchase_date)
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="md:col-span-2 lg:col-span-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-gray-700">
                Amount owed, due date, total orders, average order value and last purchase date are
                calculated automatically from each customer&apos;s transaction history.
              </div>
            )}

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_high_risk_industry}
                  onChange={(e) =>
                    setFormData({ ...formData, is_high_risk_industry: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">High-Risk Industry</span>
              </label>
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingCustomer ? 'Update Customer' : 'Add Customer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, or company…"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor="sort-customers"
              className="text-sm font-medium text-gray-700 whitespace-nowrap"
            >
              Sort by
            </label>
            <select
              id="sort-customers"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[180px]"
            >
              <option value="name_asc">Name (A–Z)</option>
              <option value="name_desc">Name (Z–A)</option>
              <option value="amount_desc">Amount due (high–low)</option>
              <option value="amount_asc">Amount due (low–high)</option>
              <option value="due_asc">Due date (soonest)</option>
              <option value="due_desc">Due date (latest)</option>
              <option value="risk_desc">Risk (high–low)</option>
              <option value="risk_asc">Risk (low–high)</option>
              <option value="repurchase_desc">Repurchase (high–low)</option>
              <option value="repurchase_asc">Repurchase (low–high)</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount / Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Repurchase Intent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedAndFilteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery.trim()
                      ? 'No customers match your search. Try a different term or clear the search.'
                      : 'No customers yet. Add your first customer to get started!'}
                  </td>
                </tr>
              ) : (
                sortedAndFilteredCustomers.map((customer) => {
                  const riskScore = calculateRiskScore(customer);
                  const repurchaseScore = calculateRepurchaseScore(customer);
                  const riskLabel = getRiskLabel(riskScore);
                  const repurchaseLabel = getRepurchaseLabel(repurchaseScore);
                  const notesCount = Array.isArray((customer as { notes?: unknown[] }).notes)
                    ? (customer as { notes?: unknown[] }).notes!.length
                    : 0;

                  return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{customer.name}</span>
                            {notesCount > 0 && (
                              <span
                                className="inline-flex items-center text-amber-600"
                                title={`${notesCount} note${notesCount !== 1 ? 's' : ''}`}
                              >
                                <FileText className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                          {customer.company && (
                            <div className="text-sm text-gray-500">{customer.company}</div>
                          )}
                          <div className="text-sm text-gray-500">{customer.email}</div>

                          {customer.phone && (
                            <div className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {customer.phone}
                            </div>
                          )}

                          {(customer.street_address ||
                            customer.city ||
                            customer.state_province) && (
                            <div className="text-xs text-gray-400 mt-1">
                              {[
                                customer.street_address,
                                customer.city,
                                customer.state_province,
                                customer.postal_code,
                                customer.country,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          )}

                          {customer.tags && customer.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {customer.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {formatCurrency(customer.amount_owed)}
                          </div>
                          {customer.due_date && (
                            <div className="text-sm text-gray-500">
                              Due: {formatDate(customer.due_date)}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{riskLabel.emoji}</span>
                          <div>
                            <div className={`font-medium ${riskLabel.color}`}>{riskLabel.text}</div>
                            <div className="text-sm text-gray-500">Score: {riskScore}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{repurchaseLabel.emoji}</span>
                          <div>
                            <div className={`font-medium ${repurchaseLabel.color}`}>
                              {repurchaseLabel.text}
                            </div>
                            <div className="text-sm text-gray-500">Score: {repurchaseScore}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="relative group">
                            <button
                              onClick={() => handleSendInvoice(customer)}
                              disabled={sendingAction !== null}
                              className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                                (customer as { last_invoice_sent_at?: string | null })
                                  .last_invoice_sent_at
                                  ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none whitespace-nowrap z-20">
                              {(customer as { last_invoice_sent_at?: string | null })
                                .last_invoice_sent_at
                                ? `Invoice sent ${formatDate((customer as { last_invoice_sent_at?: string }).last_invoice_sent_at!.slice(0, 10))}`
                                : 'Send invoice'}
                            </span>
                          </div>

                          <div className="relative group">
                            <button
                              onClick={() => handleSendReminder(customer)}
                              disabled={sendingAction !== null}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none whitespace-nowrap z-20">
                              Send Reminder (email)
                            </span>
                          </div>

                          <div className="relative group">
                            <button
                              onClick={() => handleEdit(customer)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none whitespace-nowrap z-20">
                              Edit Customer
                            </span>
                          </div>

                          <div className="relative group">
                            <button
                              onClick={() => setSelectedCustomerForTransactions(customer)}
                              className="relative p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            >
                              <Calendar className="w-4 h-4" />
                              {(customer.total_orders ?? 0) > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center text-[10px] font-semibold text-purple-700 bg-purple-200 rounded-full">
                                  {customer.total_orders}
                                </span>
                              )}
                            </button>
                            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none whitespace-nowrap z-20">
                              View Transactions
                            </span>
                          </div>

                          <div className="relative group">
                            <button
                              onClick={() => setSelectedCustomerForNotes(customer)}
                              className="relative p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                              {notesCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center text-[10px] font-semibold text-amber-700 bg-amber-200 rounded-full">
                                  {notesCount}
                                </span>
                              )}
                            </button>
                            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none whitespace-nowrap z-20">
                              Customer Notes
                            </span>
                          </div>

                          <div className="relative group">
                            <button
                              onClick={() => handleSendOffer(customer)}
                              disabled={sendingAction !== null}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none whitespace-nowrap z-20">
                              Send Offer (email)
                            </span>
                          </div>

                          <div className="relative group">
                            <button
                              onClick={() => handleSendSms(customer)}
                              disabled={sendingAction !== null}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none whitespace-nowrap z-20">
                              Send SMS
                            </span>
                          </div>

                          <div className="relative group">
                            <button
                              onClick={() => handleDelete(customer.id)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none whitespace-nowrap z-20">
                              Delete
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History Modal */}
      {selectedCustomerForTransactions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="max-w-6xl w-full max-h-[90vh] overflow-auto">
            <TransactionHistory
              customerId={selectedCustomerForTransactions.id}
              customerName={selectedCustomerForTransactions.name}
              userId={userId!}
              isOffline={isOffline}
              onClose={() => setSelectedCustomerForTransactions(null)}
              onTransactionsChange={loadCustomers}
              onPendingCountChange={refreshPendingCount}
            />
          </div>
        </div>
      )}

      {/* Customer Notes Modal */}
      {selectedCustomerForNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="max-w-2xl w-full mx-4">
            <CustomerNotes
              customerId={selectedCustomerForNotes.id}
              userId={userId!}
              onClose={() => {
                setSelectedCustomerForNotes(null);
                loadCustomers();
              }}
            />
          </div>
        </div>
      )}

      {/* Data Import/Export Modal */}
      {showImportExport && (
        <DataImportExport
          customers={customers}
          onImportSuccess={loadCustomers}
          onClose={() => setShowImportExport(false)}
        />
      )}

      {invoiceModalCustomer && (
        <SendInvoiceModal
          customer={{
            id: invoiceModalCustomer.id,
            name: invoiceModalCustomer.name,
            email: invoiceModalCustomer.email,
          }}
          onClose={() => setInvoiceModalCustomer(null)}
          onSent={handleInvoiceSent}
        />
      )}
    </div>
  );
}
