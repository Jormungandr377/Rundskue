import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ArrowRight, Store, Star } from 'lucide-react';
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
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { analytics } from '../api';
import authenticatedApi from '../services/api';
import { formatCurrency } from '../utils/format';
import { CHART_COLORS } from '../constants/colors';
import SpendingHeatmap from '../components/SpendingHeatmap';

type ReportType = 'spending' | 'income-expense' | 'trends' | 'net-worth' | 'heatmap';

export default function Reports() {
  const navigate = useNavigate();
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

  const { data: heatmapData, isLoading: heatmapLoading } = useQuery<{ date: string; amount: number }[]>({
    queryKey: ['analytics', 'spending-heatmap'],
    queryFn: async () => {
      const response = await authenticatedApi.get('/analytics/spending-heatmap');
      return response.data;
    },
    enabled: reportType === 'heatmap',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Reports</h1>
          <p className="text-stone-500 dark:text-stone-400">Analyze your financial data</p>
        </div>
      </div>

      {/* Quick Links to Dedicated Analysis Pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/year-in-review')}
          className="card p-4 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors group text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <Star className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="font-semibold text-stone-900 dark:text-white text-sm">Year in Review</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Annual financial infographic</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 dark:text-stone-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/merchant-analysis')}
          className="card p-4 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors group text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <Store className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="font-semibold text-stone-900 dark:text-white text-sm">Merchant Analysis</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Top merchants, spending breakdown</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 dark:text-stone-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
        </button>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2 border-b border-stone-200 dark:border-stone-700 overflow-x-auto">
        {[
          { id: 'spending', label: 'Spending by Category' },
          { id: 'income-expense', label: 'Income vs Expenses' },
          { id: 'trends', label: 'Monthly Trends' },
          { id: 'net-worth', label: 'Net Worth' },
          { id: 'heatmap', label: 'Heatmap' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id as ReportType)}
            className={`px-4 py-3 font-medium text-sm transition-colors whitespace-nowrap ${
              reportType === tab.id
                ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Range (for some reports) */}
      {(reportType === 'spending' || reportType === 'income-expense') && (
        <div className="card p-4 flex items-center gap-4">
          <Calendar className="w-5 h-5 text-stone-400 dark:text-stone-500" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <span className="text-stone-400 dark:text-stone-500">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      )}

      {/* Report Content */}
      <div className="card p-6">
        {reportType === 'spending' && spending && (
          <div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Spending by Category</h3>
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
                      <span className="text-stone-700 dark:text-stone-300">{cat.category_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-stone-900 dark:text-white">{formatCurrency(cat.amount)}</span>
                      <span className="text-stone-500 dark:text-stone-400 text-sm ml-2">({cat.percentage}%)</span>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-stone-200 dark:border-stone-700 flex items-center justify-between font-semibold">
                  <span className="text-stone-900 dark:text-white">Total</span>
                  <span className="text-stone-900 dark:text-white">{formatCurrency(spending.reduce((sum, cat) => sum + cat.amount, 0))}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {reportType === 'income-expense' && cashFlow && (
          <div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Income vs Expenses</h3>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <p className="text-sm text-emerald-700 dark:text-emerald-400">Income</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(cashFlow.total_income)}</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">Expenses</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(cashFlow.total_expenses)}</p>
              </div>
              <div className={`p-4 rounded-lg ${cashFlow.net_cash_flow >= 0 ? 'bg-teal-50 dark:bg-teal-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
                <p className={`text-sm ${cashFlow.net_cash_flow >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-orange-700 dark:text-orange-400'}`}>Net</p>
                <p className={`text-2xl font-bold ${cashFlow.net_cash_flow >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-orange-600 dark:text-orange-400'}`}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#44403c" opacity={0.2} />
                  <XAxis dataKey="name" stroke="#a8a29e" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} stroke="#a8a29e" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="amount" fill="#14b8a6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {reportType === 'trends' && trends && (
          <div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Monthly Trends (Past 12 Months)</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#44403c" opacity={0.2} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => format(parseISO(value + '-01'), 'MMM')}
                    stroke="#a8a29e"
                  />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} stroke="#a8a29e" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => format(parseISO(label + '-01'), 'MMMM yyyy')}
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg, #fff)',
                      border: '1px solid #e7e5e4',
                      borderRadius: '8px',
                    }}
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
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Net Worth Over Time</h3>
            {netWorth.length > 0 ? (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={netWorth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#44403c" opacity={0.2} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => format(parseISO(value), 'MMM yyyy')}
                      stroke="#a8a29e"
                    />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} stroke="#a8a29e" />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => format(parseISO(label), 'MMMM d, yyyy')}
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg, #fff)',
                        border: '1px solid #e7e5e4',
                        borderRadius: '8px',
                      }}
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
              <div className="text-center py-12 text-stone-500 dark:text-stone-400">
                <p>No net worth history available.</p>
                <p className="text-sm mt-2">Net worth snapshots are created automatically during daily syncs.</p>
              </div>
            )}
          </div>
        )}

        {reportType === 'heatmap' && (
          <div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Spending Heatmap</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
              Daily spending activity over the past year. Darker cells indicate higher spending.
            </p>
            {heatmapLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 dark:border-teal-400"></div>
              </div>
            ) : heatmapData && heatmapData.length > 0 ? (
              <SpendingHeatmap data={heatmapData} />
            ) : (
              <div className="text-center py-12 text-stone-500 dark:text-stone-400">
                <p>No spending data available for the heatmap.</p>
                <p className="text-sm mt-2">Spending data will appear here once transactions are synced.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
