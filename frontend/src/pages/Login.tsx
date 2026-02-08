import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Shield, Sparkles, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false)
  const [totpCode, setTotpCode] = useState('')

  const from = (location.state as any)?.from?.pathname || '/'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await login(email, password, rememberMe, needs2FA ? totpCode : undefined)

      if (result.requires2FA) {
        setNeeds2FA(true)
        setIsSubmitting(false)
        return
      }

      if (result.success) {
        navigate(from, { replace: true })
      }
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.detail === 'Email not verified') {
        navigate('/verify-email')
        return
      }
      const message = err.response?.data?.detail || 'Invalid email or password'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Animated Gradient */}
      <div className="hidden lg:flex lg:w-1/2 auth-gradient relative overflow-hidden">
        {/* Mesh overlay */}
        <div className="absolute inset-0 mesh-gradient opacity-40" />

        {/* Floating orbs */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-32 right-16 w-48 h-48 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Rundskue</h2>
              <p className="text-sm text-white/60 font-medium">Finance Tracker</p>
            </div>
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            Take control of<br />your finances
          </h1>
          <p className="text-lg text-white/70 max-w-md leading-relaxed">
            Track spending, build budgets, set goals, and gain insights into your financial health — all in one place.
          </p>

          {/* Feature highlights */}
          <div className="mt-12 space-y-4">
            {[
              'Smart budget tracking & envelope system',
              'Automated bank sync via Plaid',
              'Debt payoff planning & net worth tracking',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-white/80">
                <div className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-surface-50 dark:bg-surface-950">
        <div className="max-w-sm w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-glow">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-surface-900 dark:text-white">Rundskue</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Welcome back</h2>
            <p className="text-surface-500 dark:text-surface-400 mt-1.5 text-sm">Sign in to your account to continue</p>
          </div>

          <div className="card p-6">
            {error && (
              <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!needs2FA ? (
                <>
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="input-label">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="input-label">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input pr-11"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me + Forgot password */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 text-primary-600 bg-white dark:bg-surface-800 border-surface-300 dark:border-surface-600 rounded focus:ring-primary-500 focus:ring-2"
                      />
                      <span className="text-sm text-surface-600 dark:text-surface-400">Remember me</span>
                    </label>
                    <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                </>
              ) : (
                /* 2FA Code Input */
                <div>
                  <div className="flex items-center gap-2.5 mb-4 p-3 bg-primary-50 dark:bg-primary-900/10 rounded-xl">
                    <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    <span className="text-sm font-medium text-primary-700 dark:text-primary-300">Two-factor authentication required</span>
                  </div>
                  <label htmlFor="totp" className="input-label">
                    Authentication code
                  </label>
                  <input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="input text-center text-2xl tracking-[0.3em] font-mono"
                    placeholder="000000"
                    autoFocus
                    autoComplete="one-time-code"
                  />
                  <p className="mt-2 text-xs text-surface-500 dark:text-surface-400">
                    Enter the 6-digit code from your authenticator app, or a backup code.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNeeds2FA(false)
                      setTotpCode('')
                      setError('')
                    }}
                    className="mt-3 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors"
                  >
                    &larr; Back to login
                  </button>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-3"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {needs2FA ? 'Verify' : 'Sign in'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors">
              Create one
            </Link>
          </p>

          <div className="flex justify-center gap-3 mt-8 text-xs text-surface-400 dark:text-surface-500">
            <Link to="/privacy" className="hover:text-surface-600 dark:hover:text-surface-300 transition-colors">Privacy</Link>
            <span className="text-surface-300 dark:text-surface-600">&middot;</span>
            <Link to="/security" className="hover:text-surface-600 dark:hover:text-surface-300 transition-colors">Security</Link>
            <span className="text-surface-300 dark:text-surface-600">&middot;</span>
            <Link to="/data-retention" className="hover:text-surface-600 dark:hover:text-surface-300 transition-colors">Data Retention</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
