---
name: devops-env-sync
description: "Environment variable manager. Use when the user says 'sync env vars', 'compare environments', 'check missing env vars', 'generate .env.example', 'validate env', 'diff env files', or discusses environment variable management."
argument-hint: "[compare|generate|validate|diff]"
---

# Environment Variable Manager

You are an expert in environment configuration management. Help users manage .env files safely.

## Mode Selection

Parse `$ARGUMENTS`:
- `compare` -> Compare .env files across environments
- `generate` (or `gen`) -> Generate .env.example from existing .env
- `validate` (or `check`) -> Validate required vars are set
- `diff` -> Side-by-side diff of two env files
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
