---
name: devops-docker-gen
description: "Dockerfile and docker-compose.yml generator. Use when the user says 'dockerize', 'create Dockerfile', 'generate docker-compose', 'containerize my app', 'add Docker support', or 'optimize Dockerfile'. Analyzes project and generates optimized container configs."
argument-hint: "[dockerfile|compose|both]"
---

# Dockerfile & Docker Compose Generator

You are an expert in container optimization. Generate production-ready Docker configurations.

## Phase 1: Project Analysis

Scan the project to understand its structure:

1. **Detect language & framework**:
   - Check `package.json` -> Node.js (Express, Next.js, Fastify, NestJS...)
   - Check `requirements.txt` / `pyproject.toml` -> Python (Django, FastAPI, Flask...)
   - Check `go.mod` -> Go
   - Check `Cargo.toml` -> Rust
   - Check `Gemfile` -> Ruby (Rails, Sinatra...)
   - Check `pom.xml` / `build.gradle` -> Java (Spring Boot...)
   - Check `.csproj` / `.sln` -> C# (.NET, ASP.NET Core, Blazor...)
   - Check `composer.json` -> PHP (Laravel, Symfony, WordPress...)
   - Check `mix.exs` -> Elixir (Phoenix, LiveView...)

2. **Detect existing Docker config**:
   - `Dockerfile` - analyze for improvements
   - `docker-compose.yml` / `docker-compose.yaml` / `compose.yml`
   - `.dockerignore`

3. **Detect services needed**:
   - Database connections in config/env (PostgreSQL, MySQL, MongoDB, Redis)
   - Message queues (RabbitMQ, Kafka)
   - Search engines (Elasticsearch)
   - Cache layers (Redis, Memcached)

## Phase 2: Ask the User

Parse `$ARGUMENTS`: `dockerfile`, `compose`, or `both` (default: `both`).

Ask the user:
1. **What mode?** Development, production, or both?
2. **What services?** Confirm detected services, ask about additional needs
3. **Existing Dockerfile?** If found, ask: optimize it or start fresh?

## Phase 3: Generate Dockerfile

Follow these best practices for EVERY Dockerfile:

### Multi-stage Build Pattern
```
Stage 1: deps    - Install dependencies only (cached layer)
Stage 2: build   - Build/compile the application
Stage 3: runtime - Minimal production image
```

### Security Checklist
- Use specific image tags (NOT `latest`)
- Run as non-root user
- Don't copy unnecessary files (use .dockerignore)
- No secrets in image layers
- Use `COPY` not `ADD` (unless extracting archives)
- Set `HEALTHCHECK` instruction

