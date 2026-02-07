import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to app
        </Link>

        <div className="bg-white dark:bg-stone-800 rounded-xl shadow-sm border border-stone-200 dark:border-stone-700 p-8 sm:p-10">
          <h1 className="text-3xl font-bold text-stone-900 dark:text-white mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-8">
            Effective date: February 2026
          </p>

          {/* 1. Introduction */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
              1. Introduction
            </h2>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
              Rundskue operates Finance Tracker, a personal financial management tool available at{' '}
              <a
                href="https://finance.rundskue.com"
                className="text-teal-600 dark:text-teal-400 hover:underline"
              >
                finance.rundskue.com
              </a>
              . This Privacy Policy explains how we collect, use, and protect your information when
              you use our service. By using Finance Tracker, you agree to the practices described in
              this policy.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
              2. Information We Collect
            </h2>

            <h3 className="text-lg font-medium text-stone-800 dark:text-stone-200 mt-4 mb-2">
              Account Information
            </h3>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
              When you create an account, we collect your email address and password. Your password
              is hashed using bcrypt and is never stored in plain text.
            </p>

            <h3 className="text-lg font-medium text-stone-800 dark:text-stone-200 mt-4 mb-2">
              Financial Data
            </h3>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
              If you choose to link a bank account, we receive bank account details and transaction
              data synced through Plaid. This data is used solely to provide you with financial
              tracking and budgeting features within the application.
            </p>

            <h3 className="text-lg font-medium text-stone-800 dark:text-stone-200 mt-4 mb-2">
              Usage Data
            </h3>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
              We collect session information, device type, and login timestamps to manage your active
              sessions and ensure the security of your account.
            </p>
          </section>

          {/* 3. How We Use Your Information */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
              3. How We Use Your Information
            </h2>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed mb-3">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700 dark:text-stone-300 leading-relaxed">
              <li>
                To provide financial tracking, budgeting, and reporting features within the
                application.
              </li>
              <li>To sync your bank accounts and transactions via Plaid.</li>
              <li>
                To send you notifications about your accounts, such as budget threshold alerts and
                upcoming bill reminders.
              </li>
              <li>
                For error monitoring via Sentry to improve application reliability. No personally
                identifiable information (PII) is transmitted to Sentry.
              </li>
            </ul>
          </section>

          {/* 4. Third-Party Services */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
              4. Third-Party Services
            </h2>

            <h3 className="text-lg font-medium text-stone-800 dark:text-stone-200 mt-4 mb-2">
              Plaid
            </h3>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
              We use Plaid to securely connect your bank accounts to Finance Tracker. When you link
              an account, Plaid collects and processes your banking credentials and financial data
              according to their own privacy policy. We encourage you to review{' '}
              <a
                href="https://plaid.com/legal/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 dark:text-teal-400 hover:underline"
              >
                Plaid's privacy policy
              </a>{' '}
              for details on how they handle your data.
            </p>

            <h3 className="text-lg font-medium text-stone-800 dark:text-stone-200 mt-4 mb-2">
              Sentry
            </h3>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
              We use Sentry for error monitoring and application performance tracking. No personal
              financial data or personally identifiable information is shared with Sentry.
            </p>
          </section>

          {/* 5. Data Security */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
              5. Data Security
            </h2>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed mb-3">
              We take the security of your data seriously and implement the following measures:
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700 dark:text-stone-300 leading-relaxed">
              <li>All data in transit is protected with HTTPS/TLS encryption.</li>
              <li>Plaid access tokens are encrypted at rest using Fernet symmetric encryption.</li>
              <li>
                Passwords are hashed with bcrypt and are never stored or transmitted in plain text.
              </li>
              <li>
                Two-factor authentication (2FA) is available for additional account security via
                TOTP-based authenticator apps.
              </li>
            </ul>
          </section>

          {/* 6. Data Retention */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
              6. Data Retention
            </h2>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
              Your financial data is retained for as long as your account remains active. If you wish
              to have your data deleted, you may request account deletion at any time by contacting
              us (see Contact section below). Upon deletion, all associated data will be permanently
              removed from our systems.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
              7. Your Rights
            </h2>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed mb-3">
              You have the following rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside space-y-2 text-stone-700 dark:text-stone-300 leading-relaxed">
              <li>
                <span className="font-medium text-stone-800 dark:text-stone-200">Access:</span> You
                can view all of your stored data within the application at any time.
              </li>
              <li>
                <span className="font-medium text-stone-800 dark:text-stone-200">Export:</span> You
                can export your transaction data in CSV or Excel format.
              </li>
              <li>
                <span className="font-medium text-stone-800 dark:text-stone-200">Deletion:</span>{' '}
                You can request complete deletion of your account and all associated data.
              </li>
            </ul>
          </section>

          {/* 8. Contact */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
              8. Contact
            </h2>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
              If you have any questions about this Privacy Policy or wish to exercise your data
              rights, please contact:
            </p>
            <div className="mt-3 p-4 bg-stone-50 dark:bg-stone-700/50 rounded-lg">
              <p className="text-stone-800 dark:text-stone-200 font-medium">Luke Robinson</p>
              <a
                href="mailto:lukerobinson1234377@outlook.com"
                className="text-teal-600 dark:text-teal-400 hover:underline text-sm"
              >
                lukerobinson1234377@outlook.com
              </a>
            </div>
          </section>

          {/* 9. Changes to This Policy */}
          <section>
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
              9. Changes to This Policy
            </h2>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
              We may update this Privacy Policy from time to time. Any changes will be reflected on
              this page with an updated effective date. We encourage you to review this policy
              periodically to stay informed about how we protect your information.
            </p>
            <p className="text-stone-500 dark:text-stone-400 text-sm mt-3">
              Last updated: February 2026
            </p>
          </section>
        </div>

        <div className="text-center mt-6 space-y-2">
          <div className="flex justify-center gap-4 text-sm">
            <Link to="/security" className="text-teal-600 dark:text-teal-400 hover:underline">Security Policy</Link>
            <span className="text-stone-400">&middot;</span>
            <Link to="/data-retention" className="text-teal-600 dark:text-teal-400 hover:underline">Data Retention Policy</Link>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            &copy; {new Date().getFullYear()} Rundskue. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
