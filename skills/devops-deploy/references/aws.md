# AWS Deployment Reference

## CLI Setup Check

```bash
aws --version
aws sts get-caller-identity
# Verify correct account and region
aws configure get region
```

## ECS (Elastic Container Service)

```bash
# Force new deployment with current task definition
aws ecs update-service \
  --cluster my-cluster \
  --service my-service \
  --force-new-deployment

# Update service with new task definition
aws ecs update-service \
  --cluster my-cluster \
  --service my-service \
  --task-definition my-task-def:latest

# Wait for service stability
aws ecs wait services-stable \
  --cluster my-cluster \
  --services my-service
```

## Lambda

```bash
# Zip and deploy
zip -r function.zip . -x "*.git*"
aws lambda update-function-code \
  --function-name my-function \
  --zip-file fileb://function.zip

# SAM deploy
sam build
sam deploy --guided          # first time
sam deploy                   # subsequent
```

## S3 + CloudFront (Static Sites)

```bash
# Sync build output to S3
aws s3 sync ./dist s3://my-bucket \
  --delete \
  --cache-control "public, max-age=31536000"

# Upload index.html with no-cache
aws s3 cp ./dist/index.html s3://my-bucket/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890 \
  --paths "/*"
```

## Elastic Beanstalk

```bash
# Initialize (first time)
eb init

# Deploy
eb deploy

# Deploy specific environment
eb deploy my-env

# View status
eb status

# View logs
eb logs
```

## ECR (Container Registry)

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

# Build, tag, push
docker build -t my-app .
docker tag my-app:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
```

## Environment Variables (SSM Parameter Store)

```bash
# Set parameter
aws ssm put-parameter \
  --name "/myapp/prod/DB_HOST" \
  --value "db.example.com" \
  --type SecureString \
  --overwrite

# Get parameter
aws ssm get-parameter \
  --name "/myapp/prod/DB_HOST" \
  --with-decryption

# List parameters by path
aws ssm get-parameters-by-path \
  --path "/myapp/prod/" \
  --with-decryption
```
