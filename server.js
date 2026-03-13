const http = require("http");
const https = require("https");
const url = require("url");

const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  const targetHost = req.headers["x-target-host"] || "clob.polymarket.com";
  const parsedUrl = url.parse(req.url);

  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lower = k.toLowerCase();
    if (["x-target-host", "host", "x-forwarded-for", "x-real-ip", "true-client-ip", "cf-connecting-ip"].includes(lower)) continue;
    forwardHeaders[lower] = v;
  }
  forwardHeaders["host"] = targetHost;

  let body = Buffer.alloc(0);
  req.on("data", chunk => { body = Buffer.concat([body, chunk]); });
  req.on("end", () => {
    const options = {
      hostname: targetHost,
      port: 443,
      path: parsedUrl.path,
      method: req.method,
      headers: forwardHeaders,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    });

    if (body.length > 0) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
