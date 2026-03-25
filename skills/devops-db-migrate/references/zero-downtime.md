# Zero-Downtime Migrations Reference

## Expand-Contract Pattern

The safest approach: add new, migrate data, remove old.

```sql
-- Step 1: EXPAND - Add new column (non-blocking)
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

-- Step 2: MIGRATE - Backfill data
UPDATE users SET full_name = first_name || ' ' || last_name
WHERE full_name IS NULL;
-- For large tables, batch it:
-- UPDATE users SET full_name = first_name || ' ' || last_name
-- WHERE id BETWEEN 1 AND 10000 AND full_name IS NULL;

-- Step 3: Deploy code that writes to BOTH columns

-- Step 4: Deploy code that reads from new column only

-- Step 5: CONTRACT - Remove old columns (next release)
ALTER TABLE users DROP COLUMN first_name;
ALTER TABLE users DROP COLUMN last_name;
```

## Dangerous Operations Checklist

### Adding NOT NULL Without Default -- LOCKS TABLE

```sql
-- BAD: Locks entire table, rewrites all rows
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';

-- SAFE: Three-step approach
ALTER TABLE users ADD COLUMN role VARCHAR(20);                -- No lock
UPDATE users SET role = 'user' WHERE role IS NULL;            -- Backfill
ALTER TABLE users ALTER COLUMN role SET NOT NULL;             -- Brief lock
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';       -- For new rows
```

### Adding Index on Large Table -- LOCKS WRITES

```sql
-- BAD: Locks table for writes during build
CREATE INDEX idx_users_email ON users(email);

-- SAFE: PostgreSQL - non-blocking
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- SAFE: MySQL 5.6+ (online DDL)
ALTER TABLE users ADD INDEX idx_users_email (email), ALGORITHM=INPLACE, LOCK=NONE;
```

### Renaming Column -- BREAKS RUNNING CODE

```sql
-- BAD: Running code still references old name
ALTER TABLE users RENAME COLUMN name TO full_name;

-- SAFE: Expand-contract
-- 1. Add new column
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
-- 2. Backfill
UPDATE users SET full_name = name WHERE full_name IS NULL;
-- 3. Deploy code using both columns
-- 4. Deploy code using only new column
-- 5. Drop old column next release
ALTER TABLE users DROP COLUMN name;
```

### Dropping Column -- IRREVERSIBLE

```sql
-- Always ensure no code references the column before dropping
-- Check with: grep -r "column_name" src/

-- PostgreSQL: mark unused first (instant, no lock)
-- Then drop later when confirmed safe
ALTER TABLE users DROP COLUMN IF EXISTS legacy_field;
```

### Changing Column Type

```sql
-- BAD: May lock table and fail on incompatible data
ALTER TABLE users ALTER COLUMN age TYPE bigint;

-- SAFE: Expand-contract
ALTER TABLE users ADD COLUMN age_new bigint;
UPDATE users SET age_new = age::bigint WHERE age_new IS NULL;
-- Deploy code to use age_new
ALTER TABLE users DROP COLUMN age;
ALTER TABLE users RENAME COLUMN age_new TO age;
```

## Online Schema Change Tools

### pt-online-schema-change (Percona, MySQL)

```bash
# Creates shadow table, copies data, swaps
pt-online-schema-change \
  --alter "ADD COLUMN role VARCHAR(20) DEFAULT 'user'" \
  --execute \
  --max-load Threads_running=25 \
  --critical-load Threads_running=50 \
  D=mydb,t=users,h=localhost
```

### gh-ost (GitHub, MySQL)

```bash
# Triggerless online migration
gh-ost \
  --host=localhost \
  --database=mydb \
  --table=users \
  --alter="ADD COLUMN role VARCHAR(20) DEFAULT 'user'" \
  --execute \
  --chunk-size=1000 \
  --max-load=Threads_running=25
```

## Blue-Green Database Migration

```bash
# 1. Create read replica
# 2. Apply schema changes to replica
# 3. Let replica catch up
# 4. Promote replica to primary
# 5. Point application to new primary
# 6. Decommission old primary

# AWS RDS example
aws rds create-db-instance-read-replica \
  --db-instance-identifier mydb-blue \
  --source-db-instance-identifier mydb-green

aws rds promote-read-replica \
  --db-instance-identifier mydb-blue
```

## Backup Before Migration

### PostgreSQL

```bash
# Full dump
pg_dump -h localhost -U admin mydb > backup_$(date +%Y%m%d_%H%M%S).sql

# Custom format (parallel restore)
pg_dump -Fc -h localhost -U admin mydb > backup.dump
pg_restore -j 4 -d mydb backup.dump

# Specific tables
pg_dump -t users -t orders mydb > tables_backup.sql

# Schema only (verify migration SQL)
pg_dump --schema-only mydb > schema_before.sql
```

### MySQL

```bash
# Full dump with transactions (InnoDB safe)
mysqldump --single-transaction --routines --triggers \
  -h localhost -u admin -p mydb > backup_$(date +%Y%m%d).sql

# Specific tables
mysqldump --single-transaction mydb users orders > tables_backup.sql
```

### Cloud Snapshots

```bash
# AWS RDS snapshot
aws rds create-db-snapshot \
  --db-instance-identifier mydb \
  --db-snapshot-identifier pre-migration-$(date +%Y%m%d)

# GCP Cloud SQL
gcloud sql backups create --instance=mydb --description="pre-migration"

# Verify backup exists before proceeding
aws rds describe-db-snapshots \
  --db-snapshot-identifier pre-migration-20231010 \
  --query 'DBSnapshots[0].Status'
```

## Migration Runbook Template

```bash
#!/bin/bash
set -euo pipefail

echo "=== Pre-migration checks ==="
# 1. Verify backup
pg_dump -Fc mydb > pre_migration_backup.dump
echo "Backup created: $(ls -lh pre_migration_backup.dump)"

# 2. Check current schema version
npx prisma migrate status  # or alembic current

# 3. Test migration on staging first
echo "Confirmed staging migration succeeded? (y/n)"
read confirm && [ "$confirm" = "y" ] || exit 1

echo "=== Applying migration ==="
# 4. Enable maintenance mode / reduce traffic
# 5. Apply migration
npx prisma migrate deploy

echo "=== Post-migration checks ==="
# 6. Verify schema
psql mydb -c "\dt"
psql mydb -c "SELECT count(*) FROM users;"

# 7. Run smoke tests
curl -f https://api.example.com/health || echo "HEALTH CHECK FAILED"

echo "=== Migration complete ==="
```
