# Terraform GCP Patterns Reference

## Remote State Backend (GCS)

```hcl
terraform {
  backend "gcs" {
    bucket = "mycompany-terraform-state"
    prefix = "prod"
  }
}

# Bootstrap bucket
resource "google_storage_bucket" "state" {
  name     = "mycompany-terraform-state"
  location = "US"
  versioning { enabled = true }
  uniform_bucket_level_access = true
}
```

## Provider Config

```hcl
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
```

## VPC with Subnets

```hcl
resource "google_compute_network" "main" {
  name                    = "main-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "private" {
  name          = "private"
  ip_cidr_range = "10.0.1.0/24"
  region        = var.region
  network       = google_compute_network.main.id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/20"
  }

  private_ip_google_access = true
}

resource "google_compute_router" "main" {
  name    = "main-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "main-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

resource "google_compute_firewall" "allow_internal" {
  name    = "allow-internal"
  network = google_compute_network.main.name
  allow { protocol = "tcp" }
  allow { protocol = "udp" }
  allow { protocol = "icmp" }
  source_ranges = ["10.0.0.0/8"]
}
```

## Cloud Run Service

```hcl
resource "google_cloud_run_v2_service" "app" {
  name     = "app"
  location = var.region

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/app/api:latest"

      ports { container_port = 3000 }

      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }

      env { name = "DATABASE_URL"; value_source { secret_key_ref { secret = google_secret_manager_secret.db_url.secret_id; version = "latest" } } }
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    service_account = google_service_account.app.email
  }
}

# Allow public access
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Custom domain mapping
resource "google_cloud_run_domain_mapping" "app" {
  name     = "api.example.com"
  location = var.region
  metadata { namespace = var.project_id }
  spec { route_name = google_cloud_run_v2_service.app.name }
}

# VPC connector for private network access
resource "google_vpc_access_connector" "main" {
  name          = "vpc-connector"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.8.0.0/28"
  machine_type  = "e2-micro"
}
```

## Cloud SQL PostgreSQL

```hcl
resource "google_sql_database_instance" "main" {
  name             = "app-db"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = "db-custom-2-4096"
    availability_type = "REGIONAL"  # HA
    disk_size         = 50
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      backup_retention_settings { retained_backups = 14 }
    }

    database_flags {
      name  = "max_connections"
      value = "200"
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "app" {
  name     = "appdb"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = "app"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}
```

## GCS Bucket

```hcl
resource "google_storage_bucket" "assets" {
  name     = "${var.project_id}-assets"
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning { enabled = true }

  lifecycle_rule {
    condition { age = 90; with_state = "ARCHIVED" }
    action { type = "Delete" }
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.bucket.id
  }
}
```

## IAM Bindings

```hcl
# Service account for app
resource "google_service_account" "app" {
  account_id   = "app-runtime"
  display_name = "App Runtime SA"
}

# Grant specific roles
resource "google_project_iam_member" "app_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_storage_bucket_iam_member" "app_storage" {
  bucket = google_storage_bucket.assets.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

# Workload Identity Federation for CI/CD (GitHub Actions)
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }
  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
}

resource "google_service_account_iam_member" "github_wi" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/myorg/myrepo"
}
```
