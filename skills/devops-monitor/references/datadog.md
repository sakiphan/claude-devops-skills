# Datadog Reference

## Datadog Agent Docker Compose Service

```yaml
datadog-agent:
  image: gcr.io/datadoghq/agent:latest
  environment:
    - DD_API_KEY=${DD_API_KEY}
    - DD_SITE=datadoghq.com
    - DD_APM_ENABLED=true
    - DD_APM_NON_LOCAL_TRAFFIC=true
    - DD_LOGS_ENABLED=true
    - DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true
    - DD_DOGSTATSD_NON_LOCAL_TRAFFIC=true
  ports:
    - "8126:8126"  # APM
    - "8125:8125/udp"  # DogStatsD
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - /proc/:/host/proc/:ro
    - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
  restart: unless-stopped
```

## APM Setup

**Node.js**: `npm install dd-trace` then `require('dd-trace').init({ service: 'my-app', env: 'production' });` as first line.

**Python**: `pip install ddtrace` then `ddtrace-run python app.py` with `DD_SERVICE` and `DD_ENV` set.

**Go**:
```go
import "gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
tracer.Start(tracer.WithService("my-go-app"), tracer.WithEnv("production"))
defer tracer.Stop()
```

**C#/.NET**: `dotnet add package Datadog.Trace`, set `CORECLR_ENABLE_PROFILING=1`, `CORECLR_PROFILER={846F5F1C-F9AE-4B07-969E-05C26BC060D8}`.

## Custom Metrics (DogStatsD)

```javascript
// Node.js: npm install hot-shots
const client = new (require('hot-shots'))({ host: 'datadog-agent', port: 8125 });
client.increment('app.page.views', 1, { page: '/home' });
client.gauge('app.queue.length', 42);
```

```python
# Python: pip install datadog
from datadog import statsd
statsd.increment('app.page.views', tags=["page:/home"])
statsd.gauge('app.queue.length', 42)
```

## Log Collection

Add Docker labels to application services for automatic log collection:

```yaml
my-app:
  image: my-app:latest
  labels:
    com.datadoghq.ad.logs: '[{"source":"python","service":"my-app"}]'
```

## Monitor Creation (API)

```bash
curl -X POST "https://api.datadoghq.com/api/v1/monitor" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "metric alert",
    "query": "avg(last_5m):avg:app.request.error_rate{env:production} > 0.05",
    "name": "High Error Rate",
    "message": "Error rate above 5% @slack-alerts",
    "options": { "thresholds": { "critical": 0.05, "warning": 0.02 } }
  }'
```

## Key Environment Variables

```bash
DD_API_KEY=<your-api-key>          # Required, never hardcode
DD_SITE=datadoghq.com             # Region: datadoghq.com, datadoghq.eu, etc.
DD_APM_ENABLED=true                # Enable APM trace collection
DD_LOGS_ENABLED=true               # Enable log collection
DD_DOGSTATSD_NON_LOCAL_TRAFFIC=true  # Accept StatsD from other containers
DD_ENV=production                  # Unified service tag: environment
DD_SERVICE=my-app                  # Unified service tag: service name
DD_VERSION=1.2.0                   # Unified service tag: version
```
