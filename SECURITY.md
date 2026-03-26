# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.3.x   | :white_check_mark: |
| < 1.3   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in this package, please report it responsibly.

**Do NOT open a public issue.**

Instead, please email **security@sakiphan.dev** or open a [private security advisory](https://github.com/sakiphan/claude-skills-devops/security/advisories/new) on GitHub.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

### Response timeline

- **24 hours**: Acknowledgment of report
- **72 hours**: Initial assessment
- **7 days**: Fix or mitigation plan

## Security Design

This package has a minimal attack surface by design:

- **Zero dependencies** — no transitive supply chain risk
- **No code execution at runtime** — skills are markdown files read by Claude Code
- **Explicit file boundaries** — `files` field in package.json + `.npmignore`
- **Install script** only copies markdown files to `~/.claude/skills/`

## npm Provenance

Starting from v1.3.2, this package is published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) via GitHub Actions, providing a cryptographic link between the published package and its source code.
