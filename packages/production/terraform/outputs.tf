output "cluster_name" {
  value = google_container_cluster.primary.name
}

output "cluster_region" {
  value = google_container_cluster.primary.location
}

output "get_credentials_command" {
  description = "Run this to point kubectl/helm at the cluster."
  value       = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --region ${google_container_cluster.primary.location} --project ${var.project_id}"
}

output "app_repository_url" {
  description = "Push CI-built images here."
  value       = "${var.gke_region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app_images.repository_id}"
}

output "mirror_repository_pull_example" {
  description = "Example pull through the Echo registry mirror."
  value       = "docker pull ${var.gar_mirror_region}-docker.pkg.dev/${var.project_id}/${var.mirror_repository_name}/node:23"
}

output "gke_runtime_service_account" {
  value = google_service_account.gke_runtime.email
}

output "cicd_deployer_service_account" {
  description = "Service account impersonated by the GitHub Actions deploy workflow via WIF."
  value       = google_service_account.cicd_deployer.email
}

output "wif_provider" {
  description = "Full workload_identity_provider resource name for google-github-actions/auth."
  value       = google_iam_workload_identity_pool_provider.github.name
}
