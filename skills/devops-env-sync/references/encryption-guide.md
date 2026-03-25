# Encrypting Env Files for Team Sharing

## Tool Comparison

| Feature | git-crypt | SOPS + age | 1Password CLI | Doppler |
|---------|-----------|------------|---------------|---------|
| Cost | Free | Free | $8/user/mo | $18/user/mo |
| Setup time | 5 min | 15 min | 30 min | 20 min |
| Best for | Small teams | Mid teams | Enterprise | SaaS teams |
| CI/CD native | Manual | Good | Good | Excellent |
| Per-value encrypt | No (full file) | Yes | Yes | Yes |
| Access revocation | Hard (re-encrypt) | Easy (re-key) | Easy (remove) | Easy (remove) |
| Audit log | No | No | Yes | Yes |
| Learning curve | Low | Medium | Medium | Low |
| Offline access | Yes | Yes | No | No |

## Decision Guide

Choose the right tool based on your team's constraints:

- **Use git-crypt if**: You have a small team (fewer than 5 developers), your secret management needs are simple, you have no compliance or audit requirements, and you want the fastest possible setup with zero cost.

- **Use SOPS + age if**: You need per-value encryption so that diffs remain readable, you manage multiple environments with different secret sets, you need solid CI/CD integration without a paid service, or you work on a mid-size team where access control and re-keying matter.

- **Use 1Password CLI if**: Your team already uses 1Password for credential management, you need audit logs showing who accessed which secrets and when, you have compliance requirements (SOC 2, HIPAA) that demand access tracking, or you want non-technical team members to manage secrets through a familiar UI.

- **Use Doppler if**: You want a fully managed service with no self-hosted infrastructure, you need real-time secret syncing across multiple environments and platforms, you require built-in secret rotation and change history, or your team primarily deploys SaaS applications with frequent environment changes.

---

## git-crypt

Transparent encryption for files in git. Files are encrypted on push, decrypted on pull.

**Setup:**

```bash
brew install git-crypt    # macOS
apt install git-crypt     # Debian/Ubuntu

cd your-repo
git-crypt init
```

**Configure which files to encrypt** via `.gitattributes`:

```
.env filter=git-crypt diff=git-crypt
.env.* filter=git-crypt diff=git-crypt
secrets/** filter=git-crypt diff=git-crypt
```

**Add team members by GPG key:**

```bash
git-crypt add-gpg-user RECIPIENT_GPG_KEY_ID
```

**Export a symmetric key (alternative to GPG):**

```bash
git-crypt export-key ./git-crypt-key
# Share this key securely with team members
git-crypt unlock ./git-crypt-key
```

**Verify encryption status:**

```bash
git-crypt status
```

Best for: Small teams, simple setup, full-file encryption.

---

## SOPS with age Encryption

Mozilla SOPS encrypts values (not keys) in YAML, JSON, ENV, and INI files. `age` is a simple modern encryption tool (no GPG complexity).

**Setup:**

```bash
brew install sops age      # macOS
apt install sops age       # Debian/Ubuntu (may need PPA)

# Generate an age keypair
age-keygen -o keys.txt
# Prints public key: age1abc...
# Store keys.txt in ~/.config/sops/age/keys.txt
mkdir -p ~/.config/sops/age
mv keys.txt ~/.config/sops/age/keys.txt
```

**Create `.sops.yaml` in repo root:**

```yaml
creation_rules:
  - path_regex: \.env.*
    age: >-
      age1abc123...,
      age1def456...
  - path_regex: secrets/.*\.yaml
    age: >-
      age1abc123...
```

**Encrypt/decrypt:**

```bash
# Encrypt
sops -e .env > .env.enc
sops -e -i secrets/prod.yaml   # In-place

# Decrypt
sops -d .env.enc > .env
sops -d secrets/prod.yaml      # Prints to stdout

# Edit encrypted file directly
sops secrets/prod.yaml         # Opens in $EDITOR, re-encrypts on save
```

Best for: Teams wanting per-value encryption, CI/CD integration, multi-recipient support.

---

## 1Password CLI (op)

Use 1Password as your team's secret store. Inject secrets at runtime.

**Setup:**

```bash
brew install 1password-cli
op account add --address my-team.1password.com
op signin
```

**Store secrets:**

```bash
op item create --category=login \
  --title="App Prod Secrets" \
  --vault="Engineering" \
  'DB_PASSWORD=supersecret' \
  'API_KEY=sk-123'
```

**Create env template** (`.env.tpl`):

```
DB_HOST=postgres.prod.internal
DB_PASSWORD=op://Engineering/App Prod Secrets/DB_PASSWORD
API_KEY=op://Engineering/App Prod Secrets/API_KEY
```

**Inject at runtime:**

```bash
op run --env-file=.env.tpl -- node server.js
# Or generate a resolved .env
op inject -i .env.tpl -o .env
```

Best for: Teams already using 1Password, non-technical team members, audit logging.

---

## Doppler

Centralized secret management as a service. Syncs secrets to any environment.

**Setup:**

```bash
brew install dopplerhq/cli/doppler
doppler login
doppler setup    # Select project and config (dev/staging/prod)
```

**Usage:**

```bash
# Run process with injected secrets
doppler run -- node server.js

# Download as .env
doppler secrets download --no-file --format env > .env

# View secrets
doppler secrets
```

**CI/CD integration (GitHub Actions):**

```yaml
steps:
  - uses: dopplerhq/secrets-fetch-action@v1
    with:
      doppler-token: ${{ secrets.DOPPLER_TOKEN }}
      doppler-project: myapp
      doppler-config: production
```

Best for: Multiple environments, secret rotation, centralized management, audit trails.

---

## Best Practices for Secret Rotation

1. **Never commit plaintext secrets.** Add `.env` to `.gitignore` before first commit.

2. **Rotate on exposure.** If a secret hits git history, rotate immediately — rewriting history is not enough.

3. **Automate rotation** where possible:
   ```bash
   # Example: rotate DB password and update in 1Password
   NEW_PASS=$(openssl rand -base64 32)
   psql -c "ALTER USER app PASSWORD '$NEW_PASS'"
   op item edit "App Prod Secrets" "DB_PASSWORD=$NEW_PASS"
   ```

4. **Use short-lived credentials** over long-lived secrets (AWS STS, GCP workload identity).

5. **Audit access.** Use tools that log who accessed which secrets and when (Doppler, 1Password, Vault).

6. **Separate secrets per environment.** Never share production secrets with development.

7. **Verify `.gitignore`** before any commit:
   ```bash
   git status --porcelain | grep '\.env'
   # Should show nothing if .gitignore is correct
   ```
