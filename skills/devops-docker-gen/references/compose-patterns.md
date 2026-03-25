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
```
