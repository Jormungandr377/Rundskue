import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Calendar, DollarSign, RefreshCw, AlertCircle } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { recurring, categories as categoriesApi } from '../api'
import type { RecurringTransaction, Category } from '../types'
import { formatCurrency } from '../utils/format'

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

export default function RecurringBills() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly',
    day_of_month: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    category_id: '',
    is_income: false,
    notes: '',
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => recurring.list(),
  })

  const { data: upcoming = [] } = useQuery({
    queryKey: ['recurring', 'upcoming'],
    queryFn: () => recurring.upcoming(30),
  })

  const { data: categoryList } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof recurring.create>[0]) => recurring.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
      setShowForm(false)
      setFormData({
        name: '', amount: '', frequency: 'monthly', day_of_month: '',
        start_date: format(new Date(), 'yyyy-MM-dd'), category_id: '', is_income: false, notes: '',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => recurring.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      recurring.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      name: formData.name,
      amount: parseFloat(formData.amount),
      frequency: formData.frequency,
      day_of_month: formData.day_of_month ? parseInt(formData.day_of_month) : undefined,
      start_date: formData.start_date,
      category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
      is_income: formData.is_income,
      notes: formData.notes || undefined,
    })
  }

  const monthlyTotal = items
    .filter(i => i.is_active && !i.is_income)
    .reduce((sum, item) => {
      const multiplier = {
        weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 1/3, yearly: 1/12
      }[item.frequency] || 1
      return sum + item.amount * multiplier
    }, 0)

  const monthlyIncome = items
    .filter(i => i.is_active && i.is_income)
    .reduce((sum, item) => {
      const multiplier = {
        weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 1/3, yearly: 1/12
      }[item.frequency] || 1
      return sum + item.amount * multiplier
    }, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Bills & Subscriptions</h1>
          <p className="text-surface-500 dark:text-surface-400">
            {items.filter(i => i.is_active).length} active recurring transactions
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <DollarSign className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Monthly Bills</p>
              <p className="text-xl font-bold text-surface-900 dark:text-white">{formatCurrency(monthlyTotal)}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Monthly Income</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(monthlyIncome)}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Due in 30 days</p>
              <p className="text-xl font-bold text-surface-900 dark:text-white">{upcoming.length} bills</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Add Recurring Transaction</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Netflix, Rent, Salary"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Frequency</label>
              <select
                value={formData.frequency}
                onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 Weeks</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.day_of_month}
                onChange={e => setFormData({ ...formData, day_of_month: e.target.value })}
                placeholder="1-31 (optional)"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Category</label>
              <select
                value={formData.category_id}
                onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
              >
                <option value="">No category</option>
                {categoryList?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                id="is_income"
                checked={formData.is_income}
                onChange={e => setFormData({ ...formData, is_income: e.target.checked })}
                className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="is_income" className="text-sm text-surface-700 dark:text-surface-300">
                This is income (e.g., salary, dividends)
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Notes</label>
              <input
                type="text"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Recurring Transaction'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-600 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming Bills */}
      {upcoming.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-500" />
            Upcoming in 30 Days
          </h3>
          <div className="space-y-3">
            {upcoming.map(item => {
              const daysUntil = differenceInDays(parseISO(item.next_due_date), new Date())
              return (
                <div key={`upcoming-${item.id}`} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      daysUntil <= 3 ? 'bg-red-500' : daysUntil <= 7 ? 'bg-orange-500' : 'bg-emerald-500'
                    }`} />
                    <div>
                      <p className="font-medium text-surface-900 dark:text-white">{item.name}</p>
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil} days`}
                        {' \u00b7 '}{format(parseISO(item.next_due_date), 'MMM d')}
                      </p>
                    </div>
                  </div>
                  <p className={`font-semibold ${item.is_income ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-900 dark:text-white'}`}>
                    {item.is_income ? '+' : '-'}{formatCurrency(item.amount)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All Recurring Items */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-surface-100 dark:border-surface-700">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white">All Recurring Transactions</h3>
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <p className="text-surface-500 dark:text-surface-400">No recurring transactions yet</p>
            <p className="text-sm text-surface-400 dark:text-surface-500">Add your bills and subscriptions to track them</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {items.map(item => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-4 hover:bg-surface-50 dark:hover:bg-surface-700/50 ${
                  !item.is_active ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-surface-900 dark:text-white">{item.name}</p>
                    {item.is_income && (
                      <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                        Income
                      </span>
                    )}
                    {!item.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-surface-100 dark:bg-surface-700 text-surface-500 rounded-full">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    {FREQUENCY_LABELS[item.frequency] || item.frequency}
                    {item.category_name && ` \u00b7 ${item.category_name}`}
                    {' \u00b7 Next: '}{format(parseISO(item.next_due_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`font-semibold ${item.is_income ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-900 dark:text-white'}`}>
                    {formatCurrency(item.amount)}
                  </p>
                  <button
                    onClick={() => toggleMutation.mutate({ id: item.id, is_active: !item.is_active })}
                    className={`p-1.5 rounded-lg transition-colors ${
                      item.is_active
                        ? 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
                        : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    }`}
                    title={item.is_active ? 'Pause' : 'Resume'}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
