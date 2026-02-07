# Access Review Procedure

**Finance Tracker** by Rundskue
**Version:** 1.0
**Effective Date:** February 7, 2026
**Application URL:** https://finance.rundskue.com

---

## 1. Purpose

This document defines the procedure for conducting periodic access reviews of user accounts in Finance Tracker. Access reviews ensure that user privileges remain appropriate and that inactive or unnecessary accounts are promptly de-provisioned.

---

## 2. Review Schedule

| Frequency | Months | Automated Reminder |
|-----------|--------|-------------------|
| Quarterly | January, April, July, October | Yes — notification created for admin users on the 1st of each review month |

---

## 3. Reviewer

Access reviews are performed by users with the **Admin** role. The reviewing admin's identity is recorded in the audit log upon completion.

---

## 4. Review Procedure

### Step 1: Generate the Access Review Report

Navigate to the admin panel or call the API endpoint:

```
GET /api/admin/access-review
```

The report includes:
- Total number of users
- Number of active users
- Number of admin users
- Number of users with 2FA enabled
- Per-user details: email, role, active status, 2FA status, last login date, active session count, linked bank items

### Step 2: Review Each User

For each user in the report, evaluate:

| Check | Action if Needed |
|-------|-----------------|
| Is the account still needed? | Deactivate via `PUT /api/admin/users/{id}/deactivate` |
| Is the role appropriate? | Change via `PUT /api/admin/users/{id}/role` |
| Does the admin have 2FA enabled? | Contact user and require 2FA enrollment |
| Has the user logged in recently? | Consider deactivation for long-inactive accounts |
| Are linked bank items appropriate? | Verify with user if unexpected |

### Step 3: Take Corrective Actions

- **Deactivate** accounts that are no longer needed. Deactivation immediately revokes all sessions.
- **Downgrade** admin accounts that no longer require elevated privileges.
- **Contact** admin users who lack 2FA and require them to enable it.

### Step 4: Record Completion

Record the review completion via the admin panel or API:

```
POST /api/admin/access-review/complete
Body: { "notes": "Q1 2026 review completed. All accounts verified. No changes required." }
```

This creates an audit log entry with:
- Timestamp
- Reviewer identity (admin email)
- Review notes
- Status: "completed"

---

## 5. Audit Trail

All actions taken during the review are individually logged:

- User deactivations → `user_deactivated` audit event
- Role changes → `role_changed` audit event
- Review completion → `access_review` audit event

These records are retained indefinitely and can be queried via `GET /api/admin/audit-logs?action=access_review`.

---

## 6. Escalation

If the reviewing admin identifies suspicious activity (e.g., unexpected sessions, unauthorized role changes), they should:

1. Immediately deactivate the affected account.
2. Review the audit log for the affected user's recent activity.
3. Follow the incident response procedure documented in the Security Policy.

---

## Document History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | February 7, 2026 | Initial access review procedure |

---

*For questions about this procedure, contact: rundskue@outlook.com*
