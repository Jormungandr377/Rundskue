# Finance Tracker - Project Status

**Last Updated:** 2026-02-07
**Status:** Full-Stack Auth + Performance + Dark Mode + PWA + Notifications + Goals + Testing + Plaid Attestations + Security Hardening, Deployed to Coolify + Cloudflare Tunnel

## Overview

Self-hosted personal finance tracker with Plaid bank linking, TSP retirement simulator, budgeting, and analytics. Built with FastAPI (Python) backend and React 18 + TypeScript frontend.

**Live URL:** https://finance.rundskue.com
**Coolify Dashboard:** https://coolify.rundskue.com (also http://172.27.30.17:8000)
**Uptime Monitor:** https://uptime.rundskue.com
**GitHub Repo:** https://github.com/Jormungandr377/Rundskue.git (main branch)

---

## Server Infrastructure

### Server Details
- **Host:** SER8 (Ubuntu 24.04.3 LTS, WSL2)
- **RAM:** ~32GB, **Storage:** ~1TB

### Cloudflare Tunnel (RUNNING as systemd service)
- **Tunnel Name:** coolify-tunnel
- **cloudflared Version:** 2026.2.0
- **Service:** `systemctl status cloudflared` (enabled, auto-starts on boot)
- **Config:** `/etc/cloudflared/config.yml`
- **Credentials:** `/etc/cloudflared/<tunnel-id>.json`

**Tunnel Routes:**
| Hostname | Service |
|----------|---------|
| finance.rundskue.com | http://127.0.0.1:80 (Coolify proxy → Docker container) |
| coolify.rundskue.com | http://127.0.0.1:8000 (Coolify dashboard) |
| ws.rundskue.com | http://127.0.0.1:6001 (Coolify websocket/Pusher) |
| uptime.rundskue.com | http://127.0.0.1:80 (uptime monitor) |
| * (catch-all) | http_status:404 |

**Tunnel Management:**
```bash
# Check status
sudo systemctl status cloudflared

# Restart tunnel
sudo systemctl restart cloudflared

# View logs
sudo journalctl -u cloudflared -f

# Update cloudflared (installed via .deb, can't use `cloudflared update`)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb && sudo dpkg -i /tmp/cloudflared.deb

# Edit tunnel config
sudo nano /etc/cloudflared/config.yml
sudo systemctl restart cloudflared
```

**Kernel tuning (persisted in /etc/sysctl.conf):**
```bash
net.core.wmem_max=7500000  # For QUIC performance
```

### Coolify Deployment
- Single Dockerfile: FastAPI serves React static files + PWA assets
- PostgreSQL database on same Coolify instance
- GitHub auto-deploy from main branch (push to main → auto builds)
- SMTP env vars configured in Coolify dashboard

### SMTP Configuration (Configured in Coolify)
- SMTP settings are stored as environment variables in Coolify dashboard
- See `.env.example` for required variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM)

---

## Credentials

> **IMPORTANT:** All credentials are stored in `.env` files (which are git-ignored) and
> Coolify environment variables. **Never commit credentials to this file or any tracked file.**
>
> Rotate any credential that was previously exposed in git history.

- **Admin account:** See Coolify env vars
- **SMTP:** Configured in Coolify dashboard
- **Plaid API:** Sandbox credentials in `.env` file (see `.env.example`)
- **Plaid sandbox test login:** user_good / pass_good / any MFA code
- Switch to development/production requires Plaid dashboard approval

---

## Architecture

