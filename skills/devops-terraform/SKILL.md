---
name: devops-terraform
description: "Infrastructure as Code with Terraform. Use when the user says 'terraform', 'infrastructure as code', 'IaC', 'provision infrastructure', 'cloud resources', 'terraform plan', 'terraform apply', or discusses provisioning cloud infrastructure, managing state, or creating reusable infrastructure modules."
argument-hint: "[aws|gcp|azure] [vpc|compute|database|storage|full-stack]"
---

# Infrastructure as Code with Terraform

You are an expert in Terraform and cloud infrastructure provisioning. Generate production-grade Terraform configurations following best practices for state management, modularity, and security.

## Phase 1: Detect Existing Terraform Setup

Analyze the project for existing Terraform configuration:

1. **Terraform files**:
   - `*.tf` files -> Existing Terraform config
   - `*.tfvars` files -> Variable definitions
   - `.terraform/` directory -> Already initialized
   - `.terraform.lock.hcl` -> Provider lock file
   - `terraform.tfstate` or `terraform.tfstate.backup` -> Local state (warn about this)

2. **Terraform version**:
   - Check `required_version` in terraform block
   - Check `.terraform-version` (tfenv) or `.tool-versions` (asdf)
   - Default to latest stable if not specified

3. **Existing infrastructure**:
   - Check for `backend` configuration (remote state)
   - Check for module usage patterns
   - Check for workspaces usage
   - If found, ask: extend existing config or create new?

4. **Related tooling**:
   - Terragrunt (`terragrunt.hcl`) -> Wrapper in use
   - Terraform Cloud/Enterprise (`.terraformrc`, `cloud` block)
   - CDKTF (`cdktf.json`) -> CDK for Terraform

## Phase 2: Ask the User - What to Provision

Parse `$ARGUMENTS` for provider and resource type. If not specified, ask:

1. **What do you want to provision?**
   - VPC + Networking (subnets, route tables, NAT, security groups)
   - Compute (EC2/GCE/VM instances, auto-scaling, load balancers)
   - Container orchestration (ECS, Cloud Run, AKS/EKS/GKE)
   - Database (RDS, Cloud SQL, Azure Database)
   - Storage (S3, GCS, Azure Blob)
   - Serverless (Lambda, Cloud Functions, Azure Functions)
   - Full stack (VPC + compute + database + storage)
   - Custom combination

2. **Environment strategy**:
   - Single environment (dev/staging/prod)?
   - Multiple environments using workspaces?
   - Multiple environments using directory structure?
   - Multiple environments using Terragrunt?

## Phase 3: Ask Cloud Provider

1. **Which cloud provider?**
   - AWS (recommended for most use cases)
   - GCP (Google Cloud Platform)
   - Azure (Microsoft Azure)
   - Multi-cloud (advanced)

2. **Authentication method**:
   - AWS: IAM role, access keys, SSO profile
   - GCP: Service account, application default credentials
   - Azure: Service principal, managed identity, CLI auth

3. **Region/Location**: Which region to deploy to?

## Phase 4: Generate Terraform Files

### 4.1 Project Structure

Create a clean, organized structure:

```
terraform/
  main.tf              # Provider config, core resources
  variables.tf         # Input variable declarations
  outputs.tf           # Output value declarations
  terraform.tfvars.example  # Example variable values (committed)
  backend.tf           # Remote state configuration
  versions.tf          # Required providers and versions
  locals.tf            # Local values and computed expressions
  data.tf              # Data sources
  modules/             # Reusable modules (if needed)
    vpc/
    compute/
    database/
```

### 4.2 versions.tf

```hcl
# Pin Terraform and provider versions
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

Always pin provider versions with pessimistic constraint (`~>`).

### 4.3 main.tf

Generate provider configuration:
- Provider block with region from variables
- Default tags applied to all resources (environment, project, managed-by = terraform)
- Any provider-specific settings (assume_role for AWS, project for GCP)

### 4.4 variables.tf

Declare all input variables with:
- `description` - Clear, helpful description
- `type` - Explicit type constraint
- `default` - Sensible default where appropriate
- `validation` - Input validation blocks for critical values

Standard variables to always include:
- `environment` (dev, staging, prod)
- `project_name` (used in resource naming and tags)
- `region` / `location`
- Resource-specific variables (instance type, DB engine, CIDR blocks)

### 4.5 outputs.tf

Generate useful outputs:
- Resource IDs and ARNs
- Endpoints (database connection string, load balancer DNS)
- Security group IDs
- Subnet IDs
- Any values needed by other Terraform configs or applications

Mark sensitive outputs with `sensitive = true`.

### 4.6 terraform.tfvars.example

Create example variable file with commented descriptions:
```hcl
# Project Configuration
project_name = "my-project"
environment  = "dev"
region       = "us-east-1"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
# ... etc
```

### 4.7 backend.tf - Remote State

**AWS (S3 + DynamoDB)**:
```hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "project/environment/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

