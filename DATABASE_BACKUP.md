# Database Backup & Restore Guide

## Overview

This guide covers backup strategies, automated backup setup, and disaster recovery procedures for the Finance Tracker PostgreSQL database.

## Quick Reference

```bash
# Create manual backup
pg_dump -U finance_user -h localhost finance_tracker > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -U finance_user -h localhost finance_tracker < backup_20260208_120000.sql

# Verify backup integrity
pg_restore --list backup.dump
```

---

## Backup Strategies

### 1. Manual Backups

**When to use:**
- Before major migrations
- Before bulk data operations
- Before application upgrades

**SQL Format (recommended for small databases):**
```bash
pg_dump -U finance_user -d finance_tracker -F plain > backup.sql
```

**Custom Format (recommended for large databases):**
```bash
pg_dump -U finance_user -d finance_tracker -F custom > backup.dump
```

**Directory Format (parallel backup/restore):**
```bash
pg_dump -U finance_user -d finance_tracker -F directory -j 4 -f backup_dir/
```

### 2. Automated Daily Backups

#### Option A: Cron Job (Linux/Mac)

Create backup script `/usr/local/bin/backup-finance-db.sh`:
```bash
#!/bin/bash
set -e

# Configuration
DB_NAME="finance_tracker"
DB_USER="finance_user"
BACKUP_DIR="/var/backups/finance-tracker"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/finance_${TIMESTAMP}.sql.gz"

# Create backup
pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

# Verify backup was created
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not created" >&2
    exit 1
fi

# Check file size (should be > 1KB)
FILE_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
if [ "$FILE_SIZE" -lt 1024 ]; then
    echo "ERROR: Backup file too small ($FILE_SIZE bytes)" >&2
    exit 1
fi

# Delete old backups (older than RETENTION_DAYS)
find "$BACKUP_DIR" -name "finance_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "✓ Backup created: $BACKUP_FILE ($FILE_SIZE bytes)"
```

Make executable and add to cron:
```bash
chmod +x /usr/local/bin/backup-finance-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /usr/local/bin/backup-finance-db.sh >> /var/log/finance-backup.log 2>&1
```

#### Option B: Systemd Timer (Linux)

Create `/etc/systemd/system/finance-backup.service`:
```ini
[Unit]
Description=Finance Tracker Database Backup
After=postgresql.service

[Service]
Type=oneshot
User=postgres
ExecStart=/usr/local/bin/backup-finance-db.sh
StandardOutput=journal
StandardError=journal
```

Create `/etc/systemd/system/finance-backup.timer`:
```ini
[Unit]
Description=Daily Finance Tracker Backup
Requires=finance-backup.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:
```bash
sudo systemctl enable finance-backup.timer
sudo systemctl start finance-backup.timer
sudo systemctl status finance-backup.timer
```

#### Option C: Windows Task Scheduler

Create PowerShell script `C:\Scripts\backup-finance-db.ps1`:
```powershell
$BackupDir = "C:\Backups\FinanceTracker"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = "$BackupDir\finance_$Timestamp.sql"

# Create directory if it doesn't exist
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# Run pg_dump
& "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" `
    -U finance_user -d finance_tracker -F plain -f $BackupFile

# Compress with 7-Zip or built-in compression
Compress-Archive -Path $BackupFile -DestinationPath "$BackupFile.zip"
Remove-Item $BackupFile

# Delete old backups (older than 30 days)
Get-ChildItem $BackupDir -Filter "finance_*.sql.zip" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item

Write-Output "✓ Backup created: $BackupFile.zip"
```

Add to Task Scheduler:
- Open Task Scheduler
- Create Basic Task → "Finance Tracker Backup"
- Trigger: Daily at 2:00 AM
- Action: Start a program
  - Program: `powershell.exe`
  - Arguments: `-ExecutionPolicy Bypass -File "C:\Scripts\backup-finance-db.ps1"`

### 3. Cloud Backup (Off-site Storage)

#### AWS S3 Backup Script

