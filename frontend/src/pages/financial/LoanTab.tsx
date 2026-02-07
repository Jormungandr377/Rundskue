import { useState, useMemo } from 'react';
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
import {
  Home,
  Car,
  User,
  GraduationCap,
  DollarSign,
  Calendar,
  TrendingDown,
  Clock,
} from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

type LoanPreset = 'mortgage' | 'auto' | 'personal' | 'student';

interface LoanPresetConfig {
  label: string;
  icon: typeof Home;
  amount: number;
  rate: number;
  term: number;
}

const LOAN_PRESETS: Record<LoanPreset, LoanPresetConfig> = {
  mortgage: { label: 'Mortgage', icon: Home, amount: 300000, rate: 6.5, term: 30 },
  auto: { label: 'Auto', icon: Car, amount: 35000, rate: 7.0, term: 5 },
  personal: { label: 'Personal', icon: User, amount: 15000, rate: 10.0, term: 3 },
  student: { label: 'Student', icon: GraduationCap, amount: 50000, rate: 5.5, term: 10 },
};

interface YearlySummary {
  year: number;
  startingBalance: number;
  totalPaid: number;
  principal: number;
  interest: number;
  endingBalance: number;
}

interface PaymentChartData {
  year: number;
  principal: number;
  interest: number;
}

interface AmortizationResult {
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  payoffDate: Date;
  yearlySchedule: YearlySummary[];
  chartData: PaymentChartData[];
  // With extra payments
  extraTotalInterest: number;
  extraTotalCost: number;
  extraPayoffDate: Date;
  extraMonthsPaid: number;
  monthsSaved: number;
  interestSaved: number;
  extraYearlySchedule: YearlySummary[];
}

