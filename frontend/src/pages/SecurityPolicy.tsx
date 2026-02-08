import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function SecurityPolicy() {
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
            Security Policy
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">
            Finance Tracker by Rundskue &middot; Version 1.0
          </p>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-8">
            Effective date: February 7, 2026
          </p>

          {/* 1. Purpose & Scope */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              1. Purpose &amp; Scope
            </h2>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed mb-3">
              This document describes the security measures implemented in Finance Tracker, a personal
              finance tracking application built and maintained by Rundskue. It is intended to provide
              transparency about how user data is protected and to establish baseline security practices
              for the project.
            </p>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed mb-3">
              This policy applies to the Finance Tracker web application hosted at{' '}
              <a href="https://finance.rundskue.com" className="text-primary-600 dark:text-primary-400 hover:underline">
                finance.rundskue.com
              </a>
              , including the FastAPI backend API, React frontend, PostgreSQL database, supporting
              infrastructure, and third-party integrations.
            </p>
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                <strong>Disclaimer:</strong> Finance Tracker is a small, self-hosted personal project.
                While reasonable security measures have been implemented, this application has not
                undergone a formal third-party security audit and is not SOC 2 or ISO 27001 certified.
              </p>
            </div>
          </section>

          {/* 2. Data Classification */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              2. Data Classification
            </h2>

            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-4 mb-2">
              Critical
            </h3>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li><strong>Plaid access tokens</strong> &mdash; Encrypted at rest with Fernet symmetric encryption. Never logged or exposed in API responses.</li>
              <li><strong>User passwords</strong> &mdash; Hashed with bcrypt before storage. Plaintext passwords are never stored or logged.</li>
              <li><strong>JWT signing secrets</strong> &mdash; Stored as environment variables. Never committed to source control.</li>
            </ul>

            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-4 mb-2">
              Sensitive
            </h3>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>Financial transaction data, account balances, and account metadata</li>
              <li>User profile information (email addresses, display names)</li>
              <li>Session and device data, refresh tokens</li>
              <li>Two-factor authentication TOTP secrets</li>
            </ul>

            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-4 mb-2">
              Internal
            </h3>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>Application logs and error traces (sent to Sentry)</li>
              <li>Non-secret application configuration and deployment settings</li>
            </ul>
          </section>

          {/* 3. Access Control */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              3. Access Control
            </h2>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>All users must register and authenticate before accessing any financial data.</li>
              <li>API endpoints enforce ownership checks &mdash; users can only access their own data.</li>
              <li>An admin role exists for elevated privileges with no self-service escalation.</li>
              <li>CORS whitelist permits requests only from <code className="text-sm bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded">finance.rundskue.com</code> and localhost (development).</li>
              <li>The PostgreSQL database is not exposed to the public internet &mdash; accessible only within the Docker network.</li>
              <li>Database credentials are stored as environment variables, never committed to source control.</li>
            </ul>
          </section>

          {/* 4. Encryption */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              4. Encryption
            </h2>

            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-4 mb-2">
              In Transit
            </h3>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>All traffic is served over HTTPS with TLS encryption.</li>
              <li>TLS certificates are automatically managed and renewed.</li>
              <li>Unencrypted HTTP requests are redirected to HTTPS.</li>
            </ul>

            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-4 mb-2">
              At Rest
            </h3>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>Plaid access tokens are encrypted using Fernet symmetric encryption before being stored in the database.</li>
              <li>Passwords are hashed using bcrypt (one-way hash, cannot be decrypted).</li>
            </ul>

            <div className="mt-4 p-4 bg-surface-50 dark:bg-surface-700/50 rounded-lg">
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                <strong>Transparency note:</strong> Financial transaction data and user profiles are
                stored in PostgreSQL without field-level encryption. Protection relies on network
                isolation and server access controls.
              </p>
            </div>
          </section>

          {/* 5. Authentication & Session Management */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              5. Authentication &amp; Session Management
            </h2>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li><strong>JWT-based auth</strong> with short-lived access tokens and longer-lived refresh tokens.</li>
              <li><strong>Two-factor authentication</strong> (TOTP) compatible with Google Authenticator, Authy, and similar apps.</li>
              <li><strong>Session &amp; device tracking</strong> &mdash; users can view and revoke active sessions.</li>
              <li>Refresh tokens can be revoked on logout or password change.</li>
              <li>Passwords validated via Pydantic models on the backend.</li>
            </ul>
          </section>

          {/* 6. API Security */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              6. API Security
            </h2>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li><strong>CSRF protection</strong> via <code className="text-sm bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded">X-Requested-With</code> header validation on mutating requests.</li>
              <li><strong>Rate limiting</strong> using slowapi to prevent abuse and brute-force attacks.</li>
              <li><strong>Input validation</strong> with Pydantic models &mdash; malformed input is rejected before reaching business logic.</li>
              <li><strong>SQL injection prevention</strong> via SQLAlchemy ORM parameterized queries.</li>
              <li><strong>GZip compression</strong> middleware for optimized response delivery.</li>
            </ul>
          </section>

          {/* 7. Infrastructure Security */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              7. Infrastructure Security
            </h2>
            <ul className="list-disc list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li>Deployed as Docker containers on a self-hosted server, managed through Coolify.</li>
              <li>Backend, frontend, and database run in isolated containers within a shared Docker network.</li>
              <li>Only ports 80/443 are exposed to the public internet.</li>
              <li>All secrets stored as environment variables, never in source code.</li>
              <li>Runtime errors monitored via Sentry (configured to minimize sensitive data exposure).</li>
            </ul>

            <div className="mt-4 p-4 bg-surface-50 dark:bg-surface-700/50 rounded-lg">
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                <strong>Known limitations:</strong> Single maintainer, no dedicated security operations
                team, no IDS, no automated vulnerability scanning, and no WAF beyond what the reverse
                proxy provides. OS and Docker updates are applied on a best-effort basis.
              </p>
            </div>
          </section>

          {/* 8. Incident Response */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              8. Incident Response
            </h2>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed mb-3">
              In the event of a suspected security incident, the following steps are taken:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-surface-700 dark:text-surface-300 leading-relaxed">
              <li><strong>Assess</strong> &mdash; Determine nature and scope using available logs and Sentry data.</li>
              <li><strong>Contain</strong> &mdash; Revoke compromised tokens, rotate secrets, disable affected accounts, or take the application offline if necessary.</li>
              <li><strong>Notify</strong> &mdash; Inform affected users promptly with an honest description of the incident.</li>
              <li><strong>Remediate</strong> &mdash; Fix the underlying vulnerability, rotate credentials, restore operations.</li>
              <li><strong>Review</strong> &mdash; Document what happened and prevent recurrence.</li>
            </ol>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed mt-3">
              If Plaid access tokens are suspected compromised, the Fernet encryption key is rotated
              immediately, all tokens invalidated via Plaid API, and users asked to re-link accounts.
            </p>
          </section>

          {/* 9. Third-Party Integrations */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              9. Third-Party Integrations
            </h2>

            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-4 mb-2">
              Plaid
            </h3>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed mb-2">
              Users connect bank accounts through Plaid Link. Credentials are entered directly into
              Plaid's interface and are never seen or stored by Finance Tracker. Plaid returns an
              access token (encrypted before storage) used to fetch account and transaction data.
            </p>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed">
              Plaid is SOC 2 Type II certified with AES-256 encryption. See{' '}
              <a
                href="https://plaid.com/security/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Plaid's security page
              </a>{' '}
              for details.
            </p>

            <h3 className="text-lg font-medium text-surface-800 dark:text-surface-200 mt-4 mb-2">
              Sentry
            </h3>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed">
              Used for error monitoring. Reports may include technical metadata but are configured to
              minimize sensitive data exposure. See{' '}
              <a
                href="https://sentry.io/security/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Sentry's security page
              </a>.
            </p>
          </section>

          {/* 10. Contact */}
          <section>
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-3">
              10. Contact Information
            </h2>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed mb-3">
              For security concerns, vulnerability reports, or questions about this policy:
            </p>
            <div className="p-4 bg-surface-50 dark:bg-surface-700/50 rounded-lg space-y-1">
              <p className="text-surface-800 dark:text-surface-200 font-medium">Luke Robinson</p>
              <a
                href="mailto:rundskue@outlook.com"
                className="text-primary-600 dark:text-primary-400 hover:underline text-sm"
              >
                rundskue@outlook.com
              </a>
            </div>
            <p className="text-surface-500 dark:text-surface-400 text-sm mt-3">
              If you discover a security vulnerability, please report it privately rather than opening
              a public issue. Responsible disclosure is appreciated and will be acknowledged.
            </p>
            <p className="text-surface-500 dark:text-surface-400 text-sm mt-3">
              Last updated: February 7, 2026
            </p>
          </section>
        </div>

        <div className="text-center mt-6 space-y-2">
          <div className="flex justify-center gap-4 text-sm">
            <Link to="/privacy" className="text-primary-600 dark:text-primary-400 hover:underline">Privacy Policy</Link>
            <span className="text-surface-400">&middot;</span>
            <Link to="/data-retention" className="text-primary-600 dark:text-primary-400 hover:underline">Data Retention Policy</Link>
          </div>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            &copy; {new Date().getFullYear()} Rundskue. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
