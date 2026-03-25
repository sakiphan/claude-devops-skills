# Grafana Dashboard Reference

## Datasource Provisioning - datasources.yml

```yaml
# /etc/grafana/provisioning/datasources/datasources.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      timeInterval: "15s"
      httpMethod: POST
```

## Dashboard Provisioning - dashboards.yml

```yaml
# /etc/grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1
providers:
  - name: default
    orgId: 1
    folder: "Provisioned"
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
```

## Web App Dashboard - web-app.json

```json
{
  "dashboard": {
    "title": "Web App Overview",
    "uid": "web-app-overview",
    "refresh": "30s",
    "time": { "from": "now-1h", "to": "now" },
    "panels": [
      {
        "title": "Request Rate (req/s)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [{
          "expr": "sum(rate(http_requests_total[5m])) by (method)",
          "legendFormat": "{{ method }}"
        }]
      },
      {
        "title": "Error Rate (%)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
        "targets": [{
          "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100",
          "legendFormat": "5xx rate"
        }],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 1 },
                { "color": "red", "value": 5 }
              ]
            },
            "unit": "percent"
          }
        }
      },
      {
        "title": "Latency Histogram (p50 / p95 / p99)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "p99"
          }
        ],
        "fieldConfig": { "defaults": { "unit": "s" } }
      },
      {
        "title": "Active Connections",
        "type": "stat",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
        "targets": [{
          "expr": "sum(http_active_connections)",
          "legendFormat": "connections"
        }]
      }
    ]
  },
  "overwrite": true
}
```

## Infrastructure Dashboard - infrastructure.json

```json
{
  "dashboard": {
    "title": "Infrastructure",
    "uid": "infra-overview",
    "refresh": "30s",
    "panels": [
      {
        "title": "CPU Usage (%)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [{
          "expr": "100 - (avg by(instance)(rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
          "legendFormat": "{{ instance }}"
        }],
        "fieldConfig": { "defaults": { "unit": "percent", "max": 100 } }
      },
      {
        "title": "Memory Usage (%)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
        "targets": [{
          "expr": "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100",
          "legendFormat": "{{ instance }}"
        }],
        "fieldConfig": { "defaults": { "unit": "percent", "max": 100 } }
      },
      {
        "title": "Disk Usage (%)",
        "type": "gauge",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
        "targets": [{
          "expr": "100 - (node_filesystem_avail_bytes{mountpoint=\"/\"} / node_filesystem_size_bytes{mountpoint=\"/\"} * 100)",
          "legendFormat": "{{ instance }}"
        }],
        "fieldConfig": {
          "defaults": {
            "unit": "percent", "min": 0, "max": 100,
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 70 },
                { "color": "red", "value": 90 }
              ]
            }
          }
        }
      },
      {
        "title": "Network I/O (bytes/s)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
        "targets": [
          {
            "expr": "rate(node_network_receive_bytes_total{device!=\"lo\"}[5m])",
            "legendFormat": "{{ instance }} rx"
          },
          {
            "expr": "rate(node_network_transmit_bytes_total{device!=\"lo\"}[5m])",
            "legendFormat": "{{ instance }} tx"
          }
        ],
        "fieldConfig": { "defaults": { "unit": "Bps" } }
      }
    ]
  },
  "overwrite": true
}
```

## Import via API

```bash
# Import dashboard JSON
curl -X POST http://admin:admin@localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @web-app.json

# List dashboards
curl http://admin:admin@localhost:3000/api/search?type=dash-db
```
