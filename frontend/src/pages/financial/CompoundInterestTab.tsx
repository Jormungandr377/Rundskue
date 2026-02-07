import { useState, useMemo } from 'react';
import { Calculator, DollarSign, TrendingUp, Percent } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

type CompoundingFrequency = 'monthly' | 'quarterly' | 'semi-annually' | 'annually';

const COMPOUNDING_OPTIONS: { value: CompoundingFrequency; label: string; periodsPerYear: number }[] = [
  { value: 'monthly', label: 'Monthly', periodsPerYear: 12 },
  { value: 'quarterly', label: 'Quarterly', periodsPerYear: 4 },
  { value: 'semi-annually', label: 'Semi-Annually', periodsPerYear: 2 },
  { value: 'annually', label: 'Annually', periodsPerYear: 1 },
];

interface YearlyBreakdown {
  year: number;
  startingBalance: number;
  contributions: number;
  interestEarned: number;
  endingBalance: number;
}

interface ChartDataPoint {
  year: number;
  Contributions: number;
  Interest: number;
}

interface CalculationResult {
  finalBalance: number;
  totalContributions: number;
  totalInterest: number;
  effectiveAnnualRate: number;
  yearlyBreakdown: YearlyBreakdown[];
  chartData: ChartDataPoint[];
}

