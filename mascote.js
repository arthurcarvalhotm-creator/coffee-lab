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

  function svg(humor, opts) {
    opts = opts || {};
    const h = HUMORES[humor] || HUMORES.feliz;
    const tam = opts.size || 96;
    const [pe, xe, ye] = BRACO[h.be], [pd, xd, yd] = BRACO[h.bd];
    const vapores = [[48, 0], [60, 0.6], [72, 1.2], [54, 1.8]].slice(0, h.vapor).map(([x, d]) => `<path class="m-steam" style="animation-delay:${d}s" d="M${x} 32 q-5 -6 0 -12 q5 -6 0 -12" stroke="${CUP2}" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('');
    return `<svg class="mascote ${opts.anim === false ? '' : h.anim}" viewBox="0 0 120 120" width="${tam}" height="${tam}" role="img" aria-label="Pingo, a xícara mascote (${humor})">
      <g class="m-vapor">${vapores}</g>
      <g class="m-corpo">
        <ellipse cx="60" cy="104" rx="42" ry="6.5" fill="${CUP2}" stroke="${INK}" stroke-width="2.4"/>
        <path d="M92 52 C112 50 113 82 90 80" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="M92 52 C112 50 113 82 90 80" stroke="${CUP}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M26 42 H94 L88 88 Q86 99 75 99 H45 Q34 99 32 88 Z" fill="${CUP}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M31 80 Q60 88 89 80 L88 88 Q86 99 75 99 H45 Q34 99 32 88 Z" fill="${CUP2}" opacity=".7"/>
        <ellipse cx="60" cy="42" rx="34" ry="7" fill="${CAFE}" stroke="${INK}" stroke-width="2.6"/>
        <ellipse cx="60" cy="42.5" rx="26" ry="4.4" fill="${CREMA}"/>
        <path d="M60 46 C54 42 55 38.6 58 39.2 Q60 39.8 60 41.2 Q60 39.8 62 39.2 C65 38.6 66 42 60 46 Z" fill="${CUP}"/>
        ${h.blush ? `<ellipse cx="40" cy="75" rx="5" ry="3" fill="${BLUSH}" opacity=".7"/><ellipse cx="80" cy="75" rx="5" ry="3" fill="${BLUSH}" opacity=".7"/>` : ''}
        ${OLHOS[h.olhos](48, -1)}${OLHOS[h.olhos](72, 1)}
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
    return `<div class="pingo-card ${opts.compacto ? 'compacto' : ''}"><div class="pingo-fig">${svg(humor, { size: opts.size || (opts.compacto ? 64 : 92) })}</div><div class="pingo-fala">${opts.titulo ? `<strong>${opts.titulo}</strong><br>` : ''}${texto}</div></div>`;
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
    HUMORES: Object.keys(HUMORES), nome: 'Pingo' };
  window.Pingo = window.Mascote;
})();
