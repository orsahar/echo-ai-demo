resource "google_container_cluster" "primary" {
  name     = var.cluster_name
  project  = var.project_id
  location = var.gke_region

  enable_autopilot = true

  # This cluster is stood up per demo session and torn down afterward --
  # deletion_protection defaults to true on this resource, which would
  # block `terraform destroy` and defeat the whole point.
  deletion_protection = false

  release_channel {
    channel = "REGULAR" # required for Autopilot
  }

  cluster_autoscaling {
    auto_provisioning_defaults {
      service_account = google_service_account.gke_runtime.email
      oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
    }
  }

  resource_labels = var.labels

  depends_on = [google_project_service.container]
}
