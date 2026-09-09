const http = require("node:http");
const axios = require("axios");

const PORT = process.env.PORT || 8080;
const AXIOS_VERSION = require("axios/package.json").version;
const FOLLOW_REDIRECTS_VERSION = require("follow-redirects/package.json").version;

// Real outbound call exercising axios's HTTP stack, not just a version
// string. Target is overridable in case a demo network can't reach it.
const PROBE_URL = process.env.AXIOS_PROBE_URL || "https://registry.npmjs.org/axios";
const PROBE_TIMEOUT_MS = 2000;

async function probeAxios() {
  try {
    const res = await axios.get(PROBE_URL, { timeout: PROBE_TIMEOUT_MS });
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err.code || err.message || "request failed" };
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.url === "/libraries") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        axios: { version: AXIOS_VERSION },
        followRedirects: { version: FOLLOW_REDIRECTS_VERSION },
        note:
          "axios's transitive dependency follow-redirects is pinned to " +
          "1.15.6 via an npm 'overrides' entry -- vulnerable to " +
          "GHSA-r4q5-vmmm-2653, fixed upstream in 1.16.0. From Echo's " +
          "registry the same 1.15.6 resolves to a patched revision " +
          "(reported here as e.g. '1.15.6+echo.1'), so the version string " +
          "alone shows the difference -- but a scanner still needs Echo's " +
          "OpenVEX feed to know that +echo.N revision is remediated. " +
          "Compare CVEs via the OpenVEX-aware Trivy scan (see CI job " +
          "summary), not by reading this field.",
      })
    );
    return;
  }

  if (req.url === "/libraries/probe") {
    probeAxios().then((result) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ axiosVersion: AXIOS_VERSION, probe: result }));
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "hello from echo-demo/libraries",
      node: process.version,
      axios: AXIOS_VERSION,
      followRedirects: FOLLOW_REDIRECTS_VERSION,
      endpoints: ["/", "/health", "/libraries", "/libraries/probe"],
    })
  );
});

server.listen(PORT, () => {
  console.log(`libraries server listening on port ${PORT}`);
});
