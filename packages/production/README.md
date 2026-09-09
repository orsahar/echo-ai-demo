# production

The "final destination" demo: a real GKE Autopilot cluster, Echo's registry
mirrored into Google Artifact Registry, Echo's `mongodb-kubernetes` Helm
chart providing real MongoDB storage (its own images routed through the
same GAR mirror), and a real Node.js app -- hardened at the base-image and
npm-index layers exactly like `packages/libraries` -- doing real CRUD
against it.

**This is ephemeral.** Stood up for a demo session, torn down afterward.
See [`terraform/README.md`](terraform/README.md) for cost notes and the
teardown command.

## Layout

```
terraform/    GKE Autopilot cluster + GAR mirror + GAR app repo + IAM
app/          the Node.js app (Dockerfile / Dockerfile.echo, real Mongo CRUD)
chart/        this app's own Helm chart (Deployment + ClusterIP Service)
k8s/          Helm values for the mongodb-kubernetes operator chart
```

## The MongoDB piece

Installed from Echo's chart, not a hand-written manifest:

```bash
helm registry login reg.echohq.com   # reuses docker login creds
kubectl create namespace demo-prod
kubectl create secret generic production-mongodb-user-password \
  -n demo-prod --from-literal=password="$(openssl rand -base64 24)"

helm install mongodb-operator oci://reg.echohq.com/charts/upstream/mongodb-kubernetes \
  --version 1.10.0 \
  -f k8s/mongodb-values.yaml \
  -n demo-prod
```

`k8s/mongodb-values.yaml` sets `community.createResource: true`, which makes
the chart itself template the `MongoDBCommunity` custom resource (from
`community.resource.*` in that file) -- confirmed by pulling and reading the
chart's actual templates, not assumed. It also sets `global.imageRegistry`
to the GAR mirror, which -- confirmed via `helm template` dry-run before
installing for real -- routes every image this chart uses (operator, agent,
`mongo:8.0.28`, upgrade hook, readiness probe) through GAR too, not just our
own app image.

Single member (`community.resource.members: 1`), not a real replica set --
this is a demo, not production data.

**Once the resource reaches `Running`**, the operator creates a connection-
string secret (`production-mongodb-connection-string`, name set via
`connectionStringSecretName` on the user), with the ready-to-use connection
string at key `connectionString.standard` -- confirmed live by reading the
actual secret after a real install, matching `chart/values.yaml`'s
`mongodb.connectionStringSecretKey`.

Also confirmed live: `clusterAdmin` on the `admin` db does **not** grant
data-level access to other databases. The user's role needs an explicit
`readWrite` on the db the app actually uses (`k8s/mongodb-values.yaml`) --
found via a real `POST /notes` returning "not authorized on production"
before the role was corrected.

## The app

`app/Dockerfile.echo` parameterizes both the base image (`BASE_IMAGE` arg)
and the npm registry (`NPM_REGISTRY` arg + `NPM_AUTH_TOKEN` secret, keyed by
the registry's host+path so the same mechanism works against either
registry). Defaults pull directly from Echo -- used by
`production-build-and-scan.yml`, which has no GCP/GAR dependency and must
keep working even when the ephemeral infra is torn down. The real deploy
workflow (`production-deploy.yml`) overrides both to route through the GAR
mirror instead, matching Echo's own recommended pattern ("CI/CD pulls from
your internal registry, not directly from Echo") -- verified live before
wiring it up: a real `docker build` against the mirrored base image, and a
real `npm install` through the GAR npm mirror resolving an actual tarball
from that host, not a silent public-npm fallback.

```bash
docker build -f app/Dockerfile -t production-regular app/

# Hardened, direct from Echo (matches production-build-and-scan.yml):
docker login reg.echohq.com
ECHO_LIBRARIES_KEY=<key> docker buildx build \
  --secret id=NPM_AUTH_TOKEN,env=ECHO_LIBRARIES_KEY \
  -f app/Dockerfile.echo -t production-echo --load app/

# Hardened, through the GAR mirror (matches production-deploy.yml):
export GAR_TOKEN=$(gcloud auth print-access-token)
docker buildx build \
  --build-arg BASE_IMAGE=us-central1-docker.pkg.dev/whtvr-ai/echo-demo-prod-mirror/node:23 \
  --build-arg NPM_REGISTRY=https://us-central1-npm.pkg.dev/whtvr-ai/echo-demo-prod-mirror-npm/ \
  --secret id=NPM_AUTH_TOKEN,env=GAR_TOKEN \
  -f app/Dockerfile.echo -t production-echo --load app/
```

`npm install` occasionally segfaults transiently under the secret-mounted
`RUN` (seen locally and on GitHub's native amd64 runners, regardless of
which registry) -- the Dockerfile retries it a few times before failing the
build.

Push to the GAR app repo (output from `terraform output app_repository_url`),
then:

```bash
helm upgrade --install production-app chart \
  -n demo-prod \
  --set image.repository=<app_repository_url>/production \
  --set image.tag=<tag>
```

Access without a public LoadBalancer:

```bash
kubectl port-forward -n demo-prod svc/production-app 8080:8080
curl -X POST localhost:8080/notes -d '{"text":"hello"}' -H 'Content-Type: application/json'
curl localhost:8080/notes
curl localhost:8080/health   # real db.command("ping"), not just liveness
```

## Teardown

```bash
helm uninstall production-app -n demo-prod
helm uninstall mongodb-operator -n demo-prod
cd terraform && terraform destroy
```

See [`terraform/README.md`](terraform/README.md) for cost details and the
full teardown verification.