### Optimization Checklist
- Order layers from least to most frequently changing
- Combine `RUN` commands to reduce layers
- Use `--mount=type=cache` for package manager caches
- Clean up in the same layer (apt-get clean, rm -rf /var/lib/apt/lists/*)
- Use alpine or distroless for production where possible

### Multi-Platform Builds (ARM64 + AMD64)

For Apple Silicon (M1/M2/M3/M4) users deploying to Linux servers:

```bash
# Create and use buildx builder
docker buildx create --name multiarch --use

# Build for both platforms
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:latest .

# Build + push to registry in one step
docker buildx build --platform linux/amd64,linux/arm64 -t registry/myapp:v1.0 --push .
```

In CI (GitHub Actions):
```yaml
- uses: docker/build-push-action@v6
  with:
    platforms: linux/amd64,linux/arm64
    push: true
    tags: registry/myapp:${{ github.sha }}
```

Tips:
- Use `CGO_ENABLED=0` for Go to avoid cross-compilation issues
- Rust: add both `x86_64-unknown-linux-musl` and `aarch64-unknown-linux-musl` targets
- Node.js/Python: alpine images support both architectures natively

### Language-Specific Patterns

Reference [dockerfile-patterns.md](references/dockerfile-patterns.md) for detailed patterns per language.

## Phase 4: Generate docker-compose.yml

### Structure
```yaml
services:
  app:          # Main application
  db:           # Database (if needed)
  cache:        # Cache layer (if needed)
  ...           # Additional services

volumes:        # Named volumes for persistence
networks:       # Custom networks for isolation
```

### Best Practices
- Use `depends_on` with `condition: service_healthy`
- Define health checks for every service
- Use named volumes (never bind mounts for data in production)
- Set resource limits (`deploy.resources.limits`)
- Use `.env` file for configuration, never hardcode
- Separate networks for frontend/backend isolation
- Use `restart: unless-stopped` for production
- Pin image versions for all services
- Use `init: true` for proper signal handling (PID 1 problem):
  ```yaml
  # Proper signal handling (PID 1 problem)
  # Without init, your app runs as PID 1 and won't handle SIGTERM properly,
  # causing 10s forced shutdown delays and zombie child processes.
  services:
    app:
      init: true  # Adds tini as PID 1 — forwards signals, reaps zombies
  ```
- Configure logging on every service to prevent unbounded log growth:
  ```yaml
  # Add to every service for production
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
  ```

Reference [compose-patterns.md](references/compose-patterns.md) for service-specific configs.

## Phase 5: Generate .dockerignore

Always create/update `.dockerignore` based on detected project type:

**Node.js:**
```
node_modules/
npm-debug.log*
.next/
dist/
build/
coverage/
```

**Python:**
```
__pycache__/
*.pyc
.venv/
*.egg-info/
dist/
.pytest_cache/
```

**Go:**
```
vendor/
*.test
bin/
```

**Common (always include):**
```
.git/
.env*
*.log
.DS_Store
.idea/
.vscode/
docker-compose*.yml
Dockerfile*
README.md
```

## Phase 6: Development vs Production

If the user wants both dev and prod configs:

**Development (`docker-compose.yml`):**
- Bind mount source code for hot reload
- Expose debug ports
- Use `build: .` instead of image reference
- Set `NODE_ENV=development` or equivalent
- Include dev tools (pgadmin, redis-commander, mailhog)
- No resource limits needed

**Production (`docker-compose.prod.yml`):**
- Use pre-built images from registry
- No source mounts
- Resource limits set
- Restart policies
- No dev tools
- Log drivers configured
- Use `docker compose -f docker-compose.yml -f docker-compose.prod.yml up`

## Phase 7: Validate & Test

1. **Syntax validation**: `docker compose config` to validate compose file
2. **Dockerfile lint** - check for these common issues:
   - `apt-get update` without `apt-get install` in same RUN
   - `COPY . .` before dependency install (breaks cache)
   - Missing `--no-cache` or `--no-install-recommends`
   - Using `latest` tag
   - Missing `EXPOSE` instruction
3. **Build test**: Offer to run `docker compose build --no-cache`
4. **Startup test**: `docker compose up -d` then check health:
   - `docker compose ps` - all services should be "healthy" or "running"
   - `docker compose logs --tail=20` - check for startup errors
5. **Size check**: `docker images` - show image size, suggest optimization if >500MB

### Common Build Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `COPY failed: file not found` | Wrong context or path | Check `.dockerignore`, verify file exists |
| `Could not resolve host` | Network issue in build | Check DNS, add `--network=host` if behind proxy |
| `permission denied` | Non-root user can't write | `chown` directories before switching USER |
| `no space left on device` | Docker disk full | `docker system prune -a` |
| `OCI runtime error` | Architecture mismatch | Use `--platform linux/amd64` or multi-arch build |

## Output Format

When presenting generated files:
- Show the complete file content with inline comments
- Show a summary table:
  ```
  Generated Files
  ──────────────────────────────────
  Dockerfile          (multi-stage, 3 stages, ~150MB final)
  docker-compose.yml  (app + postgres + redis)
  .dockerignore       (24 rules)
  ──────────────────────────────────
  Next: docker compose up -d
  ```
- Highlight security decisions (non-root, no secrets, pinned versions)
- Highlight optimization decisions (multi-stage, cache mounts, layer order)
- Provide useful follow-up commands:
  - `docker compose logs -f` - follow logs
  - `docker compose exec app sh` - shell into container
  - `docker compose down -v` - stop and remove volumes
