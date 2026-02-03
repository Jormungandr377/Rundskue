import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, ChevronDown, X, Check } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { transactions, categories, accounts as accountsApi } from '../api';
import type { Transaction, Category, Account } from '../types';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(amount));
}

export default function Transactions() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data: txnData, isLoading } = useQuery({
    queryKey: ['transactions', { search, selectedAccount, selectedCategory, dateRange, page }],
    queryFn: () => transactions.list({
      search: search || undefined,
      account_id: selectedAccount || undefined,
      category_id: selectedCategory || undefined,
      start_date: dateRange.start,
      end_date: dateRange.end,
      limit,
      offset: page * limit,
    }),
  });

  const { data: categoryList } = useQuery({
    queryKey: ['categories'],
    queryFn: categories.list,
  });

  const { data: accountList } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Transaction> }) =>
      transactions.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setEditingTxn(null);
    },
  });

  const handleCategoryChange = (txnId: number, categoryId: number) => {
    updateMutation.mutate({ id: txnId, data: { category_id: categoryId } });
  };

  const handleToggleExclude = (txn: Transaction) => {
    updateMutation.mutate({ id: txn.id, data: { is_excluded: !txn.is_excluded } });
  };

  const handleToggleTransfer = (txn: Transaction) => {
    updateMutation.mutate({ id: txn.id, data: { is_transfer: !txn.is_transfer } });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500">
            {txnData?.total || 0} transactions found
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Account Filter */}
          <select
            value={selectedAccount || ''}
            onChange={(e) => setSelectedAccount(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Accounts</option>
            {accountList?.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.display_name || acc.name}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categoryList?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Date Range */}
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="self-center text-gray-400">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Description</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Account</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Amount</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {txnData?.items.map((txn) => (
                <tr 
                  key={txn.id} 
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    txn.is_excluded ? 'opacity-50' : ''
                  } ${txn.is_transfer ? 'bg-purple-50' : ''}`}
                >
                  <td className="py-3 px-4 text-gray-600">
                    {format(parseISO(txn.date), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {txn.custom_name || txn.merchant_name || txn.name}
                      </p>
                      {txn.pending && (
                        <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                          Pending
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {txn.account?.display_name || txn.account?.name || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={txn.category_id || ''}
                      onChange={(e) => handleCategoryChange(txn.id, Number(e.target.value))}
                      className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Uncategorized</option>
                      {categoryList?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`py-3 px-4 text-right font-semibold ${
                    txn.amount < 0 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {txn.amount < 0 ? '+' : '-'}{formatCurrency(txn.amount)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleToggleExclude(txn)}
                        title={txn.is_excluded ? 'Include in reports' : 'Exclude from reports'}
                        className={`p-1 rounded ${
                          txn.is_excluded 
                            ? 'bg-gray-200 text-gray-600' 
                            : 'hover:bg-gray-100 text-gray-400'
                        }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleTransfer(txn)}
                        title={txn.is_transfer ? 'Mark as regular transaction' : 'Mark as transfer'}
                        className={`p-1 rounded ${
                          txn.is_transfer 
                            ? 'bg-purple-200 text-purple-600' 
                            : 'hover:bg-gray-100 text-gray-400'
                        }`}
                      >
                        ↔
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {txnData && txnData.total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page + 1} of {Math.ceil(txnData.total / limit)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= txnData.total}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
