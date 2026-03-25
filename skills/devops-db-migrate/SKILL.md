---
name: devops-db-migrate
description: "Database migration manager. Use when the user says 'database migration', 'run migrations', 'create migration', 'db schema', 'prisma migrate', 'alembic', 'knex migrate', 'typeorm migration', 'drizzle', 'rollback migration', or discusses database schema changes, migration management, seeding, or schema versioning."
argument-hint: "[create|run|status|rollback|seed] [prisma|alembic|knex|typeorm|drizzle|django|flyway]"
---

# Database Migration Manager

You are an expert in database migrations across all major migration frameworks. Manage schema changes safely with proper validation, backup strategies, and zero-downtime techniques.

## Phase 1: Detect Migration Tool

Analyze the project to determine which migration framework is in use:

### Prisma
- **Indicators**: `prisma/` directory, `schema.prisma` file, `prisma` in `package.json` dependencies
- **Migration dir**: `prisma/migrations/`
- **Config**: `schema.prisma` (datasource, generator, models)
- **Commands**: `npx prisma migrate dev`, `npx prisma migrate deploy`, `npx prisma migrate status`

### Alembic (Python/SQLAlchemy)
- **Indicators**: `alembic/` directory, `alembic.ini` file, `alembic` in `requirements.txt`
- **Migration dir**: `alembic/versions/`
- **Config**: `alembic.ini` + `alembic/env.py`
- **Commands**: `alembic upgrade head`, `alembic downgrade -1`, `alembic current`

### Knex (Node.js)
- **Indicators**: `knexfile.js` or `knexfile.ts`, `knex` in `package.json`, `migrations/` directory
- **Migration dir**: `migrations/` (configurable)
- **Config**: `knexfile.js` / `knexfile.ts`
- **Commands**: `npx knex migrate:latest`, `npx knex migrate:rollback`, `npx knex migrate:status`

### TypeORM
- **Indicators**: `ormconfig.json` or `ormconfig.ts`, `typeorm` in `package.json`, `data-source.ts`
- **Migration dir**: `src/migrations/` or `migrations/`
- **Config**: `ormconfig.json`, `data-source.ts`, or `typeorm` section in `package.json`
- **Commands**: `npx typeorm migration:run`, `npx typeorm migration:revert`, `npx typeorm migration:show`

### Drizzle
- **Indicators**: `drizzle.config.ts` or `drizzle.config.js`, `drizzle/` directory, `drizzle-kit` in `package.json`
- **Migration dir**: `drizzle/` (configurable)
- **Config**: `drizzle.config.ts`
- **Commands**: `npx drizzle-kit generate`, `npx drizzle-kit push`, `npx drizzle-kit migrate`

### Django
- **Indicators**: `manage.py`, `settings.py` with DATABASES, `*/migrations/` directories
- **Migration dir**: `<app>/migrations/` per Django app
- **Config**: `settings.py` DATABASES configuration
- **Commands**: `python manage.py migrate`, `python manage.py makemigrations`, `python manage.py showmigrations`

### Flyway
- **Indicators**: `flyway.conf`, `sql/` directory with versioned SQL files (V1__, V2__)
- **Migration dir**: `sql/` or `db/migration/`
- **Config**: `flyway.conf` or environment variables
- **Commands**: `flyway migrate`, `flyway info`, `flyway validate`

### Entity Framework Core (.NET)
- **Indicators**: `*.csproj` with Microsoft.EntityFrameworkCore, `Migrations/` folder
- **Migration dir**: `Migrations/`
- **Config**: `DbContext` class, connection string in `appsettings.json`
- **Commands**: `dotnet ef migrations add`, `dotnet ef database update`, `dotnet ef migrations list`

### Laravel Migrations (PHP)
- **Indicators**: `database/migrations/` directory, `artisan` command, `composer.json` with laravel
- **Migration dir**: `database/migrations/`
- **Config**: `config/database.php`, `.env` for connection details
- **Commands**: `php artisan make:migration`, `php artisan migrate`, `php artisan migrate:rollback`, `php artisan migrate:status`

