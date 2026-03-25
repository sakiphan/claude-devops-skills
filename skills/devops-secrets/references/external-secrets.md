# External Secrets Operator (ESO) for Kubernetes

## Overview

The External Secrets Operator (ESO) synchronizes secrets from external providers (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager, Azure Key Vault, Doppler, 1Password, and more) into native Kubernetes Secrets. It eliminates manual secret management in K8s and provides automatic refresh/rotation.

---

## Installation via Helm

```bash
# Add the External Secrets Helm repo
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

# Install ESO
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --set installCRDs=true

# Verify installation
kubectl -n external-secrets get pods
kubectl get crd | grep external-secrets
# Expected CRDs:
#   clustersecretstores.external-secrets.io
#   externalsecrets.external-secrets.io
#   secretstores.external-secrets.io
#   pushsecrets.external-secrets.io
```

### Production Helm Values

```yaml
# values-production.yaml
replicaCount: 2

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 200m
    memory: 256Mi

serviceMonitor:
  enabled: true
  namespace: monitoring

webhook:
  replicaCount: 2

certController:
  replicaCount: 2

# Process secrets across all namespaces
scopedNamespace: ""

# How often to reconcile ExternalSecrets (fallback)
controllerClass: ""
```

---

## SecretStore CR (Provider Backends)

A `SecretStore` is namespaced and defines how to connect to an external secret provider.

### AWS Secrets Manager Backend

```yaml
# secret-store-aws.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        # Option 1: Reference a K8s secret containing AWS credentials
        secretRef:
          accessKeyIDSecretRef:
            name: aws-credentials
            key: access-key-id
          secretAccessKeySecretRef:
            name: aws-credentials
            key: secret-access-key
---
# The referenced K8s secret (bootstrap manually or via CI)
apiVersion: v1
kind: Secret
metadata:
  name: aws-credentials
  namespace: production
type: Opaque
stringData:
  access-key-id: "AKIAIOSFODNN7EXAMPLE"
  secret-access-key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

```yaml
# Option 2: Use IRSA (IAM Roles for Service Accounts) -- recommended
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-secrets-sa
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: "arn:aws:iam::123456789012:role/external-secrets-role"
```

### GCP Secret Manager Backend

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: gcp-secret-manager
  namespace: production
spec:
  provider:
    gcpsm:
      projectID: my-gcp-project
      auth:
        secretRef:
          secretAccessKeySecretRef:
            name: gcp-credentials
            key: service-account.json
```

### HashiCorp Vault Backend

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: production
spec:
  provider:
    vault:
      server: "https://vault.internal:8200"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "external-secrets"
          serviceAccountRef:
            name: external-secrets-sa
```

### Doppler Backend

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: doppler-backend
  namespace: production
spec:
  provider:
    doppler:
      auth:
        secretRef:
          dopplerToken:
            name: doppler-token
            key: token
---
apiVersion: v1
kind: Secret
metadata:
  name: doppler-token
  namespace: production
type: Opaque
stringData:
  token: "dp.st.production.xxxxxxxxxxxx"
```

---

## ExternalSecret CR (Mapping External to K8s Secret)

An `ExternalSecret` defines which external secrets to fetch and how to map them into a Kubernetes Secret.

### Basic Example

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-database
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore

  target:
    name: myapp-database-credentials    # K8s Secret name to create
    creationPolicy: Owner               # ESO owns this secret
    deletionPolicy: Retain              # Keep K8s Secret if ExternalSecret is deleted

  data:
    # Map individual keys from a JSON secret
    - secretKey: DB_HOST                 # Key in the K8s Secret
      remoteRef:
        key: myapp/production/database   # Secret name in AWS
        property: host                   # JSON key within the secret

    - secretKey: DB_PASSWORD
      remoteRef:
        key: myapp/production/database
        property: password

    - secretKey: DB_USERNAME
      remoteRef:
        key: myapp/production/database
        property: username
