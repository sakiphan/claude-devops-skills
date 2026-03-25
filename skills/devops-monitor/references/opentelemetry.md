# OpenTelemetry Reference

## OTel Collector Docker Compose Service

```yaml
otel-collector:
  image: otel/opentelemetry-collector-contrib:latest
  command: ["--config", "/etc/otel/config.yaml"]
  ports:
    - "4317:4317"   # OTLP gRPC
    - "4318:4318"   # OTLP HTTP
    - "8889:8889"   # Prometheus exporter
  volumes:
    - ./otel-collector-config.yaml:/etc/otel/config.yaml
  restart: unless-stopped
```

## Collector Config (otel-collector-config.yaml)

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 1024
  memory_limiter:
    check_interval: 1s
    limit_mib: 512

exporters:
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true
  prometheus:
    endpoint: "0.0.0.0:8889"
  logging:
    loglevel: info

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/jaeger]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [logging]
```

## Auto-Instrumentation: Node.js

```bash
npm install @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-grpc @opentelemetry/exporter-metrics-otlp-grpc
```

```bash
# Zero-code: run with --require flag
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 \
OTEL_SERVICE_NAME=my-node-app \
node --require @opentelemetry/auto-instrumentations-node/register app.js
```

## Auto-Instrumentation: Python

```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install  # auto-detect and install library instrumentations
```

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 \
OTEL_SERVICE_NAME=my-python-app \
opentelemetry-instrument python app.py
```

## Auto-Instrumentation: Go

```go
// go get go.opentelemetry.io/otel go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc
// go get go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp
exporter, _ := otlptracegrpc.New(ctx, otlptracegrpc.WithEndpoint("localhost:4317"), otlptracegrpc.WithInsecure())
tp := trace.NewTracerProvider(trace.WithBatcher(exporter))
otel.SetTracerProvider(tp)
// Wrap handlers: otelhttp.NewHandler(mux, "server")
```

## Auto-Instrumentation: C#/.NET

```bash
dotnet add package OpenTelemetry.AutoInstrumentation
# Set env vars: CORECLR_ENABLE_PROFILING=1, CORECLR_PROFILER={918728DD-259F-4A6A-AC2B-B85E1B658318}
# OTEL_DOTNET_AUTO_HOME=/opt/opentelemetry-dotnet-instrumentation
```

## OTLP Exporter Environment Variables

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc          # or http/protobuf
OTEL_SERVICE_NAME=my-service
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.version=1.2.0
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1               # sample 10% in production
```

## Backend Integration: Jaeger

```yaml
jaeger:
  image: jaegertracing/all-in-one:latest
  ports: ["16686:16686", "4317"]  # UI + OTLP gRPC
```

## Backend Integration: Grafana Tempo

```yaml
tempo:
  image: grafana/tempo:latest
  command: ["-config.file=/etc/tempo/config.yaml"]
  ports: ["3200:3200", "4317"]
  volumes: ["./tempo-config.yaml:/etc/tempo/config.yaml"]
```

## Backend Integration: Prometheus

```yaml
# In prometheus.yml, scrape the collector's metrics exporter
- job_name: 'otel-collector'
  static_configs:
    - targets: ['otel-collector:8889']
```