### Backend (FastAPI + PostgreSQL)
- **Auth:** JWT access tokens (15min) + httpOnly secure refresh token cookies (7-30 days)
- **2FA:** Optional TOTP with Google Authenticator + backup codes
- **Admin 2FA Enforcement:** Admin users MUST have 2FA enabled to login (blocked otherwise)
- **RBAC:** User/Admin roles; admin dependency (`get_current_admin_user`) for admin endpoints
- **CSRF Protection:** Custom header middleware (X-Requested-With) on all state-changing API requests
- **Security Headers:** X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy, CSP (API only)
- **Rate Limiting:** SlowAPI on login (10/min), register (5/min), forgot-password (3/min)
- **All routes protected** - every API endpoint requires authentication
- **Audit Logging:** Immutable audit log for all security-relevant actions (login, register, 2FA, role changes, deactivation, data export, etc.)
- **Admin Panel:** User management, role changes, audit log queries, access review reports
- **Quarterly Access Reviews:** APScheduler job creates notifications for admin users on Jan/Apr/Jul/Oct 1st
- **De-provisioning:** Admin deactivate endpoint immediately sets is_active=False + revokes all tokens
- **Registration Gate:** `REGISTRATION_ENABLED=false` env var to disable new signups
- **Session Management:** Track active sessions per user, revoke individual or all other sessions
- **User-Profile model:** 1:N (household/multi-profile support)
- **Recurring transactions:** Track subscriptions, bills, income with due date forecasting
- **Savings Goals:** Track financial goals with progress, contributions, deadlines
- **Notifications:** Budget threshold alerts (80%+), bill due date reminders (3-day), access review reminders
- **Auto-Categorization:** Rule-based transaction categorization (contains/exact/starts_with matching)
- **Data export:** CSV and Excel export with styled headers
- **Theme persistence:** User theme preference saved server-side
- **Error Monitoring:** Sentry SDK integration (configurable via SENTRY_DSN env var)

### Frontend (React 18 + TypeScript + Vite)
- **Tailwind CSS** for styling with **dark mode** support (`darkMode: 'class'`)
- **React Query** for server state
- **Axios interceptors** for auto-refresh on 401
- **Toast notifications** for user feedback
- **Mobile responsive** sidebar with hamburger menu
- **Protected routes** with AuthContext
- **Code splitting:** React.lazy() on all 20 pages - each is its own chunk
- **Vendor splitting:** react, data (query+axios), charts (recharts), utils (date-fns+lucide)
- **PWA:** Installable on mobile/desktop with service worker for offline support
- **Dark mode:** System-aware theme toggle with server-side persistence
- **Onboarding:** Multi-step welcome flow for new users (welcome → profile → bank link)
- **Accessibility:** Skip navigation, aria-labels on all icon buttons, aria-live toasts

### Backend Performance
- **GZip compression:** GZipMiddleware on all responses > 500 bytes
- **Cache headers:** Immutable 1yr cache for hashed `/assets/`, no-cache for HTML/SW, no-store for API
- **Database indexes:** Composite + FK indexes on high-query columns
- **Secure cookies:** `secure=True` on all httpOnly refresh token cookies
- **Result:** 821KB monolithic -> 102KB initial transfer (login), 68% compression ratio

---

## File Structure

### Backend
```
backend/app/
├── core/security.py          # Password, JWT, TOTP, QR code utilities
├── routers/
│   ├── auth.py               # Auth endpoints (login, register, 2FA, change-password, reset, theme) + audit logging + admin 2FA enforcement + registration gate
│   ├── admin.py              # Admin endpoints: user mgmt, role changes, audit logs, access review
│   ├── profiles.py           # User profiles (protected)
│   ├── accounts.py           # Bank accounts (protected)
│   ├── transactions.py       # Transactions (protected)
│   ├── budgets.py            # Budget management (protected)
│   ├── analytics.py          # Spending analytics (protected)
│   ├── tsp.py                # TSP simulator (protected)
│   ├── plaid.py              # Plaid bank linking (protected) + audit logging
│   ├── recurring.py          # Recurring bills & subscriptions (protected)
│   ├── goals.py              # Savings goals CRUD + contributions (protected)
│   ├── notifications.py      # Budget alerts, bill reminders, access review reminders (protected)
│   ├── categorization.py     # Auto-categorization rules + apply (protected)
│   ├── sessions.py           # Active session management (protected) + audit logging
│   └── export.py             # CSV/Excel data export (protected) + audit logging
├── schemas/auth.py           # Auth Pydantic schemas (includes role in UserResponse)
├── services/
│   ├── audit.py              # Audit logging service (log_audit_event, log_from_request)
│   ├── email.py              # SMTP email service (password reset, welcome emails)
│   └── sync_service.py       # Plaid sync scheduler
├── dependencies.py           # Auth middleware (get_current_active_user, get_current_admin_user)
├── models.py                 # SQLAlchemy models (User, Profile, Account, Transaction, RecurringTransaction, SavingsGoal, CategoryRule, Notification, AuditLog) + role field on User
├── config.py                 # Settings (includes registration_enabled)
├── database.py               # DB session
├── init_db.py                # DB initialization
└── main.py                   # App entry + rate limiter + GZip + cache headers + CORS + CSRF + SecurityHeaders + Sentry + PWA routes + APScheduler (quarterly review reminder) + admin 2FA startup check
```

