/* Relatórios, backup e configurações. */
(function () {
  "use strict";
  const EA = window.EA, esc = EA.esc, V = EA.views;

  // ============================================================ RELATÓRIOS
  const REPORTS = [
    ["estoque", "Posição do estoque", "categoria, produto, local"], ["lotes", "Lotes e recipientes", "categoria, produto, lote, local"],
    ["validade", "Controle de validade (FEFO)", "categoria, lote, local, prazo"], ["movimentacoes", "Movimentações", "período, produto, categoria, local"],
    ["autonomia", "Consumo e autonomia", "categoria, pessoas"], ["compras", "Lista de compras", "meta de dias, pessoas"],
    ["pessoas", "Planejamento por pessoa", "cenários"], ["emergencia", "Inventário de emergência (para guardar impresso)", "pessoas, meta"],
    ["mapa", "Mapa de armazenamento", ""], ["revisao", "Folha de contagem (revisão periódica)", ""], ["auditoria", "Trilha de auditoria", ""],
  ];
  const FILTERS = {
    estoque: ["category_id", "product_id", "location_id"], lotes: ["category_id", "product_id", "lot", "location_id"],
    validade: ["category_id", "location_id", "lot", "within_days"], movimentacoes: ["product_id", "category_id", "location_id", "date_from", "date_to", "type"],
    autonomia: ["category_id", "people"], compras: ["target_days", "people"], pessoas: ["people_list"], emergencia: ["people", "target_days"],
    mapa: [], revisao: [], auditoria: [],
  };
  V.relatorios = async function (el) {
    const prods = await EA.get("/api/products");
    el.innerHTML = `<div class="page-head"><div><h1>Relatórios</h1><div class="sub">Visualize, imprima ou exporte em PDF, Excel e CSV. Tudo gerado localmente.</div></div>
      <div class="actions"><a class="btn ghost" href="${EA.url("/exportar/planilha-completa")}">Planilha completa (Excel)</a></div></div>
      <div class="grid" style="grid-template-columns:minmax(260px,320px) 1fr">
        <section class="panel"><h3>Relatório</h3><div data-types style="display:flex;flex-direction:column;gap:2px;margin-top:8px">
          ${REPORTS.map((r, i) => `<label style="display:flex;gap:8px;padding:5px 0;cursor:pointer"><input type="radio" name="rt" value="${r[0]}" ${i === 0 ? "checked" : ""}><span>${esc(r[1])}${r[2] ? `<div class="small muted">filtros: ${esc(r[2])}</div>` : ""}</span></label>`).join("")}</div></section>
        <section class="panel"><h3>Filtros</h3><div class="form" data-filters style="margin-top:8px">
          <label class="fld s4" data-fl="category_id"><span>Categoria</span><select name="category_id">${EA.catOptions("", { withSubs: true })}</select></label>
          <label class="fld s4" data-fl="product_id"><span>Produto</span><select name="product_id"><option value="">— todos —</option>${prods.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
          <label class="fld s4" data-fl="location_id"><span>Local</span><select name="location_id">${EA.locOptions("", "— todos —")}</select></label>
          <label class="fld s4" data-fl="lot"><span>Lote (código ou nº)</span><input name="lot"></label>
          <label class="fld s4" data-fl="within_days"><span>Validade em até (dias)</span><input name="within_days" inputmode="numeric"></label>
          <label class="fld s4" data-fl="type"><span>Tipo de movimentação</span><select name="type"><option value="">— todos —</option>${Object.entries(EA.boot.movement_types).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label>
          <label class="fld s4" data-fl="date_from"><span>Período: de</span><input type="date" name="date_from"></label>
          <label class="fld s4" data-fl="date_to"><span>até</span><input type="date" name="date_to"></label>
          <label class="fld s4" data-fl="people"><span>Pessoas</span><input name="people" inputmode="numeric" placeholder="${esc(EA.boot.settings.people)}"></label>
          <label class="fld s4" data-fl="target_days"><span>Meta (dias)</span><input name="target_days" inputmode="numeric" placeholder="padrão"></label>
          <label class="fld s4" data-fl="people_list"><span>Cenários (pessoas)</span><input name="people_list" value="${esc(EA.boot.settings.people_scenarios || "")}"></label>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn" data-view>Visualizar / imprimir</button><button class="btn ghost" data-fmt="pdf">PDF</button>
          <button class="btn ghost" data-fmt="xlsx">Excel</button><button class="btn ghost" data-fmt="csv">CSV</button></div>
        <iframe data-prev title="Pré-visualização" style="width:100%;height:60vh;border:1px solid var(--line);border-radius:6px;margin-top:14px;background:#fff"></iframe></section></div>`;
    const kind = () => el.querySelector("[name=rt]:checked").value;
    const showF = () => { const fs = FILTERS[kind()]; el.querySelectorAll("[data-fl]").forEach((x) => (x.style.display = fs.includes(x.dataset.fl) ? "" : "none")); };
    const params = (fmt) => {
      const p = { tipo: kind() };
      if (fmt) p.formato = fmt;
      FILTERS[kind()].forEach((k) => { const v = el.querySelector(`[name=${k}]`).value; if (v) p[k] = v; });
      return p;
    };
    el.querySelectorAll("[name=rt]").forEach((r) => r.addEventListener("change", () => { showF(); preview(); }));
    const preview = () => EA.frameSrc(el.querySelector("[data-prev]"), EA.url("/relatorio", params()));
    el.querySelector("[data-view]").onclick = () => EA.openUrl(EA.url("/relatorio", params()), true);
    el.querySelectorAll("[data-fmt]").forEach((b) => (b.onclick = () => { EA.openUrl(EA.url("/relatorio", params(b.dataset.fmt)), false); }));
    el.querySelectorAll("[data-filters] [name]").forEach((i) => i.addEventListener("change", preview));
    showF();
    preview();
  };

  // ============================================================ BACKUP
  V.backup = async function (el) {
    const d = await EA.get("/api/backups");
    const KIND = { manual: "manual", automatico: "automático", "pre-restauracao": "antes de restaurar", encerramento: "ao encerrar", importado: "outro" };
    el.innerHTML = `<div class="page-head"><div><h1>Backup e segurança</h1><div class="sub">Banco de dados: <span class="mono">${esc(d.db_path)}</span> (${(d.db_size / 1024).toFixed(0)} KB)</div></div></div>
      <div class="grid g3">
        <section class="panel"><h2>Fazer backup agora</h2><p class="small muted">Cria uma cópia verificada (SHA-256) na pasta de backups. Nunca substitui backups anteriores.</p>
          <form class="form" data-bk><label class="fld s12"><span>Observação</span><input name="notes" placeholder="ex.: após compras do mês"></label>
          <label class="fld s12 no-ipad"><span>Copiar também para (pendrive / pasta)</span><select name="dest"><option value="">— somente no computador —</option>${d.drives.map((x) => `<option value="${esc(x.path)}">${esc(x.label)}</option>`).join("")}</select></label>
          <label class="fld s12 no-ipad"><span>ou digite a pasta</span><input name="dest2" placeholder="ex.: E:\\"></label></form>
          <button class="btn ok" data-do style="margin-top:10px">Fazer backup</button></section>
        <section class="panel"><h2>Verificar integridade</h2><p class="small muted">Confere a estrutura do banco, as chaves, os saldos (nenhum negativo) e as proteções do histórico.</p>
          <button class="btn ghost" data-int>Verificar agora</button><div data-intout style="margin-top:10px"></div></section>
        <section class="panel"><h2>Exportar e importar</h2>
          <p><a class="btn ghost" href="${EA.url("/exportar/banco")}">Exportar banco completo (.db)</a></p>
          <p><a class="btn ghost" href="${EA.url("/exportar/json")}">Exportar dados (JSON)</a></p>
          <p><a class="btn ghost" href="${EA.url("/exportar/planilha-completa")}">Exportar planilha (Excel)</a></p>
          <p><button class="btn ghost" data-impjson>Importar dados (JSON)…</button></p>
          <p><button class="btn ghost" data-upload>Restaurar de um arquivo .db…</button></p></section>
      </div>
      <section class="panel"><div class="panel-head"><h2>Cópias de segurança (${d.files.length})</h2><span class="small muted">Pasta: <span class="mono">${esc(d.folder)}</span></span></div>
        ${d.files.length ? `<div class="table-wrap tall"><table class="t"><thead><tr><th>Data/hora</th><th>Tipo</th><th>Arquivo</th><th class="n">Tamanho</th><th>Soma SHA-256</th><th></th></tr></thead><tbody>
          ${d.files.map((f) => `<tr><td class="nowrap">${EA.date(f.ts)}</td><td>${esc(KIND[f.kind] || f.kind)}</td><td class="mono small">${esc(f.name)}</td><td class="n">${(f.size / 1024).toFixed(0)} KB</td>
            <td>${f.has_checksum ? '<span class="badge b-green">registrada</span>' : '<span class="badge b-grey">ausente</span>'}</td>
            <td class="nowrap right"><button class="btn sm ghost" data-ver="${esc(f.name)}">Verificar</button> <button class="btn sm ghost no-ipad" data-copy="${esc(f.name)}">Copiar p/ pendrive</button> <button class="btn sm danger" data-rest="${esc(f.name)}">Restaurar</button></td></tr>`).join("")}
          </tbody></table></div>` : '<div class="empty">Nenhum backup ainda.</div>'}
        <p class="small muted">Backups automáticos: na abertura, a cada ${esc(EA.boot.settings.auto_backup_hours)} h quando há alterações e ao encerrar. São mantidos os ${esc(EA.boot.settings.auto_backup_keep)} automáticos mais recentes; backups manuais nunca são apagados pelo sistema.</p></section>
      <section class="panel no-ipad"><h2>Restaurar a partir de um pendrive ou pasta</h2><form class="form" data-rpath><label class="fld s8"><span>Caminho completo do arquivo .db</span><input name="path" placeholder="E:\\EstoqueAutonomo_backups\\estoque_2026-11-09_101500_manual.db"></label>
        <div class="fld s4" style="justify-content:flex-end"><button type="button" class="btn ghost" data-vpath>Verificar arquivo</button></div><div class="fld s12" data-vout></div>
        <div class="fld s4"><button type="button" class="btn danger" data-rp>Restaurar este arquivo</button></div></form></section>`;
    const reload = () => V.backup(el);
    el.querySelector("[data-do]").onclick = async (e) => {
      const f = EA.formData(el.querySelector("[data-bk]"));
      e.target.disabled = true;
      try {
        const r = await EA.post("/api/backups", { notes: f.notes, dest: f.dest2 || f.dest });
        let msg = "Backup criado e verificado.";
        if (r.copy) msg += r.copy.exists ? " Já existia no destino um arquivo com esse nome (não substituído)." : " Cópia gravada em " + r.copy.path + (r.copy.verified ? " (conferida)." : " (FALHA na conferência!)");
        EA.toast(msg, r.copy && r.copy.verified === false);
        reload();
      } catch (err) { EA.toast(err.message, true); e.target.disabled = false; }
    };
    el.querySelector("[data-int]").onclick = async () => {
      const r = await EA.get("/api/integrity");
      el.querySelector("[data-intout]").innerHTML = r.ok
        ? `<div class="alert good">Banco íntegro. ${Object.entries(r.counts).map(([k, v]) => v + " " + k).join(", ")}.</div>`
        : `<div class="alert bad">Problemas: ${r.issues.map(esc).join("<br>")}</div>`;
    };
    const verifyOut = (r) => r.ok ? `<div class="alert good">Arquivo íntegro${r.checksum_ok === true ? " e soma SHA-256 confere" : r.checksum_ok === false ? " — ATENÇÃO: soma SHA-256 NÃO confere" : ""}. ${Object.entries(r.counts || {}).map(([k, v]) => v + " " + k).join(", ")}.</div>` : `<div class="alert bad">${(r.issues || []).map(esc).join("<br>")}</div>`;
    el.querySelectorAll("[data-ver]").forEach((b) => (b.onclick = async () => {
      const r = await EA.post("/api/backups/verify", { name: b.dataset.ver });
      EA.modal({ title: "Verificação: " + b.dataset.ver, footer: '<button class="btn" data-x>Fechar</button>', body: verifyOut(r) });
    }));
    el.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => EA.modal({
      title: "Copiar backup para pendrive", size: "narrow", okLabel: "Copiar",
      body: `<form class="form"><label class="fld s12"><span>Destino</span><select name="dest"><option value="">— digite abaixo —</option>${d.drives.map((x) => `<option value="${esc(x.path)}">${esc(x.label)}</option>`).join("")}</select></label>
        <label class="fld s12"><span>ou pasta</span><input name="dest2" placeholder="E:\\"></label></form><p class="small muted">Será criada a pasta EstoqueAutonomo_backups no destino.</p>`,
      onOk: async (m) => {
        const f = EA.formData(m.querySelector("form"));
        const dest = f.dest2 || f.dest;
        let r = await EA.post("/api/backups/copy", { name: b.dataset.copy, dest });
        if (r.needs_confirmation) {
          if (!(await EA.confirm("Substituir backup?", esc(r.message) + "<br><span class='mono small'>" + esc(r.path) + "</span>", "Substituir", true))) return false;
          r = await EA.post("/api/backups/copy", { name: b.dataset.copy, dest, overwrite: true });
        }
        EA.toast("Copiado para " + r.path + (r.verified ? " (conferido)" : ""), !r.verified);
      },
    })));
    const restore = (payload, label) => EA.modal({
      title: "Restaurar backup", size: "narrow", okLabel: "Restaurar",
      body: `<p>Os dados atuais serão substituídos por <b>${esc(label)}</b>.</p><p>Antes disso, o sistema faz automaticamente um backup do estado atual (“antes de restaurar”), para que nada se perca.</p>
        <form class="form"><label class="fld s12"><span>Digite <b>RESTAURAR</b> para confirmar</span><input name="confirm" autocomplete="off"></label></form>`,
      onOk: async (m) => {
        const c = m.querySelector("[name=confirm]").value.trim().toUpperCase();
        const r = await EA.post(payload.url, Object.assign({ confirm: c }, payload.body));
        EA.afterRestore("Restaurado. Backup do estado anterior: " + r.pre_restore_backup.split(/[\\/]/).pop());
      },
    });
    el.querySelectorAll("[data-rest]").forEach((b) => (b.onclick = () => restore({ url: "/api/backups/restore", body: { name: b.dataset.rest } }, b.dataset.rest)));
    el.querySelector("[data-vpath]").onclick = async () => {
      const p = el.querySelector("[data-rpath] [name=path]").value.trim().replace(/^"|"$/g, "");
      el.querySelector("[data-vout]").innerHTML = verifyOut(await EA.post("/api/backups/verify", { path: p }));
    };
    el.querySelector("[data-rp]").onclick = () => {
      const p = el.querySelector("[data-rpath] [name=path]").value.trim().replace(/^"|"$/g, "");
      if (!p) return EA.toast("Informe o caminho do arquivo.", true);
      restore({ url: "/api/backups/restore", body: { path: p } }, p);
    };
    el.querySelector("[data-upload]").onclick = () => EA.modal({
      title: "Restaurar de um arquivo .db", size: "narrow", okLabel: "Restaurar",
      body: `<form class="form"><label class="fld s12"><span>Arquivo de backup (.db)</span><input type="file" name="f"></label>
        <label class="fld s12"><span>Digite <b>RESTAURAR</b> para confirmar</span><input name="confirm" autocomplete="off"></label></form>
        <p class="small muted">O arquivo é verificado antes; o estado atual é salvo automaticamente.</p>`,
      onOk: async (m) => {
        const file = m.querySelector("[name=f]").files[0];
        if (!file) throw new Error("Selecione o arquivo.");
        const b64 = await fileB64(file);
        const r = await EA.post("/api/restore-upload", { data: b64, filename: file.name, confirm: m.querySelector("[name=confirm]").value.trim().toUpperCase() });
        EA.afterRestore("Restaurado. Backup do estado anterior: " + r.pre_restore_backup.split(/[\\/]/).pop());
      },
    });
    el.querySelector("[data-impjson]").onclick = () => EA.modal({
      title: "Importar dados (JSON)", size: "narrow", okLabel: "Importar",
      body: `<p>Substitui <b>todos</b> os dados pelos do arquivo exportado (o estado atual é salvo antes, automaticamente).</p>
        <form class="form"><label class="fld s12"><span>Arquivo .json exportado pelo Estoque Autônomo</span><input type="file" name="f" accept=".json,application/json"></label>
        <label class="fld s12"><span>Digite <b>SUBSTITUIR</b> para confirmar</span><input name="confirm" autocomplete="off"></label></form>`,
      onOk: async (m) => {
        const file = m.querySelector("[name=f]").files[0];
        if (!file) throw new Error("Selecione o arquivo.");
        let data;
        try { data = JSON.parse(await file.text()); } catch (e) { throw new Error("Arquivo JSON inválido."); }
        await EA.post("/api/import-json", { data, confirm: m.querySelector("[name=confirm]").value.trim().toUpperCase() });
        EA.afterRestore("Dados importados.");
      },
    });
  };
  async function usersPanel(el) {
    const ROLE = { admin: "Administrador", operador: "Operador", consulta: "Consulta" };
    const roleOpts = (sel) => Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v}</option>`).join("");
    const users = await EA.get("/api/users");
    el.querySelector("[data-ulist]").innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Situação</th><th>Último acesso</th><th></th></tr></thead><tbody>
      ${users.map((u) => `<tr><td><b>${esc(u.name)}</b>${u.id === EA.user.id ? ' <span class="badge b-blue">você</span>' : ""}</td><td class="mono">${esc(u.username)}</td><td>${esc(u.role_label)}</td>
        <td>${u.active ? '<span class="badge b-green">ativo</span>' : '<span class="badge b-grey">desativado</span>'}</td><td>${EA.date(u.last_login)}</td>
        <td class="right"><button class="btn sm ghost" data-eu="${u.id}">Editar</button></td></tr>`).join("")}</tbody></table></div>`;
    el.querySelector("[data-newuser]").onclick = () => EA.modal({
      title: "Novo usuário", size: "narrow", okLabel: "Criar usuário",
      body: `<form class="form"><label class="fld s12"><span>Nome</span><input name="name"></label><label class="fld s6"><span>Usuário</span><input name="username" autocapitalize="none" autocomplete="off"></label>
        <label class="fld s6"><span>Perfil</span><select name="role">${roleOpts("operador")}</select></label>
        <label class="fld s12"><span>Senha inicial (mín. 6)</span><input name="password" type="password" autocomplete="new-password"></label>
        <p class="help">A pessoa pode trocar a senha depois, pelo botão “Senha” no topo.</p></form>`,
      onOk: async (m) => { await EA.post("/api/users", EA.formData(m.querySelector("form"))); EA.toast("Usuário criado."); usersPanel(el); },
    });
    el.querySelectorAll("[data-eu]").forEach((b) => (b.onclick = () => {
      const u = users.find((x) => x.id == b.dataset.eu);
      EA.modal({
        title: "Editar usuário " + u.username, size: "narrow",
        body: `<form class="form"><label class="fld s12"><span>Nome</span><input name="name" value="${esc(u.name)}"></label>
          <label class="fld s6"><span>Perfil</span><select name="role">${roleOpts(u.role)}</select></label>
          <label class="fld s6 chk"><input type="checkbox" name="active" ${u.active ? "checked" : ""}><span>Ativo (pode entrar)</span></label>
          <label class="fld s12"><span>Nova senha (deixe em branco para manter)</span><input name="password" type="password" autocomplete="new-password"></label>
          <p class="help">Usuários não são apagados, apenas desativados, para preservar o histórico.</p></form>`,
        onOk: async (m) => {
          const d = EA.formData(m.querySelector("form"));
          if (!d.password) delete d.password;
          await EA.put("/api/users/" + u.id, d);
          EA.toast("Usuário atualizado.");
          usersPanel(el);
        },
      });
    }));
    el.querySelector("[data-newcode]").onclick = async () => {
      if (!(await EA.confirm("Novo código de recuperação", "O código atual deixará de valer. Anote o novo em lugar seguro.", "Gerar"))) return;
      const r = await EA.post("/api/users/recovery-code");
      EA.modal({ title: "Novo código de recuperação", size: "narrow", footer: '<button class="btn" data-x>Já anotei</button>',
        body: `<p>Anote e guarde em papel. Ele permite redefinir a senha de um administrador.</p><div class="auth-code">${esc(r.recovery_code)}</div>` });
    };
  }

  function fileB64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = () => rej(new Error("Falha ao ler o arquivo."));
      r.readAsDataURL(file);
    });
  }

  // ============================================================ CONFIGURAÇÕES
  V.configuracoes = async function (el) {
    await EA.reloadBoot();
    const s = EA.boot.settings;
    el.innerHTML = `<div class="page-head"><div><h1>Configurações</h1><div class="sub">Versão ${esc(EA.boot.version)} · dados em <span class="mono">${esc(EA.boot.db_path)}</span></div></div></div>
      <section class="panel"><h2>Residência e cálculos</h2><form class="form" data-set>
        <label class="fld s6"><span>Nome da residência / local</span><input name="household_name" value="${esc(s.household_name)}"></label>
        <label class="fld s3"><span>Pessoas atendidas (padrão)</span><input name="people" inputmode="numeric" value="${esc(s.people)}"></label>
        <label class="fld s3"><span>Responsável padrão</span><input name="responsible_default" value="${esc(s.responsible_default)}"></label>
        <label class="fld s3"><span>Cenários de pessoas</span><input name="people_scenarios" value="${esc(s.people_scenarios)}"></label>
        <label class="fld s3"><span>Autonomia desejada (dias)</span><input name="target_days" inputmode="numeric" value="${esc(s.target_days)}"></label>
        <label class="fld s3"><span>Meta no modo de emergência (dias)</span><input name="emergency_target_days" inputmode="numeric" value="${esc(s.emergency_target_days)}"></label>
        <label class="fld s3"><span>Horizontes de cálculo (dias)</span><input name="horizons" value="${esc(s.horizons)}"></label>
        <label class="fld s3"><span>Alertas de validade (dias)</span><input name="alert_days" value="${esc(s.alert_days)}"></label>
        <label class="fld s3"><span>Base da previsão de consumo</span><select name="forecast_basis">
          <option value="planejado" ${s.forecast_basis === "planejado" ? "selected" : ""}>Planejado (ou histórico se não houver)</option>
          <option value="observado" ${s.forecast_basis === "observado" ? "selected" : ""}>Histórico real de consumo</option>
          <option value="maior" ${s.forecast_basis === "maior" ? "selected" : ""}>O maior dos dois (mais prudente)</option></select></label>
        <label class="fld s3"><span>Janela do histórico (dias)</span><input name="observed_window_days" inputmode="numeric" value="${esc(s.observed_window_days)}"></label>
        <label class="fld s3"><span>Revisão periódica a cada (dias)</span><input name="review_interval_days" inputmode="numeric" value="${esc(s.review_interval_days)}"></label>
        <label class="fld s3"><span>Backup automático a cada (horas)</span><input name="auto_backup_hours" inputmode="numeric" value="${esc(s.auto_backup_hours)}"></label>
        <label class="fld s3"><span>Manter backups automáticos</span><input name="auto_backup_keep" inputmode="numeric" value="${esc(s.auto_backup_keep)}"></label>
        <label class="fld s3"><span>Sair sozinho após inatividade (min; 0 = nunca)</span><input name="session_timeout_min" inputmode="numeric" value="${esc(s.session_timeout_min)}"></label>
      </form>${EA.user.role === "admin" ? '<button class="btn" data-save style="margin-top:12px">Salvar configurações</button>' : '<p class="small muted" style="margin-top:10px">Somente um administrador altera as configurações.</p>'}</section>
      ${EA.user.role === "admin" ? `<section class="panel" data-users><div class="panel-head"><h2>Usuários</h2><div class="actions"><button class="btn sm ghost" data-newcode>Gerar novo código de recuperação</button><button class="btn sm" data-newuser>Novo usuário</button></div></div><div data-ulist></div>
        <p class="small muted">Perfis: <b>Administrador</b> faz tudo (usuários, configurações, restaurar backup). <b>Operador</b> cadastra e registra movimentações. <b>Consulta</b> só visualiza e imprime. Cada movimentação fica registrada com o nome de quem estava conectado.</p></section>` : ""}
      <div class="grid g2">
        <section class="panel"><div class="panel-head"><h2>Unidades de medida</h2><div class="actions"><button class="btn sm" data-unit>Nova unidade</button></div></div>
          <table class="t">${EA.boot.units.map((u) => `<tr><td class="mono">${esc(u.code)}</td><td>${esc(u.name)}</td><td class="muted">${esc(u.kind)}</td></tr>`).join("")}</table></section>
        <section class="panel"><div class="panel-head"><h2>Cenários salvos</h2></div>
          <table class="t">${EA.boot.scenarios.map((c) => `<tr><td>${esc(c.name)}</td><td class="n">${c.people} pessoas</td><td class="right"><button class="btn sm ghost" data-delsc="${c.id}">Excluir</button></td></tr>`).join("")}</table>
          <form class="form" data-sc style="margin-top:10px"><label class="fld s6"><span>Nome</span><input name="name" placeholder="ex.: família ampliada"></label><label class="fld s3"><span>Pessoas</span><input name="people" inputmode="numeric"></label>
            <div class="fld s3" style="justify-content:flex-end"><button class="btn ghost" type="submit">Adicionar</button></div></form></section>
      </div>
      <section class="panel"><div class="panel-head"><h2>Trilha de auditoria</h2><div class="actions"><a class="btn sm ghost" target="_blank" href="${EA.url("/relatorio", { tipo: "auditoria" })}">Relatório completo</a></div></div><div data-aud></div></section>`;
    const sv = el.querySelector("[data-save]");
    if (sv) sv.onclick = async () => {
      try {
        await EA.put("/api/settings", { values: EA.formData(el.querySelector("[data-set]")) });
        await EA.reloadBoot();
        EA.toast("Configurações salvas.");
      } catch (e) { EA.toast(e.message, true); }
    };
    el.querySelector("[data-unit]").onclick = () => EA.modal({
      title: "Nova unidade de medida", size: "narrow",
      body: `<form class="form"><label class="fld s4"><span class="req">Sigla</span><input name="code" placeholder="ex.: bd"></label><label class="fld s8"><span>Nome</span><input name="name" placeholder="ex.: balde"></label>
        <label class="fld s12"><span>Tipo</span><select name="kind"><option value="contagem">contagem</option><option value="volume">volume</option><option value="massa">massa</option><option value="comprimento">comprimento</option><option value="outro">outro</option></select></label></form>`,
      onOk: async (m) => { await EA.post("/api/units", EA.formData(m.querySelector("form"))); EA.toast("Unidade criada."); V.configuracoes(el); },
    });
    el.querySelector("[data-sc]").addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await EA.post("/api/scenarios", EA.formData(e.target)); V.configuracoes(el); } catch (err) { EA.toast(err.message, true); }
    });
    el.querySelectorAll("[data-delsc]").forEach((b) => (b.onclick = async () => { await EA.del("/api/scenarios/" + b.dataset.delsc); V.configuracoes(el); }));
    if (EA.user.role === "admin") await usersPanel(el);
    const aud = await EA.get("/api/audit?limit=60");
    el.querySelector("[data-aud]").innerHTML = aud.length ? `<div class="table-wrap tall"><table class="t"><thead><tr><th>Data</th><th>Entidade</th><th>Ação</th><th>Responsável</th><th>Alterações</th></tr></thead><tbody>
      ${aud.map((r) => `<tr><td class="nowrap">${EA.date(r.ts)}</td><td>${esc(r.entity)} ${r.entity_id || ""}</td><td>${esc(r.action)}</td><td>${esc(r.responsible || "")}</td><td class="small mono" style="max-width:520px;word-break:break-word">${esc(r.after_json || "")}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">Sem registros.</div>';
  };
})();
