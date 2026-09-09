const http = require("node:http");
const { URL } = require("node:url");
const axios = require("axios");
const Ajv = require("ajv");
const { nanoid } = require("nanoid");
const pathToRegexp = require("path-to-regexp");
const jws = require("jws");

const PORT = process.env.PORT || 8080;

// Every package below is pinned (directly or, for follow-redirects, via an
// npm `overrides` entry) to a specific version with a known CVE that Echo's
// OpenVEX feed lists as remediated -- see package.json and README.
const LIBRARY_VERSIONS = {
  axios: require("axios/package.json").version,
  followRedirects: require("follow-redirects/package.json").version,
  ajv: require("ajv/package.json").version,
  nanoid: require("nanoid/package.json").version,
  pathToRegexp: require("path-to-regexp/package.json").version,
  jws: require("jws/package.json").version,
};

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

// path-to-regexp@0.1.10 predates the modern named-export API (match/compile).
// This is the old Express-4-era shape: it returns a RegExp directly and
// mutates the `keys` array you pass in with the param names, in order.
const userRouteKeys = [];
const userRoutePattern = pathToRegexp("/users/:id", userRouteKeys);

const validateSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "integer", minimum: 0 },
  },
  required: ["name"],
  additionalProperties: false,
};
const ajv = new Ajv();
const validateBody = ajv.compile(validateSchema);

const JWS_DEMO_SECRET = process.env.JWS_DEMO_SECRET || "echo-demo-not-a-real-secret";

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        req.destroy();
        reject(new Error("body too large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && pathname === "/") {
    sendJson(res, 200, {
      message: "hello from echo-demo/libraries",
      node: process.version,
      requestId: nanoid(),
      endpoints: [
        "GET /",
        "GET /health",
        "GET /libraries",
        "GET /libraries/probe",
        "POST /validate",
        "GET /token",
        "GET /users/:id",
      ],
    });
    return;
  }

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "GET" && pathname === "/libraries") {
    sendJson(res, 200, {
      versions: LIBRARY_VERSIONS,
      note:
        "follow-redirects, ajv, nanoid, path-to-regexp, and jws are pinned " +
        "to versions with known CVEs that Echo's OpenVEX feed lists as " +
        "remediated. Echo patches the same version rather than bumping it, " +
        "so these version strings won't show the fix -- compare via the " +
        "OpenVEX-aware Trivy scan (CI job summary's 'Echo-remediated " +
        "vulnerabilities' section), not by reading this field.",
    });
    return;
  }

  if (req.method === "GET" && pathname === "/libraries/probe") {
    const result = await probeAxios();
    sendJson(res, 200, { axiosVersion: LIBRARY_VERSIONS.axios, probe: result });
    return;
  }

  // Exercises ajv: validates the request body against a small schema.
  if (req.method === "POST" && pathname === "/validate") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, { valid: false, error: err.message });
      return;
    }
    const valid = validateBody(body);
    sendJson(res, valid ? 200 : 422, { valid, errors: validateBody.errors || null });
    return;
  }

  // Exercises jws: issues a signed demo token (not real auth -- just to
  // exercise the library, secret is a hardcoded demo default).
  if (req.method === "GET" && pathname === "/token") {
    const id = nanoid();
    const token = jws.sign({
      header: { alg: "HS256" },
      payload: { sub: id, demo: true, iat: Math.floor(Date.now() / 1000) },
      secret: JWS_DEMO_SECRET,
    });
    sendJson(res, 200, { id, token });
    return;
  }

  // Exercises path-to-regexp: matches /users/:id via the old Express-4-era API.
  if (req.method === "GET") {
    const match = userRoutePattern.exec(pathname);
    if (match) {
      const params = {};
      userRouteKeys.forEach((key, i) => {
        params[key.name] = match[i + 1];
      });
      sendJson(res, 200, { route: "/users/:id", params, requestId: nanoid() });
      return;
    }
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`libraries server listening on port ${PORT}`);
});