### Database Migrations
```
backend/alembic/versions/
├── ...-001_initial.py
├── ...-002_*.py
├── ...-003_*.py
├── ...-004_goals_rules_notifications.py
└── 20260207_2200-005_add_audit_log_and_role.py  # audit_logs table + user.role column
```

### GitHub Actions
```
.github/workflows/
├── security.yml              # Vulnerability scanning: pip-audit, npm audit, Bandit SAST, Trivy Docker scan (weekly Monday + on push/PR to main)
└── ci.yml                    # CI pipeline: backend pytest (with PostgreSQL), frontend build + tests (on push/PR to main)
```

### Policy Documents
```
docs/
├── SECURITY_POLICY.md                # Security policy (includes security headers, vuln scanning, audit logging, access reviews, de-provisioning)
├── ACCESS_CONTROL_POLICY.md          # Roles, auth, authorization, provisioning/de-provisioning, access reviews
├── ACCESS_REVIEW_PROCEDURE.md        # Quarterly access review procedure
├── VULNERABILITY_MANAGEMENT.md       # Scanning cadence, severity classification, patch SLAs
├── generate_docx.py                  # Generates .docx versions of all policy docs
├── Security_Policy_Rundskue.docx
├── Privacy_Policy_Rundskue.docx
├── Data_Retention_Policy_Rundskue.docx
└── Access_Control_Policy_Rundskue.docx
```

### Frontend
```
frontend/src/
├── contexts/
│   ├── AuthContext.tsx        # Auth state (user, login, logout, register)
│   ├── ToastContext.tsx       # Toast notification system
│   └── ThemeContext.tsx       # Dark/light/system theme with server persistence
├── components/
│   └── ProtectedRoute.tsx    # Route guard (redirects to /login)
├── services/
│   └── api.ts                # Authenticated axios + auth API methods
├── api.ts                    # Data API client (accounts, transactions, recurring, goals, notifications, categorization, sessions, export)
├── pages/
│   ├── Login.tsx             # Email/password + 2FA support
│   ├── Signup.tsx            # Registration with password strength
│   ├── ForgotPassword.tsx    # Request reset email
│   ├── ResetPassword.tsx     # Set new password from token
│   ├── ChangePassword.tsx    # Change password (authenticated)
│   ├── TwoFactorSetup.tsx    # Enable/disable 2FA with QR
│   ├── Dashboard.tsx         # Main dashboard with charts, goals, bills, insights
│   ├── Accounts.tsx          # Bank accounts
│   ├── Transactions.tsx      # Transaction list with CSV/Excel export
│   ├── Budgets.tsx           # Budget management
│   ├── RecurringBills.tsx    # Recurring bills & subscriptions CRUD
│   ├── Goals.tsx             # Savings goals with progress bars + contributions
│   ├── Notifications.tsx     # Notification center (budget alerts, bill reminders)
│   ├── CategoryRules.tsx     # Auto-categorization rules management
│   ├── Sessions.tsx          # Active session management
│   ├── Onboarding.tsx        # New user onboarding flow
│   ├── Reports.tsx           # Analytics/reports
│   ├── TSPSimulator.tsx      # TSP retirement simulator
│   ├── LinkAccount.tsx       # Plaid bank linking
│   └── Profiles.tsx          # Profile management
├── App.tsx                   # Router + lazy loading + responsive sidebar + dark mode
├── main.tsx                  # Entry point with QueryClient + SW registration
├── types.ts                  # TypeScript interfaces
└── index.css                 # Tailwind + dark mode + custom animations
frontend/public/
├── manifest.json             # PWA manifest
├── sw.js                     # Service worker (offline caching)
└── favicon.svg               # App icon (SVG for any size)
```

