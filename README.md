<p align="center">
  <br/>
  <img width="160" src="https://cdn.simpleicons.org/docker/2496ED" alt="DevOps" />
  <br/>
</p>

<h1 align="center">claude-skills-devops</h1>

<p align="center">
  <strong>11 interactive DevOps skills for <a href="https://claude.ai/code">Claude Code</a></strong><br/>
  Not just docs — actual workflows that analyze, ask, execute, and verify.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/claude-skills-devops"><img src="https://img.shields.io/npm/v/claude-skills-devops.svg?style=flat-square&color=CB3837&logo=npm&logoColor=white" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/claude-skills-devops"><img src="https://img.shields.io/npm/dm/claude-skills-devops.svg?style=flat-square&color=blue&logo=npm&logoColor=white" alt="downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="license" /></a>
  <a href="https://github.com/sakiphan/claude-skills-devops"><img src="https://img.shields.io/github/stars/sakiphan/claude-skills-devops?style=flat-square&logo=github" alt="stars" /></a>
</p>

<p align="center">
  <code>npm install -g claude-skills-devops</code>
</p>

---

## Why?

Most DevOps tasks follow the same pattern: scan the project, make decisions, generate configs, validate. But you repeat this from scratch every time.

These skills encode **senior DevOps knowledge** into reusable workflows. Type a slash command, answer a few questions, get production-ready output.

```
You: /devops-docker-gen both

Claude: Analyzing project... Node.js + Express detected.
        PostgreSQL and Redis found in dependencies.
        Generating multi-stage Dockerfile, docker-compose.yml, .dockerignore...

        Generated Files
        ──────────────────────────────────
        Dockerfile          (multi-stage, 3 stages, ~150MB final)
        docker-compose.yml  (app + postgres + redis)
        .dockerignore       (24 rules)
        ──────────────────────────────────
        Next: docker compose up -d
```

## How It Works

```
                    You type: /devops-deploy prod aws
                                    |
                    +---------------+---------------+
                    |                               |
              1. Read SKILL.md              2. Scan your project
              (deployment workflow)          (detect Node.js, Next.js)
                    |                               |
                    +---------------+---------------+
                                    |
                          3. Read references/aws.md
                          (AWS-specific commands)
                                    |
                          4. Execute workflow
                          (checks -> deploy -> verify)
```

Each skill lives in `~/.claude/skills/` with a `SKILL.md` and optional `references/` directory.

---

## 11 Skills

### Deploy & Ship

| | Skill | What it does |
|:--|:------|:------------|
| :rocket: | **`/devops-deploy`** | Deploy to Vercel, AWS, GCP, Fly.io, Railway with pre-checks & rollback |
| :whale: | **`/devops-docker-gen`** | Generate Dockerfile + docker-compose for 9 languages. Multi-platform builds |
| :arrows_counterclockwise: | **`/devops-ci-pipeline`** | CI/CD for GitHub Actions, GitLab CI, CircleCI, Bitbucket. With DB migration gates |

### Secure & Audit

| | Skill | What it does |
|:--|:------|:------------|
| :shield: | **`/devops-infra-audit`** | 50+ security checks with before/after fix examples. Supply chain scanning |
| :closed_lock_with_key: | **`/devops-secrets`** | Secret management with SOPS, Vault, AWS SM. Audit, rotate, migrate |
| :gear: | **`/devops-env-sync`** | Compare, validate, analyze .env files across environments and 9 languages |

### Provision & Orchestrate

| | Skill | What it does |
|:--|:------|:------------|
| :ship: | **`/devops-k8s`** | Generate manifests, debug pods, Helm charts, GitOps with ArgoCD |
| :cloud: | **`/devops-terraform`** | Infrastructure as Code for AWS/GCP with reusable module patterns |
| :bar_chart: | **`/devops-monitor`** | Prometheus, OTel, Datadog setup. SLO alerting + RED method dashboards |

### Analyze & Migrate

| | Skill | What it does |
|:--|:------|:------------|
| :mag: | **`/devops-log-analyzer`** | Error patterns, timeline reconstruction, distributed trace correlation |
| :floppy_disk: | **`/devops-db-migrate`** | Safe migrations for Prisma, Alembic, TypeORM + 7 more. Zero-downtime strategies |

---

<details>
<summary><h2>Skill Details (click to expand)</h2></summary>

### `/devops-deploy`

```
/devops-deploy staging vercel    # deploy to staging on Vercel
/devops-deploy prod aws          # deploy to production on AWS
/devops-deploy                   # interactive mode
```

