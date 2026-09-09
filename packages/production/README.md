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
`connectionStringSecretName` on the user). Confirm the exact key inside it
(`kubectl get secret production-mongodb-connection-string -n demo-prod -o
yaml`) matches `chart/values.yaml`'s `mongodb.connectionStringSecretKey`
before deploying the app -- written as `connectionString.standard` based on
the community-operator convention, verify rather than trust.

## The app

```bash
docker build -f app/Dockerfile -t production-regular app/
# or, hardened:
docker login reg.echohq.com
ECHO_LIBRARIES_KEY=<key> docker buildx build \
  --secret id=ECHO_LIBRARIES_KEY,env=ECHO_LIBRARIES_KEY \
  -f app/Dockerfile.echo -t production-echo --load app/
```

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
