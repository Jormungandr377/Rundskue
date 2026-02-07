# Finance Tracker - Project Status

**Last Updated:** 2026-02-07
**Status:** Full-Stack Authentication Complete, Deployed to Coolify

## Overview

Self-hosted personal finance tracker with Plaid bank linking, TSP retirement simulator, budgeting, and analytics. Built with FastAPI (Python) backend and React 18 + TypeScript frontend.

**Live URL:** https://finance.rundskue.com
**Coolify Dashboard:** http://172.27.30.17:8000

---

## Architecture

### Backend (FastAPI + PostgreSQL)
- **Auth:** JWT access tokens (15min) + httpOnly refresh token cookies (7-30 days)
- **2FA:** Optional TOTP with Google Authenticator + backup codes
- **Rate Limiting:** SlowAPI on login (10/min), register (5/min), forgot-password (3/min)
- **All routes protected** - every API endpoint requires authentication
- **User-Profile model:** 1:N (household/multi-profile support)

### Frontend (React 18 + TypeScript + Vite)
- **Tailwind CSS** for styling (no component library)
- **React Query** for server state
- **Axios interceptors** for auto-refresh on 401
- **Toast notifications** for user feedback
- **Mobile responsive** sidebar with hamburger menu
- **Protected routes** with AuthContext

### Deployment
- Single Dockerfile: FastAPI serves React static files
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
│   ├── auth.py               # Auth endpoints (login, register, 2FA, change-password, reset)
│   ├── profiles.py           # User profiles (protected)
│   ├── accounts.py           # Bank accounts (protected)
│   ├── transactions.py       # Transactions (protected)
│   ├── budgets.py            # Budget management (protected)
│   ├── analytics.py          # Spending analytics (protected)
│   ├── tsp.py                # TSP simulator (protected)
│   └── plaid.py              # Plaid bank linking (protected)
├── schemas/auth.py           # Auth Pydantic schemas
├── services/
│   ├── email.py              # SMTP email service
│   └── sync_service.py       # Plaid sync scheduler
├── dependencies.py           # Auth middleware (get_current_active_user)
├── models.py                 # SQLAlchemy models
├── config.py                 # Settings
├── database.py               # DB session
├── init_db.py                # DB initialization
└── main.py                   # App entry + rate limiter + CORS
```

### Frontend
```
frontend/src/
├── contexts/
│   ├── AuthContext.tsx        # Auth state (user, login, logout, register)
│   └── ToastContext.tsx       # Toast notification system
├── components/
│   └── ProtectedRoute.tsx    # Route guard (redirects to /login)
├── services/
│   └── api.ts                # Authenticated axios + auth API methods
├── api.ts                    # Legacy API client (now uses authenticated axios)
├── pages/
│   ├── Login.tsx             # Email/password + 2FA support
│   ├── Signup.tsx            # Registration with password strength
│   ├── ForgotPassword.tsx    # Request reset email
│   ├── ResetPassword.tsx     # Set new password from token
│   ├── ChangePassword.tsx    # Change password (authenticated)
│   ├── TwoFactorSetup.tsx    # Enable/disable 2FA with QR
│   ├── Dashboard.tsx         # Main dashboard
│   ├── Accounts.tsx          # Bank accounts
│   ├── Transactions.tsx      # Transaction list
│   ├── Budgets.tsx           # Budget management
│   ├── Reports.tsx           # Analytics/reports
│   ├── TSPSimulator.tsx      # TSP retirement simulator
│   ├── LinkAccount.tsx       # Plaid bank linking
│   └── Profiles.tsx          # Profile management
├── App.tsx                   # Router + responsive sidebar + layout
├── main.tsx                  # Entry point with QueryClient
├── types.ts                  # TypeScript interfaces
└── index.css                 # Tailwind + custom animations
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
| POST | /change-password | - | Change password (authenticated) |
| POST | /2fa/setup | - | Initialize 2FA |
| POST | /2fa/verify | - | Verify & enable 2FA |
| POST | /2fa/disable | - | Disable 2FA |
| POST | /forgot-password | 3/min | Request reset email |
| POST | /reset-password | - | Reset with token |

### Data APIs (all require auth)
- `/api/profiles/` - User profiles CRUD
- `/api/accounts/` - Bank accounts (via Plaid)
- `/api/transactions/` - Transaction list, categorization
- `/api/budgets/` - Budget CRUD + progress tracking
- `/api/analytics/` - Spending by category, cash flow, trends, net worth
- `/api/tsp/` - TSP scenarios, projections, fund performance
- `/api/plaid/` - Link token, exchange, sync

---

## Progress

| Area | Status |
|------|--------|
| Backend Auth | 100% |
| Route Protection | 100% (all 7 routers) |
| Database Migrations | 100% |
| Frontend Auth | 100% (login, signup, 2FA, reset, change password) |
| Toast Notifications | 100% |
| Mobile Responsive | 100% (hamburger menu sidebar) |
| Rate Limiting | 100% (login, register, forgot-password) |
| Deployment | 100% (Coolify, auto-deploy) |
| Plaid Integration | Built, needs real bank testing |

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

1. **Refresh token cookie:** `secure=False` - should be `True` when HTTPS is configured with proper certs
2. **Plaid:** Uses sandbox credentials, needs real keys for production bank linking
3. **Email:** SMTP not configured - password reset emails won't send without SMTP setup
4. **Browser cache:** After deploys, users may need hard refresh (Ctrl+Shift+F5)
