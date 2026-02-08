import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PiggyBank,
  Wallet,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Target,
} from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { spendingControls, categories, profiles, goals } from '../api';
import type { SpendingControl, Category, SavingsGoal } from '../types';
import { formatCurrency } from '../utils/format';
import { useToast } from '../contexts/ToastContext';

type Methodology = 'budget' | 'envelope' | 'savings_rule';

const METHODOLOGY_CONFIG: Record<Methodology, { label: string; description: string; icon: typeof PiggyBank }> = {
  budget: {
    label: 'Traditional Budget',
    description: 'Monthly category-based spending limits',
    icon: PiggyBank,
  },
  envelope: {
    label: 'Envelope Budget',
    description: 'Zero-based allocation — give every dollar a job',
    icon: Wallet,
  },
  savings_rule: {
    label: 'Savings Rules',
    description: 'Automated savings with round-ups, percentages, or fixed amounts',
    icon: TrendingDown,
  },
};

const COLORS = ['#3b82f6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function SpendingControlPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [methodology, setMethodology] = useState<Methodology>('budget');
  const [showCreate, setShowCreate] = useState(false);
  const [editingControl, setEditingControl] = useState<SpendingControl | null>(null);
  const [showMigrate, setShowMigrate] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: profileList } = useQuery({ queryKey: ['profiles'], queryFn: profiles.list });
  const profileId = profileList?.[0]?.id ?? 0;

  const { data: controlList = [], isLoading } = useQuery({
    queryKey: ['spending-controls', profileId, methodology],
    queryFn: () => spendingControls.list({ profile_id: profileId, methodology, include_stats: true }),
    enabled: profileId > 0,
  });

  const { data: summary } = useQuery({
    queryKey: ['spending-controls-summary', profileId, methodology],
    queryFn: () => spendingControls.summary({ profile_id: profileId, methodology }),
    enabled: profileId > 0,
  });

  const { data: categoryList = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categories.list,
  });

  const { data: goalList = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goals.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => spendingControls.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spending-controls'] });
      queryClient.invalidateQueries({ queryKey: ['spending-controls-summary'] });
      addToast('Spending control deleted', 'success');
    },
    onError: () => addToast('Failed to delete', 'error'),
  });

  const migrateMutation = useMutation({
    mutationFn: (sourceType: 'budget' | 'envelope' | 'savings_rule') =>
      spendingControls.migrate(sourceType, profileId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['spending-controls'] });
      queryClient.invalidateQueries({ queryKey: ['spending-controls-summary'] });
      addToast(`Migrated ${data.count} items`, 'success');
      setShowMigrate(false);
    },
    onError: () => addToast('Migration failed', 'error'),
  });

  const handleEdit = (control: SpendingControl) => {
    setEditingControl(control);
    setShowCreate(true);
  };

  const handleFormClose = () => {
    setShowCreate(false);
    setEditingControl(null);
  };

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['spending-controls'] });
    queryClient.invalidateQueries({ queryKey: ['spending-controls-summary'] });
    handleFormClose();
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Spending Control</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm">
            Manage budgets, envelopes, and savings rules in one place
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMigrate(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-surface-600 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 rounded-xl hover:bg-surface-200 dark:hover:bg-surface-700"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Migrate
          </button>
          <button
            onClick={() => { setShowCreate(true); setEditingControl(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>

      {/* Methodology Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {(Object.entries(METHODOLOGY_CONFIG) as [Methodology, typeof METHODOLOGY_CONFIG[Methodology]][]).map(
          ([key, config]) => {
            const Icon = config.icon;
            const isActive = methodology === key;
            return (
              <button
                key={key}
                onClick={() => setMethodology(key)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  isActive
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-surface-900 dark:text-white'}`}>
                    {config.label}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">{config.description}</p>
                </div>
              </button>
            );
          }
        )}
      </div>

      {/* Month Navigation for Budgets */}
      {methodology === 'budget' && (
        <div className="flex items-center justify-center gap-4 mb-6">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
          </button>
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white w-48 text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg">
            <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-300" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-sm text-surface-500 dark:text-surface-400">Allocated</p>
            <p className="text-xl font-bold text-surface-900 dark:text-white">{formatCurrency(summary.total_allocated)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-surface-500 dark:text-surface-400">Spent</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary.total_spent)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-surface-500 dark:text-surface-400">Remaining</p>
            <p className={`text-xl font-bold ${summary.total_remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.total_remaining)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-surface-500 dark:text-surface-400">Active</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-surface-900 dark:text-white">{summary.active_count}</p>
              {summary.over_budget_count > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  {summary.over_budget_count} over
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : controlList.length === 0 ? (
        <EmptyState methodology={methodology} onCreateClick={() => { setShowCreate(true); setEditingControl(null); }} />
      ) : (
        /* Control List */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {controlList.map((control) => (
            <ControlCard
              key={control.id}
              control={control}
              methodology={methodology}
              onEdit={handleEdit}
              onDelete={(id) => {
                if (confirm('Delete this spending control?')) deleteMutation.mutate(id);
              }}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <ControlFormModal
          methodology={methodology}
          profileId={profileId}
          control={editingControl}
          categories={categoryList}
          goals={goalList}
          currentMonth={currentMonth}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Migrate Modal */}
      {showMigrate && (
        <MigrateModal
          onMigrate={(type) => migrateMutation.mutate(type)}
          onClose={() => setShowMigrate(false)}
          isLoading={migrateMutation.isPending}
        />
      )}
    </div>
  );
}


// ─── Control Card ─────────────────────────────────────────────

function ControlCard({
  control,
  methodology,
  onEdit,
  onDelete,
}: {
  control: SpendingControl;
  methodology: Methodology;
  onEdit: (c: SpendingControl) => void;
  onDelete: (id: number) => void;
}) {
  const spent = control.spent ?? 0;
  const amount = control.amount || 0;
  const utilization = control.utilization ?? (amount > 0 ? (spent / amount) * 100 : 0);
  const isOver = utilization > 100;
  const remaining = control.remaining ?? amount - spent;

  if (methodology === 'savings_rule') {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-500" />
            <h3 className="font-semibold text-surface-900 dark:text-white text-sm">{control.name}</h3>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(control)} className="p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => onDelete(control.id)} className="p-1 text-surface-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-surface-500 dark:text-surface-400">Type</span>
            <span className="text-surface-900 dark:text-white capitalize">{(control.rule_type || '').replace('_', ' ')}</span>
          </div>
          {control.rule_type === 'round_up' && (
            <div className="flex justify-between text-sm">
              <span className="text-surface-500 dark:text-surface-400">Round up to</span>
              <span className="text-surface-900 dark:text-white">${control.round_up_to}</span>
            </div>
          )}
          {control.rule_type === 'percentage' && (
            <div className="flex justify-between text-sm">
              <span className="text-surface-500 dark:text-surface-400">Percentage</span>
              <span className="text-surface-900 dark:text-white">{control.percentage}%</span>
            </div>
          )}
          {control.rule_type === 'fixed_schedule' && (
            <div className="flex justify-between text-sm">
              <span className="text-surface-500 dark:text-surface-400">Amount</span>
              <span className="text-surface-900 dark:text-white">{formatCurrency(control.amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-surface-500 dark:text-surface-400">Total Saved</span>
            <span className="text-green-600 font-medium">{formatCurrency(control.total_saved)}</span>
          </div>
          {!control.is_active && (
            <span className="inline-block text-xs bg-surface-100 dark:bg-surface-800 text-surface-500 px-2 py-0.5 rounded-full">Paused</span>
          )}
        </div>
      </div>
    );
  }

  // Budget / Envelope card
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {methodology === 'envelope' && (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: control.color }} />
          )}
          <h3 className="font-semibold text-surface-900 dark:text-white text-sm">{control.name}</h3>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(control)} className="p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => onDelete(control.id)} className="p-1 text-surface-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-surface-500 dark:text-surface-400">Spent</span>
          <span className={isOver ? 'text-red-600 font-medium' : 'text-surface-900 dark:text-white'}>
            {formatCurrency(spent)}
          </span>
        </div>
        <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              isOver ? 'bg-red-500' : utilization > 80 ? 'bg-yellow-500' : 'bg-primary-500'
            }`}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-surface-500 dark:text-surface-400">of {formatCurrency(amount)}</span>
          <span className={`font-medium ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(remaining)} left
          </span>
        </div>
        {control.rollover_amount > 0 && (
          <p className="text-xs text-primary-600">+{formatCurrency(control.rollover_amount)} rollover</p>
        )}
        {!control.is_active && (
          <span className="inline-block text-xs bg-surface-100 dark:bg-surface-800 text-surface-500 px-2 py-0.5 rounded-full">Inactive</span>
        )}
      </div>
    </div>
  );
}


// ─── Empty State ──────────────────────────────────────────────

function EmptyState({ methodology, onCreateClick }: { methodology: Methodology; onCreateClick: () => void }) {
  const config = METHODOLOGY_CONFIG[methodology];
  const Icon = config.icon;

  return (
    <div className="card p-12 text-center">
      <Icon className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-2">
        No {config.label.toLowerCase()} controls yet
      </h3>
      <p className="text-surface-500 dark:text-surface-400 mb-4 text-sm">
        {config.description}. Create your first one to get started.
      </p>
      <button onClick={onCreateClick} className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700">
        <Plus className="w-5 h-5 mr-2" />
        Create {config.label}
      </button>
    </div>
  );
}


// ─── Form Modal ───────────────────────────────────────────────

function ControlFormModal({
  methodology,
  profileId,
  control,
  categories,
  goals,
  currentMonth,
  onClose,
  onSuccess,
}: {
  methodology: Methodology;
  profileId: number;
  control: SpendingControl | null;
  categories: Category[];
  goals: SavingsGoal[];
  currentMonth: Date;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { addToast } = useToast();
  const isEdit = !!control;

  const [form, setForm] = useState({
    name: control?.name || '',
    amount: control?.amount?.toString() || '',
    category_id: control?.category_id?.toString() || '',
    period: control?.period || 'monthly',
    is_template: control?.is_template || false,
    rollover_amount: control?.rollover_amount?.toString() || '0',
    alert_threshold_pct: control?.alert_threshold_pct?.toString() || '80',
    color: control?.color || '#3b82f6',
    icon: control?.icon || 'wallet',
    goal_id: control?.goal_id?.toString() || '',
    rule_type: control?.rule_type || 'round_up',
    round_up_to: control?.round_up_to?.toString() || '1',
    percentage: control?.percentage?.toString() || '10',
    frequency: control?.frequency || 'monthly',
    notes: control?.notes || '',
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<SpendingControl>) => spendingControls.create(data),
    onSuccess: () => {
      addToast(`${METHODOLOGY_CONFIG[methodology].label} created`, 'success');
      onSuccess();
    },
    onError: () => addToast('Failed to create', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SpendingControl> }) => spendingControls.update(id, data),
    onSuccess: () => {
      addToast(`${METHODOLOGY_CONFIG[methodology].label} updated`, 'success');
      onSuccess();
    },
    onError: () => addToast('Failed to update', 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Record<string, unknown> = {
      profile_id: profileId,
      name: form.name,
      methodology,
      amount: parseFloat(form.amount) || 0,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      period: form.period,
      notes: form.notes || null,
    };

    if (methodology === 'budget') {
      payload.month = format(currentMonth, 'yyyy-MM-01');
      payload.is_template = form.is_template;
      payload.rollover_amount = parseFloat(form.rollover_amount) || 0;
      payload.alert_threshold_pct = parseInt(form.alert_threshold_pct) || 80;
    }

    if (methodology === 'envelope') {
      payload.color = form.color;
      payload.icon = form.icon;
    }

    if (methodology === 'savings_rule') {
      payload.rule_type = form.rule_type;
      payload.goal_id = form.goal_id ? parseInt(form.goal_id) : null;
      if (form.rule_type === 'round_up') payload.round_up_to = parseInt(form.round_up_to) || 1;
      if (form.rule_type === 'percentage') payload.percentage = parseFloat(form.percentage) || 0;
      if (form.rule_type === 'fixed_schedule') payload.frequency = form.frequency;
    }

    if (isEdit && control) {
      updateMutation.mutate({ id: control.id, data: payload as Partial<SpendingControl> });
    } else {
      createMutation.mutate(payload as Partial<SpendingControl>);
    }
  };

  const expenseCategories = categories.filter(c => !c.is_income);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-900 rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-surface-200 dark:border-surface-700">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
            {isEdit ? 'Edit' : 'New'} {METHODOLOGY_CONFIG[methodology].label}
          </h3>
          <button onClick={onClose} className="p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-800 dark:text-white"
              placeholder={methodology === 'budget' ? 'e.g., Groceries' : methodology === 'envelope' ? 'e.g., Dining Out' : 'e.g., Round-up Savings'}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              {methodology === 'savings_rule' && form.rule_type !== 'fixed_schedule' ? 'Target Amount' : 'Amount'}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required={methodology !== 'savings_rule' || form.rule_type === 'fixed_schedule'}
              value={form.amount}
              onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-800 dark:text-white"
              placeholder="0.00"
            />
          </div>

          {/* Category (budget & envelope) */}
          {methodology !== 'savings_rule' && (
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Category</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-800 dark:text-white"
              >
                <option value="">All Categories</option>
                {expenseCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Budget-specific fields */}
          {methodology === 'budget' && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Alert Threshold (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.alert_threshold_pct}
                  onChange={(e) => setForm(f => ({ ...f, alert_threshold_pct: e.target.value }))}
                  className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-800 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_template"
                  checked={form.is_template}
                  onChange={(e) => setForm(f => ({ ...f, is_template: e.target.checked }))}
                  className="rounded border-surface-300 text-primary-600"
                />
                <label htmlFor="is_template" className="text-sm text-surface-700 dark:text-surface-300">
                  Save as template for future months
                </label>
              </div>
            </>
          )}

          {/* Envelope-specific fields */}
          {methodology === 'envelope' && (
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      form.color === c ? 'border-surface-900 dark:border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Savings Rule-specific fields */}
          {methodology === 'savings_rule' && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Rule Type</label>
                <select
                  value={form.rule_type}
                  onChange={(e) => setForm(f => ({ ...f, rule_type: e.target.value as 'round_up' | 'percentage' | 'fixed_schedule' }))}
                  className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-800 dark:text-white"
                >
                  <option value="round_up">Round Up</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed_schedule">Fixed Schedule</option>
                </select>
              </div>

              {form.rule_type === 'round_up' && (
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Round up to nearest ($)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.round_up_to}
                    onChange={(e) => setForm(f => ({ ...f, round_up_to: e.target.value }))}
                    className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-800 dark:text-white"
                  />
                </div>
              )}

              {form.rule_type === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.percentage}
                    onChange={(e) => setForm(f => ({ ...f, percentage: e.target.value }))}
                    className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-800 dark:text-white"
                  />
                </div>
              )}

              {form.rule_type === 'fixed_schedule' && (
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Frequency</label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm(f => ({ ...f, frequency: e.target.value as 'weekly' | 'monthly' }))}
                    className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-800 dark:text-white"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Target Goal</label>
                <select
                  value={form.goal_id}
                  onChange={(e) => setForm(f => ({ ...f, goal_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-800 dark:text-white"
                >
                  <option value="">No goal</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-800 dark:text-white"
              placeholder="Optional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── Migrate Modal ────────────────────────────────────────────

function MigrateModal({
  onMigrate,
  onClose,
  isLoading,
}: {
  onMigrate: (type: 'budget' | 'envelope' | 'savings_rule') => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-surface-200 dark:border-surface-700">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Migrate Legacy Data</h3>
          <button onClick={onClose} className="p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
            Import your existing budgets, envelopes, or savings rules into the unified system. Legacy data will remain intact.
          </p>
          {([
            { type: 'budget' as const, label: 'Budgets', icon: PiggyBank },
            { type: 'envelope' as const, label: 'Envelopes', icon: Wallet },
            { type: 'savings_rule' as const, label: 'Savings Rules', icon: TrendingDown },
          ]).map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => onMigrate(type)}
              disabled={isLoading}
              className="flex items-center gap-3 w-full p-3 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors disabled:opacity-50"
            >
              <Icon className="w-5 h-5 text-primary-500" />
              <span className="text-sm font-medium text-surface-900 dark:text-white">Migrate {label}</span>
              <ArrowRightLeft className="w-4 h-4 text-surface-400 ml-auto" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
