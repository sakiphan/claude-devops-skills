# HashiCorp Vault Guide

## Overview

HashiCorp Vault is a secrets management platform that provides a unified interface to secrets, with tight access control, detailed audit logging, and support for dynamic secrets. It handles secrets storage, encryption as a service, identity-based access, and credential leasing/revocation.

---

## Dev Server Setup (Testing Only)

```bash
# Install Vault
brew install vault          # macOS
# Or download from https://releases.hashicorp.com/vault/

# Start dev server (in-memory, auto-unsealed, root token = "dev-root-token")
vault server -dev -dev-root-token-id="dev-root-token"

# In another terminal, configure the client
export VAULT_ADDR="http://127.0.0.1:8200"
export VAULT_TOKEN="dev-root-token"

# Verify
vault status
vault secrets list
```

The dev server is NOT for production. It stores everything in memory and runs unsealed with a known root token.

---

## Production Deployment Options

### Docker Compose

```yaml
# docker-compose.yaml
services:
  vault:
    image: hashicorp/vault:1.17
    container_name: vault
    cap_add:
      - IPC_LOCK
    ports:
      - "8200:8200"
    environment:
      VAULT_ADDR: "http://0.0.0.0:8200"
    volumes:
      - ./vault/config:/vault/config
      - vault-data:/vault/data
    command: vault server -config=/vault/config/vault.hcl
    restart: unless-stopped

volumes:
  vault-data:
```

```hcl
# vault/config/vault.hcl
ui            = true
disable_mlock = false
api_addr      = "http://0.0.0.0:8200"

storage "raft" {
  path    = "/vault/data"
  node_id = "vault-1"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = false
  tls_cert_file = "/vault/config/tls/cert.pem"
  tls_key_file  = "/vault/config/tls/key.pem"
}
```

### Kubernetes with Helm

```bash
# Add the HashiCorp Helm repo
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

# Install in HA mode with Raft storage
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set server.ha.enabled=true \
  --set server.ha.replicas=3 \
  --set server.ha.raft.enabled=true \
  --set ui.enabled=true \
  --set injector.enabled=true
```

```yaml
# values-production.yaml
server:
  ha:
    enabled: true
    replicas: 3
    raft:
      enabled: true
      config: |
        ui = true

        listener "tcp" {
          tls_disable = 0
          address     = "[::]:8200"
          tls_cert_file = "/vault/tls/tls.crt"
          tls_key_file  = "/vault/tls/tls.key"
        }

        storage "raft" {
          path = "/vault/data"
          retry_join {
            leader_api_addr = "https://vault-0.vault-internal:8200"
          }
          retry_join {
            leader_api_addr = "https://vault-1.vault-internal:8200"
          }
          retry_join {
            leader_api_addr = "https://vault-2.vault-internal:8200"
          }
        }

        service_registration "kubernetes" {}

  resources:
    requests:
      memory: 256Mi
      cpu: 250m
    limits:
      memory: 512Mi
      cpu: 500m

  dataStorage:
    size: 10Gi
    storageClass: gp3

  auditStorage:
    enabled: true
    size: 10Gi

injector:
  enabled: true
  replicas: 2

ui:
  enabled: true
  serviceType: ClusterIP
```

### HCP Vault (Managed Service)

HashiCorp Cloud Platform provides fully managed Vault clusters:

```bash
# Access HCP Vault via CLI
export VAULT_ADDR="https://vault-cluster.vault.xxxx.aws.hashicorp.cloud:8200"
export VAULT_TOKEN="hvs.your-token-here"
export VAULT_NAMESPACE="admin"

vault status
```

HCP handles unsealing, upgrades, backups, and HA. Recommended for teams that want Vault without operational overhead.

---

## KV Secrets Engine v2 (Versioned)

### Enable and Configure

```bash
# Enable KV v2 at a custom path
vault secrets enable -path=secret -version=2 kv

# Configure max versions to keep
vault write secret/config max_versions=10 delete_version_after="768h"
```

### CRUD Operations

```bash
# Create / Update a secret (creates a new version)
vault kv put secret/myapp/database \
  username="app_user" \
  password="s3cret-p4ss" \
  host="db.internal" \
  port="5432"

# Read current version
vault kv get secret/myapp/database

# Read specific version
vault kv get -version=2 secret/myapp/database

# Read as JSON (for scripting)
vault kv get -format=json secret/myapp/database | jq -r '.data.data.password'

# Patch (update specific fields, keep others)
vault kv patch secret/myapp/database password="new-p4ss"

# Delete current version (soft delete, recoverable)
vault kv delete secret/myapp/database

# Undelete a version
vault kv undelete -versions=3 secret/myapp/database

# Permanently destroy specific versions
vault kv destroy -versions=1,2 secret/myapp/database

# List secrets at a path
vault kv list secret/myapp/

# Get metadata (versions, timestamps)
vault kv metadata get secret/myapp/database
```

