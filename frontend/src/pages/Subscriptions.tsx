import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Trash2, Search, AlertTriangle, X } from 'lucide-react';
import { subscriptions, profiles } from '../api';
import { formatCurrency } from '../utils/format';
import { useToast } from '../contexts/ToastContext';
import type { SubscriptionItem } from '../types';

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export default function SubscriptionsPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', frequency: 'monthly', merchant_name: '', notes: '' });

  const { data: profileList } = useQuery({ queryKey: ['profiles'], queryFn: profiles.list });
  const profileId = profileList?.[0]?.id ?? 0;

  const { data: subList = [], isLoading } = useQuery({
    queryKey: ['subscriptions', profileId],
    queryFn: () => subscriptions.list(profileId, false),
    enabled: profileId > 0,
  });

  const { data: summary } = useQuery({
    queryKey: ['subscriptions-summary', profileId],
    queryFn: () => subscriptions.summary(profileId),
    enabled: profileId > 0,
  });

  const createMutation = useMutation({
    mutationFn: (data: { profile_id: number; name: string; amount: number; frequency: string; merchant_name?: string; notes?: string }) =>
      subscriptions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-summary'] });
      setShowCreate(false);
      setForm({ name: '', amount: '', frequency: 'monthly', merchant_name: '', notes: '' });
      addToast('Subscription added', 'success');
    },
    onError: () => addToast('Failed to add subscription', 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      subscriptions.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-summary'] });
    },
    onError: () => addToast('Failed to update subscription', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => subscriptions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-summary'] });
      addToast('Subscription deleted', 'success');
    },
    onError: () => addToast('Failed to delete subscription', 'error'),
  });

  const detectMutation = useMutation({
    mutationFn: () => subscriptions.detect(profileId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-summary'] });
      addToast(`Detected ${data.detected} subscription${data.detected !== 1 ? 's' : ''}`, 'success');
    },
    onError: () => addToast('Detection failed', 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      profile_id: profileId,
      name: form.name,
      amount: parseFloat(form.amount) || 0,
      frequency: form.frequency,
      merchant_name: form.merchant_name || undefined,
      notes: form.notes || undefined,
    });
  };

  const activeSubs = subList.filter(s => s.is_active);
  const inactiveSubs = subList.filter(s => !s.is_active);

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Subscriptions</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">Track recurring charges and find unused subscriptions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800">
            <Search className="w-4 h-4" /> {detectMutation.isPending ? 'Scanning...' : 'Auto-Detect'}
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-sm text-stone-500 dark:text-stone-400">Monthly Cost</p>
            <p className="text-xl font-bold text-stone-900 dark:text-white">{formatCurrency(summary.total_monthly_cost)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-stone-500 dark:text-stone-400">Annual Cost</p>
            <p className="text-xl font-bold text-stone-900 dark:text-white">{formatCurrency(summary.total_annual_cost)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-stone-500 dark:text-stone-400">Active</p>
            <p className="text-xl font-bold text-green-600">{summary.active_count}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-stone-500 dark:text-stone-400">Possibly Unused</p>
            <p className="text-xl font-bold text-amber-600">{summary.flagged_unused_count}</p>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-900 dark:text-white">Add Subscription</h2>
            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-stone-400" /></button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Name</label>
              <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white" placeholder="Netflix" />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Amount</label>
              <input type="number" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white" placeholder="15.99" />
            </div>
            <div className="w-36">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Frequency</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white">
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Add</button>
          </form>
        </div>
      )}

      {/* Active Subscriptions */}
      {activeSubs.length === 0 && inactiveSubs.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
          <p className="text-stone-500 dark:text-stone-400 mb-2">No subscriptions tracked yet</p>
          <p className="text-sm text-stone-400">Click "Auto-Detect" to scan your transactions for recurring charges</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeSubs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-stone-900 dark:text-white mb-3">Active ({activeSubs.length})</h2>
              <div className="card divide-y divide-stone-200 dark:divide-stone-700">
                {activeSubs.map(sub => (
                  <SubRow key={sub.id} sub={sub} onToggle={(active) => toggleMutation.mutate({ id: sub.id, is_active: active })} onDelete={() => deleteMutation.mutate(sub.id)} />
                ))}
              </div>
            </div>
          )}
          {inactiveSubs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-stone-500 dark:text-stone-400 mb-3">Inactive ({inactiveSubs.length})</h2>
              <div className="card divide-y divide-stone-200 dark:divide-stone-700 opacity-60">
                {inactiveSubs.map(sub => (
                  <SubRow key={sub.id} sub={sub} onToggle={(active) => toggleMutation.mutate({ id: sub.id, is_active: active })} onDelete={() => deleteMutation.mutate(sub.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubRow({ sub, onToggle, onDelete }: { sub: SubscriptionItem; onToggle: (active: boolean) => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <CreditCard className="w-5 h-5 text-stone-400" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-stone-900 dark:text-white">{sub.name}</span>
            {sub.is_flagged_unused && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" /> Unused?
              </span>
            )}
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {FREQ_LABELS[sub.frequency] || sub.frequency}
            {sub.last_charged && ` · Last charged ${sub.last_charged}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-semibold text-stone-900 dark:text-white">{formatCurrency(sub.amount)}</span>
        <button onClick={() => onToggle(!sub.is_active)}
          className={`text-xs px-2 py-1 rounded ${sub.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'}`}>
          {sub.is_active ? 'Active' : 'Paused'}
        </button>
        <button onClick={onDelete} className="text-stone-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
