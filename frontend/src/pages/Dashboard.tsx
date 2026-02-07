import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';
import { accounts, analytics, transactions, recurring } from '../api';
import type { SpendingByCategory, MonthlyTrend, Transaction } from '../types';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['accounts', 'summary'],
    queryFn: () => accounts.getSummary(),
  });

  const { data: cashFlow, isLoading: cashFlowLoading } = useQuery({
    queryKey: ['analytics', 'cashFlow'],
    queryFn: () => analytics.cashFlow({}),
  });

  const { data: spending, isLoading: spendingLoading } = useQuery({
    queryKey: ['analytics', 'spending'],
    queryFn: () => analytics.spendingByCategory({}),
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics', 'trends'],
    queryFn: () => analytics.monthlyTrends({ months: 6 }),
  });

  const { data: recentTxns, isLoading: txnsLoading } = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => transactions.list({ page_size: 10 }),
  });

  const { data: insights } = useQuery({
    queryKey: ['analytics', 'insights'],
    queryFn: () => analytics.insights(),
  });

  const { data: upcomingBills } = useQuery({
    queryKey: ['recurring', 'upcoming'],
    queryFn: () => recurring.upcoming(14),
  });

  const isLoading = summaryLoading || cashFlowLoading || spendingLoading || trendsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">Your financial overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Net Worth</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary?.net_worth || 0)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Assets</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(summary?.total_assets || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Liabilities</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(summary?.total_liabilities || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <CreditCard className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">This Month's Cash Flow</p>
              <p className={`text-2xl font-bold ${(cashFlow?.net_cash_flow || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(cashFlow?.net_cash_flow || 0)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${(cashFlow?.net_cash_flow || 0) >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {(cashFlow?.net_cash_flow || 0) >= 0 ? (
                <ArrowUpRight className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <ArrowDownRight className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Trend */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Income vs Expenses</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => format(parseISO(value + '-01'), 'MMM')}
                  stroke="#9CA3AF"
                />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} stroke="#9CA3AF" />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => format(parseISO(label + '-01'), 'MMMM yyyy')}
                  contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stackId="1"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.3}
                  name="Income"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stackId="2"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.3}
                  name="Expenses"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending by Category */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Spending by Category</h3>
          <div className="h-64 flex">
            <div className="w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spending?.slice(0, 8) || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="amount"
                    nameKey="category_name"
                  >
                    {spending?.slice(0, 8).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 flex flex-col justify-center space-y-2">
              {spending?.slice(0, 6).map((cat, index) => (
                <div key={cat.category_id} className="flex items-center text-sm">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{cat.category_name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{cat.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Transactions, Upcoming Bills, Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {recentTxns?.transactions?.slice(0, 6).map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{txn.custom_name || txn.merchant_name || txn.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{format(parseISO(txn.date), 'MMM d')}</p>
                </div>
                <p className={`font-semibold text-sm ${txn.amount < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                  {txn.amount < 0 ? '+' : '-'}{formatCurrency(Math.abs(txn.amount))}
                </p>
              </div>
            ))}
            {(!recentTxns?.transactions || recentTxns.transactions.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No transactions yet</p>
            )}
          </div>
        </div>

        {/* Upcoming Bills */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-500" />
            Upcoming Bills
          </h3>
          <div className="space-y-3">
            {upcomingBills?.slice(0, 6).map((bill) => {
              const daysUntil = differenceInDays(parseISO(bill.next_due_date), new Date())
              return (
                <div key={bill.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-orange-500' : 'bg-green-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{bill.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">
                    {formatCurrency(bill.amount)}
                  </p>
                </div>
              )
            })}
            {(!upcomingBills || upcomingBills.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No upcoming bills</p>
            )}
          </div>
        </div>

        {/* Insights */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Spending Insights</h3>
          <div className="space-y-3">
            {insights?.slice(0, 5).map((insight, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  insight.type === 'increase' ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-green-50 dark:bg-green-900/20'
                }`}
              >
                <div className="flex items-start">
                  <AlertCircle className={`w-5 h-5 mr-2 mt-0.5 flex-shrink-0 ${
                    insight.type === 'increase' ? 'text-orange-500' : 'text-green-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{insight.category}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{insight.message}</p>
                  </div>
                </div>
              </div>
            ))}
            {(!insights || insights.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No insights available yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