---

## API Endpoints

### Auth (`/api/auth/`)
| Method | Endpoint | Rate Limit | Description |
|--------|----------|------------|-------------|
| POST | /register | 5/min | Create account |
| POST | /login | 10/min | Login (supports 2FA) |
| POST | /refresh | - | Refresh access token |
| POST | /logout | - | Revoke refresh token |
| GET | /me | - | Get current user |
| PUT | /theme | - | Update theme preference (light/dark/system) |
| POST | /change-password | - | Change password (authenticated) |
| POST | /2fa/setup | - | Initialize 2FA |
| POST | /2fa/verify | - | Verify & enable 2FA |
| POST | /2fa/disable | - | Disable 2FA |
| POST | /forgot-password | 3/min | Request reset email |
| POST | /reset-password | - | Reset with token |

### Data APIs (all require auth)
- `/api/profiles/` - User profiles CRUD
- `/api/accounts/` - Bank accounts (via Plaid)
- `/api/transactions/` - Transaction list, categorization, bulk ops
- `/api/budgets/` - Budget CRUD + progress tracking
- `/api/analytics/` - Spending by category, cash flow, trends, net worth, insights
- `/api/tsp/` - TSP scenarios, projections, fund performance
- `/api/plaid/` - Link token, exchange, sync
- `/api/recurring/` - Recurring bills/subscriptions CRUD + upcoming
- `/api/goals/` - Savings goals CRUD + contribute endpoint
- `/api/notifications/` - List, mark read, check budgets/bills
- `/api/categorization/` - Auto-categorization rules CRUD + apply
- `/api/sessions/` - List active sessions, revoke individual/all
- `/api/export/` - CSV and Excel transaction exports

### Admin APIs (require admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/users | List all users with role, is_active, totp_enabled, last login |
| PUT | /api/admin/users/{id}/role | Change user role (audit logged) |
| PUT | /api/admin/users/{id}/deactivate | Deactivate user + revoke all tokens (audit logged) |
| PUT | /api/admin/users/{id}/reactivate | Reactivate user (audit logged) |
| GET | /api/admin/audit-logs | Query audit logs with filters (action, user_id, date range, status) |
| GET | /api/admin/access-review | Generate access review report (user count, 2FA adoption, per-user details) |
| POST | /api/admin/access-review/complete | Record review completion with notes (audit logged) |

---

## Completed Features

### 1. Dark Mode
- Tailwind `darkMode: 'class'` with ThemeContext
- Toggle in sidebar header (moon/sun icons)
- Persists to server via `PUT /api/auth/theme`
- Supports light / dark / system preferences
- All pages have full dark mode styling

### 2. Recurring Bills & Subscriptions
- Backend: `RecurringTransaction` model with frequency-based scheduling
- Frontend: Full CRUD page with summary cards, due date indicators
- Dashboard widget: Upcoming bills within 14 days

### 3. Data Export
- Backend: CSV and Excel export endpoints with styled output
- Frontend: Download buttons on Transactions page
- Excel has formatted headers with blue fill, auto-column widths

### 4. PWA (Progressive Web App)
- `manifest.json` for mobile/desktop install
- Service worker with network-first strategy for HTML, cache-first for assets
- Financial data (API) never cached for security
- Auto-update check every hour

### 5. Secure Cookies
- Changed `secure=True` on all httpOnly refresh token cookies

### 6. Database Indexes
- Added indexes on `Profile.user_id`, `RefreshToken.user_id`, `Account.profile_id`
- Composite indexes on `RecurringTransaction` for profile+active and next_due_date

