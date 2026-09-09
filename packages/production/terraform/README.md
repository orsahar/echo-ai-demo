# production/terraform

Provisions the shared GCP infra for the `production` demo: a GKE Autopilot
cluster, two GAR "remote repositories" mirroring Echo -- `reg.echohq.com`
(images) and `npm.echohq.com` (npm packages) -- via Echo's own
[`echo-terraform-gar-mirror`](https://github.com/buildecho/onboarding-providers/tree/main/echo-terraform-gar-mirror)
module, a separate standard GAR repository for CI-built app images, Workload
Identity Federation for the deploy workflow, and the IAM/service accounts
all of it needs. Both mirrors are verified working (real `docker pull` /
`npm install` through each) -- see `packages/production/README.md`.

**This is meant to be ephemeral.** Stand it up for a demo session, tear it
down afterward with `terraform destroy`. `deletion_protection` is explicitly
disabled on the cluster for exactly this reason.

## Cost

Two hours end to end: worst case ~$0.20 in cluster-management-fee cluster-
hours (likely fully covered by Google Cloud's Always Free $74.40/month GKE
credit, which is sized almost exactly for one continuously-running cluster)
plus a few cents of Autopilot pod-request billing while pods are actually
scheduled. No `LoadBalancer` Services are used anywhere in this demo (that's
the one thing that would actually cost real money if left running — ~$18/mo
continuously) — access is via `kubectl port-forward`.

## Prerequisites

- `terraform >= 1.5`, `gcloud`, authenticated (`gcloud auth login` /
  `gcloud auth application-default login`) against project `whtvr-ai` (or
  whatever `project_id` you set).
- An Echo **Images** access key (Settings → Keys in the Echo platform — a
  different key type from the Libraries key below).
- An Echo **Libraries** key for the npm mirror. Unlike the Images key, the
  username is **not** the key name or your email -- it's a separate "token
  username" (format `et-N`), shown in the Echo app under
  **Settings → Integrations → Google Artifact Registry**, next to the
  module snippet it generates for you. Copy both from there.
- IAM on your own account: `roles/container.admin`,
  `roles/artifactregistry.admin`, `roles/secretmanager.admin`,
  `roles/iam.serviceAccountAdmin`. (Echo's docs also list
  `roles/accesscontextmanager.policyEditor` for the GAR integration — that's
  only relevant if this GCP org enforces VPC Service Controls, which
  `whtvr-ai` almost certainly doesn't; the actual module source doesn't
  reference it at all. Only add it if `apply` fails with a VPC-SC-shaped
  permission error.)

## Apply

```bash
cp terraform.tfvars.example terraform.tfvars
# fill in echo_image_key_name / echo_image_key_value and
# echo_library_key_name / echo_library_key_value
terraform init
terraform plan
terraform apply
```

Note the `gar_mirror_region` (default `us-central1`) is deliberately
different from `gke_region` (default `me-west1`) — the Echo GAR-mirror
module's `location` variable validation doesn't currently accept
`me-west1`. Cross-region pulls are a non-issue for a short demo.

## After apply

```bash
terraform output get_credentials_command   # copy/paste to configure kubectl
```

Then proceed to Phase B (`packages/production/README.md`) to install the
MongoDB operator chart and deploy the app.

## Teardown

```bash
terraform destroy
```

Confirm nothing's left running:

```bash
gcloud container clusters list --project whtvr-ai
gcloud artifacts repositories list --project whtvr-ai
```