function calculateAmortization(
  principal: number,
  annualRate: number,
  termYears: number,
  extraMonthly: number
): AmortizationResult | null {
  if (principal <= 0 || annualRate <= 0 || termYears <= 0) return null;

  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  const monthlyPayment = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  if (!isFinite(monthlyPayment) || isNaN(monthlyPayment)) return null;

  // Standard amortization (no extra payments)
  const yearlySchedule: YearlySummary[] = [];
  const chartData: PaymentChartData[] = [];
  let balance = principal;
  let totalInterest = 0;

  for (let year = 1; year <= termYears; year++) {
    const startingBalance = balance;
    let yearPrincipal = 0;
    let yearInterest = 0;
    let yearTotalPaid = 0;

    for (let month = 1; month <= 12; month++) {
      if (balance <= 0) break;
      const interestPayment = balance * r;
      let principalPayment = monthlyPayment - interestPayment;
      if (principalPayment > balance) principalPayment = balance;
      const payment = interestPayment + principalPayment;

      yearInterest += interestPayment;
      yearPrincipal += principalPayment;
      yearTotalPaid += payment;
      totalInterest += interestPayment;
      balance -= principalPayment;
      if (balance < 0.01) balance = 0;
    }

    yearlySchedule.push({
      year,
      startingBalance,
      totalPaid: yearTotalPaid,
      principal: yearPrincipal,
      interest: yearInterest,
      endingBalance: balance,
    });

    chartData.push({
      year,
      principal: Math.round(yearPrincipal),
      interest: Math.round(yearInterest),
    });
  }

  const totalCost = principal + totalInterest;
  const now = new Date();
  const payoffDate = new Date(now.getFullYear(), now.getMonth() + n, 1);

  // With extra payments
  const extraYearlySchedule: YearlySummary[] = [];
  let extraBalance = principal;
  let extraTotalInterest = 0;
  let extraMonthsPaid = 0;
  let extraDone = false;

  for (let year = 1; year <= termYears; year++) {
    if (extraDone) break;
    const startingBalance = extraBalance;
    let yearPrincipal = 0;
    let yearInterest = 0;
    let yearTotalPaid = 0;

    for (let month = 1; month <= 12; month++) {
      if (extraBalance <= 0) {
        extraDone = true;
        break;
      }
      const interestPayment = extraBalance * r;
      let principalPayment = monthlyPayment + extraMonthly - interestPayment;
      if (principalPayment > extraBalance) principalPayment = extraBalance;
      const payment = interestPayment + principalPayment;

      yearInterest += interestPayment;
      yearPrincipal += principalPayment;
      yearTotalPaid += payment;
      extraTotalInterest += interestPayment;
      extraBalance -= principalPayment;
      extraMonthsPaid++;
      if (extraBalance < 0.01) {
        extraBalance = 0;
        extraDone = true;
        break;
      }
    }

    extraYearlySchedule.push({
      year,
      startingBalance,
      totalPaid: yearTotalPaid,
      principal: yearPrincipal,
      interest: yearInterest,
      endingBalance: extraBalance,
    });
  }

  const extraTotalCost = principal + extraTotalInterest;
  const extraPayoffDate = new Date(now.getFullYear(), now.getMonth() + extraMonthsPaid, 1);
  const monthsSaved = n - extraMonthsPaid;
  const interestSaved = totalInterest - extraTotalInterest;

  return {
    monthlyPayment,
    totalInterest,
    totalCost,
    payoffDate,
    yearlySchedule,
    chartData,
    extraTotalInterest,
    extraTotalCost,
    extraPayoffDate,
    extraMonthsPaid,
    monthsSaved,
    interestSaved,
    extraYearlySchedule,
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (years === 0) return `${remaining} month${remaining !== 1 ? 's' : ''}`;
  if (remaining === 0) return `${years} year${years !== 1 ? 's' : ''}`;
  return `${years} yr${years !== 1 ? 's' : ''} ${remaining} mo`;
}

export default function LoanTab() {
  const [activePreset, setActivePreset] = useState<LoanPreset>('mortgage');
  const [loanAmount, setLoanAmount] = useState(300000);
  const [annualRate, setAnnualRate] = useState(6.5);
  const [termYears, setTermYears] = useState(30);
  const [extraPayment, setExtraPayment] = useState(0);

  const handlePresetChange = (preset: LoanPreset) => {
    const config = LOAN_PRESETS[preset];
    setActivePreset(preset);
    setLoanAmount(config.amount);
    setAnnualRate(config.rate);
    setTermYears(config.term);
    setExtraPayment(0);
  };

  const result = useMemo(
    () => calculateAmortization(loanAmount, annualRate, termYears, extraPayment),
    [loanAmount, annualRate, termYears, extraPayment]
  );

  const hasExtra = extraPayment > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Loan Calculator</h1>
        <p className="text-stone-500 dark:text-stone-400">
          Calculate payments, compare payoff strategies, and view amortization schedules
        </p>
      </div>

      {/* Loan Type Presets */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
          Loan Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.entries(LOAN_PRESETS) as [LoanPreset, LoanPresetConfig][]).map(
            ([key, preset]) => {
              const Icon = preset.icon;
              const isActive = activePreset === key;
              return (
                <button
                  key={key}
                  onClick={() => handlePresetChange(key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                    isActive
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                      : 'border-stone-200 dark:border-stone-600 hover:border-stone-300 dark:hover:border-stone-500 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-stone-400 dark:text-stone-500'}`} />
                  <div className="text-left">
                    <p className="font-medium text-sm">{preset.label}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {formatCurrency(preset.amount)} / {preset.rate}%
                    </p>
                  </div>
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Input Form */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Loan Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Loan Amount ($)
            </label>
            <input
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              min={0}
              step={1000}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg dark:bg-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Annual Interest Rate (%)
            </label>
            <input
              type="number"
              value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              min={0}
              max={50}
              step={0.1}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg dark:bg-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Loan Term (years)
            </label>
            <input
              type="number"
              value={termYears}
              onChange={(e) => setTermYears(Number(e.target.value))}
              min={1}
              max={50}
              step={1}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg dark:bg-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              Extra Monthly Payment ($)
            </label>
            <input
              type="number"
              value={extraPayment}
              onChange={(e) => setExtraPayment(Number(e.target.value))}
              min={0}
              step={50}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-600 rounded-lg dark:bg-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {result && (
        <>
          {/* Summary Cards */}
          <div className={`grid gap-4 ${hasExtra ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2 lg:grid-cols-4'}`}>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-teal-500" />
                <p className="text-sm text-stone-500 dark:text-stone-400">Monthly Payment</p>
              </div>
              <p className="text-xl font-bold text-stone-900 dark:text-white">
                {formatCurrency(result.monthlyPayment)}
              </p>
              {hasExtra && (
                <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                  + {formatCurrency(extraPayment)} extra
                </p>
              )}
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <p className="text-sm text-stone-500 dark:text-stone-400">Total Interest</p>
              </div>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(hasExtra ? result.extraTotalInterest : result.totalInterest)}
              </p>
              {hasExtra && (
                <p className="text-xs text-stone-400 dark:text-stone-500 line-through mt-1">
                  {formatCurrency(result.totalInterest)}
                </p>
              )}
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-purple-500" />
                <p className="text-sm text-stone-500 dark:text-stone-400">Total Cost</p>
              </div>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(hasExtra ? result.extraTotalCost : result.totalCost)}
              </p>
              {hasExtra && (
                <p className="text-xs text-stone-400 dark:text-stone-500 line-through mt-1">
                  {formatCurrency(result.totalCost)}
                </p>
              )}
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <p className="text-sm text-stone-500 dark:text-stone-400">Payoff Date</p>
              </div>
              <p className="text-xl font-bold text-stone-900 dark:text-white">
                {formatDate(hasExtra ? result.extraPayoffDate : result.payoffDate)}
              </p>
              {hasExtra && (
                <p className="text-xs text-stone-400 dark:text-stone-500 line-through mt-1">
                  {formatDate(result.payoffDate)}
                </p>
              )}
            </div>

            {hasExtra && (
              <>
                <div className="card p-4 border-green-200 dark:border-green-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    <p className="text-sm text-stone-500 dark:text-stone-400">Time Saved</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatMonths(result.monthsSaved)}
                  </p>
                </div>

                <div className="card p-4 border-green-200 dark:border-green-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <p className="text-sm text-stone-500 dark:text-stone-400">Interest Saved</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(result.interestSaved)}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Payment Breakdown Chart */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">
              Payment Breakdown Over Time
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="year"
                    label={{ value: 'Year', position: 'insideBottomRight', offset: -5 }}
                    tick={{ fill: '#78716c', fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fill: '#78716c', fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    labelFormatter={(label) => `Year ${label}`}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e7e5e4',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="principal"
                    name="Principal"
                    stackId="1"
                    stroke="#14b8a6"
                    fill="#14b8a6"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="interest"
                    name="Interest"
                    stackId="1"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 text-center">
              Notice how principal payments increase over time while interest payments decrease
            </p>
          </div>

          {/* Amortization Schedule Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-stone-200 dark:border-stone-700">
              <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
                Amortization Schedule (Yearly Summary)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 dark:bg-stone-700/50 border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-stone-600 dark:text-stone-300">Year</th>
                    <th className="text-right py-3 px-4 font-medium text-stone-600 dark:text-stone-300">Starting Balance</th>
                    <th className="text-right py-3 px-4 font-medium text-stone-600 dark:text-stone-300">Total Paid</th>
                    <th className="text-right py-3 px-4 font-medium text-stone-600 dark:text-stone-300">Principal</th>
                    <th className="text-right py-3 px-4 font-medium text-stone-600 dark:text-stone-300">Interest</th>
                    <th className="text-right py-3 px-4 font-medium text-stone-600 dark:text-stone-300">Ending Balance</th>
                    {hasExtra && (
                      <>
                        <th className="text-right py-3 px-4 font-medium text-emerald-600 dark:text-emerald-400 border-l border-stone-200 dark:border-stone-600">
                          Balance (w/ Extra)
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-emerald-600 dark:text-emerald-400">
                          Interest (w/ Extra)
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
                  {result.yearlySchedule.map((row, idx) => {
                    const extraRow = hasExtra ? result.extraYearlySchedule[idx] : null;
                    const extraPaidOff = hasExtra && (!extraRow || extraRow.startingBalance <= 0);

                    return (
                      <tr
                        key={row.year}
                        className={`${
                          idx % 2 === 0
                            ? 'bg-white dark:bg-stone-800'
                            : 'bg-stone-50/50 dark:bg-gray-750/50'
                        } ${extraPaidOff ? 'opacity-50' : ''}`}
                      >
                        <td className="py-3 px-4 font-medium text-stone-900 dark:text-white">{row.year}</td>
                        <td className="py-3 px-4 text-right text-stone-600 dark:text-stone-400">
                          {formatCurrency(row.startingBalance)}
                        </td>
                        <td className="py-3 px-4 text-right text-stone-600 dark:text-stone-400">
                          {formatCurrency(row.totalPaid)}
                        </td>
                        <td className="py-3 px-4 text-right text-teal-600 dark:text-teal-400">
                          {formatCurrency(row.principal)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">
                          {formatCurrency(row.interest)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-stone-900 dark:text-white">
                          {formatCurrency(row.endingBalance)}
                        </td>
                        {hasExtra && (
                          <>
                            <td className="py-3 px-4 text-right border-l border-stone-200 dark:border-stone-600 font-medium text-emerald-600 dark:text-emerald-400">
                              {extraRow && extraRow.startingBalance > 0
                                ? formatCurrency(extraRow.endingBalance)
                                : extraPaidOff
                                  ? 'Paid off'
                                  : formatCurrency(0)}
                            </td>
                            <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                              {extraRow && extraRow.startingBalance > 0
                                ? formatCurrency(extraRow.interest)
                                : '--'}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-stone-50 dark:bg-stone-700/50 border-t-2 border-stone-300 dark:border-stone-600">
                  <tr>
                    <td className="py-3 px-4 font-bold text-stone-900 dark:text-white">Total</td>
                    <td className="py-3 px-4 text-right text-stone-600 dark:text-stone-400">--</td>
                    <td className="py-3 px-4 text-right font-bold text-stone-900 dark:text-white">
                      {formatCurrency(result.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-teal-600 dark:text-teal-400">
                      {formatCurrency(loanAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(result.totalInterest)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-stone-900 dark:text-white">
                      {formatCurrency(0)}
                    </td>
                    {hasExtra && (
                      <>
                        <td className="py-3 px-4 text-right border-l border-stone-200 dark:border-stone-600 font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(0)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(result.extraTotalInterest)}
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && (
        <div className="card p-12 text-center">
          <DollarSign className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stone-900 dark:text-white mb-2">
            Enter loan details above
          </h3>
          <p className="text-stone-500 dark:text-stone-400">
            Fill in valid loan amount, interest rate, and term to see your amortization schedule.
          </p>
        </div>
      )}
    </div>
  );
}
