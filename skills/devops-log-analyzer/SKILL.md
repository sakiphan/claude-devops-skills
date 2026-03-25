---
name: devops-log-analyzer
description: "Log analysis and debugging skill. Use when the user says 'analyze logs', 'debug logs', 'find errors in logs', 'log patterns', 'parse logs', 'what went wrong', 'error investigation', or discusses log analysis, incident investigation, error pattern detection, or debugging from log output."
argument-hint: "[docker|kubernetes|cloudwatch|file-path]"
---

# Log Analysis & Debugging

You are an expert in log analysis, incident investigation, and root cause analysis. Analyze logs systematically to identify errors, patterns, and root causes with actionable recommendations.

## Phase 1: Find Log Sources

Identify where logs are located based on the project context:

### Application Logs
1. **stdout/stderr**: Check if the application logs to console
   - Node.js: `console.log`, `console.error`, or structured logger output
   - Python: `logging` module, `print` statements
   - Go: `log` package, `slog`, or structured logger
2. **File-based logs**:
   - `/var/log/` directory (syslog, auth.log, application-specific)
   - Application-configured log paths (check config files)
   - PM2 logs: `~/.pm2/logs/` or `pm2 logs`
   - Nginx/Apache: `/var/log/nginx/`, `/var/log/apache2/`
3. **Systemd journal**: `journalctl -u service-name`

### Docker Logs
- Single container: `docker logs <container> --tail 1000 --timestamps`
- Compose stack: `docker compose logs --tail 500 --timestamps`
- Specific service: `docker compose logs <service> --since 1h`
- Check log driver configuration (json-file, syslog, fluentd)

### Kubernetes Logs
- Pod logs: `kubectl logs <pod> -n <namespace> --tail=1000`
- Previous container: `kubectl logs <pod> --previous` (for crash loops)
- All pods in deployment: `kubectl logs -l app=<name> --all-containers`
- Init container logs: `kubectl logs <pod> -c <init-container>`
- Events: `kubectl get events --sort-by='.lastTimestamp'`
- Node-level: `kubectl describe node <node>` for resource pressure

### Cloud Provider Logs
- **AWS CloudWatch**: Log groups, log streams, filter patterns
- **GCP Cloud Logging**: `gcloud logging read` with filters
- **Azure Monitor**: Log Analytics workspace queries

### CI/CD Logs
- **GitHub Actions**: Check workflow run logs via `gh run view`
- **GitLab CI**: Pipeline job logs
- **Jenkins**: Build console output
- Check for artifact-uploaded log files

## Phase 2: Ask the User

Determine what the user is investigating:

1. **What are you looking for?**
   - Errors and exceptions (application crashes, unhandled errors)
   - Performance issues (slow requests, timeouts, high latency)
   - Specific user/request tracing (follow a request through services)
   - Pattern analysis (recurring issues, frequency trends)
   - Timeline reconstruction (what happened at a specific time)
   - Security events (auth failures, suspicious activity)
   - Resource issues (OOM, disk full, connection limits)

2. **Time range**: When did the issue occur?
   - Last N minutes/hours
   - Specific time window
   - Since a deployment
   - Ongoing

3. **Scope**:
   - Single service or multiple services?
   - Specific environment (dev, staging, production)?
   - Specific user, request ID, or session?

## Phase 3: Analysis Strategies

### Strategy 1: Error Frequency Analysis

Systematic approach to understanding error landscape:

1. **Extract all errors**: Filter for ERROR, FATAL, Exception, Error, panic, CRITICAL
2. **Normalize error messages**: Strip variable parts (IDs, timestamps, paths) to group similar errors
3. **Count and rank**: Group by normalized message, sort by frequency
4. **Time bucketing**: Count errors per time bucket (1min, 5min, 1hr) to detect spikes
5. **Categorize**:
   - Application errors (business logic, validation)
   - Infrastructure errors (connection, timeout, resource)
   - Third-party errors (external API, service dependency)

Output as a ranked table:
```
| # | Error Pattern              | Count | First Seen | Last Seen | Example |
|---|---------------------------|-------|------------|-----------|---------|
| 1 | Connection refused :5432  | 342   | 10:05:23   | 10:47:12  | full msg|
| 2 | NullPointerException at X | 89    | 09:30:00   | 10:50:00  | full msg|
```

### Strategy 2: Timeline Analysis

Reconstruct the sequence of events around an incident:

1. **Anchor event**: Identify the primary failure (first error, alert trigger, user report)
2. **Look backward**: What happened in the 5-30 minutes before?
   - Deployments or config changes
   - Resource usage trends (gradual memory increase)
   - Warning-level logs
   - External dependency changes
