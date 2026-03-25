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

## ADD vs COPY

Flag ADD with remote URLs (use curl/wget + COPY instead):

```bash
grep -E '^ADD\s+https?://' Dockerfile
```

ADD auto-extracts tarballs which can be unexpected. Prefer COPY unless extraction is intended.

## HEALTHCHECK

Verify HEALTHCHECK is defined:

```bash
grep -c '^HEALTHCHECK' Dockerfile
# 0 means no health check
```

## Multi-Stage Build Detection

```bash
grep -c '^FROM ' Dockerfile
# >1 indicates multi-stage build (good for smaller images)
```

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

## Shell Form vs Exec Form

Flag shell form ENTRYPOINT/CMD (does not receive signals properly):

```bash
grep -E '^(ENTRYPOINT|CMD)\s+[^[]' Dockerfile
# Shell form — prefer exec form: CMD ["node", "app.js"]
```

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
