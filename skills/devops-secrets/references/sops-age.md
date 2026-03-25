# SOPS + age Encryption Guide

## Overview

SOPS (Secrets OPerationS) encrypts values within structured files (YAML, JSON, ENV, INI) while leaving keys in plaintext for easy diffing. Combined with age (a modern encryption tool), it provides a simple, GPG-free workflow for managing secrets in version control.

---

## Installation

### age

```bash
# macOS
brew install age

# Ubuntu/Debian
sudo apt install age

# From source
go install filippo.io/age/cmd/...@latest
```

### SOPS

```bash
# macOS
brew install sops

# Ubuntu/Debian (download binary)
SOPS_VERSION=3.9.4
curl -LO "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64"
sudo mv "sops-v${SOPS_VERSION}.linux.amd64" /usr/local/bin/sops
sudo chmod +x /usr/local/bin/sops

# From source
go install github.com/getsops/sops/v3/cmd/sops@latest
```

---

## Generate age Keypair

```bash
# Generate a new keypair
age-keygen -o keys.txt

# Output looks like:
# Public key: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
# The private key is written to keys.txt

# Store the private key securely
mkdir -p ~/.config/sops/age/
mv keys.txt ~/.config/sops/age/keys.txt
chmod 600 ~/.config/sops/age/keys.txt

# Set environment variable (add to shell profile)
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
```

---

## Create .sops.yaml Configuration

Place `.sops.yaml` at the repository root to define encryption rules per file pattern.

```yaml
# .sops.yaml
creation_rules:
  # Encrypt .env files
  - path_regex: \.env\.encrypted$
    age: >-
      age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p,
      age1an7lnxqzcsrzd6lrgszfnpfg0glrmf3sxp85gkd47mfgg7hya2gqjdjp8k

  # Encrypt secrets YAML files
  - path_regex: secrets\.ya?ml$
    age: >-
      age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p

  # Encrypt Kubernetes secret manifests
  - path_regex: k8s/.*secret.*\.ya?ml$
    age: >-
      age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
    encrypted_regex: "^(data|stringData)$"

  # Terraform tfvars
  - path_regex: \.tfvars$
    age: >-
      age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
```

Multiple age public keys let multiple team members decrypt the same file.

---

## Encrypt and Decrypt Commands

### .env Files

```bash
# Encrypt a .env file (uses dotenv format)
sops --encrypt --input-type dotenv --output-type dotenv .env > .env.encrypted

# Decrypt back to plaintext
sops --decrypt --input-type dotenv --output-type dotenv .env.encrypted > .env

# Edit encrypted file in-place (opens $EDITOR)
sops .env.encrypted
```

### YAML Files

```bash
# Encrypt a YAML file
sops --encrypt secrets.yaml > secrets.enc.yaml

# Decrypt
sops --decrypt secrets.enc.yaml > secrets.yaml

# Edit in-place
sops secrets.enc.yaml

# Encrypt only specific keys (using encrypted_regex)
sops --encrypt --encrypted-regex '^(password|api_key|token)$' config.yaml > config.enc.yaml
```

### JSON Files

```bash
# Encrypt
sops --encrypt config.json > config.enc.json

# Decrypt
sops --decrypt config.enc.json > config.json
```

### Partial Operations

```bash
# Extract a single value from an encrypted file
sops --decrypt --extract '["database"]["password"]' secrets.enc.yaml

# Set a single value without decrypting the whole file
sops set secrets.enc.yaml '["database"]["password"]' '"new-password-here"'
```

---

## CI/CD Integration: GitHub Actions

### Store the age Private Key as a Repository Secret

1. Copy the contents of `~/.config/sops/age/keys.txt`
2. Add it as a GitHub Actions secret named `SOPS_AGE_KEY`

### Workflow Example

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install sops
        run: |
          SOPS_VERSION=3.9.4
          curl -LO "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64"
          sudo mv "sops-v${SOPS_VERSION}.linux.amd64" /usr/local/bin/sops
          sudo chmod +x /usr/local/bin/sops

      - name: Decrypt secrets
        env:
          SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
        run: |
          sops --decrypt --input-type dotenv --output-type dotenv .env.encrypted > .env
          sops --decrypt k8s/secrets.enc.yaml > k8s/secrets.yaml

      - name: Deploy
        run: |
          # secrets are now available as plaintext files
          source .env
          kubectl apply -f k8s/secrets.yaml
```

Note: `SOPS_AGE_KEY` as an environment variable takes precedence over `SOPS_AGE_KEY_FILE`. You can pass the raw private key content directly.

---

## Team Onboarding: Adding New Members

### Step 1: New Member Generates Their Keypair

```bash
age-keygen -o keys.txt
# They share their PUBLIC key with the team (never the private key)
```

### Step 2: Update .sops.yaml

Add the new member's public key to the relevant `creation_rules`:

```yaml
creation_rules:
  - path_regex: \.env\.encrypted$
    age: >-
      age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p,
      age1an7lnxqzcsrzd6lrgszfnpfg0glrmf3sxp85gkd47mfgg7hya2gqjdjp8k,
      age1newmemberpublickeyhere1234567890abcdefghijklmnop
