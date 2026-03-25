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

## Privileged Containers

```bash
grep -rn 'privileged:\s*true' manifests/
grep -rn 'runAsUser:\s*0' manifests/
```

Severity: **CRITICAL** — full host access.

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

## Image Tag Policy

```bash
grep -rnE 'image:\s*\S+:latest' manifests/
grep -rnE 'image:\s*[^:@]+\s*$' manifests/  # no tag at all
```

Always pin to a specific tag or digest. Use `imagePullPolicy: IfNotPresent` with pinned tags.

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

## Host Namespaces

```bash
grep -rn 'hostNetwork:\s*true' manifests/
grep -rn 'hostPID:\s*true' manifests/
grep -rn 'hostIPC:\s*true' manifests/
```

Severity: **HIGH** — breaks container isolation.

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