### 7. Dashboard Enhancements
- Upcoming bills widget with color-coded due date indicators
- Spending insights section with increase/decrease alerts
- Full dark mode support on all charts

### 8. SMTP Email
- Password reset emails + welcome emails working
- SMTP credentials configured in Coolify env vars
- Gmail App Password for sillyluke123437733@gmail.com

### 9. Cloudflare Tunnel
- Free SSL, DDoS protection, global CDN
- Running as systemd service (auto-starts on boot)
- Routes: finance, coolify, ws, uptime subdomains
- No open ports needed on server

### 10. CSRF Protection
- Custom `CSRFMiddleware` requires `X-Requested-With: XMLHttpRequest` header on all state-changing `/api/*` requests
- Exempt paths: login, register, refresh, forgot-password, reset-password, health
- Frontend axios sends header automatically via default headers config

### 11. Session Management
- Backend tracks active sessions via `RefreshToken` records
- Frontend page shows device type (parsed from user-agent), IP, login time
- Users can revoke individual sessions or all other sessions

### 12. Savings Goals
- Backend: `SavingsGoal` model with contribute endpoint, auto-completion detection
- Frontend: Goals page with progress bars, contribution inline form, completed goals section
- Dashboard: Goals progress overview widget

### 13. Notifications & Alerts
- Backend: `Notification` model with budget threshold alerts (80%+) and bill due date reminders (3 days)
- Frontend: Notification bell with unread count badge (polls every 60s), notification page with mark read/delete
- Deduplication: Same budget/bill alerts not re-created on same day

### 14. Auto-Categorization
- Backend: `CategoryRule` model with match_field (name/merchant), match_type (contains/exact/starts_with)
- Frontend: Rules management page with apply button
- Prioritized rule matching: higher priority rules evaluated first

### 15. Error Monitoring (Sentry)
- Backend: `sentry-sdk[fastapi]` with configurable DSN via environment variable
- Traces sampling: 10%, profiles sampling: 10%
- Only initialized when `SENTRY_DSN` env var is set

### 16. Database Backup Automation
- Bash script at `backend/scripts/backup_db.sh` with 30-day rotation
- Parses DATABASE_URL for PostgreSQL pg_dump
- Gzip compressed, timestamped backups

### 17. Onboarding Flow
- 3-step wizard: Welcome → Create Profile → Connect Bank (or skip)
- Shows after new user registration
- Stores completion in localStorage

### 18. Dashboard Enhancements (v2)
- Bar chart for income vs expenses (clearer comparison)
- Net worth trend area chart
- Savings goals progress overview
- Recharts Legend component added

### 19. Accessibility
- Skip navigation link for keyboard users
- `aria-label` on all icon-only buttons across all pages
- `aria-live="polite"` on toast notification container
- `role="navigation"` on sidebar
- Proper semantic HTML throughout

### 20. Test Suites
- Backend: pytest with SQLite, fixtures for User/Profile/Auth, test files for goals, sessions, notifications, auth, categorization
- Frontend: Vitest + React Testing Library + MSW mock server, tests for API client, App component, Goals, Notifications, Sessions, CategoryRules pages

### 21. Plaid Required Attestations (All 9 Complete)
All 9 Plaid security attestations can be answered "Yes" as of 2026-02-07. Due date: 08/08/2026.

| # | Attestation | Implementation |
|---|-------------|----------------|
| 1 | Centralized IAM | User model + role field as single identity store; `get_current_admin_user` dependency; audit logging on all security events |
| 2 | MFA on internal systems | Admin users blocked from login if `totp_enabled=False`; enforced in `auth.py` login endpoint |
| 3 | Periodic access reviews | APScheduler quarterly job (Jan/Apr/Jul/Oct); `/api/admin/access-review` report; completion audit log |
| 4 | Zero trust architecture | SecurityHeadersMiddleware (HSTS, X-Frame-Options, CSP, etc.); per-request JWT auth; per-resource ownership checks; deny-by-default |
| 5 | Consumer-facing MFA | TOTP 2FA available to all users (already built) |
| 6 | Vulnerability scanning | GitHub Actions: pip-audit, npm audit, Trivy, Bandit; weekly + on push/PR |
| 7 | Documented access control | `docs/ACCESS_CONTROL_POLICY.md` covering roles, auth, authorization, provisioning |
| 8 | Patch within SLA | `docs/VULNERABILITY_MANAGEMENT.md` with SLAs: Critical 72h, High 7d, Medium 30d |
| 9 | Automated de-provisioning | `PUT /api/admin/users/{id}/deactivate` sets is_active=False + revokes all tokens immediately |

