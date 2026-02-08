import { Component, type ErrorInfo, type ReactNode, useState, useRef, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Receipt,
  Link2,
  Users,
  LogOut,
  Shield,
  Lock,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Moon,
  Sun,
  RefreshCw,
  Target,
  Wand2,
  Bell,
  Monitor,
  Calculator,
  Wallet,
  Briefcase,
  BarChart3,
  Split,
  Globe,
  Mail,
  Sparkles,
} from 'lucide-react'

// Auth (loaded eagerly - needed immediately)
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import { useQuery } from '@tanstack/react-query'
import { notifications } from './api'

// Lazy-loaded pages - each becomes its own chunk, loaded on demand
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Budgets = lazy(() => import('./pages/Budgets'))
const Reports = lazy(() => import('./pages/Reports'))
const FinancialPlanning = lazy(() => import('./pages/FinancialPlanning'))
const LinkAccount = lazy(() => import('./pages/LinkAccount'))
const Profiles = lazy(() => import('./pages/Profiles'))
const RecurringBills = lazy(() => import('./pages/RecurringBills'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const TwoFactorSetup = lazy(() => import('./pages/TwoFactorSetup'))
const ChangePassword = lazy(() => import('./pages/ChangePassword'))
const Goals = lazy(() => import('./pages/Goals'))
const Sessions = lazy(() => import('./pages/Sessions'))
const CategoryRules = lazy(() => import('./pages/CategoryRules'))
const NotificationsPage = lazy(() => import('./pages/Notifications'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Envelopes = lazy(() => import('./pages/Envelopes'))
const SpendingControlPage = lazy(() => import('./pages/SpendingControl'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
const CashFlowPage = lazy(() => import('./pages/CashFlow'))
const PaycheckRules = lazy(() => import('./pages/PaycheckRules'))
const DebtPayoff = lazy(() => import('./pages/DebtPayoff'))
const NetWorthPage = lazy(() => import('./pages/NetWorth'))
const InvestmentsPage = lazy(() => import('./pages/Investments'))
const YearInReview = lazy(() => import('./pages/YearInReview'))
const MerchantAnalysis = lazy(() => import('./pages/MerchantAnalysis'))
const BillSplitting = lazy(() => import('./pages/BillSplitting'))
const WebhooksPage = lazy(() => import('./pages/Webhooks'))
const EmailReportsPage = lazy(() => import('./pages/EmailReports'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const SecurityPolicy = lazy(() => import('./pages/SecurityPolicy'))
const DataRetentionPolicy = lazy(() => import('./pages/DataRetentionPolicy'))

// ─── Types ───────────────────────────────────────────────────
interface NavItem {
  path: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

// ─── Navigation Structure ────────────────────────────────────
const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/accounts', icon: CreditCard, label: 'Accounts' },
      { path: '/transactions', icon: Receipt, label: 'Transactions' },
    ],
  },
  {
    title: 'Budgeting',
    items: [
      { path: '/spending-control', icon: Wallet, label: 'Spending Control' },
      { path: '/recurring', icon: RefreshCw, label: 'Bills & Subs' },
      { path: '/subscriptions', icon: CreditCard, label: 'Subscriptions' },
      { path: '/goals', icon: Target, label: 'Savings Goals' },
      { path: '/bill-splitting', icon: Split, label: 'Bill Splitting' },
    ],
  },
  {
    title: 'Wealth',
    items: [
      { path: '/cash-flow', icon: TrendingUp, label: 'Cash Flow' },
      { path: '/debt', icon: CreditCard, label: 'Debt Payoff' },
      { path: '/investments', icon: Briefcase, label: 'Investments' },
      { path: '/net-worth', icon: BarChart3, label: 'Net Worth' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { path: '/reports', icon: TrendingUp, label: 'Reports' },
      { path: '/planning', icon: Calculator, label: 'Financial Planning' },
    ],
  },
  {
    title: 'Automation',
    items: [
      { path: '/rules', icon: Wand2, label: 'Auto-Categorize' },
      { path: '/webhooks', icon: Globe, label: 'Webhooks' },
      { path: '/email-reports', icon: Mail, label: 'Email Reports' },
    ],
  },
]

// ─── Page Loading Spinner ────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 border-3 border-primary-200 dark:border-primary-900/40 rounded-full" />
          <div className="absolute inset-0 w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <span className="text-sm text-surface-400 dark:text-surface-500">Loading...</span>
      </div>
    </div>
  )
}

// ─── Error Boundary ──────────────────────────────────────────
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
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-2">Something went wrong</h2>
            <p className="text-surface-500 dark:text-surface-400 mb-6 text-sm">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-primary"
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

// ─── Theme Toggle ────────────────────────────────────────────
function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { effectiveTheme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className={`${compact ? 'p-2' : 'p-2.5'} rounded-xl text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200`}
      aria-label="Toggle theme"
      title={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
    >
      {effectiveTheme === 'light' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
    </button>
  )
}

// ─── Notification Bell ───────────────────────────────────────
function NotificationBell({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notifications.unreadCount,
    refetchInterval: 60000,
  })
  const count = data?.count || 0

  return (
    <button
      onClick={() => navigate('/notifications')}
      className={`relative ${compact ? 'p-2' : 'p-2.5'} rounded-xl text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200`}
      aria-label="Notifications"
    >
      <Bell className="w-[18px] h-[18px]" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-gradient-to-r from-primary-500 to-accent-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

// ─── Collapsible Nav Group ───────────────────────────────────
function CollapsibleNavGroup({
  group,
  onNavigate,
  defaultOpen = true,
}: {
  group: NavGroup
  onNavigate?: () => void
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const location = useLocation()

  // Auto-expand if any child is active
  const hasActiveChild = group.items.some(
    (item) => item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  )

  useEffect(() => {
    if (hasActiveChild && !isOpen) {
      setIsOpen(true)
    }
  }, [hasActiveChild]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
      >
        <span>{group.title}</span>
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {group.items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl mx-1 mb-0.5 transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-primary-50 to-primary-50/50 dark:from-primary-900/20 dark:to-primary-900/10 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800/60'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/25'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 group-hover:bg-surface-200 dark:group-hover:bg-surface-700'
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                </div>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

// ─── User Menu ───────────────────────────────────────────────
function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setOpen(false)
    onNavigate?.()
    await logout()
    navigate('/login')
  }

  if (!user) return null

  const initial = user.email?.charAt(0).toUpperCase() || 'U'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-surface-50 dark:hover:bg-surface-800/60 transition-all duration-200"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-sm font-bold shadow-sm">
          {initial}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{user.email}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-elevated overflow-hidden z-50 animate-scale-in">
          <button
            onClick={() => {
              setOpen(false)
              onNavigate?.()
              navigate('/change-password')
            }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/60 transition-colors"
          >
            <Lock className="w-4 h-4" />
            Change Password
          </button>
          <button
            onClick={() => {
              setOpen(false)
              onNavigate?.()
              navigate('/2fa-setup')
            }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/60 transition-colors"
          >
            <Shield className="w-4 h-4" />
            {user.totp_enabled ? 'Manage 2FA' : 'Enable 2FA'}
          </button>
          <button
            onClick={() => {
              setOpen(false)
              onNavigate?.()
              navigate('/sessions')
            }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/60 transition-colors"
          >
            <Monitor className="w-4 h-4" />
            Active Sessions
          </button>
          <div className="border-t border-surface-100 dark:border-surface-700" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sidebar Content ─────────────────────────────────────────
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {/* Logo / Brand */}
      <div className="px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-sm shadow-primary-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-surface-900 dark:text-white tracking-tight leading-none">Rundskue</h1>
            <p className="text-[10px] text-surface-400 dark:text-surface-500 font-medium mt-0.5">Finance Tracker</p>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="px-4 pb-3 flex items-center gap-1">
        <NotificationBell compact />
        <ThemeToggle compact />
        <NavLink
          to="/link-account"
          onClick={onNavigate}
          className="p-2 rounded-xl text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200"
          title="Link Account"
        >
          <Link2 className="w-[18px] h-[18px]" />
        </NavLink>
        <NavLink
          to="/profiles"
          onClick={onNavigate}
          className="p-2 rounded-xl text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200"
          title="Profiles"
        >
          <Users className="w-[18px] h-[18px]" />
        </NavLink>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-surface-200/60 dark:border-surface-700/40" />

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto scrollbar-thin" role="navigation" aria-label="Main navigation">
        {navGroups.map((group) => (
          <CollapsibleNavGroup key={group.title} group={group} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-surface-200/60 dark:border-surface-700/40" />

      {/* User Menu */}
      <UserMenu onNavigate={onNavigate} />

      {/* Footer Links */}
      <div className="mt-auto px-5 py-3 border-t border-surface-200/60 dark:border-surface-700/40">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-surface-400 dark:text-surface-500">
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-surface-600 dark:hover:text-surface-300 transition-colors">Privacy</a>
          <a href="/security" target="_blank" rel="noopener noreferrer" className="hover:text-surface-600 dark:hover:text-surface-300 transition-colors">Security</a>
          <a href="/data-retention" target="_blank" rel="noopener noreferrer" className="hover:text-surface-600 dark:hover:text-surface-300 transition-colors">Data Retention</a>
        </div>
        <p className="text-[10px] text-surface-300 dark:text-surface-600 mt-1">&copy; {new Date().getFullYear()} Rundskue</p>
      </div>
    </>
  )
}

// ─── Authenticated Layout ────────────────────────────────────
function AuthenticatedLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex transition-colors duration-300">
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-xl focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-r border-surface-200/60 dark:border-surface-700/40 fixed h-full flex-col transition-colors duration-300">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-b border-surface-200/60 dark:border-surface-700/40 px-4 py-3 flex items-center gap-3 transition-colors duration-300">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-base font-bold text-surface-900 dark:text-white tracking-tight">Rundskue</h1>
        </div>
        <NotificationBell compact />
        <ThemeToggle compact />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={closeMobileMenu}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-surface-900 flex flex-col animate-slide-in-left shadow-2xl transition-colors">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={closeMobileMenu}
                className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent onNavigate={closeMobileMenu} />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main id="main-content" className="lg:ml-60 flex-1 p-4 pt-16 lg:p-8 lg:pt-8">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/envelopes" element={<Envelopes />} />
              <Route path="/spending-control" element={<SpendingControlPage />} />
              <Route path="/recurring" element={<RecurringBills />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/cash-flow" element={<CashFlowPage />} />
              <Route path="/paycheck-rules" element={<PaycheckRules />} />
              <Route path="/debt" element={<DebtPayoff />} />
              <Route path="/investments" element={<InvestmentsPage />} />
              <Route path="/net-worth" element={<NetWorthPage />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/year-in-review" element={<YearInReview />} />
              <Route path="/merchant-analysis" element={<MerchantAnalysis />} />
              <Route path="/bill-splitting" element={<BillSplitting />} />
              <Route path="/webhooks" element={<WebhooksPage />} />
              <Route path="/email-reports" element={<EmailReportsPage />} />
              <Route path="/planning" element={<FinancialPlanning />} />
              <Route path="/link-account" element={<LinkAccount />} />
              <Route path="/profiles" element={<Profiles />} />
              <Route path="/2fa-setup" element={<TwoFactorSetup />} />
              <Route path="/change-password" element={<ChangePassword />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/rules" element={<CategoryRules />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}

// ─── App Root ────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/security" element={<SecurityPolicy />} />
                <Route path="/data-retention" element={<DataRetentionPolicy />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

                {/* Protected routes */}
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <AuthenticatedLayout />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
