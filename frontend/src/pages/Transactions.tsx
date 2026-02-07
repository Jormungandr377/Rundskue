import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Download, X, ArrowLeftRight } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { transactions, categories, accounts as accountsApi, dataExport } from '../api';
import type { Transaction, Category, Account } from '../types';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(amount));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const pageSize = 50;

  const { data: txnData, isLoading } = useQuery({
    queryKey: ['transactions', { search, selectedAccount, selectedCategory, dateRange, page }],
    queryFn: () => transactions.list({
      search: search || undefined,
      account_id: selectedAccount || undefined,
      category_id: selectedCategory || undefined,
      start_date: dateRange.start,
      end_date: dateRange.end,
      page,
      page_size: pageSize,
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

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await dataExport.transactionsCsv({
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      downloadBlob(blob, `transactions_${dateRange.start}_${dateRange.end}.csv`);
    } catch (err) {
      console.error('Export failed:', err);
    }
    setExporting(false);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const blob = await dataExport.transactionsExcel({
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      downloadBlob(blob, `transactions_${dateRange.start}_${dateRange.end}.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
    }
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {txnData?.total || 0} transactions found
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Account Filter */}
          <select
            value={selectedAccount || ''}
            onChange={(e) => setSelectedAccount(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <span className="self-center text-gray-400">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">Description</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300 hidden md:table-cell">Account</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300 hidden lg:table-cell">Category</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-300">Amount</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-300 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {txnData?.transactions?.map((txn) => (
                  <tr
                    key={txn.id}
                    className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                      txn.is_excluded ? 'opacity-50' : ''
                    } ${txn.is_transfer ? 'bg-purple-50 dark:bg-purple-900/10' : ''}`}
                  >
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {format(parseISO(txn.date), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {txn.custom_name || txn.merchant_name || txn.name}
                        </p>
                        {txn.pending && (
                          <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded">
                            Pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      {txn.account?.display_name || txn.account?.name || '-'}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <select
                        value={txn.category_id || ''}
                        onChange={(e) => handleCategoryChange(txn.id, Number(e.target.value))}
                        className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Uncategorized</option>
                        {categoryList?.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${
                      txn.amount < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                    }`}>
                      {txn.amount < 0 ? '+' : '-'}{formatCurrency(txn.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleToggleExclude(txn)}
                          aria-label={txn.is_excluded ? 'Include in reports' : 'Exclude from reports'}
                          className={`p-1 rounded ${
                            txn.is_excluded
                              ? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'
                          }`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleTransfer(txn)}
                          aria-label={txn.is_transfer ? 'Mark as regular' : 'Mark as transfer'}
                          className={`p-1 rounded ${
                            txn.is_transfer
                              ? 'bg-purple-200 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'
                          }`}
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {txnData && txnData.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {txnData.total_pages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= txnData.total_pages}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
