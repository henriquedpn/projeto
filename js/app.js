/* =====================================================================
   Gestão Técnica da Sonda de Perfuração
   NRs • SGSO (ANP) • Itens Críticos ANP • Auditorias • Plano de Ação
   Banco de dados: data/database.json  (persistência local em localStorage)
   ===================================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'sondaDB.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const today = () => new Date().toISOString().slice(0, 10);

  const LABELS = {
    conforme: 'Conforme', parcial: 'Parcial', nao_conforme: 'Não conforme', nao_avaliado: 'Não avaliado', nao_aplicavel: 'Não aplicável',
    aberta: 'Aberta', em_tratamento: 'Em tratamento', fechada: 'Fechada',
    planejada: 'Planejada', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada',
    nc_maior: 'NC Maior', nc_menor: 'NC Menor', observacao: 'Observação', oportunidade: 'Oport. de melhoria',
    interna: 'Interna', externa: 'Externa',
    operacional: 'Operacional', degradado: 'Degradado', inoperante: 'Inoperante',
    aprovado: 'Aprovado', reprovado: 'Reprovado', vencido: 'Vencido',
    Alta: 'Alta', 'Média': 'Média', Baixa: 'Baixa'
  };
  const REQ_STATUS = ['conforme', 'parcial', 'nao_conforme', 'nao_avaliado', 'nao_aplicavel'];
  const AUD_STATUS = ['planejada', 'em_andamento', 'concluida', 'cancelada'];
  const FIND_TIPOS = ['nc_maior', 'nc_menor', 'observacao', 'oportunidade'];
  const FIND_STATUS = ['aberta', 'em_tratamento', 'fechada'];
  const ENTIDADES = ['ANP', 'Marinha do Brasil', 'Ministério do Trabalho (MTE)', 'IBAMA', 'Operadora (Cliente)',
    'Sociedade Classificadora', 'Certificadora ISO', 'Auditoria Interna'];

  const MODULES = {
    nrs: { key: 'nrs', title: 'Normas Regulamentadoras (NRs)', short: 'NRs', prefix: 'NR-' },
    sgso: { key: 'sgso', title: 'SGSO – Práticas de Gestão (Res. ANP nº 43/2007)', short: 'SGSO', prefix: 'PG-' },
    criticos: { key: 'itensCriticos', title: 'Itens Críticos ANP – Interrupção da Operação', short: 'Itens Críticos', prefix: 'IC-' }
  };
  const PAGE_TITLES = {
    dashboard: 'Painel Geral', nrs: MODULES.nrs.title, sgso: MODULES.sgso.title, criticos: MODULES.criticos.title,
    auditorias: 'Auditorias Internas e Externas', acoes: 'Plano de Ação (Constatações de Auditoria)', config: 'Configurações e Banco de Dados'
  };

  let db = null;
  const filters = { nrs: {}, sgso: {}, criticos: {}, auditorias: {}, acoes: { status: 'pendentes' } };

  /* ------------------------------------------------------------ util */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const label = (s) => LABELS[s] || s || '—';
  const badge = (s, txt) => s ? `<span class="badge b-${esc(s)}">${esc(txt || label(s))}</span>` : '<span class="muted">—</span>';
  const fmtDate = (iso) => iso ? iso.split('-').reverse().join('/') : '—';
  const addDays = (iso, d) => { const t = new Date(iso + 'T12:00:00'); t.setDate(t.getDate() + Number(d || 0)); return t.toISOString().slice(0, 10); };
  const daysUntil = (iso) => Math.round((new Date(iso + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5);
  const options = (list, sel, lbl = label) => list.map((v) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(lbl(v))}</option>`).join('');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pct = (n) => `${Math.round(n * 100)}%`;

  function askConfirm(msg, okLabel = 'Confirmar') {
    return new Promise((resolve) => {
      const d = $('#confirmDlg');
      $('#confirmMsg').textContent = msg;
      $('#confirmOk').textContent = okLabel;
      const done = (v) => { d.close(); $('#confirmOk').onclick = $('#confirmCancel').onclick = null; resolve(v); };
      $('#confirmOk').onclick = () => done(true);
      $('#confirmCancel').onclick = () => done(false);
      d.oncancel = () => resolve(false);
      d.showModal();
    });
  }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ------------------------------------------------------------ persistência */
  async function loadSeed() {
    if (location.protocol !== 'file:') {
      try {
        const r = await fetch('data/database.json', { cache: 'no-store' });
        if (r.ok) return await r.json();
      } catch (_) { /* sem servidor — usa fallback */ }
    }
    if (window.SEED_DB) return clone(window.SEED_DB);
    throw new Error('Banco de dados não encontrado (data/database.json).');
  }

  const COLLS = ['nrs', 'sgso', 'itensCriticos', 'auditorias'];
  const emptyDB = () => ({ meta: {}, responsaveis: [], nrs: [], sgso: [], itensCriticos: [], auditorias: [] });
  const ID_RE = /^[A-Za-z0-9_.~:@+-]+$/;
  // mode: 'connecting' | 'shared' (banco da equipe) | 'local' (somente este navegador)
  const store = { mode: 'connecting', shared: null, user: null, me: null, readOnly: false, live: false, slow: false, error: null, empty: false };

  async function loadLocal() {
    let saved = null;
    db = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) { /* storage bloqueado */ }
    if (saved) { try { db = JSON.parse(saved); } catch (_) { db = null; } }
    if (!db) { try { db = await loadSeed(); } catch (_) { db = emptyDB(); } }
    normalize();
  }

  function subscribeShared() {
    const confirmed = new Set();
    const timer = setTimeout(() => { if (!store.live) { store.slow = true; scheduleRender(); } }, 10000);
    const settle = (key, fromCache) => {
      if (!fromCache) confirmed.add(key);
      if (!store.live && confirmed.size === COLLS.length + 1) {
        store.live = true; store.slow = false; clearTimeout(timer);
        store.empty = COLLS.every((k) => !db[k].length);
      }
      if (store.live) store.empty = COLLS.every((k) => !db[k].length);
      scheduleRender();
    };
    const onErr = (e) => { clearTimeout(timer); store.error = e.code; scheduleRender(); };
    COLLS.forEach((k) => store.shared.collection(k).onSnapshot((snap) => {
      db[k] = snap.docs.map((d) => clone(d.data())).sort((a, b) => String(a.id).localeCompare(String(b.id)));
      normalize(); settle(k, snap.metadata.fromCache);
    }, onErr));
    store.shared.doc('config/meta').onSnapshot((snap) => {
      const d = snap.exists ? snap.data() : {};
      db.meta = clone(d.meta || {}); db.responsaveis = clone(d.responsaveis || []);
      settle('meta', snap.metadata.fromCache);
    }, onErr);
  }

  // Re-renderiza a tela quando chegam dados de outras pessoas, sem roubar o foco de quem está digitando.
  function scheduleRender() {
    clearTimeout(scheduleRender._t);
    scheduleRender._t = setTimeout(() => {
      updateFooter();
      const a = document.activeElement;
      if (a && $('#view').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) {
        a.addEventListener('blur', () => scheduleRender(), { once: true });
        return;
      }
      route();
    }, 120);
  }

  function setReadOnly(v) {
    store.readOnly = v;
    document.body.classList.toggle('readonly', v);
    updateFooter();
  }

  function writeError(e) {
    const code = e && e.code;
    if (code === 'invalid_argument') {
      setReadOnly(true);
      toast('Você não tem permissão para editar. Peça ao dono acesso de Colaborador.');
    } else if (code === 'quota_exceeded') toast('O banco compartilhado atingiu o limite. Exclua itens antigos e tente de novo.');
    else toast('Não foi possível salvar agora. Verifique a conexão e tente de novo.');
  }

  /** Grava um documento (item, PG, IC ou auditoria). Retorna true se salvou. */
  function putLocal(coll, item) {
    const i = db[coll].findIndex((x) => x.id === item.id);
    if (i >= 0) db[coll][i] = item; else db[coll].push(item);
  }
  async function writeDoc(coll, item) {
    if (store.mode !== 'shared') { putLocal(coll, item); saveLocal(); return true; }
    const body = clone(item);
    body._at = new Date().toISOString(); body._by = store.me || null;
    try { await store.shared.collection(coll).doc(item.id).set(body); item._at = body._at; item._by = body._by; return true; }
    catch (e) { writeError(e); return false; }
  }
  async function removeDoc(coll, id) {
    if (store.mode !== 'shared') { db[coll] = db[coll].filter((x) => x.id !== id); saveLocal(); return true; }
    try { await store.shared.collection(coll).doc(id).delete(); return true; } catch (e) { writeError(e); return false; }
  }
  async function writeMeta() {
    if (store.mode !== 'shared') { saveLocal(); return true; }
    try {
      await store.shared.doc('config/meta').set({ meta: clone(db.meta), responsaveis: clone(db.responsaveis), _at: new Date().toISOString(), _by: store.me || null });
      return true;
    } catch (e) { writeError(e); return false; }
  }

  /** Substitui todo o banco (importação). No modo compartilhado grava documento a documento. */
  async function replaceAll(data) {
    if (store.mode !== 'shared') { db = data; normalize(); saveLocal(); return true; }
    const total = COLLS.reduce((n, k) => n + data[k].length, 0);
    let done = 0;
    try {
      for (const k of COLLS) {
        for (const it of data[k]) {
          if (!ID_RE.test(String(it.id || ''))) throw Object.assign(new Error(`ID inválido: ${it.id}`), { code: 'bad_id' });
        }
        const keep = new Set(data[k].map((i) => i.id));
        for (const old of db[k]) if (!keep.has(old.id)) await store.shared.collection(k).doc(old.id).delete();
        for (const it of data[k]) {
          await store.shared.collection(k).doc(it.id).set({ ...it, _at: new Date().toISOString(), _by: store.me || null });
          if (++done % 10 === 0) toast(`Importando… ${done}/${total}`);
        }
      }
      db.meta = data.meta || {}; db.responsaveis = data.responsaveis || [];
      return await writeMeta();
    } catch (e) {
      if (e.code === 'bad_id') { toast(e.message); return false; }
      writeError(e); return false;
    }
  }

  function normalize() {
    db.meta ||= {}; db.responsaveis ||= [];
    ['nrs', 'sgso', 'itensCriticos', 'auditorias'].forEach((k) => { db[k] ||= []; });
    [...db.nrs, ...db.sgso, ...db.itensCriticos].forEach((i) => { i.requisitos ||= []; });
    db.itensCriticos.forEach((i) => { i.testes ||= []; });
    db.auditorias.forEach((a) => { a.escopo ||= []; a.constatacoes ||= []; });
  }

  function saveLocal() {
    db.meta.atualizadoEm = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (_) { toast('Não foi possível salvar no navegador — exporte o JSON.'); }
    updateFooter();
  }

  function updateFooter() {
    $('#brandSonda').textContent = db.meta.sonda || 'Sonda';
    const el = $('#lastSave');
    let dot = 'warn', txt;
    if (store.mode === 'connecting') txt = 'Conectando ao banco compartilhado…';
    else if (store.mode === 'shared') {
      if (store.error) { dot = 'bad'; txt = 'Conexão com o banco compartilhado perdida. Recarregue a página.'; }
      else if (store.slow && !store.live) txt = 'O banco compartilhado ainda não respondeu. Os dados podem estar desatualizados.';
      else if (!store.live) txt = 'Carregando banco compartilhado…';
      else { dot = 'ok'; txt = 'Banco compartilhado da equipe · sincronizado ao vivo'; }
    } else {
      const d = db.meta.atualizadoEm ? new Date(db.meta.atualizadoEm) : null;
      txt = `Modo local: dados salvos só neste navegador${d && !isNaN(d) ? ` · ${d.toLocaleString('pt-BR')}` : ''}`;
    }
    if (store.readOnly) txt += ' · somente leitura';
    el.innerHTML = `<span class="dot dot-${dot}"></span>${esc(txt)}`;
  }

  /** Mostra "Alterado por Fulano em …" usando o id gravado no documento. */
  async function fillEditor(doc) {
    const el = $('#editedBy');
    if (!el || !doc || !doc._at) return;
    const when = new Date(doc._at).toLocaleString('pt-BR');
    el.textContent = `Última alteração em ${when}`;
    if (doc._by && store.user) {
      try {
        const ps = await store.user.profiles([doc._by]);
        const n = ps[doc._by] && (ps[doc._by].isMe ? 'você' : ps[doc._by].name);
        if (n && $('#editedBy') === el) el.textContent = `Última alteração em ${when} por ${n}`;
      } catch (_) { /* nome indisponível */ }
    }
  }

  /** Entrega um arquivo ao usuário. Na página publicada usa a permissão de download; localmente, um link comum. */
  async function saveFile(name, data, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    if (window.claude && typeof window.claude.use === 'function') {
      const dl = await window.claude.use('downloads').catch(() => null);
      if (!dl) { toast('Download indisponível nesta visualização. Abra a página no navegador.'); return false; }
      try { await dl.save({ filename: name, data: blob }); toast('Arquivo salvo'); return true; }
      catch (e) {
        if (e && e.code === 'declined') return false;
        if (e && e.code === 'rate_limited') toast('Já existe um download aguardando confirmação.');
        else toast('Não foi possível baixar o arquivo neste ambiente.');
        return false;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return true;
  }
  const download = (name, text) => saveFile(name, text, 'application/json');
  function exportDB() {
    const text = JSON.stringify(db, (k, v) => (k === '_at' || k === '_by' ? undefined : v), 2);
    openModal({
      title: 'Exportar banco de dados (JSON)', work: {}, readOnlyAware: false,
      render: () => `<p class="small muted">Copie o conteúdo abaixo ou baixe o arquivo e salve-o como <code>data/database.json</code>.</p>
        <textarea id="exportText" readonly style="min-height:50vh;font-family:ui-monospace,Consolas,monospace;font-size:12px">${esc(text)}</textarea>`,
      actions: [
        { label: 'Fechar', fn: closeModal },
        { label: 'Baixar arquivo', fn: () => download(`database_${today()}.json`, text) },
        { label: 'Copiar JSON', cls: 'primary', fn: () => {
          const ta = $('#exportText');
          Promise.resolve().then(() => navigator.clipboard.writeText(text)).then(() => toast('JSON copiado'))
            .catch(() => { ta.focus(); ta.select(); toast('Selecionado — use Ctrl+C para copiar'); });
        } }
      ]
    });
  }

  /* ------------------------------------------------------------ regras de negócio */
  function itemStatus(item) {
    if (item.aplicavel === false) return 'nao_aplicavel';
    const reqs = item.requisitos.filter((r) => r.status !== 'nao_aplicavel');
    if (!reqs.length) return item.statusManual || 'nao_avaliado';
    if (reqs.some((r) => r.status === 'nao_conforme')) return 'nao_conforme';
    if (reqs.every((r) => r.status === 'conforme')) return 'conforme';
    if (reqs.every((r) => r.status === 'nao_avaliado')) return 'nao_avaliado';
    return 'parcial';
  }
  const isOverdue = (item) => item.aplicavel !== false && item.proximaVerificacao && item.proximaVerificacao < today();

  function reqCounts(items) {
    const c = { conforme: 0, parcial: 0, nao_conforme: 0, nao_avaliado: 0, total: 0 };
    items.filter((i) => i.aplicavel !== false).forEach((i) => i.requisitos.forEach((r) => {
      if (r.status === 'nao_aplicavel') return;
      c[r.status] = (c[r.status] || 0) + 1; c.total++;
    }));
    c.indice = c.total ? (c.conforme + 0.5 * c.parcial) / c.total : 0;
    return c;
  }

  function interruptionRisk(item) {
    const reasons = [];
    if (itemStatus(item) === 'nao_conforme') reasons.push('requisito não conforme');
    if (item.estadoOperacional && item.estadoOperacional !== 'operacional') reasons.push(`estado ${label(item.estadoOperacional).toLowerCase()}`);
    if (isOverdue(item)) reasons.push('verificação vencida');
    return reasons;
  }

  function locate(ref) {
    for (const [mk, m] of Object.entries(MODULES)) {
      const item = db[m.key].find((i) => i.id === ref);
      if (item) return { mk, item };
    }
    return null;
  }

  const allFindings = () => db.auditorias.flatMap((a) => a.constatacoes.map((c, idx) => ({ ...c, _idx: idx, audit: a })));
  const findingOverdue = (c) => c.status !== 'fechada' && c.prazo && c.prazo < today();
  const responsaveis = () => [...new Set([...db.responsaveis, ...[...db.nrs, ...db.sgso, ...db.itensCriticos].map((i) => i.responsavel).filter(Boolean)])].sort();

  /* ------------------------------------------------------------ roteamento */
  function route() {
    const r = (location.hash || '#dashboard').slice(1);
    const name = PAGE_TITLES[r] ? r : 'dashboard';
    $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
    $('#pageTitle').textContent = PAGE_TITLES[name];
    $('#sidebar').classList.remove('open');
    const v = $('#view');
    if (name === 'dashboard') v.innerHTML = viewDashboard();
    else if (MODULES[name]) v.innerHTML = viewList(name);
    else if (name === 'auditorias') v.innerHTML = viewAudits();
    else if (name === 'acoes') v.innerHTML = viewActions();
    else if (name === 'config') v.innerHTML = viewConfig();
    document.title = `${PAGE_TITLES[name]} · ${db.meta.sonda || 'Sonda'}`;
  }
  const current = () => (location.hash || '#dashboard').slice(1);

  /* ------------------------------------------------------------ painel */
  function stackBar(c) {
    if (!c.total) return '<div class="progress"></div>';
    const w = (n) => `${(n / c.total) * 100}%`;
    return `<div class="progress" title="${c.conforme} conformes · ${c.parcial} parciais · ${c.nao_conforme} não conformes · ${c.nao_avaliado} não avaliados">
      <span class="p-ok" style="width:${w(c.conforme)}"></span><span class="p-warn" style="width:${w(c.parcial)}"></span>
      <span class="p-bad" style="width:${w(c.nao_conforme)}"></span><span class="p-na" style="width:${w(c.nao_avaliado)}"></span></div>`;
  }

  function viewDashboard() {
    if (store.mode === 'connecting' || (store.mode === 'shared' && !store.live && !store.slow && COLLS.every((k) => !db[k].length))) {
      return '<div class="card card-pad empty">Carregando o banco compartilhado da equipe…</div>';
    }
    if (COLLS.every((k) => !db[k].length)) {
      return `<div class="card card-pad">
        <h3>O banco ainda está vazio</h3>
        <p class="muted">Aqui aparecerão as NRs, as práticas do SGSO, os itens críticos da ANP e as auditorias da sonda.
          Para começar, importe um arquivo <code>database.json</code> em <a href="#config">Configurações</a> ou cadastre o primeiro item em <a href="#nrs">Normas Regulamentadoras</a>.</p>
      </div>`;
    }
    const cNR = reqCounts(db.nrs), cSG = reqCounts(db.sgso), cIC = reqCounts(db.itensCriticos);
    const risk = db.itensCriticos.map((i) => ({ i, r: interruptionRisk(i) })).filter((x) => x.r.length);
    const allItems = Object.entries(MODULES).flatMap(([mk, m]) => db[m.key].map((i) => ({ mk, i })));
    const overdue = allItems.filter((x) => isOverdue(x.i)).sort((a, b) => a.i.proximaVerificacao.localeCompare(b.i.proximaVerificacao));
    const upcoming = allItems.filter((x) => x.i.aplicavel !== false && x.i.proximaVerificacao && !isOverdue(x.i) && daysUntil(x.i.proximaVerificacao) <= 30)
      .sort((a, b) => a.i.proximaVerificacao.localeCompare(b.i.proximaVerificacao));
    const finds = allFindings();
    const open = finds.filter((c) => c.status !== 'fechada');
    const late = open.filter(findingOverdue);
    const planned = db.auditorias.filter((a) => a.status === 'planejada' || a.status === 'em_andamento')
      .sort((a, b) => (a.dataInicio || '').localeCompare(b.dataInicio || ''));
    const byType = FIND_TIPOS.map((t) => [t, open.filter((c) => c.tipo === t).length]);

    const itemLink = (mk, i) => `<a href="javascript:void 0" data-open-item="${esc(mk)}|${esc(i.id)}"><b>${esc(i.codigo || i.id)}</b> – ${esc(i.titulo)}</a>`;

    return `
      ${risk.length
        ? `<div class="banner">⚠ ${risk.length} item(ns) crítico(s) ANP com risco de interrupção das operações. Verifique a lista abaixo.</div>`
        : '<div class="banner ok">✔ Nenhum item crítico ANP com risco de interrupção no momento.</div>'}
      <div class="grid kpis">
        <div class="card kpi ${cNR.indice < .8 ? 'warn' : 'ok'}"><div class="label">Índice NRs</div><div class="value">${pct(cNR.indice)}</div><div class="sub">${db.nrs.filter((i) => i.aplicavel !== false).length} NRs aplicáveis</div></div>
        <div class="card kpi ${cSG.indice < .8 ? 'warn' : 'ok'}"><div class="label">Índice SGSO</div><div class="value">${pct(cSG.indice)}</div><div class="sub">17 práticas de gestão</div></div>
        <div class="card kpi ${cIC.indice < .9 ? 'warn' : 'ok'}"><div class="label">Índice Itens Críticos</div><div class="value">${pct(cIC.indice)}</div><div class="sub">${db.itensCriticos.length} itens monitorados</div></div>
        <div class="card kpi ${risk.length ? 'bad' : 'ok'}"><div class="label">Risco de interrupção</div><div class="value">${risk.length}</div><div class="sub">itens críticos</div></div>
        <div class="card kpi ${overdue.length ? 'bad' : 'ok'}"><div class="label">Verificações vencidas</div><div class="value">${overdue.length}</div><div class="sub">${upcoming.length} nos próximos 30 dias</div></div>
        <div class="card kpi ${late.length ? 'bad' : open.length ? 'warn' : 'ok'}"><div class="label">Constatações abertas</div><div class="value">${open.length}</div><div class="sub">${late.length} com prazo vencido</div></div>
      </div>

      <div class="grid two" style="margin-top:16px">
        <div class="card card-pad">
          <h3>Conformidade por módulo</h3>
          ${[['NRs', cNR, 'nrs'], ['SGSO (ANP)', cSG, 'sgso'], ['Itens Críticos ANP', cIC, 'criticos']].map(([n, c, r]) =>
            `<div class="module-row"><a href="#${r}">${n}</a>${stackBar(c)}<div class="pct">${pct(c.indice)}</div></div>`).join('')}
          <div class="legend"><span><i style="background:var(--ok)"></i>Conforme</span><span><i style="background:var(--warn)"></i>Parcial</span>
            <span><i style="background:var(--bad)"></i>Não conforme</span><span><i style="background:var(--na);opacity:.4"></i>Não avaliado</span></div>
          <p class="small muted">Índice = (conformes + 0,5 × parciais) ÷ requisitos aplicáveis.</p>
        </div>

        <div class="card card-pad">
          <h3>⚠ Itens críticos com risco de interrupção</h3>
          ${risk.length ? `<ul class="alert-list">${risk.map(({ i, r }) => `<li>${badge(i.estadoOperacional)}<div>${itemLink('criticos', i)}<div class="small muted">${esc(r.join(' · '))}</div></div></li>`).join('')}</ul>`
            : '<div class="empty">Nenhum item em risco.</div>'}
        </div>

        <div class="card card-pad">
          <h3>Verificações vencidas e próximas (30 dias)</h3>
          ${overdue.length + upcoming.length ? `<ul class="alert-list">
            ${overdue.slice(0, 12).map(({ mk, i }) => `<li>${badge('vencido')}<div>${itemLink(mk, i)}<div class="small muted">Vencida em ${fmtDate(i.proximaVerificacao)} · ${esc(i.responsavel || 'sem responsável')}</div></div></li>`).join('')}
            ${upcoming.slice(0, 8).map(({ mk, i }) => `<li>${badge('planejada', `${daysUntil(i.proximaVerificacao)} d`)}<div>${itemLink(mk, i)}<div class="small muted">Prevista para ${fmtDate(i.proximaVerificacao)} · ${esc(i.responsavel || 'sem responsável')}</div></div></li>`).join('')}
          </ul>${overdue.length > 12 ? `<p class="small muted">+ ${overdue.length - 12} vencidas.</p>` : ''}` : '<div class="empty">Nada pendente.</div>'}
        </div>

        <div class="card card-pad">
          <h3>Auditorias planejadas / em andamento</h3>
          ${planned.length ? `<ul class="alert-list">${planned.map((a) => `<li>${badge(a.tipo)}<div><a href="javascript:void 0" data-open-audit="${esc(a.id)}"><b>${esc(a.id)}</b> – ${esc(a.titulo)}</a>
            <div class="small muted">${esc(a.entidade)} · ${fmtDate(a.dataInicio)} a ${fmtDate(a.dataFim)} · escopo: ${a.escopo.length} itens</div></div></li>`).join('')}</ul>`
            : '<div class="empty">Nenhuma auditoria planejada.</div>'}
          <h3 style="margin-top:16px">Constatações abertas por tipo</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${byType.map(([t, n]) => `${badge(t, `${label(t)}: ${n}`)}`).join('')}</div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------ listas (NR / SGSO / Críticos) */
  function viewList(mk) {
    const m = MODULES[mk], f = filters[mk], crit = mk === 'criticos';
    const q = (f.q || '').toLowerCase();
    const items = db[m.key].filter((i) => {
      const st = itemStatus(i);
      if (f.status === 'vencido') { if (!isOverdue(i)) return false; } else if (f.status && st !== f.status) return false;
      if (f.aplic === 'sim' && i.aplicavel === false) return false;
      if (f.aplic === 'nao' && i.aplicavel !== false) return false;
      if (q && !`${i.codigo} ${i.titulo} ${i.responsavel} ${i.categoria || ''} ${i.referencia || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const c = reqCounts(db[m.key]);

    return `
      <div class="toolbar">
        <input class="search" type="search" placeholder="Buscar código, título, responsável…" value="${esc(f.q || '')}" data-filter="${mk}.q">
        <select data-filter="${mk}.status"><option value="">Todos os status</option>${options([...REQ_STATUS, 'vencido'], f.status)}</select>
        ${mk === 'nrs' ? `<select data-filter="${mk}.aplic"><option value="">Aplicáveis e não aplicáveis</option>${options(['sim', 'nao'], f.aplic, (v) => v === 'sim' ? 'Somente aplicáveis' : 'Somente não aplicáveis')}</select>` : ''}
        <span class="spacer"></span>
        <span class="small muted">Índice: <b>${pct(c.indice)}</b> · ${items.length} de ${db[m.key].length} itens</span>
        <button class="btn primary" data-new-item="${mk}">+ Novo item</button>
      </div>
      <div class="card table-wrap">
        <table>
          <thead><tr>
            <th>Código</th><th>Título</th>${crit ? '<th>Categoria</th><th>Criticidade</th><th>Estado</th>' : ''}
            <th>Responsável</th><th>Requisitos</th><th>Próx. verificação</th><th>Status</th>
          </tr></thead>
          <tbody>
          ${items.map((i) => {
            const st = itemStatus(i), ap = i.requisitos.filter((r) => r.status !== 'nao_aplicavel');
            const ok = ap.filter((r) => r.status === 'conforme').length;
            return `<tr class="clickable ${i.aplicavel === false ? 'inactive' : ''}" data-open-item="${mk}|${esc(i.id)}">
              <td class="code">${esc(i.codigo)}</td>
              <td>${esc(i.titulo)}${i.referencia && !crit ? `<div class="small muted">${esc(i.referencia)}</div>` : ''}</td>
              ${crit ? `<td>${esc(i.categoria)}</td><td>${badge(i.criticidade)}</td><td>${badge(i.estadoOperacional)}</td>` : ''}
              <td>${esc(i.responsavel || '—')}</td>
              <td class="nowrap">${ap.length ? `${ok}/${ap.length}` : '—'}</td>
              <td class="nowrap">${fmtDate(i.proximaVerificacao)} ${isOverdue(i) ? badge('vencido') : ''}</td>
              <td>${badge(st)}</td></tr>`;
          }).join('') || `<tr><td colspan="${crit ? 10 : 7}" class="empty">Nenhum item encontrado.</td></tr>`}
          </tbody>
        </table>
      </div>`;
  }

  /* ------------------------------------------------------------ modal genérico com binding */
  const M = { work: null, render: null, cmds: {}, onChange: null, actions: [] };
  const dlg = () => $('#modal');

  function openModal({ title, work, render, cmds = {}, actions = [], onChange = null, readOnlyAware = true }) {
    Object.assign(M, { work, render, cmds, actions, onChange, readOnlyAware });
    M.editDoc = null;
    $('#modalTitle').textContent = title;
    renderModal();
    if (!dlg().open) dlg().showModal();
    $('#modalBody').scrollTop = 0;
  }
  function renderModal() {
    const scroll = $('#modalBody').scrollTop;
    $('#modalBody').innerHTML = M.render(M.work);
    if (store.readOnly && M.readOnlyAware !== false) {
      $$('#modalBody input, #modalBody select, #modalBody textarea').forEach((el) => { if (el.id !== 'exportText') el.disabled = true; });
    }
    const acts = store.readOnly && M.readOnlyAware !== false ? M.actions.filter((a) => a.keep || a.label === 'Cancelar' || a.label === 'Fechar') : M.actions;
    $('#modalFoot').innerHTML = acts.map((a) => [a, M.actions.indexOf(a)]).map(([a, i]) => `<button type="button" class="btn ${a.cls || ''} ${a.left ? 'left' : ''}" data-act="${i}">${esc(a.label)}</button>`).join('');
    $('#modalBody').scrollTop = scroll;
    if (M.editDoc) fillEditor(M.editDoc);
  }
  const closeModal = () => dlg().close();

  function setPath(obj, path, value) {
    const ks = path.split('.'); let o = obj;
    ks.slice(0, -1).forEach((k) => { o = o[k]; });
    o[ks[ks.length - 1]] = value;
  }
  function onModalInput(e) {
    const el = e.target;
    if (el.dataset.path) {
      const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
      setPath(M.work, el.dataset.path, v);
      if (M.onChange) M.onChange(el.dataset.path, e.type);
    }
    if (el.dataset.scope && e.type === 'change') {
      const set = new Set(M.work.escopo);
      el.checked ? set.add(el.dataset.scope) : set.delete(el.dataset.scope);
      M.work.escopo = [...set];
      el.closest('.chip').classList.toggle('on', el.checked);
      $$('[data-ref-select]').forEach((s) => { const val = s.value; s.innerHTML = refOptions(M.work.escopo, val); });
    }
  }

  /* ------------------------------------------------------------ edição de item */
  const nextReqId = (it) => {
    const nums = it.requisitos.map((r) => Number(String(r.id).split('.').pop()) || 0);
    return `${it.codigo}.${String(Math.max(0, ...nums) + 1).padStart(2, '0')}`;
  };

  function openItem(mk, id) {
    const m = MODULES[mk], crit = mk === 'criticos';
    const orig = id ? db[m.key].find((i) => i.id === id) : null;
    if (id && !orig) return;
    const isNew = !orig;
    const n = db[m.key].length + 1;
    const work = orig ? clone(orig) : {
      id: '', codigo: `${m.prefix}${String(n).padStart(2, '0')}`, titulo: '', aplicavel: true, responsavel: '',
      periodicidadeDias: 365, ultimaVerificacao: '', proximaVerificacao: '', requisitos: [], observacoes: '',
      ...(mk === 'sgso' ? { referencia: 'Resolução ANP nº 43/2007 — Regulamento Técnico do SGSO' } : {}),
      ...(crit ? { categoria: '', criticidade: 'Alta', referencia: '', descricao: '', interrompeOperacao: true, estadoOperacional: 'operacional', testes: [] } : {})
    };

    const related = () => allFindings().filter((c) => c.ref === (orig ? orig.id : work.codigo));

    const render = (w) => {
      const st = itemStatus(w), risk = crit ? interruptionRisk(w) : [];
      return `
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <span id="liveStatus">${badge(st)}</span>
          <span id="editedBy" class="small muted"></span>
          ${isOverdue(w) ? badge('vencido', 'Verificação vencida') : ''}
          ${crit && risk.length ? `<span class="badge b-nao_conforme">⚠ Risco de interrupção: ${esc(risk.join(', '))}</span>` : ''}
        </div>
        <div class="form-grid">
          <div class="field"><label>Código</label><input data-path="codigo" value="${esc(w.codigo)}" ${isNew ? '' : 'readonly'}></div>
          <div class="field" style="grid-column: span 2"><label>Título</label><input data-path="titulo" value="${esc(w.titulo)}"></div>
          ${crit ? `
            <div class="field"><label>Categoria</label><input data-path="categoria" value="${esc(w.categoria)}"></div>
            <div class="field"><label>Criticidade</label><select data-path="criticidade">${options(['Alta', 'Média', 'Baixa'], w.criticidade)}</select></div>
            <div class="field"><label>Estado operacional</label><select data-path="estadoOperacional">${options(['operacional', 'degradado', 'inoperante'], w.estadoOperacional)}</select></div>` : ''}
          <div class="field"><label>Responsável</label><input list="dlResp" data-path="responsavel" value="${esc(w.responsavel)}"></div>
          <div class="field"><label>Periodicidade (dias)</label><input type="number" min="1" data-path="periodicidadeDias" value="${esc(w.periodicidadeDias)}"></div>
          <div class="field"><label>Última verificação</label><input type="date" data-path="ultimaVerificacao" value="${esc(w.ultimaVerificacao)}"></div>
          <div class="field"><label>Próxima verificação</label><input type="date" data-path="proximaVerificacao" value="${esc(w.proximaVerificacao)}"></div>
          <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" data-path="aplicavel" ${w.aplicavel !== false ? 'checked' : ''}> Aplicável à sonda</label></div>
          ${'referencia' in w ? `<div class="field full"><label>Referência normativa</label><input data-path="referencia" value="${esc(w.referencia)}"></div>` : ''}
          ${crit ? `<div class="field full"><label>Descrição / critério de interrupção</label><textarea data-path="descricao">${esc(w.descricao)}</textarea></div>` : ''}
          <div class="field full"><label>Observações</label><textarea data-path="observacoes">${esc(w.observacoes)}</textarea></div>
        </div>
        <datalist id="dlResp">${responsaveis().map((r) => `<option value="${esc(r)}">`).join('')}</datalist>

        <div class="section-title">Requisitos / checklist (${w.requisitos.length})
          <button type="button" class="btn small" data-cmd="addReq">+ Requisito</button>
          ${w.requisitos.length ? '<button type="button" class="btn small" data-cmd="allOk">Marcar todos conformes</button>' : ''}</div>
        ${w.requisitos.length ? `<div class="table-wrap"><table class="edit-table">
          <thead><tr><th style="width:80px">ID</th><th>Descrição</th><th style="width:150px">Status</th><th style="width:28%">Evidência</th><th></th></tr></thead>
          <tbody>${w.requisitos.map((r, k) => `<tr>
            <td class="small muted nowrap">${esc(r.id)}</td>
            <td><textarea data-path="requisitos.${k}.descricao">${esc(r.descricao)}</textarea></td>
            <td><select data-path="requisitos.${k}.status">${options(REQ_STATUS, r.status)}</select></td>
            <td><input data-path="requisitos.${k}.evidencia" value="${esc(r.evidencia)}" placeholder="Documento, registro, foto…"></td>
            <td><button type="button" class="btn small danger" data-cmd="delReq" data-i="${k}" title="Remover">✕</button></td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty">Sem requisitos cadastrados.</div>'}

        ${crit ? `
          <div class="section-title">Testes e inspeções (${w.testes.length}) <button type="button" class="btn small" data-cmd="addTest">+ Registro</button></div>
          ${w.testes.length ? `<div class="table-wrap"><table class="edit-table">
            <thead><tr><th style="width:150px">Data</th><th>Descrição</th><th style="width:130px">Resultado</th><th style="width:22%">Executor</th><th></th></tr></thead>
            <tbody>${w.testes.map((t, k) => `<tr>
              <td><input type="date" data-path="testes.${k}.data" value="${esc(t.data)}"></td>
              <td><input data-path="testes.${k}.descricao" value="${esc(t.descricao)}"></td>
              <td><select data-path="testes.${k}.resultado">${options(['aprovado', 'reprovado'], t.resultado)}</select></td>
              <td><input list="dlResp" data-path="testes.${k}.executor" value="${esc(t.executor)}"></td>
              <td><button type="button" class="btn small danger" data-cmd="delTest" data-i="${k}">✕</button></td></tr>`).join('')}
            </tbody></table></div>` : '<div class="empty">Nenhum teste registrado.</div>'}` : ''}

        <div class="section-title">Constatações de auditoria relacionadas</div>
        ${related().length ? `<ul class="alert-list">${related().map((c) => `<li>${badge(c.tipo)} ${badge(c.status)}
          <div><a href="javascript:void 0" data-open-audit="${esc(c.audit.id)}"><b>${esc(c.audit.id)}</b> – ${esc(c.audit.titulo)}</a>
          <div class="small">${esc(c.descricao)}</div><div class="small muted">Prazo ${fmtDate(c.prazo)} · ${esc(c.responsavel)}</div></div></li>`).join('')}</ul>`
          : '<div class="empty">Nenhuma constatação vinculada.</div>'}`;
    };

    const cmds = {
      addReq: () => M.work.requisitos.push({ id: nextReqId(M.work), descricao: '', status: 'nao_avaliado', evidencia: '' }),
      delReq: (el) => M.work.requisitos.splice(Number(el.dataset.i), 1),
      allOk: () => M.work.requisitos.forEach((r) => { if (r.status !== 'nao_aplicavel') r.status = 'conforme'; }),
      addTest: () => M.work.testes.unshift({ data: today(), descricao: '', resultado: 'aprovado', executor: M.work.responsavel || '' }),
      delTest: (el) => M.work.testes.splice(Number(el.dataset.i), 1)
    };

    const onChange = (path, type) => {
      if (path === 'ultimaVerificacao' && M.work.ultimaVerificacao && M.work.periodicidadeDias) {
        M.work.proximaVerificacao = addDays(M.work.ultimaVerificacao, M.work.periodicidadeDias);
        const el = $('[data-path="proximaVerificacao"]'); if (el) el.value = M.work.proximaVerificacao;
      }
      if (type === 'change' && (/^requisitos\.\d+\.status$/.test(path) || ['aplicavel', 'estadoOperacional', 'proximaVerificacao', 'ultimaVerificacao'].includes(path))) renderModal();
    };

    const actions = [
      ...(isNew ? [] : [{ label: 'Excluir', cls: 'danger', left: true, fn: async () => {
        if (!await askConfirm(`Excluir ${orig.codigo}? Esta ação não pode ser desfeita.`, 'Excluir')) return;
        if (!await removeDoc(m.key, orig.id)) return;
        db[m.key] = db[m.key].filter((i) => i.id !== orig.id); closeModal(); route(); toast('Item excluído');
      } }]),
      { label: 'Cancelar', fn: closeModal },
      { label: 'Salvar', cls: 'primary', fn: async () => {
        const w = M.work;
        w.codigo = w.codigo.trim(); w.titulo = w.titulo.trim();
        if (!w.codigo || !w.titulo) return toast('Informe código e título.');
        if (!ID_RE.test(w.codigo)) return toast('Use no código apenas letras, números, hífen e ponto (ex.: NR-39).');
        if (isNew && locate(w.codigo)) return toast('Já existe um item com este código.');
        if (!isNew) {
          const now = db[m.key].find((i) => i.id === orig.id);
          if (now && now._at !== orig._at && !await askConfirm('Outra pessoa alterou este item enquanto você editava. Salvar mesmo assim e substituir a versão dela?', 'Substituir')) return;
        }
        if (isNew) w.id = w.codigo;
        w.requisitos = w.requisitos.filter((r) => r.descricao.trim());
        if (!await writeDoc(m.key, w)) return;
        const idx = db[m.key].findIndex((i) => i.id === w.id);
        if (idx >= 0) db[m.key][idx] = w; else db[m.key].push(w);
        closeModal(); route(); toast('Salvo');
      } }
    ];

    openModal({ title: isNew ? `Novo item – ${m.short}` : `${work.codigo} – ${work.titulo}`, work, render, cmds, actions, onChange });
    M.editDoc = orig; fillEditor(orig);
  }

  /* ------------------------------------------------------------ auditorias */
  function viewAudits() {
    const f = filters.auditorias, q = (f.q || '').toLowerCase();
    const list = db.auditorias.filter((a) => (!f.tipo || a.tipo === f.tipo) && (!f.status || a.status === f.status)
      && (!q || `${a.id} ${a.titulo} ${a.entidade} ${a.auditorLider} ${a.escopo.join(' ')}`.toLowerCase().includes(q)))
      .sort((a, b) => (b.dataInicio || '').localeCompare(a.dataInicio || ''));
    const counts = (t) => db.auditorias.filter((a) => a.tipo === t).length;
    return `
      <div class="toolbar">
        <input class="search" type="search" placeholder="Buscar auditoria, entidade, item do escopo…" value="${esc(f.q || '')}" data-filter="auditorias.q">
        <select data-filter="auditorias.tipo"><option value="">Internas e externas</option>${options(['interna', 'externa'], f.tipo)}</select>
        <select data-filter="auditorias.status"><option value="">Todos os status</option>${options(AUD_STATUS, f.status)}</select>
        <span class="spacer"></span>
        <span class="small muted">${counts('interna')} internas · ${counts('externa')} externas</span>
        <button class="btn primary" data-new-audit>+ Nova auditoria</button>
      </div>
      <div class="card table-wrap"><table>
        <thead><tr><th>ID</th><th>Título</th><th>Tipo</th><th>Entidade</th><th>Período</th><th>Auditor líder</th><th>Escopo</th><th>Constatações</th><th>Status</th><th>Relatório</th></tr></thead>
        <tbody>${list.map((a) => {
          const open = a.constatacoes.filter((c) => c.status !== 'fechada').length;
          const maior = a.constatacoes.filter((c) => c.tipo === 'nc_maior' && c.status !== 'fechada').length;
          return `<tr class="clickable" data-open-audit="${esc(a.id)}">
            <td class="code">${esc(a.id)}</td><td>${esc(a.titulo)}</td><td>${badge(a.tipo)}</td><td>${esc(a.entidade)}</td>
            <td class="nowrap">${fmtDate(a.dataInicio)} – ${fmtDate(a.dataFim)}</td><td>${esc(a.auditorLider)}</td>
            <td class="small">${esc(a.escopo.slice(0, 6).join(', '))}${a.escopo.length > 6 ? ` +${a.escopo.length - 6}` : ''}</td>
            <td class="nowrap">${a.constatacoes.length} total · <b>${open}</b> abertas ${maior ? badge('nc_maior', `${maior} NC maior`) : ''}</td>
            <td>${badge(a.status)}</td>
            <td><button class="btn small" data-audit-pdf="${esc(a.id)}" title="Baixar relatório em PDF">PDF</button></td></tr>`;
        }).join('') || '<tr><td colspan="10" class="empty">Nenhuma auditoria encontrada.</td></tr>'}</tbody>
      </table></div>`;
  }

  const allRefs = () => Object.values(MODULES).flatMap((m) => db[m.key].filter((i) => i.aplicavel !== false).map((i) => i));
  function refOptions(escopo, sel) {
    const refs = escopo.length ? escopo : allRefs().map((i) => i.id);
    const extra = sel && !refs.includes(sel) ? [sel] : [];
    return '<option value="">— selecione —</option>' + [...refs, ...extra].map((r) => {
      const l = locate(r); return `<option value="${esc(r)}"${r === sel ? ' selected' : ''}>${esc(r)}${l ? ` – ${esc(l.item.titulo.slice(0, 50))}` : ''}</option>`;
    }).join('');
  }

  function nextAuditId() {
    const y = new Date().getFullYear();
    const nums = db.auditorias.filter((a) => a.id.startsWith(`AUD-${y}-`)).map((a) => Number(a.id.split('-')[2]) || 0);
    return `AUD-${y}-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
  }

  function openAudit(id) {
    const orig = id ? db.auditorias.find((a) => a.id === id) : null;
    if (id && !orig) return;
    const isNew = !orig;
    const work = orig ? clone(orig) : {
      id: nextAuditId(), tipo: 'interna', entidade: 'Auditoria Interna', titulo: '', dataInicio: today(), dataFim: today(),
      auditorLider: '', status: 'planejada', escopo: [], constatacoes: [], conclusao: ''
    };

    const scopeGroup = (w, title, mk) => `<div class="scope-group"><div class="small muted" style="margin-bottom:4px"><b>${title}</b>
        <a href="javascript:void 0" data-cmd="scopeAll" data-mk="${mk}">todos</a> · <a href="javascript:void 0" data-cmd="scopeNone" data-mk="${mk}">nenhum</a></div>
      <div class="chips">${db[MODULES[mk].key].filter((i) => i.aplicavel !== false).map((i) => {
        const on = w.escopo.includes(i.id);
        return `<label class="chip ${on ? 'on' : ''}" title="${esc(i.titulo)}"><input type="checkbox" data-scope="${esc(i.id)}" ${on ? 'checked' : ''}>${esc(i.codigo)}</label>`;
      }).join('')}</div></div>`;

    const render = (w) => `
      <div id="editedBy" class="small muted" style="margin-bottom:10px"></div>
      <div class="form-grid">
        <div class="field"><label>ID</label><input data-path="id" value="${esc(w.id)}" ${isNew ? '' : 'readonly'}></div>
        <div class="field" style="grid-column: span 2"><label>Título</label><input data-path="titulo" value="${esc(w.titulo)}"></div>
        <div class="field"><label>Tipo</label><select data-path="tipo">${options(['interna', 'externa'], w.tipo)}</select></div>
        <div class="field"><label>Entidade / Auditor externo</label><input list="dlEnt" data-path="entidade" value="${esc(w.entidade)}"></div>
        <div class="field"><label>Auditor líder</label><input data-path="auditorLider" value="${esc(w.auditorLider)}"></div>
        <div class="field"><label>Início</label><input type="date" data-path="dataInicio" value="${esc(w.dataInicio)}"></div>
        <div class="field"><label>Fim</label><input type="date" data-path="dataFim" value="${esc(w.dataFim)}"></div>
        <div class="field"><label>Status</label><select data-path="status">${options(AUD_STATUS, w.status)}</select></div>
        <div class="field full"><label>Conclusão / parecer</label><textarea data-path="conclusao">${esc(w.conclusao)}</textarea></div>
      </div>
      <datalist id="dlEnt">${ENTIDADES.map((e) => `<option value="${esc(e)}">`).join('')}</datalist>
      <datalist id="dlResp">${responsaveis().map((r) => `<option value="${esc(r)}">`).join('')}</datalist>

      <div class="section-title">Escopo da auditoria (${w.escopo.length} itens)</div>
      ${scopeGroup(w, 'Normas Regulamentadoras', 'nrs')}
      ${scopeGroup(w, 'SGSO – Práticas de Gestão', 'sgso')}
      ${scopeGroup(w, 'Itens Críticos ANP', 'criticos')}

      <div class="section-title">Constatações (${w.constatacoes.length}) <button type="button" class="btn small" data-cmd="addFind">+ Constatação</button></div>
      ${w.constatacoes.length ? w.constatacoes.map((c, k) => `
        <div class="card card-pad" style="margin-bottom:10px;box-shadow:none">
          <div class="form-grid" style="margin-bottom:0">
            <div class="field"><label>ID</label><input data-path="constatacoes.${k}.id" value="${esc(c.id)}"></div>
            <div class="field" style="grid-column: span 2"><label>Item / requisito auditado</label><select data-ref-select data-path="constatacoes.${k}.ref">${refOptions(w.escopo, c.ref)}</select></div>
            <div class="field"><label>Classificação</label><select data-path="constatacoes.${k}.tipo">${options(FIND_TIPOS, c.tipo)}</select></div>
            <div class="field full"><label>Descrição da constatação</label><textarea data-path="constatacoes.${k}.descricao">${esc(c.descricao)}</textarea></div>
            <div class="field full"><label>Ação corretiva / plano de ação</label><textarea data-path="constatacoes.${k}.acao">${esc(c.acao)}</textarea></div>
            <div class="field"><label>Responsável</label><input list="dlResp" data-path="constatacoes.${k}.responsavel" value="${esc(c.responsavel)}"></div>
            <div class="field"><label>Prazo</label><input type="date" data-path="constatacoes.${k}.prazo" value="${esc(c.prazo)}"></div>
            <div class="field"><label>Status</label><select data-path="constatacoes.${k}.status">${options(FIND_STATUS, c.status)}</select></div>
            <div class="field"><label>&nbsp;</label><button type="button" class="btn danger" data-cmd="delFind" data-i="${k}">Remover constatação</button></div>
          </div>
        </div>`).join('') : '<div class="empty">Nenhuma constatação registrada.</div>'}`;

    const cmds = {
      addFind: () => {
        const nums = M.work.constatacoes.map((c) => Number(String(c.id).replace(/\D/g, '')) || 0);
        M.work.constatacoes.push({ id: `C-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`, ref: M.work.escopo[0] || '', tipo: 'nc_menor',
          descricao: '', acao: '', responsavel: '', prazo: addDays(today(), 30), status: 'aberta' });
      },
      delFind: (el) => M.work.constatacoes.splice(Number(el.dataset.i), 1),
      scopeAll: (el) => { const ids = db[MODULES[el.dataset.mk].key].filter((i) => i.aplicavel !== false).map((i) => i.id); M.work.escopo = [...new Set([...M.work.escopo, ...ids])]; },
      scopeNone: (el) => { const ids = new Set(db[MODULES[el.dataset.mk].key].map((i) => i.id)); M.work.escopo = M.work.escopo.filter((r) => !ids.has(r)); }
    };

    const onChange = (path) => {
      if (path === 'tipo' && M.work.tipo === 'interna' && !M.work.entidade) M.work.entidade = 'Auditoria Interna';
    };

    const actions = [
      ...(isNew ? [] : [{ label: 'Excluir', cls: 'danger', left: true, fn: async () => {
        if (!await askConfirm(`Excluir a auditoria ${orig.id} e todas as suas constatações?`, 'Excluir')) return;
        if (!await removeDoc('auditorias', orig.id)) return;
        db.auditorias = db.auditorias.filter((a) => a.id !== orig.id); closeModal(); route(); toast('Auditoria excluída');
      } }]),
      ...(isNew ? [] : [{ label: '⬇ Relatório PDF', left: true, keep: true, fn: () => exportAuditPdf(M.work) }]),
      { label: 'Cancelar', fn: closeModal },
      { label: 'Salvar', cls: 'primary', fn: async () => {
        const w = M.work; w.id = w.id.trim();
        if (!w.id || !w.titulo.trim()) return toast('Informe ID e título.');
        if (!ID_RE.test(w.id)) return toast('Use no ID apenas letras, números, hífen e ponto (ex.: AUD-2026-004).');
        if (isNew && db.auditorias.some((a) => a.id === w.id)) return toast('ID de auditoria já existe.');
        if (!isNew) {
          const now = db.auditorias.find((a) => a.id === orig.id);
          if (now && now._at !== orig._at && !await askConfirm('Outra pessoa alterou esta auditoria enquanto você editava. Salvar mesmo assim e substituir a versão dela?', 'Substituir')) return;
        }
        if (!await writeDoc('auditorias', w)) return;
        const idx = db.auditorias.findIndex((a) => a.id === w.id);
        if (idx >= 0) db.auditorias[idx] = w; else db.auditorias.push(w);
        closeModal(); route(); toast('Auditoria salva');
      } }
    ];
    openModal({ title: isNew ? 'Nova auditoria' : `${work.id} – ${work.titulo}`, work, render, cmds, actions, onChange });
    M.editDoc = orig; fillEditor(orig);
  }

  /* ------------------------------------------------------------ relatório de auditoria em PDF */
  async function exportAuditPdf(a) {
    const JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) return toast('Biblioteca de PDF não carregou. Verifique a conexão e recarregue a página.');
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    if (typeof doc.autoTable !== 'function') return toast('Biblioteca de tabelas do PDF não carregou. Recarregue a página.');

    const NAVY = [15, 35, 56], BLUE = [11, 92, 173], MUTED = [95, 107, 122], LINE = [221, 227, 234];
    const SEV = { nc_maior: [198, 40, 40], nc_menor: [178, 106, 0], observacao: [61, 90, 128], oportunidade: [107, 114, 128] };
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14;
    const sonda = db.meta.sonda || 'Sonda';
    const geradoEm = new Date().toLocaleString('pt-BR');
    let y;

    // Cabeçalho da primeira página
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 30, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('RELATÓRIO DE AUDITORIA', M, 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`${sonda}${db.meta.tipo ? ` · ${db.meta.tipo}` : ''}${db.meta.bacia ? ` · ${db.meta.bacia}` : ''}`, M, 20);
    doc.text(`${db.meta.operador || ''}`, M, 25.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(a.id, W - M, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(label(a.tipo).toUpperCase() + ' · ' + label(a.status).toUpperCase(), W - M, 20, { align: 'right' });

    doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    const tl = doc.splitTextToSize(a.titulo || 'Auditoria', W - 2 * M);
    doc.text(tl, M, 40); y = 40 + tl.length * 6;

    const section = (title) => {
      if (y > H - 40) { doc.addPage(); y = 20; }
      doc.setTextColor(...BLUE); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(title.toUpperCase(), M, y);
      doc.setDrawColor(...BLUE); doc.setLineWidth(0.4); doc.line(M, y + 1.5, W - M, y + 1.5);
      y += 5;
    };
    const tableBase = {
      margin: { left: M, right: M, top: 18, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: [28, 36, 48], lineColor: LINE, lineWidth: 0.2, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 246, 249] }
    };
    const after = () => { y = doc.lastAutoTable.finalY + 8; };

    // 1. Identificação
    section('1. Identificação');
    doc.autoTable({
      ...tableBase, startY: y, theme: 'plain',
      styles: { ...tableBase.styles, fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 42 }, 2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 32 } },
      body: [
        ['Tipo de auditoria', label(a.tipo), 'Status', label(a.status)],
        ['Entidade / auditor', a.entidade || '—', 'Auditor líder', a.auditorLider || '—'],
        ['Período', `${fmtDate(a.dataInicio)} a ${fmtDate(a.dataFim)}`, 'Itens no escopo', String(a.escopo.length)],
        ['Unidade', sonda, 'Emitido em', geradoEm]
      ]
    }); after();

    // 2. Resumo
    section('2. Resumo das constatações');
    const cs = a.constatacoes;
    const cnt = (fn) => cs.filter(fn).length;
    doc.autoTable({
      ...tableBase, startY: y,
      head: [['Classificação', 'Total', 'Abertas', 'Em tratamento', 'Fechadas', 'Prazo vencido']],
      body: [...FIND_TIPOS.map((t) => [label(t), cnt((c) => c.tipo === t), cnt((c) => c.tipo === t && c.status === 'aberta'),
        cnt((c) => c.tipo === t && c.status === 'em_tratamento'), cnt((c) => c.tipo === t && c.status === 'fechada'), cnt((c) => c.tipo === t && findingOverdue(c))]),
        ['Total', cs.length, cnt((c) => c.status === 'aberta'), cnt((c) => c.status === 'em_tratamento'), cnt((c) => c.status === 'fechada'), cnt(findingOverdue)]],
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.row.index === FIND_TIPOS.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [229, 237, 247]; }
        if (d.section === 'body' && d.column.index === 0 && d.row.index < FIND_TIPOS.length) { d.cell.styles.textColor = SEV[FIND_TIPOS[d.row.index]]; d.cell.styles.fontStyle = 'bold'; }
      }
    }); after();

    // 3. Escopo
    section('3. Escopo auditado');
    const escopoRows = a.escopo.map((ref) => {
      const l = locate(ref);
      return [ref, l ? l.item.titulo : '(item não encontrado no banco)', l ? MODULE_NAMES[l.mk] : '—', l ? label(itemStatus(l.item)) : '—', String(cs.filter((c) => c.ref === ref).length)];
    });
    if (escopoRows.length) {
      doc.autoTable({
        ...tableBase, startY: y,
        head: [['Item', 'Título', 'Módulo', 'Conformidade atual', 'Constatações']],
        body: escopoRows,
        columnStyles: { 0: { cellWidth: 18, fontStyle: 'bold' }, 2: { cellWidth: 30 }, 3: { cellWidth: 32 }, 4: { cellWidth: 24, halign: 'center' } }
      }); after();
    } else { doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text('Escopo não definido.', M, y + 2); y += 10; }

    // 4. Constatações
    section('4. Constatações e plano de ação');
    if (cs.length) {
      doc.autoTable({
        ...tableBase, startY: y,
        head: [['Nº', 'Item', 'Classificação', 'Descrição', 'Ação corretiva', 'Responsável', 'Prazo', 'Status']],
        body: cs.map((c) => [c.id, c.ref || '—', label(c.tipo), c.descricao || '', c.acao || '', c.responsavel || '—',
          fmtDate(c.prazo) + (findingOverdue(c) ? '\nVENCIDO' : ''), label(c.status)]),
        styles: { ...tableBase.styles, fontSize: 7.8 },
        columnStyles: { 0: { cellWidth: 11 }, 1: { cellWidth: 13, fontStyle: 'bold' }, 2: { cellWidth: 22 }, 3: { cellWidth: 41 }, 4: { cellWidth: 37 }, 5: { cellWidth: 22 }, 6: { cellWidth: 19 }, 7: { cellWidth: 17 } },
        didParseCell: (d) => {
          if (d.section !== 'body') return;
          const c = cs[d.row.index];
          if (d.column.index === 2) { d.cell.styles.textColor = SEV[c.tipo] || MUTED; d.cell.styles.fontStyle = 'bold'; }
          if (d.column.index === 6 && findingOverdue(c)) { d.cell.styles.textColor = SEV.nc_maior; d.cell.styles.fontStyle = 'bold'; }
        }
      }); after();
    } else { doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text('Nenhuma constatação registrada.', M, y + 2); y += 10; }

    // 5. Conclusão
    section('5. Conclusão / parecer');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(28, 36, 48);
    const concl = doc.splitTextToSize(a.conclusao || 'Sem parecer registrado.', W - 2 * M);
    concl.forEach((ln) => { if (y > H - 22) { doc.addPage(); y = 20; } doc.text(ln, M, y + 2); y += 4.6; });
    y += 6;

    // Assinaturas
    if (y > H - 45) { doc.addPage(); y = 30; }
    y += 14;
    const colW = (W - 2 * M - 16) / 2;
    [[a.auditorLider || 'Auditor líder', 'Auditor líder'], ['', 'Responsável pela unidade (OIM)']].forEach(([nome, cargo], i) => {
      const x = M + i * (colW + 16);
      doc.setDrawColor(...MUTED); doc.setLineWidth(0.3); doc.line(x, y, x + colW, y);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(28, 36, 48);
      if (nome) doc.text(nome, x + colW / 2, y + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
      doc.text(cargo, x + colW / 2, y + (nome ? 9.5 : 5), { align: 'center' });
    });

    // Rodapé e cabeçalho das páginas seguintes
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      if (i > 1) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...NAVY);
        doc.text(`Relatório de Auditoria ${a.id}`, M, 10);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
        doc.text(sonda, W - M, 10, { align: 'right' });
        doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, 12, W - M, 12);
      }
      doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, H - 12, W - M, H - 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      doc.text(`${a.id} · ${a.titulo || ''}`.slice(0, 95), M, H - 7);
      doc.text(`Página ${i} de ${n}`, W - M, H - 7, { align: 'right' });
    }

    doc.setProperties({ title: `Relatório de Auditoria ${a.id}`, subject: a.titulo || '', author: a.auditorLider || '', creator: 'Gestão Técnica da Sonda' });
    const nome = `Relatorio_Auditoria_${a.id}.pdf`.replace(/[^\w.\-]+/g, '_');
    await saveFile(nome, doc.output('blob'), 'application/pdf');
  }

  /* ------------------------------------------------------------ plano de ação */
  function filteredActions() {
    const f = filters.acoes, q = (f.q || '').toLowerCase();
    return allFindings().filter((c) => {
      if (f.status === 'pendentes' && c.status === 'fechada') return false;
      if (f.status === 'vencidas' && !findingOverdue(c)) return false;
      if (f.status && !['pendentes', 'vencidas'].includes(f.status) && c.status !== f.status) return false;
      if (f.tipo && c.tipo !== f.tipo) return false;
      if (f.resp && c.responsavel !== f.resp) return false;
      if (q && !`${c.ref} ${c.descricao} ${c.acao} ${c.audit.id} ${c.audit.titulo}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
  }

  const MODULE_NAMES = { nrs: 'NR', sgso: 'SGSO (ANP)', criticos: 'Item Crítico ANP' };
  const isoToDate = (iso) => (iso ? new Date(`${iso}T00:00:00`) : null);

  async function exportActionsXlsx() {
    if (!window.XLSX) return toast('Biblioteca de Excel não carregou. Verifique a conexão e recarregue a página.');
    const list = filteredActions();
    if (!list.length) return toast('Nenhuma ação para exportar com os filtros atuais.');
    const t = today();
    const rows = list.map((c) => {
      const l = locate(c.ref);
      const atraso = findingOverdue(c) ? -daysUntil(c.prazo) : 0;
      return {
        'Auditoria': c.audit.id,
        'Título da auditoria': c.audit.titulo,
        'Tipo': label(c.audit.tipo),
        'Entidade': c.audit.entidade || '',
        'Data da auditoria': isoToDate(c.audit.dataInicio),
        'Constatação nº': c.id,
        'Item': c.ref || '',
        'Título do item': l ? l.item.titulo : '',
        'Módulo': l ? MODULE_NAMES[l.mk] : '',
        'Classificação': label(c.tipo),
        'Descrição da constatação': c.descricao || '',
        'Ação corretiva': c.acao || '',
        'Responsável': c.responsavel || '',
        'Prazo': isoToDate(c.prazo),
        'Status': label(c.status),
        'Situação do prazo': c.status === 'fechada' ? 'Fechada' : !c.prazo ? 'Sem prazo' : atraso > 0 ? 'Vencido' : 'No prazo',
        'Dias de atraso': atraso
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true, dateNF: 'dd/mm/yyyy' });
    const cols = Object.keys(rows[0]);
    ws['!cols'] = cols.map((k) => ({ wch: Math.min(60, Math.max(k.length + 2, ...rows.map((r) => (r[k] instanceof Date ? 10 : String(r[k] ?? '').length + 1)))) }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: cols.length - 1 } }) };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    // formato de data dd/mm/aaaa nas colunas de data
    ['Data da auditoria', 'Prazo'].forEach((k) => {
      const c = cols.indexOf(k);
      for (let r = 1; r <= rows.length; r++) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && cell.t === 'd') cell.z = 'dd/mm/yyyy'; }
    });

    const f = filters.acoes;
    const filtroTxt = [
      f.status ? `Status: ${f.status === 'pendentes' ? 'Pendentes' : f.status === 'vencidas' ? 'Prazo vencido' : label(f.status)}` : 'Status: Todas',
      f.tipo ? `Classificação: ${label(f.tipo)}` : '', f.resp ? `Responsável: ${f.resp}` : '', f.q ? `Busca: "${f.q}"` : ''
    ].filter(Boolean).join(' · ');
    const count = (fn) => list.filter(fn).length;
    const resumo = [
      ['Plano de Ação – ' + (db.meta.sonda || 'Sonda')],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      ['Filtros aplicados', filtroTxt],
      [],
      ['Total de ações', list.length],
      ['Abertas', count((c) => c.status === 'aberta')],
      ['Em tratamento', count((c) => c.status === 'em_tratamento')],
      ['Fechadas', count((c) => c.status === 'fechada')],
      ['Com prazo vencido', count(findingOverdue)],
      [],
      ['Por classificação', 'Quantidade'],
      ...FIND_TIPOS.map((k) => [label(k), count((c) => c.tipo === k)]),
      [],
      ['Por responsável', 'Total', 'Pendentes', 'Vencidas'],
      ...[...new Set(list.map((c) => c.responsavel || '(sem responsável)'))].sort().map((r) => {
        const mine = list.filter((c) => (c.responsavel || '(sem responsável)') === r);
        return [r, mine.length, mine.filter((c) => c.status !== 'fechada').length, mine.filter(findingOverdue).length];
      })
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(resumo);
    ws2['!cols'] = [{ wch: 34 }, { wch: 40 }, { wch: 12 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    wb.Props = { Title: 'Plano de Ação', Subject: db.meta.sonda || '', CreatedDate: new Date() };
    XLSX.utils.book_append_sheet(wb, ws, 'Plano de Ação');
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumo');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true });
    const nome = `Plano_de_Acao_${(db.meta.sonda || 'Sonda').replace(/[^\w\-]+/g, '_').replace(/_+$/, '')}_${t}.xlsx`;
    await saveFile(nome, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  function viewActions() {
    const f = filters.acoes;
    const list = filteredActions();
    const resps = [...new Set(allFindings().map((c) => c.responsavel).filter(Boolean))].sort();

    return `
      <div class="toolbar">
        <input class="search" type="search" placeholder="Buscar descrição, ação, item…" value="${esc(f.q || '')}" data-filter="acoes.q">
        <select data-filter="acoes.status"><option value="">Todas</option>${options(['pendentes', 'vencidas', ...FIND_STATUS], f.status, (v) => v === 'pendentes' ? 'Pendentes (não fechadas)' : v === 'vencidas' ? 'Prazo vencido' : label(v))}</select>
        <select data-filter="acoes.tipo"><option value="">Todas as classificações</option>${options(FIND_TIPOS, f.tipo)}</select>
        <select data-filter="acoes.resp"><option value="">Todos os responsáveis</option>${options(resps, f.resp, (v) => v)}</select>
        <span class="spacer"></span><span class="small muted">${list.length} ações</span>
        <button class="btn primary" data-export-xlsx title="Exporta as ações listadas, com os filtros atuais">⬇ Exportar Excel</button>
      </div>
      <div class="card table-wrap"><table>
        <thead><tr><th>Auditoria</th><th>Item</th><th>Classificação</th><th>Constatação</th><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
        <tbody>${list.map((c) => {
          const l = locate(c.ref);
          return `<tr>
            <td class="nowrap"><a href="javascript:void 0" data-open-audit="${esc(c.audit.id)}">${esc(c.audit.id)}</a><div class="small muted">${esc(c.id)} · ${badge(c.audit.tipo)}</div></td>
            <td class="nowrap">${l ? `<a href="javascript:void 0" data-open-item="${l.mk}|${esc(c.ref)}">${esc(c.ref)}</a>` : esc(c.ref || '—')}</td>
            <td>${badge(c.tipo)}</td><td>${esc(c.descricao)}</td><td>${esc(c.acao)}</td><td>${esc(c.responsavel)}</td>
            <td class="nowrap">${fmtDate(c.prazo)} ${findingOverdue(c) ? badge('vencido') : ''}</td>
            <td><select data-find-status="${esc(c.audit.id)}|${c._idx}" ${store.readOnly ? 'disabled' : ''}>${options(FIND_STATUS, c.status)}</select></td></tr>`;
        }).join('') || '<tr><td colspan="8" class="empty">Nenhuma ação encontrada.</td></tr>'}</tbody>
      </table></div>`;
  }

  /* ------------------------------------------------------------ configurações */
  function viewConfig() {
    const m = db.meta;
    const size = new Blob([JSON.stringify(db)]).size;
    return `
      <div class="grid two">
        <div class="card card-pad">
          <h3>Dados da sonda</h3>
          <div class="form-grid">
            ${[['sonda', 'Nome da sonda'], ['tipo', 'Tipo (navio-sonda, semissubmersível, autoelevatória…)'], ['operador', 'Operador / cliente'], ['bacia', 'Bacia / locação'], ['versao', 'Versão do banco']]
              .map(([k, l]) => `<div class="field"><label>${l}</label><input data-meta="${k}" value="${esc(m[k])}"></div>`).join('')}
            <div class="field full"><label>Responsáveis cadastrados (um por linha)</label><textarea data-meta="responsaveis" rows="6">${esc(db.responsaveis.join('\n'))}</textarea></div>
          </div>
          <button class="btn primary" data-save-meta>Salvar dados</button>
        </div>
        <div class="card card-pad">
          <h3>Banco de dados (JSON)</h3>
          ${store.mode === 'shared'
            ? `<p class="small muted">Este é o <b>banco compartilhado da equipe</b>: todas as pessoas com acesso à página veem os mesmos dados, e cada alteração aparece para os outros em segundos.
                Quem tem acesso de Colaborador ou Editor pode editar; quem tem acesso de Leitor só consulta.
                <b>Importar JSON</b> substitui todo o conteúdo do banco compartilhado.</p>`
            : `<p class="small muted">Os dados são carregados de <code>data/database.json</code> e as alterações ficam salvas neste navegador (localStorage).
                Exporte o JSON para backup ou para substituir o arquivo <code>data/database.json</code> e compartilhar com a equipe.</p>`}
          <p class="small">NRs: <b>${db.nrs.length}</b> · SGSO: <b>${db.sgso.length}</b> · Itens críticos: <b>${db.itensCriticos.length}</b> · Auditorias: <b>${db.auditorias.length}</b> · Tamanho: <b>${(size / 1024).toFixed(1)} KB</b></p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" data-export>⬇ Exportar JSON</button>
            <button class="btn" data-import>⬆ Importar JSON</button>
            ${store.mode === 'local' ? '<button class="btn danger" data-reset>↺ Restaurar banco original</button>' : ''}
          </div>
          ${m.observacao ? `<p class="small muted" style="margin-top:14px">ℹ ${esc(m.observacao)}</p>` : ''}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------ eventos */
  function bind() {
    window.addEventListener('hashchange', () => { if (dlg().open) closeModal(); route(); });
    $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#exportBtn').addEventListener('click', exportDB);
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalBody').addEventListener('input', onModalInput);
    $('#modalBody').addEventListener('change', onModalInput);
    $('#modalFoot').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) M.actions[Number(b.dataset.act)].fn(); });
    $('#modalBody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (b && M.cmds[b.dataset.cmd]) { e.preventDefault(); M.cmds[b.dataset.cmd](b); renderModal(); }
    });

    // filtros
    const view = $('#view');
    const applyFilter = (el) => {
      const [k, f] = el.dataset.filter.split('.'); filters[k][f] = el.value;
      const pos = el.selectionStart; route();
      const again = $(`[data-filter="${el.dataset.filter}"]`);
      if (again && el.type === 'search') { again.focus(); try { again.setSelectionRange(pos, pos); } catch (_) { /* noop */ } }
    };
    view.addEventListener('input', (e) => { if (e.target.dataset.filter && e.target.type === 'search') applyFilter(e.target); });
    view.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.filter && el.tagName === 'SELECT') applyFilter(el);
      if (el.dataset.findStatus) {
        const [aid, idx] = el.dataset.findStatus.split('|');
        const aud = db.auditorias.find((a) => a.id === aid);
        const prev = aud.constatacoes[Number(idx)].status;
        aud.constatacoes[Number(idx)].status = el.value;
        writeDoc('auditorias', aud).then((ok) => {
          if (!ok) aud.constatacoes[Number(idx)].status = prev;
          route(); if (ok) toast('Status atualizado');
        });
      }
    });

    // cliques globais (abrem modais)
    document.addEventListener('click', (e) => {
      const pdf = e.target.closest('[data-audit-pdf]');
      if (pdf) { const a = db.auditorias.find((x) => x.id === pdf.dataset.auditPdf); if (a) exportAuditPdf(a); return; }
      const it = e.target.closest('[data-open-item]');
      if (it) { const [mk, id] = it.dataset.openItem.split('|'); return openItem(mk, id); }
      const au = e.target.closest('[data-open-audit]');
      if (au) return openAudit(au.dataset.openAudit);
      if (e.target.closest('[data-new-item]')) return openItem(e.target.closest('[data-new-item]').dataset.newItem, null);
      if (e.target.closest('[data-new-audit]')) return openAudit(null);
      if (e.target.closest('[data-export]')) return exportDB();
      if (e.target.closest('[data-export-xlsx]')) return exportActionsXlsx();
      if (e.target.closest('[data-import]')) return $('#importFile').click();
      if (e.target.closest('[data-reset]')) {
        askConfirm('Restaurar o banco original? Todas as alterações locais serão perdidas (exporte antes, se necessário).', 'Restaurar').then((ok) => {
          if (!ok) return;
          try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* noop */ }
          loadSeed().then((d) => { db = d; normalize(); saveLocal(); route(); toast('Banco restaurado'); })
            .catch(() => toast('Banco original não encontrado (data/database.json).'));
        });
        return;
      }
      if (e.target.closest('[data-save-meta]')) {
        $$('[data-meta]').forEach((el) => {
          if (el.dataset.meta === 'responsaveis') db.responsaveis = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
          else db.meta[el.dataset.meta] = el.value.trim();
        });
        writeMeta().then((ok) => { route(); if (ok) toast('Dados salvos'); });
      }
    });

    $('#importFile').addEventListener('change', async (e) => {
      const file = e.target.files[0]; e.target.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data.nrs || !data.sgso || !data.itensCriticos) throw new Error('estrutura inválida');
        const ok = await askConfirm(store.mode === 'shared'
          ? 'Importar este arquivo substitui todo o banco compartilhado da equipe. Continuar?'
          : 'Importar este arquivo substitui os dados deste navegador. Continuar?', 'Importar');
        if (!ok) return;
        data.auditorias ||= [];
        const norm = { ...emptyDB(), ...data };
        if (await replaceAll(norm)) { route(); toast('Banco importado com sucesso'); }
      } catch (err) { toast(`Falha ao importar: ${err.message}. Verifique se o arquivo é o database.json exportado.`); }
    });
  }

  /* ------------------------------------------------------------ início */
  async function init() {
    db = emptyDB();
    bind();
    const hasClaude = !!(window.claude && typeof window.claude.use === 'function');
    if (hasClaude) {
      updateFooter(); route();
      const [sdb, user] = await Promise.all([
        window.claude.use('db').catch(() => null),
        window.claude.use('user').catch(() => null)
      ]);
      store.user = user;
      if (sdb) {
        store.shared = sdb; store.mode = 'shared';
        if (user) {
          store.me = await user.id();
          if (await user.can('data.write') === false) setReadOnly(true);
        }
        updateFooter(); route();
        subscribeShared();
        return;
      }
    }
    await loadLocal();
    store.mode = 'local';
    updateFooter(); route();
  }

  init().catch((err) => { $('#view').innerHTML = `<div class="banner">Erro ao carregar o banco de dados: ${esc(err.message)}</div>`; });
})();
