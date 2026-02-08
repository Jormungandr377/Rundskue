import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, TrendingDown, DollarSign, Percent, CreditCard, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import authenticatedApi from '../services/api';
import { profiles } from '../api';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../utils/format';

// --- Types ---

interface Debt {
  id: number;
  profile_id: number;
  name: string;
  balance: number;
  interest_rate: number;
  minimum_payment: number;
  loan_type: string;
  start_date?: string;
  original_balance?: number;
}

interface PayoffPlan {
  total_months: number;
  total_interest: number;
  payoff_date: string;
  monthly_schedule?: { month: number; balance: number; interest: number; payment: number }[];
}

interface StrategyComparison {
  snowball: { total_months: number; total_interest: number };
  avalanche: { total_months: number; total_interest: number };
  months_saved: number;
  interest_saved: number;
}

interface CreditScore {
  id: number;
  score: number;
  date: string;
  notes?: string;
}

// --- Loan type labels ---

const LOAN_TYPE_LABELS: Record<string, string> = {
  mortgage: 'Mortgage',
  auto: 'Auto Loan',
  student: 'Student Loan',
  personal: 'Personal Loan',
  credit_card: 'Credit Card',
  other: 'Other',
};

const LOAN_TYPE_COLORS: Record<string, string> = {
  mortgage: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  auto: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  student: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  personal: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  credit_card: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  other: 'bg-surface-100 text-surface-700 dark:bg-surface-700 dark:text-surface-300',
};

// --- Credit score helpers ---

