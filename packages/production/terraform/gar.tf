# Mirrors reg.echohq.com into GAR as a pull-through-cache "remote repository",
# via Echo's own published Terraform module -- fetched and read directly
# from github.com/buildecho/onboarding-providers/echo-terraform-gar-mirror
# before writing this (module confirms: custom_repository.uri defaults to
# https://reg.echohq.com, auth is username/password via a Secret Manager
# secret the module creates itself, IAM for GAR's own service agent to read
# that secret is also handled internally -- nothing left to wire by hand).
module "echo_gar_mirror" {
  source = "github.com/buildecho/onboarding-providers//echo-terraform-gar-mirror"

  project_id      = var.project_id
  location        = var.gar_mirror_region
  repository_name = var.mirror_repository_name

  echo_images          = true
  echo_image_key_name  = var.echo_image_key_name
  echo_image_key_value = var.echo_image_key_value

  reader_members = [
    "serviceAccount:${google_service_account.gke_runtime.email}",
  ]

  labels = var.labels

  depends_on = [
    google_project_service.artifactregistry,
    google_project_service.secretmanager,
  ]
}

# Remote repositories are read-only mirrors -- CI needs a separate, plain
# repository to push our own built images to.
resource "google_artifact_registry_repository" "app_images" {
  project       = var.project_id
  location      = var.gke_region
  repository_id = var.app_repository_name
  description   = "CI-built images for packages/production, pushed by the deploy workflow"
  format        = "DOCKER"
  mode          = "STANDARD_REPOSITORY"

  labels = var.labels

  depends_on = [google_project_service.artifactregistry]
}
