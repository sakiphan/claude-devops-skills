# Fly.io Deployment Reference

## Prerequisites

```bash
# Install
curl -L https://fly.io/install.sh | sh

# Verify
flyctl version

# Login
fly auth login
```

## First Deploy

```bash
# Initialize and configure (creates fly.toml)
fly launch

# Launch with specific settings
fly launch --name my-app --region ord --no-deploy
```

## Subsequent Deploys

```bash
# Deploy current directory
fly deploy

# Deploy specific Dockerfile
fly deploy --dockerfile Dockerfile.prod

# Deploy specific image
fly deploy --image my-registry/my-app:latest

# Deploy without building (remote builder)
fly deploy --local-only
```

## Scaling

```bash
# Scale VM count
fly scale count 3

# Scale VM size
fly scale vm shared-cpu-1x --memory 512

# Show current scale
fly scale show

# Scale to zero (pause app)
fly scale count 0

# Autoscale
fly autoscale set min=1 max=5
```

## Secrets

```bash
# Set secret (triggers redeploy)
fly secrets set DATABASE_URL="postgres://..."

# Set multiple secrets
fly secrets set KEY1=val1 KEY2=val2

# List secrets (names only)
fly secrets list

# Remove secret
fly secrets unset KEY1

# Set secret without redeploying
fly secrets set KEY=val --stage
fly deploy  # deploy when ready
```

## Logs

```bash
# Tail live logs
fly logs

# Filter by region
fly logs --region ord
```

## Health Checks & Status

```bash
# App status
fly status

# Check app health
fly checks list

# View app info
fly info

# SSH into running machine
fly ssh console

# Restart app
fly apps restart
```

## Regions

```bash
# List current regions
fly regions list

# Add region
fly regions add ord ams

# Remove region
fly regions remove ams

# Set primary region
fly regions set ord
```

## Useful fly.toml Sections

```toml
app = "my-app"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_start_machines = true
  auto_stop_machines = true

[[http_service.checks]]
  interval = "10s"
  timeout = "2s"
  grace_period = "5s"
  method = "get"
  path = "/health"
```
