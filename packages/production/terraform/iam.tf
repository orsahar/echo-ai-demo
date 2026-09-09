# GKE node identity. For Autopilot, the node service account is NOT settable
# via node_config (that field is silently ignored / errors on Autopilot) --
# it must be set via cluster_autoscaling.auto_provisioning_defaults.service_account
# at cluster CREATION time (cannot be changed on an existing cluster).
# Verified against the terraform-provider-google Autopilot behavior before
# writing this -- this is the one part of Autopilot Terraform config that's
# genuinely non-obvious from the resource docs alone.
resource "google_service_account" "gke_runtime" {
  project      = var.project_id
  account_id   = "${var.cluster_name}-runtime"
  display_name = "GKE Autopilot node identity for ${var.cluster_name}"
}

resource "google_artifact_registry_repository_iam_member" "gke_runtime_reads_app_repo" {
  project    = var.project_id
  location   = google_artifact_registry_repository.app_images.location
  repository = google_artifact_registry_repository.app_images.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.gke_runtime.email}"
}

# Reader access to the Echo mirror repo is granted via the module's own
# reader_members input (see gar.tf) rather than a second resource here.

# CI/CD deployer identity for the Phase C GitHub Actions workflow. Created
# now so `gke_runtime`/repo wiring is complete in one apply; the Workload
# Identity Federation *trust* binding (letting GitHub Actions impersonate
# this SA) is added in Phase C, not here -- this SA has no external way to
# authenticate as itself until that's wired up.
resource "google_service_account" "cicd_deployer" {
  project      = var.project_id
  account_id   = "${var.cluster_name}-cicd"
  display_name = "CI/CD deployer for ${var.cluster_name} (GitHub Actions)"
}

resource "google_artifact_registry_repository_iam_member" "cicd_writes_app_repo" {
  project    = var.project_id
  location   = google_artifact_registry_repository.app_images.location
  repository = google_artifact_registry_repository.app_images.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.cicd_deployer.email}"
}

resource "google_project_iam_member" "cicd_container_developer" {
  project = var.project_id
  role    = "roles/container.developer"
  member  = "serviceAccount:${google_service_account.cicd_deployer.email}"
}