export default function CompoundInterestTab() {
  const [initialInvestment, setInitialInvestment] = useState<number>(10000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(500);
  const [annualRate, setAnnualRate] = useState<number>(7.0);
  const [compoundingFrequency, setCompoundingFrequency] = useState<CompoundingFrequency>('monthly');
  const [timePeriod, setTimePeriod] = useState<number>(20);

  const results = useMemo<CalculationResult>(() => {
    const periodsPerYear = COMPOUNDING_OPTIONS.find(
      (opt) => opt.value === compoundingFrequency
    )!.periodsPerYear;

    // Effective monthly rate based on compounding frequency
    const effectiveMonthlyRate =
      Math.pow(1 + annualRate / 100 / periodsPerYear, periodsPerYear / 12) - 1;

    // Effective annual rate (for display when compounding != annually)
    const effectiveAnnualRate =
      (Math.pow(1 + annualRate / 100 / periodsPerYear, periodsPerYear) - 1) * 100;

    const totalMonths = timePeriod * 12;
    let balance = initialInvestment;
    let totalInterest = 0;
    let totalContributions = initialInvestment;

    const yearlyBreakdown: YearlyBreakdown[] = [];
    const chartData: ChartDataPoint[] = [];

    for (let year = 1; year <= timePeriod; year++) {
      const startingBalance = balance;
      let yearInterest = 0;
      let yearContributions = 0;

      for (let month = 1; month <= 12; month++) {
        const monthIndex = (year - 1) * 12 + month;
        if (monthIndex > totalMonths) break;

        const interest = balance * effectiveMonthlyRate;
        balance += interest + monthlyContribution;
        yearInterest += interest;
        yearContributions += monthlyContribution;
      }

      totalInterest += yearInterest;
      totalContributions += yearContributions;

      yearlyBreakdown.push({
        year,
        startingBalance,
        contributions: yearContributions,
        interestEarned: yearInterest,
        endingBalance: balance,
      });

      chartData.push({
        year,
        Contributions: totalContributions,
        Interest: totalInterest,
      });
    }

    return {
      finalBalance: balance,
      totalContributions,
      totalInterest,
      effectiveAnnualRate,
      yearlyBreakdown,
      chartData,
    };
  }, [initialInvestment, monthlyContribution, annualRate, compoundingFrequency, timePeriod]);

  const contributionPercent =
    results.finalBalance > 0
      ? (results.totalContributions / results.finalBalance) * 100
      : 0;
  const interestPercent =
    results.finalBalance > 0
      ? (results.totalInterest / results.finalBalance) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
          Compound Interest Calculator
        </h1>
        <p className="text-stone-500 dark:text-stone-400">
          See how your investments grow over time with the power of compound interest
        </p>
      </div>

      {/* Input Form */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Initial Investment ($)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={initialInvestment}
              onChange={(e) => setInitialInvestment(Number(e.target.value))}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg dark:bg-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Monthly Contribution ($)
            </label>
            <input
              type="number"
              min="0"
              step="50"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(Number(e.target.value))}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg dark:bg-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Annual Interest Rate (%)
            </label>
            <input
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg dark:bg-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Compounding Frequency
            </label>
            <select
              value={compoundingFrequency}
              onChange={(e) => setCompoundingFrequency(e.target.value as CompoundingFrequency)}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg dark:bg-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {COMPOUNDING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Time Period (years)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={timePeriod}
              onChange={(e) => setTimePeriod(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg dark:bg-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Contribution vs Interest Bar */}
      <div className="card p-6">
        <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
          Balance Breakdown
        </h3>
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#14b8a6' }} />
            <span className="text-sm text-stone-600 dark:text-stone-400">
              Contributions {contributionPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
            <span className="text-sm text-stone-600 dark:text-stone-400">
              Interest {interestPercent.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="w-full h-6 rounded-full overflow-hidden bg-stone-200 dark:bg-stone-700 flex">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${contributionPercent}%`,
              backgroundColor: '#14b8a6',
            }}
          />
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${interestPercent}%`,
              backgroundColor: '#8b5cf6',
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
            {formatCurrency(results.totalContributions)}
          </span>
          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
            {formatCurrency(results.totalInterest)}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
            >
              <TrendingUp className="w-5 h-5" style={{ color: '#10b981' }} />
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400">Final Balance</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#10b981' }}>
            {formatCurrency(results.finalBalance)}
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
            >
              <DollarSign className="w-5 h-5" style={{ color: '#14b8a6' }} />
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400">Total Contributions</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#14b8a6' }}>
            {formatCurrency(results.totalContributions)}
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}
            >
              <Calculator className="w-5 h-5" style={{ color: '#8b5cf6' }} />
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400">Total Interest Earned</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>
            {formatCurrency(results.totalInterest)}
          </p>
        </div>

        {compoundingFrequency !== 'annually' && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
              >
                <Percent className="w-5 h-5" style={{ color: '#f59e0b' }} />
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400">Effective Annual Rate</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
              {results.effectiveAnnualRate.toFixed(2)}%
            </p>
          </div>
        )}

        {compoundingFrequency === 'annually' && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
              >
                <Percent className="w-5 h-5" style={{ color: '#f59e0b' }} />
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400">Annual Rate</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
              {annualRate.toFixed(2)}%
            </p>
          </div>
        )}
      </div>

      {/* Growth Chart */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">
          Growth Over Time
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={results.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis
                dataKey="year"
                tick={{ fill: '#78716c', fontSize: 12 }}
                label={{ value: 'Year', position: 'insideBottomRight', offset: -5, fill: '#78716c' }}
              />
              <YAxis
                tickFormatter={(value: number) => {
                  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
                  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
                  return `$${value}`;
                }}
                tick={{ fill: '#78716c', fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                labelFormatter={(label: number) => `Year ${label}`}
                contentStyle={{
                  backgroundColor: '#292524',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="Contributions"
                stackId="1"
                stroke="#14b8a6"
                fill="#14b8a6"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="Interest"
                stackId="1"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Year-by-Year Breakdown Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-stone-200 dark:border-stone-700">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
            Year-by-Year Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 dark:bg-stone-800">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-stone-600 dark:text-stone-400">
                  Year
                </th>
                <th className="text-right py-3 px-4 font-medium text-stone-600 dark:text-stone-400">
                  Starting Balance
                </th>
                <th className="text-right py-3 px-4 font-medium text-stone-600 dark:text-stone-400">
                  Contributions
                </th>
                <th className="text-right py-3 px-4 font-medium text-stone-600 dark:text-stone-400">
                  Interest Earned
                </th>
                <th className="text-right py-3 px-4 font-medium text-stone-600 dark:text-stone-400">
                  Ending Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {results.yearlyBreakdown.map((row, idx) => (
                <tr
                  key={row.year}
                  className={
                    idx % 2 === 0
                      ? 'bg-white dark:bg-stone-900'
                      : 'bg-stone-50 dark:bg-stone-800'
                  }
                >
                  <td className="py-3 px-4 text-stone-900 dark:text-white font-medium">
                    {row.year}
                  </td>
                  <td className="py-3 px-4 text-right text-stone-600 dark:text-stone-400">
                    {formatCurrency(row.startingBalance)}
                  </td>
                  <td className="py-3 px-4 text-right text-teal-600 dark:text-teal-400">
                    {formatCurrency(row.contributions)}
                  </td>
                  <td className="py-3 px-4 text-right text-purple-600 dark:text-purple-400">
                    {formatCurrency(row.interestEarned)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-stone-900 dark:text-white">
                    {formatCurrency(row.endingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
