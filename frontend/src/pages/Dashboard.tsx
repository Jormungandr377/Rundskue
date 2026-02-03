import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle
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
import { format, parseISO } from 'date-fns';
import { accounts, analytics, transactions } from '../api';
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
    queryFn: () => transactions.list({ limit: 10 }),
  });

  const { data: insights } = useQuery({
    queryKey: ['analytics', 'insights'],
    queryFn: () => analytics.insights(),
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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Your financial overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Net Worth</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary?.net_worth || 0)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Assets</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary?.total_assets || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Liabilities</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(summary?.total_liabilities || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <CreditCard className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">This Month's Cash Flow</p>
              <p className={`text-2xl font-bold ${(cashFlow?.net_cash_flow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(cashFlow?.net_cash_flow || 0)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${(cashFlow?.net_cash_flow || 0) >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {(cashFlow?.net_cash_flow || 0) >= 0 ? (
                <ArrowUpRight className="w-6 h-6 text-green-600" />
              ) : (
                <ArrowDownRight className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Trend */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Income vs Expenses</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends || []}>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h3>
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
                  <span className="text-gray-600 truncate flex-1">{cat.category_name}</span>
                  <span className="font-medium">{cat.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {recentTxns?.items.slice(0, 8).map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{txn.custom_name || txn.merchant_name || txn.name}</p>
                  <p className="text-sm text-gray-500">{format(parseISO(txn.date), 'MMM d')}</p>
                </div>
                <p className={`font-semibold ${txn.amount < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {txn.amount < 0 ? '+' : '-'}{formatCurrency(Math.abs(txn.amount))}
                </p>
              </div>
            ))}
            {(!recentTxns?.items || recentTxns.items.length === 0) && (
              <p className="text-gray-500 text-center py-4">No transactions yet</p>
            )}
          </div>
        </div>

        {/* Insights */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending Insights</h3>
          <div className="space-y-3">
            {insights?.slice(0, 5).map((insight, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg ${
                  insight.type === 'increase' ? 'bg-orange-50' : 'bg-green-50'
                }`}
              >
                <div className="flex items-start">
                  <AlertCircle className={`w-5 h-5 mr-2 mt-0.5 ${
                    insight.type === 'increase' ? 'text-orange-500' : 'text-green-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{insight.category}</p>
                    <p className="text-sm text-gray-600">{insight.message}</p>
                  </div>
                </div>
              </div>
            ))}
            {(!insights || insights.length === 0) && (
              <p className="text-gray-500 text-center py-4">No insights available yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
