---
name: devops-monitor
description: "Monitoring and observability setup. Use when the user says 'set up monitoring', 'add prometheus', 'grafana dashboard', 'alerting rules', 'observability', 'metrics', 'add logging', 'opentelemetry', 'otel', 'datadog', or discusses application monitoring, metric collection, or alerting configuration."
argument-hint: "[prometheus-grafana|opentelemetry|datadog|newrelic|elk|cloud-native]"
---

# Monitoring & Observability Setup

You are an expert in monitoring, observability, and alerting. Set up production-grade monitoring stacks with dashboards, alerts, and application instrumentation.

## Phase 1: Detect What Needs Monitoring

Analyze the project to understand what should be monitored:

1. **Application type**:
   - Web application (check for `package.json`, `requirements.txt`, `go.mod`)
   - API service (check for route definitions, OpenAPI specs)
   - Microservices (check for `docker-compose.yml`, Kubernetes manifests)
   - Database (check for database connection configs, migration files)
   - Background workers (check for queue configs, cron definitions)

2. **Existing monitoring**:
   - `prometheus.yml` -> Prometheus already configured
   - `docker-compose.yml` with grafana/prometheus services -> Stack exists
   - `datadog.yaml` or `DD_` env vars -> Datadog in use
   - `newrelic.js` or `newrelic.yml` -> New Relic in use
   - `filebeat.yml`, `logstash.conf` -> ELK stack in use
   - If found, ask: enhance existing setup or start fresh?

3. **Infrastructure context**:
   - Docker-based? (Dockerfile, docker-compose.yml)
   - Kubernetes? (k8s manifests, helm charts)
   - Cloud provider? (AWS, GCP, Azure configs)
   - Serverless? (serverless.yml, SAM template)

4. **Current health endpoints**:
   - Check for `/health`, `/healthz`, `/ready`, `/metrics` routes
   - Check for existing instrumentation libraries in dependencies

## Phase 2: Ask the User

Parse `$ARGUMENTS` for monitoring stack. If not specified, ask:

1. **Which monitoring stack?**
   - Prometheus + Grafana (recommended for self-hosted, open-source)
   - OpenTelemetry + backend (vendor-neutral instrumentation with flexible backends -- Jaeger, Grafana Tempo, Prometheus)
   - Datadog (managed, full-stack observability with APM, metrics, and logs)
   - New Relic (managed, APM-focused)
   - ELK Stack (log-focused observability)
   - Cloud-native (CloudWatch, Cloud Monitoring, Azure Monitor)

2. **What to monitor?**
   - Application metrics (request rate, error rate, latency)
   - Infrastructure metrics (CPU, memory, disk, network)
   - Business metrics (signups, orders, revenue)
   - Logs (structured logging, log aggregation)
   - Traces (distributed tracing across services)

3. **Alert destinations**:
   - Slack
   - PagerDuty
   - Email
   - Webhook
   - OpsGenie

## Phase 3: Prometheus + Grafana (Default Path)

### 3.1 Generate prometheus.yml

Create a Prometheus configuration with appropriate scrape configs:

```yaml
# prometheus.yml structure:
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alerts/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

scrape_configs:
  - job_name: 'prometheus'        # Self-monitoring
  - job_name: 'application'       # App metrics endpoint
  - job_name: 'node-exporter'     # Host metrics
  - job_name: 'cadvisor'          # Container metrics (if Docker)
```

Adjust scrape targets based on detected services. Use `dns_sd_configs` or `static_configs` as appropriate.

### 3.2 Generate Docker Compose Services

Add monitoring services to docker-compose:

- **Prometheus**: Port 9090, volume mount for config and data
- **Grafana**: Port 3000, provisioned datasources and dashboards
- **Node Exporter**: Host metrics collection
- **cAdvisor**: Container metrics (if Docker environment)
- **Alertmanager**: Alert routing and deduplication

Include:
- Named volumes for data persistence
- Health checks for each service
- Restart policies (`unless-stopped`)
- Network configuration (monitoring network)
- Resource limits to prevent monitoring from consuming excessive resources

### 3.3 Create Grafana Dashboard JSON

Generate dashboard JSON files for common metrics:

**Application Dashboard**:
- Request rate (requests/second) by endpoint and status code
- Error rate (4xx and 5xx) with threshold lines
- Latency percentiles (p50, p95, p99) as heatmap or graph
- Active connections / in-flight requests
- Request duration distribution histogram

