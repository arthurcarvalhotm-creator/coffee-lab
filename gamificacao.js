/* =====================================================================
 * Laboratório de Cafeteria — Gamificação, Evolução do Pingo e Comunidade
 *
 * Funcionalidades:
 * 1) Sistema de XP por extração (Equilíbrio, Nota Alvo, God Shot, Dial-In, Na Mosca)
 * 2) Nível Global do Barista (1–50) e 5 Estágios de Evolução do Pingo
 * 3) Maestria por Método de Extração (Níveis 1–10 em todos os métodos)
 * 4) 12 Conquistas / Badges técnicas (Moagem, Método, Sensorial, Maestria)
 * 5) Vitrine da Comunidade (Publicar e Importar Grãos, Receitas, Moedores e Métodos)
 * 6) Ranking de Baristas & Bancadas (Leaderboard + Equipamentos com opt-in público)
 * ===================================================================== */
(function () {
  'use strict';
  const lab = window.CafeLab, DB = window.CAFE_DB, E = window.Engine || window.CAFE_ENGINE;

  const LEVEL_TITLES = [
    { minLevel: 1, title: 'Aprendiz de Café' },
    { minLevel: 3, title: 'Iniciante Curioso' },
    { minLevel: 5, title: 'Barista de Bancada' },
    { minLevel: 8, title: 'Especialista em Filtro' },
    { minLevel: 11, title: 'Alquimista de Extração' },
    { minLevel: 15, title: 'Mestre de Torra & Moagem' },
    { minLevel: 20, title: 'Sommelier Sensorial' },
    { minLevel: 30, title: 'Grão-Mestre SCA' }
  ];

  const METHOD_LEVEL_TITLES = [
    'Iniciante',
    'Aprendiz de Bancada',
    'Barista Técnico',
    'Especialista em Extração',
    'Mestre do Método',
    'Grão-Mestre SCA'
  ];

  const BADGES_CATALOG = [
    {
      id: 'first_brew',
      title: 'Primeira Gota',
      description: 'Registre sua primeira extração no diário.',
      icon: '💧',
      category: 'metodo',
      xpReward: 50
    },
    {
      id: 'dial_in_sniper',
      title: 'Sniper do Clique',
      description: 'Calibre um grão atingindo a nota alvo em no máximo 2 tentativas.',
      icon: '🎯',
      category: 'moagem',
      xpReward: 150
    },
    {
      id: 'grinder_tweaker',
      title: 'Domador de Mós',
      description: 'Melhore a nota de um mesmo grão em +1.5 ponto ajustando apenas os cliques do moedor.',
      icon: '⚙️',
      category: 'moagem',
      xpReward: 100
    },
    {
      id: 'conical_master',
      title: 'Mestre do Filtro Cônico',
      description: 'Extraia ao menos 5 receitas equilibradas em métodos cônicos (V60, Origami, Hario Suiren, Chemex ou Clever).',
      icon: '📐',
      category: 'metodo',
      xpReward: 120
    },
    {
      id: 'pressure_alchemist',
      title: 'Alquimista da Pressão',
      description: 'Tire 3 extrações com nota >= 8.5 no Espresso, Moka, AeroPress ou Prensa.',
      icon: '⚡',
      category: 'metodo',
      xpReward: 150
    },
    {
      id: 'explorer_methods',
      title: 'Poliglota de Bancada',
      description: 'Registre extrações em pelo menos 4 métodos diferentes.',
      icon: '🧭',
      category: 'metodo',
      xpReward: 200
    },
    {
      id: 'terroir_hunter',
      title: 'Caçador de Terroir',
      description: 'Extraia cafés de 4 regiões produtoras diferentes.',
      icon: '⛰️',
      category: 'sensorial',
      xpReward: 180
    },
    {
      id: 'fermentation_fan',
      title: 'Entusiasta de Fermentação',
      description: 'Calibre um café de processo Fermentado, Anaeróbico ou Honey.',
      icon: '🧪',
      category: 'sensorial',
      xpReward: 120
    },
    {
      id: 'sensory_sommelier',
      title: 'Nariz de Sommelier',
      description: 'Identifique 3 ou mais descritores sensoriais em 5 extrações equilibradas.',
      icon: '🍋',
      category: 'sensorial',
      xpReward: 140
    },
    {
      id: 'god_shot',
      title: 'God Shot (Nota 9.5+)',
      description: 'Alcance a perfeição sensorial com uma nota 9.5 ou superior em equilíbrio.',
      icon: '👑',
      category: 'maestria',
      xpReward: 300
    },
    {
      id: 'latte_artist',
      title: 'Pulso de Cisne',
      description: 'Conquiste 80 pontos ou mais no treino de Latte Art.',
      icon: '🦢',
      category: 'maestria',
      xpReward: 150
    },
    {
      id: 'community_sharer',
      title: 'Barista Colaborativo',
      description: 'Compartilhe ou importe um grão, receita ou equipamento na Vitrine da Comunidade.',
      icon: '🤝',
      category: 'maestria',
      xpReward: 120
    }
  ];

  /* Itens curados iniciais da Vitrine da Comunidade (sempre disponíveis mesmo offline) */
  const VITRINE_SEED = [
    {
      id: 'seed_grao_gesha_mantiqueira',
      autorUid: 'seed_camila',
      autorNome: 'Camila Rocha · Mestre de Torra',
      autorTier: 4,
      tipo: 'grao',
      titulo: 'Sítio Santa Fé — Gesha Natural Anaeróbico',
      subtitulo: 'Mantiqueira de Minas · Torra Clara · 89.5 pts SCA',
      resumo: 'Floral intenso de jasmim, pêssego branco e acidez cítrica brilhante de bergamota. Excelente em cônicos de fluxo rápido (Origami e Hario Suiren).',
      tags: ['Mantiqueira', 'Fermentado / Anaeróbico', 'Torra Clara', '89.5 pts'],
      updatedAt: '2026-11-01T10:00:00.000Z',
      payload: {
        nome: 'Sítio Santa Fé — Gesha Anaeróbico',
        produtor: 'Família Andrade',
        torrefacao: 'Rocha Microtorrefação',
        regiao: 'mantiqueira',
        variedade: 'Gesha',
        processo: 'fermentado',
        torra: 'clara',
        especie: 'arabica',
        altitude: 1380,
        pontuacao: '89.5',
        acidez: 5,
        corpo: 3,
        docura: 5,
        notas: ['jasmim', 'pêssego', 'bergamota', 'mel'],
        dica: 'Use 92 °C e despejos suaves no centro para destacar o floral sem extrair adstringência.'
      }
    },
    {
      id: 'seed_receita_origami_240',
      autorUid: 'seed_lucas',
      autorNome: 'Lucas Takahashi · Grão-Mestre SCA',
      autorTier: 5,
      tipo: 'receita',
      titulo: 'Origami Flash Bloom 1:16 (Nota 9.5)',
      subtitulo: 'Origami Dripper · 15 g → 240 g · 93 °C · 2:25',
      resumo: 'Receita de 3 despejos com bloom longo de 45 s para cafés naturais e fermentados de alta densidade. Realça doçura de frutas tropicais e final limpo.',
      tags: ['Origami', '1:16', '93 °C', 'Nota 9.5'],
      updatedAt: '2026-11-03T14:30:00.000Z',
      payload: {
        metodoId: 'origami',
        dose: 15,
        water: 240,
        ratio: 16,
        tempC: 93,
        tempoS: 145,
        clicks: 19,
        nota: 9.5,
        descritores: ['frutas amarelas', 'floral', 'mel', 'limpo'],
        obs: 'Filtro cônico V60 02 encaixado nas canaletas do Origami. Bloom de 45 g (0:00–0:45), 2º despejo até 150 g (0:45–1:20) e 3º despejo central até 240 g (1:20–2:25).',
        graoSugerido: {
          nome: 'Catucaí 785 — Caparaó Honey',
          regiao: 'caparao',
          processo: 'honey',
          torra: 'media-clara',
          acidez: 4,
          corpo: 3,
          docura: 5,
          notas: ['damasco', 'mel', 'chá preto']
        }
      }
    },
    {
      id: 'seed_receita_suiren_165',
      autorUid: 'seed_marina',
      autorNome: 'Marina Costa · Alquimista de Extração',
      autorTier: 3,
      tipo: 'receita',
      titulo: 'Hario Suiren Alta Claridade 1:16.5 (Nota 9.2)',
      subtitulo: 'Hario Suiren · 15 g → 248 g · 94 °C · 2:15',
      resumo: 'Os 12 anéis abertos do Suiren reduzem o bypass lateral. Moagem 1 clique mais fina que no V60 entrega acidez suculenta e transparência de xícara.',
      tags: ['Hario Suiren', '1:16.5', '94 °C', 'Nota 9.2'],
      updatedAt: '2026-11-05T09:15:00.000Z',
      payload: {
        metodoId: 'suiren',
        dose: 15,
        water: 248,
        ratio: 16.5,
        tempC: 94,
        tempoS: 135,
        clicks: 17,
        nota: 9.2,
        descritores: ['frutas vermelhas', 'cítrico', 'caramelo'],
        obs: 'Despejo espiral curto mantendo o nível baixo para aproveitar o fluxo livre entre as 12 hastes do Suiren.',
        graoSugerido: {
          nome: 'Bourbon Amarelo — Alta Mogiana',
          regiao: 'mogiana',
          processo: 'cereja-descascado',
          torra: 'media-clara',
          acidez: 4,
          corpo: 3,
          docura: 4,
          notas: ['frutas vermelhas', 'caramelo', 'avelã']
        }
      }
    },
    {
      id: 'seed_moedor_kultra',
      autorUid: 'seed_lucas',
      autorNome: 'Lucas Takahashi · Grão-Mestre SCA',
      autorTier: 5,
      tipo: 'moedor',
      titulo: '1Zpresso K-Ultra (Mapa Calibrado Completo)',
      subtitulo: 'Manual · Escala 0–100 · Passo 1 clique (20 µm)',
      resumo: 'Mapa de referências testado para todos os 14 métodos (incluindo Origami no 68 e Hario Suiren no 64). Ideal para quem usa mós heptagonais de 48 mm.',
      tags: ['Moedor Manual', '1Zpresso', '14 métodos mapeados'],
      updatedAt: '2026-11-04T18:00:00.000Z',
      payload: {
        nome: '1Zpresso K-Ultra (Comunidade)',
        tipo: 'manual',
        min: 0,
        max: 100,
        passo: 1,
        passoAjuste: 2,
        direcao: 'menor=fino',
        obs: 'Anel externo numerado de 0 a 10 (10 cliques por número, 100 cliques por volta; 20 µm/clique).',
        refs: {
          espresso: 32,
          moka: 48,
          aeropress: 58,
          v60: 66,
          origami: 68,
          suiren: 64,
          kalita: 70,
          melitta: 70,
          clever: 72,
          chemex: 75,
          prensa: 82,
          coldbrew: 90,
          'capsula-presso': 38,
          'capsula-traco': 46
        }
      }
    },
    {
      id: 'seed_metodo_switch_hibrido',
      autorUid: 'seed_rafael',
      autorNome: 'Rafael Mendes · Barista de Bancada',
      autorTier: 2,
      tipo: 'metodo',
      titulo: 'Hario Switch Híbrido (Percolação + Imersão)',
      subtitulo: 'Método Personalizado · Base Clever/V60 · 1:15.5',
      resumo: 'Começa com válvula aberta até 50% da água a 93 °C e fecha a válvula na segunda metade a 82 °C para extrair doçura máxima sem amargor.',
      tags: ['Método Híbrido', 'Hario Switch', '1:15.5'],
      updatedAt: '2026-11-06T12:00:00.000Z',
      payload: {
        nome: 'Hario Switch Híbrido',
        base: 'clever',
        icone: '🧪',
        dosePadrao: 15,
        ratioPadrao: 15.5,
        tempPadrao: 92,
        tempoMin: 150,
        tempoMax: 195,
        obs: '0:00–0:45 válvula aberta até 120 g (93 °C). 0:45 fecha a válvula, adiciona até 232 g (82 °C) e abre em 2:10.'
      }
    }
  ];

  /* Perfis iniciais do Ranking de Baristas */
  const RANKING_SEED = [
    {
      uid: 'seed_lucas',
      nome: 'Lucas Takahashi',
      nivel: 32,
      xpTotal: 9850,
      tier: 5,
      titulo: 'Grão-Mestre SCA',
      badgesCount: 11,
      totalExtracoes: 148,
      calibradas: 42,
      moedores: ['1Zpresso K-Ultra', 'DF64 Gen 2'],
      metodos: ['Origami', 'V60', 'Espresso', 'Hario Suiren']
    },
    {
      uid: 'seed_camila',
      nome: 'Camila Rocha',
      nivel: 16,
      xpTotal: 4290,
      tier: 4,
      titulo: 'Mestre de Torra & Moagem',
      badgesCount: 9,
      totalExtracoes: 74,
      calibradas: 23,
      moedores: ['Comandante C40 MK4', 'Baratza Encore ESP'],
      metodos: ['V60', 'Origami', 'Chemex', 'AeroPress']
    },
    {
      uid: 'seed_marina',
      nome: 'Marina Costa',
      nivel: 9,
      xpTotal: 1920,
      tier: 3,
      titulo: 'Especialista em Filtro',
      badgesCount: 7,
      totalExtracoes: 36,
      calibradas: 12,
      moedores: ['Kingrinder K6', 'Starseeker E55 Pro'],
      metodos: ['Hario Suiren', 'V60', 'Kalita Wave']
    },
    {
      uid: 'seed_rafael',
      nome: 'Rafael Mendes',
      nivel: 5,
      xpTotal: 840,
      tier: 2,
      titulo: 'Barista de Bancada',
      badgesCount: 4,
      totalExtracoes: 18,
      calibradas: 5,
      moedores: ['Timemore C3', 'Kingrinder K2'],
      metodos: ['Clever', 'Prensa Francesa', 'AeroPress']
    }
  ];

  /* ---------- estado local da comunidade e preferências ---------- */
  function cfgComunidade() {
    const s = lab.state();
    s.config = s.config || {};
    if (!s.config.comunidade || typeof s.config.comunidade !== 'object') {
      s.config.comunidade = {
        apelido: '',
        perfilPublico: true,
        compartilhados: 0,
        importados: 0,
        meusItens: [],
        ultimoNivelCelebrado: 1,
        badgesCelebradas: []
      };
    }
    const c = s.config.comunidade;
    if (!Array.isArray(c.meusItens)) c.meusItens = [];
    if (!Array.isArray(c.badgesCelebradas)) c.badgesCelebradas = [];
    if (c.perfilPublico === undefined) c.perfilPublico = true;
    return c;
  }

  /* ---------- 1) Cálculo de XP por Extração ---------- */
  function obterDiag(brew, graoObj) {
    if (brew && brew.diag && typeof brew.diag.indice === 'number') return brew.diag;
    const m = lab.metodo(brew.metodoId) || (DB && DB.metodo && DB.metodo.v60);
    const g = graoObj || lab.grao(brew.graoId);
    if (E && E.diagnose && m) {
      try { return E.diagnose(brew, m, g); } catch (e) { /* fallback */ }
    }
    return { indice: 0, misto: false, cor: 'ok', rotulo: 'Equilibrada' };
  }

  function calcularXpExtracao(brew, extracoesAnteriores, graoObj, notaAlvo) {
    const alvo = Number(notaAlvo || (lab.state().config && lab.state().config.notaAlvo) || 8);
    const breakdown = [];
    let total = 0;

    // 1. Base XP
    const baseXp = 25;
    total += baseXp;
    breakdown.push({ label: 'Extração registrada', xp: baseXp });

    // 2. Qualidade e Equilíbrio
    const diag = obterDiag(brew, graoObj);
    const isBalanced = Math.abs(Number(diag.indice || 0)) < 0.22 && !diag.misto;
    const nota = Number(brew.nota || 0);

    if (nota >= 9.5 && isBalanced) {
      total += 100;
      breakdown.push({ label: 'God Shot! Extração memorável', xp: 100 });
    } else if (nota >= alvo && isBalanced) {
      total += 50;
      breakdown.push({ label: 'Receita Calibrada no Alvo', xp: 50 });
    } else if (isBalanced) {
      total += 20;
      breakdown.push({ label: 'Extração equilibrada', xp: 20 });
    }

    // 3. Evolução de Moagem (Dial-In) ou Acerto de Primeira (Na Mosca)
    const anteriores = (extracoesAnteriores || []).filter(
      (x) => x.id !== brew.id && x.graoId === brew.graoId && x.metodoId === brew.metodoId
    );
    if (anteriores.length > 0) {
      const prev = anteriores[anteriores.length - 1];
      if (nota >= Number(prev.nota || 0) + 0.5 && prev.clicks !== brew.clicks) {
        total += 35;
        breakdown.push({ label: 'Bônus Dial-In: Ajuste certeiro de moagem', xp: 35 });
      }
    } else if (nota >= alvo && isBalanced) {
      total += 40;
      breakdown.push({ label: 'Bônus Na Mosca: Acertou de primeira!', xp: 40 });
    }

    return { total, breakdown };
  }

  /* ---------- 2) Maestria por Método (Níveis 1 a 10) ---------- */
  function calcularMaestriaMetodos(extracoes, graos, notaAlvo) {
    const alvo = Number(notaAlvo || (lab.state().config && lab.state().config.notaAlvo) || 8);
    const s = lab.state();
    const listaMetodos = (DB && DB.metodos ? DB.metodos : []).filter((m) => !m.arquivado);
    const mapa = {};

    listaMetodos.forEach((m) => {
      mapa[m.id] = {
        methodId: m.id,
        nome: m.nome,
        icone: m.icone || '☕',
        xp: 0,
        level: 1,
        nextLevelXp: 100,
        progressPct: 0,
        extractionsCount: 0,
        calibratedCount: 0,
        bestScore: 0,
        title: METHOD_LEVEL_TITLES[0]
      };
    });

    const ordenadas = (extracoes || []).slice().sort((a, b) => new Date(a.data || 0) - new Date(b.data || 0));
    const historicoPorMetodo = {};

    ordenadas.forEach((brew) => {
      const mid = brew.metodoId || 'v60';
      if (!mapa[mid]) {
        const mObj = lab.metodo(mid) || { id: mid, nome: mid, icone: '☕' };
        mapa[mid] = {
          methodId: mid,
          nome: mObj.nome || mid,
          icone: mObj.icone || '☕',
          xp: 0,
          level: 1,
          nextLevelXp: 100,
          progressPct: 0,
          extractionsCount: 0,
          calibratedCount: 0,
          bestScore: 0,
          title: METHOD_LEVEL_TITLES[0]
        };
      }
      const g = (graos || s.graos || []).find((x) => x.id === brew.graoId);
      const hist = historicoPorMetodo[mid] || [];
      const xpRes = calcularXpExtracao(brew, hist, g, alvo);
      const diag = obterDiag(brew, g);
      const isBalanced = Math.abs(Number(diag.indice || 0)) < 0.22 && !diag.misto;
      const nota = Number(brew.nota || 0);

      mapa[mid].xp += xpRes.total;
      mapa[mid].extractionsCount += 1;
      if (nota >= alvo && isBalanced) mapa[mid].calibratedCount += 1;
      if (nota > mapa[mid].bestScore) mapa[mid].bestScore = nota;

      hist.push(brew);
      historicoPorMetodo[mid] = hist;
    });

    return Object.values(mapa).map((m) => {
      let level = 1;
      let req = 100;
      let acc = 0;
      while (m.xp >= acc + req && level < 10) {
        acc += req;
        level += 1;
        req = Math.round(req * 1.35);
      }
      const intoLevel = m.xp - acc;
      const progressPct = level >= 10 ? 100 : Math.min(100, Math.round((intoLevel / req) * 100));
      const titleIdx = Math.min(METHOD_LEVEL_TITLES.length - 1, Math.floor((level - 1) / 2));
      return {
        ...m,
        level,
        nextLevelXp: acc + req,
        progressPct,
        title: METHOD_LEVEL_TITLES[titleIdx]
      };
    }).sort((a, b) => b.xp - a.xp || b.extractionsCount - a.extractionsCount);
  }

  /* ---------- 3) Avaliação das 12 Conquistas (Badges) ---------- */
  function avaliarBadges(extracoes, graos, latteHighScore, notaAlvo, statsComunidade) {
    const alvo = Number(notaAlvo || (lab.state().config && lab.state().config.notaAlvo) || 8);
    const ordenadas = (extracoes || []).slice().sort((a, b) => new Date(a.data || 0) - new Date(b.data || 0));
    const listaGraos = graos || lab.state().graos || [];
    const com = statsComunidade || cfgComunidade();

    // Agrupa por grão + método
    const porGraoMetodo = {};
    ordenadas.forEach((b) => {
      const k = `${b.graoId}__${b.metodoId}`;
      (porGraoMetodo[k] = porGraoMetodo[k] || []).push(b);
    });

    // 1. Primeira Gota
    const hasFirstBrew = ordenadas.length >= 1;

    // 2. Sniper do Clique (calibrado em <= 2 tentativas)
    let sniperCount = 0;
    Object.values(porGraoMetodo).forEach((arr) => {
      const idx = arr.findIndex((b) => {
        const g = listaGraos.find((x) => x.id === b.graoId);
        const d = obterDiag(b, g);
        return Number(b.nota || 0) >= alvo && Math.abs(Number(d.indice || 0)) < 0.22 && !d.misto;
      });
      if (idx !== -1 && idx <= 1) sniperCount += 1;
    });

    // 3. Domador de Mós (+1.5 ponto ajustando cliques)
    let grinderTweakerDone = false;
    Object.values(porGraoMetodo).forEach((arr) => {
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].clicks !== arr[i - 1].clicks && Number(arr[i].nota || 0) >= Number(arr[i - 1].nota || 0) + 1.5) {
          grinderTweakerDone = true;
        }
      }
    });

    // 4. Mestre do Filtro Cônico (inclui V60, Origami, Suiren, Chemex, Clever, Melitta)
    const metodosConicos = ['v60', 'origami', 'suiren', 'chemex', 'clever', 'melitta', 'hario-switch'];
    const conicalBalancedCount = ordenadas.filter((b) => {
      const m = lab.metodo(b.metodoId);
      const base = m && m.base ? m.base : b.metodoId;
      if (!metodosConicos.includes(b.metodoId) && !metodosConicos.includes(base)) return false;
      const g = listaGraos.find((x) => x.id === b.graoId);
      const d = obterDiag(b, g);
      return Math.abs(Number(d.indice || 0)) < 0.22 && !d.misto;
    }).length;

    // 5. Alquimista da Pressão
    const metodosPressao = ['espresso', 'moka', 'aeropress', 'prensa', 'capsula-presso', 'capsula-traco'];
    const pressureGreatCount = ordenadas.filter((b) => {
      const m = lab.metodo(b.metodoId);
      const base = m && m.base ? m.base : b.metodoId;
      return (metodosPressao.includes(b.metodoId) || metodosPressao.includes(base)) && Number(b.nota || 0) >= 8.5;
    }).length;

    // 6. Poliglota de Bancada (4 métodos distintos)
    const uniqueMethods = new Set(ordenadas.map((b) => b.metodoId)).size;

    // 7. Caçador de Terroir (4 regiões distintas)
    const uniqueRegions = new Set(
      ordenadas.map((b) => {
        const g = listaGraos.find((x) => x.id === b.graoId);
        return g ? g.regiao : null;
      }).filter(Boolean)
    ).size;

    // 8. Entusiasta de Fermentação
    let fermentationCalibrated = false;
    ordenadas.forEach((b) => {
      const g = listaGraos.find((x) => x.id === b.graoId);
      if (g && (g.processo === 'fermentado' || g.processo === 'honey')) {
        const d = obterDiag(b, g);
        if (Number(b.nota || 0) >= alvo && Math.abs(Number(d.indice || 0)) < 0.22 && !d.misto) {
          fermentationCalibrated = true;
        }
      }
    });

    // 9. Nariz de Sommelier (3+ descritores em 5 extrações equilibradas)
    const sensoryCount = ordenadas.filter((b) => {
      const g = listaGraos.find((x) => x.id === b.graoId);
      const d = obterDiag(b, g);
      return Array.isArray(b.descritores) && b.descritores.length >= 3 && Math.abs(Number(d.indice || 0)) < 0.22 && !d.misto;
    }).length;

    // 10. God Shot (Nota >= 9.5 em equilíbrio)
    const godShotDone = ordenadas.some((b) => {
      const g = listaGraos.find((x) => x.id === b.graoId);
      const d = obterDiag(b, g);
      return Number(b.nota || 0) >= 9.5 && Math.abs(Number(d.indice || 0)) < 0.22 && !d.misto;
    });

    // 11. Pulso de Cisne (Latte Art >= 80)
    const maxLatte = Number(latteHighScore != null ? latteHighScore : maiorNotaLatte());
    const latteDone = maxLatte >= 80;

    // 12. Barista Colaborativo (Compartilhou ou importou item na comunidade)
    const totalAcoesComunidade = Number(com.compartilhados || 0) + Number(com.importados || 0) + ((com.meusItens && com.meusItens.length) || 0);
    const communityDone = totalAcoesComunidade >= 1;

    return BADGES_CATALOG.map((badge) => {
      let unlocked = false;
      let progressText = '';
      switch (badge.id) {
        case 'first_brew':
          unlocked = hasFirstBrew;
          progressText = `${Math.min(1, ordenadas.length)}/1 extração`;
          break;
        case 'dial_in_sniper':
          unlocked = sniperCount >= 1;
          progressText = unlocked ? 'Concluído!' : '0/1 grão na 1ª ou 2ª tentativa';
          break;
        case 'grinder_tweaker':
          unlocked = grinderTweakerDone;
          progressText = unlocked ? 'Concluído!' : 'Ajuste cliques e suba +1.5 na nota';
          break;
        case 'conical_master':
          unlocked = conicalBalancedCount >= 5;
          progressText = `${Math.min(5, conicalBalancedCount)}/5 extrações cônicas`;
          break;
        case 'pressure_alchemist':
          unlocked = pressureGreatCount >= 3;
          progressText = `${Math.min(3, pressureGreatCount)}/3 extrações de pressão`;
          break;
        case 'explorer_methods':
          unlocked = uniqueMethods >= 4;
          progressText = `${Math.min(4, uniqueMethods)}/4 métodos`;
          break;
        case 'terroir_hunter':
          unlocked = uniqueRegions >= 4;
          progressText = `${Math.min(4, uniqueRegions)}/4 regiões`;
          break;
        case 'fermentation_fan':
          unlocked = fermentationCalibrated;
          progressText = unlocked ? 'Concluído!' : '0/1 fermentado ou honey calibrado';
          break;
        case 'sensory_sommelier':
          unlocked = sensoryCount >= 5;
          progressText = `${Math.min(5, sensoryCount)}/5 avaliações completas`;
          break;
        case 'god_shot':
          unlocked = godShotDone;
          progressText = unlocked ? 'God Shot alcançado!' : 'Busque a nota 9.5+ em equilíbrio';
          break;
        case 'latte_artist':
          unlocked = latteDone;
          progressText = `${Math.min(80, Math.round(maxLatte))}/80 pts no Latte Art`;
          break;
        case 'community_sharer':
          unlocked = communityDone;
          progressText = unlocked ? 'Barista ativo na comunidade!' : '0/1 item compartilhado ou importado';
          break;
      }
      return { ...badge, unlocked, progressText };
    });
  }

  function maiorNotaLatte() {
    const s = lab.state();
    const arr = Array.isArray(s.latte) ? s.latte : [];
    if (!arr.length) return 0;
    return arr.reduce((m, x) => Math.max(m, Number(x.nota || x.total || x.score || 0)), 0);
  }

  /* ---------- 4) Perfil Completo do Barista ---------- */
  function calcularPerfilBarista(customState) {
    const s = customState || lab.state();
    const extracoes = s.extracoes || [];
    const graos = s.graos || [];
    const notaAlvo = Number((s.config && s.config.notaAlvo) || 8);
    const com = cfgComunidade();
    const maxLatte = maiorNotaLatte();

    const ordenadas = extracoes.slice().sort((a, b) => new Date(a.data || 0) - new Date(b.data || 0));
    let totalExtractionXp = 0;
    let calibratedRecipes = 0;
    let godShots = 0;

    ordenadas.forEach((b, idx) => {
      const g = graos.find((x) => x.id === b.graoId);
      const prev = ordenadas.slice(0, idx);
      const xpRes = calcularXpExtracao(b, prev, g, notaAlvo);
      totalExtractionXp += xpRes.total;

      const d = obterDiag(b, g);
      const isBalanced = Math.abs(Number(d.indice || 0)) < 0.22 && !d.misto;
      const nota = Number(b.nota || 0);
      if (nota >= notaAlvo && isBalanced) calibratedRecipes += 1;
      if (nota >= 9.5 && isBalanced) godShots += 1;
    });

    const badges = avaliarBadges(ordenadas, graos, maxLatte, notaAlvo, com);
    const badgeXp = badges.filter((b) => b.unlocked).reduce((acc, b) => acc + b.xpReward, 0);
    const communityBonusXp = Math.min(250, ((com.compartilhados || 0) + (com.importados || 0)) * 25);
    const totalXp = totalExtractionXp + badgeXp + communityBonusXp;

    let level = 1;
    let nextLevelReq = 150;
    let accumulatedReq = 0;

    while (totalXp >= accumulatedReq + nextLevelReq && level < 50) {
      accumulatedReq += nextLevelReq;
      level += 1;
      nextLevelReq = Math.round(nextLevelReq * 1.25);
    }

    const currentLevelXp = totalXp - accumulatedReq;
    const progressPct = Math.min(100, Math.round((currentLevelXp / nextLevelReq) * 100));

    let title = LEVEL_TITLES[0].title;
    for (const t of LEVEL_TITLES) {
      if (level >= t.minLevel) title = t.title;
    }

    const pingoStage = window.Mascote && window.Mascote.estagioPorNivel
      ? window.Mascote.estagioPorNivel(level)
      : { tier: 1, minLevel: 1, name: 'Pingo Curioso', subtitle: 'Gota recém-extraída na bancada', perk: 'Acompanha a sua cafeína e celebra cada xícara no diário.' };

    const methodMasteries = calcularMaestriaMetodos(ordenadas, graos, notaAlvo);

    return {
      level,
      title,
      totalXp,
      currentLevelXp,
      nextLevelXp: nextLevelReq,
      progressPct,
      pingoStage,
      badges,
      methodMasteries,
      stats: {
        totalExtractions: ordenadas.length,
        calibratedRecipes,
        godShots,
        unlockedBadges: badges.filter((b) => b.unlocked).length,
        totalBadges: badges.length
      }
    };
  }

  function tierAtual() {
    try {
      return calcularPerfilBarista().pingoStage.tier || 1;
    } catch (e) {
      return 1;
    }
  }

  /* ---------- Barra de XP no Card do Pingo na Home ---------- */
  function barraHomeHtml() {
    const p = calcularPerfilBarista();
    return `<div class="pingo-xp-bar" onclick="location.hash='#/comunidade'" title="Ver evolução, insígnias e comunidade">
      <div class="row between" style="gap:6px">
        <span class="pingo-lvl-badge">Nv. ${p.level} · ${lab.esc(p.title)}</span>
        <small class="muted">${p.totalXp} XP · 🏆 ${p.stats.unlockedBadges}/${p.stats.totalBadges}</small>
      </div>
      <div class="xp-track"><div class="xp-fill" style="width:${p.progressPct}%"></div></div>
      <div class="row between" style="margin-top:2px">
        <small class="muted">${lab.esc(p.pingoStage.name)} (Tier ${p.pingoStage.tier}/5)</small>
        <small style="color:var(--accent);font-weight:600">Evolução & Comunidade ›</small>
      </div>
    </div>`;
  }

  /* ---------- Sincronização do Perfil Público com o Cloud Firestore ---------- */
  async function sincronizarPerfilPublico() {
    if (!window.CafeSync || !window.CafeSync.usuarioAtual || !window.CafeSync.usuarioAtual()) return null;
    const com = cfgComunidade();
    if (com.perfilPublico === false) {
      try { await window.CafeSync.removerPerfilComunidade(); } catch (e) { /* */ }
      return null;
    }
    const p = calcularPerfilBarista();
    const s = lab.state();
    const u = window.CafeSync.usuarioAtual();
    const moedores = (s.moedores || []).map((m) => m.nome).filter(Boolean).slice(0, 6);
    const metodosUsados = p.methodMasteries.filter((m) => m.extractionsCount > 0).map((m) => m.nome.split(' (')[0]).slice(0, 6);
    const metodos = metodosUsados.length ? metodosUsados : ['V60', 'Origami', 'Espresso'];
    try {
      return await window.CafeSync.publicarPerfilComunidade({
        nome: (com.apelido || '').trim() || u.nome || 'Barista do Lab',
        foto: u.foto || '',
        nivel: p.level,
        xpTotal: p.totalXp,
        tier: p.pingoStage.tier,
        titulo: p.title,
        badgesCount: p.stats.unlockedBadges,
        badges: p.badges.filter((b) => b.unlocked).map((b) => b.id),
        totalExtracoes: p.stats.totalExtractions,
        calibradas: p.stats.calibratedRecipes,
        moedores,
        metodos,
        publico: true
      });
    } catch (e) {
      return null;
    }
  }

  /* ---------- Compartilhamento e Importação na Vitrine ---------- */
  function nomeAutorLocal() {
    const com = cfgComunidade();
    if (com.apelido && com.apelido.trim()) return com.apelido.trim();
    const u = window.CafeSync && window.CafeSync.usuarioAtual && window.CafeSync.usuarioAtual();
    if (u && u.nome) return u.nome;
    return 'Minha Bancada';
  }

  async function compartilharItem(tipo, obj) {
    if (!obj) return null;
    const p = calcularPerfilBarista();
    const com = cfgComunidade();
    const u = window.CafeSync && window.CafeSync.usuarioAtual && window.CafeSync.usuarioAtual();
    const autorUid = (u && u.uid) || 'local_user';
    const autorNome = `${nomeAutorLocal()} · ${p.title}`;
    let item = null;

    if (tipo === 'grao') {
      const reg = (DB.regiao && DB.regiao[obj.regiao]) || { nome: obj.regiao || 'Origem Especial' };
      const proc = (DB.processo && DB.processo[obj.processo]) || { nome: obj.processo || 'Natural' };
      const tor = (DB.torra && DB.torra[obj.torra]) || { nome: obj.torra || 'Média' };
      item = {
        id: `com_grao_${obj.id}`,
        autorUid,
        autorNome,
        autorTier: p.pingoStage.tier,
        tipo: 'grao',
        titulo: obj.nome || 'Grão Especial',
        subtitulo: `${reg.nome} · ${proc.nome.split(' (')[0]} · Torra ${tor.nome}`,
        resumo: obj.obs || (obj.notas && obj.notas.length ? `Notas sensoriais: ${obj.notas.join(', ')}.` : reg.dica || 'Café especial compartilhado da bancada.'),
        tags: [reg.nome, proc.nome.split(' (')[0], `Torra ${tor.nome}`, obj.pontuacao ? `${obj.pontuacao} pts` : ''].filter(Boolean),
        updatedAt: new Date().toISOString(),
        payload: {
          nome: obj.nome,
          produtor: obj.produtor || '',
          torrefacao: obj.torrefacao || '',
          regiao: obj.regiao || 'outra',
          variedade: obj.variedade || '',
          processo: obj.processo || 'natural',
          torra: obj.torra || 'media',
          especie: obj.especie || 'arabica',
          altitude: obj.altitude || '',
          pontuacao: obj.pontuacao || '',
          acidez: obj.acidez || 3,
          corpo: obj.corpo || 3,
          docura: obj.docura || 4,
          notas: Array.isArray(obj.notas) ? obj.notas : []
        }
      };
    } else if (tipo === 'receita') {
      const g = lab.grao(obj.graoId) || {};
      const m = lab.metodo(obj.metodoId) || { id: obj.metodoId, nome: obj.metodoId };
      item = {
        id: `com_receita_${obj.id}`,
        autorUid,
        autorNome,
        autorTier: p.pingoStage.tier,
        tipo: 'receita',
        titulo: `${m.nome.split(' (')[0]} · ${g.nome || 'Receita Calibrada'} (Nota ${Number(obj.nota || 8).toFixed(1)})`,
        subtitulo: `${m.nome.split(' (')[0]} · ${obj.dose} g → ${obj.water} g (1:${obj.ratio}) · ${obj.tempC} °C · ${E.fmtTempo(obj.tempoS)}`,
        resumo: obj.obs || (obj.descritores && obj.descritores.length ? `Perfil na xícara: ${obj.descritores.join(', ')}.` : 'Receita calibrada no Laboratório de Cafeteria.'),
        tags: [m.nome.split(' (')[0], `1:${obj.ratio}`, `${obj.tempC} °C`, `Nota ${Number(obj.nota || 8).toFixed(1)}`],
        updatedAt: new Date().toISOString(),
        payload: {
          metodoId: obj.metodoId,
          dose: obj.dose,
          water: obj.water,
          ratio: obj.ratio,
          tempC: obj.tempC,
          tempoS: obj.tempoS,
          clicks: obj.clicks,
          nota: obj.nota,
          descritores: Array.isArray(obj.descritores) ? obj.descritores : [],
          obs: obj.obs || '',
          graoSugerido: g.id ? {
            nome: g.nome,
            produtor: g.produtor || '',
            torrefacao: g.torrefacao || '',
            regiao: g.regiao || 'outra',
            processo: g.processo || 'natural',
            torra: g.torra || 'media',
            acidez: g.acidez || 3,
            corpo: g.corpo || 3,
            docura: g.docura || 4,
            notas: Array.isArray(g.notas) ? g.notas : []
          } : null
        }
      };
    } else if (tipo === 'moedor') {
      const refsCount = Object.keys(obj.refs || {}).length;
      item = {
        id: `com_moedor_${obj.id}`,
        autorUid,
        autorNome,
        autorTier: p.pingoStage.tier,
        tipo: 'moedor',
        titulo: obj.nome || 'Moedor Calibrado',
        subtitulo: `${obj.tipo === 'elétrico' ? 'Elétrico' : 'Manual'} · Escala ${obj.min}–${obj.max} · Passo ${obj.passo}`,
        resumo: obj.obs || `Mapa de cliques calibrado para ${refsCount} método(s).`,
        tags: [obj.tipo === 'elétrico' ? 'Moedor Elétrico' : 'Moedor Manual', `${obj.min}–${obj.max} cl`, `${refsCount} métodos`],
        updatedAt: new Date().toISOString(),
        payload: {
          nome: obj.nome,
          tipo: obj.tipo || 'manual',
          min: obj.min,
          max: obj.max,
          passo: obj.passo || 1,
          passoAjuste: obj.passoAjuste || null,
          direcao: obj.direcao || 'menor=fino',
          obs: obj.obs || '',
          refs: Object.assign({}, obj.refs || {})
        }
      };
    } else if (tipo === 'metodo') {
      item = {
        id: `com_metodo_${obj.id}`,
        autorUid,
        autorNome,
        autorTier: p.pingoStage.tier,
        tipo: 'metodo',
        titulo: obj.nome || 'Método Personalizado',
        subtitulo: `Base ${(lab.metodo(obj.base) || {}).nome || obj.base || 'Filtro'} · 1:${obj.ratioPadrao || 16}`,
        resumo: obj.obs || 'Método personalizado de bancada.',
        tags: ['Método Personalizado', `1:${obj.ratioPadrao || 16}`, `${obj.tempPadrao || 93} °C`],
        updatedAt: new Date().toISOString(),
        payload: Object.assign({}, obj)
      };
    }

    if (!item) return null;

    // Salva localmente na vitrine do usuário
    const idx = com.meusItens.findIndex((x) => x.id === item.id);
    if (idx >= 0) com.meusItens[idx] = item;
    else com.meusItens.unshift(item);
    com.compartilhados = (com.compartilhados || 0) + 1;
    lab.save();

    // Se estiver conectado à nuvem Google, publica também no Cloud Firestore
    let nuvemOk = false;
    if (window.CafeSync && window.CafeSync.usuarioAtual && window.CafeSync.usuarioAtual()) {
      try {
        await window.CafeSync.publicarItemComunidade(item);
        await sincronizarPerfilPublico();
        nuvemOk = true;
      } catch (e) { /* salvo localmente */ }
    }

    lab.toast(nuvemOk
      ? '🌎 Publicado na Vitrine da Comunidade (Nuvem)!'
      : '🌎 Adicionado à Vitrine da Comunidade!');
    return item;
  }

  function importarItemComunidade(item) {
    if (!item || !item.payload) return;
    const s = lab.state();
    const com = cfgComunidade();
    const p = item.payload;

    if (item.tipo === 'grao') {
      const jaExiste = s.graos.find((g) => g.nome.toLowerCase() === String(p.nome || '').toLowerCase());
      if (jaExiste) {
        lab.toast(`Grão "${jaExiste.nome}" já está no seu catálogo!`);
        lab.go(`#/grao/${jaExiste.id}`);
        return;
      }
      const novoGrao = {
        id: lab.uid(),
        nome: p.nome || item.titulo,
        produtor: p.produtor || '',
        torrefacao: p.torrefacao || '',
        regiao: p.regiao || 'outra',
        variedade: p.variedade || '',
        processo: p.processo || 'natural',
        torra: p.torra || 'media',
        especie: p.especie || 'arabica',
        altitude: p.altitude || '',
        pontuacao: p.pontuacao || '',
        acidez: Number(p.acidez || 3),
        corpo: Number(p.corpo || 3),
        docura: Number(p.docura || 4),
        notas: Array.isArray(p.notas) ? p.notas.slice() : [],
        obs: p.dica ? `Importado da Comunidade (${item.autorNome}): ${p.dica}` : `Importado da Comunidade (${item.autorNome}).`,
        criadoEm: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      s.graos.unshift(novoGrao);
      com.importados = (com.importados || 0) + 1;
      lab.save();
      lab.toast(`📥 Grão "${novoGrao.nome}" importado para o seu Lab!`);
      lab.go(`#/grao/${novoGrao.id}`);
      return;
    }

    if (item.tipo === 'receita') {
      let gAlvo = null;
      if (p.graoSugerido && p.graoSugerido.nome) {
        gAlvo = s.graos.find((g) => g.nome.toLowerCase() === p.graoSugerido.nome.toLowerCase());
        if (!gAlvo) {
          gAlvo = {
            id: lab.uid(),
            nome: p.graoSugerido.nome,
            produtor: p.graoSugerido.produtor || '',
            torrefacao: p.graoSugerido.torrefacao || '',
            regiao: p.graoSugerido.regiao || 'mantiqueira',
            processo: p.graoSugerido.processo || 'natural',
            torra: p.graoSugerido.torra || 'media-clara',
            especie: 'arabica',
            acidez: Number(p.graoSugerido.acidez || 4),
            corpo: Number(p.graoSugerido.corpo || 3),
            docura: Number(p.graoSugerido.docura || 4),
            notas: Array.isArray(p.graoSugerido.notas) ? p.graoSugerido.notas.slice() : [],
            obs: `Grão sugerido na receita de ${item.autorNome}.`,
            criadoEm: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          s.graos.unshift(gAlvo);
        }
      } else {
        gAlvo = s.graos.find((g) => !g.arquivado);
      }

      const mdPadrao = s.moedores[0];
      const novaExtracao = {
        id: lab.uid(),
        graoId: gAlvo ? gAlvo.id : '',
        metodoId: p.metodoId || 'v60',
        moedorId: mdPadrao ? mdPadrao.id : '',
        data: new Date().toISOString(),
        clicks: p.clicks != null ? p.clicks : null,
        dose: Number(p.dose || 15),
        water: Number(p.water || 240),
        ratio: Number(p.ratio || 16),
        tempC: Number(p.tempC || 93),
        tempoS: Number(p.tempoS || 150),
        acidez: 4,
        docura: 5,
        amargor: 2,
        corpo: 3,
        final: 4,
        sinais: [],
        descritores: Array.isArray(p.descritores) ? p.descritores.slice() : [],
        nota: Number(p.nota || 9.0),
        obs: `[Receita da Comunidade por ${item.autorNome}] ${p.obs || ''}`.trim(),
        updatedAt: new Date().toISOString()
      };
      const mObj = lab.metodo(novaExtracao.metodoId);
      if (E && E.diagnose && mObj) novaExtracao.diag = E.diagnose(novaExtracao, mObj, gAlvo);
      s.extracoes.push(novaExtracao);
      com.importados = (com.importados || 0) + 1;
      lab.save();
      lab.toast(`📥 Receita "${item.titulo}" importada para o seu Diário!`);
      lab.go(`#/extracao/${novaExtracao.id}`);
      return;
    }

    if (item.tipo === 'moedor') {
      const jaExiste = s.moedores.find((m) => m.nome.toLowerCase() === String(p.nome || '').toLowerCase());
      if (jaExiste) {
        lab.toast(`Moedor "${jaExiste.nome}" já está nos seus equipamentos!`);
        lab.go('#/moedores');
        return;
      }
      const novoMoedor = {
        id: lab.uid(),
        nome: p.nome || item.titulo,
        tipo: p.tipo || 'manual',
        min: Number(p.min || 0),
        max: Number(p.max || 40),
        passo: Number(p.passo || 1),
        passoAjuste: p.passoAjuste || null,
        direcao: p.direcao || 'menor=fino',
        obs: p.obs || `Importado da Comunidade (${item.autorNome}).`,
        refs: Object.assign({}, p.refs || {}),
        updatedAt: new Date().toISOString()
      };
      s.moedores.push(novoMoedor);
      com.importados = (com.importados || 0) + 1;
      lab.save();
      lab.toast(`📥 Moedor "${novoMoedor.nome}" importado com mapa de cliques!`);
      lab.go('#/moedores');
      return;
    }

    if (item.tipo === 'metodo') {
      s.metodos = s.metodos || [];
      const jaExiste = s.metodos.find((m) => m.nome.toLowerCase() === String(p.nome || '').toLowerCase());
      if (jaExiste) {
        lab.toast(`Método "${jaExiste.nome}" já está cadastrado!`);
        lab.go('#/equipamentos');
        return;
      }
      const novoMetodo = {
        id: 'custom_' + lab.uid(),
        nome: p.nome || item.titulo,
        base: p.base || 'v60',
        icone: p.icone || '🧪',
        dosePadrao: Number(p.dosePadrao || 15),
        ratioPadrao: Number(p.ratioPadrao || 16),
        tempPadrao: Number(p.tempPadrao || 93),
        tempoMin: Number(p.tempoMin || 150),
        tempoMax: Number(p.tempoMax || 195),
        obs: p.obs || `Importado da Comunidade (${item.autorNome}).`,
        updatedAt: new Date().toISOString()
      };
      s.metodos.push(novoMetodo);
      com.importados = (com.importados || 0) + 1;
      lab.save();
      lab.toast(`📥 Método "${novoMetodo.nome}" importado para seus Equipamentos!`);
      lab.go('#/equipamentos');
    }
  }

  /* ---------- Modal para Compartilhar Item da Própria Bancada ---------- */
  function modalCompartilharBancada(onDone) {
    const s = lab.state();
    const graos = (s.graos || []).filter((g) => !g.arquivado);
    const receitas = (s.extracoes || []).filter((x) => Number(x.nota || 0) >= 8).sort((a, b) => Number(b.nota || 0) - Number(a.nota || 0));
    const moedores = s.moedores || [];
    const metodos = s.metodos || [];

    lab.modal(`<div class="sheet-head"><h2>🌎 Compartilhar na Comunidade</h2><button class="btn sm ghost" data-close>✕</button></div>
      <p class="text-2" style="margin-top:0">Escolha um item da sua bancada para publicar na Vitrine da Comunidade. Apenas o item selecionado será compartilhado.</p>
      <form id="fShareCom">
        <label class="field"><span class="lbl">O que você quer compartilhar?</span>
          <select name="tipo" id="selTipoCom">
            <option value="receita">☕ Receita Calibrada (${receitas.length})</option>
            <option value="grao">🫘 Grão Especial do Catálogo (${graos.length})</option>
            <option value="moedor">⚙️ Moedor & Mapa de Cliques (${moedores.length})</option>
            ${metodos.length ? `<option value="metodo">🧪 Método Personalizado (${metodos.length})</option>` : ''}
          </select>
        </label>
        <label class="field" id="wrapItemCom"><span class="lbl">Selecione o item</span>
          <select name="itemId" id="selItemCom"></select>
        </label>
        <div class="sheet-foot">
          <button type="button" class="btn" data-close>Cancelar</button>
          <button type="submit" class="btn primary">🌎 Publicar na Vitrine</button>
        </div>
      </form>`, (sheet) => {
      const selTipo = lab.$('#selTipoCom', sheet);
      const selItem = lab.$('#selItemCom', sheet);

      const popular = () => {
        const t = selTipo.value;
        if (t === 'receita') {
          selItem.innerHTML = receitas.length
            ? receitas.map((x) => {
                const g = lab.grao(x.graoId);
                const m = lab.metodo(x.metodoId);
                return `<option value="${x.id}">${lab.esc((m ? m.nome.split(' (')[0] : x.metodoId) + ' · ' + (g ? g.nome : 'Café') + ' (Nota ' + Number(x.nota).toFixed(1) + ')')}</option>`;
              }).join('')
            : '<option value="">Nenhuma extração com nota ≥ 8.0 ainda</option>';
        } else if (t === 'grao') {
          selItem.innerHTML = graos.length
            ? graos.map((g) => `<option value="${g.id}">${lab.esc(g.nome)}</option>`).join('')
            : '<option value="">Nenhum grão ativo cadastrado</option>';
        } else if (t === 'moedor') {
          selItem.innerHTML = moedores.length
            ? moedores.map((m) => `<option value="${m.id}">${lab.esc(m.nome)}</option>`).join('')
            : '<option value="">Nenhum moedor cadastrado</option>';
        } else if (t === 'metodo') {
          selItem.innerHTML = metodos.length
            ? metodos.map((m) => `<option value="${m.id}">${lab.esc(m.nome)}</option>`).join('')
            : '<option value="">Nenhum método personalizado</option>';
        }
      };

      selTipo.onchange = popular;
      popular();

      lab.$('#fShareCom', sheet).onsubmit = async (e) => {
        e.preventDefault();
        const t = selTipo.value;
        const id = selItem.value;
        if (!id) { lab.toast('Selecione um item válido.'); return; }
        let obj = null;
        if (t === 'receita') obj = lab.extracao(id);
        else if (t === 'grao') obj = lab.grao(id);
        else if (t === 'moedor') obj = lab.moedor(id);
        else if (t === 'metodo') obj = (s.metodos || []).find((m) => m.id === id);
        if (!obj) return;
        lab.closeModal();
        await compartilharItem(t, obj);
        if (onDone) onDone();
      };
    });
  }

  /* ---------- Cache em memória para itens da nuvem ---------- */
  let cacheVitrineNuvem = [];
  let cacheRankingNuvem = [];
  let carregandoComunidade = false;

  async function atualizarDadosNuvemSilencioso(view, r) {
    if (!window.CafeSync || carregandoComunidade) return;
    carregandoComunidade = true;
    try {
      const [itens, perfis] = await Promise.all([
        window.CafeSync.listarItensComunidade ? window.CafeSync.listarItensComunidade() : Promise.resolve([]),
        window.CafeSync.listarPerfisComunidade ? window.CafeSync.listarPerfisComunidade() : Promise.resolve([])
      ]);
      const mudouItens = Array.isArray(itens) && itens.length !== cacheVitrineNuvem.length;
      const mudouPerfis = Array.isArray(perfis) && perfis.length !== cacheRankingNuvem.length;
      if (Array.isArray(itens)) cacheVitrineNuvem = itens;
      if (Array.isArray(perfis)) cacheRankingNuvem = perfis;
      if ((mudouItens || mudouPerfis) && location.hash.startsWith('#/comunidade')) {
        lab.routes.comunidade(view, r);
      }
    } catch (e) { /* offline fallback */ }
    carregandoComunidade = false;
  }

  function obterItensVitrine() {
    const com = cfgComunidade();
    const mapa = new Map();
    (com.meusItens || []).forEach((it) => mapa.set(it.id, it));
    (cacheVitrineNuvem || []).forEach((it) => { if (it && it.id) mapa.set(it.id, it); });
    VITRINE_SEED.forEach((it) => { if (!mapa.has(it.id)) mapa.set(it.id, it); });
    return Array.from(mapa.values()).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  function obterPerfisRanking(perfilLocal) {
    const com = cfgComunidade();
    const u = window.CafeSync && window.CafeSync.usuarioAtual && window.CafeSync.usuarioAtual();
    const s = lab.state();
    const meuUid = (u && u.uid) || 'voce_local';
    const mapa = new Map();

    RANKING_SEED.forEach((p) => mapa.set(p.uid, p));
    (cacheRankingNuvem || []).forEach((p) => { if (p && p.uid) mapa.set(p.uid, p); });

    const moedores = (s.moedores || []).map((m) => m.nome).filter(Boolean).slice(0, 5);
    const metodos = perfilLocal.methodMasteries.filter((m) => m.extractionsCount > 0).map((m) => m.nome.split(' (')[0]).slice(0, 5);

    mapa.set(meuUid, {
      uid: meuUid,
      isMe: true,
      nome: (com.apelido || '').trim() || (u && u.nome) || 'Você (Sua Bancada)',
      foto: (u && u.foto) || '',
      nivel: perfilLocal.level,
      xpTotal: perfilLocal.totalXp,
      tier: perfilLocal.pingoStage.tier,
      titulo: perfilLocal.title,
      badgesCount: perfilLocal.stats.unlockedBadges,
      totalExtracoes: perfilLocal.stats.totalExtractions,
      calibradas: perfilLocal.stats.calibratedRecipes,
      moedores: moedores.length ? moedores : ['Sem moedor cadastrado'],
      metodos: metodos.length ? metodos : ['Em início de jornada']
    });

    return Array.from(mapa.values()).sort((a, b) => (b.xpTotal || 0) - (a.xpTotal || 0));
  }

  /* ================== ROTA PRINCIPAL: #/comunidade ================== */
  lab.routes.comunidade = (view, r) => {
    lab.$('#title').textContent = 'Evolução & Comunidade';
    const tab = (r && r.q && r.q.tab) || 'evolucao';
    const cat = (r && r.q && r.q.cat) || 'todas';
    const tipoFiltro = (r && r.q && r.q.tipo) || 'todos';
    const p = calcularPerfilBarista();
    const estagios = (window.Mascote && window.Mascote.PINGO_ESTAGIOS) || [];
    const com = cfgComunidade();

    // Dispara atualização silenciosa dos itens da nuvem
    atualizarDadosNuvemSilencioso(view, r);

    const tabsHtml = `<div class="tabs">
      <button class="tab ${tab === 'evolucao' ? 'on' : ''}" data-tab="evolucao">🏆 Minha Evolução</button>
      <button class="tab ${tab === 'vitrine' ? 'on' : ''}" data-tab="vitrine">🌎 Vitrine da Comunidade</button>
      <button class="tab ${tab === 'ranking' ? 'on' : ''}" data-tab="ranking">🥇 Ranking & Bancadas</button>
    </div>`;

    let bodyHtml = '';

    if (tab === 'evolucao') {
      const badgesFiltradas = p.badges.filter((b) => cat === 'todas' || b.category === cat);
      const metodosComUso = p.methodMasteries.filter((m) => m.extractionsCount > 0);
      const metodosExibidos = metodosComUso.length ? p.methodMasteries : p.methodMasteries.slice(0, 8);

      bodyHtml = `
        <div class="card gamif-hero" style="margin-top:10px">
          <div class="gamif-hero-top">
            <div class="gamif-avatar-box">
              ${window.Mascote ? window.Mascote.svg('radiante', { size: 108, tier: p.pingoStage.tier }) : ''}
              <span class="badge ok" style="margin-top:4px">Tier ${p.pingoStage.tier}/5</span>
            </div>
            <div class="gamif-hero-info">
              <div class="row" style="gap:6px;flex-wrap:wrap">
                <span class="badge accent">Nível ${p.level}</span>
                <span class="badge">${lab.esc(p.pingoStage.name)}</span>
              </div>
              <h2 style="margin:6px 0 2px">${lab.esc(p.title)}</h2>
              <p class="text-2" style="margin:0 0 8px"><small>${lab.esc(p.pingoStage.subtitle)} — ${lab.esc(p.pingoStage.perk)}</small></p>
              <div class="xp-bar-wrap">
                <div class="row between"><small><strong>${p.totalXp} XP</strong> acumulados</small><small class="muted">Faltam ${Math.max(0, p.nextLevelXp - p.currentLevelXp)} XP p/ Nv. ${p.level + 1}</small></div>
                <div class="xp-track lg"><div class="xp-fill" style="width:${p.progressPct}%"></div></div>
              </div>
            </div>
          </div>
          <div class="stats" style="margin-top:12px">
            <div class="stat"><span class="lbl">Extrações</span><div class="hero-num">${p.stats.totalExtractions}</div></div>
            <div class="stat"><span class="lbl">Calibradas</span><div class="hero-num">${p.stats.calibratedRecipes}</div></div>
            <div class="stat"><span class="lbl">God Shots (9.5+)</span><div class="hero-num">${p.stats.godShots}</div></div>
            <div class="stat"><span class="lbl">Conquistas</span><div class="hero-num">${p.stats.unlockedBadges}<small style="font-size:.9rem">/${p.stats.totalBadges}</small></div></div>
          </div>
        </div>

        <div class="section-title"><h2>Jornada de Evolução do Pingo</h2><small class="muted">5 estágios visuais</small></div>
        <div class="pingo-stages-grid">
          ${estagios.map((st) => {
            const desbloqueado = p.level >= st.minLevel;
            const atual = p.pingoStage.tier === st.tier;
            return `<div class="card stage-card ${atual ? 'atual' : ''} ${desbloqueado ? 'unlocked' : 'locked'}">
              <div class="stage-fig">${window.Mascote ? window.Mascote.svg(atual ? 'radiante' : desbloqueado ? 'feliz' : 'sonolento', { size: 68, tier: st.tier }) : ''}</div>
              <div class="stage-meta">
                <div class="row between" style="gap:4px">
                  <strong>${lab.esc(st.name)}</strong>
                  <span class="badge ${atual ? 'ok' : desbloqueado ? 'accent' : ''}">${atual ? 'Atual' : desbloqueado ? `✓ Nv. ${st.minLevel}+` : `🔒 Nv. ${st.minLevel}`}</span>
                </div>
                <small class="text-2">${lab.esc(st.subtitle)}</small>
                <small class="muted" style="display:block;margin-top:2px">${lab.esc(st.perk)}</small>
              </div>
            </div>`;
          }).join('')}
        </div>

        <div class="section-title"><h2>Maestria por Método</h2><small class="muted">Níveis 1 a 10</small></div>
        <div class="mastery-grid">
          ${metodosExibidos.map((m) => `
            <div class="card mastery-card ${m.extractionsCount ? '' : 'soft'}">
              <div class="row between">
                <div class="row" style="gap:8px">
                  <span class="ico m" style="width:34px;height:34px">${m.icone}</span>
                  <div>
                    <strong style="display:block">${lab.esc(m.nome.split(' (')[0])}</strong>
                    <small class="muted">${lab.esc(m.title)}</small>
                  </div>
                </div>
                <span class="badge ${m.level >= 5 ? 'ok' : m.extractionsCount ? 'accent' : ''}">Nv. ${m.level}/10</span>
              </div>
              <div class="xp-track" style="margin:8px 0 4px"><div class="xp-fill" style="width:${m.progressPct}%"></div></div>
              <div class="row between">
                <small class="muted">${m.xp} XP · ${m.extractionsCount} extr. · ${m.calibratedCount} calib.</small>
                <small class="muted">${m.bestScore ? `Melhor: ${m.bestScore.toFixed(1)}` : 'Sem nota'}</small>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="section-title"><h2>Galeria de Conquistas (Badges)</h2><small class="muted">${p.stats.unlockedBadges} de ${p.stats.totalBadges} desbloqueadas</small></div>
        <div class="chips" style="margin-bottom:10px">
          ${[
            ['todas', 'Todas'],
            ['moagem', '🎯 Moagem'],
            ['metodo', '📐 Método'],
            ['sensorial', '🍋 Sensorial'],
            ['maestria', '👑 Maestria']
          ].map(([id, rot]) => `<button type="button" class="chip ${cat === id ? 'on' : ''}" data-cat="${id}">${rot}</button>`).join('')}
        </div>
        <div class="badges-grid">
          ${badgesFiltradas.map((b) => `
            <div class="card badge-card ${b.unlocked ? 'unlocked' : 'locked'}">
              <div class="badge-ico">${b.icon}</div>
              <div class="badge-body">
                <div class="row between" style="gap:4px">
                  <strong>${lab.esc(b.title)}</strong>
                  <span class="badge ${b.unlocked ? 'ok' : ''}">+${b.xpReward} XP</span>
                </div>
                <p class="text-2" style="margin:4px 0"><small>${lab.esc(b.description)}</small></p>
                <small class="${b.unlocked ? 'badge-ok-txt' : 'muted'}">${b.unlocked ? '✓ Desbloqueada' : '🔒 ' + lab.esc(b.progressText)}</small>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (tab === 'vitrine') {
      const todosItens = obterItensVitrine();
      const itens = todosItens.filter((it) => {
        if (tipoFiltro === 'todos') return true;
        if (tipoFiltro === 'equipamento') return it.tipo === 'moedor' || it.tipo === 'metodo';
        return it.tipo === tipoFiltro;
      });
      const tipoBadge = {
        grao: '🫘 Grão Especial',
        receita: '☕ Receita Calibrada',
        moedor: '⚙️ Moedor & Cliques',
        metodo: '🧪 Método Personalizado'
      };

      bodyHtml = `
        <div class="card soft" style="margin-top:10px">
          <div class="row between" style="flex-wrap:wrap;gap:8px">
            <div>
              <h3 style="margin:0">🌎 Vitrine de Cafés, Receitas & Equipamentos</h3>
              <small class="text-2">Explore cafés especiais, receitas calibradas e mapas de moedores da comunidade ou compartilhe os seus.</small>
            </div>
            <button class="btn primary sm" id="btnShareBancada">＋ Compartilhar da minha bancada</button>
          </div>
        </div>

        <div class="chips" style="margin:10px 0">
          ${[
            ['todos', 'Todos (' + todosItens.length + ')'],
            ['receita', '☕ Receitas'],
            ['grao', '🫘 Grãos Especiais'],
            ['equipamento', '⚙️ Moedores & Métodos']
          ].map(([id, rot]) => `<button type="button" class="chip ${tipoFiltro === id ? 'on' : ''}" data-tipo="${id}">${rot}</button>`).join('')}
        </div>

        <div class="grid">
          ${itens.map((it) => `
            <div class="card com-card">
              <div class="row between" style="gap:6px">
                <span class="badge accent">${tipoBadge[it.tipo] || 'Comunidade'}</span>
                <small class="muted">por <strong>${lab.esc(it.autorNome || 'Barista')}</strong></small>
              </div>
              <h3 style="margin:8px 0 2px">${lab.esc(it.titulo)}</h3>
              <small class="text-2" style="display:block;font-weight:600">${lab.esc(it.subtitulo || '')}</small>
              <p class="text-2" style="margin:6px 0 8px"><small>${lab.esc(it.resumo || '')}</small></p>
              ${it.tags && it.tags.length ? `<div class="chips" style="margin-bottom:10px">${it.tags.map((tg) => `<span class="chip static">${lab.esc(tg)}</span>`).join('')}</div>` : ''}
              <div class="row between" style="margin-top:auto;padding-top:6px;border-top:1px solid var(--border)">
                <button type="button" class="btn primary sm" data-import="${lab.esc(it.id)}">📥 Importar para meu Lab</button>
                ${(com.meusItens || []).some((m) => m.id === it.id) ? `<button type="button" class="btn danger sm ghost" data-del-com="${lab.esc(it.id)}">Remover</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (tab === 'ranking') {
      const perfis = obterPerfisRanking(p);
      const u = window.CafeSync && window.CafeSync.usuarioAtual && window.CafeSync.usuarioAtual();

      bodyHtml = `
        <div class="card" style="margin-top:10px">
          <div class="row between" style="flex-wrap:wrap;gap:8px">
            <div>
              <h3 style="margin:0">👤 Meu Perfil na Comunidade</h3>
              <small class="text-2">${u ? `Conectado como ${lab.esc(u.email || u.nome)}` : 'Defina seu apelido de barista e escolha se sua bancada aparece no ranking público.'}</small>
            </div>
            ${!u ? '<a class="btn sm primary" href="#/sync">☁ Conectar Google</a>' : '<button class="btn sm" id="btnSyncPerfil">🔄 Atualizar no Ranking</button>'}
          </div>
          <div class="form-grid" style="margin-top:10px">
            <label class="field">
              <span class="lbl">Apelido de Barista</span>
              <input type="text" id="inpApelido" placeholder="Ex.: Arthur · Lab Café" value="${lab.esc(com.apelido || (u && u.nome) || '')}">
            </label>
            <label class="field" style="justify-content:flex-end">
              <span class="lbl">Visibilidade da Bancada</span>
              <label class="check" style="margin-top:6px">
                <input type="checkbox" id="chkPublico" ${com.perfilPublico !== false ? 'checked' : ''}>
                Exibir meu nível e equipamentos no ranking
              </label>
            </label>
          </div>
        </div>

        <div class="section-title"><h2>🥇 Ranking de Baristas & Bancadas</h2><small class="muted">${perfis.length} baristas ativos</small></div>
        <div class="list">
          ${perfis.map((b, idx) => {
            const pos = idx + 1;
            const medalha = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`;
            return `<div class="card rank-item ${b.isMe ? 'me' : ''}">
              <div class="rank-row">
                <div class="rank-pos">${medalha}</div>
                <div class="rank-avatar">${window.Mascote ? window.Mascote.svg('feliz', { size: 58, tier: b.tier || 1 }) : ''}</div>
                <div class="rank-info">
                  <div class="row between" style="gap:6px;flex-wrap:wrap">
                    <div>
                      <strong>${lab.esc(b.nome)}</strong> ${b.isMe ? '<span class="badge ok">Você</span>' : ''}
                      <div class="text-2"><small>Nv. ${b.nivel || 1} · ${lab.esc(b.titulo || 'Barista')}</small></div>
                    </div>
                    <div class="right">
                      <strong style="color:var(--accent)">${b.xpTotal || 0} XP</strong>
                      <div><small class="muted">🏆 ${b.badgesCount || 0} · ☕ ${b.totalExtracoes || 0} extr.</small></div>
                    </div>
                  </div>
                  <div class="chips" style="margin-top:6px">
                    ${(b.moedores || []).map((md) => `<span class="chip static">⚙️ ${lab.esc(md)}</span>`).join('')}
                    ${(b.metodos || []).map((mt) => `<span class="chip static">☕ ${lab.esc(mt)}</span>`).join('')}
                  </div>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      `;
    }

    view.innerHTML = tabsHtml + bodyHtml;

    // Bind de navegação de abas e filtros
    lab.$$('.tab[data-tab]', view).forEach((btn) => {
      btn.onclick = () => lab.go(`#/comunidade?tab=${btn.dataset.tab}`);
    });
    lab.$$('.chip[data-cat]', view).forEach((btn) => {
      btn.onclick = () => lab.go(`#/comunidade?tab=evolucao&cat=${btn.dataset.cat}`);
    });
    lab.$$('.chip[data-tipo]', view).forEach((btn) => {
      btn.onclick = () => lab.go(`#/comunidade?tab=vitrine&tipo=${btn.dataset.tipo}`);
    });

    // Bind de ações da Vitrine
    const btnShareBancada = lab.$('#btnShareBancada', view);
    if (btnShareBancada) {
      btnShareBancada.onclick = () => modalCompartilharBancada(() => lab.routes.comunidade(view, r));
    }
    lab.$$('[data-import]', view).forEach((btn) => {
      btn.onclick = () => {
        const item = obterItensVitrine().find((x) => x.id === btn.dataset.import);
        if (item) importarItemComunidade(item);
      };
    });
    lab.$$('[data-del-com]', view).forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.delCom;
        com.meusItens = (com.meusItens || []).filter((x) => x.id !== id);
        cacheVitrineNuvem = (cacheVitrineNuvem || []).filter((x) => x.id !== id);
        lab.save();
        if (window.CafeSync && window.CafeSync.removerItemComunidade) {
          try { await window.CafeSync.removerItemComunidade(id); } catch (e) { /* */ }
        }
        lab.toast('Item removido da vitrine');
        lab.routes.comunidade(view, r);
      };
    });

    // Bind de ações do Ranking
    const inpApelido = lab.$('#inpApelido', view);
    if (inpApelido) {
      inpApelido.onchange = () => {
        com.apelido = inpApelido.value.trim();
        lab.save();
        sincronizarPerfilPublico();
        lab.toast('Apelido salvo');
        lab.routes.comunidade(view, r);
      };
    }
    const chkPublico = lab.$('#chkPublico', view);
    if (chkPublico) {
      chkPublico.onchange = () => {
        com.perfilPublico = chkPublico.checked;
        lab.save();
        sincronizarPerfilPublico();
        lab.toast(com.perfilPublico ? 'Bancada visível no ranking público' : 'Bancada ocultada do ranking público');
      };
    }
    const btnSyncPerfil = lab.$('#btnSyncPerfil', view);
    if (btnSyncPerfil) {
      btnSyncPerfil.onclick = async () => {
        lab.toast('Sincronizando perfil…');
        await sincronizarPerfilPublico();
        await atualizarDadosNuvemSilencioso(view, r);
        lab.toast('Ranking atualizado!');
      };
    }
  };

  /* ---------- Hooks de Integração com o App ---------- */
  // 1) Tile rápido na Home
  lab.hooks.tiles.push(() => {
    const p = calcularPerfilBarista();
    return `<a class="qa-tile" href="#/comunidade">
      <span class="qa-ico">🏆</span>
      <span class="qa-t">Evolução & Comunidade</span>
      <span class="qa-s">Nv. ${p.level} · ${lab.esc(p.title)} · ${p.stats.unlockedBadges}/${p.stats.totalBadges} insígnias</span>
    </a>`;
  });

  // 2) Item no menu "Mais"
  lab.hooks.mais.push(() => {
    const p = calcularPerfilBarista();
    return `<div class="item" onclick="location.hash='#/comunidade'">
      <div class="ico">🏆</div>
      <div>
        <div class="t">Evolução & Comunidade</div>
        <div class="s">Nível ${p.level} (${lab.esc(p.pingoStage.name)}) · Vitrine de cafés, receitas e ranking</div>
      </div>
      <div>›</div>
    </div>`;
  });

  // 3) Recompensa de XP e celebração ao salvar uma nova extração
  lab.hooks.extracaoSalva.push((brew) => {
    try {
      const s = lab.state();
      const com = cfgComunidade();
      const g = lab.grao(brew.graoId);
      const anteriores = (s.extracoes || []).filter((x) => x.id !== brew.id);
      const xpRes = calcularXpExtracao(brew, anteriores, g, s.config && s.config.notaAlvo);
      const p = calcularPerfilBarista();

      // Verifica se subiu de nível ou desbloqueou novas badges
      const subiuNivel = p.level > (com.ultimoNivelCelebrado || 1);
      const novasBadges = p.badges.filter((b) => b.unlocked && !(com.badgesCelebradas || []).includes(b.id));

      com.ultimoNivelCelebrado = p.level;
      com.badgesCelebradas = p.badges.filter((b) => b.unlocked).map((b) => b.id);
      lab.save();

      const msgXp = `+${xpRes.total} XP (${xpRes.breakdown.map((b) => b.label).join(' · ')})`;
      if (subiuNivel) {
        setTimeout(() => lab.toast(`🎉 Nível ${p.level} alcançado: ${p.title}! (${msgXp})`), 900);
      } else if (novasBadges.length) {
        setTimeout(() => lab.toast(`🏅 Conquista desbloqueada: ${novasBadges[0].icon} ${novasBadges[0].title}! (+${xpRes.total} XP)`), 900);
      } else {
        setTimeout(() => lab.toast(`✨ ${msgXp}`), 900);
      }

      sincronizarPerfilPublico();
    } catch (e) { /* não interrompe o fluxo de salvamento */ }
  });

  // Inicializa o marcador de nível/badges já conquistados no boot para não repetir alertas antigos
  lab.hooks.boot.push(() => {
    try {
      const com = cfgComunidade();
      const p = calcularPerfilBarista();
      if (!com.badgesCelebradas || !com.badgesCelebradas.length) {
        com.badgesCelebradas = p.badges.filter((b) => b.unlocked).map((b) => b.id);
      }
      if ((com.ultimoNivelCelebrado || 1) < p.level) {
        com.ultimoNivelCelebrado = p.level;
      }
    } catch (e) { /* */ }
  });

  window.CafeGamificacao = {
    LEVEL_TITLES,
    METHOD_LEVEL_TITLES,
    BADGES_CATALOG,
    VITRINE_SEED,
    RANKING_SEED,
    calcularXpExtracao,
    calcularMaestriaMetodos,
    avaliarBadges,
    calcularPerfilBarista,
    tierAtual,
    barraHomeHtml,
    compartilharItem,
    importarItemComunidade,
    modalCompartilharBancada,
    sincronizarPerfilPublico
  };
})();