### Access from Application (HTTP API)

```bash
# Read via API
curl -s \
  -H "X-Vault-Token: ${VAULT_TOKEN}" \
  "${VAULT_ADDR}/v1/secret/data/myapp/database" | jq '.data.data'

# Write via API
curl -s \
  -H "X-Vault-Token: ${VAULT_TOKEN}" \
  -X POST \
  -d '{"data": {"username": "app", "password": "new-pass"}}' \
  "${VAULT_ADDR}/v1/secret/data/myapp/database"
```

---

## Dynamic Secrets (Database Credentials On-Demand)

Dynamic secrets are generated on-demand and automatically revoked after their TTL expires.

### PostgreSQL Dynamic Credentials

```bash
# Enable the database secrets engine
vault secrets enable database

# Configure the PostgreSQL connection
vault write database/config/myapp-postgres \
  plugin_name=postgresql-database-plugin \
  allowed_roles="myapp-readonly,myapp-readwrite" \
  connection_url="postgresql://{{username}}:{{password}}@db.internal:5432/myapp?sslmode=require" \
  username="vault_admin" \
  password="vault-admin-password"

# Rotate the root password (Vault manages it from now on)
vault write -force database/rotate-root/myapp-postgres

# Create a read-only role
vault write database/roles/myapp-readonly \
  db_name=myapp-postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

# Create a read-write role
vault write database/roles/myapp-readwrite \
  db_name=myapp-postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="8h"

# Generate credentials (returns a unique username/password)
vault read database/creds/myapp-readonly
# Key                Value
# ---                -----
# lease_id           database/creds/myapp-readonly/abcd1234
# lease_duration     1h
# username           v-approle-myapp-r-abcdefgh
# password           A1b2C3d4-generated-pass

# Renew a lease before it expires
vault lease renew database/creds/myapp-readonly/abcd1234

# Revoke immediately (e.g., on application shutdown)
vault lease revoke database/creds/myapp-readonly/abcd1234
```

---

## AppRole Auth for Applications

AppRole is the recommended auth method for machines/applications.

### Setup

```bash
# Enable AppRole auth
vault auth enable approle

# Create a policy for the application
vault policy write myapp-policy - <<EOF
path "secret/data/myapp/*" {
  capabilities = ["read", "list"]
}
path "database/creds/myapp-readonly" {
  capabilities = ["read"]
}
EOF

# Create the AppRole
vault write auth/approle/role/myapp \
  token_policies="myapp-policy" \
  token_ttl=1h \
  token_max_ttl=4h \
  secret_id_ttl=720h \
  secret_id_num_uses=0

# Get the Role ID (stable, like a username)
vault read auth/approle/role/myapp/role-id
# role_id: 1234-abcd-5678-efgh

# Generate a Secret ID (like a password, can be rotated)
vault write -force auth/approle/role/myapp/secret-id
# secret_id: 9999-zzzz-8888-yyyy
```

### Application Login Flow

```bash
# Application authenticates with role_id + secret_id
vault write auth/approle/login \
  role_id="1234-abcd-5678-efgh" \
  secret_id="9999-zzzz-8888-yyyy"

# Returns a client token
# Key                     Value
# ---                     -----
# token                   hvs.CAESIxxxxx
# token_accessor          abc123
# token_duration          1h
# token_policies          ["default", "myapp-policy"]
```

```python
# Python application login example
import hvac

client = hvac.Client(url="https://vault.internal:8200")

# Authenticate via AppRole
result = client.auth.approle.login(
    role_id="1234-abcd-5678-efgh",
    secret_id="9999-zzzz-8888-yyyy",
)
client.token = result["auth"]["client_token"]

# Read a secret
secret = client.secrets.kv.v2.read_secret_version(
    path="myapp/database",
    mount_point="secret",
)
db_password = secret["data"]["data"]["password"]
```

---

## Kubernetes Auth Method

Allows Kubernetes pods to authenticate with Vault using their service account token.

### Setup

```bash
# Enable Kubernetes auth
vault auth enable kubernetes

# Configure it to talk to the K8s API
vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc:443"

# Create a role that maps K8s service accounts to Vault policies
vault write auth/kubernetes/role/myapp \
  bound_service_account_names=myapp \
  bound_service_account_namespaces=production \
  policies=myapp-policy \
  ttl=1h
```

### Application Usage

```python
import hvac
import os

client = hvac.Client(url="https://vault.internal:8200")

# Read the service account JWT token (injected by K8s)
with open("/var/run/secrets/kubernetes.io/serviceaccount/token") as f:
    jwt = f.read()

# Authenticate
client.auth.kubernetes.login(role="myapp", jwt=jwt)

# Now fetch secrets as usual
secret = client.secrets.kv.v2.read_secret_version(path="myapp/database")
```

