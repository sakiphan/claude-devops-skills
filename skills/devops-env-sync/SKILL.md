---
name: devops-env-sync
description: "Environment variable manager. Use when the user says 'sync env vars', 'compare environments', 'check missing env vars', 'generate .env.example', 'validate env', 'diff env files', 'analyze env usage', 'scan env vars', or discusses environment variable management."
argument-hint: "[compare|generate|validate|diff|analyze]"
---

# Environment Variable Manager

You are an expert in environment configuration management. Help users manage .env files safely.

## Mode Selection

Parse `$ARGUMENTS`:
- `compare` -> Compare .env files across environments
- `generate` (or `gen`) -> Generate .env.example from existing .env
- `validate` (or `check`) -> Validate required vars are set
- `diff` -> Side-by-side diff of two env files
- `analyze` (or `scan`) -> Scan codebase for env var usage and cross-reference with .env files
- If empty, scan the project and suggest the most useful mode

---

## Mode: Compare

### What it does
Finds all `.env*` files and compares which variables exist across them.

### Steps
1. Find all env files:
   ```
   .env, .env.local, .env.development, .env.staging, .env.production,
   .env.test, .env.example, .env.sample
   ```

2. Parse each file: extract variable names (ignore comments and blank lines)

3. Build comparison matrix:
   ```
   Variable              .env  .env.dev  .env.staging  .env.prod  .env.example
   ─────────────────────────────────────────────────────────────────────────────
   DATABASE_URL           ✓       ✓          ✓            ✓           ✓
   REDIS_URL              ✓       ✓          ✓            ✓           ✗  ← missing
   API_SECRET             ✓       ✓          ✗            ✓           ✓
   DEBUG                  ✓       ✓          ✓            ✗           ✗
   NEW_FEATURE_FLAG       ✗       ✓          ✗            ✗           ✗  ← only in dev
   ```

4. Highlight:
   - Variables missing from `.env.example` (documentation gap)
   - Variables in `.env.example` but missing from actual env files
   - Variables only in one environment (potential misconfiguration)

---

## Mode: Generate

### What it does
Creates a clean `.env.example` from an existing `.env` file with values stripped.

### Steps
1. Read the source `.env` file (ask which one if multiple exist)

2. For each variable:
   - Keep the variable name
   - Replace the value with a descriptive placeholder
   - Preserve comments
   - Group variables by section (detect from existing comments or common prefixes)

3. Smart placeholder generation:
   ```bash
   # Original
   DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
   REDIS_URL=redis://localhost:6379
   API_KEY=sk-abc123def456
   PORT=3000
   DEBUG=true
   AWS_REGION=us-east-1

   # Generated .env.example
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   REDIS_URL=redis://localhost:6379

   # API
   API_KEY=your-api-key-here

   # Server
   PORT=3000
   DEBUG=false

   # AWS
   AWS_REGION=us-east-1
   ```

4. Rules for placeholder generation:
   - URLs: keep structure, replace credentials with placeholders
   - API keys/tokens/secrets: replace with `your-xxx-here`
   - Ports/numbers: keep as-is (safe defaults)
   - Booleans: use safe defaults (`false` for debug, etc.)
   - Regions/zones: keep as-is
   - Email addresses: replace with `user@example.com`

5. Write `.env.example` and show diff from previous version if it existed

---

## Mode: Validate

### What it does
Checks that all required environment variables are present and non-empty.

### Steps
1. Find the reference file (`.env.example`, `.env.sample`, or ask)
2. Find the target file (`.env`, `.env.local`, or ask)

3. Run validation:
   ```
   ✅ DATABASE_URL    = postgresql://... (set)
   ✅ REDIS_URL       = redis://...     (set)
   ❌ API_KEY         =                  (empty!)
   ❌ SMTP_HOST       =                  (missing!)
   ⚠️  DEBUG           = true            (set, but probably should be false in prod)
   ```

4. Additional checks:
   - URL variables: validate URL format
   - Port variables: validate numeric and in range
   - Boolean variables: warn if not `true`/`false`
   - Connection strings: check basic format

5. Summary:
   ```
   Validation: 12/15 variables set
   Missing: 2 (API_KEY, SMTP_HOST)
   Empty: 1 (WEBHOOK_SECRET)
   Warnings: 1 (DEBUG=true)
   ```

---

## Mode: Diff

### What it does
Shows a clear side-by-side comparison of two env files.

### Steps
1. Ask which two files to compare (or parse from `$ARGUMENTS`)
   Example: `/devops-env-sync diff .env.staging .env.production`