**Infrastructure Dashboard**:
- CPU usage per container/host (gauge + timeseries)
- Memory usage and limits (with OOM threshold line)
- Disk I/O and space utilization
- Network traffic in/out per interface
- Container restart count

**Alert Overview Dashboard**:
- Active alerts table
- Alert history timeline
- Silence management links

Place dashboards in `monitoring/grafana/dashboards/` and configure Grafana provisioning to auto-load them.

### 3.4 Generate Alerting Rules

Create alert rules in `monitoring/prometheus/alerts/`:

**Availability Alerts**:
```yaml
# High error rate: >5% of requests returning 5xx for 5 minutes
# Service down: target unreachable for 1 minute
# Health check failing: /health returning non-200 for 2 minutes
```

**Performance Alerts**:
```yaml
# High latency: p99 > 2s for 5 minutes
# High request rate: sudden spike > 3x normal for 5 minutes
# Slow queries: database query time > 1s
```

**Infrastructure Alerts**:
```yaml
# High CPU: > 80% for 10 minutes
# High memory: > 85% for 5 minutes
# Disk space: < 15% free
# Container restarts: > 3 in 15 minutes
# OOM kills detected
```

**Custom Business Alerts**:
- Template for user-defined business metric alerts
- Include examples with comments

Each alert should include:
- `severity` label (critical, warning, info)
- `summary` annotation with human-readable description
- `description` annotation with details and current value
- `runbook_url` annotation (placeholder for documentation link)
- Appropriate `for` duration to avoid flapping

### 3.5 Alertmanager Configuration

Generate `alertmanager.yml` with:
- Route tree for severity-based routing
- Critical alerts -> PagerDuty/immediate notification
- Warning alerts -> Slack channel
- Info alerts -> email digest
- Inhibition rules (critical inhibits warning for same alert)
- Repeat interval configuration
- Grouping by alertname and service

## Phase 4: Application Instrumentation

### Node.js (Express/Fastify/Koa)

Generate instrumentation setup:

1. Install `prom-client` dependency
2. Create `metrics.js` module:
   - Default metrics collection (event loop lag, heap size, GC stats)
   - Custom histogram for HTTP request duration (labels: method, route, status_code)
   - Custom counter for HTTP requests total
   - Custom gauge for active connections
   - Custom counter for errors by type
3. Create Express middleware:
   - Record request start time with `process.hrtime()`
   - On response finish, observe duration in histogram
   - Increment request counter
   - Track active connections with gauge
4. Add `/metrics` endpoint exposing Prometheus format
5. Add `/health` and `/ready` endpoints

### Python (Flask/FastAPI/Django)

Generate instrumentation setup:

1. Install `prometheus_client` dependency
2. For **FastAPI**:
   - Middleware class tracking request duration and count
   - `/metrics` endpoint using `generate_latest()`
   - Histogram for request duration with labels
   - Counter for requests by method and endpoint
3. For **Flask**:
   - Before/after request hooks for timing
   - `/metrics` blueprint
   - Similar metrics to FastAPI
4. For **Django**:
   - Middleware class for request tracking
   - URL pattern for `/metrics`
   - Include django-prometheus if preferred
5. Include structured logging setup with `structlog` or `python-json-logger`

### C#/.NET (ASP.NET Core)

Generate instrumentation setup:

1. Install `prometheus-net.AspNetCore` NuGet package
2. Configure ASP.NET Core middleware:
   - `app.UseHttpMetrics()` for automatic HTTP request metrics
   - `app.MapMetrics()` to expose `/metrics` endpoint
3. Create custom metrics:
   - Counter for requests by method and endpoint
   - Histogram for request duration with exponential buckets
   - Gauge for in-flight requests
4. Default metrics exposed: GC count, managed memory, CPU seconds, HTTP latency
5. Add `/health` and `/ready` endpoints using ASP.NET Core health checks

C#/.NET: prometheus-net with ASP.NET Core middleware

### Go

Generate instrumentation setup:

1. Import `github.com/prometheus/client_golang/prometheus`
2. Create metrics registry:
   - `http_requests_total` counter vec (method, path, status)
   - `http_request_duration_seconds` histogram vec (method, path)
   - `http_requests_in_flight` gauge
3. Create middleware handler wrapper:
   - Use `promhttp.InstrumentHandlerCounter` and friends
   - Or custom middleware wrapping `http.Handler`
