# Grep Patterns Reference

## Node.js Error Patterns

```bash
# Unhandled promise rejections
grep -E "UnhandledPromiseRejection|unhandledRejection" app.log

# Connection errors
grep -E "ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND" app.log

# Memory issues
grep -E "ENOMEM|heap out of memory|JavaScript heap" app.log

# Syntax/runtime errors
grep -E "SyntaxError|TypeError|ReferenceError|RangeError" app.log
```

## Python Error Patterns

```bash
# Tracebacks (multiline - get 5 lines after)
grep -A 5 "^Traceback" app.log

# Import errors
grep -E "ImportError|ModuleNotFoundError" app.log

# Connection/timeout
grep -E "ConnectionError|ConnectionRefusedError|TimeoutError|ConnectionResetError" app.log

# Common exceptions
grep -E "KeyError|ValueError|AttributeError|FileNotFoundError" app.log
```

## Java Error Patterns

```bash
# Null pointer and memory
grep -E "NullPointerException|OutOfMemoryError|StackOverflowError" app.log

# Class loading
grep -E "ClassNotFoundException|NoClassDefFoundError" app.log

# Full stack traces (get 20 lines after exception)
grep -A 20 "Exception in thread\|at .*(.*\.java:" app.log
```

## Go Error Patterns

```bash
# Panics
grep -E "^panic:|runtime error:|goroutine .* \[running\]" app.log

# Context errors
grep -E "context deadline exceeded|context canceled" app.log

# Connection
grep -E "connection refused|no such host|i/o timeout" app.log
```

## HTTP Status Patterns

```bash
# All 5xx errors
grep -E "\" [5][0-9]{2} " access.log

# All 4xx errors
grep -E "\" [4][0-9]{2} " access.log

# Specific codes
grep "\" 502 " access.log    # Bad gateway
grep "\" 503 " access.log    # Service unavailable
grep "\" 429 " access.log    # Rate limited
grep "\" 401 " access.log    # Unauthorized

# Count status codes
awk '{print $9}' access.log | sort | uniq -c | sort -rn
```

## Database Error Patterns

```bash
# Deadlocks
grep -iE "deadlock|lock wait timeout" app.log

# Connection pool
grep -iE "connection pool exhausted|too many connections|max_connections" app.log

# Timeouts
grep -iE "query timeout|statement timeout|idle.*timeout" app.log

# Postgres specific
grep -iE "FATAL|PANIC|could not connect|relation .* does not exist" postgresql.log
```

## Infrastructure Patterns

```bash
# OOM killer
grep -i "Out of memory\|oom-killer\|Killed process" /var/log/syslog
dmesg | grep -i "oom\|killed process"

# Disk
grep -iE "No space left on device|disk full|filesystem full" /var/log/syslog

# DNS
grep -iE "DNS resolution failed|NXDOMAIN|SERVFAIL|name.*not.*resolve" app.log

# SSL/TLS
grep -iE "certificate.*expired|SSL_ERROR|handshake failure|x509" app.log

# Systemd service failures
journalctl -u myservice --since "1 hour ago" --no-pager | grep -iE "failed|error|fatal"
```

## Useful One-Liners

```bash
# Top 10 IPs by request count
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10

# Requests per minute
awk '{print $4}' access.log | cut -d: -f1-3 | uniq -c

# Slowest requests (if response time is last field)
awk '{print $NF, $7}' access.log | sort -rn | head -20

# Error rate per endpoint
awk '$9 >= 500 {print $7}' access.log | sort | uniq -c | sort -rn | head -10

# Count errors by hour
grep -i "error" app.log | awk '{print $1, substr($2,1,2)":00"}' | sort | uniq -c

# Find requests taking over 5 seconds (log format: ... duration=X.XXs)
grep -oP 'duration=\K[0-9.]+' app.log | awk '$1 > 5'

# Extract and count unique error messages
grep -oP '(?<=ERROR ).*' app.log | sort | uniq -c | sort -rn | head -20

# Monitor log in real-time for errors
tail -f app.log | grep --line-buffered -iE "error|fatal|panic|exception"

# Find burst of errors (more than 10 per minute)
grep -i error app.log | awk '{print $1, $2}' | cut -d: -f1-2 | uniq -c | awk '$1 > 10'

# Parse JSON logs for errors
cat app.log | jq -r 'select(.level == "error") | "\(.timestamp) \(.message)"'

# Correlate by request ID across files
grep "req-abc123" *.log
```
