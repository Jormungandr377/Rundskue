import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { format, addMonths, subMonths, parseISO } from 'date-fns';
import { budgets, categories } from '../api';
import type { Budget, BudgetItem, Category } from '../types';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Budgets() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  
  // For simplicity, using profile_id = 1. In real app, get from context
  const profileId = 1;
  const monthStr = format(currentMonth, 'yyyy-MM-dd');

  const { data: budgetList, isLoading } = useQuery({
    queryKey: ['budgets', profileId, monthStr],
    queryFn: () => budgets.list(profileId, monthStr),
  });

  const { data: budgetProgress } = useQuery({
    queryKey: ['budgets', 'progress', budgetList?.[0]?.id],
    queryFn: () => budgetList?.[0]?.id ? budgets.getProgress(budgetList[0].id) : null,
    enabled: !!budgetList?.[0]?.id,
  });

  const { data: categoryList } = useQuery({
    queryKey: ['categories'],
    queryFn: categories.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: { profile_id: number; name: string; month: string; items: Partial<BudgetItem>[] }) =>
      budgets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setShowCreateModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => budgets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const budget = budgetList?.[0];
  const progress = budgetProgress;

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
          <p className="text-gray-500">Track your spending against your budget</p>
        </div>
        {!budget && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Create Budget
          </button>
        )}
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold text-gray-900 w-48 text-center">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : budget && progress ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-6">
              <p className="text-sm text-gray-500">Total Budgeted</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(progress.total_budgeted)}
              </p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-gray-500">Total Spent</p>
              <p className={`text-2xl font-bold ${
                progress.total_spent > progress.total_budgeted ? 'text-red-600' : 'text-gray-900'
              }`}>
                {formatCurrency(progress.total_spent)}
              </p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-gray-500">Remaining</p>
              <p className={`text-2xl font-bold ${
                progress.total_budgeted - progress.total_spent < 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(progress.total_budgeted - progress.total_spent)}
              </p>
            </div>
          </div>

          {/* Budget Items */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{budget.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingBudget(budget)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this budget?')) {
                      deleteMutation.mutate(budget.id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {progress.items.map((item) => {
                const percentage = Math.min((item.spent / item.amount) * 100, 100);
                const isOverBudget = item.spent > item.amount;
                
                return (
                  <div key={item.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {item.category?.name || 'Unknown Category'}
                      </span>
                      <div className="text-right">
                        <span className={isOverBudget ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          {formatCurrency(item.spent)}
                        </span>
                        <span className="text-gray-400"> / </span>
                        <span className="text-gray-900">{formatCurrency(item.amount)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isOverBudget ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    {isOverBudget && (
                      <p className="text-sm text-red-600 mt-1">
                        Over budget by {formatCurrency(item.spent - item.amount)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="card p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No budget for this month</h3>
          <p className="text-gray-500 mb-4">
            Create a budget to start tracking your spending.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Budget
          </button>
        </div>
      )}

      {/* Create Budget Modal */}
      {showCreateModal && (
        <CreateBudgetModal
          profileId={profileId}
          month={monthStr}
          categories={categoryList || []}
          onClose={() => setShowCreateModal(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}

interface CreateBudgetModalProps {
  profileId: number;
  month: string;
  categories: Category[];
  onClose: () => void;
  onCreate: (data: { profile_id: number; name: string; month: string; items: Partial<BudgetItem>[] }) => void;
}

function CreateBudgetModal({ profileId, month, categories, onClose, onCreate }: CreateBudgetModalProps) {
  const [name, setName] = useState(`${format(parseISO(month), 'MMMM yyyy')} Budget`);
  const [items, setItems] = useState<{ category_id: number; amount: string }[]>([
    { category_id: categories[0]?.id || 0, amount: '' }
  ]);

  const handleAddItem = () => {
    setItems([...items, { category_id: categories[0]?.id || 0, amount: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: 'category_id' | 'amount', value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      profile_id: profileId,
      name,
      month,
      items: items
        .filter(item => item.amount && Number(item.amount) > 0)
        .map(item => ({
          category_id: item.category_id,
          amount: Number(item.amount),
        })),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Create Budget</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Items
            </label>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <select
                    value={item.category_id}
                    onChange={(e) => handleItemChange(index, 'category_id', Number(e.target.value))}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.filter(c => !c.is_income).map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                    className="w-32 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              + Add Category
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Budget
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
