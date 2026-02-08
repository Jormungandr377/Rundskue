import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ShieldCheck, ShieldOff, Copy, Check, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../services/api'

type SetupStep = 'password' | 'scan' | 'verify' | 'complete' | 'disable'

export default function TwoFactorSetup() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()

  const [step, setStep] = useState<SetupStep>(user?.totp_enabled ? 'disable' : 'password')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [totpCode, setTotpCode] = useState('')
  const [disableTotpCode, setDisableTotpCode] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  // Step 1: Enter password to begin setup
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const data = await authApi.setup2FA(password)
      setQrCode(data.qr_code)
      setSecret(data.secret)
      setBackupCodes(data.backup_codes)
      setStep('scan')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Incorrect password')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Step 3: Verify TOTP code
  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await authApi.verify2FA(totpCode)
      await refreshUser()
      setStep('complete')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Disable 2FA
  const handleDisable = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await authApi.disable2FA({ password, totp_code: disableTotpCode || undefined })
      await refreshUser()
      navigate(-1)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to disable 2FA')
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = async (text: string, type: 'secret' | 'codes') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'secret') {
        setCopiedSecret(true)
        setTimeout(() => setCopiedSecret(false), 2000)
      } else {
        setCopiedCodes(true)
        setTimeout(() => setCopiedCodes(false), 2000)
      }
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-primary-600" />
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Two-Factor Authentication</h1>
          <p className="text-surface-500 text-sm">
            {user?.totp_enabled
              ? '2FA is currently enabled on your account'
              : 'Add an extra layer of security to your account'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-surface-100 p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Step: Enter password */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <p className="text-sm text-surface-600">
              To set up two-factor authentication, first verify your identity by entering your password.
            </p>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-surface-700 mb-1">
                Current password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Continue'
              )}
            </button>
          </form>
        )}

        {/* Step: Scan QR code */}
        {step === 'scan' && (
          <div className="space-y-5">
            <p className="text-sm text-surface-600">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.).
            </p>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-white p-4 border-2 border-surface-200 rounded-lg">
                <img src={`data:image/png;base64,${qrCode}`} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            </div>

            {/* Manual entry key */}
            <div>
              <p className="text-xs text-surface-500 mb-1">Or enter this key manually:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-surface-50 px-3 py-2 rounded-lg text-sm font-mono text-surface-700 break-all">
                  {secret}
                </code>
                <button
                  onClick={() => copyToClipboard(secret, 'secret')}
                  className="p-2 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-50"
                  title="Copy secret"
                >
                  {copiedSecret ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Backup codes */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-amber-800">Backup codes</h3>
                <button
                  onClick={() => copyToClipboard(backupCodes.join('\n'), 'codes')}
                  className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
                >
                  {copiedCodes ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCodes ? 'Copied!' : 'Copy all'}
                </button>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                Save these backup codes in a secure place. Each code can only be used once.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {backupCodes.map((code, i) => (
                  <code key={i} className="bg-white px-2.5 py-1.5 rounded text-sm font-mono text-center text-surface-700">
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep('verify')}
              className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              I've saved the codes, continue
            </button>
          </div>
        )}

        {/* Step: Verify code */}
        {step === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-5">
            <p className="text-sm text-surface-600">
              Enter the 6-digit code from your authenticator app to verify setup.
            </p>
            <div>
              <label htmlFor="totp" className="block text-sm font-medium text-surface-700 mb-1">
                Verification code
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
                className="w-full px-4 py-2.5 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors text-center text-2xl tracking-widest"
                placeholder="000000"
                autoFocus
                autoComplete="one-time-code"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || totpCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Verify and enable 2FA'
              )}
            </button>
          </form>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div className="text-center py-4">
            <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-surface-900 mb-2">2FA is now enabled!</h2>
            <p className="text-surface-500 text-sm mb-6">
              Your account is now protected with two-factor authentication. You'll need your authenticator app each time you sign in.
            </p>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
            >
              Done
            </button>
          </div>
        )}

        {/* Step: Disable 2FA */}
        {step === 'disable' && (
          <form onSubmit={handleDisable} className="space-y-5">
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                2FA is currently enabled. Disabling it will make your account less secure.
              </p>
            </div>

            <div>
              <label htmlFor="disablePassword" className="block text-sm font-medium text-surface-700 mb-1">
                Current password
              </label>
              <div className="relative">
                <input
                  id="disablePassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="disableTotp" className="block text-sm font-medium text-surface-700 mb-1">
                Authentication code
              </label>
              <input
                id="disableTotp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={disableTotpCode}
                onChange={(e) => setDisableTotpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2.5 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors text-center text-2xl tracking-widest"
                placeholder="000000"
                autoComplete="one-time-code"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 px-4 py-2.5 border border-surface-300 text-surface-700 rounded-lg hover:bg-surface-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldOff className="w-4 h-4" />
                    Disable 2FA
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