4. Register `/metrics` endpoint with `promhttp.Handler()`
5. Add `/healthz` and `/readyz` endpoints

## Phase 5: ELK / Logging Path

If the user selects ELK stack or logging-focused monitoring:

### 5.1 Structured Logging Setup

For each detected language, generate structured logging config:

- **Node.js**: `pino` or `winston` with JSON format, correlation IDs, log levels
- **Python**: `structlog` with JSON renderer, bound loggers, request ID propagation
- **Go**: `slog` (stdlib) or `zerolog` with JSON output, request context

Every log line must include:
- Timestamp (ISO 8601)
- Log level
- Service name
- Request/correlation ID
- Message
- Additional structured fields

### 5.2 Filebeat / Fluentd Configuration

Generate log shipper config:

**Filebeat** (`filebeat.yml`):
- Input: container logs or application log files
- Processors: add hostname, decode JSON, add Kubernetes metadata
- Output: Elasticsearch or Logstash
- Index lifecycle management settings

**Fluentd** (`fluent.conf`):
- Source: tail application logs or forward from Docker
- Filter: parse JSON, add tags, enrich with metadata
- Match: output to Elasticsearch
- Buffer configuration for reliability

### 5.3 Docker Compose for ELK

Add services:
- Elasticsearch (with JVM heap size, single-node for dev)
- Kibana (port 5601, connected to Elasticsearch)
- Filebeat or Fluentd (log collection)
- Include volume mounts, health checks, resource limits

### 5.4 Kibana Dashboard

Provide instructions and saved objects for:
- Log stream view with filtering
- Error rate visualization
- Top errors aggregation
- Response time percentiles from access logs
- Index pattern setup

## Phase 6: OpenTelemetry Path

If the user selects OpenTelemetry for vendor-neutral observability:

> Reference: `references/opentelemetry.md` for collector config, auto-instrumentation snippets, and pipeline setup.

### 6.1 OTel Collector Setup

Deploy the OpenTelemetry Collector as a docker-compose service:
- Use the `otel/opentelemetry-collector-contrib` image
- Expose OTLP gRPC (4317) and OTLP HTTP (4318) receiver ports
- Mount a `otel-collector-config.yaml` with receivers, processors, and exporters
- Configure pipelines for traces, metrics, and logs independently

### 6.2 Auto-Instrumentation

For each detected language, add zero-code or minimal-code instrumentation:

- **Node.js**: Install `@opentelemetry/auto-instrumentations-node` and `@opentelemetry/exporter-trace-otlp-grpc`. Bootstrap via `--require @opentelemetry/auto-instrumentations-node/register` or a `tracing.js` init file.
- **Python**: Install `opentelemetry-distro` and `opentelemetry-instrumentation`. Run `opentelemetry-instrument` wrapper or call `configure_opentelemetry()` in code.
- **Go**: Import `go.opentelemetry.io/contrib/instrumentation` packages for net/http, gRPC, and database drivers. Initialize a `TracerProvider` with OTLP exporter.
- **C#/.NET**: Install `OpenTelemetry.AutoInstrumentation` NuGet package. Configure via environment variables (`OTEL_DOTNET_AUTO_HOME`, `CORECLR_ENABLE_PROFILING`).

### 6.3 OTLP Exporter Configuration

Set standard environment variables in the application service:
- `OTEL_EXPORTER_OTLP_ENDPOINT` pointing to the collector
- `OTEL_SERVICE_NAME` for service identification
- `OTEL_RESOURCE_ATTRIBUTES` for environment and version metadata

### 6.4 Backend Integration

Connect the collector to one or more backends:
- **Jaeger** for trace visualization (OTLP or Jaeger exporter)
- **Grafana Tempo** for scalable trace storage (OTLP exporter)
- **Prometheus** for metrics (Prometheus exporter on collector, or Prometheus remote-write)
- **Loki** for logs (Loki exporter)

Generate the appropriate exporter blocks in the collector config for the chosen backends.

## Phase 7: Datadog Path

If the user selects Datadog for managed observability:

> Reference: `references/datadog.md` for agent setup, APM instrumentation, custom metrics, and alerting.

### 7.1 Datadog Agent Setup

