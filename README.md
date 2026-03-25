<p align="center">
  <img src="https://img.shields.io/npm/v/claude-skills-devops.svg?style=for-the-badge&color=CB3837&logo=npm&logoColor=white" alt="npm version" />
  <img src="https://img.shields.io/npm/dm/claude-skills-devops.svg?style=for-the-badge&color=blue&logo=npm&logoColor=white" alt="downloads" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="license" />
  <img src="https://img.shields.io/badge/Claude_Code-Skills-blueviolet?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==&logoColor=white" alt="Claude Code" />
</p>

<h1 align="center">claude-skills-devops</h1>

<p align="center">
  <strong>10 interactive DevOps skills for Claude Code</strong><br/>
  Not just docs — actual workflows that analyze, ask, execute, and verify.
</p>

---

## What is this?

Claude Code skills are intelligent prompts that turn Claude into a **specialized DevOps engineer**. Instead of generic answers, each skill follows a structured workflow:

```
 Scan Project ──> Ask Questions ──> Generate Files ──> Validate Output
```

```
You: /devops-docker-gen both
Claude: Analyzing project... Node.js + Express detected.
        PostgreSQL and Redis found in dependencies.
        Generating multi-stage Dockerfile, docker-compose.yml, .dockerignore...
        [creates 3 production-ready files]
```

## Quick Start

```bash
npm install -g claude-skills-devops
```

That's it. Skills auto-install to `~/.claude/skills/`. Open Claude Code and start using them.

---

## 10 Skills at a Glance

### Deploy & Ship

| Skill | What it does | Example |
|:------|:------------|:--------|
| `/devops-deploy` | Interactive deployment with pre-checks & rollback | `/devops-deploy prod aws` |
| `/devops-docker-gen` | Dockerfile + docker-compose + multi-platform build | `/devops-docker-gen both` |
| `/devops-ci-pipeline` | CI/CD pipelines with caching & security | `/devops-ci-pipeline github-actions` |

### Secure & Audit

| Skill | What it does | Example |
|:------|:------------|:--------|
| `/devops-infra-audit` | 50+ security checks with fix examples | `/devops-infra-audit all` |
| `/devops-env-sync` | Manage, compare, analyze .env files | `/devops-env-sync analyze` |

### Provision & Orchestrate

| Skill | What it does | Example |
|:------|:------------|:--------|
| `/devops-k8s` | K8s manifests, debug pods, Helm, GitOps | `/devops-k8s gitops` |
| `/devops-terraform` | Terraform with module patterns for AWS/GCP | `/devops-terraform aws` |
| `/devops-monitor` | Prometheus, OTel, Datadog + SLO alerting | `/devops-monitor` |

### Analyze & Migrate

| Skill | What it does | Example |
|:------|:------------|:--------|
| `/devops-log-analyzer` | Error patterns, trace correlation | `/devops-log-analyzer` |
| `/devops-db-migrate` | Safe migrations for 10 tools | `/devops-db-migrate status` |

---

## Skill Details

### `/devops-deploy`

> Interactive deployment workflow with safety checks and **per-provider rollback procedures**.

```
/devops-deploy staging vercel    # deploy to staging on Vercel
/devops-deploy prod aws          # deploy to production on AWS
/devops-deploy                   # interactive mode
```

