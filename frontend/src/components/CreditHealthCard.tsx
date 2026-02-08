import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { CreditHealthMetrics } from '../types';
import { formatCurrency } from '../utils/format';

interface CreditHealthCardProps {
  metrics: CreditHealthMetrics;
  className?: string;
}

function getHealthColor(rating: string): string {
  switch (rating) {
    case 'Excellent':
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
    case 'Good':
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    case 'Fair':
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
    case 'Poor':
      return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
    case 'Critical':
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    default:
      return 'text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-900/20';
  }
}

function getUtilizationStatus(utilization: number): { icon: JSX.Element; label: string; color: string } {
  if (utilization <= 10) {
    return {
      icon: <CheckCircle className="w-4 h-4" />,
      label: 'Excellent',
      color: 'text-emerald-600 dark:text-emerald-400',
    };
  } else if (utilization <= 30) {
    return {
      icon: <CheckCircle className="w-4 h-4" />,
      label: 'Good',
      color: 'text-green-600 dark:text-green-400',
    };
  } else if (utilization <= 50) {
    return {
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'Fair',
      color: 'text-yellow-600 dark:text-yellow-400',
    };
  } else {
    return {
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'High',
      color: 'text-red-600 dark:text-red-400',
    };
  }
}

function getDTIStatus(dti: number): { icon: JSX.Element; label: string; color: string } {
  if (dti <= 20) {
    return {
      icon: <CheckCircle className="w-4 h-4" />,
      label: 'Excellent',
      color: 'text-emerald-600 dark:text-emerald-400',
    };
  } else if (dti <= 36) {
    return {
      icon: <CheckCircle className="w-4 h-4" />,
      label: 'Good',
      color: 'text-green-600 dark:text-green-400',
    };
  } else if (dti <= 43) {
    return {
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'Fair',
      color: 'text-yellow-600 dark:text-yellow-400',
    };
  } else {
    return {
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'High',
      color: 'text-red-600 dark:text-red-400',
    };
  }
}

export default function CreditHealthCard({ metrics, className = '' }: CreditHealthCardProps) {
  const healthColor = getHealthColor(metrics.health_rating);
  const utilizationStatus = getUtilizationStatus(metrics.credit_utilization);
  const dtiStatus = getDTIStatus(metrics.debt_to_income_ratio);

  return (
    <div className={`bg-white dark:bg-surface-800 rounded-lg shadow-sm border border-surface-200 dark:border-surface-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
          Credit Health
        </h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${healthColor}`}>
          {metrics.health_rating}
        </div>
      </div>

      {/* Health Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-surface-600 dark:text-surface-400">Overall Health Score</span>
          <span className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            {metrics.health_score}/100
          </span>
        </div>
        <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              metrics.health_score >= 80
                ? 'bg-emerald-500'
                : metrics.health_score >= 60
                ? 'bg-green-500'
                : metrics.health_score >= 40
                ? 'bg-yellow-500'
                : metrics.health_score >= 20
                ? 'bg-orange-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${metrics.health_score}%` }}
          />
        </div>
      </div>

      {/* Credit Score */}
      {metrics.credit_score && (
        <div className="mb-4 p-4 bg-surface-50 dark:bg-surface-900/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-surface-600 dark:text-surface-400 mb-1">Credit Score</div>
              <div className="text-3xl font-bold text-surface-900 dark:text-surface-100">
                {metrics.credit_score}
              </div>
              {metrics.credit_score_date && (
                <div className="text-xs text-surface-500 dark:text-surface-500 mt-1">
                  As of {new Date(metrics.credit_score_date).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className="text-right">
              <TrendingUp className="w-8 h-8 text-emerald-500 mb-1" />
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Credit Utilization */}
        <div className="p-3 bg-surface-50 dark:bg-surface-900/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className={`${utilizationStatus.color}`}>{utilizationStatus.icon}</span>
            <span className="text-xs text-surface-600 dark:text-surface-400">Utilization</span>
          </div>
          <div className="text-lg font-semibold text-surface-900 dark:text-surface-100">
            {metrics.credit_utilization.toFixed(1)}%
          </div>
          <div className="text-xs text-surface-500 dark:text-surface-500 mt-1">
            {utilizationStatus.label}
          </div>
        </div>

        {/* Debt-to-Income */}
        <div className="p-3 bg-surface-50 dark:bg-surface-900/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className={`${dtiStatus.color}`}>{dtiStatus.icon}</span>
            <span className="text-xs text-surface-600 dark:text-surface-400">DTI Ratio</span>
          </div>
          <div className="text-lg font-semibold text-surface-900 dark:text-surface-100">
            {metrics.debt_to_income_ratio.toFixed(1)}%
          </div>
          <div className="text-xs text-surface-500 dark:text-surface-500 mt-1">
            {dtiStatus.label}
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-surface-600 dark:text-surface-400">Total Debt</span>
          <span className="font-medium text-surface-900 dark:text-surface-100">
            {formatCurrency(metrics.total_debt)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-surface-600 dark:text-surface-400">Monthly Payment</span>
          <span className="font-medium text-surface-900 dark:text-surface-100">
            {formatCurrency(metrics.monthly_debt_payment)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-surface-600 dark:text-surface-400">Monthly Income</span>
          <span className="font-medium text-surface-900 dark:text-surface-100">
            {formatCurrency(metrics.monthly_income)}
          </span>
        </div>
        {metrics.total_credit_limit > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-surface-600 dark:text-surface-400">Credit Used</span>
              <span className="font-medium text-surface-900 dark:text-surface-100">
                {formatCurrency(metrics.total_credit_used)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-600 dark:text-surface-400">Credit Limit</span>
              <span className="font-medium text-surface-900 dark:text-surface-100">
                {formatCurrency(metrics.total_credit_limit)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Tips */}
      <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
        <div className="text-xs text-surface-600 dark:text-surface-400">
          {metrics.credit_utilization > 30 && (
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-yellow-600" />
              <span>Consider paying down credit cards to below 30% utilization</span>
            </div>
          )}
          {metrics.debt_to_income_ratio > 36 && (
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-yellow-600" />
              <span>DTI above 36% may affect loan approvals</span>
            </div>
          )}
          {metrics.health_score >= 80 && (
            <div className="flex items-start gap-2">
              <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-600" />
              <span>Excellent credit health! Keep up the good work</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
