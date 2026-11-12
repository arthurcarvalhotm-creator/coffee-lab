/* =====================================================================
 * Laboratório de Cafeteria — Leitura de rótulos (câmera)
 * 1) IA com visão, à escolha do usuário:
 *    - Claude (API da Anthropic, SDK oficial empacotado em vendor/), ou
 *    - Gemini (API do Google AI Studio, chamada REST direta).
 *    Ambos devolvem JSON validado por schema, mapeado para o banco nativo.
 * 2) Sem chave: OCR local com Tesseract.js (carregado sob demanda) +
 *    interpretação por regras (regiões, processos, torras, variedades…).
 * As chaves ficam só neste aparelho (localStorage) e nunca entram no backup.
 * ===================================================================== */
(function () {
  'use strict';
  const DB = window.CAFE_DB;
  const KEY_API = 'cafelab.anthropic.key';
  const KEY_MODEL = 'cafelab.anthropic.model';
  const MODELOS = [
    { id: 'claude-3-7-sonnet-latest', nome: 'Claude 3.7 Sonnet (padrão, mais preciso)' },
    { id: 'claude-3-5-sonnet-latest', nome: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-latest', nome: 'Claude 3.5 Haiku (mais rápido/barato)' }
  ];
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';

  const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* */ } };
  const getKey = () => lsGet(KEY_API);
  const getModel = () => lsGet(KEY_MODEL) || MODELOS[0].id;
  /* Gemini */
  const KEY_PROV = 'cafelab.ia.provedor';
  const KEY_GEM = 'cafelab.gemini.key';
  const KEY_GEM_MODEL = 'cafelab.gemini.model';
  const KEY_GEM_CAT = 'cafelab.gemini.catalogo';
  const GEM_AUTO = 'auto';
  const GEM_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const CATALOGO_VERSAO = 2;
  const CATALOGO_TTL_MS = 60 * 60 * 1000;
  const ESCADA_GEMINI_PADRAO = [
    'gemini-4-hydrogen',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview'
  ];
  const MODELOS_GEMINI = [
    { id: GEM_AUTO, nome: 'Automático (sempre do mais recente)' },
    { id: 'gemini-4-hydrogen', nome: 'Gemini 4 Hydrogen (mais recente)' },
    { id: 'gemini-3.8-flash', nome: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.6-flash', nome: 'Gemini 3.6 Flash' },
    { id: 'gemini-3.5-flash-lite', nome: 'Gemini 3.5 Flash-Lite (rápido/leve)' },
    { id: 'gemini-3.1-flash-lite', nome: 'Gemini 3.1 Flash-Lite' },
    { id: 'gemini-4-argon', nome: 'Gemini 4 Argon (plano pago)' }
  ];
  try { sessionStorage.removeItem('cafelab.gemini.cooldown'); } catch (e) { /* */ }
  const normalizarModeloGeminiId = (id) => String(id || '').trim().replace(/^models\//, '');
  function ehModeloGeminiLegado(id) {
    const m = normalizarModeloGeminiId(id).toLowerCase();
    if (!m) return false;
    if (/^gemini-(?:1|2)(?:\.|$|-)/.test(m)) return true;
    return m === 'gemini-3.5-flash' || m.startsWith('gemini-3.5-flash-0') || m === 'gemini-3.7-flash';
  }
  const getGemKey = () => lsGet(KEY_GEM).trim();
  function getGemModel() {
    const salvo = normalizarModeloGeminiId(lsGet(KEY_GEM_MODEL));
    if (!salvo) return GEM_AUTO;
    if (ehModeloGeminiLegado(salvo)) {
      lsSet(KEY_GEM_MODEL, '');
      return GEM_AUTO;
    }
    return salvo;
  }
  /* provedor ativo: o escolhido, se tiver chave; senão o que tiver chave */
  function provedor() {
    const escolhido = lsGet(KEY_PROV);
    if (escolhido === 'gemini' && getGemKey()) return 'gemini';
    if (escolhido === 'anthropic' && getKey()) return 'anthropic';
    if (getKey()) return 'anthropic';
    if (getGemKey()) return 'gemini';
    return 'ocr';
  }

  /* ---------- imagem: reduz para ~1568 px, JPEG ---------- */
  function carregarImagem(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não foi possível abrir a imagem.')); };
      img.src = url;
    });
  }
  function redimensionar(img, max, cinza) {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d');
    if (cinza) ctx.filter = 'grayscale(1) contrast(1.35)';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  /* ---------- Claude ---------- */
  const enumIds = (arr) => [''].concat(arr.map((x) => x.id));
  const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
      nome: { type: 'string', description: 'Nome comercial do café/lote como aparece no rótulo (ex.: "Frutas Amarelas"). Vazio se não houver.' },
      torrefacao: { type: 'string', description: 'Marca/torrefação.' },
      produtor: { type: 'string', description: 'Produtor, fazenda ou sítio, com cidade/UF se houver.' },
      regiao: { type: 'string', enum: enumIds(DB.regioes), description: 'Id da região produtora do banco; "outra" se for uma região não listada; vazio se não houver indicação.' },
      variedade: { type: 'string' },
      processo: { type: 'string', enum: enumIds(DB.processos) },
      torra: { type: 'string', enum: enumIds(DB.torras) },
      especie: { type: 'string', enum: ['', 'arabica', 'canephora', 'blend'] },
      altitude_m: { type: 'integer', description: 'Altitude em metros; se for faixa, o ponto médio; 0 se ausente.' },
      data_torra: { type: 'string', description: 'Data da torra em AAAA-MM-DD; vazio se ausente. Rótulos brasileiros usam DD/MM/AAAA.' },
      pontuacao: { type: 'string', description: 'Pontuação SCA como no rótulo (ex.: "86", "84+"); vazio se ausente.' },
      notas: { type: 'array', items: { type: 'string', enum: DB.descritores }, description: 'Descritores do rótulo mapeados para a lista permitida (use o mais próximo).' },
      notas_originais: { type: 'array', items: { type: 'string' }, description: 'Notas sensoriais exatamente como escritas no rótulo.' },
      observacoes: { type: 'string', description: 'Outras informações úteis (safra, peso, método recomendado, receita sugerida).' },
      texto_lido: { type: 'string', description: 'Transcrição do texto legível do rótulo.' }
    },
    required: ['nome', 'torrefacao', 'produtor', 'regiao', 'variedade', 'processo', 'torra', 'especie', 'altitude_m', 'data_torra', 'pontuacao', 'notas', 'notas_originais', 'observacoes', 'texto_lido']
  };
  function promptClaude() {
    const regioes = DB.regioes.map((r) => `${r.id} = ${r.nome} (${r.uf})`).join('; ');
    const processos = DB.processos.map((p) => `${p.id} = ${p.nome}`).join('; ');
    const torras = DB.torras.map((t) => `${t.id} = ${t.nome} (Agtron ${t.agtron})`).join('; ');
    return `Esta é a foto de um pacote de café especial brasileiro. Extraia as informações do rótulo para cadastrar o grão num diário de extrações.

Regras:
- Use apenas o que está escrito ou claramente implícito no rótulo; campos ausentes ficam vazios (ou 0 para altitude). Não invente produtor, altitude ou pontuação.
- Região: mapeie cidade/região para o id do banco. Exemplos: Carmo de Minas → mantiqueira; Franca/Pedregulho → alta-mogiana; Patrocínio/Araxá → cerrado-mineiro; Alto Jequitibá, Espera Feliz, Dores do Rio Preto, Alto Caparaó → caparao; Venda Nova do Imigrante → montanhas-es; Piatã/Ibicoara → chapada-diamantina.
- Processo: "natural fermentado", "fermentação induzida", leveduras, koji → fermentacao-induzida; "anaeróbico", "maceração carbônica" → anaerobico; "CD", "cereja descascado" → cereja-descascado; "lavado", "despolpado" → lavado.
- Torra: "média-clara"/"clara-média" → media-clara; "média-escura" → media-escura.

Ids de região: ${regioes}.
Ids de processo: ${processos}.
Ids de torra: ${torras}.`;
  }

  async function lerComClaude(canvas, progresso) {
    progresso('Enviando foto para a IA…');
    let Anthropic;
    try {
      ({ default: Anthropic } = await import('./vendor/anthropic-sdk.mjs'));
    } catch (e) {
      throw new Error('Não foi possível carregar o módulo da IA. Abra o app por http(s) (GitHub Pages ou servidor local), não pelo arquivo direto.');
    }
    const client = new Anthropic({ apiKey: getKey(), dangerouslyAllowBrowser: true, maxRetries: 2 });
    const model = getModel();
    const data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    const params = {
      model,
      max_tokens: 8192,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
        { type: 'text', text: promptClaude() }
      ] }]
    };
    let resp;
    try {
      resp = await client.beta.messages.create(params);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new Error('Chave da API inválida. Confira em Mais → Backup e ajustes.');
      if (e instanceof Anthropic.PermissionDeniedError) throw new Error('A chave não tem permissão para este modelo. Escolha outro modelo nos ajustes.');
      if (e instanceof Anthropic.RateLimitError) throw new Error('Limite de uso da API atingido. Tente de novo em instantes.');
      if (e instanceof Anthropic.BadRequestError) throw new Error('A API recusou a requisição: ' + (e.message || '').slice(0, 200));
      if (e instanceof Anthropic.APIConnectionError) throw new Error('Sem conexão com a API da Anthropic. Verifique a internet.');
      if (e instanceof Anthropic.APIError) throw new Error(`Erro da API (${e.status || '?'}): ${(e.message || '').slice(0, 200)}`);
      throw e;
    }
    if (resp.stop_reason === 'refusal') throw new Error('A IA não processou esta imagem. Tente outra foto ou use o OCR local (remova a chave).');
    if (resp.stop_reason === 'max_tokens') throw new Error('Resposta da IA incompleta. Tente novamente.');
    const txt = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return mapear(txt, 'Claude', resp.model && resp.model !== model ? `Respondido por ${resp.model} (fallback).` : '');
  }

  /* Converte o JSON da IA (Claude ou Gemini) nos campos do formulário */
  function mapear(txt, quem, aviso) {
    let j;
    const limpo = String(txt || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try { j = JSON.parse(limpo); } catch (e) { throw new Error('A IA devolveu um formato inesperado. Tente novamente.'); }
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('A IA devolveu um formato inesperado. Tente novamente.');
    const ok = (v, tabela) => (v && tabela[v] ? v : '');
    const str = (v) => (v == null ? '' : String(v).trim());
    const notasOrig = Array.isArray(j.notas_originais) ? j.notas_originais.map(str).filter(Boolean) : [];
    const obsExtra = str(j.observacoes);
    const obs = [notasOrig.length ? 'Notas do rótulo: ' + notasOrig.join(', ') : '', obsExtra].filter(Boolean).join(' · ');
    return {
      fonte: 'ia', quem,
      texto: str(j.texto_lido),
      campos: {
        nome: str(j.nome), torrefacao: str(j.torrefacao), produtor: str(j.produtor), regiao: ok(str(j.regiao), DB.regiao), variedade: str(j.variedade),
        processo: ok(str(j.processo), DB.processo), torra: ok(str(j.torra), DB.torra), especie: ['arabica', 'canephora', 'blend'].includes(str(j.especie)) ? str(j.especie) : '',
        altitude: +j.altitude_m || '', dataTorra: /^\d{4}-\d{2}-\d{2}$/.test(str(j.data_torra)) ? str(j.data_torra) : '',
        pontuacao: str(j.pontuacao), notas: (Array.isArray(j.notas) ? j.notas : []).filter((n) => DB.descritores.includes(n)), obs
      },
      aviso: aviso || ''
    };
  }

  /* Clona schema completo ou em versão compatível (sem strings vazias/additionalProperties) */
  const clonarSchema = (s) => JSON.parse(JSON.stringify(s));
  function prepararSchemaGemini(s) {
    const copy = clonarSchema(s);
    function limpar(obj) {
      if (!obj || typeof obj !== 'object') return;
      delete obj.additionalProperties;
      if (Array.isArray(obj.enum)) obj.enum = obj.enum.filter((v) => v !== '');
      for (const k of Object.keys(obj)) limpar(obj[k]);
    }
    limpar(copy);
    return copy;
  }

  /* ---------- Gemini: descoberta em cache, Interactions API e descida de modelo ---------- */
  const escHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function hashChaveCurto(key) {
    let h = 2166136261;
    const s = String(key || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  // Aceita apenas família rápida com visão+JSON no modo automático (Gemini 4+ Hydrogen e Gemini 3+ Flash/Flash-Lite)
  function parsearModeloRapidoGemini(id) {
    const norm = normalizarModeloGeminiId(id);
    if (!norm || ehModeloGeminiLegado(norm)) return null;
    const m = norm.match(/^gemini-(\d+)(?:\.(\d+))?-(hydrogen|flash)(?:-(lite))?(?:-(preview))?$/i);
    if (!m) return null;
    const major = parseInt(m[1], 10);
    if (major < 3) return null;
    return {
      id: norm,
      estavel: m[5] ? 0 : 1,
      major,
      minor: m[2] ? parseInt(m[2], 10) : 0,
      familia: m[3].toLowerCase() === 'hydrogen' ? 2 : 1,
      cheio: m[4] ? 0 : 1
    };
  }

  function ordenarModelosGemini(ids) {
    const mapa = new Map();
    for (const raw of ids || []) {
      const p = parsearModeloRapidoGemini(raw);
      if (p && !mapa.has(p.id)) mapa.set(p.id, p);
    }
    return Array.from(mapa.values()).sort((a, b) =>
      (b.estavel - a.estavel) || (b.major - a.major) || (b.minor - a.minor) || (b.familia - a.familia) || (b.cheio - a.cheio) || a.id.localeCompare(b.id)
    ).map((x) => x.id);
  }

  async function fetchJsonTimeout(url, options, timeoutMs) {
    const temAbort = typeof AbortController === 'function';
    const ctrl = temAbort ? new AbortController() : null;
    let timer = null;
    if (ctrl && timeoutMs > 0) timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, ctrl ? Object.assign({}, options, { signal: ctrl.signal }) : options);
      const j = await r.json().catch(() => ({}));
      return { r, j, timedOut: false };
    } catch (e) {
      const timedOut = !!(e && e.name === 'AbortError');
      return { r: { ok: false, status: 0, statusText: timedOut ? 'tempo esgotado' : 'rede' }, j: {}, timedOut };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function ehErroChaveGemini(status, msg) {
    const txt = String(msg || '');
    if (status === 401) return true;
    if (status === 400 && /api[\s_-]?key|api_key_invalid|unregistered caller/i.test(txt)) return true;
    if (status === 403) {
      if (/api[\s_-]?key|leaked|suspended|disabled|has not been used|not enabled|referer|referrer|unrestricted/i.test(txt)) return true;
      if (/model|tier|billing|quota|free/i.test(txt)) return false;
      return true;
    }
    return false;
  }

  function ehErroDeModeloOuSobrecarga(status, msg) {
    if (status === 0 || status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || status === 529 || status === 404 || status === 403) return true;
    return status === 400 && /model.*not.*(found|supported|available)|unsupported model|is deprecated|no longer supported/i.test(String(msg || ''));
  }

  function resumoMotivoGemini(r, j, timedOut) {
    if (timedOut) return 'tempo esgotado';
    if (r.status === 0) return 'sem resposta/rede';
    if (r.status === 429) return 'cota/limite (429)';
    if (r.status === 503 || r.status === 529) return `sobrecarga (${r.status})`;
    if (r.status === 404) return 'modelo indisponível (404)';
    if (r.status === 403) return 'sem acesso ao modelo (403)';
    const msg = (j && j.error && j.error.message) || r.statusText || '';
    return `HTTP ${r.status}${msg ? ' — ' + String(msg).slice(0, 60) : ''}`;
  }

  async function listarModelosGemini(key, timeoutMs) {
    const { r, j, timedOut } = await fetchJsonTimeout(`${GEM_API_BASE}/models?pageSize=200`, {
      method: 'GET',
      headers: { 'x-goog-api-key': key }
    }, timeoutMs || 8000);
    if (!r.ok) {
      const msg = (j && j.error && j.error.message) || r.statusText || '';
      const err = new Error(
        ehErroChaveGemini(r.status, msg)
          ? 'Chave do Gemini inválida, bloqueada ou sem permissão na API. Confira em Mais → Backup e ajustes.'
          : (r.status === 0 ? (timedOut ? 'Tempo esgotado ao consultar modelos Gemini.' : 'Sem conexão com a API do Gemini.') : `Erro ao listar modelos (${r.status}): ${String(msg).slice(0, 140)}`)
      );
      err.status = r.status;
      err.fatalKey = ehErroChaveGemini(r.status, msg);
      throw err;
    }
    const lista = Array.isArray(j.models) ? j.models : [];
    const brutos = lista
      .filter((m) => m && (!Array.isArray(m.supportedGenerationMethods) || m.supportedGenerationMethods.includes('generateContent')))
      .map((m) => normalizarModeloGeminiId(m.name));
    return {
      flash: ordenarModelosGemini(brutos),
      temArgon: brutos.includes('gemini-4-argon')
    };
  }

  function lerCatalogoCacheGemini(tag) {
    try {
      const cat = JSON.parse(lsGet(KEY_GEM_CAT) || 'null');
      if (cat && cat.v === CATALOGO_VERSAO && cat.tag === tag && Array.isArray(cat.modelos) && cat.modelos.length) return cat;
    } catch (e) { /* */ }
    return null;
  }

  async function atualizarCatalogoGemini(key, timeoutMs) {
    const tag = hashChaveCurto(key);
    const { flash, temArgon } = await listarModelosGemini(key, timeoutMs);
    const ordenados = ordenarModelosGemini(flash.concat(ESCADA_GEMINI_PADRAO));
    lsSet(KEY_GEM_CAT, JSON.stringify({ v: CATALOGO_VERSAO, tag, ts: Date.now(), modelos: ordenados, temArgon }));
    return { modelos: ordenados, temArgon };
  }

  async function obterCatalogoGemini(key, opts) {
    const o = opts || {};
    const tag = hashChaveCurto(key);
    const cache = lerCatalogoCacheGemini(tag);
    const fresco = cache && (Date.now() - cache.ts < CATALOGO_TTL_MS);
    if (!o.forcar && fresco) return { modelos: ordenarModelosGemini(cache.modelos.concat(ESCADA_GEMINI_PADRAO)), temArgon: !!cache.temArgon, origem: 'cache' };
    try {
      const res = await atualizarCatalogoGemini(key, o.timeoutMs || 1500);
      return Object.assign(res, { origem: 'rede' });
    } catch (e) {
      if (o.forcar || (e && e.fatalKey)) throw e;
      if (cache) return { modelos: ordenarModelosGemini(cache.modelos.concat(ESCADA_GEMINI_PADRAO)), temArgon: !!cache.temArgon, origem: 'cache-expirado' };
      return { modelos: ESCADA_GEMINI_PADRAO.slice(), temArgon: false, origem: 'padrao' };
    }
  }

  async function resolverModelosGemini(key, escolhaExplicita, opts) {
    const o = opts || {};
    const escolha = normalizarModeloGeminiId(escolhaExplicita != null ? escolhaExplicita : getGemModel()) || GEM_AUTO;
    const cat = await obterCatalogoGemini(key, { forcar: !!o.forcar, timeoutMs: o.timeoutMs });
    const baseModelos = cat.modelos.length ? cat.modelos : ESCADA_GEMINI_PADRAO.slice();
    // Sem cooldown entre tentativas: cada leitura começa sempre pelo modelo preferido/mais recente e desce se falhar
    const escada = (escolha !== GEM_AUTO && !ehModeloGeminiLegado(escolha))
      ? [escolha].concat(baseModelos.filter((m) => m !== escolha))
      : baseModelos.slice();
    return { escada, modeloPreferido: escada[0], temArgon: cat.temArgon, origemCatalogo: cat.origem };
  }

  function extrairTextoInteractions(j) {
    if (!j || typeof j !== 'object') return '';
    if (typeof j.output_text === 'string' && j.output_text.trim()) return j.output_text;
    if (Array.isArray(j.steps)) {
      const partes = [];
      for (const s of j.steps) {
        if (!s || (s.type && s.type !== 'model_output' && s.type !== 'text')) continue;
        if (typeof s.text === 'string') partes.push(s.text);
        if (typeof s.content === 'string') partes.push(s.content);
        else if (Array.isArray(s.content)) {
          for (const b of s.content) {
            if (b && b.type === 'text' && typeof b.text === 'string') partes.push(b.text);
          }
        }
      }
      if (partes.length) return partes.join('');
    }
    if (Array.isArray(j.outputs)) {
      const out = j.outputs.filter((o) => o && typeof o.text === 'string').map((o) => o.text).join('');
      if (out) return out;
    }
    const cand = (j.candidates || [])[0];
    return ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
  }

  async function chamarGeminiInteractions(model, key, promptBase, data, timeoutMs) {
    const endpoint = `${GEM_API_BASE}/interactions`;
    const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
    const enviar = (modoSchema, comThinking) => {
      const texto = promptBase + (modoSchema === 'nenhum'
        ? '\n\nResponda somente com um objeto JSON válido com estas chaves: ' + Object.keys(SCHEMA.properties).join(', ') + '.'
        : '');
      const body = {
        model,
        store: false,
        input: [
          { type: 'image', data, mime_type: 'image/jpeg' },
          { type: 'text', text: texto }
        ]
      };
      if (comThinking) body.generation_config = { thinking_level: 'low' };
      if (modoSchema !== 'nenhum') {
        body.response_format = {
          type: 'text',
          mime_type: 'application/json',
          schema: modoSchema === 'estrito' ? clonarSchema(SCHEMA) : prepararSchemaGemini(SCHEMA)
        };
      }
      return fetchJsonTimeout(endpoint, { method: 'POST', headers, body: JSON.stringify(body) }, timeoutMs);
    };

    let comThinking = true;
    let res = await enviar('estrito', comThinking);
    if (res.r.status === 400 && /thinking_level|thinking|generation_config/i.test(JSON.stringify(res.j))) {
      comThinking = false;
      res = await enviar('estrito', comThinking);
    }
    if (res.r.status === 400 && /response_format|response_json_schema|schema|additionalProperties|enum/i.test(JSON.stringify(res.j))) {
      res = await enviar('limpo', comThinking);
      if (res.r.status === 400 && /response_format|response_json_schema|schema|enum/i.test(JSON.stringify(res.j))) {
        res = await enviar('nenhum', comThinking);
      }
    }
    return res;
  }

  async function lerComGemini(canvas, progresso, ocrFallback) {
    const key = getGemKey();
    progresso('Preparando leitura com Gemini…');
    const { escada, modeloPreferido } = await resolverModelosGemini(key, getGemModel(), { timeoutMs: 1500 });
    const data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    const promptBase = promptClaude();
    const falhas = [];

    for (let i = 0; i < escada.length; i++) {
      const model = escada[i];
      progresso(i === 0 ? `Enviando foto para ${model}…` : `Tentando ${model}…`);
      const timeoutMs = /argon|carbon|pro/i.test(model) ? 24000 : 16000;
      const { r, j, timedOut } = await chamarGeminiInteractions(model, key, promptBase, data, timeoutMs);

      if (!r.ok) {
        const msg = (j && j.error && j.error.message) || r.statusText || '';
        if (ehErroChaveGemini(r.status, msg)) {
          lsSet(KEY_GEM_CAT, '');
          throw new Error('Chave do Gemini inválida, bloqueada ou sem permissão na API. Confira em Mais → Backup e ajustes.');
        }
        if (!ehErroDeModeloOuSobrecarga(r.status, msg)) {
          throw new Error(`Erro do Gemini (${r.status}): ${String(msg).slice(0, 200)}`);
        }
        const motivo = resumoMotivoGemini(r, j, timedOut);
        falhas.push({ model, status: r.status, motivo });
        if (i + 1 < escada.length) progresso(`${model} indisponível (${motivo}), descendo para ${escada[i + 1]}…`);
        continue;
      }

      if (j && j.status === 'failed') {
        const motivo = (j.errors && j.errors[0] && j.errors[0].message) || 'falha interna';
        falhas.push({ model, status: 500, motivo: String(motivo).slice(0, 60) });
        if (i + 1 < escada.length) progresso(`${model} falhou, descendo para ${escada[i + 1]}…`);
        continue;
      }

      const txt = extrairTextoInteractions(j);
      if (!txt.trim()) {
        falhas.push({ model, status: 500, motivo: 'resposta vazia' });
        if (i + 1 < escada.length) progresso(`${model} respondeu vazio, descendo para ${escada[i + 1]}…`);
        continue;
      }

      try {
        const quemSafe = /^[a-z0-9._-]+$/i.test(model) ? `Gemini (${model})` : 'Gemini';
        const aviso = model !== modeloPreferido
          ? `Respondido por ${model}, porque ${modeloPreferido} estava indisponível/sobrecarregado${falhas[0] ? ` (${falhas[0].motivo})` : ''}.`
          : '';
        return mapear(txt, quemSafe, aviso);
      } catch (e) {
        falhas.push({ model, status: 500, motivo: 'JSON inválido/incompleto' });
        if (i + 1 < escada.length) progresso(`${model} devolveu JSON incompleto, descendo para ${escada[i + 1]}…`);
      }
    }

    if (falhas.length && falhas.every((f) => f.status === 403 || f.status === 401)) {
      throw new Error('A chave do Gemini não teve permissão em nenhum modelo disponível. Confira no Google AI Studio ou em Mais → Backup e ajustes.');
    }

    const resumoFalhas = falhas.slice(0, 3).map((f) => `${f.model}: ${f.motivo}`).join('; ');
    if (typeof ocrFallback === 'function') {
      progresso('Gemini indisponível agora, tentando OCR local…');
      try {
        const resOcr = await ocrFallback();
        resOcr.aviso = `Gemini indisponível/sobrecarregado (${resumoFalhas}). Leitura feita offline via OCR local — confira cada campo.`;
        return resOcr;
      } catch (ocrErr) {
        throw new Error(`Gemini indisponível (${resumoFalhas}) e o OCR offline também falhou: ${ocrErr.message || ocrErr}`);
      }
    }
    throw new Error(`Todos os modelos Gemini falharam (${resumoFalhas}). Tente novamente em instantes.`);
  }

  async function testarGemini(chaveOpcional) {
    const key = String(chaveOpcional != null ? chaveOpcional : getGemKey()).trim();
    if (!key) throw new Error('Cole uma chave da API Gemini acima para testar.');
    const { modelos, temArgon } = await atualizarCatalogoGemini(key, 10000);
    return { modelos, temArgon };
  }

  /* ---------- OCR local ---------- */
  function carregarScript(src) {
    return new Promise((res, rej) => {
      if (window.Tesseract) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Não foi possível baixar o OCR (precisa de internet na primeira vez). Configure a chave da IA ou tente de novo online.'));
      document.head.appendChild(s);
    });
  }
  async function lerComOCR(canvas, progresso) {
    progresso('Baixando OCR local…');
    await carregarScript(TESSERACT_URL);
    progresso('Lendo o texto do rótulo…');
    const worker = await window.Tesseract.createWorker('por', 1, { logger: (m) => { if (m.status === 'recognizing text') progresso(`Lendo o texto do rótulo… ${Math.round(m.progress * 100)} %`); } });
    try {
      const { data } = await worker.recognize(canvas);
      const texto = (data && data.text) || '';
      if (!texto.trim()) throw new Error('Nenhum texto reconhecido. Aproxime a câmera, evite reflexo e tente de novo.');
      return { fonte: 'ocr', texto, campos: interpretar(texto), aviso: 'OCR local é menos preciso que a IA: confira cada campo.' };
    } finally { await worker.terminate(); }
  }

  /* ---------- interpretação por regras (usada pelo OCR) ---------- */
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const REGIOES_KW = [
    ['caparao', ['caparao', 'alto jequitiba', 'espera feliz', 'dores do rio preto', 'alto caparao', 'divino de sao lourenco', 'manhumirim', 'irupi', 'iuna']],
    ['mantiqueira', ['mantiqueira', 'carmo de minas', 'cristina', 'sao lourenco', 'pedralva', 'conceicao das pedras']],
    ['cerrado-mineiro', ['cerrado mineiro', 'patrocinio', 'araxa', 'monte carmelo', 'patos de minas', 'serra do salitre', 'campos altos']],
    ['sul-de-minas', ['sul de minas', 'tres pontas', 'varginha', 'poco fundo', 'santo antonio do amparo', 'sao sebastiao do paraiso', 'guaxupe', 'boa esperanca', 'machado']],
    ['alta-mogiana', ['alta mogiana', 'franca', 'pedregulho', 'altinopolis', 'cristais paulista']],
    ['media-mogiana', ['media mogiana', 'mococa', 'espirito santo do pinhal', 'sao joao da boa vista']],
    ['matas-de-minas', ['matas de minas', 'zona da mata', 'manhuacu', 'carangola', 'araponga', 'ervalia']],
    ['chapada-de-minas', ['chapada de minas', 'capelinha', 'jequitinhonha', 'turmalina']],
    ['campo-das-vertentes', ['campo das vertentes', 'vertentes', 'sao joao del rei', 'lavras', 'nazareno']],
    ['montanhas-es', ['montanhas do espirito santo', 'venda nova', 'afonso claudio', 'castelo', 'domingos martins', 'brejetuba']],
    ['conilon-capixaba', ['conilon', 'linhares', 'sao gabriel da palha']],
    ['chapada-diamantina', ['chapada diamantina', 'piata', 'mucuge', 'ibicoara', 'barra da estiva']],
    ['planalto-bahia', ['vitoria da conquista', 'planalto da bahia', 'barra do choca']],
    ['oeste-bahia', ['oeste da bahia', 'barreiras', 'luis eduardo magalhaes', 'cerrado baiano']],
    ['norte-pioneiro-pr', ['norte pioneiro', 'parana', 'carlopolis', 'pinhalao']],
    ['rondonia', ['rondonia', 'robusta amazonico', 'cacoal', 'alta floresta']]
  ];
  const VARIEDADES = ['Bourbon Amarelo', 'Bourbon Vermelho', 'Bourbon', 'Catuaí Amarelo', 'Catuaí Vermelho', 'Catuaí', 'Catucaí Amarelo', 'Catucaí Vermelho', 'Catucaí', 'Mundo Novo', 'Arara', 'Topázio', 'Geisha', 'Gesha', 'Acaiá', 'Obatã', 'Icatu', 'Paraíso', 'Aranãs', 'Caturra', 'Maragogipe', 'Acauã', 'Yellow Bourbon', 'Pacamara', 'SL28', 'Conilon', 'Robusta', 'Caparaó Amarelo'];

  function interpretar(texto) {
    const t = semAcento(texto).replace(/\s+/g, ' ').replace(/(\d)\.(\d{3})\b/g, '$1$2');
    const linhas = String(texto).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const c = { notas: [] };
    for (const [id, kws] of REGIOES_KW) if (kws.some((k) => t.includes(k))) { c.regiao = id; break; }
    if (/anaerob|macerac/.test(t)) c.processo = 'anaerobico';
    else if (/induzid|levedura|koji|fermentad|co-?ferment/.test(t)) c.processo = 'fermentacao-induzida';
    else if (/cereja descascad|\bcd\b|pulped/.test(t)) c.processo = 'cereja-descascado';
    else if (/honey|mel\s*\(processo\)/.test(t)) c.processo = 'honey';
    else if (/lavado|despolpad|washed/.test(t)) c.processo = 'lavado';
    else if (/descafeinad/.test(t)) c.processo = 'descafeinado';
    else if (/natural/.test(t)) c.processo = 'natural';
    const tm = t.match(/torra\s*[:\-]?\s*(media[\s\-]*clara|clara[\s\-]*media|media[\s\-]*escura|clara|media|escura)/);
    if (tm) { const v = tm[1].replace(/[\s\-]+/g, '-'); c.torra = v === 'clara-media' ? 'media-clara' : v; }
    const vs = VARIEDADES.find((v) => t.includes(semAcento(v)));
    if (vs) c.variedade = vs === 'Gesha' ? 'Geisha' : vs;
    if (/conilon|robusta|canephora/.test(t)) c.especie = 'canephora'; else if (/blend/.test(t)) c.especie = 'blend';
    const alt = t.match(/(?:altitude|alt\.?)\s*[:\-]?\s*(\d{3,4})(?:\s*(?:a|-|–)\s*(\d{3,4}))?\s*m/) || t.match(/(\d{3,4})\s*(?:m|metros)\b/);
    if (alt) { const a = +alt[1], b = alt[2] ? +alt[2] : a; const v = Math.round((a + b) / 2); if (v >= 200 && v <= 2500) c.altitude = v; }
    const pt = t.match(/(?:pontuacao|sca)\s*[:\-]?\s*(\d{2}(?:[.,]\d{1,2})?\+?)(?!\d)/) || t.match(/(?:^|[^\d\/.])(\d{2}(?:[.,]\d{1,2})?\+?)\s*(?:pts|pontos)\b/);
    if (pt) c.pontuacao = pt[1].replace(',', '.');
    const dt = t.match(/torra[^0-9]{0,20}(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/) || t.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2}|\d{2})\b/);
    if (dt) { let [d, m, y] = [+dt[1], +dt[2], +dt[3]]; if (y < 100) y += 2000; if (d <= 31 && m <= 12) c.dataTorra = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    const prod = linhas.find((l) => /produtor|fazenda|s[ií]tio|produzido por/i.test(l));
    if (prod) c.produtor = prod.replace(/^(produtor(a)?|produzido por)\s*[:\-]?\s*/i, '').slice(0, 80);
    const extra = { 'maracuja': 'frutas tropicais', 'manga': 'frutas tropicais', 'caja': 'frutas tropicais', 'morango': 'frutas vermelhas', 'cereja': 'frutas vermelhas', 'amora': 'frutas vermelhas', 'jabuticaba': 'frutas vermelhas', 'chocolate ao leite': 'chocolate', 'cacau': 'cacau', 'doce de leite': 'caramelo', 'melaco': 'melado', 'acucar mascavo': 'rapadura', 'castanha': 'castanhas', 'amendoa': 'nozes', 'avela': 'nozes', 'canela': 'especiarias', 'cravo': 'especiarias', 'jasmim': 'floral', 'rosa': 'floral', 'limao': 'limão', 'tangerina': 'laranja', 'pessego': 'pêssego' };
    DB.descritores.forEach((d) => { if (d !== 'fermentado' && t.includes(semAcento(d)) && !c.notas.includes(d)) c.notas.push(d); });
    Object.entries(extra).forEach(([k, d]) => { if (t.includes(k) && !c.notas.includes(d)) c.notas.push(d); });
    const notasLinha = linhas.find((l) => /notas?\s*(sensoria|de\s)|sabor/i.test(l));
    if (notasLinha) c.obs = 'Rótulo: ' + notasLinha.slice(0, 160);
    return c;
  }

  /* ---------- API pública ---------- */
  async function ler(file, progresso) {
    progresso = progresso || (() => {});
    const img = await carregarImagem(file);
    const prov = provedor();
    if (prov === 'anthropic') return lerComClaude(redimensionar(img, 1568, false), progresso);
    if (prov === 'gemini') {
      return lerComGemini(
        redimensionar(img, 1568, false),
        progresso,
        () => lerComOCR(redimensionar(img, 2000, true), progresso)
      );
    }
    return lerComOCR(redimensionar(img, 2000, true), progresso);
  }

  /* ---------- cartão nos ajustes ---------- */
  function cardAjustes(root) {
    const lab = window.CafeLab;
    const div = document.createElement('div');
    div.className = 'card'; div.style.marginTop = '12px';
    const temA = !!getKey(), temG = !!getGemKey(), prov = provedor();
    const escolhido = lsGet(KEY_PROV) || (temG && !temA ? 'gemini' : 'anthropic');
    const atualA = getModel();
    const atualGem = getGemModel();
    const cacheCat = temG ? lerCatalogoCacheGemini(hashChaveCurto(getGemKey())) : null;
    const topoCache = (cacheCat && cacheCat.modelos && cacheCat.modelos[0]) ? cacheCat.modelos[0] : '';
    const gemOpcaoConhecida = MODELOS_GEMINI.some((m) => m.id === atualGem);
    div.innerHTML = `<h3>📷 Leitura de rótulos por IA</h3>
      <p class="text-2">Fotografe o pacote e a IA preenche o cadastro do grão. Escolha o provedor e cole a chave dele. Sem nenhuma chave, o app usa um OCR local, menos preciso. As chaves ficam salvas só neste aparelho, não vão para o backup e só são enviadas para o provedor escolhido.</p>
      <p><span class="badge ${prov === 'ocr' ? '' : 'ok'}">Em uso: ${prov === 'anthropic' ? 'Claude' : prov === 'gemini' ? 'Gemini' : 'OCR local'}</span>${prov === 'gemini' ? ` <span class="badge">Modelo: ${escHtml(atualGem === GEM_AUTO ? (topoCache || ESCADA_GEMINI_PADRAO[0]) : atualGem)}</span>` : ''}</p>
      <label class="field"><span class="lbl">Provedor</span><select id="iaProv"><option value="anthropic" ${escolhido === 'anthropic' ? 'selected' : ''}>Claude (Anthropic)</option><option value="gemini" ${escolhido === 'gemini' ? 'selected' : ''}>Gemini (Google)</option></select></label>
      <div data-prov="anthropic">
        <label class="field"><span class="lbl">Chave da API Anthropic ${temA ? '<span class="badge ok">configurada</span>' : ''}</span><input type="password" id="apiKey" placeholder="${temA ? '•••••••• (deixe em branco para manter)' : 'sk-ant-…'}" autocomplete="off"><div class="help">Crie em console.anthropic.com → API Keys. Cobrado por uso.</div></label>
        <label class="field"><span class="lbl">Modelo</span><select id="apiModelSel">${MODELOS.map((m) => `<option value="${m.id}" ${m.id === atualA ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}<option value="_outro" ${MODELOS.some((m) => m.id === atualA) ? '' : 'selected'}>Outro (digitar)</option></select></label>
        <label class="field" id="apiOutroWrap"><span class="lbl">Id do modelo</span><input type="text" id="apiModel" value="${escHtml(atualA)}" placeholder="ex.: claude-3-7-sonnet-latest"><div class="help">Use se a Anthropic lançar um modelo novo ou se preferir fixar uma versão específica.</div></label>
      </div>
      <div data-prov="gemini">
        <label class="field"><span class="lbl">Chave da API Gemini ${temG ? '<span class="badge ok">configurada</span>' : ''}</span><input type="password" id="gemKey" placeholder="${temG ? '•••••••• (deixe em branco para manter)' : 'AIza…'}" autocomplete="off"><div class="help">Crie em aistudio.google.com → Get API key. Há cota gratuita; no plano gratuito o Google pode usar o conteúdo enviado para melhorar os modelos. As imagens são enviadas com <code>store: false</code>.</div></label>
        <label class="field"><span class="lbl">Modelo</span><select id="gemModelSel">${MODELOS_GEMINI.map((m) => `<option value="${m.id}" ${m.id === atualGem ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}<option value="_outro" ${gemOpcaoConhecida ? '' : 'selected'}>Outro (digitar)</option></select><div class="help">No modo <b>Automático</b>, toda tentativa começa sempre pelo modelo mais recente disponível para sua chave (${escHtml(topoCache || ESCADA_GEMINI_PADRAO[0])}), desce para versões anteriores/mais leves em caso de sobrecarga ou cota e recorre ao OCR local se todos falharem.</div></label>
        <label class="field" id="gemOutroWrap"><span class="lbl">Id do modelo</span><input type="text" id="gemModel" value="${escHtml(atualGem === GEM_AUTO ? '' : atualGem)}" placeholder="ex.: gemini-4-hydrogen"><div class="help">Digite o id exato se quiser fixar outro modelo. Modelos aposentados (ex.: Gemini 2.x/3.5 Flash) voltam para o modo Automático. <code>gemini-4-argon</code> exige plano pago.</div></label>
        <div class="row" style="margin:6px 0"><button type="button" class="btn sm" id="gemTest">Testar chave e atualizar modelos</button></div>
        <div class="scan-status" id="gemTestSt" hidden></div>
      </div>
      <div class="row"><button type="button" class="btn primary sm" id="apiSave">Salvar</button>${temA ? '<button type="button" class="btn sm danger" id="apiDel">Remover chave Anthropic</button>' : ''}${temG ? '<button type="button" class="btn sm danger" id="gemDel">Remover chave Gemini</button>' : ''}</div>`;
    root.appendChild(div);
    const q = (x) => div.querySelector(x);
    const sync = () => {
      div.querySelectorAll('[data-prov]').forEach((el) => { el.hidden = el.dataset.prov !== q('#iaProv').value; });
      q('#apiOutroWrap').hidden = q('#apiModelSel').value !== '_outro';
      q('#gemOutroWrap').hidden = q('#gemModelSel').value !== '_outro';
    };
    q('#iaProv').onchange = sync; q('#apiModelSel').onchange = sync; q('#gemModelSel').onchange = sync; sync();
    q('#gemTest').onclick = async () => {
      const btn = q('#gemTest');
      const st = q('#gemTestSt');
      const chave = q('#gemKey').value.trim() || getGemKey();
      btn.disabled = true;
      st.hidden = false;
      st.className = 'scan-status';
      st.textContent = 'Testando chave e buscando modelos Gemini disponíveis…';
      try {
        const { modelos, temArgon } = await testarGemini(chave);
        const top = modelos.slice(0, 4).join(' → ');
        const extra = modelos.length > 4 ? '…' : '';
        const notaArgon = temArgon ? ' (Gemini 4 Argon disponível para plano pago)' : '';
        st.className = 'scan-status ok';
        st.textContent = `✓ Chave válida! Ordem automática: ${top}${extra}${notaArgon}.`;
      } catch (err) {
        st.className = 'scan-status err';
        st.textContent = err && err.message ? err.message : String(err);
      } finally {
        btn.disabled = false;
      }
    };
    q('#apiSave').onclick = () => {
      lsSet(KEY_PROV, q('#iaProv').value);
      const k = q('#apiKey').value.trim(); if (k) lsSet(KEY_API, k);
      const m = q('#apiModelSel').value === '_outro' ? q('#apiModel').value.trim() : q('#apiModelSel').value;
      if (m) lsSet(KEY_MODEL, m);
      const antigaGem = getGemKey();
      const g = q('#gemKey').value.trim();
      if (g) {
        lsSet(KEY_GEM, g);
        if (g !== antigaGem) lsSet(KEY_GEM_CAT, '');
      }
      const gm = q('#gemModelSel').value === '_outro'
        ? normalizarModeloGeminiId(q('#gemModel').value)
        : q('#gemModelSel').value;
      let migrou = false;
      if (gm === GEM_AUTO) {
        lsSet(KEY_GEM_MODEL, '');
      } else if (gm && ehModeloGeminiLegado(gm)) {
        lsSet(KEY_GEM_MODEL, '');
        migrou = true;
      } else if (gm) {
        lsSet(KEY_GEM_MODEL, gm);
      }
      lab.toast(migrou ? 'Modelo legado atualizado para Automático' : 'Configuração da IA salva');
      lab.render();
    };
    const del = q('#apiDel'); if (del) del.onclick = () => { lsSet(KEY_API, ''); lab.toast('Chave Anthropic removida'); lab.render(); };
    const delG = q('#gemDel'); if (delG) delG.onclick = () => {
      lsSet(KEY_GEM, '');
      lsSet(KEY_GEM_CAT, '');
      lab.toast('Chave Gemini removida');
      lab.render();
    };
  }
  window.CafeLab.hooks.ajustes.push(cardAjustes);

  window.CafeRotulo = {
    ler,
    interpretar,
    SCHEMA,
    provedor,
    temChave: () => provedor() !== 'ocr',
    testarGemini,
    resolverModelosGemini,
    modelosGemini: ESCADA_GEMINI_PADRAO.slice()
  };
})();
