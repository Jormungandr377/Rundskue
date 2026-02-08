import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Plus, Pencil, Trash2, X } from 'lucide-react';
import { envelopes, profiles } from '../api';
import { formatCurrency } from '../utils/format';
import { useToast } from '../contexts/ToastContext';
import type { Envelope } from '../types';

export default function EnvelopesPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', allocated_amount: '', color: '#3b82f6', icon: 'wallet' });

  const { data: profileList } = useQuery({ queryKey: ['profiles'], queryFn: profiles.list });
  const profileId = profileList?.[0]?.id ?? 0;

  const { data: envList = [], isLoading } = useQuery({
    queryKey: ['envelopes', profileId],
    queryFn: () => envelopes.list(profileId),
    enabled: profileId > 0,
  });

  const { data: summary } = useQuery({
    queryKey: ['envelopes-summary', profileId],
    queryFn: () => envelopes.summary(profileId),
    enabled: profileId > 0,
  });

  const createMutation = useMutation({
    mutationFn: (data: { profile_id: number; name: string; allocated_amount: number; color: string; icon: string }) =>
      envelopes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envelopes'] });
      queryClient.invalidateQueries({ queryKey: ['envelopes-summary'] });
      setShowCreate(false);
      setForm({ name: '', allocated_amount: '', color: '#3b82f6', icon: 'wallet' });
      addToast('Envelope created', 'success');
    },
    onError: () => addToast('Failed to create envelope', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Envelope> }) => envelopes.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envelopes'] });
      queryClient.invalidateQueries({ queryKey: ['envelopes-summary'] });
      setEditingId(null);
      addToast('Envelope updated', 'success');
    },
    onError: () => addToast('Failed to update envelope', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => envelopes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envelopes'] });
      queryClient.invalidateQueries({ queryKey: ['envelopes-summary'] });
      addToast('Envelope deleted', 'success');
    },
    onError: () => addToast('Failed to delete envelope', 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { name: form.name, allocated_amount: parseFloat(form.allocated_amount) || 0, color: form.color } });
    } else {
      createMutation.mutate({ profile_id: profileId, name: form.name, allocated_amount: parseFloat(form.allocated_amount) || 0, color: form.color, icon: form.icon });
    }
  };

  const startEdit = (env: Envelope) => {
    setEditingId(env.id);
    setForm({ name: env.name, allocated_amount: String(env.allocated_amount), color: env.color, icon: env.icon });
    setShowCreate(true);
  };

  const COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Envelopes</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">Zero-based budgeting — give every dollar a job</p>
        </div>
        <button onClick={() => { setShowCreate(true); setEditingId(null); setForm({ name: '', allocated_amount: '', color: '#3b82f6', icon: 'wallet' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          <Plus className="w-4 h-4" /> New Envelope
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Allocated', value: formatCurrency(summary.total_allocated), color: 'text-blue-600' },
            { label: 'Total Spent', value: formatCurrency(summary.total_spent), color: 'text-red-600' },
            { label: 'Remaining', value: formatCurrency(summary.total_remaining), color: 'text-green-600' },
            { label: 'Envelopes', value: String(summary.envelope_count), color: 'text-stone-900 dark:text-white' },
          ].map((card) => (
            <div key={card.label} className="card p-4">
              <p className="text-sm text-stone-500 dark:text-stone-400">{card.label}</p>
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreate && (
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-900 dark:text-white">{editingId ? 'Edit Envelope' : 'New Envelope'}</h2>
            <button onClick={() => { setShowCreate(false); setEditingId(null); }}><X className="w-5 h-5 text-stone-400" /></button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Name</label>
              <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white" placeholder="e.g., Groceries" />
            </div>
            <div className="w-40">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Amount</label>
              <input type="number" step="0.01" value={form.allocated_amount} onChange={e => setForm(f => ({ ...f, allocated_amount: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Color</label>
              <div className="flex gap-1">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 ${form.color === c ? 'border-stone-900 dark:border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
              {editingId ? 'Update' : 'Create'}
            </button>
          </form>
        </div>
      )}

      {/* Envelope Grid */}
      {envList.length === 0 ? (
        <div className="card p-12 text-center">
          <Wallet className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
          <p className="text-stone-500 dark:text-stone-400">No envelopes yet. Create one to start budgeting!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {envList.map(env => {
            const pct = env.allocated_amount > 0 ? Math.min((env.spent_amount / env.allocated_amount) * 100, 100) : 0;
            const isOver = env.spent_amount > env.allocated_amount;
            return (
              <div key={env.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: env.color }} />
                    <h3 className="font-semibold text-stone-900 dark:text-white">{env.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(env)} className="p-1 text-stone-400 hover:text-stone-600"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => deleteMutation.mutate(env.id)} className="p-1 text-stone-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500 dark:text-stone-400">Spent</span>
                    <span className={isOver ? 'text-red-600 font-medium' : 'text-stone-900 dark:text-white'}>{formatCurrency(env.spent_amount)}</span>
                  </div>
                  <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-teal-500'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500 dark:text-stone-400">of {formatCurrency(env.allocated_amount)}</span>
                    <span className={`font-medium ${env.remaining_amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(env.remaining_amount)} left
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">{env.transaction_count} transactions</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
