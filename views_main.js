/* Dashboard, produtos, categorias, locais. */
(function () {
  "use strict";
  const EA = window.EA, esc = EA.esc, V = EA.views;

  // ============================================================ DASHBOARD
  V.dashboard = async function (el) {
    const d = await EA.get("/api/dashboard");
    const target = Number(EA.boot.settings.target_days || 90);
    const ov = d.overall;
    const maxDays = Math.max(target * 2, ...d.groups.map((g) => g.min_days || 0).filter((x) => x < 3650));
    const bars = d.groups.filter((g) => g.products).map((g) => {
      const v = g.min_days;
      const pct = v === null ? 0 : Math.min(100, (v / maxDays) * 100);
      const cls = EA.daysClass(v, target);
      return `<div class="bar-row"><span>${esc(g.label)}</span>
        <div class="track" title="Meta: ${target} dias"><div class="fill ${cls}" style="width:${pct}%"></div><div class="mark" style="left:${(target / maxDays) * 100}%"></div></div>
        <span class="d">${v === null ? '<span class="muted">—</span>' : EA.days(v)}</span>
        ${g.limiting ? `<span class="lim">limitado por ${esc(g.limiting)}</span>` : `<span class="lim">${g.with_consumption ? "" : "consumo não cadastrado"}</span>`}</div>`;
    }).join("");
    const bu = d.expiry_buckets;
    el.innerHTML = `
      <div class="page-head"><div><h1>${esc(d.household || "Dashboard")}</h1>
        <div class="sub">${d.people} pessoa(s) atendida(s) · meta de autonomia ${target} dias</div></div>
        <div class="actions"><a class="btn ghost" href="#/movimentacoes">Registrar movimentação</a><a class="btn" href="#/produtos/novo">Cadastrar produto</a></div></div>
      ${d.review_due ? `<div class="alert warn"><span>Revisão periódica de validades e quantidades ${d.last_review ? "vencida (última em " + EA.date(d.last_review.ts) + ")" : "ainda não realizada"} — a recomendação é revisar a cada ${d.review_interval} dias.</span><div class="actions"><a class="btn sm" href="#/revisao">Fazer revisão</a></div></div>` : ""}
      ${d.total_products === 0 ? `<div class="alert good"><span><b>Comece por aqui:</b> adicione os produtos da lista de sugestões (água, alimentos, higiene, remédios…) e depois lance as quantidades que você tem.</span><div class="actions"><button class="btn sm" data-cat>Abrir lista de sugestões</button></div></div>` : ""}
      ${!d.last_backup ? `<div class="alert warn"><span>Nenhum backup registrado ainda.</span><div class="actions"><a class="btn sm" href="#/backup">Fazer backup</a></div></div>` : ""}
      <div class="autonomy-hero">
        <div class="big"><div class="small">Autonomia geral estimada</div>
          <div class="n">${ov.days === null ? "—" : ov.capped ? "&gt;10<small>anos</small>" : EA.num(Math.floor(ov.days), 0) + "<small>dias</small>"}</div>
          <p>${ov.limiting ? "Item limitante: <b>" + esc(ov.limiting) + "</b> (" + esc(ov.basis) + ")" : "Cadastre o consumo dos produtos para calcular a autonomia."}</p>
          <p>Autonomia efetiva: considera validade (FEFO) e perdas por vencimento.</p></div>
        <div class="bars">${bars || '<div class="muted">Nenhum produto cadastrado.</div>'}</div>
      </div>
      <div class="gauges">
        <a class="gauge" href="#/produtos"><div class="v">${d.total_products}</div><div class="l">produtos cadastrados</div></a>
        <div class="gauge"><div class="v">${EA.money(d.total_value)}</div><div class="l">valor do estoque</div></div>
        <a class="gauge ${d.below_min.length ? "amber" : "green"}" href="#/produtos/?status=baixo"><div class="v">${d.below_min.length}</div><div class="l">abaixo do mínimo</div></a>
        <a class="gauge ${(bu.vence_7 || 0) + (bu.vence_15 || 0) + (bu.vence_30 || 0) ? "amber" : "green"}" href="#/validade"><div class="v">${(bu.vence_7 || 0) + (bu.vence_15 || 0) + (bu.vence_30 || 0)}</div><div class="l">itens vencem em 30 dias</div></a>
        <a class="gauge ${d.expired.length ? "red" : "green"}" href="#/validade"><div class="v">${d.expired.length}</div><div class="l">itens vencidos</div></a>
        <a class="gauge ${d.to_buy_count ? "amber" : "green"}" href="#/compras"><div class="v">${d.to_buy_count}</div><div class="l">produtos a comprar</div></a>
      </div>
      <div class="grid g2">
        <section class="panel"><div class="panel-head"><h2>Quantidade armazenada</h2></div>
          ${d.qty_by_unit.length ? `<table class="t">${d.qty_by_unit.map((u) => `<tr><td>${esc(u.unit)}</td><td class="n">${EA.num(u.qty)}</td></tr>`).join("")}</table>` : '<div class="empty">Sem estoque.</div>'}</section>
        <section class="panel"><div class="panel-head"><h2>Vencidos e próximos do vencimento</h2><div class="actions"><a class="btn sm ghost" href="#/validade">Ver todos</a></div></div>
          ${listExpiry(d.expired.concat(d.expiring).slice(0, 10))}</section>
        <section class="panel"><div class="panel-head"><h2>Abaixo do estoque mínimo</h2></div>
          ${d.below_min.length ? `<table class="t">${d.below_min.slice(0, 10).map((p) => `<tr class="click" data-href="#/produto/${p.id}"><td>${esc(p.name)}</td><td class="n">${EA.qty(p.qty, p.unit)}</td><td class="n muted">mín. ${EA.num(p.min_qty)}</td></tr>`).join("")}</table>` : '<div class="empty">Nenhum produto abaixo do mínimo.</div>'}</section>
        <section class="panel"><div class="panel-head"><h2>Precisam ser adquiridos</h2><div class="actions"><a class="btn sm ghost" href="#/compras">Lista de compras</a></div></div>
          ${d.to_buy.length ? `<table class="t">${d.to_buy.slice(0, 10).map((p) => `<tr class="click" data-href="#/produto/${p.id}"><td>${esc(p.name)}</td><td class="n"><b>${EA.qty(p.buy, p.unit)}</b></td><td class="muted small">${esc(p.reasons.join(", "))}</td></tr>`).join("")}</table><p class="small muted">Custo estimado total: ${EA.money(d.to_buy_cost)}</p>` : '<div class="empty">Nada a comprar para a meta atual.</div>'}</section>
        <section class="panel"><div class="panel-head"><h2>Maior consumo</h2></div>
          ${d.top_consumption.length ? `<p class="small muted">Registrado nos últimos 30 dias</p><table class="t">${d.top_consumption.map((r) => `<tr class="click" data-href="#/produto/${r.id}"><td>${esc(r.name)}</td><td class="n">${EA.qty(r.q, r.unit)}</td></tr>`).join("")}</table>` : ""}
          ${d.planned_top.length ? `<p class="small muted">Consumo previsto por dia</p><table class="t">${d.planned_top.map((r) => `<tr class="click" data-href="#/produto/${r.product_id}"><td>${esc(r.name)}</td><td class="n">${EA.qty(r.daily_rate, r.unit)}/dia</td></tr>`).join("")}</table>` : '<div class="empty">Cadastre o consumo previsto dos produtos.</div>'}</section>
        <section class="panel"><div class="panel-head"><h2>Situação dos produtos</h2></div>
          <table class="t">${Object.entries(d.status_counts).map(([k, v]) => `<tr class="click" data-href="#/produtos/?status=${k}"><td>${EA.statusBadge(k)}</td><td class="n">${v}</td></tr>`).join("")}</table>
          <p class="small muted">Último backup: ${d.last_backup ? EA.date(d.last_backup.ts) + " (" + esc(d.last_backup.kind) + ")" : "nenhum"}</p></section>
      </div>`;
    bindRowLinks(el);
    const cb = el.querySelector("[data-cat]");
    if (cb) cb.onclick = () => EA.catalogModal(() => EA.go("#/produtos"));
  };
  function listExpiry(rows) {
    if (!rows.length) return '<div class="empty">Nenhum item vencido ou vencendo em 30 dias.</div>';
    return `<table class="t">${rows.map((r) => `<tr class="click" data-href="#/produto/${r.product_id}"><td>${esc(r.product_name)} <span class="muted small">${esc(r.code)}</span></td><td class="n">${EA.qty(r.qty, r.unit)}</td><td>${EA.expiryBadge(r.status, r.days)}</td></tr>`).join("")}</table>`;
  }
  function bindRowLinks(el) {
    el.querySelectorAll("[data-href]").forEach((tr) => tr.addEventListener("click", (e) => {
      if (e.target.closest("button, a, input")) return;
      EA.go(tr.dataset.href);
    }));
  }
  EA.bindRowLinks = bindRowLinks;

  // ============================================================ PRODUTOS (lista)
  V.produtos = async function (el, arg) {
    if (arg === "novo") { await V.produtos(el); EA.productForm(null); return; }
    let initQ = "", initStatus = "";
    if (arg) {
      if (arg.startsWith("?")) initStatus = new URLSearchParams(arg).get("status") || "";
      else initQ = arg;
    }
    el.innerHTML = `
      <div class="page-head"><div><h1>Produtos</h1><div class="sub">Clique em um produto para ver a ficha completa, lotes, recipientes e histórico.</div></div>
        <div class="actions"><button class="btn ghost" data-cat>Lista de sugestões</button><button class="btn ghost" data-imp>Importar planilha (CSV)</button><a class="btn" href="#/produtos/novo">Cadastrar produto</a></div></div>
      <div class="filters">
        <label class="f">Buscar<input data-f="q" value="${esc(initQ)}" placeholder="nome, código, marca, código de barras" style="min-width:260px"></label>
        <label class="f">Categoria<select data-f="category_id">${EA.catOptions("", { withSubs: true })}</select></label>
        <label class="f">Local<select data-f="location_id">${EA.locOptions("", "— todos —")}</select></label>
        <label class="f">Situação<select data-f="status"><option value="">— todas —</option>
          <option value="adequado">Adequado</option><option value="baixo">Estoque baixo / zerado</option><option value="vencendo">Vencendo</option><option value="vencido">Com itens vencidos</option></select></label>
        <label class="f" style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" data-f="include_inactive"> mostrar inativos</label>
      </div>
      <div class="table-wrap tall" data-list><div class="empty">Carregando…</div></div>`;
    if (initStatus) el.querySelector('[data-f="status"]').value = initStatus;
    const load = async () => {
      const f = {};
      el.querySelectorAll("[data-f]").forEach((i) => { f[i.dataset.f] = i.type === "checkbox" ? (i.checked ? "1" : "") : i.value; });
      const rows = await EA.get("/api/products" + EA.qs(f));
      const box = el.querySelector("[data-list]");
      if (!rows.length) {
        box.innerHTML = Object.values(f).some((v) => v) ? '<div class="empty">Nenhum produto encontrado com esses filtros.</div>'
          : `<div class="panel" style="margin:12px;border-left:5px solid var(--signal)"><h2>Nenhum produto cadastrado ainda</h2>
            <p>O jeito mais rápido de começar é adicionar a <b>lista de produtos comuns</b>: água, arroz, feijão, flocão (cuscuz), farinha, macarrão, óleo, charque, sardinha, leite em pó, café, remédios básicos, higiene, limpeza, gás, pilhas e outros, cerca de 60 itens.
            Eles entram com <b>estoque zerado</b>; depois você lança as quantidades em <b>Entrada</b> na ficha de cada um. O que não usar, é só desativar.</p>
            <p style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-catall>Adicionar a lista completa</button><button class="btn ghost" data-cat2>Escolher quais adicionar</button><a class="btn ghost" href="#/produtos/novo">Cadastrar um produto</a></p></div>`;
        const b2 = box.querySelector("[data-cat2]");
        if (b2) b2.onclick = () => EA.catalogModal(load);
        const b3 = box.querySelector("[data-catall]");
        if (b3) b3.onclick = async () => { b3.disabled = true; await EA.addWholeCatalog(); await EA.reloadBoot(); load(); };
        return;
      }
      box.innerHTML = `<table class="t"><thead><tr><th>Produto</th><th>Categoria</th><th class="n">Quantidade</th><th class="n">Mínimo</th><th>Situação</th><th>Próx. validade</th><th class="n">Autonomia</th><th>Local</th></tr></thead><tbody>
        ${rows.map((p) => `<tr class="click st-${p.status}" data-href="#/produto/${p.id}">
          <td><b>${esc(p.name)}</b>${p.active ? "" : ' <span class="badge b-grey">inativo</span>'}<div class="small muted">${esc(p.code)}${p.brand ? " · " + esc(p.brand) : ""}</div></td>
          <td>${esc(p.category_name || "")}<div class="small muted">${esc(p.subcategory_name || "")}</div></td>
          <td class="n">${EA.qty(p.qty, p.unit)}</td><td class="n">${EA.num(p.min_qty)}</td>
          <td>${EA.statusBadge(p.status)} ${EA.flagBadges(p.flags.filter((f) => f !== p.status && !(p.status === "baixo" && (f === "baixo" || f === "zerado"))))}</td>
          <td>${p.next_expiry ? EA.date(p.next_expiry) : '<span class="muted">—</span>'}</td>
          <td class="n">${p.daily_rate > 0 ? EA.days(p.autonomy_days, p.autonomy_capped) : '<span class="muted">—</span>'}</td>
          <td class="small">${esc(p.locations.join("; "))}</td></tr>`).join("")}</tbody></table>`;
      bindRowLinks(box);
    };
    let tmr;
    el.querySelectorAll("[data-f]").forEach((i) => i.addEventListener(i.tagName === "INPUT" && i.type !== "checkbox" ? "input" : "change", () => { clearTimeout(tmr); tmr = setTimeout(load, 200); }));
    el.querySelector("[data-imp]").addEventListener("click", importCsv);
    el.querySelector("[data-cat]").addEventListener("click", () => EA.catalogModal(load));
    await load();
  };

  // ------------------------------------------------------------ calculadora de porções
  // Ex.: "um pacote de 400 g de cuscuz dá para 4 pessoas, servido 1 vez por dia"
  const MASS = { g: 0.001, kg: 1 }, VOL = { mL: 0.001, L: 1 };
  function pkgUnits(u) {
    if (u in MASS) return Object.keys(MASS);
    if (u in VOL) return Object.keys(VOL);
    return [u];
  }
  function toProductUnit(q, from, to) {
    if (from === to) return q;
    if (from in MASS && to in MASS) return (q * MASS[from]) / MASS[to];
    if (from in VOL && to in VOL) return (q * VOL[from]) / VOL[to];
    return q;
  }
  EA.portionCalc = async function (o) {
    o = o || {};
    let products = null;
    if (!o.product && !o.unit) products = (await EA.get("/api/products")).filter((p) => p.active);
    const people = Number(EA.boot.settings.people) || 1;
    const unitOf = (p) => (p ? p.unit : o.unit) || "kg";
    const defUnit = (u) => (u === "kg" ? "g" : u === "L" ? "mL" : u);
    EA.modal({
      title: "Calculadora de comida por pessoa" + (o.product ? " — " + o.product.name : o.name ? " — " + o.name : ""), okLabel: o.onApply ? "Usar no cadastro" : "Salvar no produto",
      body: `<p class="small muted">Informe quanto rende uma embalagem na sua casa. A calculadora transforma isso em consumo por pessoa e projeta para ${people} pessoas.</p>
        <form class="form" data-pc>
          ${products ? `<label class="fld s12"><span>Produto</span><select name="pid">${products.map((p) => `<option value="${p.id}">${esc(p.name)} (${esc(p.unit)})</option>`).join("")}</select></label>` : ""}
          <label class="fld s3"><span>Uma embalagem de</span><input name="pkg" inputmode="decimal" value="${unitOf(o.product) === "kg" || unitOf(o.product) === "L" ? "400" : "1"}"></label>
          <label class="fld s3"><span>Unidade</span><select name="pkgu"></select></label>
          <label class="fld s3"><span>Dá para quantas pessoas</span><input name="serves" inputmode="numeric" value="4"></label>
          <label class="fld s3"><span>Servido quantas vezes</span><input name="times" inputmode="decimal" value="1"></label>
          <label class="fld s3"><span>Por</span><select name="per"><option value="dia">dia</option><option value="semana">semana</option></select></label>
          <label class="fld s3"><span>Pessoas na casa</span><input name="people" inputmode="numeric" value="${people}"></label>
        </form>
        <div class="panel" data-out style="margin-top:12px;background:#f7f9f9"></div>`,
      onOpen: (m) => {
        const f = m.querySelector("[data-pc]");
        const cur = () => (products ? products.find((p) => p.id == f.pid.value) : o.product);
        const fillUnits = () => {
          const u = unitOf(cur());
          f.pkgu.innerHTML = pkgUnits(u).map((x) => `<option ${x === defUnit(u) ? "selected" : ""}>${esc(x)}</option>`).join("");
        };
        const calc = () => {
          const u = unitOf(cur());
          const pkg = toProductUnit(EA.parseNum(f.pkg.value), f.pkgu.value, u);
          const serves = Math.max(1, EA.parseNum(f.serves.value));
          const times = EA.parseNum(f.times.value) / (f.per.value === "semana" ? 7 : 1);
          const ppl = Math.max(1, EA.parseNum(f.people.value));
          const perMeal = pkg / serves, perDay = perMeal * times, house = perDay * ppl;
          m._res = { perPersonDay: perDay };
          const n = (h) => (pkg > 0 ? Math.ceil((house * h) / pkg) : 0);
          m.querySelector("[data-out]").innerHTML = pkg > 0 && times > 0 ? `
            <dl class="kv"><dt>Por pessoa, por refeição</dt><dd><b>${EA.qty(perMeal, u)}</b></dd>
            <dt>Por pessoa, por dia</dt><dd><b>${EA.qty(perDay, u)}</b></dd>
            <dt>Para ${ppl} pessoas</dt><dd><b>${EA.qty(house, u)}</b> por dia · ${EA.qty(house * 7, u)} por semana · ${EA.qty(house * 30.4375, u)} por mês</dd>
            <dt>Embalagens necessárias</dt><dd>${[30, 90, 180].map((h) => `${h} dias: <b>${n(h)}</b>`).join(" · ")} <span class="muted">(de ${EA.num(EA.parseNum(f.pkg.value))} ${esc(f.pkgu.value)})</span></dd></dl>`
            : '<span class="muted">Preencha o tamanho da embalagem e quantas vezes é servido.</span>';
        };
        if (f.pid) f.pid.addEventListener("change", () => { fillUnits(); calc(); });
        fillUnits();
        f.addEventListener("input", calc); f.addEventListener("change", calc);
        calc();
      },
      onOk: async (m) => {
        if (!m._res || !(m._res.perPersonDay > 0)) throw new Error("Preencha os dados da embalagem.");
        if (o.onApply) { o.onApply(m._res); return; }
        const f = m.querySelector("[data-pc]");
        const pid = o.product ? o.product.id : f.pid.value;
        const full = (await EA.get("/api/products/" + pid)).product;
        await EA.put("/api/products/" + pid, Object.assign({}, full, { cons_mode: "por_pessoa", cons_period: "dia", cons_qty: m._res.perPersonDay, cons_people: null }));
        EA.toast("Consumo salvo: " + EA.num(m._res.perPersonDay, 4) + " " + full.unit + " por pessoa por dia.");
        o.onSaved && o.onSaved();
      },
    });
  };

  // Lista de produtos sugeridos: cria os produtos com estoque zerado
  EA.catalogModal = async function (done) {
    const items = await EA.get("/api/catalog");
    const groups = {};
    items.forEach((i) => (groups[i.category] = groups[i.category] || []).push(i));
    EA.modal({
      title: "Lista de produtos sugeridos", size: "wide", okLabel: "Adicionar selecionados",
      body: `<p>Marque o que você guarda em casa. Os produtos entram <b>com estoque zerado</b>; depois, em cada um, use <b>Entrada</b> para lançar a quantidade, a validade e o local.
        O consumo sugerido é uma média por adulto: ajuste na ficha do produto conforme a realidade da casa.</p>
        <div style="display:flex;gap:8px;margin:8px 0 12px"><button type="button" class="btn sm ghost" data-all>Marcar todos</button><button type="button" class="btn sm ghost" data-none>Desmarcar todos</button><span class="small muted" data-n style="align-self:center"></span></div>
        <div style="columns:2 360px;column-gap:22px">${Object.entries(groups).map(([g, list]) => `<div style="break-inside:avoid;margin-bottom:14px">
          <h3 style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-g="${esc(g)}"> ${esc(g)}</h3>
          ${list.map((i) => `<label style="display:flex;gap:8px;padding:4px 0;align-items:flex-start;${i.exists ? "opacity:.55" : ""}"><input type="checkbox" value="${esc(i.key)}" data-grp="${esc(g)}" ${i.exists ? "disabled" : "checked"} style="margin-top:3px">
            <span>${esc(i.name)} <span class="small muted">(${esc(i.unit)})</span>${i.critical ? ' <span class="badge b-blue">crítico</span>' : ""}<br><span class="small muted">${i.exists ? "já cadastrado" : esc(i.consumo)}</span></span></label>`).join("")}</div>`).join("")}</div>`,
      onOpen: (m) => {
        const boxes = () => Array.from(m.querySelectorAll("input[value]:not([disabled])"));
        const count = () => (m.querySelector("[data-n]").textContent = boxes().filter((b) => b.checked).length + " selecionado(s)");
        m.addEventListener("change", (e) => {
          if (e.target.dataset.g !== undefined) boxes().filter((b) => b.dataset.grp === e.target.dataset.g).forEach((b) => (b.checked = e.target.checked));
          count();
        });
        m.querySelectorAll("[data-g]").forEach((g) => (g.checked = true));
        m.querySelector("[data-all]").onclick = () => { boxes().forEach((b) => (b.checked = true)); count(); };
        m.querySelector("[data-none]").onclick = () => { boxes().forEach((b) => (b.checked = false)); count(); };
        count();
      },
      onOk: async (m) => {
        const keys = Array.from(m.querySelectorAll("input[value]:checked:not([disabled])")).map((b) => b.value);
        if (!keys.length) throw new Error("Marque ao menos um produto.");
        const r = await EA.post("/api/catalog", { keys });
        await EA.reloadBoot();
        EA.toast(r.created + " produto(s) adicionado(s) com estoque zerado.");
        done && done();
      },
    });
  };

  function importCsv() {
    EA.modal({
      title: "Importar produtos de planilha (CSV)", okLabel: "Importar",
      body: `<p>Baixe o <a href="${EA.url("/exportar/modelo-produtos.csv")}">modelo de planilha</a>, preencha no Excel e salve como <b>CSV (separado por ponto e vírgula)</b>. Cada linha cria um produto; se houver quantidade, cria também o primeiro lote.</p>
        <form class="form"><label class="fld s8"><span>Arquivo CSV</span><input type="file" accept=".csv,text/csv" name="_file"></label>${EA.respField()}</form>`,
      onOk: async (m) => {
        const f = m.querySelector("[name=_file]").files[0];
        if (!f) throw new Error("Selecione o arquivo.");
        const buf = await f.arrayBuffer();
        let text = new TextDecoder("utf-8").decode(buf);
        if (text.includes("\uFFFD")) text = new TextDecoder("windows-1252").decode(buf);
        const resp = m.querySelector("[name=responsible]").value;
        EA.rememberResponsible(resp);
        const r = await EA.post("/api/import-products-csv", { text, responsible: resp });
        await EA.reloadBoot();
        EA.toast(r.created + " produto(s) importado(s).");
        if (r.errors.length) {
          EA.modal({ title: "Linhas não importadas", footer: '<button class="btn" data-x>Fechar</button>', body: "<ul>" + r.errors.map((e) => "<li>" + esc(e) + "</li>").join("") + "</ul>" });
        }
        EA.refresh();
      },
    });
  }

  // ============================================================ PRODUTO (ficha)
  V.produto = async function (el, id) {
    const d = await EA.get("/api/products/" + id);
    const p = d.product, s = d.summary, a = d.autonomy;
    const rule = parseRule(p.cons_rule);
    const consTxt = p.cons_mode === "nenhum" ? "não cadastrado"
      : `${EA.num(p.cons_qty)} ${esc(p.unit)} ${p.cons_mode === "por_pessoa" ? "por pessoa " : ""}por ${{ dia: "dia", semana: "semana", mes: "mês", intervalo: "intervalo de " + (rule.interval_days || "?") + " dias" }[p.cons_period]}${p.cons_mode === "por_pessoa" ? " · " + (p.cons_people || EA.boot.settings.people) + " pessoa(s)" : ""}`;
    el.innerHTML = `
      <div class="page-head"><div><div class="small muted"><a href="#/produtos">Produtos</a> › ${esc(EA.catName(p.category_id))}</div><h1>${esc(p.name)}</h1></div>
        <div class="actions">
          <button class="btn" data-a="entrada">Entrada (novo lote)</button>
          <button class="btn ghost" data-a="consumir">Consumir (FEFO)</button>
          <button class="btn ghost" data-a="mov">Outra movimentação</button>
          <a class="btn ghost" href="#/etiquetas/P:${p.id}">Etiqueta</a>
          <button class="btn ghost" data-a="calc">Calcular consumo</button>
          <button class="btn ghost" data-a="editar">Editar</button>
        </div></div>
      <section class="panel"><div class="prod-head">
        <div class="photo" ${p.photo ? `style="background-image:url('${EA.url("/foto/" + encodeURIComponent(p.photo))}')"` : ""}>${p.photo ? "" : "sem foto"}</div>
        <div>
          <div>${EA.statusBadge(s.status)} ${EA.flagBadges(s.flags.filter((f) => f !== s.status))} ${p.critical ? '<span class="badge b-blue">item crítico</span>' : ""} ${p.active ? "" : '<span class="badge b-grey">inativo</span>'}</div>
          <div class="stat-line">
            <div><b>${EA.qty(s.qty, p.unit)}</b>quantidade atual</div>
            <div><b>${EA.qty(s.usable_qty, p.unit)}</b>utilizável (não vencida)</div>
            <div><b>${a ? EA.days(a.autonomy_days, a.autonomy_capped) : "—"}</b>autonomia efetiva</div>
            <div><b>${a && a.depletion_date ? EA.date(a.depletion_date) : "—"}</b>esgotamento estimado</div>
            <div><b>${EA.money(s.value)}</b>valor em estoque</div>
          </div>
          <dl class="kv" style="margin-top:12px">
            <dt>Código</dt><dd class="mono">${esc(p.code)}${p.barcode ? " · EAN " + esc(p.barcode) : ""}</dd>
            <dt>Categoria</dt><dd>${esc(EA.catName(p.category_id))}${p.subcategory_id ? " › " + esc(EA.catName(p.subcategory_id)) : ""}</dd>
            <dt>Marca / fabricante</dt><dd>${esc(p.brand || "—")} / ${esc(p.manufacturer || "—")}</dd>
            <dt>Estoque mín. / segurança / máx.</dt><dd>${EA.num(p.min_qty)} / ${EA.num(p.safety_qty)} / ${p.max_qty === null ? "—" : EA.num(p.max_qty)} ${esc(p.unit)}</dd>
            <dt>Consumo previsto</dt><dd>${consTxt}${ruleSummary(rule)}</dd>
            <dt>Local padrão</dt><dd>${esc(d.default_location_path || "—")}</dd>
            ${p.shelf_life_open_days ? `<dt>Validade após aberto</dt><dd>${p.shelf_life_open_days} dias</dd>` : ""}
            ${p.description ? `<dt>Descrição</dt><dd>${esc(p.description)}</dd>` : ""}
            ${p.notes ? `<dt>Observações</dt><dd>${esc(p.notes)}</dd>` : ""}
          </dl>
        </div>
        <div class="codebox"><img src="${EA.url("/codigo/qr.svg", { c: p.code })}" alt="QR Code ${esc(p.code)}"><div class="small"><b class="mono">EA-${esc(p.code)}</b><br>QR Code do produto</div></div>
      </div></section>
      <div class="tabs" role="tablist">
        <button class="on" data-tab="fefo">Onde está e ordem de uso (FEFO)</button><button data-tab="lotes">Lotes e recipientes (${d.lots.length})</button>
        <button data-tab="auto">Consumo e autonomia</button><button data-tab="hist">Histórico (${d.movements.length})</button><button data-tab="aud">Auditoria</button>
      </div>
      <div data-pane="fefo">${fefoTable(d.fefo, p)}</div>
      <div data-pane="lotes" hidden>${lotsTable(d.lots, p)}</div>
      <div data-pane="auto" hidden>${autonomyPane(a, p)}</div>
      <div data-pane="hist" hidden>${EA.movTable(d.movements, { hideProduct: true })}</div>
      <div data-pane="aud" hidden>${auditTable(d.audit)}</div>`;
    el.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      el.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("on", x === b));
      el.querySelectorAll("[data-pane]").forEach((x) => (x.hidden = x.dataset.pane !== b.dataset.tab));
    }));
    const reload = () => V.produto(el, id);
    el.querySelector('[data-a="entrada"]').onclick = () => EA.entryForm(p, reload);
    el.querySelector('[data-a="consumir"]').onclick = () => EA.consumeForm(p, reload);
    el.querySelector('[data-a="mov"]').onclick = () => EA.movementForm({ product: p, lots: d.lots }, reload);
    el.querySelector('[data-a="editar"]').onclick = () => EA.productForm(p);
    el.querySelector('[data-a="calc"]').onclick = () => EA.portionCalc({ product: p, onSaved: reload });
    EA.bindLotActions(el, p, d.lots, reload);
    EA.bindMovActions(el, reload);
    bindRowLinks(el);
  };

  function fefoTable(items, p) {
    if (!items.length) return '<div class="panel empty">Sem estoque deste produto. Use “Entrada (novo lote)”.</div>';
    let rank = 0;
    return `<div class="table-wrap"><table class="t"><thead><tr><th>Ordem</th><th>Item</th><th>Lote</th><th class="n">Quantidade</th><th>Validade</th><th>Aberto em</th><th>Local exato</th></tr></thead><tbody>
      ${items.map((i) => { const exp = i.status === "vencido"; if (!exp) rank++; return `<tr class="click" data-href="#/${i.kind === "lote" ? "lote" : "recipiente"}/${i.id}">
        <td>${exp ? '<span class="badge b-red">descartar</span>' : `<b>${rank}º</b>`}</td><td class="mono">${esc(i.code)}${i.label && i.label !== i.code ? " · " + esc(i.label) : ""}<div class="small muted">${i.kind}</div></td>
        <td>${esc(i.lot_number || i.lot_code)}</td><td class="n">${EA.qty(i.qty, p.unit)}</td><td>${EA.date(i.expires_at)} ${EA.expiryBadge(i.status, i.days)}</td>
        <td>${EA.date(i.opened_at)}</td><td>${esc(i.location_path || "—")}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="small muted">FEFO: use primeiro o que vence primeiro; entre itens de mesma validade, os recipientes já abertos.</p>`;
  }

  function lotsTable(lots, p) {
    if (!lots.length) return '<div class="panel empty">Nenhum lote.</div>';
    return `<div class="table-wrap"><table class="t"><thead><tr><th>Lote</th><th>Fornecedor</th><th class="n">Adquirido</th><th class="n">Saldo</th><th>Validade</th><th>Entrada</th><th>Local</th><th></th></tr></thead><tbody>
      ${lots.map((l) => `<tr class="click" data-href="#/lote/${l.id}"><td><b class="mono">${esc(l.code)}</b><div class="small muted">nº ${esc(l.lot_number || "—")}</div></td>
        <td>${esc(l.supplier || "—")}</td><td class="n">${EA.qty(l.qty_acquired, p.unit)}<div class="small muted">${EA.money(l.unit_price)}/${esc(p.unit)}</div></td>
        <td class="n"><b>${EA.qty(l.qty, p.unit)}</b>${l.containers.length ? `<div class="small muted">livre: ${EA.num(l.free_qty)}</div>` : ""}</td>
        <td>${EA.date(l.expires_at)} ${l.qty > 0 ? EA.expiryBadge(l.status, l.days) : ""}</td><td>${EA.date(l.entry_at)}</td><td>${esc(l.location_path || "—")}</td>
        <td class="nowrap"><button class="btn sm ghost" data-split="${l.id}" ${l.free_qty > 0 ? "" : "disabled"}>Dividir em recipientes</button></td></tr>
        ${l.containers.map((c) => `<tr class="sub click" data-href="#/recipiente/${c.id}"><td class="mono">↳ ${esc(c.code)} ${c.label && c.label !== c.code ? "· " + esc(c.label) : ""}</td><td>${c.opened_at ? "aberto em " + EA.date(c.opened_at) : "fechado"}</td>
          <td class="n">${EA.qty(c.initial_qty, p.unit)}</td><td class="n">${EA.qty(c.qty, p.unit)}</td><td>${EA.date(c.effective_expiry)} ${c.qty > 0 ? EA.expiryBadge(c.status, c.days) : '<span class="badge b-grey">vazio</span>'}</td><td>${EA.date(c.stored_at)}</td><td>${esc(c.location_path || "—")}</td><td></td></tr>`).join("")}`).join("")}
      </tbody></table></div>`;
  }

  function autonomyPane(a, p) {
    if (!a) return '<div class="panel empty">Produto inativo.</div>';
    const hs = Object.keys(a.need).map(Number).sort((x, y) => x - y);
    return `<div class="grid g2"><section class="panel"><h3>Consumo</h3><dl class="kv">
        <dt>Planejado</dt><dd>${EA.num(a.planned_rate)} ${esc(p.unit)}/dia</dd>
        <dt>Observado (histórico)</dt><dd>${EA.num(a.observed_rate)} ${esc(p.unit)}/dia</dd>
        <dt>Usado na previsão (hoje)</dt><dd><b>${EA.num(a.daily_rate)} ${esc(p.unit)}/dia</b> · ${EA.num(a.weekly_rate)}/semana · ${EA.num(a.monthly_rate)}/mês</dd>
        <dt>Reserva intocável</dt><dd>${EA.num(a.reserve)} ${esc(p.unit)}</dd></dl></section>
      <section class="panel"><h3>Autonomia</h3><dl class="kv">
        <dt>Disponível (não vencido)</dt><dd>${EA.qty(a.available, p.unit)}</dd>
        <dt>Autonomia efetiva</dt><dd><b>${EA.days(a.autonomy_days, a.autonomy_capped)}</b>${a.autonomy_days ? " · " + EA.num(a.autonomy_weeks, 1) + " semanas · " + EA.num(a.autonomy_months, 1) + " meses" : ""}</dd>
        <dt>Divisão simples</dt><dd>${a.simple_days === null ? "—" : EA.num(a.simple_days, 1) + " dias"} <span class="small muted">(quantidade ÷ consumo, sem validade)</span></dd>
        <dt>Perda prevista por vencimento</dt><dd>${a.lost_by_expiry > 0 ? `<span class="badge b-red">${EA.qty(a.lost_by_expiry, p.unit)}</span>` : "nenhuma"}</dd>
        <dt>Data estimada de esgotamento</dt><dd>${EA.date(a.depletion_date)}</dd></dl></section></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Período</th><th class="n">Necessário</th><th class="n">Coberto pelo estoque</th><th class="n">Excedente / falta</th></tr></thead><tbody>
        ${hs.map((h) => { const b = a.balance[h]; return `<tr><td>${h} dias${h === a.target_days ? ' <span class="badge b-blue">meta</span>' : ""}</td><td class="n">${EA.qty(a.need[h], p.unit)}</td><td class="n">${EA.qty(a.covered[h], p.unit)}</td>
          <td class="n">${b >= 0 ? `<span class="badge b-green">+${EA.num(b)}</span>` : `<span class="badge b-red">${EA.num(b)}</span>`}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="small muted">Sugestão de compra para ${a.target_days} dias: <b>${EA.qty(a.suggest_buy, p.unit)}</b> ${a.suggest_reasons.length ? "(" + esc(a.suggest_reasons.join(", ")) + ")" : ""}</p>`;
  }

  function auditTable(rows) {
    if (!rows.length) return '<div class="panel empty">Sem registros.</div>';
    return `<div class="table-wrap"><table class="t"><thead><tr><th>Data</th><th>Ação</th><th>Responsável</th><th>Antes</th><th>Depois</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="nowrap">${EA.date(r.ts)}</td><td>${esc(r.action)}</td><td>${esc(r.responsible || "")}</td><td class="small mono">${esc(r.before_json || "")}</td><td class="small mono">${esc(r.after_json || "")}</td></tr>`).join("")}</tbody></table></div>`;
  }
  EA.auditTable = auditTable;

  function parseRule(r) { try { return r ? JSON.parse(r) : {}; } catch (e) { return {}; } }
  function ruleSummary(r) {
    const parts = [];
    if (r.adjust && Number(r.adjust) !== 1) parts.push("ajuste ×" + EA.num(r.adjust, 2));
    if (r.phases && r.phases.length) parts.push(r.phases.length + " fase(s)");
    if (r.monthly) parts.push("sazonalidade mensal");
    if (r.reserve) parts.push("reserva " + EA.num(r.reserve));
    return parts.length ? ` <span class="badge b-blue">não linear: ${esc(parts.join(", "))}</span>` : "";
  }

  // ============================================================ PRODUTO (formulário)
  EA.productForm = function (p) {
    const isNew = !p;
    p = p || { unit: "un", cons_mode: "nenhum", cons_period: "dia", min_qty: 0, safety_qty: 0, critical: 0, active: 1 };
    const rule = parseRule(p.cons_rule);
    const monthly = rule.monthly || null;
    let saved = false;
    const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const m = EA.modal({
      title: isNew ? "Cadastrar produto" : "Editar produto — " + p.name, size: "wide", okLabel: isNew ? "Cadastrar" : "Salvar alterações",
      body: `<form class="form" autocomplete="off">
        <label class="fld s6"><span class="req">Nome</span><input name="name" value="${esc(p.name || "")}" required autofocus></label>
        <label class="fld s3"><span>Categoria</span><select name="category_id">${EA.catOptions(p.category_id, { blankLabel: "— selecione —" })}</select></label>
        <label class="fld s3"><span>Subcategoria</span><select name="subcategory_id">${EA.subOptions(p.category_id, p.subcategory_id)}</select></label>
        <label class="fld s3"><span>Marca</span><input name="brand" value="${esc(p.brand || "")}"></label>
        <label class="fld s3"><span>Fabricante</span><input name="manufacturer" value="${esc(p.manufacturer || "")}"></label>
        <label class="fld s3"><span class="req">Unidade de medida</span><select name="unit">${EA.unitOptions(p.unit)}</select></label>
        <label class="fld s3"><span>Código de barras de fábrica (EAN)</span><input name="barcode" value="${esc(p.barcode || "")}" placeholder="leia com o leitor USB"></label>
        <label class="fld s12"><span>Descrição</span><input name="description" value="${esc(p.description || "")}"></label>
        <label class="fld s3"><span>Estoque mínimo</span><input name="min_qty" inputmode="decimal" value="${EA.num(p.min_qty, 6)}"></label>
        <label class="fld s3"><span>Estoque de segurança</span><input name="safety_qty" inputmode="decimal" value="${EA.num(p.safety_qty, 6)}"></label>
        <label class="fld s3"><span>Estoque máximo</span><input name="max_qty" inputmode="decimal" value="${p.max_qty === null || p.max_qty === undefined ? "" : EA.num(p.max_qty, 6)}"></label>
        <label class="fld s3"><span>Autonomia desejada (dias)</span><input name="desired_days" inputmode="numeric" value="${p.desired_days || ""}" placeholder="padrão: ${esc(EA.boot.settings.target_days)}"></label>
        <label class="fld s6"><span>Local de armazenamento padrão</span><select name="default_location_id">${EA.locOptions(p.default_location_id)}</select></label>
        <label class="fld s3"><span>Validade após aberto (dias)</span><input name="shelf_life_open_days" inputmode="numeric" value="${p.shelf_life_open_days || ""}"></label>
        <label class="fld s3 chk"><input type="checkbox" name="critical" ${p.critical ? "checked" : ""}><span>Item crítico (entra na autonomia geral)</span></label>
        <fieldset><legend>Consumo planejado</legend><div class="form">
          <label class="fld s3"><span>Forma de consumo</span><select name="cons_mode">
            <option value="nenhum" ${p.cons_mode === "nenhum" ? "selected" : ""}>Não consumido regularmente</option>
            <option value="por_pessoa" ${p.cons_mode === "por_pessoa" ? "selected" : ""}>Por pessoa</option>
            <option value="total" ${p.cons_mode === "total" ? "selected" : ""}>Total do grupo familiar</option></select></label>
          <label class="fld s2"><span>Quantidade</span><input name="cons_qty" inputmode="decimal" value="${EA.num(p.cons_qty || 0, 6)}"></label>
          <label class="fld s2"><span>Por</span><select name="cons_period">
            <option value="dia" ${p.cons_period === "dia" ? "selected" : ""}>dia</option><option value="semana" ${p.cons_period === "semana" ? "selected" : ""}>semana</option>
            <option value="mes" ${p.cons_period === "mes" ? "selected" : ""}>mês</option><option value="intervalo" ${p.cons_period === "intervalo" ? "selected" : ""}>a cada N dias</option></select></label>
          <label class="fld s2" data-interval><span>N dias</span><input name="r_interval" inputmode="numeric" value="${rule.interval_days || ""}"></label>
          <label class="fld s3"><span>Pessoas atendidas</span><input name="cons_people" inputmode="numeric" value="${p.cons_people || ""}" placeholder="padrão: ${esc(EA.boot.settings.people)}"></label>
          <p class="help" data-cons-preview></p>
          <div class="fld s12" style="flex-direction:row"><button type="button" class="btn sm ghost" data-portion>Calculadora de porções (ex.: pacote de 400 g dá para 4 pessoas)</button></div>
          <details class="fld s12"><summary><b>Regras não lineares</b> (opcional): ajuste, reserva, fases e sazonalidade</summary>
            <div class="form" style="margin-top:8px">
              <label class="fld s3"><span>Fator de ajuste (×)</span><input name="r_adjust" inputmode="decimal" value="${rule.adjust ? EA.num(rule.adjust, 4) : ""}" placeholder="1"></label>
              <label class="fld s3"><span>Reserva intocável (${esc(p.unit || "un")})</span><input name="r_reserve" inputmode="decimal" value="${rule.reserve ? EA.num(rule.reserve, 6) : ""}"></label>
              <p class="help">Fases: altere o consumo em períodos a partir de hoje. Ex.: dias 0–30 fator 1,5 (adaptação); a partir do dia 30, fator 0,8.</p>
              <div class="fld s12" data-phases></div>
              <div class="fld s12"><button type="button" class="btn sm ghost" data-addphase>Adicionar fase</button></div>
              <label class="fld s12 chk"><input type="checkbox" name="r_monthly_on" ${monthly ? "checked" : ""}><span>Usar sazonalidade mensal (fator por mês; ex.: mais água no verão)</span></label>
              <div class="fld s12" data-monthly ${monthly ? "" : "hidden"} style="display:grid;grid-template-columns:repeat(12,1fr);gap:4px">
                ${MONTHS.map((mm, i) => `<label class="small" style="display:flex;flex-direction:column">${mm}<input name="r_m${i}" inputmode="decimal" value="${monthly ? EA.num(monthly[i], 3) : "1"}"></label>`).join("")}</div>
            </div></details>
        </div></fieldset>
        ${isNew ? `<fieldset><legend>Entrada inicial (primeiro lote) — opcional</legend><div class="form">
          <label class="fld s2"><span>Quantidade adquirida</span><input name="l_qty" inputmode="decimal"></label>
          <label class="fld s2"><span>Preço unitário (R$)</span><input name="l_unit_price" inputmode="decimal"></label>
          <label class="fld s2"><span>Valor total (R$)</span><input name="l_total_price" inputmode="decimal"></label>
          <label class="fld s3"><span>Número do lote</span><input name="l_lot_number"></label>
          <label class="fld s3"><span>Fornecedor</span><input name="l_supplier"></label>
          <label class="fld s3"><span>Data de aquisição</span><input type="date" name="l_acquired_at" value="${EA.todayISO()}"></label>
          <label class="fld s3"><span>Entrada no estoque</span><input type="date" name="l_entry_at" value="${EA.todayISO()}"></label>
          <label class="fld s3"><span>Data de armazenamento</span><input type="date" name="l_stored_at" value="${EA.todayISO()}"></label>
          <label class="fld s3"><span>Data de fabricação</span><input type="date" name="l_manufactured_at"></label>
          <label class="fld s3"><span>Data de validade</span><input type="date" name="l_expires_at"></label>
          <label class="fld s3"><span>Local (se diferente do padrão)</span><select name="l_location_id">${EA.locOptions("", "— local padrão —")}</select></label>
          <label class="fld s3"><span>Dividir em N recipientes</span><input name="l_split_count" inputmode="numeric" placeholder="ex.: 5"></label>
          <label class="fld s3"><span>Quantidade por recipiente</span><input name="l_split_size" inputmode="decimal" placeholder="ex.: 20"></label>
        </div></fieldset>` : `<label class="fld s3 chk"><input type="checkbox" name="active" ${p.active ? "checked" : ""}><span>Produto ativo</span></label>`}
        <label class="fld s12"><span>Observações</span><textarea name="notes" rows="2">${esc(p.notes || "")}</textarea></label>
        <label class="fld s6"><span>Fotografia (opcional)</span><input type="file" accept="image/*" name="_photo"></label>
        ${EA.respField()}
      </form>`,
      onOpen: (m) => {
        const f = m.querySelector("form");
        f.category_id.addEventListener("change", () => { f.subcategory_id.innerHTML = EA.subOptions(f.category_id.value); });
        const phases = m.querySelector("[data-phases]");
        const addPhase = (ph) => {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:4px";
          row.innerHTML = `do dia <input data-p="from" style="width:70px" value="${ph ? ph.from : 0}"> até o dia <input data-p="to" style="width:70px" value="${ph && ph.to !== null && ph.to !== undefined ? ph.to : ""}" placeholder="fim"> fator <input data-p="factor" style="width:70px" value="${ph ? EA.num(ph.factor, 3) : "1"}"> <button type="button" class="btn sm ghost">remover</button>`;
          row.querySelector("button").onclick = () => row.remove();
          phases.appendChild(row);
        };
        (rule.phases || []).forEach(addPhase);
        m.querySelector("[data-addphase]").onclick = () => addPhase(null);
        f.r_monthly_on.addEventListener("change", () => { m.querySelector("[data-monthly]").hidden = !f.r_monthly_on.checked; });
        m.querySelector("[data-portion]").onclick = () => EA.portionCalc({
          unit: f.unit.value, name: f.name.value,
          onApply: (res) => {
            f.cons_mode.value = "por_pessoa"; f.cons_period.value = "dia";
            f.cons_qty.value = EA.num(res.perPersonDay, 6);
            ["cons_mode", "cons_period", "cons_qty"].forEach((n) => f[n].dispatchEvent(new Event("change")));
            f.cons_qty.dispatchEvent(new Event("input"));
          },
        });
        const prev = () => {
          const q = parseNum(f.cons_qty.value), per = { dia: 1, semana: 7, mes: 30.4375, intervalo: parseNum(f.r_interval.value) || 0 }[f.cons_period.value];
          m.querySelector("[data-interval]").style.visibility = f.cons_period.value === "intervalo" ? "visible" : "hidden";
          const ppl = f.cons_mode.value === "por_pessoa" ? (parseNum(f.cons_people.value) || Number(EA.boot.settings.people)) : 1;
          const daily = per ? (q / per) * ppl : 0;
          m.querySelector("[data-cons-preview]").textContent = f.cons_mode.value === "nenhum" ? "Sem consumo regular: a autonomia não é calculada para este produto."
            : `Consumo previsto: ${EA.num(daily)} ${f.unit.value}/dia · ${EA.num(daily * 7)}/semana · ${EA.num(daily * 30.4375)}/mês${f.cons_mode.value === "por_pessoa" ? " para " + ppl + " pessoa(s)" : ""}.`;
        };
        ["cons_qty", "cons_period", "cons_mode", "cons_people", "r_interval", "unit"].forEach((n) => f[n].addEventListener("input", prev));
        ["cons_period", "cons_mode", "unit"].forEach((n) => f[n].addEventListener("change", prev));
        prev();
      },
      onOk: async (m) => {
        const f = m.querySelector("form");
        const d = EA.formData(f);
        const r = {};
        if (d.r_adjust && parseNum(d.r_adjust) !== 1) r.adjust = parseNum(d.r_adjust);
        if (d.r_reserve && parseNum(d.r_reserve) > 0) r.reserve = parseNum(d.r_reserve);
        if (d.cons_period === "intervalo") r.interval_days = parseNum(d.r_interval);
        const ph = [];
        m.querySelectorAll("[data-phases] > div").forEach((row) => {
          const g = (k) => row.querySelector(`[data-p=${k}]`).value;
          ph.push({ from: parseInt(g("from") || "0", 10), to: g("to") === "" ? null : parseInt(g("to"), 10), factor: parseNum(g("factor")) });
        });
        if (ph.length) r.phases = ph;
        if (d.r_monthly_on) r.monthly = Array.from({ length: 12 }, (_, i) => parseNum(d["r_m" + i]) || 0);
        const body = {};
        Object.keys(d).forEach((k) => { if (!k.startsWith("r_") && !k.startsWith("l_") && !k.startsWith("_")) body[k] = d[k]; });
        body.cons_rule = Object.keys(r).length ? r : null;
        if (isNew && d.l_qty) {
          body.initial_lot = {};
          Object.keys(d).filter((k) => k.startsWith("l_")).forEach((k) => (body.initial_lot[k.slice(2)] = d[k]));
        }
        EA.rememberResponsible(d.responsible);
        const res = isNew ? await EA.post("/api/products", body) : await EA.put("/api/products/" + p.id, body);
        const pid = res.product.id;
        const file = f._photo.files[0];
        if (file) await EA.uploadPhoto(pid, file, d.responsible);
        saved = true;
        EA.toast(isNew ? "Produto cadastrado: " + res.product.code : "Alterações salvas.");
        EA.go("#/produto/" + pid);
        if (!isNew) EA.refresh();
      },
      onClose: () => { if (!saved && location.hash === "#/produtos/novo") location.hash = "#/produtos"; },
    });
    return m;
  };
  function parseNum(v) {
    if (v === null || v === undefined || v === "") return 0;
    v = String(v).trim().replace(/\s/g, "");
    if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  EA.parseNum = parseNum;

  EA.uploadPhoto = function (pid, file, responsible) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = async () => {
        const sc = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        try { res(await EA.post("/api/products/" + pid + "/photo", { data: c.toDataURL("image/jpeg", 0.85), responsible })); } catch (e) { rej(e); }
      };
      img.onerror = () => rej(new Error("Imagem inválida."));
      img.src = URL.createObjectURL(file);
    });
  };

  // ============================================================ CATEGORIAS
  V.categorias = async function (el) {
    await EA.reloadBoot();
    const cats = EA.boot.categories;
    const tops = cats.filter((c) => !c.parent_id);
    el.innerHTML = `<div class="page-head"><div><h1>Categorias</h1><div class="sub">O grupo define a prioridade no modo de emergência (água, alimentos, medicamentos e higiene vêm primeiro).</div></div>
      <div class="actions"><button class="btn" data-new>Nova categoria</button></div></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Categoria</th><th>Grupo de emergência</th><th>Essencial</th><th class="n">Produtos</th><th></th></tr></thead><tbody>
      ${tops.map((t) => `<tr class="${t.active ? "" : "muted"}"><td><b>${esc(t.name)}</b>${t.active ? "" : " (inativa)"}</td><td>${esc(EA.boot.groups[t.grupo] || t.grupo)}</td><td>${t.essential ? "sim" : "não"}</td><td class="n">${t.products}</td>
        <td class="nowrap right"><button class="btn sm ghost" data-sub="${t.id}">+ Subcategoria</button> <button class="btn sm ghost" data-edit="${t.id}">Editar</button> <button class="btn sm ghost" data-delc="${t.id}">Excluir</button></td></tr>
        ${cats.filter((c) => c.parent_id === t.id).map((s) => `<tr class="sub ${s.active ? "" : "muted"}"><td>↳ ${esc(s.name)}${s.active ? "" : " (inativa)"}</td><td></td><td></td><td class="n">${s.products}</td>
          <td class="nowrap right"><button class="btn sm ghost" data-edit="${s.id}">Editar</button> <button class="btn sm ghost" data-delc="${s.id}">Excluir</button></td></tr>`).join("")}`).join("")}
      </tbody></table></div>`;
    const form = (c, parent) => {
      c = c || { grupo: "outros", essential: 0, priority: 50, active: 1, parent_id: parent || null };
      const isSub = !!c.parent_id;
      EA.modal({
        title: c.id ? "Editar categoria" : isSub ? "Nova subcategoria" : "Nova categoria", size: "narrow",
        body: `<form class="form"><label class="fld s12"><span class="req">Nome</span><input name="name" value="${esc(c.name || "")}"></label>
          ${isSub ? `<label class="fld s12"><span>Categoria principal</span><select name="parent_id">${EA.catOptions(c.parent_id, { blank: false })}</select></label>`
            : `<label class="fld s6"><span>Grupo (emergência)</span><select name="grupo">${Object.entries(EA.boot.groups).map(([k, v]) => `<option value="${k}" ${k === c.grupo ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
          <label class="fld s6"><span>Ordem de prioridade</span><input name="priority" value="${c.priority}"></label>
          <label class="fld s12 chk"><input type="checkbox" name="essential" ${c.essential ? "checked" : ""}><span>Essencial para sobrevivência</span></label>`}
          <label class="fld s12 chk"><input type="checkbox" name="active" ${c.active ? "checked" : ""}><span>Ativa</span></label></form>`,
        onOk: async (m) => {
          const d = EA.formData(m.querySelector("form"));
          if (c.id) d.id = c.id;
          if (isSub) { const par = cats.find((x) => x.id == d.parent_id); d.grupo = par.grupo; d.essential = par.essential; d.priority = par.priority; }
          await EA.post("/api/categories", d);
          EA.toast("Categoria salva.");
          V.categorias(el);
        },
      });
    };
    el.querySelector("[data-new]").onclick = () => form(null);
    el.querySelectorAll("[data-sub]").forEach((b) => (b.onclick = () => form(null, Number(b.dataset.sub))));
    el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => form(cats.find((c) => c.id == b.dataset.edit))));
    el.querySelectorAll("[data-delc]").forEach((b) => (b.onclick = async () => {
      if (!(await EA.confirm("Excluir categoria", "Se houver produtos ou subcategorias, a categoria será apenas inativada.", "Excluir", true))) return;
      try { const r = await EA.del("/api/categories/" + b.dataset.delc); EA.toast(r.deleted ? "Categoria excluída." : "Categoria em uso: foi inativada."); V.categorias(el); } catch (e) { EA.toast(e.message, true); }
    }));
  };

  // ============================================================ LOCAIS / MAPA DE ARMAZENAMENTO
  const LOC_LABEL = { deposito: "Depósito", cozinha: "Cozinha", despensa: "Despensa", cisterna: "Cisterna", caixa_dagua: "Caixa d'água", galpao: "Galpão", armario: "Armário",
    prateleira: "Prateleira", geladeira: "Geladeira", freezer: "Freezer", quarto: "Quarto", garagem: "Garagem", veiculo: "Veículo", outro: "Outro" };
  EA.LOC_LABEL = LOC_LABEL;
  V.locais = async function (el) {
    await EA.reloadBoot();
    const mp = await EA.get("/api/map");
    const node = (n) => `<li class="node"><div class="nh"><span class="badge b-grey">${esc(LOC_LABEL[n.type] || n.type)}</span><span class="nm">${esc(n.name)}</span>
        <span class="mono small muted">${esc(n.code || "")}</span>${n.active ? "" : '<span class="badge b-grey">inativo</span>'}<span class="small muted">${n.total_items} item(ns)</span>
        <div class="actions"><button class="btn sm ghost" data-child="${n.id}">+ Dentro deste</button><a class="btn sm ghost" href="#/etiquetas/LOC:${n.id}">Etiqueta</a><button class="btn sm ghost" data-edit="${n.id}">Editar</button><button class="btn sm ghost" data-del="${n.id}">Excluir</button></div></div>
        ${n.items.length ? `<div class="items">${n.items.map((i) => `<div><a href="#/produto/${i.product_id}">${esc(i.product_name)}</a> <span class="mono small muted">${esc(i.code)}</span> — ${EA.qty(i.qty, i.unit)} ${EA.expiryBadge(i.status, i.days)}</div>`).join("")}</div>` : ""}
        ${n.children.length ? `<ul class="tree">${n.children.map(node).join("")}</ul>` : ""}</li>`;
    el.innerHTML = `<div class="page-head"><div><h1>Locais e mapa de armazenamento</h1><div class="sub">Organize em níveis: Depósito › Estante 2 › Prateleira B. Cada item mostra exatamente onde está guardado.</div></div>
      <div class="actions"><a class="btn ghost" target="_blank" href="${EA.url("/relatorio", { tipo: "mapa" })}">Imprimir mapa</a><button class="btn" data-new>Novo local</button></div></div>
      <div class="filters"><label class="f">Encontrar produto no mapa<input data-find placeholder="digite o nome" style="min-width:260px"></label></div>
      <ul class="tree" data-tree>${mp.tree.map(node).join("") || '<div class="empty">Nenhum local cadastrado.</div>'}</ul>
      ${mp.unplaced.length ? `<section class="panel"><h3>Itens sem local definido</h3>${mp.unplaced.map((i) => `<div><a href="#/produto/${i.product_id}">${esc(i.product_name)}</a> ${esc(i.code)} — ${EA.qty(i.qty, i.unit)}</div>`).join("")}</section>` : ""}`;
    const form = (l, parent) => {
      l = l || { type: "prateleira", parent_id: parent || null, active: 1 };
      EA.modal({
        title: l.id ? "Editar local" : "Novo local", size: "narrow",
        body: `<form class="form"><label class="fld s12"><span class="req">Nome</span><input name="name" value="${esc(l.name || "")}" placeholder="ex.: Prateleira B"></label>
          <label class="fld s6"><span>Tipo</span><select name="type">${Object.entries(LOC_LABEL).map(([k, v]) => `<option value="${k}" ${k === l.type ? "selected" : ""}>${v}</option>`).join("")}</select></label>
          <label class="fld s6"><span>Fica dentro de</span><select name="parent_id">${EA.locOptions(l.parent_id, "— nível principal —")}</select></label>
          <label class="fld s12"><span>Descrição / como chegar</span><input name="description" value="${esc(l.description || "")}"></label>
          <label class="fld s6"><span>Capacidade</span><input name="capacity" value="${esc(l.capacity || "")}" placeholder="ex.: 5.000 L"></label>
          <label class="fld s6 chk"><input type="checkbox" name="active" ${l.active ? "checked" : ""}><span>Ativo</span></label></form>`,
        onOk: async (m) => {
          const d = EA.formData(m.querySelector("form"));
          if (l.id) d.id = l.id;
          await EA.post("/api/locations", d);
          EA.toast("Local salvo.");
          V.locais(el);
        },
      });
    };
    el.querySelector("[data-new]").onclick = () => form(null);
    el.querySelectorAll("[data-child]").forEach((b) => (b.onclick = () => form(null, Number(b.dataset.child))));
    el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => form(EA.boot.locations.find((x) => x.id == b.dataset.edit))));
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!(await EA.confirm("Excluir local", "Se o local tiver itens, sublocais ou histórico, ele será apenas inativado.", "Excluir", true))) return;
      try { const r = await EA.del("/api/locations/" + b.dataset.del); EA.toast(r.deleted ? "Local excluído." : "Local em uso: foi inativado."); V.locais(el); } catch (e) { EA.toast(e.message, true); }
    }));
    el.querySelector("[data-find]").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      el.querySelectorAll(".node .items > div").forEach((d) => { d.style.background = q && d.textContent.toLowerCase().includes(q) ? "#fff3b0" : ""; });
      const hit = q && Array.from(el.querySelectorAll(".node .items > div")).find((d) => d.textContent.toLowerCase().includes(q));
      if (hit) hit.scrollIntoView({ block: "center" });
    });
  };
  V.local = async function (el, id) {
    await V.locais(el);
    const n = Array.from(el.querySelectorAll(`[data-edit="${id}"]`))[0];
    if (n) { const nh = n.closest(".nh"); nh.style.outline = "3px solid var(--signal)"; nh.scrollIntoView({ block: "center" }); }
  };
})();