- Detects project type (Node.js, Python, Go, Rust, Java, C#/.NET, Ruby, PHP, Elixir)
- Pre-deploy checks: tests, lint, build, git status, secret scan
- Per-provider rollback procedures with verification steps
- Post-deploy health check

**Providers:** Vercel, AWS (ECS/Lambda/S3), GCP (Cloud Run/App Engine), Fly.io, Railway

---

### `/devops-docker-gen`

```
/devops-docker-gen dockerfile    # only Dockerfile
/devops-docker-gen compose       # only docker-compose.yml
/devops-docker-gen both          # everything
```

- Multi-stage Dockerfile (~150MB vs ~1GB)
- docker-compose with health checks, resource limits, logging, init
- Multi-platform builds (ARM64 + AMD64)
- Kafka, MinIO, worker compose patterns

**Languages:** Node.js, Python, Go, Rust, Java, C#/.NET, PHP, Elixir, Ruby

---

### `/devops-ci-pipeline`

```
/devops-ci-pipeline github-actions
/devops-ci-pipeline gitlab-ci
/devops-ci-pipeline bitbucket-pipelines
```

- Dependency caching, matrix builds, parallel jobs
- Security scanning, conditional deploy
- Monorepo support (Turborepo, Nx, pnpm workspaces)
- Database migration safety gates in CI

---

### `/devops-infra-audit`

```
/devops-infra-audit all          # scan everything
/devops-infra-audit docker       # only Docker
/devops-infra-audit k8s          # only Kubernetes
```

50+ checks across: Docker, Compose, CI/CD, K8s, Env, Terraform, Supply Chain

Output: Scored report (A-F) with before/after fix code examples

---

### `/devops-secrets`

```
/devops-secrets setup            # set up from scratch
/devops-secrets audit            # scan for secret hygiene issues
/devops-secrets rotate           # plan & execute rotation
/devops-secrets migrate          # migrate between providers
```

Supports: SOPS + age, AWS Secrets Manager, HashiCorp Vault, External Secrets Operator, Sealed Secrets, Doppler

---

### `/devops-k8s`

```
/devops-k8s generate deployment  # create manifests
/devops-k8s debug                # diagnose failing pods
/devops-k8s helm my-app          # Helm chart scaffold
/devops-k8s gitops               # ArgoCD + Kustomize
```

Generates: Deployment, Service, Ingress, ConfigMap, HPA, PDB, NetworkPolicy

---

### `/devops-env-sync`

```
/devops-env-sync compare         # matrix of all .env files
/devops-env-sync analyze         # find where each var is used
/devops-env-sync validate        # check missing/empty vars
```

Scans 9 languages for env var usage. Framework-aware (Next.js, Vite, Django, Rails).

---

### `/devops-monitor`

```
/devops-monitor prometheus       # Prometheus + Grafana
/devops-monitor datadog          # Datadog APM
/devops-monitor                  # interactive
```

SLO/SLI framework, burn rate alerting, RED method dashboards, OTel auto-instrumentation.

---

### `/devops-terraform`

```
/devops-terraform aws            # AWS resources
/devops-terraform gcp            # GCP resources
```

Generates: `main.tf`, `variables.tf`, `outputs.tf`, `backend.tf` with reusable module patterns.

---

### `/devops-log-analyzer`

```
/devops-log-analyzer             # interactive
/devops-log-analyzer errors      # focus on errors
```

Error frequency, timeline reconstruction, distributed trace correlation across microservices.

---

### `/devops-db-migrate`

```
/devops-db-migrate               # detects your tool
/devops-db-migrate status        # check pending
```

Supports: Prisma, Alembic, Knex, TypeORM, Drizzle, Django, Flyway, EF Core, Laravel, Ecto

</details>

---

## Language Support

| Language | Docker | CI | Deploy | Monitor | Migrations |
|:---------|:------:|:--:|:------:|:-------:|:----------:|
| **Node.js** | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| **Python** | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| **Go** | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| **Rust** | :white_check_mark: | :white_check_mark: | :white_check_mark: | - | - |
| **Java** | :white_check_mark: | :white_check_mark: | :white_check_mark: | - | :white_check_mark: |
| **C#/.NET** | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| **PHP** | :white_check_mark: | :white_check_mark: | :white_check_mark: | - | :white_check_mark: |
| **Elixir** | :white_check_mark: | :white_check_mark: | :white_check_mark: | - | :white_check_mark: |
| **Ruby** | :white_check_mark: | :white_check_mark: | :white_check_mark: | - | - |

## By the Numbers

| | |
|:--|:--|
| **11** | Interactive skills |
| **52** | Files in package |
| **50+** | Security checks (infra-audit) |
| **9** | Languages supported |
| **6** | Cloud providers |
| **10** | Migration tools |
| **7** | Secret managers |

## CLI

```bash
claude-skills-devops list        # show installed skills
claude-skills-devops doctor      # verify all skills healthy
claude-skills-devops install     # reinstall after update
claude-skills-devops uninstall   # clean removal
```

## Changelog

### v1.3.0
- New `/devops-secrets` skill (SOPS, Vault, AWS SM, External Secrets Operator)

### v1.2.0
- Audit: before/after remediation examples + supply chain security
- Deploy: per-provider rollback procedures
- Docker: multi-platform builds, Kafka/MinIO/worker patterns
- K8s: NetworkPolicy + PDB + readiness probes
- Monitor: SLO/SLI framework + burn rate alerting
- CI: database migration safety gates
- Terraform: reusable module patterns
- Log Analyzer: distributed trace correlation
- Env Sync: `analyze` mode (9 languages)

### v1.1.0
- OpenTelemetry + Datadog monitoring
- PHP + Elixir language support
- ArgoCD + Kustomize + Bitbucket Pipelines

### v1.0.0
- Initial release with 10 skills

## Uninstall

```bash
npm uninstall -g claude-skills-devops
```

## Requirements

- Node.js >= 18
- [Claude Code](https://claude.ai/code)

## Contributing

PRs welcome. Each skill lives in `skills/<name>/SKILL.md` with optional `references/` dir.

## License

MIT
