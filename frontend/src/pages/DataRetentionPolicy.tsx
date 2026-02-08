import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function DataRetentionPolicy() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to app
        </Link>

        <div className="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 p-8 sm:p-10">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Data Retention Policy
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">
            Finance Tracker by Rundskue &middot; Version 1.0
          </p>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-8">
            Effective date: February 2026
          </p>

          {/* 1. Purpose & Scope */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              1. Purpose &amp; Scope
            </h2>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed">
              This document defines the data retention practices for Finance Tracker, a personal
              finance management application operated by Rundskue at{' '}
              <a href="https://finance.rundskue.com" className="text-primary-600 dark:text-primary-400 hover:underline">
                finance.rundskue.com
              </a>
              . It describes what data is collected, how long it is retained, and how it is deleted.
              This policy applies to all data stored in the PostgreSQL database, application logs,
              and encrypted credentials.
            </p>
          </section>

          {/* 2. Data Categories & Retention Periods */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              2. Data Categories &amp; Retention Periods
            </h2>

            {/* User Account Data */}
            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-5 mb-3">
              User Account Data
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-600">
                    <th className="text-left py-2 pr-4 text-surface-800 dark:text-surface-200 font-medium">Data</th>
                    <th className="text-left py-2 text-surface-800 dark:text-surface-200 font-medium">Retention</th>
                  </tr>
                </thead>
                <tbody className="text-surface-700 dark:text-surface-300">
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">Email address</td>
                    <td className="py-2">While account is active; deleted within 30 days of deletion request</td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">Hashed password</td>
                    <td className="py-2">While account is active; deleted within 30 days of deletion request</td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">2FA secrets</td>
                    <td className="py-2">While 2FA is enabled; deleted when disabled or account deleted</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bank Connection Data */}
            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-5 mb-3">
              Bank Connection Data (Plaid)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-600">
                    <th className="text-left py-2 pr-4 text-surface-800 dark:text-surface-200 font-medium">Data</th>
                    <th className="text-left py-2 text-surface-800 dark:text-surface-200 font-medium">Retention</th>
                  </tr>
                </thead>
                <tbody className="text-surface-700 dark:text-surface-300">
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">Plaid access tokens (encrypted)</td>
                    <td className="py-2">While bank link is active; revoked via Plaid API and deleted on unlink</td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">Account info (name, type, last 4, balances)</td>
                    <td className="py-2">While bank link is active; deleted on unlink or account deletion</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Financial Data */}
            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-5 mb-3">
              Financial Data
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-600">
                    <th className="text-left py-2 pr-4 text-surface-800 dark:text-surface-200 font-medium">Data</th>
                    <th className="text-left py-2 text-surface-800 dark:text-surface-200 font-medium">Retention</th>
                  </tr>
                </thead>
                <tbody className="text-surface-700 dark:text-surface-300">
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">Transactions</td>
                    <td className="py-2">While account is active; deleted within 30 days of deletion request</td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">Budget configurations</td>
                    <td className="py-2">While account is active; deleted within 30 days of deletion request</td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">Savings goals</td>
                    <td className="py-2">While account is active; deleted within 30 days of deletion request</td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">Recurring bills</td>
                    <td className="py-2">While account is active; deleted within 30 days of deletion request</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Session & Logs */}
            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-5 mb-3">
              Session &amp; Log Data
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-600">
                    <th className="text-left py-2 pr-4 text-surface-800 dark:text-surface-200 font-medium">Data</th>
                    <th className="text-left py-2 text-surface-800 dark:text-surface-200 font-medium">Retention</th>
                  </tr>
                </thead>
                <tbody className="text-surface-700 dark:text-surface-300">
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">Session tokens &amp; device info</td>
                    <td className="py-2">Auto-expired after 30 days of inactivity</td>
                  </tr>
                  <tr className="border-b border-surface-100 dark:border-surface-700">
                    <td className="py-2 pr-4">Application logs</td>
                    <td className="py-2">Retained for 90 days, then automatically deleted</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. Data Deletion Procedures */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              3. Data Deletion Procedures
            </h2>

            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-4 mb-2">
              Account Deletion
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>Account is deactivated immediately (login disabled).</li>
              <li>All Plaid access tokens are revoked via the Plaid API, then deleted.</li>
              <li>All user data is permanently deleted from the database within 30 days.</li>
              <li>User is notified by email once deletion is complete.</li>
            </ol>

            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-4 mb-2">
              Bank Account Unlinking
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>Plaid access token is revoked via the Plaid API.</li>
              <li>Token and bank account metadata are deleted from the database.</li>
              <li>Previously synced transactions are retained unless the user explicitly requests deletion.</li>
            </ol>

            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-4 mb-2">
              Automated Expiration
            </h3>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>Sessions inactive for over 30 days are automatically purged.</li>
              <li>Application logs older than 90 days are automatically removed.</li>
            </ul>

            <div className="mt-4 p-4 bg-surface-50 dark:bg-surface-700/50 rounded-lg">
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                Data is deleted via standard SQL <code className="bg-surface-100 dark:bg-surface-600 px-1 py-0.5 rounded text-xs">DELETE</code> operations.
                Space is reclaimed during normal PostgreSQL vacuuming. Deleted data may persist in
                database backups for up to 30 days before aging out.
              </p>
            </div>
          </section>

          {/* 4. User Rights */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              4. Your Rights
            </h2>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>
                <span className="font-medium text-surface-800 dark:text-surface-200">Deletion:</span>{' '}
                Request deletion of your account and all associated data at any time. Completed within 30 days.
              </li>
              <li>
                <span className="font-medium text-surface-800 dark:text-surface-200">Export:</span>{' '}
                Export your transaction data in CSV or Excel format through the application.
              </li>
              <li>
                <span className="font-medium text-surface-800 dark:text-surface-200">Access:</span>{' '}
                View all your stored data within the application at any time.
              </li>
            </ul>
            <p className="text-surface-500 dark:text-surface-400 text-sm mt-3">
              Requests are handled on a best-effort basis. Response times are generally within 30 days.
            </p>
          </section>

          {/* 5. Backup & Archive */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              5. Backup &amp; Archive
            </h2>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>The PostgreSQL database is backed up daily.</li>
              <li>Backups are retained for up to 30 days; older backups are automatically removed.</li>
              <li>Deleted data may persist in backups for up to 30 days after deletion from the live database.</li>
              <li>No separate long-term archive is maintained.</li>
            </ul>
          </section>

          {/* 6. Review Schedule */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              6. Review Schedule
            </h2>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed">
              This policy is reviewed at least once per year. The next scheduled review
              is <strong>February 2027</strong>. Significant changes that affect how user data is
              retained or deleted will be communicated to users.
            </p>
          </section>

          {/* 7. Contact */}
          <section>
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              7. Contact
            </h2>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed mb-3">
              For questions about this policy or to submit a data-related request:
            </p>
            <div className="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-lg">
              <p className="text-surface-800 dark:text-surface-200 font-medium">Luke Robinson</p>
              <a
                href="mailto:rundskue@outlook.com"
                className="text-primary-600 dark:text-primary-400 hover:underline text-sm"
              >
                rundskue@outlook.com
              </a>
            </div>
            <p className="text-surface-500 dark:text-surface-400 text-sm mt-3">
              Last updated: February 2026
            </p>
          </section>
        </div>

        <div className="text-center mt-6 space-y-2">
          <div className="flex justify-center gap-4 text-sm">
            <Link to="/privacy" className="text-primary-600 dark:text-primary-400 hover:underline">Privacy Policy</Link>
            <span className="text-surface-400">&middot;</span>
            <Link to="/security" className="text-primary-600 dark:text-primary-400 hover:underline">Security Policy</Link>
          </div>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            &copy; {new Date().getFullYear()} Rundskue. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
