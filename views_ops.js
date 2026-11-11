/* Lotes, recipientes, movimentações, validade, etiquetas e revisão periódica. */
(function () {
  "use strict";
  const EA = window.EA, esc = EA.esc, V = EA.views;

  // ------------------------------------------------------------ formulários de operação
  EA.entryForm = function (p, done) {
    EA.modal({
      title: "Entrada de " + p.name + " (novo lote)", size: "wide", okLabel: "Registrar entrada",
      body: `<form class="form">
        <label class="fld s3"><span class="req">Quantidade (${esc(p.unit)})</span><input name="qty" inputmode="decimal" required autofocus></label>
        <label class="fld s3"><span>Preço unitário (R$)</span><input name="unit_price" inputmode="decimal"></label>
        <label class="fld s3"><span>ou valor total (R$)</span><input name="total_price" inputmode="decimal"></label>
        <label class="fld s3"><span>Número do lote</span><input name="lot_number"></label>
        <label class="fld s6"><span>Fornecedor</span><input name="supplier"></label>
        <label class="fld s6"><span>Local de armazenamento</span><select name="location_id">${EA.locOptions(p.default_location_id)}</select></label>
        <label class="fld s3"><span>Data de aquisição</span><input type="date" name="acquired_at" value="${EA.todayISO()}"></label>
        <label class="fld s3"><span>Entrada no estoque</span><input type="date" name="entry_at" value="${EA.todayISO()}"></label>
        <label class="fld s3"><span>Data de armazenamento</span><input type="date" name="stored_at" value="${EA.todayISO()}"></label>
        <label class="fld s3"><span>Data de fabricação</span><input type="date" name="manufactured_at"></label>
        <label class="fld s3"><span>Data de validade</span><input type="date" name="expires_at"></label>
        <label class="fld s3"><span>Dividir em N recipientes</span><input name="split_count" inputmode="numeric" placeholder="opcional"></label>
        <label class="fld s3"><span>Quantidade por recipiente</span><input name="split_size" inputmode="decimal"></label>
        <label class="fld s12"><span>Observações</span><input name="notes"></label>
        ${EA.respField()}</form>`,
      onOk: async (m) => {
        const d = EA.formData(m.querySelector("form"));
        EA.rememberResponsible(d.responsible);
        const lot = await EA.post("/api/products/" + p.id + "/entry", d);
        EA.toast("Entrada registrada: lote " + lot.code);
        if (await EA.confirm("Imprimir etiqueta?", "Deseja imprimir a etiqueta do lote <b>" + esc(lot.code) + "</b> e de seus recipientes agora?", "Ir para etiquetas")) {
          const det = await EA.get("/api/lots/" + lot.id);
          EA.go("#/etiquetas/" + ["L:" + lot.id].concat(det.lot.containers.map((c) => "R:" + c.id)).join(","));
          return;
        }
        done && done();
      },
    });
  };

  EA.consumeForm = function (p, done) {
    EA.modal({
      title: "Consumir " + p.name, size: "narrow", okLabel: "Registrar consumo",
      body: `<p class="small muted">A retirada segue o FEFO: o sistema baixa primeiro os itens que vencem primeiro (itens vencidos não são consumidos).</p>
        <form class="form"><label class="fld s6"><span class="req">Quantidade (${esc(p.unit)})</span><input name="qty" inputmode="decimal" autofocus></label>
        <label class="fld s6"><span>Data/hora</span><input type="datetime-local" name="ts"></label>
        <label class="fld s12"><span>Motivo / destino</span><input name="reason" placeholder="ex.: consumo da semana"></label>${EA.respField().replace("s4", "s12")}</form>`,
      onOk: async (m) => {
        const d = EA.formData(m.querySelector("form"));
        d.product_id = p.id;
        EA.rememberResponsible(d.responsible);
        const r = await EA.post("/api/consume", d);
        EA.toast("Consumo registrado (" + r.movement_ids.length + " item(ns) baixado(s) por FEFO).");
        done && done();
      },
    });
  };

  const TYPE_HELP = {
    CONSUMO: "Saída para consumo de um lote/recipiente específico.", TRANSFERENCIA: "Muda o item de lugar (a quantidade não muda).",
    DESCARTE: "Retirada definitiva (ex.: embalagem danificada).", PERDA: "Item perdido, estragado ou extraviado.",
    VENCIMENTO: "Baixa de item vencido.", AJUSTE: "Correção após contagem física: informe a quantidade contada.",
    DEVOLUCAO: "Devolução ao estoque (entrada) ou ao fornecedor (saída).", ABERTURA: "Registra a abertura; se o produto tiver validade após aberto, a validade é recalculada.",
  };
  EA.movementForm = function (ctx, done) {
    // ctx: {product, lots} ou {lot, container, product}
    const p = ctx.product;
    let opts = "";
    (ctx.lots || []).forEach((l) => {
      if (l.qty > 0 || l.free_qty > 0) opts += `<option value="L:${l.id}">Lote ${esc(l.code)} ${l.lot_number ? "(" + esc(l.lot_number) + ")" : ""} — livre ${EA.num(l.free_qty)} ${esc(p.unit)} — val. ${EA.date(l.expires_at)}</option>`;
      l.containers.forEach((c) => { if (c.qty > 0) opts += `<option value="R:${c.id}">&nbsp;&nbsp;Recipiente ${esc(c.code)} ${c.label && c.label !== c.code ? "(" + esc(c.label) + ")" : ""} — ${EA.num(c.qty)} ${esc(p.unit)} — ${esc(c.location_path)}</option>`; });
    });
    if (ctx.container) opts = `<option value="R:${ctx.container.id}">Recipiente ${esc(ctx.container.code)} — ${EA.num(ctx.container.qty)} ${esc(p.unit)}</option>`;
    else if (ctx.lot) opts = `<option value="L:${ctx.lot.id}">Lote ${esc(ctx.lot.code)} — livre ${EA.num(ctx.lot.free_qty)} ${esc(p.unit)}</option>`;
    const types = Object.entries(EA.boot.movement_types).filter(([k]) => !["ENTRADA", "FRACIONAMENTO", "ESTORNO"].includes(k));
    EA.modal({
      title: "Movimentação — " + p.name, okLabel: "Registrar",
      body: opts ? `<form class="form">
        <label class="fld s6"><span class="req">Tipo</span><select name="type">${types.map(([k, v]) => `<option value="${k}" ${k === (ctx.type || "CONSUMO") ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
        <label class="fld s6"><span class="req">Lote ou recipiente</span><select name="target">${opts}</select></label>
        <p class="help" data-help></p>
        <label class="fld s3" data-show="qty"><span class="req">Quantidade (${esc(p.unit)})</span><input name="qty" inputmode="decimal"></label>
        <label class="fld s3" data-show="counted"><span class="req">Quantidade contada</span><input name="counted_qty" inputmode="decimal"></label>
        <label class="fld s3" data-show="direction"><span>Sentido</span><select name="direction"><option value="entrada">Volta ao estoque (+)</option><option value="saida">Sai do estoque (−)</option></select></label>
        <label class="fld s6" data-show="to"><span class="req">Local de destino</span><select name="to_location_id">${EA.locOptions("")}</select></label>
        <label class="fld s3" data-show="opened"><span>Data de abertura</span><input type="date" name="opened_at" value="${EA.todayISO()}"></label>
        <label class="fld s3"><span>Data/hora (se retroativa)</span><input type="datetime-local" name="ts"></label>
        <label class="fld s12"><span data-reason-label>Motivo</span><input name="reason"></label>${EA.respField()}</form>` : '<div class="empty">Não há saldo em lotes ou recipientes deste produto.</div>',
      onOpen: (m) => {
        const f = m.querySelector("form");
        if (!f) return;
        const upd = () => {
          const t = f.type.value;
          const show = { qty: !["TRANSFERENCIA", "ABERTURA", "AJUSTE"].includes(t), counted: t === "AJUSTE", direction: t === "DEVOLUCAO", to: t === "TRANSFERENCIA", opened: t === "ABERTURA" };
          m.querySelectorAll("[data-show]").forEach((x) => (x.style.display = show[x.dataset.show] ? "" : "none"));
          m.querySelector("[data-help]").textContent = TYPE_HELP[t] || "";
          m.querySelector("[data-reason-label]").className = ["AJUSTE", "DEVOLUCAO", "DESCARTE", "PERDA", "VENCIMENTO"].includes(t) ? "req" : "";
        };
        f.type.addEventListener("change", upd);
        upd();
      },
      onOk: async (m) => {
        const f = m.querySelector("form");
        if (!f) return true;
        const d = EA.formData(f);
        const [k, id] = d.target.split(":");
        if (k === "L") d.lot_id = id; else d.container_id = id;
        delete d.target;
        if (d.type !== "AJUSTE") delete d.counted_qty;
        EA.rememberResponsible(d.responsible);
        const r = await EA.post("/api/movements", d);
        EA.toast(r.message || "Movimentação registrada.");
        done && done();
      },
    });
  };

  EA.splitForm = function (lot, p, done) {
    EA.modal({
      title: "Dividir lote " + lot.code + " em recipientes", okLabel: "Criar recipientes",
      body: `<p>Saldo livre do lote: <b>${EA.qty(lot.free_qty, p.unit)}</b>. Cada recipiente recebe código e QR Code próprios e continua ligado ao lote de origem.</p>
        <form class="form"><label class="fld s3"><span>Número de recipientes</span><input name="n" inputmode="numeric" value="1" autofocus></label>
        <label class="fld s3"><span>Quantidade em cada (${esc(p.unit)})</span><input name="size" inputmode="decimal"></label>
        <label class="fld s6"><span>Rótulo (prefixo)</span><input name="label" placeholder="ex.: Galão azul"></label>
        <label class="fld s6"><span>Local</span><select name="location_id">${EA.locOptions(lot.location_id)}</select></label>
        <label class="fld s3"><span>Validade específica</span><input type="date" name="expires_at"></label>
        <label class="fld s3"><span>Data de armazenamento</span><input type="date" name="stored_at" value="${EA.todayISO()}"></label>${EA.respField()}</form>`,
      onOk: async (m) => {
        const d = EA.formData(m.querySelector("form"));
        const n = parseInt(d.n, 10) || 0;
        if (n < 1 || n > 500) throw new Error("Informe entre 1 e 500 recipientes.");
        const conts = [];
        for (let i = 1; i <= n; i++) conts.push({ qty: d.size, label: d.label ? `${d.label} ${n > 1 ? i : ""}`.trim() : "", location_id: d.location_id, expires_at: d.expires_at, stored_at: d.stored_at });
        EA.rememberResponsible(d.responsible);
        const r = await EA.post("/api/lots/" + lot.id + "/split", { containers: conts, responsible: d.responsible });
        EA.toast(r.container_ids.length + " recipiente(s) criado(s).");
        if (await EA.confirm("Imprimir etiquetas?", "Imprimir as etiquetas dos novos recipientes?", "Ir para etiquetas")) {
          EA.go("#/etiquetas/" + r.container_ids.map((i) => "R:" + i).join(","));
          return;
        }
        done && done();
      },
    });
  };

  EA.bindLotActions = function (el, p, lots, reload) {
    el.querySelectorAll("[data-split]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const lot = lots.find((l) => l.id == b.dataset.split);
      EA.splitForm(lot, p, reload);
    }));
  };

  // ------------------------------------------------------------ tabela de movimentações
  EA.movTable = function (rows, o) {
    o = o || {};
    if (!rows.length) return '<div class="panel empty">Nenhuma movimentação.</div>';
    return `<div class="table-wrap tall"><table class="t"><thead><tr><th>Nº</th><th>Data/hora</th><th>Tipo</th>${o.hideProduct ? "" : "<th>Produto</th>"}<th>Lote / recipiente</th><th class="n">Quantidade</th><th>Locais</th><th>Motivo</th><th>Responsável</th><th></th></tr></thead><tbody>
      ${rows.map((m) => { const q = m.qty || m.container_qty; const unit = m.unit || o.unit || "";
        return `<tr><td class="mono small">${m.id}</td><td class="nowrap">${EA.date(m.ts)}</td><td>${esc(m.type_label)}${m.reversed ? ' <span class="badge b-grey">estornada</span>' : ""}</td>
        ${o.hideProduct ? "" : `<td><a href="#/produto/${m.product_id}">${esc(m.product_name)}</a></td>`}
        <td class="mono small">${esc(m.container_code || m.lot_code || "")}</td>
        <td class="n">${q ? `<span class="${q < 0 ? "" : ""}">${q > 0 ? "+" : ""}${EA.num(q)} ${esc(unit)}</span>` : '<span class="muted">—</span>'}${m.type === "FRACIONAMENTO" ? '<div class="small muted">no recipiente</div>' : ""}</td>
        <td class="small">${esc([m.from_path, m.to_path].filter(Boolean).join(" → "))}</td><td class="small">${esc(m.reason || "")}</td><td class="small">${esc(m.responsible)}</td>
        <td>${!m.reversed && !["ESTORNO", "TRANSFERENCIA", "ABERTURA"].includes(m.type) ? `<button class="btn sm ghost" data-rev="${m.id}" title="Lança a movimentação inversa; a original continua no histórico">Estornar</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`;
  };
  EA.bindMovActions = function (el, reload) {
    el.querySelectorAll("[data-rev]").forEach((b) => b.addEventListener("click", () => {
      EA.modal({
        title: "Estornar movimentação nº " + b.dataset.rev, size: "narrow", okLabel: "Estornar",
        body: `<p>O estorno lança uma movimentação inversa. A original <b>não é apagada</b> e continua no histórico.</p><form class="form"><label class="fld s12"><span class="req">Motivo do estorno</span><input name="reason"></label>${EA.respField().replace("s4", "s12")}</form>`,
        onOk: async (m) => {
          const d = EA.formData(m.querySelector("form"));
          await EA.post("/api/movements/" + b.dataset.rev + "/reverse", d);
          EA.toast("Movimentação estornada.");
          reload && reload();
        },
      });
    }));
  };

  // ============================================================ LOTES E RECIPIENTES
  V.lotes = async function (el) {
    el.innerHTML = `<div class="page-head"><div><h1>Lotes e recipientes</h1><div class="sub">Um produto pode ter vários lotes; cada lote pode ser dividido em recipientes (ex.: 100 L em 5 galões de 20 L) sem perder a origem.</div></div></div>
      <div class="filters"><label class="f">Buscar<input data-q placeholder="produto, código ou nº do lote" style="min-width:260px"></label>
      <label class="f" style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-empty> incluir esgotados</label></div><div data-list></div>`;
    const load = async () => {
      const rows = await EA.get("/api/lots" + EA.qs({ q: el.querySelector("[data-q]").value, include_empty: el.querySelector("[data-empty]").checked ? 1 : "" }));
      const box = el.querySelector("[data-list]");
      if (!rows.length) { box.innerHTML = '<div class="panel empty">Nenhum lote com saldo. Registre entradas pela ficha do produto.</div>'; return; }
      box.innerHTML = `<div class="table-wrap tall"><table class="t"><thead><tr><th>Lote / recipiente</th><th>Produto</th><th>Nº lote</th><th class="n">Saldo</th><th>Validade</th><th>Local</th><th></th></tr></thead><tbody>
        ${rows.map((l) => `<tr class="click" data-href="#/lote/${l.id}"><td class="mono"><b>${esc(l.code)}</b></td><td>${esc(l.product_name)}</td><td>${esc(l.lot_number || "—")}</td>
          <td class="n"><b>${EA.qty(l.qty, l.unit)}</b>${l.containers.length ? `<div class="small muted">fora de recipientes: ${EA.num(l.free_qty)}</div>` : ""}</td><td>${EA.date(l.expires_at)} ${l.qty > 0 ? EA.expiryBadge(l.status, l.days) : ""}</td><td class="small">${esc(l.location_path)}</td>
          <td class="nowrap"><a class="btn sm ghost" href="#/etiquetas/${["L:" + l.id].concat(l.containers.map((c) => "R:" + c.id)).join(",")}">Etiquetas</a></td></tr>
          ${l.containers.map((c) => `<tr class="sub click" data-href="#/recipiente/${c.id}"><td class="mono">↳ ${esc(c.code)}</td><td>${esc(c.label || "")}${c.opened_at ? ' <span class="badge b-blue">aberto</span>' : ""}</td><td></td>
            <td class="n">${EA.qty(c.qty, l.unit)} <span class="small muted">de ${EA.num(c.initial_qty)}</span></td><td>${EA.date(c.effective_expiry)} ${c.qty > 0 ? EA.expiryBadge(c.status, c.days) : '<span class="badge b-grey">vazio</span>'}</td><td class="small">${esc(c.location_path)}</td><td></td></tr>`).join("")}`).join("")}
        </tbody></table></div>`;
      EA.bindRowLinks(box);
    };
    let t;
    el.querySelector("[data-q]").addEventListener("input", () => { clearTimeout(t); t = setTimeout(load, 200); });
    el.querySelector("[data-empty]").addEventListener("change", load);
    await load();
  };

  V.lote = async function (el, id) {
    const d = await EA.get("/api/lots/" + id);
    const l = d.lot, p = d.product;
    const withStock = l.containers.filter((c) => c.qty > 0), empties = l.containers.filter((c) => !(c.qty > 0));
    el.innerHTML = `<div class="page-head"><div><div class="small muted"><a href="#/produto/${p.id}">${esc(p.name)}</a> › lote</div><h1>Lote ${esc(l.code)}</h1></div>
      <div class="actions"><button class="btn" data-mov>Movimentar</button><button class="btn ghost" data-split ${l.free_qty > 0 ? "" : "disabled"}>Dividir em recipientes</button>
        <a class="btn ghost" href="#/etiquetas/${["L:" + l.id].concat(l.containers.map((c) => "R:" + c.id)).join(",")}">Etiquetas</a><button class="btn ghost" data-edit>Editar dados</button></div></div>
      <div class="grid g-wide"><section class="panel"><dl class="kv">
        <dt>Produto</dt><dd><a href="#/produto/${p.id}">${esc(p.name)}</a></dd><dt>Número do lote</dt><dd>${esc(l.lot_number || "—")}</dd><dt>Fornecedor</dt><dd>${esc(l.supplier || "—")}</dd>
        <dt>Quantidade adquirida</dt><dd>${EA.qty(l.qty_acquired, p.unit)} · ${EA.money(l.unit_price)}/${esc(p.unit)} · total ${EA.money(l.qty_acquired * l.unit_price)}</dd>
        <dt>Saldo atual</dt><dd><b>${EA.qty(l.qty, p.unit)}</b> (em recipientes: ${EA.num(l.container_total)}; livre: ${EA.num(l.free_qty)})</dd>
        <dt>Aquisição / entrada</dt><dd>${EA.date(l.acquired_at)} / ${EA.date(l.entry_at)}</dd><dt>Armazenamento</dt><dd>${EA.date(l.stored_at)}</dd>
        <dt>Fabricação / validade</dt><dd>${EA.date(l.manufactured_at)} / ${EA.date(l.expires_at)} ${EA.expiryBadge(l.status, l.days)}</dd>
        ${l.opened_at ? `<dt>Aberto em</dt><dd>${EA.date(l.opened_at)}</dd>` : ""}<dt>Local</dt><dd>${esc(l.location_path || "—")}</dd><dt>Observações</dt><dd>${esc(l.notes || "—")}</dd></dl></section>
        <section class="panel codebox" style="flex-direction:column;align-items:flex-start"><img src="${EA.url("/codigo/qr.svg", { c: l.code })}" alt="" style="width:140px;height:140px"><span class="mono">EA-${esc(l.code)}</span></section></div>
      <h2 style="margin:6px 0 10px">Recipientes com saldo (${withStock.length})${empties.length ? ` <span class="small muted" style="font-family:var(--body);font-weight:400">· ${empties.length} vazio(s) no fim da lista</span>` : ""}</h2>
      ${l.containers.length ? `<div class="table-wrap tall"><table class="t"><thead><tr><th>Recipiente</th><th>Rótulo</th><th class="n">Inicial</th><th class="n">Atual</th><th>Validade</th><th>Aberto</th><th>Local</th></tr></thead><tbody>
        ${withStock.concat(empties).map((c) => `<tr class="click" data-href="#/recipiente/${c.id}"><td class="mono">${esc(c.code)}</td><td>${esc(c.label || "")}</td><td class="n">${EA.num(c.initial_qty)}</td><td class="n"><b>${EA.num(c.qty)}</b></td>
          <td>${EA.date(c.effective_expiry)} ${c.qty > 0 ? EA.expiryBadge(c.status, c.days) : '<span class="badge b-grey">vazio</span>'}</td><td>${EA.date(c.opened_at)}</td><td>${esc(c.location_path)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="panel empty">Lote não dividido em recipientes.</div>'}
      <h2 style="margin:16px 0 10px">Histórico do lote</h2>${EA.movTable(d.movements, { hideProduct: true, unit: p.unit })}`;
    const reload = () => V.lote(el, id);
    el.querySelector("[data-mov]").onclick = () => EA.movementForm({ product: p, lots: [l] }, reload);
    el.querySelector("[data-split]").onclick = () => EA.splitForm(l, p, reload);
    el.querySelector("[data-edit]").onclick = () => EA.modal({
      title: "Editar dados do lote " + l.code, okLabel: "Salvar",
      body: `<p class="small muted">A quantidade não é editada aqui: use uma movimentação (ajuste de inventário) para manter o histórico.</p><form class="form">
        <label class="fld s3"><span>Número do lote</span><input name="lot_number" value="${esc(l.lot_number || "")}"></label><label class="fld s3"><span>Fornecedor</span><input name="supplier" value="${esc(l.supplier || "")}"></label>
        <label class="fld s3"><span>Preço unitário</span><input name="unit_price" value="${EA.num(l.unit_price, 4)}"></label><label class="fld s3"><span>Aquisição</span><input type="date" name="acquired_at" value="${l.acquired_at || ""}"></label>
        <label class="fld s3"><span>Entrada</span><input type="date" name="entry_at" value="${l.entry_at || ""}"></label><label class="fld s3"><span>Armazenamento</span><input type="date" name="stored_at" value="${l.stored_at || ""}"></label>
        <label class="fld s3"><span>Fabricação</span><input type="date" name="manufactured_at" value="${l.manufactured_at || ""}"></label><label class="fld s3"><span>Validade</span><input type="date" name="expires_at" value="${l.expires_at || ""}"></label>
        <label class="fld s12"><span>Observações</span><input name="notes" value="${esc(l.notes || "")}"></label>${EA.respField()}</form>`,
      onOk: async (m) => { await EA.put("/api/lots/" + l.id, EA.formData(m.querySelector("form"))); EA.toast("Lote atualizado."); reload(); },
    });
    EA.bindRowLinks(el);
    EA.bindMovActions(el, reload);
  };

  V.recipiente = async function (el, id) {
    const d = await EA.get("/api/containers/" + id);
    const c = d.container, p = d.product, l = d.lot;
    el.innerHTML = `<div class="page-head"><div><div class="small muted"><a href="#/produto/${p.id}">${esc(p.name)}</a> › <a href="#/lote/${l.id}">lote ${esc(l.code)}</a> › recipiente</div>
        <h1>${esc(c.label || c.code)}</h1></div>
      <div class="actions"><button class="btn" data-use>Retirar</button><button class="btn ghost" data-mov>Outra movimentação</button>
        ${c.opened_at ? "" : '<button class="btn ghost" data-open>Registrar abertura</button>'}
        <button class="btn ghost" data-ret ${c.qty > 0 ? "" : "disabled"}>Devolver ao lote</button><a class="btn ghost" href="#/etiquetas/R:${c.id}">Etiqueta</a><button class="btn ghost" data-edit>Editar</button></div></div>
      <div class="grid g-wide"><section class="panel">
        <div class="stat-line" style="margin-top:0"><div><b>${EA.qty(c.qty, p.unit)}</b>quantidade atual</div><div><b>${EA.qty(c.initial_qty, p.unit)}</b>quantidade inicial</div>
          <div><b>${EA.date(c.effective_expiry)}</b>validade ${EA.expiryBadge(c.status, c.days)}</div></div>
        <dl class="kv" style="margin-top:12px"><dt>Código</dt><dd class="mono">${esc(c.code)}</dd><dt>Lote de origem</dt><dd><a href="#/lote/${l.id}">${esc(l.code)}</a> (nº ${esc(l.lot_number || "—")})</dd>
          <dt>Armazenado em</dt><dd>${EA.date(c.stored_at)}</dd><dt>Aberto em</dt><dd>${c.opened_at ? EA.date(c.opened_at) : "fechado"}</dd>
          <dt>Localização física</dt><dd><b>${esc(c.location_path || "—")}</b></dd><dt>Capacidade</dt><dd>${EA.qty(c.capacity, p.unit)}</dd><dt>Observações</dt><dd>${esc(c.notes || "—")}</dd></dl></section>
        <section class="panel codebox" style="flex-direction:column;align-items:flex-start"><img src="${EA.url("/codigo/qr.svg", { c: c.code })}" alt="" style="width:140px;height:140px"><span class="mono">EA-${esc(c.code)}</span></section></div>
      <h2 style="margin:6px 0 10px">Histórico de retiradas</h2>${EA.movTable(d.movements, { hideProduct: true, unit: p.unit })}`;
    const reload = () => V.recipiente(el, id);
    const ctx = { product: p, container: c };
    el.querySelector("[data-use]").onclick = () => EA.movementForm(Object.assign({ type: "CONSUMO" }, ctx), reload);
    el.querySelector("[data-mov]").onclick = () => EA.movementForm(ctx, reload);
    const ob = el.querySelector("[data-open]");
    if (ob) ob.onclick = () => EA.movementForm(Object.assign({ type: "ABERTURA" }, ctx), reload);
    el.querySelector("[data-ret]").onclick = async () => {
      if (!(await EA.confirm("Devolver ao lote", "O conteúdo do recipiente volta para a parte livre do lote " + esc(l.code) + ".", "Devolver"))) return;
      try { await EA.post("/api/containers/" + c.id + "/return", { responsible: EA.responsible() }); EA.toast("Conteúdo devolvido ao lote."); reload(); } catch (e) { EA.toast(e.message, true); }
    };
    el.querySelector("[data-edit]").onclick = () => EA.modal({
      title: "Editar recipiente " + c.code, size: "narrow",
      body: `<form class="form"><label class="fld s12"><span>Rótulo</span><input name="label" value="${esc(c.label || "")}"></label>
        <label class="fld s6"><span>Capacidade</span><input name="capacity" value="${EA.num(c.capacity, 6)}"></label><label class="fld s6"><span>Armazenado em</span><input type="date" name="stored_at" value="${c.stored_at || ""}"></label>
        <label class="fld s6"><span>Validade específica</span><input type="date" name="expires_at" value="${c.expires_at || ""}"></label>
        <label class="fld s12"><span>Observações</span><input name="notes" value="${esc(c.notes || "")}"></label>${EA.respField().replace("s4", "s12")}
        <p class="help">Para mudar o local use “Outra movimentação › Transferência”, que fica registrada no histórico.</p></form>`,
      onOk: async (m) => { await EA.put("/api/containers/" + c.id, EA.formData(m.querySelector("form"))); EA.toast("Recipiente atualizado."); reload(); },
    });
    EA.bindMovActions(el, reload);
  };

  // ============================================================ LANÇAR ESTOQUE (várias entradas de uma vez)
  V.lancar = async function (el) {
    await EA.reloadBoot();
    const prods = (await EA.get("/api/products")).filter((p) => p.active);
    el.innerHTML = `<div class="page-head"><div><h1>Lançar estoque</h1><div class="sub">Preencha a quantidade dos produtos que você tem e registre tudo de uma vez. Cada linha preenchida vira um lote, com validade e local.</div></div>
        <div class="actions"><a class="btn ghost" href="#/produtos">Voltar aos produtos</a></div></div>
      ${prods.length ? `<div class="filters">
        <label class="f">Buscar<input data-q placeholder="nome do produto" style="min-width:220px"></label>
        <label class="f">Categoria<select data-c>${EA.catOptions("")}</select></label>
        <label class="f">Local para todos<select data-loc>${EA.locOptions("", "— local de cada produto —")}</select></label>
        <label class="f" style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-zero> só produtos sem estoque</label></div>
      <form data-form><div class="table-wrap"><table class="t bulk"><thead><tr><th>Produto</th><th class="n hide-sm">Em estoque</th><th>Quantidade</th><th>Validade</th><th class="hide-sm">Local</th><th class="hide-sm">Preço unit. (R$)</th></tr></thead><tbody>
        ${prods.map((p) => `<tr data-id="${p.id}" data-cat="${p.category_id || ""}" data-qty="${p.qty}" data-name="${esc(p.name.toLowerCase())}">
          <td><b>${esc(p.name)}</b><div class="small muted">${esc(p.category_name || "")}</div></td>
          <td class="n hide-sm">${EA.qty(p.qty, p.unit)}</td>
          <td class="q"><input name="qty" inputmode="decimal" placeholder="${esc(p.unit)}" aria-label="Quantidade de ${esc(p.name)} em ${esc(p.unit)}"></td>
          <td><input type="date" name="expires_at" aria-label="Validade de ${esc(p.name)}"></td>
          <td class="hide-sm"><select name="location_id" aria-label="Local de ${esc(p.name)}">${EA.locOptions("", "— padrão —")}</select></td>
          <td class="hide-sm"><input name="unit_price" inputmode="decimal" aria-label="Preço unitário de ${esc(p.name)}"></td></tr>`).join("")}</tbody></table></div>
        <div class="sticky-bar"><b data-n>Nenhuma linha preenchida</b><span class="small muted">Linhas sem quantidade são ignoradas.</span>
          <button class="btn ok" type="submit" style="margin-left:auto" disabled>Registrar entradas</button></div></form>`
      : `<div class="panel empty"><p>Cadastre os produtos primeiro.</p><p><a class="btn" href="#/produtos">Ir para Produtos</a></p></div>`}`;
    const form = el.querySelector("[data-form]");
    if (!form) return;
    const rows = Array.from(form.querySelectorAll("tbody tr"));
    const filled = () => rows.filter((r) => EA.parseNum(r.querySelector("[name=qty]").value) > 0);
    const upd = () => {
      rows.forEach((r) => r.classList.toggle("filled", EA.parseNum(r.querySelector("[name=qty]").value) > 0));
      const n = filled().length;
      form.querySelector("[data-n]").textContent = n ? n + " produto(s) a lançar" : "Nenhuma linha preenchida";
      form.querySelector("button[type=submit]").disabled = !n;
    };
    const filt = () => {
      const q = el.querySelector("[data-q]").value.trim().toLowerCase(), c = el.querySelector("[data-c]").value, z = el.querySelector("[data-zero]").checked;
      rows.forEach((r) => { r.hidden = !!((q && !r.dataset.name.includes(q)) || (c && r.dataset.cat !== c) || (z && Number(r.dataset.qty) > 0)); });
    };
    form.addEventListener("input", upd);
    ["[data-q]", "[data-c]", "[data-zero]"].forEach((s) => el.querySelector(s).addEventListener("input", filt));
    form.addEventListener("keydown", (e) => {
      // Enter desce para a mesma coluna da próxima linha visível (digitação rápida)
      if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
      e.preventDefault();
      const tr = e.target.closest("tr");
      let nx = tr.nextElementSibling;
      while (nx && nx.hidden) nx = nx.nextElementSibling;
      if (nx) nx.querySelector(`[name=${e.target.name}]`).focus();
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const all = el.querySelector("[data-loc]").value;
      const items = filled().map((r) => ({ product_id: r.dataset.id, qty: r.querySelector("[name=qty]").value, expires_at: r.querySelector("[name=expires_at]").value,
        location_id: r.querySelector("[name=location_id]").value || all, unit_price: r.querySelector("[name=unit_price]").value }));
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        const res = await EA.post("/api/bulk-entry", { items });
        EA.toast(res.created + " entrada(s) registrada(s).");
        if (await EA.confirm("Imprimir etiquetas?", "Deseja imprimir as etiquetas dos " + res.created + " lote(s) lançados?", "Ir para etiquetas")) return EA.go("#/etiquetas/" + res.lot_ids.map((i) => "L:" + i).join(","));
        EA.go("#/produtos");
      } catch (err) { EA.toast(err.message, true); btn.disabled = false; }
    });
  };

  // ============================================================ MOVIMENTAÇÕES
  V.movimentacoes = async function (el) {
    const prods = await EA.get("/api/products");
    el.innerHTML = `<div class="page-head"><div><h1>Movimentações</h1><div class="sub">Histórico completo e protegido: registros não podem ser alterados nem apagados — correções são feitas por estorno.</div></div>
      <div class="actions"><button class="btn" data-new>Nova movimentação</button></div></div>
      <div class="filters">
        <label class="f">Produto<select data-f="product_id"><option value="">— todos —</option>${prods.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
        <label class="f">Tipo<select data-f="type"><option value="">— todos —</option>${Object.entries(EA.boot.movement_types).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label>
        <label class="f">Categoria<select data-f="category_id">${EA.catOptions("", { withSubs: true })}</select></label>
        <label class="f">Local<select data-f="location_id">${EA.locOptions("", "— todos —")}</select></label>
        <label class="f">De<input type="date" data-f="date_from"></label><label class="f">Até<input type="date" data-f="date_to"></label>
        <label class="f">Responsável<input data-f="responsible"></label>
        <a class="btn ghost" data-pdf target="_blank">PDF</a><a class="btn ghost" data-xlsx>Excel</a><a class="btn ghost" data-csv>CSV</a>
      </div><div data-list></div>`;
    const getF = () => { const f = {}; el.querySelectorAll("[data-f]").forEach((i) => (f[i.dataset.f] = i.value)); return f; };
    const load = async () => {
      const f = getF();
      const rows = await EA.get("/api/movements" + EA.qs(Object.assign({ limit: 1000 }, f)));
      el.querySelector("[data-list]").innerHTML = EA.movTable(rows);
      EA.bindMovActions(el, load);
      const clean = {}; Object.entries(f).forEach(([k, v]) => { if (v) clean[k] = v; });
      el.querySelector("[data-pdf]").href = EA.url("/relatorio", Object.assign({ tipo: "movimentacoes", formato: "pdf" }, clean));
      el.querySelector("[data-xlsx]").href = EA.url("/relatorio", Object.assign({ tipo: "movimentacoes", formato: "xlsx" }, clean));
      el.querySelector("[data-csv]").href = EA.url("/relatorio", Object.assign({ tipo: "movimentacoes", formato: "csv" }, clean));
    };
    el.querySelectorAll("[data-f]").forEach((i) => i.addEventListener("change", load));
    el.querySelector("[data-new]").onclick = () => {
      EA.modal({
        title: "Nova movimentação", size: "narrow", okLabel: "Continuar",
        body: `<form class="form"><label class="fld s12"><span>Produto</span><select name="pid">${prods.filter((p) => p.active).map((p) => `<option value="${p.id}">${esc(p.name)} — ${EA.qty(p.qty, p.unit)}</option>`).join("")}</select></label>
          <p class="help">Para entradas (compra/doação), use “Entrada” na ficha do produto — cada entrada gera um lote rastreável.</p>
          <div class="fld s12" style="flex-direction:row;gap:8px"><button type="button" class="btn ghost" data-entry>Entrada (novo lote)</button><button type="button" class="btn ghost" data-cons>Consumo FEFO</button></div></form>`,
        onOpen: (m) => {
          const pick = () => prods.find((p) => p.id == m.querySelector("[name=pid]").value);
          m.querySelector("[data-entry]").onclick = async () => { const p = pick(); m.close(); EA.entryForm((await EA.get("/api/products/" + p.id)).product, load); };
          m.querySelector("[data-cons]").onclick = async () => { const p = pick(); m.close(); EA.consumeForm((await EA.get("/api/products/" + p.id)).product, load); };
        },
        onOk: async (m) => {
          const d = await EA.get("/api/products/" + m.querySelector("[name=pid]").value);
          setTimeout(() => EA.movementForm({ product: d.product, lots: d.lots }, load), 10);
        },
      });
    };
    await load();
  };

  // ============================================================ VALIDADE
  V.validade = async function (el) {
    el.innerHTML = `<div class="page-head"><div><h1>Controle de validade</h1><div class="sub">Ordem de uso pelo método FEFO (primeiro a vencer, primeiro a sair).</div></div>
      <div class="actions"><a class="btn ghost" data-pdf target="_blank">Imprimir / PDF</a><a class="btn ghost" data-xlsx>Excel</a></div></div>
      <div class="buckets" data-buckets></div>
      <div class="filters"><label class="f">Categoria<select data-f="category_id">${EA.catOptions("", { withSubs: true })}</select></label>
        <label class="f">Local<select data-f="location_id">${EA.locOptions("", "— todos —")}</select></label>
        <label class="f">Lote<input data-f="lot" placeholder="código ou nº"></label>
        <label class="f">Vence em até (dias)<input data-f="within_days" inputmode="numeric" style="width:110px"></label>
        <label class="f" style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-f="include_no_expiry"> incluir itens sem validade</label></div>
      <div data-list></div>`;
    let status = "";
    const load = async () => {
      const f = { status };
      el.querySelectorAll("[data-f]").forEach((i) => (f[i.dataset.f] = i.type === "checkbox" ? (i.checked ? "1" : "") : i.value));
      const d = await EA.get("/api/expiry" + EA.qs(f));
      const lab = { vencido: "Vencidos" };
      d.alert_days.forEach((a) => (lab["vence_" + a] = "Vencem em até " + a + " dias"));
      el.querySelector("[data-buckets]").innerHTML = `<button data-st="" class="${status ? "" : "on"}"><b>${d.rows.length}</b>Todos (filtro atual)</button>` +
        Object.entries(d.buckets).map(([k, v]) => `<button data-st="${k}" class="${status === k ? "on" : ""}"><b style="color:${k === "vencido" ? "var(--red)" : v ? "var(--amber)" : "inherit"}">${v}</b>${lab[k]}</button>`).join("");
      el.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { status = b.dataset.st; load(); }));
      const rows = d.rows;
      el.querySelector("[data-list]").innerHTML = rows.length ? `<div class="table-wrap tall"><table class="t"><thead><tr><th>Produto</th><th>Ordem FEFO</th><th>Item</th><th>Lote</th><th class="n">Quantidade</th><th>Validade</th><th>Situação</th><th>Local</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="click ${r.status === "vencido" ? "st-vencido" : r.status.startsWith("vence_") ? "st-vencendo" : ""}" data-href="#/${r.kind === "lote" ? "lote" : "recipiente"}/${r.id}">
          <td><b>${esc(r.product_name)}</b><div class="small muted">${esc(r.category_name || "")}</div></td><td>${r.fefo_rank ? r.fefo_rank + "º" : '<span class="badge b-red">descartar</span>'}</td>
          <td class="mono small">${esc(r.code)}</td><td>${esc(r.lot_number || r.lot_code)}</td><td class="n">${EA.qty(r.qty, r.unit)}</td><td>${EA.date(r.expires_at)}</td><td>${EA.expiryBadge(r.status, r.days)}</td><td class="small">${esc(r.location_path)}</td>
          <td>${r.status === "vencido" ? `<button class="btn sm ghost" data-baixa="${r.kind}:${r.id}:${r.product_id}">Dar baixa</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : '<div class="panel empty">Nenhum item neste filtro.</div>';
      EA.bindRowLinks(el.querySelector("[data-list]"));
      el.querySelectorAll("[data-baixa]").forEach((b) => b.addEventListener("click", async (e) => {
        e.stopPropagation();
        const [kind, iid, pid] = b.dataset.baixa.split(":");
        const pd = await EA.get("/api/products/" + pid);
        const it = rows.find((r) => r.kind === kind && r.id == iid);
        const ctx = { product: pd.product, type: "VENCIMENTO" };
        if (kind === "lote") ctx.lot = pd.lots.find((l) => l.id == iid); else ctx.container = Object.assign({ qty: it.qty }, it, { id: Number(iid) });
        EA.movementForm(ctx, load);
      }));
      const clean = {}; Object.entries(f).forEach(([k, v]) => { if (v) clean[k] = v; });
      el.querySelector("[data-pdf]").href = EA.url("/relatorio", Object.assign({ tipo: "validade", formato: "pdf" }, clean));
      el.querySelector("[data-xlsx]").href = EA.url("/relatorio", Object.assign({ tipo: "validade", formato: "xlsx" }, clean));
    };
    el.querySelectorAll("[data-f]").forEach((i) => i.addEventListener("change", load));
    await load();
  };

  // ============================================================ QR CODES E ETIQUETAS
  V.etiquetas = async function (el, preset) {
    const [prods, lots] = await Promise.all([EA.get("/api/products"), EA.get("/api/lots")]);
    const sel = new Set((preset || "").split(",").filter(Boolean));
    const label = (k, txt, sub) => `<label style="display:flex;gap:8px;align-items:center;padding:3px 0"><input type="checkbox" value="${k}" ${sel.has(k) ? "checked" : ""}> <span>${txt}</span> <span class="small muted">${sub || ""}</span></label>`;
    el.innerHTML = `<div class="page-head"><div><h1>QR Codes e etiquetas</h1><div class="sub">Os códigos contêm apenas o identificador interno (ex.: EA-R-000012) e são lidos neste computador, sem internet.</div></div></div>
      <div class="grid g-wide"><section class="panel"><div class="panel-head"><h2>Escolha as etiquetas</h2><div class="actions">
          <input data-q placeholder="filtrar" style="width:160px"><button class="btn sm ghost" data-all>Marcar visíveis</button><button class="btn sm ghost" data-none>Limpar</button></div></div>
        <div data-items style="max-height:58vh;overflow:auto;columns:2 280px">
          <h3>Produtos</h3>${prods.map((p) => label("P:" + p.id, esc(p.name), p.code)).join("")}
          <h3 style="margin-top:10px">Lotes e recipientes</h3>${lots.map((l) => label("L:" + l.id, esc(l.product_name) + " — lote " + esc(l.lot_number || l.code), l.code) + l.containers.map((c) => label("R:" + c.id, "&nbsp;&nbsp;↳ " + esc(c.label || c.code), c.code + " · " + EA.num(c.qty) + " " + esc(l.unit))).join("")).join("")}
          <h3 style="margin-top:10px">Locais</h3>${EA.boot.locations.filter((l) => l.active).map((l) => label("LOC:" + l.id, esc(l.path), l.code)).join("")}
        </div></section>
        <section class="panel"><h2>Impressão</h2><form class="form" data-opts>
          <label class="fld s12"><span>Modelo</span><select name="modelo">
            <option value="a4_3x8">Folha A4 — 3×8 (70×37 mm, 24 por folha)</option><option value="a4_2x7">Folha A4 — 2×7 (99×38 mm, 14 por folha)</option>
            <option value="a4_4x10">Folha A4 — 4×10 (48×25 mm, 40 por folha)</option><option value="62x40">Etiqueta térmica 62×40 mm (uma por página)</option>
            <option value="50x30">Etiqueta térmica 50×30 mm</option><option value="100x50">Etiqueta térmica 100×50 mm</option></select></label>
          <label class="fld s6"><span>Cópias de cada</span><input name="copias" value="1" inputmode="numeric"></label>
          <label class="fld s6"><span>Pular posições (folha já usada)</span><input name="pular" value="0" inputmode="numeric"></label></form>
          <p class="small muted" data-count></p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" data-print>Visualizar e imprimir</button><button class="btn ghost" data-pdf>Gerar PDF</button></div>
          <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
          <h3>Testar leitura</h3><p class="small muted">Leitor USB: clique no campo de leitura no topo (ou pressione F2) e leia a etiqueta. Câmera: use o botão abaixo.</p>
          <button class="btn ghost" data-cam>Ler pela câmera</button>
          <p class="small muted" style="margin-top:12px">Etiqueta perdida? Basta marcar o item novamente e imprimir: o código é sempre o mesmo.</p></section></div>`;
    const items = el.querySelector("[data-items]");
    const chosen = () => Array.from(items.querySelectorAll("input:checked")).map((i) => i.value);
    const count = () => (el.querySelector("[data-count]").textContent = chosen().length + " item(ns) selecionado(s).");
    items.addEventListener("change", count);
    count();
    el.querySelector("[data-q]").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      items.querySelectorAll("label").forEach((l) => (l.style.display = !q || l.textContent.toLowerCase().includes(q) ? "flex" : "none"));
    });
    el.querySelector("[data-all]").onclick = () => { items.querySelectorAll("label").forEach((l) => { if (l.style.display !== "none") l.querySelector("input").checked = true; }); count(); };
    el.querySelector("[data-none]").onclick = () => { items.querySelectorAll("input").forEach((i) => (i.checked = false)); count(); };
    const open = (fmt) => {
      const c = chosen();
      if (!c.length) return EA.toast("Selecione ao menos um item.", true);
      const o = EA.formData(el.querySelector("[data-opts]"));
      const u = EA.url("/etiquetas", Object.assign({ items: c.join(","), formato: fmt }, o));
      EA.openUrl(fmt === "html" ? u + "#imprimir" : u, true);
    };
    el.querySelector("[data-print]").onclick = () => open("html");
    el.querySelector("[data-pdf]").onclick = () => open("pdf");
    el.querySelector("[data-cam]").onclick = () => EA.cameraScan((code) => EA.openCode(code));
  };

  // ============================================================ REVISÃO PERIÓDICA
  V.revisao = async function (el) {
    const d = await EA.get("/api/review");
    el.innerHTML = `<div class="page-head"><div><h1>Revisão periódica</h1><div class="sub">Confira fisicamente quantidades e validades. Informe apenas o que contou; diferenças viram ajustes de inventário registrados no histórico.</div></div>
      <div class="actions"><a class="btn ghost" target="_blank" href="${EA.url("/relatorio", { tipo: "revisao" })}">Imprimir folha de contagem</a></div></div>
      ${d.history.length ? `<p class="small muted">Últimas revisões: ${d.history.map((h) => EA.date(h.ts) + " (" + esc(h.responsible) + ", " + h.adjustments + " ajuste(s))").join(" · ")}</p>` : ""}
      ${d.rows.length ? `<form data-form><div class="table-wrap tall"><table class="t"><thead><tr><th>Local</th><th>Produto</th><th>Item</th><th class="n">No sistema</th><th>Validade</th><th style="width:140px">Contado</th></tr></thead><tbody>
        ${d.rows.map((r, i) => `<tr class="${r.status === "vencido" ? "st-vencido" : ""}"><td class="small">${esc(r.location_path || "—")}</td><td><b>${esc(r.product_name)}</b></td><td class="mono small">${esc(r.code)}</td>
          <td class="n">${EA.qty(r.qty, r.unit)}</td><td>${EA.date(r.expires_at)} ${EA.expiryBadge(r.status, r.days)}</td>
          <td><input data-i="${i}" inputmode="decimal" placeholder="${EA.num(r.qty)}" style="width:120px"></td></tr>`).join("")}</tbody></table></div>
        <div class="panel" style="margin-top:12px"><div class="form"><label class="fld s8"><span>Observações da revisão</span><input name="notes"></label>${EA.respField()}</div>
          <div style="margin-top:10px;display:flex;gap:8px"><button class="btn ok" type="submit">Concluir revisão</button><span class="small muted">Itens sem contagem informada são considerados conferidos sem diferença.</span></div></div></form>`
        : '<div class="panel empty">Nada em estoque para revisar.</div>'}`;
    const f = el.querySelector("[data-form]");
    if (!f) return;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const counts = d.rows.map((r, i) => ({ lot_id: r.lot_id, container_id: r.container_id, counted: f.querySelector(`[data-i="${i}"]`).value ? EA.parseNum(f.querySelector(`[data-i="${i}"]`).value) : "" }));
      const resp = f.querySelector("[name=responsible]").value;
      EA.rememberResponsible(resp);
      try {
        const r = await EA.post("/api/review", { counts, notes: f.querySelector("[name=notes]").value, responsible: resp });
        EA.toast("Revisão concluída: " + r.adjustments + " ajuste(s) registrado(s).");
        EA.go("#/dashboard");
      } catch (err) { EA.toast(err.message, true); }
    });
  };
})();
