# Docker Compose Service Patterns

All services below use Compose v2 syntax. Combine as needed.

## PostgreSQL

```yaml
postgres:
  image: postgres:17-alpine
  restart: unless-stopped
  environment:
    POSTGRES_DB: appdb
    POSTGRES_USER: appuser
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./init-scripts:/docker-entrypoint-initdb.d
  ports:
    - "5432:5432"
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U appuser -d appdb"]
    interval: 10s
    timeout: 5s
    retries: 5
  deploy:
    resources:
      limits:
        memory: 512M
```

## MySQL

```yaml
mysql:
  image: mysql:8.4
  restart: unless-stopped
  environment:
    MYSQL_DATABASE: appdb
    MYSQL_USER: appuser
    MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
  volumes:
    - mysql_data:/var/lib/mysql
  ports:
    - "3306:3306"
  healthcheck:
    test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "appuser", "-p${MYSQL_PASSWORD}"]
    interval: 10s
    timeout: 5s
    retries: 5
  deploy:
    resources:
      limits:
        memory: 512M
```

## MongoDB

```yaml
mongo:
  image: mongo:7
  restart: unless-stopped
  environment:
    MONGO_INITDB_ROOT_USERNAME: admin
    MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    MONGO_INITDB_DATABASE: appdb
  volumes:
    - mongo_data:/data/db
  ports:
    - "27017:27017"
  healthcheck:
    test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
    interval: 10s
    timeout: 5s
    retries: 5
  deploy:
    resources:
      limits:
        memory: 512M
```

## Redis

```yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
  volumes:
    - redis_data:/data
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
  deploy:
    resources:
      limits:
        memory: 256M
```

## RabbitMQ

```yaml
rabbitmq:
  image: rabbitmq:3-management-alpine
  restart: unless-stopped
  environment:
    RABBITMQ_DEFAULT_USER: appuser
    RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
  ports:
    - "5672:5672"
    - "15672:15672"
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "check_running"]
    interval: 15s
    timeout: 10s
    retries: 5
  deploy:
    resources:
      limits:
        memory: 512M
```

## Elasticsearch

```yaml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.17.0
  restart: unless-stopped
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - ES_JAVA_OPTS=-Xms512m -Xmx512m
  volumes:
    - es_data:/usr/share/elasticsearch/data
  ports:
    - "9200:9200"
  healthcheck:
    test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
    interval: 15s
    timeout: 10s
    retries: 5
  deploy:
    resources:
      limits:
        memory: 1G
```

## Nginx Reverse Proxy

```yaml
nginx:
  image: nginx:1.27-alpine
  restart: unless-stopped
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/conf.d:/etc/nginx/conf.d:ro
  ports:
    - "80:80"
    - "443:443"
  healthcheck:
    test: ["CMD", "nginx", "-t"]
    interval: 30s
    timeout: 5s
    retries: 3
  depends_on:
    app:
      condition: service_healthy
  deploy:
    resources:
      limits:
        memory: 128M
```

## Traefik Reverse Proxy

```yaml
traefik:
  image: traefik:v3.2
  restart: unless-stopped
  command:
    - "--api.dashboard=true"
    - "--providers.docker=true"
    - "--providers.docker.exposedbydefault=false"
    - "--entrypoints.web.address=:80"
    - "--entrypoints.websecure.address=:443"
    - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
    - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - traefik_certs:/letsencrypt
  ports:
    - "80:80"
    - "443:443"
  healthcheck:
    test: ["CMD", "traefik", "healthcheck"]
    interval: 15s
    timeout: 5s
    retries: 3
  deploy:
    resources:
      limits:
        memory: 128M

# Example app service with Traefik labels:
# app:
#   labels:
#     - "traefik.enable=true"
#     - "traefik.http.routers.app.rule=Host(`app.example.com`)"
#     - "traefik.http.routers.app.entrypoints=websecure"
#     - "traefik.http.routers.app.tls.certresolver=letsencrypt"
```

## Kafka + Zookeeper

```yaml
zookeeper:
  image: confluentinc/cp-zookeeper:7.7.0
  restart: unless-stopped
  environment:
    ZOOKEEPER_CLIENT_PORT: 2181
    ZOOKEEPER_TICK_TIME: 2000
  volumes:
    - zookeeper_data:/var/lib/zookeeper/data
  healthcheck:
    test: ["CMD", "nc", "-z", "localhost", "2181"]
    interval: 10s
    timeout: 5s
    retries: 5
  deploy:
    resources:
      limits:
        memory: 512M

kafka:
  image: confluentinc/cp-kafka:7.7.0
  restart: unless-stopped
  depends_on:
    zookeeper:
      condition: service_healthy
  environment:
    KAFKA_BROKER_ID: 1
    KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
  ports:
    - "9092:9092"
  volumes:
    - kafka_data:/var/lib/kafka/data
  healthcheck:
    test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "localhost:9092"]
    interval: 15s
    timeout: 10s
    retries: 5
  deploy:
    resources:
      limits:
        memory: 1G
```

## MinIO (S3-Compatible Storage)

```yaml
minio:
  image: minio/minio:RELEASE.2024-01-01T00-00-00Z
  restart: unless-stopped
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_USER:-minioadmin}
    MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
  volumes:
    - minio_data:/data
  ports:
    - "9000:9000"
    - "9001:9001"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 15s
    timeout: 5s
    retries: 3
  deploy:
    resources:
      limits:
        memory: 512M
```

## Background Worker

```yaml
# Generic worker pattern — adapt command for your framework:
#   Node.js:  npm run worker
#   Python:   celery -A app worker --loglevel=info
#   Ruby:     bundle exec sidekiq
#   Go:       /app/worker
worker:
  build: .
  command: npm run worker
  restart: unless-stopped
  init: true
  depends_on:
    redis:
      condition: service_healthy
  environment:
    - QUEUE_NAME=default
    - WORKER_CONCURRENCY=4
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"

# Scheduler/cron companion (Python Celery Beat example):
# scheduler:
#   build: .
#   command: celery -A app beat --loglevel=info
#   depends_on:
#     redis:
#       condition: service_healthy
```

## Network Isolation

```yaml
# Separate frontend/backend networks for security
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge

# Usage in services:
# nginx:
#   networks: [frontend, backend]
# app:
#   networks: [backend]
# postgres:
#   networks: [backend]
```

## Logging Configuration

```yaml
# Add to every production service to prevent unbounded log growth.
# Use a YAML anchor to avoid repetition across services.
x-logging: &default-logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"    # rotate after 10MB
      max-file: "3"      # keep 3 rotated files

# Usage — merge into any service:
# services:
#   app:
#     <<: *default-logging
#     image: myapp:latest
#   worker:
#     <<: *default-logging
#     image: myapp:latest
#     command: npm run worker
```

## PID 1 Signal Handling (init: true)

```yaml
# Containers run the app as PID 1 by default. Most apps do NOT handle
# SIGTERM/SIGCHLD properly as PID 1, causing slow shutdowns (10s timeout)
# and zombie processes. Adding `init: true` inserts tini as PID 1.
services:
  app:
    build: .
    init: true   # Adds tini as PID 1 — proper signal forwarding & zombie reaping
    restart: unless-stopped
```

## Volumes (declare at bottom of compose file)

```yaml
volumes:
  postgres_data:
  mysql_data:
  mongo_data:
  redis_data:
  rabbitmq_data:
  es_data:
  traefik_certs:
  zookeeper_data:
  kafka_data:
  minio_data:
```
