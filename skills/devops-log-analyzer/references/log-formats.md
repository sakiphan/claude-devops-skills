# Log Formats Reference

## Apache/Nginx Combined Log Format

```
# Format:
# host ident authuser date request status bytes referrer user-agent
127.0.0.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /api/users HTTP/1.1" 200 2326 "https://example.com" "Mozilla/5.0"
```

```bash
# Parse fields with awk
# $1=IP, $4=date, $6=method, $7=path, $9=status, $10=bytes
awk '{print $1, $9, $7}' access.log

# Top paths by status code
awk '$9 == 500 {print $7}' access.log | sort | uniq -c | sort -rn

# Requests per IP per hour
awk '{gsub(/\[/,"",$4); split($4,a,":"); print $1, a[2]":00"}' access.log | sort | uniq -c | sort -rn

# Bytes transferred per endpoint
awk '{sum[$7] += $10} END {for (p in sum) print sum[p], p}' access.log | sort -rn

# Extract date range
awk '/10\/Oct\/2023:13:5[0-9]/' access.log
```

## JSON Structured Logs

```json
{"timestamp":"2023-10-10T13:55:36Z","level":"error","message":"connection refused","service":"api","request_id":"abc-123","duration_ms":45}
```

### jq Queries

```bash
# Filter by level
cat app.log | jq 'select(.level == "error")'

# Extract specific fields
cat app.log | jq -r '[.timestamp, .level, .message] | @tsv'

# Count by level
cat app.log | jq -r '.level' | sort | uniq -c | sort -rn

# Filter by time range
cat app.log | jq 'select(.timestamp >= "2023-10-10T13:00:00Z" and .timestamp < "2023-10-10T14:00:00Z")'

# Group errors by message
cat app.log | jq -r 'select(.level == "error") | .message' | sort | uniq -c | sort -rn

# Average duration by endpoint
cat app.log | jq -r 'select(.duration_ms != null) | "\(.path) \(.duration_ms)"' | \
  awk '{sum[$1]+=$2; count[$1]++} END {for (p in sum) printf "%s %.0fms\n", p, sum[p]/count[p]}' | sort -k2 -rn

# Follow request through services by ID
cat *.log | jq -r 'select(.request_id == "abc-123") | "\(.timestamp) [\(.service)] \(.message)"' | sort

# Errors with stack traces
cat app.log | jq 'select(.level == "error" and .stack != null) | {message, stack}'

# Nested field access
cat app.log | jq '.metadata.user_id'

# Pretty print with color
cat app.log | jq -C '.' | less -R
```

## Syslog Format

```
# Format: <priority>timestamp hostname app[pid]: message
Oct 10 13:55:36 web01 nginx[1234]: connection reset by peer
```

```bash
# Parse syslog
awk '{print $1, $2, $3, $4, $5}' /var/log/syslog

# Filter by service
grep "nginx\[" /var/log/syslog

# journalctl (systemd)
journalctl -u nginx --since "1 hour ago" --output json-pretty
journalctl -u nginx --since "2023-10-10" --until "2023-10-11"
journalctl -p err  # Only errors and above
journalctl -k      # Kernel messages only
```

## Docker Log Format

```bash
# Default JSON file driver
# /var/lib/docker/containers/<id>/<id>-json.log
# {"log":"message\n","stream":"stdout","time":"2023-10-10T13:55:36.123Z"}

# View logs
docker logs mycontainer --since 1h --tail 100
docker logs mycontainer 2>&1 | grep ERROR

# Parse docker JSON logs
cat *-json.log | jq -r 'select(.stream == "stderr") | .log' | tr -d '\n'

# Docker compose logs
docker compose logs -f --since 30m api worker

# Filter by container in docker JSON
cat *-json.log | jq -r '.log' | grep -i error
```

## Kubernetes Log Format

```bash
# Pod logs
kubectl logs mypod -c mycontainer --since=1h --tail=200
kubectl logs -l app=api --all-containers --since=30m

# Previous crashed container
kubectl logs mypod --previous

# Stream logs
kubectl logs -f deploy/api

# All pods in namespace
kubectl logs -n production -l app=api --prefix --timestamps

# Events (useful for crash/scheduling issues)
kubectl get events --sort-by='.lastTimestamp' -n production
kubectl get events --field-selector reason=OOMKilling

# Parse structured k8s logs with stern (better log viewer)
stern api --since 1h --output json | jq 'select(.message | contains("error"))'
stern "api-.*" -n production --tail 50
```

## Multi-Format Parsing with awk

```bash
# Auto-detect and parse timestamp from various formats
# ISO 8601
awk '/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/ {print $1, $0}'

# Extract key=value pairs
grep -oP '\w+=\S+' app.log | sort | head -20

# Convert Apache log to JSON
awk '{
  printf "{\"ip\":\"%s\",\"date\":\"%s\",\"method\":\"%s\",\"path\":\"%s\",\"status\":%s,\"bytes\":%s}\n",
  $1, $4, $6, $7, $9, $10
}' access.log | sed 's/\[//g; s/"GET/"GET/; s/"POST/"POST/'

# Multiline log aggregation (Java stack traces)
awk '/^[0-9]{4}-[0-9]{2}-[0-9]{2}/ {if(buf) print buf; buf=$0; next} {buf=buf"\\n"$0} END{print buf}' app.log

# Count log lines per second (detect bursts)
awk '{print $1, $2}' app.log | cut -d. -f1 | uniq -c | sort -rn | head -10
```
