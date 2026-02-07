# Security Policy

**Finance Tracker** by Rundskue
**Version:** 1.0
**Effective Date:** February 7, 2026
**Last Updated:** February 7, 2026
**Application URL:** https://finance.rundskue.com

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Data Classification](#2-data-classification)
3. [Access Control](#3-access-control)
4. [Encryption](#4-encryption)
5. [Authentication & Session Management](#5-authentication--session-management)
6. [API Security](#6-api-security)
7. [Infrastructure Security](#7-infrastructure-security)
8. [Incident Response](#8-incident-response)
9. [Third-Party Integrations](#9-third-party-integrations)
10. [Contact Information](#10-contact-information)

---

## 1. Purpose & Scope

### 1.1 Purpose

This document describes the security measures implemented in Finance Tracker, a personal finance tracking application built and maintained by Rundskue. It is intended to provide transparency about how user data is protected and to establish baseline security practices for the project.

### 1.2 Scope

This policy applies to:

- The Finance Tracker web application hosted at `finance.rundskue.com`
- The FastAPI (Python) backend API
- The React (TypeScript) frontend
- The PostgreSQL database
- All supporting infrastructure (Docker containers, reverse proxy, deployment tooling)
- Third-party integrations (Plaid API)

### 1.3 Honest Disclaimer

Finance Tracker is a small, self-hosted personal project. While reasonable security measures have been implemented (as described in this document), this application has not undergone a formal third-party security audit and is not SOC 2 or ISO 27001 certified. Users should understand that this is not an enterprise-grade financial institution and should weigh that accordingly when deciding what data to entrust to the platform.

---

## 2. Data Classification

Finance Tracker handles data at varying levels of sensitivity. The following classification guides how each category is stored, transmitted, and protected.

### 2.1 Critical

- **Plaid access tokens** -- Used to maintain connections to users' bank accounts via the Plaid API. Encrypted at rest with Fernet symmetric encryption. Never logged or exposed in API responses.
- **User passwords** -- Hashed with bcrypt before storage. Plaintext passwords are never stored or logged.
- **JWT signing secrets** -- Stored as environment variables on the server. Never committed to source control.

### 2.2 Sensitive

- **Financial transaction data** -- Account balances, transaction histories, and account metadata retrieved from Plaid.
- **User profile information** -- Email addresses, display names, and account preferences.
- **Session and device data** -- Records of active sessions, device identifiers, and refresh tokens.
- **Two-factor authentication secrets** -- TOTP seed values associated with user accounts.

### 2.3 Internal

- **Application logs** -- Request logs, error traces (sent to Sentry), and server diagnostics. Logs are reviewed for debugging and may contain request metadata but should not contain credentials or financial data.
- **Configuration data** -- Non-secret application settings, feature flags, and deployment configuration.

---

## 3. Access Control

### 3.1 User Access

- All users must register an account and authenticate before accessing any financial data.
- Users can only access their own financial data. API endpoints enforce ownership checks so that one user cannot retrieve another user's accounts, transactions, or settings.

### 3.2 Administrative Access

- An admin role exists for elevated privileges (e.g., user management).
- Admin capabilities are restricted to designated accounts. There is no self-service admin escalation.

### 3.3 CORS Policy

- The backend enforces a CORS whitelist that permits requests only from:
  - `https://finance.rundskue.com` (production)
  - `localhost` origins (development only)
- Requests from unlisted origins are rejected by the server.

### 3.4 Database Access

- The PostgreSQL database is not exposed to the public internet. It is accessible only from within the Docker network on the host server.
- Database credentials are stored as environment variables and are not committed to source control.

---

## 4. Encryption

### 4.1 Encryption in Transit

- All traffic to `finance.rundskue.com` is served over HTTPS with TLS encryption.
- TLS certificates are managed through the deployment platform (Coolify) and are automatically renewed.
- Unencrypted HTTP requests are redirected to HTTPS.

### 4.2 Encryption at Rest

- **Plaid access tokens** are encrypted at rest using Python's `cryptography` library (Fernet symmetric encryption) before being written to the database. The encryption key is stored as a server-side environment variable, separate from the database.
- **Passwords** are hashed using bcrypt with an appropriate work factor. Bcrypt is a one-way hash; passwords cannot be decrypted, only verified.
- **General database contents** (transaction data, user profiles, etc.) are stored in PostgreSQL without application-layer encryption. They are protected by database access controls and network isolation as described in Section 7.

### 4.3 What Is Not Encrypted at Rest

To be transparent: financial transaction data, account metadata, and user profile information are stored in the PostgreSQL database in plaintext. Protection for this data relies on network isolation (the database is not publicly accessible), server access controls, and operating system-level security rather than field-level encryption. This is a known limitation and may be addressed in future versions.

---

## 5. Authentication & Session Management

### 5.1 Password Requirements

- Passwords are hashed with bcrypt before storage.
- Input validation is enforced on password fields via Pydantic models on the backend.

### 5.2 JWT-Based Authentication

- Authentication uses JSON Web Tokens (JWT) with a short-lived access token and a longer-lived refresh token.
- Access tokens are used for API authorization. When an access token expires, the client uses the refresh token to obtain a new one without requiring the user to re-enter credentials.
- Refresh tokens can be revoked (e.g., on logout or password change).

### 5.3 Two-Factor Authentication (2FA)

- Users may enable TOTP-based two-factor authentication (compatible with apps such as Google Authenticator, Authy, or similar).
- When 2FA is enabled, a valid TOTP code is required in addition to the password during login.
- 2FA is optional but recommended, particularly for accounts with linked bank data.

### 5.4 Session & Device Management

- The application tracks active sessions with associated device information.
- Users can view their active sessions and revoke any session they do not recognize.
- This provides visibility into where and how an account is being accessed.

---

## 6. API Security

### 6.1 CSRF Protection

- The backend uses custom middleware that validates the presence of an `X-Requested-With` header on mutating requests. This mitigates cross-site request forgery by ensuring requests originate from the application's own frontend rather than from a third-party page.

### 6.2 Rate Limiting

- API endpoints are rate-limited using `slowapi` to prevent abuse, brute-force attacks, and excessive resource consumption.
- Rate limits are applied per-client and will return HTTP 429 responses when thresholds are exceeded.

### 6.3 Input Validation

- All API request bodies and parameters are validated using Pydantic models. Malformed or unexpected input is rejected before it reaches business logic.
- This reduces the attack surface for injection and data integrity issues.

### 6.4 SQL Injection Prevention

- All database queries are constructed using SQLAlchemy ORM, which uses parameterized queries by default. Raw SQL strings with user input are not used.

### 6.5 Response Compression

- GZip compression middleware is enabled to reduce response sizes. While primarily a performance measure, this is noted here for completeness as it is part of the middleware stack.

---

## 7. Infrastructure Security

### 7.1 Deployment Architecture

- The application is deployed as Docker containers on a self-hosted server, orchestrated and managed through Coolify.
- The backend (FastAPI), frontend (React/static files), and database (PostgreSQL) each run in isolated containers within a shared Docker network.

### 7.2 Network Isolation

- The PostgreSQL database container is not exposed on any public port. It is reachable only from other containers within the Docker network.
- Only the reverse proxy / web-facing ports (80/443) are exposed to the public internet.

### 7.3 Environment Variables

- All secrets (database credentials, JWT signing keys, Plaid API keys, Fernet encryption keys, Sentry DSN) are stored as environment variables managed through Coolify. They are not hardcoded in source code or committed to version control.

### 7.4 Error Monitoring

- Runtime errors and exceptions are reported to Sentry for monitoring and debugging.
- Sentry is configured to avoid capturing sensitive request bodies or credentials. However, incidental metadata (such as request URLs or user IDs) may appear in error reports.

### 7.5 Security Headers

All HTTP responses include defense-in-depth headers:

- `X-Content-Type-Options: nosniff` -- prevents MIME type sniffing
- `X-Frame-Options: DENY` -- prevents clickjacking via iframes
- `Referrer-Policy: strict-origin-when-cross-origin` -- controls referrer leakage
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` -- disables unused browser APIs
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` -- enforces HTTPS
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` -- applied to API endpoints

### 7.6 Vulnerability Scanning

Automated vulnerability scanning runs via GitHub Actions on every push/PR to main and weekly:

- **pip-audit** -- Python dependency CVE scanning
- **npm audit** -- Node.js dependency CVE scanning
- **Bandit** -- Python static analysis (SQL injection, hardcoded secrets, etc.)
- **Trivy** -- Docker image scanning for OS and library vulnerabilities

Patch SLAs: Critical vulnerabilities within 72 hours, High within 7 days, Medium within 30 days, Low at next release. See `VULNERABILITY_MANAGEMENT.md` for full details.

### 7.7 Audit Logging

All security-relevant actions are recorded in an immutable audit log, including: login attempts (success/failure), user registration, password changes, 2FA changes, session management, role changes, user deactivation, bank account linking, and data exports. Audit logs are queryable by admin users and are retained indefinitely.

### 7.8 Access Reviews

Quarterly access reviews are conducted to verify that user privileges remain appropriate. The system automatically reminds admin users on the 1st of January, April, July, and October. See `ACCESS_REVIEW_PROCEDURE.md` for the full procedure.

### 7.9 De-provisioning

When a user account is deactivated by an admin:

1. The account is immediately set to inactive (login disabled).
2. All active refresh tokens are revoked immediately.
3. The action is recorded in the audit log.

There is no delay between deactivation and access revocation. See `ACCESS_CONTROL_POLICY.md` for full details.

### 7.10 Known Limitations

- The server is self-hosted and managed by a single maintainer. There is no dedicated security operations team or intrusion detection system.
- Server operating system updates and Docker image updates are applied manually on a best-effort basis.
- There is no Web Application Firewall (WAF) in front of the application beyond what Coolify and the reverse proxy provide.

---

## 8. Incident Response

### 8.1 Scope

Given the scale of this project (single maintainer, small user base), the incident response process is informal but follows a structured approach.

### 8.2 Detection

- Application errors are surfaced through Sentry alerts.
- Unusual activity (e.g., spikes in failed login attempts) may be identified through application logs and rate limiter responses.
- Users are encouraged to report suspicious account activity to the contact addresses listed in Section 10.

### 8.3 Response Procedure

In the event of a suspected security incident, the maintainer will:

1. **Assess** -- Determine the nature and scope of the incident using available logs, Sentry data, and server access.
2. **Contain** -- Take immediate action to limit damage. This may include revoking compromised tokens, rotating secrets, disabling affected accounts, or taking the application offline if necessary.
3. **Notify** -- Inform affected users as promptly as possible with an honest description of what happened, what data may have been affected, and what steps are being taken.
4. **Remediate** -- Fix the underlying vulnerability, rotate any compromised credentials, and restore normal operation.
5. **Review** -- Document what happened and what changes are needed to prevent recurrence.

### 8.4 Plaid Token Compromise

If there is reason to believe that Plaid access tokens have been compromised (even in encrypted form):

1. The Fernet encryption key will be rotated immediately.
2. All existing Plaid access tokens will be invalidated via the Plaid API.
3. Affected users will be notified and asked to re-link their bank accounts.

### 8.5 Disclosure

The maintainer is committed to honest and timely disclosure. There is no bug bounty program at this time, but responsible disclosure of vulnerabilities is welcomed and appreciated (see Section 10).

---

## 9. Third-Party Integrations

### 9.1 Plaid

Finance Tracker integrates with [Plaid](https://plaid.com) to allow users to securely link their bank accounts and retrieve financial data.

**How the integration works:**

1. Users initiate a bank connection through Plaid Link, a drop-in UI component provided by Plaid. Credentials are entered directly into Plaid's interface and are never seen or stored by Finance Tracker.
2. Plaid returns an access token that Finance Tracker uses to fetch account and transaction data on the user's behalf.
3. These access tokens are encrypted with Fernet encryption before being stored in the database (see Section 4.2).

**What Finance Tracker does NOT have access to:**

- Users' bank login credentials (these are handled entirely by Plaid)
- Users' full bank account numbers (Plaid provides only masked account numbers by default)

**Plaid's security posture:**

- Plaid is SOC 2 Type II certified, uses AES-256 encryption, and undergoes regular third-party security audits. More information is available at [https://plaid.com/security/](https://plaid.com/security/).
- Finance Tracker's use of Plaid is subject to Plaid's terms of service and data privacy practices.

### 9.2 Sentry

- Sentry is used for error monitoring and crash reporting.
- Error reports may include technical metadata (request paths, user IDs, stack traces) but are configured to minimize exposure of sensitive data.
- Sentry's security practices are described at [https://sentry.io/security/](https://sentry.io/security/).

---

## 10. Contact Information

For security concerns, vulnerability reports, or questions about this policy:

| Channel | Address |
|---|---|
| **Security Email** | [security@rundskue.com](mailto:security@rundskue.com) *(planned -- not yet active)* |
| **Current Contact** | [admin@rundskue.com](mailto:admin@rundskue.com) |
| **Maintainer** | Luke Robinson -- [rundskue@outlook.com](mailto:rundskue@outlook.com) |

Until the `security@rundskue.com` group mailbox is set up, please direct all security-related communications to `admin@rundskue.com` or contact the maintainer directly.

If you discover a security vulnerability, please report it privately to one of the addresses above rather than opening a public issue. Responsible disclosure is appreciated and will be acknowledged.

---

## Document History

| Version | Date | Description |
|---|---|---|
| 1.0 | February 7, 2026 | Initial security policy |

---

*This document describes the security posture of Finance Tracker as of the date above. It will be updated as the application evolves. If you have questions or suggestions for improvement, please reach out using the contact information in Section 10.*
