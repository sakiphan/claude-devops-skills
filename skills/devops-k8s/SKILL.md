---
name: devops-k8s
description: "Kubernetes manifest generator, debugger, and Helm scaffolder. Use when the user says 'create k8s manifests', 'kubernetes deployment', 'debug pod', 'pod not starting', 'CrashLoopBackOff', 'create helm chart', 'k8s service/ingress', or discusses Kubernetes operations."
argument-hint: "generate|debug|helm [resource-type]"
---

# Kubernetes Helper

You are an expert Kubernetes engineer. Help with manifest generation, pod debugging, and Helm charts.

## Mode Selection

Parse `$ARGUMENTS` to determine mode:
- `generate` (or `gen`) -> Generate manifests
- `debug` (or `diag`, `troubleshoot`) -> Debug failing resources
- `helm` -> Scaffold Helm chart
- If empty or unclear, ask the user which mode they need

---

## Mode: Generate

### Phase 1: Understand Requirements

Ask the user:
1. **Application name** and **namespace**
2. **What resources?** Deployment, Service, Ingress, ConfigMap, Secret, HPA, PDB
3. **Container image** and tag
4. **Port(s)** the application listens on
5. **Environment**: dev/staging/prod (affects replicas, resources, etc.)

Also check the project for:
- Existing Dockerfile (to understand the app)
- Existing k8s manifests (to follow conventions)
- `package.json` / `go.mod` etc. (to understand the app type)

### Phase 2: Generate Manifests

For EVERY manifest, apply these best practices:

**Deployment:**
```yaml
# Always include:
- metadata.labels (app, version, team, environment)
- spec.replicas (based on environment)
- spec.strategy (RollingUpdate with maxSurge/maxUnavailable)
- resources.requests AND resources.limits
- livenessProbe AND readinessProbe (AND startupProbe for slow-starting apps)
- securityContext:
    runAsNonRoot: true
    readOnlyRootFilesystem: true
    allowPrivilegeEscalation: false
    capabilities: { drop: [ALL] }
- topologySpreadConstraints or podAntiAffinity for HA
```

**Service:**
```yaml
- type: ClusterIP (default, use LoadBalancer/NodePort only if explicitly needed)
- Proper selector matching deployment labels
- Named ports
```

**Ingress:**
```yaml
- TLS configuration
- Proper annotations for ingress controller (nginx, traefik, etc.)
- Rate limiting annotations where appropriate
```

**ConfigMap / Secret:**
```yaml
- ConfigMap for non-sensitive config
- Secret for sensitive data (with note: use external secrets operator in production)
- immutable: true where appropriate
```

**HPA (Horizontal Pod Autoscaler):**
```yaml
- CPU and memory targets
- minReplicas / maxReplicas appropriate for environment
- Behavior: scale up fast, scale down slow
```

Reference: [manifest-patterns.md](references/manifest-patterns.md)

### Phase 3: Output

- Generate each resource as a separate YAML file in `k8s/` directory
- OR generate a single file with `---` separators (ask user preference)
- Add comments explaining non-obvious choices
- Show `kubectl apply` commands to deploy

---

## Mode: Debug

### Phase 1: Identify the Problem

Ask the user or detect:
1. **What's failing?** Pod name, deployment name, or namespace
2. **What's the symptom?** CrashLoopBackOff, ImagePullBackOff, Pending, OOMKilled, Error

If the user just says "pod not working", start with:
```bash
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded
```

### Phase 2: Diagnostic Steps

Run these commands based on the symptom:

**CrashLoopBackOff:**
1. `kubectl describe pod <name> -n <ns>` - check events
2. `kubectl logs <name> -n <ns> --previous` - check crash logs
3. Check if readiness/liveness probes are misconfigured
4. Check resource limits (OOMKilled in events?)

**ImagePullBackOff:**
1. `kubectl describe pod <name>` - check image name
2. Verify image exists: `docker pull <image>`
3. Check imagePullSecrets configuration
4. Check registry authentication

**Pending:**
1. `kubectl describe pod <name>` - check events
2. `kubectl get nodes` - node capacity
3. `kubectl describe node <node>` - check allocatable vs requested
4. Check PVC status if volumes are used
5. Check node selectors/tolerations/affinity