2. Parse both files and show:
   ```
   Comparing: .env.staging vs .env.production

   Only in .env.staging:
     + DEBUG=true
     + FEATURE_BETA=1

   Only in .env.production:
     + SENTRY_DSN=https://...
     + CDN_URL=https://cdn.example.com

   Different values:
     ~ DATABASE_URL
       staging:    postgresql://staging-db:5432/app
       production: postgresql://prod-db:5432/app
     ~ LOG_LEVEL
       staging:    debug
       production: warn

   Same in both: (14 variables)
     = PORT=3000
     = NODE_ENV=(different but expected)
     ...
   ```

3. **IMPORTANT**: When showing values, mask sensitive ones:
   - API keys: show first 4 chars + `****`
   - Passwords: show `****`
   - Tokens: show first 4 chars + `****`
   - URLs with credentials: mask the password portion

---

## Mode: Analyze

### What it does
Scans the entire codebase for environment variable usage, cross-references with `.env*` files, and produces a comprehensive dependency map. Identifies unused variables, missing variables, and undocumented variables.

### When to use
- `analyze` or `scan` -> Run full env dependency analysis
- Useful before deployments, onboarding new developers, or cleaning up stale config

### Steps

1. **Scan codebase for env variable usage patterns** across all source files:

   | Language   | Patterns to match                                                        |
   |------------|--------------------------------------------------------------------------|
   | Node.js/TS | `process.env.VAR_NAME`, `process.env['VAR_NAME']`, `process.env["VAR_NAME"]` |
   | Python     | `os.environ["VAR_NAME"]`, `os.environ.get("VAR_NAME")`, `os.getenv("VAR_NAME")` |
   | Go         | `os.Getenv("VAR_NAME")`, `os.LookupEnv("VAR_NAME")`                    |
   | C# / .NET  | `Environment.GetEnvironmentVariable("VAR_NAME")`                        |
   | PHP/Laravel| `env("VAR_NAME")`, `getenv("VAR_NAME")`, `$_ENV["VAR_NAME"]`            |
   | Elixir     | `System.get_env("VAR_NAME")`                                            |
   | Ruby       | `ENV["VAR_NAME"]`, `ENV.fetch("VAR_NAME")`                              |
   | Rust       | `env::var("VAR_NAME")`, `env::var_os("VAR_NAME")`                       |
   | Java       | `System.getenv("VAR_NAME")`                                             |

   Use grep/ripgrep with appropriate regex patterns. Exclude `node_modules/`, `.git/`, `vendor/`, `venv/`, `__pycache__/`, `dist/`, `build/`, and other dependency/output directories.

   ```bash
   # Example scan commands (adapt per project language)
   # Node.js / TypeScript
   grep -rn "process\.env\.\([A-Z_][A-Z0-9_]*\)" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" .

   # Python
   grep -rn 'os\.environ\["\|os\.environ\.get(\|os\.getenv(' --include="*.py" .

   # Go
   grep -rn 'os\.Getenv(\|os\.LookupEnv(' --include="*.go" .

   # C#
   grep -rn 'Environment\.GetEnvironmentVariable(' --include="*.cs" .

   # PHP
   grep -rn 'env(\|getenv(\|\$_ENV\[' --include="*.php" .

   # Elixir
   grep -rn 'System\.get_env(' --include="*.ex" --include="*.exs" .
   ```

2. **Parse all `.env*` files** in the project root:
   - `.env`, `.env.local`, `.env.development`, `.env.staging`, `.env.production`, `.env.test`, `.env.example`, `.env.sample`
   - Extract all defined variable names and which files they appear in

3. **Cross-reference usage with definitions** and build the dependency map.

4. **Classify each variable** by type (heuristic, based on name and value patterns):
   - `*_URL`, `*_URI`, `*_DSN` -> Connection string
   - `*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD` -> Sensitive credential
   - `*_PORT` -> Port number
   - `*_HOST`, `*_DOMAIN` -> Hostname
   - `*_ENABLED`, `*_DEBUG`, `*_VERBOSE` -> Boolean flag
   - `*_REGION`, `*_ZONE` -> Cloud region
   - `*_TIMEOUT`, `*_INTERVAL`, `*_LIMIT` -> Numeric config
   - `*_EMAIL`, `*_FROM` -> Email address
   - Everything else -> General configuration

