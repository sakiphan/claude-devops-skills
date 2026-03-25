# Dockerfile Security Checks

## Root User Detection

Check for absence of USER instruction (container runs as root by default):

```bash
grep -c '^USER ' Dockerfile
# 0 means no USER set — runs as root
```

Flag if USER is set to root explicitly:

```bash
grep -iE '^USER\s+(root|0)' Dockerfile
```

### Fix (D001)

**BAD:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "server.js"]
```

**GOOD:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && \
    addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["node", "server.js"]
```

Create a non-root user and switch to it before CMD; the container no longer runs with root privileges.

## Secret Detection

Scan for hardcoded secrets in ENV and ARG:

```bash
grep -iE '^(ENV|ARG)\s+.*(PASSWORD|SECRET|KEY|TOKEN|API_KEY|PRIVATE|CREDENTIAL)' Dockerfile
```

Check for secrets passed via build args (leaked in image history):

```bash
grep -iE '^ARG\s+.*(PASSWORD|SECRET|TOKEN)' Dockerfile
# ARG values are visible in `docker history`
```

### Fix (D002)

**BAD:**
```dockerfile
FROM node:20-alpine
ENV DATABASE_PASSWORD=supersecret123
ARG API_TOKEN=sk-live-abc123
RUN ./setup.sh
```

**GOOD:**
```dockerfile
FROM node:20-alpine
# Pass secrets at runtime, never bake them into the image
RUN --mount=type=secret,id=db_pass cat /run/secrets/db_pass > /dev/null
CMD ["node", "server.js"]
# Build: docker build --secret id=db_pass,src=./db_pass.txt .
# Run:   docker run -e DATABASE_PASSWORD="$(cat db_pass.txt)" myapp
```

Use Docker BuildKit secret mounts for build-time secrets and runtime environment variables or secret managers for run-time secrets; never embed credentials in ENV or ARG.

## Base Image Tag Pinning

Detect `:latest` tag or missing tag (defaults to latest):

```bash
grep -E '^FROM\s+\S+(:latest)?\s' Dockerfile
grep -E '^FROM\s+[^:@]+\s' Dockerfile  # no tag or digest at all
```

Best practice — pin by digest:

```dockerfile
FROM node:20-alpine@sha256:abc123...
```

### Fix (D003)

**BAD:**
```dockerfile
FROM node:latest
FROM python
```

**GOOD:**
```dockerfile
FROM node:20-alpine@sha256:1a2b3c4d5e6f...
FROM python:3.12-slim@sha256:7a8b9c0d1e2f...
```

Pin base images to a specific version tag and ideally a digest to ensure reproducible, deterministic builds.

## ADD vs COPY

Flag ADD with remote URLs (use curl/wget + COPY instead):

```bash
grep -E '^ADD\s+https?://' Dockerfile
```

ADD auto-extracts tarballs which can be unexpected. Prefer COPY unless extraction is intended.

### Fix (D004)

**BAD:**
```dockerfile
ADD https://example.com/app.tar.gz /opt/app/
ADD config.json /etc/app/
```

**GOOD:**
```dockerfile
RUN curl -fsSL https://example.com/app.tar.gz -o /tmp/app.tar.gz && \
    tar -xzf /tmp/app.tar.gz -C /opt/app/ && \
    rm /tmp/app.tar.gz
COPY config.json /etc/app/
```

Use COPY for local files and explicit curl/wget for remote files; ADD with URLs bypasses checksum verification and obscures intent.

## HEALTHCHECK

Verify HEALTHCHECK is defined:

```bash
grep -c '^HEALTHCHECK' Dockerfile
# 0 means no health check
```

### Fix (D005)

**BAD:**
```dockerfile
FROM node:20-alpine
COPY . .
CMD ["node", "server.js"]
# No HEALTHCHECK — orchestrator cannot detect unhealthy containers
```

**GOOD:**
```dockerfile
FROM node:20-alpine
COPY . .
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
CMD ["node", "server.js"]
```

Add a HEALTHCHECK so Docker and orchestrators can detect and restart unhealthy containers automatically.

## Multi-Stage Build Detection

```bash
grep -c '^FROM ' Dockerfile
# >1 indicates multi-stage build (good for smaller images)
```

### Fix (D006)

**BAD:**
```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install && npm run build
CMD ["node", "dist/server.js"]
# Final image includes devDependencies, source code, and build tools
```

**GOOD:**
```dockerfile
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/server.js"]
```

Use multi-stage builds to separate build dependencies from the runtime image, drastically reducing image size and attack surface.

## Package Cache Cleanup

Unclean caches bloat image layers. Check per distro:

**Debian/Ubuntu (apt):**

```bash
grep -E 'apt-get install' Dockerfile | grep -v 'rm -rf /var/lib/apt/lists'
# Each RUN with apt-get install should clean up in the same layer
```

Expected pattern:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends pkg \
    && rm -rf /var/lib/apt/lists/*
```

**Alpine (apk):**

```bash
grep -E 'apk add' Dockerfile | grep -v '\-\-no-cache'
```

Expected: `apk add --no-cache`

### Fix (D007)

**BAD (Debian/Ubuntu):**
```dockerfile
RUN apt-get update
RUN apt-get install -y curl git
# Cache left in image; separate layers prevent cleanup
```

**GOOD (Debian/Ubuntu):**
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/*
```

**BAD (Alpine):**
```dockerfile
RUN apk add curl git
```

**GOOD (Alpine):**
```dockerfile
RUN apk add --no-cache curl git
```

Always clean package manager caches in the same RUN layer as the install to prevent cache bloat in the final image.

**RHEL/CentOS (yum/dnf):**

```bash
grep -E '(yum|dnf) install' Dockerfile | grep -v '(yum|dnf) clean all'
```

## COPY Scope

Flag copying entire build context:

```bash
grep -E '^COPY\s+\.\s' Dockerfile
# COPY . . — may include .env, .git, secrets
```

Ensure `.dockerignore` exists alongside the Dockerfile.

### Fix (D008)

**BAD:**
```dockerfile
COPY . .
# No .dockerignore — sends .git, .env, node_modules, secrets to build context
```

**GOOD:**
```dockerfile
COPY . .
```
With a `.dockerignore` file:
```
.git
.env
.env.*
node_modules
*.secret
*.pem
.github
tests
README.md
```

Create a `.dockerignore` file to exclude sensitive files, large directories, and build artifacts from the Docker build context.

## Shell Form vs Exec Form

Flag shell form ENTRYPOINT/CMD (does not receive signals properly):

```bash
grep -E '^(ENTRYPOINT|CMD)\s+[^[]' Dockerfile
# Shell form — prefer exec form: CMD ["node", "app.js"]
```

### Fix (D009 — Shell Form)

**BAD:**
```dockerfile
ENTRYPOINT node server.js
CMD npm start
# Shell form wraps in /bin/sh -c, PID 1 is sh, signals not forwarded
```

**GOOD:**
```dockerfile
ENTRYPOINT ["node", "server.js"]
CMD ["npm", "start"]
# Exec form: process is PID 1, receives SIGTERM for graceful shutdown
```

Use exec form (JSON array) for ENTRYPOINT and CMD so the process receives OS signals directly and can shut down gracefully.

## Severity Guide

| Check | Severity |
|---|---|
| Running as root | HIGH |
| Hardcoded secrets | CRITICAL |
| Unpinned base image | MEDIUM |
| ADD with URL | LOW |
| No HEALTHCHECK | LOW |
| No cache cleanup | LOW |
| COPY . (no .dockerignore) | MEDIUM |
