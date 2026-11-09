/* =====================================================================
 * Laboratório de Cafeteria — Motor de diagnóstico e recomendação
 * Regras determinísticas (sem rede): parte do banco nativo e converge
 * usando o histórico real do grão × método × moedor.
 * ===================================================================== */
window.Engine = (function () {
  'use strict';
  const DB = window.CAFE_DB;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;
  /* Métodos personalizados (e a B75) herdam o comportamento de um método base */
  const baseId = (m) => (m && (m.base || m.id)) || '';
  const isPressao = (m) => baseId(m) === 'espresso' || baseId(m) === 'moka';
  const isEspresso = (m) => baseId(m) === 'espresso';

  /* Arredonda para o passo do moedor (ex.: 0,5 ou 0,33) */
  function snap(grinder, clicks) {
    const passo = Number(grinder && grinder.passo) || 1;
    const min = Number(grinder && grinder.min) || 0;
    const max = Number(grinder && grinder.max) || 40;
    const s = Math.round((clicks - min) / passo) * passo + min;
    return clamp(Math.round(s * 100) / 100, min, max);
  }

  /* Classes de método */
  const IMERSAO = ['prensa-francesa', 'clever', 'aeropress', 'cold-brew'];
  const tipoMetodo = (m) => (isEspresso(m) ? 'espresso' : baseId(m) === 'moka' ? 'moka' : IMERSAO.includes(baseId(m)) ? 'imersao' : 'filtro');

  /* Faixa de tempo para a dose usada. Nos filtrados (percolação) a água leva
   * mais tempo para atravessar um leito maior: a faixa do método vale para a
   * dose padrão (10 g) e escala com (dose / padrão)^0,4. Imersão, espresso e
   * moka não mudam com a dose. */
  function faixaTempo(method, dose) {
    const T = method.tempoS;
    const d = Number(dose), ref = Number(method.dosePadrao) || 10;
    if (tipoMetodo(method) !== 'filtro' || !d || d === ref) return { min: T.min, max: T.max, padrao: T.padrao };
    const f = clamp(Math.pow(d / ref, 0.4), 0.5, 1.8);
    const r5 = (v) => Math.round((v * f) / 5) * 5;
    return { min: r5(T.min), max: r5(T.max), padrao: r5(T.padrao) };
  }

  /* Tamanho de um "ajuste padrão" em cliques para este moedor/método.
   * Com µm por clique conhecido: ~18 µm no espresso, ~30 µm na moka,
   * ~55 µm em filtrados e ~80 µm em imersão. */
  function passoAjuste(grinder, method) {
    const passo = Number(grinder.passo) || 1;
    const tipo = tipoMetodo(method);
    let base;
    if (grinder.passoAjuste) base = Number(grinder.passoAjuste) * (tipo === 'espresso' ? 0.5 : tipo === 'imersao' ? 1.4 : 1);
    else if (grinder.umPorClique) base = ({ espresso: 18, moka: 30, filtro: 55, imersao: 80 })[tipo] / Number(grinder.umPorClique);
    else {
      const span = (Number(grinder.max) || 40) - (Number(grinder.min) || 0);
      base = tipo === 'espresso' ? span / 36 : tipo === 'imersao' ? span / 14 : span / 18;
    }
    base = Math.max(passo, Math.round(base / passo) * passo);
    return Math.round(base * 100) / 100;
  }

  /* Converte um descritor de moagem (1–7 ± offset) em cliques */
  function clicksForMethod(grinder, method, offsetSteps) {
    const off = offsetSteps || 0;
    const min = Number(grinder.min) || 0, max = Number(grinder.max) || 40;
    const refs = grinder.refs || {};
    let base;
    const ref = refs[method.id] != null && refs[method.id] !== '' ? refs[method.id] : method.base && refs[method.base] != null && refs[method.base] !== '' ? refs[method.base] : null;
    if (ref != null) base = Number(ref);
    else {
      // interpola pela escala 1–7
      base = min + (max - min) * ((method.grind - 0.5) / 7);
    }
    // um "passo" de descritor: 1/12 da escala em filtrados; espresso é muito mais sensível (1/30)
    const stepClicks = grinder.umPorClique || grinder.passoAjuste ? 2 * passoAjuste(grinder, method) : (max - min) / (isEspresso(method) ? 30 : 12);
    const sinal = grinder.direcao === 'maior=fino' ? -1 : 1; // padrão: menor número = mais fino
    return snap(grinder, base + sinal * off * stepClicks);
  }

  /* ---------- Ponto de partida para um grão novo ---------- */
  function startingPoint(bean, method, grinder) {
    const torra = DB.torra[bean.torra] || DB.torra['media'];
    const proc = DB.processo[bean.processo] || DB.processo['cereja-descascado'];
    const reg = DB.regiao[bean.regiao] || DB.regiao['outra'];
    const acidez = Number(bean.acidez || reg.acidez || 3);
    const corpo = Number(bean.corpo || reg.corpo || 3);
    const canephora = reg.id === 'conilon-capixaba' || reg.id === 'rondonia' || bean.especie === 'canephora';
    const por = [];

    // razão
    let ratio;
    if (isEspresso(method)) {
      ratio = torra.base.ratioEspresso + proc.ajuste.ratio * 0.15;
      if (acidez >= 4) { ratio += 0.2; por.push('Acidez alta: razão de espresso mais longa para abrir doçura.'); }
      if (corpo >= 4 && acidez <= 2) { ratio -= 0.1; por.push('Perfil encorpado: razão levemente mais curta preserva textura.'); }
      if (canephora) { ratio -= 0.15; por.push('Canephora: razão curta (1:1,8–1:2).'); }
    } else if (baseId(method) === 'moka' || baseId(method) === 'cold-brew') {
      ratio = method.ratio.padrao;
    } else {
      const offsetTorra = torra.base.ratioFiltro - 16; // referência V60 1:16
      ratio = method.ratio.padrao + offsetTorra + proc.ajuste.ratio;
      if (acidez >= 4) { ratio += 0.5; por.push('Acidez alta: razão um pouco mais longa (mais clareza).'); }
      if (corpo >= 4) { ratio -= 0.5; por.push('Corpo alto: razão um pouco mais curta sustenta o corpo.'); }
      if (canephora) { ratio -= 1; por.push('Canephora: razão mais curta e temperatura menor.'); }
    }
    ratio = clamp(ratio, method.ratio.min, method.ratio.max);
    if (proc.ajuste.ratio) por.push(`Processo ${proc.nome.split(' (')[0]}: ${proc.ajuste.ratio > 0 ? 'razão mais longa' : 'razão mais curta'}.`);

    // temperatura
    let tempC;
    if (baseId(method) === 'cold-brew') tempC = method.tempC.padrao;
    else if (isEspresso(method)) tempC = torra.base.espressoTempC + proc.ajuste.tempC * 0.5;
    else tempC = torra.base.filtroTempC + proc.ajuste.tempC + (method.tempC.padrao - 93);
    if (acidez >= 4 && !isPressao(method) && baseId(method) !== 'cold-brew') tempC += 0.5;
    if (method.id === 'suiren' && (proc.id === 'anaerobico' || proc.id === 'fermentacao-induzida')) {
      tempC += 0.5; // as 12 pétalas abertas já esfriam o terço final da extração
    }
    if (canephora) tempC -= 2;
    tempC = clamp(Math.round(tempC * 2) / 2, method.tempC.min, method.tempC.max);
    por.push(`Torra ${torra.nome.toLowerCase()}: base de ${isEspresso(method) ? torra.base.espressoTempC : torra.base.filtroTempC} °C${proc.ajuste.tempC ? ` (${proc.ajuste.tempC > 0 ? '+' : ''}${proc.ajuste.tempC} °C pelo processo)` : ''}.`);
    if (method.id === 'suiren') por.push('Hario Suiren: as 12 aletas abertas dissipam calor rápido; a água mais quente no início compensa a perda térmica e o resfriamento natural no fim evita amargor.');
    if (method.id === 'origami') por.push('Origami: receita calibrada para filtro cônico (fluxo ágil pelas 20 caneluras). Se usar filtro plano (Kalita Wave), engrosse 1–2 cliques para ganhar doçura e corpo.');

    // moagem
    let moagemOff = torra.base.moagem + proc.ajuste.moagem;
    if (canephora) moagemOff += 0.5;
    if (corpo >= 4 && (baseId(method) === 'v60' || baseId(method) === 'prensa-francesa')) { moagemOff += 0.25; }
    // se o moedor não tiver ref própria de suiren/origami e estiver herdando da V60, compensa o fluxo maior
    const usaFallbackBase = grinder && grinder.refs && grinder.refs[method.id] == null && method.base;
    if (usaFallbackBase && method.id === 'suiren') moagemOff -= 0.25;
    if (usaFallbackBase && method.id === 'origami') moagemOff -= 0.15;
    const clicks = grinder ? clicksForMethod(grinder, method, moagemOff) : null;
    if (moagemOff !== 0) por.push(`Moagem ${moagemOff > 0 ? 'mais grossa' : 'mais fina'} que o padrão do método (${r2(Math.abs(moagemOff))} passo).`);

    // dose / água
    // dose de partida: 10 g (espresso 16 g); a dose do grão, se definida, vale fora do espresso
    const dose = (!isEspresso(method) && Number(bean.dosePadrao)) || method.dosePadrao;
    const water = isEspresso(method) ? r1(dose * ratio) : Math.round(dose * ratio);
    const TS = faixaTempo(method, dose);
    if (tipoMetodo(method) === 'filtro' && dose <= 12) por.push(`Dose de ${fmtN(dose)} g: leito baixo drena mais rápido; a faixa de tempo (${fmtTempo(TS.min)}–${fmtTempo(TS.max)}) já considera essa dose.`);

    // descanso
    let descanso = null;
    if (bean.dataTorra) {
      const dias = Math.floor((Date.now() - new Date(bean.dataTorra).getTime()) / 86400000);
      const faixa = torra.descansoDias[isPressao(method) ? 'espresso' : 'filtrado'];
      descanso = { dias, faixa, ok: dias >= faixa[0] && dias <= faixa[1] * 2 };
      if (dias < faixa[0]) por.push(`Grão com ${dias} dia(s) de torra: ainda desgaseificando (ideal ${faixa[0]}–${faixa[1]} dias). Espere resultados instáveis; moa 1 passo mais grosso e faça bloom mais longo.`);
      else if (dias > faixa[1] * 2) por.push(`Grão com ${dias} dias de torra: já passou do pico (${faixa[0]}–${faixa[1]} dias). Moa um pouco mais fino e use +1 °C.`);
    }

    return { ratio: r2(ratio), tempC, clicks, dose, water, tempoS: TS.padrao, faixaTempo: TS, moagemOff, por, descanso, torra, proc, reg };
  }

  /* ---------- Rendimento de extração (EY) ---------- */
  function ey(brew, method) {
    const tds = Number(brew.tds);
    if (!tds || !brew.dose) return null;
    const bebida = isEspresso(method) ? Number(brew.yieldG || brew.water) : Number(brew.water) * 0.87; // filtrados: ~13 % retido no pó
    if (!bebida) return null;
    return r1(tds * bebida / Number(brew.dose));
  }

  /* ---------- Perfil sensorial esperado do grão ----------
   * O que este grão, nesta torra e neste método, deveria entregar na xícara
   * (escala 1–5). É a referência para ler a avaliação: acidez 4 é ótima num
   * lavado da Mantiqueira e sinal de sub-extração num natural do Cerrado. */
  const FAMILIAS = {
    fruta: ['frutas amarelas', 'frutas vermelhas', 'frutas tropicais', 'frutas secas', 'cítrico', 'laranja', 'limão', 'maçã', 'uva', 'pêssego', 'maracujá', 'manga', 'cereja', 'morango', 'amora', 'jabuticaba', 'cajá', 'caju'],
    floral: ['floral', 'chá preto', 'ervas', 'jasmim', 'flores'],
    doce: ['caramelo', 'mel', 'rapadura', 'melado', 'cana', 'baunilha', 'doce de leite', 'açúcar mascavo'],
    chocolate: ['chocolate', 'cacau', 'nozes', 'castanhas', 'castanha', 'amendoim', 'amêndoa'],
    fermentado: ['vinho', 'fermentado', 'álcool', 'licor', 'boozy'],
    tostado: ['tostado', 'defumado', 'amadeirado', 'queimado'],
    cru: ['cereal', 'vegetal', 'grama', 'palha']
  };
  const NOME_FAMILIA = { fruta: 'fruta', floral: 'floral', doce: 'caramelo/mel', chocolate: 'chocolate/nozes' };
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function familia(nota) {
    const n = semAcento(nota);
    for (const f in FAMILIAS) if (FAMILIAS[f].some((x) => n.includes(semAcento(x)))) return f;
    return null;
  }
  const meio = (v) => Math.round(v * 2) / 2;
  const fmtN = (v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',');
  const minusc = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const juntar = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]);
  const AMARGOR_TORRA = { clara: 1.5, 'media-clara': 2, media: 2.5, 'media-escura': 3.5, escura: 4.2 };
  const ACIDEZ_TORRA = { clara: 0.5, 'media-clara': 0.25, media: 0, 'media-escura': -0.5, escura: -1 };
  const CORPO_METODO = { espresso: 1.2, moka: 1, 'prensa-francesa': 0.6, 'coador-pano': 0.4, clever: 0.2, aeropress: 0.2, 'cold-brew': 0.3, melitta: 0, kalita: 0, origami: -0.3, v60: -0.4, suiren: -0.5, chemex: -0.7 };
  const ATRIBUTOS = [['acidez', 'Acidez'], ['docura', 'Doçura'], ['amargor', 'Amargor'], ['corpo', 'Corpo'], ['final', 'Finalização']];

  function perfilEsperado(bean, method) {
    const b = bean || {};
    const reg = DB.regiao[b.regiao] || DB.regiao.outra;
    const torraId = DB.torra[b.torra] ? b.torra : 'media';
    const canephora = b.especie === 'canephora' || reg.id === 'conilon-capixaba' || reg.id === 'rondonia';
    const acB = Number(b.acidez) || reg.acidez || 3, coB = Number(b.corpo) || reg.corpo || 3, doB = Number(b.docura) || reg.docura || 3;
    const notas = (b.notas && b.notas.length ? b.notas : reg.notas) || [];
    return {
      acidez: meio(clamp(acB + (ACIDEZ_TORRA[torraId] || 0) - (canephora ? 0.5 : 0), 1, 5)),
      docura: meio(clamp(Math.max(3.5, doB), 1, 5)), // doçura: buscar o máximo que o grão entrega
      amargor: meio(clamp((AMARGOR_TORRA[torraId] || 2.5) + (canephora ? 0.7 : 0), 1, 5)),
      corpo: meio(clamp(coB + (CORPO_METODO[method && method.id] != null ? CORPO_METODO[method.id] : (CORPO_METODO[baseId(method)] || 0)), 1, 5)),
      final: 4,
      notas, familias: [...new Set(notas.map(familia).filter(Boolean))],
      torraId, torra: DB.torra[torraId], proc: DB.processo[b.processo] || null, reg, canephora
    };
  }

  /* Compara o que você sentiu com o que o grão deveria entregar */
  function leituraSensorial(brew, method, bean) {
    const E = perfilEsperado(bean, method);
    const P = {}, d = {};
    ATRIBUTOS.forEach(([k]) => { P[k] = Number(brew[k]) || 3; d[k] = r2(P[k] - E[k]); });
    const perc = brew.descritores || [];
    const famP = [...new Set(perc.map(familia).filter(Boolean))];
    const escura = E.torraId === 'media-escura' || E.torraId === 'escura';
    return {
      esperado: E, percebido: P, desvio: d, notasPercebidas: perc, familiasPercebidas: famP,
      notasFaltando: perc.length ? E.familias.filter((f) => ['fruta', 'floral', 'doce', 'chocolate'].includes(f) && !famP.includes(f)) : [],
      notasIntrusas: famP.filter((f) => ['tostado', 'cru', 'fermentado'].includes(f) && !E.familias.includes(f) && !(f === 'tostado' && escura))
    };
  }

  /* ---------- Diagnóstico de uma extração ----------
   * indice ∈ [-1, 1]: negativo = sub-extração, positivo = sobre-extração
   * forca  ∈ [-1, 1]: negativo = fraco/diluído, positivo = forte demais
   * Com o grão, a avaliação é lida em relação ao perfil esperado dele. */
  function diagnose(brew, method, bean) {
    let sub = 0, sobre = 0, forca = 0, ferm = 0;
    const fatores = [];
    (brew.sinais || []).forEach((id) => {
      const s = DB.sinal[id]; if (!s) return;
      if (s.tipo === 'sub') { sub += s.peso; fatores.push({ t: s.nome, v: -s.peso }); }
      else if (s.tipo === 'sobre') { sobre += s.peso; fatores.push({ t: s.nome, v: +s.peso }); }
      else if (s.tipo === 'forca-baixa') { forca -= 1; fatores.push({ t: s.nome, v: 0, forca: -1 }); }
      else if (s.tipo === 'forca-alta') { forca += 1; fatores.push({ t: s.nome, v: 0, forca: +1 }); }
      else if (s.tipo === 'processo') { ferm += 1; fatores.push({ t: s.nome, v: 0, processo: true }); }
    });

    const temGrao = bean && (bean.id || bean.regiao || bean.torra);
    let leitura = null;
    if (temGrao) {
      leitura = leituraSensorial(brew, method, bean);
      const E = leitura.esperado, P = leitura.percebido, d = leitura.desvio;
      const acExc = Math.max(0, d.acidez), acDef = Math.max(0, -d.acidez), doDef = Math.max(0, -d.docura);
      const amExc = Math.max(0, d.amargor), fiDef = Math.max(0, -d.final), co = d.corpo;
      const tor = E.torra.nome.toLowerCase();
      if (acExc >= 1) {
        const v = 0.35 * acExc + (doDef >= 1 ? 0.25 * doDef : 0);
        sub += v; fatores.push({ t: `Acidez ${fmtN(P.acidez)} acima do esperado para este grão (${fmtN(E.acidez)})${doDef >= 1 ? ` e doçura ${fmtN(P.docura)} abaixo do alvo (${fmtN(E.docura)})` : ''}`, v: -r2(v) });
      }
      if (amExc >= 1) {
        const v = 0.35 * amExc + (doDef >= 1 && acExc < 1 ? 0.25 * doDef : 0);
        sobre += v; fatores.push({ t: `Amargor ${fmtN(P.amargor)} acima do esperado para torra ${tor} (${fmtN(E.amargor)})${doDef >= 1 && acExc < 1 ? ` e doçura ${fmtN(P.docura)} abaixo do alvo (${fmtN(E.docura)})` : ''}`, v: r2(v) });
      }
      if (doDef >= 1 && acExc < 1 && amExc < 1) {
        if (co <= -1) { forca -= 0.35; fatores.push({ t: `Doçura ${fmtN(P.docura)} e corpo ${fmtN(P.corpo)} abaixo do esperado: xícara diluída`, v: 0, forca: -0.35 }); }
        else { const v = 0.2 * doDef; sub += v; fatores.push({ t: `Doçura ${fmtN(P.docura)} abaixo do que o grão entrega (${fmtN(E.docura)}), sem acidez nem amargor em excesso`, v: -r2(v) }); }
      }
      if (fiDef >= 1.5) {
        if (amExc >= 1) { sobre += 0.15; fatores.push({ t: `Finalização ${fmtN(P.final)}: final áspero junto com o amargor`, v: 0.15 }); }
        else if (acExc >= 1 || doDef >= 1) { sub += 0.15; fatores.push({ t: `Finalização ${fmtN(P.final)}: final curto, a doçura não se sustenta`, v: -0.15 }); }
      }
      if (acDef >= 1.5 && amExc >= 1) { sobre += 0.2; fatores.push({ t: `Acidez ${fmtN(P.acidez)} apagada pelo amargor (esperado ${fmtN(E.acidez)})`, v: 0.2 }); }
      if (co <= -1.5 && doDef < 1) { forca -= 0.4; fatores.push({ t: `Corpo ${fmtN(P.corpo)} abaixo do esperado (${fmtN(E.corpo)}) para este grão no método`, v: 0, forca: -0.4 }); }
      else if (co >= 1.5) { forca += 0.4; fatores.push({ t: `Corpo ${fmtN(P.corpo)} acima do esperado (${fmtN(E.corpo)}) para este grão no método`, v: 0, forca: 0.4 }); }
      leitura.notasIntrusas.forEach((fam) => {
        if (fam === 'cru') { sub += 0.3; fatores.push({ t: 'Notas de cereal/vegetal: típico de sub-extração', v: -0.3 }); }
        if (fam === 'tostado') { sobre += 0.3; fatores.push({ t: `Notas tostadas/amadeiradas num café de torra ${tor}: água quente demais ou extração longa`, v: 0.3 }); }
        if (fam === 'fermentado') { ferm += 0.5; fatores.push({ t: 'Notas de vinho/fermentado fora do perfil do grão', v: 0, processo: true }); }
      });
    } else {
      // sem grão cadastrado: leitura absoluta dos controles 1–5
      const ac = Number(brew.acidez) || 3, doc = Number(brew.docura) || 3, am = Number(brew.amargor) || 3;
      const corpo = Number(brew.corpo) || 3, fim = Number(brew.final) || 3;
      if (ac >= 4 && doc <= 2) { sub += 0.6; fatores.push({ t: 'Acidez alta com doçura baixa', v: -0.6 }); }
      if (am >= 4 && doc <= 2) { sobre += 0.6; fatores.push({ t: 'Amargor alto com doçura baixa', v: +0.6 }); }
      if (am >= 4 && ac <= 2) { sobre += 0.3; fatores.push({ t: 'Amargor domina a acidez', v: +0.3 }); }
      if (ac >= 4 && am <= 2 && doc <= 3) { sub += 0.3; fatores.push({ t: 'Acidez domina sem doçura', v: -0.3 }); }
      if (corpo <= 2 && fim <= 2) { sub += 0.3; forca -= 0.3; fatores.push({ t: 'Corpo leve e final curto', v: -0.3, forca: -0.3 }); }
      if (corpo >= 5 && am >= 4) { sobre += 0.2; forca += 0.3; fatores.push({ t: 'Muito corpo e amargor', v: +0.2, forca: +0.3 }); }
    }

    // tempo vs faixa do método
    const t = Number(brew.tempoS);
    if (t && method.tempoS && baseId(method) !== 'cold-brew') {
      const { min, max } = faixaTempo(method, brew.dose);
      const span = (max - min) || 1;
      if (t < min) { const dd = clamp((min - t) / span, 0, 1); sub += 0.5 * dd; fatores.push({ t: `Tempo ${fmtTempo(t)} abaixo da faixa (${fmtTempo(min)}–${fmtTempo(max)})`, v: -r2(0.5 * dd), tempo: -1 }); }
      if (t > max) { const dd = clamp((t - max) / span, 0, 1); sobre += 0.5 * dd; fatores.push({ t: `Tempo ${fmtTempo(t)} acima da faixa (${fmtTempo(min)}–${fmtTempo(max)})`, v: r2(0.5 * dd), tempo: +1 }); }
    }
    // EY / TDS
    const e = ey(brew, method);
    if (e != null) {
      const lo = isEspresso(method) ? 18 : 18.5, hi = isEspresso(method) ? 23 : 22.5;
      if (e < lo) { const dd = clamp((lo - e) / 3, 0, 1); sub += 0.7 * dd; fatores.push({ t: `EY ${e} % abaixo de ${lo} %`, v: -r2(0.7 * dd) }); }
      if (e > hi) { const dd = clamp((e - hi) / 3, 0, 1); sobre += 0.7 * dd; fatores.push({ t: `EY ${e} % acima de ${hi} %`, v: r2(0.7 * dd) }); }
    }
    const tds = Number(brew.tds);
    if (tds) {
      const lo = isEspresso(method) ? 8 : 1.2, hi = isEspresso(method) ? 12 : 1.5;
      if (tds < lo) { forca -= 0.5; fatores.push({ t: `TDS ${tds} % baixo`, v: 0, forca: -0.5 }); }
      if (tds > hi) { forca += 0.5; fatores.push({ t: `TDS ${tds} % alto`, v: 0, forca: +0.5 }); }
    }

    const indice = clamp((sobre - sub) / 1.6, -1, 1);
    forca = clamp(forca, -1, 1);
    let rotulo, cor;
    if (indice <= -0.55) { rotulo = 'Sub-extração clara'; cor = 'sub'; }
    else if (indice <= -0.2) { rotulo = 'Leve sub-extração'; cor = 'sub'; }
    else if (indice >= 0.55) { rotulo = 'Sobre-extração clara'; cor = 'sobre'; }
    else if (indice >= 0.2) { rotulo = 'Leve sobre-extração'; cor = 'sobre'; }
    else { rotulo = 'Extração equilibrada'; cor = 'ok'; }
    const misto = sub > 0.6 && sobre > 0.6;
    if (misto) { rotulo = 'Sub e sobre ao mesmo tempo (canal / moagem irregular)'; cor = 'misto'; }
    return { indice: r2(indice), forca: r2(forca), ferm, rotulo, cor, fatores, ey: e, misto, leitura };
  }

  /* ---------- Faixas de temperatura por torra ---------- */
  const FAIXA_TEMP = {
    filtro: { clara: [92, 97], 'media-clara': [91, 96], media: [89, 95], 'media-escura': [86, 93], escura: [84, 91] },
    espresso: { clara: [93, 96], 'media-clara': [92, 95], media: [91, 94], 'media-escura': [89, 93], escura: [88, 92] }
  };
  function faixaTemp(method, torraId) {
    const f = FAIXA_TEMP[isEspresso(method) ? 'espresso' : 'filtro'][torraId] || [88, 96];
    const a = Math.max(f[0], method.tempC.min), b = Math.min(f[1], method.tempC.max);
    return a <= b ? [a, b] : [method.tempC.min, method.tempC.max];
  }
  const PASSO_TEMPO_IMERSAO = { 'prensa-francesa': 45, clever: 30, aeropress: 20, 'cold-brew': 7200 };
  const NOME_VAR = { moagem: 'moagem', temperatura: 'temperatura', 'razão': 'razão', tempo: 'tempo de imersão' };
  function fmtVar(v, x) { return v === 'moagem' ? `${fmtClicks(x)} cliques` : v === 'temperatura' ? `${fmtN(x)} °C` : v === 'razão' ? `1:${fmtN(x)}` : fmtTempo(x); }

  /* O que mudou da extração anterior para esta, e o efeito na nota */
  function aprendizado(brew, prev, method) {
    if (!prev) return null;
    const num = (v) => (v == null || v === '' ? null : Number(v));
    const mud = [];
    if (num(prev.clicks) != null && num(brew.clicks) != null && num(prev.clicks) !== num(brew.clicks)) mud.push({ v: 'moagem', de: num(prev.clicks), para: num(brew.clicks) });
    if (baseId(method) !== 'cold-brew' && num(prev.tempC) != null && num(prev.tempC) !== num(brew.tempC)) mud.push({ v: 'temperatura', de: num(prev.tempC), para: num(brew.tempC) });
    if (num(prev.ratio) != null && Math.abs(num(prev.ratio) - (num(brew.ratio) || 0)) >= 0.05) mud.push({ v: 'razão', de: num(prev.ratio), para: num(brew.ratio) });
    if (tipoMetodo(method) === 'imersao' && num(prev.tempoS) && num(brew.tempoS) && Math.abs(prev.tempoS - brew.tempoS) >= 10) mud.push({ v: 'tempo', de: num(prev.tempoS), para: num(brew.tempoS) });
    mud.forEach((m) => { m.sentido = Math.sign(m.para - m.de); });
    const temNotas = prev.nota != null && prev.nota !== '' && brew.nota != null && brew.nota !== '';
    return { prev, mud, dn: temNotas ? r1(Number(brew.nota) - Number(prev.nota)) : 0 };
  }

  /* ---------- Recomendação para a próxima extração ----------
   * history: extrações anteriores do mesmo grão × método × moedor, em ordem
   * cronológica; brew: a atual (última). Cada ação traz o "porquê". */
  function recommend(brew, history, method, grinder, bean, opts) {
    opts = opts || {};
    history = history || [];
    const TS = faixaTempo(method, brew.dose);
    const temGrao = bean && (bean.id || bean.regiao || bean.torra);
    const diag = diagnose(brew, method, temGrao ? bean : null);
    const L = diag.leitura;
    const tipo = tipoMetodo(method);
    const torraId = temGrao && DB.torra[bean.torra] ? bean.torra : 'media';
    const torra = DB.torra[torraId];
    const tor = torra.nome.toLowerCase();
    const clara = torraId === 'clara' || torraId === 'media-clara';
    const escura = torraId === 'media-escura' || torraId === 'escura';
    const alvoNota = Number(opts.notaAlvo) || 8;
    const acoes = [];
    const add = (a) => { acoes.push(a); return a; };
    const temAcao = () => acoes.some((a) => a.tipo === 'principal' || a.tipo === 'secundario');
    // no máximo 2 mudanças de receita por vez; o resto vira alternativa
    const ALAVANCAS = ['moagem', 'temperatura', 'razão', 'tempo'];
    const efetivas = () => acoes.filter((a) => (a.tipo === 'principal' || a.tipo === 'secundario') && ALAVANCAS.includes(a.alvo)).length;
    const tipoLivre = () => (efetivas() >= 2 ? 'alternativa' : acoes.some((a) => a.tipo === 'principal') ? 'secundario' : 'principal');
    const original = {
      clicks: brew.clicks != null && brew.clicks !== '' ? Number(brew.clicks) : null,
      ratio: Number(brew.ratio), tempC: Number(brew.tempC), dose: Number(brew.dose), water: Number(brew.water),
      tempoS: tipo === 'imersao' && Number(brew.tempoS) ? Number(brew.tempoS) : TS.padrao
    };
    const prox = Object.assign({}, original);
    const step = grinder ? passoAjuste(grinder, method) : 1;
    const dirFino = grinder && grinder.direcao === 'maior=fino' ? +1 : -1;
    const prev = history.length ? history[history.length - 1] : null;
    if (prev && !prev.diag) prev.diag = diagnose(prev, method, temGrao ? bean : null);
    const score = Number(brew.nota) || 0;
    const sev = Math.abs(diag.indice);
    const niveis = sev < 0.4 ? 1 : sev < 0.7 ? 2 : (tipo === 'espresso' ? 2 : 3);
    const [tMin, tMax] = faixaTemp(method, torraId);
    const bloqueio = {};
    const usados = new Set();
    const t = Number(brew.tempoS) || 0;
    let status = 'ajustando';
    let confianca = 0.45 + Math.min(0.3, history.length * 0.1) + (brew.tds ? 0.1 : 0) + (L ? 0.05 : 0);
    const sintomas = diag.fatores.filter((f) => f.v).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 2).map((f) => minusc(f.t)).join('; ');

    /* ----- alavancas ----- */
    function moer(fino, passos, tipoA, por, comHistorico) {
      const efetiva = tipoA !== 'alternativa';
      if (usados.has('moagem') || (efetiva && bloqueio.moagem != null)) return false;
      if (!grinder || prox.clicks == null) {
        add({ alvo: 'moagem', tipo: tipoA, txt: `${fino ? 'Moa mais fino' : 'Moa mais grosso'} (${passos > 1 ? passos + ' ajustes' : '1 ajuste'})`, por: `${por} Cadastre o moedor e os cliques para receber o número exato.` });
        if (efetiva) usados.add('moagem');
        return true;
      }
      let mag = Math.max(Number(grinder.passo) || 1, passos * step);
      if (comHistorico && prev && prev.diag && prev.clicks != null && prev.clicks !== '' && Number(prev.clicks) !== prox.clicks) {
        const pi = prev.diag.indice, moved = Math.abs(Number(prev.clicks) - prox.clicks);
        if (Math.abs(pi) >= 0.2 && Math.sign(pi) !== Math.sign(diag.indice)) {
          const w = sev / (sev + Math.abs(pi) || 1);
          mag = Math.max(Number(grinder.passo) || 1, Math.abs((Number(prev.clicks) - prox.clicks) * w));
          confianca += 0.1;
          add({ alvo: 'nota', tipo: 'info', txt: `O ponto ideal de moagem está entre ${fmtClicks(prev.clicks)} e ${fmtClicks(prox.clicks)} cliques.`, por: `Com ${fmtClicks(prev.clicks)} cliques a xícara ficou do lado oposto (${prev.diag.rotulo.toLowerCase()}); por isso o ajuste agora é menor.` });
        } else if (Math.sign(pi) === Math.sign(diag.indice) && sev >= Math.abs(pi) - 0.1) {
          mag = Math.max(mag, Math.min(moved * 1.5, step * 4));
          add({ alvo: 'nota', tipo: 'info', txt: 'O último ajuste de moagem não foi suficiente.', por: `Você já tinha mudado ${fmtClicks(moved)} cliques e o problema continuou; o passo desta vez é maior.` });
        }
      }
      const novo = snap(grinder, prox.clicks + (fino ? dirFino : -dirFino) * mag);
      const delta = r2(novo - prox.clicks);
      if (!delta) return false;
      add({ alvo: 'moagem', tipo: tipoA, de: prox.clicks, para: novo, delta, txt: `${fino ? 'Moa mais fino' : 'Moa mais grosso'}: ${fmtClicks(prox.clicks)} → ${fmtClicks(novo)} cliques (${delta > 0 ? '+' : ''}${fmtClicks(delta)})`, por });
      if (efetiva) { prox.clicks = novo; usados.add('moagem'); }
      return true;
    }
    function temperatura(delta, tipoA, por) {
      const efetiva = tipoA !== 'alternativa';
      if (baseId(method) === 'cold-brew' || !prox.tempC) return false;
      if (usados.has('temperatura') || (efetiva && bloqueio.temperatura === Math.sign(delta))) return false;
      let nova;
      if (delta > 0) { if (prox.tempC >= tMax) return false; nova = Math.min(prox.tempC + delta, tMax); }
      else { if (prox.tempC <= tMin) return false; nova = Math.max(prox.tempC + delta, tMin); }
      nova = Math.round(nova * 2) / 2;
      if (nova === prox.tempC) return false;
      add({ alvo: 'temperatura', tipo: tipoA, de: prox.tempC, para: nova, delta: r1(nova - prox.tempC), txt: `Temperatura: ${fmtN(prox.tempC)} → ${fmtN(nova)} °C`, por });
      if (efetiva) { prox.tempC = nova; usados.add('temperatura'); }
      return true;
    }
    function razao(delta, tipoA, por) {
      const efetiva = tipoA !== 'alternativa';
      if (!prox.ratio) return false;
      if (usados.has('razão') || (efetiva && bloqueio['razão'] === Math.sign(delta))) return false;
      const nova = clamp(r2(prox.ratio + delta), method.ratio.min, method.ratio.max);
      if (nova === prox.ratio) return false;
      const vol = isEspresso(method) ? `bebida ${fmtN(r1(prox.dose * nova))} g` : `água ${Math.round(prox.dose * nova)} g`;
      add({ alvo: 'razão', tipo: tipoA, de: prox.ratio, para: nova, delta: r2(nova - prox.ratio), txt: `Razão: 1:${fmtN(prox.ratio)} → 1:${fmtN(nova)} (${vol} para ${fmtN(prox.dose)} g de café)`, por });
      if (efetiva) { prox.ratio = nova; usados.add('razão'); }
      return true;
    }
    function tempoImersao(deltaS, tipoA, por) {
      const efetiva = tipoA !== 'alternativa';
      if (usados.has('tempo') || (efetiva && bloqueio.tempo === Math.sign(deltaS))) return false;
      const base = prox.tempoS || TS.padrao, gr = baseId(method) === 'cold-brew' ? 1800 : 5;
      const novo = Math.round(clamp(base + deltaS, TS.min, TS.max * 1.25) / gr) * gr;
      if (novo === base) return false;
      add({ alvo: 'tempo', tipo: tipoA, de: base, para: novo, txt: `Tempo de imersão: ${fmtTempo(base)} → ${fmtTempo(novo)}`, por });
      if (efetiva) { prox.tempoS = novo; usados.add('tempo'); }
      return true;
    }
    const tecnica = (txt, por, tipoA) => add({ alvo: 'técnica', tipo: tipoA || 'info', txt, por });
    function maisExtracaoSuave(tipoA, por) {
      if (tipo === 'imersao') return tempoImersao(PASSO_TEMPO_IMERSAO[baseId(method)] || 30, tipoA, por) || moer(true, 1, tipoA, por);
      if (tipo === 'filtro' && !escura) return temperatura(1, tipoA, por) || moer(true, 1, tipoA, por);
      return moer(true, 1, tipoA, por);
    }

    /* ----- 1. aprendizado com a extração anterior ----- */
    const hl = aprendizado(brew, prev, method);
    if (hl && hl.mud.length && Math.abs(hl.dn) >= 1) {
      const nP = fmtN(Number(hl.prev.nota)), nB = fmtN(score);
      if (hl.mud.length === 1) {
        const m1 = hl.mud[0];
        const cruzou = m1.v === 'moagem' && hl.prev.diag && Math.abs(hl.prev.diag.indice) >= 0.2 && sev >= 0.2 && Math.sign(hl.prev.diag.indice) !== Math.sign(diag.indice);
        const efeito = m1.v === 'moagem' ? (m1.sentido === dirFino ? 1 : -1) : m1.sentido; // +1 = extrai mais
        const precisa = diag.indice <= -0.2 ? 1 : diag.indice >= 0.2 ? -1 : 0;
        if (hl.dn < 0 && !cruzou && precisa !== 0 && -efeito !== precisa) {
          add({ alvo: 'nota', tipo: 'info', txt: `A nota caiu de ${nP} para ${nB}, mas mudar a ${NOME_VAR[m1.v]} para ${fmtVar(m1.v, m1.para)} ia na direção certa.`, por: 'A queda deve ter outra causa; siga o ajuste abaixo.' });
        } else if (hl.dn < 0 && !cruzou) {
          bloqueio[m1.v] = m1.sentido;
          add({ alvo: m1.v, tipo: precisa !== 0 ? 'secundario' : 'principal', de: m1.para, para: m1.de, txt: `Volte a ${NOME_VAR[m1.v]} para ${fmtVar(m1.v, m1.de)}`, por: `Com ${fmtVar(m1.v, m1.de)} a nota foi ${nP}; ao mudar para ${fmtVar(m1.v, m1.para)} caiu para ${nB}. Essa direção não funcionou para este grão.` });
          if (m1.v === 'moagem') prox.clicks = m1.de; else if (m1.v === 'temperatura') prox.tempC = m1.de; else if (m1.v === 'razão') prox.ratio = m1.de; else prox.tempoS = m1.de;
          usados.add(m1.v);
          confianca += 0.1;
        } else if (hl.dn > 0) {
          add({ alvo: 'nota', tipo: 'info', txt: `Mudar a ${NOME_VAR[m1.v]} (${fmtVar(m1.v, m1.de)} → ${fmtVar(m1.v, m1.para)}) subiu a nota de ${nP} para ${nB}.`, por: 'Se a xícara ainda pedir, continue na mesma direção.' });
          confianca += 0.05;
        }
      } else {
        add({ alvo: 'nota', tipo: 'info', txt: `Você mudou ${hl.mud.map((m) => NOME_VAR[m.v]).join(', ')} ao mesmo tempo e a nota ${hl.dn > 0 ? 'subiu' : 'caiu'} ${fmtN(Math.abs(hl.dn))} ponto(s).`, por: 'Mudando uma variável por vez fica claro o que funciona para este grão.' });
      }
    }

    /* ----- 2. eixo de extração ----- */
    if (diag.misto) {
      tecnica('Melhore a distribuição do pó antes de mexer na receita', 'Sinais de sub e sobre ao mesmo tempo indicam canalização ou moagem irregular: nivele o leito, faça um bloom que molhe todo o pó e despeje mais baixo e suave.', 'principal');
      moer(false, 1, 'alternativa', 'Se o problema se repetir com boa distribuição, moa um pouco mais grosso para reduzir finos.');
    } else if (diag.indice <= -0.2) {
      const por = `A xícara pediu mais extração: ${sintomas}.`;
      if (tipo === 'filtro') {
        const ok = moer(true, niveis, tipoLivre(), por, true);
        if (clara) temperatura(ok ? Math.min(niveis, 2) : Math.max(1, niveis), tipoLivre(), `Torra ${tor} é mais densa e só solta os açúcares com mais energia${ok ? ': junto com a moagem, água mais quente completa o ajuste' : ''}.`);
        else if (!escura && (niveis >= 2 || !ok)) temperatura(1, tipoLivre(), `Numa torra ${tor}, 1 °C a mais completa o ajuste sem puxar amargor.`);
        else if (escura) tecnica('Alongue o bloom para 45–60 s e faça um despejo a mais', `Em torra ${tor}, subir a temperatura puxa amargor; prefira mais tempo de contato.`, ok ? 'info' : 'principal');
        if (t && t < TS.min) add({ alvo: 'nota', tipo: 'info', txt: `Tempo total ${fmtTempo(t)} abaixo da faixa do método (${fmtTempo(TS.min)}–${fmtTempo(TS.max)}).`, por: 'A água passou rápido demais pelo pó; a moagem mais fina deve trazer o tempo para a faixa.' });
      } else if (tipo === 'imersao') {
        const passoT = PASSO_TEMPO_IMERSAO[baseId(method)] || 30;
        let ok = false;
        if (!t || t < TS.max) ok = tempoImersao(passoT * niveis, tipoLivre(), `${por} Na imersão, o tempo de contato é a alavanca mais direta.`);
        if (!ok || niveis >= 2) moer(true, 1, tipoLivre(), ok ? 'Mais superfície de contato completa o ajuste.' : `${por} O tempo já está no limite do método; moa mais fino.`);
        if (clara) temperatura(1, tipoLivre(), `Torra ${tor} extrai melhor com água mais quente.`);
      } else if (tipo === 'espresso') {
        if (t && t >= TS.max) razao(0.2 * niveis, tipoLivre(), `O shot já correu ${t} s e ainda ficou com ${sintomas}. Moer mais fino pode travar a máquina; deixe correr mais bebida para extrair mais.`);
        else moer(true, niveis, tipoLivre(), `${por} Moer mais fino aumenta o tempo de contato (alvo ${TS.min}–${TS.max} s).`, true);
        if (clara) temperatura(1, tipoLivre(), `Torra ${tor} pede água mais quente no espresso.`);
      } else {
        moer(true, 1, tipoLivre(), por, true);
        tecnica('Coloque água já quente na base e use fogo médio, sem compactar o pó', 'Água fria na base aquece o pó antes de extrair e deixa a bebida ácida e rala.');
      }
    } else if (diag.indice >= 0.2) {
      const por = `A xícara passou do ponto: ${sintomas}.`;
      if (tipo === 'filtro') {
        const ok = moer(false, niveis, tipoLivre(), por, true);
        if (escura) temperatura(-Math.min(3, niveis + 1), tipoLivre(), `Torra ${tor} já é muito solúvel: água mais fria segura o amargor.`);
        else if (!clara && (niveis >= 2 || !ok)) temperatura(-1, tipoLivre(), `Numa torra ${tor}, 1 °C a menos ajuda a segurar o amargor.`);
        else if (clara && prox.tempC > 95) temperatura(-1, tipoLivre(), `${fmtN(prox.tempC)} °C é quente até para torra ${tor}.`);
        if (niveis >= 2 || (t && t > TS.max)) tecnica('Despeje mais baixo e suave, com menos pulsos e sem swirl no final', 'Agitação extra também puxa amargor e leva finos para o fundo, travando a drenagem.');
        if (t && t > TS.max) add({ alvo: 'nota', tipo: 'info', txt: `Tempo total ${fmtTempo(t)} acima da faixa do método (${fmtTempo(TS.min)}–${fmtTempo(TS.max)}).`, por: 'A moagem mais grossa deve trazer a drenagem para a faixa.' });
      } else if (tipo === 'imersao') {
        const passoT = PASSO_TEMPO_IMERSAO[baseId(method)] || 30;
        let ok = false;
        if (!t || t > TS.min) ok = tempoImersao(-passoT * niveis, tipoLivre(), `${por} Menos tempo de contato é a correção mais direta na imersão.`);
        if (!ok || niveis >= 2) moer(false, 1, tipoLivre(), ok ? 'Moagem mais grossa reduz finos e adstringência.' : `${por} O tempo já está no mínimo do método; moa mais grosso.`);
        if (escura) temperatura(-2, tipoLivre(), `Torra ${tor} extrai rápido; água mais fria segura o amargor.`);
        if (baseId(method) === 'prensa-francesa') tecnica('Retire a espuma, pressione só até a superfície e sirva logo', 'O café continua extraindo enquanto fica na prensa.');
      } else if (tipo === 'espresso') {
        if (t && t <= TS.min) razao(-0.2 * niveis, tipoLivre(), `O shot foi rápido (${t} s) e mesmo assim ficou com ${sintomas}: corte a bebida mais cedo.`);
        else moer(false, niveis, tipoLivre(), `${por} Moer mais grosso encurta o tempo de contato (alvo ${TS.min}–${TS.max} s).`, true);
        if (escura) temperatura(-1, tipoLivre(), `Torra ${tor} pede água um pouco mais fria no espresso.`);
      } else {
        moer(false, 1, tipoLivre(), por, true);
        tecnica('Tire do fogo assim que o café começar a clarear e resfrie a base', 'O final da extração da moka é o que mais traz amargor.');
      }
    }

    /* ----- 3. notas de fermentação ----- */
    if (diag.ferm) {
      const proc = L && L.esperado.proc ? L.esperado.proc.nome.split(' (')[0].toLowerCase() : 'do lote';
      temperatura(-2, tipoLivre(), `As notas de fermentado/álcool vêm do processo (${proc}), não da moagem: água mais fria deixa a xícara mais limpa.`);
      if (!isPressao(method)) razao(tipo === 'espresso' ? 0.2 : 0.5, tipoLivre(), 'Um pouco mais de água dilui a intensidade fermentada.');
    }

    /* ----- 4. força (corpo) → razão ----- */
    if (Math.abs(diag.forca) >= 0.3) {
      const explicita = (brew.sinais || []).some((s) => s === 'fraco' || s === 'forte');
      const tipoA = explicita || sev < 0.5 ? tipoLivre() : 'alternativa';
      const fraco = diag.forca < 0;
      const corpoTxt = L ? `Corpo ${fmtN(L.percebido.corpo)} ${fraco ? 'abaixo' : 'acima'} do esperado (${fmtN(L.esperado.corpo)}) para este grão no método ${method.nome.split(' (')[0]}` : (fraco ? 'Xícara fraca/diluída' : 'Xícara intensa demais');
      if (tipo === 'moka') tecnica(fraco ? 'Encha o funil até a borda, nivelado e sem compactar' : 'Dilua na xícara com um pouco de água quente', `${corpoTxt}. Na moka a razão é fixada pelo funil.`);
      else {
        const forte = Math.abs(diag.forca) >= 0.6;
        const d = tipo === 'espresso' ? (forte ? 0.3 : 0.2) : baseId(method) === 'cold-brew' ? 1 : (forte ? 1 : 0.5);
        razao(fraco ? -d : d, tipoA, `${corpoTxt}. ${fraco ? 'Menos água por grama de café encorpa a xícara' : 'Mais água por grama de café deixa a xícara mais leve'} sem mudar a extração.${tipoA === 'alternativa' ? ' Faça isso depois de corrigir a extração.' : ''}`);
      }
    }

    /* ----- 5. ajuste de perfil (extração no ponto, sabor ainda longe do grão) ----- */
    if (!diag.misto && sev < 0.2 && L) {
      const E = L.esperado, P = L.percebido, d = L.desvio;
      const perfilGrao = `${E.reg.id !== 'outra' ? E.reg.nome : 'este grão'}${E.proc ? ' ' + E.proc.nome.split(' (')[0].toLowerCase() : ''} de torra ${tor}`;
      const doDef = -d.docura, acExc = d.acidez, acDef = -d.acidez, amExc = d.amargor;
      const brilhante = E.acidez >= 3.5 || E.familias.includes('fruta') || E.familias.includes('floral');
      const faltaFruta = L.notasFaltando.some((f) => f === 'fruta' || f === 'floral');
      const cands = [];
      if (doDef >= 1 && acExc < 1 && amExc < 1) cands.push({ peso: doDef, f: (tA) => maisExtracaoSuave(tA, `Doçura ${fmtN(P.docura)} abaixo do que ${perfilGrao} costuma entregar (${fmtN(E.docura)}), sem acidez nem amargor sobrando: dá para extrair mais açúcares antes do amargor aparecer.`) });
      if (acExc >= 1 && doDef < 1) cands.push({ peso: acExc * 0.9, f: (tA) => razao(tipo === 'espresso' ? -0.2 : -0.5, tA, `Acidez ${fmtN(P.acidez)} mais viva que o perfil de ${perfilGrao} (${fmtN(E.acidez)}), com boa doçura: um pouco mais de corpo arredonda a acidez.`) });
      if (brilhante && amExc < 1 && (acDef >= 1.5 || (acDef >= 1 && faltaFruta))) cands.push({ peso: acDef, f: (tA) => {
        const ok = razao(tipo === 'espresso' ? 0.3 : 0.5, tA, `Acidez ${fmtN(P.acidez)} abaixo do potencial de ${perfilGrao} (${fmtN(E.acidez)}${E.notas.length ? '; notas esperadas: ' + E.notas.slice(0, 3).join(', ') : ''}): uma xícara um pouco mais diluída e limpa abre a acidez e a fruta.`);
        if (ok && tipo === 'filtro') moer(false, 1, 'alternativa', 'Outra forma de ganhar clareza: moagem 1 ajuste mais grossa com 1 °C a mais mantém a extração e reduz o corpo que mascara a acidez.');
        return ok;
      } });
      if (L.notasFaltando.some((f) => f === 'doce' || f === 'chocolate') && L.familiasPercebidas.includes('fruta') && acExc >= 0.5) {
        const esperadas = E.notas.filter((n) => ['doce', 'chocolate'].includes(familia(n))).slice(0, 2).join(' e ') || 'caramelo/chocolate';
        cands.push({ peso: 1, f: (tA) => maisExtracaoSuave(tA, `Você sentiu fruta ácida, mas não o ${esperadas} esperado deste grão: esses sabores saem mais tarde na extração.`) });
      }
      if (Math.abs(d.corpo) >= 1 && Math.abs(diag.forca) < 0.3) cands.push({ peso: Math.abs(d.corpo) * 0.8, f: (tA) => razao((d.corpo < 0 ? -1 : 1) * (tipo === 'espresso' ? 0.2 : 0.5), tA, `Corpo ${fmtN(P.corpo)} ${d.corpo < 0 ? 'abaixo' : 'acima'} do esperado (${fmtN(E.corpo)}) para este grão no método ${method.nome.split(' (')[0]}.`) });
      cands.sort((a, b) => b.peso - a.peso);
      let n = 0;
      for (const c of cands) { if (n >= 2) break; if (c.f(tipoLivre())) n++; }
    }

    /* ----- 6. sem nada a corrigir ----- */
    if (!temAcao() && !diag.misto) {
      if (score >= alvoNota) {
        status = 'calibrado';
        acoes.unshift({ alvo: 'ok', tipo: 'principal', txt: `Receita calibrada: repita ${fmtReceita(prox, method)}`, por: L ? `Nota ${fmtN(score)} e xícara dentro do perfil esperado deste grão.` : `Nota ${fmtN(score)} e extração equilibrada.` });
      } else if (score > 0 && L) {
        const E = L.esperado;
        const brilhante = E.acidez >= 3.5 || E.familias.includes('fruta') || E.familias.includes('floral');
        const por0 = `A xícara bate com o perfil esperado, mas a nota ficou em ${fmtN(score)}.`;
        if (brilhante) razao(tipo === 'espresso' ? 0.2 : 0.5, 'principal', `${por0} Num grão de perfil vivo${E.notas.length ? ' (' + E.notas.slice(0, 3).join(', ') + ')' : ''}, vale testar uma xícara mais limpa, que realça acidez e fruta. Mude só isso e compare.`);
        else razao(tipo === 'espresso' ? -0.2 : -0.5, 'principal', `${por0} Num grão de perfil doce/achocolatado${E.notas.length ? ' (' + E.notas.slice(0, 3).join(', ') + ')' : ''}, vale testar mais corpo e doçura. Mude só isso e compare.`);
        if (!temAcao()) acoes.unshift({ alvo: 'ok', tipo: 'principal', txt: 'Repita a receita e avalie com calma', por: `${por0} Registre acidez, doçura, amargor e as notas que sentir para o próximo ajuste ser mais preciso.` });
      } else if (score > 0) {
        acoes.unshift({ alvo: 'ok', tipo: 'principal', txt: 'Repita a receita e avalie com calma', por: 'Cadastre o grão com região, processo e torra para o app comparar a xícara com o perfil esperado.' });
      } else {
        acoes.unshift({ alvo: 'ok', tipo: 'principal', txt: 'Extração equilibrada: repita a receita e dê uma nota', por: 'Com a nota o app confirma a calibração.' });
      }
    }

    /* ----- 7. você gostou: respeita a nota ----- */
    if (status !== 'calibrado' && score >= alvoNota && sev < 0.4 && !diag.misto && !diag.ferm) {
      acoes.forEach((a) => { if (a.tipo === 'principal' || a.tipo === 'secundario') a.tipo = 'alternativa'; });
      Object.assign(prox, original);
      status = 'calibrado';
      acoes.unshift({ alvo: 'ok', tipo: 'principal', txt: `Receita calibrada: repita ${fmtReceita(prox, method)}`, por: `Nota ${fmtN(score)}: você gostou. As sugestões abaixo são só para explorar, uma de cada vez.` });
    }

    /* ----- 8. contexto: descanso do grão e tempo do espresso ----- */
    if (temGrao && bean.dataTorra) {
      const dias = Math.floor((Date.now() - new Date(bean.dataTorra).getTime()) / 86400000);
      const faixa = torra.descansoDias[isPressao(method) ? 'espresso' : 'filtrado'];
      if (dias >= 0 && dias < faixa[0]) add({ alvo: 'nota', tipo: 'info', txt: `Grão com ${dias} dia(s) de torra, ainda liberando gás.`, por: `O ideal nesta torra é ${faixa[0]}–${faixa[1]} dias. Até lá a xícara varia de um dia para o outro; bloom mais longo ajuda.` });
      else if (dias > faixa[1] * 2) add({ alvo: 'nota', tipo: 'info', txt: `Grão com ${dias} dias de torra: aromas já em queda.`, por: 'Se a xícara estiver sem vida mesmo equilibrada, é o grão; moer um pouco mais fino e 1 °C a mais compensam.' });
    }
    if (tipo === 'espresso' && t && (t < TS.min || t > TS.max) && sev < 0.2) {
      add({ alvo: 'nota', tipo: 'info', txt: `Tempo ${t} s fora da faixa (${TS.min}–${TS.max} s), mas a xícara está boa.`, por: `Priorize o sabor. Para padronizar, ${t < TS.min ? 'feche' : 'abra'} ${fmtClicks(step)} clique(s) e reavalie.` });
    }

    // leitura resumida da xícara
    let leitura = '';
    if (L) {
      const partes = ATRIBUTOS.filter(([k]) => Math.abs(L.desvio[k]) >= 1).map(([k, nome]) => `${nome} ${L.percebido[k]} (${k === 'docura' ? 'alvo' : 'esperado'} ${fmtN(L.esperado[k])})`);
      leitura = partes.length ? `${partes.join(' · ')}: ${diag.rotulo.toLowerCase()}.` : `Xícara dentro do perfil esperado para este grão: ${diag.rotulo.toLowerCase()}.`;
      if (L.notasFaltando.length) leitura += ` Faltaram notas de ${juntar(L.notasFaltando.map((f) => NOME_FAMILIA[f]))}.`;
    }

    const ordem = { principal: 0, secundario: 1, info: 2, alternativa: 3 };
    acoes.forEach((a, i) => { a.tipo = a.tipo || 'info'; a._i = i; });
    acoes.sort((a, b) => (ordem[a.tipo] - ordem[b.tipo]) || (a._i - b._i));
    acoes.forEach((a) => { delete a._i; });
    prox.water = isEspresso(method) ? r1(prox.dose * prox.ratio) : Math.round(prox.dose * prox.ratio);
    const deltaClicks = prox.clicks != null && original.clicks != null ? r2(prox.clicks - original.clicks) : 0;
    return { diag, acoes, prox, status, confianca: r2(clamp(confianca, 0, 0.95)), deltaClicks, leitura, esperado: L ? L.esperado : null };
  }

  /* ---------- Receita de despejos escalada para dose × água ---------- */
  /* Tempos das etapas valem para a dose padrão (10 g); nos filtrados escalam
   * junto com a faixa de tempo. A etapa final de drenagem recebe o alvo. */
  function receita(method, dose, water) {
    const r = DB.receitas[method.id] || (method.base && DB.receitas[method.base]);
    if (!r || !r.etapas || !r.etapas.length) return null;
    const d = Number(dose) || method.dosePadrao;
    const total = Number(water) || Math.round(d * method.ratio.padrao);
    const filtro = tipoMetodo(method) === 'filtro';
    const ref = Number(method.dosePadrao) || 10;
    const f = filtro && d !== ref ? clamp(Math.pow(d / ref, 0.4), 0.5, 1.8) : 1;
    const TS = faixaTempo(method, d);
    let prev = 0;
    const etapas = r.etapas.map((e, i, arr) => {
      const acumulado = isEspresso(method) ? r1(total * e.agua) : Math.round(total * e.agua);
      const despejo = Math.max(0, Math.round((acumulado - prev) * 10) / 10);
      prev = acumulado;
      const t = f === 1 || !e.t ? e.t : Math.round((e.t * f) / 5) * 5;
      const dren = filtro && i === arr.length - 1 && i > 0 && e.agua >= 1 && arr[i - 1].agua >= 1;
      return { n: i + 1, t, acumulado, despejo, desc: dren ? `${e.desc} Alvo de término: ${fmtTempo(TS.min)}–${fmtTempo(TS.max)}.` : e.desc };
    });
    return { nome: r.nome, etapas, total };
  }

  /* ---------- Estado de calibração de um grão ---------- */
  function calibration(brews, opts) {
    opts = opts || {};
    const alvo = Number(opts.notaAlvo) || 8;
    const n = brews ? brews.length : 0;
    if (!n) return { tentativas: 0, status: 'novo', melhor: null };
    const melhor = brews.reduce((a, b) => (Number(b.nota) || 0) > (Number(a.nota) || 0) ? b : a, brews[0]);
    const ultimo = brews[n - 1];
    const ok = ultimo.diag && Math.abs(ultimo.diag.indice) < 0.2 && (Number(ultimo.nota) || 0) >= alvo;
    const firstAlvo = brews.findIndex(b => (Number(b.nota) || 0) >= alvo && b.diag && Math.abs(b.diag.indice) < 0.2);
    return { tentativas: n, status: ok ? 'calibrado' : 'ajustando', melhor, tentativasAteCalibrar: firstAlvo >= 0 ? firstAlvo + 1 : null };
  }

  /* ---------- Aptidão grão × método (escolha pelo método) ----------
   * Pontua o quanto um grão combina com um método a partir do terroir, da
   * torra, do perfil (acidez/corpo/doçura), das notas, do processo, do
   * descanso e do histórico real. Devolve os motivos que pesaram. */
  const ESTILO = { v60: 'conico', origami: 'conico', suiren: 'conico', chemex: 'conico', kalita: 'plano', b75: 'plano', melitta: 'plano', 'coador-pano': 'pano', clever: 'imersaoFiltro', aeropress: 'imersaoFiltro', 'prensa-francesa': 'prensa', espresso: 'espresso', moka: 'moka', 'cold-brew': 'cold' };
  const TORRA_FIT = {
    conico: { clara: 2, 'media-clara': 1.5, media: 0.5, 'media-escura': -1, escura: -2 },
    plano: { clara: 1, 'media-clara': 1.5, media: 1, 'media-escura': 0, escura: -1 },
    pano: { clara: -0.5, 'media-clara': 0.5, media: 1, 'media-escura': 1, escura: 0.5 },
    imersaoFiltro: { clara: 1, 'media-clara': 1, media: 1, 'media-escura': 0.5, escura: 0 },
    prensa: { clara: -0.5, 'media-clara': 0.5, media: 1, 'media-escura': 1.5, escura: 1 },
    espresso: { clara: -1, 'media-clara': 0.5, media: 1.5, 'media-escura': 1.5, escura: 0.5 },
    moka: { clara: -1.5, 'media-clara': -0.5, media: 1, 'media-escura': 1.5, escura: 1.5 },
    cold: { clara: -0.5, 'media-clara': 0.5, media: 1, 'media-escura': 1.5, escura: 1 }
  };
  const FERMENTADOS = ['anaerobico', 'fermentacao-induzida'];
  function aptidao(bean, method, opts) {
    opts = opts || {};
    const b = bean || {};
    const reg = DB.regiao[b.regiao] || DB.regiao.outra;
    const torraId = DB.torra[b.torra] ? b.torra : 'media';
    const tor = DB.torra[torraId].nome.toLowerCase();
    const est = ESTILO[baseId(method)] || 'plano';
    const nomeM = method.curto || method.nome.split(' (')[0];
    const ac = Number(b.acidez) || reg.acidez || 3, co = Number(b.corpo) || reg.corpo || 3, doc = Number(b.docura) || reg.docura || 3;
    const canephora = b.especie === 'canephora' || reg.id === 'conilon-capixaba' || reg.id === 'rondonia';
    const fams = [...new Set(((b.notas && b.notas.length ? b.notas : reg.notas) || []).map(familia).filter(Boolean))];
    const frutaFloral = fams.includes('fruta') || fams.includes('floral');
    const chocoDoce = fams.includes('chocolate') || fams.includes('doce');
    const motivos = [];
    let score = 0;
    const m = (v, t) => { if (!v) return; score += v; motivos.push({ v, t }); };

    if (reg.id !== 'outra' && (reg.metodos || []).some((id) => id === method.id || id === baseId(method))) m(1.5, `Indicado para o terroir ${reg.nome}`);
    const tf = TORRA_FIT[est][torraId] || 0;
    if (tf >= 1) m(tf, `Torra ${tor} combina com ${nomeM}`);
    else if (tf <= -1) m(tf, `Torra ${tor} pede cuidado em ${nomeM}`);
    else if (tf) score += tf;

    if (est === 'conico') {
      if (ac >= 4) m(1.5, 'Acidez alta brilha na clareza do filtro cônico');
      if (frutaFloral) m(1, 'Notas frutadas/florais ficam nítidas');
      if (co >= 4 && ac <= 2 && method.id !== 'origami') m(-1, 'Perfil encorpado e pouco ácido perde graça no cônico');
      if (FERMENTADOS.includes(b.processo)) m(0.5, 'Fermentado com xícara limpa e definida');
      // Particularidades do Origami
      if (method.id === 'origami') {
        if (FERMENTADOS.includes(b.processo)) m(0.5, 'As 20 caneluras ventilam o papel e destacam aromas exóticos sem pesar');
        if (doc >= 4 && (torraId === 'media' || torraId === 'media-clara')) m(0.5, 'Versátil: aceita filtro cônico (clareza) ou Kalita Wave (doçura e corpo)');
      }
      // Particularidades da Hario Suiren
      if (method.id === 'suiren') {
        if ((torraId === 'clara' || torraId === 'media-clara') && frutaFloral) m(1, 'As 12 pétalas abertas esfriam o final da extração e preservam florais delicados');
        if (FERMENTADOS.includes(b.processo)) m(0.5, 'Queda térmica natural no terço final evita notas alcoólicas/boozy');
        if (torraId === 'media-escura' || torraId === 'escura' || (co >= 4 && ac <= 2)) m(-1, 'Dissipação de calor das aletas abertas deixa torras escuras ou cafés pesados sub-extraídos');
      }
    } else if (est === 'plano') {
      if (doc >= 4) m(1, 'Doçura alta: o fundo plano valoriza o equilíbrio');
      if (frutaFloral && ac >= 3) m(0.5, 'Extração uniforme preserva as notas de fruta');
    } else if (est === 'pano') {
      if (co >= 4) m(1, 'O pano passa óleos e reforça o corpo');
      if (chocoDoce) m(0.5, 'Notas de chocolate/caramelo ganham textura');
    } else if (est === 'imersaoFiltro') {
      if (FERMENTADOS.includes(b.processo)) m(1, 'Fermentados ficam doces e redondos na imersão');
      if (doc >= 4) m(0.5, 'Imersão entrega doçura com pouca técnica');
    } else if (est === 'prensa') {
      if (co >= 4) m(1.5, 'Corpo alto combina com a textura da prensa');
      if (chocoDoce) m(0.5, 'Chocolate e nozes aparecem bem na imersão longa');
      if (ac >= 4 && fams.includes('floral')) m(-1, 'Florais delicados se perdem no corpo pesado');
    } else if (est === 'espresso') {
      if (co >= 4) m(1, 'Corpo alto sustenta o espresso e o leite');
      if (chocoDoce) m(1, 'Chocolate/caramelo: perfil clássico de espresso');
      if (ac >= 4) m(-0.5, 'Acidez alta pode ficar agressiva: use razão mais longa');
    } else if (est === 'moka') {
      if (co >= 4) m(1, 'Corpo alto combina com a moka');
      if (chocoDoce) m(0.5, 'Notas de chocolate resistem bem ao calor da moka');
      if (ac >= 4) m(-1, 'Acidez alta tende a ficar áspera na moka');
    } else if (est === 'cold') {
      if (chocoDoce) m(1, 'Chocolate/caramelo ficam doces no cold brew');
      if (fams.includes('fruta') && b.processo === 'natural') m(0.5, 'Naturais frutados rendem cold brew licoroso');
      if (fams.includes('floral')) m(-1, 'Florais quase somem na extração a frio');
    }
    if (canephora) m(['espresso', 'moka', 'cold'].includes(est) ? 1.5 : est === 'conico' ? -1.5 : 0, ['espresso', 'moka', 'cold'].includes(est) ? 'Canephora: corpo e crema no método certo' : 'Canephora fica amargo e sem doçura no cônico');
    if (FERMENTADOS.includes(b.processo) && est === 'espresso') m(-0.5, 'Fermentados podem ficar alcoólicos no espresso');

    // descanso desde a torra
    if (b.dataTorra) {
      const dias = Math.floor((Date.now() - new Date(b.dataTorra).getTime()) / 86400000);
      const faixa = DB.torra[torraId].descansoDias[isPressao(method) ? 'espresso' : 'filtrado'];
      if (dias >= 0 && dias < faixa[0]) m(-0.5, `Só ${dias} dia(s) de torra: ainda desgaseificando`);
      else if (dias >= faixa[0] && dias <= faixa[1]) m(0.5, `No ponto de descanso (${dias} dias de torra)`);
      else if (dias > faixa[1] * 2) m(-0.5, `${dias} dias de torra: já passou do pico`);
    }
    // histórico real deste grão neste método
    const hist = opts.historico || [];
    let melhor = null;
    if (hist.length) {
      melhor = hist.reduce((a, x) => ((Number(x.nota) || 0) > (Number(a.nota) || 0) ? x : a), hist[0]);
      const cal = calibration(hist, opts);
      const mn = Number(melhor.nota) || 0;
      if (cal.status === 'calibrado') m(2, `Já calibrado aqui (melhor nota ${fmtN(mn)})`);
      else if (mn >= 8) m(1, `Já tirou nota ${fmtN(mn)} neste método`);
      else if (mn && mn < 6 && hist.length >= 2) m(-0.5, `Notas baixas até agora (melhor ${fmtN(mn)})`);
    }
    const r = Math.round(score * 10) / 10;
    const nivel = r >= 4.5 ? 'otimo' : r >= 2.5 ? 'bom' : r >= 0.5 ? 'possivel' : 'pouco';
    motivos.sort((a, x) => x.v - a.v);
    return { score: r, nivel, rotulo: { otimo: 'Ótima escolha', bom: 'Boa escolha', possivel: 'Funciona', pouco: 'Pouco indicado' }[nivel], motivos, tentativas: hist.length, melhor };
  }

  /* ---------- formatação ---------- */
  function fmtTempo(s) {
    s = Math.round(Number(s) || 0);
    if (s >= 3600) return `${(s / 3600).toFixed(1)} h`;
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60), r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }
  function fmtClicks(c) { c = Number(c); return Number.isInteger(c) ? String(c) : c.toFixed(2).replace(/\.?0+$/, ''); }
  function fmtReceita(p, method) {
    const parts = [];
    if (p.clicks != null) parts.push(`${fmtClicks(p.clicks)} cliques`);
    parts.push(`${fmtN(p.dose)} g → ${isEspresso(method) ? fmtN(p.water) + ' g de bebida' : p.water + ' g de água'} (1:${fmtN(p.ratio)})`);
    if (baseId(method) !== 'cold-brew') parts.push(`${fmtN(p.tempC)} °C`);
    return parts.join(' · ');
  }

  return { baseId, faixaTempo, aptidao, startingPoint, diagnose, recommend, calibration, ey, receita, clicksForMethod, passoAjuste, snap, fmtTempo, fmtClicks, fmtReceita, fmtN, isEspresso, isPressao, tipoMetodo, perfilEsperado, leituraSensorial, familia, ATRIBUTOS };
})();
