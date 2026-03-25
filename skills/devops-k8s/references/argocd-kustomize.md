# ArgoCD + Kustomize Reference

## ArgoCD Application Manifest

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/repo.git
    targetRevision: main
    path: k8s/overlays/dev
  destination:
    server: https://kubernetes.default.svc
    namespace: my-app-dev
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        maxDuration: 3m0s
        factor: 2
```

For production, remove `syncPolicy.automated` to require manual sync.

## Kustomize Base Structure

### base/kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
  - ingress.yaml

commonLabels:
  app: my-app
  managed-by: kustomize
```

### overlays/dev/kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namespace: my-app-dev

images:
  - name: my-app
    newTag: dev-latest

replicas:
  - name: my-app
    count: 1

patches:
  - target:
      kind: Deployment
      name: my-app
    patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/resources
        value:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 256Mi

configMapGenerator:
  - name: my-app-config
    literals:
      - ENV=dev
      - LOG_LEVEL=debug
```

## kustomization.yaml Key Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `resources` | Files/dirs to include | `- deployment.yaml` |
| `patches` | Strategic merge or JSON patches | See above |
| `images` | Override image name/tag | `newTag: v1.2.3` |
| `replicas` | Override replica count | `count: 3` |
| `namespace` | Set namespace for all resources | `my-app-prod` |
| `commonLabels` | Add labels to all resources | `env: prod` |
| `commonAnnotations` | Add annotations to all resources | `team: platform` |
| `configMapGenerator` | Generate ConfigMaps | `literals:` or `files:` |
| `secretGenerator` | Generate Secrets | `literals:` or `files:` |
| `namePrefix` | Prefix all resource names | `prod-` |
| `nameSuffix` | Suffix all resource names | `-v2` |

## Common Patches Per Environment

### Replicas + Resources (prod)
```yaml
patches:
  - target:
      kind: Deployment
      name: my-app
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 3
      - op: replace
        path: /spec/template/spec/containers/0/resources
        value:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 1Gi
```

### Environment Variables
```yaml
configMapGenerator:
  - name: my-app-config
    behavior: merge
    literals:
      - ENV=production
      - LOG_LEVEL=warn
      - ENABLE_DEBUG=false
```

## ArgoCD Sync Policies

| Policy | Use Case |
|--------|----------|
| `automated.selfHeal: true` | Auto-revert manual cluster changes |
| `automated.prune: true` | Delete resources removed from git |
| No `automated` block | Manual sync only (use for prod) |
| `syncOptions: [ApplyOutOfSyncOnly=true]` | Only apply changed resources |
| `syncOptions: [ServerSideApply=true]` | Use server-side apply for large CRDs |

## App of Apps Pattern

A parent Application that manages child Applications:
```yaml
# apps/kustomization.yaml
resources:
  - my-app-dev.yaml
  - my-app-staging.yaml
  - my-app-prod.yaml
```

```yaml
# argocd-root.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/org/repo.git
    path: apps
  destination:
    server: https://kubernetes.default.svc
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
```

## Useful Commands

```bash
# Sync an application
argocd app sync my-app-dev

# Get application status
argocd app get my-app-dev

# View app diff (what would change)
argocd app diff my-app-dev

# Rollback to previous version
argocd app rollback my-app-dev

# List all applications
argocd app list

# Build kustomize locally to preview
kustomize build k8s/overlays/dev
kustomize build k8s/overlays/prod

# Diff kustomize output against cluster
kustomize build k8s/overlays/dev | kubectl diff -f -

# Hard refresh (clear cache)
argocd app get my-app-dev --hard-refresh
```