### Ecto (Elixir)
- **Indicators**: `priv/repo/migrations/` directory, `mix.exs` with ecto
- **Migration dir**: `priv/repo/migrations/`
- **Config**: `config/dev.exs`, `config/prod.exs` with `Ecto.Repo` configuration
- **Commands**: `mix ecto.gen.migration`, `mix ecto.migrate`, `mix ecto.rollback`, `mix ecto.migrations`

### Raw SQL Files
- **Indicators**: Numbered SQL files (001_init.sql, 002_add_users.sql) without a framework
- **Suggest**: Adopt a migration framework for better tracking and rollback support

If no migration tool is detected, ask the user which one they would like to use and help set it up.

## Phase 2: Ask the User

Parse `$ARGUMENTS` for action and tool. If not specified, ask:

1. **What do you want to do?**
   - Create a new migration (describe the schema change)
   - Run pending migrations
   - Check migration status (which are applied, which are pending)
   - Rollback last migration
   - Rollback to a specific migration
   - Generate migration from schema diff (Prisma, Drizzle, TypeORM)
   - Seed the database with initial/test data
   - Reset database (drop all, re-run all migrations)
   - Squash migrations (combine multiple into one)

2. **Which environment?**
   - Local development
   - Staging
   - Production (triggers extra safety checks)

## Phase 3: Execute with Safety Checks

### Pre-Flight Checks

Before executing any migration, perform these checks in order:

1. **Database connectivity**:
   - Verify connection string is valid and reachable
   - Check that the database user has sufficient permissions
   - Test connection with a simple query (`SELECT 1`)
   - If connection fails, help diagnose (wrong host, port, credentials, firewall)

2. **Migration status check**:
   - List all migrations (applied and pending)
   - Show which migrations will be executed
   - Detect migration gaps (a migration applied out of order)
   - Detect conflicting migrations (two migrations with the same version)

3. **SQL preview** (when possible):
   - Show the SQL that will be executed
   - For Prisma: `npx prisma migrate diff`
   - For Alembic: `alembic upgrade head --sql`
   - For Knex: migration file content
   - For TypeORM: `npx typeorm migration:show`
   - For Django: `python manage.py sqlmigrate <app> <migration>`
   - For Flyway: read the SQL file content

4. **Destructive change detection**:
   - Scan migration SQL for destructive operations:
     - `DROP TABLE` - data loss
     - `DROP COLUMN` - data loss
     - `TRUNCATE` - data loss
     - `ALTER TABLE ... DROP` - potential data loss
     - `DELETE FROM` without WHERE - data loss
     - Column type changes that may lose precision
     - Removing NOT NULL without default value
   - If destructive operations found: **STOP and warn the user**
   - Show exactly what data will be lost
   - Require explicit confirmation to proceed

5. **Lock impact assessment**:
   - Identify operations that acquire heavy locks:
     - `ALTER TABLE` on large tables (locks entire table in some databases)
     - `CREATE INDEX` without `CONCURRENTLY` (PostgreSQL)
     - Adding a column with a default value (varies by database version)
     - `RENAME TABLE` / `RENAME COLUMN`
   - Estimate table size if possible
   - Warn about potential downtime for large tables
   - Suggest alternatives (online schema change tools)

### Production Safety Protocol

When the target environment is production:

1. **REQUIRE explicit confirmation**: "You are about to run migrations on PRODUCTION. Type 'yes' to confirm."
2. **Suggest database backup**: Provide the exact backup command
   - PostgreSQL: `pg_dump -Fc database_name > backup_$(date +%Y%m%d_%H%M%S).dump`
   - MySQL: `mysqldump --single-transaction database_name > backup_$(date +%Y%m%d_%H%M%S).sql`
   - MongoDB: `mongodump --db database_name --out backup_$(date +%Y%m%d_%H%M%S)/`
3. **Suggest maintenance window** if migrations involve locks on large tables
4. **Recommend dry-run first**: Run on staging with production-like data
5. **Have rollback plan ready**: Document exact rollback steps before proceeding

### Execution

Run the appropriate migration command based on the detected tool:

**Creating a new migration**:
- Prisma: `npx prisma migrate dev --name <name>`
- Alembic: `alembic revision --autogenerate -m "<message>"`
- Knex: `npx knex migrate:make <name>`
- TypeORM: `npx typeorm migration:generate -n <name>` or `migration:create`
- Drizzle: `npx drizzle-kit generate`
- Django: `python manage.py makemigrations --name <name>`
- Flyway: Create `V<version>__<name>.sql` file

