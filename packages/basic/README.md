# basic

A minimal, dependency-free Node.js HTTP server (`server.js`), built two ways:

- `Dockerfile` - regular upstream base image (`node:23`)
- `Dockerfile.echo` - identical app, built on the [Echo](https://docs.echohq.com) hardened base image (`reg.echohq.com/node:23`)

The app code and every other line are identical between the two Dockerfiles;
only the `FROM` line changes. That isolates the base image as the only
variable when comparing scan results.

## Run locally

```bash
npm install
npm start
# curl http://localhost:8080
```

## Build both images

```bash
docker build -f Dockerfile -t basic-regular .
docker login reg.echohq.com   # needed once, see root README for credentials
docker build -f Dockerfile.echo -t basic-echo .
```

## Scan locally with Trivy

```bash
trivy image basic-regular
trivy image basic-echo
```

CI does this automatically on every push/PR that touches this package - see
[`.github/workflows/basic-build-and-scan.yml`](../../.github/workflows/basic-build-and-scan.yml)
for the build + scan + comparison workflow.
