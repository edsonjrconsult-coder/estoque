/* Service worker: guarda todos os arquivos do app no iPad para funcionar sem internet. */
const CACHE = "estoque-autonomo-4ff0e7d3cb7c";
const FILES = [
 "./",
 "app.zip",
 "index.html",
 "ipad_main.py",
 "manifest.webmanifest",
 "pyodide/pyodide-lock.json",
 "pyodide/pyodide.asm.js",
 "pyodide/pyodide.asm.wasm",
 "pyodide/pyodide.js",
 "pyodide/python_stdlib.zip",
 "pyodide/sqlite3-1.0.0.zip",
 "static/core.js",
 "static/icone-180.png",
 "static/icone-192.png",
 "static/icone-512.png",
 "static/icone.ico",
 "static/icone.svg",
 "static/ipad.js",
 "static/style.css",
 "static/vendor/jsQR-LICENSE.txt",
 "static/vendor/jsQR.js",
 "static/views_admin.js",
 "static/views_main.js",
 "static/views_ops.js",
 "static/views_plan.js"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("estoque-autonomo-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await c.match("./") || await c.match("index.html") : null);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      return new Response("Sem conexão e arquivo não encontrado no cache.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
