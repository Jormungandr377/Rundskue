import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertTriangle, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { profiles } from '../api';
import authenticatedApi from '../services/api';
import { formatCurrency } from '../utils/format';

interface CashFlowEvent {
  name: string;
  amount: number;
  type: string;
}

interface CashFlowDay {
  date: string;
  projected_balance: number;
  events: CashFlowEvent[];
  cumulative_income: number;
  cumulative_expenses: number;
}

export default function CashFlow() {
  const [days, setDays] = useState(30);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioAmount, setScenarioAmount] = useState('');
  const [scenarioFreq, setScenarioFreq] = useState('monthly');
  const [showScenario, setShowScenario] = useState(false);

  const { data: profileList } = useQuery({ queryKey: ['profiles'], queryFn: profiles.list });
  const profileId = profileList?.[0]?.id;

  const { data: forecast, isLoading } = useQuery({
    queryKey: ['cashflow-forecast', profileId, days],
    queryFn: () => authenticatedApi.get<CashFlowDay[]>('/cashflow/forecast', {
      params: { profile_id: profileId, days }
    }).then(r => r.data),
    enabled: !!profileId,
  });

  const { data: scenario } = useQuery({
    queryKey: ['cashflow-scenario', profileId, days, scenarioName, scenarioAmount, scenarioFreq],
    queryFn: () => authenticatedApi.get<CashFlowDay[]>('/cashflow/scenarios', {
      params: {
        profile_id: profileId,
        days,
        add_expense_name: scenarioName || undefined,
        add_expense_amount: scenarioAmount ? parseFloat(scenarioAmount) : undefined,
        add_expense_frequency: scenarioFreq,
      }
    }).then(r => r.data),
    enabled: !!profileId && showScenario && !!scenarioName && !!scenarioAmount,
  });

  const chartData = (forecast || []).map((day, i) => ({
    date: format(new Date(day.date), 'MMM d'),
    balance: day.projected_balance,
    scenario: scenario?.[i]?.projected_balance,
    income: day.cumulative_income,
    expenses: day.cumulative_expenses,
  }));

  const minBalance = forecast ? Math.min(...forecast.map(d => d.projected_balance)) : 0;
  const hasNegative = minBalance < 0;
  const lastDay = forecast?.[forecast.length - 1];
  const firstDay = forecast?.[0];
  const balanceChange = lastDay && firstDay ? lastDay.projected_balance - firstDay.projected_balance : 0;

  // Find upcoming events (next 7 days)
  const upcomingEvents = (forecast || [])
    .slice(0, 7)
    .flatMap(d => d.events.map(e => ({ ...e, date: d.date })))
    .slice(0, 10);

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Cash Flow Forecast</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm">Projected balances based on recurring bills and income</p>
        </div>
        <div className="flex gap-2">
          {[30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm rounded-lg ${days === d ? 'bg-primary-600 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-surface-500 dark:text-surface-400">Current Balance</p>
          <p className="text-xl font-bold text-surface-900 dark:text-white">{formatCurrency(firstDay?.projected_balance || 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-500 dark:text-surface-400">Projected ({days}d)</p>
          <p className="text-xl font-bold text-surface-900 dark:text-white">{formatCurrency(lastDay?.projected_balance || 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-500 dark:text-surface-400">Net Change</p>
          <p className={`text-xl font-bold ${balanceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {balanceChange >= 0 ? '+' : ''}{formatCurrency(balanceChange)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-surface-500 dark:text-surface-400">Min Balance</p>
          <p className={`text-xl font-bold ${hasNegative ? 'text-red-600' : 'text-surface-900 dark:text-white'}`}>
            {formatCurrency(minBalance)}
          </p>
          {hasNegative && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Below zero</p>}
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6">
        <h3 className="font-semibold text-surface-900 dark:text-white mb-4">Balance Projection</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} interval={Math.floor(days / 8)} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="balance" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} name="Projected" />
              {showScenario && scenario && (
                <Area type="monotone" dataKey="scenario" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.05} name="Scenario" strokeDasharray="5 5" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scenario Builder */}
      <div className="card p-6">
        <h3 className="font-semibold text-surface-900 dark:text-white mb-4">What-If Scenario</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Expense Name</label>
            <input type="text" value={scenarioName} onChange={e => setScenarioName(e.target.value)}
              placeholder="e.g., New Car Payment" className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600 dark:text-white" />
          </div>
          <div className="w-32">
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Amount</label>
            <input type="number" value={scenarioAmount} onChange={e => setScenarioAmount(e.target.value)}
              placeholder="500" className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600 dark:text-white" />
          </div>
          <div className="w-36">
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Frequency</label>
            <select value={scenarioFreq} onChange={e => setScenarioFreq(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600 dark:text-white">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
            </select>
          </div>
          <button onClick={() => setShowScenario(!showScenario)}
            className={`px-4 py-2 rounded-lg ${showScenario ? 'bg-amber-500 text-white' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
            {showScenario ? 'Hide Scenario' : 'Show Scenario'}
          </button>
        </div>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Upcoming Events (Next 7 Days)
          </h3>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {upcomingEvents.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  {e.type === 'income' ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-surface-900 dark:text-white">{e.name}</span>
                  <span className="text-xs text-surface-400">{format(new Date(e.date), 'MMM d')}</span>
                </div>
                <span className={e.type === 'income' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {e.type === 'income' ? '+' : '-'}{formatCurrency(e.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
