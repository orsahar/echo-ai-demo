# libraries

A small Node.js HTTP server exercising several real npm packages
(`axios`/`follow-redirects`, `ajv`, `nanoid`, `path-to-regexp`, `jws`),
built two ways:

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

## The actual vulnerable dependencies

`axios@1.20.0` itself isn't in Echo's advisory coverage today, but five of
its neighbors are — each pinned to a version with a real, known CVE, chosen
directly from Echo's own OpenVEX feed (`https://advisory.echohq.com/openvex.json`)
so the remediation is verifiable rather than assumed:

| Package | Pinned version | Advisory | Used for |
|---|---|---|---|
| `follow-redirects` (transitive, via `overrides`) | `1.15.6` | [GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653) | `GET /libraries/probe` (via axios) |
| `ajv` | `8.17.1` | CVE-2025-69873 | `POST /validate` |
| `nanoid` | `3.3.6` | CVE-2024-55565, CVE-2026-67214, CVE-2026-73086 (**not** CVE-2026-67213 — see below) | request/token IDs |
| `path-to-regexp` | `0.1.10` | CVE-2024-52798, CVE-2026-4867 | `GET /users/:id` routing |
| `jws` | `4.0.0` | CVE-2025-65945 | `GET /token` |

`path-to-regexp@0.1.10` is the old Express-4-era version (different API from
the modern package) — the exact vulnerable version many production apps
still carry today via Express's own dependency tree, which makes it a
particularly relatable example.

**Not everything is patched, on purpose.** I scanned both images directly
(regular vs. echo, with and without `--vex`) and confirmed: of 9 CVE
findings across these 5 packages, Echo's OpenVEX feed remediates **8** —
`CVE-2026-67213` on `nanoid@3.3.6` is not currently covered, so it still
shows up on the echo image too. That's expected and consistent with Echo's
own docs ("patch availability is version-specific... our goal is always to
reach 0, but never at the expense of stability"), and it's a more honest
demo than a suspiciously perfect 100%.

**Unlike the base-image story, the installed version strings here do
change** — e.g. `follow-redirects` goes from `1.15.6` (public) to
`1.15.6+echo.1` (Echo) — but that `+echo.N` build-metadata suffix doesn't
change semver precedence, so a scanner comparing versions still sees
"1.15.6-ish, still in the vulnerable range" and flags it regardless. That's
exactly why the reduction only shows up once the scan is told about Echo's
remediation via `--vex`; the version bump alone isn't enough for a scanner
to know it's fixed. See "Scanning" below.

`GET /libraries` reports the installed version of every pinned package plus
this explanation. `GET /libraries/probe` makes a real (short-timeout,
safely-failing) outbound call using axios. `POST /validate` runs a JSON body
through an `ajv`-compiled schema. `GET /token` signs a demo token with
`jws`. `GET /users/:id` is matched via `path-to-regexp`'s old
(`pathToRegexp(path, keys)` → `RegExp`) API.

## Run locally

```bash
npm install
npm start
# curl http://localhost:8080/libraries
```

This installs from the **public** registry (no Echo credentials needed) —
fine for local dev of the app itself; it does not exercise Echo's library
hardening, and `npm audit` will report several advisories across the pinned
packages.

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
trivy image libraries-regular   # ~9 findings across the 5 pinned packages
trivy image libraries-echo      # +echo.N revisions installed, but still flagged without VEX
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

This should show 8 suppressed findings and 1 still-flagged finding
(`CVE-2026-67213` on `nanoid` — see above). If Echo's coverage has changed
since this was written, the exact split may differ; that's expected as
Echo's remediation set evolves.

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
