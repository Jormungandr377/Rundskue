import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Trash2, AlertTriangle, Calendar, Target, Loader2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { notifications } from '../api';
import type { AppNotification } from '../types';
import { useToast } from '../contexts/ToastContext';

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  budget_alert: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  bill_reminder: { icon: Calendar, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30' },
  goal_reached: { icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data: notifList, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notifications.list(),
  });

  const markReadMutation = useMutation({
    mutationFn: notifications.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notifications.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      addToast('All marked as read', 'success');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: notifications.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const checkBudgetsMutation = useMutation({
    mutationFn: notifications.checkBudgets,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      addToast(`Created ${data.alerts_created} budget alerts`, 'info');
    },
  });

  const checkBillsMutation = useMutation({
    mutationFn: notifications.checkBills,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      addToast(`Created ${data.reminders_created} bill reminders`, 'info');
    },
  });

  const unreadCount = notifList?.filter(n => !n.is_read).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Notifications</h1>
          <p className="text-stone-500 dark:text-stone-400">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { checkBudgetsMutation.mutate(); checkBillsMutation.mutate(); }}
            className="px-3 py-2 text-sm border border-stone-200 dark:border-stone-600 text-stone-700 dark:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
          >
            Check Now
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      ) : notifList && notifList.length > 0 ? (
        <div className="space-y-2">
          {notifList.map((notif) => {
            const config = typeConfig[notif.type] || typeConfig.budget_alert;
            const Icon = config.icon;

            return (
              <div
                key={notif.id}
                className={`card p-4 flex items-start gap-4 ${!notif.is_read ? 'border-l-4 border-teal-500' : ''}`}
              >
                <div className={`p-2 rounded-full ${config.bg} flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${!notif.is_read ? 'text-stone-900 dark:text-white' : 'text-stone-600 dark:text-stone-400'}`}>
                      {notif.title}
                    </p>
                    {!notif.is_read && (
                      <span className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{notif.message}</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                    {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true })}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notif.is_read && (
                    <button
                      onClick={() => markReadMutation.mutate(notif.id)}
                      className="p-1.5 text-stone-400 hover:text-teal-500 transition-colors"
                      aria-label="Mark as read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(notif.id)}
                    className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-stone-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stone-900 dark:text-white mb-2">No notifications</h3>
          <p className="text-stone-500 dark:text-stone-400">You're all caught up! Budget alerts and bill reminders will appear here.</p>
        </div>
      )}
    </div>
  );
}
