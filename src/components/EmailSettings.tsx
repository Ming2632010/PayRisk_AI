// src/components/EmailSettings.tsx
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';

const DEFAULT_REMINDER_SUBJECT = 'Friendly reminder about your overdue invoice';
const DEFAULT_REMINDER_BODY = 'Hi {{customer_name}},\n\nJust a gentle reminder that your payment of {{amount}} was due on {{due_date}}. Let me know if you need any help!\n\nThanks,\n{{your_name}}';
const DEFAULT_OFFER_SUBJECT = 'Special offer just for you';
const DEFAULT_OFFER_BODY = "Hi {{customer_name}},\n\nThank you for being a valued customer. Here's a special offer just for you: {{offer_details}}.\n\nBest regards,\n{{your_name}}";
const DEFAULT_INVOICE_SUBJECT = 'Invoice {{invoice_number}} from {{your_name}} – {{total}}';
const DEFAULT_INVOICE_BODY = 'Hi {{customer_name}},\n\nPlease find your invoice {{invoice_number}} below. The total amount due is {{total}}{{due_date}}.\n\nThanks,\n{{your_name}}';
const DEFAULT_SMS_BODY = 'Hi {{customer_name}}, friendly reminder: {{amount}} is due{{due_date}}. Any questions, please contact {{contact_name}} on {{contact_number}}. Thanks — {{business_name}}';

/**
 * Predicts how Twilio will bill an SMS given its text. Twilio splits long messages into
 * "segments" and charges per segment. GSM-7 messages fit 160 chars per segment (153 when
 * concatenated). Any non-GSM-7 character (e.g. emoji, most non-Latin scripts) forces
 * UCS-2 encoding at 70 chars per segment (67 when concatenated).
 */
const GSM7_CHARS = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà\[\]^{|}~€\\`]*$/;
function estimateSmsSegments(text: string): { length: number; segments: number; encoding: 'GSM-7' | 'UCS-2'; perSegment: number } {
  const length = text.length;
  const isGsm = GSM7_CHARS.test(text);
  const encoding = isGsm ? 'GSM-7' : 'UCS-2';
  if (length === 0) return { length, segments: 0, encoding, perSegment: isGsm ? 160 : 70 };
  if (isGsm) {
    if (length <= 160) return { length, segments: 1, encoding, perSegment: 160 };
    return { length, segments: Math.ceil(length / 153), encoding, perSegment: 153 };
  }
  if (length <= 70) return { length, segments: 1, encoding, perSegment: 70 };
  return { length, segments: Math.ceil(length / 67), encoding, perSegment: 67 };
}

export default function EmailSettings() {
  const [reminderSubject, setReminderSubject] = useState(DEFAULT_REMINDER_SUBJECT);
  const [reminderBody, setReminderBody] = useState(DEFAULT_REMINDER_BODY);
  const [offerSubject, setOfferSubject] = useState(DEFAULT_OFFER_SUBJECT);
  const [offerBody, setOfferBody] = useState(DEFAULT_OFFER_BODY);
  const [invoiceSubject, setInvoiceSubject] = useState(DEFAULT_INVOICE_SUBJECT);
  const [invoiceBody, setInvoiceBody] = useState(DEFAULT_INVOICE_BODY);
  const [smsBody, setSmsBody] = useState(DEFAULT_SMS_BODY);
  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.emailTemplates.get(), api.invoiceEmailTemplate.get(), api.smsTemplate.get()])
      .then(([templates, inv, sms]) => {
        setReminderSubject(templates.reminder.subject);
        setReminderBody(templates.reminder.body);
        setOfferSubject(templates.offer.subject);
        setOfferBody(templates.offer.body);
        setInvoiceSubject(inv.subject);
        setInvoiceBody(inv.body);
        setSmsBody(sms.body || DEFAULT_SMS_BODY);
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
        api.smsTemplate.save({ body: smsBody }),
      ]);
      setSaveStatus('✅ Templates saved. They will be used when you send reminder, offer, invoice, or SMS.');
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
    setSmsBody(DEFAULT_SMS_BODY);
  };

  // Live stats for the SMS template. Cannot exactly predict length post-variable-substitution
  // (that depends on each customer), but renders a realistic estimate using sample values so
  // merchants can see when their template will overflow to 2 or 3 SMS segments.
  const smsPreview = useMemo(() => {
    return smsBody
      .replace(/\{\{customer_name\}\}/g, 'John')
      .replace(/\{\{amount\}\}/g, '$459.00')
      .replace(/\{\{due_date\}\}/g, ' by 2026-04-25')
      .replace(/\{\{business_name\}\}/g, 'Acme Ltd')
      .replace(/\{\{contact_name\}\}/g, 'Sarah')
      .replace(/\{\{contact_number\}\}/g, '+61 412 345 678')
      .replace(/\{\{contact_email\}\}/g, 'billing@acme.com');
  }, [smsBody]);
  const smsStats = useMemo(() => estimateSmsSegments(smsPreview), [smsPreview]);

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

      {/* SMS Template (one-way) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">📱</span>
          <h2 className="text-lg font-semibold text-gray-900">SMS Template</h2>
          <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 border border-amber-200">
            one-way
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Used when you click <strong>Send SMS</strong> on a customer. Because SMS is send-only,
          include your contact details (name, number, or email) so customers can reply through
          another channel. Keep it under <strong>160 characters</strong> to fit a single SMS
          segment.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value.slice(0, 1000))}
            />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-gray-500">
                Preview length: <strong>{smsStats.length}</strong> / {smsStats.perSegment} chars per segment ({smsStats.encoding})
              </span>
              <span
                className={`font-medium ${
                  smsStats.segments <= 1
                    ? 'text-green-600'
                    : smsStats.segments === 2
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`}
              >
                {smsStats.segments === 0
                  ? 'Empty'
                  : `${smsStats.segments} SMS segment${smsStats.segments === 1 ? '' : 's'}`}
              </span>
            </div>
            {smsStats.segments > 1 && (
              <p className="text-xs text-amber-700 mt-1">
                ⚠️ Your message will be billed as {smsStats.segments} SMS. Consider shortening
                for better deliverability and lower cost.
              </p>
            )}
            {smsStats.encoding === 'UCS-2' && (
              <p className="text-xs text-amber-700 mt-1">
                ⚠️ Contains a non-GSM character (emoji or special symbol) — reduces the
                per-segment limit to {smsStats.perSegment} chars.
              </p>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Available variables:</p>
            <div className="flex flex-wrap gap-2">
              {['{{customer_name}}', '{{amount}}', '{{due_date}}', '{{business_name}}', '{{contact_name}}', '{{contact_number}}', '{{contact_email}}'].map((v) => (
                <span key={v} className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {v}
                </span>
              ))}
            </div>
            <p className="text-xs text-blue-800/80 mt-2">
              <code>&#123;&#123;business_name&#125;&#125;</code>,{' '}
              <code>&#123;&#123;contact_name&#125;&#125;</code>,{' '}
              <code>&#123;&#123;contact_number&#125;&#125;</code>, and{' '}
              <code>&#123;&#123;contact_email&#125;&#125;</code> come from your{' '}
              <strong>Business profile</strong>.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Preview (with sample data)</p>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                {smsPreview || <em className="text-gray-400">Type a message above to see the preview</em>}
              </p>
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
