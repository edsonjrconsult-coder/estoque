/* Estoque Autônomo — núcleo da interface (sem bibliotecas externas, sem internet). */
(function () {
  "use strict";
  const EA = (window.EA = { views: {}, boot: null });

  // ------------------------------------------------------------ API local
  EA.api = async function (method, path, body) {
    const opt = { method, headers: { "X-EA-Token": window.EA_TOKEN, "X-EA-Session": EA.session || "" } };
    if (body !== undefined) {
      opt.headers["Content-Type"] = "application/json";
      opt.body = JSON.stringify(body);
    }
    let r;
    try {
      r = await fetch(path, opt);
    } catch (e) {
      throw new Error("O serviço local do Estoque Autônomo não está respondendo. Abra o sistema novamente pelo atalho.");
    }
    let data = null;
    try { data = await r.json(); } catch (e) { data = null; }
    if (!r.ok) {
      EA.authFailed(r.status, data);
      throw new Error((data && data.error) || "Erro " + r.status);
    }
    return data;
  };
  // a sessão vale só para esta janela/aba (some ao fechar); recarregar a página não exige novo login
  EA.user = null;
  Object.defineProperty(EA, "session", {
    get() { try { return sessionStorage.getItem("ea_session"); } catch (e) { return EA._sess || null; } },
    set(v) { EA._sess = v; try { if (v) sessionStorage.setItem("ea_session", v); else sessionStorage.removeItem("ea_session"); } catch (e) { /* */ } },
  });
  // sessão expirada ou ausente: volta para a tela de entrada sem perder a tela em que estava
  EA.authFailed = function (status, data) {
    if (status === 401 && data && data.auth && EA.user) {
      EA.user = null; EA.session = null;
      setTimeout(() => EA.showLogin(true), 0);
    }
  };
  EA.get = (p) => EA.api("GET", p);
  EA.post = (p, b) => EA.api("POST", p, b || {});
  EA.put = (p, b) => EA.api("PUT", p, b || {});
  EA.del = (p) => EA.api("DELETE", p, {});
  EA.url = function (path, params) {
    const u = new URLSearchParams(params || {});
    u.set("t", window.EA_TOKEN);
    if (EA.session) u.set("s", EA.session);
    return path + "?" + u.toString();
  };
  // Abertura de arquivos gerados (relatórios, etiquetas, exportações). O app do iPad substitui estas funções.
  EA.openUrl = function (u, newTab) { if (newTab) window.open(u, "_blank"); else window.location.href = u; };
  EA.frameSrc = function (frame, u) { frame.src = u; };
  EA.qs = function (obj) {
    const u = new URLSearchParams();
    Object.entries(obj || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") u.set(k, v); });
    const s = u.toString();
    return s ? "?" + s : "";
  };

  // ------------------------------------------------------------ formatação
  const esc = (EA.esc = function (s) {
    return s === null || s === undefined ? "" : String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  });
  EA.num = function (v, dec) {
    if (v === null || v === undefined || v === "" || isNaN(v)) return "—";
    dec = dec === undefined ? 3 : dec;
    return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
  };
  EA.money = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  EA.date = function (s) {
    if (!s) return "—";
    s = String(s);
    if (s.length >= 10 && s[4] === "-") {
      let out = s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4);
      if (s.length >= 16) out += " " + s.slice(11, 16);
      return out;
    }
    return s;
  };
  EA.days = function (v, capped) {
    if (v === null || v === undefined) return '<span class="muted">sem consumo</span>';
    if (capped) return "&gt; 10 anos";
    // arredonda sempre para baixo: em autonomia, a estimativa conservadora é a segura
    if (v >= 365) return EA.num(Math.floor((v / 365.25) * 10) / 10, 1) + " anos";
    return v < 10 ? EA.num(Math.floor(v * 10) / 10, 1) + " dias" : EA.num(Math.floor(v), 0) + " dias";
  };
  EA.qty = (v, u) => EA.num(v) + " " + esc(u || "");
  EA.todayISO = function () {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  const STATUS = {
    adequado: ["b-green", "Adequado"], baixo: ["b-amber", "Estoque baixo"], vencendo: ["b-yellow", "Vencendo"], vencido: ["b-red", "Vencido"],
  };
  EA.statusBadge = (st) => { const s = STATUS[st] || ["b-grey", st]; return `<span class="badge ${s[0]}">${s[1]}</span>`; };
  EA.expiryBadge = function (status, days) {
    if (!status || status === "sem_validade") return '<span class="badge b-grey">sem validade</span>';
    if (status === "vencido") return `<span class="badge b-red">vencido há ${Math.abs(days)} d</span>`;
    if (status === "ok") return `<span class="badge b-green">${days} dias</span>`;
    const lim = parseInt(status.slice(6), 10);
    const cls = lim <= 15 ? "b-red" : lim <= 30 ? "b-amber" : "b-yellow";
    return `<span class="badge ${cls}">vence em ${days} d</span>`;
  };
  EA.flagBadges = function (flags) {
    const m = { vencido: ["b-red", "itens vencidos"], vencendo: ["b-yellow", "vencendo"], baixo: ["b-amber", "abaixo do mínimo"], zerado: ["b-red", "zerado"], acima_maximo: ["b-blue", "acima do máximo"] };
    return (flags || []).map((f) => `<span class="badge ${m[f] ? m[f][0] : "b-grey"}">${m[f] ? m[f][1] : f}</span>`).join(" ");
  };
  EA.daysClass = function (d, target) {
    if (d === null || d === undefined) return "";
    if (d < Math.min(30, target || 30)) return "red";
    if (d < (target || 90)) return "amber";
    return "";
  };

  // ------------------------------------------------------------ dados de apoio
  EA.reloadBoot = async function () {
    EA.boot = await EA.get("/api/bootstrap");
    document.getElementById("house").textContent = EA.boot.settings.household_name || "";
    return EA.boot;
  };
  EA.catName = (id) => { const c = EA.boot.categories.find((x) => x.id == id); return c ? c.name : ""; };
  EA.catOptions = function (sel, opts) {
    opts = opts || {};
    const tops = EA.boot.categories.filter((c) => !c.parent_id && (c.active || c.id == sel));
    let h = opts.blank !== false ? `<option value="">${opts.blankLabel || "— todas —"}</option>` : "";
    tops.forEach((t) => {
      h += `<option value="${t.id}" ${t.id == sel ? "selected" : ""}>${esc(t.name)}</option>`;
      if (opts.withSubs) EA.boot.categories.filter((c) => c.parent_id === t.id && c.active).forEach((s) => {
        h += `<option value="${s.id}" ${s.id == sel ? "selected" : ""}>&nbsp;&nbsp;↳ ${esc(s.name)}</option>`;
      });
    });
    return h;
  };
  EA.subOptions = function (parent, sel) {
    let h = '<option value="">— nenhuma —</option>';
    EA.boot.categories.filter((c) => c.parent_id == parent && (c.active || c.id == sel)).forEach((s) => {
      h += `<option value="${s.id}" ${s.id == sel ? "selected" : ""}>${esc(s.name)}</option>`;
    });
    return h;
  };
  EA.locOptions = function (sel, blank) {
    let h = `<option value="">${blank || "— selecione —"}</option>`;
    EA.boot.locations.filter((l) => l.active || l.id == sel).forEach((l) => {
      h += `<option value="${l.id}" ${l.id == sel ? "selected" : ""}>${esc(l.path)}</option>`;
    });
    return h;
  };
  EA.unitOptions = function (sel) {
    return EA.boot.units.map((u) => `<option value="${esc(u.code)}" ${u.code === sel ? "selected" : ""}>${esc(u.code)} — ${esc(u.name)}</option>`).join("");
  };
  EA.locPath = (id) => { const l = EA.boot.locations.find((x) => x.id == id); return l ? l.path : ""; };

  EA.responsible = function () { return EA.user ? EA.user.name : ""; };
  EA.rememberResponsible = function (v) { try { if (v) localStorage.setItem("ea_resp", v); } catch (e) { /* sem armazenamento */ } };

  // ------------------------------------------------------------ toasts e modais
  EA.toast = function (msg, isErr) {
    const t = document.createElement("div");
    t.className = "toast" + (isErr ? " err" : "");
    t.textContent = msg;
    document.getElementById("toasts").appendChild(t);
    setTimeout(() => t.remove(), isErr ? 7000 : 3500);
  };

  EA.modal = function (opts) {
    const root = document.getElementById("modal-root");
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal ${opts.size || ""}" role="dialog" aria-modal="true">
      <header><h2>${esc(opts.title)}</h2><button class="icon-btn" data-x aria-label="Fechar">✕</button></header>
      <div class="body"><div class="err"></div>${opts.body || ""}</div>
      ${opts.footer === false ? "" : `<footer>${opts.footer || `<button class="btn ghost" data-x>Cancelar</button><button class="btn" data-ok>${esc(opts.okLabel || "Salvar")}</button>`}</footer>`}
    </div>`;
    root.appendChild(bg);
    const m = bg.querySelector(".modal");
    const prev = document.activeElement;
    const close = () => { bg.remove(); if (opts.onClose) opts.onClose(); if (prev && prev.focus) prev.focus(); };
    m.close = close;
    m.error = (msg) => { const e = m.querySelector(".err"); e.textContent = msg; e.classList.toggle("show", !!msg); if (msg) e.scrollIntoView({ block: "nearest" }); };
    bg.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", close));
    bg.addEventListener("keydown", (e) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab") return;
      // mantém o foco do teclado dentro da janela
      const els = Array.from(m.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    const ok = bg.querySelector("[data-ok]");
    if (ok && opts.onOk) {
      const run = async () => {
        ok.disabled = true;
        m.error("");
        try {
          const r = await opts.onOk(m);
          if (r !== false) close();
        } catch (e) {
          m.error(e.message);
        } finally {
          ok.disabled = false;
        }
      };
      ok.addEventListener("click", run);
      m.querySelectorAll("form").forEach((f) => f.addEventListener("submit", (e) => { e.preventDefault(); run(); }));
    }
    if (opts.onOpen) opts.onOpen(m);
    const first = m.querySelector("[autofocus], input:not([type=hidden]):not([readonly]), select, textarea");
    if (first) first.focus();
    return m;
  };
  EA.confirm = function (title, html, okLabel, danger) {
    return new Promise((res) => {
      EA.modal({
        title, size: "narrow", body: `<div>${html}</div>`,
        footer: `<button class="btn ghost" data-x>Cancelar</button><button class="btn ${danger ? "danger" : ""}" data-ok>${esc(okLabel || "Confirmar")}</button>`,
        onOk: () => { res(true); }, onClose: () => res(false),
      });
    });
  };
  EA.formData = function (root) {
    const o = {};
    root.querySelectorAll("[name]").forEach((el) => {
      if (el.type === "checkbox") o[el.name] = el.checked ? 1 : 0;
      else if (el.type === "radio") { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value;
    });
    return o;
  };
  EA.respField = function () {
    return `<label class="fld s4"><span>Responsável (usuário conectado)</span><input name="responsible" value="${esc(EA.responsible())}" readonly tabindex="-1"></label>`;
  };

  // ------------------------------------------------------------ menu e rotas
  // Ícones próprios (traço), desenhados em SVG: iguais em qualquer aparelho, sem depender de fontes
  const I = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  EA.icons = {
    dashboard: I('<rect x="3" y="3" width="8" height="10" rx="1"/><rect x="13" y="3" width="8" height="6" rx="1"/><rect x="13" y="11" width="8" height="10" rx="1"/><rect x="3" y="15" width="8" height="6" rx="1"/>'),
    produtos: I('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'),
    lancar: I('<path d="M4 6h10M4 12h10M4 18h6"/><path d="M18 9v8M14 13h8"/>'),
    categorias: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    locais: I('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
    lotes: I('<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="8" height="6" rx="1"/><rect x="13" y="14" width="8" height="6" rx="1"/>'),
    movimentacoes: I('<path d="M4 8h14l-3-3M20 16H6l3 3"/>'),
    consumo: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pessoas: I('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.3"/><path d="M16 14.2c2.8.3 5 2.6 5 5.8"/>'),
    validade: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>'),
    etiquetas: I('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v7M14 20h3"/>'),
    compras: I('<path d="M3 4h2l2.5 11h10.5l2-8H6.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>'),
    revisao: I('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 12l2.5 2.5 4.5-5"/>'),
    relatorios: I('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 17v-3M12 17v-5M15 17v-2"/>'),
    emergencia: I('<path d="M12 3 2 20h20z"/><path d="M12 10v4.5M12 17.5v.1"/>'),
    backup: I('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
    configuracoes: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
    ajuda: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17v.1"/>'),
    camera: I('<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    minus: I('<path d="M5 12h14"/>'),
    user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>'),
  };
  const MENU = [
    ["dashboard", "Painel"], ["produtos", "Produtos"], ["lancar", "Lançar estoque"], ["categorias", "Categorias"],
    ["locais", "Locais e mapa"], ["lotes", "Lotes e recipientes"], ["movimentacoes", "Movimentações"],
    ["consumo", "Consumo e autonomia"], ["pessoas", "Planejamento por pessoa"], ["validade", "Validade"],
    ["etiquetas", "QR Codes e etiquetas"], ["compras", "Compras e reposição"], ["revisao", "Revisão periódica"],
    ["relatorios", "Relatórios"], "sep", ["emergencia", "Modo de emergência", "emerg"], "sep",
    ["backup", "Backup"], ["configuracoes", "Configurações"], ["ajuda", "Ajuda"],
  ];
  function renderMenu(active) {
    document.getElementById("menu").innerHTML = MENU.map((m) => {
      if (m === "sep") return '<div class="sep"></div>';
      return `<a href="#/${m[0]}" class="${m[0] === active ? "on" : ""} ${m[2] || ""}" data-r="${m[0]}" ${m[0] === active ? 'aria-current="page"' : ""}><span class="ic">${EA.icons[m[0]] || ""}</span>${m[1]}</a>`;
    }).join("");
  }

  EA.go = (h) => { if (location.hash === h) route(); else location.hash = h; };
  EA.refresh = () => route();
  let routeSeq = 0;
  async function route() {
    const h = location.hash.replace(/^#\/?/, "") || "dashboard";
    const [name, arg] = h.split("/");
    const view = EA.views[name] ? name : "dashboard";
    const groupOf = { produto: "produtos", lote: "lotes", recipiente: "lotes", local: "locais" };
    renderMenu(groupOf[view] || view);
    document.body.classList.toggle("emergency", view === "emergencia");
    document.getElementById("side").classList.remove("open");
    const host = document.getElementById("view");
    const seq = ++routeSeq;
    const el = document.createElement("div");
    const slow = setTimeout(() => { if (seq === routeSeq) host.innerHTML = '<div class="empty">Carregando…</div>'; }, 150);
    try {
      await EA.views[view](el, arg ? decodeURIComponent(arg) : undefined);
    } catch (e) {
      el.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`;
    }
    clearTimeout(slow);
    if (seq !== routeSeq) return; // o usuário já navegou para outra tela
    host.replaceChildren(el);
    window.scrollTo(0, 0);
    if (document.activeElement === document.body) host.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ leitura de códigos (USB e câmera)
  EA.openCode = async function (code) {
    code = (code || "").trim();
    if (!code) return;
    try {
      const r = await EA.get("/api/lookup" + EA.qs({ code }));
      const target = { produto: "#/produto/" + r.id, lote: "#/lote/" + r.id, recipiente: "#/recipiente/" + r.id, local: "#/local/" + r.id }[r.kind];
      EA.toast("Código lido: " + r.code);
      EA.go(target);
    } catch (e) {
      // não é etiqueta: usa como busca de produto
      EA.go("#/produtos/" + encodeURIComponent(code));
    }
  };

  function setupScanner() {
    const form = document.getElementById("scan-form");
    const inp = document.getElementById("scan");
    form.addEventListener("submit", (e) => { e.preventDefault(); const v = inp.value; inp.value = ""; EA.openCode(v); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "F2") { e.preventDefault(); inp.focus(); inp.select(); }
    });
    // leitor USB digitando com o foco fora de campos: captura sequências rápidas terminadas em Enter
    let buf = "", last = 0;
    document.addEventListener("keydown", (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector(".modal-bg")) return;
      const now = Date.now();
      if (now - last > 80) buf = "";
      last = now;
      if (e.key === "Enter") {
        if (buf.length >= 5) { e.preventDefault(); EA.openCode(buf); }
        buf = "";
      } else if (e.key.length === 1) buf += e.key;
    });
    document.getElementById("scan-cam").addEventListener("click", () => EA.cameraScan((code) => EA.openCode(code)));
  }

  EA.cameraScan = function (onCode) {
    let stream = null, raf = null, done = false;
    const m = EA.modal({
      title: "Ler QR Code pela câmera", size: "narrow", footer: '<button class="btn ghost" data-x>Fechar</button>',
      body: `<p class="muted small">Aponte a câmera para a etiqueta. A leitura acontece neste computador, sem internet.</p>
        <video playsinline muted style="width:100%;background:#000;border-radius:6px;max-height:50vh"></video>
        <canvas hidden></canvas><p class="small" data-st>Iniciando câmera…</p>
        <details class="small"><summary>Sem câmera? Ler a partir de uma foto</summary><input type="file" accept="image/*" data-file></details>`,
      onClose: () => { done = true; if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); },
    });
    const video = m.querySelector("video"), canvas = m.querySelector("canvas"), st = m.querySelector("[data-st]");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const found = (code) => { if (done) return; done = true; m.close(); onCode(code); };
    const decode = (w, h) => {
      const img = ctx.getImageData(0, 0, w, h);
      const r = window.jsQR ? jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" }) : null;
      return r && r.data ? r.data : null;
    };
    m.querySelector("[data-file]").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, 1600 / Math.max(img.width, img.height));
        canvas.width = img.width * sc; canvas.height = img.height * sc;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const c = decode(canvas.width, canvas.height);
        if (c) found(c); else st.textContent = "Nenhum QR Code encontrado na imagem.";
      };
      img.src = URL.createObjectURL(f);
    });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      st.textContent = "Câmera indisponível neste computador. Use o leitor USB ou uma foto.";
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
      stream = s;
      video.srcObject = s;
      video.play();
      st.textContent = "Procurando QR Code…";
      const tick = () => {
        if (done) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const c = decode(canvas.width, canvas.height);
          if (c) return found(c);
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    }).catch((e) => { st.textContent = "Não foi possível usar a câmera: " + e.message; });
  };

  // ------------------------------------------------------------ alertas globais
  EA.renderAlerts = function () {
    const s = EA.boot.startup || {};
    const box = document.getElementById("alerts");
    let h = "";
    if (s.unclean_previous && !sessionStorageGet("ea_seen_unclean")) {
      h += s.ok
        ? `<div class="alert good" data-k="ea_seen_unclean"><span>O sistema foi encerrado de forma inesperada da última vez (queda de energia ou desligamento). A verificação de integridade foi concluída: <b>banco íntegro, nenhum dado perdido</b>.</span><div class="actions"><button class="btn sm ghost" data-dismiss>Entendi</button></div></div>`
        : "";
    }
    if (s.ok === false) {
      h += `<div class="alert bad"><span>A verificação de integridade encontrou problemas: ${esc((s.issues || []).slice(0, 3).join("; "))}.</span><div class="actions"><a class="btn sm danger" href="#/backup">Restaurar um backup</a></div></div>`;
    }
    box.innerHTML = h;
    box.querySelectorAll("[data-dismiss]").forEach((b) => b.addEventListener("click", () => {
      const a = b.closest(".alert"); sessionStorageSet(a.dataset.k, "1"); a.remove();
    }));
  };
  function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  // ------------------------------------------------------------ entrada (usuário e senha)
  function authShell(inner) {
    const chip = document.getElementById("user-chip");
    if (chip) chip.remove();
    let a = document.getElementById("auth");
    if (!a) { a = document.createElement("div"); a.id = "auth"; document.body.appendChild(a); }
    a.innerHTML = `<div class="auth-card"><div class="auth-brand"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="15" width="22" height="12" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15 16 6l11 9" fill="none" stroke="currentColor" stroke-width="2"/></svg><div><b>Estoque Autônomo</b><small>${esc((EA.authStatus && EA.authStatus.household) || "")}</small></div></div>${inner}</div>`;
    const f = a.querySelector("input:not([readonly])");
    if (f) f.focus(); // foco imediato (um foco atrasado poderia "roubar" o que já está sendo digitado)
    return a;
  }
  function authErr(a, msg) { const e = a.querySelector(".auth-err"); e.textContent = msg || ""; e.hidden = !msg; }
  async function authPost(path, body) {
    // as rotas de entrada não exigem sessão
    const prev = EA.session;
    try { return await EA.post(path, body); } finally { if (!EA.session) EA.session = prev; }
  }

  EA.showSetup = function () {
    const a = authShell(`<h1>Criar o administrador</h1><p>Primeiro acesso: crie o usuário administrador. Depois você poderá cadastrar outras pessoas da casa, com perfis de acesso.</p>
      <form class="form" data-f>
        <label class="fld s12"><span>Seu nome</span><input name="name" autocomplete="name" required></label>
        <label class="fld s12"><span>Usuário (para entrar)</span><input name="username" autocomplete="username" autocapitalize="none" required></label>
        <label class="fld s6"><span>Senha (mín. 6 caracteres)</span><input name="password" type="password" autocomplete="new-password" required></label>
        <label class="fld s6"><span>Repita a senha</span><input name="password2" type="password" autocomplete="new-password" required></label>
        <label class="auth-check fld s12" style="flex-direction:row"><input type="checkbox" name="catalog" checked> Já cadastrar a lista de produtos comuns (água, arroz, feijão, flocão, charque, enlatados, higiene, limpeza, gás…) com estoque zerado</label>
        <p class="auth-err" hidden></p><button class="btn" type="submit">Criar e entrar</button></form>`);
    a.querySelector("[data-f]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = EA.formData(e.target);
      if (d.password !== d.password2) return authErr(a, "As senhas não são iguais.");
      try {
        const r = await authPost("/api/auth/setup", d);
        EA.session = r.session; EA.user = r.user;
        EA.showRecoveryCode(r.recovery_code, async () => {
          if (d.catalog) await EA.addWholeCatalog();
          EA.enter();
        });
      } catch (err) { authErr(a, err.message); }
    });
  };

  EA.showRecoveryCode = function (code, then) {
    const a = authShell(`<h1>Guarde o código de recuperação</h1>
      <p>Se você esquecer a senha do administrador, este código é a <b>única forma</b> de recuperar o acesso. Anote em papel e guarde junto do inventário de emergência.</p>
      <div class="auth-code">${esc(code)}</div>
      <p class="small muted">Ele só aparece agora. Depois de usado, o sistema gera um novo. Um administrador pode gerar outro em Configurações › Usuários.</p>
      <label class="auth-check"><input type="checkbox" data-ok> Anotei o código em lugar seguro</label>
      <button class="btn" data-go disabled>Continuar</button>`);
    const ok = a.querySelector("[data-ok]"), go = a.querySelector("[data-go]");
    ok.addEventListener("change", () => (go.disabled = !ok.checked));
    go.addEventListener("click", then);
  };

  EA.showLogin = function (expired) {
    const demo = EA.authStatus && EA.authStatus.demo;
    const a = authShell(`<h1>Entrar</h1>${expired ? '<p class="auth-note">Sua sessão terminou por inatividade. Entre novamente para continuar de onde parou.</p>' : ""}
      ${demo ? '<p class="auth-note">Demonstração: usuário <b>demo</b>, senha <b>demo123</b>.</p>' : ""}
      <form class="form" data-f>
        <label class="fld s12"><span>Usuário</span><input name="username" autocomplete="username" autocapitalize="none" required></label>
        <label class="fld s12"><span>Senha</span><input name="password" type="password" autocomplete="current-password" required></label>
        <p class="auth-err" hidden></p><button class="btn" type="submit">Entrar</button></form>
      <button class="link auth-forgot" data-forgot>Esqueci a senha</button>`);
    a.querySelector("[data-f]").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const r = await authPost("/api/auth/login", EA.formData(e.target));
        EA.session = r.session; EA.user = r.user;
        EA.enter();
      } catch (err) { authErr(a, err.message); }
    });
    a.querySelector("[data-forgot]").addEventListener("click", EA.showRecover);
  };

  EA.showRecover = function () {
    const a = authShell(`<h1>Recuperar acesso</h1><p>Use o código de recuperação anotado quando o administrador foi criado. Usuários que não são administradores devem pedir a um administrador que troque a senha.</p>
      <form class="form" data-f>
        <label class="fld s12"><span>Código de recuperação</span><input name="code" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" required></label>
        <label class="fld s12"><span>Usuário do administrador</span><input name="username" autocapitalize="none" required></label>
        <label class="fld s6"><span>Nova senha</span><input name="password" type="password" autocomplete="new-password" required></label>
        <label class="fld s6"><span>Repita</span><input name="password2" type="password" autocomplete="new-password" required></label>
        <p class="auth-err" hidden></p><button class="btn" type="submit">Redefinir senha</button></form>
      <button class="link auth-forgot" data-back>Voltar</button>`);
    a.querySelector("[data-back]").addEventListener("click", () => EA.showLogin());
    a.querySelector("[data-f]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = EA.formData(e.target);
      if (d.password !== d.password2) return authErr(a, "As senhas não são iguais.");
      try {
        const r = await authPost("/api/auth/recover", d);
        EA.showRecoveryCode(r.recovery_code, () => EA.showLogin());
      } catch (err) { authErr(a, err.message); }
    });
  };

  // depois de restaurar, todos entram de novo com os usuários do banco restaurado
  EA.afterRestore = async function (msg) {
    EA.session = null; EA.user = null;
    EA.toast(msg + " Entre novamente.");
    history.replaceState(null, "", "#/dashboard");
    try { EA.authStatus = await EA.get("/api/auth/status"); } catch (e) { /* */ }
    if (EA.authStatus && !EA.authStatus.has_users) EA.showSetup(); else EA.showLogin();
  };

  EA.addWholeCatalog = async function () {
    try {
      const items = await EA.get("/api/catalog");
      const r = await EA.post("/api/catalog", { keys: items.filter((i) => !i.exists).map((i) => i.key) });
      EA.toast(r.created + " produtos da lista cadastrados com estoque zerado. Lance as quantidades em Entrada.");
      return r;
    } catch (e) { EA.toast(e.message, true); return null; }
  };

  EA.logout = async function () {
    try { await EA.post("/api/auth/logout"); } catch (e) { /* */ }
    EA.session = null; EA.user = null;
    EA.showLogin();
  };

  // Menu do usuário (canto superior direito): nome, perfil, trocar senha e sair
  function renderUserChip() {
    let c = document.getElementById("user-chip");
    if (!c) {
      c = document.createElement("div");
      c.id = "user-chip";
      document.getElementById("top").appendChild(c);
      document.addEventListener("click", (e) => { if (!e.target.closest("#user-chip")) c.classList.remove("open"); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") c.classList.remove("open"); });
    }
    c.innerHTML = `<button class="user-btn" aria-haspopup="true" aria-label="Menu do usuário ${esc(EA.user.name)}" data-menu>${EA.icons.user}<span>${esc(EA.user.name)}</span></button>
      <div class="user-pop" role="menu"><div class="who"><b>${esc(EA.user.name)}</b><small>${esc(EA.user.username)} · ${esc(EA.user.role_label)}</small></div>
        <button role="menuitem" data-pw>Trocar minha senha</button><button role="menuitem" data-out>Sair</button></div>`;
    c.querySelector("[data-menu]").onclick = () => c.classList.toggle("open");
    c.querySelector("[data-out]").onclick = EA.logout;
    c.querySelector("[data-pw]").onclick = () => { c.classList.remove("open"); EA.modal({
      title: "Trocar minha senha", size: "narrow", okLabel: "Trocar senha",
      body: `<form class="form"><label class="fld s12"><span>Senha atual</span><input type="password" name="old" autocomplete="current-password"></label>
        <label class="fld s6"><span>Nova senha</span><input type="password" name="new" autocomplete="new-password"></label><label class="fld s6"><span>Repita</span><input type="password" name="new2" autocomplete="new-password"></label></form>`,
      onOk: async (m) => {
        const d = EA.formData(m.querySelector("form"));
        if (d.new !== d.new2) throw new Error("As senhas novas não são iguais.");
        await EA.post("/api/auth/password", d);
        EA.toast("Senha alterada.");
      },
    }); };
  }

  let started = false;
  EA.enter = async function () {
    const a = document.getElementById("auth");
    try {
      await EA.reloadBoot();
    } catch (e) {
      document.getElementById("view").innerHTML = `<div class="alert bad">${esc(e.message)}</div>`;
    }
    if (a) a.remove();
    document.body.classList.toggle("role-consulta", EA.user.role === "consulta");
    document.body.classList.toggle("role-admin", EA.user.role === "admin");
    renderUserChip();
    if (!started) {
      started = true;
      EA.renderAlerts();
      setupScanner();
      document.getElementById("menu-toggle").addEventListener("click", () => document.getElementById("side").classList.toggle("open"));
      document.getElementById("btn-quit").addEventListener("click", async () => {
        if (!(await EA.confirm("Encerrar o sistema", "O sistema fará um backup (se houver alterações) e será encerrado. Para abrir de novo, use o atalho <b>Estoque Autônomo</b>.", "Encerrar"))) return;
        try { await EA.post("/api/shutdown"); } catch (e) { /* já encerrando */ }
        document.body.innerHTML = '<div style="padding:40px;font:16px Segoe UI,Arial">Estoque Autônomo encerrado com segurança. Pode fechar esta janela.</div>';
        setTimeout(() => window.close(), 800);
      });
      window.addEventListener("hashchange", route);
    }
    route();
    if (EA.onEnter) EA.onEnter();
  };

  // ------------------------------------------------------------ início
  EA.start = async function () {
    try {
      EA.authStatus = await EA.get("/api/auth/status");
    } catch (e) {
      document.getElementById("view").innerHTML = `<div class="alert bad">${esc(e.message)}</div>`;
      return;
    }
    if (!EA.authStatus.has_users) EA.showSetup();
    else if (EA.authStatus.user) { EA.user = EA.authStatus.user; EA.enter(); }
    else { EA.session = null; EA.showLogin(); }
  };
})();