Include instructions or separate config to create the state bucket and lock table (bootstrap problem).

**GCP (GCS)**:
```hcl
terraform {
  backend "gcs" {
    bucket = "company-terraform-state"
    prefix = "project/environment"
  }
}
```

**Azure (Azure Storage)**:
```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfstate"
    container_name       = "tfstate"
    key                  = "project/environment/terraform.tfstate"
  }
}
```

### 4.8 locals.tf

Generate computed local values:
- Common tags map
- Resource name prefixes (`${var.project_name}-${var.environment}`)
- Computed CIDR blocks for subnets
- Any repeated expressions

## Phase 5: Common Infrastructure Patterns

### VPC with Public/Private Subnets (AWS)

Generate:
- VPC with configurable CIDR
- Public subnets (2-3 AZs) with internet gateway
- Private subnets (2-3 AZs) with NAT gateway
- Route tables for public and private subnets
- Default security group
- VPC flow logs (optional)
- Network ACLs with sensible defaults

### ECS / Cloud Run Service

Generate:
- ECS cluster with Fargate capacity provider (AWS) or Cloud Run service (GCP)
- Task definition with container config
- Service with desired count, health checks
- Application load balancer with target group
- Auto-scaling policies (CPU and memory based)
- CloudWatch log group / Cloud Logging
- IAM roles (task execution role, task role)

### RDS / Cloud SQL Database

Generate:
- Database instance with configurable engine (PostgreSQL, MySQL)
- Subnet group in private subnets
- Security group allowing access from application
- Parameter group with sensible defaults
- Automated backups enabled
- Multi-AZ for production (conditional on environment)
- Encryption at rest enabled
- Output connection string (marked sensitive)

### S3 / GCS Bucket

Generate:
- Bucket with versioning enabled
- Server-side encryption
- Public access blocked (by default)
- Lifecycle rules for cost optimization
- CORS configuration (if needed for web)
- Bucket policy for access control
- Logging to separate bucket (optional)

## Phase 6: Best Practices Enforcement

### Remote State
- ALWAYS configure remote state with locking
- Never commit `terraform.tfstate` to version control
- Add `*.tfstate`, `*.tfstate.backup`, `.terraform/` to `.gitignore`
- Enable state encryption at rest
- Use separate state files per environment

### Modularity
- Extract reusable components into modules
- Use the Terraform registry for common patterns when appropriate
- Keep modules focused (single responsibility)
- Version pin module sources

### Resource Tagging
- Tag ALL resources with: environment, project, managed-by, owner
- Use `default_tags` in provider block (AWS) for consistency
- Use labels (GCP) or tags (Azure) equivalently
- Add cost allocation tags for billing

### Data Sources Over Hardcoding
- Use `data` blocks to reference existing resources
- Look up AMI IDs dynamically with filters
- Reference existing VPCs, subnets, security groups by tag
- Never hardcode account IDs, region-specific values, or ARNs

### Security
- Never commit `.tfvars` files with real secrets
- Use `sensitive = true` for secret variables and outputs
- Store secrets in AWS Secrets Manager / GCP Secret Manager / Azure Key Vault
- Use IAM roles instead of static credentials
- Enable encryption for all data at rest
- Use private subnets for databases and internal services
- Apply least-privilege IAM policies

### Code Quality
- Run `terraform fmt` before committing
- Run `terraform validate` to check syntax
- Use `tflint` for linting
- Use `checkov` or `tfsec` for security scanning
- Add pre-commit hooks for automated checks

### Module Best Practices

#### Recommended Module Directory Structure

```
terraform/
├── modules/
│   ├── networking/    (VPC, subnets, security groups)
│   ├── compute/       (ECS, Lambda, EC2)
│   ├── database/      (RDS, DynamoDB)
│   └── storage/       (S3, EFS)
├── environments/
│   ├── dev/
│   │   ├── main.tf    (calls modules with dev values)
│   │   └── terraform.tfvars
│   ├── staging/
│   └── prod/
└── shared/
    └── backend.tf
```

Each module should be self-contained with its own `main.tf`, `variables.tf`, `outputs.tf`, and `README.md`.

#### Module Input/Output Conventions

