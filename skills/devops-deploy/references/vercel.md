# Vercel Deployment Reference

## Prerequisites

```bash
npm i -g vercel
vercel login
```

## Project Linking

```bash
vercel link
# Follow prompts to select scope and project
```

## Deploy

```bash
# Preview deployment (default)
vercel

# Production deployment
vercel --prod

# Deploy specific directory
vercel ./dist --prod
```

## Environment Variables

```bash
# Add variable (interactive - select environments)
vercel env add VARIABLE_NAME

# Add for specific environment
vercel env add VARIABLE_NAME production
echo "value" | vercel env add VARIABLE_NAME production

# List variables
vercel env ls

# Remove variable
vercel env rm VARIABLE_NAME production

# Pull env vars to local .env
vercel env pull .env.local
```

## Framework Configurations

### Next.js
No config needed - auto-detected. Ensure `next.config.js` exists.

### Vite
```json
// vercel.json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### Create React App
```json
// vercel.json
{
  "buildCommand": "react-scripts build",
  "outputDirectory": "build",
  "framework": "create-react-app"
}
```

### Custom Rewrites (SPA fallback)
```json
// vercel.json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Rollback

```bash
# List recent deployments
vercel ls

# Rollback to previous production deployment
vercel rollback

# Rollback to specific deployment
vercel rollback <deployment-url>
```

## Domain Management

```bash
# List domains
vercel domains ls

# Add domain
vercel domains add example.com

# Remove domain
vercel domains rm example.com

# Inspect domain DNS
vercel domains inspect example.com
```

## Useful Commands

```bash
# View deployment logs
vercel logs <deployment-url>

# List all deployments
vercel ls

# Remove a deployment
vercel rm <deployment-url>

# View project info
vercel inspect <deployment-url>
```
