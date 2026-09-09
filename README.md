# echo-demo

Monorepo for Echo sales-engineering demos. Each demo lives under `packages/`.

## Packages

- [`packages/basic`](packages/basic) - a minimal Node.js HTTP server built two
  ways: once from a regular upstream Docker base image, once from the
  equivalent [Echo](https://docs.echohq.com) hardened base image. A GitHub
  Actions workflow builds both, scans each with [Trivy](https://trivy.dev),
  and posts a side-by-side vulnerability comparison to the workflow run
  summary.

- [`packages/libraries`](packages/libraries) - a minimal Node.js HTTP server
  built two ways from the *same* base image: once with dependencies
  installed from the public npm registry, once via
  [Echo](https://docs.echohq.com)'s hardened npm index. Demonstrates
  library-level (not base-image) hardening: a vulnerable transitive
  dependency of `axios` is pinned deliberately, and Echo backports the CVE
  fix without changing the installed version, so the workflow scans the
  Echo build with Echo's OpenVEX feed to surface the reduction.

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

Echo's npm index (`npm.echohq.com`) requires a separate **Libraries key**
(also generated from Settings -> Keys, but a different key type from the
registry credentials above). Used by `packages/libraries`:

- `ECHO_LIBRARIES_KEY` - the Libraries key used to authenticate npm installs

See [Pulling and running images](https://docs.echohq.com/for-engineering/pulling)
and [Implementing npm](https://docs.echohq.com/libraries/implementing-npm) for details.
