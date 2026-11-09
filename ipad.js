/* Estoque Autônomo — iPad.
   Roda o MESMO núcleo Python do Windows dentro do navegador (Pyodide/WebAssembly).
   Os dados ficam no iPad (IndexedDB, persistido a cada operação). Nada é enviado à internet. */
(function () {
  "use strict";
  const EA = window.EA;
  let py = null, call = null, FS = null;
  const MUTATING = new Set(["POST", "PUT", "DELETE"]);
  const PERSIST_PATHS = ["/exportar/banco"]; // GETs que gravam (backup) também precisam ser persistidos

  function splash(msg, sub) {
    let s = document.getElementById("splash");
    if (!s) {
      s = document.createElement("div");
      s.id = "splash";
      document.body.appendChild(s);
    }
    s.innerHTML = `<svg viewBox="0 0 32 32" width="64" height="64" aria-hidden="true"><rect x="5" y="15" width="22" height="12" fill="none" stroke="#e8b500" stroke-width="2"/><path d="M5 15 16 6l11 9" fill="none" stroke="#e8b500" stroke-width="2"/></svg>
      <div style="font-size:24px">Estoque Autônomo</div><div class="hz"></div><div>${EA.esc(msg)}</div>${sub ? `<p>${sub}</p>` : ""}`;
  }

  function syncfs(populate) {
    return new Promise((res, rej) => FS.syncfs(populate, (err) => (err ? rej(err) : res())));
  }
  let persistChain = Promise.resolve();
  EA.persist = function () {
    // serializa as gravações no IndexedDB (cada operação confirmada é salva antes de seguir)
    persistChain = persistChain.then(() => syncfs(false)).catch((e) => {
      console.error(e);
      EA.toast("ATENÇÃO: falha ao gravar no armazenamento do iPad (" + e + "). Exporte um backup agora.", true);
    });
    return persistChain;
  };

  // --------------------------------------------------------------- chamada ao núcleo (síncrona)
  function rawCall(method, pathWithQuery, body) {
    const i = pathWithQuery.indexOf("?");
    const path = decodeURIComponent(i >= 0 ? pathWithQuery.slice(0, i) : pathWithQuery);
    const query = i >= 0 ? pathWithQuery.slice(i + 1) : "";
    const r = call(method, path, query, body === undefined ? "" : JSON.stringify(body), EA.session || "");
    const out = r.toJs();
    r.destroy();
    let data = out[2];
    if (data && data.toJs) { const d = data.toJs(); data.destroy(); data = d; }
    return { status: out[0], ctype: out[1], data: data, filename: out[3] };
  }

  EA.api = async function (method, path, body) {
    const r = rawCall(method, path, body);
    if (MUTATING.has(method)) await EA.persist();
    let obj = null;
    try { obj = JSON.parse(new TextDecoder().decode(r.data)); } catch (e) { obj = null; }
    if (r.status >= 400) {
      EA.authFailed(r.status, obj);
      throw new Error((obj && obj.error) || "Erro " + r.status);
    }
    return obj;
  };

  // --------------------------------------------------------------- URLs de imagens e arquivos
  const IMG = /^\/(codigo|foto)\//;
  EA.url = function (path, params) {
    const u = new URLSearchParams(params || {});
    const full = path + (u.toString() ? "?" + u.toString() : "");
    if (IMG.test(path)) {
      const r = rawCall("GET", full);
      if (r.status !== 200) return "";
      return URL.createObjectURL(new Blob([r.data], { type: r.ctype }));
    }
    return "ea:" + full;
  };
  EA.frameSrc = function (frame, u) {
    const r = rawCall("GET", u.replace(/^ea:/, ""));
    frame.removeAttribute("src");
    frame.srcdoc = new TextDecoder().decode(r.data);
  };
  EA.openUrl = function (u) { openFile(u.replace(/^ea:/, "").replace(/#.*$/, "")); };
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href^='ea:']");
    if (!a) return;
    e.preventDefault();
    openFile(a.getAttribute("href").slice(3));
  }, true);

  function openFile(pathq) {
    const r = rawCall("GET", pathq);
    if (r.status >= 400) {
      let m = "Erro " + r.status;
      try { m = JSON.parse(new TextDecoder().decode(r.data)).error; } catch (x) { /* */ }
      return EA.toast(m, true);
    }
    if (PERSIST_PATHS.some((p) => pathq.startsWith(p))) EA.persist();
    if (r.ctype.startsWith("text/html")) return viewer(pathq, new TextDecoder().decode(r.data));
    const name = r.filename || "arquivo";
    deliver(new File([r.data], name, { type: r.ctype.split(";")[0] }), pathq);
  }

  async function deliver(file, pathq) {
    // Compartilhar abre o menu do iPad: Salvar em Arquivos (inclusive pendrive USB/iCloud), Imprimir, AirDrop...
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: file.name });
        afterExport(pathq);
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    afterExport(pathq);
  }

  function afterExport(pathq) {
    if (pathq.startsWith("/exportar/banco") || pathq.startsWith("/exportar/json")) {
      EA.put("/api/settings", { values: { ipad_last_export: new Date().toISOString().slice(0, 19).replace("T", " ") } }).catch(() => {});
    }
  }

  // Visualizador para relatórios/etiquetas em HTML, com geração de PDF para imprimir (AirPrint) ou salvar
  function viewer(pathq, html) {
    const v = document.createElement("div");
    v.className = "viewer";
    const pdfPath = pathq.startsWith("/relatorio") || pathq.startsWith("/etiquetas")
      ? pathq.replace(/([?&])formato=[^&]*/, "$1").replace(/[?&]$/, "") + (pathq.includes("?") ? "&" : "?") + "formato=pdf" : null;
    v.innerHTML = `<header><h2>Visualização</h2>${pdfPath ? '<button class="btn" data-pdf>Imprimir ou salvar (PDF)</button>' : ""}<button class="btn ghost" data-close>Fechar</button></header><iframe title="Visualização"></iframe>`;
    document.body.appendChild(v);
    v.querySelector("iframe").srcdoc = html.replace("location.hash==='#imprimir'", "false");
    v.querySelector("[data-close]").onclick = () => v.remove();
    if (pdfPath) v.querySelector("[data-pdf]").onclick = () => openFile(pdfPath);
  }

  // --------------------------------------------------------------- lembrete de cópia para Arquivos
  function exportReminder() {
    if (window.EA_DEMO) return;
    const last = EA.boot.settings.ipad_last_export;
    const days = last ? (Date.now() - new Date(last.replace(" ", "T")).getTime()) / 864e5 : Infinity;
    if (days < 7 || document.getElementById("export-reminder")) return;
    const box = document.getElementById("alerts");
    const div = document.createElement("div");
    div.id = "export-reminder";
    div.className = "alert warn";
    div.innerHTML = `<span>${last ? "A última cópia do banco para o app Arquivos foi há " + Math.floor(days) + " dias." : "Você ainda não salvou nenhuma cópia do banco fora do app."} No iPad, os dados ficam guardados no próprio app: <b>se o app for removido da Tela de Início, eles são apagados</b>. Salve uma cópia no app Arquivos (iCloud Drive, pendrive USB ou “No meu iPad”).</span><div class="actions"><a class="btn sm" href="ea:/exportar/banco">Salvar cópia agora</a></div>`;
    box.appendChild(div);
  }

  // --------------------------------------------------------------- inicialização
  EA.bootIpad = async function () {
    document.body.classList.add("ipad");
    splash("Carregando…", "Na primeira abertura leva alguns segundos. Depois funciona sem internet.");
    if ("serviceWorker" in navigator) {
      if (!window.EA_DEMO) { try { await navigator.serviceWorker.register("sw.js"); } catch (e) { console.warn("SW", e); } }
    }
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* */ }
    const opts = { indexURL: window.EA_PYODIDE_URL || "pyodide/", stdout: () => {}, stderr: (t) => console.warn(t) };
    if (window.EA_STDLIB_URL) opts.stdLibURL = window.EA_STDLIB_URL; // hospedagens que não servem .zip
    if (window.EA_LOCK_URL) opts.lockFileURL = window.EA_LOCK_URL;
    py = await loadPyodide(opts);
    if (window.EA_STDLIB_URL) {
      // pacotes servidos com extensão .zip.wasm (hospedagens que recusam .zip)
      py.runPython("import shutil\nshutil.register_unpack_format('zipwasm', ['.zip.wasm'], shutil._unpack_zipfile)");
    }
    await py.loadPackage("sqlite3", { messageCallback: () => {} });
    FS = py.FS;
    try { FS.mkdir("/data"); } catch (e) { /* já existe */ }
    FS.mount(py.FS.filesystems.IDBFS, {}, "/data");
    await syncfs(true);
    // banco inicial opcional (usado na página de demonstração)
    if (window.EA_SEED_DB && !py.FS.analyzePath("/data/estoque.db").exists) {
      const seed = new Uint8Array(await (await fetch(window.EA_SEED_DB)).arrayBuffer());
      py.FS.writeFile("/data/estoque.db", seed);
    }
    const appZip = await (await fetch(window.EA_APP_ZIP || "app.zip")).arrayBuffer();
    py.unpackArchive(appZip, "zip", { extractDir: "/app" });
    const main = await (await fetch("ipad_main.py")).text();
    py.runPython(main);
    call = py.globals.get("call");
    await EA.persist();
    window.EA_TOKEN = "ipad";
    window.EA_VERSION = py.runPython("version()");
    const s = document.getElementById("splash");
    if (s) s.remove();
    EA.onEnter = exportReminder;
    await EA.start();
    // grava ao sair/minimizar (segurança extra)
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") EA.persist(); });
  };
  window.addEventListener("error", (e) => {
    if (!call) splash("Não foi possível iniciar.", EA.esc(String(e.message || e)) + "<br>Feche o app e abra novamente. Se persistir, reinstale a partir do endereço original.");
  });
})();
