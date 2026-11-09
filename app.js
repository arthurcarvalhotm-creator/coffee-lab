/* =====================================================================
 * Laboratório de Cafeteria — interface (SPA sem dependências)
 * ===================================================================== */
(function () {
  'use strict';
  const DB = window.CAFE_DB, E = window.Engine;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const KEY = 'cafelab.v1';
  const BEAN = '<svg class="bean-ico" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="8.5" cy="12.5" rx="4.6" ry="7" transform="rotate(-30 8.5 12.5)" fill="currentColor"/><path d="M6.2 6.9c2.4 1.9 2.6 4.4 1.3 6.5-1.2 2-1.4 3.6-.1 5.4" stroke="var(--surface)" stroke-width="1.3" fill="none" stroke-linecap="round"/><ellipse cx="16" cy="10.5" rx="4.2" ry="6.4" transform="rotate(25 16 10.5)" fill="currentColor" opacity=".8"/><path d="M13.6 5.3c2.3 1.6 2.7 3.9 1.7 5.8-1 1.9-1 3.4.3 5" stroke="var(--surface)" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>';

  /* ---------------- Armazenamento de fotos (IndexedDB) ---------------- */
  const CafeFotoStore = (() => {
    const DB_NAME = 'cafelab_media';
    const STORE = 'fotos';
    let dbPromise = null;
    function getDB() {
      if (!dbPromise) {
        dbPromise = new Promise((resolve) => {
          if (!window.indexedDB) return resolve(null);
          try {
            const req = window.indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
              const db = e.target.result;
              if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
          } catch (e) { resolve(null); }
        });
      }
      return dbPromise;
    }
    async function set(id, dataUrl) {
      if (!id) return;
      try {
        const db = await getDB();
        if (!db) return;
        return new Promise((resolve) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.objectStore(STORE).put(dataUrl, id);
        });
      } catch (e) { /* fallback */ }
    }
    async function get(id) {
      if (!id) return null;
      try {
        const db = await getDB();
        if (!db) return null;
        return new Promise((resolve) => {
          const tx = db.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
      } catch (e) { return null; }
    }
    async function del(id) {
      if (!id) return;
      try {
        const db = await getDB();
        if (!db) return;
        return new Promise((resolve) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.objectStore(STORE).delete(id);
        });
      } catch (e) { /* fallback */ }
    }
    return { set, get, del };
  })();

  /* ---------------- Estado / armazenamento ---------------- */
  let state = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.graos) return s; } catch (e) { /* ignore */ }
    return { graos: [], moedores: [], extracoes: [], metodos: [], config: { tema: 'auto', notaAlvo: 8 } };
  }
  function save() {
    registrarMetodos();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      try {
        const copiaLeve = {
          ...state,
          graos: state.graos.map((g) => {
            if (g.foto) {
              CafeFotoStore.set(g.id, g.foto);
              const { foto, ...resto } = g;
              return { ...resto, _idbFoto: true };
            }
            return g;
          })
        };
        localStorage.setItem(KEY, JSON.stringify(copiaLeve));
      } catch (e2) {
        toast('Não foi possível salvar: o armazenamento do navegador está cheio. Remova algumas fotos ou faça backup.');
      }
    }
    try { hooks.salvo.forEach((fn) => fn()); } catch (e) { /* módulos ainda não carregados */ }
  }
  async function hidratarFotos() {
    let mudou = false;
    for (const g of (state.graos || [])) {
      if (!g.foto && g.id) {
        const f = await CafeFotoStore.get(g.id);
        if (f) {
          g.foto = f;
          mudou = true;
        } else if (g.catalogoId && typeof CAFE_FOTOS !== 'undefined' && CAFE_FOTOS[g.catalogoId]) {
          g.foto = CAFE_FOTOS[g.catalogoId];
          CafeFotoStore.set(g.id, g.foto);
          mudou = true;
        }
      } else if (g.foto && g.id) {
        CafeFotoStore.set(g.id, g.foto);
      }
    }
    if (mudou) render();
  }
  /* Importa o catálogo nativo (cafés comprados) e os moedores do usuário sem duplicar */
  function seedCatalogo(force) {
    let n = 0, m = 0;
    if (force || (state.config.catalogoVersao || 0) < DB.CATALOGO_VERSAO) {
      DB.catalogo.forEach((c) => {
        if (state.graos.some((g) => g.catalogoId === c.catalogoId)) return;
        const foto = (typeof CAFE_FOTOS !== 'undefined' && CAFE_FOTOS[c.catalogoId]) || c.foto || '';
        const novo = { ...c, id: uid(), criadoEm: new Date().toISOString(), dataTorra: '' };
        if (foto) {
          novo.foto = foto;
          CafeFotoStore.set(novo.id, foto);
        }
        state.graos.push(novo); n++;
      });
      DB.moedoresModelo.filter((mm) => mm.id).forEach((mm) => {
        if (state.moedores.some((x) => x.modeloId === mm.id)) return;
        state.moedores.push({ id: uid(), modeloId: mm.id, nome: mm.nome, tipo: mm.tipo, min: mm.min, max: mm.max, passo: mm.passo, direcao: mm.direcao || 'menor=fino', refs: { ...mm.refs }, obs: mm.obs || '' }); m++;
      });
      state.config.catalogoVersao = DB.CATALOGO_VERSAO;
      save();
    }
    if ((state.config.moedoresVersao || 0) < 2) { // atualiza escalas/referências dos moedores pré-cadastrados
      DB.moedoresModelo.filter((mm) => mm.id).forEach((mm) => {
        const m = state.moedores.find((x) => x.modeloId === mm.id);
        if (m) Object.assign(m, { nome: mm.nome, tipo: mm.tipo, min: mm.min, max: mm.max, passo: mm.passo, direcao: mm.direcao, refs: { ...mm.refs }, obs: mm.obs });
        else state.moedores.push({ id: uid(), modeloId: mm.id, nome: mm.nome, tipo: mm.tipo, min: mm.min, max: mm.max, passo: mm.passo, direcao: mm.direcao, refs: { ...mm.refs }, obs: mm.obs });
      });
      state.config.moedoresVersao = 2; save();
    }
    if ((state.config.moedoresVersao || 0) < 3) { // E55 Pro recalibrado pelo uso real
      const mm = DB.moedoresModelo.find((x) => x.id === 'starseeker-e55-pro');
      const m = state.moedores.find((x) => x.modeloId === mm.id);
      if (m) Object.assign(m, { max: mm.max, passo: mm.passo, refs: { ...mm.refs }, obs: mm.obs });
      state.config.moedoresVersao = 3; save();
    }
    if ((state.config.moedoresVersao || 0) < 4) { // K2 e JX-Pro recalibrados pelo uso real
      ['kingrinder-k2', '1zpresso-jx-pro'].forEach((id) => {
        const mm = DB.moedoresModelo.find((x) => x.id === id);
        const m = state.moedores.find((x) => x.modeloId === id);
        if (m) Object.assign(m, { max: mm.max, passo: mm.passo, refs: { ...mm.refs }, obs: mm.obs });
      });
      state.config.moedoresVersao = 4; save();
    }
    if ((state.config.moedoresVersao || 0) < 5) { // µm por clique: tamanho realista dos ajustes de moagem
      DB.moedoresModelo.filter((mm) => mm.id && mm.umPorClique).forEach((mm) => { const m = state.moedores.find((x) => x.modeloId === mm.id); if (m && !m.umPorClique) m.umPorClique = mm.umPorClique; });
      state.config.moedoresVersao = 5; save();
    }
    if ((state.config.moedoresVersao || 0) < 6) { // Tramontina by Breville Express (referências por cliques do fabricante)
      const mm = DB.moedoresModelo.find((x) => x.id === 'tramontina-breville-express');
      if (!state.moedores.some((x) => x.modeloId === mm.id)) state.moedores.push({ id: uid(), modeloId: mm.id, nome: mm.nome, tipo: mm.tipo, min: mm.min, max: mm.max, passo: mm.passo, direcao: mm.direcao, passoAjuste: mm.passoAjuste, refs: { ...mm.refs }, obs: mm.obs });
      state.config.moedoresVersao = 6; save();
    }
    if ((state.config.moedoresVersao || 0) < 7) { // Recalibração de moagem para espresso 16 g (cama menor no cesto requer moagem mais fina)
      state.moedores.forEach((m) => {
        const modelo = DB.moedoresModelo.find((x) => (x.id && x.id === m.modeloId) || x.nome === m.nome);
        if (modelo && modelo.refs && modelo.refs.espresso != null) {
          m.refs = m.refs || {};
          m.refs.espresso = modelo.refs.espresso;
          if (modelo.obs) m.obs = modelo.obs;
        }
      });
      state.config.moedoresVersao = 7; save();
    }
    if ((state.config.moedoresVersao || 0) < 8) { // Referências de cliques para Origami e Hario Suiren
      state.moedores.forEach((m) => {
        const modelo = DB.moedoresModelo.find((x) => (x.id && x.id === m.modeloId) || x.nome === m.nome);
        if (modelo && modelo.refs) {
          m.refs = m.refs || {};
          if (m.refs.origami == null && modelo.refs.origami != null) m.refs.origami = modelo.refs.origami;
          if (m.refs.suiren == null && modelo.refs.suiren != null) m.refs.suiren = modelo.refs.suiren;
        }
      });
      state.config.moedoresVersao = 8; save();
    }
    if (!state.config.estoqueV2) { // moedor padrão E55 Pro; grãos que já zeraram ficam sem estoque
      const e55 = state.moedores.find((x) => x.modeloId === 'starseeker-e55-pro');
      if (e55 && !state.config.moedorPadrao) state.config.moedorPadrao = e55.id;
      state.graos.forEach((g) => { const r = restante(g); if (r != null && r <= 0) g.semEstoque = true; });
      state.config.estoqueV2 = true; save();
    }
    if (!state.config.dose10) { // receitas de partida refeitas com 10 g (espresso 18 g); extrações registradas não mudam
      state.graos.forEach((g) => { if (g.dosePadrao != null) g.dosePadrao = null; });
      state.config.dose10 = true; save();
    }
    if (!state.config.estoqueMigrado) {
      state.graos.forEach((g) => { if (g.catalogoId && g.pesoPacote == null) g.pesoPacote = g.catalogoId === 'netcafes-caramelo-chocolate' ? 500 : 250; });
      state.config.estoqueMigrado = true; save();
    }
    return { graos: n, moedores: m };
  }
  const grao = (id) => state.graos.find((g) => g.id === id);
  const moedor = (id) => state.moedores.find((m) => m.id === id);
  /* Moedor padrão das telas de extração (configurável em Equipamentos; padrão de fábrica: E55 Pro) */
  const moedorPadrao = () => moedor(state.config.moedorPadrao) || state.moedores.find((m) => m.modeloId === 'starseeker-e55-pro') || state.moedores[0] || null;
  const extracao = (id) => state.extracoes.find((x) => x.id === id);
  const metodo = (id) => DB.metodo[id];

  /* ---------------- Métodos: nativos + personalizados ----------------
   * Os personalizados ficam em state.metodos (sincronizam) e herdam o
   * comportamento de um método nativo (base) no motor. */
  const NATIVOS = DB.metodos.slice();
  const ICO = (k, cls) => (window.IconesMetodo ? window.IconesMetodo.svg(k, cls) : '');
  function montarMetodo(c) {
    const b = NATIVOS.find((x) => x.id === c.base) || DB.metodo.v60;
    const o = Object.assign({}, b, c);
    o.base = b.base || b.id; // o motor enxerga sempre um método nativo "raiz"
    o.baseEscolhida = b.id;
    o.ratio = Object.assign({}, b.ratio, c.ratio); o.tempC = Object.assign({}, b.tempC, c.tempC); o.tempoS = Object.assign({}, b.tempoS, c.tempoS);
    o.tipo = b.tipo; o.custom = true; o.curto = c.nome;
    o.receita = c.receita || `Personalizado a partir de ${b.nome}.`;
    o.ico = c.ico || b.ico || b.id; o.icone = ICO(o.ico);
    return o;
  }
  function registrarMetodos() {
    if (!Array.isArray(state.metodos)) state.metodos = [];
    const custom = state.metodos.map(montarMetodo);
    DB.metodos.length = 0; NATIVOS.concat(custom).forEach((m) => DB.metodos.push(m));
    Object.keys(DB.metodo).forEach((k) => { if (!NATIVOS.some((n) => n.id === k)) delete DB.metodo[k]; });
    Object.keys(DB.receitas).forEach((k) => { if (!NATIVOS.some((n) => n.id === k)) delete DB.receitas[k]; });
    custom.forEach((m) => {
      DB.metodo[m.id] = m;
      DB.receitas[m.id] = m.etapas && m.etapas.length ? { nome: m.nome, etapas: m.etapas } : DB.receitas[m.baseEscolhida] || DB.receitas[m.base];
    });
  }
  registrarMetodos();
  const ocultos = () => state.config.metodosOcultos || [];
  const metodoVisivel = (m) => m && !m.arquivado && !ocultos().includes(m.id);
  const metodosVisiveis = () => DB.metodos.filter(metodoVisivel);
  const nomeCurto = (m) => m.curto || m.nome.split(' (')[0];
  /* Método que abre a extração por grão: o último usado com esse grão; senão a V60 */
  function metodoInicial(graoId) {
    const ult = state.extracoes.filter((x) => x.graoId === graoId && metodoVisivel(metodo(x.metodoId))).sort((a, b) => new Date(b.data) - new Date(a.data))[0];
    if (ult) return ult.metodoId;
    return metodoVisivel(DB.metodo.v60) ? 'v60' : (metodosVisiveis()[0] || DB.metodo.v60).id;
  }

  /* Histórico grão × método × moedor em ordem cronológica, com diag */
  function historico(graoId, metodoId, moedorId) {
    return state.extracoes
      .filter((x) => x.graoId === graoId && x.metodoId === metodoId && (!moedorId || x.moedorId === moedorId))
      .sort((a, b) => new Date(a.data) - new Date(b.data))
      .map(withDiag);
  }
  function withDiag(x) { const m = metodo(x.metodoId); if (m) x.diag = E.diagnose(x, m, grao(x.graoId)); return x; }

  /* ---------------- Utilidades UI ---------------- */
  let toastT;
  function toast(msg) { const t = $('#toast'); t.innerHTML = `<div class="toast">${esc(msg)}</div>`; clearTimeout(toastT); toastT = setTimeout(() => (t.innerHTML = ''), 2600); }
  function fmtData(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function fmtDia(iso) { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR'); }
  function nowLocal() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
  function isoLocal(iso) { const d = new Date(iso); if (isNaN(d)) return nowLocal(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
  function parseTempo(s) {
    s = String(s || '').trim().toLowerCase().replace(',', '.'); if (!s) return null;
    let m;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*h$/))) return Math.round(parseFloat(m[1]) * 3600);
    if ((m = s.match(/^(\d+)\s*[:m]\s*(\d{1,2})\s*s?$/))) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    if ((m = s.match(/^(\d+)\s*m(?:in)?$/))) return parseInt(m[1], 10) * 60;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*s?$/))) return Math.round(parseFloat(m[1]));
    return null;
  }
  /* Tempo para campos editáveis: sempre m:ss (0:28, 2:45); horas como 14h */
  function tempoCampo(sg) {
    sg = Math.round(Number(sg) || 0);
    if (sg >= 3600) return `${String(Math.round((sg / 3600) * 10) / 10).replace('.', ',')}h`;
    return `${Math.floor(sg / 60)}:${String(sg % 60).padStart(2, '0')}`;
  }
  function nomeGrao(g) { return g ? g.nome : '(grão removido)'; }
  function badgeDiag(d) { return d ? `<span class="badge ${d.cor}">${esc(d.rotulo)}</span>` : ''; }
  function chipsSel(name, opts, selected, cls) {
    return `<div class="chips" data-chips="${name}">${opts.map((o) => {
      const id = typeof o === 'string' ? o : o.id, lbl = typeof o === 'string' ? o : o.nome, extra = typeof o === 'string' ? '' : (o.tipo || '');
      return `<button type="button" class="chip ${extra} ${selected.includes(id) ? 'on' : ''} ${cls || ''}" data-v="${esc(id)}" title="${esc(typeof o === 'string' ? '' : o.dica || '')}">${esc(lbl)}</button>`;
    }).join('')}</div>`;
  }
  function chipsVal(root, name) { return $$(`[data-chips="${name}"] .chip.on`, root).map((c) => c.dataset.v); }
  function bindChips(root) { if (!root || root._chipsOk) return; root._chipsOk = true; root.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c && !c.classList.contains('static')) { c.classList.toggle('on'); c.dispatchEvent(new CustomEvent('chipchange', { bubbles: true })); } }); }
  function sel(name, opts, val, attrs) { return `<select name="${name}" ${attrs || ''}>${opts.map((o) => `<option value="${esc(o.id)}" ${o.id === val ? 'selected' : ''}>${esc(o.nome)}</option>`).join('')}</select>`; }
  function range(name, lbl, val, min, max, step) { return `<div class="range-row"><span class="lbl">${lbl}</span><input type="range" name="${name}" min="${min}" max="${max}" step="${step || 1}" value="${val}" oninput="this.nextElementSibling.value=this.value"><output>${val}</output></div>`; }
  /* Controle com − / + para ajuste fino (arrastar continua funcionando) */
  const fmtVal = (v) => String(v).replace('.', ',');
  function rangeFino(name, lbl, val, min, max, step, style) {
    return `<div class="range-row passos"${style ? ` style="${style}"` : ''}><span class="lbl">${lbl}</span><button type="button" class="passo-btn" data-passo="-1" aria-label="Diminuir ${lbl}">−</button><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${val}" oninput="this.closest('.range-row').querySelector('output').value=String(this.value).replace('.',',')"><button type="button" class="passo-btn" data-passo="1" aria-label="Aumentar ${lbl}">+</button><output>${fmtVal(val)}</output></div>`;
  }
  function setRange(inp, v) { inp.value = v; const o = inp.closest('.range-row').querySelector('output'); if (o) o.value = fmtVal(inp.value); }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.passo-btn'); if (!b) return;
    const inp = b.closest('.range-row').querySelector('input[type=range]');
    const st = +inp.step || 1, v = Math.min(+inp.max, Math.max(+inp.min, Math.round((+inp.value + st * +b.dataset.passo) / st) * st));
    setRange(inp, Math.round(v * 100) / 100);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  function confirmar(msg) { return window.confirm(msg); }

  /* ---------------- Receita / despejos ---------------- */
  function tabelaReceita(rec, m, editable) {
    if (!rec) return '';
    const esp = E.isEspresso(m);
    const rows = rec.etapas.map((e, i) => editable
      ? `<tr data-row><td class="n">${i + 1}</td><td><input type="text" name="pt" value="${tempoCampo(e.t)}" inputmode="numeric" style="width:70px"></td><td><input type="number" name="pa" value="${e.acumulado}" step="0.1" inputmode="decimal" style="width:80px"></td><td><input type="text" name="pd" value="${esc(e.desc || '')}" placeholder="obs"></td><td><button type="button" class="rm" title="Remover">✕</button></td></tr>`
      : `<tr><td class="n">${e.n || i + 1}</td><td>${E.fmtTempo(e.t)}</td><td><strong>${e.acumulado} g</strong>${e.despejo ? ` <small class="muted">(+${e.despejo})</small>` : ''}</td><td class="text-2">${esc(e.desc || '')}</td></tr>`).join('');
    return `<div class="tbl-wrap"><table class="pours"><thead><tr><th>#</th><th>Tempo</th><th>${esp ? 'Bebida acum.' : 'Água acum.'}</th><th>${editable ? 'Observação' : 'O que fazer'}</th>${editable ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function lerDespejos(root) {
    return $$('tr[data-row]', root).map((tr) => ({ t: parseTempo($('[name=pt]', tr).value) || 0, acumulado: +$('[name=pa]', tr).value || 0, desc: $('[name=pd]', tr).value.trim() })).filter((d) => d.acumulado || d.t || d.desc);
  }

  /* ---------------- Modal ---------------- */
  function modal(html, onMount) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-bg"><div class="sheet" role="dialog" aria-modal="true"><div class="handle"></div>${html}</div></div>`;
    m.querySelector('.modal-bg').addEventListener('click', (e) => { if (e.target.classList.contains('modal-bg')) closeModal(); });
    $$('[data-close]', m).forEach((b) => b.addEventListener('click', closeModal));
    bindChips(m);
    if (onMount) onMount(m.querySelector('.sheet'));
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { $('#modal').innerHTML = ''; document.body.style.overflow = ''; }

  /* Tabelas .tbl-stack: cada célula recebe o título da coluna (vira cartão no celular) */
  function rotularTabelas(root) {
    $$('table.tbl-stack', root).forEach((t) => {
      const th = $$('thead th', t).map((h) => h.textContent.trim());
      $$('tbody tr', t).forEach((tr) => Array.from(tr.children).forEach((td, i) => { if (th[i] && !td.dataset.label) td.dataset.label = th[i]; }));
    });
  }
  /* Mantém o balão de dica dentro do gráfico (não empurra a página para o lado) */
  function posicionarDica(tip, box, x, y) {
    const bw = box.clientWidth, tw = tip.offsetWidth;
    tip.style.left = Math.max(tw / 2 + 2, Math.min(bw - tw / 2 - 2, x)) + 'px';
    tip.style.top = y + 'px';
  }
  window.__posicionarDica = posicionarDica;

  /* ---------------- Router ---------------- */
  const routes = {};
  let histStack = [];
  function go(hash) { location.hash = hash; }
  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '') || 'inicio';
    const [path, qs] = h.split('?');
    const parts = path.split('/');
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    return { name: parts[0], id: parts[1], q };
  }
  function render() {
    const r = parseRoute();
    const fn = routes[r.name] || routes.inicio;
    const view = $('#view');
    closeModal();
    view.innerHTML = '';
    const top = ['inicio', 'diario', 'nova', 'graos', 'mais', 'escolher'].includes(r.name) && !r.id;
    $('#btnBack').hidden = top;
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.route === r.name || (r.name === 'grao' && a.dataset.route === 'graos') || (r.name === 'extracao' && a.dataset.route === 'diario') || (r.name === 'escolher' && a.dataset.route === 'nova') || (['moedores', 'equipamentos', 'biblioteca', 'ajustes', 'cafeina', 'latte'].includes(r.name) && a.dataset.route === 'mais')));
    fn(view, r);
    rotularTabelas(view);
    bindChips(view);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  $('#btnBack').addEventListener('click', () => { if (history.length > 1) history.back(); else go('#/inicio'); });

  /* ---------------- Tema ---------------- */
  function applyTheme() {
    const t = state.config.tema || 'auto';
    const isDark = t === 'dark' || (t === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

    // Mantém a barra de gestos / navegação do Android e a status bar na cor da aplicação
    const corTema = isDark ? '#1f1814' : '#6f4e37';
    const metasTheme = document.querySelectorAll('meta[name="theme-color"]');
    if (metasTheme.length) {
      metasTheme.forEach((m) => m.setAttribute('content', corTema));
    } else {
      const metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      metaTheme.setAttribute('content', corTema);
      document.head.appendChild(metaTheme);
    }
  }
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if ((state.config.tema || 'auto') === 'auto') applyTheme();
      });
    } catch (e) { /* fallback navegadores antigos */ }
  }
  $('#btnTheme').addEventListener('click', () => {
    const order = ['auto', 'light', 'dark'];
    state.config.tema = order[(order.indexOf(state.config.tema || 'auto') + 1) % 3];
    save(); applyTheme(); toast(`Tema: ${{ auto: 'automático', light: 'claro', dark: 'escuro' }[state.config.tema]}`);
  });

  /* ======================= INÍCIO ======================= */
  routes.inicio = (view) => {
    $('#title').textContent = 'Laboratório de Cafeteria';
    const ultimas = state.extracoes.slice().sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5).map(withDiag);
    const graosAtivos = state.graos.filter((g) => !g.arquivado);
    const calibs = graosAtivos.map((g) => {
      const porMetodo = {};
      state.extracoes.filter((x) => x.graoId === g.id).forEach((x) => { (porMetodo[x.metodoId] = porMetodo[x.metodoId] || []).push(x); });
      const cal = Object.entries(porMetodo).map(([mid, xs]) => ({ mid, ...E.calibration(xs.sort((a, b) => new Date(a.data) - new Date(b.data)).map(withDiag), { notaAlvo: state.config.notaAlvo }) }));
      return { g, cal };
    });
    const total = state.extracoes.length;
    const calibradas = calibs.reduce((n, c) => n + c.cal.filter((x) => x.status === 'calibrado').length, 0);
    const medias = calibs.flatMap((c) => c.cal).filter((c) => c.tentativasAteCalibrar).map((c) => c.tentativasAteCalibrar);
    const mediaTent = medias.length ? (medias.reduce((a, b) => a + b, 0) / medias.length).toFixed(1) : '—';

    view.innerHTML = `
      ${saudacaoPingo()}
      <div class="qa-grid">${tilesInicio()}${hooks.tiles.map((fn) => fn()).join('')}</div>
      ${hooks.home.map((fn) => fn()).join('')}
      <div class="row" style="margin-top:14px">
        <a class="btn primary" href="#/nova">＋ Nova extração</a>
        <a class="btn" href="#/graos?novo=1">Cadastrar grão</a>
        ${state.moedores.length ? '' : '<a class="btn" href="#/moedores?novo=1">Cadastrar moedor</a>'}
      </div>
      <div class="stats" style="margin-top:14px">
        <div class="stat"><span class="lbl">Extrações</span><div class="hero-num">${total}</div></div>
        <div class="stat"><span class="lbl">Grãos do catálogo</span><div class="hero-num">${graosAtivos.length}</div></div>
        <div class="stat"><span class="lbl">Receitas calibradas</span><div class="hero-num">${calibradas}</div></div>
        <div class="stat"><span class="lbl">Tentativas até calibrar</span><div class="hero-num">${mediaTent}</div></div>
      </div>
      ${!state.graos.length ? `<div class="card soft" style="margin-top:16px"><h3>Como começar</h3><ol style="margin:0;padding-left:18px;color:var(--text-2)"><li>Cadastre seu <a href="#/moedores?novo=1">moedor</a> (escala de cliques).</li><li>Cadastre o <a href="#/graos?novo=1">grão</a> com região, processo e torra — o app sugere a receita de partida.</li><li>Registre a extração com a nota de xícara e os sinais que percebeu; o motor calcula o ajuste para a próxima.</li></ol></div>` : ''}
      <div class="section-title"><h2>Calibração em andamento</h2></div>
      ${calibs.some((c) => !c.cal.length) ? `<p class="text-2" style="margin:0 0 8px"><small>${calibs.filter((c) => !c.cal.length).length} grão(s) ainda sem extração · <a href="#/graos">ver todos</a></small></p>` : ''}
      ${calibs.some((c) => c.cal.length) ? `<div class="grid">${calibs.filter((c) => c.cal.length).map(({ g, cal }) => `
        <div class="card clickable" onclick="location.hash='#/grao/${g.id}'">
          <div class="row between"><h3>${esc(g.nome)}</h3>${cal.some((c) => c.status === 'calibrado') ? '<span class="badge ok">✓ calibrado</span>' : cal.length ? '<span class="badge accent">ajustando</span>' : '<span class="badge">novo</span>'}</div>
          <small>${esc((DB.regiao[g.regiao] || {}).nome || '')} · ${esc((DB.processo[g.processo] || {}).nome.split(' (')[0] || '')} · torra ${esc((DB.torra[g.torra] || {}).nome || '').toLowerCase()}</small>
          ${cal.length ? `<div class="chips" style="margin-top:8px">${cal.map((c) => `<span class="chip static ${c.status === 'calibrado' ? 'on' : ''}">${esc(metodo(c.mid).nome)} · ${c.tentativas}×${c.melhor && c.melhor.nota ? ` · melhor ${c.melhor.nota}` : ''}</span>`).join('')}</div>` : '<small class="muted">Nenhuma extração ainda.</small>'}
        </div>`).join('')}</div>` : `<div class="empty"><div class="big">${BEAN}</div>${calibs.length ? 'Nenhuma calibração começou. Escolha um grão e registre a primeira extração.' : 'Nenhum grão cadastrado.'}</div>`}
      <div class="section-title"><h2>Últimas extrações</h2><a href="#/diario">ver todas</a></div>
      ${ultimas.length ? `<div class="list">${ultimas.map(itemExtracao).join('')}</div>` : '<div class="empty"><div class="big">📓</div>O diário está vazio.</div>'}
    `;
  };

  /* ---------- Início: Pingo + cartões de ação rápida ---------- */
  function ultimaExtracao() { return state.extracoes.slice().sort((a, b) => new Date(b.data) - new Date(a.data))[0]; }
  function saudacaoPingo() {
    if (!window.Mascote) return '';
    const h = new Date().getHours();
    const oi = h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    let humor = 'feliz', txt = 'Bora calibrar um café hoje?';
    const ult = ultimaExtracao();
    if (window.CafeCafeina) { const f = window.Mascote.porCafeina(window.CafeCafeina.resumo()); humor = f.humor; txt = f.texto; }
    if (ult && (humor === 'feliz' || humor === 'sonolento')) {
      withDiag(ult);
      const g = grao(ult.graoId), m = metodo(ult.metodoId);
      if (ult.nota >= 8) { humor = humor === 'sonolento' ? humor : 'radiante'; txt += ` Sua última extração de ${g ? g.nome : 'café'} (${m ? m.nome : ''}) tirou nota ${ult.nota}.`; }
      else if (ult.diag && ult.diag.cor !== 'ok') { txt += ` A última de ${g ? g.nome : 'café'} pediu ajuste: ${ult.diag.rotulo.toLowerCase()}.`; }
    }
    return `<div style="margin-bottom:4px">${window.Mascote.card(humor, txt, { titulo: `${oi}! Eu sou o Pingo.` })}</div>`;
  }
  function tilesInicio() {
    const ult = ultimaExtracao();
    const g = ult && grao(ult.graoId), m = ult && metodo(ult.metodoId);
    const rep = ult && g ? `<a class="qa-tile destaque" href="#/nova?from=${ult.id}&repetir=1"><span class="qa-ico">🔁</span><span class="qa-t">Repetir última receita</span><span class="qa-s">${esc(g.nome)} · ${esc(m ? m.nome : '')}${ult.nota ? ' · nota ' + ult.nota : ''}</span></a>`
      : `<a class="qa-tile destaque" href="#/nova"><span class="qa-ico">＋</span><span class="qa-t">Nova extração</span><span class="qa-s">registre e calibre</span></a>`;
    const timer = ult && g ? `<a class="qa-tile" href="#/nova?from=${ult.id}&repetir=1&timer=1"><span class="qa-ico">⏱</span><span class="qa-t">Timer guiado</span><span class="qa-s">com a última receita</span></a>` : '';
    const est = estoqueResumo();
    const estoque = `<a class="qa-tile" href="#/graos?estoque=1"><span class="qa-ico">📦</span><span class="qa-t">Estoque</span><span class="qa-s">${est.total ? `${est.gramas} g em ${est.total} grão(s)` : 'informe o peso dos pacotes'}</span>${est.acabando ? `<span class="badge sobre">⚠ ${est.acabando} acabando</span>` : ''}</a>`;
    const porMetodo = `<a class="qa-tile" href="#/escolher"><span class="qa-ico">${ICO('v60')}</span><span class="qa-t">Escolher por método</span><span class="qa-s">veja os cafés indicados</span></a>`;
    return rep + porMetodo + timer + estoque;
  }

  /* ---------- Estoque ---------- */
  const pacotes = (g) => (g && g.pacotes != null && g.pacotes !== '' ? Math.max(0, +g.pacotes) : 1);
  function restante(g) {
    if (!g || !(+g.pesoPacote)) return null;
    const usado = state.extracoes.filter((x) => x.graoId === g.id).reduce((s, x) => s + (+x.dose || 0), 0);
    return Math.max(0, Math.round(pacotes(g) * +g.pesoPacote - (+g.usadoAntes || 0) - usado));
  }
  /* Sem estoque: marcado à mão ou automaticamente quando o estoque chega a 0; some das telas de extração */
  const disponivel = (g) => g && !g.arquivado && !g.semEstoque;
  function marcarSeZerou(g, antes) {
    if (!g || g.semEstoque) return;
    const r = restante(g);
    if (r != null && r <= 0 && (antes == null || antes > 0)) { g.semEstoque = true; setTimeout(() => toast(`${g.nome} acabou: marcado como sem estoque`), 2700); }
  }
  function addPacote(g, n) {
    g.pacotes = pacotes(g) + (n || 1);
    if (g.semEstoque && restante(g) > 0) delete g.semEstoque;
  }
  function dosesRestantes(g, r) {
    const xs = state.extracoes.filter((x) => x.graoId === g.id);
    const dose = xs.length ? xs.reduce((s, x) => s + (+x.dose || 0), 0) / xs.length : (+g.dosePadrao || 10);
    return Math.floor(r / dose);
  }
  function estoqueResumo() {
    const ativos = state.graos.filter((g) => disponivel(g) && restante(g) != null);
    const gramas = ativos.reduce((s, g) => s + restante(g), 0);
    const acabando = ativos.filter((g) => restante(g) > 0 && dosesRestantes(g, restante(g)) <= 3).length;
    return { total: ativos.length, gramas, acabando };
  }
  function badgeEstoque(g) {
    if (g.semEstoque) return '<span class="badge">sem estoque</span>';
    const r = restante(g); if (r == null) return '';
    const d = dosesRestantes(g, r);
    return r <= 0 ? '<span class="badge">acabou</span>' : `<span class="badge ${d <= 3 ? 'sobre' : ''}">${d <= 3 ? '⚠ ' : ''}${r} g · ~${d} doses</span>`;
  }

  /* ---------- Foto do café: comprimida (máx. 480 px, JPEG) e guardada no próprio grão ---------- */
  function fotoDeArquivo(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não foi possível abrir a foto.')); };
      img.src = url;
    });
  }
  const fotoOk = (f) => typeof f === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f);
  function icoGrao(g) { return g && fotoOk(g.foto) ? `<div class="ico foto"><img src="${g.foto}" alt="" loading="lazy"></div>` : `<div class="ico">${BEAN}</div>`; }
  function verFoto(src) {
    const d = document.createElement('div'); d.className = 'foto-zoom'; d.innerHTML = `<img src="${src}" alt="Foto do café">`;
    d.onclick = () => d.remove(); document.body.appendChild(d);
  }

  function itemExtracao(x) {
    const g = grao(x.graoId), m = metodo(x.metodoId);
    return `<div class="item" onclick="location.hash='#/extracao/${x.id}'">
      <div class="ico">${m ? m.icone : '☕'}</div>
      <div><div class="t">${esc(nomeGrao(g))} <small class="muted">· ${esc(m ? m.nome : '')}</small></div>
        <div class="s">${fmtData(x.data)} · ${x.clicks != null ? E.fmtClicks(x.clicks) + ' cl · ' : ''}${x.dose} g · 1:${x.ratio} · ${x.tempC} °C · ${E.fmtTempo(x.tempoS)}</div>
        <div style="margin-top:4px">${badgeDiag(x.diag)}</div></div>
      <div class="right"><div class="score">${x.nota != null && x.nota !== '' ? Number(x.nota).toFixed(1) : '—'}</div><small>nota</small></div>
    </div>`;
  }

  /* ======================= EXPORTAÇÃO CSV ======================= */
  function exportarCSV(extracoes) {
    const xs = extracoes || state.extracoes;
    if (!xs || !xs.length) return toast('Nenhuma extração para exportar');
    const cols = [
      'Data/Hora', 'Grão', 'Torrefação', 'Produtor', 'Região', 'Processo', 'Torra',
      'Método', 'Moedor', 'Cliques', 'Dose (g)', 'Água/Bebida (g)', 'Razão (1:X)',
      'Temperatura (°C)', 'Tempo (s)', 'Nota', 'Diagnóstico', 'TDS (%)', 'EY (%)',
      'Cafeína (mg)', 'Descritores', 'Observações'
    ];
    const escapeCSV = (v) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };
    const rows = xs.map((x) => {
      withDiag(x);
      const g = grao(x.graoId) || {};
      const m = metodo(x.metodoId) || {};
      const md = moedor(x.moedorId) || {};
      const reg = DB.regiao[g.regiao] || {};
      const proc = DB.processo[g.processo] || {};
      const tor = DB.torra[g.torra] || {};
      const cafeinaDose = (state.cafeina || []).find((c) => c.extracaoId === x.id);
      return [
        x.data || '',
        g.nome || '',
        g.torrefacao || '',
        g.produtor || '',
        reg.nome || '',
        proc.nome || '',
        tor.nome || '',
        m.nome || '',
        md.nome || '',
        x.clicks != null ? x.clicks : '',
        x.dose != null ? x.dose : '',
        x.water != null ? x.water : '',
        x.ratio != null ? x.ratio : '',
        x.tempC != null ? x.tempC : '',
        x.tempoS != null ? x.tempoS : '',
        x.nota != null ? x.nota : '',
        x.diag && x.diag.rotulo ? x.diag.rotulo : '',
        x.tds != null ? x.tds : '',
        x.diag && x.diag.ey != null ? x.diag.ey : '',
        cafeinaDose ? cafeinaDose.mg : '',
        (x.descritores || []).join(', '),
        x.obs || ''
      ].map(escapeCSV).join(';');
    });
    const csvContent = '\uFEFF' + [cols.map(escapeCSV).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cafelab-extracoes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`${xs.length} extração(ões) exportada(s) em CSV`);
  }

  /* ======================= DIÁRIO ======================= */
  routes.diario = (view, r) => {
    $('#title').textContent = 'Diário de extrações';
    const fg = r.q.grao || '', fm = r.q.metodo || '';
    let xs = state.extracoes.slice().map(withDiag);
    if (fg) xs = xs.filter((x) => x.graoId === fg);
    if (fm) xs = xs.filter((x) => x.metodoId === fm);
    xs.sort((a, b) => new Date(b.data) - new Date(a.data));
    view.innerHTML = `
      <div class="row" style="gap:8px;align-items:center">
        <select id="fGrao" style="flex:1;min-width:130px"><option value="">Todos os grãos</option>${state.graos.map((g) => `<option value="${g.id}" ${g.id === fg ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select>
        <select id="fMet" style="flex:1;min-width:130px"><option value="">Todos os métodos</option>${DB.metodos.map((m) => `<option value="${m.id}" ${m.id === fm ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>
        <button class="btn sm" id="btnExportCSV" title="Exportar para planilha (CSV)">📊 CSV</button>
      </div>
      <div class="list" style="margin-top:12px">${xs.length ? xs.map(itemExtracao).join('') : '<div class="empty"><div class="big">📓</div>Nenhuma extração com esse filtro.</div>'}</div>`;
    const upd = () => go(`#/diario?grao=${$('#fGrao').value}&metodo=${$('#fMet').value}`);
    $('#fGrao').onchange = upd; $('#fMet').onchange = upd;
    $('#btnExportCSV').onclick = () => exportarCSV(xs);
  };

  /* ======================= DETALHE DA EXTRAÇÃO ======================= */
  routes.extracao = (view, r) => {
    const x = extracao(r.id); if (!x) { view.innerHTML = '<div class="empty">Extração não encontrada.</div>'; return; }
    withDiag(x);
    const g = grao(x.graoId), m = metodo(x.metodoId) || Object.assign({}, DB.metodo.v60, { id: x.metodoId, nome: '(método removido)' }), md = moedor(x.moedorId);
    $('#title').textContent = 'Extração';
    const hist = historico(x.graoId, x.metodoId, x.moedorId);
    const idx = hist.findIndex((h) => h.id === x.id);
    const antes = hist.slice(0, Math.max(0, idx));
    const reco = E.recommend(x, antes, m, md, g || {}, { notaAlvo: state.config.notaAlvo });
    view.innerHTML = `
      <div class="card">
        <div class="row between"><div><h2>${esc(nomeGrao(g))}</h2><small>${m.icone} ${esc(m.nome)} · ${md ? esc(md.nome) : 'sem moedor'} · ${fmtData(x.data)}${x.editadoEm ? ' · editado' : ''}</small> <a href="#/nova?editar=${x.id}" class="link-editar">✏️ editar</a></div>
          <div class="right"><div class="hero-num">${x.nota !== '' && x.nota != null ? Number(x.nota).toFixed(1) : '—'}</div><small>nota</small></div></div>
        <div class="kv" style="margin-top:10px">
          ${x.clicks != null ? `<div><span class="lbl">Moagem</span><div class="v">${E.fmtClicks(x.clicks)} cl</div></div>` : ''}
          <div><span class="lbl">Dose</span><div class="v">${x.dose} g</div></div>
          <div><span class="lbl">${E.isEspresso(m) ? 'Bebida' : 'Água'}</span><div class="v">${x.water} g</div></div>
          <div><span class="lbl">Razão</span><div class="v">1:${E.fmtN(x.ratio)}</div></div>
          <div><span class="lbl">Temperatura</span><div class="v">${E.fmtN(x.tempC)} °C</div></div>
          <div><span class="lbl">Tempo</span><div class="v">${E.fmtTempo(x.tempoS)}</div></div>
          ${x.tds ? `<div><span class="lbl">TDS / EY</span><div class="v">${x.tds} % / ${x.diag.ey != null ? x.diag.ey + ' %' : '—'}</div></div>` : ''}
        </div>
        ${x.descritores && x.descritores.length ? `<div class="chips" style="margin-top:10px">${x.descritores.map((d) => `<span class="chip static">${esc(d)}</span>`).join('')}</div>` : ''}
        ${x.obs ? `<p class="text-2" style="margin-top:10px">${esc(x.obs)}</p>` : ''}
        ${x.despejos && x.despejos.length ? `<details class="recipe" style="margin-top:10px" open><summary>Despejos executados (${x.despejos.length})</summary>${tabelaReceita({ etapas: x.despejos }, m, false)}</details>` : ''}
      </div>

      ${window.Mascote ? (() => {
        const f = window.Mascote.porExtracao(x), nv = window.Mascote.nivelExtracao(x), info = window.Mascote.NIVEIS[nv - 1];
        return `<div class="card avaliacao-res" style="margin-top:12px">
          <div class="avaliacao"><div class="av-fig">${window.Mascote.svg(info.humor, { size: 104 })}</div>
          <div class="av-corpo"><span class="lbl">Avaliação do Pingo</span><div class="hero-num">${nv}<small style="font-size:.9rem">/5</small></div><strong>${esc(info.rotulo)}</strong><p class="text-2" style="margin:4px 0 0"><small>${esc(f.texto)}</small></p></div></div>
          ${window.Mascote.escala(nv)}
          <small class="muted">Combina a sua nota (70 %) com o equilíbrio da extração (30 %).</small></div>`;
      })() : ''}
      <div class="card" style="margin-top:12px">
        <h3>Diagnóstico ${badgeDiag(x.diag)}</h3>
        ${barraExtracao(x.diag)}
        ${radar([{ nome: 'Esta extração', v: sens(x), cls: 'a' }].concat(x.diag.leitura ? [{ nome: 'Perfil esperado do grão', v: x.diag.leitura.esperado, cls: 'b' }] : []))}
        ${perfilHtml(x.diag.leitura)}
        ${x.diag.fatores.length ? `<ul class="factors">${x.diag.fatores.map((f) => `<li>${f.v < 0 ? '🔵' : f.v > 0 ? '🟠' : '⚪'} ${esc(f.t)}${f.forca ? ` (força ${f.forca > 0 ? '↑' : '↓'})` : ''}</li>`).join('')}</ul>` : '<small class="muted">Nenhum sinal de desequilíbrio registrado.</small>'}
      </div>

      ${cardReco(reco, m, x)}

      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
        <a class="btn primary sm" href="#/nova?editar=${x.id}">✏️ Editar registro</a>
        <button class="btn sm" id="btnShare">📤 Compartilhar receita</button>
        <button class="btn sm" id="dup">Duplicar como nova</button>
        <button class="btn danger sm" id="del">Excluir</button>
      </div>`;
    $('#del').onclick = () => { if (confirmar('Excluir esta extração?')) { state.extracoes = state.extracoes.filter((e) => e.id !== x.id); hooks.extracaoExcluida.forEach((fn) => fn(x)); save(); toast('Excluída'); go('#/diario'); } };
    $('#dup').onclick = () => go(`#/nova?from=${x.id}&copiar=1`);
    $('#btnShare').onclick = () => modalCompartilharReceita(x, g, m, md);
  };

  /* ================== COMPARTILHAMENTO DE RECEITA EM PNG ================== */
  function wrapCardText(text, maxChars = 40) {
    const words = String(text || '').split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars) {
        if (cur) lines.push(cur.trim());
        cur = w;
      } else {
        cur = (cur + ' ' + w).trim();
      }
    }
    if (cur) lines.push(cur.trim());
    return lines;
  }

  function gerarReceitaCardSvg({ grao, metodo, moedor, extracao, diag }) {
    const g = grao || {};
    const m = metodo || {};
    const md = moedor || null;
    const x = extracao || {};
    const d = diag || (E.diagnostico ? E.diagnostico(x, m) : {});

    const pingoInfo = window.Mascote && window.Mascote.porExtracao ? window.Mascote.porExtracao(x) : { humor: 'feliz', texto: 'Nível de cafeína e extração sob controle!' };
    const humor = pingoInfo.humor || 'feliz';
    const pingoTexto = pingoInfo.texto || 'Nível de cafeína e extração sob controle!';
    const mascoteRawSvg = window.Mascote && window.Mascote.svg ? window.Mascote.svg(humor, { size: 190, anim: false }) : '';

    const nomeG = nomeGrao(g);
    const subGrao = [g.torrefacao, g.produtor, g.regiao ? (DB.regiao[g.regiao] || {}).nome || g.regiao : null].filter(Boolean).join(' • ') || 'Origem do Lote';

    const badges = [];
    if (g.processo) badges.push({ t: (DB.processo[g.processo] || {}).nome ? (DB.processo[g.processo].nome.split(' (')[0]) : g.processo, bg: '#2c2138', fg: '#b995dc' });
    if (g.torra) badges.push({ t: `Torra ${(DB.torra[g.torra] || {}).nome || g.torra}`, bg: '#3d2416', fg: '#f0925a' });
    if (g.variedade) badges.push({ t: g.variedade, bg: '#1d2b3d', fg: '#7fb0ea' });

    const isEsp = E.isEspresso(m);
    const doseStr = `${E.fmtN ? E.fmtN(x.dose) : x.dose} g`;
    const waterLabel = isEsp ? 'BEBIDA EXTRAÍDA' : 'ÁGUA TOTAL';
    const waterStr = `${E.fmtN ? E.fmtN(x.water) : x.water} g (1:${E.fmtN ? E.fmtN(x.ratio) : x.ratio})`;
    const tempStr = `${E.fmtN ? E.fmtN(x.tempC) : x.tempC} °C`;
    const tempoStr = E.fmtTempo ? E.fmtTempo(x.tempoS) : `${x.tempoS}s`;
    const moagemVal = x.clicks != null ? `${E.fmtClicks ? E.fmtClicks(x.clicks) : x.clicks} cl` : '—';
    const moagemSub = md ? md.nome : 'Padrão';

    const notaStr = x.nota != null ? `${Number(x.nota).toFixed(1)}` : '—';
    const dataFormatada = x.data ? new Date(x.data).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : new Date().toLocaleDateString('pt-BR');

    const descritores = (x.descritores || []).slice(0, 6);

    let statusBg = '#17301f', statusFg = '#6fc290', statusLabel = 'Equilibrada • No alvo';
    if (d.cor === 'sub') { statusBg = '#1d2b3d'; statusFg = '#7fb0ea'; statusLabel = 'Sub-extraída'; }
    else if (d.cor === 'sobre') { statusBg = '#3d2416'; statusFg = '#f0925a'; statusLabel = 'Sobre-extraída'; }
    else if (d.cor === 'misto') { statusBg = '#2c2138'; statusFg = '#b995dc'; statusLabel = 'Canalização / Misto'; }

    const pingoLines = wrapCardText(`"${pingoTexto}"`, 42);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="20%" r="85%">
      <stop offset="0%" stop-color="#241a14"/>
      <stop offset="60%" stop-color="#18110d"/>
      <stop offset="100%" stop-color="#0f0b09"/>
    </radialGradient>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#281f18"/>
      <stop offset="100%" stop-color="#1d1510"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e8c298"/>
      <stop offset="50%" stop-color="#c99e74"/>
      <stop offset="100%" stop-color="#9d734c"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <style>
    .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  </style>

  <rect width="1080" height="1350" fill="#0f0b09"/>
  <rect x="24" y="24" width="1032" height="1302" rx="42" fill="url(#bgGrad)" stroke="#38291f" stroke-width="2.5"/>
  <rect x="36" y="36" width="1008" height="1278" rx="32" fill="none" stroke="#c99e74" stroke-width="1.2" stroke-opacity="0.3"/>

  <!-- Topo: Marca e Título do Laboratório -->
  <g transform="translate(70, 75)" class="font-sans">
    <circle cx="28" cy="28" r="28" fill="#2d2017" stroke="#c99e74" stroke-width="1.5"/>
    <text x="28" y="37" font-size="28" text-anchor="middle">☕</text>
    <text x="74" y="27" font-size="21" font-weight="800" fill="url(#goldGrad)" letter-spacing="3">LABORATÓRIO DE CAFETERIA</text>
    <text x="74" y="47" font-size="14" font-weight="600" fill="#a49182" letter-spacing="1.5">FICHA TÉCNICA DE EXTRAÇÃO</text>
  </g>

  <!-- Data no Topo Direito -->
  <g transform="translate(680, 85)" class="font-sans">
    <rect width="330" height="38" rx="19" fill="#221812" stroke="#3a2b21" stroke-width="1"/>
    <text x="165" y="24" font-size="13" font-weight="500" fill="#a49182" text-anchor="middle">${esc(dataFormatada)}</text>
  </g>

  <!-- Card do Grão Principal -->
  <g transform="translate(70, 155)" class="font-sans" filter="url(#shadow)">
    <rect width="940" height="165" rx="24" fill="url(#cardGrad)" stroke="#3e2d21" stroke-width="1.5"/>
    <text x="40" y="58" font-size="34" font-weight="800" fill="#ffffff">${esc(nomeG)}</text>
    <text x="40" y="92" font-size="19" font-weight="500" fill="#c6b6a6">${esc(subGrao)}</text>
    <g transform="translate(40, 112)">
      ${badges.map((b, i) => `
        <g transform="translate(${i * 180}, 0)">
          <rect width="165" height="32" rx="16" fill="${b.bg}" stroke="${b.fg}" stroke-width="1" stroke-opacity="0.4"/>
          <text x="82.5" y="21" font-size="13" font-weight="700" fill="${b.fg}" text-anchor="middle">${esc(b.t)}</text>
        </g>
      `).join('')}
    </g>
  </g>

  <!-- Grid de Parâmetros de Extração (6 cartões 2x3) -->
  <g transform="translate(70, 345)" class="font-sans">
    <g transform="translate(0, 0)">
      <rect width="298" height="135" rx="20" fill="url(#cardGrad)" stroke="#38291f" stroke-width="1.5"/>
      <text x="26" y="38" font-size="13" font-weight="700" fill="#a49182" letter-spacing="1">MÉTODO</text>
      <text x="26" y="80" font-size="25" font-weight="800" fill="#ffffff">${esc(m.nome || 'Método')}</text>
      <text x="26" y="110" font-size="15" font-weight="500" fill="#c6b6a6">${esc(m.tipo || 'Extração')}</text>
    </g>
    <g transform="translate(321, 0)">
      <rect width="298" height="135" rx="20" fill="url(#cardGrad)" stroke="#38291f" stroke-width="1.5"/>
      <text x="26" y="38" font-size="13" font-weight="700" fill="#a49182" letter-spacing="1">MOAGEM</text>
      <text x="26" y="80" font-size="25" font-weight="800" fill="#e8c298">${esc(moagemVal)}</text>
      <text x="26" y="110" font-size="15" font-weight="500" fill="#c6b6a6">${esc(moagemSub)}</text>
    </g>
    <g transform="translate(642, 0)">
      <rect width="298" height="135" rx="20" fill="url(#cardGrad)" stroke="#38291f" stroke-width="1.5"/>
      <text x="26" y="38" font-size="13" font-weight="700" fill="#a49182" letter-spacing="1">${isEsp ? 'DOSE NO FILTRO' : 'DOSE DE CAFÉ'}</text>
      <text x="26" y="80" font-size="25" font-weight="800" fill="#ffffff">${esc(doseStr)}</text>
      <text x="26" y="110" font-size="15" font-weight="500" fill="#c6b6a6">${isEsp ? 'Cama de 16 g' : 'Grãos moídos'}</text>
    </g>
    <g transform="translate(0, 155)">
      <rect width="298" height="135" rx="20" fill="url(#cardGrad)" stroke="#38291f" stroke-width="1.5"/>
      <text x="26" y="38" font-size="13" font-weight="700" fill="#a49182" letter-spacing="1">${esc(waterLabel)}</text>
      <text x="26" y="80" font-size="25" font-weight="800" fill="#ffffff">${esc(waterStr)}</text>
      <text x="26" y="110" font-size="15" font-weight="500" fill="#c6b6a6">Relação café:água</text>
    </g>
    <g transform="translate(321, 155)">
      <rect width="298" height="135" rx="20" fill="url(#cardGrad)" stroke="#38291f" stroke-width="1.5"/>
      <text x="26" y="38" font-size="13" font-weight="700" fill="#a49182" letter-spacing="1">TEMPERATURA</text>
      <text x="26" y="80" font-size="25" font-weight="800" fill="#ffffff">${esc(tempStr)}</text>
      <text x="26" y="110" font-size="15" font-weight="500" fill="#c6b6a6">Água na extração</text>
    </g>
    <g transform="translate(642, 155)">
      <rect width="298" height="135" rx="20" fill="url(#cardGrad)" stroke="#38291f" stroke-width="1.5"/>
      <text x="26" y="38" font-size="13" font-weight="700" fill="#a49182" letter-spacing="1">TEMPO TOTAL</text>
      <text x="26" y="80" font-size="25" font-weight="800" fill="#ffffff">${esc(tempoStr)}</text>
      <text x="26" y="110" font-size="15" font-weight="500" fill="#c6b6a6">Tempo de extração</text>
    </g>
  </g>

  <!-- Seção de Avaliação e Notas Sensoriais -->
  <g transform="translate(70, 665)" class="font-sans" filter="url(#shadow)">
    <rect width="940" height="160" rx="24" fill="url(#cardGrad)" stroke="#38291f" stroke-width="1.5"/>
    <g transform="translate(36, 30)">
      <rect width="180" height="100" rx="18" fill="#1b130e" stroke="#c99e74" stroke-width="1.5"/>
      <text x="90" y="32" font-size="13" font-weight="700" fill="#a49182" text-anchor="middle" letter-spacing="1">AVALIAÇÃO</text>
      <text x="90" y="78" font-size="34" font-weight="900" fill="#e8c298" text-anchor="middle">⭐ ${esc(notaStr)}</text>
    </g>
    <g transform="translate(245, 34)">
      <rect width="210" height="34" rx="17" fill="${statusBg}" stroke="${statusFg}" stroke-width="1" stroke-opacity="0.5"/>
      <text x="105" y="23" font-size="14" font-weight="700" fill="${statusFg}" text-anchor="middle">${esc(statusLabel)}</text>
      <g transform="translate(0, 52)">
        <text x="0" y="16" font-size="14" font-weight="600" fill="#a49182">Notas sensoriais percebidas:</text>
        <g transform="translate(0, 26)">
          ${descritores.length ? descritores.map((desc, i) => `
            <g transform="translate(${i * 135}, 0)">
              <rect width="125" height="28" rx="14" fill="#2d221a" stroke="#4a3729" stroke-width="1"/>
              <text x="62.5" y="19" font-size="12" font-weight="600" fill="#f2eae2" text-anchor="middle">${esc(desc)}</text>
            </g>
          `).join('') : `<text x="0" y="19" font-size="13" fill="#8f7e6f" font-style="italic">Nenhum descritor registrado</text>`}
        </g>
      </g>
    </g>
  </g>

  <!-- Seção do Mascote Pingo -->
  <g transform="translate(70, 855)" class="font-sans">
    <rect width="940" height="270" rx="26" fill="#1d1510" stroke="#3d2c20" stroke-width="1.5"/>
    <g transform="translate(25, 40)">
      ${mascoteRawSvg}
    </g>
    <g transform="translate(245, 45)">
      <path d="M 0 50 L -18 60 L 0 70 Z" fill="#291e17"/>
      <rect width="650" height="180" rx="22" fill="#291e17" stroke="#c99e74" stroke-width="1.2" stroke-opacity="0.4"/>
      <text x="34" y="44" font-size="15" font-weight="800" fill="url(#goldGrad)" letter-spacing="1.5">PINGO ANALISA A EXTRAÇÃO</text>
      <text x="34" y="86" font-size="20" font-weight="600" fill="#ffffff">
        ${pingoLines.map((line, idx) => `<tspan x="34" dy="${idx === 0 ? 0 : 28}">${esc(line)}</tspan>`).join('')}
      </text>
      <text x="34" y="152" font-size="14" font-weight="500" fill="#a49182">— Pingo, o mascote do Laboratório ☕</text>
    </g>
  </g>

  <!-- Rodapé -->
  <g transform="translate(70, 1265)" class="font-sans">
    <line x1="0" y1="0" x2="940" y2="0" stroke="#38291f" stroke-width="1.5"/>
    <text x="0" y="32" font-size="15" font-weight="600" fill="#a49182">Laboratório de Cafeteria • Extrações &amp; Calibração</text>
    <text x="940" y="32" font-size="15" font-weight="700" fill="url(#goldGrad)" text-anchor="end">cafelab.app</text>
  </g>
</svg>`;
  }

  function gerarReceitaPngBlob({ grao, metodo, moedor, extracao, diag }) {
    const svgStr = gerarReceitaCardSvg({ grao, metodo, moedor, extracao, diag });
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1350;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Falha ao gerar blob do canvas'));
          }, 'image/png');
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Falha ao renderizar SVG no canvas'));
      };
      img.src = url;
    });
  }

  async function modalCompartilharReceita(x, g, m, md) {
    const d = withDiag(x).diag || {};
    const isEsp = E.isEspresso(m);
    const nomeG = nomeGrao(g);
    const fileName = `receita-${nomeG.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'cafe'}.png`;

    const notasTxt = x.descritores && x.descritores.length ? `\nNotas sensoriais: ${x.descritores.join(', ')}` : '';
    const notaTxt = x.nota ? `\nAvaliação: ⭐ ${Number(x.nota).toFixed(1)}/10` : '';
    const moagemTxt = x.clicks != null ? `\nMoagem: ${E.fmtClicks(x.clicks)} cl${md ? ` (${md.nome})` : ''}` : '';
    const textoLimpo = `☕ Receita de Café: ${nomeG}
Método: ${m.nome}
Dose: ${x.dose} g de café
${isEsp ? 'Bebida' : 'Água'}: ${x.water} g (Razão 1:${E.fmtN(x.ratio)})
Temperatura: ${E.fmtN(x.tempC)} °C
Tempo: ${E.fmtTempo(x.tempoS)}${moagemTxt}${notaTxt}${notasTxt}

Extraído no Laboratório de Cafeteria 🧪☕`;

    modal(`
      <div class="sheet-head">
        <h2>Compartilhar Receita</h2>
        <button class="btn sm ghost" data-close>✕</button>
      </div>
      <div class="card-preview-wrap">
        <div class="card-preview-container" id="shareCardLoading">
          <div class="empty"><div class="big">☕</div>Gerando imagem com o Pingo…</div>
        </div>
        <div class="share-actions-grid" id="shareActions" style="opacity:0.4;pointer-events:none">
          <button class="btn primary sm" id="btnShareFile">📤 Compartilhar (PNG)</button>
          <button class="btn sm" id="btnDownloadFile">⬇️ Baixar Imagem</button>
          <button class="btn ghost sm" id="btnCopyImg">📋 Copiar Imagem</button>
          <button class="btn ghost sm" id="btnCopyText">💬 Copiar Texto</button>
        </div>
      </div>
    `);

    try {
      const pngBlob = await gerarReceitaPngBlob({ grao: g, metodo: m, moedor: md, extracao: x, diag: d });
      const imgUrl = URL.createObjectURL(pngBlob);
      const box = $('#shareCardLoading');
      if (box) box.innerHTML = `<img src="${imgUrl}" class="card-preview-img" alt="Card da receita com mascote Pingo">`;

      const actions = $('#shareActions');
      if (actions) {
        actions.style.opacity = '1';
        actions.style.pointerEvents = 'auto';
      }

      const file = new File([pngBlob], fileName, { type: 'image/png' });

      $('#btnShareFile').onclick = async () => {
        if (navigator.share) {
          try {
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: `Receita: ${nomeG} no ${m.nome}`,
                text: `Receita de ${nomeG} no ${m.nome} — Laboratório de Cafeteria`,
                files: [file]
              });
              return;
            } else {
              await navigator.share({
                title: `Receita: ${nomeG} no ${m.nome}`,
                text: textoLimpo
              });
              return;
            }
          } catch (err) {
            if (err.name === 'AbortError') return;
          }
        }
        baixarArquivo(pngBlob, fileName);
        toast('Imagem salva para compartilhar!');
      };

      $('#btnDownloadFile').onclick = () => {
        baixarArquivo(pngBlob, fileName);
        toast('Imagem baixada!');
      };

      $('#btnCopyImg').onclick = async () => {
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
            toast('Imagem copiada!');
            return;
          } catch (e) { /* fallback */ }
        }
        toast('Cópia de imagem não suportada neste aparelho. Use Baixar ou Compartilhar.');
      };

      $('#btnCopyText').onclick = async () => {
        try {
          await navigator.clipboard.writeText(textoLimpo);
          toast('Texto da receita copiado!');
        } catch (e) {
          toast('Não foi possível copiar o texto');
        }
      };
    } catch (err) {
      const box = $('#shareCardLoading');
      if (box) {
        box.innerHTML = `<div class="empty"><div class="big">⚠️</div>Não foi possível gerar imagem.<br><small class="muted">${esc(err.message || err)}</small></div>`;
      }
      const actions = $('#shareActions');
      if (actions) {
        actions.style.opacity = '1';
        actions.style.pointerEvents = 'auto';
      }
      $('#btnCopyText').onclick = async () => {
        try {
          await navigator.clipboard.writeText(textoLimpo);
          toast('Texto copiado!');
        } catch (e) { toast('Erro ao copiar'); }
      };
    }
  }

  function baixarArquivo(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function sens(x) { return { acidez: +x.acidez || 3, docura: +x.docura || 3, amargor: +x.amargor || 3, corpo: +x.corpo || 3, final: +x.final || 3 }; }
  function barraExtracao(d) {
    const pct = 50 + d.indice * 45;
    return `<div class="bar" title="Índice de extração ${d.indice}"><div class="pin" style="left:${pct}%"></div></div><div class="bar-lbl"><span>sub-extração</span><span>equilíbrio</span><span>sobre-extração</span></div>`;
  }
  /* ---------- Recomendação: ações com o porquê ---------- */
  const ICONES = { moagem: '⚙️', temperatura: '🌡️', razão: '⚖️', tempo: '⏱️', técnica: '🖐️', nota: 'ℹ️', ok: '✅' };
  function acoesHtml(reco) {
    const tag = { secundario: 'e também', alternativa: 'alternativa' };
    return reco.acoes.map((a) => `<div class="acao t-${a.tipo || 'info'}"><div class="k">${ICONES[a.alvo] || '•'}</div><div>${tag[a.tipo] ? `<span class="acao-tag">${tag[a.tipo]}</span> ` : ''}<span class="acao-txt">${esc(a.txt)}</span>${a.por ? `<div class="acao-por">${esc(a.por)}</div>` : ''}</div></div>`).join('');
  }
  function leituraHtml(reco) { return reco.leitura ? `<div class="leitura">🔎 ${esc(reco.leitura)}</div>` : ''; }
  /* Perfil esperado do grão × o que você sentiu */
  function perfilHtml(L) {
    if (!L) return '';
    const seta = (d) => (d >= 1.5 ? '▲▲' : d >= 1 ? '▲' : d <= -1.5 ? '▼▼' : d <= -1 ? '▼' : '✓');
    return `<div class="tbl-wrap" style="margin-top:8px"><table class="tbl perfil"><thead><tr><th></th><th>Esperado</th><th>Você sentiu</th><th></th></tr></thead><tbody>
      ${E.ATRIBUTOS.map(([k, nome]) => `<tr><td>${nome}</td><td>${E.fmtN(L.esperado[k])}</td><td><strong>${E.fmtN(L.percebido[k])}</strong></td><td class="${Math.abs(L.desvio[k]) >= 1 ? 'desvio' : 'ok'}">${seta(L.desvio[k])}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="text-2" style="margin:6px 0 0"><small>Esperado para ${esc(L.esperado.reg.id !== 'outra' ? L.esperado.reg.nome : 'este grão')}${L.esperado.proc ? ' · ' + esc(L.esperado.proc.nome.split(' (')[0].toLowerCase()) : ''} · torra ${esc(L.esperado.torra.nome.toLowerCase())}${L.esperado.notas.length ? ` · notas: ${L.esperado.notas.map(esc).join(', ')}` : ''}${L.notasPercebidas.length ? `<br>Você sentiu: ${L.notasPercebidas.map(esc).join(', ')}` : ''}</small></p>`;
  }
  function cardReco(reco, m, x) {
    const p = reco.prox;
    return `<div class="card reco ${reco.status === 'calibrado' ? 'ok' : reco.diag.cor}" style="margin-top:12px">
      <div class="row between"><h3>Próxima extração</h3><span class="badge ${reco.status === 'calibrado' ? 'ok' : 'accent'}">${reco.status === 'calibrado' ? 'calibrado' : 'ajustando'} · confiança ${Math.round(reco.confianca * 100)} %</span></div>
      ${leituraHtml(reco)}
      ${acoesHtml(reco)}
      <div class="kv" style="margin-top:10px">
        ${p.clicks != null ? `<div><span class="lbl">Moagem</span><div class="v">${E.fmtClicks(p.clicks)} cl</div></div>` : ''}
        <div><span class="lbl">Dose</span><div class="v">${p.dose} g</div></div>
        <div><span class="lbl">${E.isEspresso(m) ? 'Bebida' : 'Água'}</span><div class="v">${p.water} g</div></div>
        <div><span class="lbl">Razão</span><div class="v">1:${E.fmtN(p.ratio)}</div></div>
        ${m.id !== 'cold-brew' ? `<div><span class="lbl">Temperatura</span><div class="v">${E.fmtN(p.tempC)} °C</div></div>` : ''}
        <div><span class="lbl">${E.tipoMetodo(m) === 'imersao' ? 'Tempo de imersão' : 'Tempo alvo'}</span><div class="v">${E.tipoMetodo(m) === 'imersao' ? E.fmtTempo(p.tempoS) : (() => { const T = E.faixaTempo(m, p.dose); return `${E.fmtTempo(T.min)}–${E.fmtTempo(T.max)}`; })()}</div></div>
      </div>
      ${(() => { const rc = E.receita(m, p.dose, p.water); return rc ? `<details class="recipe" style="margin-top:10px"><summary>Plano de despejos · ${esc(rc.nome)}</summary>${tabelaReceita(rc, m, false)}</details>` : ''; })()}
      ${x ? `<div class="inline-actions"><a class="btn primary" href="#/nova?from=${x.id}">Preparar com esta receita →</a></div>` : ''}
    </div>`;
  }

  /* ======================= NOVA EXTRAÇÃO ======================= */
  routes.nova = (view, r) => {
    // preferência: começar pelo grão ou pelo método
    if (r.q.modo === 'grao' && state.config.modoNova !== 'grao') { state.config.modoNova = 'grao'; save(); }
    if (state.config.modoNova === 'metodo' && !r.q.editar && !r.q.from && !r.q.grao && !r.q.metodo && !r.q.modo) return routes.escolher(view, r);
    const editando = r.q.editar ? extracao(r.q.editar) : null;
    if (r.q.editar && !editando) { view.innerHTML = '<div class="empty">Extração não encontrada.</div>'; return; }
    $('#title').textContent = editando ? 'Editar extração' : 'Nova extração';
    if (!state.graos.length) { view.innerHTML = `<div class="empty"><div class="big">${BEAN}</div>Cadastre um grão antes de registrar extrações.<div style="margin-top:12px"><a class="btn primary" href="#/graos?novo=1">Cadastrar grão</a></div></div>`; return; }
    const from = editando || (r.q.from ? extracao(r.q.from) : null);
    const copiar = !!r.q.copiar, repetir = !!r.q.repetir;
    const pre = {
      graoId: (from && from.graoId) || r.q.grao || (state.graos.find(disponivel) || state.graos[0]).id,
      metodoId: (from && from.metodoId) || (metodo(r.q.metodo) && r.q.metodo) || metodoInicial(r.q.grao || (state.graos.find(disponivel) || state.graos[0]).id),
      moedorId: (from && from.moedorId) || r.q.moedor || (moedorPadrao() || {}).id || ''
    };
    const mVia = r.q.via === 'metodo' ? metodo(pre.metodoId) : null;
    view.innerHTML = `
      ${editando || from ? '' : segModo(mVia ? 'metodo' : 'grao')}
      ${mVia ? `<p class="text-2" style="margin:0 0 10px"><small><a href="#/escolher/${mVia.id}">← outros cafés para ${esc(nomeCurto(mVia))}</a></small></p>` : ''}
      <form id="fNova" autocomplete="off">
        <div class="card">
          <div class="form-grid">
            <label class="field"><span class="lbl">Grão</span>${sel('graoId', state.graos.filter((g) => disponivel(g) || g.id === pre.graoId).map((g) => ({ id: g.id, nome: g.nome + (g.semEstoque ? ' (sem estoque)' : '') })), pre.graoId)}</label>
            <label class="field"><span class="lbl">Método</span>${sel('metodoId', DB.metodos.filter((m) => metodoVisivel(m) || m.id === pre.metodoId).map((m) => ({ id: m.id, nome: m.nome })), pre.metodoId)}</label>
            <label class="field"><span class="lbl">Moedor</span>${sel('moedorId', [{ id: '', nome: '— sem moedor —' }].concat(state.moedores.map((m) => ({ id: m.id, nome: m.nome }))), pre.moedorId)}</label>
            <label class="field"><span class="lbl">Data e hora</span><input type="datetime-local" name="data" value="${editando ? isoLocal(editando.data) : nowLocal()}"></label>
          </div>
        </div>
        <div id="sugestao"></div>
        <div class="card" style="margin-top:12px">
          <h3>Receita executada</h3>
          <div class="form-grid">
            <label class="field"><span class="lbl">Moagem (cliques)</span><input type="number" name="clicks" inputmode="decimal" step="any"><div class="help" id="hClicks"></div></label>
            <label class="field"><span class="lbl">Dose (g)</span><input type="number" name="dose" inputmode="decimal" step="0.1" required><div class="help">Mudar a dose recalcula a água mantendo a razão.</div></label>
            <label class="field"><span class="lbl" id="lWater">Água (g)</span><input type="number" name="water" inputmode="decimal" step="0.1" required><div class="help">Editar recalcula a razão.</div></label>
            <label class="field"><span class="lbl">Razão (1:x)</span><input type="number" name="ratio" inputmode="decimal" step="0.01"><div class="help">Editar recalcula a água.</div></label>
            <label class="field"><span class="lbl">Temperatura (°C)</span><input type="number" name="tempC" inputmode="decimal" step="0.5" required></label>
            <label class="field"><span class="lbl">Tempo de contato</span><input type="text" name="tempo" inputmode="numeric" placeholder="2:45 · 28 · 14h"><div class="help" id="hTempo"></div></label>
            <label class="field"><span class="lbl">TDS % (opcional)</span><input type="number" name="tds" inputmode="decimal" step="0.01" placeholder="refratômetro"></label>
          </div>
          <button class="btn primary block" type="button" id="btnTimer" style="margin:4px 0 14px">⏱ Iniciar timer guiado</button>
          <div class="row between" style="margin-top:4px"><span class="lbl" style="margin:0">Despejos / ataques executados</span><div class="row" style="gap:6px"><button class="btn sm" type="button" id="pourPlano">Preencher pelo plano</button><button class="btn sm ghost" type="button" id="pourAdd">＋ linha</button></div></div>
          <div id="pours"></div>
          <div class="help">Tempo em que cada ataque começou e a água acumulada na balança ao fim dele. Ajuste para o que você realmente fez.</div>
        </div>
        <div class="card" style="margin-top:12px">
          <h3>Xícara</h3>
          <div class="avaliacao" id="avaliacao">
            <div class="av-fig" id="avFig">${window.Mascote ? window.Mascote.svg('pensativo', { size: 104 }) : ''}</div>
            <div class="av-corpo">
              <strong>Avalie essa extração</strong>
              <div class="estrelas" id="estrelas">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="estrela" data-n="${n}" aria-label="${n} de 5">★</button>`).join('')}</div>
              <small class="muted" id="avRotulo"></small>
            </div>
          </div>
          ${rangeFino('nota', 'Nota 0–10', 6, 0, 10, 0.5, 'margin:2px 0 12px')}
          <div class="help" id="hPerfil" style="margin:-4px 0 10px"></div>
          ${rangeFino('acidez', 'Acidez', 3, 1, 5, 0.5)}
          ${rangeFino('docura', 'Doçura', 3, 1, 5, 0.5)}
          ${rangeFino('amargor', 'Amargor', 3, 1, 5, 0.5)}
          ${rangeFino('corpo', 'Corpo', 3, 1, 5, 0.5)}
          ${rangeFino('final', 'Finalização', 3, 1, 5, 0.5)}
          <div class="lbl" style="margin-top:8px">Sinais percebidos</div>
          ${chipsSel('sinais', DB.sinais, [])}
          <div class="lbl" style="margin-top:12px">Descritores</div>
          ${chipsSel('descritores', DB.descritores, [])}
          <label class="field"><span class="lbl">Observações</span><textarea name="obs" placeholder="bloom, despejos, canal, água usada…"></textarea></label>
          <label class="field"><span class="lbl">Quanto você bebeu? (diário de cafeína)</span>${sel('bebido', [{ id: '1', nome: 'Tudo' }, { id: '0.5', nome: 'Metade' }, { id: '0.25', nome: 'Um quarto / prova' }, { id: '0', nome: 'Não bebi (só calibração)' }], String(state.config.bebidoPadrao != null ? state.config.bebidoPadrao : '1'))}<div class="help" id="hCafeina"></div></label>
        </div>
        <div class="row" style="margin-top:14px"><button class="btn primary block" type="submit">${editando ? 'Salvar alterações' : 'Salvar e diagnosticar'}</button>${editando ? `<a class="btn block" href="#/extracao/${editando.id}" style="justify-content:center">Cancelar</a>` : ''}</div>
      </form>`;
    const f = $('#fNova');
    // avaliação 1–5 com o Pingo, sincronizada com a nota fina
    function pintarAvaliacao() {
      const nota = +f.elements.nota.value, nv = window.Mascote ? window.Mascote.nivelPorNota(nota) : Math.max(1, Math.round(nota / 2));
      $$('#estrelas .estrela', f).forEach((b) => b.classList.toggle('on', +b.dataset.n <= nv));
      const info = window.Mascote ? window.Mascote.NIVEIS[nv - 1] : { humor: 'feliz', rotulo: '' };
      $('#avRotulo', f).textContent = `${nv}/5 · ${info.rotulo}`;
      if (window.Mascote) { const fig = $('#avFig', f); if (fig.dataset.h !== info.humor) { fig.dataset.h = info.humor; fig.innerHTML = window.Mascote.svg(info.humor, { size: 104 }); } }
    }
    $('#estrelas', f).addEventListener('click', (e) => { const b = e.target.closest('.estrela'); if (!b) return; const nota = +b.dataset.n * 2; setRange(f.elements.nota, nota); pintarAvaliacao(); });
    f.elements.nota.addEventListener('input', pintarAvaliacao);
    setTimeout(pintarAvaliacao, 0);
    const F = (n) => f.elements[n];
    // controles de paladar começam no perfil esperado do grão: só conta o que você mover
    let sensTocado = false;
    ['acidez', 'docura', 'amargor', 'corpo', 'final'].forEach((k) => F(k).addEventListener('input', () => { sensTocado = true; }));
    function aplicarPerfilEsperado() {
      const { g, m } = ctx(); if (!g || !m) return;
      const Ep = E.perfilEsperado(g, m);
      $('#hPerfil').textContent = `Perfil esperado deste grão: acidez ${E.fmtN(Ep.acidez)}, doçura ${E.fmtN(Ep.docura)}, amargor ${E.fmtN(Ep.amargor)}, corpo ${E.fmtN(Ep.corpo)}${Ep.notas.length ? ' · notas: ' + Ep.notas.slice(0, 4).join(', ') : ''}. ${sensTocado ? 'Compare com o que você sentiu.' : 'Os controles começam nele: mova só o que você sentiu diferente.'}`;
      if (sensTocado) return;
      ['acidez', 'docura', 'amargor', 'corpo', 'final'].forEach((k) => { const v = Math.min(5, Math.max(1, Math.round(Ep[k] * 2) / 2)); setRange(F(k), v); });
    }

    function ctx() { return { g: grao(F('graoId').value), m: metodo(F('metodoId').value), md: moedor(F('moedorId').value) }; }
    function aplicarReceita(p) {
      if (p.clicks != null && F('moedorId').value) F('clicks').value = p.clicks;
      F('dose').value = p.dose; F('ratio').value = p.ratio; F('water').value = p.water; F('tempC').value = p.tempC;
      if (p.tempoS && (!F('tempo').value || !tempoTocado)) F('tempo').value = tempoCampo(p.tempoS);
      aguaAnterior = +p.water || null;
      preencherPlano();
      atualizarReferencia();
    }
    /* Dose ↔ água ↔ razão. Mexer na dose recalcula a água mantendo a razão;
     * os despejos e o card de referência acompanham a nova água. */
    let tempoTocado = false;
    F('tempo').addEventListener('input', () => { tempoTocado = true; });
    let aguaAnterior = null, camposTocados = false, doseTocada = false, refReceita = null;
    const arred = (v) => (E.isEspresso(ctx().m) ? Math.round(v * 10) / 10 : Math.round(v));
    const escalada = (p, d) => (d && p && d !== p.dose ? Object.assign({}, p, { dose: d, water: arred(d * p.ratio) }) : p);
    function escalarDespejos(nova) {
      const velha = aguaAnterior; aguaAnterior = nova || null;
      if (!velha || !nova || velha === nova) return;
      const k = nova / velha;
      $$('#pours tr[data-row] [name=pa]').forEach((i) => { if (i.value === '') return; i.value = Math.abs(+i.value - velha) < 0.05 ? nova : arred(+i.value * k); });
    }
    function hintTempo() {
      const { m } = ctx(), h = $('#hTempo'); if (!h || !m) return;
      if (E.tipoMetodo(m) === 'filtro') { const T = E.faixaTempo(m, +F('dose').value || m.dosePadrao); h.textContent = `Faixa para ${E.fmtN(+F('dose').value || m.dosePadrao)} g: ${E.fmtTempo(T.min)}–${E.fmtTempo(T.max)}`; }
      else h.textContent = `Faixa do método: ${E.fmtTempo(m.tempoS.min)}–${E.fmtTempo(m.tempoS.max)}`;
    }
    function atualizarReferencia() {
      hintTempo();
      const box = $('#sugestao'); if (!refReceita || !box) return;
      const { m } = ctx(), d = +F('dose').value || refReceita.dose, p = escalada(refReceita, d);
      const set = (k, v) => { const el = $(`[data-ref="${k}"]`, box); if (el) el.innerHTML = v; };
      set('dose', `${E.fmtN(p.dose)} g`); set('water', `${E.fmtN(p.water)} g`);
      if (E.tipoMetodo(m) === 'filtro') { const T = E.faixaTempo(m, p.dose); set('tempo', `${E.fmtTempo(T.min)}–${E.fmtTempo(T.max)}`); }
      set('nota', p.dose !== refReceita.dose ? `Referência ajustada para ${E.fmtN(p.dose)} g, mantendo a razão 1:${E.fmtN(p.ratio)} (sugestão original: ${E.fmtN(refReceita.dose)} g → ${E.fmtN(refReceita.water)} g).` : '');
      const pl = $('[data-ref="plano"]', box); if (pl) { const rc = E.receita(m, p.dose, p.water); pl.innerHTML = rc ? tabelaReceita(rc, m, false) : ''; }
    }
    function preencherPlano() {
      const { m } = ctx();
      const rc = E.receita(m, +F('dose').value || m.dosePadrao, +F('water').value);
      $('#pours').innerHTML = rc ? tabelaReceita(rc, m, true) : '<small class="muted">Sem plano padrão para este método.</small>';
    }
    function addLinha() {
      let tb = $('#pours tbody');
      if (!tb) { $('#pours').innerHTML = tabelaReceita({ etapas: [] }, ctx().m, true); tb = $('#pours tbody'); }
      const tr = document.createElement('tr'); tr.dataset.row = '1';
      tr.innerHTML = `<td class="n">${tb.children.length + 1}</td><td><input type="text" name="pt" inputmode="numeric" style="width:70px" placeholder="1:30"></td><td><input type="number" name="pa" step="0.1" inputmode="decimal" style="width:80px"></td><td><input type="text" name="pd" placeholder="obs"></td><td><button type="button" class="rm" title="Remover">✕</button></td>`;
      tb.appendChild(tr);
    }
    $('#pourPlano').onclick = preencherPlano;
    $('#btnTimer').onclick = () => {
      const { g, m, md } = ctx();
      let etapas = lerDespejos(f);
      if (!etapas.length) { const rc = E.receita(m, +F('dose').value || m.dosePadrao, +F('water').value); etapas = rc ? rc.etapas : [{ t: 0, acumulado: +F('water').value, desc: '' }]; }
      window.CafeTimer.open({ grao: g, metodo: m, moedor: md, dose: +F('dose').value, water: +F('water').value, tempC: +F('tempC').value, clicks: F('clicks').value, etapas }, (res) => {
        if (res.tempoS) { F('tempo').value = tempoCampo(res.tempoS); tempoTocado = true; }
        if (res.etapas && res.etapas.length) $('#pours').innerHTML = tabelaReceita({ etapas: res.etapas }, m, true);
        toast(`Tempo registrado: ${E.fmtTempo(res.tempoS)}${res.drenagemS ? ' · drenagem marcada' : ''}`);
        F('tempo').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    };
    const hintCafeina = () => { const h = $('#hCafeina'); if (!h || !window.CafeCafeina) return; const { g, m } = ctx(); const mg = window.CafeCafeina.estimarExtracao(g, m, +F('dose').value); h.textContent = `≈ ${Math.round(mg * (+F('bebido').value))} mg de cafeína (estimativa para ${F('dose').value || 0} g)`; };
    ['dose', 'bebido', 'graoId', 'metodoId'].forEach((n) => F(n).addEventListener('change', hintCafeina)); F('dose').addEventListener('input', hintCafeina);
    setTimeout(hintCafeina, 0);
    if (r.q.timer) setTimeout(() => $('#btnTimer') && $('#btnTimer').click(), 50);
    $('#pourAdd').onclick = addLinha;
    $('#pours').addEventListener('click', (e) => { if (e.target.classList.contains('rm')) { e.target.closest('tr').remove(); $$('#pours tr[data-row] td.n').forEach((td, i) => (td.textContent = i + 1)); } });
    function renderSugestao() {
      const { g, m, md } = ctx();
      $('#lWater').textContent = E.isEspresso(m) ? 'Bebida na xícara (g)' : 'Água (g)';
      hintTempo();
      if (md) { F('clicks').min = md.min; F('clicks').max = md.max; F('clicks').step = md.passo || 1; $('#hClicks').textContent = `${md.nome}: ${md.min}–${md.max}, passo ${md.passo || 1} (${md.direcao === 'maior=fino' ? 'maior = mais fino' : 'menor = mais fino'})`; }
      else $('#hClicks').textContent = 'Cadastre um moedor para receber cliques exatos.';
      if (editando) { refReceita = null; $('#sugestao').innerHTML = `<div class="card soft" style="margin-top:12px"><strong>✏️ Editando o registro de ${fmtData(editando.data)}</strong><div class="help">Corrija o que for preciso e salve. O diagnóstico e as recomendações são recalculados com os novos valores.</div></div>`; return null; }
      const hist = historico(g.id, m.id, md ? md.id : '');
      let html, receita;
      if (hist.length) {
        const ult = hist[hist.length - 1];
        const reco = E.recommend(ult, hist.slice(0, -1), m, md, g, { notaAlvo: state.config.notaAlvo });
        receita = reco.prox;
        html = `<div class="card reco ${reco.status === 'calibrado' ? 'ok' : reco.diag.cor}" style="margin-top:12px">
          <div class="row between"><h3>Recomendação (${hist.length} extração(ões) anteriores)</h3><span class="badge ${reco.status === 'calibrado' ? 'ok' : 'accent'}">${reco.status}</span></div>
          <small>Última: ${fmtData(ult.data)} · nota ${ult.nota || '—'} · ${esc(ult.diag.rotulo)}</small>
          ${leituraHtml(reco)}
          ${acoesHtml(reco)}
          <div class="kv" style="margin-top:8px"><div><span class="lbl">Dose</span><div class="v" data-ref="dose">${E.fmtN(reco.prox.dose)} g</div></div><div><span class="lbl">${E.isEspresso(m) ? 'Bebida' : 'Água'}</span><div class="v" data-ref="water">${E.fmtN(reco.prox.water)} g</div></div><div><span class="lbl">Razão</span><div class="v">1:${E.fmtN(reco.prox.ratio)}</div></div></div>
          <small class="muted" data-ref="nota"></small>
          ${(() => { const rc = E.receita(m, reco.prox.dose, reco.prox.water); return rc ? `<details class="recipe" style="margin-top:8px"><summary>Plano de despejos · ${esc(rc.nome)}</summary><div data-ref="plano">${tabelaReceita(rc, m, false)}</div></details>` : ''; })()}
          <div class="inline-actions"><button class="btn primary sm" type="button" id="usar">Usar esta receita</button><a class="btn sm" href="#/extracao/${ult.id}">Ver última</a></div>
        </div>`;
      } else {
        const sp = E.startingPoint(g, m, md);
        receita = sp;
        html = `<div class="card reco" style="margin-top:12px">
          <div class="row between"><h3>Ponto de partida sugerido</h3><span class="badge accent">1ª extração</span></div>
          <div class="kv">
            ${sp.clicks != null ? `<div><span class="lbl">Moagem</span><div class="v">${E.fmtClicks(sp.clicks)} cl</div></div>` : ''}
            <div><span class="lbl">Dose</span><div class="v" data-ref="dose">${E.fmtN(sp.dose)} g</div></div>
            <div><span class="lbl">${E.isEspresso(m) ? 'Bebida' : 'Água'}</span><div class="v" data-ref="water">${E.fmtN(sp.water)} g</div></div>
            <div><span class="lbl">Razão</span><div class="v">1:${E.fmtN(sp.ratio)}</div></div>
            <div><span class="lbl">Temp.</span><div class="v">${E.fmtN(sp.tempC)} °C</div></div>
            <div><span class="lbl">${E.tipoMetodo(m) === 'imersao' ? 'Imersão' : 'Tempo alvo'}</span><div class="v" data-ref="tempo">${E.tipoMetodo(m) === 'imersao' ? E.fmtTempo(sp.tempoS) : `${E.fmtTempo(sp.faixaTempo.min)}–${E.fmtTempo(sp.faixaTempo.max)}`}</div></div>
          </div>
          <small class="muted" data-ref="nota"></small>
          <ul class="factors" style="margin:8px 0 0;padding-left:18px">${sp.por.map((p) => `<li>${esc(p)}</li>`).join('')}<li>${esc(m.receita)}</li></ul>
          ${(() => { const rc = E.receita(m, sp.dose, sp.water); return rc ? `<details class="recipe" style="margin-top:8px"><summary>Plano de despejos · ${esc(rc.nome)}</summary><div data-ref="plano">${tabelaReceita(rc, m, false)}</div></details>` : ''; })()}
          <div class="inline-actions"><button class="btn primary sm" type="button" id="usar">Usar esta receita</button></div>
        </div>`;
      }
      $('#sugestao').innerHTML = html;
      refReceita = receita;
      $('#usar').onclick = () => { const d = +F('dose').value; aplicarReceita(doseTocada && d ? escalada(receita, d) : receita); camposTocados = false; toast('Receita aplicada aos campos'); };
      return receita;
    }
    let mAnterior = ctx().m;
    ['graoId', 'metodoId', 'moedorId'].forEach((n) => F(n).addEventListener('change', () => {
      const m0 = mAnterior; mAnterior = ctx().m;
      const rec = renderSugestao();
      // troca de grão/método aplica a nova referência (se você não editou os campos), mantendo a dose que você escolheu
      if (rec && (!F('dose').value || (!camposTocados && !editando))) {
        const manter = doseTocada && +F('dose').value && E.isEspresso(m0) === E.isEspresso(mAnterior);
        aplicarReceita(manter ? escalada(rec, +F('dose').value) : rec);
      } else atualizarReferencia();
      aplicarPerfilEsperado();
    }));
    ['clicks', 'tempC'].forEach((n) => F(n).addEventListener('input', () => { camposTocados = true; }));
    F('dose').addEventListener('input', () => {
      doseTocada = true;
      const d = +F('dose').value, rt = +F('ratio').value;
      if (d && rt) { F('water').value = arred(d * rt); escalarDespejos(+F('water').value); }
      else if (d && +F('water').value) F('ratio').value = Math.round((+F('water').value / d) * 100) / 100;
      atualizarReferencia();
    });
    F('ratio').addEventListener('input', () => { camposTocados = true; const d = +F('dose').value, rt = +F('ratio').value; if (d && rt) { F('water').value = arred(d * rt); escalarDespejos(+F('water').value); } });
    F('water').addEventListener('input', () => { camposTocados = true; const d = +F('dose').value, w = +F('water').value; if (d && w) F('ratio').value = Math.round((w / d) * 100) / 100; escalarDespejos(w); });

    const rec0 = renderSugestao();
    function preencherSensorial(src) {
      ['acidez', 'docura', 'amargor', 'corpo', 'final'].forEach((k) => { if (src[k]) setRange(F(k), src[k]); });
      setRange(F('nota'), src.nota != null && src.nota !== '' ? src.nota : 6); setTimeout(pintarAvaliacao, 0);
      $$('[data-chips="sinais"] .chip, [data-chips="descritores"] .chip', f).forEach((c) => c.classList.remove('on'));
      (src.sinais || []).forEach((s) => { const c = $(`[data-chips="sinais"] .chip[data-v="${s}"]`, f); if (c) c.classList.add('on'); });
      (src.descritores || []).forEach((s) => { const c = $(`[data-chips="descritores"] .chip[data-v="${s}"]`, f); if (c) c.classList.add('on'); });
      F('obs').value = src.obs || '';
      sensTocado = true;
    }
    if (editando) {
      aplicarReceita({ clicks: editando.clicks, dose: editando.dose, ratio: editando.ratio, water: editando.water, tempC: editando.tempC, tempoS: null });
      if (editando.clicks == null || editando.clicks === '') F('clicks').value = '';
      F('tempo').value = editando.tempoS ? tempoCampo(editando.tempoS) : '';
      F('tds').value = editando.tds != null ? editando.tds : '';
      $('#pours').innerHTML = editando.despejos && editando.despejos.length ? tabelaReceita({ etapas: editando.despejos }, ctx().m, true) : '';
      preencherSensorial(editando);
      F('bebido').value = String(editando.bebido != null ? editando.bebido : 1);
      hintCafeina();
    } else if (from) {
      if (repetir) {
        aplicarReceita({ clicks: from.clicks, dose: from.dose, ratio: from.ratio, water: from.water, tempC: from.tempC, tempoS: from.tempoS });
        if (from.despejos && from.despejos.length) $('#pours').innerHTML = tabelaReceita({ etapas: from.despejos }, ctx().m, true);
        F('tempo').value = '';
        toast('Receita da última extração carregada');
      } else if (copiar) {
        aplicarReceita({ clicks: from.clicks, dose: from.dose, ratio: from.ratio, water: from.water, tempC: from.tempC, tempoS: from.tempoS });
        preencherSensorial(from);
        if (from.despejos && from.despejos.length) $('#pours').innerHTML = tabelaReceita({ etapas: from.despejos }, ctx().m, true);
      } else {
        aplicarReceita(rec0); F('tempo').value = '';
      }
    } else aplicarReceita(rec0);
    aplicarPerfilEsperado();

    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const { g, m, md } = ctx();
      const tempoS = parseTempo(F('tempo').value);
      if (F('tempo').value && tempoS == null) { toast('Tempo inválido. Use 2:45, 28 ou 14h.'); F('tempo').focus(); return; }
      const dt = editando && F('data').value === isoLocal(editando.data) ? editando.data : F('data').value ? new Date(F('data').value).toISOString() : new Date().toISOString();
      const x = {
        id: editando ? editando.id : uid(), data: dt, graoId: g.id, metodoId: m.id, moedorId: md ? md.id : '',
        clicks: F('clicks').value === '' ? null : +F('clicks').value,
        dose: +F('dose').value, water: +F('water').value, ratio: +F('ratio').value || Math.round((+F('water').value / +F('dose').value) * 100) / 100,
        tempC: +F('tempC').value, tempoS: tempoS, tds: F('tds').value ? +F('tds').value : null,
        acidez: +F('acidez').value, docura: +F('docura').value, amargor: +F('amargor').value, corpo: +F('corpo').value, final: +F('final').value,
        sinais: chipsVal(f, 'sinais'), descritores: chipsVal(f, 'descritores'), nota: +F('nota').value, obs: F('obs').value.trim(),
        despejos: lerDespejos(f), bebido: +F('bebido').value
      };
      if (E.isEspresso(m)) x.yieldG = x.water;
      x.diag = E.diagnose(x, m, g);
      const estoqueAntes = restante(g);
      if (editando) {
        const i = state.extracoes.findIndex((e) => e.id === editando.id);
        const novo = Object.assign({}, editando, x, { editadoEm: new Date().toISOString() });
        if (!E.isEspresso(m)) delete novo.yieldG;
        state.extracoes[i] = novo;
        marcarSeZerou(g, editando.graoId === g.id ? estoqueAntes : null);
        hooks.extracaoEditada.forEach((fn) => fn(novo, g, m, editando));
        save();
        toast('Registro atualizado');
        go(`#/extracao/${novo.id}`);
        return;
      }
      state.extracoes.push(x);
      marcarSeZerou(g, estoqueAntes);
      hooks.extracaoSalva.forEach((fn) => fn(x, g, m));
      save();
      toast('Extração registrada');
      go(`#/extracao/${x.id}`);
    });
  };

  /* ======================= ESCOLHER PELO MÉTODO ======================= */
  function segModo(ativo) {
    return `<div class="seg" role="group" aria-label="Começar a extração">
      <a class="seg-btn ${ativo === 'grao' ? 'on' : ''}" href="#/nova?modo=grao">${BEAN}<span>Pelo grão</span></a>
      <a class="seg-btn ${ativo === 'metodo' ? 'on' : ''}" href="#/escolher">${ICO('v60')}<span>Pelo método</span></a>
    </div>`;
  }
  /* Grãos ativos ordenados pela aptidão ao método (terroir, torra, perfil, histórico, estoque) */
  function cafesParaMetodo(m) {
    return state.graos.filter(disponivel).map((g) => {
      const hist = state.extracoes.filter((x) => x.graoId === g.id && x.metodoId === m.id).sort((a, b) => new Date(a.data) - new Date(b.data)).map(withDiag);
      const apt = E.aptidao(g, m, { historico: hist });
      const r = restante(g);
      return { g, apt, r, semEstoque: r != null && r <= 0 };
    }).sort((a, b) => b.apt.score - a.apt.score);
  }
  routes.escolher = (view, r) => {
    if (state.config.modoNova !== 'metodo') { state.config.modoNova = 'metodo'; save(); }
    if (r.id) return metodoEscolhido(view, r);
    $('#title').textContent = 'Nova extração';
    const ms = metodosVisiveis();
    view.innerHTML = `
      ${segModo('metodo')}
      <p class="text-2" style="margin:0 0 12px"><small>Escolha o método e eu indico os cafés do seu estoque que combinam com ele.</small></p>
      <div class="mt-grid">
        ${ms.map((m) => {
          const cs = cafesParaMetodo(m).filter((c) => !c.semEstoque), ot = cs.filter((c) => c.apt.nivel === 'otimo').length, bo = cs.filter((c) => c.apt.nivel === 'bom').length;
          const sub = ot ? `${ot} ótima${ot > 1 ? 's' : ''} escolha${ot > 1 ? 's' : ''}` : bo ? `${bo} boa${bo > 1 ? 's' : ''} opç${bo > 1 ? 'ões' : 'ão'}` : '&nbsp;';
          return `<a class="mt-tile" href="#/escolher/${m.id}"><span class="mt-card">${m.icone}</span><span class="mt-nome">${esc(nomeCurto(m))}</span><span class="mt-sub">${sub}</span></a>`;
        }).join('')}
        <a class="mt-tile" href="#/equipamentos?novoMetodo=1"><span class="mt-card add">${ICO('personalizado')}</span><span class="mt-nome">Personalizado</span><span class="mt-sub">criar método</span></a>
      </div>
      ${ocultos().length ? `<p style="margin-top:10px"><small class="muted">${ocultos().length} método(s) oculto(s) · <a href="#/equipamentos">mostrar</a></small></p>` : ''}`;
  };
  function metodoEscolhido(view, r) {
    const m = metodo(r.id);
    if (!m) { view.innerHTML = '<div class="empty">Método não encontrado.</div>'; return; }
    $('#title').textContent = nomeCurto(m);
    const lista = cafesParaMetodo(m);
    const md = moedorPadrao();
    const T = E.faixaTempo(m, m.dosePadrao);
    const agua = E.isEspresso(m) ? Math.round(m.dosePadrao * m.ratio.padrao * 10) / 10 : Math.round(m.dosePadrao * m.ratio.padrao);
    const item = (c) => {
      const sp = E.startingPoint(c.g, m, md);
      const pos = c.apt.motivos.filter((x) => x.v > 0).slice(0, 3), neg = c.apt.motivos.filter((x) => x.v < 0).slice(0, 1);
      const cls = { otimo: 'ok', bom: 'accent', possivel: '', pouco: 'sobre' }[c.apt.nivel];
      return `<a class="item rec-cafe" href="#/nova?grao=${c.g.id}&metodo=${m.id}&via=metodo">
        ${icoGrao(c.g)}
        <div><div class="t">${esc(c.g.nome)} <span class="badge ${c.semEstoque ? '' : cls}">${c.semEstoque ? 'sem estoque' : esc(c.apt.rotulo)}</span></div>
          <div class="s">${esc((DB.regiao[c.g.regiao] || {}).nome || '')} · ${esc(((DB.processo[c.g.processo] || {}).nome || '').split(' (')[0])} · torra ${esc(((DB.torra[c.g.torra] || {}).nome || '').toLowerCase())}</div>
          ${pos.length || neg.length ? `<ul class="motivos">${pos.map((x) => `<li class="pos">${esc(x.t)}</li>`).join('')}${neg.map((x) => `<li class="neg">${esc(x.t)}</li>`).join('')}</ul>` : ''}
          <div class="s">${c.apt.tentativas ? `${c.apt.tentativas} extração(ões) neste método · ` : 'Partida: '}${sp.clicks != null ? E.fmtClicks(sp.clicks) + ' cl · ' : ''}${E.fmtN(sp.dose)} g → ${E.fmtN(sp.water)} g · ${E.fmtN(sp.tempC)} °C</div>
          ${badgeEstoque(c.g) ? `<div style="margin-top:4px">${badgeEstoque(c.g)}</div>` : ''}
        </div><div class="right">›</div></a>`;
    };
    const ok = lista.filter((c) => !c.semEstoque);
    const top = ok.filter((c) => c.apt.score >= 2.5), meio = ok.filter((c) => c.apt.score >= 0.5 && c.apt.score < 2.5), baixo = ok.filter((c) => c.apt.score < 0.5), sem = lista.filter((c) => c.semEstoque);
    view.innerHTML = `
      ${segModo('metodo')}
      <div class="card mt-head">
        <div class="mt-card">${m.icone}</div>
        <div><h2>${esc(m.nome)}</h2><small>${esc(m.tipo)}${m.custom ? ' · personalizado' : ''} · moagem ${esc((m.grindDesc || '').toLowerCase())}</small></div>
          <div class="kv">
            <div><span class="lbl">Receita base</span><div class="v">${E.fmtN(m.dosePadrao)} g → ${E.fmtN(agua)} g</div></div>
            <div><span class="lbl">Razão</span><div class="v">1:${E.fmtN(m.ratio.padrao)}</div></div>
            <div><span class="lbl">Temp.</span><div class="v">${E.fmtN(m.tempC.padrao)} °C</div></div>
            <div><span class="lbl">Tempo</span><div class="v">${E.fmtTempo(T.min)}–${E.fmtTempo(T.max)}</div></div>
          </div>
      </div>
      <p class="text-2" style="margin:8px 0 0"><small>${esc(m.receita || '')}</small></p>
      <div class="section-title"><h2>Cafés recomendados</h2>${m.custom ? `<a href="#/equipamentos?metodo=${m.id}">editar método</a>` : ''}</div>
      ${state.graos.length && !lista.length ? `<div class="empty"><div class="big">${BEAN}</div>Nenhum café com estoque. Adicione pacotes na página do grão.</div>` : ''}
      ${!state.graos.length ? `<div class="empty"><div class="big">${BEAN}</div>Cadastre seus grãos para receber indicações.<div style="margin-top:12px"><a class="btn primary" href="#/graos?novo=1">Cadastrar grão</a></div></div>` : ''}
      ${top.length ? `<div class="list">${top.map(item).join('')}</div>` : state.graos.length ? '<div class="card soft"><small>Nenhum café do estoque se destaca neste método. Veja abaixo os que também funcionam.</small></div>' : ''}
      ${meio.length ? `<div class="section-title"><h3 style="margin:0">Também funcionam</h3></div><div class="list">${meio.map(item).join('')}</div>` : ''}
      ${baixo.length ? `<details class="lib" style="margin-top:12px"><summary>Pouco indicados (${baixo.length})</summary><div class="list" style="padding:8px">${baixo.map(item).join('')}</div></details>` : ''}
      <p style="margin-top:12px"><small class="muted">A indicação combina terroir, torra, perfil (acidez, corpo, doçura), notas, processo, dias de torra e o que você já registrou neste método.${md ? ` Cliques para ${esc(md.nome)}.` : ''}</small></p>`;
  }

  /* ======================= EQUIPAMENTOS (métodos + moedores) ======================= */
  routes.equipamentos = (view, r) => {
    $('#title').textContent = 'Equipamentos';
    const usoM = (id) => state.extracoes.filter((x) => x.metodoId === id).length;
    view.innerHTML = `
      <div class="section-title" style="margin-top:0"><h2>Métodos de preparo</h2><button class="btn primary sm" id="novoMet">＋ Novo método</button></div>
      <div class="list">${DB.metodos.map((m) => `<div class="item" data-met="${m.id}">
        <div class="ico m">${m.icone}</div>
        <div><div class="t">${esc(m.nome)} ${m.custom ? '<span class="badge accent">personalizado</span>' : ''} ${m.arquivado ? '<span class="badge">arquivado</span>' : ocultos().includes(m.id) ? '<span class="badge">oculto</span>' : ''}</div>
          <div class="s">${esc(m.tipo)} · ${E.fmtN(m.dosePadrao)} g · 1:${E.fmtN(m.ratio.padrao)} · ${E.fmtN(m.tempC.padrao)} °C${m.custom ? ` · base ${esc(nomeCurto(metodo(m.baseEscolhida) || {}))}` : ''}${usoM(m.id) ? ` · ${usoM(m.id)} extração(ões)` : ''}</div></div>
        <div>›</div></div>`).join('')}</div>
      <div class="section-title"><h2>Moedores</h2><button class="btn sm" id="novoMo">＋ Novo moedor</button></div>
      ${state.moedores.length ? `<label class="field"><span class="lbl">Moedor padrão nas extrações (por grão e por método)</span>${sel('moedorPadrao', state.moedores.map((x) => ({ id: x.id, nome: x.nome })), (moedorPadrao() || {}).id, 'id="moPadrao"')}</label>` : ''}
      <div class="list">${state.moedores.length ? state.moedores.map((md) => `<div class="item" data-mo="${md.id}"><div class="ico">⚙️</div><div><div class="t">${esc(md.nome)} ${moedorPadrao() && moedorPadrao().id === md.id ? '<span class="badge ok">padrão</span>' : ''}</div><div class="s">${esc(md.tipo)} · escala ${md.min}–${md.max}, passo ${md.passo}${md.umPorClique ? ` · ${E.fmtN(md.umPorClique)} µm/clique` : ''}</div></div><div>›</div></div>`).join('') : '<div class="empty">Nenhum moedor cadastrado.</div>'}</div>`;
    $('#novoMet').onclick = () => formMetodo();
    $('#novoMo').onclick = () => formMoedor();
    if ($('#moPadrao')) $('#moPadrao').onchange = (e) => { state.config.moedorPadrao = e.target.value; save(); toast('Moedor padrão atualizado'); render(); };
    $$('[data-met]', view).forEach((el) => (el.onclick = () => { const m = metodo(el.dataset.met); if (m.custom) formMetodo(state.metodos.find((c) => c.id === m.id)); else detalheMetodoNativo(m); }));
    $$('[data-mo]', view).forEach((el) => (el.onclick = () => formMoedor(moedor(el.dataset.mo))));
    if (r.q.novoMetodo) { history.replaceState(null, '', '#/equipamentos'); formMetodo(); }
    else if (r.q.metodo) { const c = state.metodos.find((x) => x.id === r.q.metodo); history.replaceState(null, '', '#/equipamentos'); if (c) formMetodo(c); }
  };
  function detalheMetodoNativo(m) {
    const T = E.faixaTempo(m, m.dosePadrao), rc = E.receita(m, m.dosePadrao);
    modal(`<div class="sheet-head"><h2 class="row" style="gap:8px">${m.icone} ${esc(m.nome)}</h2><button class="btn sm ghost" data-close>✕</button></div>
      <p><strong>Razão:</strong> 1:${E.fmtN(m.ratio.min)}–1:${E.fmtN(m.ratio.max)} (padrão 1:${E.fmtN(m.ratio.padrao)}) · <strong>Dose de partida:</strong> ${E.fmtN(m.dosePadrao)} g</p>
      <p><strong>Temperatura:</strong> ${m.tempC.min}–${m.tempC.max} °C · <strong>Tempo:</strong> ${E.fmtTempo(T.min)}–${E.fmtTempo(T.max)}${E.tipoMetodo(m) === 'filtro' ? ` (para ${E.fmtN(m.dosePadrao)} g)` : ''}</p>
      <p><strong>Moagem:</strong> ${esc(m.grindDesc)}</p>
      <p class="text-2">${esc(m.sensibilidade)}</p>
      ${rc ? `<details class="recipe"><summary>Plano de despejos · ${esc(rc.nome)}</summary>${tabelaReceita(rc, m, false)}</details>` : ''}
      <label class="check" style="margin-top:12px"><input type="checkbox" id="vis" ${ocultos().includes(m.id) ? '' : 'checked'}> Mostrar na escolha por método e na nova extração</label>
      <div class="sheet-foot"><button type="button" class="btn" id="variar">Criar versão personalizada</button><button type="button" class="btn primary" data-close>Fechar</button></div>`, (sheet) => {
      $('#vis', sheet).onchange = (e) => { const o = ocultos().filter((x) => x !== m.id); if (!e.target.checked) o.push(m.id); state.config.metodosOcultos = o; save(); render(); };
      $('#variar', sheet).onclick = () => formMetodo(null, m);
    });
  }
  /* Método personalizado: herda o comportamento de um método nativo (base) */
  function formMetodo(c, deBase) {
    const isNew = !c;
    const b0 = deBase || DB.metodo.v60;
    c = c || { nome: deBase ? `${nomeCurto(deBase)} (minha versão)` : '', ico: deBase ? deBase.ico : 'chaleira', base: b0.id, dosePadrao: b0.dosePadrao, ratio: { ...b0.ratio }, tempC: { ...b0.tempC }, tempoS: { ...b0.tempoS }, grind: b0.grind, grindDesc: b0.grindDesc, fluxo: b0.fluxo, receita: '', etapas: [] };
    const baseM = () => NATIVOS.find((x) => x.id === $('#fMet [name=base]').value) || DB.metodo.v60;
    const tempoTxt = (v) => (v == null ? '' : tempoCampo(v));
    const usos = c.id ? state.extracoes.filter((x) => x.metodoId === c.id).length : 0;
    const planoAtual = () => {
      const bm = NATIVOS.find((x) => x.id === c.base) || b0;
      const tot = Math.round((c.dosePadrao || 10) * ((c.ratio && c.ratio.padrao) || bm.ratio.padrao));
      if (c.etapas && c.etapas.length) return { etapas: c.etapas.map((e) => ({ t: e.t, acumulado: Math.round(tot * e.agua), desc: e.desc })) };
      return E.receita(bm, c.dosePadrao || bm.dosePadrao, tot);
    };
    modal(`<div class="sheet-head"><h2>${isNew ? 'Novo método' : 'Editar método'}</h2><button class="btn sm ghost" data-close>✕</button></div>
      <form id="fMet" autocomplete="off">
        <div class="form-grid">
          <label class="field full"><span class="lbl">Nome *</span><input type="text" name="nome" value="${esc(c.nome)}" required placeholder="ex.: Origami, Orea, Hario Switch…"></label>
          <label class="field full"><span class="lbl">Comporta-se como (tipo base)</span>${sel('base', NATIVOS.map((m) => ({ id: m.id, nome: `${m.nome} · ${m.tipo}` })), c.base)}<div class="help">O motor usa o diagnóstico, as faixas e a referência de moagem do método base. Você ajusta os números abaixo.</div></label>
        </div>
        <div class="lbl">Ícone</div>
        <div class="ico-pick">${window.IconesMetodo.escolhas.map((i) => `<label title="${esc(i.nome)}"><input type="radio" name="ico" value="${i.id}" ${i.id === c.ico ? 'checked' : ''}><span>${ICO(i.id)}</span></label>`).join('')}</div>
        <div class="form-grid" style="margin-top:10px">
          <label class="field"><span class="lbl">Dose padrão (g)</span><input type="number" name="dosePadrao" value="${c.dosePadrao}" step="0.1" inputmode="decimal" required></label>
          <label class="field"><span class="lbl">Razão padrão (1:x)</span><input type="number" name="rPad" value="${c.ratio.padrao}" step="0.1" inputmode="decimal" required></label>
          <label class="field"><span class="lbl">Razão mín.</span><input type="number" name="rMin" value="${c.ratio.min}" step="0.1" inputmode="decimal"></label>
          <label class="field"><span class="lbl">Razão máx.</span><input type="number" name="rMax" value="${c.ratio.max}" step="0.1" inputmode="decimal"></label>
          <label class="field"><span class="lbl">Temperatura padrão (°C)</span><input type="number" name="tPad" value="${c.tempC.padrao}" step="0.5" inputmode="decimal" required></label>
          <label class="field"><span class="lbl">Temp. mín. / máx.</span><div class="row" style="gap:6px;flex-wrap:nowrap"><input type="number" name="tMin" value="${c.tempC.min}" step="0.5" inputmode="decimal"><input type="number" name="tMax" value="${c.tempC.max}" step="0.5" inputmode="decimal"></div></label>
          <label class="field"><span class="lbl">Tempo alvo</span><input type="text" name="sPad" value="${tempoTxt(c.tempoS.padrao)}" inputmode="numeric" placeholder="2:40"></label>
          <label class="field"><span class="lbl">Tempo mín. / máx.</span><div class="row" style="gap:6px;flex-wrap:nowrap"><input type="text" name="sMin" value="${tempoTxt(c.tempoS.min)}" inputmode="numeric"><input type="text" name="sMax" value="${tempoTxt(c.tempoS.max)}" inputmode="numeric"></div></label>
          <label class="field"><span class="lbl">Moagem (descritor)</span>${sel('grind', DB.grindEscala.map((g) => ({ id: String(g.n), nome: `${g.n} · ${g.nome}` })), String(c.grind))}</label>
          <label class="field"><span class="lbl">Descrição da moagem</span><input type="text" name="grindDesc" value="${esc(c.grindDesc || '')}"></label>
          <label class="field"><span class="lbl">Vazão do despejo (g/s)</span><input type="number" name="fluxo" value="${c.fluxo || ''}" step="0.5" inputmode="decimal"><div class="help">Usada pelo timer guiado.</div></label>
          <label class="field full"><span class="lbl">Receita / observações</span><textarea name="receita" placeholder="como você prepara, filtro usado…">${esc(c.receita || '')}</textarea></label>
        </div>
        <div class="row between" style="margin-top:4px"><span class="lbl" style="margin:0">Plano de despejos (para a dose e razão padrão)</span><div class="row" style="gap:6px"><button class="btn sm" type="button" id="plBase">Copiar do base</button><button class="btn sm ghost" type="button" id="plAdd">＋ linha</button></div></div>
        <div id="plano"></div>
        <div class="help">Água acumulada na balança ao fim de cada etapa. Ao extrair, o plano escala para a dose e a água que você usar. Sem linhas, herda o plano do método base.</div>
        <div class="sheet-foot">${isNew ? '' : c.arquivado ? '<button type="button" class="btn" id="reativar">Reativar</button>' : `<button type="button" class="btn danger" id="delMet">${usos ? 'Arquivar' : 'Excluir'}</button>`}<button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>
      </form>`, (sheet) => {
      const f = $('#fMet', sheet), F = (n) => f.elements[n];
      const pintarPlano = (rc) => { $('#plano', sheet).innerHTML = tabelaReceita(rc && rc.etapas.length ? rc : { etapas: [] }, baseM(), true); };
      pintarPlano(planoAtual());
      // o plano está em gramas para dose × razão padrão: acompanha quando você muda esses campos
      const totalForm = () => (+F('dosePadrao').value || 0) * (+F('rPad').value || 0);
      let totPlano = totalForm();
      const reescalar = () => {
        const novo = totalForm(); if (!novo || !totPlano || novo === totPlano) { if (novo) totPlano = novo; return; }
        const k = novo / totPlano;
        $$('#plano [name=pa]', sheet).forEach((i) => { if (i.value === '') return; i.value = Math.abs(+i.value - totPlano) < 0.6 ? Math.round(novo) : Math.round(+i.value * k); });
        totPlano = novo;
      };
      ['dosePadrao', 'rPad'].forEach((n) => F(n).addEventListener('input', reescalar));
      const doBase = () => { const bm = baseM(), d = +F('dosePadrao').value || bm.dosePadrao, rt = +F('rPad').value || bm.ratio.padrao; return E.receita(bm, d, Math.round(d * rt)); };
      $('#plBase', sheet).onclick = () => pintarPlano(doBase());
      $('#plAdd', sheet).onclick = () => {
        let tb = $('#plano tbody', sheet); if (!tb) { pintarPlano(null); tb = $('#plano tbody', sheet); }
        const tr = document.createElement('tr'); tr.dataset.row = '1';
        tr.innerHTML = `<td class="n">${tb.children.length + 1}</td><td><input type="text" name="pt" inputmode="numeric" style="width:70px" placeholder="1:30"></td><td><input type="number" name="pa" step="0.1" inputmode="decimal" style="width:80px"></td><td><input type="text" name="pd" placeholder="obs"></td><td><button type="button" class="rm" title="Remover">✕</button></td>`;
        tb.appendChild(tr);
      };
      $('#plano', sheet).addEventListener('click', (e) => { if (e.target.classList.contains('rm')) { e.target.closest('tr').remove(); $$('#plano tr[data-row] td.n', sheet).forEach((td, i) => (td.textContent = i + 1)); } });
      F('base').onchange = () => { // método novo: puxa as faixas e o plano do novo base
        if (!isNew) return;
        const bm = baseM();
        F('dosePadrao').value = bm.dosePadrao; F('rPad').value = bm.ratio.padrao; F('rMin').value = bm.ratio.min; F('rMax').value = bm.ratio.max;
        F('tPad').value = bm.tempC.padrao; F('tMin').value = bm.tempC.min; F('tMax').value = bm.tempC.max;
        F('sPad').value = tempoTxt(bm.tempoS.padrao); F('sMin').value = tempoTxt(bm.tempoS.min); F('sMax').value = tempoTxt(bm.tempoS.max);
        F('grind').value = String(bm.grind); F('grindDesc').value = bm.grindDesc; F('fluxo').value = bm.fluxo || '';
        const ic = f.querySelector(`[name=ico][value="${bm.ico || bm.id}"]`); if (ic) ic.checked = true;
        pintarPlano(doBase()); totPlano = totalForm();
      };
      const del = $('#delMet', sheet);
      if (del) del.onclick = () => {
        if (usos) { if (!confirmar(`Arquivar "${c.nome}"? As ${usos} extração(ões) continuam no diário; o método some da escolha e da nova extração.`)) return; const o = state.metodos.find((x) => x.id === c.id); o.arquivado = true; }
        else { if (!confirmar(`Excluir "${c.nome}"?`)) return; state.metodos = state.metodos.filter((x) => x.id !== c.id); }
        save(); closeModal(); toast(usos ? 'Método arquivado' : 'Método excluído'); render();
      };
      const reat = $('#reativar', sheet); if (reat) reat.onclick = () => { const o = state.metodos.find((x) => x.id === c.id); delete o.arquivado; save(); closeModal(); toast('Método reativado'); render(); };
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const bm = baseM();
        const num = (n, d) => (F(n).value === '' ? d : +F(n).value);
        const tp = (n, d) => { const v = parseTempo(F(n).value); return v == null ? d : v; };
        const o = {
          id: c.id || 'u-' + uid(), nome: F('nome').value.trim(), base: bm.id, ico: (f.querySelector('[name=ico]:checked') || {}).value || bm.ico || bm.id,
          dosePadrao: num('dosePadrao', bm.dosePadrao),
          ratio: { padrao: num('rPad', bm.ratio.padrao), min: num('rMin', bm.ratio.min), max: num('rMax', bm.ratio.max) },
          tempC: { padrao: num('tPad', bm.tempC.padrao), min: num('tMin', bm.tempC.min), max: num('tMax', bm.tempC.max) },
          tempoS: { padrao: tp('sPad', bm.tempoS.padrao), min: tp('sMin', bm.tempoS.min), max: tp('sMax', bm.tempoS.max) },
          grind: +F('grind').value || bm.grind, grindDesc: F('grindDesc').value.trim() || bm.grindDesc, fluxo: num('fluxo', bm.fluxo),
          receita: F('receita').value.trim(), criadoEm: c.criadoEm || new Date().toISOString()
        };
        if (!o.nome) { toast('Dê um nome ao método.'); return; }
        if (!(o.dosePadrao > 0) || !(o.ratio.padrao > 0)) { toast('Dose e razão precisam ser maiores que zero.'); return; }
        if (o.ratio.min > o.ratio.max || o.tempC.min > o.tempC.max || o.tempoS.min > o.tempoS.max) { toast('Confira as faixas: mínimo maior que o máximo.'); return; }
        o.ratio.padrao = Math.min(o.ratio.max, Math.max(o.ratio.min, o.ratio.padrao));
        const tot = o.dosePadrao * o.ratio.padrao;
        const linhas = lerDespejos(sheet).filter((d) => d.acumulado > 0).sort((a, b) => a.t - b.t);
        o.etapas = linhas.map((d) => ({ t: d.t, agua: Math.min(1, Math.round((d.acumulado / tot) * 1000) / 1000), desc: d.desc }));
        if (c.arquivado) o.arquivado = true;
        const i = state.metodos.findIndex((x) => x.id === o.id);
        if (i >= 0) state.metodos[i] = o; else state.metodos.push(o);
        save(); closeModal(); toast('Método salvo'); render();
      });
    });
  }

  /* ======================= GRÃOS ======================= */
  routes.graos = (view, r) => {
    $('#title').textContent = 'Grãos';
    const ordem = ['estoque', 'nome', 'torrefacao'].includes(state.config.ordemGraos) ? state.config.ordemGraos : 'estoque';
    const col = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
    const grupo = (g) => (g.arquivado ? 2 : g.semEstoque ? 1 : 0); // ativos → sem estoque → arquivados
    const torr = (g) => (g.torrefacao || '').trim();
    const gs = state.graos.slice().sort((a, b) => grupo(a) - grupo(b) || (
      ordem === 'nome' ? col.compare(a.nome, b.nome)
        : ordem === 'torrefacao' ? (!torr(a) - !torr(b)) || col.compare(torr(a), torr(b)) || col.compare(a.nome, b.nome)
          : ((restante(a) == null ? 1e9 : restante(a)) - (restante(b) == null ? 1e9 : restante(b))) || col.compare(a.nome, b.nome)));
    let cab = '';
    const cabecalho = (g) => { // títulos de grupo: torrefação e "sem estoque"/"arquivados"
      const k = grupo(g) === 1 ? '#sem' : grupo(g) === 2 ? '#arq' : ordem === 'torrefacao' ? torr(g) || 'Sem torrefação informada' : '';
      if (k === cab) return ''; cab = k;
      return k ? `<div class="list-grupo">${esc(k === '#sem' ? 'Sem estoque' : k === '#arq' ? 'Arquivados' : k)}</div>` : '';
    };
    view.innerHTML = `
      <div class="row between"><h2 style="margin:0">${r.q.estoque ? 'Estoque' : 'Seus grãos'}</h2><button class="btn primary sm" id="novo">＋ Novo grão</button></div>
      <div class="graos-barra-filtros">
        <div class="search-box">
          <svg class="search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
          <input type="search" id="qGrao" class="search-input" placeholder="Buscar grão, torrefação, notas…" autocomplete="off" spellcheck="false">
          <button type="button" class="search-clear" id="btnLimparBusca" aria-label="Limpar busca" hidden>✕</button>
        </div>
        <div class="ordem-box">
          <svg class="sort-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M6 12h12m-9 6h6"/></svg>
          <select id="ordemGraos" class="ordem-select" aria-label="Ordenar grãos">
            <option value="estoque" ${ordem === 'estoque' ? 'selected' : ''}>Estoque restante</option>
            <option value="nome" ${ordem === 'nome' ? 'selected' : ''}>Nome (A–Z)</option>
            <option value="torrefacao" ${ordem === 'torrefacao' ? 'selected' : ''}>Torrefação</option>
          </select>
        </div>
      </div>
      <small class="muted" style="display:block;margin-top:6px">${estoqueResumo().gramas} g em estoque. O estoque desconta a dose de cada extração registrada; cafés sem estoque não aparecem nas telas de extração.</small>
      <div class="list" id="listaGraos" style="margin-top:12px"></div>`;

    const renderLista = (termo) => {
      termo = (termo || '').toLowerCase().trim();
      const filtrados = gs.filter((g) => {
        if (!termo) return true;
        const texto = [g.nome, g.torrefacao, g.produtor, g.variedade, (DB.regiao[g.regiao] || {}).nome, (g.notas || []).join(' ')].filter(Boolean).join(' ').toLowerCase();
        return texto.includes(termo);
      });
      cab = '';
      const listEl = $('#listaGraos', view);
      if (!listEl) return;
      if (!filtrados.length) {
        listEl.innerHTML = `<div class="empty">Nenhum grão encontrado${termo ? ` para "${esc(termo)}"` : ''}.</div>`;
        return;
      }
      listEl.innerHTML = filtrados.map((g) => {
        const n = state.extracoes.filter((x) => x.graoId === g.id).length;
        return `${cabecalho(g)}<div class="item${g.semEstoque || g.arquivado ? ' apagado' : ''}" onclick="location.hash='#/grao/${g.id}'">${icoGrao(g)}
          <div><div class="t">${esc(g.nome)} ${g.arquivado ? '<span class="badge">arquivado</span>' : ''} ${badgeEstoque(g)}</div><div class="s">${esc((DB.regiao[g.regiao] || {}).nome || '')} · ${esc(((DB.processo[g.processo] || {}).nome || '').split(' (')[0])} · torra ${esc(((DB.torra[g.torra] || {}).nome || '').toLowerCase())}${g.dataTorra ? ' · torrado em ' + fmtDia(g.dataTorra) : ''}</div>${g.torrefacao ? `<div class="s">${esc(g.torrefacao)}${g.kit ? ' · ' + esc(g.kit) : ''}</div>` : ''}</div>
          <div class="right"><div class="score">${n}</div><small>extr.</small></div></div>`;
      }).join('');
    };

    renderLista('');
    const qGrao = $('#qGrao', view);
    const btnLimpar = $('#btnLimparBusca', view);
    qGrao.oninput = (e) => {
      renderLista(e.target.value);
      if (btnLimpar) btnLimpar.hidden = !e.target.value;
    };
    if (btnLimpar) {
      btnLimpar.onclick = () => {
        qGrao.value = '';
        btnLimpar.hidden = true;
        renderLista('');
        qGrao.focus();
      };
    }
    $('#ordemGraos').onchange = (e) => { state.config.ordemGraos = e.target.value; save(); render(); };
    $('#novo').onclick = () => formGrao();
    if (r.q.novo) { history.replaceState(null, '', '#/graos'); formGrao(); }
  };

  function formGrao(g) {
    g = g || { regiao: 'sul-de-minas', processo: 'natural', torra: 'media-clara', especie: 'arabica', notas: [] };
    const isNew = !g.id;
    modal(`
      <div class="sheet-head"><h2>${isNew ? 'Novo grão' : 'Editar grão'}</h2><button class="btn sm ghost" data-close>✕</button></div>
      <div class="scan-box">
        <label class="btn primary block" style="justify-content:center">📷 Ler rótulo com a câmera<input type="file" id="scanFile" accept="image/*" capture="environment" hidden></label>
        <label class="btn sm ghost" style="margin-top:6px">🖼 Escolher foto da galeria<input type="file" id="scanFile2" accept="image/*" hidden></label>
        <div id="scanStatus"></div>
      </div>
      <form id="fGrao">
        <div class="foto-cafe">
          <div class="ft" id="ftPrev">${fotoOk(g.foto) ? `<img src="${g.foto}" alt="">` : BEAN}</div>
          <div><span class="lbl" style="margin:0 0 6px">Foto do café</span><div class="acoes">
            <label class="btn sm">📷 Tirar foto<input type="file" id="ftCam" accept="image/*" capture="environment" hidden></label>
            <label class="btn sm ghost">🖼 Galeria<input type="file" id="ftGal" accept="image/*" hidden></label>
            <button type="button" class="btn sm ghost" id="ftDel" ${fotoOk(g.foto) ? '' : 'hidden'}>Remover</button>
          </div><div class="help" style="margin-top:4px">A foto do rótulo lida pela IA/OCR também fica salva aqui.</div></div>
        </div>
        <div class="form-grid">
          <label class="field full"><span class="lbl">Nome / lote *</span><input type="text" name="nome" value="${esc(g.nome || '')}" required placeholder="Ex.: Fazenda Santa Inês — Bourbon Amarelo"></label>
          <label class="field"><span class="lbl">Produtor / fazenda</span><input type="text" name="produtor" value="${esc(g.produtor || '')}"></label>
          <label class="field"><span class="lbl">Torrefação</span><input type="text" name="torrefacao" value="${esc(g.torrefacao || '')}"></label>
          <label class="field"><span class="lbl">Região (terroir)</span>${sel('regiao', DB.regioes.map((x) => ({ id: x.id, nome: `${x.nome} (${x.uf})` })), g.regiao)}</label>
          <label class="field"><span class="lbl">Variedade</span><input type="text" name="variedade" value="${esc(g.variedade || '')}" list="dlVar"><datalist id="dlVar"></datalist></label>
          <label class="field"><span class="lbl">Processo</span>${sel('processo', DB.processos.map((x) => ({ id: x.id, nome: x.nome })), g.processo)}</label>
          <label class="field"><span class="lbl">Torra</span>${sel('torra', DB.torras.map((x) => ({ id: x.id, nome: `${x.nome} (Agtron ${x.agtron})` })), g.torra)}</label>
          <label class="field"><span class="lbl">Espécie</span>${sel('especie', [{ id: 'arabica', nome: 'Arábica' }, { id: 'canephora', nome: 'Canephora (conilon/robusta)' }, { id: 'blend', nome: 'Blend' }], g.especie)}</label>
          <label class="field"><span class="lbl">Data da torra</span><input type="date" name="dataTorra" value="${esc(g.dataTorra || '')}"></label>
          <label class="field"><span class="lbl">Altitude (m)</span><input type="number" name="altitude" value="${esc(g.altitude || '')}" inputmode="numeric"></label>
          <label class="field"><span class="lbl">Dose padrão fora do espresso (g, opcional)</span><input type="number" name="dosePadrao" value="${esc(g.dosePadrao || '')}" inputmode="decimal" step="0.1"></label>
          <label class="field"><span class="lbl">Peso do pacote (g)</span><input type="number" name="pesoPacote" value="${esc(g.pesoPacote || '')}" inputmode="numeric" placeholder="ex.: 250"></label>
          <label class="field"><span class="lbl">Pacotes comprados</span><input type="number" name="pacotes" value="${g.id ? pacotes(g) : 1}" min="0" step="1" inputmode="numeric"><div class="help">Total desde o cadastro. Cada pacote soma o peso acima ao estoque.</div></label>
          <label class="field"><span class="lbl">Já usado antes do app (g)</span><input type="number" name="usadoAntes" value="${esc(g.usadoAntes || '')}" inputmode="numeric" placeholder="0"></label>
          <label class="check full" style="margin:2px 0 10px"><input type="checkbox" name="semEstoque" ${g.semEstoque ? 'checked' : ''}> Sem estoque <small class="muted">(não aparece nas telas de extração; marca sozinho quando o estoque zera)</small></label>
          <label class="field"><span class="lbl">Pontuação (SCA)</span><input type="text" name="pontuacao" value="${esc(g.pontuacao || '')}" placeholder="ex.: 86+"></label>
          <label class="field"><span class="lbl">Kit / origem da compra</span><input type="text" name="kit" value="${esc(g.kit || '')}"></label>
          <label class="field full"><span class="lbl">Link da loja</span><input type="text" name="link" value="${esc(g.link || '')}" inputmode="url" placeholder="https://"></label>
        </div>
        <div class="card soft" id="perfilRegiao" style="margin:4px 0 12px"></div>
        <div class="lbl">Perfil sensorial esperado (1–5)</div>
        ${range('acidez', 'Acidez', g.acidez || 3, 1, 5)}
        ${range('corpo', 'Corpo', g.corpo || 3, 1, 5)}
        ${range('docura', 'Doçura', g.docura || 4, 1, 5)}
        <div class="lbl" style="margin-top:8px">Notas do rótulo / perfil</div>
        ${chipsSel('notas', DB.descritores, g.notas || [])}
        <label class="field" style="margin-top:12px"><span class="lbl">Observações</span><textarea name="obs">${esc(g.obs || '')}</textarea></label>
        <div class="sheet-foot">${isNew ? '' : '<button type="button" class="btn danger" id="delGrao">Excluir</button>'}<button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>
      </form>`, (sheet) => {
      const f = $('#fGrao', sheet);
      const F = (n) => f.elements[n];
      function perfil() {
        const reg = DB.regiao[F('regiao').value];
        $('#perfilRegiao', sheet).innerHTML = `<strong>${esc(reg.nome)}</strong> · ${reg.altitude[0]}–${reg.altitude[1]} m<br><small>${esc(reg.perfil)}</small><br><small class="muted">Métodos indicados: ${reg.metodos.map((m) => metodo(m).nome).join(', ')}</small>`;
        $('#dlVar', sheet).innerHTML = reg.variedades.map((v) => `<option value="${esc(v)}">`).join('');
        if (reg.id === 'conilon-capixaba' || reg.id === 'rondonia') F('especie').value = 'canephora';
      }
      F('regiao').addEventListener('change', () => {
        perfil();
        const reg = DB.regiao[F('regiao').value];
        ['acidez', 'corpo', 'docura'].forEach((k) => { F(k).value = reg[k]; F(k).nextElementSibling.value = reg[k]; });
        $$('[data-chips="notas"] .chip', sheet).forEach((c) => c.classList.toggle('on', reg.notas.includes(c.dataset.v)));
      });
      perfil();
      if (isNew) { const reg = DB.regiao[g.regiao]; $$('[data-chips="notas"] .chip', sheet).forEach((c) => c.classList.toggle('on', reg.notas.includes(c.dataset.v))); ['acidez', 'corpo', 'docura'].forEach((k) => { F(k).value = reg[k]; F(k).nextElementSibling.value = reg[k]; }); }
      let foto = fotoOk(g.foto) ? g.foto : null;
      const pintarFoto = () => { $('#ftPrev', sheet).innerHTML = foto ? `<img src="${foto}" alt="">` : BEAN; $('#ftDel', sheet).hidden = !foto; };
      const pegarFoto = async (e) => {
        const file = e.target.files && e.target.files[0]; e.target.value = '';
        if (!file) return;
        try { foto = await fotoDeArquivo(file); pintarFoto(); } catch (err) { toast(err.message); }
      };
      $('#ftCam', sheet).addEventListener('change', pegarFoto);
      $('#ftGal', sheet).addEventListener('change', pegarFoto);
      $('#ftDel', sheet).onclick = () => { foto = null; pintarFoto(); };
      const onScan = async (e) => {
        const file = e.target.files && e.target.files[0]; e.target.value = '';
        if (!file || !window.CafeRotulo) return;
        // a foto enviada para leitura vira a foto do café (se ainda não houver uma)
        if (!foto) fotoDeArquivo(file).then((d) => { foto = d; pintarFoto(); }).catch(() => {});
        const st = $('#scanStatus', sheet);
        st.innerHTML = `<div class="scan-status"><span class="spin"></span> <span id="scanMsg">Preparando imagem…</span></div>`;
        try {
          const res = await window.CafeRotulo.ler(file, (msg) => { const el = $('#scanMsg', sheet); if (el) el.textContent = msg; });
          const preenchidos = aplicarCampos(res.campos);
          st.innerHTML = `<div class="scan-status ok">✓ ${res.fonte === 'ia' ? 'Lido pelo ' + (res.quem || 'IA') : 'Lido por OCR local'} · ${preenchidos.length ? 'preenchido: ' + preenchidos.join(', ') : 'nenhum campo reconhecido'}. Confira antes de salvar.</div>${res.texto ? `<details class="recipe" style="margin-top:6px"><summary>Texto lido</summary><pre class="ocr-text">${esc(res.texto)}</pre></details>` : ''}${res.aviso ? `<div class="help">${esc(res.aviso)}</div>` : ''}`;
        } catch (err) {
          st.innerHTML = `<div class="scan-status err">✕ ${esc(err.message || String(err))}</div>`;
        }
      };
      $('#scanFile', sheet).addEventListener('change', onScan);
      $('#scanFile2', sheet).addEventListener('change', onScan);
      function aplicarCampos(c) {
        const feitos = [];
        const set = (name, val, rotulo) => { if (val == null || val === '' || !F(name)) return; F(name).value = val; F(name).classList.add('scanned'); feitos.push(rotulo); };
        if (c.regiao && DB.regiao[c.regiao]) { F('regiao').value = c.regiao; F('regiao').dispatchEvent(new Event('change')); F('regiao').classList.add('scanned'); feitos.push('região'); }
        if (!F('nome').value.trim()) set('nome', c.nome, 'nome'); set('produtor', c.produtor, 'produtor'); set('torrefacao', c.torrefacao, 'torrefação');
        set('variedade', c.variedade, 'variedade');
        if (c.processo && DB.processo[c.processo]) set('processo', c.processo, 'processo');
        if (c.torra && DB.torra[c.torra]) set('torra', c.torra, 'torra');
        if (c.especie) set('especie', c.especie, 'espécie');
        set('dataTorra', c.dataTorra, 'data da torra'); set('altitude', c.altitude || '', 'altitude'); set('pontuacao', c.pontuacao, 'pontuação');
        if (c.notas && c.notas.length) { $$('[data-chips="notas"] .chip', sheet).forEach((ch) => ch.classList.toggle('on', c.notas.includes(ch.dataset.v))); feitos.push('notas'); }
        if (c.obs) { F('obs').value = (F('obs').value ? F('obs').value + '\n' : '') + c.obs; feitos.push('observações'); }
        return feitos;
      }
      const del = $('#delGrao', sheet);
      if (del) del.onclick = () => {
        if (confirmar('Excluir o grão e TODAS as suas extrações?')) {
          const excluidas = state.extracoes.filter((x) => x.graoId === g.id);
          excluidas.forEach((x) => hooks.extracaoExcluida.forEach((fn) => fn(x)));
          state.graos = state.graos.filter((x) => x.id !== g.id);
          state.extracoes = state.extracoes.filter((x) => x.graoId !== g.id);
          CafeFotoStore.del(g.id);
          save(); closeModal(); toast('Grão excluído'); go('#/graos');
        }
      };
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const o = { ...g, id: g.id || uid(), nome: F('nome').value.trim(), produtor: F('produtor').value.trim(), torrefacao: F('torrefacao').value.trim(), regiao: F('regiao').value, variedade: F('variedade').value.trim(), processo: F('processo').value, torra: F('torra').value, especie: F('especie').value, dataTorra: F('dataTorra').value, altitude: F('altitude').value ? +F('altitude').value : null, dosePadrao: F('dosePadrao').value ? +F('dosePadrao').value : null, acidez: +F('acidez').value, corpo: +F('corpo').value, docura: +F('docura').value, notas: chipsVal(sheet, 'notas'), obs: F('obs').value.trim(), pesoPacote: F('pesoPacote').value ? +F('pesoPacote').value : null, usadoAntes: F('usadoAntes').value ? +F('usadoAntes').value : 0, pontuacao: F('pontuacao').value.trim(), kit: F('kit').value.trim(), link: F('link').value.trim(), criadoEm: g.criadoEm || new Date().toISOString() };
        if (foto) { o.foto = foto; CafeFotoStore.set(o.id, foto); } else { delete o.foto; CafeFotoStore.del(o.id); }
        // pacotes e "sem estoque": adicionar pacotes desmarca sozinho; a caixa manda quando você a mexe
        o.pacotes = F('pacotes').value === '' ? 1 : Math.max(0, Math.round(+F('pacotes').value));
        const caixa = F('semEstoque').checked, caixaMexida = caixa !== !!g.semEstoque;
        const maisPacotes = o.pacotes > pacotes(g) && !isNew;
        if (caixaMexida) o.semEstoque = caixa;
        else if (maisPacotes) o.semEstoque = false;
        if (!o.semEstoque) delete o.semEstoque;
        if (isNew) state.graos.push(o); else { Object.assign(g, o); if (!foto) delete g.foto; if (!o.semEstoque) delete g.semEstoque; }
        if (!o.semEstoque && !caixaMexida) marcarSeZerou(isNew ? o : g, null);
        save(); closeModal(); toast(isNew ? 'Grão cadastrado' : 'Grão atualizado');
        if (isNew) go(`#/grao/${o.id}`); else render();
      });
    });
  }

  /* ======================= DETALHE DO GRÃO ======================= */
  routes.grao = (view, r) => {
    const g = grao(r.id); if (!g) { view.innerHTML = '<div class="empty">Grão não encontrado.</div>'; return; }
    $('#title').textContent = g.nome;
    const reg = DB.regiao[g.regiao] || DB.regiao.outra, proc = DB.processo[g.processo], tor = DB.torra[g.torra];
    const xs = state.extracoes.filter((x) => x.graoId === g.id).sort((a, b) => new Date(a.data) - new Date(b.data)).map(withDiag);
    const metodosUsados = [...new Set(xs.map((x) => x.metodoId))];
    const mSel = r.q.metodo && metodosUsados.includes(r.q.metodo) ? r.q.metodo : metodosUsados[0];
    const xsM = xs.filter((x) => x.metodoId === mSel);
    const cal = E.calibration(xsM, { notaAlvo: state.config.notaAlvo });
    const melhor = cal.melhor, ultimo = xsM[xsM.length - 1];
    const sugeridos = reg.metodos.map((id) => metodo(id));
    view.innerHTML = `
      <div class="card">
        ${fotoOk(g.foto) ? `<img class="grao-foto" id="gFoto" src="${g.foto}" alt="Foto de ${esc(g.nome)}">` : ''}
        <div class="row between"><div><h2>${esc(g.nome)}</h2><small>${esc(g.produtor || '')}${g.produtor && g.torrefacao ? ' · ' : ''}${esc(g.torrefacao || '')}</small></div><button class="btn sm" id="edit">Editar</button></div>
        <div class="chips" style="margin-top:8px">
          <span class="chip static">📍 ${esc(reg.nome)}</span><span class="chip static">${esc(proc ? proc.nome.split(' (')[0] : '')}</span><span class="chip static">🔥 ${esc(tor ? tor.nome : '')}</span>
          ${g.variedade ? `<span class="chip static">🌱 ${esc(g.variedade)}</span>` : ''}${g.altitude ? `<span class="chip static">⛰️ ${g.altitude} m</span>` : ''}${g.pontuacao ? `<span class="chip static">⭐ ${esc(g.pontuacao)}</span>` : ''}${g.dataTorra ? `<span class="chip static">📅 ${fmtDia(g.dataTorra)} (${Math.floor((Date.now() - new Date(g.dataTorra)) / 86400000)} d)</span>` : '<span class="chip static" style="color:var(--sobre)">📅 data da torra não informada</span>'}
        </div>
        <div class="estoque-linha">
          <span>📦 Estoque: ${restante(g) != null ? `${badgeEstoque(g)} <small class="muted">${pacotes(g)} pacote${pacotes(g) === 1 ? '' : 's'} de ${g.pesoPacote} g</small>` : `<small class="muted">${g.semEstoque ? '<span class="badge">sem estoque</span> ' : ''}informe o peso do pacote</small>`}</span>
          <span class="row" style="gap:6px">${+g.pesoPacote ? '<button class="btn sm" id="maisPacote">＋1 pacote</button>' : ''}<label class="check"><input type="checkbox" id="semEst" ${g.semEstoque ? 'checked' : ''}> Sem estoque</label></span>
        </div>
        ${g.kit ? `<p class="text-2" style="margin:8px 0 0"><small>🛒 ${esc(g.kit)}${g.link ? ` · <a href="${esc(g.link)}" target="_blank" rel="noopener">página do café ↗</a>` : ''}</small></p>` : ''}
        ${g.obs ? `<p class="text-2" style="margin:8px 0 0"><small>📝 ${esc(g.obs)}</small></p>` : ''}
        ${g.notas && g.notas.length ? `<p class="text-2" style="margin:8px 0 0"><small>${g.notas.map(esc).join(' · ')}</small></p>` : ''}
        <p class="text-2" style="margin:8px 0 0"><small>${esc(reg.dica)}</small></p>
        <div class="inline-actions"><a class="btn primary" href="#/nova?grao=${g.id}${mSel ? '&metodo=' + mSel : ''}">＋ Extrair este grão</a></div>
      </div>

      <div class="section-title"><h2>Calibração</h2></div>
      ${metodosUsados.length ? `<div class="tabs">${metodosUsados.map((id) => `<button class="tab ${id === mSel ? 'on' : ''}" onclick="location.hash='#/grao/${g.id}?metodo=${id}'">${metodo(id).icone} ${esc(metodo(id).nome)}</button>`).join('')}</div>` : ''}
      ${xsM.length ? `
      <div class="card" style="margin-top:10px">
        <div class="row between"><h3>${esc(metodo(mSel).nome)}</h3><span class="badge ${cal.status === 'calibrado' ? 'ok' : 'accent'}">${cal.status === 'calibrado' ? '✓ calibrado' : 'ajustando'} · ${cal.tentativas} tentativa(s)</span></div>
        ${melhor ? `<div class="kv">
          <div><span class="lbl">Melhor nota</span><div class="v">${Number(melhor.nota || 0).toFixed(1)}</div></div>
          ${melhor.clicks != null ? `<div><span class="lbl">Moagem</span><div class="v">${E.fmtClicks(melhor.clicks)} cl</div></div>` : ''}
          <div><span class="lbl">Razão</span><div class="v">1:${melhor.ratio}</div></div>
          <div><span class="lbl">Temp.</span><div class="v">${melhor.tempC} °C</div></div>
          <div><span class="lbl">Tempo</span><div class="v">${E.fmtTempo(melhor.tempoS)}</div></div>
          ${cal.tentativasAteCalibrar ? `<div><span class="lbl">Calibrou em</span><div class="v">${cal.tentativasAteCalibrar}ª</div></div>` : ''}
        </div>` : ''}
        <div class="section-title" style="margin-top:14px"><h3 style="margin:0">Curva de notas</h3></div>
        ${curvaNotas(xsM)}
        <div class="section-title" style="margin-top:14px"><h3 style="margin:0">Curva de sabor</h3></div>
        ${radar([{ nome: 'Última', v: sens(ultimo), cls: 'a' }].concat(melhor && melhor.id !== ultimo.id ? [{ nome: 'Melhor', v: sens(melhor), cls: 'b' }] : []))}
        ${tabelaExtracoes(xsM)}
      </div>
      ${(() => { const md = moedor(ultimo.moedorId); const reco = E.recommend(ultimo, xsM.slice(0, -1).filter((x) => x.moedorId === ultimo.moedorId), metodo(mSel), md, g, { notaAlvo: state.config.notaAlvo }); return cardReco(reco, metodo(mSel), ultimo); })()}
      ` : `<div class="card soft"><p>Nenhuma extração registrada. Métodos indicados para este terroir:</p><div class="chips">${sugeridos.map((m) => `<a class="chip" href="#/nova?grao=${g.id}&metodo=${m.id}">${m.icone} ${esc(m.nome)}</a>`).join('')}</div></div>`}

      <div class="section-title"><h2>Pontos de partida por método</h2></div>
      <div class="tbl-wrap"><table class="tbl tbl-stack"><thead><tr><th>Método</th><th>Razão</th><th>Temp.</th><th>Moagem</th><th>Tempo</th></tr></thead><tbody>
        ${metodosVisiveis().map((m) => { const md = moedorPadrao(); const sp = E.startingPoint(g, m, md); return `<tr><td><span>${m.icone} ${esc(m.nome)}${reg.metodos.includes(m.id) || reg.metodos.includes(E.baseId(m)) ? ' <span class="badge ok">indicado</span>' : ''}</span></td><td>1:${sp.ratio}</td><td>${sp.tempC} °C</td><td>${sp.clicks != null ? E.fmtClicks(sp.clicks) + ' cl' : m.grindDesc}</td><td>${E.fmtTempo(m.tempoS.min)}–${E.fmtTempo(m.tempoS.max)}</td></tr>`; }).join('')}
      </tbody></table></div>
      ${state.moedores.length ? `<small class="muted">Cliques calculados para ${esc(moedorPadrao().nome)} (moedor padrão).</small>` : '<small class="muted">Cadastre um moedor para ver cliques.</small>'}
      <div class="row" style="margin-top:16px"><button class="btn sm" id="arq">${g.arquivado ? 'Reativar grão' : 'Arquivar grão'}</button></div>`;
    $('#edit').onclick = () => formGrao(g);
    if ($('#gFoto')) $('#gFoto').onclick = () => verFoto(g.foto);
    if ($('#maisPacote')) $('#maisPacote').onclick = () => { addPacote(g); save(); toast(`Pacote adicionado: ${restante(g)} g em estoque`); render(); };
    $('#semEst').onchange = (e) => { if (e.target.checked) g.semEstoque = true; else delete g.semEstoque; save(); toast(e.target.checked ? 'Marcado como sem estoque' : 'Voltou para as telas de extração'); render(); };
    $('#arq').onclick = () => { g.arquivado = !g.arquivado; save(); render(); };
  };

  function tabelaExtracoes(xs) {
    return `<div class="tbl-wrap" style="margin-top:10px"><table class="tbl tbl-stack"><thead><tr><th>#</th><th>Data</th><th>Cliques</th><th>Razão</th><th>°C</th><th>Tempo</th><th>Nota</th><th>Diagnóstico</th></tr></thead><tbody>
      ${xs.map((x, i) => `<tr style="cursor:pointer" onclick="location.hash='#/extracao/${x.id}'"><td>${i + 1}</td><td>${new Date(x.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</td><td>${x.clicks != null ? E.fmtClicks(x.clicks) : '—'}</td><td>1:${x.ratio}</td><td>${x.tempC}</td><td>${E.fmtTempo(x.tempoS)}</td><td><strong>${x.nota != null ? Number(x.nota).toFixed(1) : '—'}</strong></td><td>${badgeDiag(x.diag)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }

  /* ---------- gráficos (SVG inline) ---------- */
  function curvaNotas(xs) {
    const W = 420, H = 190, pl = 30, pr = 12, pt = 16, pb = 26;
    const n = xs.length;
    const xAt = (i) => pl + (n === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1));
    const yAt = (v) => pt + (H - pt - pb) * (1 - v / 10);
    const pts = xs.map((x, i) => ({ x: xAt(i), y: yAt(Number(x.nota) || 0), d: x }));
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = n > 1 ? `${path} L${pts[n - 1].x.toFixed(1)},${yAt(0)} L${pts[0].x.toFixed(1)},${yAt(0)} Z` : '';
    const alvo = state.config.notaAlvo || 8;
    return `<div class="chart-box"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Notas por extração">
      <g class="grid">${[0, 2, 4, 6, 8, 10].map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${yAt(v)}" y2="${yAt(v)}"/><text x="${pl - 6}" y="${yAt(v) + 4}" text-anchor="end">${v}</text>`).join('')}</g>
      <line x1="${pl}" x2="${W - pr}" y1="${yAt(alvo)}" y2="${yAt(alvo)}" stroke="var(--ok)" stroke-dasharray="4 4" stroke-width="1.5"/><text x="${W - pr}" y="${yAt(alvo) - 4}" text-anchor="end" fill="var(--ok)">alvo ${alvo}</text>
      ${area ? `<path class="area" d="${area}"/>` : ''}<path class="line" d="${path}"/>
      ${pts.map((p, i) => `<circle class="pt ${p.d.diag ? p.d.diag.cor : ''}" cx="${p.x}" cy="${p.y}" r="5"/><text x="${p.x}" y="${H - 8}" text-anchor="middle">${i + 1}</text><circle class="hit" cx="${p.x}" cy="${p.y}" r="14" data-tip="${esc(`#${i + 1} · nota ${Number(p.d.nota || 0).toFixed(1)} · ${p.d.clicks != null ? E.fmtClicks(p.d.clicks) + ' cl · ' : ''}1:${p.d.ratio} · ${p.d.tempC} °C · ${p.d.diag ? p.d.diag.rotulo : ''}`)}"/>`).join('')}
    </svg><div class="legend"><span style="--c:var(--sub)">sub-extração</span><span style="--c:var(--ok)">equilíbrio</span><span style="--c:var(--sobre)">sobre-extração</span><span style="--c:var(--misto)">misto</span></div></div>`;
  }
  function radar(series) {
    const axes = [['acidez', 'Acidez'], ['docura', 'Doçura'], ['amargor', 'Amargor'], ['corpo', 'Corpo'], ['final', 'Final']];
    const W = 300, H = 230, cx = 150, cy = 118, R = 80;
    const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
    const P = (i, v) => [cx + Math.cos(ang(i)) * R * (v / 5), cy + Math.sin(ang(i)) * R * (v / 5)];
    const ring = (v) => axes.map((a, i) => P(i, v).map((n) => n.toFixed(1)).join(',')).join(' ');
    return `<div class="chart-box"><svg class="chart" viewBox="0 0 ${W} ${H}" style="max-width:340px;margin:0 auto" role="img" aria-label="Perfil sensorial">
      <g class="grid">${[1, 2, 3, 4, 5].map((v) => `<polygon points="${ring(v)}" fill="none" stroke="var(--border)"/>`).join('')}${axes.map((a, i) => `<line x1="${cx}" y1="${cy}" x2="${P(i, 5)[0]}" y2="${P(i, 5)[1]}"/>`).join('')}</g>
      ${series.map((s) => `<polygon points="${axes.map((a, i) => P(i, s.v[a[0]]).map((n) => n.toFixed(1)).join(',')).join(' ')}" class="area ${s.cls}" style="opacity:.25"/><polygon points="${axes.map((a, i) => P(i, s.v[a[0]]).map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" class="line ${s.cls}"/>`).join('')}
      ${axes.map((a, i) => { const [x, y] = P(i, 6.1); return `<text x="${x}" y="${y + 4}" text-anchor="middle">${a[1]}</text>`; }).join('')}
    </svg>${series.length > 1 ? `<div class="legend" style="justify-content:center">${series.map((s) => `<span style="--c:${s.cls === 'b' ? 'var(--teal)' : 'var(--accent)'}">${esc(s.nome)}</span>`).join('')}</div>` : ''}</div>`;
  }
  document.addEventListener('mouseover', (e) => { const h = e.target.closest('.hit'); if (!h) return; const box = h.closest('.chart-box'); let t = $('.tip', box); if (!t) { t = document.createElement('div'); t.className = 'tip'; box.appendChild(t); } t.textContent = h.dataset.tip; const r = h.getBoundingClientRect(), b = box.getBoundingClientRect(); posicionarDica(t, box, r.left - b.left + r.width / 2, r.top - b.top); });
  document.addEventListener('mouseout', (e) => { if (e.target.closest && e.target.closest('.hit')) { const t = $('.tip', e.target.closest('.chart-box')); if (t) t.remove(); } });
  document.addEventListener('click', (e) => { const h = e.target.closest('.hit'); if (h) toast(h.dataset.tip); });

  /* ======================= MAIS ======================= */
  routes.mais = (view) => {
    $('#title').textContent = 'Mais';
    view.innerHTML = `<div class="list">
      <div class="item" onclick="location.hash='#/equipamentos'"><div class="ico m">${ICO('kalita')}</div><div><div class="t">Equipamentos</div><div class="s">${DB.metodos.length} métodos (${state.metodos.length} personalizado${state.metodos.length === 1 ? '' : 's'}) · ${state.moedores.length} moedor(es)</div></div><div>›</div></div>
      <div class="item" onclick="location.hash='#/biblioteca'"><div class="ico">📚</div><div><div class="t">Biblioteca</div><div class="s">Regiões, processos, torras, métodos e indicações</div></div><div>›</div></div>
      ${hooks.mais.map((fn) => fn()).join('')}
      <div class="item" onclick="location.hash='#/ajustes'"><div class="ico">💾</div><div><div class="t">Backup e ajustes</div><div class="s">Exportar/importar dados, instalar no celular</div></div><div>›</div></div>
    </div>`;
  };

  /* ======================= MOEDORES ======================= */
  routes.moedores = (view, r) => {
    $('#title').textContent = 'Moedores';
    view.innerHTML = `<div class="row between"><h2 style="margin:0">Moedores</h2><button class="btn primary sm" id="novo">＋ Novo moedor</button></div>
      <div class="list" style="margin-top:12px">${state.moedores.length ? state.moedores.map((m) => `<div class="item" data-id="${m.id}"><div class="ico">⚙️</div><div><div class="t">${esc(m.nome)}</div><div class="s">${esc(m.tipo)} · escala ${m.min}–${m.max}, passo ${m.passo} · ${m.direcao === 'maior=fino' ? 'maior = fino' : 'menor = fino'}</div><div class="s">${Object.entries(m.refs || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${metodo(k) ? metodo(k).nome.split(' ')[0] : k} ${v}`).join(' · ')}</div>${m.obs ? `<div class="s" style="margin-top:4px">${esc(m.obs)}</div>` : ''}</div><div>›</div></div>`).join('') : '<div class="empty"><div class="big">⚙️</div>Nenhum moedor. Sem moedor o app sugere apenas a descrição da moagem.</div>'}</div>`;
    $('#novo').onclick = () => formMoedor();
    $$('.item[data-id]', view).forEach((el) => (el.onclick = () => formMoedor(moedor(el.dataset.id))));
    if (r.q.novo) { history.replaceState(null, '', '#/moedores'); formMoedor(); }
  };
  function formMoedor(m) {
    const isNew = !m;
    m = m || { nome: '', tipo: 'manual', min: 0, max: 40, passo: 1, direcao: 'menor=fino', refs: {} };
    modal(`<div class="sheet-head"><h2>${isNew ? 'Novo moedor' : 'Editar moedor'}</h2><button class="btn sm ghost" data-close>✕</button></div>
      <form id="fMo">
        <label class="field"><span class="lbl">Modelo (preenche a escala)</span><select id="modelo"><option value="">— escolher modelo —</option>${DB.moedoresModelo.map((x, i) => `<option value="${i}">${esc(x.nome)}</option>`).join('')}</select></label>
        <div class="form-grid">
          <label class="field full"><span class="lbl">Nome *</span><input type="text" name="nome" value="${esc(m.nome)}" required></label>
          <label class="field"><span class="lbl">Tipo</span>${sel('tipo', [{ id: 'manual', nome: 'Manual' }, { id: 'elétrico', nome: 'Elétrico' }], m.tipo)}</label>
          <label class="field"><span class="lbl">Direção</span>${sel('direcao', [{ id: 'menor=fino', nome: 'Menor número = mais fino' }, { id: 'maior=fino', nome: 'Maior número = mais fino' }], m.direcao)}</label>
          <label class="field"><span class="lbl">Mínimo</span><input type="number" name="min" value="${m.min}" step="any" inputmode="decimal"></label>
          <label class="field"><span class="lbl">Máximo</span><input type="number" name="max" value="${m.max}" step="any" inputmode="decimal"></label>
          <label class="field"><span class="lbl">Passo (sub-clique)</span><input type="number" name="passo" value="${m.passo}" step="any" min="0.01" inputmode="decimal"><div class="help">1 = clique inteiro; 0,5 = meio clique; 0,33 = terço.</div></label>
          <label class="field"><span class="lbl">Ajuste padrão (cliques)</span><input type="number" name="passoAjuste" value="${m.passoAjuste || ''}" step="any" inputmode="decimal" placeholder="auto"><div class="help">Quanto o motor move por ajuste normal. Vazio = automático.</div></label>
          <label class="field full"><span class="lbl">Observações / como contar os cliques</span><textarea name="obs">${esc(m.obs || '')}</textarea></label>
        </div>
        <div class="lbl">Referências por método (cliques)</div>
        <div class="form-grid">${DB.metodos.filter((x) => !x.arquivado).map((x) => `<label class="field"><span class="lbl">${x.icone} ${esc(nomeCurto(x))}</span><input type="number" name="ref_${x.id}" value="${m.refs && m.refs[x.id] != null ? m.refs[x.id] : ''}" step="any" inputmode="decimal" placeholder="${x.base && metodo(x.base) ? 'usa ' + esc(nomeCurto(metodo(x.base))) : '—'}"></label>`).join('')}</div>
        <div class="sheet-foot">${isNew ? '' : '<button type="button" class="btn danger" id="delMo">Excluir</button>'}<button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>
      </form>`, (sheet) => {
      const f = $('#fMo', sheet), F = (n) => f.elements[n];
      $('#modelo', sheet).onchange = (e) => { const mm = DB.moedoresModelo[+e.target.value]; if (!mm) return; if (!F('nome').value) F('nome').value = mm.nome.split(' (')[0]; F('tipo').value = mm.tipo; F('min').value = mm.min; F('max').value = mm.max; F('passo').value = mm.passo; if (mm.direcao) F('direcao').value = mm.direcao; if (mm.obs) F('obs').value = mm.obs; F('passoAjuste').value = mm.passoAjuste || ''; DB.metodos.forEach((x) => (F('ref_' + x.id).value = mm.refs[x.id] != null ? mm.refs[x.id] : '')); };
      const del = $('#delMo', sheet); if (del) del.onclick = () => { if (confirmar('Excluir moedor? As extrações continuam, mas sem referência de cliques.')) { state.moedores = state.moedores.filter((x) => x.id !== m.id); save(); closeModal(); render(); } };
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const refs = Object.assign({}, m.refs); DB.metodos.forEach((x) => { const el = F('ref_' + x.id); if (!el) return; if (el.value !== '') refs[x.id] = +el.value; else delete refs[x.id]; });
        const o = { ...m, id: m.id || uid(), nome: F('nome').value.trim(), tipo: F('tipo').value, direcao: F('direcao').value, min: +F('min').value, max: +F('max').value, passo: +F('passo').value || 1, passoAjuste: F('passoAjuste').value ? +F('passoAjuste').value : null, refs, obs: F('obs').value.trim() };
        if (o.max <= o.min) { toast('Máximo deve ser maior que o mínimo.'); return; }
        if (isNew) state.moedores.push(o); else Object.assign(m, o);
        save(); closeModal(); toast('Moedor salvo'); render();
      });
    });
  }

  /* ======================= BIBLIOTECA ======================= */
  routes.biblioteca = (view, r) => {
    $('#title').textContent = 'Biblioteca';
    const tab = r.q.tab || 'regioes';
    const q = (r.q.q || '').toLowerCase();
    const tabs = [['regioes', 'Regiões'], ['processos', 'Processos'], ['torras', 'Torras'], ['metodos', 'Métodos'], ['receitas', 'Receitas'], ['indicacoes', 'Indicações']];
    const match = (s) => !q || String(s).toLowerCase().includes(q);
    let body = '';
    if (tab === 'regioes') body = DB.regioes.filter((x) => match(x.nome + x.perfil + x.notas.join(' ') + x.uf)).map((x) => `<details class="lib"><summary>${esc(x.nome)} <span class="badge">${esc(x.uf)}</span></summary><div class="body">
      <p><strong>Altitude:</strong> ${x.altitude[0]}–${x.altitude[1]} m · <strong>Clima:</strong> ${esc(x.clima)}</p>
      <p><strong>Perfil:</strong> ${esc(x.perfil)}</p>
      <div class="chips" style="margin-bottom:8px">${x.notas.map((n) => `<span class="chip static">${esc(n)}</span>`).join('')}</div>
      <p><strong>Acidez</strong> ${'●'.repeat(x.acidez)}${'○'.repeat(5 - x.acidez)} · <strong>Corpo</strong> ${'●'.repeat(x.corpo)}${'○'.repeat(5 - x.corpo)} · <strong>Doçura</strong> ${'●'.repeat(x.docura)}${'○'.repeat(5 - x.docura)}</p>
      ${x.variedades.length ? `<p><strong>Variedades comuns:</strong> ${x.variedades.map(esc).join(', ')}</p>` : ''}
      <p><strong>Processos típicos:</strong> ${x.processos.map((p) => DB.processo[p].nome.split(' (')[0]).join(', ')}</p>
      <p><strong>Métodos indicados:</strong> ${x.metodos.map((m) => metodo(m).icone + ' ' + metodo(m).nome).join(', ')}</p>
      <p>💡 ${esc(x.dica)}</p></div></details>`).join('');
    if (tab === 'processos') body = DB.processos.filter((x) => match(x.nome + x.sensorial)).map((x) => `<details class="lib"><summary>${esc(x.nome)}</summary><div class="body"><p>${esc(x.descricao)}</p><p><strong>Sensorial:</strong> ${esc(x.sensorial)}</p><p><strong>Ajuste automático:</strong> temperatura ${x.ajuste.tempC >= 0 ? '+' : ''}${x.ajuste.tempC} °C · razão ${x.ajuste.ratio >= 0 ? '+' : ''}${x.ajuste.ratio} · moagem ${x.ajuste.moagem >= 0 ? '+' : ''}${x.ajuste.moagem} passo</p><p>💡 ${esc(x.dica)}</p></div></details>`).join('');
    if (tab === 'torras') body = DB.torras.filter((x) => match(x.nome + x.sensorial)).map((x) => `<details class="lib"><summary>${esc(x.nome)} <span class="badge">Agtron ${esc(x.agtron)}</span></summary><div class="body"><p>${esc(x.cor)}</p><p><strong>Sensorial:</strong> ${esc(x.sensorial)}</p><p><strong>Base:</strong> filtrado ${x.base.filtroTempC} °C · 1:${x.base.ratioFiltro} — espresso ${x.base.espressoTempC} °C · 1:${x.base.ratioEspresso}</p><p><strong>Descanso pós-torra:</strong> filtrado ${x.descansoDias.filtrado.join('–')} dias · espresso ${x.descansoDias.espresso.join('–')} dias</p><p>💡 ${esc(x.dica)}</p></div></details>`).join('');
    if (tab === 'metodos') body = DB.metodos.filter((x) => match(x.nome + x.tipo)).map((x) => `<details class="lib"><summary>${x.icone} ${esc(x.nome)} <span class="badge">${esc(x.tipo)}</span></summary><div class="body">
      <p><strong>Razão:</strong> 1:${x.ratio.min}–1:${x.ratio.max} (padrão 1:${x.ratio.padrao}) · <strong>Dose:</strong> ${x.dosePadrao} g</p>
      <p><strong>Temperatura:</strong> ${x.tempC.min}–${x.tempC.max} °C · <strong>Tempo:</strong> ${E.fmtTempo(x.tempoS.min)}–${E.fmtTempo(x.tempoS.max)}${E.tipoMetodo(x) === 'filtro' ? ` (para ${x.dosePadrao} g; escala com a dose)` : ''}</p>
      <p><strong>Moagem:</strong> ${esc(x.grindDesc)} (~${x.microns[0]}–${x.microns[1]} µm)</p>
      <p><strong>Sensibilidade:</strong> ${esc(x.sensibilidade)}</p><p><strong>Receita base:</strong> ${esc(x.receita)}</p></div></details>`).join('');
    if (tab === 'receitas') body = DB.metodos.filter((x) => E.receita(x, x.dosePadrao) && match(x.nome)).map((x) => { const rc = E.receita(x, x.dosePadrao, E.isEspresso(x) ? Math.round(x.dosePadrao * x.ratio.padrao * 10) / 10 : Math.round(x.dosePadrao * x.ratio.padrao)); return `<details class="lib"><summary>${x.icone} ${esc(x.nome)} <span class="badge">${x.dosePadrao} g / ${rc.total} g</span></summary><div class="body"><p><strong>${esc(rc.nome)}</strong> · ${x.tempC.padrao} °C · moagem ${esc(x.grindDesc)}</p>${tabelaReceita(rc, x, false)}<p style="margin-top:8px">💡 ${esc(x.sensibilidade)}</p></div></details>`; }).join('');
    if (tab === 'indicacoes') body = `<div class="tbl-wrap"><table class="tbl tbl-stack"><thead><tr><th>Perfil do grão</th><th>Métodos</th><th>Razão</th><th>Temp.</th><th>Torra</th></tr></thead><tbody>${DB.indicacoesPerfil.filter((x) => match(x.perfil)).map((x) => `<tr><td>${esc(x.perfil)}</td><td><span>${x.metodos.map((m) => metodo(m).icone + ' ' + metodo(m).nome.split(' (')[0]).join('<br>')}</span></td><td>${esc(x.razao)}</td><td>${esc(x.tempC)}</td><td>${esc(x.torra)}</td></tr>`).join('')}</tbody></table></div>
      <div class="card soft" style="margin-top:12px"><h3>Escala de moagem</h3><table class="tbl">${DB.grindEscala.map((g) => `<tr><td>${g.n}</td><td><strong>${g.nome}</strong></td><td>${esc(g.ex)}</td></tr>`).join('')}</table></div>`;
    view.innerHTML = `<input class="search" type="text" id="q" placeholder="Buscar…" value="${esc(r.q.q || '')}">
      <div class="tabs">${tabs.map(([id, n]) => `<button class="tab ${id === tab ? 'on' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>
      <div style="margin-top:10px">${body || '<div class="empty">Nada encontrado.</div>'}</div>`;
    $$('.tab', view).forEach((b) => (b.onclick = () => go(`#/biblioteca?tab=${b.dataset.tab}&q=${encodeURIComponent($('#q').value)}`)));
    let t; $('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { history.replaceState(null, '', `#/biblioteca?tab=${tab}&q=${encodeURIComponent(e.target.value)}`); render(); $('#q').focus(); $('#q').setSelectionRange(99, 99); }, 350); });
  };

  /* ======================= AJUSTES / BACKUP ======================= */
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; const b = $('#btnInstall'); if (b) b.hidden = false; });
  routes.ajustes = (view) => {
    $('#title').textContent = 'Backup e ajustes';
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const isFile = location.protocol === 'file:';
    view.innerHTML = `
      <div class="card"><h3>Backup</h3><p class="text-2">Os dados ficam neste aparelho (armazenamento local do navegador). Com a sincronização ativa, uma cópia criptografada vai para o seu GitHub. Exporte um backup de vez em quando.</p>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" id="exp">⬇︎ Exportar JSON</button><button class="btn" id="expCsv">📊 Exportar diário (CSV)</button><label class="btn">⬆︎ Importar JSON<input type="file" id="imp" accept="application/json,.json" hidden></label><button class="btn" id="copy">Copiar para a área de transferência</button></div>
        <textarea id="paste" placeholder="…ou cole aqui um backup JSON e clique em Importar do texto" style="margin-top:10px"></textarea>
        <div class="row" style="margin-top:6px"><button class="btn sm" id="impTxt">Importar do texto</button></div></div>
      <div class="card" style="margin-top:12px"><h3>Preferências</h3>
        <label class="field"><span class="lbl">Nota alvo para considerar “calibrado”</span><input type="number" id="alvo" min="5" max="10" step="0.5" value="${state.config.notaAlvo || 8}"></label>
        <label class="field"><span class="lbl">Tema</span>${sel('tema', [{ id: 'auto', nome: 'Automático' }, { id: 'light', nome: 'Claro' }, { id: 'dark', nome: 'Escuro' }], state.config.tema || 'auto', 'id="tema"')}</label></div>
      <div class="card" style="margin-top:12px"><h3>Instalar no celular</h3>
        ${standalone ? '<p class="text-2">✅ Você já está usando o app instalado.</p>' : ''}
        ${isFile ? '<p class="text-2">Você abriu o arquivo diretamente (file://). Funciona, mas para instalar como app é preciso servir a pasta por HTTP/HTTPS — veja o README (GitHub Pages ou um servidor local na mesma rede Wi-Fi).</p>' : ''}
        <button class="btn primary" id="btnInstall" ${deferredInstall ? '' : 'hidden'}>Instalar aplicativo</button>
        <p class="text-2" style="margin-top:8px"><strong>Android (Chrome):</strong> menu ⋮ → “Instalar aplicativo” ou “Adicionar à tela inicial”.<br><strong>iPhone (Safari):</strong> botão Compartilhar → “Adicionar à Tela de Início”.</p></div>
      <div id="ajustesModulos"></div>
      <div class="card" style="margin-top:12px"><h3>Meus cafés e moedores</h3><p class="text-2">O app vem com o catálogo dos cafés que você comprou (Maeda, Encantos do Café, Net Cafés, Colheita) e com o Starseeker E55 Pro e o Kingrinder K2. Se você excluiu algum e quer de volta, reimporte: só entra o que estiver faltando.</p><button class="btn" id="reimport">Reimportar catálogo</button></div>
      <div class="card" style="margin-top:12px"><h3>Dados de exemplo</h3><p class="text-2">Carrega 1 moedor, 2 grãos e uma sequência de extrações para você ver o motor funcionando.</p><button class="btn" id="demo">Carregar exemplo</button></div>
      <div class="card" style="margin-top:12px"><h3>Zona de perigo</h3><button class="btn danger" id="wipe">Apagar todos os dados</button></div>
      <div class="card" style="margin-top:12px"><h3>Versão do app</h3><p class="text-2">Versão instalada: <strong id="swVersao">${swVersao || (navigator.serviceWorker && navigator.serviceWorker.controller ? 'verificando…' : 'sem cache offline')}</strong>. O app se atualiza sozinho quando abre com internet. Se alguma novidade não aparecer, force a atualização: os seus dados (grãos, extrações, cafeína) não são apagados.</p><button class="btn" id="btnAtualizar">🔄 Forçar atualização</button></div>
      <p class="muted" style="margin-top:16px"><small>Laboratório de Cafeteria · dados locais, com sincronização opcional e criptografada.</small></p>`;
    $('#exp').onclick = () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cafelab-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); };
    $('#expCsv').onclick = () => exportarCSV(state.extracoes);
    $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(state)); toast('Copiado'); } catch (e) { toast('Não foi possível copiar'); } };
    const importar = (txt) => { try { const s = JSON.parse(txt); if (!s || !Array.isArray(s.graos) || !Array.isArray(s.extracoes)) throw new Error('formato'); if (!confirmar(`Importar ${s.graos.length} grão(s), ${(s.moedores || []).length} moedor(es) e ${s.extracoes.length} extração(ões)? Isso substitui os dados atuais.`)) return; state = { graos: s.graos, moedores: s.moedores || [], extracoes: s.extracoes, metodos: s.metodos || [], cafeina: s.cafeina || state.cafeina || [], latte: s.latte || state.latte || [], config: s.config || state.config }; save(); applyTheme(); toast('Backup importado'); go('#/inicio'); } catch (e) { toast('Arquivo inválido'); } };
    $('#imp').onchange = (e) => { const fl = e.target.files[0]; if (!fl) return; const rd = new FileReader(); rd.onload = () => importar(rd.result); rd.readAsText(fl); };
    $('#impTxt').onclick = () => importar($('#paste').value);
    $('#alvo').onchange = (e) => { state.config.notaAlvo = +e.target.value || 8; save(); toast('Salvo'); };
    $('#tema').onchange = (e) => { state.config.tema = e.target.value; save(); applyTheme(); };
    $('#btnInstall').onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('#btnInstall').hidden = true; };
    hooks.ajustes.forEach((fn) => fn($('#ajustesModulos')));
    $('#btnAtualizar').onclick = () => { toast('Atualizando…'); forcarAtualizacao(); };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage('versao');
    $('#reimport').onclick = () => { const r = seedCatalogo(true); toast(`Importados: ${r.graos} grão(s), ${r.moedores} moedor(es)`); };
    $('#demo').onclick = () => { if (state.extracoes.length && !confirmar('Adicionar dados de exemplo aos dados atuais?')) return; carregarDemo(); toast('Exemplo carregado'); go('#/inicio'); };
    $('#wipe').onclick = () => { if (confirmar('Apagar TODOS os dados deste aparelho? Não há como desfazer.')) { (state.graos || []).forEach((g) => CafeFotoStore.del(g.id)); localStorage.removeItem(KEY); state = load(); registrarMetodos(); toast('Dados apagados'); go('#/inicio'); } };
  };

  function carregarDemo() {
    const md = { id: uid(), nome: 'Timemore C3', tipo: 'manual', min: 0, max: 36, passo: 1, direcao: 'menor=fino', refs: DB.moedoresModelo[0].refs };
    const g1 = { id: uid(), nome: 'Sítio Boa Vista — Bourbon Amarelo', produtor: 'Família Pereira', torrefacao: 'Torra local', regiao: 'mantiqueira', variedade: 'Bourbon Amarelo', processo: 'natural', torra: 'media-clara', especie: 'arabica', dataTorra: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10), acidez: 4, corpo: 3, docura: 4, notas: ['frutas vermelhas', 'caramelo', 'floral'], criadoEm: new Date().toISOString() };
    const g2 = { id: uid(), nome: 'Fazenda Recanto — Catuaí CD', produtor: 'Fazenda Recanto', regiao: 'cerrado-mineiro', variedade: 'Catuaí Vermelho', processo: 'cereja-descascado', torra: 'media', especie: 'arabica', dataTorra: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), acidez: 2, corpo: 4, docura: 4, notas: ['chocolate', 'nozes', 'caramelo'], criadoEm: new Date().toISOString() };
    state.moedores.push(md); state.graos.push(g1, g2);
    const d = (h) => new Date(Date.now() - h * 3600000).toISOString();
    const seq = [
      { graoId: g1.id, metodoId: 'v60', moedorId: md.id, data: d(72), clicks: 20, dose: 15, water: 240, ratio: 16, tempC: 94, tempoS: 150, acidez: 5, docura: 2, amargor: 1, corpo: 2, final: 2, sinais: ['azedo', 'aguado'], descritores: ['cítrico'], nota: 5.5, obs: 'Drenou rápido.' },
      { graoId: g1.id, metodoId: 'v60', moedorId: md.id, data: d(48), clicks: 17, dose: 15, water: 240, ratio: 16, tempC: 94, tempoS: 215, acidez: 2, docura: 3, amargor: 4, corpo: 4, final: 3, sinais: ['adstringente'], descritores: ['caramelo'], nota: 6.5, obs: 'Passou do ponto.' },
      { graoId: g1.id, metodoId: 'v60', moedorId: md.id, data: d(24), clicks: 18, dose: 15, water: 240, ratio: 16, tempC: 94, tempoS: 185, acidez: 4, docura: 4, amargor: 2, corpo: 3, final: 4, sinais: [], descritores: ['frutas vermelhas', 'caramelo', 'floral'], nota: 8.5, obs: 'Aí sim.' },
      { graoId: g2.id, metodoId: 'espresso', moedorId: md.id, data: d(30), clicks: 9, dose: 18, water: 36, ratio: 2, tempC: 92.5, tempoS: 19, acidez: 4, docura: 2, amargor: 2, corpo: 3, final: 2, sinais: ['azedo', 'salgado'], descritores: [], nota: 5, obs: 'Correu rápido.' },
      { graoId: g2.id, metodoId: 'espresso', moedorId: md.id, data: d(6), clicks: 8, dose: 18, water: 36, ratio: 2, tempC: 92.5, tempoS: 27, acidez: 3, docura: 4, amargor: 3, corpo: 4, final: 4, sinais: [], descritores: ['chocolate', 'caramelo'], nota: 8, obs: '' }
    ];
    seq.forEach((x) => { x.id = uid(); if (x.metodoId === 'espresso') x.yieldG = x.water; x.diag = E.diagnose(x, metodo(x.metodoId)); state.extracoes.push(x); });
    save();
  }

  /* ---------------- PWA ---------------- */
  let swVersao = '';
  async function forcarAtualizacao() {
    try {
      if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); }
      if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); }
    } catch (e) { /* segue para o reload */ }
    location.replace(location.pathname + '?v=' + Date.now() + location.hash);
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    // recarrega uma vez quando uma versão nova assume o controle
    let recarregou = false;
    const tinhaControle = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (tinhaControle && !recarregou) { recarregou = true; location.reload(); } });
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.versao) { swVersao = e.data.versao; const el = document.getElementById('swVersao'); if (el) el.textContent = swVersao; } });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage('versao');
    }).catch(() => { /* sem SW (ex.: http em rede local) */ }));
  }

  /* ---------------- API para módulos (timer, rótulo, cafeína) ---------------- */
  const hooks = { home: [], tiles: [], mais: [], ajustes: [], extracaoSalva: [], extracaoEditada: [], extracaoExcluida: [], salvo: [], boot: [] };
  window.CafeLab = {
    state: () => state, save, carregarDemo, routes, render, go, toast, modal, closeModal, esc, uid, $, $$, fmtData, parseTempo,
    grao, moedor, metodo, extracao, BEAN, hooks, nowLocal, fotoStore: CafeFotoStore, exportarCSV
  };

  /* ---------------- boot (após os módulos registrarem rotas) ---------------- */
  function boot() { applyTheme(); seedCatalogo(false); hidratarFotos(); render(); hooks.boot.forEach((fn) => fn()); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
