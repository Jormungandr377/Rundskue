import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Camera,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import authenticatedApi from '../services/api';
import { accounts, profiles } from '../api';
import type { NetWorthSnapshot } from '../types';
import { formatCurrency } from '../utils/format';
import { useToast } from '../contexts/ToastContext';

const DATE_RANGES = [
  { label: '6 Months', value: 6 },
  { label: '1 Year', value: 12 },
  { label: '2 Years', value: 24 },
] as const;

const MILESTONES = [
  { threshold: 10_000, label: '$10K', color: 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300' },
  { threshold: 25_000, label: '$25K', color: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' },
  { threshold: 50_000, label: '$50K', color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
  { threshold: 100_000, label: '$100K', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  { threshold: 250_000, label: '$250K', color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
  { threshold: 500_000, label: '$500K', color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  { threshold: 1_000_000, label: '$1M', color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' },
];

const BREAKDOWN_COLORS: Record<string, string> = {
  checking: '#14b8a6',
  savings: '#10b981',
  investment: '#8b5cf6',
  credit: '#ef4444',
  loan: '#f97316',
  mortgage: '#ec4899',
  other: '#6366f1',
};

export default function NetWorth() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [months, setMonths] = useState<number>(12);

  // Fetch profile for profile_id context
  const { data: profileList } = useQuery({
    queryKey: ['profiles'],
    queryFn: profiles.list,
  });
  const profileId = profileList?.[0]?.id;

  // Net worth history
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['analytics', 'netWorthHistory', months],
    queryFn: () =>
      authenticatedApi
        .get<NetWorthSnapshot[]>('/analytics/net-worth-history', {
          params: { months },
        })
        .then((r) => r.data),
  });

  // Account summary for breakdown
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['accounts', 'summary'],
    queryFn: () => accounts.getSummary(),
  });

  // Snapshot mutation
  const snapshotMutation = useMutation({
    mutationFn: () =>
      authenticatedApi
        .post('/analytics/snapshot-net-worth', null, {
          params: { profile_id: profileId },
        })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'netWorthHistory'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] });
      addToast('Net worth snapshot saved!', 'success');
    },
    onError: () => {
      addToast('Failed to take snapshot', 'error');
    },
  });

  // Derived values
  const latestSnapshot = history && history.length > 0 ? history[history.length - 1] : null;
  const previousSnapshot = history && history.length > 1 ? history[history.length - 2] : null;
  const changeFromPrevious = latestSnapshot?.change_from_previous ?? (
    latestSnapshot && previousSnapshot
      ? latestSnapshot.net_worth - previousSnapshot.net_worth
      : 0
  );

  const totalAssets = summary?.total_assets ?? latestSnapshot?.total_assets ?? 0;
  const totalLiabilities = summary?.total_liabilities ?? latestSnapshot?.total_liabilities ?? 0;
  const netWorth = summary?.net_worth ?? latestSnapshot?.net_worth ?? 0;

  // Chart data
  const chartData = useMemo(() => {
    if (!history) return [];
    return history.map((snap) => ({
      date: snap.date,
      assets: snap.total_assets,
      liabilities: snap.total_liabilities,
      net_worth: snap.net_worth,
    }));
  }, [history]);

  // Milestones reached
  const achievedMilestones = useMemo(() => {
    return MILESTONES.filter((m) => netWorth >= m.threshold);
  }, [netWorth]);

  const nextMilestone = useMemo(() => {
    return MILESTONES.find((m) => netWorth < m.threshold);
  }, [netWorth]);

  // Breakdown by account type
  const accountBreakdown = useMemo(() => {
    if (!summary?.accounts_by_type) return [];
    return Object.entries(summary.accounts_by_type)
      .map(([type, data]) => ({
        type,
        balance: data.balance,
        count: data.count,
        color: BREAKDOWN_COLORS[type] || '#a8a29e',
        isLiability: ['credit', 'loan', 'mortgage'].includes(type),
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [summary]);

  const maxBalance = useMemo(() => {
    if (accountBreakdown.length === 0) return 1;
    return Math.max(...accountBreakdown.map((a) => Math.abs(a.balance)));
  }, [accountBreakdown]);

  const isLoading = historyLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Net Worth</h1>
          <p className="text-stone-500 dark:text-stone-400">Track your wealth over time</p>
        </div>
        <button
          onClick={() => snapshotMutation.mutate()}
          disabled={snapshotMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
          aria-label="Take net worth snapshot"
        >
          {snapshotMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          Take Snapshot
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500 dark:text-stone-400">Total Assets</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalAssets)}
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
              <p className="text-sm text-stone-500 dark:text-stone-400">Total Liabilities</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(totalLiabilities)}
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
              <p className="text-sm text-stone-500 dark:text-stone-400">Net Worth</p>
              <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-stone-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(netWorth)}
              </p>
            </div>
            <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-full">
              <Wallet className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500 dark:text-stone-400">Change</p>
              <p className={`text-2xl font-bold ${changeFromPrevious >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {changeFromPrevious >= 0 ? '+' : ''}{formatCurrency(changeFromPrevious)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${changeFromPrevious >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {changeFromPrevious >= 0 ? (
                <ArrowUpRight className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Net Worth History Chart */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
            Net Worth History
          </h3>
          <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 rounded-lg p-1">
            {DATE_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setMonths(range.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  months === range.value
                    ? 'bg-white dark:bg-stone-700 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 1 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="assetsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="liabilitiesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#44403c" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    try {
                      return format(parseISO(value), 'MMM yy');
                    } catch {
                      return value;
                    }
                  }}
                  stroke="#a8a29e"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  stroke="#a8a29e"
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'assets' ? 'Assets' : name === 'liabilities' ? 'Liabilities' : 'Net Worth',
                  ]}
                  labelFormatter={(label) => {
                    try {
                      return format(parseISO(label), 'MMM d, yyyy');
                    } catch {
                      return label;
                    }
                  }}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    border: '1px solid #e7e5e4',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="assets"
                  stackId="1"
                  stroke="#10b981"
                  fill="url(#assetsGradient)"
                  name="Assets"
                />
                <Area
                  type="monotone"
                  dataKey="liabilities"
                  stackId="2"
                  stroke="#ef4444"
                  fill="url(#liabilitiesGradient)"
                  name="Liabilities"
                />
                <Area
                  type="monotone"
                  dataKey="net_worth"
                  stroke="#14b8a6"
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Net Worth"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex flex-col items-center justify-center text-stone-400 dark:text-stone-500">
            <Wallet className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">Not enough data yet</p>
            <p className="text-sm mt-1">Take snapshots regularly to track your net worth over time.</p>
          </div>
        )}
      </div>

      {/* Bottom Row: Breakdown + Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Breakdown */}
        <div className="lg:col-span-2 card p-6">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">
            Breakdown by Account Type
          </h3>
          {accountBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-700">
                    <th className="text-left text-sm font-medium text-stone-500 dark:text-stone-400 pb-3">
                      Type
                    </th>
                    <th className="text-left text-sm font-medium text-stone-500 dark:text-stone-400 pb-3 hidden sm:table-cell">
                      Accounts
                    </th>
                    <th className="text-left text-sm font-medium text-stone-500 dark:text-stone-400 pb-3 w-1/3">
                      &nbsp;
                    </th>
                    <th className="text-right text-sm font-medium text-stone-500 dark:text-stone-400 pb-3">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {accountBreakdown.map((item) => (
                    <tr key={item.type}>
                      <td className="py-3">
                        <span className="font-medium text-stone-900 dark:text-white capitalize">
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3 hidden sm:table-cell">
                        <span className="text-sm text-stone-500 dark:text-stone-400">
                          {item.count}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2.5">
                          <div
                            className="h-2.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${(Math.abs(item.balance) / maxBalance) * 100}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`font-semibold ${
                            item.isLiability
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-stone-900 dark:text-white'
                          }`}
                        >
                          {item.isLiability ? '-' : ''}
                          {formatCurrency(Math.abs(item.balance))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-300 dark:border-stone-600">
                    <td className="pt-3 font-semibold text-stone-900 dark:text-white">
                      Net Worth
                    </td>
                    <td className="pt-3 hidden sm:table-cell" />
                    <td className="pt-3" />
                    <td className="pt-3 text-right">
                      <span
                        className={`font-bold text-lg ${
                          netWorth >= 0
                            ? 'text-teal-600 dark:text-teal-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatCurrency(netWorth)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-stone-500 dark:text-stone-400 text-center py-8">
              No account data available. Link your accounts to see a breakdown.
            </p>
          )}
        </div>

        {/* Milestones */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Milestones
          </h3>
          <div className="space-y-3">
            {MILESTONES.map((milestone) => {
              const isAchieved = netWorth >= milestone.threshold;
              const isNext = nextMilestone?.threshold === milestone.threshold;
              const progress = isNext
                ? Math.min((netWorth / milestone.threshold) * 100, 100)
                : isAchieved
                ? 100
                : 0;

              return (
                <div key={milestone.threshold} className="relative">
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      isAchieved
                        ? milestone.color
                        : isNext
                        ? 'bg-stone-50 dark:bg-stone-800 border border-dashed border-stone-300 dark:border-stone-600'
                        : 'bg-stone-50 dark:bg-stone-800/50 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isAchieved ? (
                        <Award className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-stone-300 dark:border-stone-600 flex-shrink-0" />
                      )}
                      <span
                        className={`font-medium text-sm ${
                          isAchieved
                            ? ''
                            : 'text-stone-500 dark:text-stone-400'
                        }`}
                      >
                        {milestone.label}
                      </span>
                    </div>
                    {isAchieved && (
                      <span className="text-xs font-medium">Reached</span>
                    )}
                    {isNext && (
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        {formatCurrency(milestone.threshold - netWorth)} to go
                      </span>
                    )}
                  </div>
                  {isNext && (
                    <div className="mt-1 w-full bg-stone-200 dark:bg-stone-700 rounded-full h-1">
                      <div
                        className="h-1 rounded-full bg-teal-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
