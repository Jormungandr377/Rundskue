import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, Check, X, ArrowLeft } from 'lucide-react'
import { authApi } from '../services/api'
import { useToast } from '../contexts/ToastContext'

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

export default function ChangePassword() {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allChecksPassed = passwordChecks.every((check) => check.test(newPassword))
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!allChecksPassed) {
      setError('New password does not meet the requirements')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      addToast('Password changed successfully! Please sign in again.', 'success')
      // Password change revokes all sessions, redirect to login
      navigate('/login', { replace: true })
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to change password. Please try again.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Change Password</h2>
            <p className="text-sm text-stone-500">Update your account password</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current Password */}
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-stone-700 mb-1">
              Current password
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors pr-10"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-stone-700 mb-1">
              New password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors pr-10"
                placeholder="Create a new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Password strength indicators */}
            {newPassword.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {passwordChecks.map((check) => {
                  const passed = check.test(newPassword)
                  return (
                    <div key={check.label} className="flex items-center gap-2 text-xs">
                      {passed ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-stone-300" />
                      )}
                      <span className={passed ? 'text-emerald-600' : 'text-stone-400'}>
                        {check.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-stone-700 mb-1">
              Confirm new password
            </label>
            <input
              id="confirmNewPassword"
              type={showNew ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors ${
                confirmPassword.length > 0 && !passwordsMatch
                  ? 'border-red-300'
                  : 'border-stone-300'
              }`}
              placeholder="Confirm your new password"
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !allChecksPassed || !passwordsMatch || !currentPassword}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
            Change Password
          </button>
        </form>
      </div>
    </div>
  )
}
