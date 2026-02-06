# Backend - Authentication Implementation Details

**Directory:** `D:\Coding Projects\Finance Project\finance-tracker\backend`
**Status:** Authentication system 100% complete - All routes protected

---

## 🎯 Quick Start for Next Session

### Current Task: Update Remaining API Routers

**Pattern to apply to each router:**

```python
# Step 1: Add imports at top of file
from ..models import User
from ..dependencies import get_current_active_user

# Step 2: Add auth dependency to EVERY endpoint
@router.get("/endpoint")
def endpoint_name(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Step 3: Get user's profile IDs (for filtering)
    profile_ids = [p.id for p in current_user.profiles]

    # Step 4: Filter all queries by user's profiles
    query = db.query(Model).filter(Model.profile_id.in_(profile_ids))

    # Step 5: For specific resource access, verify ownership
    resource = query.filter(Model.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
```

---

## 📝 Routers Checklist

### ✅ All Complete
- [x] `auth.py` - Authentication endpoints (10 endpoints)
- [x] `profiles.py` - All 5 endpoints protected
- [x] `accounts.py` - All 4 endpoints protected
- [x] `transactions.py` - All 7 endpoints protected
- [x] `budgets.py` - All 8 endpoints protected
- [x] `plaid.py` - All 6 endpoints protected
- [x] `analytics.py` - All 6 endpoints protected
- [x] `tsp.py` - All 10 endpoints protected

---

## 📂 Authentication File Structure

### Core Files
```
app/
├── core/
│   ├── security.py          # All security utilities
│   │   ├── hash_password()
│   │   ├── verify_password()
│   │   ├── create_access_token()
│   │   ├── decode_token()
│   │   ├── generate_totp_secret()
│   │   ├── generate_qr_code()
│   │   └── verify_totp()
│   └── __init__.py
│
├── dependencies.py           # Auth middleware
│   ├── get_current_user()
│   ├── get_current_active_user()
│   └── get_optional_current_user()
│
├── models.py                 # Database models
│   ├── User
│   ├── RefreshToken
│   ├── PasswordResetToken
│   └── Profile (updated with user_id)
│
├── schemas/auth.py           # Pydantic schemas
│   ├── UserRegister
│   ├── UserLogin
│   ├── Token
│   ├── TwoFactorSetup
│   ├── ForgotPassword
│   └── ResetPassword
│
├── routers/auth.py           # Auth endpoints
│   ├── POST /auth/register
│   ├── POST /auth/login
│   ├── POST /auth/refresh
│   ├── POST /auth/logout
│   ├── GET /auth/me
│   ├── POST /auth/2fa/setup
│   ├── POST /auth/2fa/verify
│   ├── POST /auth/2fa/disable
│   ├── POST /auth/forgot-password
│   └── POST /auth/reset-password
│
└── services/email.py         # Email service
    ├── send_email()
    ├── send_password_reset_email()
    └── send_welcome_email()
```

### Migration Files
```
alembic/
├── versions/
│   ├── 001_add_authentication.py      # Create auth tables
│   └── 002_make_user_id_required.py   # Add FK constraint
├── env.py                              # Alembic config
└── script.py.mako                      # Migration template

scripts/
└── migrate_to_auth.py                  # Data migration

MIGRATION.md                            # Full migration guide
```

---

## 🔍 Router Update Examples

### Example 1: Simple GET (transactions.py)

**Before:**
```python
@router.get("/")
def get_transactions(db: Session = Depends(get_db)):
    return db.query(Transaction).all()
```

**After:**
```python
@router.get("/")
def get_transactions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get user's profile IDs
    profile_ids = [p.id for p in current_user.profiles]

    # Filter transactions by user's profiles via accounts
    transactions = db.query(Transaction).join(Account).filter(
        Account.profile_id.in_(profile_ids)
    ).all()

    return transactions
```

### Example 2: GET with ID (budgets.py)

**Before:**
```python
@router.get("/{budget_id}")
def get_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Not found")
    return budget
```

**After:**
```python
@router.get("/{budget_id}")
def get_budget(
    budget_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get user's profile IDs
    profile_ids = [p.id for p in current_user.profiles]

    # Filter by user's profiles
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.profile_id.in_(profile_ids)
    ).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Not found")

    return budget
```

### Example 3: POST (budgets.py)

**Before:**
```python
@router.post("/")
def create_budget(budget: BudgetCreate, db: Session = Depends(get_db)):
    db_budget = Budget(**budget.dict())
    db.add(db_budget)
    db.commit()
    return db_budget
```

**After:**
```python
@router.post("/")
def create_budget(
    budget: BudgetCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Verify profile_id belongs to user
    profile_ids = [p.id for p in current_user.profiles]
    if budget.profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied")

    db_budget = Budget(**budget.dict())
    db.add(db_budget)
    db.commit()
    return db_budget
```

---

## 🔐 Security Patterns

### Data Access Control

**Always filter by user's profiles:**
```python
profile_ids = [p.id for p in current_user.profiles]
query.filter(Model.profile_id.in_(profile_ids))
```

