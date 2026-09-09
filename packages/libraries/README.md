# libraries

A minimal Node.js HTTP server using `axios`, built two ways:

- `Dockerfile` - regular upstream base image (`node:23`), dependencies
  installed from the public npm registry
- `Dockerfile.echo` - identical app, built on the Echo hardened base image
  (`reg.echohq.com/node:23`) **and** dependencies installed via Echo's
  hardened npm index (`npm.echohq.com`)

Unlike `basic` (which isolates base-image hardening as a single variable),
this package stacks both Echo surfaces in its `echo` variant to show the
combined effect: base-image CVE reduction and library CVE reduction in one
image. If you want to isolate the library variable alone the way `basic`
isolates the base image, point `Dockerfile.echo`'s `FROM` back at plain
`node:23`.

## The actual vulnerable dependency

`axios@1.20.0` itself isn't in Echo's advisory coverage today. Its
transitive dependency `follow-redirects` is, though — so `package.json`
pins it directly via an npm `overrides` entry:

```json
"overrides": { "follow-redirects": "1.15.6" }
```

`follow-redirects@1.15.6` is vulnerable to
[GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653),
fixed upstream in 1.16.0. This was verified directly against Echo's own
OpenVEX feed (`https://advisory.echohq.com/openvex.json`), which lists
`pkg:npm/follow-redirects@1.15.6+echo.1` as `fixed` for that advisory — i.e.
Echo backports the fix onto the same `1.15.6` version rather than bumping
it.

**Unlike the base-image story, the installed version string here does
change** — from `1.15.6` (public) to `1.15.6+echo.1` (Echo) — but that
`+echo.N` build-metadata suffix doesn't change semver precedence, so a
scanner comparing versions still sees "1.15.6-ish, still in the vulnerable
range" and flags it. That's exactly why the reduction only shows up once
the scan is told about Echo's remediation via `--vex`; the version bump
alone isn't enough for a scanner to know it's fixed. See "Scanning" below.

`GET /libraries` reports both the installed axios and follow-redirects
versions plus this explanation. `GET /libraries/probe` makes a real
(short-timeout, safely-failing) outbound call using axios.

## Run locally

```bash
npm install
npm start
# curl http://localhost:8080/libraries
```

This installs from the **public** registry (no Echo credentials needed) —
fine for local dev of the app itself; it does not exercise Echo's library
hardening, and `npm audit` will report the `follow-redirects` advisory.

## Build both images

```bash
docker build -f Dockerfile -t libraries-regular .

docker login reg.echohq.com   # needed once, see root README for credentials
ECHO_LIBRARIES_KEY=<your Libraries key> \
  docker buildx build --secret id=ECHO_LIBRARIES_KEY,env=ECHO_LIBRARIES_KEY \
  -f Dockerfile.echo -t libraries-echo --load .
```

`docker buildx build --secret` requires BuildKit; on Docker Desktop / recent
Docker Engine this is the default builder already. `Dockerfile.echo` needs
**both** registry credentials (to pull `reg.echohq.com/node:23`) and a
Libraries key (a different key type, for `npm.echohq.com`) — both come from
**Settings → Keys** in the Echo platform.

## Scan locally with Trivy

```bash
trivy image libraries-regular
trivy image libraries-echo   # +echo.1 revision installed, but still flagged without VEX
```

To see the actual CVE reduction from Echo's library patching, fetch Echo's
OpenVEX feed and re-scan the echo image with it:

```bash
curl https://advisory.echohq.com/openvex.json -o openvex.json
trivy image --vex openvex.json libraries-echo
```

**By default this scan just goes quiet** — a `--vex` match is dropped from
the report entirely, with zero trace in the output. That's indistinguishable
from "the scanner found nothing to begin with," which is exactly the
confusing part. Add `--show-suppressed` (an `[EXPERIMENTAL]` Trivy flag,
table format only — it isn't in the JSON schema as of Trivy 0.74) to get an
explicit "Suppressed Vulnerabilities" section showing what was found and
remediated:

```bash
trivy image --vex openvex.json --show-suppressed libraries-echo
```

CI does this automatically and posts the suppressed-vulnerabilities table to
the `echo` job's summary, alongside the severity-count comparison.

## Lockfile note

This demo intentionally does not commit a `package-lock.json`, to avoid the
lockfile-regeneration step Echo's docs describe for production migrations
(see [Implementing npm](https://docs.echohq.com/libraries/implementing-npm)).
Both Dockerfiles use `npm install`, not `npm ci`. For a production rollout,
commit a lockfile regenerated against Echo's index and switch to `npm ci`.

CI does this automatically on every push/PR that touches this package - see
[`.github/workflows/libraries-build-and-scan.yml`](../../.github/workflows/libraries-build-and-scan.yml)
for the build + scan + comparison workflow.
