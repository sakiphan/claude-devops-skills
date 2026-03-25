# Docker Compose Security Checks

## Privileged Mode

```bash
grep -n 'privileged:\s*true' docker-compose.yml
```

Full host access. Almost never needed. Severity: **CRITICAL**

## Host Network Mode

```bash
grep -n 'network_mode:\s*["'\'']?host' docker-compose.yml
```

Bypasses Docker network isolation. Severity: **HIGH**

## Dangerous Volume Mounts

```bash
grep -nE '^\s*-\s*("|'"'"')?/' docker-compose.yml | grep -E '(:/|/etc|/var/run/docker.sock|/proc|/sys)'
```

Critical mounts to flag:

| Mount | Risk |
|---|---|
| `/var/run/docker.sock` | Full Docker daemon access |
| `/` or `/etc` | Host filesystem read/write |
| `/proc`, `/sys` | Kernel info leak / manipulation |

## Resource Limits

Check for presence of resource limits:

```bash
grep -A5 'resources:' docker-compose.yml | grep 'limits:'
```

Expected YAML path: `services.<name>.deploy.resources.limits`

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
```

Missing resource limits allow a single container to starve the host. Severity: **MEDIUM**

## Health Checks

```bash
grep -c 'healthcheck:' docker-compose.yml
```

Expected structure per service:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Secrets Management

Flag inline secrets in environment variables:

```bash
grep -nE '^\s*(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)\s*[:=]' docker-compose.yml
grep -nE '^\s*-\s*(PASSWORD|SECRET|TOKEN|API_KEY)=' docker-compose.yml
```

Preferred: use Docker secrets or external secret store:

```yaml
secrets:
  db_password:
    file: ./secrets/db_password.txt

services:
  db:
    secrets:
      - db_password
```

Or reference `.env` file (still check `.env` is in `.gitignore`):

```yaml
env_file:
  - .env
```

## Image Tag Pinning

Flag services using `:latest` or no tag:

```bash
grep -nE 'image:\s*\S+(:latest)?\s*$' docker-compose.yml | grep -v '@sha256'
grep -nE 'image:\s*[^:@]+\s*$' docker-compose.yml
```

## Read-Only Root Filesystem

Check if `read_only: true` is set:

```bash
grep -n 'read_only:' docker-compose.yml
```

Best practice for stateless services:

```yaml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
```

## Restart Policy

```bash
grep -n 'restart:' docker-compose.yml
```

Acceptable values: `unless-stopped`, `on-failure`, `always`. Missing restart policy means containers stay down after crash.

## Exposed Ports

Flag ports bound to all interfaces:

```bash
grep -nE '^\s*-\s*"?\d+:\d+"?\s*$' docker-compose.yml
# "8080:80" binds to 0.0.0.0 — prefer "127.0.0.1:8080:80"
```

## Severity Summary

| Check | Severity |
|---|---|
| privileged: true | CRITICAL |
| docker.sock mount | CRITICAL |
| Inline secrets | HIGH |
| network_mode: host | HIGH |
| Host filesystem mounts | HIGH |
| No resource limits | MEDIUM |
| Unpinned image tags | MEDIUM |
| Ports on 0.0.0.0 | MEDIUM |
| No health check | LOW |
| No restart policy | LOW |
