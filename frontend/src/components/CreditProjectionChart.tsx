import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CreditProjectionPoint } from '../types';

interface CreditProjectionChartProps {
  projections: CreditProjectionPoint[];
  currentScore: number;
  className?: string;
}

export default function CreditProjectionChart({ projections, currentScore, className = '' }: CreditProjectionChartProps) {
  // Format data for chart
  const chartData = projections.map(p => ({
    month: `Month ${p.month}`,
    monthNum: p.month,
    score: p.estimated_score,
    debt: p.remaining_debt,
    paidOff: p.debts_paid_off,
  }));

  // Add current point at month 0 if not present
  if (!chartData.some(d => d.monthNum === 0)) {
    chartData.unshift({
      month: 'Now',
      monthNum: 0,
      score: currentScore,
      debt: 0, // Will be set by API
      paidOff: 0,
    });
  }

  return (
    <div className={`bg-white dark:bg-surface-800 rounded-lg shadow-sm border border-surface-200 dark:border-surface-700 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
        Credit Score Projection
      </h3>

      <div className="text-sm text-surface-600 dark:text-surface-400 mb-4">
        Estimated score improvement as you pay off debts
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis
            dataKey="month"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
            domain={[Math.min(currentScore - 50, 550), 850]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
            formatter={(value: any, name: string) => {
              if (name === 'score') return [value, 'Credit Score'];
              if (name === 'debt') return [`$${value.toLocaleString()}`, 'Remaining Debt'];
              if (name === 'paidOff') return [value, 'Debts Paid Off'];
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
            formatter={(value) => {
              if (value === 'score') return 'Credit Score';
              if (value === 'debt') return 'Remaining Debt';
              return value;
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#10B981"
            strokeWidth={3}
            dot={{ fill: '#10B981', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Key Insights */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {projections.length > 0 && (
          <>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">Projected Score</div>
              <div className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
                {projections[projections.length - 1].estimated_score}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                +{projections[projections.length - 1].estimated_score - currentScore} points
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">Timeline</div>
              <div className="text-lg font-bold text-blue-900 dark:text-blue-300">
                {projections[projections.length - 1].month} months
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                Until debt-free
              </div>
            </div>

            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-xs text-purple-700 dark:text-purple-400 mb-1">Debts Cleared</div>
              <div className="text-lg font-bold text-purple-900 dark:text-purple-300">
                {projections[projections.length - 1].debts_paid_off}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-500 mt-1">
                Accounts paid off
              </div>
            </div>
          </>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <div className="text-xs text-yellow-800 dark:text-yellow-300">
          <strong>Note:</strong> These are estimates based on current data. Actual credit score changes depend on many factors including payment history, credit inquiries, and account age.
        </div>
      </div>
    </div>
  );
}
