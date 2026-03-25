# Migration Tools Command Reference

## Prisma

```bash
# Create migration from schema changes
npx prisma migrate dev --name add_users_table

# Apply pending migrations (production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Push schema without migration file (prototyping only)
npx prisma db push

# Reset database (drops all data)
npx prisma migrate reset

# Seed database
npx prisma db seed

# Generate client after schema change
npx prisma generate

# Open database browser
npx prisma studio
```

```prisma
// prisma/schema.prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
}
```

## Alembic (SQLAlchemy)

```bash
# Initialize
alembic init alembic

# Create migration (auto-detect changes)
alembic revision --autogenerate -m "add users table"

# Create empty migration
alembic revision -m "custom data migration"

# Apply all pending
alembic upgrade head

# Apply specific revision
alembic upgrade abc123

# Rollback one step
alembic downgrade -1

# Rollback to specific
alembic downgrade abc123

# Show current revision
alembic current

# Show migration history
alembic history --verbose

# Show SQL without executing
alembic upgrade head --sql
```

```python
# alembic/versions/001_add_users.py
def upgrade():
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('name', sa.String(255)),
    )

def downgrade():
    op.drop_table('users')
```

## Knex.js

```bash
# Create migration
npx knex migrate:make add_users_table

# Run pending migrations
npx knex migrate:latest

# Rollback last batch
npx knex migrate:rollback

# Rollback all
npx knex migrate:rollback --all

# Check status
npx knex migrate:status

# Create seed file
npx knex seed:make seed_users

# Run seeds
npx knex seed:run

# Run specific seed
npx knex seed:run --specific=seed_users.js
```

```javascript
// migrations/20231010_add_users.js
exports.up = function(knex) {
  return knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('email').notNullable().unique();
    t.string('name');
    t.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
```

## TypeORM

```bash
# Create empty migration
npx typeorm migration:create src/migrations/AddUsers

# Generate from entity changes (auto-detect)
npx typeorm migration:generate src/migrations/AddUsers -d src/data-source.ts

# Run pending migrations
npx typeorm migration:run -d src/data-source.ts

# Revert last migration
npx typeorm migration:revert -d src/data-source.ts

# Show migrations
npx typeorm migration:show -d src/data-source.ts
```

```typescript
// src/migrations/1696940136-AddUsers.ts
export class AddUsers1696940136 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "email" VARCHAR NOT NULL UNIQUE,
        "name" VARCHAR
      )
    `);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

## Drizzle

```bash
# Generate migration from schema
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Push schema directly (no migration file)
npx drizzle-kit push

# Open Drizzle Studio (DB browser)
npx drizzle-kit studio

# Drop migration
npx drizzle-kit drop
```

```typescript
// src/schema.ts
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});
```

## Django

```bash
# Create migrations from model changes
python manage.py makemigrations
python manage.py makemigrations myapp --name add_users

# Apply migrations
python manage.py migrate
python manage.py migrate myapp 0003  # Up to specific

# Show migration status
python manage.py showmigrations

# Show SQL for a migration
python manage.py sqlmigrate myapp 0001

# Rollback
python manage.py migrate myapp 0002  # Go back to 0002

# Create empty migration (for data migration)
python manage.py makemigrations myapp --empty --name populate_users

# Squash migrations
python manage.py squashmigrations myapp 0001 0010
```

## Flyway

```bash
# Apply pending migrations
flyway migrate

# Show migration info
flyway info

# Validate applied migrations match local
flyway validate

# Repair checksum mismatches
flyway repair

# Clean database (DROPS EVERYTHING)
flyway clean

# Baseline existing database
flyway baseline -baselineVersion=1
```

```
-- V1__create_users.sql (naming: V{version}__{description}.sql)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255)
);

-- V2__add_users_index.sql
CREATE INDEX idx_users_email ON users(email);
```

```conf
# flyway.conf
flyway.url=jdbc:postgresql://localhost:5432/mydb
flyway.user=admin
flyway.password=${DB_PASSWORD}
flyway.locations=filesystem:./sql/migrations
flyway.baselineOnMigrate=true
```

## Entity Framework Core (.NET)

```bash
# Install EF tools
dotnet tool install --global dotnet-ef

# Create migration
dotnet ef migrations add InitialCreate

# Apply migrations
dotnet ef database update

# Rollback to specific migration
dotnet ef database update PreviousMigrationName

# Revert all migrations
dotnet ef database update 0

# List migrations
dotnet ef migrations list

# Generate SQL script (for production)
dotnet ef migrations script --idempotent -o migration.sql

# Check pending migrations
dotnet ef migrations list | grep "(Pending)"

# Remove last migration (if not applied)
dotnet ef migrations remove
```

Example migration:
```csharp
public partial class AddUserTable : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Users",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy",
                        NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                Email = table.Column<string>(maxLength: 255, nullable: false),
                CreatedAt = table.Column<DateTime>(nullable: false, defaultValueSql: "NOW()")
            },
            constraints: table => table.PrimaryKey("PK_Users", x => x.Id));

        migrationBuilder.CreateIndex("IX_Users_Email", "Users", "Email", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("Users");
    }
}
```

## Laravel Migrations (PHP)

```bash
php artisan make:migration create_users_table
php artisan migrate
php artisan migrate:rollback
php artisan migrate:rollback --step=2
php artisan migrate:status
php artisan migrate:fresh --seed  # WARNING: drops all tables
php artisan db:seed
# Generate SQL without running
php artisan migrate --pretend
```

## Ecto (Elixir)

```bash
mix ecto.gen.migration create_users
mix ecto.migrate
mix ecto.rollback
mix ecto.rollback --step 2
mix ecto.migrations  # show status
mix ecto.reset  # WARNING: drops and recreates
mix run priv/repo/seeds.exs
# Generate SQL
mix ecto.migrate --log-migrations-sql
```
