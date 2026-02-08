import { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  PiggyBank,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calculator,
  Briefcase,
} from 'lucide-react';
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

type AccountType = '401k' | 'traditional_ira' | 'roth_ira' | 'roth_401k' | '403b';

interface YearData {
  year: number;
  age: number;
  salary: number;
  contribution: number;
  employerMatch: number;
  growth: number;
  balance: number;
  totalContributions: number;
  totalEmployerMatch: number;
  totalGrowth: number;
}

interface ProjectionResult {
  yearByYear: YearData[];
  finalBalance: number;
  totalContributions: number;
  totalEmployerMatch: number;
  totalGrowth: number;
  monthlyRetirementIncome: number;
  afterTaxMonthlyIncome: number;
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: '401k', label: '401(k)' },
  { value: 'traditional_ira', label: 'Traditional IRA' },
  { value: 'roth_ira', label: 'Roth IRA' },
  { value: 'roth_401k', label: 'Roth 401(k)' },
  { value: '403b', label: '403(b)' },
];

import { formatCurrency } from '../../utils/format';

const TAX_BRACKETS = [10, 12, 22, 24, 32, 35, 37];

function getContributionLimit(accountType: AccountType, age: number): number {
  const is50Plus = age >= 50;
  if (accountType === 'traditional_ira' || accountType === 'roth_ira') {
    return is50Plus ? 8000 : 7000;
  }
  // 401(k), Roth 401(k), 403(b)
  return is50Plus ? 30500 : 23000;
}

function hasEmployerMatch(accountType: AccountType): boolean {
  return accountType === '401k' || accountType === '403b';
}

function isRothAccount(accountType: AccountType): boolean {
  return accountType === 'roth_ira' || accountType === 'roth_401k';
}

