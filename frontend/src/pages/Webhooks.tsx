import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Plus, Trash2, Zap, ToggleLeft, ToggleRight, Send, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import authenticatedApi from '../services/api';
import { useToast } from '../contexts/ToastContext';

interface WebhookItem {
  id: number;
  url: string;
  events: string[];
  secret_masked: string;
  is_active: boolean;
  last_triggered?: string;
  failure_count: number;
  created_at: string;
}

interface TestResult {
  success: boolean;
  status_code?: number;
  error?: string;
}

const AVAILABLE_EVENTS = [
  { value: 'transaction_created', label: 'Transaction Created' },
  { value: 'budget_exceeded', label: 'Budget Exceeded' },
  { value: 'goal_reached', label: 'Goal Reached' },
  { value: 'bill_due', label: 'Bill Due' },
  { value: 'sync_completed', label: 'Sync Completed' },
];

const webhooksApi = {
  list: () =>
    authenticatedApi.get<WebhookItem[]>('/webhooks').then(r => r.data),
  create: (data: { url: string; events: string[] }) =>
    authenticatedApi.post<WebhookItem>('/webhooks', data).then(r => r.data),
  update: (id: number, data: { url?: string; events?: string[]; is_active?: boolean }) =>
    authenticatedApi.put<WebhookItem>(`/webhooks/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    authenticatedApi.delete(`/webhooks/${id}`),
  test: (id: number) =>
    authenticatedApi.post<TestResult>(`/webhooks/${id}/test`).then(r => r.data),
};

export default function Webhooks() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ url: '', events: [] as string[] });
  const [testingId, setTestingId] = useState<number | null>(null);

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: webhooksApi.list,
  });

  const createMutation = useMutation({
    mutationFn: webhooksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setShowCreate(false);
      setForm({ url: '', events: [] });
      addToast('Webhook created!', 'success');
    },
    onError: () => addToast('Failed to create webhook', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { url?: string; events?: string[]; is_active?: boolean } }) =>
      webhooksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: () => addToast('Failed to update webhook', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: webhooksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      addToast('Webhook deleted', 'success');
    },
    onError: () => addToast('Failed to delete webhook', 'error'),
  });

  const testMutation = useMutation({
    mutationFn: webhooksApi.test,
    onSuccess: (data) => {
      setTestingId(null);
      if (data.success) {
        addToast(`Test successful (HTTP ${data.status_code})`, 'success');
      } else {
        addToast(`Test failed: ${data.error || 'Unknown error'}`, 'error');
      }
    },
    onError: () => {
      setTestingId(null);
      addToast('Failed to send test webhook', 'error');
    },
  });

  const handleToggle = (webhook: WebhookItem) => {
    updateMutation.mutate({ id: webhook.id, data: { is_active: !webhook.is_active } });
  };

  const handleTest = (id: number) => {
    setTestingId(id);
    testMutation.mutate(id);
  };

  const toggleEvent = (event: string) => {
    setForm(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.events.length === 0) {
      addToast('Select at least one event', 'error');
      return;
    }
    createMutation.mutate({ url: form.url, events: form.events });
  };

  const getStatusBadge = (webhook: WebhookItem) => {
    if (webhook.failure_count > 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
          <AlertTriangle className="w-3 h-3" />
          Failing
        </span>
      );
    }
    if (webhook.is_active) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 rounded-full">
        Inactive
      </span>
    );
  };

  const getEventLabel = (event: string) => {
    return AVAILABLE_EVENTS.find(e => e.value === event)?.label || event;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Webhooks</h1>
          <p className="text-surface-500 dark:text-surface-400">Receive real-time notifications when events occur</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">New Webhook</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Endpoint URL
              </label>
              <input
                type="url"
                required
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://your-server.com/webhook"
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Events
              </label>
              <div className="flex flex-wrap gap-3">
                {AVAILABLE_EVENTS.map((event) => (
                  <label
                    key={event.value}
                    className="flex items-center gap-2 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={form.events.includes(event.value)}
                      onChange={() => toggleEvent(event.value)}
                      className="w-4 h-4 rounded border-surface-300 dark:border-surface-600 text-primary-600 focus:ring-primary-500 dark:bg-surface-700"
                    />
                    <span className="text-sm text-surface-700 dark:text-surface-300">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Webhook
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setForm({ url: '', events: [] }); }}
                className="px-4 py-2 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Webhook List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : webhooks && webhooks.length > 0 ? (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="w-5 h-5 text-surface-400 flex-shrink-0" />
                    <p className="font-medium text-surface-900 dark:text-white truncate" title={webhook.url}>
                      {webhook.url}
                    </p>
                    {getStatusBadge(webhook)}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-0.5 text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full"
                      >
                        {getEventLabel(event)}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-500 dark:text-surface-400">
                    <span>
                      Secret: <code className="text-xs bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded">{webhook.secret_masked}</code>
                    </span>
                    {webhook.last_triggered && (
                      <span>
                        Last triggered {formatDistanceToNow(parseISO(webhook.last_triggered), { addSuffix: true })}
                      </span>
                    )}
                    <span>
                      Created {formatDistanceToNow(parseISO(webhook.created_at), { addSuffix: true })}
                    </span>
                    {webhook.failure_count > 0 && (
                      <span className="text-red-500 dark:text-red-400">
                        {webhook.failure_count} failure{webhook.failure_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(webhook)}
                    className="p-2 text-surface-400 hover:text-primary-500 transition-colors"
                    aria-label={webhook.is_active ? 'Deactivate webhook' : 'Activate webhook'}
                    title={webhook.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {webhook.is_active ? (
                      <ToggleRight className="w-5 h-5 text-primary-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleTest(webhook.id)}
                    disabled={testingId === webhook.id}
                    className="p-2 text-surface-400 hover:text-primary-500 disabled:opacity-50 transition-colors"
                    aria-label="Send test webhook"
                    title="Send test"
                  >
                    {testingId === webhook.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(webhook.id)}
                    className="p-2 text-surface-400 hover:text-red-500 transition-colors"
                    aria-label="Delete webhook"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Zap className="w-12 h-12 text-surface-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-2">No webhooks configured</h3>
          <p className="text-surface-500 dark:text-surface-400 mb-4">
            Add a webhook to receive real-time notifications when events occur in your account.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Add Your First Webhook
          </button>
        </div>
      )}
    </div>
  );
}