```

### Map an Entire JSON Secret

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-config
  namespace: production
spec:
  refreshInterval: 30m
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore

  target:
    name: myapp-config

  dataFrom:
    - extract:
        key: myapp/production/config
        # All JSON keys become K8s Secret keys
```

### Template the Output

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-database-url
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore

  target:
    name: myapp-database-url
    template:
      engineVersion: v2
      data:
        DATABASE_URL: "postgresql://{{ .username }}:{{ .password }}@{{ .host }}:{{ .port }}/{{ .dbname }}?sslmode=require"
        .env: |
          DATABASE_URL=postgresql://{{ .username }}:{{ .password }}@{{ .host }}:{{ .port }}/{{ .dbname }}
          DB_POOL_SIZE=20

  data:
    - secretKey: username
      remoteRef:
        key: myapp/production/database
        property: username
    - secretKey: password
      remoteRef:
        key: myapp/production/database
        property: password
    - secretKey: host
      remoteRef:
        key: myapp/production/database
        property: host
    - secretKey: port
      remoteRef:
        key: myapp/production/database
        property: port
    - secretKey: dbname
      remoteRef:
        key: myapp/production/database
        property: dbname
```

---

## ClusterSecretStore for Multi-Namespace

A `ClusterSecretStore` is cluster-scoped, allowing any namespace to reference it.

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager   # No namespace -- cluster-scoped
spec:
  conditions:
    # Restrict which namespaces can use this store
    - namespaces:
        - production
        - staging
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
            namespace: external-secrets
```

Reference from any allowed namespace:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: shared-api-keys
  namespace: staging
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore      # Reference the cluster-scoped store

  target:
    name: api-keys

  data:
    - secretKey: STRIPE_KEY
      remoteRef:
        key: shared/api-keys
        property: stripe_key
```

---

## Refresh Intervals and Rotation

### How Refresh Works

- `refreshInterval` on ExternalSecret controls how often ESO polls the external provider
- When the external secret value changes, ESO updates the K8s Secret
- Pods consuming the secret via `envFrom` need a restart to pick up changes
- Pods consuming via volume mounts get automatic updates (kubelet sync period)

```yaml
spec:
  refreshInterval: 15m    # Check every 15 minutes
  # refreshInterval: 0    # Disable auto-refresh (one-time sync only)
```

### Force Refresh

```bash
# Annotate to trigger immediate reconciliation
kubectl annotate externalsecret myapp-database \
  force-sync=$(date +%s) --overwrite -n production
```

### Automatic Pod Restart on Secret Change

Use Reloader or Stakater to restart pods when secrets update:

```bash
# Install Stakater Reloader
helm install reloader stakater/reloader --namespace reloader --create-namespace
```

```yaml
# Add annotation to Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  annotations:
    reloader.stakater.com/auto: "true"
    # Or target specific secrets:
    # secret.reloader.stakater.com/reload: "myapp-database-credentials"
```

---

## PushSecret (Sync from K8s to External)

PushSecret reverses the flow: it pushes Kubernetes Secrets to external providers. Useful for bootstrapping or syncing secrets outward.

```yaml
apiVersion: external-secrets.io/v1alpha1
kind: PushSecret
metadata:
  name: push-tls-cert
  namespace: production
spec:
  # How often to push
  refreshInterval: 1h

  secretStoreRefs:
    - name: aws-secrets-manager
      kind: SecretStore

  # Source K8s Secret
  selector:
    secret:
      name: myapp-tls-cert

  data:
    - match:
        secretKey: tls.crt          # Key in the K8s Secret
        remoteRef:
          remoteKey: myapp/production/tls-certificate
          property: certificate     # Key in the external secret

    - match:
        secretKey: tls.key
        remoteRef:
          remoteKey: myapp/production/tls-certificate
          property: private_key
```

---

## Example: AWS Secrets Manager to K8s Secret to Pod

### End-to-End Setup

```bash
# 1. Create the secret in AWS
aws secretsmanager create-secret \
  --name myapp/production/database \
  --secret-string '{"username":"app","password":"s3cret","host":"db.internal","port":"5432","dbname":"myapp"}'
