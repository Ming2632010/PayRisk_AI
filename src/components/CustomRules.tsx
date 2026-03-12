// src/components/CustomRules.tsx
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react';

interface Rule {
  id: string;
  type: 'risk' | 'repurchase' | 'both';
  field: string;
  operator: 'contains' | 'equals' | 'gt' | 'lt' | 'in_last_days';
  value: string;
  score_modifier: number;
  enabled: boolean;
}

export default function CustomRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    const savedRules = localStorage.getItem('customRules');
    if (savedRules) {
      try {
        setRules(JSON.parse(savedRules));
      } catch (error) {
        console.error('Error loading rules:', error);
      }
    }
  }, []);

  const addRule = () => {
    const newRule: Rule = {
      id: Date.now().toString(),
      type: 'risk',
      field: 'customer.notes',
      operator: 'contains',
      value: '',
      score_modifier: 10,
      enabled: true,
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (id: string, field: keyof Rule, value: any) => {
    setRules(rules.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)));
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  const saveRules = () => {
    localStorage.setItem('customRules', JSON.stringify(rules));
    setSaveStatus('✅ Rules saved locally. Score modifiers will be applied in a future update.');
    setTimeout(() => setSaveStatus(''), 4000);
  };

  const getFieldOptions = (type: string) => {
    const baseFields = [
      { value: 'customer.name', label: 'Customer Name' },
      { value: 'customer.email', label: 'Email' },
      { value: 'customer.company', label: 'Company' },
      { value: 'customer.notes', label: 'Notes' },
      { value: 'customer.amount_owed', label: 'Amount Owed' },
      { value: 'customer.total_orders', label: 'Total Orders' },
      { value: 'customer.average_order_value', label: 'Avg Order Value' },
    ];

    if (type === 'risk') {
      return [
        ...baseFields,
        { value: 'customer.is_high_risk_industry', label: 'High Risk Industry' },
        { value: 'days_overdue', label: 'Days Overdue' },
      ];
    } else {
      return [
        ...baseFields,
        { value: 'days_since_last_purchase', label: 'Days Since Last Purchase' },
        { value: 'payment_history_score', label: 'Payment History' },
      ];
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Custom Scoring Rules</h1>
        <p className="text-gray-600">
          Add your own rules to adjust risk and repurchase scores based on your industry experience.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How custom rules work:</p>
            <p>
              Rules are saved in this browser and will be used to adjust risk and repurchase scores in a future update. The app currently uses built-in scoring; your rules are stored for when modifier logic is enabled.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {rules.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">
              No custom rules yet. Click the button below to add your first rule.
            </p>
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex flex-wrap gap-3 items-start">
                <select
                  value={rule.type}
                  onChange={(e) => updateRule(rule.id, 'type', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                >
                  <option value="risk">🎯 Risk Score</option>
                  <option value="repurchase">📈 Repurchase Score</option>
                  <option value="both">✨ Both</option>
                </select>

                <span className="text-gray-500 self-center">IF</span>

                <select
                  value={rule.field}
                  onChange={(e) => updateRule(rule.id, 'field', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm min-w-[180px]"
                >
                  {getFieldOptions(rule.type).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, 'operator', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                >
                  <option value="contains">contains</option>
                  <option value="equals">equals</option>
                  <option value="gt">&gt; (greater than)</option>
                  <option value="lt">&lt; (less than)</option>
                  <option value="in_last_days">in last (days)</option>
                </select>

                <input
                  type="text"
                  value={rule.value}
                  onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
                  placeholder="value"
                  className="px-3 py-2 border border-gray-300 rounded-lg flex-1 min-w-[120px]"
                />

                <select
                  value={rule.score_modifier}
                  onChange={(e) => updateRule(rule.id, 'score_modifier', Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                >
                  <option value="-30">-30 points</option>
                  <option value="-20">-20 points</option>
                  <option value="-10">-10 points</option>
                  <option value="10">+10 points</option>
                  <option value="20">+20 points</option>
                  <option value="30">+30 points</option>
                </select>

                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => updateRule(rule.id, 'enabled', e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-600">ON</span>
                </label>

                <button
                  onClick={() => deleteRule(rule.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={addRule}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2 mb-6"
      >
        <Plus className="w-4 h-4" />
        Add Custom Rule
      </button>

      <div className="flex items-center gap-4">
        <button
          onClick={saveRules}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save All Rules
        </button>
        {saveStatus && <span className="text-green-600">{saveStatus}</span>}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-700 mb-2">💡 Example rules from other users:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>
            • IF email contains "tempmail" → +30 to risk score (catches disposable email users)
          </li>
          <li>
            • IF notes contains "negotiated" → +20 to risk score (price hagglers often delay
            payment)
          </li>
          <li>• IF days_overdue &gt; 30 → +40 to risk score</li>
          <li>
            • IF total_orders &gt; 5 AND average_order_value &gt; 500 → +20 to repurchase score
          </li>
        </ul>
      </div>
    </div>
  );
}
