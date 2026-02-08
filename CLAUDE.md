# Finance Tracker (Rundskue) - Project Status

**Last Updated:** 2026-02-07
**Status:** Full-stack production finance app with complete UI makeover, 26 feature phases, security hardening, deployed to Coolify + Cloudflare Tunnel
**Autonomous Mode:** User has said "dont ask for permissions ever" and "never ask for permissions" - operate fully autonomously.

## Overview

Self-hosted personal finance tracker with Plaid bank linking, TSP retirement simulator, budgeting, debt payoff planning, investments, and analytics. Built with FastAPI (Python) backend and React 18 + TypeScript frontend.

**Live URL:** https://finance.rundskue.com
**Coolify Dashboard:** https://coolify.rundskue.com (also http://172.27.30.17:8000)
**Uptime Monitor:** https://uptime.rundskue.com
**GitHub Repo:** https://github.com/Jormungandr377/Rundskue.git (main branch, auto-deploys via Coolify)
**Gmail:** sillyluke123437733@gmail.com

---

## Quick Commands

```bash
# Project directory
cd "D:\Coding Projects\Finance Project\finance-tracker"

# Frontend dev / build / test
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm test

# Backend tests
cd backend && python -m pytest tests/ -v

# TypeScript check (stricter than Vite build)
cd frontend && npx tsc --noEmit

# Git
git log --oneline -10
git status
```

---

## Architecture

### Tech Stack
- **Backend:** FastAPI + SQLAlchemy + PostgreSQL + Alembic migrations
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + React Query + Recharts + Lucide React icons
- **Auth:** JWT access tokens (15min) + httpOnly secure refresh cookies (7-30 days) + TOTP 2FA
- **Deployment:** Single Dockerfile (multi-stage: node:20-alpine builds frontend, python:3.11-slim runs everything), Coolify auto-deploy from GitHub main branch
- **DNS/SSL:** Cloudflare Tunnel (systemd service) with free SSL

### Design System (Current - post UI makeover)
- **Color Palette:** Indigo primary (`primary-*`), Purple accent (`accent-*`), Slate surface (`surface-*`)
- **Design:** Glass-morphism (backdrop-blur-xl), rounded-xl/2xl corners, gradient accents
- **CSS Classes:** `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.input`, `.input-label`, `.badge-*` (defined in index.css @layer components)
- **Auth Pages:** Split-screen layout with animated gradient left panel + form on right
- **Sidebar:** Grouped collapsible navigation (Overview, Budgeting, Wealth, Insights, Automation) with icon backgrounds
- **Brand:** "Rundskue" with Sparkles icon, subtitle "Finance Tracker"
- **Chart Colors:** Indigo primary `#6366f1`, defined in `frontend/src/constants/colors.ts`
- **Old backup:** `frontend_backup/` contains the pre-makeover frontend files

### Key Architectural Patterns
- All API routes protected via `get_current_active_user` dependency
- Admin endpoints use `get_current_admin_user` (requires `role == "admin"`)
- Frontend uses React Query for server state, Axios interceptors for auto-refresh on 401
- Code splitting: React.lazy() on all 35+ pages, vendor splitting (react, charts, data, utils)
- PWA with service worker (network-first for HTML, cache-first for assets, no caching for API)

---

## Server Infrastructure

### Cloudflare Tunnel (systemd service)
| Hostname | Service |
|----------|---------|
| finance.rundskue.com | http://127.0.0.1:80 (Coolify proxy -> Docker container) |
| coolify.rundskue.com | http://127.0.0.1:8000 (Coolify dashboard) |
| ws.rundskue.com | http://127.0.0.1:6001 (Coolify websocket/Pusher) |
| uptime.rundskue.com | http://127.0.0.1:80 (uptime monitor) |

```bash
sudo systemctl status cloudflared
sudo systemctl restart cloudflared
sudo journalctl -u cloudflared -f
```

### Deployment
- Push to `main` branch -> Coolify auto-builds Docker image -> deploys
- PostgreSQL on same Coolify instance
- SMTP env vars configured in Coolify dashboard
- `start.sh` runs Alembic migrations then starts uvicorn

---

## File Structure

