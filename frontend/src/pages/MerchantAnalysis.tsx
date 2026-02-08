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
} from 'recharts';
import {
  Search,
  ArrowUpDown,
  ArrowLeft,
  Loader2,
  Store,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import authenticatedApi from '../services/api';
import { formatCurrency } from '../utils/format';

interface MerchantData {
  merchant_name: string;
  total_spent: number;
  transaction_count: number;
  avg_amount: number;
  first_seen: string;
  last_seen: string;
  top_category: string;
}

type SortField = 'total_spent' | 'transaction_count' | 'avg_amount';

export default function MerchantAnalysis() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('total_spent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data: merchants, isLoading, isError } = useQuery<MerchantData[]>({
    queryKey: ['analytics', 'merchant-analysis', sortBy],
    queryFn: async () => {
      const response = await authenticatedApi.get(
        `/analytics/merchant-analysis?limit=50&sort_by=${sortBy}`
      );
      return response.data;
    },
  });

  const handleSortToggle = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const filteredMerchants = useMemo(() => {
    if (!merchants) return [];
    let result = merchants;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((m) =>
        m.merchant_name.toLowerCase().includes(query)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [merchants, searchQuery, sortBy, sortDirection]);

  const top10ForChart = useMemo(() => {
    if (!merchants) return [];
    return [...merchants]
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 10)
      .reverse();
  }, [merchants]);

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (isError || !merchants) {
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
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Merchant Analysis</h1>
        </div>
        <div className="card p-6 text-center">
          <p className="text-stone-500 dark:text-stone-400">Unable to load merchant data. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/reports')}
          className="p-2 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          aria-label="Back to reports"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Merchant Analysis</h1>
          <p className="text-stone-500 dark:text-stone-400">
            {merchants.length} merchant{merchants.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
      </div>

      {/* Top 10 Merchants Bar Chart */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Top 10 Merchants by Spending</h3>
        {top10ForChart.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10ForChart} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#44403c" opacity={0.2} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  stroke="#a8a29e"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="merchant_name"
                  width={120}
                  stroke="#a8a29e"
                  fontSize={11}
                  tickFormatter={(value: string) =>
                    value.length > 16 ? value.slice(0, 14) + '...' : value
                  }
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    border: '1px solid #e7e5e4',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="total_spent" name="Total Spent" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-stone-500 dark:text-stone-400 text-center py-8">No merchant data available</p>
        )}
      </div>

      {/* Search & Sort Controls */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500" />
            <input
              type="text"
              placeholder="Search merchants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>

          {/* Sort Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">Sort by:</span>
            {([
              { field: 'total_spent' as SortField, label: 'Total' },
              { field: 'transaction_count' as SortField, label: 'Count' },
              { field: 'avg_amount' as SortField, label: 'Average' },
            ]).map((btn) => (
              <button
                key={btn.field}
                onClick={() => handleSortToggle(btn.field)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  sortBy === btn.field
                    ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {btn.label}
                {sortBy === btn.field && (
                  <ArrowUpDown className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Merchant Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-700">
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Merchant
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                  onClick={() => handleSortToggle('total_spent')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Total Spent
                    {sortBy === 'total_spent' && <ArrowUpDown className="w-3 h-3" />}
                  </span>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                  onClick={() => handleSortToggle('transaction_count')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Transactions
                    {sortBy === 'transaction_count' && <ArrowUpDown className="w-3 h-3" />}
                  </span>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors hidden md:table-cell"
                  onClick={() => handleSortToggle('avg_amount')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Avg Amount
                    {sortBy === 'avg_amount' && <ArrowUpDown className="w-3 h-3" />}
                  </span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider hidden lg:table-cell">
                  First Seen
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider hidden lg:table-cell">
                  Last Seen
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider hidden xl:table-cell">
                  Top Category
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredMerchants.length > 0 ? (
                filteredMerchants.map((merchant) => (
                  <tr
                    key={merchant.merchant_name}
                    className="hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <Store className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <span className="font-medium text-stone-900 dark:text-white text-sm truncate max-w-[200px]">
                          {merchant.merchant_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-stone-900 dark:text-white text-sm">
                      {formatCurrency(merchant.total_spent)}
                    </td>
                    <td className="px-6 py-4 text-right text-stone-600 dark:text-stone-400 text-sm">
                      {merchant.transaction_count}
                    </td>
                    <td className="px-6 py-4 text-right text-stone-600 dark:text-stone-400 text-sm hidden md:table-cell">
                      {formatCurrency(merchant.avg_amount)}
                    </td>
                    <td className="px-6 py-4 text-stone-500 dark:text-stone-400 text-sm hidden lg:table-cell">
                      {formatDate(merchant.first_seen)}
                    </td>
                    <td className="px-6 py-4 text-stone-500 dark:text-stone-400 text-sm hidden lg:table-cell">
                      {formatDate(merchant.last_seen)}
                    </td>
                    <td className="px-6 py-4 hidden xl:table-cell">
                      {merchant.top_category ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                          {merchant.top_category}
                        </span>
                      ) : (
                        <span className="text-stone-400 dark:text-stone-600 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-stone-500 dark:text-stone-400">
                    {searchQuery
                      ? `No merchants found matching "${searchQuery}"`
                      : 'No merchant data available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
