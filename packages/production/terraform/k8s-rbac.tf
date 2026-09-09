# IAM roles (container.developer) grant GKE *API* access but do not by
# themselves grant in-cluster Kubernetes RBAC permissions to a non-creator
# principal -- the CI/CD SA needs an explicit ClusterRoleBinding too, or
# helm/kubectl calls from the deploy workflow will authenticate fine but
# get Forbidden from the Kubernetes API itself.

provider "kubernetes" {
  host                   = "https://${google_container_cluster.primary.endpoint}"
  cluster_ca_certificate = base64decode(google_container_cluster.primary.master_auth[0].cluster_ca_certificate)
  token                  = data.google_client_config.default.access_token
}

data "google_client_config" "default" {}

resource "kubernetes_cluster_role_binding" "cicd_deployer_admin" {
  metadata {
    name = "${var.cluster_name}-cicd-deployer-admin"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "cluster-admin"
  }

  subject {
    kind      = "User"
    name      = google_service_account.cicd_deployer.email
    api_group = "rbac.authorization.k8s.io"
  }

  depends_on = [google_container_cluster.primary]
}
