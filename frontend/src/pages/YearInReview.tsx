import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  ArrowLeft,
  Trophy,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import authenticatedApi from '../services/api';
import { formatCurrency } from '../utils/format';
import { useToast } from '../contexts/ToastContext';

interface YearInReviewData {
  year: number;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  average_daily_spend: number;
  top_categories: {
    category_name: string;
    amount: number;
    percentage: number;
    transaction_count: number;
  }[];
  top_merchants: {
    merchant_name: string;
    total_spent: number;
    transaction_count: number;
  }[];
  biggest_expense: {
    name: string;
    merchant_name?: string;
    amount: number;
    date: string;
    category_name?: string;
  };
  monthly_breakdown: {
    month: string;
    month_name: string;
    income: number;
    expenses: number;
    net: number;
  }[];
  best_month: {
    month_name: string;
    net_savings: number;
    income: number;
    expenses: number;
  };
  worst_month: {
    month_name: string;
    net_savings: number;
    income: number;
    expenses: number;
  };
}

export default function YearInReview() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const years = useMemo(() => {
    const result: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      result.push(y);
    }
    return result;
  }, [currentYear]);

  const { data, isLoading, isError } = useQuery<YearInReviewData>({
    queryKey: ['analytics', 'year-in-review', selectedYear],
    queryFn: async () => {
      try {
        const response = await authenticatedApi.get(`/analytics/year-in-review?year=${selectedYear}`);
        return response.data;
      } catch (err: any) {
        addToast(err?.response?.data?.detail || 'Failed to load year in review data', 'error');
        throw err;
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reports')}
            className="p-2 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            aria-label="Back to reports"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Year in Review</h1>
        </div>
        <div className="card p-6 text-center">
          <p className="text-stone-500 dark:text-stone-400">Unable to load year in review data. Please try again later.</p>
        </div>
      </div>
    );
  }

  const savingsRate = data.total_income > 0
    ? ((data.net_savings / data.total_income) * 100).toFixed(1)
    : '0.0';

  const maxCategoryAmount = data.top_categories.length > 0
    ? Math.max(...data.top_categories.map((c) => c.amount))
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reports')}
            className="p-2 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            aria-label="Back to reports"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Year in Review</h1>
            <p className="text-stone-500 dark:text-stone-400">Your financial summary for {selectedYear}</p>
          </div>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          aria-label="Select year"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Big Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500 dark:text-stone-400">Total Income</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(data.total_income)}
              </p>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500 dark:text-stone-400">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(data.total_expenses)}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500 dark:text-stone-400">Net Savings</p>
              <p className={`text-2xl font-bold ${data.net_savings >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {formatCurrency(data.net_savings)}
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{savingsRate}% savings rate</p>
            </div>
            <div className={`p-3 rounded-full ${data.net_savings >= 0 ? 'bg-teal-100 dark:bg-teal-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
              <DollarSign className={`w-6 h-6 ${data.net_savings >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-orange-600 dark:text-orange-400'}`} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500 dark:text-stone-400">Avg Daily Spend</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">
                {formatCurrency(data.average_daily_spend)}
              </p>
            </div>
            <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-full">
              <Calendar className="w-6 h-6 text-stone-600 dark:text-stone-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Top Categories + Top Merchants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Categories Bar Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Top Spending Categories</h3>
          {data.top_categories.length > 0 ? (
            <div className="space-y-3">
              {data.top_categories.slice(0, 5).map((cat, index) => (
                <div key={cat.category_name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-700 dark:text-stone-300 font-medium">
                      {index + 1}. {cat.category_name}
                    </span>
                    <span className="text-stone-900 dark:text-white font-semibold">
                      {formatCurrency(cat.amount)}
                      <span className="text-stone-400 dark:text-stone-500 font-normal ml-1">
                        ({cat.percentage}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-teal-500 dark:bg-teal-400 transition-all duration-500"
                      style={{ width: `${(cat.amount / maxCategoryAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-500 dark:text-stone-400 text-center py-8">No category data available</p>
          )}
        </div>

        {/* Top Merchants */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Top Merchants</h3>
          {data.top_merchants.length > 0 ? (
            <div className="space-y-3">
              {data.top_merchants.slice(0, 8).map((merchant, index) => (
                <div
                  key={merchant.merchant_name}
                  className="flex items-center gap-3 py-2 border-b border-stone-100 dark:border-stone-700/50 last:border-0"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    index < 3
                      ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-900 dark:text-white text-sm truncate">
                      {merchant.merchant_name}
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      {merchant.transaction_count} transaction{merchant.transaction_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="font-semibold text-stone-900 dark:text-white text-sm">
                    {formatCurrency(merchant.total_spent)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-500 dark:text-stone-400 text-center py-8">No merchant data available</p>
          )}
        </div>
      </div>

      {/* Biggest Expense */}
      {data.biggest_expense && (
        <div className="card p-6 border-l-4 border-l-orange-500 dark:border-l-orange-400">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full flex-shrink-0">
              <ShoppingCart className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Biggest Single Expense</h3>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                {formatCurrency(data.biggest_expense.amount)}
              </p>
              <p className="text-stone-700 dark:text-stone-300 mt-1 font-medium">
                {data.biggest_expense.merchant_name || data.biggest_expense.name}
              </p>
              <div className="flex items-center gap-3 mt-1 text-sm text-stone-500 dark:text-stone-400">
                <span>{new Date(data.biggest_expense.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                {data.biggest_expense.category_name && (
                  <>
                    <span className="text-stone-300 dark:text-stone-600">|</span>
                    <span>{data.biggest_expense.category_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Breakdown */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Monthly Breakdown</h3>
        {data.monthly_breakdown.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly_breakdown} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#44403c" opacity={0.2} />
                <XAxis
                  dataKey="month_name"
                  stroke="#a8a29e"
                  fontSize={12}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <YAxis
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  stroke="#a8a29e"
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    border: '1px solid #e7e5e4',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-stone-500 dark:text-stone-400 text-center py-8">No monthly data available</p>
        )}
      </div>

      {/* Best / Worst Month */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Best Month */}
        {data.best_month && (
          <div className="card p-6 border-l-4 border-l-emerald-500 dark:border-l-emerald-400">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex-shrink-0">
                <Trophy className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">Best Month</h3>
                <p className="text-xl font-bold text-stone-900 dark:text-white mt-1">{data.best_month.month_name}</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatCurrency(data.best_month.net_savings)} saved
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-stone-500 dark:text-stone-400">
                  <span>Income: {formatCurrency(data.best_month.income)}</span>
                  <span>Expenses: {formatCurrency(data.best_month.expenses)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Worst Month */}
        {data.worst_month && (
          <div className="card p-6 border-l-4 border-l-red-500 dark:border-l-red-400">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">Worst Month</h3>
                <p className="text-xl font-bold text-stone-900 dark:text-white mt-1">{data.worst_month.month_name}</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {formatCurrency(data.worst_month.net_savings)} net
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-stone-500 dark:text-stone-400">
                  <span>Income: {formatCurrency(data.worst_month.income)}</span>
                  <span>Expenses: {formatCurrency(data.worst_month.expenses)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
