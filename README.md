# claude-skills-devops

> 10 interactive DevOps skills for [Claude Code](https://claude.ai/code) — not just docs, actual workflows that analyze, ask, execute, and verify.

[![npm version](https://img.shields.io/npm/v/claude-skills-devops.svg)](https://www.npmjs.com/package/claude-skills-devops)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## What is this?

Claude Code skills are intelligent prompts that turn Claude into a specialized DevOps engineer. Instead of generic answers, each skill:

1. **Scans your project** — detects languages, frameworks, existing configs
2. **Asks targeted questions** — environment, provider, preferences
3. **Generates real files** — Dockerfiles, CI pipelines, K8s manifests, Terraform configs
4. **Validates the output** — lints, tests, verifies before you ship

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

## 10 Skills

### Deploy & Ship

| Skill | What it does | Example |
|-------|-------------|---------|
| [`/devops-deploy`](#devops-deploy) | Interactive deployment with pre-checks | `/devops-deploy prod aws` |
| [`/devops-docker-gen`](#devops-docker-gen) | Generate Dockerfile + docker-compose | `/devops-docker-gen both` |
| [`/devops-ci-pipeline`](#devops-ci-pipeline) | Create CI/CD pipelines | `/devops-ci-pipeline github-actions` |

### Secure & Audit

| Skill | What it does | Example |
|-------|-------------|---------|
| [`/devops-infra-audit`](#devops-infra-audit) | Security scan all infra configs | `/devops-infra-audit all` |
| [`/devops-env-sync`](#devops-env-sync) | Manage .env files across environments | `/devops-env-sync compare` |

### Provision & Orchestrate

| Skill | What it does | Example |
|-------|-------------|---------|
| [`/devops-k8s`](#devops-k8s) | K8s manifests, debug pods, Helm charts | `/devops-k8s debug` |
| [`/devops-terraform`](#devops-terraform) | Generate Terraform for AWS/GCP | `/devops-terraform aws` |
| [`/devops-monitor`](#devops-monitor) | Set up Prometheus + Grafana | `/devops-monitor` |

### Analyze & Migrate

| Skill | What it does | Example |
|-------|-------------|---------|
| [`/devops-log-analyzer`](#devops-log-analyzer) | Find errors, patterns in logs | `/devops-log-analyzer` |
| [`/devops-db-migrate`](#devops-db-migrate) | Safe database migrations | `/devops-db-migrate status` |

---

## Skill Details

### `/devops-deploy`

Interactive deployment workflow with safety checks.

```
/devops-deploy staging vercel    # deploy to staging on Vercel
/devops-deploy prod aws          # deploy to production on AWS
/devops-deploy                   # interactive — asks questions
```

**What happens:**
- Detects project type (Node.js, Python, Go, Rust, Java, C#/.NET, Ruby)
- Runs pre-deploy checks: tests, lint, build, git status, secret scan
- Deploys to your provider with rollback instructions
- Post-deploy health check and summary

**Providers:** Vercel, AWS (ECS/Lambda/S3), GCP (Cloud Run/App Engine), Fly.io, Railway

---

### `/devops-docker-gen`

Generates optimized, production-ready Docker configurations.

```
/devops-docker-gen dockerfile    # only Dockerfile
/devops-docker-gen compose       # only docker-compose.yml
/devops-docker-gen both          # Dockerfile + compose + .dockerignore
```

**What it generates:**
- Multi-stage Dockerfile (deps → build → runtime, ~150MB instead of ~1GB)
- docker-compose.yml with health checks, resource limits, named networks
- .dockerignore with language-specific rules
- Non-root user, pinned versions, cache-optimized layers

**Languages:** Node.js, Python, Go, Rust, Java/Spring, C#/ASP.NET Core

---

### `/devops-ci-pipeline`

Creates CI/CD pipelines with all the best practices you'd forget.

```
/devops-ci-pipeline github-actions
/devops-ci-pipeline gitlab-ci
/devops-ci-pipeline circleci
```

**What's included:**
- Dependency caching, matrix builds, parallel jobs
- Security scanning (dependency audit, SAST)
- Conditional deploy (preview on PR, production on main)
- Monorepo support (Turborepo, Nx, pnpm workspaces)

---

### `/devops-infra-audit`

Read-only security audit with severity-rated findings.

```
/devops-infra-audit all          # scan everything
/devops-infra-audit docker       # only Docker files
/devops-infra-audit ci           # only CI/CD pipelines
/devops-infra-audit k8s          # only Kubernetes
```

**40+ checks across:**
- Docker: root user, latest tag, no healthcheck, secrets in layers
- Compose: privileged mode, docker.sock mount, no resource limits
- CI/CD: unpinned actions, secret exposure, fork PR risks
- K8s: no security context, no probes, no network policies
- Env: committed .env files, hardcoded credentials
- Terraform: state in git, overly permissive IAM

**Output:** Scored report (A-F) with fix suggestions and effort estimates.

---

### `/devops-k8s`

Three modes: generate, debug, or scaffold Helm.

```
/devops-k8s generate deployment  # create K8s manifests
/devops-k8s debug                # diagnose failing pods
/devops-k8s helm my-app          # scaffold Helm chart
```

**Generate:** Deployment, Service, Ingress, ConfigMap, HPA, PDB — all with security contexts, probes, resource limits, topology constraints.

**Debug:** Diagnoses CrashLoopBackOff, ImagePullBackOff, Pending, OOMKilled. Runs kubectl commands, reads logs, suggests fixes.

**Helm:** Full chart scaffold with values per environment, helpers, NOTES.txt.

---

### `/devops-env-sync`

Never lose track of environment variables again.

```
/devops-env-sync compare         # matrix of all .env files
/devops-env-sync generate        # create .env.example
/devops-env-sync validate        # check missing/empty vars
/devops-env-sync diff .env.staging .env.production
```

**Features:** Comparison matrix, smart placeholder generation, secret masking, framework-aware (Next.js `NEXT_PUBLIC_*`, Vite `VITE_*` warnings).

---

### `/devops-monitor`

Set up monitoring from scratch.

```
/devops-monitor                  # interactive — detects your stack
/devops-monitor prometheus       # Prometheus + Grafana setup
```

**What it sets up:**
- Prometheus config with scrape targets and alert rules
- Grafana dashboards (request rate, error rate, latency, CPU, memory)
- Application instrumentation (Node.js, Python, Go, C#/.NET)
- Docker Compose services for the monitoring stack

---

### `/devops-terraform`

Generate cloud infrastructure as code.

```
/devops-terraform aws            # AWS resources
/devops-terraform gcp            # GCP resources
/devops-terraform                # interactive — asks what to provision
```

**Generates:** `main.tf`, `variables.tf`, `outputs.tf`, `backend.tf`, `terraform.tfvars.example`

**Patterns:** VPC with subnets, ECS/Cloud Run, RDS/Cloud SQL, S3/GCS, remote state with locking.

---

### `/devops-log-analyzer`

Find what went wrong, fast.

```
/devops-log-analyzer             # interactive — finds log sources
/devops-log-analyzer errors      # focus on errors
```

**Sources:** Application logs, Docker, Kubernetes, CloudWatch, CI/CD logs.

**Analysis:** Error frequency, timeline reconstruction, pattern detection, request correlation.

---

### `/devops-db-migrate`

Safe database migrations with guardrails.

```
/devops-db-migrate               # interactive — detects your tool
/devops-db-migrate status        # check pending migrations
```

**Supports:** Prisma, Alembic, Knex, TypeORM, Drizzle, Django, Flyway, Entity Framework Core.

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
    SKILL.md              ← Main skill (Claude reads this)
    references/
      vercel.md           ← Provider-specific commands
      aws.md              ← (Claude reads on-demand)
      ...
```

Each skill is a structured workflow in `SKILL.md` with supporting reference files. When you type `/devops-deploy prod vercel`, Claude:

1. Reads `SKILL.md` — gets the full deployment workflow
2. Scans your project — finds `package.json`, detects Next.js
3. Reads `references/vercel.md` — gets Vercel-specific commands
4. Executes — runs checks, deploys, verifies health

Reference files keep each skill focused while supporting 5+ providers/tools per skill.

## Language Support

| Language | docker-gen | ci-pipeline | deploy | monitor | db-migrate |
|----------|-----------|-------------|--------|---------|------------|
| Node.js | Multi-stage | npm cache | All providers | prom-client | Prisma, Knex, TypeORM, Drizzle |
| Python | venv + slim | pip cache | All providers | prometheus_client | Alembic, Django |
| Go | distroless | go mod cache | All providers | client_golang | Flyway |
| Rust | cargo-chef | cargo cache | All providers | - | - |
| Java | gradle/maven | gradle/maven cache | All providers | - | Flyway |
| C#/.NET | sdk + aspnet | dotnet cache | All providers | prometheus-net | Entity Framework Core |
| Ruby | - | - | All providers | - | - |

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
