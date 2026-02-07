import { useState, lazy, Suspense } from 'react';
import { Calculator, TrendingUp, Landmark, Percent, Loader2 } from 'lucide-react';

const TSPTab = lazy(() => import('./financial/TSPTab'));
const RetirementTab = lazy(() => import('./financial/RetirementTab'));
const LoanTab = lazy(() => import('./financial/LoanTab'));
const CompoundInterestTab = lazy(() => import('./financial/CompoundInterestTab'));

const tabs = [
  { id: 'tsp', label: 'TSP Simulator', icon: Landmark, description: 'Thrift Savings Plan projections' },
  { id: 'retirement', label: 'Retirement', icon: TrendingUp, description: '401(k), IRA & Roth projections' },
  { id: 'loans', label: 'Loan Calculator', icon: Calculator, description: 'Mortgage, auto & personal loans' },
  { id: 'compound', label: 'Compound Interest', icon: Percent, description: 'Investment growth calculator' },
] as const;

type TabId = typeof tabs[number]['id'];

function TabLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  );
}

export default function FinancialPlanning() {
  const [activeTab, setActiveTab] = useState<TabId>('tsp');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Planning</h1>
        <p className="text-gray-500 dark:text-gray-400">Retirement projections, loan calculators, and investment tools</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Financial planning tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                aria-selected={isActive}
                role="tab"
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <Suspense fallback={<TabLoader />}>
        {activeTab === 'tsp' && <TSPTab />}
        {activeTab === 'retirement' && <RetirementTab />}
        {activeTab === 'loans' && <LoanTab />}
        {activeTab === 'compound' && <CompoundInterestTab />}
      </Suspense>
    </div>
  );
}
