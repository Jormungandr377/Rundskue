import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  X,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Loader2,
  Briefcase,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import authenticatedApi from '../services/api';
import { accounts } from '../api';
import { formatCurrency } from '../utils/format';
import { useToast } from '../contexts/ToastContext';
import { CHART_COLORS } from '../constants/colors';

// ---- Types ----

interface Holding {
  id: number;
  account_id: number;
  account_name?: string;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  cost_basis: number;
  asset_class: string;
  value: number;
  gain_loss: number;
  gain_loss_pct: number;
}

interface InvestmentSummary {
  total_value: number;
  total_cost_basis: number;
  total_gain_loss: number;
  total_gain_loss_pct: number;
}

interface AllocationItem {
  asset_class: string;
  value: number;
  percentage: number;
}

interface DividendMonth {
  month: string;
  amount: number;
}

interface DividendSummary {
  total_dividends: number;
  monthly: DividendMonth[];
}

interface HoldingFormData {
  account_id: string;
  symbol: string;
  name: string;
  quantity: string;
  price: string;
  cost_basis: string;
  asset_class: string;
}

const ASSET_CLASSES = [
  { value: 'stocks', label: 'Stocks' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'cash', label: 'Cash' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM: HoldingFormData = {
  account_id: '',
  symbol: '',
  name: '',
  quantity: '',
  price: '',
  cost_basis: '',
  asset_class: 'stocks',
};

type SortField = 'symbol' | 'name' | 'quantity' | 'price' | 'value' | 'cost_basis' | 'gain_loss' | 'asset_class';
type SortDir = 'asc' | 'desc';

export default function Investments() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<HoldingFormData>(EMPTY_FORM);
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ---- Queries ----

  const { data: holdingsData, isLoading: holdingsLoading } = useQuery({
    queryKey: ['investments', 'holdings'],
    queryFn: () =>
      authenticatedApi
        .get<Holding[]>('/investments/holdings')
        .then((r) => r.data),
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['investments', 'summary'],
    queryFn: () =>
      authenticatedApi
        .get<InvestmentSummary>('/investments/summary')
        .then((r) => r.data),
  });

  const { data: allocationData } = useQuery({
    queryKey: ['investments', 'allocation'],
    queryFn: () =>
      authenticatedApi
        .get<AllocationItem[]>('/investments/allocation')
        .then((r) => r.data),
  });

  const { data: dividendData } = useQuery({
    queryKey: ['investments', 'dividends'],
    queryFn: () =>
      authenticatedApi
        .get<DividendSummary>('/investments/dividends')
        .then((r) => r.data),
  });

  const { data: accountList } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accounts.list(),
  });

  // Filter to investment accounts only
  const investmentAccounts = useMemo(() => {
    return (accountList || []).filter((a) => a.account_type === 'investment');
  }, [accountList]);

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      authenticatedApi.post('/investments/holdings', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      resetForm();
      addToast('Holding added!', 'success');
    },
    onError: () => addToast('Failed to add holding', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      authenticatedApi.put(`/investments/holdings/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      resetForm();
      addToast('Holding updated!', 'success');
    },
    onError: () => addToast('Failed to update holding', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authenticatedApi.delete(`/investments/holdings/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      addToast('Holding deleted', 'success');
    },
    onError: () => addToast('Failed to delete holding', 'error'),
  });

  // ---- Handlers ----

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (holding: Holding) => {
    setForm({
      account_id: String(holding.account_id),
      symbol: holding.symbol,
      name: holding.name,
      quantity: String(holding.quantity),
      price: String(holding.price),
      cost_basis: String(holding.cost_basis),
      asset_class: holding.asset_class,
    });
    setEditingId(holding.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      account_id: parseInt(form.account_id),
      symbol: form.symbol.toUpperCase(),
      name: form.name,
      quantity: parseFloat(form.quantity),
      price: parseFloat(form.price),
      cost_basis: parseFloat(form.cost_basis),
      asset_class: form.asset_class,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // ---- Sorted holdings ----

  const sortedHoldings = useMemo(() => {
    if (!holdingsData) return [];
    return [...holdingsData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [holdingsData, sortField, sortDir]);

  // ---- Render helpers ----

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="text-left text-sm font-medium text-surface-500 dark:text-surface-400 pb-3 cursor-pointer select-none hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDir === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
        )}
      </div>
    </th>
  );

  const totalGainLoss = summaryData?.total_gain_loss ?? 0;
  const totalGainLossPct = summaryData?.total_gain_loss_pct ?? 0;
  const isLoading = holdingsLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Investment Portfolio</h1>
          <p className="text-surface-500 dark:text-surface-400">Manage your investment holdings</p>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setShowForm(true);
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          aria-label={showForm ? 'Cancel adding holding' : 'Add new holding'}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Holding'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Total Value</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">
                {formatCurrency(summaryData?.total_value ?? 0)}
              </p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full">
              <Briefcase className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Total Cost Basis</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">
                {formatCurrency(summaryData?.total_cost_basis ?? 0)}
              </p>
            </div>
            <div className="p-3 bg-surface-100 dark:bg-surface-800 rounded-full">
              <DollarSign className="w-6 h-6 text-surface-600 dark:text-surface-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Total Gain/Loss</p>
              <p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${totalGainLoss >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {totalGainLoss >= 0 ? (
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Gain/Loss %</p>
              <p className={`text-2xl font-bold ${totalGainLossPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {totalGainLossPct >= 0 ? '+' : ''}{totalGainLossPct.toFixed(2)}%
              </p>
            </div>
            <div className={`p-3 rounded-full ${totalGainLossPct >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {totalGainLossPct >= 0 ? (
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Holding Form */}
      {showForm && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            {editingId ? 'Edit Holding' : 'Add New Holding'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Account
              </label>
              <select
                value={form.account_id}
                onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                required
                className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select account...</option>
                {investmentAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.display_name || acc.name}
                    {acc.mask ? ` (****${acc.mask})` : ''}
                  </option>
                ))}
                {investmentAccounts.length === 0 && (
                  <option value="" disabled>
                    No investment accounts found
                  </option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Symbol
              </label>
              <input
                type="text"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                placeholder="e.g. AAPL"
                required
                className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Apple Inc."
                required
                className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Asset Class
              </label>
              <select
                value={form.asset_class}
                onChange={(e) => setForm({ ...form, asset_class: e.target.value })}
                required
                className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {ASSET_CLASSES.map((ac) => (
                  <option key={ac.value} value={ac.value}>
                    {ac.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Quantity
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
                required
                className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Current Price
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
                required
                className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Total Cost Basis
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cost_basis}
                onChange={(e) => setForm({ ...form, cost_basis: e.target.value })}
                placeholder="0.00"
                required
                className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : editingId ? (
                  'Update'
                ) : (
                  'Add'
                )}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Holdings Table */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Holdings</h3>
        {sortedHoldings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <SortHeader field="symbol">Symbol</SortHeader>
                  <SortHeader field="name">Name</SortHeader>
                  <SortHeader field="quantity">Qty</SortHeader>
                  <SortHeader field="price">Price</SortHeader>
                  <SortHeader field="value">Value</SortHeader>
                  <SortHeader field="cost_basis">Cost Basis</SortHeader>
                  <SortHeader field="gain_loss">Gain/Loss</SortHeader>
                  <SortHeader field="asset_class">Class</SortHeader>
                  <th className="text-right text-sm font-medium text-surface-500 dark:text-surface-400 pb-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {sortedHoldings.map((holding) => (
                  <tr
                    key={holding.id}
                    className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    <td className="py-3">
                      <span className="font-semibold text-primary-600 dark:text-primary-400">
                        {holding.symbol}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-surface-900 dark:text-white text-sm">
                        {holding.name}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-surface-700 dark:text-surface-300 text-sm">
                        {holding.quantity.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 4,
                        })}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-surface-700 dark:text-surface-300 text-sm">
                        {formatCurrency(holding.price)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="font-medium text-surface-900 dark:text-white text-sm">
                        {formatCurrency(holding.value)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-surface-700 dark:text-surface-300 text-sm">
                        {formatCurrency(holding.cost_basis)}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span
                          className={`font-medium text-sm ${
                            holding.gain_loss >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {holding.gain_loss >= 0 ? '+' : ''}
                          {formatCurrency(holding.gain_loss)}
                        </span>
                        <span
                          className={`text-xs ${
                            holding.gain_loss_pct >= 0
                              ? 'text-emerald-500 dark:text-emerald-500'
                              : 'text-red-500 dark:text-red-500'
                          }`}
                        >
                          {holding.gain_loss_pct >= 0 ? '+' : ''}
                          {holding.gain_loss_pct.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 capitalize">
                        {holding.asset_class.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(holding)}
                          className="p-1.5 text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                          aria-label={`Edit ${holding.symbol}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(holding.id)}
                          className="p-1.5 text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                          aria-label={`Delete ${holding.symbol}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Briefcase className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-2">
              No holdings yet
            </h3>
            <p className="text-surface-500 dark:text-surface-400 mb-4">
              Add your investment holdings to start tracking your portfolio.
            </p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Your First Holding
              </button>
            )}
          </div>
        )}
      </div>

      {/* Charts Row: Allocation + Dividends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Allocation Donut */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Asset Allocation
          </h3>
          {allocationData && allocationData.length > 0 ? (
            <div className="h-72 flex">
              <div className="w-3/5">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="asset_class"
                    >
                      {allocationData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg, #fff)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-2/5 flex flex-col justify-center space-y-2">
                {allocationData.map((item, index) => (
                  <div key={item.asset_class} className="flex items-center text-sm">
                    <div
                      className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                      style={{
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                    <span className="text-surface-600 dark:text-surface-400 truncate flex-1 capitalize">
                      {item.asset_class.replace('_', ' ')}
                    </span>
                    <span className="font-medium text-surface-900 dark:text-white ml-2">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-surface-400 dark:text-surface-500">
              <div className="text-center">
                <PieChartIcon className="w-10 h-10 mx-auto mb-2" />
                <p>Add holdings to see allocation</p>
              </div>
            </div>
          )}
        </div>

        {/* Dividends */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Dividends
            </h3>
            {dividendData && (
              <div className="text-right">
                <p className="text-xs text-surface-500 dark:text-surface-400">Total Income</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(dividendData.total_dividends)}
                </p>
              </div>
            )}
          </div>
          {dividendData?.monthly && dividendData.monthly.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividendData.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.2} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => {
                      try {
                        const [y, m] = value.split('-');
                        return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', {
                          month: 'short',
                        });
                      } catch {
                        return value;
                      }
                    }}
                    stroke="#94a3b8"
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={(value) => `$${value}`}
                    stroke="#94a3b8"
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Dividends']}
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg, #fff)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar
                    dataKey="amount"
                    name="Dividends"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-surface-400 dark:text-surface-500">
              <div className="text-center">
                <DollarSign className="w-10 h-10 mx-auto mb-2" />
                <p>No dividend data available</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