### 22. Audit Logging
- Immutable `AuditLog` model: id, timestamp, user_id, action, resource_type, resource_id, details (JSON), ip_address, user_agent, status
- Actions tracked: LOGIN, LOGIN_FAILED, LOGOUT, REGISTER, PASSWORD_CHANGE, PASSWORD_RESET, 2FA_ENABLED, 2FA_DISABLED, SESSION_REVOKED, PLAID_LINK, PLAID_UNLINK, USER_DEACTIVATED, USER_REACTIVATED, ROLE_CHANGED, ACCESS_REVIEW, DATA_EXPORT
- Service: `backend/app/services/audit.py` with `log_audit_event()` and `log_from_request()` helpers
- Admin queryable via `GET /api/admin/audit-logs` with filters

### 23. Admin Role & User Management
- `role` column on User model (default: "user", admin: "admin")
- `get_current_admin_user` dependency checks `role == "admin"`
- Admin endpoints for user listing, role changes, deactivation/reactivation
- All admin actions audit logged
- Registration can be disabled via `REGISTRATION_ENABLED=false` env var

### 24. Security Headers
- `SecurityHeadersMiddleware` in main.py adds to all responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (API endpoints only)

### 25. CI/CD Pipelines (GitHub Actions)
- **security.yml:** pip-audit, npm audit, Bandit SAST, Trivy Docker scan (weekly Monday + on push/PR to main)
- **ci.yml:** Backend pytest with PostgreSQL service container, frontend npm build + tests (on push/PR to main)

---

## Progress

| Area | Status |
|------|--------|
| Backend Auth | 100% |
| CSRF Protection | 100% (custom header middleware) |
| Route Protection | 100% (all 15 routers including admin) |
| Database Migrations | 100% (005 - audit_logs table + user.role column) |
| Frontend Auth | 100% (login, signup, 2FA, reset, change password) |
| Toast Notifications | 100% |
| Mobile Responsive | 100% (hamburger menu sidebar) |
| Rate Limiting | 100% (login, register, forgot-password) |
| Deployment | 100% (Coolify, auto-deploy from GitHub) |
| Performance | 100% (GZip, code splitting, cache headers) |
| Dark Mode | 100% (all pages, server-persisted) |
| Recurring Bills | 100% (backend + frontend + dashboard widget) |
| Savings Goals | 100% (CRUD + contribute + dashboard widget) |
| Notifications | 100% (budget alerts + bill reminders + access review reminders + bell badge) |
| Auto-Categorization | 100% (rules CRUD + apply) |
| Session Management | 100% (list + revoke + audit logged) |
| Data Export | 100% (CSV + Excel + audit logged) |
| PWA | 100% (manifest + service worker) |
| Secure Cookies | 100% |
| Database Indexes | 100% |
| Error Monitoring | 100% (Sentry SDK, configurable DSN) |
| DB Backup Script | 100% (pg_dump + rotation) |
| Onboarding Flow | 100% (3-step wizard) |
| Accessibility | 100% (skip nav, aria-labels, aria-live) |
| Backend Tests | 100% (pytest + fixtures + 6 test files) |
| Frontend Tests | 100% (Vitest + RTL + MSW + 6 test files) |
| Cloudflare Tunnel | 100% (systemd service, 4 subdomains) |
| SMTP Email | 100% (configured in Coolify) |
| Plaid Integration | 100% (sandbox mode, attestations complete) |
| Admin RBAC | 100% (admin role, user management, deactivation) |
| Audit Logging | 100% (immutable log, all security events, admin queryable) |
| Security Headers | 100% (HSTS, X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy) |
| Plaid Attestations | 100% (all 9 attestations implementable, due 08/08/2026) |
| Vulnerability Scanning | 100% (GitHub Actions: pip-audit, npm audit, Bandit, Trivy) |
| CI Pipeline | 100% (GitHub Actions: pytest + frontend build) |
| Access Reviews | 100% (quarterly scheduler + admin report + completion audit) |
| Policy Documentation | 100% (Security, Access Control, Access Review, Vulnerability Management) |