---

## Transit Engine (Encryption as a Service)

Transit provides encryption/decryption without exposing keys. Applications send data to Vault for encryption; the key never leaves Vault.

```bash
# Enable Transit
vault secrets enable transit

# Create an encryption key
vault write -f transit/keys/myapp-encryption \
  type=aes256-gcm96

# Encrypt data (plaintext must be base64-encoded)
vault write transit/encrypt/myapp-encryption \
  plaintext=$(echo -n "sensitive-credit-card-4111" | base64)
# ciphertext: vault:v1:AbCdEf123456...

# Decrypt data
vault write transit/decrypt/myapp-encryption \
  ciphertext="vault:v1:AbCdEf123456..."
# plaintext: c2Vuc2l0aXZlLWNyZWRpdC1jYXJkLTQxMTE=
echo "c2Vuc2l0aXZlLWNyZWRpdC1jYXJkLTQxMTE=" | base64 -d
# sensitive-credit-card-4111

# Rotate the encryption key (old data still decryptable)
vault write -f transit/keys/myapp-encryption/rotate

# Re-encrypt data with the latest key version (rewrap)
vault write transit/rewrap/myapp-encryption \
  ciphertext="vault:v1:AbCdEf123456..."
# Returns vault:v2:XyZabc789...

# Set minimum decryption version (enforce key rotation)
vault write transit/keys/myapp-encryption/config \
  min_decryption_version=2
```

### Policy for Transit-Only Access

```hcl
# Application can encrypt/decrypt but never read the key
path "transit/encrypt/myapp-encryption" {
  capabilities = ["update"]
}

path "transit/decrypt/myapp-encryption" {
  capabilities = ["update"]
}

# Deny key export
path "transit/export/*" {
  capabilities = ["deny"]
}
```

---

## Policies (Path-Based Access Control)

Vault policies control what paths a token can access and what operations are allowed.

### Capabilities

- `create` -- write to a path that doesn't exist
- `read` -- read a path
- `update` -- write to a path that exists
- `delete` -- delete a path
- `list` -- list entries at a path
- `sudo` -- access root-protected paths
- `deny` -- explicit deny (overrides everything)

### Example Policies

```hcl
# policy: backend-team.hcl
# Backend team: full access to their secrets, read-only to shared
path "secret/data/backend/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "secret/metadata/backend/*" {
  capabilities = ["read", "list", "delete"]
}

path "secret/data/shared/*" {
  capabilities = ["read", "list"]
}

path "database/creds/backend-readwrite" {
  capabilities = ["read"]
}
```

```hcl
# policy: ci-cd.hcl
# CI/CD pipeline: read-only access to deployment secrets
path "secret/data/deploy/*" {
  capabilities = ["read", "list"]
}

path "secret/data/+/ci-config" {
  capabilities = ["read"]
}

# Allow token self-renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}
```

```hcl
# policy: admin.hcl
# Admin: broad access with audit requirements
path "secret/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "sys/policies/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "auth/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# Allow managing mount points
path "sys/mounts/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
```

### Apply Policies

```bash
vault policy write backend-team policy/backend-team.hcl
vault policy write ci-cd policy/ci-cd.hcl
vault policy write admin policy/admin.hcl

# List all policies
vault policy list

# Read a policy
vault policy read backend-team

# Create a token with specific policies
vault token create -policy=backend-team -ttl=8h
```

---

## Agent Sidecar for Kubernetes (Auto-Inject Secrets)

The Vault Agent Injector automatically injects secrets into pods via annotations.

### Prerequisites

The injector is installed with the Helm chart (`injector.enabled=true`).

### Pod Annotations for Secret Injection

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
      annotations:
        # Enable injection
        vault.hashicorp.com/agent-inject: "true"

        # Vault role to authenticate as
        vault.hashicorp.com/role: "myapp"

        # Inject database credentials as a file
        vault.hashicorp.com/agent-inject-secret-db-creds: "secret/data/myapp/database"
        vault.hashicorp.com/agent-inject-template-db-creds: |
          {{- with secret "secret/data/myapp/database" -}}
          DATABASE_URL=postgresql://{{ .Data.data.username }}:{{ .Data.data.password }}@{{ .Data.data.host }}:{{ .Data.data.port }}/{{ .Data.data.dbname }}
          {{- end }}

        # Inject API keys as a separate file
        vault.hashicorp.com/agent-inject-secret-api-keys: "secret/data/myapp/api-keys"
        vault.hashicorp.com/agent-inject-template-api-keys: |
          {{- with secret "secret/data/myapp/api-keys" -}}
          STRIPE_KEY={{ .Data.data.stripe_key }}
          SENDGRID_KEY={{ .Data.data.sendgrid_key }}
          {{- end }}

        # Inject dynamic database credentials
        vault.hashicorp.com/agent-inject-secret-dynamic-db: "database/creds/myapp-readonly"
        vault.hashicorp.com/agent-inject-template-dynamic-db: |
          {{- with secret "database/creds/myapp-readonly" -}}
          DB_USER={{ .Data.username }}
          DB_PASS={{ .Data.password }}
          {{- end }}

        # Keep the agent running to renew dynamic secret leases
        vault.hashicorp.com/agent-pre-populate-only: "false"

    spec:
      serviceAccountName: myapp
      containers:
        - name: app
          image: myapp:latest
          command: ["/bin/sh", "-c"]
          args:
            - |
              source /vault/secrets/db-creds
              source /vault/secrets/api-keys
              exec node server.js
          volumeMounts: []
          # Secrets appear at /vault/secrets/<name>
