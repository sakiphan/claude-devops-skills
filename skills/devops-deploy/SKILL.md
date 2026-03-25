---
name: devops-deploy
description: "Interactive deployment workflow. Use when the user says 'deploy', 'ship to prod', 'deploy to staging', 'push to vercel/aws/fly.io/railway/gcp', or discusses deployment. Detects project type, runs pre-deploy checks, and executes deployment."
argument-hint: "[environment] [provider]"
---

# Interactive Deployment Workflow

You are an expert DevOps engineer. Guide the user through a safe, structured deployment process.

## Phase 1: Project Discovery

First, analyze the project to understand what we're deploying:

1. **Detect project type** by checking for:
   - `package.json` (Node.js) - check `scripts` for build/start commands
   - `requirements.txt` / `pyproject.toml` / `Pipfile` (Python)
   - `go.mod` (Go)
   - `Cargo.toml` (Rust)
   - `Gemfile` (Ruby)
   - `pom.xml` / `build.gradle` (Java)
   - `.csproj` / `.sln` / `global.json` (C# / .NET)
   - `composer.json` (PHP - Laravel, Symfony...)
   - `mix.exs` (Elixir - Phoenix...)

2. **Detect existing deployment config**:
   - `vercel.json` or `.vercel/` -> Vercel
   - `fly.toml` -> Fly.io
   - `railway.json` or `railway.toml` -> Railway
   - `app.yaml` or `cloudbuild.yaml` -> GCP
   - `appspec.yml` or `buildspec.yml` or `samconfig.toml` -> AWS
   - `Dockerfile` -> Container-based deployment
   - `Procfile` -> Heroku-style

3. **Check git status**: uncommitted changes, current branch, remote tracking

## Phase 2: Ask the User

Parse `$ARGUMENTS` first. If environment and provider are already specified, skip to Phase 3.

Otherwise, ask the user:

1. **Environment**: Which environment are you deploying to?
   - `dev` / `development`
   - `staging` / `preview`
   - `prod` / `production`

2. **Provider**: Based on detected config or ask:
   - Vercel (frontend, Next.js, static sites)
   - AWS (ECS, Lambda, S3, Elastic Beanstalk)
   - GCP (Cloud Run, App Engine, Cloud Functions)
   - Fly.io (full-stack apps, Docker-based)
   - Railway (simple full-stack deployment)

3. **Confirmation for production**: If deploying to `prod`, ALWAYS ask for explicit confirmation and show what will be deployed (branch, last commit, changes summary).

## Phase 3: Pre-Deploy Checklist

Run these checks and report results before deploying:

```
[ ] Git working tree is clean (no uncommitted changes)
[ ] On correct branch for target environment
[ ] Tests pass (run test command from package.json/Makefile/etc)
[ ] Lint passes (if configured)
[ ] Build succeeds (run build command)
[ ] Environment variables are set for target env
[ ] No secrets in codebase (quick grep for common patterns)
[ ] Dependencies are up to date (no security vulnerabilities)
[ ] Database migrations are applied (if applicable)
```

### Check Execution Strategy

Run checks in this order (fail fast):
1. Git status first (cheapest check)
2. Secret scan (grep for patterns: `PASSWORD=`, `API_KEY=`, `SECRET=`, `TOKEN=`, private keys)
3. Dependency audit (`npm audit`, `pip audit`, `govulncheck`)
4. Lint (catches syntax issues before expensive build)
5. Tests (unit first, integration if fast)
6. Build (most expensive, run last)

### Error Recovery

If any check fails:
- Show the failure clearly with the exact error output
- Ask if the user wants to fix it or skip (except secrets - never skip)
- For test/lint failures, offer to fix them automatically
- If build fails, check common causes:
  - Missing env vars needed at build time
  - TypeScript errors
  - Missing dependencies (run install first)
  - Outdated lock file (suggest regenerating)

### Rollback Plan

Before deploying, identify the rollback strategy:
- **Vercel**: `vercel rollback` to previous deployment
- **AWS ECS**: note current task definition revision for rollback
- **Fly.io**: `fly releases` to identify previous release
- **Railway**: automatic rollback via dashboard
- **GCP Cloud Run**: `gcloud run services update-traffic --to-revisions=PREVIOUS`

Tell the user: "If something goes wrong, here's how to rollback: [command]"

## Phase 4: Execute Deployment

Based on the chosen provider, read the appropriate reference file for detailed commands:
- Vercel: See [vercel.md](references/vercel.md)
- AWS: See [aws.md](references/aws.md)
- GCP: See [gcp.md](references/gcp.md)
- Fly.io: See [fly-io.md](references/fly-io.md)
- Railway: See [railway.md](references/railway.md)

Execute the deployment commands step by step, showing output to the user.

### Handling Deployment Failures

If deployment command fails:
1. **Auth error**: Check if CLI is logged in, token is valid
2. **Build error on provider**: Check build logs, compare with local build
3. **Timeout**: Check if the app starts within expected time, health check endpoint works
4. **Resource limit**: Check plan limits (Vercel hobby, Fly.io free tier, etc.)
5. **Region error**: Verify target region is available for the service

Show the raw error output and diagnose the root cause before suggesting fixes.

## Phase 5: Post-Deploy Verification

After deployment:
1. **Get the deployment URL** and display prominently
2. **Health check sequence**:
   - Wait 5-10 seconds for cold start
   - `curl -s -o /dev/null -w "%{http_code}" <URL>` - expect 200
   - If health endpoint exists (`/health`, `/api/health`, `/healthz`), check that too
   - If non-200, wait 15 more seconds and retry (cold start can be slow)
3. **Smoke test** (if applicable):
   - Check main page loads
   - Check API responds (if API project)
   - Verify static assets load (check for 404s)
4. **Show deployment summary**:
   ```
   Deployment Summary
   ──────────────────────────
   URL:         https://my-app.vercel.app
   Environment: production
   Branch:      main (abc1234)
   Provider:    Vercel
   Status:      ✅ Healthy (200 OK)
   Rollback:    vercel rollback
   ──────────────────────────
   ```
5. **Post-deploy reminders**:
   - "Monitor logs for the next 10 minutes"
   - "Check error tracking (Sentry, etc.) for new issues"
   - "Verify critical user flows if this is a production deploy"
   - If database migration was involved: "Verify data integrity"

## Safety Rules

- **NEVER** deploy to production without explicit user confirmation
- **NEVER** skip the uncommitted changes check for production
- **ALWAYS** show what will be deployed before executing (branch, commit, diff summary)
- **ALWAYS** provide rollback instructions before deploying to production
- If `$ARGUMENTS` contains `prod` or `production`, be extra cautious
- If unsure about anything, ask the user rather than assuming
- If the project has no tests, WARN the user but don't block deployment
- If deploying a branch other than main/master to prod, WARN explicitly
- Check if there's a CI pipeline that should have run first - warn if skipping CI