---

## Quick Commands

```bash
# Project directory (Windows/WSL)
cd "D:\Coding Projects\Finance Project\finance-tracker"

# Frontend dev
cd frontend && npm run dev

# Frontend build
cd frontend && npm run build

# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && python -m pytest tests/ -v

# Git
git log --oneline -5
git status

# Server SSH (use your configured user@host)
# ssh <user>@<server-ip>

# Server - check tunnel
sudo systemctl status cloudflared

# Server - restart tunnel
sudo systemctl restart cloudflared

# Server - view tunnel logs
sudo journalctl -u cloudflared -f

# Server - update cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb && sudo dpkg -i /tmp/cloudflared.deb
```

---

## Known Issues / Notes

1. **Plaid:** Uses sandbox credentials (user_good / pass_good), needs Plaid dashboard approval + production keys for real bank linking
2. **Browser cache:** Hashed assets cached 1yr (immutable), HTML set to no-cache so deploys auto-refresh
3. **QUIC timeouts:** Periodic "timeout: no recent network activity" in cloudflared logs are normal - idle connection recycling, auto-reconnects in seconds
4. **ws.rundskue.com:** May show connection errors if Coolify's Pusher/websocket service (port 6001) isn't running - cosmetic, doesn't affect finance app
5. **Cloudflare tunnel config:** System config at `/etc/cloudflared/config.yml`, user backup at `~/.cloudflared/config.yml` - edit the `/etc/` one for the systemd service
6. **Old admin account (admin@financetracker.app):** Blocked from login because admin 2FA enforcement requires TOTP to be enabled before login. Either enable 2FA directly in DB or use the new admin account (rundskue@outlook.com)
7. **Admin 2FA chicken-and-egg:** If creating a new admin without 2FA, you must set TOTP secret directly in the database via Coolify terminal (Python one-liner with pyotp) since the login blocks without 2FA
8. **Transaction data not encrypted at rest:** Financial data stored in plaintext in PostgreSQL, protected by network isolation only (documented in SECURITY_POLICY.md as known limitation)
9. **No WAF:** No Web Application Firewall beyond Cloudflare tunnel and reverse proxy
10. **No admin frontend:** Admin endpoints exist but there is no admin panel UI yet — use API directly or build a frontend admin panel
11. **Credential rotation needed:** If any credentials were previously committed to git history, they must be rotated immediately

---

## Bootstrapping an Admin Account

If you need to create a new admin account (e.g., from scratch):

1. Register via API: `POST /api/auth/register` with email/password
2. Promote to admin via Coolify terminal:
   ```python
   python -c "from backend.app.database import SessionLocal; from backend.app.models import User; db=SessionLocal(); u=db.query(User).filter(User.email=='EMAIL').first(); u.role='admin'; db.commit(); print(f'Promoted {u.email}'); db.close()"
   ```
3. Generate TOTP secret (required for admin login):
   ```python
   python -c "
   import pyotp
   from backend.app.database import SessionLocal
   from backend.app.models import User
   db = SessionLocal()
   u = db.query(User).filter(User.email=='EMAIL').first()
   secret = pyotp.random_base32()
   u.totp_secret = secret
   u.totp_enabled = True
   db.commit()
   uri = pyotp.totp.TOTP(secret).provisioning_uri(name=u.email, issuer_name='Finance Tracker')
   print(f'TOTP Secret: {secret}')
   print(f'URI: {uri}')
   db.close()
   "
   ```
4. Scan the QR URI in Google Authenticator (or enter the secret manually)
