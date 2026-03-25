---
name: devops-infra-audit
description: "Infrastructure security audit. Use when the user says 'audit infrastructure', 'check security', 'scan Dockerfile', 'review docker-compose', 'audit CI pipeline', 'check for secrets', 'security review', or 'infra review'. Scans all infra configs for security issues and misconfigurations."
argument-hint: "[docker|ci|k8s|env|all]"
---

# Infrastructure Security Audit

You are a security-focused infrastructure auditor. Perform a thorough, non-destructive audit.

**IMPORTANT**: This is a READ-ONLY audit. Do NOT modify any files. Report findings only.

## Phase 1: Discovery

Find all infrastructure files in the project:

```
Dockerfile*           docker-compose*.yml    compose*.yml
.github/workflows/    .gitlab-ci.yml         .circleci/
k8s/                  kubernetes/             helm/
*.yaml (k8s)          *.yml (k8s)
.env*                 *.env                   secrets*
terraform/            *.tf                    pulumi/
nginx*.conf           Caddyfile
```

Report what was found before starting the audit.

## Phase 2: Scope Selection

Parse `$ARGUMENTS`: `docker`, `ci`, `k8s`, `env`, or `all` (default: `all`).

If `all`, audit everything found. Otherwise, focus on the specified area.

## Phase 3: Audit Checks

### Docker Audit
Reference: [dockerfile-checks.md](references/dockerfile-checks.md)

| ID | Severity | Check |
|----|----------|-------|
| D001 | CRITICAL | Running as root (no USER instruction) |
| D002 | CRITICAL | Secrets in build args or ENV |
| D003 | HIGH | Using `latest` tag for base image |
| D004 | HIGH | Using `ADD` instead of `COPY` (remote URLs) |
| D005 | HIGH | No HEALTHCHECK defined |
| D006 | MEDIUM | Not using multi-stage build |
| D007 | MEDIUM | Package cache not cleaned in same layer |
| D008 | MEDIUM | No .dockerignore file |
| D009 | LOW | Missing LABEL metadata |

### Docker Compose Audit
Reference: [compose-checks.md](references/compose-checks.md)

| ID | Severity | Check |
|----|----------|-------|
| C001 | CRITICAL | Privileged mode enabled |
| C002 | CRITICAL | Host network mode without justification |
| C003 | CRITICAL | Sensitive dirs mounted (/, /etc, /var/run/docker.sock) |
| C004 | HIGH | No resource limits defined |
| C005 | HIGH | No health checks defined |
| C006 | HIGH | Secrets in environment values (not using secrets:) |
| C007 | MEDIUM | Using `latest` tag |
| C008 | MEDIUM | No restart policy |
| C009 | LOW | No named networks (using default) |

### CI/CD Audit
Reference: [ci-checks.md](references/ci-checks.md)

| ID | Severity | Check |
|----|----------|-------|
| CI001 | CRITICAL | Secrets printed or logged |
| CI002 | CRITICAL | Third-party actions not pinned to SHA |
| CI003 | HIGH | write permissions on GITHUB_TOKEN without need |
| CI004 | HIGH | No dependency vulnerability scanning |
| CI005 | HIGH | Pull request from fork can access secrets |
| CI006 | MEDIUM | No timeout set on jobs |
| CI007 | MEDIUM | No concurrency controls |
| CI008 | LOW | No caching configured |

### Kubernetes Audit
Reference: [k8s-checks.md](references/k8s-checks.md)

| ID | Severity | Check |
|----|----------|-------|
| K001 | CRITICAL | Running as root / privileged |
| K002 | CRITICAL | Secrets in plain text (not using Secret resource) |
| K003 | HIGH | No resource limits/requests |
| K004 | HIGH | No liveness/readiness probes |
| K005 | HIGH | Using `latest` tag |
| K006 | HIGH | No network policies |
| K007 | MEDIUM | No pod disruption budget |
| K008 | MEDIUM | No security context |
| K009 | LOW | Missing labels (app, version, team) |

### Environment Files Audit

| ID | Severity | Check |
|----|----------|-------|
| E001 | CRITICAL | .env files committed to git (check .gitignore) |
| E002 | CRITICAL | Real API keys/tokens/passwords in any file |
| E003 | HIGH | No .env.example provided |
| E004 | HIGH | Database URLs with embedded credentials |
| E005 | MEDIUM | Default/weak passwords in config |

### Terraform / IaC Audit

| ID | Severity | Check |
|----|----------|-------|
| T001 | CRITICAL | Credentials hardcoded in .tf files |
| T002 | CRITICAL | State file committed to git |
| T003 | HIGH | No remote state backend configured |
| T004 | HIGH | No state locking (DynamoDB/GCS) |
| T005 | HIGH | Overly permissive IAM policies (`*` actions/resources) |
| T006 | MEDIUM | No resource tagging |
| T007 | MEDIUM | Using default VPC/security groups |
| T008 | LOW | No provider version constraints |

### Dependency Audit

| ID | Severity | Check |
|----|----------|-------|
| DEP001 | CRITICAL | Known critical CVEs in dependencies |
| DEP002 | HIGH | Outdated packages with security patches available |
| DEP003 | MEDIUM | No lock file (package-lock.json, yarn.lock, etc.) |
| DEP004 | LOW | Unused dependencies |

Run `npm audit`, `pip audit`, `govulncheck`, or `cargo audit` if applicable.

### Supply Chain Security