```

```yaml
# 2. Create SecretStore
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-sm
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: eso-sa
---
# 3. Create ExternalSecret
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-creds
  namespace: production
spec:
  refreshInterval: 30m
  secretStoreRef:
    name: aws-sm
    kind: SecretStore
  target:
    name: db-credentials
    template:
      engineVersion: v2
      data:
        DATABASE_URL: "postgresql://{{ .username }}:{{ .password }}@{{ .host }}:{{ .port }}/{{ .dbname }}"
  data:
    - secretKey: username
      remoteRef:
        key: myapp/production/database
        property: username
    - secretKey: password
      remoteRef:
        key: myapp/production/database
        property: password
    - secretKey: host
      remoteRef:
        key: myapp/production/database
        property: host
    - secretKey: port
      remoteRef:
        key: myapp/production/database
        property: port
    - secretKey: dbname
      remoteRef:
        key: myapp/production/database
        property: dbname
---
# 4. Deployment consuming the secret
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
    spec:
      serviceAccountName: myapp
      containers:
        - name: app
          image: myapp:latest
          envFrom:
            - secretRef:
                name: db-credentials
          # Or use specific keys:
          # env:
          #   - name: DATABASE_URL
          #     valueFrom:
          #       secretKeyRef:
          #         name: db-credentials
          #         key: DATABASE_URL
```

```bash
# 5. Verify
kubectl get externalsecret db-creds -n production
# NAME       STORE    REFRESH INTERVAL   STATUS
# db-creds   aws-sm   30m                SecretSynced

kubectl get secret db-credentials -n production -o jsonpath='{.data.DATABASE_URL}' | base64 -d
# postgresql://app:s3cret@db.internal:5432/myapp
```

---

## Example: Vault to K8s Secret

```yaml
# SecretStore for Vault
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault
  namespace: production
spec:
  provider:
    vault:
      server: "https://vault.internal:8200"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "external-secrets"
          serviceAccountRef:
            name: eso-sa
---
# ExternalSecret fetching from Vault KV v2
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: vault-db-creds
  namespace: production
spec:
  refreshInterval: 15m
  secretStoreRef:
    name: vault
    kind: SecretStore

  target:
    name: vault-database-credentials

  data:
    - secretKey: DB_USERNAME
      remoteRef:
        key: myapp/database           # Vault KV path
        property: username

    - secretKey: DB_PASSWORD
      remoteRef:
        key: myapp/database
        property: password

    - secretKey: API_KEY
      remoteRef:
        key: myapp/api-keys
        property: stripe_secret_key
```

---

## Sealed Secrets Alternative (Brief Comparison)

Sealed Secrets (by Bitnami) is an alternative approach where secrets are encrypted client-side and stored in Git.

| Feature | External Secrets Operator | Sealed Secrets |
|---|---|---|
| **Architecture** | Syncs from external provider to K8s | Encrypts K8s Secrets for Git storage |
| **Source of truth** | External provider (AWS, Vault, etc.) | Git (encrypted manifests) |
| **Rotation** | Automatic via refresh interval | Manual re-encryption required |
| **Multi-cluster** | Each cluster syncs from same provider | Each cluster has its own key pair |
| **Providers** | 20+ external backends | None (standalone) |
| **Complexity** | Requires external provider setup | Simple, self-contained |
| **GitOps fit** | ExternalSecret CRs in Git (no secrets) | Encrypted SealedSecret CRs in Git |
| **Key management** | Delegated to external provider | Cluster-managed asymmetric key pair |
| **Audit trail** | Via external provider (CloudTrail, etc.) | Git history only |

**When to use Sealed Secrets:**
- Small teams without an external secrets provider
- Simple setups where Git is the only source of truth
- No budget for Secrets Manager, Vault, etc.

**When to use ESO:**
- You already use AWS Secrets Manager, Vault, GCP, etc.
- You need automatic rotation
- Multi-cluster environments sharing secrets from a central provider
- Enterprise compliance requirements (audit, access control)

---

## Troubleshooting: Common Errors

### SecretStore Connection Failed

```bash
kubectl describe secretstore aws-sm -n production
# Conditions:
#   Type: Ready
#   Status: False
#   Reason: ConfigError
#   Message: could not validate SecretStore: ...
```

**Causes:**
- Invalid credentials in the referenced K8s Secret
- Wrong region or endpoint
- Network policy blocking egress to AWS/Vault
- IRSA service account not annotated correctly

**Fix:**
```bash
# Test connectivity from the ESO pod
kubectl exec -it -n external-secrets deploy/external-secrets -- \
  wget -qO- https://secretsmanager.us-east-1.amazonaws.com

