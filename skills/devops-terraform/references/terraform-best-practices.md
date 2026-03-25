# Terraform Best Practices Reference

## File Organization

```
infrastructure/
  modules/
    vpc/
      main.tf
      variables.tf
      outputs.tf
    ecs-service/
      main.tf
      variables.tf
      outputs.tf
  environments/
    prod/
      main.tf          # Calls modules
      variables.tf
      terraform.tfvars  # Env-specific values
      backend.tf
    staging/
      main.tf
      variables.tf
      terraform.tfvars
      backend.tf
```

**Per-file convention:**
- `main.tf` - Resources and module calls
- `variables.tf` - Input variable declarations
- `outputs.tf` - Output declarations
- `providers.tf` - Provider config and required_providers
- `backend.tf` - Backend config
- `locals.tf` - Local values
- `data.tf` - Data sources

## State Management

### Remote State - Always Use It

```hcl
# Directories per environment (preferred over workspaces)
# environments/prod/backend.tf
terraform {
  backend "s3" {
    bucket = "company-tf-state"
    key    = "prod/main.tfstate"
    region = "us-east-1"
  }
}
```

### Reference Other State

```hcl
data "terraform_remote_state" "vpc" {
  backend = "s3"
  config = {
    bucket = "company-tf-state"
    key    = "prod/vpc.tfstate"
    region = "us-east-1"
  }
}

# Use: data.terraform_remote_state.vpc.outputs.vpc_id
```

### Workspaces vs Directories

| Aspect        | Workspaces           | Directories (Recommended) |
|---------------|----------------------|---------------------------|
| State         | Same backend, prefix | Separate backends         |
| Config        | Same, use conditionals | Independent, clear       |
| Risk          | Wrong workspace = disaster | Explicit per env     |
| CI/CD         | Must select workspace | Just cd into directory    |

## Variable Patterns

### Locals vs Variables

```hcl
# variables.tf - Things that change between environments
variable "env" { type = string }
variable "instance_count" { type = number; default = 2 }

# locals.tf - Derived values, constants, computed logic
locals {
  name_prefix = "${var.project}-${var.env}"
  common_tags = {
    Project     = var.project
    Environment = var.env
    ManagedBy   = "terraform"
  }
  is_prod = var.env == "prod"
}
```

### tfvars Per Environment

```hcl
# environments/prod/terraform.tfvars
env            = "prod"
instance_count = 4
instance_type  = "t3.large"

# environments/staging/terraform.tfvars
env            = "staging"
instance_count = 1
instance_type  = "t3.small"
```

### Variable Validation

```hcl
variable "env" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.env)
    error_message = "env must be dev, staging, or prod"
  }
}
```

## Security

### Sensitive Variables

```hcl
variable "db_password" {
  type      = string
  sensitive = true  # Hides from plan/apply output
}

# Better: pull from secrets manager
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/db-password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db.secret_string
}
```

### Provider Auth with OIDC (no static keys)

```yaml
# GitHub Actions - AWS
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789:role/github-actions
    aws-region: us-east-1

# GitHub Actions - GCP
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: projects/123/locations/global/workloadIdentityPools/github/providers/github
    service_account: deploy@project.iam.gserviceaccount.com
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Terraform
on:
  pull_request:
    paths: ["infrastructure/**"]
  push:
    branches: [main]
    paths: ["infrastructure/**"]

jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - run: terraform init
        working-directory: infrastructure/environments/prod
      - run: terraform plan -no-color -out=tfplan
        working-directory: infrastructure/environments/prod
        id: plan

      - uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '```\n${{ steps.plan.outputs.stdout }}\n```'
            })

  apply:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production  # Requires approval
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: us-east-1
      - run: terraform init && terraform apply -auto-approve
        working-directory: infrastructure/environments/prod
```

## Import Existing Resources

```bash
# Import into state
terraform import aws_s3_bucket.existing my-bucket-name
terraform import google_compute_instance.vm projects/myproj/zones/us-central1-a/instances/myvm

# Generate config from import (Terraform 1.5+)
terraform plan -generate-config-out=generated.tf
```

## Drift Detection

```bash
# Detect drift (plan with no changes expected)
terraform plan -detailed-exitcode
# Exit code: 0=no changes, 1=error, 2=drift detected

# Refresh state to match reality
terraform refresh   # Deprecated, use:
terraform apply -refresh-only

# Scheduled drift check in CI
- name: Drift check
  run: |
    terraform plan -detailed-exitcode
    if [ $? -eq 2 ]; then
      echo "DRIFT DETECTED" && exit 1
    fi
```
