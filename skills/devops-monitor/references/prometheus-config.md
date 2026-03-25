# Prometheus Configuration Reference

## prometheus.yml - Complete Config

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  scrape_timeout: 10s

rule_files:
  - "alert_rules.yml"
  - "recording_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  # Prometheus self-monitoring
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  # Node exporter (host metrics)
  - job_name: "node"
    static_configs:
      - targets: ["node-exporter:9100"]

  # Application servers
  - job_name: "app"
    metrics_path: /metrics
    static_configs:
      - targets: ["app1:3000", "app2:3000"]
    relabel_configs:
      - source_labels: [__address__]
        regex: "(.+):.*"
        target_label: instance
        replacement: "$1"

  # Kubernetes service discovery
  - job_name: "k8s-pods"
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod

  # Docker service discovery
  - job_name: "docker"
    dockerswarm_sd_configs:
      - host: unix:///var/run/docker.sock
        role: tasks
    relabel_configs:
      - source_labels: [__meta_dockerswarm_service_label_prometheus_scrape]
        action: keep
        regex: true
```

## Alert Rules - alert_rules.yml

```yaml
groups:
  - name: app_alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error rate above 5% ({{ $value | humanizePercentage }})"

      - alert: HighP99Latency
        expr: |
          histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
          > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency above 1s ({{ $value | humanizeDuration }})"

      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.job }}/{{ $labels.instance }} is down"

  - name: infra_alerts
    rules:
      - alert: HighCPU
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "CPU above 80% on {{ $labels.instance }}"

      - alert: HighMemory
        expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Memory above 90% on {{ $labels.instance }}"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space below 10% on {{ $labels.instance }}"
```

## Recording Rules - recording_rules.yml

```yaml
groups:
  - name: request_rates
    interval: 15s
    rules:
      - record: job:http_requests_total:rate5m
        expr: sum(rate(http_requests_total[5m])) by (job)

      - record: job:http_requests_errors:rate5m
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) by (job)

      - record: job:http_request_duration_seconds:p99
        expr: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job))

      - record: job:http_request_duration_seconds:p50
        expr: histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job))

      - record: instance:node_cpu_utilization:ratio
        expr: 1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))
```

## Relabeling Cheatsheet

```yaml
# Drop a label
- action: labeldrop
  regex: "unwanted_label"

# Keep only targets with a specific label
- source_labels: [env]
  action: keep
  regex: "production|staging"

# Rename a label
- source_labels: [old_name]
  target_label: new_name
  action: replace

# Hash-based sharding (for HA pairs)
- source_labels: [__address__]
  modulus: 2
  target_label: __tmp_hash
  action: hashmod
- source_labels: [__tmp_hash]
  regex: ^0$
  action: keep
```
