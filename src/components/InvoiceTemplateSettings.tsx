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
};

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