```bash
#!/bin/bash
set -e

# Configuration
DB_NAME="finance_tracker"
DB_USER="finance_user"
S3_BUCKET="s3://my-finance-backups"
AWS_PROFILE="default"

# Create backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/finance_${TIMESTAMP}.sql.gz"

pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

# Upload to S3
aws s3 cp "$BACKUP_FILE" "$S3_BUCKET/" --profile "$AWS_PROFILE"

# Clean up local file
rm "$BACKUP_FILE"

# Delete old S3 backups (optional - use lifecycle policy instead)
aws s3 ls "$S3_BUCKET/" --profile "$AWS_PROFILE" | \
    while read -r line; do
        createDate=$(echo "$line" | awk {'print $1" "$2'})
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date -d "30 days ago" +%s)
        if [[ $createDate -lt $olderThan ]]; then
            fileName=$(echo "$line" | awk {'print $4'})
            if [[ $fileName != "" ]]; then
                aws s3 rm "$S3_BUCKET/$fileName" --profile "$AWS_PROFILE"
            fi
        fi
    done

echo "✓ Backup uploaded to S3: $S3_BUCKET/finance_${TIMESTAMP}.sql.gz"
```

---

## Restore Procedures

### 1. Full Database Restore

**From SQL backup:**
```bash
# Stop the application first
docker stop finance-tracker

# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS finance_tracker;"
psql -U postgres -c "CREATE DATABASE finance_tracker OWNER finance_user;"

# Restore from backup
psql -U finance_user -d finance_tracker < backup_20260208_120000.sql

# Restart application
docker start finance-tracker
```

**From custom format:**
```bash
pg_restore -U finance_user -d finance_tracker -c backup.dump
```

### 2. Partial Restore (Specific Tables)

```bash
# Restore only transactions table
pg_restore -U finance_user -d finance_tracker -t transactions backup.dump

# Restore multiple tables
pg_restore -U finance_user -d finance_tracker \
    -t transactions -t accounts -t categories backup.dump
```

### 3. Point-in-Time Recovery (PITR)

**Enable WAL archiving** in `postgresql.conf`:
```conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'
max_wal_senders = 3
```

**Create base backup:**
```bash
pg_basebackup -U postgres -D /var/backups/base -Ft -z -P
```

**Restore to specific point in time:**
```bash
# Stop PostgreSQL
systemctl stop postgresql

# Replace data directory with base backup
rm -rf /var/lib/postgresql/15/main/*
tar -xzf /var/backups/base/base.tar.gz -C /var/lib/postgresql/15/main/

# Create recovery.conf
cat > /var/lib/postgresql/15/main/recovery.conf <<EOF
restore_command = 'cp /var/lib/postgresql/archive/%f %p'
recovery_target_time = '2026-02-08 12:00:00'
EOF

# Start PostgreSQL
systemctl start postgresql
```

---

## Backup Verification

### 1. Test Restore (Recommended Monthly)

```bash
# Create test database
psql -U postgres -c "CREATE DATABASE finance_test;"

# Restore backup to test database
psql -U finance_user -d finance_test < backup.sql

# Run verification queries
psql -U finance_user -d finance_test -c "SELECT COUNT(*) FROM users;"
psql -U finance_user -d finance_test -c "SELECT COUNT(*) FROM transactions;"

# Drop test database
psql -U postgres -c "DROP DATABASE finance_test;"
```

### 2. Backup Integrity Checks

```bash
# Check SQL file is valid
head -n 10 backup.sql  # Should show SQL DDL statements

# Check compressed backup
gzip -t backup.sql.gz  # Tests integrity

# Check custom format backup
pg_restore --list backup.dump | head
```

---

## Disaster Recovery

### Emergency Recovery Checklist

1. **Identify the issue:**
   - Data corruption
   - Accidental deletion
   - Hardware failure
   - Ransomware attack

2. **Stop the application:**
   ```bash
   docker stop finance-tracker
   ```

3. **Assess data loss:**
   ```bash
   psql -U finance_user -d finance_tracker -c "SELECT COUNT(*) FROM transactions;"
   ```

4. **Find latest good backup:**
   ```bash
   ls -lh /var/backups/finance-tracker/ | tail
   ```

