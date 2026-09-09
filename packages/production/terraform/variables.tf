variable "project_id" {
  description = "GCP project to provision into."
  type        = string
  default     = "whtvr-ai"
}

variable "gke_region" {
  description = "Region for the GKE Autopilot cluster and the app's own GAR repository."
  type        = string
  default     = "me-west1"
}

variable "gar_mirror_region" {
  description = <<-EOT
    Region for the Echo registry mirror (remote) repository. Must be a
    location accepted by the echo-terraform-gar-mirror module's validation
    (as of the fetched module version, me-west1 is not in that list) --
    deliberately separate from gke_region. Cross-region pulls are a non-issue
    for a short-lived demo cluster.
  EOT
  type        = string
  default     = "us-central1"
}

variable "cluster_name" {
  description = "Name for the GKE Autopilot cluster."
  type        = string
  default     = "echo-demo-prod"
}

variable "namespace" {
  description = "Kubernetes namespace the app and MongoDB operator deploy into."
  type        = string
  default     = "demo-prod"
}

variable "mirror_repository_name" {
  description = "GAR repository id for the Echo registry mirror (remote repository)."
  type        = string
  default     = "echo-demo-prod-mirror"
}

variable "app_repository_name" {
  description = "GAR repository id for CI-built app images (standard, writable repository)."
  type        = string
  default     = "echo-demo-prod-app"
}

variable "echo_image_key_name" {
  description = "Echo Images access key name (username) -- from Settings -> Keys in the Echo platform. Required."
  type        = string
  sensitive   = true
}

variable "echo_image_key_value" {
  description = "Echo Images access key value (password) -- from Settings -> Keys in the Echo platform. Required."
  type        = string
  sensitive   = true
}

variable "echo_library_key_name" {
  description = "Echo Libraries access key name (username) for the GAR npm mirror -- a different key type from the Images key above. Required."
  type        = string
  sensitive   = true
}

variable "echo_library_key_value" {
  description = "Echo Libraries access key value (password) for the GAR npm mirror. Required."
  type        = string
  sensitive   = true
}

variable "github_repo" {
  description = "GitHub \"owner/repo\" allowed to impersonate the CI/CD deployer SA via Workload Identity Federation."
  type        = string
  default     = "orsahar/echo-ai-demo"
}

variable "labels" {
  description = "Labels applied to all created resources."
  type        = map(string)
  default = {
    environment = "demo-prod"
    managed-by  = "terraform"
    repo        = "echo-ai-demo"
  }
}