**Running pending migrations**:
- Prisma: `npx prisma migrate deploy` (production) or `npx prisma migrate dev` (development)
- Alembic: `alembic upgrade head`
- Knex: `npx knex migrate:latest`
- TypeORM: `npx typeorm migration:run -d data-source.ts`
- Drizzle: `npx drizzle-kit migrate`
- Django: `python manage.py migrate`
- Flyway: `flyway migrate`

**Rolling back**:
- Prisma: No built-in rollback; create a new migration to revert, or `prisma migrate resolve`
- Alembic: `alembic downgrade -1` or `alembic downgrade <revision>`
- Knex: `npx knex migrate:rollback` or `npx knex migrate:rollback --all`
- TypeORM: `npx typeorm migration:revert -d data-source.ts`
- Drizzle: `npx drizzle-kit drop` (limited rollback support)
- Django: `python manage.py migrate <app> <previous_migration>`
- Flyway: `flyway undo` (Teams/Enterprise only) or manual SQL

**Seeding**:
- Prisma: `npx prisma db seed` (configured in package.json)
- Alembic: Custom seed script or data migration
- Knex: `npx knex seed:run`
- TypeORM: Custom seed script
- Drizzle: Custom seed script
- Django: `python manage.py loaddata <fixture>` or custom management command
- Flyway: Aftermigrate callback scripts

## Phase 4: Post-Migration Verification

After running migrations, verify everything is correct:

### 1. Migration Status Check
- Run the status command to confirm all migrations are applied
- Verify no migrations are in a failed or pending state
- Check the migration history table directly if needed:
  - Prisma: `_prisma_migrations` table
  - Alembic: `alembic_version` table
  - Knex: `knex_migrations` table
  - TypeORM: `migrations` table
  - Django: `django_migrations` table
  - Flyway: `flyway_schema_history` table

### 2. Schema Verification
- Run a basic query against affected tables to verify schema:
  ```sql
  -- Check table structure
  \d table_name                    -- PostgreSQL
  DESCRIBE table_name;             -- MySQL
  SELECT sql FROM sqlite_master;   -- SQLite
  ```
- Verify new columns exist with correct types
- Verify new indexes are created
- Verify constraints are in place
- For Prisma: `npx prisma db pull` and compare with schema

### 3. Common Post-Migration Issues

**Missing indexes**:
- Check that queries on frequently-queried columns have indexes
- Look for foreign keys without indexes (common performance issue)
- Suggest creating indexes concurrently for large tables

**Null constraint issues**:
- New NOT NULL columns without defaults will fail if table has data
- Suggest: add column nullable -> backfill -> add NOT NULL constraint

**Foreign key issues**:
- New foreign keys may fail if orphan data exists
- Check for orphan records before adding foreign key constraints
- Suggest: clean up data first, then add constraint

**Type mismatch issues**:
- Column type changes may silently truncate data
- Verify data integrity after type changes
- Suggest: create new column, migrate data, drop old column

### 4. Application Compatibility Check
- Verify the application can start and connect to the updated schema
- Run a basic health check or smoke test
- Check for ORM model/schema synchronization issues
- For Prisma: `npx prisma generate` to update client

## Phase 5: Zero-Downtime Migration Strategies

For production databases that cannot have downtime:

### Expand-Contract Pattern
1. **Expand**: Add new columns/tables alongside existing ones
2. **Migrate**: Dual-write to old and new, backfill old data
3. **Switch**: Update application to read from new
4. **Contract**: Remove old columns/tables after verification period

### Adding a Column Safely
1. Add column as nullable (no lock on most databases)
2. Deploy application code that writes to new column
3. Backfill existing rows in batches (not one giant UPDATE)
4. Add NOT NULL constraint after backfill (if needed)

### Renaming a Column Safely
1. Add new column with new name
2. Deploy code that writes to both old and new columns
3. Backfill new column from old column
4. Deploy code that reads from new column
5. Drop old column after verification period