**For resources via foreign keys:**
```python
# Transactions are linked to Accounts, which are linked to Profiles
db.query(Transaction).join(Account).filter(
    Account.profile_id.in_(profile_ids)
)
```

### Error Handling

**404 vs 403:**
- Use 404 if resource doesn't exist OR doesn't belong to user (don't reveal existence)
- Only use 403 when explicitly checking permissions on a known resource

```python
# Preferred: 404 for both cases
resource = query.filter(
    Model.id == id,
    Model.profile_id.in_(profile_ids)
).first()
if not resource:
    raise HTTPException(status_code=404, detail="Not found")

# Alternative: Explicit 403
if resource and resource.profile_id not in profile_ids:
    raise HTTPException(status_code=403, detail="Access denied")
```

---

## 🧪 Testing Checklist

After updating each router:

1. **Unauthenticated Access:**
   ```bash
   curl http://localhost:8000/api/endpoint
   # Should return 401 Unauthorized
   ```

2. **With Valid Token:**
   ```bash
   curl -H "Authorization: Bearer <token>" http://localhost:8000/api/endpoint
   # Should return user's data only
   ```

3. **Cross-User Access:**
   - Login as User A
   - Try to access User B's resource by ID
   - Should return 404 (not 403)

4. **Combined View:**
   - User with multiple profiles
   - Should see data from ALL their profiles
   - Should NOT see other users' data

---

## 🔧 Configuration

### Required Environment Variables

**Minimum for auth to work:**
```bash
SECRET_KEY=<generate with: openssl rand -hex 32>
DATABASE_URL=postgresql://user:pass@host:5432/finance_tracker
```

**Optional for full features:**
```bash
# Email (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@financetracker.com

# Frontend URL (for CORS and email links)
FRONTEND_URL=http://localhost:3000

# Token durations (defaults shown)
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
REFRESH_TOKEN_REMEMBER_ME_DAYS=30

# Password policy (defaults shown)
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_NUMBER=true
PASSWORD_REQUIRE_SPECIAL=true
```

### Settings in config.py

All auth settings are defined in `app/config.py`:
```python
class Settings(BaseSettings):
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    # ... etc
```

---

## 🚀 Deployment Steps

### 1. Update Environment Variables in Coolify

```bash
SECRET_KEY=<generated-key>
DATABASE_URL=postgresql://postgres:password@host:5432/finance_tracker
SMTP_USER=<your-email>
SMTP_PASSWORD=<your-app-password>
```

### 2. Deploy Application

Coolify will automatically rebuild with new code.

### 3. Run Migrations

```bash
# SSH into Coolify container or use Coolify terminal
alembic upgrade 001
python scripts/migrate_to_auth.py
alembic upgrade 002
```

### 4. Verify

```bash
# Test health endpoint
curl https://finance.rundskue.com/api/health

# Test login with default credentials
curl -X POST https://finance.rundskue.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@financetracker.local","password":"ChangeMe123!","remember_me":true}'
```

### 5. Change Default Password

Login with default credentials and immediately change password via frontend or API.

---

## 📊 Database Schema Changes

### New Tables

**users:**
- id (PK)
- email (unique, indexed)
- hashed_password
- is_active
- is_verified
- totp_secret
- totp_enabled
- backup_codes (JSON)
- created_at
- updated_at

**refresh_tokens:**
- id (PK)
- token (unique, indexed)
- user_id (FK → users.id)
- expires_at
- is_revoked
- created_at
- user_agent
- ip_address

**password_reset_tokens:**
- id (PK)
- token (unique, indexed)
- user_id (FK → users.id)
- expires_at
- is_used
- created_at

### Modified Tables

**profiles:**
- Added: user_id (FK → users.id)

---

## 🐛 Common Issues & Solutions

### Issue: "Module not found" errors
**Solution:** Dependencies not installed. Run:
```bash
cd backend
pip install -r requirements.txt
```

### Issue: Migration fails with "relation already exists"
**Solution:** Database already has auth tables. Check migration status:
```bash
alembic current
alembic history
```

### Issue: "SECRET_KEY not set" error
**Solution:** Generate and set in environment:
```bash
openssl rand -hex 32
# Add to .env or Coolify environment
```

### Issue: Email not sending
**Solution:**
1. Check SMTP credentials are correct
2. For Gmail, use App Password (not regular password)
3. Check logs for specific SMTP errors

### Issue: 401 on protected endpoints
**Solution:**
1. Verify token is being sent in Authorization header
2. Check token hasn't expired (15 min for access tokens)
3. Try refreshing token via /auth/refresh endpoint

---

## 📚 Additional Resources

- **Main CLAUDE.md:** Project-level context in parent directory
- **MIGRATION.md:** Detailed migration guide with troubleshooting
- **.env.example:** Template for environment variables
- **Alembic docs:** https://alembic.sqlalchemy.org/
- **FastAPI Security:** https://fastapi.tiangolo.com/tutorial/security/

---

**Next Action:** Configure environment variables, deploy to Coolify, run database migrations, and begin frontend auth implementation.