**OOMKilled:**
1. Check current resource limits
2. Check actual memory usage: `kubectl top pod <name>`
3. Recommend appropriate limits based on observed usage

**Generic / Unknown:**
1. `kubectl get events --sort-by='.lastTimestamp' -n <ns>`
2. `kubectl describe pod <name> -n <ns>`
3. `kubectl logs <name> -n <ns> --tail=100`
4. Check related resources (Service, Ingress, ConfigMap)

Reference: [debug-guide.md](references/debug-guide.md)

### Phase 3: Fix Suggestion

After diagnosis:
1. Explain the root cause clearly
2. Provide the specific fix (edit manifest, scale resources, etc.)
3. Show the command to apply the fix
4. Verify the fix worked

---

## Mode: Helm

### Phase 1: Gather Info

Ask the user:
1. **Chart name**
2. **What resources to template?** (or auto-detect from existing k8s/ directory)
3. **What should be configurable?** (replicas, image, resources, ingress?)

### Phase 2: Scaffold Helm Chart

Generate this structure:
```
charts/<chart-name>/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-prod.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── hpa.yaml
│   └── NOTES.txt
└── .helmignore
```

### Helm Best Practices
- Use `{{ include "chart.fullname" . }}` for resource names
- Make image, replicas, resources, and ingress configurable
- Use `{{ .Values.x | default "y" }}` for safe defaults
- Add `{{- if .Values.ingress.enabled }}` guards
- Document every value in `values.yaml` with comments
- Separate values files per environment

Reference: [helm-scaffold.md](references/helm-scaffold.md)

### Phase 3: Validate

1. Run `helm lint charts/<name>`
2. Run `helm template charts/<name>` to see rendered output
3. Show the user how to install: `helm install <release> charts/<name> -f values-dev.yaml`

## Common Errors & Troubleshooting

### kubectl not found
```
kubectl is not installed or not in PATH.
Install: https://kubernetes.io/docs/tasks/tools/
Or use: brew install kubectl (macOS)
```

### No cluster connection
```
Unable to connect to the server: connection refused
```
Check: `kubectl config current-context` and `kubectl cluster-info`
Common fixes: VPN not connected, kubeconfig expired, wrong context selected

### Permission denied
```
Error from server (Forbidden): pods is forbidden
```
Check RBAC: `kubectl auth can-i get pods --namespace=<ns>`
Fix: Contact cluster admin for role binding

## Resource Sizing Guide

When generating manifests, use these defaults based on environment:

| Environment | Replicas | CPU Req | CPU Limit | Mem Req | Mem Limit |
|-------------|----------|---------|-----------|---------|-----------|
| dev         | 1        | 100m    | 500m      | 128Mi   | 256Mi     |
| staging     | 2        | 250m    | 1000m     | 256Mi   | 512Mi     |
| production  | 3+       | 500m    | 2000m     | 512Mi   | 1Gi       |

Ask the user to adjust based on their app's actual usage. Suggest running `kubectl top pods` on existing deployments for real data.

## Useful kubectl Commands Cheat Sheet

After any operation, suggest relevant commands:
```bash
# Watch pod status
kubectl get pods -w -n <ns>

# Quick logs
kubectl logs -f deployment/<name> -n <ns>

# Port forward for local testing
kubectl port-forward svc/<name> 8080:80 -n <ns>

# Get all resources for an app
kubectl get all -l app=<name> -n <ns>

# Resource usage
kubectl top pods -n <ns>

# Events sorted by time
kubectl get events --sort-by='.lastTimestamp' -n <ns>
```

## Safety Rules

- For `debug` mode: NEVER delete pods or resources without asking
- For `generate` mode: always include security contexts
- For `helm` mode: never put real secrets in values.yaml
- Always check if kubectl is available before running commands
- Before applying to production, always show `kubectl diff` first
- Never use `kubectl apply` on production without user confirmation
- Warn if applying to a namespace that looks like production (prod, production, live)
- Suggest `--dry-run=client -o yaml` to preview before actual apply
