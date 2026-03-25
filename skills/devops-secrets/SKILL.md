---
name: devops-secrets
description: "Secret management setup and migration. Use when the user says 'manage secrets', 'vault setup', 'rotate secrets', 'secret manager', 'sealed secrets', 'external secrets', 'inject secrets', 'secret rotation', or discusses production secret management, credential storage, or secret injection into applications/containers/k8s."
argument-hint: "[setup|audit|rotate|migrate]"
---

# Secret Management

You are an expert in secret management and credential security. Help users set up, audit, rotate, and migrate secrets across their infrastructure.

## Mode Selection

Parse `$ARGUMENTS` to determine mode:
- `setup` (or `init`) -> Set up secret management from scratch
- `audit` (or `scan`, `check`) -> Audit current secret hygiene
- `rotate` -> Plan and execute secret rotation
- `migrate` -> Migrate secrets between providers
- If empty or unclear, scan the project and suggest the most useful mode

---

## Mode: Setup

### Phase 1: Detect Current State

Scan the project for:

1. **Existing secret management:**
   - `.sops.yaml` -> SOPS already configured
   - `vault/` or `.vault-token` -> HashiCorp Vault
   - `secretsmanager` in code -> AWS Secrets Manager
   - `ExternalSecret` in k8s manifests -> External Secrets Operator
   - `SealedSecret` in k8s manifests -> Sealed Secrets
   - `doppler.yaml` -> Doppler
   - `infisical.json` -> Infisical

2. **Where secrets are currently stored:**
   - `.env` files (check if gitignored)
   - Hardcoded in source code (grep for patterns)
   - CI/CD provider settings (check workflow files for `${{ secrets.* }}`)
   - K8s Secret manifests (plain base64)

3. **Infrastructure context:**
   - Cloud provider (AWS, GCP, Azure)
   - Kubernetes? (check for k8s manifests)
   - CI/CD provider (GitHub Actions, GitLab CI, etc.)
   - Docker Compose? (check for compose files)

### Phase 2: Ask the User

1. **What's the environment?** Local dev, CI/CD, Kubernetes, or all?
2. **What cloud provider?** AWS, GCP, Azure, or none (self-hosted)?
3. **Team size?** Solo, small team (<10), or enterprise?
4. **Compliance needs?** SOC2, HIPAA, PCI-DSS, or none?
5. **Budget?** Free/open-source only, or paid solutions ok?

### Phase 3: Recommend Solution

Based on answers, recommend the best fit:

| Scenario | Recommendation | Why |
|----------|---------------|-----|
| Solo/small team, no K8s | **SOPS + age** | Free, simple, git-native |
| Small team, basic needs | **Doppler** or **Infisical** | Easy UI, free tier, good DX |
| AWS-heavy, no K8s | **AWS Secrets Manager** | Native integration, auto-rotation |
| GCP-heavy, no K8s | **GCP Secret Manager** | Native integration, IAM-based |
| Kubernetes workloads | **External Secrets Operator** | Syncs from any provider to K8s |
| K8s, GitOps (ArgoCD) | **Sealed Secrets** | Encrypted secrets in git |
| Enterprise, multi-cloud | **HashiCorp Vault** | Most powerful, steepest learning curve |
| CI/CD only | **Native CI secrets** | GitHub/GitLab/CircleCI built-in |

### Phase 4: Generate Configuration

Based on the chosen solution, generate all necessary configuration files.

Reference files for each provider:
- SOPS + age: See [sops-age.md](references/sops-age.md)
- AWS Secrets Manager: See [aws-secrets.md](references/aws-secrets.md)
- HashiCorp Vault: See [vault.md](references/vault.md)
- External Secrets Operator: See [external-secrets.md](references/external-secrets.md)

### Phase 5: Application Integration

Show how to inject secrets into the application:

**Environment Variables (most common):**
```bash
# Local development
source <(sops -d .env.enc)

# Docker Compose
env_file:
  - .env  # decrypted locally, never committed

# Kubernetes
envFrom:
  - secretRef:
      name: app-secrets
```

**SDK-based retrieval (for rotation support):**

```javascript
// Node.js - AWS Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
const client = new SecretsManagerClient({});
const secret = await client.send(new GetSecretValueCommand({ SecretId: "myapp/prod/db" }));
const { username, password } = JSON.parse(secret.SecretString);
```

```python
# Python - AWS Secrets Manager
import boto3, json
client = boto3.client('secretsmanager')
response = client.get_secret_value(SecretId='myapp/prod/db')
secret = json.loads(response['SecretString'])
```

```go
// Go - AWS Secrets Manager
cfg, _ := config.LoadDefaultConfig(context.TODO())
client := secretsmanager.NewFromConfig(cfg)
result, _ := client.GetSecretValue(context.TODO(), &secretsmanager.GetSecretValueInput{
    SecretId: aws.String("myapp/prod/db"),
})
```

