# CircleCI Reference

## Basic Structure

```yaml
version: 2.1

orbs:
  node: circleci/node@6
  docker: circleci/docker@2

executors:
  default:
    docker:
      - image: cimg/node:22.0

jobs:
  build:
    executor: default
    steps:
      - checkout
      - run: npm ci
      - run: npm run build

workflows:
  main:
    jobs:
      - build
```

## Common Orbs

```yaml
orbs:
  node: circleci/node@6         # Node.js setup, install, cache
  python: circleci/python@2     # Python setup, pip install
  docker: circleci/docker@2     # Docker build, push
  aws-cli: circleci/aws-cli@4   # AWS credential config
  gcp-cli: circleci/gcp-cli@3   # GCP credential config
  slack: circleci/slack@4       # Slack notifications
  terraform: circleci/terraform@3
```

## Caching

```yaml
jobs:
  build:
    executor: default
    steps:
      - checkout

      - restore_cache:
          keys:
            - deps-v1-{{ checksum "package-lock.json" }}
            - deps-v1-

      - run: npm ci

      - save_cache:
          key: deps-v1-{{ checksum "package-lock.json" }}
          paths:
            - node_modules

      - run: npm test
```

## Docker Executor vs Machine Executor

```yaml
jobs:
  # Docker executor: lightweight, no Docker daemon
  unit-test:
    docker:
      - image: cimg/python:3.13
      - image: cimg/postgres:17.0  # service container
        environment:
          POSTGRES_USER: test
          POSTGRES_DB: testdb
    steps:
      - checkout
      - run: pip install -r requirements.txt
      - run: pytest

  # Machine executor: full VM, has Docker daemon
  integration-test:
    machine:
      image: ubuntu-2404:current
    steps:
      - checkout
      - run: docker compose up -d
      - run: ./run-integration-tests.sh
```

## Workflows and Job Dependencies

```yaml
workflows:
  build-test-deploy:
    jobs:
      - build

      - unit-test:
          requires: [build]

      - integration-test:
          requires: [build]

      - deploy-staging:
          requires: [unit-test, integration-test]
          filters:
            branches:
              only: main

      - approve-prod:
          type: approval
          requires: [deploy-staging]

      - deploy-prod:
          requires: [approve-prod]
          context: production-secrets
```

## Contexts for Secrets

```yaml
# Contexts are configured in CircleCI UI (Organization Settings > Contexts)
# Reference them in workflow job definitions:
workflows:
  deploy:
    jobs:
      - deploy:
          context:
            - aws-credentials    # has AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
            - docker-hub         # has DOCKER_LOGIN, DOCKER_PASSWORD
```

## Artifacts and Test Results

```yaml
jobs:
  test:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - run: npm ci
      - run: npm test -- --reporters=default --reporters=jest-junit
      - store_test_results:
          path: test-results    # JUnit XML for CircleCI test insights
      - store_artifacts:
          path: coverage        # downloadable from UI
          destination: coverage-report
```

## Docker Build and Push

```yaml
jobs:
  build-and-push:
    docker:
      - image: cimg/base:current
    steps:
      - checkout
      - setup_remote_docker:
          docker_layer_caching: true  # paid feature
      - run: |
          echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_LOGIN" --password-stdin
          docker build -t myorg/myapp:${CIRCLE_SHA1} .
          docker push myorg/myapp:${CIRCLE_SHA1}

# Or with the Docker orb:
# jobs:
#   docker/publish:
#     image: myorg/myapp
#     tag: ${CIRCLE_SHA1}
```

## Reusable Commands

```yaml
commands:
  install-deps:
    description: "Install and cache dependencies"
    parameters:
      cache-version:
        type: string
        default: "v1"
    steps:
      - restore_cache:
          keys:
            - deps-<< parameters.cache-version >>-{{ checksum "package-lock.json" }}
      - run: npm ci
      - save_cache:
          key: deps-<< parameters.cache-version >>-{{ checksum "package-lock.json" }}
          paths: [node_modules]

jobs:
  build:
    executor: default
    steps:
      - checkout
      - install-deps:
          cache-version: "v2"
      - run: npm run build
```

## Scheduled Workflows

```yaml
workflows:
  nightly:
    triggers:
      - schedule:
          cron: "0 2 * * *"  # 2 AM UTC daily
          filters:
            branches:
              only: main
    jobs:
      - full-test-suite
```

## Complete Pipeline Example

```yaml
version: 2.1

orbs:
  node: circleci/node@6

executors:
  app:
    docker:
      - image: cimg/node:22.0

jobs:
  build:
    executor: app
    steps:
      - checkout
      - node/install-packages
      - run: npm run build
      - persist_to_workspace:
          root: .
          paths: [dist]

  test:
    executor: app
    steps:
      - checkout
      - node/install-packages
      - run: npm test
      - store_test_results:
          path: test-results

  deploy:
    executor: app
    steps:
      - checkout
      - attach_workspace:
          at: .
      - run: ./scripts/deploy.sh

workflows:
  pipeline:
    jobs:
      - build
      - test:
          requires: [build]
      - hold:
          type: approval
          requires: [test]
          filters: { branches: { only: main } }
      - deploy:
          requires: [hold]
          context: [production]
```
