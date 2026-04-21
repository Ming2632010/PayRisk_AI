import { useState, useEffect } from 'react';
import { Building2, Save } from 'lucide-react';
import { api, type InvoiceTemplate } from '../lib/api';

const defaultTemplate: InvoiceTemplate = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  tax_id: '',
  footer_notes: '',
  tax_enabled: true,
  tax_label: 'GST',
  tax_rate: 10,
  tax_inclusive: false,
  sms_country_code: '+61',
};

/** Common SMS country codes shown in the datalist. Users can still type anything else. */
const SMS_COUNTRY_CODES: { code: string; label: string }[] = [
  { code: '+61', label: 'Australia' },
  { code: '+64', label: 'New Zealand' },
  { code: '+1',  label: 'US / Canada' },
  { code: '+44', label: 'United Kingdom' },
  { code: '+353', label: 'Ireland' },
  { code: '+65', label: 'Singapore' },
  { code: '+852', label: 'Hong Kong' },
  { code: '+81', label: 'Japan' },
  { code: '+82', label: 'South Korea' },
  { code: '+91', label: 'India' },
  { code: '+86', label: 'China' },
  { code: '+49', label: 'Germany' },
  { code: '+33', label: 'France' },
  { code: '+34', label: 'Spain' },
  { code: '+39', label: 'Italy' },
  { code: '+31', label: 'Netherlands' },
  { code: '+27', label: 'South Africa' },
  { code: '+971', label: 'UAE' },
];

export default function InvoiceTemplateSettings() {
  const [template, setTemplate] = useState<InvoiceTemplate>(defaultTemplate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.invoiceTemplate.get().then((t) => {
      setTemplate({ ...defaultTemplate, ...t });
    }).catch(() => setTemplate(defaultTemplate)).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      await api.invoiceTemplate.save(template);
      setMessage('Business profile saved. It will be used on invoices and on emails you send to customers.');
      try {
        window.dispatchEvent(new Event('business-profile-updated'));
      } catch (_err) {
        /* safe to ignore: only affects header label refresh */
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-500 py-8">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          Business profile
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Your company details. Used for invoices you send and as the sender / reply address on reminder, offer, and invoice emails.
        </p>
      </div>

      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 space-y-2">
        <p className="font-medium text-slate-800">How this info is used</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Company / business name</strong> – shown as the sender name in the inbox (e.g. <em>&quot;Acme Ltd&quot;</em>) and used for <code>&#123;&#123;your_name&#125;&#125;</code> in reminder / offer templates.
          </li>
          <li>
            <strong>Email</strong> – used as <strong>Reply-To</strong> on reminder, offer, and invoice emails when valid; otherwise replies go to your PayRisk login email. Also shown on invoices.
          </li>
          <li>
            <strong>Contact name, Phone, Address, Tax ID, Footer notes</strong> – printed on the invoice emails you send to customers.
          </li>
        </ul>
        <p className="text-xs text-slate-500">
          Tip: fill in the fields that represent <strong>your</strong> business — not the customer&apos;s. Each customer&apos;s own info is saved on their record.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company / business name</label>
          <input
            type="text"
            value={template.company_name}
            onChange={(e) => setTemplate({ ...template, company_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Acme Ltd"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact name</label>
          <input
            type="text"
            value={template.contact_name}
            onChange={(e) => setTemplate({ ...template, contact_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="John Smith"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={template.email}
            onChange={(e) => setTemplate({ ...template, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="billing@acme.com"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            When valid, customer <strong>Reply</strong> on reminder, offer, and invoice emails goes here. Otherwise replies go to your PayRisk login email. Also shown on invoices.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="text"
            value={template.phone}
            onChange={(e) => setTemplate({ ...template, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="+1 234 567 8900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <textarea
            value={template.address}
            onChange={(e) => setTemplate({ ...template, address: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={2}
            placeholder="123 Main St&#10;City, State, ZIP"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID / ABN / VAT number</label>
          <input
            type="text"
            value={template.tax_id}
            onChange={(e) => setTemplate({ ...template, tax_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="XX XXX XXX XX"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Footer notes (optional)</label>
          <textarea
            value={template.footer_notes}
            onChange={(e) => setTemplate({ ...template, footer_notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={2}
            placeholder="Payment terms, bank details, or thank you message"
          />
        </div>

        <div className="pt-4 mt-2 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Tax (GST / VAT)</h3>
          <p className="text-xs text-gray-500 mb-4">
            Applied to every line on invoices you send. Defaults to 10% GST (Australia). Change the label / rate for your country.
          </p>

          <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
            <input
              type="checkbox"
              checked={template.tax_enabled}
              onChange={(e) => setTemplate({ ...template, tax_enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            Apply tax to invoices
          </label>

          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!template.tax_enabled ? 'opacity-50' : ''}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax label</label>
              <input
                type="text"
                value={template.tax_label}
                onChange={(e) => setTemplate({ ...template, tax_label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="GST"
                disabled={!template.tax_enabled}
              />
              <p className="text-xs text-gray-500 mt-1">e.g. GST, VAT, Sales tax</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={template.tax_rate}
                onChange={(e) => setTemplate({ ...template, tax_rate: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={!template.tax_enabled}
              />
              <p className="text-xs text-gray-500 mt-1">Percentage applied to each transaction</p>
            </div>
          </div>

          <label className={`flex items-start gap-2 text-sm text-gray-700 mt-4 ${!template.tax_enabled ? 'opacity-50' : ''}`}>
            <input
              type="checkbox"
              checked={template.tax_inclusive}
              onChange={(e) => setTemplate({ ...template, tax_inclusive: e.target.checked })}
              className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded"
              disabled={!template.tax_enabled}
            />
            <span>
              <span className="font-medium">Amounts include tax</span>
              <span className="block text-xs text-gray-500">
                Leave off (default) if the amount you enter on a transaction is <em>before</em> tax — tax is added on top.
                Tick if the amount already includes tax — it will be shown separately on the invoice.
              </span>
            </span>
          </label>
        </div>

        <div className="pt-4 mt-2 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">SMS settings</h3>
          <p className="text-xs text-gray-500 mb-4">
            Default country code applied to customer phone numbers that are stored in local format
            (e.g. <code>0412 345 678</code> becomes <code>+61 412 345 678</code>). Numbers already in
            international format (starting with <code>+</code>) are used as-is.
          </p>

          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Default SMS country code</label>
            <input
              type="text"
              list="sms-country-code-list"
              value={template.sms_country_code}
              onChange={(e) => setTemplate({ ...template, sms_country_code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
              placeholder="+61"
            />
            <datalist id="sms-country-code-list">
              {SMS_COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </datalist>
            <p className="text-xs text-gray-500 mt-1">
              Pick from the list or type any country code (e.g. <code>+61</code>, <code>+1</code>, <code>+44</code>).
            </p>
          </div>
        </div>

        {message && <p className="text-sm text-green-600">{message}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save template'}
        </button>
      </div>
    </div>
  );
}
