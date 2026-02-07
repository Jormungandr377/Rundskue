# Access Control Policy

**Finance Tracker** by Rundskue
**Version:** 1.0
**Effective Date:** February 7, 2026
**Last Updated:** February 7, 2026
**Application URL:** https://finance.rundskue.com

---

## 1. Purpose

This document defines the access control framework for Finance Tracker. It describes how users are identified, authenticated, authorized, and de-provisioned, and establishes the roles, permissions, and review processes that govern access to the application and its data.

---

## 2. Roles & Permissions

### 2.1 Role Definitions

| Role | Description | Capabilities |
|------|-------------|--------------|
| **User** | Standard end-user | View/manage own financial data, link bank accounts, configure budgets, export data, enable 2FA |
| **Admin** | Application administrator | All User capabilities + user management, role changes, audit log access, access reviews, user deactivation/reactivation |

### 2.2 Principle of Least Privilege

- All accounts default to the **User** role at registration.
- Admin privileges are granted only by an existing admin via the `/api/admin/users/{id}/role` endpoint.
- There is no self-service admin escalation.
- All role changes are recorded in the audit log with the acting admin, target user, and old/new role.

### 2.3 Data Isolation

- Users can only access their own financial data. Every API endpoint enforces ownership checks at the database query level (filtering by `user_id` or `profile_id`).
- Admin endpoints do not grant access to other users' financial data—only to user metadata (email, role, active status, 2FA status, session counts).

---

## 3. Authentication Requirements

### 3.1 Password Policy

| Requirement | Setting |
|-------------|---------|
| Minimum length | 8 characters |
| Uppercase letter | Required |
| Number | Required |
| Special character | Required |

### 3.2 Two-Factor Authentication (2FA)

- TOTP-based 2FA is available to all users (compatible with Google Authenticator, Authy, and similar apps).
- **Admin accounts are required to have 2FA enabled.** Admin users who have not enabled 2FA are blocked from logging in until they enable it.
- At application startup, a warning is logged if any admin accounts lack 2FA.

### 3.3 Session Management

| Setting | Value |
|---------|-------|
| Access token lifetime | 15 minutes |
| Refresh token lifetime | 7 days (standard) / 30 days (remember me) |
| Token storage | Access token in memory; refresh token in httpOnly cookie |
| Concurrent sessions | Allowed; all visible in session management UI |

- Users can view all active sessions and revoke any individual session or all other sessions.
- On user deactivation, all refresh tokens are immediately revoked.

---

## 4. Authorization Model

### 4.1 Zero Trust Architecture

Finance Tracker implements zero trust principles:

- **Per-request authentication:** Every API request is authenticated via JWT. There is no implicit trust based on network location.
- **Per-resource authorization:** Every data access query includes ownership filters. No data is returned without verifying the requesting user owns it.
- **Deny by default:** Unauthenticated requests to `/api/` endpoints return 401. Requests from non-admin users to admin endpoints return 403.

### 4.2 CSRF Protection

- State-changing API requests require an `X-Requested-With` header, leveraging the browser's same-origin policy to prevent cross-site request forgery.

### 4.3 Rate Limiting

- API endpoints are rate-limited per client IP to prevent brute-force attacks and abuse.

### 4.4 Security Headers

All responses include defense-in-depth HTTP headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (API endpoints only)

---

## 5. Provisioning & De-provisioning

### 5.1 Account Provisioning

1. New users register via the `/api/auth/register` endpoint.
2. Registration can be disabled by setting `REGISTRATION_ENABLED=false` in the environment, preventing new sign-ups.
3. New accounts default to the User role.
4. All registrations are recorded in the audit log.

### 5.2 Account De-provisioning (Attestation 9)

When an admin deactivates a user via `/api/admin/users/{id}/deactivate`:

1. The user's `is_active` flag is set to `false` immediately.
2. All of the user's active refresh tokens are revoked immediately.
3. The user can no longer log in or access any data.
4. The action is recorded in the audit log with the acting admin and target user.

This process is automated and takes effect immediately—there is no delay between deactivation and access revocation.

### 5.3 Account Reactivation

- Deactivated accounts can be reactivated by an admin via `/api/admin/users/{id}/reactivate`.
- Reactivation is recorded in the audit log.

---

## 6. Access Review Process

### 6.1 Schedule

Access reviews are conducted quarterly (January, April, July, October). The system automatically creates a notification for admin users on the 1st of each review month.

### 6.2 Review Procedure

1. Admin navigates to the access review report (`GET /api/admin/access-review`).
2. The report includes: total users, active users, admin count, 2FA adoption, and per-user details (role, active status, 2FA status, last login, active sessions, linked bank items).
3. Admin reviews each user's access level and determines if it is still appropriate.
4. Admin records review completion via `POST /api/admin/access-review/complete` with notes.
5. The completion is recorded in the audit log for compliance evidence.

### 6.3 What to Check

- Are all active accounts still needed?
- Do admin accounts still require admin privileges?
- Do all admin accounts have 2FA enabled?
- Are there accounts that haven't logged in recently and should be deactivated?
- Are linked bank items still appropriate for each user?

---

## 7. Audit Logging

All security-relevant actions are recorded in an immutable audit log:

| Event | Logged Details |
|-------|----------------|
| Login (success/failure) | User, IP, user agent, outcome |
| Registration | New user email |
| Logout | User, session |
| Password change/reset | User |
| 2FA enable/disable | User |
| Session revocation | User, session ID |
| Role change | Acting admin, target user, old/new role |
| User deactivation/reactivation | Acting admin, target user |
| Bank account link/unlink | User, institution |
| Data export | User, format, row count |
| Access review completion | Reviewer, notes |

Audit logs are queryable by admins via `GET /api/admin/audit-logs` with filters for action, user, date range, and status.

---

## 8. Infrastructure Access

- The PostgreSQL database is not exposed to the public internet. It is accessible only within the Docker network.
- Database credentials are stored as environment variables, never in source control.
- Server access is limited to the application maintainer.
- All secrets (JWT signing key, Plaid API keys, Fernet encryption key) are managed via environment variables.

---

## 9. Review Schedule

This policy is reviewed at least annually, or whenever significant changes are made to the access control system.

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | February 7, 2026 | Initial access control policy |

---

*For questions about this policy, contact: rundskue@outlook.com*
