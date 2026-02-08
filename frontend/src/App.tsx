import { Component, type ErrorInfo, type ReactNode, useState, useRef, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Receipt,
  Link2,
  Users,
  LogOut,
  Shield,
  Lock,
  ChevronDown,
  User,
  Menu,
  X,
  Loader2,
  Moon,
  Sun,
  RefreshCw,
  Target,
  Wand2,
  Bell,
  Monitor,
  Calculator,
  Wallet,
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
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const SecurityPolicy = lazy(() => import('./pages/SecurityPolicy'))
const DataRetentionPolicy = lazy(() => import('./pages/DataRetentionPolicy'))

// Page loading spinner for lazy-loaded routes
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
    </div>
  )
}

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
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Something went wrong</h2>
            <p className="text-stone-600 dark:text-stone-400 mb-4">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
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
  { path: '/recurring', icon: RefreshCw, label: 'Bills & Subs' },
  { path: '/goals', icon: Target, label: 'Savings Goals' },
  { path: '/reports', icon: TrendingUp, label: 'Reports' },
  { path: '/planning', icon: Calculator, label: 'Financial Planning' },
  { path: '/rules', icon: Wand2, label: 'Auto-Categorize' },
]

// Theme toggle button
function ThemeToggle() {
  const { effectiveTheme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
      aria-label="Toggle theme"
      title={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
    >
      {effectiveTheme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  )
}

// Notification bell with unread count badge
function NotificationBell() {
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notifications.unreadCount,
    refetchInterval: 60000, // Poll every minute
  })
  const count = data?.count || 0

  return (
    <button
      onClick={() => navigate('/notifications')}
      className="relative p-2 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-teal-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

// User dropdown menu component
function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
      >
        <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">{user.email}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg overflow-hidden z-50">
          <button
            onClick={() => {
              setOpen(false)
              onNavigate?.()
              navigate('/change-password')
            }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
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
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
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
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
          >
            <Monitor className="w-4 h-4" />
            Active Sessions
          </button>
          <div className="border-t border-stone-100 dark:border-stone-700" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// Sidebar content (shared between desktop and mobile)
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <Wallet className="w-4.5 h-4.5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">Finance</h1>
        </div>
        <div className="flex items-center gap-0.5">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      <nav className="mt-1 flex-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg mb-0.5 transition-colors ${
                isActive
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-l-[3px] border-teal-600 dark:border-teal-500 -ml-px'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px] mr-3 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-stone-200 dark:border-stone-700/60 mx-3" />
      <div className="px-3 py-1">
        <NavLink
          to="/link-account"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`
          }
        >
          <Link2 className="w-[18px] h-[18px] mr-3 flex-shrink-0" />
          Link Account
        </NavLink>
        <NavLink
          to="/profiles"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`
          }
        >
          <Users className="w-[18px] h-[18px] mr-3 flex-shrink-0" />
          Profiles
        </NavLink>
      </div>
      <div className="border-t border-stone-200 dark:border-stone-700/60 mx-3" />
      <UserMenu onNavigate={onNavigate} />

      {/* Policy links footer */}
      <div className="mt-auto px-5 py-3 border-t border-stone-200 dark:border-stone-700/60">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-400 dark:text-stone-500">
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Privacy</a>
          <a href="/security" target="_blank" rel="noopener noreferrer" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Security</a>
          <a href="/data-retention" target="_blank" rel="noopener noreferrer" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Data Retention</a>
        </div>
        <p className="text-[10px] text-stone-300 dark:text-stone-600 mt-1">&copy; {new Date().getFullYear()} Rundskue</p>
      </div>
    </>
  )
}

// Main authenticated layout with responsive sidebar
function AuthenticatedLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex transition-colors">
      {/* Skip to main content link - visible only on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden lg:flex w-56 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 fixed h-full flex-col transition-colors" role="navigation" aria-label="Main navigation">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-4 py-3 flex items-center gap-3 transition-colors">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 bg-teal-600 rounded-lg flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">Finance</h1>
        </div>
        <NotificationBell />
        <ThemeToggle />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={closeMobileMenu}
          />
          {/* Sidebar */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-stone-900 flex flex-col animate-slide-in-left shadow-xl transition-colors">
            <div className="absolute top-4 right-4">
              <button
                onClick={closeMobileMenu}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
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
      <main id="main-content" className="lg:ml-56 flex-1 p-4 pt-16 lg:p-8 lg:pt-8">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/recurring" element={<RecurringBills />} />
              <Route path="/reports" element={<Reports />} />
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