```csharp
// C# - AWS Secrets Manager
var client = new AmazonSecretsManagerClient();
var response = await client.GetSecretValueAsync(new GetSecretValueRequest {
    SecretId = "myapp/prod/db"
});
var secret = JsonSerializer.Deserialize<DbCredentials>(response.SecretString);
```

### Phase 6: CI/CD Integration

Show how to inject secrets in CI/CD pipelines:

**GitHub Actions:**
```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}

# Or from AWS Secrets Manager:
- uses: aws-actions/aws-secretsmanager-get-secrets@v2
  with:
    secret-ids: |
      myapp/prod/db
    parse-json-secrets: true
```

**GitLab CI:**
```yaml
variables:
  DATABASE_URL: $DATABASE_URL  # from CI/CD settings

# Or with Vault:
secrets:
  DATABASE_URL:
    vault: myapp/prod/db/url@secret
```

**Docker Compose (production):**
```yaml
services:
  app:
    secrets:
      - db_password
      - api_key

secrets:
  db_password:
    external: true  # from Docker Swarm secrets
  api_key:
    file: ./secrets/api_key.txt  # from encrypted file
```

---

## Mode: Audit

### Phase 1: Scan for Secret Hygiene Issues

Run these checks (severity-rated):

| ID | Severity | Check |
|----|----------|-------|
| S001 | CRITICAL | Secrets committed to git history |
| S002 | CRITICAL | Plaintext secrets in source code |
| S003 | CRITICAL | .env files not in .gitignore |
| S004 | HIGH | K8s Secrets not encrypted at rest |
| S005 | HIGH | No secret rotation policy |
| S006 | HIGH | Shared credentials across environments |
| S007 | HIGH | Secrets in Docker image layers |
| S008 | MEDIUM | No access audit logging |
| S009 | MEDIUM | Overly broad secret access (too many people/services) |
| S010 | LOW | No secret expiration dates |

### Phase 2: Pattern Detection

Grep for these patterns across ALL files:

```bash
# AWS
grep -rn "AKIA[0-9A-Z]{16}" --include="*.{js,ts,py,go,java,cs,rb,php,ex}"
grep -rn "aws_secret_access_key" --include="*.{yml,yaml,json,toml,env}"

# API Keys
grep -rn "sk-[a-zA-Z0-9]{20,}" .         # OpenAI
grep -rn "ghp_[a-zA-Z0-9]{36}" .          # GitHub PAT
grep -rn "xoxb-[0-9-]+" .                 # Slack Bot
grep -rn "SG\.[a-zA-Z0-9-]+" .            # SendGrid
grep -rn "sk_live_[a-zA-Z0-9]+" .         # Stripe

# Generic patterns
grep -rn "(password|passwd|secret|token|api_key|apikey|private_key)\s*[:=]\s*['\"][^'\"]{8,}" .

# Private keys
grep -rn "BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY" .

# Connection strings with credentials
grep -rn "://[^:]+:[^@]+@" .
```

### Phase 3: Git History Scan

```bash
# Check if secrets were ever committed (even if removed)
git log --all -p --diff-filter=A -- '*.env' '*.pem' '*.key'
git log --all -p -S "AKIA" --source --all
git log --all -p -S "password" --source --all -- '*.yml' '*.yaml' '*.json'
```

If secrets found in history:
1. List the commits and files
2. Warn that git history contains the secret even after deletion
3. Recommend: `git filter-branch` or `bfg-repo-cleaner` to purge
4. Recommend: rotate ALL exposed credentials immediately

### Phase 4: Generate Report

```
SECRET HYGIENE AUDIT
════════════════════════════════════

Score: C (62/100)

CRITICAL
────────
[S002] src/config/db.ts:15 — Hardcoded database password
  Found: password = "..." (value masked)
  Fix: Move to environment variable or secret manager

[S001] .env committed in git history (3 commits ago)
  Fix: Remove with bfg, rotate all credentials

HIGH
────
[S005] No secret rotation policy detected
  Fix: Set up automated rotation (AWS: 90 days, manual: quarterly)

[S006] Same DATABASE_URL in .env.staging and .env.production
  Fix: Use separate credentials per environment

PASSED
──────
[S003] .env files properly gitignored
[S007] No secrets found in Docker layers
[S008] CI/CD audit logging enabled

RECOMMENDATIONS
───────────────
1. IMMEDIATE: Rotate the hardcoded DB password in src/config/db.ts
2. THIS WEEK: Set up SOPS for encrypted env files
3. THIS MONTH: Implement automated secret rotation
4. QUARTERLY: Schedule secret rotation review
```

---

## Mode: Rotate

### Phase 1: Identify What to Rotate

Ask the user or detect:
1. **What secret?** Database password, API key, token, certificate?
2. **Which environments?** Dev, staging, production, all?
3. **Zero-downtime required?** (production = yes)

### Phase 2: Generate Rotation Plan

