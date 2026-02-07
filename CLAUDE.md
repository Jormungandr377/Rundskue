# Finance Tracker - Project Status

**Last Updated:** 2026-02-07
**Status:** Full-Stack Auth + Performance + Dark Mode + PWA + Notifications + Goals + Testing, Deployed to Coolify + Cloudflare Tunnel

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
- **IP:** 172.27.30.17
- **User:** luke_mini
- **Kernel:** 6.6.87.2-microsoft-standard-WSL2
- **RAM:** ~32GB, **Storage:** ~1TB

### Cloudflare Tunnel (RUNNING as systemd service)
- **Tunnel Name:** coolify-tunnel
- **Tunnel ID:** 91882f6d-8f81-4fd6-835d-a213393076d3
- **cloudflared Version:** 2026.2.0
- **Service:** `systemctl status cloudflared` (enabled, auto-starts on boot)
- **Config:** `/etc/cloudflared/config.yml`
- **Credentials:** `/etc/cloudflared/91882f6d-8f81-4fd6-835d-a213393076d3.json`
- **User config backup:** `~/.cloudflared/config.yml` (original, points to home dir)

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
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sillyluke123437733@gmail.com
SMTP_PASSWORD=injq dlal pohz bwfn (Gmail App Password)
SMTP_FROM=noreply@financetracker.com
```

---

## Key Credentials

```
Admin: admin@financetracker.app / ChangeMe123!
Gmail SMTP: sillyluke123437733@gmail.com / App Password: injq dlal pohz bwfn
Server SSH: luke_mini@172.27.30.17
```

---

## Architecture

### Backend (FastAPI + PostgreSQL)
- **Auth:** JWT access tokens (15min) + httpOnly secure refresh token cookies (7-30 days)
- **2FA:** Optional TOTP with Google Authenticator + backup codes
- **CSRF Protection:** Custom header middleware (X-Requested-With) on all state-changing API requests
- **Rate Limiting:** SlowAPI on login (10/min), register (5/min), forgot-password (3/min)
- **All routes protected** - every API endpoint requires authentication
- **Session Management:** Track active sessions per user, revoke individual or all other sessions
- **User-Profile model:** 1:N (household/multi-profile support)
- **Recurring transactions:** Track subscriptions, bills, income with due date forecasting
- **Savings Goals:** Track financial goals with progress, contributions, deadlines
- **Notifications:** Budget threshold alerts (80%+), bill due date reminders (3-day)
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
│   ├── auth.py               # Auth endpoints (login, register, 2FA, change-password, reset, theme)
│   ├── profiles.py           # User profiles (protected)
│   ├── accounts.py           # Bank accounts (protected)
│   ├── transactions.py       # Transactions (protected)
│   ├── budgets.py            # Budget management (protected)
│   ├── analytics.py          # Spending analytics (protected)
│   ├── tsp.py                # TSP simulator (protected)
│   ├── plaid.py              # Plaid bank linking (protected)
│   ├── recurring.py          # Recurring bills & subscriptions (protected)
│   ├── goals.py              # Savings goals CRUD + contributions (protected)
│   ├── notifications.py      # Budget alerts, bill reminders (protected)
│   ├── categorization.py     # Auto-categorization rules + apply (protected)
│   ├── sessions.py           # Active session management (protected)
│   └── export.py             # CSV/Excel data export (protected)
├── schemas/auth.py           # Auth Pydantic schemas
├── services/
│   ├── email.py              # SMTP email service (password reset, welcome emails)
│   └── sync_service.py       # Plaid sync scheduler
├── dependencies.py           # Auth middleware (get_current_active_user)
├── models.py                 # SQLAlchemy models (User, Profile, Account, Transaction, RecurringTransaction, SavingsGoal, CategoryRule, Notification)
├── config.py                 # Settings
├── database.py               # DB session
├── init_db.py                # DB initialization
└── main.py                   # App entry + rate limiter + GZip + cache headers + CORS + CSRF + Sentry + PWA routes
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

---

## Progress

| Area | Status |
|------|--------|
| Backend Auth | 100% |
| CSRF Protection | 100% (custom header middleware) |
| Route Protection | 100% (all 14 routers) |
| Database Migrations | 100% (004 - goals + rules + notifications) |
| Frontend Auth | 100% (login, signup, 2FA, reset, change password) |
| Toast Notifications | 100% |
| Mobile Responsive | 100% (hamburger menu sidebar) |
| Rate Limiting | 100% (login, register, forgot-password) |
| Deployment | 100% (Coolify, auto-deploy from GitHub) |
| Performance | 100% (GZip, code splitting, cache headers) |
| Dark Mode | 100% (all pages, server-persisted) |
| Recurring Bills | 100% (backend + frontend + dashboard widget) |
| Savings Goals | 100% (CRUD + contribute + dashboard widget) |
| Notifications | 100% (budget alerts + bill reminders + bell badge) |
| Auto-Categorization | 100% (rules CRUD + apply) |
| Session Management | 100% (list + revoke) |
| Data Export | 100% (CSV + Excel) |
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
| Plaid Integration | Built, needs real bank testing |

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

# Server SSH
ssh luke_mini@172.27.30.17

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

1. **Plaid:** Uses sandbox credentials, needs real keys for production bank linking
2. **Browser cache:** Hashed assets cached 1yr (immutable), HTML set to no-cache so deploys auto-refresh
3. **QUIC timeouts:** Periodic "timeout: no recent network activity" in cloudflared logs are normal - idle connection recycling, auto-reconnects in seconds
4. **ws.rundskue.com:** May show connection errors if Coolify's Pusher/websocket service (port 6001) isn't running - cosmetic, doesn't affect finance app
5. **Cloudflare tunnel config:** System config at `/etc/cloudflared/config.yml`, user backup at `~/.cloudflared/config.yml` - edit the `/etc/` one for the systemd service
