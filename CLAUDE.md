# Finance Tracker - Project Status

**Last Updated:** 2026-02-07
**Status:** Full-Stack Auth + Performance + Dark Mode + PWA, Deployed to Coolify

## Overview

Self-hosted personal finance tracker with Plaid bank linking, TSP retirement simulator, budgeting, and analytics. Built with FastAPI (Python) backend and React 18 + TypeScript frontend.

**Live URL:** https://finance.rundskue.com
**Coolify Dashboard:** http://172.27.30.17:8000

---

## Architecture

### Backend (FastAPI + PostgreSQL)
- **Auth:** JWT access tokens (15min) + httpOnly secure refresh token cookies (7-30 days)
- **2FA:** Optional TOTP with Google Authenticator + backup codes
- **Rate Limiting:** SlowAPI on login (10/min), register (5/min), forgot-password (3/min)
- **All routes protected** - every API endpoint requires authentication
- **User-Profile model:** 1:N (household/multi-profile support)
- **Recurring transactions:** Track subscriptions, bills, income with due date forecasting
- **Data export:** CSV and Excel export with styled headers
- **Theme persistence:** User theme preference saved server-side

### Frontend (React 18 + TypeScript + Vite)
- **Tailwind CSS** for styling with **dark mode** support (`darkMode: 'class'`)
- **React Query** for server state
- **Axios interceptors** for auto-refresh on 401
- **Toast notifications** for user feedback
- **Mobile responsive** sidebar with hamburger menu
- **Protected routes** with AuthContext
- **Code splitting:** React.lazy() on all 15 pages - each is its own chunk
- **Vendor splitting:** react, data (query+axios), charts (recharts), utils (date-fns+lucide)
- **PWA:** Installable on mobile/desktop with service worker for offline support
- **Dark mode:** System-aware theme toggle with server-side persistence

### Backend Performance
- **GZip compression:** GZipMiddleware on all responses > 500 bytes
- **Cache headers:** Immutable 1yr cache for hashed `/assets/`, no-cache for HTML/SW, no-store for API
- **Database indexes:** Composite + FK indexes on high-query columns
- **Secure cookies:** `secure=True` on all httpOnly refresh token cookies
- **Result:** 821KB monolithic -> 102KB initial transfer (login), 68% compression ratio

### Deployment
- Single Dockerfile: FastAPI serves React static files + PWA assets
- PostgreSQL database on same Coolify instance
- GitHub auto-deploy from main branch

---

## Key Credentials

```
Admin: admin@financetracker.app / ChangeMe123!
```

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
│   └── export.py             # CSV/Excel data export (protected)
├── schemas/auth.py           # Auth Pydantic schemas
├── services/
│   ├── email.py              # SMTP email service (password reset, welcome emails)
│   └── sync_service.py       # Plaid sync scheduler
├── dependencies.py           # Auth middleware (get_current_active_user)
├── models.py                 # SQLAlchemy models (User, Profile, Account, Transaction, RecurringTransaction)
├── config.py                 # Settings
├── database.py               # DB session
├── init_db.py                # DB initialization
└── main.py                   # App entry + rate limiter + GZip + cache headers + CORS + PWA routes
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
├── api.ts                    # Data API client (accounts, transactions, recurring, export, etc.)
├── pages/
│   ├── Login.tsx             # Email/password + 2FA support
│   ├── Signup.tsx            # Registration with password strength
│   ├── ForgotPassword.tsx    # Request reset email
│   ├── ResetPassword.tsx     # Set new password from token
│   ├── ChangePassword.tsx    # Change password (authenticated)
│   ├── TwoFactorSetup.tsx    # Enable/disable 2FA with QR
│   ├── Dashboard.tsx         # Main dashboard with upcoming bills & spending insights
│   ├── Accounts.tsx          # Bank accounts
│   ├── Transactions.tsx      # Transaction list with CSV/Excel export
│   ├── Budgets.tsx           # Budget management
│   ├── RecurringBills.tsx    # Recurring bills & subscriptions CRUD
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
- `/api/export/` - CSV and Excel transaction exports

---

## Features Added This Session

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
- Code ready: password reset emails + welcome emails
- Needs SMTP credentials configured in Coolify env vars
- See `.env.example` for setup instructions

---

## Progress

| Area | Status |
|------|--------|
| Backend Auth | 100% |
| Route Protection | 100% (all 10 routers) |
| Database Migrations | 100% (003 - indexes + recurring + theme) |
| Frontend Auth | 100% (login, signup, 2FA, reset, change password) |
| Toast Notifications | 100% |
| Mobile Responsive | 100% (hamburger menu sidebar) |
| Rate Limiting | 100% (login, register, forgot-password) |
| Deployment | 100% (Coolify, auto-deploy) |
| Performance | 100% (GZip, code splitting, cache headers) |
| Dark Mode | 100% (all pages, server-persisted) |
| Recurring Bills | 100% (backend + frontend + dashboard widget) |
| Data Export | 100% (CSV + Excel) |
| PWA | 100% (manifest + service worker) |
| Secure Cookies | 100% |
| Database Indexes | 100% |
| Plaid Integration | Built, needs real bank testing |
| SMTP Email | Code ready, needs env credentials |

---

## Environment Variables (SMTP Setup)

To enable password reset emails, set these in Coolify environment:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=noreply@financetracker.com
```

For Gmail: Enable 2FA, then create App Password at https://myaccount.google.com/apppasswords

---

## Cloudflare Tunnel Setup

To add CDN/SSL via Cloudflare Tunnel:

1. Install cloudflared on your server:
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
   chmod +x /usr/local/bin/cloudflared
   ```

2. Authenticate with Cloudflare:
   ```bash
   cloudflared tunnel login
   ```

3. Create a tunnel:
   ```bash
   cloudflared tunnel create finance-tracker
   ```

4. Create config at `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

   ingress:
     - hostname: finance.rundskue.com
       service: http://localhost:8000
     - service: http_status:404
   ```

5. Route DNS:
   ```bash
   cloudflared tunnel route dns finance-tracker finance.rundskue.com
   ```

6. Run as a service:
   ```bash
   cloudflared service install
   systemctl start cloudflared
   systemctl enable cloudflared
   ```

Benefits: Free SSL, DDoS protection, global CDN caching, no open ports needed.

---

## Quick Commands

```bash
# Project directory
cd "D:\Coding Projects\Finance Project\finance-tracker"

# Frontend dev
cd frontend && npm run dev

# Frontend build
cd frontend && npm run build

# Git
git log --oneline -5
git status
```

---

## Known Issues / Notes

1. **Plaid:** Uses sandbox credentials, needs real keys for production bank linking
2. **Email:** SMTP not configured - password reset emails won't send without SMTP env vars
3. **Browser cache:** Hashed assets cached 1yr (immutable), HTML set to no-cache so deploys auto-refresh
