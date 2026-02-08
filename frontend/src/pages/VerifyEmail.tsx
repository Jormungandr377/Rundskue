import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { authApi } from '../services/api'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  // Resend state
  const [resendEmail, setResendEmail] = useState('')
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (token) {
      verifyToken(token)
    }
  }, [token])

  const verifyToken = async (verificationToken: string) => {
    setStatus('verifying')
    try {
      await authApi.verifyEmail(verificationToken)
      setStatus('success')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Verification failed. The link may have expired.')
      setStatus('error')
    }
  }

  const handleResend = async () => {
    if (!resendEmail) return
    setResendStatus('sending')
    try {
      await authApi.resendVerification(resendEmail)
      setResendStatus('sent')
    } catch {
      setResendStatus('sent') // Always show sent to prevent enumeration
    }
  }

  // Token verification flow
  if (token) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-stone-900">Finance Tracker</h1>
            <p className="text-stone-500 mt-2">Email verification</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-8">
            {status === 'verifying' && (
              <div className="text-center py-4">
                <Loader2 className="w-12 h-12 text-teal-500 animate-spin mx-auto mb-4" />
                <p className="text-stone-500">Verifying your email...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-stone-900 mb-2">Email verified!</h2>
                <p className="text-stone-500 text-sm mb-6">
                  Your email has been verified successfully. You can now sign in.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-sm"
                >
                  Sign in
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center py-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-stone-900 mb-2">Verification failed</h2>
                <p className="text-stone-500 text-sm mb-6">{error}</p>
                {/* Resend form */}
                <div className="text-left mt-6">
                  <p className="text-sm text-stone-500 mb-3">Request a new verification link:</p>
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors mb-3"
                  />
                  {resendStatus === 'sent' ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
                      A new verification link has been sent if the email exists.
                    </div>
                  ) : (
                    <button
                      onClick={handleResend}
                      disabled={!resendEmail || resendStatus === 'sending'}
                      className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium text-sm"
                    >
                      {resendStatus === 'sending' ? 'Sending...' : 'Resend verification email'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-stone-500 mt-6">
            <Link to="/login" className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium">
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // No token -- "Check your email" page (shown after signup redirect)
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-900">Finance Tracker</h1>
          <p className="text-stone-500 mt-2">Verify your email</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-8">
          <div className="text-center py-4">
            <Mail className="w-12 h-12 text-teal-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-stone-900 mb-2">Check your email</h2>
            <p className="text-stone-500 text-sm mb-6">
              We sent a verification link to your email address. Click the link to verify your account.
            </p>

            {/* Resend section */}
            {resendStatus === 'sent' ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm mb-4">
                A new verification link has been sent if the email exists.
              </div>
            ) : (
              <div className="mt-6">
                <p className="text-sm text-stone-500 mb-3">Didn't receive the email?</p>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors mb-3"
                />
                <button
                  onClick={handleResend}
                  disabled={!resendEmail || resendStatus === 'sending'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium text-sm"
                >
                  {resendStatus === 'sending' ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Mail className="w-5 h-5" />
                  )}
                  Resend verification email
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-stone-500 mt-6">
          <Link to="/login" className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </p>

        <div className="flex justify-center gap-3 mt-8 text-xs text-stone-400">
          <Link to="/privacy" className="hover:text-stone-600 transition-colors">Privacy</Link>
          <span>&middot;</span>
          <Link to="/security" className="hover:text-stone-600 transition-colors">Security</Link>
          <span>&middot;</span>
          <Link to="/data-retention" className="hover:text-stone-600 transition-colors">Data Retention</Link>
        </div>
      </div>
    </div>
  )
}
