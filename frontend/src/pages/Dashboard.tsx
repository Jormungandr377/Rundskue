import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';
import { accounts, analytics, transactions, recurring, goals } from '../api';
import { formatCurrency } from '../utils/format';
import { CHART_COLORS } from '../constants/colors';

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

  const { data: netWorthHistory } = useQuery({
    queryKey: ['analytics', 'netWorthHistory'],
    queryFn: () => analytics.netWorthHistory({ months: 6 }),
  });

  const { data: savingsGoals } = useQuery({
    queryKey: ['goals', 'active'],
    queryFn: () => goals.list(false),
  });

  const isLoading = summaryLoading || cashFlowLoading || spendingLoading || trendsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-10 h-10 border-3 border-primary-200 dark:border-primary-900/40 rounded-full" />
          <div className="absolute inset-0 w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Dashboard</h1>
        <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">Your financial overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">Net Worth</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
                {formatCurrency(summary?.net_worth || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center shadow-sm shadow-primary-500/20 group-hover:shadow-md group-hover:shadow-primary-500/25 transition-shadow">
              <Wallet className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="card p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">Total Assets</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(summary?.total_assets || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="card p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">Total Liabilities</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {formatCurrency(summary?.total_liabilities || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="card p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">This Month</p>
              <p className={`text-2xl font-bold mt-1 ${(cashFlow?.net_cash_flow || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(cashFlow?.net_cash_flow || 0)}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${(cashFlow?.net_cash_flow || 0) >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
              {(cashFlow?.net_cash_flow || 0) >= 0 ? (
                <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses - Bar Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Income vs Expenses</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends || []} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.15} />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => format(parseISO(value + '-01'), 'MMM')}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => format(parseISO(label + '-01'), 'MMMM yyyy')}
                  contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending by Category */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Spending by Category</h3>
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
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 flex flex-col justify-center space-y-2.5">
              {spending?.slice(0, 6).map((cat, index) => (
                <div key={cat.category_id} className="flex items-center text-sm">
                  <div
                    className="w-3 h-3 rounded-full mr-2.5 flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="text-surface-600 dark:text-surface-400 truncate flex-1">{cat.category_name}</span>
                  <span className="font-semibold text-surface-900 dark:text-white ml-2">{cat.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Net Worth Trend + Savings Goals Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Worth Trend */}
        {netWorthHistory && netWorthHistory.length > 1 && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Net Worth Trend</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(parseISO(value), 'MMM')}
                    stroke="#94a3b8"
                    fontSize={12}
                  />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => format(parseISO(label), 'MMM d, yyyy')}
                    contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                  />
                  <Area type="monotone" dataKey="net_worth" stroke="#6366f1" fill="#6366f1" fillOpacity={0.12} name="Net Worth" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Savings Goals Progress */}
        {savingsGoals && savingsGoals.length > 0 && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Savings Goals</h3>
            <div className="space-y-4">
              {savingsGoals.filter(g => !g.is_completed).slice(0, 4).map((goal) => (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-surface-900 dark:text-white">{goal.name}</span>
                    <span className="text-surface-500 dark:text-surface-400">
                      {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                    </span>
                  </div>
                  <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(goal.progress_pct, 100)}%`, backgroundColor: goal.color || '#6366f1' }}
                    />
                  </div>
                  <p className="text-right text-xs text-surface-400 dark:text-surface-500 mt-0.5">{goal.progress_pct}%</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Recent Transactions, Upcoming Bills, Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Recent Transactions</h3>
          <div className="space-y-1">
            {recentTxns?.transactions?.slice(0, 6).map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-2.5 border-b border-surface-100 dark:border-surface-700/50 last:border-0">
                <div>
                  <p className="font-medium text-surface-900 dark:text-white text-sm">{txn.custom_name || txn.merchant_name || txn.name}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{format(parseISO(txn.date), 'MMM d')}</p>
                </div>
                <p className={`font-semibold text-sm ${txn.amount < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-900 dark:text-white'}`}>
                  {txn.amount < 0 ? '+' : '-'}{formatCurrency(Math.abs(txn.amount))}
                </p>
              </div>
            ))}
            {(!recentTxns?.transactions || recentTxns.transactions.length === 0) && (
              <p className="text-surface-500 dark:text-surface-400 text-center py-8 text-sm">No transactions yet</p>
            )}
          </div>
        </div>

        {/* Upcoming Bills */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Upcoming Bills
          </h3>
          <div className="space-y-1">
            {upcomingBills?.slice(0, 6).map((bill) => {
              const daysUntil = differenceInDays(parseISO(bill.next_due_date), new Date())
              return (
                <div key={bill.id} className="flex items-center justify-between py-2.5 border-b border-surface-100 dark:border-surface-700/50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${
                      daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <div>
                      <p className="font-medium text-surface-900 dark:text-white text-sm">{bill.name}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-sm text-surface-900 dark:text-white">
                    {formatCurrency(bill.amount)}
                  </p>
                </div>
              )
            })}
            {(!upcomingBills || upcomingBills.length === 0) && (
              <p className="text-surface-500 dark:text-surface-400 text-center py-8 text-sm">No upcoming bills</p>
            )}
          </div>
        </div>

        {/* Insights */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Spending Insights</h3>
          <div className="space-y-3">
            {insights?.slice(0, 5).map((insight, index) => (
              <div
                key={index}
                className={`p-3.5 rounded-xl ${
                  insight.type === 'increase' ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-emerald-50 dark:bg-emerald-900/10'
                }`}
              >
                <div className="flex items-start">
                  <AlertCircle className={`w-4.5 h-4.5 mr-2.5 mt-0.5 flex-shrink-0 ${
                    insight.type === 'increase' ? 'text-amber-500' : 'text-emerald-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{insight.category}</p>
                    <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">{insight.message}</p>
                  </div>
                </div>
              </div>
            ))}
            {(!insights || insights.length === 0) && (
              <p className="text-surface-500 dark:text-surface-400 text-center py-8 text-sm">No insights available yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