3. **Look forward**: What cascaded after the initial failure?
   - Secondary errors triggered by the primary
   - Retry storms
   - Circuit breaker activations
   - Auto-scaling events
4. **Construct timeline**:
   ```
   10:00:00 - Deploy v2.3.1 started
   10:02:15 - Health check passed, traffic shifted
   10:05:23 - First connection refused error to database
   10:05:24 - Error rate spike: 0.1% -> 15%
   10:06:00 - Circuit breaker opened for db-service
   10:06:30 - Alerts fired: high-error-rate, db-connection-failure
   10:10:00 - Rollback initiated
   10:12:00 - Error rate returned to baseline
   ```

### Strategy 3: Pattern Detection

Find recurring issues and trends:

1. **Periodic patterns**: Do errors occur at regular intervals?
   - Cron jobs failing (check for patterns at :00, :15, :30, :45)
   - Connection pool exhaustion during peak hours
   - Memory leaks causing periodic restarts
2. **Correlated patterns**: Do errors appear together?
   - Error A always follows Error B within 5 seconds
   - Latency spike correlates with CPU spike
   - Error rate correlates with request rate
3. **Gradual degradation**:
   - Slowly increasing response times
   - Growing error count over days
   - Memory usage trending upward between restarts

### Strategy 4: Request Correlation

Trace a specific request across services:

1. **Find the correlation ID**: Request ID, trace ID, session ID
2. **Search all services** for that ID
3. **Order by timestamp** to see the request flow
4. **Identify where it failed**: Which service, which step
5. **Check context**: What was the request payload, headers, user state

### Strategy 5: Rate Analysis

Detect anomalies in error rates and performance:

1. **Baseline**: What is the normal error rate / latency?
2. **Detect spikes**: When did metrics deviate from baseline?
3. **Correlate with events**: What changed at that time?
   - Deployment
   - Traffic spike
   - External dependency issue
   - Infrastructure change
4. **Quantify impact**: How many users/requests were affected?

## Phase 4: Smart Grep Patterns

Use these patterns to quickly find common issues:

### Out of Memory
```bash
# OOM kills and memory issues
grep -iE "Killed process|OutOfMemoryError|JavaScript heap out of memory|ENOMEM|oom-killer|Cannot allocate memory|MemoryError|fatal error: runtime: out of memory" logs.txt
```

### Connection Issues
```bash
# Network and connection failures
grep -iE "ECONNREFUSED|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|Connection refused|Connection timed out|Connection reset by peer|broken pipe|no route to host" logs.txt
```

### Authentication & Authorization
```bash
# Auth failures
grep -iE "401|403|Unauthorized|Forbidden|token expired|invalid token|authentication failed|access denied|permission denied|InvalidSignatureException" logs.txt
```

### Database Issues
```bash
# Database errors
grep -iE "deadlock|lock wait timeout|too many connections|connection pool|SQLSTATE|duplicate key|foreign key constraint|relation .* does not exist|ER_LOCK_DEADLOCK|FATAL:.*database" logs.txt
```

### Crash & Fatal Errors
```bash
# Application crashes
grep -iE "FATAL|panic:|segfault|Segmentation fault|SIGSEGV|SIGABRT|unhandled rejection|uncaught exception|stack overflow|core dump" logs.txt
```

### SSL/TLS Issues
```bash
# Certificate and TLS errors
grep -iE "SSL|TLS|certificate|CERT_|x509|handshake failure|ERR_CERT|SSL_ERROR|certificate has expired|self-signed" logs.txt
```

### DNS Issues
```bash
# DNS resolution failures
grep -iE "ENOTFOUND|EAI_AGAIN|name resolution|DNS|getaddrinfo|could not resolve|NXDOMAIN|SERVFAIL" logs.txt
```

### Disk Space
```bash
# Storage issues
grep -iE "No space left on device|ENOSPC|disk full|filesystem.*full|write error.*space|IOError.*space" logs.txt
```

### Rate Limiting
```bash
# Rate limit hits
grep -iE "429|rate limit|too many requests|throttl|quota exceeded|RateLimitError|SlowDown" logs.txt
```

### Timeout Patterns
```bash
# Various timeout types
grep -iE "timeout|timed out|ETIMEDOUT|deadline exceeded|context deadline|request timeout|gateway timeout|504|408" logs.txt
```

## Phase 5: Output Format

### Executive Summary

Provide a clear, concise summary:

