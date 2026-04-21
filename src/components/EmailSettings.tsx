// src/components/EmailSettings.tsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const DEFAULT_REMINDER_SUBJECT = 'Friendly reminder about your overdue invoice';
const DEFAULT_REMINDER_BODY = 'Hi {{customer_name}},\n\nJust a gentle reminder that your payment of {{amount}} was due on {{due_date}}. Let me know if you need any help!\n\nThanks,\n{{your_name}}';
const DEFAULT_OFFER_SUBJECT = 'Special offer just for you';
const DEFAULT_OFFER_BODY = "Hi {{customer_name}},\n\nThank you for being a valued customer. Here's a special offer just for you: {{offer_details}}.\n\nBest regards,\n{{your_name}}";
const DEFAULT_INVOICE_SUBJECT = 'Invoice {{invoice_number}} from {{your_name}} – {{total}}';
const DEFAULT_INVOICE_BODY = 'Hi {{customer_name}},\n\nPlease find your invoice {{invoice_number}} below. The total amount due is {{total}}{{due_date}}.\n\nThanks,\n{{your_name}}';

export default function EmailSettings() {
  const [reminderSubject, setReminderSubject] = useState(DEFAULT_REMINDER_SUBJECT);
  const [reminderBody, setReminderBody] = useState(DEFAULT_REMINDER_BODY);
  const [offerSubject, setOfferSubject] = useState(DEFAULT_OFFER_SUBJECT);
  const [offerBody, setOfferBody] = useState(DEFAULT_OFFER_BODY);
  const [invoiceSubject, setInvoiceSubject] = useState(DEFAULT_INVOICE_SUBJECT);
  const [invoiceBody, setInvoiceBody] = useState(DEFAULT_INVOICE_BODY);
  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.emailTemplates.get(), api.invoiceEmailTemplate.get()])
      .then(([templates, inv]) => {
        setReminderSubject(templates.reminder.subject);
        setReminderBody(templates.reminder.body);
        setOfferSubject(templates.offer.subject);
        setOfferBody(templates.offer.body);
        setInvoiceSubject(inv.subject);
        setInvoiceBody(inv.body);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError(null);
    try {
      await Promise.all([
        api.emailTemplates.save({
          reminder: { subject: reminderSubject, body: reminderBody },
          offer: { subject: offerSubject, body: offerBody },
        }),
        api.invoiceEmailTemplate.save({ subject: invoiceSubject, body: invoiceBody }),
      ]);
      setSaveStatus('✅ Templates saved. They will be used when you send reminder, offer, or invoice emails.');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (e) {
      setSaveStatus('');
      setError(e instanceof Error ? e.message : 'Failed to save templates');
    }
  };

  const handleReset = () => {
    setReminderSubject(DEFAULT_REMINDER_SUBJECT);
    setReminderBody(DEFAULT_REMINDER_BODY);
    setOfferSubject(DEFAULT_OFFER_SUBJECT);
    setOfferBody(DEFAULT_OFFER_BODY);
    setInvoiceSubject(DEFAULT_INVOICE_SUBJECT);
    setInvoiceBody(DEFAULT_INVOICE_BODY);
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-gray-500">Loading templates…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        <p className="text-gray-600">Customize the emails that will be sent when you use Send Reminder or Send Offer.</p>
      </div>
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 space-y-2">
        <p className="font-medium text-slate-800">How customers see your emails</p>
        <p>
          Sender name and reply address come from your{' '}
          <strong>Business profile</strong>. Set them there once, and reminder, offer, and invoice emails will all use:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>From</strong>: your <em>Company / business name</em> shown in the inbox (falls back to a name from your login email if empty).
          </li>
          <li>
            <strong>Reply-To</strong>: your Business profile <em>Email</em> when valid, otherwise your PayRisk login email.
          </li>
          <li>
            <code>&#123;&#123;your_name&#125;&#125;</code> in the templates below uses the same business name.
          </li>
        </ul>
      </div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Payment Reminder Template */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">💰</span>
          <h2 className="text-lg font-semibold text-gray-900">Payment Reminder Email</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={reminderSubject}
              onChange={(e) => setReminderSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
            <textarea
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={reminderBody}
              onChange={(e) => setReminderBody(e.target.value)}
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Available variables:</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {'{{customer_name}}'}
              </span>
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {'{{amount}}'}
              </span>
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {'{{due_date}}'}
              </span>
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {'{{your_name}}'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Special Offer Template */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🎁</span>
          <h2 className="text-lg font-semibold text-gray-900">Special Offer Email</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={offerSubject}
              onChange={(e) => setOfferSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
            <textarea
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={offerBody}
              onChange={(e) => setOfferBody(e.target.value)}
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Available variables:</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {'{{customer_name}}'}
              </span>
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {'{{offer_details}}'}
              </span>
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {'{{your_name}}'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Email Template */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🧾</span>
          <h2 className="text-lg font-semibold text-gray-900">Invoice Email</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          The subject line and intro text used when you click <strong>Send Invoice</strong>. The invoice line items,
          tax, and totals are generated automatically from the transactions you select — configure tax in <strong>Business profile</strong>.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={invoiceSubject}
              onChange={(e) => setInvoiceSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Intro Body</label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={invoiceBody}
              onChange={(e) => setInvoiceBody(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Shown above the invoice table in the email. The invoice itself (line items, Price, Tax, Line total, Subtotal, Tax, Total due) is auto-generated.
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Available variables:</p>
            <div className="flex flex-wrap gap-2">
              {['{{customer_name}}', '{{invoice_number}}', '{{subtotal}}', '{{tax_amount}}', '{{tax_label}}', '{{total}}', '{{due_date}}', '{{your_name}}'].map((v) => (
                <span key={v} className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Save templates
        </button>

        <button
          onClick={handleReset}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Reset to Defaults
        </button>

        {saveStatus && <span className="text-green-600 font-medium">{saveStatus}</span>}
      </div>

      {/* Live Preview */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Preview</h3>
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="font-medium text-gray-900">{reminderSubject}</p>
            <p className="text-gray-600 whitespace-pre-line text-sm mt-2 border-t pt-2">
              {reminderBody
                .replace(/{{customer_name}}/g, 'John')
                .replace(/{{amount}}/g, '$459')
                .replace(/{{due_date}}/g, 'Mar 31, 2026')
                .replace(/{{your_name}}/g, 'Steve')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