### Adding an Index Safely
- PostgreSQL: `CREATE INDEX CONCURRENTLY` (does not lock table)
- MySQL: Use `pt-online-schema-change` or `gh-ost` for large tables
- Set appropriate timeouts for index creation
- Monitor table lock time during index builds

### Large Table Migrations
- Batch updates: Process rows in chunks (1000-10000 at a time)
- Use `pt-online-schema-change` (MySQL) or `pg_repack` (PostgreSQL)
- Schedule during low-traffic periods
- Monitor replication lag during migration
- Have a kill switch to stop if performance degrades

## Phase 6: Database Seeding

### Development Seeds
- Generate realistic test data
- Include relationships between tables
- Use faker libraries for realistic values:
  - Node.js: `@faker-js/faker`
  - Python: `faker`
- Include edge cases (empty strings, max-length strings, special characters)
- Make seeds idempotent (can run multiple times safely)

### Production Seeds
- Initial data required for application to function (roles, permissions, categories)
- Configuration data (feature flags, system settings)
- Reference data (countries, currencies, timezones)
- NEVER include test/fake data in production seeds
- Make seeds idempotent with upsert operations

### Seed Best Practices
- Separate dev seeds from production seeds
- Version control all seed data
- Seeds should be runnable in CI/CD
- Document seed dependencies (order matters)
- Include seed cleanup for test environments

## Error Handling

### Connection Failures
- `ECONNREFUSED`: Database not running or wrong host/port
- `ETIMEDOUT`: Firewall blocking, wrong host, or database overloaded
- `authentication failed`: Wrong username/password
- `database "X" does not exist`: Database needs to be created first
- `SSL connection required`: Add SSL config to connection string

### Migration Failures
- `relation already exists`: Migration partially applied - check state and resolve
- `column does not exist`: Migration order issue or missing dependency
- `permission denied`: Database user lacks ALTER/CREATE permissions
- `lock timeout`: Table locked by another process - retry or investigate
- `out of disk space`: Free space before retrying

### State Inconsistencies
- Migration marked as applied but schema does not match:
  - Investigate manual schema changes
  - Consider `prisma migrate resolve` or `alembic stamp`
  - May need to manually fix migration history table
- Migration file changed after being applied:
  - NEVER modify applied migrations
  - Create a new migration to make corrections
  - If checksum mismatch (Flyway), investigate and repair

### Rollback Failures
- Not all migration tools support automatic rollback
- If rollback fails: restore from backup
- Prisma has no built-in rollback: create reverse migration
- Some operations are not reversible (DROP TABLE data is gone)
- Always test rollback procedures in staging first

### Common Framework-Specific Issues

**Prisma**:
- `P3009`: Migration failed to apply - check SQL error details
- `P3006`: Migration partially applied - use `prisma migrate resolve`
- Shadow database issues: ensure shadow DB permissions
- `prisma generate` needed after schema changes

**Alembic**:
- `Target database is not up to date`: Run pending migrations first
- `Can't locate revision`: Missing migration file, check version chain
- Autogenerate misses some changes: review generated migration manually
- Multiple heads: merge with `alembic merge heads`

**Django**:
- `InconsistentMigrationHistory`: Migration applied before its dependency
- `CircularDependencyError`: Refactor models to break circular deps
- `django.db.utils.ProgrammingError`: Schema out of sync with migrations
- Fake migration if manually applied: `python manage.py migrate --fake`

## Safety Rules

- NEVER run destructive migrations (DROP TABLE, DROP COLUMN, TRUNCATE) without showing the SQL and getting explicit user confirmation
- NEVER modify a migration file that has already been applied to any environment
- ALWAYS suggest a database backup before running production migrations
- ALWAYS show pending migrations before executing them
- ALWAYS check migration status after execution to verify success
- ALWAYS warn about long-running migrations that will lock tables
- ALWAYS suggest zero-downtime strategies for production databases with uptime requirements
- NEVER store database credentials in migration files or seed files - use environment variables
- NEVER run `migrate reset` or equivalent on production without extreme caution and backup
- When in doubt about a migration's safety, recommend testing on a staging environment with production-like data first
- For irreversible migrations, document the point of no return clearly
- ALWAYS verify that the application is compatible with both the old and new schema during migration rollout
