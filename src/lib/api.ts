import { getToken } from './auth';
import type { AuthUser } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type JsonRequestInit = Omit<RequestInit, 'body'> & { body?: unknown };

function getAuthToken(): string | null {
  return getToken();
}

async function request<T>(path: string, options: JsonRequestInit = {}): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const { body, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...(rest as RequestInit),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data as T;
}

export type Subscription = {
  plan: 'starter' | 'basic' | 'professional' | 'business';
  period_start: string | null;
  emails_sent: number;
  sms_sent: number;
  emails_limit: number;
  sms_limit: number;
};

export type DueTodayResponse = {
  count: number;
  customers: Array<{
    id: number;
    name: string;
    email: string;
    amount_owed: number;
    due_date: string | null;
  }>;
};

export type InvoiceTemplate = {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  tax_id: string;
  footer_notes: string;
  tax_enabled: boolean;
  tax_label: string;
  tax_rate: number;
  tax_inclusive: boolean;
  sms_country_code: string;
};

export type EmailTemplates = {
  reminder: { subject: string; body: string };
  offer: { subject: string; body: string };
};

export type InvoiceEmailTemplate = { subject: string; body: string };

export type SmsTemplate = { body: string };

export type InvoiceSummary = {
  id: number;
  invoice_number: string;
  subject: string;
  subtotal: number;
  tax_amount: number;
  tax_label: string | null;
  tax_rate: number | null;
  tax_inclusive: boolean | null;
  total: number;
  sent_to: string;
  sent_at: string;
  tx_count: number | null;
};

export type InvoiceDetail = InvoiceSummary & {
  customer_id: number;
  transaction_ids: number[];
  html: string;
};

export type InvoicePreview = {
  html: string;
  subject: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  count: number;
  invoice_number: string;
};

export type InvoiceSendResult = {
  sent: boolean;
  channel: string;
  invoice_id: number | null;
  invoice_number: string;
  total: number;
};

export const api = {
  auth: {
    me: () => request<AuthUser>('/auth/me'),
  },
  subscription: {
    get: () => request<Subscription>('/api/subscription'),
    update: (plan: string) =>
      request<Subscription>('/api/subscription', { method: 'PATCH', body: { plan } }),
    createCheckoutSession: (plan: string) =>
      request<{ url: string }>('/api/subscription/checkout-session', {
        method: 'POST',
        body: { plan },
      }),
    /** Call after returning from Stripe with ?page=plan&success=1&session_id=… */
    confirmCheckout: (sessionId: string) =>
      request<Subscription>('/api/subscription/confirm-checkout', {
        method: 'POST',
        body: { sessionId },
      }),
  },
  invoiceTemplate: {
    get: () => request<InvoiceTemplate>('/api/invoice-template'),
    save: (body: Partial<InvoiceTemplate>) =>
      request<InvoiceTemplate>('/api/invoice-template', { method: 'PUT', body }),
  },
  emailTemplates: {
    get: () => request<EmailTemplates>('/api/email-templates'),
    save: (body: Partial<EmailTemplates>) =>
      request<EmailTemplates>('/api/email-templates', { method: 'PUT', body }),
  },
  invoiceEmailTemplate: {
    get: () => request<InvoiceEmailTemplate>('/api/invoice-email-template'),
    save: (body: Partial<InvoiceEmailTemplate>) =>
      request<InvoiceEmailTemplate>('/api/invoice-email-template', { method: 'PUT', body }),
  },
  smsTemplate: {
    get: () => request<SmsTemplate>('/api/sms-template'),
    save: (body: Partial<SmsTemplate>) =>
      request<SmsTemplate>('/api/sms-template', { method: 'PUT', body }),
  },
  invoices: {
    get: (id: number) => request<InvoiceDetail>(`/api/invoices/${id}`),
  },
  customers: {
    list: () => request<unknown[]>('/api/customers'),
    create: (body: Record<string, unknown>) =>
      request<unknown>('/api/customers', { method: 'POST', body }),
    update: (id: number, body: Record<string, unknown>) =>
      request<unknown>(`/api/customers/${id}`, { method: 'PUT', body }),
    delete: (id: number) => request<void>(`/api/customers/${id}`, { method: 'DELETE' }),
    import: (rows: Record<string, unknown>[]) =>
      request<{ imported: number }>('/api/customers/import', { method: 'POST', body: rows }),
    dueToday: () => request<DueTodayResponse>('/api/customers/due-today'),
    sendReminder: (id: number) =>
      request<{ sent: boolean; channel: string }>(`/api/customers/${id}/send-reminder`, {
        method: 'POST',
      }),
    sendOffer: (id: number) =>
      request<{ sent: boolean; channel: string }>(`/api/customers/${id}/send-offer`, {
        method: 'POST',
      }),
    sendSms: (id: number, body?: { message?: string; phone?: string }) =>
      request<{ sent: boolean; channel: string; to?: string; preview?: string }>(`/api/customers/${id}/send-sms`, {
        method: 'POST',
        body: body || {},
      }),
    sendInvoice: (id: number, body?: { transaction_ids?: number[] }) =>
      request<InvoiceSendResult>(`/api/customers/${id}/send-invoice`, {
        method: 'POST',
        body: body || {},
      }),
    invoicePreview: (id: number, body?: { transaction_ids?: number[] }) =>
      request<InvoicePreview>(`/api/customers/${id}/invoice-preview`, {
        method: 'POST',
        body: body || {},
      }),
    listInvoices: (id: number) => request<InvoiceSummary[]>(`/api/customers/${id}/invoices`),
  },
  notes: {
    list: (customerId: number) => request<unknown[]>(`/api/customers/${customerId}/notes`),
    save: (customerId: number, notes: unknown[]) =>
      request<{ notes: unknown[] }>(`/api/customers/${customerId}/notes`, {
        method: 'PUT',
        body: notes,
      }),
  },
  transactions: {
    list: (customerId: number) => request<unknown[]>(`/api/transactions?customer_id=${customerId}`),
    create: (body: {
      customer_id: number;
      date: string;
      amount: number;
      description?: string | null;
      status?: string;
      finish_date?: string | null;
      due_date?: string | null;
      paid_fully?: boolean;
      paid_at?: string | null;
      apply_tax?: boolean;
    }) => request<unknown>('/api/transactions', { method: 'POST', body }),
    update: (id: number, body: Record<string, unknown>) =>
      request<unknown>(`/api/transactions/${id}`, { method: 'PUT', body }),
    delete: (id: number) => request<void>(`/api/transactions/${id}`, { method: 'DELETE' }),
  },
};
