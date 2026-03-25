# Kubernetes Security Checks

## Security Context

Check for missing or weak securityContext:

```bash
grep -rn 'securityContext:' manifests/
```

Required at pod and container level:

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
    - name: app
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["ALL"]
```

### Fix (K008)

**BAD:**
```yaml
spec:
  containers:
    - name: app
      image: myapp:1.0
      # No securityContext — defaults allow privilege escalation and writable root
```

**GOOD:**
```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
    - name: app
      image: myapp:1.0
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["ALL"]
```

Set securityContext at both pod and container level to enforce non-root execution, prevent privilege escalation, and limit capabilities.

## Privileged Containers

```bash
grep -rn 'privileged:\s*true' manifests/
grep -rn 'runAsUser:\s*0' manifests/
```

Severity: **CRITICAL** — full host access.

### Fix (K001)

**BAD:**
```yaml
spec:
  containers:
    - name: app
      image: myapp:1.0
      securityContext:
        privileged: true
        runAsUser: 0
```

**GOOD:**
```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
  containers:
    - name: app
      image: myapp:1.0
      securityContext:
        privileged: false
        allowPrivilegeEscalation: false
        capabilities:
          drop: ["ALL"]
          add: ["NET_BIND_SERVICE"]   # Only if needed
```

Never run containers as privileged or root; use `runAsNonRoot: true` and drop all capabilities, adding back only the specific ones required.

## Resource Limits and Requests

```bash
grep -A6 'resources:' manifests/ | grep -E '(limits|requests|cpu|memory):'
```

Both limits and requests must be set:

```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi
```

Missing limits allows a pod to consume all node resources. Missing requests causes poor scheduling. Severity: **HIGH**

### Fix (K003)

**BAD:**
```yaml
spec:
  containers:
    - name: app
      image: myapp:1.0
      # No resources block — pod can consume entire node
```

**GOOD:**
```yaml
spec:
  containers:
    - name: app
      image: myapp:1.0
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 256Mi
```

Always set both resource requests (for scheduling) and limits (for enforcement) to prevent resource starvation and enable proper cluster scheduling.

## Probes

Check for liveness and readiness probes:

```bash
grep -rn 'livenessProbe:' manifests/
grep -rn 'readinessProbe:' manifests/
grep -rn 'startupProbe:' manifests/
```

All production workloads need at minimum readiness + liveness:

```yaml
readinessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 20
```

Use startupProbe for slow-starting containers to avoid liveness kills during boot.

### Fix (K004)

**BAD:**
```yaml
spec:
  containers:
    - name: app
      image: myapp:1.0
      # No probes — K8s cannot detect if the app is healthy or ready
```

**GOOD:**
```yaml
spec:
  containers:
    - name: app
      image: myapp:1.0
      readinessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 10
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 15
        periodSeconds: 20
      startupProbe:
        httpGet:
          path: /healthz
          port: 8080
        failureThreshold: 30
        periodSeconds: 10
```

Add readiness probes (to control traffic routing), liveness probes (to restart stuck pods), and startup probes (to protect slow-starting containers).

## Network Policies

```bash
grep -rn 'kind: NetworkPolicy' manifests/
```

Absence means all pod-to-pod traffic is allowed. At minimum, define a default-deny ingress policy per namespace:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes:
    - Ingress
```

### Fix (K006)

**BAD:**
```yaml
# No NetworkPolicy resources at all — all pods can talk to all other pods
```

**GOOD:**
```yaml
# 1. Default deny all ingress in the namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
---
# 2. Allow only specific traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-api
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - port: 8080
```

Start with a default-deny ingress policy per namespace, then add allow rules for only the specific pod-to-pod traffic that is required.

## Plain-Text Secrets

```bash
grep -rn 'kind: Secret' manifests/
grep -A10 'kind: Secret' manifests/ | grep 'data:' -A5
```

Flag secrets committed to git — values are only base64 encoded, not encrypted. Use Sealed Secrets, SOPS, or external secret operators instead.

Check for secrets in ConfigMaps:

```bash
grep -rnE '(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)' manifests/ | grep -i configmap
```

### Fix (K002)

**BAD:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:
  password: cGFzc3dvcmQxMjM=    # base64 of "password123" — committed to git
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  API_KEY: sk-live-abc123        # Secret in a ConfigMap — no protection at all
```

**GOOD:**
```yaml
# Option 1: Sealed Secrets (encrypted, safe to commit)
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: db-credentials
spec:
  encryptedData:
    password: AgBghT8...encrypted...

# Option 2: External Secrets Operator (fetches from Vault/AWS/GCP)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: db-credentials
  data:
    - secretKey: password
      remoteRef:
        key: production/db
        property: password
```

Never commit plain-text secrets to git; use Sealed Secrets, SOPS, or an External Secrets Operator to manage secrets securely.

## Image Tag Policy

```bash
grep -rnE 'image:\s*\S+:latest' manifests/
grep -rnE 'image:\s*[^:@]+\s*$' manifests/  # no tag at all
```

Always pin to a specific tag or digest. Use `imagePullPolicy: IfNotPresent` with pinned tags.

### Fix (K005)

**BAD:**
```yaml
spec:
  containers:
    - name: app
      image: myapp:latest
      # Or worse: image: myapp (no tag at all)
```

**GOOD:**
```yaml
spec:
  containers:
    - name: app
      image: myapp:1.2.3@sha256:a1b2c3d4e5f6...
      imagePullPolicy: IfNotPresent
```

Pin images to a specific version tag and digest for deterministic deployments; use `imagePullPolicy: IfNotPresent` with pinned tags.

## Service Account

```bash
grep -rn 'serviceAccountName:' manifests/
grep -rn 'automountServiceAccountToken:' manifests/
```

Disable auto-mounting when not needed:

```yaml
spec:
  automountServiceAccountToken: false
```

Default service account has no permissions in RBAC-enabled clusters, but the mounted token can still be exploited.

### Fix (Service Account)

**BAD:**
```yaml
spec:
  # No serviceAccountName — uses "default" SA
  # automountServiceAccountToken defaults to true — token mounted into every pod
  containers:
    - name: app
      image: myapp:1.0
```

**GOOD:**
```yaml
spec:
  serviceAccountName: myapp-sa
  automountServiceAccountToken: false    # Disable unless the app needs K8s API access
  containers:
    - name: app
      image: myapp:1.0
```

Disable automatic service account token mounting for workloads that do not need Kubernetes API access, and use dedicated service accounts with minimal RBAC roles.

## Host Namespaces

```bash
grep -rn 'hostNetwork:\s*true' manifests/
grep -rn 'hostPID:\s*true' manifests/
grep -rn 'hostIPC:\s*true' manifests/
```

Severity: **HIGH** — breaks container isolation.

### Fix (Host Namespaces)

**BAD:**
```yaml
spec:
  hostNetwork: true
  hostPID: true
  hostIPC: true
  containers:
    - name: app
      image: myapp:1.0
```

**GOOD:**
```yaml
spec:
  hostNetwork: false
  hostPID: false
  hostIPC: false
  containers:
    - name: app
      image: myapp:1.0
```

Never use host namespaces unless absolutely required (e.g., specific CNI plugins); they break container isolation and expose the host's process table and network stack.

## Severity Summary

| Check | Severity |
|---|---|
| Privileged containers | CRITICAL |
| Plain-text secrets in git | CRITICAL |
| Running as root | HIGH |
| No resource limits | HIGH |
| Host namespace access | HIGH |
| No network policies | MEDIUM |
| Missing probes | MEDIUM |
| Unpinned image tags | MEDIUM |
| Auto-mounted service account | LOW |