### Backend (`backend/app/`)
```
core/security.py              # Password hashing, JWT (PyJWT), TOTP, QR codes, encrypt/decrypt TOTP secrets, common password check
dependencies.py                # Auth middleware: get_current_user, get_current_active_user, get_current_admin_user, get_optional_current_user
models.py                      # 35 SQLAlchemy models (see Models section)
config.py                      # Pydantic settings (env vars)
database.py                    # SQLAlchemy engine + session
init_db.py                     # DB initialization + seed data
main.py                        # FastAPI app, middleware (CORS, CSRF, SecurityHeaders, GZip), rate limiting, APScheduler, Sentry
schemas/auth.py                # Auth Pydantic schemas
schemas/schemas.py             # Data schemas

routers/ (18 routers):
  auth.py                      # Register, login (with 2FA + account lockout), refresh, logout, change-password, forgot/reset-password, 2FA setup/verify/disable, theme
  admin.py                     # User management, role changes, audit logs, access reviews
  profiles.py                  # Profile CRUD
  accounts.py                  # Bank account management
  transactions.py              # Transaction listing & categorization
  budgets.py                   # Budget CRUD & progress
  analytics.py                 # Spending analytics, cash flow, trends, net worth, insights
  tsp.py                       # TSP retirement simulator
  plaid.py                     # Plaid integration & bank linking
  recurring.py                 # Recurring bills & subscriptions
  goals.py                     # Savings goals CRUD + contributions
  notifications.py             # Budget alerts, bill reminders
  categorization.py            # Auto-categorization rules
  sessions.py                  # Active session management
  export.py                    # CSV/Excel data export
  credit.py                    # Credit score tracking (returns { entries: [...], latest_score, ... } for /history)
  debt.py                      # Debt management & payoff planning
  investments.py               # Investment holdings

services/ (11 services):
  audit.py                     # Immutable audit logging (RESOURCE_DELETED constant + log_from_request)
  email.py                     # SMTP email (password reset, welcome, scheduled reports)
  encryption.py                # Fernet encryption (shared _fernet instance from ENCRYPTION_KEY)
  analytics.py                 # Spending analytics calculations
  categorization.py            # Auto-categorization logic
  plaid_service.py             # Plaid API integration
  subscription_detector.py     # Recurring subscription detection
  sync_service.py              # Plaid transaction sync scheduler (APScheduler)
  report_generator.py          # PDF/email report generation
  tsp_simulator.py             # TSP retirement calculations
  webhook_dispatcher.py        # Webhook event dispatching
```

### Frontend (`frontend/src/`)
```
App.tsx                        # Router + grouped collapsible sidebar (5 groups) + glass-morphism layout
main.tsx                       # Entry point + QueryClient + SW registration
index.css                      # Tailwind @layer components (.card, .btn-*, .input, .badge-*, auth-gradient, mesh-gradient)
api.ts                         # Data API client (accounts, transactions, recurring, goals, notifications, categorization, sessions, export)
types.ts                       # TypeScript interfaces
constants/colors.ts            # CHART_COLORS array (indigo primary #6366f1)

contexts/
  AuthContext.tsx              # Auth state, login/register/logout, token management
  ThemeContext.tsx              # Dark/light/system theme with server persistence
  ToastContext.tsx              # Toast notification system

components/
  ProtectedRoute.tsx           # Route guard -> /login redirect
  SpendingHeatmap.tsx          # Heat map visualization

pages/ (35+ pages):
  Login.tsx                    # Split-screen: gradient left panel + form right, 2FA support
  Signup.tsx                   # Split-screen: gradient left panel + form right, password strength
  ForgotPassword.tsx           # Password reset request
  ResetPassword.tsx            # Set new password from token
  ChangePassword.tsx           # Change password (authenticated)
  TwoFactorSetup.tsx           # Enable/disable 2FA with QR
  VerifyEmail.tsx              # Email verification
  Dashboard.tsx                # Charts (bar, pie, area), goals, bills, insights
  Accounts.tsx                 # Bank accounts
  Transactions.tsx             # Transaction list + CSV/Excel export
  Budgets.tsx                  # Budget management
  Envelopes.tsx                # Envelope budgeting
  RecurringBills.tsx           # Recurring bills CRUD
  Subscriptions.tsx            # Subscription management
  Goals.tsx                    # Savings goals + contributions
  BillSplitting.tsx            # Bill splitting
  CashFlow.tsx                 # Cash flow analysis
  DebtPayoff.tsx               # Debt payoff + credit score (fixed: credit history extracts .entries from API response)
  Investments.tsx              # Investment portfolio
  NetWorth.tsx                 # Net worth tracking
  Reports.tsx                  # Analytics & reporting
  FinancialPlanning.tsx        # Planning tools (tabs: compound interest, loan, retirement, TSP)
  CategoryRules.tsx            # Auto-categorization rules
  Notifications.tsx            # Notification center
  Sessions.tsx                 # Active session management
  Webhooks.tsx                 # Webhook management
  EmailReports.tsx             # Scheduled email reports
  MerchantAnalysis.tsx         # Merchant spending analysis
  YearInReview.tsx             # Annual financial review
  PaycheckRules.tsx            # Paycheck allocation
  Onboarding.tsx               # New user welcome flow
  LinkAccount.tsx              # Plaid bank linking
  Profiles.tsx                 # Profile management
  TSPSimulator.tsx             # TSP retirement simulator
  PrivacyPolicy.tsx            # Privacy policy
  SecurityPolicy.tsx           # Security policy
  DataRetentionPolicy.tsx      # Data retention policy

pages/financial/ (sub-tabs):
  CompoundInterestTab.tsx
  LoanTab.tsx
  RetirementTab.tsx
  TSPTab.tsx
```

