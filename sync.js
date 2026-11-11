/* =====================================================================
 * Laboratório de Cafeteria — Login Social (Google / Firebase Auth),
 * Sincronização em Nuvem (Cloud Firestore) e API da Comunidade
 *
 * Arquitetura:
 * 1) Autenticação OAuth 2.0 com Google (Firebase Auth Compat + Identity Toolkit)
 *    e cofre local em IndexedDB (cafelab.keystore) protegido por CryptoKey
 *    AES-GCM 256 não-extraível.
 * 2) Banco em nuvem isolado por usuário (/users/{uid}/{colecao}/{docId})
 *    com mesclagem em 3 vias por registro (updatedAt + lápides deletedAt)
 *    e proteção contra sobrescrita por nuvem vazia.
 * 3) Coleções públicas da Comunidade (/community_profiles/{uid} e
 *    /community_items/{itemId}) com publicação seletiva (opt-in) e
 *    importação em 1 toque.
 * ===================================================================== */
(function () {
  'use strict';
  const lab = window.CafeLab, DB = window.CAFE_DB;
  const K = {
    on: 'cafelab.sync.ativo',
    modo: 'cafelab.sync.modo',
    base: 'cafelab.sync.base',
    disp: 'cafelab.sync.dispositivo',
    ult: 'cafelab.sync.ultimo',
    lgpd: 'cafelab.sync.lgpd',
    comPerfis: 'cafelab.comunidade.perfis',
    comItens: 'cafelab.comunidade.itens'
  };
  const SCHEMA_VERSION = 2;
  const EXPIRA_LAPIDE = 90 * 86400 * 1000; // 90 dias
  const COLECOES = ['graos', 'moedores', 'extracoes', 'metodos', 'cafeina', 'latte'];
  const CONFIG_LOCAL = ['tema', 'catalogoVersao', 'moedoresVersao', 'estoqueMigrado', 'estoqueV2', 'dose10', '_mod', 'updatedAt'];

  // Captura as credenciais do SDK em escopo privado e remove do objeto global window
  const FB_CFG_INTERNO = (() => {
    const raw = (typeof window !== 'undefined' && window.CAFE_FIREBASE_CONFIG) || {};
    const cfg = Object.freeze({
      apiKey: String(raw.apiKey || '').trim(),
      authDomain: String(raw.authDomain || (raw.projectId ? `${String(raw.projectId).trim()}.firebaseapp.com` : '')).trim(),
      projectId: String(raw.projectId || '').trim(),
      storageBucket: String(raw.storageBucket || '').trim(),
      messagingSenderId: String(raw.messagingSenderId || '').trim(),
      appId: String(raw.appId || '').trim()
    });
    if (typeof window !== 'undefined') {
      try { delete window.CAFE_FIREBASE_CONFIG; } catch (e) { window.CAFE_FIREBASE_CONFIG = undefined; }
    }
    try { localStorage.removeItem('cafelab.sync.fbConfig'); } catch (e) { /* */ }
    return cfg;
  })();

  const ls = {
    get: (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* */ } }
  };

  /* ---------- utilidades de serialização e hash ---------- */
  const b64 = (buf) => {
    const u = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  const CAMPOS_CONTROLE = new Set(['_mod', 'updatedAt', 'deletedAt', 'schemaVersion', 'contaUid', 'diag', '_idbFoto', '_intocado', '_unif']);
  function estavel(v) {
    if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
    if (v && typeof v === 'object') {
      const ehCatalogoFotoPadrao = v.catalogoId && typeof window !== 'undefined' && window.CAFE_FOTOS && v.foto === window.CAFE_FOTOS[v.catalogoId];
      return '{' + Object.keys(v)
        .filter((k) => !CAMPOS_CONTROLE.has(k) && !(ehCatalogoFotoPadrao && k === 'foto') && v[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + estavel(v[k]))
        .join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
  }
  function hash(v) {
    const s = estavel(v);
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 ^ c, 2246822519);
    }
    return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length.toString(36);
  }

  const agora = () => Date.now();
  const modDe = (r) => Number((r && (r.updatedAt || r._mod)) || 0);
  const carimbarMod = (r, t, uidConta) => {
    if (r && typeof r === 'object') {
      r.updatedAt = t;
      r._mod = t;
      r.deletedAt = null;
      r.schemaVersion = SCHEMA_VERSION;
      const u = uidConta || (contaCache && contaCache.uid) || (lab.state().config && lab.state().config.contaUid) || null;
      if (u && !r.contaUid) r.contaUid = u;
    }
    return r;
  };
  const dispositivo = () => {
    let d = ls.get(K.disp);
    if (!d) {
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
      d = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'Tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'Celular' : 'Computador';
      ls.set(K.disp, d);
    }
    return d;
  };
  const sanitizarId = (raw) => String(raw || 'item').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || 'item';

  /* ---------- Cofre local (IndexedDB cafelab.keystore + AES-GCM 256) ---------- */
  let contaCache = null; // { uid, email, nome, foto, provedor, idToken, refreshToken, expiraEm }

  const contaAtiva = () => (contaCache && contaCache.uid ? contaCache : null);
  const ativo = () => !!(ls.get(K.on) || (contaCache && contaCache.uid));

  function abrirCofre() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      try {
        const req = indexedDB.open('cafelab.keystore', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('auth')) db.createObjectStore('auth');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  async function lerItemCofre(chaveCofre) {
    const db = await abrirCofre();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('auth', 'readonly');
        const r = tx.objectStore('auth').get(chaveCofre);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  async function gravarItemCofre(chaveCofre, val) {
    const db = await abrirCofre();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('auth', 'readwrite');
        if (val) tx.objectStore('auth').put(val, chaveCofre);
        else tx.objectStore('auth').delete(chaveCofre);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  async function salvarContaCofre(conta) {
    if (!conta || !conta.uid) {
      contaCache = null;
      await gravarItemCofre('conta', null);
      return null;
    }
    contaCache = Object.assign({}, conta);
    const st = lab.state();
    if (st && st.config) st.config.contaUid = conta.uid;
    ls.set(K.modo, 'conta');
    ls.set(K.on, '1');
    try {
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const payload = JSON.stringify(contaCache);
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(payload));
      await gravarItemCofre('conta', { key, iv: b64(iv), ct: b64(ct) });
    } catch (e) { /* mantém em memória caso WebCrypto indisponível */ }
    return contaCache;
  }

  async function carregarContaCofre() {
    if (contaCache && contaCache.uid) return contaCache;
    const rec = await lerItemCofre('conta');
    if (rec && rec.key && rec.iv && rec.ct) {
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, rec.key, unb64(rec.ct));
        const parsed = JSON.parse(new TextDecoder().decode(pt));
        if (parsed && parsed.uid) {
          contaCache = parsed;
          const st = lab.state();
          if (st && st.config) st.config.contaUid = parsed.uid;
          ls.set(K.on, '1');
          return contaCache;
        }
      } catch (e) { /* cofre inválido */ }
    }
    return null;
  }

  /* ---------- Configuração Firebase Auth + Cloud Firestore (Escopo Privado) ---------- */
  function lerFbConfig() {
    return FB_CFG_INTERNO;
  }

  function obterFirebaseAuth() {
    if (typeof window === 'undefined' || !window.firebase || !window.firebase.auth) return null;
    const cfg = lerFbConfig();
    if (!cfg.apiKey || !cfg.projectId) return null;
    try {
      if (!window.firebase.apps || !window.firebase.apps.length) {
        window.firebase.initializeApp(cfg);
      }
      return window.firebase.auth();
    } catch (e) {
      return null;
    }
  }

  async function vincularUsuarioFirebase(u) {
    if (!u || !u.uid) return null;
    const idToken = await u.getIdToken();
    const conta = {
      uid: sanitizarId(u.uid),
      email: u.email || '',
      nome: u.displayName || (u.email ? u.email.split('@')[0] : 'Barista'),
      foto: u.photoURL || '',
      provedor: 'google.com',
      idToken,
      refreshToken: u.refreshToken || '',
      expiraEm: Date.now() + 3500 * 1000
    };
    await salvarContaCofre(conta);
    vincularContaUid(lab.state(), conta.uid);
    return conta;
  }

  async function obterIdTokenValido(opcional) {
    const auth = obterFirebaseAuth();
    if (auth && auth.currentUser) {
      try {
        const tok = await auth.currentUser.getIdToken();
        if (contaCache) {
          contaCache.idToken = tok;
          contaCache.expiraEm = Date.now() + 3500 * 1000;
        } else {
          await vincularUsuarioFirebase(auth.currentUser);
        }
        return tok;
      } catch (e) { /* fallback para cofre */ }
    }
    const conta = await carregarContaCofre();
    if (!conta || !conta.uid) {
      if (opcional) return null;
      throw new Error('Sessão desconectada. Faça login com a sua conta do Google.');
    }
    if (conta.idToken && conta.expiraEm && Date.now() < conta.expiraEm - 90000) return conta.idToken;
    if (!conta.refreshToken) return conta.idToken || null;
    const cfg = lerFbConfig();
    if (!cfg.apiKey) {
      if (opcional) return null;
      throw new Error('Configuração do Firebase ausente.');
    }
    let r;
    try {
      r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(cfg.apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(conta.refreshToken)}`
      });
    } catch (e) {
      if (opcional) return null;
      throw new Error('Sem conexão para validar sessão.');
    }
    if (!r.ok) {
      if (opcional) return null;
      if (r.status === 400 || r.status === 401 || r.status === 403) {
        throw new Error('Sessão expirada. Entre novamente com a sua conta do Google.');
      }
      throw new Error(`Erro ao renovar token (${r.status}).`);
    }
    const j = await r.json();
    conta.idToken = j.id_token;
    conta.refreshToken = j.refresh_token || conta.refreshToken;
    conta.uid = sanitizarId(j.user_id || conta.uid);
    conta.expiraEm = Date.now() + (Number(j.expires_in) || 3600) * 1000;
    await salvarContaCofre(conta);
    return conta.idToken;
  }

  async function iniciarLoginSocial(providerId) {
    providerId = providerId || 'google.com';
    const auth = obterFirebaseAuth();
    if (auth) {
      const provider = new window.firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        const cred = await auth.signInWithPopup(provider);
        if (cred && cred.user) return await vincularUsuarioFirebase(cred.user);
        return null;
      } catch (e) {
        const code = (e && e.code) || '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
        if (code === 'auth/popup-blocked') {
          await auth.signInWithRedirect(provider);
          return null;
        }
        if (code === 'auth/unauthorized-domain') {
          const dom = (typeof location !== 'undefined' && location.hostname) || 'atual';
          throw new Error(`Domínio "${dom}" ainda não autorizado no Firebase. Adicione "${dom}" em Firebase Console → Authentication → Settings → Domínios autorizados.`);
        }
        if (code === 'auth/operation-not-supported-in-this-environment') {
          throw new Error('Para fazer login com o Google, abra o Laboratório de Cafeteria via servidor (http://localhost) ou link HTTPS publicado, e não via arquivo local (file://).');
        }
        throw new Error('Não foi possível entrar com o Google: ' + ((e && e.message) || code));
      }
    }
    throw new Error('SDK de autenticação do Google não carregado. Verifique sua conexão com a internet.');
  }

  /* ---------- Conversão Cloud Firestore REST Value <-> JS ---------- */
  function toFsValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return { nullValue: null };
      if (Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER) return { integerValue: String(v) };
      return { doubleValue: v };
    }
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
    if (typeof v === 'object') return { mapValue: { fields: toFsFields(v) } };
    return { stringValue: String(v) };
  }
  function toFsFields(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach((k) => {
      if (obj[k] !== undefined) out[k] = toFsValue(obj[k]);
    });
    return out;
  }
  function fromFsValue(val) {
    if (!val || typeof val !== 'object') return null;
    if ('nullValue' in val) return null;
    if ('booleanValue' in val) return Boolean(val.booleanValue);
    if ('integerValue' in val) return Number(val.integerValue);
    if ('doubleValue' in val) return Number(val.doubleValue);
    if ('stringValue' in val) return String(val.stringValue);
    if ('timestampValue' in val) return new Date(val.timestampValue).getTime();
    if ('arrayValue' in val) return ((val.arrayValue && val.arrayValue.values) || []).map(fromFsValue);
    if ('mapValue' in val) return fromFsFields((val.mapValue && val.mapValue.fields) || {});
    return null;
  }
  function fromFsFields(fields) {
    const out = {};
    if (!fields || typeof fields !== 'object') return out;
    Object.keys(fields).forEach((k) => { out[k] = fromFsValue(fields[k]); });
    return out;
  }
  function fromFsDoc(doc) {
    if (!doc || !doc.fields) return null;
    const obj = fromFsFields(doc.fields);
    if (!obj.id && doc.name) obj.id = doc.name.split('/').pop();
    return obj;
  }

  /* ---------- Chamadas Cloud Firestore REST ---------- */
  async function fsReq(caminho, opts) {
    opts = opts || {};
    const cfg = lerFbConfig();
    if (!cfg.projectId) throw new Error('Projeto Firebase (projectId) não configurado.');
    const token = await obterIdTokenValido(!!opts.publicRead);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents`;
    let r;
    try {
      r = await fetch(baseUrl + caminho, {
        method: opts.method || 'GET',
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store'
      });
    } catch (e) { throw new Error('Sem conexão com o Cloud Firestore.'); }
    if (r.status === 404 && opts.allow404) return null;
    if (r.status === 401 || r.status === 403) {
      const j = await r.json().catch(() => ({}));
      throw new Error('Permissão negada no Firestore (' + ((j.error && j.error.message) || r.status) + '). Verifique as Security Rules e sua sessão.');
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(`Erro do Firestore (${r.status}): ${(j.error && j.error.message) || ''}`);
    }
    if (r.status === 204) return null;
    return r.json().catch(() => null);
  }

  async function listarColecaoFs(uid, col) {
    const docs = [];
    let pageToken = '';
    do {
      const qs = `?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
      const res = await fsReq(`/users/${encodeURIComponent(uid)}/${encodeURIComponent(col)}${qs}`, { allow404: true });
      if (!res || !res.documents) break;
      res.documents.forEach((d) => { const item = fromFsDoc(d); if (item && item.id) docs.push(item); });
      pageToken = res.nextPageToken || '';
    } while (pageToken);
    return docs;
  }

  async function commitWritesFs(writes) {
    if (!writes || !writes.length) return;
    for (let i = 0; i < writes.length; i += 400) {
      const chunk = writes.slice(i, i + 400);
      await fsReq(':commit', { method: 'POST', body: { writes: chunk } });
    }
  }

  /* ---------- Identificação por uid (contaUid), normalização e mescla em 3 vias ---------- */
  function lerBase() { try { return JSON.parse(ls.get(K.base)) || null; } catch (e) { return null; } }
  function configSinc(cfg) {
    const o = {};
    Object.keys(cfg || {}).forEach((k) => { if (!CONFIG_LOCAL.includes(k)) o[k] = cfg[k]; });
    return o;
  }
  function garantirIds(st) {
    (st.latte || []).forEach((x, idx) => {
      if (!x.id) x.id = 'l' + ((Date.parse(x.t) || (agora() + idx))).toString(36);
      else x.id = sanitizarId(x.id);
    });
    (st.cafeina || []).forEach((x, idx) => {
      if (!x.id) x.id = 'c' + ((Date.parse(x.t) || (agora() + idx))).toString(36);
      else x.id = sanitizarId(x.id);
    });
    ['graos', 'moedores', 'extracoes', 'metodos'].forEach((col) => {
      (st[col] || []).forEach((x) => { if (x && x.id) x.id = sanitizarId(x.id); });
    });
  }

  function vincularContaUid(st, uidConta) {
    if (!st || !uidConta) return;
    if (!st.config) st.config = { tema: 'auto', notaAlvo: 8 };
    st.config.contaUid = uidConta;
    COLECOES.forEach((col) => {
      (st[col] || []).forEach((r) => {
        if (r && typeof r === 'object' && (!r.contaUid || r.contaUid === uidConta)) r.contaUid = uidConta;
      });
    });
  }

  function intocado(col, r) {
    if (col === 'graos' && r.catalogoId) {
      const c = (DB.catalogo || []).find((x) => x.catalogoId === r.catalogoId);
      if (!c) return false;
      const ehFotoPadrao = !r.foto || (typeof window !== 'undefined' && window.CAFE_FOTOS && r.foto === window.CAFE_FOTOS[r.catalogoId]);
      return Object.keys(c).every((k) => estavel(c[k]) === estavel(r[k])) && !r.dataTorra && ehFotoPadrao;
    }
    if (col === 'moedores' && r.modeloId) {
      const m = (DB.moedoresModelo || []).find((x) => x.id === r.modeloId);
      if (!m) return false;
      return estavel(m.refs) === estavel(r.refs) && m.max === r.max && m.passo === r.passo;
    }
    return false;
  }

  function unificarIds(local, remoto) {
    const trocas = { graos: {}, moedores: {} };
    [['graos', 'catalogoId'], ['moedores', 'modeloId']].forEach(([col, chaveNat]) => {
      (local[col] || []).forEach((r) => {
        if (!r || !r[chaveNat]) return;
        const par = ((remoto && remoto[col]) || []).find((x) => x && x[chaveNat] === r[chaveNat]);
        if (par && par.id && par.id !== r.id) {
          trocas[col][r.id] = par.id;
          r.id = par.id;
          r._unif = true;
          if (intocado(col, r)) r._intocado = true;
        }
      });
    });
    (local.extracoes || []).forEach((x) => {
      if (x && trocas.graos[x.graoId]) x.graoId = trocas.graos[x.graoId];
      if (x && trocas.moedores[x.moedorId]) x.moedorId = trocas.moedores[x.moedorId];
    });
    return trocas;
  }

  function prepararRegistroParaNuvem(col, r, uid, t) {
    const copia = Object.assign({}, r);
    delete copia.diag;
    delete copia._idbFoto;
    delete copia._intocado;
    delete copia._unif;
    // Se a foto do grão é a mesma imagem padrão do catálogo (CAFE_FOTOS), não trafega base64 redundante
    if (col === 'graos' && copia.catalogoId && typeof window !== 'undefined' && window.CAFE_FOTOS && copia.foto === window.CAFE_FOTOS[copia.catalogoId]) {
      delete copia.foto;
    }
    if (col === 'graos' && typeof copia.foto === 'string' && copia.foto.length > 340000) {
      delete copia.foto;
    }
    copia.id = sanitizarId(copia.id);
    copia.contaUid = uid;
    copia.updatedAt = Number(copia.updatedAt || copia._mod) || t;
    copia._mod = copia.updatedAt;
    copia.schemaVersion = SCHEMA_VERSION;
    copia.deletedAt = null;
    return copia;
  }

  function mesclar(local, remoto, base, t) {
    const res = { colecoes: {}, apagados: {}, config: null, mudouLocal: false, mudouRemoto: false };
    const baseH = (base && base.h) || {};
    const primeira = !base;
    const uidConta = (contaCache && contaCache.uid) || (local.config && local.config.contaUid) || null;
    const regOk = (r) => !!(r && r.id && !r.deletedAt);

    COLECOES.forEach((col) => {
      const L = new Map((local[col] || []).filter(regOk).map((r) => [r.id, r]));
      const R = new Map(((remoto && remoto.colecoes && remoto.colecoes[col]) || []).filter(regOk).map((r) => [r.id, r]));
      const B = baseH[col] || {};
      const lapLocal = Object.assign({}, (local.apagados && local.apagados[col]) || {});
      (local[col] || []).forEach((r) => { if (r && r.deletedAt) lapLocal[r.id] = r.deletedAt; });
      const lapides = Object.assign({}, (remoto && remoto.apagados && remoto.apagados[col]) || {});
      const localColecaoVazia = L.size === 0 && R.size > 0;
      const out = [];
      const ids = new Set([...L.keys(), ...R.keys(), ...Object.keys(B), ...Object.keys(lapLocal)]);

      ids.forEach((id) => {
        const l = L.get(id), r = R.get(id);
        const localMudou = l && (!(id in B) || hash(l) !== B[id]);
        const localApagou = !l && !localColecaoVazia && ((id in B) || (id in lapLocal));
        if (l && localMudou && !(primeira && (l._intocado || l._unif) && r)) {
          carimbarMod(l, Math.max(modDe(l), t), uidConta);
        }
        if (l) { delete l._intocado; delete l._unif; }

        if (localApagou) {
          const tDel = lapLocal[id] || t;
          const refBase = (id in lapLocal) ? (lapLocal[id] || 0) : ((base && base.t) || 0);
          if (r && modDe(r) > refBase) {
            delete lapides[id];
            carimbarMod(r, modDe(r), uidConta);
            out.push(r);
            res.mudouLocal = true;
          } else {
            lapides[id] = Math.max(lapides[id] || 0, tDel);
            if (r) res.mudouRemoto = true;
          }
          return;
        }

        const lap = lapides[id] || 0;
        let venc = null;
        if (l && r) venc = modDe(l) >= modDe(r) ? l : r;
        else venc = l || r;

        if (venc && lap && lap >= modDe(venc)) {
          if (primeira && l && !r) {
            // Primeiro sync: preserva dados locais sem deixar lápides remotas apagarem registros existentes
          } else {
            if (l) res.mudouLocal = true;
            return;
          }
        }
        if (venc && lap) delete lapides[id];
        carimbarMod(venc, modDe(venc) || t, uidConta);
        out.push(venc);
        if (venc !== l && (!l || hash(l) !== hash(venc))) res.mudouLocal = true;
        if (venc !== r && (!r || hash(r) !== hash(venc) || modDe(r) !== modDe(venc))) res.mudouRemoto = true;
      });

      Object.keys(lapides).forEach((id) => { if (t - (lapides[id] || 0) > EXPIRA_LAPIDE) delete lapides[id]; });
      res.colecoes[col] = out;
      res.apagados[col] = lapides;
    });

    const cL = configSinc(local.config), cR = (remoto && remoto.config) || null;
    const cLmudou = !base || hash(cL) !== base.cfg;
    const cLmod = cLmudou ? (primeira && cR ? 0 : t) : modDe(local.config);
    if (!cR || cLmod >= modDe(cR)) {
      res.config = Object.assign({}, cL, { _mod: cLmod || t, updatedAt: cLmod || t });
      if (!cR || hash(cR) !== hash(res.config)) res.mudouRemoto = true;
    } else {
      res.config = Object.assign({}, cR, { _mod: modDe(cR), updatedAt: modDe(cR) });
      if (hash(cR) !== hash(cL)) res.mudouLocal = true;
    }
    if (uidConta) res.config.contaUid = uidConta;
    return res;
  }

  /* ---------- Sincronização Firestore Privada ---------- */
  let rodando = null, pendente = false, ultimoErro = '';

  function status(msg, tipo) {
    const b = document.getElementById('btnSync');
    if (b) {
      b.hidden = false;
      const conectado = ativo();
      b.textContent = tipo === 'sync' ? '⟳' : tipo === 'erro' ? '⚠' : '☁';
      b.title = msg || (conectado ? 'Sincronização ativa (clique para sincronizar)' : 'Conectar conta Google / Sincronizar na nuvem');
      b.classList.toggle('sync-erro', tipo === 'erro');
      b.classList.toggle('sync-roda', tipo === 'sync');
      b.classList.toggle('sync-on', conectado && tipo !== 'erro');
    }
    const el = document.getElementById('syncStatus');
    if (el && msg) el.textContent = msg;
  }

  async function desativarLocal() {
    clearTimeout(timer); timer = null; pendente = false;
    try {
      const auth = obterFirebaseAuth();
      if (auth && auth.currentUser) await auth.signOut();
    } catch (e) { /* */ }
    [K.on, K.modo, K.base, K.ult].forEach((k) => ls.set(k, ''));
    contaCache = null; ultimoErro = '';
    await gravarItemCofre('conta', null);
    status('Conectar conta Google', 'ok');
  }

  function limparBase() {
    ls.set(K.base, '');
    const st = lab.state(), t = agora();
    COLECOES.forEach((col) => { (st[col] || []).forEach((r) => carimbarMod(r, t)); });
    if (st.config) { st.config._mod = t; st.config.updatedAt = t; }
  }

  async function sincronizarFirestore(opts) {
    opts = opts || {};
    const conta = await carregarContaCofre();
    if (!conta || !conta.uid) throw new Error('Conecte sua conta do Google para sincronizar.');
    const cfg = lerFbConfig();
    if (!cfg.projectId) throw new Error('Projeto Firebase não configurado.');
    const uid = sanitizarId(conta.uid);
    const st = lab.state(), t = agora();
    garantirIds(st);
    vincularContaUid(st, uid);

    const userDocRaw = opts.recomecar ? null : await fsReq(`/users/${encodeURIComponent(uid)}`, { allow404: true });
    const userDoc = userDocRaw ? fromFsDoc(userDocRaw) : null;
    let remoto = null;
    const docsRemotosMap = {};

    if (userDoc && !opts.recomecar) {
      const colArrays = await Promise.all(COLECOES.map((col) => listarColecaoFs(uid, col)));
      const colecoesRemotas = {};
      const apagadosRemotos = Object.assign({}, userDoc.apagados || {});
      COLECOES.forEach((col, idx) => {
        const lista = colArrays[idx] || [];
        docsRemotosMap[col] = new Map(lista.map((r) => [r.id, r]));
        colecoesRemotas[col] = lista.filter((r) => r && r.id && !r.deletedAt);
        if (!apagadosRemotos[col]) apagadosRemotos[col] = {};
        lista.forEach((r) => { if (r && r.deletedAt) apagadosRemotos[col][r.id] = r.deletedAt; });
      });
      remoto = { colecoes: colecoesRemotas, apagados: apagadosRemotos, config: userDoc.config || null };
    } else {
      COLECOES.forEach((col) => { docsRemotosMap[col] = new Map(); });
    }

    const base = opts.recomecar ? null : lerBase();
    if (remoto) unificarIds(st, remoto.colecoes || {});
    const m = mesclar(st, remoto, base && base.uid === uid ? base : null, t);

    // Proteção contra sobrescrita: nuvem vazia NUNCA apaga dados locais existentes
    const localTinhaDados = (st.extracoes && st.extracoes.length > 0) || (st.graos && st.graos.length > 0);
    const remotoVazio = !remoto || !remoto.colecoes || ((!remoto.colecoes.extracoes || !remoto.colecoes.extracoes.length) && (!remoto.colecoes.graos || !remoto.colecoes.graos.length));
    const mFicouVazio = (!m.colecoes.extracoes || !m.colecoes.extracoes.length) && (!m.colecoes.graos || !m.colecoes.graos.length);

    if (localTinhaDados && (remotoVazio || mFicouVazio)) {
      COLECOES.forEach((col) => {
        const itensLocaisValidos = (st[col] || []).filter((r) => r && !r.deletedAt);
        if (itensLocaisValidos.length > 0) {
          m.colecoes[col] = itensLocaisValidos;
          m.colecoes[col].forEach((r) => carimbarMod(r, t, uid));
          m.apagados[col] = {};
        }
      });
      m.mudouLocal = false;
      m.mudouRemoto = true;
    }

    if (m.mudouLocal || !remoto) {
      COLECOES.forEach((col) => { st[col] = m.colecoes[col]; });
      const locais = {};
      CONFIG_LOCAL.forEach((k) => { if (st.config && k in st.config) locais[k] = st.config[k]; });
      st.config = Object.assign({ tema: 'auto', notaAlvo: 8 }, m.config, locais, {
        contaUid: uid,
        _mod: m.config._mod,
        updatedAt: m.config.updatedAt || m.config._mod
      });
      // Hidratar fotos dos grãos recebidos
      (st.graos || []).forEach((g) => {
        if (g.foto && lab.fotoStore) lab.fotoStore.set(g.id, g.foto);
        else if (!g.foto && g.catalogoId && typeof window !== 'undefined' && window.CAFE_FOTOS && window.CAFE_FOTOS[g.catalogoId]) {
          g.foto = window.CAFE_FOTOS[g.catalogoId];
          if (lab.fotoStore) lab.fotoStore.set(g.id, g.foto);
        }
      });
    } else {
      st.config.contaUid = uid;
      st.config._mod = m.config._mod;
      st.config.updatedAt = m.config.updatedAt || m.config._mod;
    }

    const h = {};
    const writes = [];
    const docPrefix = `projects/${cfg.projectId}/databases/(default)/documents/users/${uid}`;
    COLECOES.forEach((col) => {
      h[col] = {};
      const rMap = docsRemotosMap[col] || new Map();
      m.colecoes[col].forEach((r) => {
        const limpo = prepararRegistroParaNuvem(col, r, uid, t);
        r.contaUid = uid;
        r.updatedAt = limpo.updatedAt;
        r._mod = limpo._mod;
        r.schemaVersion = SCHEMA_VERSION;
        r.deletedAt = null;
        h[col][r.id] = hash(limpo);
        const rAnt = rMap.get(r.id);
        if (!rAnt || rAnt.deletedAt || hash(rAnt) !== h[col][r.id] || modDe(rAnt) !== limpo.updatedAt) {
          writes.push({
            update: {
              name: `${docPrefix}/${col}/${limpo.id}`,
              fields: toFsFields(limpo)
            }
          });
        }
      });
      const lap = m.apagados[col] || {};
      Object.entries(lap).forEach(([id, ts]) => {
        const rAnt = rMap.get(id);
        if (rAnt && !rAnt.deletedAt) {
          const lapDoc = prepararRegistroParaNuvem(col, rAnt, uid, ts);
          lapDoc.deletedAt = ts;
          writes.push({
            update: {
              name: `${docPrefix}/${col}/${sanitizarId(id)}`,
              fields: toFsFields(lapDoc)
            }
          });
        }
      });
    });

    const cfgHash = hash(configSinc(st.config));
    if (writes.length || m.mudouRemoto || !remoto) {
      writes.push({
        update: {
          name: docPrefix,
          fields: toFsFields({
            uid,
            schemaVersion: SCHEMA_VERSION,
            updatedAt: t,
            atualizadoEm: new Date(t).toISOString(),
            por: dispositivo(),
            config: m.config,
            lgpd: (st.config && st.config.lgpd) || { consentimentoEm: new Date(t).toISOString() },
            apagados: m.apagados
          })
        }
      });
      await commitWritesFs(writes);
    }

    ls.set(K.base, JSON.stringify({ uid, t, h, cfg: cfgHash }));
    ls.set(K.ult, new Date(t).toISOString());
    salvandoPorSync = true; lab.save(); salvandoPorSync = false;

    // Atualiza o perfil público de bancada na Comunidade (se opt-in ativo)
    if (window.CafeGamificacao && typeof window.CafeGamificacao.sincronizarPerfilPublico === 'function') {
      window.CafeGamificacao.sincronizarPerfilPublico().catch(() => {});
    }

    return { ok: true, recebeu: m.mudouLocal, enviou: writes.length > 0 };
  }

  async function sincronizar(opts) {
    opts = opts || {};
    await carregarContaCofre();
    if (!ativo()) return { ok: false, msg: 'Conecte sua conta do Google para sincronizar' };
    if (rodando) { pendente = true; return rodando; }
    rodando = (async () => {
      status('Sincronizando…', 'sync');
      try {
        const rFs = await sincronizarFirestore(opts);
        ultimoErro = '';
        const quando = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        status(`Sincronizado às ${quando}`, 'ok');
        if (rFs.recebeu && !opts.silencioso) lab.toast('Dados atualizados da sua conta Google');
        if (rFs.recebeu) lab.render();
        return rFs;
      } catch (e) {
        ultimoErro = e.message || String(e);
        status('Falha ao sincronizar: ' + ultimoErro, 'erro');
        if (!opts.silencioso) lab.toast(ultimoErro);
        return { ok: false, msg: ultimoErro };
      } finally {
        rodando = null;
        if (pendente) { pendente = false; setTimeout(() => sincronizar({ silencioso: true }), 500); }
      }
    })();
    return rodando;
  }

  /* ---------- Direito ao Esquecimento (LGPD Art. 18) ---------- */
  async function excluirContaNuvem() {
    await carregarContaCofre();
    const conta = contaAtiva();
    const st = lab.state();
    if (conta && conta.uid) {
      const cfg = lerFbConfig();
      const uid = sanitizarId(conta.uid);
      if (cfg.projectId && cfg.apiKey) {
        try {
          const token = await obterIdTokenValido(true);
          const [colArrays, itensRemotos] = await Promise.all([
            Promise.all(COLECOES.map((col) => listarColecaoFs(uid, col).catch(() => []))),
            listarItensComunidade().catch(() => [])
          ]);
          const docPrefix = `projects/${cfg.projectId}/databases/(default)/documents/users/${uid}`;
          const deletes = [];
          COLECOES.forEach((col, idx) => {
            (colArrays[idx] || []).forEach((doc) => {
              if (doc && doc.id) deletes.push({ delete: `${docPrefix}/${col}/${sanitizarId(doc.id)}` });
            });
          });
          deletes.push({ delete: docPrefix });
          deletes.push({ delete: `projects/${cfg.projectId}/databases/(default)/documents/community_profiles/${uid}` });

          // Exclui também todos os itens publicados pelo usuário em /community_items
          const idsItens = new Set();
          if (st && st.config && st.config.comunidade && Array.isArray(st.config.comunidade.meusItens)) {
            st.config.comunidade.meusItens.forEach((it) => { if (it && it.id) idsItens.add(sanitizarId(it.id)); });
          }
          (itensRemotos || []).forEach((it) => {
            if (it && it.id && it.autorUid === uid) idsItens.add(sanitizarId(it.id));
          });
          idsItens.forEach((itemId) => {
            deletes.push({ delete: `projects/${cfg.projectId}/databases/(default)/documents/community_items/${itemId}` });
          });

          await commitWritesFs(deletes).catch(() => {});
          if (token) {
            await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(cfg.apiKey)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: token })
            }).catch(() => {});
          }
        } catch (e) { /* prossegue com limpeza local */ }
      }
    }
    if (st && st.config) {
      delete st.config.contaUid;
      delete st.config.lgpd;
      if (st.config.comunidade) {
        st.config.comunidade.perfilPublico = false;
        st.config.comunidade.meusItens = [];
      }
      salvandoPorSync = true; lab.save(); salvandoPorSync = false;
    }
    [K.lgpd, K.comPerfis, K.comItens].forEach((k) => ls.set(k, ''));
    await desativarLocal();
    return { ok: true };
  }

  /* ---------- API da Comunidade (Firestore /community_profiles e /community_items) ---------- */
  function nomeAnonimizado(preferido, conta) {
    const p = String(preferido || '').trim();
    if (p && !p.includes('@')) return p.slice(0, 120);
    const primeiro = conta && conta.nome ? String(conta.nome).trim().split(/\s+/)[0] : '';
    return (primeiro && !primeiro.includes('@') ? primeiro : 'Barista').slice(0, 120);
  }

  async function publicarPerfilComunidade(perfil) {
    const conta = await carregarContaCofre();
    const cfg = lerFbConfig();
    if (!conta || !conta.uid || !cfg.projectId) return { ok: false, offline: true };
    if (!perfil || perfil.publico !== true) {
      return removerPerfilComunidade();
    }
    const uid = sanitizarId(conta.uid);
    const t = agora();
    // Anonimização estrita (LGPD): nunca envia email nem foto do Google para coleções públicas
    const doc = {
      uid,
      nome: nomeAnonimizado(perfil.nome, conta),
      nivel: Math.max(1, Math.min(100, Math.round(Number(perfil.nivel) || 1))),
      xpTotal: Math.max(0, Math.min(10000000, Math.round(Number(perfil.xpTotal) || 0))),
      tier: Math.max(1, Math.min(5, Math.round(Number(perfil.tier) || 1))),
      titulo: String(perfil.titulo || 'Aprendiz da Xícara').slice(0, 120),
      badgesCount: Math.max(0, Math.min(50, Math.round(Number(perfil.badgesCount) || 0))),
      badges: Array.isArray(perfil.badges) ? perfil.badges.slice(0, 50).map(String) : [],
      totalExtracoes: Math.max(0, Math.min(100000, Math.round(Number(perfil.totalExtracoes) || 0))),
      calibradas: Math.max(0, Math.min(100000, Math.round(Number(perfil.calibradas) || 0))),
      moedores: Array.isArray(perfil.moedores) ? perfil.moedores.slice(0, 20).map((s) => String(s).slice(0, 80)) : [],
      metodos: Array.isArray(perfil.metodos) ? perfil.metodos.slice(0, 20).map((s) => String(s).slice(0, 80)) : [],
      publico: true,
      updatedAt: t,
      atualizadoEm: new Date(t).toISOString()
    };
    const docName = `projects/${cfg.projectId}/databases/(default)/documents/community_profiles/${uid}`;
    await commitWritesFs([{ update: { name: docName, fields: toFsFields(doc) } }]);
    return { ok: true, doc };
  }

  async function removerPerfilComunidade() {
    const conta = await carregarContaCofre();
    const cfg = lerFbConfig();
    if (!conta || !conta.uid || !cfg.projectId) return { ok: false };
    const uid = sanitizarId(conta.uid);
    const docName = `projects/${cfg.projectId}/databases/(default)/documents/community_profiles/${uid}`;
    await commitWritesFs([{ delete: docName }]);
    return { ok: true };
  }

  async function listarPerfisComunidade() {
    const cfg = lerFbConfig();
    if (!cfg.projectId) return [];
    const res = await fsReq('/community_profiles?pageSize=100', { allow404: true, publicRead: true });
    if (!res || !res.documents) return [];
    const lista = [];
    res.documents.forEach((d) => {
      const item = fromFsDoc(d);
      if (item && item.uid && item.publico === true) {
        delete item.email;
        delete item.foto;
        lista.push(item);
      }
    });
    lista.sort((a, b) => (Number(b.xpTotal) || 0) - (Number(a.xpTotal) || 0));
    try { ls.set(K.comPerfis, JSON.stringify(lista.slice(0, 80))); } catch (e) { /* */ }
    return lista;
  }

  async function publicarItemComunidade(item) {
    const conta = await carregarContaCofre();
    const cfg = lerFbConfig();
    const t = agora();
    const autorUid = conta && conta.uid ? sanitizarId(conta.uid) : 'local-barista';
    const apelidoCfg = (lab.state().config && lab.state().config.comunidade && lab.state().config.comunidade.apelido) || '';
    const autorNome = String(item.autorNome || nomeAnonimizado(apelidoCfg, conta)).slice(0, 120);
    const tipoValido = ['grao', 'receita', 'moedor', 'metodo'].includes(item.tipo) ? item.tipo : 'grao';
    const rawId = sanitizarId(item.id || `${tipoValido}_${autorUid}_${t.toString(36)}`);
    const itemId = rawId.includes(autorUid) ? rawId : sanitizarId(`com_${tipoValido}_${autorUid}_${rawId}`);

    // Limpa payload para caber na validação (<= 50 chaves e sem fotos ou PII)
    const cleanPayload = {};
    Object.keys(item.payload || {}).slice(0, 45).forEach((k) => {
      const v = item.payload[k];
      if (v === undefined || k === 'foto' || k === 'email' || k === 'contaUid' || k === 'diag' || k === '_idbFoto') return;
      cleanPayload[k] = v;
    });

    const doc = {
      id: itemId,
      autorUid,
      autorNome,
      autorTier: Math.max(1, Math.min(5, Math.round(Number(item.autorTier) || 1))),
      autorNivel: Math.max(1, Math.min(100, Math.round(Number(item.autorNivel) || 1))),
      tipo: tipoValido,
      titulo: String(item.titulo || 'Item compartilhado').slice(0, 200),
      subtitulo: item.subtitulo ? String(item.subtitulo).slice(0, 300) : null,
      resumo: item.resumo ? String(item.resumo).slice(0, 1000) : null,
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 20).map((s) => String(s).slice(0, 60)) : [],
      nota: item.nota != null ? Math.max(0, Math.min(10, Number(item.nota))) : null,
      metodoId: item.metodoId ? String(item.metodoId).slice(0, 64) : null,
      regiao: item.regiao ? String(item.regiao).slice(0, 64) : null,
      processo: item.processo ? String(item.processo).slice(0, 64) : null,
      torra: item.torra ? String(item.torra).slice(0, 64) : null,
      payload: cleanPayload,
      updatedAt: t,
      criadoEm: new Date(t).toISOString()
    };

    // Salva no cache local imediatamente
    let cache = [];
    try { cache = JSON.parse(ls.get(K.comItens) || '[]'); } catch (e) { cache = []; }
    cache = [doc, ...cache.filter((x) => x.id !== doc.id)].slice(0, 100);
    ls.set(K.comItens, JSON.stringify(cache));

    if (conta && conta.uid && cfg.projectId) {
      const docName = `projects/${cfg.projectId}/databases/(default)/documents/community_items/${itemId}`;
      await commitWritesFs([{ update: { name: docName, fields: toFsFields(doc) } }]);
      return { ok: true, nuvem: true, doc };
    }
    return { ok: true, nuvem: false, doc };
  }

  async function removerItemComunidade(itemId) {
    if (!itemId) return { ok: false };
    const id = sanitizarId(itemId);
    let cache = [];
    try { cache = JSON.parse(ls.get(K.comItens) || '[]'); } catch (e) { cache = []; }
    ls.set(K.comItens, JSON.stringify(cache.filter((x) => x.id !== id)));

    const conta = await carregarContaCofre();
    const cfg = lerFbConfig();
    if (conta && conta.uid && cfg.projectId) {
      const docName = `projects/${cfg.projectId}/databases/(default)/documents/community_items/${id}`;
      await commitWritesFs([{ delete: docName }]).catch(() => {});
    }
    return { ok: true };
  }

  async function listarItensComunidade() {
    const cfg = lerFbConfig();
    if (!cfg.projectId) return [];
    const res = await fsReq('/community_items?pageSize=100', { allow404: true, publicRead: true });
    if (!res || !res.documents) return [];
    const lista = [];
    res.documents.forEach((d) => {
      const item = fromFsDoc(d);
      if (item && item.id && item.titulo) lista.push(item);
    });
    lista.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    try { ls.set(K.comItens, JSON.stringify(lista.slice(0, 100))); } catch (e) { /* */ }
    return lista;
  }

  /* ---------- Gatilhos automáticos ---------- */
  let salvandoPorSync = false, timer = null;
  lab.hooks.salvo.push(() => {
    if (salvandoPorSync || !ativo()) return;
    if (rodando) { pendente = true; return; }
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; sincronizar({ silencioso: true }); }, 4000);
  });

  lab.hooks.boot.push(async () => {
    await carregarContaCofre();
    const auth = obterFirebaseAuth();
    if (auth) {
      try {
        const redir = await auth.getRedirectResult();
        if (redir && redir.user) await vincularUsuarioFirebase(redir.user);
      } catch (e) { /* */ }
      auth.onAuthStateChanged(async (u) => {
        if (u && (!contaCache || contaCache.uid !== sanitizarId(u.uid))) {
          await vincularUsuarioFirebase(u);
          status('Sincronização ativa', 'ok');
          sincronizar({ silencioso: true });
        }
      });
    }
    status(ativo() ? 'Sincronização ativa' : 'Conectar conta Google', 'ok');
    const b = document.getElementById('btnSync');
    if (b) {
      b.hidden = false;
      b.onclick = async () => {
        if (!ativo()) { lab.go('#/sync'); return; }
        const r = await sincronizar();
        if (r && r.ok) lab.toast(r.recebeu ? 'Dados atualizados da nuvem' : 'Sincronizado com a nuvem');
      };
    }
    if (ativo()) setTimeout(() => sincronizar({ silencioso: true }), 800);
  });

  document.addEventListener('visibilitychange', () => {
    if (!ativo()) return;
    if (document.visibilityState === 'visible') sincronizar({ silencioso: true });
    else if (timer) { clearTimeout(timer); timer = null; sincronizar({ silencioso: true }); }
  });
  window.addEventListener('online', () => { if (ativo()) sincronizar({ silencioso: true }); });

  /* ---------- UI de Sincronização (Rota #/sync e Card em #/ajustes) ---------- */
  function renderCardSync(container, ehPaginaCompleta) {
    const conta = contaAtiva();
    const ult = ls.get(K.ult);
    const consentiu = ls.get(K.lgpd) === '1' || !!(lab.state().config && lab.state().config.lgpd);
    const fotoSegura = conta && typeof conta.foto === 'string' && /^https:\/\//i.test(conta.foto.trim()) ? conta.foto.trim() : '';

    const html = `
      <div class="card ${ehPaginaCompleta ? 'stack' : ''}" style="${ehPaginaCompleta ? 'max-width:560px;margin:0 auto' : 'margin-top:12px'}">
        <div class="row between">
          <div>
            <h3>☁ Login com Google &amp; Sincronização</h3>
            <p class="text-2" style="margin:4px 0 0">Sincronize automaticamente seus grãos, moedores, receitas calibradas, evolução do Pingo e conquistas entre celular, tablet e computador.</p>
          </div>
          ${conta ? '<span class="badge ok">Conectado</span>' : '<span class="badge">Modo convidado</span>'}
        </div>

        ${conta ? `
          <div class="card soft" style="margin-top:10px">
            <div class="row between">
              <div class="row" style="gap:10px">
                ${fotoSegura ? `<img src="${lab.esc(fotoSegura)}" alt="" referrerpolicy="no-referrer" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:1px solid var(--border)">` : '<div class="ico">👤</div>'}
                <div>
                  <strong>${lab.esc(conta.nome || 'Conta Google')}</strong>
                  ${conta.email ? `<div class="s">${lab.esc(conta.email)}</div>` : ''}
                </div>
              </div>
              <a class="btn sm ghost" href="#/comunidade?tab=ranking">🥇 Comunidade</a>
            </div>
            <div class="s" id="syncStatus" style="margin-top:8px">${ult ? 'Última sincronização: ' + lab.fmtData(ult) : 'Sincronização automática ativa'}${ultimoErro ? ' · ' + lab.esc(ultimoErro) : ''}</div>
          </div>
          <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">
            <button class="btn primary sm" id="syAgora">⟳ Sincronizar agora</button>
            <button class="btn sm" id="syOff">Sair da conta</button>
            <button class="btn danger sm" id="syExcluirConta">🗑️ Excluir conta e dados (LGPD)</button>
          </div>
        ` : `
          <label class="check" style="margin:10px 0">
            <input type="checkbox" id="syLgpd" ${consentiu ? 'checked' : ''}>
            <span class="text-2" style="font-size:.86rem">Autorizo a sincronização privada em nuvem dos meus dados do diário de café na minha conta Google (LGPD).</span>
          </label>
          <div class="row" style="gap:8px">
            <button class="btn primary" id="syGoogle" style="width:100%;justify-content:center">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 1.81-1.5 3.34-3.2 4.37v3.62h5.18c3.03-2.79 4.78-6.9 4.78-11.81 0-.8-.08-1.57-.23-2.31z"/><path fill="currentColor" d="M12.18 22c4.32 0 7.95-1.43 10.6-3.88l-5.18-3.62c-1.43.96-3.26 1.53-5.42 1.53-4.17 0-7.7-2.81-8.96-6.6H-2.1v3.73C.54 18.42 5.93 22 12.18 22z" opacity=".85"/></svg>
              Entrar com a conta do Google
            </button>
          </div>
          <small class="muted" style="display:block;margin-top:6px">O uso sem conta continua 100% liberado e offline neste aparelho.</small>
        `}
      </div>`;

    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    container.appendChild(wrap);
    const q = (s) => wrap.querySelector(s);

    if (q('#syGoogle')) {
      q('#syGoogle').onclick = async () => {
        const chk = q('#syLgpd');
        if (chk && !chk.checked) {
          lab.toast('Marque a caixa de autorização LGPD para sincronizar na nuvem.');
          return;
        }
        ls.set(K.lgpd, '1');
        const st = lab.state();
        st.config.lgpd = { consentimentoEm: new Date().toISOString() };
        try {
          const res = await iniciarLoginSocial('google.com');
          if (res && res.uid) {
            lab.toast(`Conectado como ${res.nome || res.email}! Sincronizando…`);
            await sincronizar({ silencioso: true });
            lab.render();
          }
        } catch (e) {
          lab.toast(e.message || String(e));
        }
      };
    }
    if (q('#syAgora')) {
      q('#syAgora').onclick = async () => {
        lab.toast('Sincronizando…');
        const r = await sincronizar();
        if (r && r.ok) lab.toast(r.recebeu ? 'Dados atualizados da nuvem' : 'Sincronizado com sucesso');
        lab.render();
      };
    }
    if (q('#syOff')) {
      q('#syOff').onclick = async () => {
        if (!window.confirm('Sair da sua conta Google neste aparelho? Seus dados continuam salvos na nuvem e neste aparelho.')) return;
        await desativarLocal();
        lab.toast('Conta desconectada neste aparelho');
        lab.render();
      };
    }
    if (q('#syExcluirConta')) {
      q('#syExcluirConta').onclick = async () => {
        if (!window.confirm('Excluir PERMANENTEMENTE seus dados na nuvem, seus itens compartilhados, seu perfil público e sua conta conectada (Direito ao Esquecimento — LGPD)? Esta ação não pode ser desfeita.')) return;
        lab.toast('Excluindo dados na nuvem…');
        await excluirContaNuvem();
        lab.toast('Dados em nuvem excluídos');
        lab.render();
      };
    }
  }

  lab.routes.sync = (view) => {
    document.getElementById('title').textContent = 'Sincronização na Nuvem';
    view.innerHTML = '';
    renderCardSync(view, true);
  };

  lab.hooks.ajustes.push((root) => {
    renderCardSync(root, false);
  });

  window.CafeSync = {
    sincronizar,
    sincronizarFirestore,
    mesclar,
    unificarIds,
    hash,
    ativo,
    contaAtiva,
    usuarioAtual: contaAtiva,
    iniciarLoginSocial,
    toFsFields,
    fromFsFields,
    fromFsDoc,
    excluirContaNuvem,
    desativarLocal,
    limparBase,
    publicarPerfilComunidade,
    removerPerfilComunidade,
    listarPerfisComunidade,
    publicarItemComunidade,
    removerItemComunidade,
    listarItensComunidade
  };
})();