**What happens:**
- Detects project type (Node.js, Python, Go, Rust, Java, C#/.NET, Ruby, PHP, Elixir)
- Runs pre-deploy checks: tests, lint, build, git status, secret scan
- Deploys with provider-specific commands
- Post-deploy health check + instant rollback if needed

**Providers:** Vercel, AWS (ECS/Lambda/S3), GCP (Cloud Run/App Engine), Fly.io, Railway

**New in v1.2:** Detailed rollback procedures per provider with verification steps and estimated rollback times.

---

### `/devops-docker-gen`

> Generates optimized, production-ready Docker configurations with **multi-platform support**.

```
/devops-docker-gen dockerfile    # only Dockerfile
/devops-docker-gen compose       # only docker-compose.yml
/devops-docker-gen both          # Dockerfile + compose + .dockerignore
```

**What it generates:**
- Multi-stage Dockerfile (deps -> build -> runtime, ~150MB instead of ~1GB)
- docker-compose.yml with health checks, resource limits, logging, init
- .dockerignore with language-specific rules
- Non-root user, HEALTHCHECK, pinned versions, cache-optimized layers

**New in v1.2:** Multi-platform builds (ARM64 + AMD64), Kafka/MinIO/worker compose patterns, logging config.

**Languages:** Node.js, Python, Go, Rust, Java/Spring, C#/.NET, PHP, Elixir, Ruby

---

### `/devops-ci-pipeline`

> Creates CI/CD pipelines with all the best practices you'd forget.

```
/devops-ci-pipeline github-actions
/devops-ci-pipeline gitlab-ci
/devops-ci-pipeline bitbucket-pipelines
```

**What's included:**
- Dependency caching, matrix builds, parallel jobs
- Security scanning (dependency audit, SAST)
- Conditional deploy (preview on PR, production on main)
- Monorepo support (Turborepo, Nx, pnpm workspaces)
- Safe database migrations in CI with dry-run gates

**Providers:** GitHub Actions, GitLab CI, CircleCI, Bitbucket Pipelines

**New in v1.2:** Database migration safety gates in CI (Prisma, Alembic, Django, Flyway).

---

### `/devops-infra-audit`

> Read-only security audit with severity-rated findings and **before/after fix examples**.

```
/devops-infra-audit all          # scan everything
/devops-infra-audit docker       # only Docker files
/devops-infra-audit ci           # only CI/CD pipelines
/devops-infra-audit k8s          # only Kubernetes
```

**50+ checks across 7 categories:**

| Category | Example Checks |
|:---------|:---------------|
| Docker | root user, latest tag, no healthcheck, secrets in layers |
| Compose | privileged mode, docker.sock mount, no resource limits |
| CI/CD | unpinned actions, secret exposure, fork PR risks |
| K8s | no security context, no probes, no network policies |
| Env | committed .env files, hardcoded credentials |
| Terraform | state in git, overly permissive IAM |
| Supply Chain | no image scanning, no SBOM, unsigned images |

**Output:** Scored report (A-F) with fix suggestions, effort estimates, and before/after code examples.

**New in v1.2:** Supply chain security checks (Trivy, SBOM, Cosign) + remediation examples for every check.

---

### `/devops-k8s`

> Four modes: generate, debug, helm, or **GitOps with ArgoCD**.

```
/devops-k8s generate deployment  # create K8s manifests
/devops-k8s debug                # diagnose failing pods
/devops-k8s helm my-app          # scaffold Helm chart
/devops-k8s gitops               # ArgoCD + Kustomize setup
```

**Generate:** Deployment, Service, Ingress, ConfigMap, HPA, PDB, **NetworkPolicy** — all with security contexts, probes, resource limits.

**Debug:** Diagnoses CrashLoopBackOff, ImagePullBackOff, Pending, OOMKilled with kubectl commands and fixes.

**Helm:** Full chart scaffold with values per environment, helpers, NOTES.txt.

**GitOps:** ArgoCD Application + Kustomize overlays (dev/staging/prod).

**New in v1.2:** NetworkPolicy generation, PodDisruptionBudget, framework-specific readiness probes.

---

### `/devops-env-sync`

> Never lose track of environment variables again. Now with **dependency mapping**.

```
/devops-env-sync compare         # matrix of all .env files
/devops-env-sync generate        # create .env.example
/devops-env-sync validate        # check missing/empty vars
/devops-env-sync analyze         # find where each var is used
/devops-env-sync diff .env.staging .env.production
```

**Features:** Comparison matrix, smart placeholder generation, secret masking, framework-aware warnings (Next.js `NEXT_PUBLIC_*`, Vite `VITE_*`).

**New in v1.2:** `analyze` mode scans codebase across 9 languages to map which env vars are used where, find unused vars, and detect missing definitions.

---

### `/devops-monitor`

> Set up monitoring from scratch with **SLO-based alerting**.

```
/devops-monitor                  # interactive — detects your stack
/devops-monitor prometheus       # Prometheus + Grafana setup
/devops-monitor datadog          # Datadog APM + metrics
```

**What it sets up:**
- Prometheus + Grafana (scrape configs, dashboards, alert rules)
- OpenTelemetry (collector, auto-instrumentation, OTLP exporters)
- Datadog (agent, APM, custom metrics, log collection)
- SLO/SLI framework with burn rate alerting
- RED method dashboards (Rate, Errors, Duration)

**New in v1.2:** SLO/SLI framework, burn rate alerting, error budget dashboards, RED method quick reference.

---

### `/devops-terraform`

> Generate cloud infrastructure as code with **reusable module patterns**.

```
/devops-terraform aws            # AWS resources
/devops-terraform gcp            # GCP resources
/devops-terraform                # interactive mode
```

**Generates:** `main.tf`, `variables.tf`, `outputs.tf`, `backend.tf`, `terraform.tfvars.example`

**Patterns:** VPC with subnets, ECS/Cloud Run, RDS/Cloud SQL, S3/GCS, remote state with locking.

**New in v1.2:** Reusable module directory structure, version pinning, workspaces vs separate directories guide.

---

### `/devops-log-analyzer`

> Find what went wrong, fast. Now with **distributed trace correlation**.

```
/devops-log-analyzer             # interactive — finds log sources
/devops-log-analyzer errors      # focus on errors
```

**Sources:** Application logs, Docker, Kubernetes, CloudWatch, CI/CD logs.

**Analysis:** Error frequency, timeline reconstruction, pattern detection, cross-service trace correlation.

**New in v1.2:** Distributed trace ID correlation across microservices with visual request flow reconstruction.

---

### `/devops-db-migrate`

> Safe database migrations with guardrails.

```
/devops-db-migrate               # interactive — detects your tool
/devops-db-migrate status        # check pending migrations
```

**Supports:** Prisma, Alembic, Knex, TypeORM, Drizzle, Django, Flyway, Entity Framework Core, Laravel, Ecto.

**Safety:** Warns on destructive ops (DROP TABLE), suggests backups before prod, zero-downtime strategies (expand-contract pattern).

---

## CLI

```bash
claude-skills-devops list        # show installed skills
claude-skills-devops doctor      # verify all skills healthy
claude-skills-devops install     # reinstall after update
claude-skills-devops uninstall   # clean removal
```

## How It Works

```
~/.claude/skills/
  devops-deploy/
    SKILL.md              <- Main skill (Claude reads this)
    references/
      vercel.md           <- Provider-specific commands
      aws.md              <- (Claude reads on-demand)
      ...
```

Each skill is a structured workflow in `SKILL.md` with supporting reference files. When you type `/devops-deploy prod vercel`, Claude:

1. **Reads** `SKILL.md` — gets the full deployment workflow
2. **Scans** your project — finds `package.json`, detects Next.js
3. **Reads** `references/vercel.md` — gets Vercel-specific commands
4. **Executes** — runs checks, deploys, verifies health

Reference files keep each skill focused while supporting 5+ providers/tools per skill.

## Language Support

| Language | docker-gen | ci-pipeline | deploy | monitor | db-migrate |
|:---------|:----------|:------------|:-------|:--------|:-----------|
| **Node.js** | Multi-stage | npm cache | All providers | prom-client, OTel, Datadog | Prisma, Knex, TypeORM, Drizzle |
| **Python** | venv + slim | pip cache | All providers | prometheus_client, OTel, Datadog | Alembic, Django |
| **Go** | distroless | go mod cache | All providers | client_golang, OTel, Datadog | Flyway |
| **Rust** | cargo-chef | cargo cache | All providers | - | - |
| **Java** | gradle/maven | gradle/maven cache | All providers | - | Flyway |
| **C#/.NET** | sdk + aspnet | dotnet cache | All providers | prometheus-net, OTel, Datadog | Entity Framework Core |
| **PHP** | fpm-alpine | composer cache | All providers | - | Laravel Migrations |
| **Elixir** | release build | mix cache | All providers | - | Ecto |
| **Ruby** | slim + bundler | bundle cache | All providers | - | - |

## What's New in v1.2

- **Audit:** Before/after remediation examples for every check + supply chain security (Trivy, SBOM, Cosign)
- **Deploy:** Per-provider rollback procedures with verification steps
- **Docker:** Multi-platform builds (ARM64/AMD64), Kafka/MinIO/worker patterns, logging config
- **K8s:** NetworkPolicy + PDB generation, framework-specific readiness probes
- **Monitor:** SLO/SLI framework, burn rate alerting, RED method dashboards
- **CI:** Database migration safety gates in CI pipelines
- **Terraform:** Reusable module patterns, workspace vs directory guide
- **Log Analyzer:** Distributed trace correlation across microservices
- **Env Sync:** `analyze` mode — scan codebase to map env var usage across 9 languages
- **AWS Ref:** IAM roles, Lambda layers, CloudWatch alarms, Secrets Manager
- **Encryption:** Tool comparison matrix (git-crypt vs SOPS vs 1Password vs Doppler)

## Uninstall

```bash
npm uninstall -g claude-skills-devops
```

Cleanly removes all skills. Restores any pre-existing skills that were backed up.

## Requirements

- Node.js >= 18
- [Claude Code](https://claude.ai/code)

## Contributing

PRs welcome. Each skill lives in `skills/<name>/SKILL.md` with optional `references/` dir.

## License

MIT
