import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Check, X, Sparkles, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface PasswordCheck {
  label: string
  test: (pw: string) => boolean
}

const passwordChecks: PasswordCheck[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'One special character', test: (pw) => /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(pw) },
]

export default function Signup() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allChecksPassed = passwordChecks.every((check) => check.test(password))
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!allChecksPassed) {
      setError('Password does not meet the requirements')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    try {
      await register(email, password)
      navigate('/verify-email', { replace: true })
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Registration failed. Please try again.'
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
            Start your financial<br />journey today
          </h1>
          <p className="text-lg text-white/70 max-w-md leading-relaxed">
            Join thousands of users who are building better financial habits with Rundskue.
          </p>

          {/* Feature highlights */}
          <div className="mt-12 space-y-4">
            {[
              'Free to use — no hidden fees',
              'Bank-level security with 2FA',
              'Automatic categorization & insights',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-white/80">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Signup Form */}
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
            <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Create your account</h2>
            <p className="text-surface-500 dark:text-surface-400 mt-1.5 text-sm">Get started in under a minute</p>
          </div>

          <div className="card p-6">
            {error && (
              <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    placeholder="Create a password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>

                {/* Password strength indicators */}
                {password.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {passwordChecks.map((check) => {
                      const passed = check.test(password)
                      return (
                        <div key={check.label} className="flex items-center gap-2 text-xs">
                          {passed ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                              <X className="w-2.5 h-2.5 text-surface-400" />
                            </div>
                          )}
                          <span className={passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-400 dark:text-surface-500'}>
                            {check.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="input-label">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`input ${
                    confirmPassword.length > 0 && !passwordsMatch
                      ? 'border-red-300 dark:border-red-700 focus:ring-red-500/30 focus:border-red-500'
                      : ''
                  }`}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">Passwords do not match</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !allChecksPassed || !passwordsMatch}
                className="btn-primary w-full py-3"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Create account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors">
              Sign in
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
