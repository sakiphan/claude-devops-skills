# Dockerfile Patterns by Language

## Node.js (npm/pnpm)

```dockerfile
# --- Build stage ---
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm (remove if using npm)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy lockfile first for layer caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# --- Production stage ---
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Python (pip + venv)

```dockerfile
# --- Build stage ---
FROM python:3.13-slim AS builder
WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# --- Production stage ---
FROM python:3.13-slim AS production
WORKDIR /app

# Copy virtual env from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY --from=builder /app .

# Non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser

EXPOSE 8000
CMD ["gunicorn", "app.main:app", "--bind", "0.0.0.0:8000", "--workers", "4"]
```

## Go (distroless runtime)

```dockerfile
# --- Build stage ---
FROM golang:1.23-alpine AS builder
WORKDIR /app

# Cache module downloads
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Static binary, no CGO
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server

# --- Production stage ---
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app/server /server

EXPOSE 8080
ENTRYPOINT ["/server"]
```

## Rust (cargo-chef + musl)

```dockerfile
# --- Chef stage: compute recipe ---
FROM rust:1.82-alpine AS chef
RUN apk add --no-cache musl-dev
RUN cargo install cargo-chef
WORKDIR /app

# --- Planner: generate recipe.json ---
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# --- Builder: build with cached deps ---
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies (cached if recipe unchanged)
RUN cargo chef cook --release --recipe-path recipe.json --target x86_64-unknown-linux-musl
COPY . .
RUN cargo build --release --target x86_64-unknown-linux-musl

# --- Production stage ---
FROM scratch
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/myapp /myapp

EXPOSE 8080
ENTRYPOINT ["/myapp"]
```

## Java / Spring Boot (Gradle)

```dockerfile
# --- Build stage ---
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

# Cache Gradle wrapper and dependencies
COPY gradle/ gradle/
COPY gradlew build.gradle.kts settings.gradle.kts ./
RUN ./gradlew dependencies --no-daemon

COPY src/ src/
RUN ./gradlew bootJar --no-daemon -x test

# --- Production stage ---
FROM eclipse-temurin:21-jre-alpine AS production
WORKDIR /app

# Extract Spring Boot layered JAR for better caching
COPY --from=builder /app/build/libs/*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

## Java / Spring Boot (Maven variant)

```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

COPY pom.xml mvnw ./
COPY .mvn .mvn
RUN ./mvnw dependency:go-offline -B

COPY src/ src/
RUN ./mvnw package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine AS production
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

## C# / ASP.NET Core

```dockerfile
# --- Build stage ---
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Restore dependencies (cached layer)
COPY *.csproj ./
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

# --- Production stage ---
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS production
WORKDIR /app

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/publish .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "MyApp.dll"]
```

## PHP (Laravel)

```dockerfile
FROM php:8.3-fpm-alpine AS build
WORKDIR /app
RUN apk add --no-cache postgresql-dev && docker-php-ext-install pdo_pgsql opcache
COPY composer.json composer.lock ./
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install --no-dev --no-scripts --optimize-autoloader
COPY . .
RUN composer dump-autoload --optimize

FROM php:8.3-fpm-alpine AS production
WORKDIR /app
RUN apk add --no-cache postgresql-dev && docker-php-ext-install pdo_pgsql opcache
COPY --from=build /app /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app/storage /app/bootstrap/cache
USER appuser
EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD php-fpm-healthcheck || exit 1
CMD ["php-fpm"]
```

## Elixir (Phoenix)

```dockerfile
FROM elixir:1.17-alpine AS build
WORKDIR /app
ENV MIX_ENV=prod
RUN mix local.hex --force && mix local.rebar --force
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod && mix deps.compile
COPY . .
RUN mix assets.deploy && mix compile && mix release

FROM alpine:3.20 AS production
WORKDIR /app
RUN apk add --no-cache libstdc++ libgcc ncurses-libs
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build /app/_build/prod/rel/my_app ./
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["bin/my_app", "start"]
```
