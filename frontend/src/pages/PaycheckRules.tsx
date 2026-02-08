import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, DollarSign, Percent } from 'lucide-react';
import { profiles } from '../api';
import authenticatedApi from '../services/api';
import { useToast } from '../contexts/ToastContext';

interface Allocation {
  id?: number;
  target_type: string;
  target_id: number;
  amount_type: string;
  amount: number;
  priority: number;
}

interface PaycheckRule {
  id: number;
  profile_id: number;
  name: string;
  match_merchant: string;
  match_amount_min?: number;
  match_amount_max?: number;
  is_active: boolean;
  allocations: Allocation[];
}

export default function PaycheckRules() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    match_merchant: '',
    match_amount_min: '',
    match_amount_max: '',
    allocations: [{ target_type: 'goal', target_id: 0, amount_type: 'percentage', amount: '', priority: 0 }] as { target_type: string; target_id: number; amount_type: string; amount: string; priority: number }[],
  });

  const { data: profileList } = useQuery({ queryKey: ['profiles'], queryFn: profiles.list });
  const profileId = profileList?.[0]?.id ?? 0;

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['paycheck-rules'],
    queryFn: () => authenticatedApi.get<PaycheckRule[]>('/paycheck').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => authenticatedApi.post('/paycheck', data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['paycheck-rules'] }); setShowForm(false); addToast('Rule created', 'success'); },
    onError: () => addToast('Failed to create rule', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => authenticatedApi.put(`/paycheck/${id}`, data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['paycheck-rules'] }); setShowForm(false); setEditingId(null); addToast('Rule updated', 'success'); },
    onError: () => addToast('Failed to update rule', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authenticatedApi.delete(`/paycheck/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['paycheck-rules'] }); addToast('Rule deleted', 'success'); },
    onError: () => addToast('Failed to delete rule', 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      profile_id: profileId,
      name: form.name,
      match_merchant: form.match_merchant,
      match_amount_min: form.match_amount_min ? parseFloat(form.match_amount_min) : null,
      match_amount_max: form.match_amount_max ? parseFloat(form.match_amount_max) : null,
      allocations: form.allocations
        .filter(a => a.amount && Number(a.amount) > 0)
        .map(a => ({ target_type: a.target_type, target_id: a.target_id, amount_type: a.amount_type, amount: Number(a.amount), priority: a.priority })),
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const startEdit = (rule: PaycheckRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      match_merchant: rule.match_merchant,
      match_amount_min: rule.match_amount_min?.toString() || '',
      match_amount_max: rule.match_amount_max?.toString() || '',
      allocations: rule.allocations.map(a => ({
        target_type: a.target_type,
        target_id: a.target_id,
        amount_type: a.amount_type,
        amount: a.amount.toString(),
        priority: a.priority,
      })),
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({ name: '', match_merchant: '', match_amount_min: '', match_amount_max: '', allocations: [{ target_type: 'goal', target_id: 0, amount_type: 'percentage', amount: '', priority: 0 }] });
    setEditingId(null);
    setShowForm(false);
  };

  const addAllocation = () => {
    setForm(f => ({ ...f, allocations: [...f.allocations, { target_type: 'goal', target_id: 0, amount_type: 'percentage', amount: '', priority: 0 }] }));
  };

  const removeAllocation = (i: number) => {
    setForm(f => ({ ...f, allocations: f.allocations.filter((_, idx) => idx !== i) }));
  };

  const updateAllocation = (i: number, field: string, value: string | number) => {
    setForm(f => {
      const allocs = [...f.allocations];
      allocs[i] = { ...allocs[i], [field]: value };
      return { ...f, allocations: allocs };
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Paycheck Splitting</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">Auto-allocate income to envelopes, goals, and categories</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-900 dark:text-white">{editingId ? 'Edit Rule' : 'New Rule'}</h2>
            <button onClick={resetForm}><X className="w-5 h-5 text-stone-400" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Rule Name</label>
                <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white" placeholder="e.g., Biweekly Paycheck" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Match Merchant</label>
                <input type="text" required value={form.match_merchant} onChange={e => setForm(f => ({ ...f, match_merchant: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white" placeholder="e.g., DFAS" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Min Amount (optional)</label>
                <input type="number" step="0.01" value={form.match_amount_min} onChange={e => setForm(f => ({ ...f, match_amount_min: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Max Amount (optional)</label>
                <input type="number" step="0.01" value={form.match_amount_max} onChange={e => setForm(f => ({ ...f, match_amount_max: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Allocations</label>
              <div className="space-y-2">
                {form.allocations.map((alloc, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={alloc.target_type} onChange={e => updateAllocation(i, 'target_type', e.target.value)}
                      className="px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white">
                      <option value="goal">Goal</option>
                      <option value="envelope">Envelope</option>
                      <option value="category">Category</option>
                    </select>
                    <input type="number" placeholder="Target ID" value={alloc.target_id || ''} onChange={e => updateAllocation(i, 'target_id', Number(e.target.value))}
                      className="w-24 px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white" />
                    <select value={alloc.amount_type} onChange={e => updateAllocation(i, 'amount_type', e.target.value)}
                      className="px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white">
                      <option value="percentage">%</option>
                      <option value="fixed">$</option>
                    </select>
                    <div className="relative w-28">
                      <input type="number" step="0.01" placeholder="Amount" value={alloc.amount} onChange={e => updateAllocation(i, 'amount', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-stone-800 dark:border-stone-600 dark:text-white" />
                      {alloc.amount_type === 'percentage' ? (
                        <Percent className="absolute right-3 top-2.5 w-4 h-4 text-stone-400" />
                      ) : (
                        <DollarSign className="absolute right-3 top-2.5 w-4 h-4 text-stone-400" />
                      )}
                    </div>
                    {form.allocations.length > 1 && (
                      <button type="button" onClick={() => removeAllocation(i)} className="p-2 text-stone-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addAllocation} className="mt-2 text-sm text-teal-600 hover:text-teal-700">+ Add Allocation</button>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="card p-12 text-center">
          <DollarSign className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
          <p className="text-stone-500 dark:text-stone-400">No paycheck rules yet. Create one to auto-allocate income!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map(rule => (
            <div key={rule.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-stone-900 dark:text-white">{rule.name}</h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    Match: "{rule.match_merchant}"
                    {rule.match_amount_min != null && ` | Min: $${rule.match_amount_min}`}
                    {rule.match_amount_max != null && ` | Max: $${rule.match_amount_max}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => startEdit(rule)} className="p-1 text-stone-400 hover:text-stone-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => deleteMutation.mutate(rule.id)} className="p-1 text-stone-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {rule.allocations.length > 0 && (
                <div className="border-t border-stone-100 dark:border-stone-700 pt-2 mt-2">
                  <p className="text-xs text-stone-400 mb-1">Allocations:</p>
                  <div className="flex flex-wrap gap-2">
                    {rule.allocations.map((a, i) => (
                      <span key={i} className="text-xs bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-2 py-1 rounded">
                        {a.amount_type === 'percentage' ? `${a.amount}%` : `$${a.amount}`} → {a.target_type} #{a.target_id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
