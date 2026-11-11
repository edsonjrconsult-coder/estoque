/* Consumo e autonomia, planejamento por pessoa, compras e modo de emergência. */
(function () {
  "use strict";
  const EA = window.EA, esc = EA.esc, V = EA.views;

  // ============================================================ CONSUMO E AUTONOMIA
  V.consumo = async function (el) {
    const people0 = EA.boot.settings.people;
    el.innerHTML = `<div class="page-head"><div><h1>Consumo e autonomia</h1>
      <div class="sub">Autonomia efetiva = quanto tempo o estoque dura consumindo pelo FEFO e descontando o que vencer antes de ser usado.</div></div>
      <div class="actions"><a class="btn ghost" data-pdf target="_blank">PDF</a><a class="btn ghost" data-xlsx>Excel</a></div></div>
      <div class="filters"><label class="f">Pessoas atendidas (cenário)<input data-people type="number" min="1" value="${esc(people0)}" style="width:120px"></label>
        <span class="small muted" style="align-self:center">Altere para simular; o padrão da residência é ${esc(people0)} (em Configurações).</span></div>
      <div data-out></div>`;
    const load = async () => {
      const ppl = el.querySelector("[data-people]").value;
      const d = await EA.get("/api/autonomy" + EA.qs({ people: ppl }));
      const rows = d.rows;
      const hs = rows.length ? Object.keys(rows[0].need).map(Number).sort((a, b) => a - b) : [];
      const hShow = hs.filter((h) => [30, 60, 90, 180].includes(h));
      el.querySelector("[data-out]").innerHTML = `
        <div class="gauges">${d.groups.filter((g) => g.products).map((g) => `<div class="gauge ${EA.daysClass(g.min_days, 90)}"><div class="v">${g.min_days === null ? "—" : EA.num(Math.floor(g.min_days), 0) + " d"}</div><div class="l">${esc(g.label)}${g.limiting ? " · limitado por " + esc(g.limiting) : ""}</div></div>`).join("")}</div>
        <div class="table-wrap tall"><table class="t"><thead><tr><th>Produto</th><th>Consumo cadastrado</th><th class="n">Por dia</th><th class="n">Por semana</th><th class="n">Por mês</th><th class="n">Disponível</th>
          <th class="n">Autonomia</th><th>Esgota em</th>${hShow.map((h) => `<th class="n">Para ${h} dias</th>`).join("")}<th class="n">Perda p/ venc.</th></tr></thead><tbody>
          ${rows.map((r) => `<tr class="click ${r.daily_rate > 0 && r.autonomy_days < 30 ? "st-vencido" : r.daily_rate > 0 && r.autonomy_days < r.target_days ? "st-baixo" : r.daily_rate > 0 ? "st-adequado" : ""}" data-href="#/produto/${r.product_id}">
            <td><b>${esc(r.name)}</b><div class="small muted">${esc(r.category_name || "")}${r.critical ? " · crítico" : ""}${r.has_rule ? " · regra não linear" : ""}</div></td>
            <td class="small">${r.cons_mode === "nenhum" ? (r.observed_rate > 0 ? "pelo histórico" : '<span class="muted">não cadastrado</span>') : EA.num(r.cons_qty) + " " + esc(r.unit) + (r.cons_mode === "por_pessoa" ? "/pessoa" : "") + "/" + ({ dia: "dia", semana: "semana", mes: "mês", intervalo: "intervalo" }[r.cons_period])}
              ${r.observed_rate > 0 ? `<div class="muted">observado: ${EA.num(r.observed_rate)}/dia</div>` : ""}</td>
            <td class="n">${EA.num(r.daily_rate)}</td><td class="n">${EA.num(r.weekly_rate)}</td><td class="n">${EA.num(r.monthly_rate)}</td>
            <td class="n">${EA.qty(r.available, r.unit)}</td><td class="n"><b>${r.daily_rate > 0 ? EA.days(r.autonomy_days, r.autonomy_capped) : "—"}</b></td>
            <td>${EA.date(r.depletion_date)}</td>
            ${hShow.map((h) => { const b = r.balance[h]; return `<td class="n">${r.daily_rate > 0 ? `${EA.num(r.need[h])}<div class="small ${b < 0 ? "" : "muted"}">${b < 0 ? `<span class="badge b-red">falta ${EA.num(-b)}</span>` : "sobra " + EA.num(b)}</div>` : "—"}</td>`; }).join("")}
            <td class="n">${r.lost_by_expiry > 0 ? `<span class="badge b-red">${EA.num(r.lost_by_expiry)}</span>` : ""}</td></tr>`).join("")}
        </tbody></table></div>
        <p class="small muted">Para cadastrar regras específicas (fases, sazonalidade mensal, reserva intocável, consumo a cada N dias), edite o produto em “Consumo planejado”.
        A base da previsão (planejado, histórico ou o maior dos dois) é definida em Configurações.</p>`;
      EA.bindRowLinks(el);
      el.querySelector("[data-pdf]").href = EA.url("/relatorio", { tipo: "autonomia", formato: "pdf", people: ppl });
      el.querySelector("[data-xlsx]").href = EA.url("/relatorio", { tipo: "autonomia", formato: "xlsx", people: ppl });
    };
    el.querySelector("[data-people]").addEventListener("change", load);
    await load();
  };

  // ============================================================ PLANEJAMENTO POR PESSOA
  V.pessoas = async function (el) {
    el.innerHTML = `<div class="page-head"><div><h1>Planejamento por pessoa</h1><div class="sub">Compare quanto o estoque dura e quanto comprar conforme o número de pessoas abastecidas.</div></div>
      <div class="actions"><a class="btn ghost" data-pdf target="_blank">PDF</a><a class="btn ghost" data-xlsx>Excel</a></div></div>
      <div class="filters"><label class="f">Cenários (nº de pessoas, separados por vírgula)<input data-list value="${esc(EA.boot.settings.people_scenarios || "10,15,18")}" style="width:220px"></label>
        <button class="btn ghost" data-go>Comparar</button><button class="btn ghost" data-save>Salvar como padrão</button>
        <button class="btn" data-calc style="margin-left:auto">Calculadora de comida por pessoa</button></div><div data-out></div>`;
    const load = async () => {
      const lst = el.querySelector("[data-list]").value.replace(/\s/g, "");
      const d = await EA.get("/api/people" + EA.qs({ list: lst }));
      const ps = d.people;
      const out = el.querySelector("[data-out]");
      if (!d.rows.length) { out.innerHTML = '<div class="panel empty">Cadastre o consumo dos produtos (por pessoa ou total) para comparar cenários.</div>'; return; }
      out.innerHTML = `
        <div class="grid" style="grid-template-columns:repeat(${ps.length},minmax(0,1fr));margin-bottom:16px">${d.summary.map((s) => `<section class="panel">
          <h2>${s.people} pessoas</h2><p class="muted small">Autonomia geral: <b style="font-size:16px;color:var(--ink)">${s.overall.days === null ? "—" : EA.days(s.overall.days, s.overall.capped)}</b>${s.overall.limiting ? " (limitada por " + esc(s.overall.limiting) + ")" : ""}</p>
          <div class="table-wrap"><table class="t">${s.groups.filter((g) => g.with_consumption).map((g) => `<tr><td>${esc(g.label)}</td><td class="n"><b>${EA.days(g.min_days)}</b></td></tr>`).join("")}</table></div></section>`).join("")}</div>
        ${d.per_category.length ? `<section class="panel"><h2>Consumo estimado por pessoa e por categoria</h2><div class="table-wrap"><table class="t"><thead><tr><th>Categoria</th><th class="n">Por pessoa/dia</th>${ps.map((n) => `<th class="n">${n} pessoas/dia</th><th class="n">${n} pessoas/mês</th>`).join("")}</tr></thead><tbody>
          ${d.per_category.map((c) => `<tr><td>${esc(c.category)}</td><td class="n">${EA.qty(c.per_person_day, c.unit)}</td>${ps.map((n) => `<td class="n">${EA.qty(c.by_people[n], c.unit)}</td><td class="n">${EA.qty(c.by_people[n] * 30.4375, c.unit)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
          <p class="small muted">Somado por unidade de medida (só produtos com consumo “por pessoa”).</p></section>` : ""}
        <section class="panel"><h2>Autonomia e compras por produto</h2><div class="table-wrap tall"><table class="t"><thead><tr><th>Produto</th><th class="n">Estoque</th><th class="n">Por pessoa/dia</th>
          ${ps.map((n) => `<th class="n">${n} p.: dura</th><th class="n">${n} p.: comprar p/ 90 d</th><th class="n">${n} p.: comprar p/ 180 d</th>`).join("")}</tr></thead><tbody>
          ${d.rows.map((r) => `<tr class="click" data-href="#/produto/${r.id}"><td><b>${esc(r.name)}</b><div class="small muted">${r.cons_mode === "total" ? "consumo total (não varia com pessoas)" : esc(r.category_name || "")}</div></td>
            <td class="n">${EA.qty(r.qty, r.unit)}</td><td class="n">${r.per_person_day ? EA.num(r.per_person_day) : "—"}</td>
            ${ps.map((n) => { const s = r.scenarios[n]; return `<td class="n"><b>${EA.days(s.days, s.capped)}</b></td><td class="n">${s.buy[90] !== undefined ? EA.num(s.buy[90]) : "—"}</td><td class="n">${s.buy[180] !== undefined ? EA.num(s.buy[180]) : "—"}</td>`; }).join("")}</tr>`).join("")}
          </tbody></table></div></section>`;
      EA.bindRowLinks(out);
      el.querySelector("[data-pdf]").href = EA.url("/relatorio", { tipo: "pessoas", formato: "pdf", people_list: lst });
      el.querySelector("[data-xlsx]").href = EA.url("/relatorio", { tipo: "pessoas", formato: "xlsx", people_list: lst });
    };
    el.querySelector("[data-go]").onclick = load;
    el.querySelector("[data-calc]").onclick = () => EA.portionCalc({ onSaved: load });
    el.querySelector("[data-list]").addEventListener("change", load);
    el.querySelector("[data-save]").onclick = async () => {
      await EA.put("/api/settings", { values: { people_scenarios: el.querySelector("[data-list]").value } });
      await EA.reloadBoot();
      EA.toast("Cenários salvos como padrão.");
    };
    await load();
  };

  // ============================================================ COMPRAS E REPOSIÇÃO
  V.compras = async function (el) {
    el.innerHTML = `<div class="page-head"><div><h1>Compras e reposição</h1><div class="sub">Quanto comprar para manter a autonomia desejada, somando o estoque de segurança e respeitando mínimo e máximo.</div></div>
      <div class="actions"><a class="btn ghost" data-pdf target="_blank">Imprimir lista</a><a class="btn ghost" data-xlsx>Excel</a><a class="btn ghost" data-csv>CSV</a></div></div>
      <div class="filters"><label class="f">Manter autonomia de (dias)<select data-t><option value="">meta de cada produto</option>${[30, 60, 90, 180, 365].map((d) => `<option value="${d}">${d} dias</option>`).join("")}</select></label>
        <label class="f">Pessoas<input data-p type="number" min="1" value="${esc(EA.boot.settings.people)}" style="width:100px"></label>
        <label class="f" style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-all> mostrar também os que não precisam de compra</label></div>
      <div data-out></div>`;
    const load = async () => {
      const t = el.querySelector("[data-t]").value, p = el.querySelector("[data-p]").value;
      const d = await EA.get("/api/purchase" + EA.qs({ target_days: t, people: p, all: el.querySelector("[data-all]").checked ? 1 : "" }));
      el.querySelector("[data-out]").innerHTML = d.rows.length ? `<div class="table-wrap tall"><table class="t"><thead><tr><th>Produto</th><th class="n">Em estoque</th><th class="n">Consumo/dia</th><th class="n">Autonomia</th>
        <th class="n">Meta</th><th class="n">Necessário</th><th class="n">Mín. / seg. / máx.</th><th class="n">Comprar</th><th>Motivo</th><th class="n">Custo est.</th></tr></thead><tbody>
        ${d.rows.map((r) => `<tr class="click ${r.buy > 0 ? "st-baixo" : "st-adequado"}" data-href="#/produto/${r.id}"><td><b>${esc(r.name)}</b><div class="small muted">${esc(r.category_name || "")}</div></td>
          <td class="n">${EA.qty(r.available, r.unit)}</td><td class="n">${EA.num(r.daily_rate)}</td><td class="n">${r.daily_rate > 0 ? EA.days(r.autonomy_days, r.autonomy_capped) : "—"}</td>
          <td class="n">${r.target_days} d</td><td class="n">${EA.num(r.need)}</td><td class="n small">${EA.num(r.min_qty)} / ${EA.num(r.safety_qty)} / ${r.max_qty === null ? "—" : EA.num(r.max_qty)}</td>
          <td class="n"><b style="font-size:15px">${EA.qty(r.buy, r.unit)}</b></td><td class="small">${esc(r.reasons.join(", "))}${r.capped_by_max ? ' <span class="badge b-blue">limitado ao máximo</span>' : ""}${r.lost_by_expiry > 0 ? `<div class="muted">inclui reposição de ${EA.num(r.lost_by_expiry)} que vencerá</div>` : ""}</td>
          <td class="n">${r.last_price ? EA.money(r.estimated_cost) : '<span class="muted">sem preço</span>'}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="9" class="right"><b>Custo total estimado</b></td><td class="n"><b>${EA.money(d.total_cost)}</b></td></tr></tfoot></table></div>`
        : '<div class="panel empty">Nenhuma compra necessária para esta meta. 👍</div>';
      EA.bindRowLinks(el);
      const q = { target_days: t, people: p };
      ["pdf", "xlsx", "csv"].forEach((f) => (el.querySelector("[data-" + f + "]").href = EA.url("/relatorio", Object.assign({ tipo: "compras", formato: f }, q))));
    };
    el.querySelectorAll("[data-t],[data-p],[data-all]").forEach((i) => i.addEventListener("change", load));
    await load();
  };

  // ============================================================ MODO DE EMERGÊNCIA
  const EM_GROUPS = ["agua", "alimentos", "medicamentos", "higiene", "limpeza", "agricola", "outros"];
  V.emergencia = async function (el) {
    let st = { target_days: EA.boot.settings.emergency_target_days || 90, people: EA.boot.settings.people, global: 0, red: {} };
    try { const s = JSON.parse(sessionStorage.getItem("ea_em") || "null"); if (s) st = Object.assign(st, s); } catch (e) { /* sem armazenamento */ }
    el.innerHTML = `<div class="hazard" aria-hidden="true"></div>
      <div class="em-title"><div><h1>Modo de emergência</h1><p>Estoque disponível, autonomia por categoria e o que economizar. Tudo calculado neste aparelho, sem internet.</p></div>
        <div class="actions"><a class="btn emergency-btn" data-print target="_blank">Imprimir inventário de emergência</a><a class="btn ghost" data-pdf>PDF</a><a class="btn ghost" href="#/dashboard">Sair do modo de emergência</a></div></div>
      <div class="em-groups" data-groups></div>
      <section class="em-panel"><h2>Simular redução do consumo</h2>
        <div class="em-sim" data-sim>
          <label>Meta de duração (dias)<input type="number" min="1" data-k="target_days" value="${esc(st.target_days)}" style="width:100%"></label>
          <label>Pessoas<input type="number" min="1" data-k="people" value="${esc(st.people)}" style="width:100%"></label>
          <label>Redução geral <output data-o="global">${st.global}%</output><input type="range" min="0" max="90" step="5" data-k="global" value="${st.global}"></label>
          ${EM_GROUPS.slice(0, 4).map((g) => `<label>${esc(EA.boot.groups[g])} <output data-o="${g}">${st.red[g] || 0}%</output><input type="range" min="0" max="90" step="5" data-g="${g}" value="${st.red[g] || 0}"></label>`).join("")}
        </div>
        <p class="small" style="color:#b6c2c9;margin:10px 0 0">Projeções de cobertura para 30, 60, 90 e 180 dias aparecem em cada categoria acima. <button class="link" data-reset style="color:#e8b500">Zerar simulação</button></p></section>
      <section class="em-panel"><h2>Estoque disponível por prioridade</h2><div style="overflow-x:auto" data-table></div></section>`;
    const load = async () => {
      try { sessionStorage.setItem("ea_em", JSON.stringify(st)); } catch (e) { /* ignore */ }
      const d = await EA.post("/api/emergency", { reductions: st.red, global_reduction: st.global, target_days: st.target_days, people: st.people });
      const covCls = (v) => (v === null ? "cov-na" : v >= 0.999 ? "cov-ok" : v >= 0.6 ? "cov-mid" : "cov-bad");
      el.querySelector("[data-groups]").innerHTML = d.groups.filter((g) => g.products).map((g) => {
        const cls = g.min_days === null ? "none" : g.min_days < 30 ? "red" : g.min_days < d.target_days ? "amber" : "";
        return `<div class="em-g ${cls}"><h3>${esc(g.label)}</h3><div class="d">${g.min_days === null ? "—" : g.min_days >= 3650 ? "10+<small>anos</small>" : EA.num(Math.floor(g.min_days), 0) + "<small>dias</small>"}</div>
          <div class="lim">${g.limiting ? "limitado por " + esc(g.limiting) : g.with_consumption ? "" : "consumo não cadastrado"}</div>
          <div class="cov">${d.horizons.map((h) => `<div>${h}d<span class="${covCls(g.coverage[h])}">${g.coverage[h] === null ? "—" : Math.round(g.coverage[h] * 100) + "%"}</span></div>`).join("")}</div></div>`;
      }).join("") || '<div class="em-g none"><h3>Sem dados</h3><div class="lim">Cadastre produtos e consumo.</div></div>';
      let curG = null;
      el.querySelector("[data-table]").innerHTML = `<table class="em-table"><thead><tr><th>Produto</th><th class="n">Disponível</th><th class="n">Consumo/dia</th><th class="n">Dura</th><th>Usar primeiro</th><th>Próx. validade</th><th>Economizar</th></tr></thead><tbody>
        ${d.rows.map((r) => { let h = ""; if (r.grupo !== curG) { curG = r.grupo; h = `<tr class="grp"><td colspan="7">${esc(EA.boot.groups[r.grupo] || r.grupo)}</td></tr>`; }
          return h + `<tr><td><a href="#/produto/${r.id}" style="color:#fff">${esc(r.name)}</a></td><td class="n">${EA.qty(r.available, r.unit)}</td><td class="n">${EA.num(r.daily_rate)}</td>
            <td class="n"><b>${r.daily_rate > 0 ? EA.days(r.autonomy_days, r.autonomy_capped) : "—"}</b></td><td class="small">${r.fefo_first ? esc(r.fefo_first) + "<br>" + esc(r.fefo_location || "") : "—"}</td><td>${EA.date(r.next_expiry)}</td>
            <td>${r.expiry_limited ? '<span class="eco">vence antes da meta — use primeiro</span>' : r.required_reduction ? `<span class="eco">reduzir ${Math.round(r.required_reduction * 100)}%</span>` : r.daily_rate > 0 ? '<span class="okk">não</span>' : ""}</td></tr>`; }).join("")}
        </tbody></table>${d.economize.length ? `<p style="color:#ff8a80;margin-top:10px"><b>${d.economize.length} produto(s) precisam ser economizados</b> para alcançar ${d.target_days} dias.</p>` : `<p class="okk" style="color:#8fd6a8;margin-top:10px">Nenhum produto precisa ser economizado para a meta de ${d.target_days} dias.</p>`}`;
      const q = { tipo: "emergencia", target_days: st.target_days, people: st.people, global_reduction: st.global };
      Object.entries(st.red).forEach(([k, v]) => { if (v) q["red_" + k] = v; });
      el.querySelector("[data-print]").href = EA.url("/relatorio", q);
      el.querySelector("[data-pdf]").href = EA.url("/relatorio", Object.assign({ formato: "pdf" }, q));
    };
    let t;
    const sched = () => { clearTimeout(t); t = setTimeout(load, 150); };
    el.querySelectorAll("[data-sim] input").forEach((i) => i.addEventListener("input", () => {
      if (i.dataset.g) { st.red[i.dataset.g] = Number(i.value); el.querySelector(`[data-o="${i.dataset.g}"]`).textContent = i.value + "%"; }
      else if (i.dataset.k === "global") { st.global = Number(i.value); el.querySelector('[data-o="global"]').textContent = i.value + "%"; }
      else st[i.dataset.k] = i.value;
      sched();
    }));
    el.querySelector("[data-reset]").onclick = () => { try { sessionStorage.removeItem("ea_em"); } catch (e) { /* ignore */ } V.emergencia(el); };
    await load();
  };
})();
