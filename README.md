# echo-demo

Monorepo for Echo sales-engineering demos. Each demo lives under `packages/`.

## Packages

- [`packages/basic`](packages/basic) - a minimal Node.js HTTP server built two
  ways: once from a regular upstream Docker base image, once from the
  equivalent [Echo](https://docs.echohq.com) hardened base image. A GitHub
  Actions workflow builds both, scans each with [Trivy](https://trivy.dev),
  and posts a side-by-side vulnerability comparison to the workflow run
  summary.

## Adding a new demo package

Create a new folder under `packages/<name>` and add its own workflow under
`.github/workflows/<name>-build-and-scan.yml`, following the pattern used by
`basic`.

## Required repo secrets

Echo's registry (`reg.echohq.com`) requires authentication to pull images.
Create an access key under **Settings -> Keys** in the Echo platform, then add
it to this repo's GitHub Actions secrets:

- `ECHO_REGISTRY_USERNAME` - your Echo email / access key name
- `ECHO_REGISTRY_TOKEN` - the access token generated for that key

See [Pulling and running images](https://docs.echohq.com/for-engineering/pulling) for details.