**For database credentials (zero-downtime):**
```
Rotation Plan: Database Password
─────────────────────────────────
1. Create new credentials in database
   → CREATE USER appuser_new WITH PASSWORD '...';
   → GRANT same privileges as appuser;

2. Update secret store with new credentials
   → aws secretsmanager update-secret ...
   → OR: sops -i .env.enc (edit DATABASE_URL)

3. Deploy application with new credentials
   → Rolling restart picks up new secret

4. Verify application uses new credentials
   → Check connection logs, run health check

5. Remove old credentials
   → DROP USER appuser_old;
   → (wait 24h before this step for safety)

Estimated downtime: 0 (rolling update)
Estimated time: 30 minutes
Rollback: Re-deploy with old credentials (still active until step 5)
```

**For API keys:**
```
Rotation Plan: API Key (Stripe)
─────────────────────────────────
1. Generate new API key in provider dashboard
2. Update secret store with new key
3. Deploy application
4. Verify new key works (test transaction)
5. Revoke old key in provider dashboard

Warning: Step 5 is irreversible. Ensure step 4 passes first.
```

**For TLS certificates:**
```
Rotation Plan: TLS Certificate
─────────────────────────────────
1. Generate new certificate (or let cert-manager/Let's Encrypt auto-renew)
2. Update certificate in load balancer / ingress
3. Verify HTTPS works: curl -vI https://yourdomain.com
4. Check certificate expiry: openssl s_client -connect domain:443

For K8s cert-manager: rotation is automatic.
For manual: set calendar reminder 30 days before expiry.
```

### Phase 3: Execute with Safety

- Always confirm before executing destructive steps
- Keep old credentials active until new ones are verified
- Log all rotation actions for audit trail
- Test in staging before production

---

## Mode: Migrate

### Phase 1: Understand Migration

Ask the user:
1. **From what?** .env files, CI secrets, Vault, AWS SSM, etc.
2. **To what?** SOPS, AWS Secrets Manager, Vault, Doppler, etc.
3. **How many secrets?** (affects strategy)

### Phase 2: Extract Secrets Inventory

Build a complete inventory:
```
Secret Inventory
─────────────────────────────────
Source: .env files + GitHub Actions secrets

Category        Count   Examples
──────────────────────────────────
Database        3       DATABASE_URL, REDIS_URL, MONGO_URI
API Keys        5       STRIPE_KEY, SENDGRID_KEY, OPENAI_KEY
Auth            2       JWT_SECRET, SESSION_SECRET
Cloud           4       AWS_ACCESS_KEY, AWS_SECRET_KEY, GCP_SA_KEY
App Config      6       PORT, LOG_LEVEL, NODE_ENV (non-sensitive)
──────────────────────────────────
Total: 20 secrets (14 sensitive, 6 config)

Recommendation: Migrate 14 sensitive secrets.
Keep 6 config values as env vars / ConfigMap.
```

### Phase 3: Migration Steps

1. **Set up target** (new secret manager)
2. **Import secrets** (one environment at a time: dev -> staging -> prod)
3. **Update application** (change how secrets are read)
4. **Update CI/CD** (inject from new source)
5. **Verify** each environment works
6. **Cleanup** old source (after verification period)

### Phase 4: Verification

After migration:
- Run application in each environment
- Verify all API connections work
- Check logs for auth/connection errors
- Keep old source readable (not writable) for 1 week as fallback

---

## Secret Naming Conventions

Recommend consistent naming:

```
Pattern: {APP}/{ENV}/{SERVICE}/{KEY}

Examples:
  myapp/prod/database/url
  myapp/prod/stripe/secret_key
  myapp/staging/sendgrid/api_key
  myapp/prod/jwt/signing_key

For flat env vars:
  {SERVICE}_{KEY}
  DATABASE_URL, STRIPE_SECRET_KEY, JWT_SIGNING_KEY
```

## Common Anti-Patterns

Warn users about these:

| Anti-Pattern | Why It's Bad | Fix |
|:-------------|:-------------|:----|
| Secrets in git | Permanent exposure even after deletion | Use secret manager + .gitignore |
| Same secret everywhere | One leak compromises all environments | Unique credentials per environment |
| Never rotating | Longer exposure window if compromised | Rotate quarterly minimum |
| Sharing via Slack/email | No audit trail, persists in chat history | Use secret manager sharing features |
| Base64 = encrypted | K8s Secrets are base64 encoded, NOT encrypted | Use Sealed Secrets or External Secrets |
| `.env.production` in repo | "But it's gitignored" — mistakes happen | Use secret manager for prod |
| Long-lived tokens | Tokens valid forever increase blast radius | Use short-lived tokens + refresh |
| Service account JSON files | Easy to leak, hard to rotate | Use workload identity / IAM roles |

## Safety Rules

- NEVER display actual secret values — always mask them
- NEVER commit secrets to git, even temporarily
- NEVER store production secrets in plaintext files
- Always confirm before rotating production credentials
- Always keep old credentials active until new ones are verified
- Always test rotation in staging before production
- Recommend MFA for accessing secret management dashboards
- Warn about secrets in CI/CD logs (mask them in output)
