import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  User,
  Link2,
  ArrowRight,
  Check,
  LayoutDashboard,
  Shield,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import { profiles } from '../api';

const STEPS = ['Welcome', 'Profile', 'Connect'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [profileName, setProfileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProfile = async () => {
    if (!profileName.trim()) return;
    setIsCreating(true);
    try {
      await profiles.create({ name: profileName.trim(), is_primary: true });
      setStep(2);
    } catch {
      // If profile already exists, just move on
      setStep(2);
    } finally {
      setIsCreating(false);
    }
  };

  const goToDashboard = () => {
    localStorage.setItem('onboarding_completed', 'true');
    navigate('/', { replace: true });
  };

  const goToLinkAccount = () => {
    localStorage.setItem('onboarding_completed', 'true');
    navigate('/link-account', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Progress indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i < step
                    ? 'bg-emerald-500 text-white'
                    : i === step
                    ? 'bg-teal-600 text-white'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 transition-colors ${
                    i < step ? 'bg-emerald-500' : 'bg-stone-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-stone-100 overflow-hidden">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Wallet className="w-8 h-8 text-teal-600" />
              </div>
              <h1 className="text-2xl font-bold text-stone-900 mb-2">
                Welcome to Finance Tracker
              </h1>
              <p className="text-stone-500 mb-8">
                Your personal finance dashboard. Track spending, set budgets, and reach your savings goals.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8 text-left">
                {[
                  { icon: TrendingUp, label: 'Track spending', desc: 'See where your money goes' },
                  { icon: PiggyBank, label: 'Set budgets', desc: 'Stay on top of expenses' },
                  { icon: Shield, label: 'Secure', desc: 'Bank-level encryption' },
                  { icon: LayoutDashboard, label: 'Dashboard', desc: 'All your finances at a glance' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-stone-50">
                    <Icon className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">{label}</p>
                      <p className="text-xs text-stone-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep(1)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 1: Create Profile */}
          {step === 1 && (
            <div className="p-8">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                <User className="w-6 h-6 text-teal-600" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 text-center mb-2">
                Create Your Profile
              </h2>
              <p className="text-stone-500 text-center mb-6">
                This helps organize your accounts and data.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="profileName" className="block text-sm font-medium text-stone-700 mb-1">
                    Your Name
                  </label>
                  <input
                    id="profileName"
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && profileName.trim()) handleCreateProfile();
                    }}
                  />
                </div>

                <button
                  onClick={handleCreateProfile}
                  disabled={!profileName.trim() || isCreating}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Connect Bank or Skip */}
          {step === 2 && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-2">
                Profile Created!
              </h2>
              <p className="text-stone-500 mb-8">
                Connect your bank account to automatically import transactions, or skip and explore the app first.
              </p>

              <div className="space-y-3">
                <button
                  onClick={goToLinkAccount}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                >
                  <Link2 className="w-4 h-4" />
                  Connect Bank Account
                </button>
                <button
                  onClick={goToDashboard}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Skip to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