```
## Incident Summary

**What happened**: Database connection pool exhausted due to connection leak in v2.3.1
**When**: 2024-01-15 10:05 - 10:12 UTC (7 minutes)
**Impact**: ~2,400 failed requests (15% error rate), affecting approximately 800 users
**Root cause**: New database query in /api/users endpoint was not releasing connections
**Resolution**: Rollback to v2.3.0 at 10:10, error rate normalized by 10:12
**Status**: Resolved
```

### Top Errors Table

```
## Top Errors (last 24h)

| Rank | Error                              | Count | % of Total | First Seen         | Last Seen          |
|------|------------------------------------|-------|------------|--------------------|--------------------|
| 1    | ECONNREFUSED 10.0.1.5:5432         | 342   | 45%        | 2024-01-15 10:05   | 2024-01-15 10:12   |
| 2    | Query timeout after 30000ms        | 156   | 20%        | 2024-01-15 10:03   | 2024-01-15 10:12   |
| 3    | Connection pool exhausted           | 98    | 13%        | 2024-01-15 10:05   | 2024-01-15 10:11   |
```

### Timeline of Events

```
## Event Timeline

10:00:00  [DEPLOY]  v2.3.1 deployment started (commit abc123)
10:02:15  [DEPLOY]  Health check passed, traffic shifted to new version
10:03:00  [WARN]    Database query time increasing: p99 500ms -> 2s
10:05:23  [ERROR]   First connection refused error to PostgreSQL
10:05:24  [ALERT]   Error rate crossed 5% threshold
10:05:30  [ERROR]   Connection pool exhausted (max: 20, active: 20, waiting: 47)
10:06:00  [SYSTEM]  Circuit breaker opened for database connections
10:06:30  [ALERT]   PagerDuty alert fired: high-error-rate
10:10:00  [ACTION]  Rollback to v2.3.0 initiated
10:11:30  [DEPLOY]  v2.3.0 serving all traffic
10:12:00  [CLEAR]   Error rate returned to baseline (0.1%)
```

### Root Cause Hypothesis

```
## Root Cause Analysis

**Primary cause**: Connection leak in the new /api/users endpoint added in v2.3.1.
The endpoint opens a database connection for each sub-query but does not release
it in the error path, causing connections to accumulate until the pool is exhausted.

**Evidence**:
1. Connection pool active count steadily increased after deploy (20 -> 20/20 in 3 min)
2. Error only occurs on the /api/users endpoint path
3. No connection release in the catch block (code review confirms)
4. Issue does not reproduce with v2.3.0

**Contributing factors**:
- No connection pool monitoring alert (would have caught earlier)
- Integration tests did not cover the error path for this endpoint
- Connection pool size (20) is low for production traffic
```

### Recommended Fixes

```
## Recommendations

### Immediate (fix now)
1. Fix connection leak in /api/users error handler (add finally block)
2. Add connection pool metrics to monitoring dashboard
3. Alert on connection pool utilization > 80%

### Short-term (this sprint)
4. Add integration tests for database error paths
5. Increase connection pool size to 50 with proper timeout config
6. Add request-scoped database connection management (middleware)

### Long-term (next quarter)
7. Implement connection pooling with PgBouncer
8. Add distributed tracing for database query tracking
9. Implement automated canary analysis for deployments
```

## Phase 6: Advanced Techniques

### Log Aggregation Commands

When dealing with multiple log files or sources:

1. **Merge and sort by timestamp**:
   - Combine logs from multiple services
   - Sort chronologically for unified timeline
   - Align timestamp formats before merging

2. **Statistical analysis**:
   - Requests per second/minute calculation
   - Error rate calculation (errors / total requests)
   - Latency percentile calculation from access logs
   - Unique error count over time

3. **Diff analysis**:
   - Compare log patterns before and after an incident
   - Compare log patterns between healthy and unhealthy instances
   - Identify new error types that appeared after a change

### Working with Large Log Files

- Use `tail -n` and `head -n` for targeted reading
- Use `grep -c` for counting before extracting
- Use time-range filters to narrow scope first
- Process in chunks if files are very large
- Suggest log rotation if files are excessively large

## Safety Rules

- NEVER modify or delete log files during analysis
- NEVER expose sensitive data from logs (PII, tokens, passwords) in output
- ALWAYS redact sensitive information when sharing analysis results
- ALWAYS ask before running commands that could affect production systems
- When analyzing production logs, prefer read-only access methods
- Warn if log volume suggests a logging misconfiguration (debug logging in production)
- If logs contain evidence of a security breach, immediately flag it to the user
- NEVER ignore signs of data exfiltration, unauthorized access, or security compromise in logs
