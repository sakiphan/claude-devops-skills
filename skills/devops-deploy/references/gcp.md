# GCP Deployment Reference

## CLI Setup Check

```bash
gcloud --version
gcloud auth list
gcloud config get-value project
gcloud config get-value compute/region
```

## Cloud Run

```bash
# Deploy from source (builds automatically)
gcloud run deploy my-service \
  --source . \
  --region us-central1 \
  --allow-unauthenticated

# Deploy from container image
gcloud run deploy my-service \
  --image gcr.io/PROJECT_ID/my-app:latest \
  --region us-central1 \
  --port 8080 \
  --allow-unauthenticated

# Set env vars during deploy
gcloud run deploy my-service \
  --image gcr.io/PROJECT_ID/my-app:latest \
  --set-env-vars "KEY1=val1,KEY2=val2"

# Update env vars on existing service
gcloud run services update my-service \
  --update-env-vars "KEY1=newval"

# View service URL
gcloud run services describe my-service --format="value(status.url)"
```

## App Engine

```bash
# Deploy (reads app.yaml)
gcloud app deploy

# Deploy specific config
gcloud app deploy app.yaml

# View app
gcloud app browse

# Stream logs
gcloud app logs tail -s default

# Manage traffic between versions
gcloud app services set-traffic default \
  --splits v1=0.5,v2=0.5
```

### Minimal app.yaml
```yaml
runtime: nodejs20
instance_class: F1
env_variables:
  NODE_ENV: "production"
```

## Cloud Functions

```bash
# Deploy HTTP function
gcloud functions deploy my-function \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point handler \
  --region us-central1

# Deploy with env vars
gcloud functions deploy my-function \
  --set-env-vars "KEY=value" \
  --runtime nodejs20 \
  --trigger-http

# Deploy Gen2 function
gcloud functions deploy my-function \
  --gen2 \
  --runtime nodejs20 \
  --trigger-http \
  --region us-central1
```

## Container Registry / Artifact Registry

```bash
# Configure Docker for GCR
gcloud auth configure-docker

# Configure for Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push to GCR
docker build -t gcr.io/PROJECT_ID/my-app:latest .
docker push gcr.io/PROJECT_ID/my-app:latest

# Build and push to Artifact Registry
docker build -t us-central1-docker.pkg.dev/PROJECT_ID/my-repo/my-app:latest .
docker push us-central1-docker.pkg.dev/PROJECT_ID/my-repo/my-app:latest
```

## Secrets Management

```bash
# Create secret
echo -n "secret-value" | gcloud secrets create MY_SECRET --data-file=-

# Access secret
gcloud secrets versions access latest --secret=MY_SECRET

# Mount secret in Cloud Run
gcloud run deploy my-service \
  --set-secrets "ENV_VAR=MY_SECRET:latest"

# List secrets
gcloud secrets list
```