```

### Step 3: Re-encrypt All Existing Files

```bash
# Update encryption on all matching files to include the new key
# This requires someone who CAN currently decrypt to run:

sops updatekeys .env.encrypted
sops updatekeys secrets.enc.yaml

# Or use a script to bulk-update:
find . -name "*.encrypted" -o -name "*.enc.yaml" | while read f; do
  sops updatekeys "$f" --yes
done
```

### Step 4: Commit and Push

```bash
git add .sops.yaml .env.encrypted secrets.enc.yaml
git commit -m "chore: add new team member to sops recipients"
git push
```

The new member can now decrypt all re-encrypted files.

---

## Key Rotation Procedure

### When to Rotate

- Team member leaves the organization
- Key is suspected to be compromised
- Periodic rotation policy (e.g., quarterly)

### Step 1: Remove the Old Key from .sops.yaml

Edit `.sops.yaml` and remove the departing member's public key from all rules.

### Step 2: Re-encrypt All Files

```bash
#!/bin/bash
# rotate-keys.sh
set -euo pipefail

echo "Re-encrypting all SOPS-managed files..."

# Find and re-encrypt all managed files
for pattern in "*.encrypted" "*.enc.yaml" "*.enc.json"; do
  find . -name "$pattern" | while read -r file; do
    echo "Rotating: $file"
    sops updatekeys "$file" --yes
  done
done

echo "Key rotation complete. Commit and push the changes."
```

```bash
chmod +x rotate-keys.sh
./rotate-keys.sh
git add -A
git commit -m "security: rotate sops keys, remove departed member"
git push
```

### Step 3: Rotate the Actual Secrets

Removing someone's decryption access does NOT invalidate secrets they previously had access to. You must also:

1. Rotate database passwords
2. Rotate API keys and tokens
3. Rotate any credentials the departed member could have copied
4. Update the encrypted files with the new secret values

---

## Example: Full Workflow

### Encrypting .env for a Project

```bash
# Original .env (DO NOT commit this)
cat > .env <<'EOF'
DATABASE_URL=postgres://app:s3cret-p4ss@db.internal:5432/myapp
REDIS_URL=redis://:r3dis-auth@redis.internal:6379
STRIPE_SECRET_KEY=sk_live_abc123def456
JWT_SECRET=super-secret-jwt-key-2024
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
EOF

# Encrypt it
sops --encrypt --input-type dotenv --output-type dotenv .env > .env.encrypted

# Verify the encrypted file (keys visible, values encrypted)
cat .env.encrypted
# DATABASE_URL=ENC[AES256_GCM,data:...,type:str]
# REDIS_URL=ENC[AES256_GCM,data:...,type:str]
# ...

# Add to .gitignore
echo ".env" >> .gitignore

# Commit only the encrypted version
git add .env.encrypted .gitignore .sops.yaml
git commit -m "chore: add encrypted environment variables"
```

### Decrypting in a Docker Entrypoint

```dockerfile
# Dockerfile
FROM node:22-alpine

RUN apk add --no-cache curl && \
    SOPS_VERSION=3.9.4 && \
    curl -LO "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64" && \
    mv "sops-v${SOPS_VERSION}.linux.amd64" /usr/local/bin/sops && \
    chmod +x /usr/local/bin/sops

WORKDIR /app
COPY . .
RUN npm ci --production

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
```

```bash
#!/bin/sh
# entrypoint.sh
set -e

# SOPS_AGE_KEY is injected as an environment variable at runtime
# (via K8s secret, ECS task definition, Docker run --env, etc.)
if [ -f ".env.encrypted" ] && [ -n "$SOPS_AGE_KEY" ]; then
  echo "Decrypting secrets..."
  sops --decrypt --input-type dotenv --output-type dotenv .env.encrypted > .env

  # Export all variables
  set -a
  . ./.env
  set +a

  # Clean up plaintext
  rm -f .env
  unset SOPS_AGE_KEY
fi

exec "$@"
```

```bash
# Run the container, injecting the age key at runtime
docker run -e SOPS_AGE_KEY="$(cat ~/.config/sops/age/keys.txt)" myapp:latest
```

---

## Best Practices

1. **Never commit plaintext secrets** -- add `.env`, `secrets.yaml` (unencrypted) to `.gitignore`
2. **Use `.sops.yaml`** -- avoids passing flags manually and ensures consistent encryption rules
3. **One keypair per person** -- do not share private keys between team members
4. **CI/CD gets its own key** -- create a dedicated age keypair for CI, separate from human keys
5. **Rotate secrets on team departure** -- removing decryption access is not enough
6. **Use `encrypted_regex`** for Kubernetes manifests -- encrypt only `data`/`stringData`, leave metadata readable
7. **Pin SOPS version** in CI -- avoid surprises from version changes
