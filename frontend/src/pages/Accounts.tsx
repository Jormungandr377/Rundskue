import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CreditCard, 
  Landmark, 
  PiggyBank, 
  TrendingUp, 
  Home,
  Eye,
  EyeOff,
  RefreshCw,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { accounts, plaid } from '../api';
import type { Account, PlaidItem } from '../types';
import { formatCurrency } from '../utils/format';

const accountTypeIcons: Record<string, React.ReactNode> = {
  checking: <Landmark className="w-5 h-5" />,
  savings: <PiggyBank className="w-5 h-5" />,
  credit: <CreditCard className="w-5 h-5" />,
  investment: <TrendingUp className="w-5 h-5" />,
  loan: <CreditCard className="w-5 h-5" />,
  mortgage: <Home className="w-5 h-5" />,
};

const accountTypeColors: Record<string, string> = {
  checking: 'bg-primary-100 text-primary-600',
  savings: 'bg-emerald-100 text-emerald-600',
  credit: 'bg-orange-100 text-orange-600',
  investment: 'bg-purple-100 text-purple-600',
  loan: 'bg-red-100 text-red-600',
  mortgage: 'bg-pink-100 text-pink-600',
};

export default function Accounts() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [syncing, setSyncing] = useState<number | null>(null);

  const { data: accountList, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accounts.list(),
  });

  const { data: summary } = useQuery({
    queryKey: ['accounts', 'summary'],
    queryFn: () => accounts.getSummary(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { display_name?: string; is_hidden?: boolean } }) =>
      accounts.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setEditingId(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: (itemId: number) => plaid.syncItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setSyncing(null);
    },
    onError: () => {
      setSyncing(null);
    },
  });

  const handleStartEdit = (acc: Account) => {
    setEditingId(acc.id);
    setEditName(acc.display_name || acc.name);
  };

  const handleSaveEdit = (id: number) => {
    updateMutation.mutate({ id, data: { display_name: editName } });
  };

  const handleToggleHidden = (acc: Account) => {
    updateMutation.mutate({ id: acc.id, data: { is_hidden: !acc.is_hidden } });
  };

  // Group accounts by type
  const groupedAccounts = accountList?.reduce((groups, acc) => {
    const type = acc.account_type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(acc);
    return groups;
  }, {} as Record<string, Account[]>) || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Accounts</h1>
        <p className="text-surface-500">Manage your linked bank accounts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <p className="text-sm text-surface-500">Total Assets</p>
          <p className="text-2xl font-bold text-emerald-600">
            {formatCurrency(summary?.total_assets || 0)}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-surface-500">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(summary?.total_liabilities || 0)}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-surface-500">Net Worth</p>
          <p className="text-2xl font-bold text-surface-900">
            {formatCurrency(summary?.net_worth || 0)}
          </p>
        </div>
      </div>

      {/* Accounts by Type */}
      {Object.entries(groupedAccounts).map(([type, accs]) => (
        <div key={type} className="card">
          <div className="px-6 py-4 border-b border-surface-200">
            <h3 className="text-lg font-semibold text-surface-900 capitalize">{type} Accounts</h3>
          </div>
          <div className="divide-y divide-surface-100">
            {accs.map((acc) => (
              <div 
                key={acc.id} 
                className={`p-4 flex items-center justify-between ${acc.is_hidden ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${accountTypeColors[type] || 'bg-surface-100 text-surface-600'}`}>
                    {accountTypeIcons[type] || <CreditCard className="w-5 h-5" />}
                  </div>
                  <div>
                    {editingId === acc.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-1 border border-surface-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(acc.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-surface-400 hover:bg-surface-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-surface-900">
                          {acc.display_name || acc.name}
                        </p>
                        <p className="text-sm text-surface-500">
                          {acc.official_name && acc.official_name !== acc.name && (
                            <span>{acc.official_name} • </span>
                          )}
                          {acc.mask && `••••${acc.mask}`}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${
                      type === 'credit' || type === 'loan' || type === 'mortgage'
                        ? 'text-red-600'
                        : 'text-surface-900'
                    }`}>
                      {type === 'credit' || type === 'loan' || type === 'mortgage' ? '-' : ''}
                      {formatCurrency(Math.abs(acc.balance_current))}
                    </p>
                    {acc.balance_available !== null && acc.balance_available !== acc.balance_current && (
                      <p className="text-sm text-surface-500">
                        Available: {formatCurrency(acc.balance_available)}
                      </p>
                    )}
                    {acc.balance_limit && (
                      <p className="text-sm text-surface-500">
                        Limit: {formatCurrency(acc.balance_limit)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEdit(acc)}
                      className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg"
                      title="Rename account"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleHidden(acc)}
                      className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg"
                      title={acc.is_hidden ? 'Show account' : 'Hide account'}
                    >
                      {acc.is_hidden ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {(!accountList || accountList.length === 0) && (
        <div className="card p-12 text-center">
          <CreditCard className="w-12 h-12 text-surface-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-surface-900 mb-2">No accounts linked</h3>
          <p className="text-surface-500 mb-4">
            Connect your bank accounts to start tracking your finances.
          </p>
          <a
            href="/link-account"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700"
          >
            Link Account
          </a>
        </div>
      )}
    </div>
  );
}
