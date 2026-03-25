# Pod Debugging Decision Tree

## CrashLoopBackOff

Pod starts, crashes, restarts repeatedly with increasing backoff.

**Diagnostic commands:**

```bash
kubectl describe pod <pod> -n <ns>
kubectl logs <pod> -n <ns> --previous    # Logs from crashed container
kubectl logs <pod> -n <ns> -c <container> --previous  # Multi-container
kubectl get events -n <ns> --sort-by='.lastTimestamp' | grep <pod>
```

**Common causes:**

| Cause | Evidence | Fix |
|---|---|---|
| App error on startup | Error in logs --previous | Fix application code or config |
| Missing config/secret | "file not found" or env var errors | Verify ConfigMap/Secret exists and is mounted |
| Wrong command/args | "exec format error" or immediate exit | Check `command` and `args` in spec |
| Port conflict | "bind: address already in use" | Change container port |
| Failing liveness probe | "Liveness probe failed" in events | Increase `initialDelaySeconds` or fix probe endpoint |

## ImagePullBackOff

Cannot pull the container image.

**Diagnostic commands:**

```bash
kubectl describe pod <pod> -n <ns> | grep -A5 "Events:"
kubectl get events -n <ns> | grep "pull"
```

**Common causes:**

| Cause | Evidence | Fix |
|---|---|---|
| Image not found | "manifest unknown" | Verify image:tag exists in registry |
| Auth failure | "unauthorized" or "access denied" | Create/fix `imagePullSecrets` |
| Registry unreachable | "timeout" or "no such host" | Check network, DNS, firewall |
| Typo in image name | "not found" | Check `image:` field spelling |

**Quick fix for private registries:**

```bash
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=user \
  --docker-password=pass \
  -n <ns>
# Then add imagePullSecrets to pod spec
```

## Pending

Pod cannot be scheduled to any node.

**Diagnostic commands:**

```bash
kubectl describe pod <pod> -n <ns> | grep -A10 "Events:"
kubectl get nodes -o wide
kubectl describe nodes | grep -A5 "Allocated resources"
kubectl get pvc -n <ns>  # Check if PVC is pending
```

**Common causes:**

| Cause | Evidence | Fix |
|---|---|---|
| Insufficient CPU/memory | "Insufficient cpu" or "Insufficient memory" | Reduce requests, add nodes, or evict pods |
| No matching nodes | "node(s) didn't match" | Check nodeSelector, affinity, tolerations |
| PVC not bound | PVC in Pending state | Check StorageClass, PV availability |
| Taint with no toleration | "node(s) had taints" | Add toleration or remove taint |
| Too many pods on node | "Too many pods" | Increase max-pods on node or add nodes |

## OOMKilled

Container exceeded its memory limit.

**Diagnostic commands:**

```bash
kubectl describe pod <pod> -n <ns> | grep -A3 "Last State"
kubectl top pod <pod> -n <ns>          # Current memory usage
kubectl top pod -n <ns> --sort-by=memory
```

**Evidence:** `Reason: OOMKilled`, Exit Code 137

**Fixes:**

1. Increase memory limit if the app genuinely needs more:
   ```yaml
   resources:
     limits:
       memory: 512Mi  # Increase from previous value
   ```
2. Investigate memory leak — profile the application
3. For JVM apps, ensure `-Xmx` is set below container limit (leave ~25% headroom)
4. Check if the app respects cgroup memory limits

## CreateContainerError

Container runtime cannot create the container.

**Diagnostic commands:**

```bash
kubectl describe pod <pod> -n <ns>
kubectl get events -n <ns> --sort-by='.lastTimestamp'
```

**Common causes:**

| Cause | Evidence | Fix |
|---|---|---|
| Missing ConfigMap/Secret | "configmap not found" / "secret not found" | Create the missing resource |
| Bad volume mount | "mount path must be absolute" | Fix volumeMounts path |
| Security context issue | "operation not permitted" | Adjust securityContext or PodSecurityPolicy |

## Init Container Failures

Init containers must succeed (exit 0) before app containers start.

**Diagnostic commands:**

```bash
kubectl describe pod <pod> -n <ns> | grep -A20 "Init Containers:"
kubectl logs <pod> -n <ns> -c <init-container-name>
```

**Common causes:**

| Cause | Evidence | Fix |
|---|---|---|
| Dependency not ready | Connection refused, timeout | Check if target service is running |
| Wrong command | Non-zero exit code | Fix init container command |
| Permission denied | "permission denied" in logs | Fix securityContext or file permissions |

## General Debugging Toolkit

```bash
# Exec into a running pod
kubectl exec -it <pod> -n <ns> -- /bin/sh

# Run a debug container (ephemeral, K8s 1.23+)
kubectl debug -it <pod> -n <ns> --image=busybox --target=<container>

# Network debugging from inside the cluster
kubectl run debug --rm -it --image=nicolaka/netshoot -- /bin/bash

# Check DNS resolution
kubectl run dns-test --rm -it --image=busybox -- nslookup <service>.<ns>.svc.cluster.local

# View resource usage across all pods
kubectl top pods -n <ns> --sort-by=cpu
```