```

### How It Works

1. Pod is created with vault annotations
2. Mutating webhook intercepts and adds an init container (vault-agent-init) and sidecar (vault-agent)
3. Init container authenticates to Vault using the K8s service account token
4. Secrets are rendered as files at `/vault/secrets/`
5. Sidecar keeps running to renew leases and refresh secrets

---

## Seal/Unseal Concepts

### What Is Sealing?

When Vault starts, it is in a **sealed** state. Sealed Vault knows where the encrypted data is, but cannot decrypt it. The master key that decrypts the encryption key is split using Shamir's Secret Sharing.

### Initialization

```bash
# Initialize Vault (first time only)
vault operator init \
  -key-shares=5 \
  -key-threshold=3

# Output:
# Unseal Key 1: AAAA...
# Unseal Key 2: BBBB...
# Unseal Key 3: CCCC...
# Unseal Key 4: DDDD...
# Unseal Key 5: EEEE...
# Initial Root Token: hvs.xxxx
#
# SAVE THESE SECURELY. Distribute to different team members.
```

- **key-shares**: Total number of key fragments
- **key-threshold**: Minimum fragments needed to unseal

### Unsealing

```bash
# Requires 3 of 5 key holders to each provide their key
vault operator unseal AAAA...   # Progress: 1/3
vault operator unseal CCCC...   # Progress: 2/3
vault operator unseal EEEE...   # Progress: 3/3 -> Vault is unsealed
```

### Auto-Unseal (Production)

Manual unsealing is impractical for production. Use auto-unseal with a cloud KMS:

```hcl
# vault.hcl - AWS KMS auto-unseal
seal "awskms" {
  region     = "us-east-1"
  kms_key_id = "arn:aws:kms:us-east-1:123456789012:key/abcd-1234-efgh-5678"
}
```

```hcl
# vault.hcl - GCP Cloud KMS auto-unseal
seal "gcpckms" {
  project    = "my-project"
  region     = "global"
  key_ring   = "vault-keyring"
  crypto_key = "vault-unseal-key"
}
```

```hcl
# vault.hcl - Azure Key Vault auto-unseal
seal "azurekeyvault" {
  vault_name = "my-vault-keyvault"
  key_name   = "vault-unseal-key"
}
```

With auto-unseal, Vault automatically unseals on restart using the cloud KMS. Recovery keys replace unseal keys for emergency operations.

### Seal Operations

```bash
# Check seal status
vault status
# Sealed: false
# Key Shares: 5
# Key Threshold: 3

# Manually seal Vault (emergency lockdown)
vault operator seal
# This immediately seals Vault, requiring unseal to resume
```

---

## Audit Logging

Enable audit logging to track every Vault operation:

```bash
# File audit log
vault audit enable file file_path=/vault/logs/audit.log

# Syslog
vault audit enable syslog tag="vault" facility="AUTH"

# Socket (send to SIEM)
vault audit enable socket address="logstash.internal:9200" socket_type="tcp"
```

Every request and response is logged (with sensitive values HMAC'd). If all audit devices fail, Vault stops responding to requests to prevent unaudited access.

---

## Best Practices

1. **Never use the root token in production** -- create admin tokens with specific policies, then revoke root
2. **Enable audit logging** before anything else -- compliance and forensics require it
3. **Use auto-unseal** with cloud KMS for production -- manual unsealing does not scale
4. **Prefer dynamic secrets** over static ones -- short-lived, automatically revoked, unique per consumer
5. **Rotate regularly** -- use `vault lease revoke -prefix` to force credential rotation
6. **Least privilege policies** -- start with deny-all and explicitly grant access
7. **Separate mount points** per team/environment -- easier policy management
8. **Monitor lease counts** -- runaway lease creation can exhaust Vault resources
9. **Back up Raft snapshots** -- `vault operator raft snapshot save backup.snap`
10. **Use namespaces** (Enterprise) for multi-tenancy -- isolate teams completely
