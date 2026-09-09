const http = require("node:http");
const { URL } = require("node:url");
const { ObjectId } = require("mongodb");
const { getDb, ping } = require("./db");

const PORT = process.env.PORT || 8080;

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

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

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && pathname === "/") {
    sendJson(res, 200, {
      message: "hello from echo-demo/production",
      node: process.version,
      endpoints: ["GET /", "GET /health", "POST /notes", "GET /notes", "GET /notes/:id"],
    });
    return;
  }

  // Real DB connectivity check, not just process liveness.
  if (req.method === "GET" && pathname === "/health") {
    try {
      await ping();
      sendJson(res, 200, { status: "ok", mongodb: "connected" });
    } catch (err) {
      sendJson(res, 503, { status: "degraded", mongodb: "unreachable", error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/notes") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
      return;
    }
    if (!body.text || typeof body.text !== "string") {
      sendJson(res, 422, { error: "'text' (string) is required" });
      return;
    }
    try {
      const db = await getDb();
      const result = await db.collection("notes").insertOne({
        text: body.text,
        createdAt: new Date(),
      });
      sendJson(res, 201, { id: result.insertedId });
    } catch (err) {
      sendJson(res, 502, { error: "database write failed", detail: err.message });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/notes") {
    try {
      const db = await getDb();
      const notes = await db
        .collection("notes")
        .find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      sendJson(res, 200, { notes });
    } catch (err) {
      sendJson(res, 502, { error: "database read failed", detail: err.message });
    }
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/notes/")) {
    const id = pathname.slice("/notes/".length);
    if (!ObjectId.isValid(id)) {
      sendJson(res, 400, { error: "invalid id" });
      return;
    }
    try {
      const db = await getDb();
      const note = await db.collection("notes").findOne({ _id: new ObjectId(id) });
      if (!note) {
        sendJson(res, 404, { error: "not found" });
        return;
      }
      sendJson(res, 200, note);
    } catch (err) {
      sendJson(res, 502, { error: "database read failed", detail: err.message });
    }
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`production server listening on port ${PORT}`);
});