# Check IRSA token
kubectl exec -it -n production <pod> -- cat /var/run/secrets/eks.amazonaws.com/serviceaccount/token
```

### ExternalSecret Status: SecretSyncedError

```bash
kubectl get externalsecret -n production
# NAME       STORE    REFRESH   STATUS
# db-creds   aws-sm   30m       SecretSyncedError

kubectl describe externalsecret db-creds -n production
# Message: could not get secret data: AccessDeniedException
```

**Causes:**
- IAM policy missing `secretsmanager:GetSecretValue`
- Secret name/path is wrong
- JSON property key doesn't exist in the remote secret

**Fix:**
```bash
# Verify the secret exists and is accessible
aws secretsmanager get-secret-value --secret-id myapp/production/database

# Check IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/external-secrets-role \
  --action-names secretsmanager:GetSecretValue \
  --resource-arns "arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp/production/*"
```

### Secret Not Updating After External Change

```bash
# Check last sync time
kubectl get externalsecret db-creds -n production -o jsonpath='{.status.refreshTime}'

# Force an immediate sync
kubectl annotate externalsecret db-creds \
  force-sync=$(date +%s) --overwrite -n production

# Check ESO controller logs
kubectl logs -n external-secrets deploy/external-secrets -f --tail=50
```

### Pods Not Picking Up Updated Secrets

Pods using `envFrom` or `env.valueFrom` only read secrets at startup. They need a restart:

```bash
# Rolling restart
kubectl rollout restart deployment/myapp -n production

# Or use Stakater Reloader for automatic restarts (see Refresh section above)
```

Pods using secret volume mounts get updates automatically (kubelet sync, typically 1-2 minutes).

### CRD Version Mismatch

```
error: resource mapping not found for name: "..." namespace: "..." from "...":
no matches for kind "ExternalSecret" in version "external-secrets.io/v1beta1"
```

**Fix:**
```bash
# Check installed CRD versions
kubectl get crd externalsecrets.external-secrets.io -o jsonpath='{.spec.versions[*].name}'

# Upgrade ESO
helm upgrade external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --set installCRDs=true
```

### Multiple SecretStores Across Namespaces

If you need the same provider config in many namespaces, use `ClusterSecretStore` instead of duplicating `SecretStore` in each namespace.

---

## Best Practices

1. **Use ClusterSecretStore** for shared providers -- avoid duplicating SecretStore per namespace
2. **Set appropriate refresh intervals** -- 15-60 minutes is typical; shorter means more API calls and cost
3. **Use IRSA/Workload Identity** over static credentials -- no credential rotation needed
4. **Set `deletionPolicy: Retain`** -- prevents accidental secret deletion if ExternalSecret is removed
5. **Template secrets** -- compose connection strings and config files in the ExternalSecret, not in application code
6. **Monitor sync status** -- alert on `SecretSyncedError` conditions via Prometheus/alertmanager
7. **Use `dataFrom` with `extract`** -- for secrets that map 1:1 to K8s Secret keys, avoid listing each property
8. **Namespace isolation** -- use namespaced SecretStore with separate IAM roles per environment
9. **Combine with Reloader** -- ensure pods pick up rotated secrets automatically
10. **Version pin ESO** -- avoid surprise CRD changes in production upgrades