export default function RetirementTab() {
  const [accountType, setAccountType] = useState<AccountType>('401k');
  const [currentAge, setCurrentAge] = useState(30);
  const [retirementAge, setRetirementAge] = useState(65);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [annualContribution, setAnnualContribution] = useState(6000);
  const [expectedReturn, setExpectedReturn] = useState(7.0);
  const [employerMatchPct, setEmployerMatchPct] = useState(3.0);
  const [annualSalary, setAnnualSalary] = useState(60000);
  const [annualRaisePct, setAnnualRaisePct] = useState(2.0);
  const [taxBracket, setTaxBracket] = useState(22);
  const [showAllYears, setShowAllYears] = useState(false);

  const showEmployerMatch = hasEmployerMatch(accountType);
  const isRoth = isRothAccount(accountType);

  // Contribution limit warning
  const contributionWarning = useMemo(() => {
    const limit = getContributionLimit(accountType, currentAge);
    if (annualContribution > limit) {
      const typeLabel = ACCOUNT_TYPES.find((t) => t.value === accountType)?.label || accountType;
      const catchUp = currentAge >= 50 ? ' (catch-up)' : '';
      return `The 2024 ${typeLabel} contribution limit is ${formatCurrency(limit)}${catchUp}. Your contribution of ${formatCurrency(annualContribution)} exceeds this limit.`;
    }
    return null;
  }, [accountType, currentAge, annualContribution]);

  const projection = useMemo<ProjectionResult>(() => {
    const years = retirementAge - currentAge;
    if (years <= 0) {
      return {
        yearByYear: [],
        finalBalance: currentBalance,
        totalContributions: 0,
        totalEmployerMatch: 0,
        totalGrowth: 0,
        monthlyRetirementIncome: (currentBalance * 0.04) / 12,
        afterTaxMonthlyIncome: isRoth
          ? (currentBalance * 0.04) / 12
          : ((currentBalance * 0.04) / 12) * (1 - taxBracket / 100),
      };
    }

    const returnRate = expectedReturn / 100;
    const raiseRate = annualRaisePct / 100;
    const matchRate = employerMatchPct / 100;

    let balance = currentBalance;
    let cumulativeContributions = 0;
    let cumulativeMatch = 0;
    let cumulativeGrowth = 0;
    const yearByYear: YearData[] = [];

    for (let i = 0; i < years; i++) {
      const age = currentAge + i;
      const salary = annualSalary * Math.pow(1 + raiseRate, i);
      const limit = getContributionLimit(accountType, age);
      const contribution = Math.min(annualContribution, limit);
      const match = showEmployerMatch ? salary * matchRate : 0;
      const yearGrowth = balance * returnRate;

      balance = balance + contribution + match + yearGrowth;
      cumulativeContributions += contribution;
      cumulativeMatch += match;
      cumulativeGrowth += yearGrowth;

      yearByYear.push({
        year: i + 1,
        age: age + 1,
        salary: Math.round(salary),
        contribution: Math.round(contribution),
        employerMatch: Math.round(match),
        growth: Math.round(yearGrowth),
        balance: Math.round(balance),
        totalContributions: Math.round(cumulativeContributions),
        totalEmployerMatch: Math.round(cumulativeMatch),
        totalGrowth: Math.round(cumulativeGrowth),
      });
    }

    const monthlyIncome = (balance * 0.04) / 12;
    const afterTaxMonthly = isRoth ? monthlyIncome : monthlyIncome * (1 - taxBracket / 100);

    return {
      yearByYear,
      finalBalance: Math.round(balance),
      totalContributions: Math.round(cumulativeContributions),
      totalEmployerMatch: Math.round(cumulativeMatch),
      totalGrowth: Math.round(cumulativeGrowth),
      monthlyRetirementIncome: Math.round(monthlyIncome),
      afterTaxMonthlyIncome: Math.round(afterTaxMonthly),
    };
  }, [
    currentAge,
    retirementAge,
    currentBalance,
    annualContribution,
    expectedReturn,
    employerMatchPct,
    annualSalary,
    annualRaisePct,
    taxBracket,
    accountType,
    showEmployerMatch,
    isRoth,
  ]);

  // Chart data: stacked contributions + growth
  const chartData = useMemo(() => {
    return projection.yearByYear.map((row) => ({
      age: row.age,
      Contributions: row.totalContributions + row.totalEmployerMatch,
      Growth: row.totalGrowth,
    }));
  }, [projection.yearByYear]);

  const displayedYears = showAllYears
    ? projection.yearByYear
    : projection.yearByYear.slice(0, 10);

  const accountLabel =
    ACCOUNT_TYPES.find((t) => t.value === accountType)?.label || accountType;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
          <Calculator className="w-7 h-7 text-primary-600 dark:text-primary-400" />
          Retirement Projections
        </h1>
        <p className="text-surface-500 dark:text-surface-400">
          Estimate your retirement savings growth over time
        </p>
      </div>

      {/* Account Type Selector */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Account Type
        </label>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setAccountType(type.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                accountType === type.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-surface-500 dark:text-surface-400" />
          {accountLabel} Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Current Age */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Current Age
            </label>
            <input
              type="number"
              min={18}
              max={80}
              value={currentAge}
              onChange={(e) => setCurrentAge(Number(e.target.value))}
              className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Retirement Age */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Retirement Age
            </label>
            <input
              type="number"
              min={currentAge + 1}
              max={100}
              value={retirementAge}
              onChange={(e) => setRetirementAge(Number(e.target.value))}
              className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Current Balance */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Current Balance ($)
            </label>
            <input
              type="number"
              min={0}
              value={currentBalance}
              onChange={(e) => setCurrentBalance(Number(e.target.value))}
              className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Annual Contribution */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Annual Contribution ($)
            </label>
            <input
              type="number"
              min={0}
              value={annualContribution}
              onChange={(e) => setAnnualContribution(Number(e.target.value))}
              className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Expected Return */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Expected Annual Return (%)
            </label>
            <input
              type="number"
              min={0}
              max={30}
              step={0.1}
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(Number(e.target.value))}
              className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Annual Raise */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Annual Raise (%)
            </label>
            <input
              type="number"
              min={0}
              max={20}
              step={0.1}
              value={annualRaisePct}
              onChange={(e) => setAnnualRaisePct(Number(e.target.value))}
              className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Employer Match - only for 401k/403b */}
          {showEmployerMatch && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Employer Match (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={employerMatchPct}
                  onChange={(e) => setEmployerMatchPct(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Annual Salary ($)
                </label>
                <input
                  type="number"
                  min={0}
                  value={annualSalary}
                  onChange={(e) => setAnnualSalary(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </>
          )}

          {/* Tax Bracket */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Tax Bracket (%)
            </label>
            <select
              value={taxBracket}
              onChange={(e) => setTaxBracket(Number(e.target.value))}
              className="w-full px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg dark:bg-surface-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {TAX_BRACKETS.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Contribution Limit Warning */}
        {contributionWarning && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {contributionWarning}
            </p>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Projected Balance at {retirementAge}
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(projection.finalBalance)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full">
              <DollarSign className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Total Contributions</p>
              <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                {formatCurrency(projection.totalContributions)}
              </p>
            </div>
          </div>
        </div>

        {showEmployerMatch && (
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">Total Employer Match</p>
                <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(projection.totalEmployerMatch)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Total Investment Growth</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(projection.totalGrowth)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
              <PiggyBank className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Est. Monthly Income (4% Rule)
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(projection.monthlyRetirementIncome)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full">
              <Calendar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                After-Tax Monthly Income
                {isRoth && (
                  <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">(Roth: tax-free)</span>
                )}
              </p>
              <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                {formatCurrency(projection.afterTaxMonthlyIncome)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Projection Chart */}
      {chartData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Balance Projection Over Time
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="age"
                  label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
                  tick={{ fill: '#78716c', fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value: number) => {
                    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                    return `$${value}`;
                  }}
                  tick={{ fill: '#78716c', fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  labelFormatter={(label) => `Age ${label}`}
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Contributions"
                  stackId="1"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="Growth"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Year-by-Year Breakdown Table */}
      {projection.yearByYear.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
              Year-by-Year Breakdown
            </h3>
            {projection.yearByYear.length > 10 && (
              <button
                onClick={() => setShowAllYears(!showAllYears)}
                className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                {showAllYears ? (
                  <>
                    Show Less <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Show All {projection.yearByYear.length} Years{' '}
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-surface-600 dark:text-surface-400">
                    Year
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-surface-600 dark:text-surface-400">
                    Age
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-surface-600 dark:text-surface-400">
                    Contribution
                  </th>
                  {showEmployerMatch && (
                    <th className="text-right py-3 px-4 font-medium text-surface-600 dark:text-surface-400">
                      Employer Match
                    </th>
                  )}
                  <th className="text-right py-3 px-4 font-medium text-surface-600 dark:text-surface-400">
                    Growth
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-surface-600 dark:text-surface-400">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedYears.map((row, idx) => (
                  <tr
                    key={row.year}
                    className={
                      idx % 2 === 0
                        ? 'bg-white dark:bg-surface-900'
                        : 'bg-surface-50 dark:bg-surface-800/50'
                    }
                  >
                    <td className="py-3 px-4 text-surface-900 dark:text-white">{row.year}</td>
                    <td className="py-3 px-4 text-surface-600 dark:text-surface-400">{row.age}</td>
                    <td className="py-3 px-4 text-right text-primary-600 dark:text-primary-400">
                      {formatCurrency(row.contribution)}
                    </td>
                    {showEmployerMatch && (
                      <td className="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(row.employerMatch)}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(row.growth)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-surface-900 dark:text-white">
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showAllYears && projection.yearByYear.length > 10 && (
            <div className="p-3 text-center border-t border-surface-200 dark:border-surface-700">
              <button
                onClick={() => setShowAllYears(true)}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Show remaining {projection.yearByYear.length - 10} years
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {projection.yearByYear.length === 0 && (
        <div className="card p-12 text-center">
          <Calculator className="w-12 h-12 text-surface-400 dark:text-surface-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-2">
            No projection to display
          </h3>
          <p className="text-surface-500 dark:text-surface-400">
            Your retirement age must be greater than your current age to generate a projection.
          </p>
        </div>
      )}
    </div>
  );
}
