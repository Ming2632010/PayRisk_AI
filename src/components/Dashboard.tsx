import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, DollarSign, Users, Clock } from 'lucide-react';
import { api } from '../lib/api';
import type { Customer } from '../lib/database.types';
import { DashboardCharts } from './DashboardCharts';
import {
  calculateRiskScore,
  calculateRepurchaseScore,
  formatCurrency,
  formatDate,
} from '../utils/scoring';

interface DashboardMetrics {
  totalOutstanding: number;
  overdueAmount: number;
  highRiskCount: number;
  highRepurchaseCount: number;
  estimatedRepurchaseValue: number;
  notContactedCount: number;
}

export function Dashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalOutstanding: 0,
    overdueAmount: 0,
    highRiskCount: 0,
    highRepurchaseCount: 0,
    estimatedRepurchaseValue: 0,
    notContactedCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const data = await api.customers.list();
      const list = (data || []) as Customer[];
      setCustomers(list);
      calculateMetrics(list);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateMetrics(customerData: Customer[]) {
    const today = new Date();
    let totalOutstanding = 0;
    let overdueAmount = 0;
    let highRiskCount = 0;
    let highRepurchaseCount = 0;
    let estimatedRepurchaseValue = 0;
    let notContactedCount = 0;

    customerData.forEach((customer) => {
      totalOutstanding += customer.amount_owed;

      if (customer.due_date && new Date(customer.due_date) < today) {
        overdueAmount += customer.amount_owed;
      }

      const riskScore = calculateRiskScore(customer);
      if (riskScore >= 60) {
        highRiskCount++;
      }

      const repurchaseScore = calculateRepurchaseScore(customer);
      if (repurchaseScore >= 80) {
        highRepurchaseCount++;
        estimatedRepurchaseValue += customer.average_order_value;
      }

      if (customer.last_purchase_date) {
        const daysSinceContact = Math.floor(
          (today.getTime() - new Date(customer.last_purchase_date).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (daysSinceContact > 30) {
          notContactedCount++;
        }
      }
    });

    setMetrics({
      totalOutstanding,
      overdueAmount,
      highRiskCount,
      highRepurchaseCount,
      estimatedRepurchaseValue,
      notContactedCount,
    });
  }

  const highRiskCustomers = customers
    .map((customer) => ({
      ...customer,
      riskScore: calculateRiskScore(customer),
    }))
    .filter((c) => c.riskScore >= 60)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  const highValueCustomers = customers
    .map((customer) => ({
      ...customer,
      repurchaseScore: calculateRepurchaseScore(customer),
    }))
    .filter((c) => c.repurchaseScore >= 80)
    .sort((a, b) => b.repurchaseScore - a.repurchaseScore)
    .slice(0, 5);

  const [sendingAction, setSendingAction] = useState<'reminder' | 'offer' | null>(null);

  async function handleSendReminder(customer: Customer) {
    setSendingAction('reminder');
    try {
      await api.customers.sendReminder(customer.id);
      alert(`Payment reminder sent by email to ${customer.name}.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send reminder');
    } finally {
      setSendingAction(null);
    }
  }

  async function handleSendOffer(customer: Customer) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl shadow-sm border border-red-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Risk Management
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(metrics.totalOutstanding)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Overdue Amount</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(metrics.overdueAmount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">High-Risk Customers</p>
              <p className="text-2xl font-bold text-orange-600">{metrics.highRiskCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Value Management
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">High Intent</p>
              <p className="text-2xl font-bold text-green-600">{metrics.highRepurchaseCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Est. Repurchase</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(metrics.estimatedRepurchaseValue)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Not Contacted (30d)</p>
              <p className="text-2xl font-bold text-gray-700">{metrics.notContactedCount}</p>
            </div>
          </div>
        </div>
      </div>

          {/* 仪表盘图表 */}
    <DashboardCharts customers={customers} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-800">High-Risk Alerts</h3>
            <span className="ml-auto text-sm text-gray-500">Top 5</span>
          </div>
          {highRiskCustomers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No high-risk customers</p>
          ) : (
            <div className="space-y-3">
              {highRiskCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-600">{customer.company || customer.email}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-600">
                        <DollarSign className="w-3 h-3 inline" />
                        {formatCurrency(customer.amount_owed)}
                      </span>
                      {customer.due_date && (
                        <span className="text-sm text-gray-600">
                          <Clock className="w-3 h-3 inline" />
                          Due {formatDate(customer.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{customer.riskScore}</div>
                      <div className="text-xs text-gray-500">Risk Score</div>
                    </div>
                    <button
                      onClick={() => handleSendReminder(customer)}
                      disabled={sendingAction !== null}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium whitespace-nowrap"
                    >
                      {sendingAction === 'reminder' ? 'Sending…' : 'Send Reminder'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-800">High-Value Recommendations</h3>
            <span className="ml-auto text-sm text-gray-500">Top 5</span>
          </div>
          {highValueCustomers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No high-value opportunities</p>
          ) : (
            <div className="space-y-3">
              {highValueCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-600">{customer.company || customer.email}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-600">
                        <Users className="w-3 h-3 inline" />
                        {customer.total_orders} orders
                      </span>
                      <span className="text-sm text-gray-600">
                        <DollarSign className="w-3 h-3 inline" />
                        Avg {formatCurrency(customer.average_order_value)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {customer.repurchaseScore}
                      </div>
                      <div className="text-xs text-gray-500">Intent Score</div>
                    </div>
                    <button
                      onClick={() => handleSendOffer(customer)}
                      disabled={sendingAction !== null}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium whitespace-nowrap"
                    >
                      {sendingAction === 'offer' ? 'Sending…' : 'Send Offer'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
