import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PiggyBank, Plus, Target, Calendar, DollarSign, Trash2, Check } from 'lucide-react';
import { format, parseISO, differenceInMonths } from 'date-fns';
import { goals } from '../api';
import type { SavingsGoal } from '../types';
import { useToast } from '../contexts/ToastContext';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const GOAL_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6',
];

export default function Goals() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [contributeId, setContributeId] = useState<number | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [form, setForm] = useState({
    name: '',
    target_amount: '',
    current_amount: '0',
    deadline: '',
    color: '#3b82f6',
  });

  const { data: goalsList, isLoading } = useQuery({
    queryKey: ['goals', showCompleted],
    queryFn: () => goals.list(showCompleted),
  });

  const createMutation = useMutation({
    mutationFn: goals.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowCreate(false);
      setForm({ name: '', target_amount: '', current_amount: '0', deadline: '', color: '#3b82f6' });
      addToast('Goal created!', 'success');
    },
    onError: () => addToast('Failed to create goal', 'error'),
  });

  const contributeMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => goals.contribute(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setContributeId(null);
      setContributeAmount('');
      addToast('Contribution added!', 'success');
    },
    onError: () => addToast('Failed to add contribution', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: goals.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      addToast('Goal deleted', 'success');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount) || 0,
      deadline: form.deadline || undefined,
      color: form.color,
    });
  };

  const handleContribute = (goalId: number) => {
    const amount = parseFloat(contributeAmount);
    if (amount > 0) {
      contributeMutation.mutate({ id: goalId, amount });
    }
  };

  const totalSaved = goalsList?.reduce((sum, g) => sum + g.current_amount, 0) || 0;
  const totalTarget = goalsList?.filter(g => !g.is_completed).reduce((sum, g) => sum + g.target_amount, 0) || 0;
  const activeGoals = goalsList?.filter(g => !g.is_completed) || [];
  const completedGoals = goalsList?.filter(g => g.is_completed) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Savings Goals</h1>
          <p className="text-gray-500 dark:text-gray-400">Track your progress toward financial goals</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Goal
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Goals</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeGoals.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Saved</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalSaved)}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <PiggyBank className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Remaining Target</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalTarget - totalSaved)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreate && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Goal</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Emergency Fund"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Amount</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                  placeholder="10000"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.current_amount}
                  onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date (optional)</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
              <div className="flex gap-2">
                {GOAL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-full border-2 ${form.color === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Goal
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goals Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeGoals.map((goal) => (
            <div key={goal.id} className="card p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                  {goal.deadline && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(goal.deadline), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate(goal.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label={`Delete ${goal.name} goal`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{formatCurrency(goal.current_amount)}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(goal.target_amount)}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(goal.progress_pct, 100)}%`, backgroundColor: goal.color }}
                  />
                </div>
                <p className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {goal.progress_pct}%
                </p>
              </div>

              {goal.monthly_needed && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {formatCurrency(goal.monthly_needed)}/month to reach target
                </p>
              )}

              {/* Contribute */}
              {contributeId === goal.id ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={contributeAmount}
                    onChange={(e) => setContributeAmount(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => handleContribute(goal.id)}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setContributeId(null); setContributeAmount(''); }}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setContributeId(goal.id)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  + Add Contribution
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-3"
          >
            {showCompleted ? 'Hide' : 'Show'} completed goals ({completedGoals.length})
          </button>
          {showCompleted && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedGoals.map((goal) => (
                <div key={goal.id} className="card p-6 opacity-70">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatCurrency(goal.target_amount)} reached
                    {goal.completed_at && ` on ${format(parseISO(goal.completed_at), 'MMM d, yyyy')}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeGoals.length === 0 && !isLoading && !showCreate && (
        <div className="text-center py-12">
          <PiggyBank className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No savings goals yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Create your first goal to start tracking your savings</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Goal
          </button>
        </div>
      )}
    </div>
  );
}
