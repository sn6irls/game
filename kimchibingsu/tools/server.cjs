// Local preview only. GitHub Pages serves these same files without Node.js.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
};
http
  .createServer((req, res) => {
    let file;
    try {
      const requested = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      file = path.resolve(
        root,
        "." + (requested === "/" ? "/index.html" : requested),
      );
    } catch {
      res.writeHead(400);
      return res.end("Bad request");
    }
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.setHeader(
        "Content-Type",
        types[path.extname(file).toLowerCase()] || "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-cache");
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/`));