5. **Restore database:**
   ```bash
   psql -U postgres -c "DROP DATABASE finance_tracker;"
   psql -U postgres -c "CREATE DATABASE finance_tracker OWNER finance_user;"
   gunzip < /var/backups/finance-tracker/finance_20260208_020000.sql.gz | \
       psql -U finance_user -d finance_tracker
   ```

6. **Verify restoration:**
   ```bash
   psql -U finance_user -d finance_tracker -c "SELECT COUNT(*) FROM transactions;"
   psql -U finance_user -d finance_tracker -c "SELECT email FROM users LIMIT 5;"
   ```

7. **Restart application:**
   ```bash
   docker start finance-tracker
   ```

8. **Test functionality:**
   - Login to web interface
   - Check recent transactions
   - Verify account balances

---

## Monitoring & Alerts

### Backup Success Monitoring

**Check last backup age:**
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/finance-tracker"
LATEST_BACKUP=$(ls -t $BACKUP_DIR/finance_*.sql.gz | head -1)
BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))

if [ $BACKUP_AGE -gt 48 ]; then
    echo "⚠️ WARNING: Latest backup is $BACKUP_AGE hours old!"
    # Send alert email or notification
fi
```

### Integrate with Monitoring Tools

**Prometheus Exporter Example:**
```python
# Add to your monitoring stack
backup_age_hours = Gauge('finance_backup_age_hours', 'Hours since last backup')
backup_size_bytes = Gauge('finance_backup_size_bytes', 'Size of latest backup')

def check_backup_status():
    latest = get_latest_backup()
    age = (datetime.now() - latest.timestamp).total_seconds() / 3600
    size = latest.size

    backup_age_hours.set(age)
    backup_size_bytes.set(size)
```

---

## Best Practices

### ✅ Do's

- **Automate backups** - Set up daily automated backups
- **Test restores** - Verify backups work at least monthly
- **Off-site storage** - Keep backups in different location (cloud)
- **Encrypt backups** - Use encryption for sensitive financial data
- **Monitor backups** - Alert on failed or missing backups
- **Document procedures** - Keep recovery procedures updated
- **Version control** - Keep migration scripts in git

### ❌ Don'ts

- **Don't** rely on a single backup location
- **Don't** keep backups indefinitely without cleanup
- **Don't** skip testing restore procedures
- **Don't** store backups on same server without off-site copy
- **Don't** forget to backup before major changes
- **Don't** ignore backup failure alerts

---

## Encryption

### Encrypt Backups (Recommended for Financial Data)

```bash
# Backup with GPG encryption
pg_dump -U finance_user -d finance_tracker | \
    gzip | \
    gpg --symmetric --cipher-algo AES256 > backup_$(date +%Y%m%d).sql.gz.gpg

# Restore from encrypted backup
gpg --decrypt backup_20260208.sql.gz.gpg | \
    gunzip | \
    psql -U finance_user -d finance_tracker
```

---

## Troubleshooting

### Issue: Backup file is empty or very small
**Solution:** Check PostgreSQL permissions and authentication
```bash
# Test connection
psql -U finance_user -d finance_tracker -c "SELECT version();"

# Check pg_hba.conf for authentication rules
cat /etc/postgresql/15/main/pg_hba.conf
```

### Issue: Restore fails with "permission denied"
**Solution:** Ensure user has proper database privileges
```sql
GRANT ALL PRIVILEGES ON DATABASE finance_tracker TO finance_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO finance_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO finance_user;
```

### Issue: Out of disk space during restore
**Solution:** Clean up old files or expand disk
```bash
# Check disk usage
df -h

# Find large files
du -sh /var/backups/finance-tracker/*

# Clean old backups
find /var/backups/finance-tracker -name "finance_*.sql.gz" -mtime +60 -delete
```

---

## Additional Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [pg_dump Reference](https://www.postgresql.org/docs/current/app-pgdump.html)
- [pg_restore Reference](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [WAL Archiving](https://www.postgresql.org/docs/current/continuous-archiving.html)

---

**Last Updated:** 2026-02-08
**Version:** 1.0
