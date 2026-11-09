/* =====================================================================
 * Laboratório de Cafeteria — Pingo, o mascote
 * Uma xícara com olhos, braços e vapor. A expressão muda conforme a
 * cafeína no corpo, a nota da extração, o timer e o treino de latte art.
 * ===================================================================== */
(function () {
  'use strict';
  const INK = '#3b2a1e', CUP = '#fbf3e8', CUP2 = '#efe0cc', CAFE = '#8a5a36', CREMA = '#c89468', BLUSH = '#f2a38c';

  const OLHOS = {
    normal: (x) => `<g class="m-eye"><ellipse cx="${x}" cy="64" rx="4.6" ry="6" fill="${INK}"/><circle cx="${x + 1.6}" cy="61.6" r="1.7" fill="#fff"/></g>`,
    feliz: (x) => `<path d="M${x - 5} 65 Q${x} 58 ${x + 5} 65" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    sono: (x) => `<path d="M${x - 5} 64 H${x + 5}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M${x - 5} 64 Q${x} 68 ${x + 5} 64" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    fechado: (x) => `<path d="M${x - 5} 63 Q${x} 68 ${x + 5} 63" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    arregalado: (x) => `<g class="m-eye"><circle cx="${x}" cy="63" r="6.5" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cx="${x}" cy="63" r="2.2" fill="${INK}"/></g>`,
    triste: (x, lado) => `<g class="m-eye"><ellipse cx="${x}" cy="65" rx="4.2" ry="5.4" fill="${INK}"/><circle cx="${x + 1.4}" cy="63" r="1.5" fill="#fff"/></g><path d="M${x - 6} ${lado < 0 ? 55 : 57} L${x + 6} ${lado < 0 ? 57 : 55}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
    olhandoCima: (x) => `<g class="m-eye"><ellipse cx="${x}" cy="64" rx="4.6" ry="6" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="${x + 1.5}" cy="60.8" r="2.6" fill="${INK}"/></g>`,
    enjoado: (x, lado) => `<path d="M${x - 5} ${lado < 0 ? 60 : 66} L${x + 4} 63 L${x - 5} ${lado < 0 ? 66 : 60}" transform="${lado > 0 ? `translate(${2 * x} 0) scale(-1 1)` : ''}" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    estrela: (x) => `<path d="M${x} 57 L${x + 1.9} 61.6 L${x + 6.6} 62 L${x + 3} 65.2 L${x + 4.1} 70 L${x} 67.4 L${x - 4.1} 70 L${x - 3} 65.2 L${x - 6.6} 62 L${x - 1.9} 61.6 Z" fill="${INK}"/>`
  };
  const BOCAS = {
    sorriso: `<path d="M53 76 Q60 83 67 76" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    aberta: `<path d="M52 75 Q60 88 68 75 Z" fill="${INK}"/><path d="M55.5 80.5 Q60 84 64.5 80.5" fill="${BLUSH}"/>`,
    o: `<ellipse cx="60" cy="79" rx="3.4" ry="4" fill="${INK}"/>`,
    ozinho: `<ellipse cx="60" cy="79" rx="2" ry="2.3" fill="${INK}"/>`,
    reta: `<path d="M55 79 H65" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
    triste: `<path d="M53 81 Q60 75 67 81" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    zigue: `<path d="M51 79 L55 76 L58 80 L62 76 L65 80 L69 77" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    enjoo: `<path d="M51 80 Q54 76 57 80 Q60 84 63 80 Q66 76 69 80" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M57 81 Q60 88 63 81" fill="#e9848a" stroke="${INK}" stroke-width="1.6"/>`,
    lado: `<path d="M55 79 Q62 81 66 76" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`
  };
  const BRACO = { // [caminho, mão x, mão y]
    baixoE: ['M31 66 Q20 74 21 86', 21, 86], cimaE: ['M30 62 Q17 50 16 36', 16, 36], queixoE: ['M31 70 Q40 90 52 84', 52, 84], acenoE: ['M30 63 Q14 58 12 44', 12, 44],
    baixoD: ['M87 80 Q99 88 102 96', 102, 96], cimaD: ['M88 62 Q102 50 104 36', 104, 36], acenoD: ['M88 64 Q106 60 108 44', 108, 44], polegarD: ['M87 76 Q100 76 104 66', 104, 66]
  };
  const HUMORES = {
    feliz: { olhos: 'normal', boca: 'sorriso', be: 'baixoE', bd: 'acenoD', anim: 'm-bob m-wave', vapor: 2, blush: true },
    radiante: { olhos: 'feliz', boca: 'aberta', be: 'cimaE', bd: 'cimaD', anim: 'm-jump', vapor: 3, blush: true, brilho: true },
    orgulhoso: { olhos: 'estrela', boca: 'aberta', be: 'baixoE', bd: 'polegarD', anim: 'm-bob', vapor: 3, blush: true, brilho: true },
    torcendo: { olhos: 'arregalado', boca: 'aberta', be: 'acenoE', bd: 'acenoD', anim: 'm-cheer', vapor: 2, blush: true },
    pensativo: { olhos: 'olhandoCima', boca: 'lado', be: 'queixoE', bd: 'baixoD', anim: 'm-tilt', vapor: 1 },
    surpreso: { olhos: 'arregalado', boca: 'o', be: 'cimaE', bd: 'cimaD', anim: 'm-pop', vapor: 2 },
    sonolento: { olhos: 'sono', boca: 'ozinho', be: 'baixoE', bd: 'baixoD', anim: 'm-sway', vapor: 1, zzz: true },
    dormindo: { olhos: 'fechado', boca: 'ozinho', be: 'baixoE', bd: 'baixoD', anim: 'm-sway', vapor: 0, zzz: true },
    agitado: { olhos: 'arregalado', boca: 'zigue', be: 'cimaE', bd: 'cimaD', anim: 'm-shake', vapor: 4, suor: true },
    enjoado: { olhos: 'enjoado', boca: 'enjoo', be: 'queixoE', bd: 'baixoD', anim: 'm-shake-leve', vapor: 0, tremor: true },
    triste: { olhos: 'triste', boca: 'triste', be: 'baixoE', bd: 'baixoD', anim: 'm-droop', vapor: 1, lagrima: true }
  };

  const PINGO_ESTAGIOS = [
    { tier: 1, minLevel: 1, nivelMinimo: 1, name: 'Pingo Curioso', titulo: 'Pingo Curioso', subtitle: 'Vapor Clássico de Bancada', acessorio: 'Vapor Clássico de Bancada', perk: 'Começando a jornada sensorial e aprendendo a ler acidez, doçura e corpo.', descricao: 'Começando a jornada sensorial e aprendendo a ler acidez, doçura e corpo.' },
    { tier: 2, minLevel: 3, nivelMinimo: 3, name: 'Pingo de Bancada', titulo: 'Pingo de Bancada', subtitle: 'Avental Artesanal de Barista', acessorio: 'Avental Artesanal de Barista', perk: 'Já domina a relação entre cliques do moedor, razão e tempo de escoamento.', descricao: 'Já domina a relação entre cliques do moedor, razão e tempo de escoamento.' },
    { tier: 3, minLevel: 6, nivelMinimo: 6, name: 'Pingo Alquimista', titulo: 'Pingo Alquimista', subtitle: 'Óculos de Precisão + Avental', acessorio: 'Óculos de Precisão + Avental', perk: 'Calibra granulometria por bissecção e controla temperatura por nível de torra.', descricao: 'Calibra granulometria por bissecção e controla temperatura por nível de torra.' },
    { tier: 4, minLevel: 12, nivelMinimo: 12, name: 'Pingo Mestre de Torra', titulo: 'Pingo Mestre de Torra', subtitle: 'Boina de Torrador + Medalha de Ouro', acessorio: 'Boina de Torrador + Medalha de Ouro', perk: 'Extrai o potencial máximo de lotes fermentados, naturais e lavados de altitude.', descricao: 'Extrai o potencial máximo de lotes fermentados, naturais e lavados de altitude.' },
    { tier: 5, minLevel: 20, nivelMinimo: 20, name: 'Pingo Grão-Mestre SCA', titulo: 'Pingo Grão-Mestre SCA', subtitle: 'Coroa Dourada SCA + Aura Crema', acessorio: 'Coroa Dourada SCA + Aura Crema', perk: 'Lenda viva da bancada: domínio técnico absoluto em múltiplos métodos de preparo.', descricao: 'Lenda viva da bancada: domínio técnico absoluto em múltiplos métodos de preparo.' }
  ];

  function estagioPorNivel(nivel) {
    const nv = Number(nivel) || 1;
    let st = PINGO_ESTAGIOS[0];
    for (const item of PINGO_ESTAGIOS) {
      if (nv >= item.minLevel) st = item;
    }
    return st;
  }

  function resolverTier(opts) {
    if (opts && opts.tier != null) return Math.max(1, Math.min(5, Number(opts.tier) || 1));
    if (opts && opts.nivel != null) return estagioPorNivel(opts.nivel).tier;
    if (typeof window !== 'undefined' && window.CafeGamificacao && typeof window.CafeGamificacao.tierAtual === 'function') {
      return window.CafeGamificacao.tierAtual();
    }
    return 1;
  }

  function svg(humor, opts) {
    opts = opts || {};
    const h = HUMORES[humor] || HUMORES.feliz;
    const tam = opts.size || 96;
    const tier = resolverTier(opts);
    const [pe, xe, ye] = BRACO[h.be], [pd, xd, yd] = BRACO[h.bd];
    const vapores = [[48, 0], [60, 0.6], [72, 1.2], [54, 1.8]].slice(0, h.vapor).map(([x, d]) => `<path class="m-steam" style="animation-delay:${d}s" d="M${x} 32 q-5 -6 0 -12 q5 -6 0 -12" stroke="${CUP2}" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('');
    const aura = tier >= 5 ? `<circle class="m-aura" cx="60" cy="66" r="50" fill="none" stroke="#d98a3c" stroke-width="1.8" stroke-dasharray="4 4" opacity=".55"/>` : '';
    const avental = tier >= 2 ? `<g class="m-avental"><path d="M38 82 H82 L80 98 Q60 100 40 98 Z" fill="#7d4925" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><line x1="48" y1="82" x2="72" y2="82" stroke="#d98a3c" stroke-width="1.8" stroke-linecap="round"/></g>` : '';
    const medalha = tier >= 4 ? `<g class="m-medalha"><circle cx="60" cy="90" r="5.5" fill="#f4b942" stroke="${INK}" stroke-width="1.5"/><circle cx="60" cy="90" r="2.2" fill="#d98a3c"/></g>` : '';
    const chapeu = tier === 4
      ? `<path class="m-boina" d="M35 37 Q60 22 83 36 Q60 33 35 37 Z" fill="#3e2518" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
      : tier >= 5
        ? `<polygon class="m-coroa" points="42,36 47,23 55,31 60,20 65,31 73,23 78,36" fill="#f4b942" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
        : '';
    const oculos = tier >= 3 ? `<g class="m-oculos" stroke="${INK}" stroke-width="1.8" fill="none"><circle cx="48" cy="63" r="8" fill="rgba(217,138,60,.14)"/><circle cx="72" cy="63" r="8" fill="rgba(217,138,60,.14)"/><line x1="56" y1="63" x2="64" y2="63"/></g>` : '';
    return `<svg class="mascote ${opts.anim === false ? '' : h.anim}" viewBox="0 0 120 120" width="${tam}" height="${tam}" role="img" aria-label="Pingo, a xícara mascote (${humor}, estágio ${tier})">
      ${aura}
      <g class="m-vapor">${vapores}</g>
      <g class="m-corpo">
        <ellipse cx="60" cy="104" rx="42" ry="6.5" fill="${CUP2}" stroke="${INK}" stroke-width="2.4"/>
        <path d="M92 52 C112 50 113 82 90 80" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="M92 52 C112 50 113 82 90 80" stroke="${CUP}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M26 42 H94 L88 88 Q86 99 75 99 H45 Q34 99 32 88 Z" fill="${CUP}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M31 80 Q60 88 89 80 L88 88 Q86 99 75 99 H45 Q34 99 32 88 Z" fill="${CUP2}" opacity=".7"/>
        ${avental}
        ${medalha}
        <ellipse cx="60" cy="42" rx="34" ry="7" fill="${CAFE}" stroke="${INK}" stroke-width="2.6"/>
        <ellipse cx="60" cy="42.5" rx="26" ry="4.4" fill="${CREMA}"/>
        <path d="M60 46 C54 42 55 38.6 58 39.2 Q60 39.8 60 41.2 Q60 39.8 62 39.2 C65 38.6 66 42 60 46 Z" fill="${CUP}"/>
        ${chapeu}
        ${h.blush ? `<ellipse cx="40" cy="75" rx="5" ry="3" fill="${BLUSH}" opacity=".7"/><ellipse cx="80" cy="75" rx="5" ry="3" fill="${BLUSH}" opacity=".7"/>` : ''}
        ${OLHOS[h.olhos](48, -1)}${OLHOS[h.olhos](72, 1)}
        ${oculos}
        ${BOCAS[h.boca]}
        ${h.lagrima ? `<path class="m-tear" d="M44 72 q-3 5 0 7 q3 -2 0 -7 Z" fill="#7fb0ea"/>` : ''}
        ${h.suor ? `<path d="M88 50 q-3 5 0 7 q3 -2 0 -7 Z" fill="#7fb0ea"/>` : ''}
      </g>
      <g class="m-braco-e"><path d="${pe}" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/><circle cx="${xe}" cy="${ye}" r="4.4" fill="${CUP}" stroke="${INK}" stroke-width="2.4"/></g>
      <g class="m-braco-d" style="transform-origin:88px 66px"><path d="${pd}" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/><circle cx="${xd}" cy="${yd}" r="4.4" fill="${CUP}" stroke="${INK}" stroke-width="2.4"/></g>
      ${h.tremor ? `<g stroke="#e7b64a" stroke-width="3" stroke-linecap="round"><path d="M14 60 l-6 -4"/><path d="M12 72 l-7 0"/><path d="M106 54 l6 -5"/><path d="M108 68 l7 1"/></g>` : ''}
      ${h.zzz ? `<g class="m-zzz" fill="${INK}" font-weight="800" font-family="system-ui,sans-serif"><text x="92" y="30" font-size="12">z</text><text x="100" y="20" font-size="15">Z</text></g>` : ''}
      ${h.brilho ? `<g class="m-spark" fill="#e7b64a"><path d="M18 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path d="M100 14 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z"/></g>` : ''}
    </svg>`;
  }

  /* Balão de fala com o Pingo */
  function card(humor, texto, opts) {
    opts = opts || {};
    return `<div class="pingo-card ${opts.compacto ? 'compacto' : ''}"><div class="pingo-fig">${svg(humor, { size: opts.size || (opts.compacto ? 64 : 92), tier: opts.tier, anim: opts.anim })}</div><div class="pingo-fala">${opts.titulo ? `<strong>${opts.titulo}</strong><br>` : ''}${texto}${opts.extraHtml || ''}</div></div>`;
  }

  /* ---------- humores por contexto ---------- */
  function porCafeina(r) {
    const hora = new Date(r.agora).getHours();
    const perto = r.dormir - r.agora < 90 * 60000;
    if (r.noCorpo > 300) return { humor: 'agitado', texto: `Uau, ${Math.round(r.noCorpo)} mg no corpo agora! Beba água e dê um tempo no café.` };
    if (r.status === 'alto') return { humor: 'agitado', texto: `Vai sobrar uns ${Math.round(r.naCama)} mg na hora de dormir. Que tal um descafeinado se bater vontade?` };
    if (perto || hora >= 23 || hora < 5) return { humor: r.noCorpo < r.par.limiarSono ? 'sonolento' : 'pensativo', texto: r.noCorpo < r.par.limiarSono ? 'Hora de desacelerar. Seu nível de cafeína está ótimo para dormir.' : 'Quase hora de dormir e ainda tem cafeína circulando. Melhor parar por hoje.' };
    if (r.hoje === 0) return { humor: 'sonolento', texto: hora < 12 ? 'Bom dia! Ainda sem café hoje… bora extrair um?' : 'Nenhuma cafeína hoje. Tudo bem pular um dia!' };
    if (r.status === 'atencao') return { humor: 'pensativo', texto: `Tá no limite: ${Math.round(r.naCama)} mg na hora de dormir. O próximo, se vier, que seja cedo.` };
    return { humor: 'feliz', texto: r.ultimo ? `Tudo sob controle. Dá para mais um café de 100 mg até as ${new Date(r.ultimo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.` : 'Nível de cafeína tranquilo.' };
  }
  function porExtracao(x) {
    const n = Number(x.nota) || 0, d = x.diag || {};
    if (d.misto) return { humor: 'surpreso', texto: 'Sinais de sub e sobre juntos: parece canalização. Capriche na distribuição do pó!' };
    if (n >= 9) return { humor: 'orgulhoso', texto: `Nota ${n}! Essa receita merece moldura.` };
    if (n >= 8 && d.cor === 'ok') return { humor: 'radiante', texto: `Nota ${n} e extração equilibrada. Calibrado!` };
    if (n > 0 && n < 5) return { humor: 'triste', texto: 'Essa não desceu bem… mas cada xícara ensina. Olha o ajuste abaixo.' };
    if (d.cor === 'sub') return { humor: 'pensativo', texto: 'Faltou extrair. Moagem mais fina deve resolver.' };
    if (d.cor === 'sobre') return { humor: 'pensativo', texto: 'Passou do ponto. Vamos abrir a moagem.' };
    return { humor: 'feliz', texto: n ? `Nota ${n}. Estamos chegando lá!` : 'Dê uma nota para eu te ajudar a calibrar.' };
  }
  function porLatte(score) {
    if (score >= 85) return { humor: 'orgulhoso', texto: `${score} pontos! Mão de barista campeão.` };
    if (score >= 70) return { humor: 'radiante', texto: `${score} pontos! O ritmo está firme.` };
    if (score >= 50) return { humor: 'feliz', texto: `${score} pontos. Mais constância e a rosetta sai!` };
    if (score >= 30) return { humor: 'pensativo', texto: `${score} pontos. Use o metrônomo e vá mais devagar.` };
    return { humor: 'triste', texto: `${score} pontos. Respira, solta o punho e tenta de novo.` };
  }

  /* ---------- escala de avaliação 1–5 ---------- */
  const NIVEIS = [
    { n: 1, humor: 'enjoado', rotulo: 'Ruim, preciso mudar bastante' },
    { n: 2, humor: 'triste', rotulo: 'Fraco, dá para melhorar' },
    { n: 3, humor: 'pensativo', rotulo: 'Ok, bebível' },
    { n: 4, humor: 'feliz', rotulo: 'Muito bom' },
    { n: 5, humor: 'radiante', rotulo: 'Excelente, de campeonato!' }
  ];
  const nivelPorNota = (nota) => Math.max(1, Math.min(5, Math.round((Number(nota) || 0) / 2) || 1));
  // combina a nota dada (70 %) com o equilíbrio da extração (30 %)
  function nivelExtracao(x) {
    const d = x.diag || {};
    const pelaAnalise = d.misto ? 2 : Math.max(1, 5 - 4 * Math.abs(Number(d.indice) || 0));
    if (x.nota == null || x.nota === '') return Math.round(pelaAnalise);
    return Math.max(1, Math.min(5, Math.round((Number(x.nota) / 2) * 0.7 + pelaAnalise * 0.3)));
  }
  function escala(atual) {
    return `<div class="pingo-escala" role="img" aria-label="Avaliação ${atual} de 5">${NIVEIS.map((nv) => `<div class="pe-item ${nv.n === atual ? 'on' : ''}">${svg(nv.humor, { size: nv.n === atual ? 52 : 38, anim: nv.n === atual })}<span>${nv.n}</span></div>`).join('')}</div>`;
  }

  window.Mascote = { svg, card, porCafeina, porExtracao, porLatte, NIVEIS, nivelPorNota, nivelExtracao, escala,
    PINGO_ESTAGIOS, resolverTier, estagioPorNivel, HUMORES: Object.keys(HUMORES), nome: 'Pingo' };
  window.Pingo = window.Mascote;
})();
