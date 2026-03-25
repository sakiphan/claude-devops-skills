# GitLab CI Reference

## Basic Structure

```yaml
stages:
  - build
  - test
  - deploy

variables:
  NODE_VERSION: "22"

default:
  image: node:22-alpine
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
```

## Cache Configuration

```yaml
# Per-job cache with fallback
build:
  stage: build
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
    policy: pull-push  # pull, push, or pull-push
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour
```

## Docker-in-Docker

```yaml
build-image:
  stage: build
  image: docker:27
  services:
    - docker:27-dind
  variables:
    DOCKER_TLS_CERTDIR: "/certs"
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

## Using Kaniko (no privileged mode)

```yaml
build-image-kaniko:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:v1.23.2-debug
    entrypoint: [""]
  script:
    - /kaniko/executor
      --context $CI_PROJECT_DIR
      --dockerfile $CI_PROJECT_DIR/Dockerfile
      --destination $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

## Rules Syntax

```yaml
deploy-staging:
  stage: deploy
  rules:
    # Run on main branch pushes
    - if: $CI_COMMIT_BRANCH == "main"
      when: on_success
    # Run manually on tags
    - if: $CI_COMMIT_TAG
      when: manual
    # Never run on merge requests
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: never
  script:
    - echo "Deploying to staging..."
```

## Environment Management

```yaml
deploy-staging:
  stage: deploy
  environment:
    name: staging
    url: https://staging.example.com
  script:
    - ./deploy.sh staging

deploy-production:
  stage: deploy
  environment:
    name: production
    url: https://example.com
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
  allow_failure: false  # blocks pipeline until approved
  script:
    - ./deploy.sh production
```

## Artifacts and Reports

```yaml
test:
  stage: test
  script:
    - npm ci
    - npm test -- --coverage
  artifacts:
    paths:
      - coverage/
    reports:
      junit: test-results/junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    expire_in: 30 days
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'
```

## Templates and Includes

```yaml
# Include shared templates
include:
  # From another project
  - project: 'devops/ci-templates'
    ref: main
    file: '/templates/docker-build.yml'
  # From a URL
  - remote: 'https://example.com/ci-template.yml'
  # Local file
  - local: '/.gitlab/ci/test.yml'

# Define a reusable template
.deploy_template:
  image: alpine:3.20
  before_script:
    - apk add --no-cache curl
  script:
    - curl -X POST "$DEPLOY_WEBHOOK"

deploy-staging:
  extends: .deploy_template
  environment:
    name: staging

deploy-production:
  extends: .deploy_template
  environment:
    name: production
  when: manual
```

## Multi-Project Pipeline

```yaml
trigger-downstream:
  stage: deploy
  trigger:
    project: team/downstream-project
    branch: main
    strategy: depend  # wait for downstream to finish
```

## Parallel and Matrix

```yaml
test:
  stage: test
  parallel:
    matrix:
      - PYTHON_VERSION: ["3.11", "3.12", "3.13"]
        DB: ["postgres", "mysql"]
  image: python:${PYTHON_VERSION}-slim
  script:
    - pip install -r requirements.txt
    - pytest --db=$DB
```

## Complete Pipeline Example

```yaml
stages: [build, test, deploy]

variables:
  DOCKER_IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

build:
  stage: build
  image: docker:27
  services: [docker:27-dind]
  variables:
    DOCKER_TLS_CERTDIR: "/certs"
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build --cache-from $CI_REGISTRY_IMAGE:latest -t $DOCKER_IMAGE .
    - docker push $DOCKER_IMAGE

test:
  stage: test
  image: $DOCKER_IMAGE
  script:
    - npm test

deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  environment: { name: production, url: "https://app.example.com" }
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
  script:
    - kubectl set image deployment/app app=$DOCKER_IMAGE
```
