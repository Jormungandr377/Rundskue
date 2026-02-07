# Data Retention Policy

**Finance Tracker** by Rundskue
**URL:** [https://finance.rundskue.com](https://finance.rundskue.com)

**Version:** 1.0
**Effective Date:** February 2026
**Last Reviewed:** February 2026
**Author:** Luke Robinson

---

## 1. Purpose & Scope

This document defines the data retention practices for Finance Tracker, a personal finance management application operated by Rundskue. It describes what data is collected, how long it is retained, and how it is deleted.

Finance Tracker is a small, independently operated project. This policy is written to be transparent about how user data is handled rather than to satisfy any particular regulatory framework, though the practices described here are informed by general data protection principles.

This policy applies to all data stored by the Finance Tracker application, including data held in the PostgreSQL database, application logs, and encrypted credentials. It covers data for all users of the application at finance.rundskue.com.

---

## 2. Data Categories & Retention Periods

### 2.1 User Account Data

| Data Element | Description | Retention Period |
|---|---|---|
| Email address | Used for login and account identification | Retained while the account is active; deleted within 30 days of an account deletion request |
| Hashed password | Bcrypt or similar one-way hash | Retained while the account is active; deleted within 30 days of an account deletion request |
| Two-factor authentication secrets | TOTP secrets for 2FA | Retained while 2FA is enabled; deleted when 2FA is disabled or the account is deleted |

### 2.2 Bank Connection Data (Plaid)

| Data Element | Description | Retention Period |
|---|---|---|
| Plaid access tokens | Fernet-encrypted tokens linking to bank accounts via Plaid | Retained while the bank link is active; revoked via the Plaid API and deleted from the database when the user unlinks the account |
| Bank account information | Account name, type, last four digits, balances | Retained while the associated bank link is active; deleted when the user unlinks the account or deletes their Finance Tracker account |

### 2.3 Financial Data

| Data Element | Description | Retention Period |
|---|---|---|
| Transactions | Amount, date, merchant name, category | Retained while the user account is active; deleted within 30 days of an account deletion request |
| Budget configurations | User-defined budgets and category allocations | Retained while the user account is active; deleted within 30 days of an account deletion request |
| Savings goals | Goal names, target amounts, progress | Retained while the user account is active; deleted within 30 days of an account deletion request |
| Recurring bills | Bill names, amounts, due dates, frequency | Retained while the user account is active; deleted within 30 days of an account deletion request |

### 2.4 Session & Device Data

| Data Element | Description | Retention Period |
|---|---|---|
| Session tokens | Authentication session identifiers | Automatically expired and purged after 30 days of inactivity |
| Device information | Browser/device metadata associated with sessions | Deleted when the corresponding session is expired or invalidated |

### 2.5 TSP & Retirement Planning Inputs

| Data Element | Description | Retention Period |
|---|---|---|
| Retirement planning inputs | Contribution rates, projections, scenarios | Some inputs are session-scoped only and are not persisted to the database. Any inputs that are persisted follow the same retention period as other financial data. |

### 2.6 Application Logs

| Data Element | Description | Retention Period |
|---|---|---|
| Server and application logs | Request logs, error logs, general operational logs | Retained for 90 days, then automatically deleted |

Logs may contain IP addresses, timestamps, and request paths. They do not intentionally contain financial data, passwords, or access tokens.

---

## 3. Data Deletion Procedures

### 3.1 User-Initiated Account Deletion

When a user requests account deletion:

1. The account is marked for deletion and immediately deactivated (login is disabled).
2. All Plaid access tokens associated with the account are revoked through the Plaid API, then deleted from the database.
3. All user data -- including account information, transactions, budgets, savings goals, recurring bills, and session records -- is permanently deleted from the PostgreSQL database within 30 days.
4. The user is notified by email once deletion is complete.

### 3.2 Bank Account Unlinking

When a user unlinks a bank account:

1. The corresponding Plaid access token is revoked via the Plaid API.
2. The token and associated bank account metadata are deleted from the database.
3. Transaction data previously synced from the unlinked account is retained unless the user explicitly requests its deletion or deletes their entire account.

### 3.3 Automated Expiration

- **Sessions:** A scheduled task runs daily to purge sessions that have been inactive for more than 30 days.
- **Logs:** A scheduled task or log rotation policy removes application logs older than 90 days.

### 3.4 Method of Deletion

Data is deleted via standard SQL `DELETE` operations against the PostgreSQL database. This is a logical deletion; the space is reclaimed by PostgreSQL during normal vacuuming operations. Full-disk erasure or physical destruction is not performed as part of routine deletion, which is typical for a project of this scale.

---

## 4. User Rights

### 4.1 Right to Request Deletion

Users may request deletion of their account and all associated data at any time. Requests can be submitted through the application's account settings or by contacting the address listed in Section 7. Deletion will be completed within 30 days.

### 4.2 Right to Export Data

Users may request an export of their personal data, including:

- Account profile information
- Transaction history
- Budget configurations
- Savings goals and recurring bills

Exports are provided in a standard machine-readable format (JSON or CSV). Export requests can be made through the application or by contacting the address listed in Section 7.

### 4.3 Limitations

Finance Tracker is a personal project and does not have a dedicated legal or compliance team. Requests are handled on a best-effort basis by the project operator. Response times may vary but will generally be within 30 days.

---

## 5. Backup & Archive Policies

### 5.1 Database Backups

The PostgreSQL database is backed up on a regular schedule (daily). Backups are stored on the same server or a directly associated storage volume.

### 5.2 Retention of Backups

Database backups are retained for up to 30 days. Older backups are automatically overwritten or deleted.

### 5.3 Deletion in Backups

When a user account is deleted, the deletion is reflected in all new backups going forward. Existing backups that still contain the deleted data will age out and be removed within the 30-day backup retention window. This means deleted data may persist in backups for up to 30 days after deletion from the live database.

### 5.4 Archive Policy

Finance Tracker does not maintain a separate long-term archive. All data resides in the live database or in short-term backups as described above.

---

## 6. Review Schedule

This policy is reviewed at least once per year. The next scheduled review is **February 2027**.

Changes to this policy will be noted with an updated version number and effective date at the top of this document. Significant changes that affect how user data is retained or deleted will be communicated to users.

### Revision History

| Version | Date | Description |
|---|---|---|
| 1.0 | February 2026 | Initial version |

---

## 7. Contact

For questions about this policy or to submit a data-related request:

**Luke Robinson**
Email: [lukerobinson1234377@outlook.com](mailto:lukerobinson1234377@outlook.com)
