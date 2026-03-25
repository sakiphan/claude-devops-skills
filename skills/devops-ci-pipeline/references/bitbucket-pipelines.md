# Bitbucket Pipelines Reference

## File Location

Pipeline config goes in `bitbucket-pipelines.yml` at the repo root.

## Basic Structure

```yaml
image: node:20

definitions:
  caches:
    custom-cache: ~/.my-cache
  services:
    docker:
      memory: 2048

pipelines:
  default:
    - step:
        name: Build and Test
        caches:
          - node
        script:
          - npm ci
          - npm run lint
          - npm test
          - npm run build
        artifacts:
          - dist/**

  branches:
    main:
      - step:
          name: Deploy to Production
          deployment: production
          trigger: manual
          script:
            - pipe: atlassian/aws-ecs-deploy:1.0.0
              variables:
                CLUSTER_NAME: "prod-cluster"
                SERVICE_NAME: "my-service"
```

## Pipeline Triggers

| Trigger | Syntax |
|---------|--------|
| All branches | `default:` |
| Specific branch | `branches: { main: [...] }` |
| Pull requests | `pull-requests: { '**': [...] }` |
| Tags | `tags: { 'v*': [...] }` |
| Custom/manual | `custom: { deploy: [...] }` |

## Built-in Caches

| Cache | Path |
|-------|------|
| `node` | `node_modules` |
| `pip` | `~/.cache/pip` |
| `composer` | `~/.composer/cache` |
| `dotnet` | `~/.nuget/packages` |
| `maven` | `~/.m2/repository` |
| `gradle` | `~/.gradle/caches` |
| `docker` | Docker layer cache |

## Step Options

```yaml
- step:
    name: Step Name
    image: python:3.12        # Override global image
    size: 2x                  # Double memory (4096 -> 8192 MB)
    caches:
      - node
    script:
      - echo "commands here"
    artifacts:
      - dist/**
      - reports/*.xml
    after-script:
      - echo "runs even if step fails"
```

## Parallel Steps

```yaml
- parallel:
    - step:
        name: Lint
        script:
          - npm run lint
    - step:
        name: Test
        script:
          - npm test
```

## Deployment Environments

```yaml
- step:
    name: Deploy Staging
    deployment: staging        # test, staging, or production
    script:
      - ./deploy.sh staging

- step:
    name: Deploy Production
    deployment: production
    trigger: manual            # Require manual approval
    script:
      - ./deploy.sh production
```

## Docker Build and Push

```yaml
- step:
    name: Build Docker Image
    services:
      - docker
    caches:
      - docker
    script:
      - docker build -t my-app:$BITBUCKET_COMMIT .
      - pipe: atlassian/bitbucket-pipe-release/docker-push:1.0.0
        variables:
          IMAGE: my-app
          TAGS: "$BITBUCKET_COMMIT latest"
```

## Common Pipes

```yaml
# AWS ECS Deploy
- pipe: atlassian/aws-ecs-deploy:1.0.0
  variables:
    CLUSTER_NAME: "my-cluster"
    SERVICE_NAME: "my-service"
    TASK_DEFINITION: "task-def.json"

# AWS S3 Deploy
- pipe: atlassian/aws-s3-deploy:1.4.0
  variables:
    S3_BUCKET: "my-bucket"
    LOCAL_PATH: "dist"

# Slack Notify
- pipe: atlassian/slack-notify:2.0.0
  variables:
    WEBHOOK_URL: $SLACK_WEBHOOK
    MESSAGE: "Deployment complete"
```

## Size Limits

| Size | Memory | Use Case |
|------|--------|----------|
| `1x` (default) | 4096 MB | Standard builds |
| `2x` | 8192 MB | Large builds, Docker-in-Docker |

Total pipeline minutes are limited per plan (50-3500/month).

## Complete Node.js Example

```yaml
image: node:20

definitions:
  services:
    docker:
      memory: 2048

pipelines:
  default:
    - parallel:
        - step:
            name: Lint
            caches:
              - node
            script:
              - npm ci
              - npm run lint
        - step:
            name: Test
            caches:
              - node
            script:
              - npm ci
              - npm test
            artifacts:
              - coverage/**

    - step:
        name: Build
        caches:
          - node
        script:
          - npm ci
          - npm run build
        artifacts:
          - dist/**

  branches:
    main:
      - parallel:
          - step:
              name: Lint
              caches:
                - node
              script:
                - npm ci
                - npm run lint
          - step:
              name: Test
              caches:
                - node
              script:
                - npm ci
                - npm test

      - step:
          name: Build & Push Docker
          services:
            - docker
          caches:
            - docker
          script:
            - docker build -t my-app:$BITBUCKET_COMMIT .
            - docker tag my-app:$BITBUCKET_COMMIT registry.example.com/my-app:latest
            - docker push registry.example.com/my-app:$BITBUCKET_COMMIT
            - docker push registry.example.com/my-app:latest

      - step:
          name: Deploy Staging
          deployment: staging
          script:
            - ./deploy.sh staging

      - step:
          name: Deploy Production
          deployment: production
          trigger: manual
          script:
            - ./deploy.sh production
```
