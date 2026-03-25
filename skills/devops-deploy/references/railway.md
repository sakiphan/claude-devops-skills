# Railway Deployment Reference

## Prerequisites

```bash
# Install
npm i -g @railway/cli

# Or via brew
brew install railway

# Verify
railway --version
```

## Authentication

```bash
# Login (opens browser)
railway login

# Login with token (CI)
railway login --browserless

# Check auth status
railway whoami
```

## Project Linking

```bash
# Link to existing project (interactive)
railway link

# Create new project
railway init
```

## Deploy

```bash
# Deploy current directory
railway up

# Deploy with specific Dockerfile
railway up --dockerfile Dockerfile.prod

# Deploy and detach (don't follow logs)
railway up --detach
```

## Environment Variables

```bash
# Set variable
railway variables set KEY=value

# Set multiple variables
railway variables set KEY1=val1 KEY2=val2

# List variables
railway variables

# Delete variable
railway variables delete KEY
```

## Logs

```bash
# View recent logs
railway logs

# Follow/tail logs
railway logs --follow
```

## Domain Management

```bash
# Generate a Railway subdomain
railway domain

# Custom domains are managed via the Railway dashboard
# After adding, point your DNS CNAME to the provided target
```

## Other Useful Commands

```bash
# Open project in browser dashboard
railway open

# View project status
railway status

# Run command with Railway env vars injected
railway run <command>
# Example: railway run npm run db:migrate

# Connect to database service
railway connect
```

## Nixpacks Configuration (Build)

Railway uses Nixpacks by default. Override with `nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ["nodejs-18_x"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm run start"
```

Or use a `railway.toml`:

```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 5
```
