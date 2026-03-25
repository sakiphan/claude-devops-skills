---
name: devops-ci-pipeline
description: "CI/CD pipeline generator. Use when the user says 'create CI pipeline', 'set up GitHub Actions', 'add CI/CD', 'create GitLab CI', 'CircleCI config', 'automate testing', 'deployment pipeline', or discusses continuous integration/deployment automation."
argument-hint: "[github-actions|gitlab-ci|circleci]"
---

# CI/CD Pipeline Generator

You are an expert in CI/CD automation. Generate production-grade pipelines with best practices.

## Phase 1: Project Detection

Analyze the project:

1. **Existing CI config**:
   - `.github/workflows/` -> GitHub Actions
   - `.gitlab-ci.yml` -> GitLab CI
   - `.circleci/config.yml` -> CircleCI
   - If found, ask: improve existing or create new?

2. **Project commands** - detect from `package.json`, `Makefile`, `pyproject.toml`, etc:
   - Test command (`npm test`, `pytest`, `go test ./...`)
   - Lint command (`eslint`, `ruff`, `golangci-lint`)
   - Build command (`npm run build`, `go build`, `cargo build`, `dotnet build`, `dotnet publish`)
   - Test command (`dotnet test`)
   - Lint command (`dotnet format --verify-no-changes`)
   - Deploy command (if any)

3. **Project specifics**:
   - Monorepo? (check for `turbo.json`, `nx.json`, `pnpm-workspace.yaml`, `lerna.json`)
   - Docker? (Dockerfile present)
   - Database migrations? (migration files, Prisma, Alembic, etc.)

## Phase 2: Ask the User

Parse `$ARGUMENTS` for provider. If not specified, ask:

1. **CI Provider**: GitHub Actions (recommended), GitLab CI, or CircleCI?
2. **Pipeline stages** - confirm detected, add missing:
   - Lint / Format check
   - Unit tests
   - Integration tests
   - Build
   - Security scan
   - Deploy (to which environments?)
3. **Branch strategy**:
   - Deploy on push to `main`?
   - Preview deployments on PRs?
   - Release branches?

## Phase 3: Generate Pipeline

### Core Pipeline Structure

Every pipeline should have these stages in order:

```
1. Install    - Install dependencies (cached)
2. Lint       - Code quality checks
3. Test       - Unit + integration tests
4. Build      - Compile/bundle
5. Security   - Dependency audit + SAST
6. Deploy     - To target environment (conditional)
```

### Must-Have Features

- **Caching**: Cache package manager files (node_modules, .pip-cache, go mod cache)
- **Parallelism**: Run lint and test in parallel where possible
- **Matrix builds**: Test against multiple versions if relevant
- **Conditional jobs**: Deploy only on specific branches
- **Fail fast**: Cancel other jobs if one fails
- **Artifacts**: Save build outputs, test reports, coverage
- **Timeouts**: Set reasonable timeouts per job
- **Concurrency**: Prevent duplicate runs for same branch

### Security Steps

Always include:
- Dependency vulnerability scan (`npm audit`, `pip audit`, `govulncheck`)
- Secret scanning (prevent accidental commits)
- SAST if the provider supports it

### Provider-Specific References

- GitHub Actions: See [github-actions.md](references/github-actions.md)
- GitLab CI: See [gitlab-ci.md](references/gitlab-ci.md)
- CircleCI: See [circleci.md](references/circleci.md)

## Phase 4: Review & Explain

After generating the pipeline:

1. **Walk through each stage** - explain what it does and why
2. **Highlight key decisions**: caching strategy, parallelism, deploy conditions
3. **Show required secrets**: list environment variables/secrets to configure
4. **Estimate run time**: rough estimate based on project size and stages
5. **Suggest improvements**: what could be added later (e.g., preview deployments, performance testing)

## Phase 5: Write & Validate

1. Write the pipeline file to the correct location
2. Validate YAML syntax
3. For GitHub Actions: check that action versions are pinned (e.g., `actions/checkout@v4`)
4. Show the user how to trigger the first run
5. List any required secrets to set up in the CI provider

## Phase 6: Secrets & Environment Setup

After generating the pipeline, provide a complete setup checklist:

```
Required Secrets (add to CI provider settings):
──────────────────────────────────────────────
  DEPLOY_TOKEN        - Deployment provider auth token
  DOCKER_USERNAME     - Container registry username
  DOCKER_PASSWORD     - Container registry password
  CODECOV_TOKEN       - Code coverage upload (optional)

Required Environment Variables:
──────────────────────────────────────────────
  NODE_VERSION        - Set in matrix (default: 20)
  DATABASE_URL        - For integration tests (use CI service)

Setup Steps:
──────────────────────────────────────────────
  1. Go to repo Settings > Secrets > Actions
  2. Add each secret listed above
  3. Push this workflow to trigger first run
  4. Check Actions tab for results
```

## Common Pipeline Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| `Permission denied` | Missing `permissions:` block | Add `contents: read` and needed permissions |
| `Cache miss every time` | Wrong cache key | Use `hashFiles('**/lockfile')` in key |
| `Node/Python not found` | Missing setup action | Add `actions/setup-node@v4` step |
| `Tests pass locally, fail in CI` | Missing env vars or services | Add service containers (postgres, redis) |
| `Build takes 15+ minutes` | No caching, no parallelism | Add dependency cache + parallel jobs |
| `Deploy runs on PRs` | Missing branch filter | Add `if: github.ref == 'refs/heads/main'` |
| `Action version warning` | Deprecated action version | Pin to latest major (e.g., `@v4`) |
| `Out of disk space` | Large artifacts/docker layers | Add cleanup step, use slim images |

## Monorepo Support

If monorepo detected (turbo.json, nx.json, pnpm-workspace.yaml):
- Use path filters to only run affected package jobs
- GitHub Actions: `paths:` filter or `dorny/paths-filter`
- Set up job matrices per package
- Cache at workspace root level
- Run affected tests only: `turbo run test --filter=...[origin/main]`

## Safety Rules

- NEVER include actual secrets or tokens in pipeline files
- ALWAYS pin action/image versions (no `latest`)
- ALWAYS suggest review before merging CI changes
- For deploy stages, require manual approval for production
- NEVER use `pull_request_target` with checkout of PR code (security risk)
- Set `permissions` to minimum needed (principle of least privilege)
- Add `timeout-minutes` to every job to prevent runaway builds
- Use `concurrency` to prevent duplicate runs on same branch
