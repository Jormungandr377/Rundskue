import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlaidLink } from 'react-plaid-link';
import { Link2, Building2, RefreshCw, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { plaid, profiles } from '../api';
import type { PlaidItem, Profile } from '../types';

export default function LinkAccount() {
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<number | null>(null);

  const { data: profileList } = useQuery({
    queryKey: ['profiles'],
    queryFn: profiles.list,
  });

  // Auto-select first/primary profile when data loads
  if (profileList && profileList.length > 0 && !selectedProfileId) {
    const primary = profileList.find((p: Profile) => p.is_primary);
    setSelectedProfileId(primary?.id || profileList[0].id);
  }

  const { data: plaidItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['plaid', 'items', selectedProfileId],
    queryFn: () => selectedProfileId ? plaid.listItems(selectedProfileId) : [],
    enabled: !!selectedProfileId,
  });

  const linkTokenMutation = useMutation({
    mutationFn: (profileId: number) => plaid.getLinkToken(profileId),
    onSuccess: (data) => {
      setLinkToken(data.link_token);
    },
  });

  const exchangeTokenMutation = useMutation({
    mutationFn: ({ publicToken, metadata }: { publicToken: string; metadata: any }) =>
      plaid.exchangeToken(
        selectedProfileId!,
        publicToken,
        metadata?.institution?.institution_id,
        metadata?.institution?.name
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setLinkToken(null);
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

  const deleteMutation = useMutation({
    mutationFn: (itemId: number) => plaid.removeItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const onPlaidSuccess = useCallback((publicToken: string, metadata: any) => {
    exchangeTokenMutation.mutate({ publicToken, metadata });
  }, [exchangeTokenMutation]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  });

  const handleStartLink = () => {
    if (selectedProfileId) {
      linkTokenMutation.mutate(selectedProfileId);
    }
  };

  // Open Plaid Link when token is ready
  if (linkToken && ready) {
    open();
  }

  const handleSync = (itemId: number) => {
    setSyncing(itemId);
    syncMutation.mutate(itemId);
  };

  const handleDelete = (itemId: number, institutionName: string) => {
    if (confirm(`Remove ${institutionName || 'this bank'}? This will delete all associated accounts and transactions.`)) {
      deleteMutation.mutate(itemId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Link Account</h1>
        <p className="text-gray-500">Connect your bank accounts using Plaid</p>
      </div>

      {/* Profile Selection */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Link accounts to profile:
        </label>
        <select
          value={selectedProfileId || ''}
          onChange={(e) => setSelectedProfileId(Number(e.target.value))}
          className="w-full max-w-xs px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {profileList?.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name} {profile.is_primary && '(Primary)'}
            </option>
          ))}
        </select>
      </div>

      {/* Link New Account */}
      <div className="card p-8 text-center">
        <Link2 className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect a New Bank</h2>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Securely link your bank accounts to automatically import transactions and track balances.
        </p>
        <button
          onClick={handleStartLink}
          disabled={!selectedProfileId || linkTokenMutation.isPending}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {linkTokenMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Preparing...
            </>
          ) : (
            <>
              <Link2 className="w-5 h-5" />
              Connect Bank
            </>
          )}
        </button>
      </div>

      {/* Linked Banks */}
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Linked Banks</h3>
        </div>
        {itemsLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : plaidItems?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No banks linked yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {plaidItems?.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${item.is_active ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Building2 className={`w-6 h-6 ${item.is_active ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.institution_name || 'Unknown Bank'}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{item.account_count} account{item.account_count !== 1 ? 's' : ''}</span>
                      {item.last_sync && (
                        <span>Last synced: {format(parseISO(item.last_sync), 'MMM d, h:mm a')}</span>
                      )}
                    </div>
                    {item.error_code && (
                      <div className="flex items-center gap-1 text-sm text-red-600 mt-1">
                        <AlertCircle className="w-4 h-4" />
                        <span>{item.error_message || item.error_code}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.is_active ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      Error
                    </span>
                  )}
                  <button
                    onClick={() => handleSync(item.id)}
                    disabled={!item.is_active || syncing === item.id}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                    title="Sync now"
                  >
                    <RefreshCw className={`w-5 h-5 ${syncing === item.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.institution_name || '')}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Remove"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync All */}
      {plaidItems && plaidItems.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => selectedProfileId && plaid.syncAll().then(() => {
              queryClient.invalidateQueries({ queryKey: ['accounts'] });
              queryClient.invalidateQueries({ queryKey: ['transactions'] });
            })}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
            Sync All Banks
          </button>
        </div>
      )}
    </div>
  );
}
