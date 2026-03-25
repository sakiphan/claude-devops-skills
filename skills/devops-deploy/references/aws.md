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

## IAM Role for Deployment

```bash
# Create ECS task execution role
aws iam create-role --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

# Attach the managed ECS task execution policy
aws iam attach-role-policy --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Create a task role for application-level permissions (S3, SQS, etc.)
aws iam create-role --role-name ecsTaskRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

# Attach application-specific policies to the task role
aws iam attach-role-policy --role-name ecsTaskRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

## Lambda with Layers

```bash
# Package dependencies as a Lambda layer
cd /tmp && mkdir -p nodejs
cp -r /path/to/project/node_modules nodejs/
zip -r layer.zip nodejs/

# Publish the layer
aws lambda publish-layer-version \
  --layer-name my-deps \
  --zip-file fileb://layer.zip \
  --compatible-runtimes nodejs20.x

# Attach the layer to a function (use the LayerVersionArn from the publish output)
aws lambda update-function-configuration \
  --function-name myFunc \
  --layers arn:aws:lambda:us-east-1:123456789:layer:my-deps:1

# Update function code separately from layers
zip -r function.zip index.mjs
aws lambda update-function-code \
  --function-name myFunc \
  --zip-file fileb://function.zip
```

## CloudWatch Monitoring

```bash
# Create a log group for ECS service logs
aws logs create-log-group --log-group-name /ecs/myapp
aws logs put-retention-policy --log-group-name /ecs/myapp --retention-in-days 30

# Create a high error rate alarm (5XX errors on ALB)
aws cloudwatch put-metric-alarm --alarm-name high-error-rate \
  --metric-name HTTPCode_ELB_5XX_Count --namespace AWS/ApplicationELB \
  --statistic Sum --period 300 --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:ops-alerts \
  --dimensions Name=LoadBalancer,Value=app/my-alb/1234567890

# Create a high CPU alarm for ECS service
aws cloudwatch put-metric-alarm --alarm-name ecs-high-cpu \
  --metric-name CPUUtilization --namespace AWS/ECS \
  --statistic Average --period 300 --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:ops-alerts \
  --dimensions Name=ClusterName,Value=my-cluster Name=ServiceName,Value=my-service

# Query recent logs with CloudWatch Logs Insights
aws logs start-query \
  --log-group-name /ecs/myapp \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 50'
```

## Secrets Manager

```bash
# Create a secret
aws secretsmanager create-secret \
  --name myapp/prod/db-url \
  --secret-string "postgresql://user:pass@db.example.com:5432/myapp"

# Retrieve a secret
aws secretsmanager get-secret-value --secret-id myapp/prod/db-url

# Rotate a secret value
aws secretsmanager update-secret \
  --secret-id myapp/prod/db-url \
  --secret-string "postgresql://user:newpass@db.example.com:5432/myapp"

# In ECS task definition JSON, reference secrets with valueFrom:
# "secrets": [
#   {
#     "name": "DATABASE_URL",
#     "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:myapp/prod/db-url"
#   }
# ]
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
