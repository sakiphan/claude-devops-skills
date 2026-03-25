# GitHub Actions Reference

## Workflow Structure

```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Hello"
```

## Common Setup Actions (Pinned Versions)

```yaml
# Node.js with built-in caching
- uses: actions/setup-node@v4
  with:
    node-version: "22"
    cache: "pnpm"  # or npm, yarn

# Python with pip cache
- uses: actions/setup-python@v5
  with:
    python-version: "3.13"
    cache: "pip"

# Go with built-in cache
- uses: actions/setup-go@v5
  with:
    go-version: "1.23"

# Java
- uses: actions/setup-java@v4
  with:
    distribution: "temurin"
    java-version: "21"
    cache: "gradle"  # or maven
```

## Manual Cache (when built-in is insufficient)

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

## Matrix Strategy

```yaml
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [20, 22]
        exclude:
          - os: macos-latest
            node: 20
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
```

## Environment Protection

```yaml
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.example.com
    steps:
      - run: echo "Deploying..."
# Configure required reviewers in Settings > Environments
```

## Docker Build and Push

```yaml
jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Deploy to Vercel

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: ${{ github.ref == 'refs/heads/main' && '--prod' || '' }}
```

## Deploy to AWS (ECS example)

```yaml
jobs:
  deploy-aws:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy-role
          aws-region: us-east-1

      - uses: aws-actions/amazon-ecr-login@v2

      - run: |
          docker build -t $ECR_REGISTRY/myapp:${{ github.sha }} .
          docker push $ECR_REGISTRY/myapp:${{ github.sha }}

      - uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: task-def.json
          service: my-service
          cluster: my-cluster
          wait-for-service-stability: true
```

## Reusable Workflows

```yaml
# .github/workflows/reusable-build.yml
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: "22"
    secrets:
      NPM_TOKEN:
        required: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci && npm test

# Caller workflow:
# jobs:
#   build:
#     uses: ./.github/workflows/reusable-build.yml
#     with:
#       node-version: "22"
#     secrets: inherit
```

## Secret Management Best Practices

- Use OIDC (`id-token: write`) for cloud providers instead of long-lived keys.
- Scope secrets to environments (production, staging) for least privilege.
- Use `${{ secrets.NAME }}` -- masked in logs automatically.
- For org-wide secrets, use organization-level settings.
- Rotate secrets regularly; GitHub does not expire them automatically.

## .NET

```yaml
- uses: actions/setup-dotnet@v4
  with:
    dotnet-version: '9.0.x'

- run: dotnet restore
- run: dotnet build --no-restore
- run: dotnet test --no-build --verbosity normal --logger "trx;LogFileName=test-results.trx"
- run: dotnet publish -c Release -o ./publish --no-restore

# Cache NuGet packages
- uses: actions/cache@v4
  with:
    path: ~/.nuget/packages
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/*.csproj') }}
```

## PHP

```yaml
- uses: shivammathur/setup-php@v2
  with:
    php-version: '8.3'
    extensions: pdo_pgsql, redis
    coverage: xdebug
- run: composer install --no-interaction --prefer-dist
- run: php artisan test --parallel
# Cache
- uses: actions/cache@v4
  with:
    path: vendor
    key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}
```

## Elixir

```yaml
- uses: erlef/setup-beam@v1
  with:
    otp-version: '27.0'
    elixir-version: '1.17'
- run: mix deps.get
- run: mix compile --warnings-as-errors
- run: mix test
# Cache
- uses: actions/cache@v4
  with:
    path: |
      deps
      _build
    key: ${{ runner.os }}-mix-${{ hashFiles('**/mix.lock') }}
```