Deploy the Datadog Agent as a docker-compose service:
- Use the `gcr.io/datadoghq/agent` image
- Set `DD_API_KEY` (from environment variable, never hardcoded)
- Enable APM: `DD_APM_ENABLED=true`, expose port 8126
- Enable logs: `DD_LOGS_ENABLED=true`, `DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true`
- Mount `/var/run/docker.sock` and `/proc` for container and host metrics
- Set `DD_SITE` for the correct Datadog region (e.g., `datadoghq.com`, `datadoghq.eu`)

### 7.2 APM Instrumentation

For each detected language, add Datadog tracing:

- **Node.js**: Install `dd-trace`, require it at application entry (`dd-trace/init` or `dd-trace.init()`)
- **Python**: Install `ddtrace`, run with `ddtrace-run` wrapper or patch manually
- **Go**: Import `gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer`, call `tracer.Start()` with appropriate options
- **C#/.NET**: Install `Datadog.Trace` NuGet package, enable automatic instrumentation via environment variables or `dd-trace-dotnet`

### 7.3 Custom Metrics with DogStatsD

- Configure the agent to receive DogStatsD on port 8125
- Use language-specific clients (`hot-shots` for Node.js, `datadog` for Python) to emit custom gauges, counters, histograms, and distributions
- Tag all metrics with `service`, `env`, and `version` for unified service tagging

### 7.4 Log Collection

- Configure application services with `com.datadoghq.ad.logs` Docker labels for automatic log collection
- Ensure logs are in JSON format for automatic parsing
- Map `source` and `service` labels for proper log pipeline routing in Datadog

### 7.5 Monitors and Dashboards

- Use the Datadog API or Terraform `datadog` provider to create monitors:
  - Metric monitors for error rate, latency, and infrastructure thresholds
  - APM monitors for service-level objectives (SLOs)
  - Log monitors for error patterns
- Create dashboards via API with widgets for key metrics, traces, and logs in a single view

## Phase 8: Review & Validate

After generating the monitoring setup:

1. **List all generated files** with brief description of each
2. **Explain the architecture**: how data flows from app -> collector -> storage -> visualization
3. **Show how to start**: exact commands to bring up the stack
4. **Verify connectivity**: commands to check each component is healthy
5. **Show example queries**: PromQL queries or Kibana searches for common questions
6. **List required configuration**: any secrets, tokens, or endpoints to configure

## Error Handling

### Prometheus Not Scraping
- Check target is reachable: `curl http://target:port/metrics`
- Verify scrape config job name and targets match
- Check Prometheus targets page at `http://localhost:9090/targets`
- Look for firewall/network issues between Prometheus and targets
- Verify metrics endpoint returns valid Prometheus format
- Check for `scrape_timeout` being too short

### Grafana Datasource Not Connecting
- Verify Prometheus URL is correct (use Docker service name if in same network)
- Check network connectivity between Grafana and Prometheus containers
- Ensure Prometheus is healthy: `curl http://prometheus:9090/-/healthy`
- Check Grafana datasource provisioning YAML syntax
- Verify Grafana has correct permissions to access Prometheus

### No Metrics Appearing
- Verify application is exposing `/metrics` endpoint
- Check that instrumentation middleware is correctly applied (order matters)
- Ensure metric names match dashboard queries exactly
- Check Prometheus scrape interval vs dashboard time range
- Use Prometheus expression browser to test queries directly
- Verify labels match what dashboards expect

### Alertmanager Not Sending Alerts
- Check Alertmanager is receiving alerts: `http://localhost:9093/#/alerts`
- Verify notification config (Slack webhook URL, email settings)
- Check alert routing matches severity labels
- Test with a synthetic always-firing alert
- Check Alertmanager logs for delivery errors

### High Cardinality Issues
- Warn if labels could have unbounded values (user IDs, request IDs)
- Suggest label value limits
- Check Prometheus memory usage and series count
- Recommend `metric_relabel_configs` to drop high-cardinality labels

## Safety Rules

- NEVER expose monitoring dashboards publicly without authentication
- NEVER include credentials (Slack webhooks, API keys) in committed files - use environment variables
- ALWAYS set resource limits on monitoring containers to prevent them from consuming all host resources
- ALWAYS use named volumes for Prometheus and Grafana data to prevent data loss
- ALWAYS set appropriate retention periods for metrics data (default 15d for Prometheus)
- WARN users about storage requirements for high-cardinality metrics
- For production setups, recommend Prometheus federation or Thanos for high availability
- Suggest Grafana RBAC and authentication setup for team environments