### Config Files
```
tailwind.config.js             # Custom colors (primary/accent/surface), shadows (glow/card/elevated), 8 animations
frontend/vite.config.ts        # Vite config with manual chunks
Dockerfile                     # Multi-stage: node:20-alpine -> python:3.11-slim, non-root user (appuser:1001), healthcheck port 8000
start.sh                       # Runs alembic upgrade head -> uvicorn
backend/requirements.txt       # PyJWT==2.8.0 (NOT python-jose), cryptography, pyotp, plaid-python, slowapi, sentry-sdk, etc.
```

---

## Database Models (35 models in `backend/app/models.py`)

**Auth:** User (with role, totp_secret/enabled, is_verified), RefreshToken, PasswordResetToken, EmailVerificationToken
**Profiles:** Profile (1:N with User), PlaidItem, Account (AccountType enum)
**Transactions:** Transaction, Category, CategoryRule, Envelope
**Budgets:** Budget, BudgetItem, BudgetAlert, SavingsGoal, SavingsRule
**Recurring:** RecurringTransaction, Subscription, PaycheckRule, PaycheckAllocation
**Debt/Credit:** Debt, CreditScore
**Investments:** InvestmentHolding, NetWorthSnapshot, TSPScenario, TSPFundHistory
**Notifications:** Notification, AuditLog, ScheduledReport, Webhook
**Social:** SharedBudget, SplitExpense, SplitParticipant
**Health:** FinancialHealthSnapshot

All datetime defaults use `lambda: datetime.now(timezone.utc)` (migrated from datetime.utcnow).

---

## Security Features

- JWT via **PyJWT** (migrated from python-jose; `import jwt as pyjwt` in security.py and dependencies.py)
- TOTP secrets **encrypted at rest** via Fernet (services/encryption.py), with fallback for legacy unencrypted secrets
- **Account lockout:** 5 failed logins in 15 minutes -> HTTP 429 (queries AuditLog)
- **Common password dictionary:** ~200 password frozenset checked in `validate_password()`
- **Non-root Docker:** appuser (UID 1001)
- **Audit logging on all delete endpoints:** RESOURCE_DELETED logged across all 17 routers
- **Rate limiting:** Login 10/min, register 5/min, forgot-password 3/min, analytics/export/plaid/categorization have additional limits
- **CSRF:** Custom X-Requested-With header middleware
- **Security Headers:** HSTS, X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy
- **Admin 2FA enforcement:** Admins blocked from login without TOTP enabled
- **Quarterly access reviews:** APScheduler job creates admin notifications
- **GitHub Actions:** pip-audit, npm audit, Bandit SAST, Trivy Docker scan (weekly + on push/PR)

---

## Recent Git History

```
92b6d8f Fix Debt Payoff crash: credit score history API returns object, not array
6d3a6d4 Complete UI makeover: indigo/violet design system with glass-morphism
69d55a1 Security hardening phase 2: 8 remaining security improvements
b036d6a Security hardening: fix 25+ vulnerabilities across all severity levels
188901e Add Phase 8: Smart categorization, scheduled email reports, webhooks
d86540b Add Phase 7: Shared budgets and bill splitting
ca0d0b3 Add Phase 6: Spending heatmap, merchant analysis, health score, year-in-review, PDF export
4f9a2cd Add Phase 5: Investment portfolio, enhanced net worth, dividend tracking
00b8905 Add Phase 4: Debt payoff planner, interest calculator, credit score tracking
55f1820 Add Phase 3: Savings rules, emergency fund tracker, sinking funds
7786d2e Add Phase 2: Cash flow forecasting, income trends comparison, paycheck splitting
bdcad58 Add Phase 1: Budget enhancements - rollover budgets, envelopes, spending alerts, subscription tracker
```