| ID | Severity | Check |
|----|----------|-------|
| SC001 | CRITICAL | No container image scanning (Trivy/Grype) in CI |
| SC002 | HIGH | No SBOM generation (syft/cyclonedx) |
| SC003 | HIGH | Images not signed (Cosign/Notation) |
| SC004 | HIGH | Base images from untrusted registries |
| SC005 | MEDIUM | No image digest pinning (using tags only) |
| SC006 | MEDIUM | No vulnerability threshold in CI (allow all severities) |

Detection commands:

```bash
# Check for Trivy/Grype in CI configs
grep -rnE '(trivy|grype|anchore|snyk container)' .github/workflows/ .gitlab-ci.yml .circleci/ 2>/dev/null

# Check for SBOM generation steps
grep -rnE '(syft|cyclonedx|spdx|sbom)' .github/workflows/ .gitlab-ci.yml .circleci/ 2>/dev/null

# Check for cosign verify in deployment
grep -rnE '(cosign sign|cosign verify|notation sign|notation verify)' .github/workflows/ .gitlab-ci.yml k8s/ manifests/ 2>/dev/null

# Check for digest pinning in Dockerfiles/K8s manifests
grep -rnE 'image:.*@sha256:' Dockerfile* k8s/ manifests/ docker-compose*.yml 2>/dev/null
grep -rnE '^FROM\s+\S+@sha256:' Dockerfile* 2>/dev/null

# Check for vulnerability severity threshold in CI
grep -rnE '(--severity|--exit-code|--fail-on|severity-cutoff)' .github/workflows/ .gitlab-ci.yml 2>/dev/null
```

## Phase 4: Secret Detection Deep Scan

Grep for these patterns across ALL files (not just infra):

```
# API Keys & Tokens
(AKIA[0-9A-Z]{16})                    # AWS Access Key
(sk-[a-zA-Z0-9]{48})                   # OpenAI API Key
(ghp_[a-zA-Z0-9]{36})                  # GitHub Personal Token
(gho_[a-zA-Z0-9]{36})                  # GitHub OAuth Token
(xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24})  # Slack Bot Token
(SG\.[a-zA-Z0-9]{22}\.[a-zA-Z0-9]{43})      # SendGrid API Key

# Generic patterns
(password|passwd|pwd)\s*[:=]\s*['\"][^'\"]+   # Passwords
(secret|token|key|api_key)\s*[:=]\s*['\"][^'\"]+  # Secrets
(BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY)       # Private keys
```

For each match:
- Report the file and line number
- Show the variable NAME only, never the value
- Classify as: confirmed secret, likely secret, or false positive
- Check if the file is in .gitignore

## Phase 5: Generate Report

Present findings in this format:

```
====================================================
  INFRASTRUCTURE AUDIT REPORT
  Generated: [date] | Scope: [all/docker/ci/k8s/env]
====================================================

SUMMARY
-------
  Files scanned:    23
  Issues found:     12
    Critical:  2  (fix immediately)
    High:      4  (fix before next deploy)
    Medium:    4  (fix when possible)
    Low:       2  (nice to have)

  Security score:   C (65/100)

CRITICAL ISSUES (fix immediately)
---------------------------------
[D001] Dockerfile:15 - Container runs as root
  Impact:  Container compromise gives root access to host
  Fix:     Add `USER nonroot` after creating the user
  Effort:  5 minutes

[E002] src/config.js:42 - Hardcoded API key detected
  Impact:  Secret exposed in version control
  Fix:     Move to environment variable, rotate the key immediately
  Effort:  15 minutes + key rotation

HIGH ISSUES (fix before next deploy)
-------------------------------------
[C004] docker-compose.yml:23 - No resource limits
  Impact:  Single container can consume all host resources (DoS risk)
  Fix:     Add deploy.resources.limits with CPU and memory
  Effort:  10 minutes

MEDIUM ISSUES (fix when possible)
----------------------------------
[D006] Dockerfile - Not using multi-stage build
  Impact:  Production image contains build tools and source code
  Fix:     Use multi-stage build to separate build and runtime
  Effort:  30 minutes

LOW ISSUES (nice to have)
--------------------------
[D009] Dockerfile - Missing LABEL metadata
  Impact:  Harder to track image origin and version
  Fix:     Add LABEL maintainer, version, description
  Effort:  2 minutes

PASSED CHECKS
--------------
  [E001] .env files properly gitignored
  [CI004] Dependency scanning configured
  [K008] Security context properly set
  [D005] Health check defined

RECOMMENDATIONS
---------------
1. IMMEDIATE: Rotate the exposed API key in src/config.js
2. THIS WEEK: Add USER instruction to Dockerfile
3. THIS SPRINT: Set up automated dependency scanning in CI
4. BACKLOG: Implement network policies for Kubernetes

====================================================
  Next: Run `/devops-infra-audit` again after fixes
====================================================
```

## Phase 6: Offer Auto-Fix

After presenting the report, ask the user:
"Would you like me to automatically fix any of these issues?"

For each fixable issue, categorize:
- **Auto-fixable** (safe to fix automatically): missing .dockerignore, missing labels, adding health checks, adding resource limits, pinning image versions
- **Needs review** (generate fix but user must approve): adding USER instruction, fixing CI permissions, removing secrets
- **Manual only** (provide instructions): rotating exposed secrets, setting up remote state, configuring network policies

## Safety Rules

- This is READ-ONLY. Never modify files during an audit
- Never expose actual secret values in the report - just note their presence
- When checking for secrets, grep for patterns, don't try to validate them
- Be specific about line numbers and file paths
- Provide actionable fix suggestions for every issue
- Include effort estimates for each fix
- Prioritize findings by actual risk, not just rule severity
- If no issues found in a category, explicitly say "All checks passed"
