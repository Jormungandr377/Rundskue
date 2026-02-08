import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Plus,
  Trash2,
  Send,
  Calendar,
  Clock,
  ToggleLeft,
  ToggleRight,
  FileText,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import authenticatedApi from '../services/api';
import { useToast } from '../contexts/ToastContext';

interface ScheduledReport {
  id: number;
  report_type: string;
  frequency: string;
  day_of_week?: number;
  day_of_month?: number;
  is_active: boolean;
  last_sent?: string;
  created_at: string;
}

const REPORT_TYPES: Record<string, { label: string; icon: typeof Mail; color: string; bg: string; description: string }> = {
  weekly_summary: {
    label: 'Weekly Summary',
    icon: Calendar,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    description: 'Overview of spending, income, and budget progress for the past week.',
  },
  monthly_summary: {
    label: 'Monthly Summary',
    icon: BarChart3,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    description: 'Detailed breakdown of monthly spending by category, income vs expenses, and trends.',
  },
  budget_status: {
    label: 'Budget Status',
    icon: FileText,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    description: 'Current budget utilization for each category, overspending alerts, and remaining amounts.',
  },
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const fetchScheduledReports = () =>
  authenticatedApi.get<ScheduledReport[]>('/reports/scheduled').then(r => r.data);

const createScheduledReport = (data: { report_type: string; frequency: string; day_of_week?: number; day_of_month?: number }) =>
  authenticatedApi.post<ScheduledReport>('/reports/scheduled', data).then(r => r.data);

const updateScheduledReport = (id: number, data: { is_active?: boolean; frequency?: string; day_of_week?: number; day_of_month?: number }) =>
  authenticatedApi.put<ScheduledReport>(`/reports/scheduled/${id}`, data).then(r => r.data);

const deleteScheduledReport = (id: number) =>
  authenticatedApi.delete(`/reports/scheduled/${id}`).then(r => r.data);

const sendReportNow = (id: number) =>
  authenticatedApi.post(`/reports/scheduled/${id}/send-now`).then(r => r.data);

export default function EmailReports() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    report_type: 'weekly_summary',
    frequency: 'weekly',
    day_of_week: '0',
    day_of_month: '1',
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: fetchScheduledReports,
  });

  const createMutation = useMutation({
    mutationFn: createScheduledReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      setShowForm(false);
      setFormData({ report_type: 'weekly_summary', frequency: 'weekly', day_of_week: '0', day_of_month: '1' });
      addToast('Report schedule created', 'success');
    },
    onError: () => addToast('Failed to create report schedule', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { is_active?: boolean; frequency?: string; day_of_week?: number; day_of_month?: number } }) =>
      updateScheduledReport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
    onError: () => addToast('Failed to update report', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScheduledReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      addToast('Report schedule deleted', 'success');
    },
    onError: () => addToast('Failed to delete report', 'error'),
  });

  const sendNowMutation = useMutation({
    mutationFn: sendReportNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      addToast('Report sent to your email', 'success');
    },
    onError: () => addToast('Failed to send report', 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: { report_type: string; frequency: string; day_of_week?: number; day_of_month?: number } = {
      report_type: formData.report_type,
      frequency: formData.frequency,
    };
    if (formData.frequency === 'weekly') {
      payload.day_of_week = parseInt(formData.day_of_week);
    } else {
      payload.day_of_month = parseInt(formData.day_of_month);
    }
    createMutation.mutate(payload);
  };

  const getScheduleDescription = (report: ScheduledReport): string => {
    if (report.frequency === 'weekly' && report.day_of_week !== undefined) {
      return `Every ${DAY_NAMES[report.day_of_week] || 'Monday'}`;
    }
    if (report.frequency === 'monthly' && report.day_of_month !== undefined) {
      const suffix = report.day_of_month === 1 ? 'st' : report.day_of_month === 2 ? 'nd' : report.day_of_month === 3 ? 'rd' : 'th';
      return `Monthly on the ${report.day_of_month}${suffix}`;
    }
    return report.frequency === 'weekly' ? 'Weekly' : 'Monthly';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Email Reports</h1>
          <p className="text-stone-500 dark:text-stone-400">Schedule automated financial summaries</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Report
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">New Scheduled Report</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Report Type
                </label>
                <select
                  value={formData.report_type}
                  onChange={e => setFormData({ ...formData, report_type: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-stone-700 dark:text-white"
                >
                  <option value="weekly_summary">Weekly Summary</option>
                  <option value="monthly_summary">Monthly Summary</option>
                  <option value="budget_status">Budget Status</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Frequency
                </label>
                <select
                  value={formData.frequency}
                  onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-stone-700 dark:text-white"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {formData.frequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Day of Week
                  </label>
                  <select
                    value={formData.day_of_week}
                    onChange={e => setFormData({ ...formData, day_of_week: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-stone-700 dark:text-white"
                  >
                    {DAY_NAMES.map((day, i) => (
                      <option key={day} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
              )}
              {formData.frequency === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Day of Month
                  </label>
                  <select
                    value={formData.day_of_month}
                    onChange={e => setFormData({ ...formData, day_of_month: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-stone-700 dark:text-white"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-600 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Report Cards */}
      {reports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map(report => {
            const config = REPORT_TYPES[report.report_type] || REPORT_TYPES.weekly_summary;
            const Icon = config.icon;

            return (
              <div
                key={report.id}
                className={`bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6 ${
                  !report.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${config.bg}`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-900 dark:text-white">{config.label}</h3>
                      <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full ${
                        report.is_active
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                      }`}>
                        {report.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => updateMutation.mutate({ id: report.id, data: { is_active: !report.is_active } })}
                    className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                    aria-label={report.is_active ? 'Deactivate report' : 'Activate report'}
                    title={report.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {report.is_active ? (
                      <ToggleRight className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-stone-400 dark:text-stone-500" />
                    )}
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>{getScheduleDescription(report)}</span>
                  </div>
                  {report.last_sent && (
                    <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span>Last sent {format(parseISO(report.last_sent), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  )}
                  {!report.last_sent && (
                    <div className="flex items-center gap-2 text-sm text-stone-400 dark:text-stone-500">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span>Never sent</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-stone-100 dark:border-stone-700">
                  <button
                    onClick={() => sendNowMutation.mutate(report.id)}
                    disabled={sendNowMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 disabled:opacity-50 transition-colors"
                    aria-label="Send report now"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Now
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(report.id)}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                    aria-label="Delete report schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-12 text-center">
          <Mail className="w-12 h-12 text-stone-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stone-900 dark:text-white mb-2">No scheduled reports</h3>
          <p className="text-stone-500 dark:text-stone-400 mb-4">
            Set up automated email reports to stay on top of your finances.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Create Your First Report
          </button>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">What's included in each report?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(REPORT_TYPES).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div key={key} className="flex gap-3">
                <div className={`p-2 rounded-lg ${config.bg} h-fit flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div>
                  <p className="font-medium text-stone-900 dark:text-white text-sm">{config.label}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{config.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
