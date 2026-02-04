import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, TrendingUp, Calculator, DollarSign } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { tsp } from '../api';
import type { TSPScenario, TSPProjectionResult, TSPFundHistory } from '../types';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const FUND_COLORS = {
  G: '#6b7280',
  F: '#3b82f6',
  C: '#22c55e',
  S: '#f59e0b',
  I: '#8b5cf6',
};

export default function TSPSimulator() {
  const queryClient = useQueryClient();
  const profileId = 1; // In real app, get from context
  
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const { data: scenarios, isLoading: scenariosLoading } = useQuery({
    queryKey: ['tsp', 'scenarios', profileId],
    queryFn: async () => {
      try {
        return await tsp.listScenarios(profileId);
      } catch {
        return [];
      }
    },
  });

  const { data: fundPerformance } = useQuery({
    queryKey: ['tsp', 'fundPerformance'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/tsp/fund-performance');
        if (!response.ok) return null;
        const data = await response.json();
        // Convert array to dict keyed by fund name
        const result: Record<string, { ten_year?: number }> = {};
        if (Array.isArray(data)) {
          for (const item of data) {
            result[item.fund] = item;
          }
        }
        return result;
      } catch {
        return null;
      }
    },
  });

  const { data: projection, isLoading: projectionLoading } = useQuery({
    queryKey: ['tsp', 'projection', selectedScenarioId],
    queryFn: async () => {
      if (!selectedScenarioId) return null;
      try {
        return await tsp.project(selectedScenarioId);
      } catch {
        return null;
      }
    },
    enabled: !!selectedScenarioId,
  });

  const { data: comparison } = useQuery({
    queryKey: ['tsp', 'comparison', compareIds],
    queryFn: async () => {
      if (compareIds.length < 2) return null;
      try {
        return await tsp.compare(compareIds);
      } catch {
        return null;
      }
    },
    enabled: compareIds.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<TSPScenario>) => tsp.createScenario(data),
    onSuccess: (newScenario) => {
      queryClient.invalidateQueries({ queryKey: ['tsp', 'scenarios'] });
      setSelectedScenarioId(newScenario.id);
      setShowCreateModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tsp.deleteScenario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tsp', 'scenarios'] });
      if (selectedScenarioId === deleteMutation.variables) {
        setSelectedScenarioId(null);
      }
    },
  });

  const handleToggleCompare = (id: number) => {
    if (compareIds.includes(id)) {
      setCompareIds(compareIds.filter(i => i !== id));
    } else if (compareIds.length < 4) {
      setCompareIds([...compareIds, id]);
    }
  };

  const selectedScenario = scenarios?.find(s => s.id === selectedScenarioId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TSP Retirement Simulator</h1>
          <p className="text-gray-500">Project your Thrift Savings Plan growth to retirement</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          New Scenario
        </button>
      </div>

      {/* Fund Performance Overview */}
      {fundPerformance && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Historical Fund Returns (10-Year Average)</h3>
          <div className="grid grid-cols-5 gap-4">
            {(['G', 'F', 'C', 'S', 'I'] as const).map((fund) => {
              const data = fundPerformance[fund];
              return (
                <div key={fund} className="text-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-2"
                    style={{ backgroundColor: FUND_COLORS[fund] }}
                  >
                    {fund}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {data?.ten_year?.toFixed(1) || '—'}%
                  </p>
                  <p className="text-xs text-gray-500">
                    {fund === 'G' && 'Government Securities'}
                    {fund === 'F' && 'Fixed Income'}
                    {fund === 'C' && 'Common Stock (S&P)'}
                    {fund === 'S' && 'Small Cap Stock'}
                    {fund === 'I' && 'International'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenarios List */}
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Scenarios</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {scenariosLoading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : scenarios?.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No scenarios yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700"
                >
                  Create your first scenario
                </button>
              </div>
            ) : (
              scenarios?.map((scenario) => (
                <div
                  key={scenario.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedScenarioId === scenario.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedScenarioId(scenario.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{scenario.name}</p>
                      <p className="text-sm text-gray-500">
                        {scenario.contribution_pct}% contribution • Retire at {scenario.retirement_age}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(scenario.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleCompare(scenario.id);
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                        title="Compare"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this scenario?')) {
                            deleteMutation.mutate(scenario.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Projection Details */}
        <div className="lg:col-span-2 space-y-6">
          {projection && selectedScenario ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Current Balance</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(selectedScenario.current_balance)}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Final Balance</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(projection.final_balance)}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Total Contributions</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatCurrency(projection.total_contributions + projection.total_employer_match)}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Investment Growth</p>
                  <p className="text-xl font-bold text-purple-600">
                    {formatCurrency(projection.total_growth)}
                  </p>
                </div>
              </div>

              {/* Allocation */}
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Fund Allocation</h3>
                <div className="flex items-center gap-4">
                  {(['G', 'F', 'C', 'S', 'I'] as const).map((fund) => {
                    const allocObj = (selectedScenario as any).allocation;
                    const alloc = allocObj ? allocObj[fund.toLowerCase()] : (selectedScenario as any)[`allocation_${fund.toLowerCase()}`] || 0;
                    if (!alloc || alloc === 0) return null;
                    return (
                      <div key={fund} className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: FUND_COLORS[fund] }}
                        >
                          {fund}
                        </div>
                        <span className="font-medium">{alloc}%</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Expected return: {(projection.average_return_rate ?? 0).toFixed(1)}% annually
                </p>
              </div>

              {/* Projection Chart */}
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Balance Projection</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projection.projections || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        labelFormatter={(label) => {
                          const p = projection.projections?.find(p => p.year === label);
                          return `Year ${label}${p?.age ? ` (Age ${p.age})` : ''}`;
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="ending_balance"
                        name="Balance"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Year-by-Year Details */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Year-by-Year Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Year</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Age</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Starting Balance</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Your Contribution</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Agency Match</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Growth</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(projection.projections || []).slice(0, 10).map((p: any, idx: number) => (
                        <tr key={p.year} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="py-3 px-4 text-gray-900">{p.year}</td>
                          <td className="py-3 px-4 text-gray-600">{p.age || '—'}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{formatCurrency(p.starting_balance || 0)}</td>
                          <td className="py-3 px-4 text-right text-blue-600">{formatCurrency(p.contribution || 0)}</td>
                          <td className="py-3 px-4 text-right text-green-600">{formatCurrency(p.employer_match || 0)}</td>
                          <td className="py-3 px-4 text-right text-purple-600">{formatCurrency(p.growth || 0)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{formatCurrency(p.ending_balance || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-12 text-center">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a scenario</h3>
              <p className="text-gray-500">
                Choose a scenario from the list to view projections, or create a new one.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Comparison Chart */}
      {comparison && comparison.scenarios && comparison.scenarios.length >= 2 && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Scenario Comparison</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparison.comparison || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                {comparison.scenarios.map((s: any, idx: number) => (
                  <Line
                    key={s.scenario_id}
                    type="monotone"
                    dataKey={`scenario_${s.scenario_id}_balance`}
                    name={s.scenario_name}
                    stroke={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'][idx]}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Create Scenario Modal */}
      {showCreateModal && (
        <CreateScenarioModal
          profileId={profileId}
          onClose={() => setShowCreateModal(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}

interface CreateScenarioModalProps {
  profileId: number;
  onClose: () => void;
  onCreate: (data: Partial<TSPScenario>) => void;
}

function CreateScenarioModal({ profileId, onClose, onCreate }: CreateScenarioModalProps) {
  const [formData, setFormData] = useState({
    name: 'My TSP Scenario',
    current_balance: 0,
    contribution_pct: 5,
    base_pay: 50000,
    annual_pay_increase_pct: 2,
    allocation_g: 0,
    allocation_f: 0,
    allocation_c: 60,
    allocation_s: 30,
    allocation_i: 10,
    allocation_l: 0,
    retirement_age: 60,
    birth_year: 1990,
    use_historical_returns: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      profile_id: profileId,
      ...formData,
    });
  };

  const totalAllocation = formData.allocation_g + formData.allocation_f + formData.allocation_c + formData.allocation_s + formData.allocation_i + formData.allocation_l;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Create TSP Scenario</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scenario Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current TSP Balance</label>
              <input
                type="number"
                value={formData.current_balance}
                onChange={(e) => setFormData({ ...formData, current_balance: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Personal Info */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Birth Year</label>
              <input
                type="number"
                value={formData.birth_year}
                onChange={(e) => setFormData({ ...formData, birth_year: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retirement Age</label>
              <input
                type="number"
                value={formData.retirement_age}
                onChange={(e) => setFormData({ ...formData, retirement_age: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annual Pay Increase %</label>
              <input
                type="number"
                step="0.1"
                value={formData.annual_pay_increase_pct}
                onChange={(e) => setFormData({ ...formData, annual_pay_increase_pct: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Contribution */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annual Base Pay</label>
              <input
                type="number"
                value={formData.base_pay}
                onChange={(e) => setFormData({ ...formData, base_pay: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contribution % (BRS Match up to 5%)</label>
              <input
                type="number"
                step="0.5"
                value={formData.contribution_pct}
                onChange={(e) => setFormData({ ...formData, contribution_pct: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Fund Allocation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fund Allocation (Total: {totalAllocation}%)
              {totalAllocation !== 100 && <span className="text-red-500 ml-2">Must equal 100%</span>}
            </label>
            <div className="grid grid-cols-5 gap-4">
              {(['G', 'F', 'C', 'S', 'I'] as const).map((fund) => (
                <div key={fund}>
                  <label className="block text-xs text-gray-500 mb-1 text-center">{fund} Fund</label>
                  <input
                    type="number"
                    value={formData[`allocation_${fund.toLowerCase()}` as keyof typeof formData]}
                    onChange={(e) => setFormData({
                      ...formData,
                      [`allocation_${fund.toLowerCase()}`]: Number(e.target.value),
                    })}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={totalAllocation !== 100}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Scenario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
