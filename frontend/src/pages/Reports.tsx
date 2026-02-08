import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Calendar } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { analytics } from '../api';
import { formatCurrency } from '../utils/format';
import { CHART_COLORS } from '../constants/colors';

type ReportType = 'spending' | 'income-expense' | 'trends' | 'net-worth';

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>('spending');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  const { data: spending } = useQuery({
    queryKey: ['analytics', 'spending', dateRange],
    queryFn: () => analytics.spendingByCategory({
      start_date: dateRange.start,
      end_date: dateRange.end,
    }),
    enabled: reportType === 'spending',
  });

  const { data: cashFlow } = useQuery({
    queryKey: ['analytics', 'cashFlow', dateRange],
    queryFn: () => analytics.cashFlow({
      start_date: dateRange.start,
      end_date: dateRange.end,
    }),
    enabled: reportType === 'income-expense',
  });

  const { data: trends } = useQuery({
    queryKey: ['analytics', 'trends'],
    queryFn: () => analytics.monthlyTrends({ months: 12 }),
    enabled: reportType === 'trends',
  });

  const { data: netWorth } = useQuery({
    queryKey: ['analytics', 'netWorth'],
    queryFn: () => analytics.netWorthHistory({ months: 12 }),
    enabled: reportType === 'net-worth',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Reports</h1>
          <p className="text-stone-500">Analyze your financial data</p>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2 border-b border-stone-200">
        {[
          { id: 'spending', label: 'Spending by Category' },
          { id: 'income-expense', label: 'Income vs Expenses' },
          { id: 'trends', label: 'Monthly Trends' },
          { id: 'net-worth', label: 'Net Worth' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id as ReportType)}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              reportType === tab.id
                ? 'text-teal-600 border-b-2 border-teal-600'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Range (for some reports) */}
      {(reportType === 'spending' || reportType === 'income-expense') && (
        <div className="card p-4 flex items-center gap-4">
          <Calendar className="w-5 h-5 text-stone-400" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <span className="text-stone-400">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      )}

      {/* Report Content */}
      <div className="card p-6">
        {reportType === 'spending' && spending && (
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Spending by Category</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Pie Chart */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={spending.slice(0, 10)}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      dataKey="amount"
                      nameKey="category_name"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      labelLine={false}
                    >
                      {spending.slice(0, 10).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category List */}
              <div className="space-y-3">
                {spending.map((cat, index) => (
                  <div key={cat.category_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-stone-700">{cat.category_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-stone-900">{formatCurrency(cat.amount)}</span>
                      <span className="text-stone-500 text-sm ml-2">({cat.percentage}%)</span>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-stone-200 flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(spending.reduce((sum, cat) => sum + cat.amount, 0))}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {reportType === 'income-expense' && cashFlow && (
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Income vs Expenses</h3>
            
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-emerald-50 rounded-lg">
                <p className="text-sm text-emerald-700">Income</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(cashFlow.total_income)}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-700">Expenses</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(cashFlow.total_expenses)}</p>
              </div>
              <div className={`p-4 rounded-lg ${cashFlow.net_cash_flow >= 0 ? 'bg-teal-50' : 'bg-orange-50'}`}>
                <p className={`text-sm ${cashFlow.net_cash_flow >= 0 ? 'text-teal-700' : 'text-orange-700'}`}>Net</p>
                <p className={`text-2xl font-bold ${cashFlow.net_cash_flow >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>
                  {formatCurrency(cashFlow.net_cash_flow)}
                </p>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Income', amount: cashFlow.total_income },
                    { name: 'Expenses', amount: cashFlow.total_expenses },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="amount" fill="#14b8a6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {reportType === 'trends' && trends && (
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Monthly Trends (Past 12 Months)</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => format(parseISO(value + '-01'), 'MMM')}
                  />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => format(parseISO(label + '-01'), 'MMMM yyyy')}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.3}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="Net"
                    stroke="#14b8a6"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {reportType === 'net-worth' && netWorth && (
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Net Worth Over Time</h3>
            {netWorth.length > 0 ? (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={netWorth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => format(parseISO(value), 'MMM yyyy')}
                    />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => format(parseISO(label), 'MMMM d, yyyy')}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="total_assets"
                      name="Assets"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.3}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_liabilities"
                      name="Liabilities"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.3}
                    />
                    <Line
                      type="monotone"
                      dataKey="net_worth"
                      name="Net Worth"
                      stroke="#14b8a6"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-stone-500">
                <p>No net worth history available.</p>
                <p className="text-sm mt-2">Net worth snapshots are created automatically during daily syncs.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