5. **Output the ENV Variable Usage Map:**

   ```
   ENV Variable Usage Map
   ================================================================

   DATABASE_URL
     Defined in: .env, .env.staging, .env.production
     Used in:    src/db/connection.ts:12, src/config.ts:5
     Type:       Connection string (PostgreSQL)
     Status:     OK

   STRIPE_KEY
     Defined in: .env, .env.production
     Used in:    src/payments/stripe.ts:8
     Type:       API key (sensitive)
     Warning:    Missing from .env.staging!

   REDIS_URL
     Defined in: .env.staging, .env.production
     Used in:    src/cache/redis.ts:3, src/queue/worker.ts:11
     Type:       Connection string (Redis)
     Warning:    Missing from .env! (local development may fail)

   UNUSED_LEGACY_VAR
     Defined in: .env, .env.production
     Used in:    (nowhere in codebase)
     Type:       Unknown
     Action:     Safe to remove - no code references found

   FEATURE_NEW_CHECKOUT
     Defined in: (none)
     Used in:    src/features/checkout.ts:44
     Type:       Boolean flag
     Action:     CRITICAL - Used in code but not defined in any .env file!
                 Add to .env.example and all environment files.
   ```

6. **Generate summary report:**

   ```
   Analysis Summary
   ──────────────────────────────────────
   Total variables found in code:     24
   Total variables defined in .env*:  28

   Healthy:                           20  (defined and used)
   Unused (defined, never used):       4  (candidates for removal)
   Missing (used, never defined):      2  (CRITICAL - will cause runtime errors)
   Not in .env.example:                3  (documentation gap)
   Only in one environment:            1  (potential misconfiguration)
   Sensitive vars exposed via
     client prefix (NEXT_PUBLIC_ etc):  0  (none detected)
   ──────────────────────────────────────
   ```

7. **Highlight critical issues** (in priority order):
   - **CRITICAL**: Variables used in code but not defined in any `.env*` file (will cause runtime errors)
   - **WARNING**: Variables missing from `.env.example` (onboarding gap - new developers won't know they need these)
   - **WARNING**: Variables missing from specific environment files (staging/prod gaps)
   - **INFO**: Variables defined but never used in code (safe to clean up)
   - **INFO**: Variables with a client-exposed prefix (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`) that look like secrets

8. **Offer follow-up actions:**
   - "Would you like me to add the missing variables to `.env.example`?"
   - "Would you like me to remove unused variables from all `.env*` files?"
   - "Would you like me to create a `.env.staging` with the missing entries?"

---

## Mode: Init

If no .env files exist, help the user set up from scratch:

1. Ask what the project needs (database URL, API keys, ports, etc.)
2. Generate both `.env` and `.env.example` simultaneously
3. Add `.env` to `.gitignore` if not already there
4. Group variables with section comments:
   ```bash
   # ===== Database =====
   DATABASE_URL=postgresql://localhost:5432/myapp

   # ===== Auth =====
   JWT_SECRET=change-me-in-production

   # ===== External APIs =====
   STRIPE_KEY=sk_test_...

   # ===== Server =====
   PORT=3000
   NODE_ENV=development
   ```

## Secret Detection Patterns

When masking values, detect sensitive variables by name pattern:

**Always mask (show `****`):**
- `*PASSWORD*`, `*PASSWD*`, `*SECRET*`
- `*TOKEN*`, `*API_KEY*`, `*APIKEY*`
- `*PRIVATE_KEY*`, `*ACCESS_KEY*`
- `*AUTH*`, `*CREDENTIAL*`

**Partially mask (show first 4 chars):**
- `*URL*` containing `://user:pass@` -> mask password part
- `*DSN*`, `*CONNECTION_STRING*`

**Never mask (safe to show):**
- `PORT`, `HOST`, `NODE_ENV`, `LOG_LEVEL`
- `*_ENABLED`, `*_DEBUG`, `*_TIMEOUT`
- `*_REGION`, `*_ZONE`, `*_VERSION`

## Framework-Specific Support

Detect and handle framework-specific env patterns:

- **Next.js**: `NEXT_PUBLIC_*` (client-exposed, warn about secrets)
- **Vite**: `VITE_*` (client-exposed, warn about secrets)
- **CRA**: `REACT_APP_*` (client-exposed, warn about secrets)
- **Django**: `DJANGO_*`, `ALLOWED_HOSTS`, `DEBUG`
- **Rails**: `RAILS_*`, `RACK_ENV`
- **Docker Compose**: cross-reference `environment:` in compose files

For client-exposed prefixes (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`):
- WARN if any secret-like value uses these prefixes
- These are embedded in client bundles and visible to everyone

## Safety Rules

- **NEVER** display full secret values (API keys, passwords, tokens)
- **NEVER** commit .env files to git
- After generating .env.example, verify .env is in .gitignore
- When comparing, always mask sensitive values
- Warn if .env files are tracked by git (`git ls-files .env`)
- Warn about client-exposed env prefixes containing secrets
- When team sharing is discussed, recommend encrypted solutions (see [encryption-guide.md](references/encryption-guide.md))