---

## Feature Phases Completed (26 features across 8 phases)

**Phase 1:** Rollover budgets, envelope budgeting, spending alerts, subscription tracker
**Phase 2:** Cash flow forecasting, income trend comparison, paycheck splitting
**Phase 3:** Savings rules (round-up, percentage, fixed), emergency fund tracker, sinking funds
**Phase 4:** Debt payoff planner (snowball/avalanche), interest calculator, credit score tracking
**Phase 5:** Investment portfolio, enhanced net worth, dividend tracking
**Phase 6:** Spending heatmap, merchant analysis, financial health score, year-in-review, PDF export
**Phase 7:** Shared budgets, bill splitting
**Phase 8:** Smart auto-categorization, scheduled email reports, webhooks

---

## API Endpoints Summary

### Auth (`/api/auth/`)
POST /register (5/min), POST /login (10/min), POST /refresh, POST /logout, GET /me, PUT /theme, POST /change-password, POST /2fa/setup, POST /2fa/verify, POST /2fa/disable, POST /forgot-password (3/min), POST /reset-password

### Data (all require auth, prefix `/api/`)
`/profiles/`, `/accounts/`, `/transactions/`, `/budgets/`, `/analytics/`, `/tsp/`, `/plaid/`, `/recurring/`, `/goals/`, `/notifications/`, `/categorization/`, `/sessions/`, `/export/`, `/credit-score/`, `/debt/`, `/investments/`, `/envelopes/`, `/subscriptions/`, `/savings-rules/`, `/paycheck-rules/`, `/splits/`, `/webhooks/`, `/reports/`, `/net-worth/`

### Admin (require admin role, prefix `/api/admin/`)
GET /users, PUT /users/{id}/role, PUT /users/{id}/deactivate, PUT /users/{id}/reactivate, GET /audit-logs, GET /access-review, POST /access-review/complete

---

## Known Issues / Notes

1. **Plaid:** Uses sandbox credentials (user_good / pass_good), needs Plaid dashboard approval for production
2. **No admin frontend:** Admin endpoints exist but no UI panel - use API directly
3. **Credit score /history endpoint:** Returns `{ entries: [...], latest_score, ... }` object, NOT a plain array. Frontend must extract `.entries`.
4. **Old admin account (admin@financetracker.app):** Blocked - admin 2FA enforcement. Use rundskue@outlook.com or create new admin (see bootstrap section below)
5. **Transaction data not encrypted at rest:** Stored plaintext in PostgreSQL, protected by network isolation
6. **TypeScript strictness:** `npx tsc --noEmit` shows pre-existing unused import warnings; Vite build (`npm run build`) is the real compilation check and must pass clean
7. **CRLF warnings:** Git shows LF->CRLF warnings on Windows; these are cosmetic
8. **Old frontend backup:** `frontend_backup/` contains pre-makeover files (teal/stone color scheme)

---

## Bootstrapping an Admin Account

1. Register: `POST /api/auth/register` with email/password
2. Promote via Coolify terminal:
   ```python
   python -c "from backend.app.database import SessionLocal; from backend.app.models import User; db=SessionLocal(); u=db.query(User).filter(User.email=='EMAIL').first(); u.role='admin'; db.commit(); print(f'Promoted {u.email}'); db.close()"
   ```
3. Generate TOTP (required for admin login):
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
4. Scan URI in Google Authenticator

---

## Environment Variables (backend/app/config.py)

**Required:** `secret_key`, `database_url`, `encryption_key`
**Plaid:** `plaid_client_id`, `plaid_secret`, `plaid_env` (sandbox/development/production)
**Email:** `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_from`
**Optional:** `sentry_dsn`, `registration_enabled` (default True), `frontend_url` (for CORS)
**JWT:** `algorithm` (HS256), `access_token_expire_minutes` (15), `refresh_token_expire_days` (7), `refresh_token_remember_me_days` (30)
