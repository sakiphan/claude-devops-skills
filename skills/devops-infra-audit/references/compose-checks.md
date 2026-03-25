# Docker Compose Security Checks

## Privileged Mode

```bash
grep -n 'privileged:\s*true' docker-compose.yml
```

Full host access. Almost never needed. Severity: **CRITICAL**

### Fix (C001)

**BAD:**
```yaml
services:
  app:
    image: myapp:latest
    privileged: true
```

**GOOD:**
```yaml
services:
  app:
    image: myapp:latest
    cap_add:
      - NET_ADMIN    # Only add specific capabilities you actually need
    security_opt:
      - no-new-privileges:true
```

Remove `privileged: true` and instead grant only the specific Linux capabilities required using `cap_add`.

## Host Network Mode

```bash
grep -n 'network_mode:\s*["'\'']?host' docker-compose.yml
```

Bypasses Docker network isolation. Severity: **HIGH**

### Fix (C002)

**BAD:**
```yaml
services:
  app:
    image: myapp:latest
    network_mode: host
```

**GOOD:**
```yaml
services:
  app:
    image: myapp:latest
    networks:
      - app-net
    ports:
      - "127.0.0.1:8080:8080"

networks:
  app-net:
    driver: bridge
```

Use Docker bridge networks with explicit port mapping instead of host networking to preserve container network isolation.

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

### Fix (C003)

**BAD:**
```yaml
services:
  app:
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /etc:/host-etc
      - /:/host-root
```

**GOOD:**
```yaml
services:
  app:
    volumes:
      - app-data:/app/data          # Named volume for persistence
      - ./config:/app/config:ro     # Bind mount with read-only flag
    read_only: true
    tmpfs:
      - /tmp

volumes:
  app-data:
```

Use named volumes or scoped bind mounts with `:ro` where possible; never mount the Docker socket, root filesystem, or system directories.

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

### Fix (C004)

**BAD:**
```yaml
services:
  app:
    image: myapp:latest
    # No resource limits — container can consume all host CPU/RAM
```

**GOOD:**
```yaml
services:
  app:
    image: myapp:latest
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
```

Set both resource limits and reservations to prevent a single container from starving the host and to ensure predictable scheduling.

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

### Fix (C005)

**BAD:**
```yaml
services:
  api:
    image: myapi:1.0
    # No healthcheck — Docker has no way to know if the service is healthy
```

**GOOD:**
```yaml
services:
  api:
    image: myapi:1.0
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Add health checks so Docker can monitor service health and restart unhealthy containers when combined with a restart policy.

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

### Fix (C006)

**BAD:**
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: my-super-secret-password
      API_KEY: sk-live-abc123
```

**GOOD:**
```yaml
services:
  db:
    image: postgres:16
    env_file:
      - .env                          # Must be in .gitignore
    secrets:
      - db_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt   # Not committed to git
```

Use Docker secrets or external `.env` files (gitignored) instead of inline secret values that get committed to version control.

## Image Tag Pinning

Flag services using `:latest` or no tag:

```bash
grep -nE 'image:\s*\S+(:latest)?\s*$' docker-compose.yml | grep -v '@sha256'
grep -nE 'image:\s*[^:@]+\s*$' docker-compose.yml
```

### Fix (C007)

**BAD:**
```yaml
services:
  app:
    image: nginx:latest
  api:
    image: redis
```

**GOOD:**
```yaml
services:
  app:
    image: nginx:1.25-alpine@sha256:a1b2c3d4...
  api:
    image: redis:7.2-alpine@sha256:e5f6a7b8...
```

Pin images to specific version tags (ideally with digest) to ensure reproducible deployments and avoid unexpected breaking changes.

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

### Fix (Read-Only Root)

**BAD:**
```yaml
services:
  app:
    image: myapp:1.0
    # Writable root filesystem — attacker can modify binaries
```

**GOOD:**
```yaml
services:
  app:
    image: myapp:1.0
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
```

Enable `read_only: true` for stateless services and use `tmpfs` mounts for directories that need write access.

## Restart Policy

```bash
grep -n 'restart:' docker-compose.yml
```

Acceptable values: `unless-stopped`, `on-failure`, `always`. Missing restart policy means containers stay down after crash.

### Fix (C008)

**BAD:**
```yaml
services:
  app:
    image: myapp:1.0
    # No restart policy — container stays down after crash
```

**GOOD:**
```yaml
services:
  app:
    image: myapp:1.0
    restart: unless-stopped
```

Add a restart policy so crashed containers are automatically restarted; use `unless-stopped` for most services or `on-failure` for jobs.

## Exposed Ports

Flag ports bound to all interfaces:

```bash
grep -nE '^\s*-\s*"?\d+:\d+"?\s*$' docker-compose.yml
# "8080:80" binds to 0.0.0.0 — prefer "127.0.0.1:8080:80"
```

### Fix (C009 — Exposed Ports)

**BAD:**
```yaml
services:
  app:
    ports:
      - "8080:80"           # Binds to 0.0.0.0, accessible from any network
```

**GOOD:**
```yaml
services:
  app:
    ports:
      - "127.0.0.1:8080:80" # Binds to loopback only, not externally reachable
    networks:
      - app-net

networks:
  app-net:
    driver: bridge
```

Bind ports to `127.0.0.1` instead of all interfaces and use named networks instead of the default bridge for better isolation.

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
