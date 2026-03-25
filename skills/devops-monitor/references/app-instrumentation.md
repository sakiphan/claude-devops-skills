# Application Instrumentation Reference

## Node.js (prom-client)

```bash
npm install prom-client
```

### Express Middleware

```javascript
const client = require('prom-client');

// Collect default metrics (CPU, memory, event loop, GC)
client.collectDefaultMetrics({ prefix: 'app_' });

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const httpTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const activeConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active connections',
});

// Express middleware
function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next();
  activeConnections.inc();
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    const labels = { method: req.method, route, status: res.statusCode };
    end(labels);
    httpTotal.inc(labels);
    activeConnections.dec();
  });
  next();
}

app.use(metricsMiddleware);
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

### Fastify Plugin

```javascript
const client = require('prom-client');
client.collectDefaultMetrics({ prefix: 'app_' });

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

fastify.addHook('onRequest', (req, reply, done) => {
  req.startTime = process.hrtime.bigint();
  done();
});

fastify.addHook('onResponse', (req, reply, done) => {
  const duration = Number(process.hrtime.bigint() - req.startTime) / 1e9;
  httpDuration.observe(
    { method: req.method, route: req.routeOptions?.url || req.url, status: reply.statusCode },
    duration
  );
  done();
});

fastify.get('/metrics', async () => client.register.metrics());
```

## Python (prometheus_client)

```bash
pip install prometheus-client
```

### Flask

```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from flask import Flask, request, g
import time

app = Flask(__name__)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds', 'HTTP request duration',
    ['method', 'endpoint', 'status'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
)
REQUEST_TOTAL = Counter(
    'http_requests_total', 'Total HTTP requests',
    ['method', 'endpoint', 'status']
)
ACTIVE = Gauge('http_active_connections', 'Active connections')

@app.before_request
def before_request():
    g.start_time = time.perf_counter()
    ACTIVE.inc()

@app.after_request
def after_request(response):
    if request.path != '/metrics':
        duration = time.perf_counter() - g.start_time
        labels = [request.method, request.endpoint or request.path, response.status_code]
        REQUEST_DURATION.labels(*labels).observe(duration)
        REQUEST_TOTAL.labels(*labels).inc()
    ACTIVE.dec()
    return response

@app.route('/metrics')
def metrics():
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}
```

### FastAPI

```python
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi import FastAPI, Request, Response
import time

app = FastAPI()

DURATION = Histogram(
    'http_request_duration_seconds', 'Request duration',
    ['method', 'path', 'status'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1, 5]
)
TOTAL = Counter('http_requests_total', 'Total requests', ['method', 'path', 'status'])

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    if request.url.path != "/metrics":
        duration = time.perf_counter() - start
        labels = [request.method, request.url.path, response.status_code]
        DURATION.labels(*labels).observe(duration)
        TOTAL.labels(*labels).inc()
    return response

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

## Go (prometheus/client_golang)

```bash
go get github.com/prometheus/client_golang/prometheus
go get github.com/prometheus/client_golang/prometheus/promhttp
```

```go
package main

import (
    "net/http"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    httpDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "http_request_duration_seconds",
        Help:    "HTTP request duration in seconds",
        Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
    }, []string{"method", "path", "status"})

    httpTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
        Name: "http_requests_total",
        Help: "Total HTTP requests",
    }, []string{"method", "path", "status"})
)

func init() {
    prometheus.MustRegister(httpDuration, httpTotal)
}

func metricsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path == "/metrics" {
            next.ServeHTTP(w, r)
            return
        }
        timer := prometheus.NewTimer(prometheus.ObserverFunc(func(v float64) {
            httpDuration.WithLabelValues(r.Method, r.URL.Path, "200").Observe(v)
        }))
        httpTotal.WithLabelValues(r.Method, r.URL.Path, "200").Inc()
        next.ServeHTTP(w, r)
        timer.ObserveDuration()
    })
}

func main() {
    mux := http.NewServeMux()
    mux.Handle("/metrics", promhttp.Handler())
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("ok"))
    })
    http.ListenAndServe(":8080", metricsMiddleware(mux))
}
```

## C# / ASP.NET Core (prometheus-net)

Install: `dotnet add package prometheus-net.AspNetCore`

```csharp
// Program.cs
using Prometheus;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// HTTP metrics middleware
app.UseHttpMetrics(options =>
{
    options.AddCustomLabel("host", context => context.Request.Host.Host);
});

app.MapMetrics(); // Exposes /metrics endpoint

// Custom metrics
var requestCounter = Metrics.CreateCounter(
    "myapp_requests_total",
    "Total requests",
    new CounterConfiguration { LabelNames = new[] { "method", "endpoint" } }
);

var requestDuration = Metrics.CreateHistogram(
    "myapp_request_duration_seconds",
    "Request duration in seconds",
    new HistogramConfiguration
    {
        Buckets = Histogram.ExponentialBuckets(0.01, 2, 10)
    }
);

app.MapGet("/api/users", () =>
{
    requestCounter.WithLabels("GET", "/api/users").Inc();
    return Results.Ok(new[] { "user1", "user2" });
});

app.Run();
```

Default metrics exposed:
- `dotnet_collection_count_total` - GC collection count
- `dotnet_total_memory_bytes` - Total managed memory
- `process_cpu_seconds_total` - CPU usage
- `http_request_duration_seconds` - HTTP request latency (via middleware)
- `http_requests_in_progress` - In-flight requests
