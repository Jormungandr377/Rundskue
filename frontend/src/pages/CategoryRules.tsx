import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wand2, Plus, Trash2, Play, Loader2 } from 'lucide-react';
import { categorization, categories } from '../api';
import type { CategoryRule } from '../types';
import { useToast } from '../contexts/ToastContext';

export default function CategoryRules() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    category_id: '',
    match_field: 'name',
    match_type: 'contains',
    match_value: '',
    priority: '0',
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['categorization-rules'],
    queryFn: categorization.listRules,
  });

  const { data: categoryList } = useQuery({
    queryKey: ['categories'],
    queryFn: categories.list,
  });

  const createMutation = useMutation({
    mutationFn: categorization.createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorization-rules'] });
      setShowCreate(false);
      setForm({ category_id: '', match_field: 'name', match_type: 'contains', match_value: '', priority: '0' });
      addToast('Rule created!', 'success');
    },
    onError: () => addToast('Failed to create rule', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: categorization.deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorization-rules'] });
      addToast('Rule deleted', 'success');
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => categorization.applyRules(true),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      addToast(`Categorized ${data.categorized} transactions (${data.skipped} skipped)`, 'success');
    },
    onError: () => addToast('Failed to apply rules', 'error'),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      category_id: parseInt(form.category_id),
      match_field: form.match_field,
      match_type: form.match_type,
      match_value: form.match_value,
      priority: parseInt(form.priority) || 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Auto-Categorization Rules</h1>
          <p className="text-gray-500 dark:text-gray-400">Automatically categorize transactions based on rules</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {applyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Apply Rules
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Rule
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Rule</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">When</label>
                <select
                  value={form.match_field}
                  onChange={(e) => setForm({ ...form, match_field: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="name">Transaction Name</option>
                  <option value="merchant_name">Merchant Name</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Match Type</label>
                <select
                  value={form.match_type}
                  onChange={(e) => setForm({ ...form, match_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="contains">Contains</option>
                  <option value="exact">Exact Match</option>
                  <option value="starts_with">Starts With</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
                <input
                  type="text"
                  required
                  value={form.match_value}
                  onChange={(e) => setForm({ ...form, match_value: e.target.value })}
                  placeholder="e.g., Starbucks"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign Category</label>
                <select
                  required
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select category...</option>
                  {categoryList?.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Rule
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : rules && rules.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">Field</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">Match Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">Value</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">Category</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">Priority</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 capitalize">
                    {rule.match_field === 'merchant_name' ? 'Merchant' : 'Name'}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 capitalize">
                    {rule.match_type.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{rule.match_value}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{rule.category_name || '-'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{rule.priority}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => deleteMutation.mutate(rule.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      aria-label={`Delete rule for ${rule.match_value}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <Wand2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No rules yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Create rules to automatically categorize your transactions</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create First Rule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