function getScoreRating(score: number): { label: string; color: string } {
  if (score >= 800) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
  if (score >= 740) return { label: 'Very Good', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  if (score >= 670) return { label: 'Good', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
  if (score >= 580) return { label: 'Fair', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
  return { label: 'Poor', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
}

// --- Default form state ---

const defaultDebtForm = {
  name: '',
  balance: '',
  interest_rate: '',
  minimum_payment: '',
  loan_type: 'credit_card',
  start_date: '',
  original_balance: '',
};

const defaultScoreForm = {
  score: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

// --- Component ---

export default function DebtPayoff() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtForm, setDebtForm] = useState(defaultDebtForm);
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche'>('avalanche');
  const [extraPayment, setExtraPayment] = useState(0);
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [scoreForm, setScoreForm] = useState(defaultScoreForm);

  // --- Queries ---

  const { data: profileList } = useQuery({
    queryKey: ['profiles'],
    queryFn: profiles.list,
  });
  const profileId = profileList?.[0]?.id;

  const { data: debts = [], isLoading: debtsLoading } = useQuery({
    queryKey: ['debts'],
    queryFn: () => authenticatedApi.get<Debt[]>('/debt').then(r => r.data),
  });

  const { data: payoffPlan } = useQuery({
    queryKey: ['debt-payoff-plan', strategy, extraPayment],
    queryFn: () =>
      authenticatedApi
        .get<PayoffPlan>('/debt/payoff-plan', {
          params: { strategy, extra_payment: extraPayment },
        })
        .then(r => r.data),
    enabled: debts.length > 0,
  });

  const { data: comparison } = useQuery({
    queryKey: ['debt-comparison', extraPayment],
    queryFn: () =>
      authenticatedApi
        .get<StrategyComparison>('/debt/comparison', {
          params: { extra_payment: extraPayment },
        })
        .then(r => r.data),
    enabled: debts.length > 0,
  });

  const { data: latestScore } = useQuery({
    queryKey: ['credit-score-latest'],
    queryFn: () =>
      authenticatedApi.get<CreditScore>('/credit-score/latest').then(r => r.data),
  });

  const { data: scoreHistory = [] } = useQuery({
    queryKey: ['credit-score-history'],
    queryFn: () =>
      authenticatedApi
        .get<{ entries: CreditScore[] }>('/credit-score/history', { params: { limit: 50 } })
        .then(r => r.data.entries),
  });

  // --- Mutations ---

  const createDebtMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      authenticatedApi.post('/debt', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payoff-plan'] });
      queryClient.invalidateQueries({ queryKey: ['debt-comparison'] });
      resetDebtForm();
      addToast('Debt added successfully', 'success');
    },
    onError: () => addToast('Failed to add debt', 'error'),
  });

  const updateDebtMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      authenticatedApi.put(`/debt/${id}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payoff-plan'] });
      queryClient.invalidateQueries({ queryKey: ['debt-comparison'] });
      resetDebtForm();
      addToast('Debt updated successfully', 'success');
    },
    onError: () => addToast('Failed to update debt', 'error'),
  });

  const deleteDebtMutation = useMutation({
    mutationFn: (id: number) => authenticatedApi.delete(`/debt/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payoff-plan'] });
      queryClient.invalidateQueries({ queryKey: ['debt-comparison'] });
      addToast('Debt deleted', 'success');
    },
    onError: () => addToast('Failed to delete debt', 'error'),
  });

  const createScoreMutation = useMutation({
    mutationFn: (data: { score: number; date: string; notes?: string }) =>
      authenticatedApi.post('/credit-score', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-score-latest'] });
      queryClient.invalidateQueries({ queryKey: ['credit-score-history'] });
      setShowScoreForm(false);
      setScoreForm(defaultScoreForm);
      addToast('Credit score recorded', 'success');
    },
    onError: () => addToast('Failed to record credit score', 'error'),
  });

  // --- Handlers ---

  function resetDebtForm() {
    setShowForm(false);
    setEditingDebt(null);
    setDebtForm(defaultDebtForm);
  }

  function handleEditDebt(debt: Debt) {
    setEditingDebt(debt);
    setDebtForm({
      name: debt.name,
      balance: String(debt.balance),
      interest_rate: String(debt.interest_rate),
      minimum_payment: String(debt.minimum_payment),
      loan_type: debt.loan_type,
      start_date: debt.start_date || '',
      original_balance: debt.original_balance ? String(debt.original_balance) : '',
    });
    setShowForm(true);
  }

  function handleDebtSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      name: debtForm.name,
      balance: parseFloat(debtForm.balance),
      interest_rate: parseFloat(debtForm.interest_rate),
      minimum_payment: parseFloat(debtForm.minimum_payment),
      loan_type: debtForm.loan_type,
      ...(debtForm.start_date ? { start_date: debtForm.start_date } : {}),
      ...(debtForm.original_balance ? { original_balance: parseFloat(debtForm.original_balance) } : {}),
    };
    if (!editingDebt && profileId) {
      payload.profile_id = profileId;
    }
    if (editingDebt) {
      updateDebtMutation.mutate({ id: editingDebt.id, data: payload });
    } else {
      createDebtMutation.mutate(payload);
    }
  }

  function handleScoreSubmit(e: React.FormEvent) {
    e.preventDefault();
    createScoreMutation.mutate({
      score: parseInt(scoreForm.score),
      date: scoreForm.date,
      notes: scoreForm.notes || undefined,
    });
  }

  // --- Computed ---

  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinPayment = debts.reduce((sum, d) => sum + d.minimum_payment, 0);
  const avgRate = debts.length > 0
    ? debts.reduce((sum, d) => sum + d.interest_rate, 0) / debts.length
    : 0;

  const scoreChartData = [...scoreHistory]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(s => ({
      date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      score: s.score,
    }));

  // --- Render ---

  if (debtsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Debt Payoff Planner</h1>
          <p className="text-surface-500 dark:text-surface-400">Track debts and plan your payoff strategy</p>
        </div>
        <button
          onClick={() => {
            resetDebtForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Debt
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <DollarSign className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Total Debt</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{formatCurrency(totalDebt)}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <CreditCard className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Minimum Payments</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{formatCurrency(totalMinPayment)}/mo</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full">
              <Percent className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Avg Interest Rate</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{avgRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Debt Form */}
      {showForm && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
              {editingDebt ? 'Edit Debt' : 'Add New Debt'}
            </h3>
            <button
              onClick={resetDebtForm}
              className="p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
              aria-label="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleDebtSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Name</label>
              <input
                type="text"
                required
                value={debtForm.name}
                onChange={e => setDebtForm({ ...debtForm, name: e.target.value })}
                placeholder="e.g., Chase Visa, Student Loan"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Current Balance</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={debtForm.balance}
                onChange={e => setDebtForm({ ...debtForm, balance: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Interest Rate (APR %)</label>
              <input
                type="number"
                required
                min="0"
                max="100"
                step="0.01"
                value={debtForm.interest_rate}
                onChange={e => setDebtForm({ ...debtForm, interest_rate: e.target.value })}
                placeholder="18.99"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Minimum Payment</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={debtForm.minimum_payment}
                onChange={e => setDebtForm({ ...debtForm, minimum_payment: e.target.value })}
                placeholder="50.00"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Loan Type</label>
              <select
                value={debtForm.loan_type}
                onChange={e => setDebtForm({ ...debtForm, loan_type: e.target.value })}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="mortgage">Mortgage</option>
                <option value="auto">Auto Loan</option>
                <option value="student">Student Loan</option>
                <option value="personal">Personal Loan</option>
                <option value="credit_card">Credit Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Start Date (optional)</label>
              <input
                type="date"
                value={debtForm.start_date}
                onChange={e => setDebtForm({ ...debtForm, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Original Balance (optional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={debtForm.original_balance}
                onChange={e => setDebtForm({ ...debtForm, original_balance: e.target.value })}
                placeholder="Used to show payoff progress"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={createDebtMutation.isPending || updateDebtMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {(createDebtMutation.isPending || updateDebtMutation.isPending)
                  ? 'Saving...'
                  : editingDebt
                    ? 'Update Debt'
                    : 'Add Debt'}
              </button>
              <button
                type="button"
                onClick={resetDebtForm}
                className="px-4 py-2 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-600 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Debt Cards */}
      {debts.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 text-surface-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-2">No debts tracked yet</h3>
          <p className="text-surface-500 dark:text-surface-400 mb-4">Add your debts to start planning your payoff strategy</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Add Your First Debt
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {debts.map(debt => {
            const paidOff = debt.original_balance
              ? Math.min(((debt.original_balance - debt.balance) / debt.original_balance) * 100, 100)
              : null;

            return (
              <div key={debt.id} className="card p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-surface-900 dark:text-white">{debt.name}</h3>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${LOAN_TYPE_COLORS[debt.loan_type] || LOAN_TYPE_COLORS.other}`}>
                      {LOAN_TYPE_LABELS[debt.loan_type] || debt.loan_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditDebt(debt)}
                      className="p-1.5 text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      aria-label={`Edit ${debt.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteDebtMutation.mutate(debt.id)}
                      className="p-1.5 text-surface-400 hover:text-red-500 transition-colors"
                      aria-label={`Delete ${debt.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">Balance</span>
                    <span className="font-semibold text-surface-900 dark:text-white">{formatCurrency(debt.balance)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">Interest Rate</span>
                    <span className="text-surface-900 dark:text-white">{debt.interest_rate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">Min Payment</span>
                    <span className="text-surface-900 dark:text-white">{formatCurrency(debt.minimum_payment)}/mo</span>
                  </div>
                </div>

                {/* Progress bar (if original_balance set) */}
                {paidOff !== null && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-500 dark:text-surface-400">Payoff Progress</span>
                      <span className="font-medium text-primary-600 dark:text-primary-400">{paidOff.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full bg-primary-600 dark:bg-primary-500 transition-all duration-500"
                        style={{ width: `${paidOff}%` }}
                      />
                    </div>
                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                      {formatCurrency(debt.original_balance! - debt.balance)} of {formatCurrency(debt.original_balance!)} paid
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payoff Strategy Section */}
      {debts.length > 0 && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              Payoff Strategy
            </h3>

            {/* Strategy Toggle */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex gap-2">
                <button
                  onClick={() => setStrategy('snowball')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    strategy === 'snowball'
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                  }`}
                >
                  Snowball
                </button>
                <button
                  onClick={() => setStrategy('avalanche')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    strategy === 'avalanche'
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                  }`}
                >
                  Avalanche
                </button>
              </div>
              <p className="text-sm text-surface-500 dark:text-surface-400 self-center">
                {strategy === 'snowball'
                  ? 'Pay smallest balance first for quick wins'
                  : 'Pay highest interest rate first to save money'}
              </p>
            </div>

            {/* Extra Payment Slider */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Extra Monthly Payment: <span className="text-primary-600 dark:text-primary-400 font-bold">{formatCurrency(extraPayment)}</span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="25"
                  value={extraPayment}
                  onChange={e => setExtraPayment(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <input
                  type="number"
                  min="0"
                  step="25"
                  value={extraPayment}
                  onChange={e => setExtraPayment(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 px-3 py-1.5 text-sm border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Payoff Plan Results */}
            {payoffPlan && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 text-center">
                  <p className="text-sm text-surface-500 dark:text-surface-400">Time to Payoff</p>
                  <p className="text-2xl font-bold text-surface-900 dark:text-white">
                    {payoffPlan.total_months} <span className="text-base font-normal">months</span>
                  </p>
                  <p className="text-xs text-surface-400 dark:text-surface-500">
                    ({(payoffPlan.total_months / 12).toFixed(1)} years)
                  </p>
                </div>
                <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 text-center">
                  <p className="text-sm text-surface-500 dark:text-surface-400">Total Interest</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(payoffPlan.total_interest)}
                  </p>
                </div>
                <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 text-center">
                  <p className="text-sm text-surface-500 dark:text-surface-400">Debt-Free Date</p>
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {new Date(payoffPlan.payoff_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Strategy Comparison */}
          {comparison && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Strategy Comparison
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className={`rounded-lg p-4 border-2 transition-colors ${
                  strategy === 'snowball'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800'
                }`}>
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">Snowball (Smallest First)</p>
                  <p className="text-lg font-bold text-surface-900 dark:text-white">
                    {comparison.snowball.total_months} months
                  </p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    {formatCurrency(comparison.snowball.total_interest)} in interest
                  </p>
                </div>
                <div className={`rounded-lg p-4 border-2 transition-colors ${
                  strategy === 'avalanche'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800'
                }`}>
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">Avalanche (Highest Rate First)</p>
                  <p className="text-lg font-bold text-surface-900 dark:text-white">
                    {comparison.avalanche.total_months} months
                  </p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    {formatCurrency(comparison.avalanche.total_interest)} in interest
                  </p>
                </div>
              </div>

              {(comparison.months_saved > 0 || comparison.interest_saved > 0) && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    Avalanche saves you{' '}
                    {comparison.months_saved > 0 && (
                      <span className="font-bold">{comparison.months_saved} month{comparison.months_saved !== 1 ? 's' : ''}</span>
                    )}
                    {comparison.months_saved > 0 && comparison.interest_saved > 0 && ' and '}
                    {comparison.interest_saved > 0 && (
                      <span className="font-bold">{formatCurrency(comparison.interest_saved)}</span>
                    )}
                    {' '}compared to Snowball
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Credit Score Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Credit Score
          </h3>
          <button
            onClick={() => setShowScoreForm(!showScoreForm)}
            className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {showScoreForm ? 'Cancel' : 'Log Score'}
          </button>
        </div>

        {/* Latest Score */}
        {latestScore && (
          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-surface-900 dark:text-white">{latestScore.score}</p>
              <span className={`inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${getScoreRating(latestScore.score).color}`}>
                {getScoreRating(latestScore.score).label}
              </span>
            </div>
            <div className="text-sm text-surface-500 dark:text-surface-400">
              <p>Last updated: {new Date(latestScore.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              {latestScore.notes && <p className="mt-1 italic">{latestScore.notes}</p>}
            </div>
          </div>
        )}

        {!latestScore && !showScoreForm && (
          <p className="text-surface-500 dark:text-surface-400 text-sm mb-4">No credit score recorded yet. Log your first score to start tracking.</p>
        )}

        {/* Score Entry Form */}
        {showScoreForm && (
          <form onSubmit={handleScoreSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Score</label>
              <input
                type="number"
                required
                min="300"
                max="850"
                value={scoreForm.score}
                onChange={e => setScoreForm({ ...scoreForm, score: e.target.value })}
                placeholder="300-850"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Date</label>
              <input
                type="date"
                required
                value={scoreForm.date}
                onChange={e => setScoreForm({ ...scoreForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={scoreForm.notes}
                onChange={e => setScoreForm({ ...scoreForm, notes: e.target.value })}
                placeholder="e.g., from Experian"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={createScoreMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {createScoreMutation.isPending ? 'Saving...' : 'Save Score'}
              </button>
            </div>
          </form>
        )}

        {/* Score History Chart */}
        {scoreChartData.length > 1 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Score History</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scoreChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-200 dark:text-surface-700" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="currentColor"
                  className="text-surface-400 dark:text-surface-500"
                />
                <YAxis
                  domain={[300, 850]}
                  tick={{ fontSize: 12 }}
                  stroke="currentColor"
                  className="text-surface-400 dark:text-surface-500"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #ffffff)',
                    border: '1px solid var(--tooltip-border, #e2e8f0)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
