/* 간단 로컬 서버 — `node serve.js` 실행 후 http://localhost:8642 접속 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = 8642;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/plain; charset=utf-8"
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let file = path.normalize(path.join(ROOT, urlPath === "/" ? "index.html" : urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  // Cloudflare Pages serves /learn for learn.html, so the pages address each
  // other that way. Resolve the same extensionless URLs here, or local testing
  // exercises paths the deployed site never sees.
  if (!path.extname(file)) {
    const withHtml = file.replace(/[/]$/, "") + ".html";
    if (fs.existsSync(withHtml)) file = withHtml;
    else if (fs.existsSync(path.join(file, "index.html"))) file = path.join(file, "index.html");
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"   // 수정사항이 새로고침만으로 바로 반영되도록
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log("World Earthquake Labs ▶ http://localhost:" + PORT);
  console.log("종료하려면 Ctrl+C");
});