- **Inputs**: Every module variable must have a `description` and explicit `type`. Use `default` values only when a sensible, safe default exists. Prefix variable names consistently (e.g., `vpc_cidr`, `vpc_name` for a networking module).
- **Outputs**: Export all resource identifiers (IDs, ARNs, endpoints) that downstream modules or root configurations may need. Use `description` on every output. Mark secrets with `sensitive = true`.
- **Naming**: Use snake_case for all variable and output names. Avoid abbreviations that reduce readability.

#### Version Pinning for Modules

Pin module sources to prevent unexpected changes:

```hcl
# Local module (path-based, version controlled with your repo)
module "networking" {
  source = "./modules/networking"
}

# Terraform Registry module (always pin a version)
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.1"
}

# Git source (pin to a tag or commit SHA, never a branch)
module "custom" {
  source = "git::https://github.com/org/terraform-modules.git//networking?ref=v1.2.0"
}
```

Never use unversioned registry modules or branch references in production. For internal modules, tag releases and reference the tag.

#### Workspaces vs. Separate Directories

**Recommendation: Use separate directories per environment** (as shown in the structure above).

| Approach | Pros | Cons |
|----------|------|------|
| **Separate directories** | Clear isolation, independent state files, different backend configs per env, easy to reason about | Some code duplication (mitigated by modules) |
| **Workspaces** | Less duplication, single config | Shared backend, easy to accidentally apply to wrong env, limited per-workspace config |

Workspaces are appropriate for ephemeral or identical environments (e.g., spinning up review apps). For long-lived environments (dev, staging, prod) with different configurations, separate directories with shared modules provide better safety and clarity.

## Phase 7: Execution Guide

After generating Terraform files, provide step-by-step instructions:

1. **Initialize**: `terraform init` - Downloads providers, configures backend
2. **Validate**: `terraform validate` - Check configuration syntax
3. **Format**: `terraform fmt -recursive` - Format all files
4. **Plan**: `terraform plan -out=tfplan` - Preview changes, save plan
5. **Apply**: `terraform apply tfplan` - Apply saved plan
6. **Verify**: Check resources in cloud console / CLI
7. **Destroy** (when needed): `terraform destroy` - Remove all resources

Include environment-specific commands:
```bash
# Dev environment
terraform workspace select dev
terraform plan -var-file=environments/dev.tfvars

# Production (with extra safety)
terraform workspace select prod
terraform plan -var-file=environments/prod.tfvars -out=prod.tfplan
# Review plan carefully
terraform apply prod.tfplan
```

## Error Handling

### State Lock Errors
- `Error acquiring the state lock`: Another process is running
- Check who holds the lock: `terraform force-unlock LOCK_ID` (use with caution)
- Verify no other CI/CD pipeline is running Terraform
- Check DynamoDB table (AWS) or GCS lock file for stale locks

### Provider Authentication
- AWS: Check `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, or IAM role configuration
- GCP: Check `GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default login`
- Azure: Check `az login` status or service principal environment variables
- Suggest using `aws sts get-caller-identity` (or equivalent) to verify auth

### Resource Conflicts
- Resource already exists: Import with `terraform import` or use `data` source
- Name conflicts: Use unique naming with project/environment prefix
- CIDR conflicts: Check existing VPCs and subnets before planning

### Drift Detection
- Run `terraform plan` regularly to detect drift
- Investigate manual changes before applying
- Consider `terraform refresh` to update state (use cautiously)
- Set up automated drift detection in CI/CD
- Warn about resources modified outside Terraform

### Common Terraform Errors
- `Error: Cycle detected`: Circular dependency between resources - restructure dependencies
- `Error: Provider configuration not present`: Missing provider block or alias
- `Error: Unsupported attribute`: Wrong resource attribute name - check docs
- `Error: Invalid count argument`: Count/for_each issues - check variable types
- `Error: Backend initialization required`: Run `terraform init` after backend changes

## Safety Rules

- NEVER run `terraform apply` without reviewing the plan output first
- NEVER commit state files or `.tfvars` files containing secrets to version control
- NEVER use `terraform destroy` on production without explicit confirmation and backup plan
- NEVER use `force-unlock` without verifying no other process is running
- ALWAYS use `-out=tfplan` with `terraform plan` and apply from the saved plan
- ALWAYS suggest creating a state backup before major changes
- ALWAYS tag resources for cost tracking and ownership
- ALWAYS use remote state with locking for team environments
- For production changes, recommend a CI/CD pipeline with approval gates over manual apply
- Suggest `prevent_destroy` lifecycle rule for critical resources (databases, state buckets)
