import { Component, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Receipt,
  Settings,
  Link2,
  Users
} from 'lucide-react'

// Pages
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Transactions from './pages/Transactions'
import Budgets from './pages/Budgets'
import Reports from './pages/Reports'
import TSPSimulator from './pages/TSPSimulator'
import LinkAccount from './pages/LinkAccount'
import Profiles from './pages/Profiles'

// Error Boundary
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/accounts', icon: CreditCard, label: 'Accounts' },
  { path: '/transactions', icon: Receipt, label: 'Transactions' },
  { path: '/budgets', icon: PiggyBank, label: 'Budgets' },
  { path: '/reports', icon: TrendingUp, label: 'Reports' },
  { path: '/tsp', icon: TrendingUp, label: 'TSP Simulator' },
]

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 fixed h-full">
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-900">💰 Finance Tracker</h1>
          </div>
          
          <nav className="mt-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          
          <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200">
            <NavLink
              to="/link-account"
              className={({ isActive }) =>
                `flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Link2 className="w-5 h-5 mr-3" />
              Link Account
            </NavLink>
            <NavLink
              to="/profiles"
              className={({ isActive }) =>
                `flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Users className="w-5 h-5 mr-3" />
              Profiles
            </NavLink>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-64 flex-1 p-8">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/tsp" element={<TSPSimulator />} />
              <Route path="/link-account" element={<LinkAccount />} />
              <Route path="/profiles" element={<Profiles />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
