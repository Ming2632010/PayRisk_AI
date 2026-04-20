import { useState, useEffect } from 'react';
import { FileText, Save } from 'lucide-react';
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
      setMessage('Invoice template saved. It will be used when you send an invoice to a customer.');
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
          <FileText className="w-5 h-5 text-blue-600" />
          Invoice template
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Your company details appear on every invoice you send. Fill these in so customers see your name, contact info, and tax ID.
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
            Shown on the invoice. If this is a valid address, customer <strong>Reply</strong> on reminder, offer, and invoice emails goes here; otherwise replies go to your PayRisk login email.
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
