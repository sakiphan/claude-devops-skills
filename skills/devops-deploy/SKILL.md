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

Before deploying, note the current deployment state so rollback is possible. Identify the rollback strategy per provider and tell the user the exact commands.

Tell the user: "If something goes wrong, here's how to rollback: [command]"

---

#### Rollback: Vercel

**Estimated rollback time:** ~10 seconds (instant alias swap)

1. **List previous deployments:**
   ```bash
   vercel list --limit 10
   # Or for a specific project:
   vercel list <project-name> --limit 10
   ```

2. **Rollback command:**
   ```bash
   # Instant rollback to the previous production deployment
   vercel rollback

   # Rollback to a specific deployment by URL or ID
   vercel rollback <deployment-url-or-id>
   ```

3. **Verify rollback succeeded:**
   ```bash
   # Check which deployment is currently active
   vercel inspect <project-name> --scope <team>

   # Health check the production URL
   curl -s -o /dev/null -w "%{http_code}" https://<project>.vercel.app
   ```

---

#### Rollback: AWS ECS

**Estimated rollback time:** 2-5 minutes (new tasks must pass health checks)

1. **List previous task definition revisions:**
   ```bash
   # List all revisions for the task definition family
   aws ecs list-task-definitions --family-prefix <task-family> --sort DESC --max-items 10

   # Describe the current running service to note the active revision
   aws ecs describe-services --cluster <cluster> --services <service> \
     --query "services[0].taskDefinition"
   ```

2. **Rollback command:**
   ```bash
   # Option A: Roll back to a specific task definition revision
   aws ecs update-service \
     --cluster <cluster> \
     --service <service> \
     --task-definition <task-family>:<previous-revision-number> \
     --force-new-deployment

   # Option B: Force redeployment of the current task definition
   aws ecs update-service \
     --cluster <cluster> \
     --service <service> \
     --force-new-deployment
   ```

3. **Verify rollback succeeded:**
   ```bash
   # Watch the deployment until stable (blocks until complete)
   aws ecs wait services-stable --cluster <cluster> --services <service>

   # Confirm the active task definition revision
   aws ecs describe-services --cluster <cluster> --services <service> \
     --query "services[0].{taskDef:taskDefinition, status:status, running:runningCount, desired:desiredCount}"

   # Check that old tasks have drained
   aws ecs list-tasks --cluster <cluster> --service-name <service> --desired-status RUNNING
   ```

---

#### Rollback: AWS Lambda

**Estimated rollback time:** ~5-15 seconds (alias pointer swap)

1. **List previous versions:**
   ```bash
   # List published versions of the function
   aws lambda list-versions-by-function --function-name <function-name> \
     --query "Versions[-5:].[Version, Description, LastModified]" --output table

   # List aliases to see which version is currently live
   aws lambda list-aliases --function-name <function-name>
   ```

2. **Rollback command:**
   ```bash
   # Option A: Point the alias back to a previous version
   aws lambda update-alias \
     --function-name <function-name> \
     --name <alias-name> \
     --function-version <previous-version-number>

   # Option B: Redeploy the previous version's code to $LATEST
   #   First, get the code location of the previous version:
   aws lambda get-function --function-name <function-name> --qualifier <previous-version>
   #   Then update with the previous deployment package:
   aws lambda update-function-code \
     --function-name <function-name> \
     --s3-bucket <bucket> --s3-key <previous-package-key>
   ```

3. **Verify rollback succeeded:**
   ```bash
   # Confirm the alias now points to the correct version
   aws lambda get-alias --function-name <function-name> --name <alias-name>

   # Invoke a quick smoke test
   aws lambda invoke \
     --function-name <function-name> \
     --qualifier <alias-name> \
     --payload '{}' /tmp/lambda-response.json && cat /tmp/lambda-response.json
   ```

---

#### Rollback: GCP Cloud Run

**Estimated rollback time:** ~10-30 seconds (traffic shift to existing revision)

1. **List previous revisions:**
   ```bash
   # List all revisions for the service
   gcloud run revisions list --service <service-name> --region <region> --limit 10

   # Show current traffic allocation
   gcloud run services describe <service-name> --region <region> \
     --format="value(status.traffic)"
   ```

2. **Rollback command:**
   ```bash
   # Route 100% of traffic to a previous revision
   gcloud run services update-traffic <service-name> \
     --region <region> \
     --to-revisions=<previous-revision-name>=100
   ```

3. **Verify rollback succeeded:**
   ```bash
   # Confirm traffic is routed to the correct revision
   gcloud run services describe <service-name> --region <region> \
     --format="value(status.traffic)"

   # Health check the service URL
   SERVICE_URL=$(gcloud run services describe <service-name> --region <region> --format="value(status.url)")
   curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL"
   ```

---

#### Rollback: Fly.io

**Estimated rollback time:** 30-90 seconds (new machines with previous image)

1. **List previous releases:**
   ```bash
   # Show release history with versions and image refs
   fly releases --app <app-name>

   # Show current status
   fly status --app <app-name>
   ```

2. **Rollback command:**
   ```bash
   # Option A: Deploy the image from a previous release
   fly deploy --image <previous-image-ref> --app <app-name>

   # Option B: Rollback to the immediately previous release (if supported)
   fly releases rollback --app <app-name>
   ```

3. **Verify rollback succeeded:**
   ```bash
   # Check release list - newest entry should reference the old image
   fly releases --app <app-name>

   # Confirm instances are healthy
   fly status --app <app-name>

   # Health check
   fly ping <app-name>.fly.dev
   curl -s -o /dev/null -w "%{http_code}" https://<app-name>.fly.dev
   ```

---

#### Rollback: Railway

**Estimated rollback time:** ~30-60 seconds (redeploy from previous snapshot)

1. **List previous deployments:**
   ```bash
   # List recent deployments with status and timestamps
   railway status

   # View deployment history via the CLI
   railway logs --deployment <deployment-id>
   ```

2. **Rollback command:**
   ```bash
   # Rollback to the previous successful deployment
   railway rollback

   # Or rollback to a specific deployment ID
   railway rollback <deployment-id>
   ```

3. **Verify rollback succeeded:**
   ```bash
   # Confirm current active deployment
   railway status

   # Check the live URL responds correctly
   curl -s -o /dev/null -w "%{http_code}" <railway-deployment-url>
   ```

---

#### Rollback Quick Reference

| Provider       | Rollback Command                                              | Time     |
|----------------|---------------------------------------------------------------|----------|
| Vercel         | `vercel rollback`                                             | ~10s     |
| AWS ECS        | `aws ecs update-service --task-definition <prev> --force-new-deployment` | 2-5 min |
| AWS Lambda     | `aws lambda update-alias --function-version <prev>`           | ~5-15s   |
| GCP Cloud Run  | `gcloud run services update-traffic --to-revisions=<prev>=100`| ~10-30s  |
| Fly.io         | `fly deploy --image <previous-image>`                         | 30-90s   |
| Railway        | `railway rollback`                                            | ~30-60s  |

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
