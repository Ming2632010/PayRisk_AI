// src/components/DashboardCharts.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Customer } from '../lib/database.types';
import { 
  calculateRiskScore, 
  calculateRepurchaseScore, 
  formatCurrency 
} from '../utils/scoring';

interface DashboardChartsProps {
  customers: Customer[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function DashboardCharts({ customers }: DashboardChartsProps) {
  // 如果没数据，不显示任何内容
  if (customers.length === 0) {
    return null;
  }

  // 1. 风险分布数据
  const highRisk = customers.filter(c => calculateRiskScore(c) >= 60).length;
  const mediumRisk = customers.filter(c => {
    const score = calculateRiskScore(c);
    return score >= 40 && score < 60;
  }).length;
  const lowRisk = customers.filter(c => calculateRiskScore(c) < 40).length;

  const riskDistribution = [];
  if (highRisk > 0) riskDistribution.push({ name: 'High Risk', value: highRisk });
  if (mediumRisk > 0) riskDistribution.push({ name: 'Medium Risk', value: mediumRisk });
  if (lowRisk > 0) riskDistribution.push({ name: 'Low Risk', value: lowRisk });

  // 2. 复购意愿分布
  const highIntent = customers.filter(c => calculateRepurchaseScore(c) >= 80).length;
  const mediumIntent = customers.filter(c => {
    const score = calculateRepurchaseScore(c);
    return score >= 50 && score < 80;
  }).length;
  const lowIntent = customers.filter(c => calculateRepurchaseScore(c) < 50).length;

  const repurchaseDistribution = [];
  if (highIntent > 0) repurchaseDistribution.push({ name: 'High Intent', value: highIntent });
  if (mediumIntent > 0) repurchaseDistribution.push({ name: 'Medium Intent', value: mediumIntent });
  if (lowIntent > 0) repurchaseDistribution.push({ name: 'Low Intent', value: lowIntent });

  // 3. 逾期金额前5名
  const topOverdue = [...customers]
    .filter(c => c.amount_owed > 0)
    .sort((a, b) => b.amount_owed - a.amount_owed)
    .slice(0, 5)
    .map(c => ({
      name: c.name.length > 10 ? c.name.substring(0, 10) + '...' : c.name,
      amount: c.amount_owed,
    }));

  // 4. 标签分布
  const tagCounts: Record<string, number> = {};
  customers.forEach(customer => {
    if (customer.tags && Array.isArray(customer.tags)) {
      customer.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });
  
  const tagDistribution = Object.entries(tagCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* 风险分布饼图 */}
      {riskDistribution.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name} ${((entry.value / customers.length) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {riskDistribution.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 复购意愿饼图 */}
      {repurchaseDistribution.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Repurchase Intent</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={repurchaseDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name} ${((entry.value / customers.length) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {repurchaseDistribution.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 逾期金额排行 */}
      {topOverdue.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Overdue Amounts</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topOverdue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="amount" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 标签分布 */}
      {tagDistribution.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Tags</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tagDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}