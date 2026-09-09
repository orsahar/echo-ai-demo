# echo-demo

Monorepo for Echo sales-engineering demos. Each demo lives under `packages/`.

## Packages

- [`packages/basic`](packages/basic) - a minimal Node.js HTTP server built two
  ways: once from a regular upstream Docker base image, once from the
  equivalent [Echo](https://docs.echohq.com) hardened base image. A GitHub
  Actions workflow builds both, scans each with [Trivy](https://trivy.dev),
  and posts a side-by-side vulnerability comparison to the workflow run
  summary.

- [`packages/libraries`](packages/libraries) - a Node.js HTTP server built
  two ways: once with a regular base image and dependencies from the public
  npm registry, once on Echo's hardened base image *and* dependencies from
  [Echo](https://docs.echohq.com)'s hardened npm index - stacking both Echo
  surfaces. Five real dependencies (`axios`/`follow-redirects`, `ajv`,
  `nanoid`, `path-to-regexp`, `jws`) are pinned to versions with known CVEs;
  Echo backports fixes without changing the installed version, so the
  workflow scans the Echo build with Echo's OpenVEX feed to surface the
  reduction (8 of 9 findings, in the current pinned set).

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
registry credentials above). Used by `packages/libraries`, which needs
*both* secret sets since its echo variant uses the Echo base image too:

- `ECHO_LIBRARIES_KEY` - the Libraries key used to authenticate npm installs

See [Pulling and running images](https://docs.echohq.com/for-engineering/pulling)
and [Implementing npm](https://docs.echohq.com/libraries/implementing-npm) for details.
