const http = require("node:http");

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "hello from echo-demo/basic",
      node: process.version,
    })
  );
});

server.listen(PORT, () => {
  console.log(`basic server listening on port ${PORT}`);
});
