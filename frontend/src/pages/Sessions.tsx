import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone, Globe, Trash2, ShieldOff, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { sessions } from '../api';
import { useToast } from '../contexts/ToastContext';

function parseUserAgent(ua?: string): { device: string; browser: string } {
  if (!ua) return { device: 'Unknown Device', browser: 'Unknown Browser' };

  let device = 'Desktop';
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) device = 'Mobile';
  else if (/Tablet|iPad/i.test(ua)) device = 'Tablet';

  let browser = 'Unknown';
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edge/i.test(ua)) browser = 'Edge';

  return { device, browser };
}

export default function Sessions() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data: sessionList, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessions.list,
  });

  const revokeMutation = useMutation({
    mutationFn: sessions.revoke,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      addToast('Session revoked', 'success');
    },
    onError: () => addToast('Failed to revoke session', 'error'),
  });

  const revokeAllMutation = useMutation({
    mutationFn: sessions.revokeAllOthers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      addToast('All other sessions revoked', 'success');
    },
    onError: () => addToast('Failed to revoke sessions', 'error'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Active Sessions</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your logged-in devices</p>
        </div>
        {sessionList && sessionList.length > 1 && (
          <button
            onClick={() => revokeAllMutation.mutate()}
            className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <ShieldOff className="w-4 h-4" />
            Log Out Other Devices
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {sessionList?.map((session) => {
            const { device, browser } = parseUserAgent(session.user_agent);
            const DeviceIcon = device === 'Mobile' ? Smartphone : Monitor;

            return (
              <div
                key={session.id}
                className={`card p-4 flex items-center gap-4 ${session.is_current ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
                  <DeviceIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {browser} on {device}
                    </p>
                    {session.is_current && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full">
                        Current Session
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    {session.ip_address && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {session.ip_address}
                      </span>
                    )}
                    <span>Signed in {format(parseISO(session.created_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                </div>

                {!session.is_current && (
                  <button
                    onClick={() => revokeMutation.mutate(session.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Revoke session"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
